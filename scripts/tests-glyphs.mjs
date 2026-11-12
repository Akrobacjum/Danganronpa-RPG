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
const dataUriOf = g => 'url("data:image/svg+xml,' + `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${g.grid} ${g.grid}' shape-rendering='crispEdges'><path fill='%23000' d='${pathOf(g.rows)}'/></svg>`
    .replaceAll("<", "%3C").replaceAll(">", "%3E").replaceAll("#", "%23").replaceAll('"', "'") + '")';

export function spriteOf(glyphs) {
    /* E48 G3: after the px set, every glass row as `pix-<name>`, the later stages' drawings among them - the one served
       file that holds a drawing no rule wears yet. */
    const glass = glyphs.filter(g => g.family === "glass").map(g => `<symbol id="pix-${g.name}" viewBox="0 0 24 24"><path fill="currentColor" d="${pathOf(g.rows)}"/></symbol>`);
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n' + [...generated(glyphs).map(symbolOf), ...glass].join("\n") + "\n</svg>\n";
}

export function pixelCssOf(glyphs) {
    const css = ["/* Generated by tools/glyph-map.mjs from tools/glyphs.json - do not edit by hand.",
        "   THE ONE PREFIX (E48 G4, 11.11.2026). Every glyph a rule reads is `--drpg-pix-<name>`, named by meaning.",
        "   The :root block below is Monokuma Legacy's drawings, family legacy, declared for both themes as they were:",
        "   danganronpa.css's hand-drawn tokens (the g, r and pix prefixes) and stained-glass.css's two, and the px",
        "   drawings a sheet or a script read by name under the px prefix (the clock's phase stamp, the Event panel's",
        "   kind, the notices' sources, the voice tile's buttons, the projects tray's glyphs). Stained Glass declares",
        "   its own set over the same names at the end of this file (the glass section), so one rule wears each theme's",
        "   drawing; Legacy reads none of the glass section (option A).",
        "",
        "   UNSCOPED, since 1.2.47 (the px set on the body then): a token declared only under Stained Glass resolved to",
        "   nothing under Legacy, and an undefined mask is no mask at all - each glyph came out as a solid square of its",
        "   own colour. On :root since G4, where danganronpa.css held the g, r and pix tokens: diagnostics.mjs and the",
        "   theme-tokens test read the sheets' arrival there, and the body and all in it inherit them.",
        "   `--drpg-glyph` is the slot an icon element reads its glyph from (the px prefix's `mask` slot until G4).",
        "   The sprite is icons/pixel-sprite.svg. */",
        ":root {"];
    for (const g of glyphs.filter(g => g.family === "legacy")) css.push(`    --drpg-pix-${g.name}: ${dataUriOf(g)};`);
    css.push("}");
    const sel = fa => `${GLASS} [class*="drpg-"] i.fa-${fa},\n${GLASS} i.drpg-action-icon.fa-${fa},\n${GLASS} [class*="drpg-"] .fa-${fa}:is(i, span)`;
    /* E48 G3: FACES, each FA name to the glass glyph of its meaning (`--drpg-pix-`), declared in the glass section below;
       the mask in longhands, so a cascade that knows no `mask` shorthand (jsdom's) reads the slot as a browser does. */
    const names = Object.keys(FACES);
    css.push(names.map(sel).join(",\n") + ` {
    display: inline-block;
    width: max(1.15em, 22px);
    height: max(1.15em, 22px);
    min-width: 22px;
    min-height: 22px;
    vertical-align: -0.2em;
    background-color: currentColor;
    -webkit-mask-image: var(--drpg-glyph);
    mask-image: var(--drpg-glyph);
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    image-rendering: pixelated;
}
` + names.map(fa => sel(fa).replaceAll(",\n", "::before,\n") + "::before").join(",\n") + " { content: none; }");
    for (const [fa, n] of Object.entries(FACES)) css.push(sel(fa).replaceAll("\n", " ") + ` { --drpg-glyph: var(--drpg-pix-${n}); }`);
    return css.join("\n") + "\n" + glassCssOf(glyphs);
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
    const firstLegacy = data.glyphs.findIndex(g => g.family === "legacy" && !g.same);
    const firstRule = data.glyphs.findIndex(g => g.rule);
    const plants = [
        ["a pixel of the generated set flipped", edit(g => { g[firstPx].rows[5] = flip(g[firstPx].rows[5], 5); }), `${SPRITE} is not what`],
        ["a row one cell short", edit(g => { g[firstPx].rows[3] = g[firstPx].rows[3].slice(1); }), "is not 24 cells"],
        ["two rows drawing the same pixels, no `same`", edit(g => { g[firstPx + 1].rows = [...g[firstPx].rows]; }), "none says `same`"],
        ["a `same` naming a row that draws other pixels", edit(g => { g[firstPx + 1].same = id(g[firstPx]); }), "draw different pixels"],
        ["a legacy row redrawn, pixel-icons.css not regenerated", edit(g => { g[firstLegacy].rows[0] = flip(g[firstLegacy].rows[0], 0); }), `${PIXEL_CSS} is not what`],
        ["a chrome rule's row drifted from the sheet", edit(g => { g[firstRule].rows[1] = flip(g[firstRule].rows[1], 1); }), `is not ${id(data.glyphs[firstRule])}'s drawing`],
        ["a sheet drawing no row holds", edit(g => { g.splice(firstRule, 1); }), "has no row for"],
        ["the generated css edited by hand", { ...files, [PIXEL_CSS]: files[PIXEL_CSS].replace("--drpg-pix-search: url(", "--drpg-pix-search:  url(") }, `${PIXEL_CSS} is not what`],
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
    glass: ["glass", "px", "legacy", "chrome"],
    legacy: ["legacy", "chrome", "px"]
};

/** The keyed elements: config.mjs's ACTIONS, HOPE_CALLS, DESPAIR_CALLS, CRISIS_ACTIONS, MONOCUB, TRAP_TRIGGERS (the
 *  room triggers) and CLEANUP, each entry with an `icon`, and gm-panel.mjs's tiles (`{ key: "...", icon: "fa-..." }`,
 *  as `gm.<key>`) -> the glyph each wears, by meaning. Today's glyph where the FA table has one (83 on 10.11.2026);
 *  where it has none, the name the drawing rounds draw (10, gaps). */
export const ELEMENTS = {
    "ACTIONS.search": "search", "ACTIONS.observe": "observe", "ACTIONS.analyze": "brain",
    "ACTIONS.project": "hourglass", "ACTIONS.rest": "rest", "ACTIONS.listen": "listen", "ACTIONS.palm": "palm",
    "ACTIONS.tamper": "broom", "ACTIONS.directMurder": "direct-murder", "ACTIONS.move": "move", "ACTIONS.sabotage": "tamper",
    "HOPE_CALLS.support": "support", "HOPE_CALLS.experience": "cap", "HOPE_CALLS.ultimate": "star",
    "HOPE_CALLS.contribution": "contribution", "HOPE_CALLS.reroll": "reroll", "HOPE_CALLS.sprint": "sprint",
    "HOPE_CALLS.burst": "dynamic", "HOPE_CALLS.relief": "relief", "HOPE_CALLS.determination": "fist",
    "HOPE_CALLS.freeCrit": "loaded", "DESPAIR_CALLS.obstacle": "barrier", "DESPAIR_CALLS.forTheGame": "gift",
    "DESPAIR_CALLS.behindClosedDoors": "door", "DESPAIR_CALLS.thisWillHurt": "heartcrack",
    "DESPAIR_CALLS.paranoia": "paranoia", "DESPAIR_CALLS.chained": "chain", "DESPAIR_CALLS.silence": "silence",
    "DESPAIR_CALLS.fuelTheCub": "cub", "DESPAIR_CALLS.gameProtection": "trend-down",
    "DESPAIR_CALLS.favoriteProject": "trend-up", "DESPAIR_CALLS.feedOverflow": "wave",
    "DESPAIR_CALLS.contraband": "contraband", "DESPAIR_CALLS.publicAnnouncement": "horn",
    "DESPAIR_CALLS.motive": "envelope", "DESPAIR_CALLS.newRule": "gavel", "CRISIS_ACTIONS.useItem": "analyze",
    "CRISIS_ACTIONS.leaveClue": "leave-clue", "CRISIS_ACTIONS.secureTrace": "secure-trace", "CRISIS_ACTIONS.selfDefence": "shield",
    "CRISIS_ACTIONS.survive": "survive", "CRISIS_ACTIONS.roleReversal": "role-reversal", "CRISIS_ACTIONS.strike": "strike",
    "CRISIS_ACTIONS.pin": "down", "CRISIS_ACTIONS.keepDistance": "swap", "CRISIS_ACTIONS.weaponAttack": "murder",
    "CRISIS_ACTIONS.finishingBlow": "finishing-blow", "CRISIS_ACTIONS.sharedEscape": "shared-escape",
    "CRISIS_ACTIONS.doubleRoleReversal": "double-role-reversal", "CRISIS_ACTIONS.crimePartners": "crime-partners",
    "CRISIS_ACTIONS.avertedEyes": "eye-slash", "MONOCUB.abilities.meddle": "confusion", "TRAP_TRIGGERS.alone": "alone",
    "TRAP_TRIGGERS.enters": "enters", "TRAP_TRIGGERS.search": "search", "TRAP_TRIGGERS.rest": "rest",
    "TRAP_TRIGGERS.item": "item-used", "TRAP_TRIGGERS.project": "hourglass", "TRAP_TRIGGERS.sabotage": "tamper",
    "TRAP_TRIGGERS.stash": "stash", "TRAP_TRIGGERS.passage": "passage", "TRAP_TRIGGERS.manual": "trap-manual",
    "CLEANUP.actions.eraseTrace": "erase-trace", "CLEANUP.actions.misleadingTrail": "misleading-trail",
    "CLEANUP.actions.moveBody": "move-body", "gm.whoIsAlive": "pulse", "gm.projects": "checklist", "gm.sound": "sound",
    "gm.rules": "rules", "gm.murder": "gm-murder", "gm.investigation": "lens", "gm.trial": "scale", "gm.jump": "calendar",
    "gm.gmTeam": "team", "gm.roomSetup": "room-setup", "gm.tables": "table", "gm.voiceReset": "voice-reset",
    "gm.seasonSetup": "wand", "gm.mastermind": "mask", "gm.settings": "settings",
    "gm.failureLog": "bug", "gm.caseWindow": "case-backup"
};

/** What later stages build, by the inventory (S/stages/E48/GLYPH-INVENTORY.md, 10.11.2026): [row, stage, element,
 *  glyph or [two glyphs]]. A row's id is `F<row>`, a two-glyph row's halves `F<row>a` and `F<row>b`. */
export const FUTURE = [
    [1, "E48", "Notice history button", "history-12"],
    [2, "E48", "Microphone", "mic"],
    [3, "E48", "Microphone off", "mic-off"],
    [4, "E48", "Sound off", "sound-off"],
    [5, "E48", "Lock (manual GM mic lock)", "mic-lock"],
    [6, "E48", "Photo", "photo"],
    [7, "E48", "Chevron (description toggle)", "chevron"],
    [8, "E48", "Sound launcher gear", "gear"],
    [9, "E48", "Sound panel speaker", "sound"],
    [10, "E48", "Handbooks book launcher", "book"],
    [11, "E48", "GM launcher glyph", "gm"],
    [12, "E48", "Voice reset", "voice-reset"],
    [13, "E48", "End chapter", "end-chapter"],
    [14, "E48", "Find Passage (row)", "passage"],
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
    [28, "E97", "Case window launcher (Sprawa)", "case-backup"],
    [29, "E97", "Run realization", "run"],
    [30, "E97", "Undo realization", "undo"],
    [31, "E97", "Realization marker", "made"],
    [32, "E97", "Column order arrows", ["order-up", "order-down"]],
    [33, "E98", "Map view toggle", "map-view"],
    [34, "E98", "Table view toggle", "table-view"],
    [35, "E98", "Murder-bound toggle", "murder-bound"],
    [36, "E98", "Who has what (list)", "who-has"],
    [37, "E99", "Case schema button (console frame)", "case-map"],
    [38, "E99", "Node check box (conclusion, counter, solution)", "node-check"],
    [39, "E99", "Show summary", "summary"],
    [40, "E92", "Spectator badge (HUD / card)", "spectator"],
    [41, "E92", "Assign Spectator (Students window)", "assign-spectator"],
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
    [59, "E74", "Door list entries (closed, sealed)", ["closed-door", "sealed-door"]],
    [60, "E73", "Zone A / Zone B choice buttons", ["zone-a", "zone-b"]],
    [61, "E73", "Straw Poll", "straw-poll"],
    [62, "E73", "Logic Dive", "logic-dive"],
    [63, "E73", "Scrum Debate", "scrum"],
    [64, "E73", "Bar: Count now", "count-now"],
    [65, "E73", "Bar: Skip question", "skip"],
    [66, "E73", "Bar: Skip in Scrum", "skip"],
    [67, "E73", "Finding entry marks (Monokuma confirms / Class thinks)", ["finding-confirmed", "finding-thinks"]],
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
    [82, "E72", "Redeem waits (Events panel)", "redeem-wait"],
    /* E48 G3, 11.11.2026: what batch 4 drew past the inventory's 82 - E97's design notes (section 7) and the owner's two
       E69 marks of 10.11 - so the uniqueness and the drawn checks hold them too. */
    [83, "E97", "Check the case's consistency", "case-check"],
    [84, "E97", "Realization preview (and Show the preview when a body is found)", "preview"],
    [85, "E97", "Who left it (author)", "author"],
    [86, "E97", "Place on the map (the GM panel's question)", "place-trace"],
    [87, "E97", "Column order (sort)", "sort-column"],
    [88, "E97", "Add a deduction", "add-deduction"],
    [89, "E97", "Add a counter", "add-counter"],
    [90, "E97", "Add the solution", "add-solution"],
    [91, "E97", "Link an input to a deduction", "link"],
    [92, "E97", "Node state: held", "held"],
    [93, "E97", "Node state: on the map", "on-map"],
    [94, "E97", "Node state: planned", "planned"],
    [95, "E97", "Reachable (x of y past half)", "reachable"],
    [96, "E97", "Consistency problem on a node", "case-warn"],
    [97, "E69", "The hidden killer's \"?\" token (victim and witnesses)", "hidden-killer"],
    [98, "E69", "The killer's reveal prompt", "reveal"]
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
    /* Row 8 of 10.11 (the Spectator badge = Assign Spectator) is gone: the owner split it, a state against an action. */
    [["TRAP_TRIGGERS.passage", "F14"], "the secret passage: the room trigger and Analyze's Find Passage row (batch 2, 11.11)"],
    [["MONOCUB.abilities.meddle", "F69"], "the Monocub's Confusion: today's meddle and E72's Confusion tile are one ability (config.mjs MONOCUB.abilities.meddle; the owner, 11.11)"],
    [["gm.sound", "F9"], "the Sound panel: the GM's Sound tile opens it (sound-panel.mjs openSoundDialog), and the speaker the inventory gave it has no wearer of its own - read 11.11: --drpg-pix-speaker's one reader is the corner launcher, which wears the gear in both themes (stained-glass.css) and opens the Look dialog (look.mjs)"],
    [["gm.voiceReset", "F12"], "Voice reset: the inventory's row is the GM's tile (batch 2 drew it once for both)"],
    [["gm.caseWindow", "F28"], "the Case window: the GM's tile and E97's launcher open one window (gm-stores.mjs openCaseWindow)"]
];



/** Pairs that mean opposite things and must never look alike (S02-73). */
export const OPPOSITES = [
    ["ACTIONS.sabotage", "HOPE_CALLS.contribution"], ["ACTIONS.analyze", "DESPAIR_CALLS.paranoia"],
    ["ACTIONS.palm", "MONOCUB.abilities.meddle"], ["F2", "F3"], ["gm.sound", "F4"], ["F21a", "F21b"], ["F32a", "F32b"],
    ["F60a", "F60b"], ["F29", "F30"], ["F76", "F77"]
];

/** The Font Awesome classes markup carries where it has no element key -> the glyph Stained Glass wears for it (Q5: no
 *  markup change in E48). E48 G3, 11.11.2026: the FA table whole, each name now the `glass` row's of that meaning (the
 *  batch 1 redrawings keep their px names; `circle` is `resource-dot` and `skull` `direct-murder`, because `dot` and
 *  `skull` are already pix rows - Despair's 8- and 12-grid marks both themes read - and a glass declaration of that
 *  name would repaint them under Stained Glass with a drawing nobody approved for them), then batch 2's faces (Q4) and
 *  the four of its keyed group that markup also carries (Analyze's Find Stash and Find Passage rows, Tamper's cover
 *  row, the GM's voice tile), then batch 3's three of today's FA names that no file wears yet. */
export const FACES = {
    ...Object.fromEntries(Object.entries(FA).map(([fa, n]) => [fa, n === "dot" ? "resource-dot" : n === "skull" ? "direct-murder" : n])),
    "align-left": "description", "angles-up": "advance", "circle-info": "callout-note", "circle-exclamation": "callout-important",
    "triangle-exclamation": "callout-warning", "lightbulb": "tip", "comment-question": "ask-hint", "crosshairs": "observe-specific",
    "eye-low-vision": "observe-hidden", "magnifying-glass-location": "observe-point", "magnifying-glass-plus": "search-specific",
    "map-location-dot": "show-on-map", "image": "picture", "folder-open": "file-pick", "forward-step": "next-phase",
    "id-card": "sheet", "masks-theater": "monokuma-mark", "paper-plane": "send", "pen-nib": "reshape", "thumbs-up": "favours",
    "thumbs-down": "hinders", "user-pen": "gm-picks", "wand-sparkles": "init",
    "box-archive": "stash", "dungeon": "passage", "eraser": "erase-trace", "microphone-lines": "voice-reset",
    "microphone-slash": "mic-off", "volume-xmark": "sound-off", "camera": "photo",
    /* E105 FT-14 (11.11.2026): Tamper's Misleading Trail row (action-tamper.mjs, `fa-signs-post`) kept Font Awesome
       under the glass - the one row of its picker FACES did not name; it wears the keyed CLEANUP row's drawing, the
       same function (UNWORN.CLEANUP: "its picker rows are Tamper's, worn through FACES"). */
    "signs-post": "misleading-trail"
};

/** Font Awesome icons in markup with no drpg- element round them, which FACES's `[class*="drpg-"]` cannot reach: [the
 *  host's selector, what, { FA name: glyph }]. E105 FT-14 (11.11.2026): Daggerheart's countdown tray (countdowns.hbs
 *  2.10.11, the module's Projects tray) draws a row's -1 and +1 as `<a><i class="fa-solid fa-minus|fa-plus">` and a hidden
 *  countdown's mark as `fa-eye-slash`, in `#countdowns`, whose ancestors carry no drpg- class; under Stained Glass they
 *  were the one Font Awesome in the dressed tray (the survey's glass-harness reading: 5 icons on the GM's page, 1 on a
 *  player's). The minus and plus step a count, the function the kit's steppers' minus and plus are (FACES); the hidden
 *  mark is not Averted Eyes (FACES's eye-slash), so it wears a drawing of its own, `unseen`. The owner's follow-up
 *  ("Tak", 11.11.2026): a looping countdown's `<a class="looping-container"><i class="loop-marker fa-solid fa-repeat">` is
 *  drawn too, with a drawing of its own (`countdown-loop`; FACES's repeat is the Reroll Hope Call's). No harness page
 *  draws a looping row; the fix's shots add one to the glass harness's tray as a stand-in of countdowns.hbs's markup.
 *  The tray's header clock is hidden under the glass (stained-glass.css) and is not mapped. Monokuma Legacy keeps Font
 *  Awesome in the tray (option A). */
export const HOST_FACES = [
    ["#countdowns", "Daggerheart's countdown tray: a row's -1, +1 and hidden mark", { minus: "minus", plus: "plus", "eye-slash": "unseen", repeat: "countdown-loop" }]
];

/** Stained Glass's themes: the one constant option B changes (A1: B = add "monokuma-legacy"; not built). */
export const GLASS_THEMES = ["stained-glass"];
const GLASS = GLASS_THEMES.length === 1 ? `body.drpg-theme-${GLASS_THEMES[0]}` : `:is(${GLASS_THEMES.map(t => `body.drpg-theme-${t}`).join(", ")})`;

/** The Font Awesome class each keyed element's markup carries where the rule needs it (a crisis row is a pick list's
 *  row, keyed by its input's value and its icon; the Monocub's tile has no key but its icon). R3340 holds these to
 *  config.mjs's `icon`, so a renamed icon is a red test, not a tile that silently keeps the old glyph. */
export const KEY_ICONS = {
    "CRISIS_ACTIONS.useItem": "fa-flask", "CRISIS_ACTIONS.leaveClue": "fa-fingerprint", "CRISIS_ACTIONS.secureTrace": "fa-hand-holding",
    "CRISIS_ACTIONS.selfDefence": "fa-shield-halved", "CRISIS_ACTIONS.survive": "fa-person-running",
    "CRISIS_ACTIONS.roleReversal": "fa-arrows-rotate", "CRISIS_ACTIONS.strike": "fa-hand-fist", "CRISIS_ACTIONS.pin": "fa-down-long",
    "CRISIS_ACTIONS.keepDistance": "fa-arrows-left-right", "CRISIS_ACTIONS.weaponAttack": "fa-khanda",
    "CRISIS_ACTIONS.finishingBlow": "fa-skull-crossbones", "CRISIS_ACTIONS.sharedEscape": "fa-door-open",
    "CRISIS_ACTIONS.doubleRoleReversal": "fa-repeat", "CRISIS_ACTIONS.crimePartners": "fa-handshake",
    "CRISIS_ACTIONS.avertedEyes": "fa-eye-slash", "MONOCUB.abilities.meddle": "fa-hand-sparkles"
};

/** Keyed elements no markup draws an icon for, and why (read 11.11.2026): they are mapped and drawn, and nothing wears
 *  them until their markup does. */
export const UNWORN = {
    TRAP_TRIGGERS: "a trap's trigger is an <option> of a select (projects-ui.mjs), which draws no icon",
    CLEANUP: "a cleanup key names a roll (roll-draw.mjs cleanupKey); its picker rows are Tamper's, worn through FACES"
};

/** The selector Stained Glass keys an element's glyph on, or null where nothing draws it (UNWORN). */
export function glassSelectorOf(elementId) {
    const [set, ...rest] = elementId.split("."), key = rest[rest.length - 1];
    if (set === "ACTIONS") return `.drpg-action-button[data-drpg-action="${key}"] .drpg-action-icon`;
    if (set === "HOPE_CALLS" || set === "DESPAIR_CALLS") return `.drpg-call-button[data-drpg-call="${key}"] .drpg-action-icon`;
    if (set === "CRISIS_ACTIONS") return `.drpg-choice:has(> input[value="${key}"]) > i.${KEY_ICONS[elementId]}`;
    if (elementId === "MONOCUB.abilities.meddle") return `.drpg-action-button:not([data-drpg-action], [data-drpg-call]) .drpg-action-icon.${KEY_ICONS[elementId]}`;
    if (set === "gm") return `.drpg-gmp-button[data-drpg-run="${key}"] > i`;
    return null;
}

/** A Remnant's mark (remnant-ring.mjs GLYPH_ACTIONS) -> its glass glyph, by the action that left it. */
export const REMNANT_ACTS = { search: "search", project: "hourglass", sabotage: "tamper", dynamic: "dynamic", resolution: "broom",
    incident: "direct-murder", discard: "trash", manual: "gm", loot: "palm" };

/** Markup with no key and an FA class another meaning shares: [what, selector, glyph]. */
export const FACE_RULES = [
    ["the handbooks' CAUTION callout (its fa-hand is Palm's)", ".drpg-callout-caution .drpg-callout-title i", "caution"],
    ["Project's Start row (its fa-lightbulb is the handbooks' TIP)", '.drpg-choice:has(> input[value="start"]) > i.fa-lightbulb', "project-new"],
    /* E105 FT batch 2 follow-up (the owner's "Tak", 11.11.2026: one function, one glyph): the Projects tray's Manage
       projects button (projects-ui.mjs, `<button class="drpg-projects-gear"><i class="fa-solid fa-gear">`) wore FACES's
       gear, the corner Look launcher's gear with its sound waves. */
    ["the Projects tray's Manage projects (its fa-gear is the corner Look launcher's)", ".drpg-projects-gear > i.fa-gear", "projects-manage"]
];

/** A state of a control that wears a drawing of its own under Stained Glass: [what, the glyph element's selector, glyph,
 *  the selector of what the drawing makes redundant]. The glyph is a ui-kit.mjs `pixelGlyph`, which carries its
 *  `--drpg-glyph` inline, so the rule sets the mask's image itself (as a Remnant's, "image": the longhand outranks
 *  `.drpg-pxi`'s `mask` shorthand by specificity, with no `!important` against the inline slot). The
 *  GM's manual mic lock (F5; batch 5, the owner 11.11.2026): voice-tile.mjs draws the mic and, after it, a small lock
 *  badge (`.drpg-voice-mic-lock`) shown while `LAUNCH_STATES.gmBlock` is on; batch 5's drawing is the mic with its lock,
 *  so under Stained Glass the mic wears it and the badge stands down. Legacy keeps the mic and its badge (option A). */
export const STATE_RULES = [
    ["the GM's manual mic lock (F5)", ".drpg-voice-mic.is-gm-blocked > .drpg-pxi:first-child", "mic-lock", ".drpg-voice-mic.is-gm-blocked > .drpg-voice-mic-lock"]
];

/** Every rule the glass section writes: [id, selector, glyph, how] - how "box" (the FA box, the slot set), "image" (an
 *  element that is a mask box already: only its image), "before" (a text button given a glyph before its label). */
export function glassRules() {
    const out = [];
    for (const [id, glyph] of Object.entries(ELEMENTS)) {
        const sel = glassSelectorOf(id);
        if (sel) out.push([id, sel, glyph, "box"]);
    }
    for (const [what, sel, glyph] of FACE_RULES) out.push([`rule.${glyph}`, sel, glyph, "box"]);
    for (const [act, glyph] of Object.entries(REMNANT_ACTS)) out.push([`remnant.${act}`, `.drpg-remnant-glyph[data-drpg-act="${act}"]`, glyph, "image"]);
    for (const [, sel, glyph] of STATE_RULES) out.push([`state.${glyph}`, sel, glyph, "image"]);
    for (const [host, , faces] of HOST_FACES) for (const [fa, glyph] of Object.entries(faces)) out.push([`host.${host}.fa-${fa}`, `${host} i.fa-${fa}`, glyph, "box"]);
    /* No rule for the GM launcher: its glass glyph is today's eye pixel for pixel (glass:gm same g:monokuma-eye, the owner
       11.11), so the chrome rule that draws it already draws the glass set's; a rule here would only move the winner of
       its mask (R1333's hexagon prints) for the same picture. */
    /* E49 A2 moved End the chapter into Edit campaign as a text button (gm-campaign.mjs, `data-drpg-end-chapter`): no
       <i> to mask, so the glyph stands before its label, the one way to key it with no markup change (Q5). */
    out.push(["button.end-chapter", "[data-drpg-end-chapter]::before", "end-chapter", "before"]);
    return out;
}

/** The names Stained Glass wears (FACES and the rules), each with the row it wears, in first-use order; `problems`
 *  names a worn name no row draws, and a worn non-glass row whose name a pix row holds (the declaration would repaint
 *  that pix drawing under Stained Glass). */
export function glassWorn(glyphs) {
    const names = [...new Set([...Object.values(FACES), ...glassRules().map(r => r[2])])];
    const worn = [], problems = [];
    for (const name of names) {
        const row = drawingOf(glyphs, name, "glass");
        if (!row) { problems.push(`Stained Glass wears "${name}", which no row draws`); continue; }
        if (row.family !== "glass" && glyphs.some(g => g.family === "legacy" && g.name === name && g.grid !== 24))
            problems.push(`Stained Glass wears ${row.family}:${name} as --drpg-pix-${name}, which would repaint legacy:${name}`);
        worn.push([name, row]);
    }
    return { worn, problems };
}

/** The glass section of pixel-icons.css (E48 G3). */
export function glassCssOf(glyphs) {
    const { worn, problems } = glassWorn(glyphs), rules = glassRules();
    const css = ["", "/* STAINED GLASS WEARS THE ONE SET (E48 G3, 11.11.2026). Every glyph Stained Glass wears is declared here as",
        "   `--drpg-pix-<name>` on the theme's body - the drawing rounds' approved `glass` rows, else the px row kept as drawn",
        "   (Q2) - and the rules below key it on the element: the tiles on their data- keys, a crisis row on its input's",
        "   value, the GM panel's tiles on data-drpg-run, a Remnant on data-drpg-act, the rest on FACES above. Monokuma",
        "   Legacy reads none of it (option A; R3348 holds its icons to what they were). The drawings of later stages are",
        "   in tools/glyphs.json and the sprite, and nothing here wears them until their markup lands." + (problems.length ? `\n   PROBLEMS: ${problems.join("; ")}` : "") + " */",
        `${GLASS} {`];
    for (const [name, row] of worn) css.push(`    --drpg-pix-${name}: ${dataUriOf(row)};`);
    css.push("}");
    const box = rules.filter(r => r[3] === "box");
    css.push(box.map(r => `${GLASS} ${r[1]}`).join(",\n") + ` {
    display: inline-block;
    width: max(1.15em, 22px);
    height: max(1.15em, 22px);
    min-width: 22px;
    min-height: 22px;
    vertical-align: -0.2em;
    background-color: currentColor;
    -webkit-mask-image: var(--drpg-glyph);
    mask-image: var(--drpg-glyph);
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    image-rendering: pixelated;
}`);
    css.push(box.map(r => `${GLASS} ${r[1]}::before`).join(",\n") + " { content: none; }");
    for (const [, sel, glyph, how] of rules) {
        if (how === "box") css.push(`${GLASS} ${sel} { --drpg-glyph: var(--drpg-pix-${glyph}); }`);
        else if (how === "image") css.push(`${GLASS} ${sel} { -webkit-mask-image: var(--drpg-pix-${glyph}); mask-image: var(--drpg-pix-${glyph}); }`);
        else css.push(`${GLASS} ${sel} {
    content: "";
    display: inline-block;
    width: 22px;
    height: 22px;
    margin-inline-end: 0.35em;
    vertical-align: -0.3em;
    background-color: currentColor;
    -webkit-mask-image: var(--drpg-pix-${glyph});
    mask-image: var(--drpg-pix-${glyph});
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    image-rendering: pixelated;
}`);
    }
    for (const [, , , redundant] of STATE_RULES) css.push(`${GLASS} ${redundant} { display: none; }`);
    return css.join("\n") + "\n";
}

/* ------------------------------ what the page wears ------------------------- */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The icon elements R3340 and R3341 read, as markup the module writes them: [id, html] with one `[data-drpg-probe]`
 *  in each. `keyed` is keyedElements's [[id, icon]]; the GM launcher and End the chapter are pseudo-elements, which
 *  a computed style headless does not read, so they are not here. */
export function glyphProbes(keyed) {
    const out = [], icon = new Map(keyed);
    const i = (fa, cls = "") => `<i class="fa-solid ${esc(fa)}${cls}" data-drpg-probe inert></i>`;
    for (const [id] of Object.entries(ELEMENTS)) {
        const [set, ...rest] = id.split("."), key = esc(rest[rest.length - 1]), fa = icon.get(id) ?? "fa-circle";
        if (set === "ACTIONS") out.push([id, `<div class="drpg-action-grid"><button type="button" class="drpg-action-button" data-drpg-action="${key}">${i(fa, " drpg-action-icon")}</button></div>`]);
        else if (set === "HOPE_CALLS" || set === "DESPAIR_CALLS") out.push([id, `<div class="drpg-action-grid"><button type="button" class="drpg-action-button drpg-call-button" data-drpg-call="${key}" data-drpg-call-kind="${set === "HOPE_CALLS" ? "hope" : "despair"}">${i(fa, " drpg-action-icon")}</button></div>`]);
        else if (set === "CRISIS_ACTIONS") out.push([id, `<div class="drpg-choices"><label class="drpg-choice"><input type="radio" name="variant" value="${key}">${i(fa)}</label></div>`]);
        else if (set === "MONOCUB") out.push([id, `<div class="drpg-action-grid"><button type="button" class="drpg-action-button">${i(fa, " drpg-action-icon")}</button></div>`]);
        else if (set === "gm") out.push([id, `<div class="drpg-gmp-grid"><button type="button" class="drpg-gmp-button" data-drpg-run="${key}">${i(fa)}</button></div>`]);
    }
    out.push(["rule.caution", `<div class="drpg-callout drpg-callout-caution"><p class="drpg-callout-title">${i("fa-hand")}</p></div>`]);
    out.push(["rule.project-new", `<div class="drpg-choices"><label class="drpg-choice"><input type="radio" name="variant" value="start">${i("fa-lightbulb")}</label></div>`]);
    out.push(["rule.projects-manage", `<div class="countdowns-header"><button type="button" class="drpg-projects-gear">${i("fa-gear")}</button></div>`]);
    for (const act of Object.keys(REMNANT_ACTS)) out.push([`remnant.${act}`, `<div class="drpg-remnant-ring"><span class="drpg-remnant-glyph" data-drpg-act="${act}" data-drpg-probe aria-hidden="true"></span></div>`]);
    for (const fa of Object.keys(FACES)) out.push([`face.fa-${fa}`, `<div class="drpg-glyph-probe">${i(`fa-${fa}`)}</div>`]);
    return out;
}

/** What one icon element wears: its mask's token (`--drpg-pix-search`), else `fa:<its fa- classes>` where it has no
 *  mask and so draws Font Awesome's glyph. Headless the cascade leaves var() unresolved, so the token is read off the
 *  text (one level through the `--drpg-glyph` slot); in a browser the mask is the drawing's url(...), and `tokens`
 *  (url -> the custom properties on the body that hold it, `glyphTokens`) names it. */
export function glyphReading(el, view, tokens) {
    const s = view.getComputedStyle(el);
    let m = (s.getPropertyValue("mask-image") || s.getPropertyValue("-webkit-mask-image") || "").trim();
    if (/^var\(\s*--drpg-glyph\s*\)$/.test(m)) m = s.getPropertyValue("--drpg-glyph").trim() || m;
    const v = /^var\(\s*(--drpg-[a-z0-9-]+)\s*\)$/.exec(m);
    if (v) return v[1];
    if (/^url\(/.test(m)) return (tokens?.get(m.replace(/\s+/g, "")) ?? ["url:unnamed"]).join("|");
    if (m && m !== "none") return `mask:${m.slice(0, 40)}`;
    return `fa:${[...el.classList].filter(c => /^fa-/.test(c) && c !== "fa-solid").join(" ") || "none"}`;
}

/** url -> the glyph custom properties on `el` (the body) that resolve to it, for every family and name of the rows. */
export function glyphTokens(el, view, glyphs) {
    const s = view.getComputedStyle(el), out = new Map();
    const props = new Set(glyphs.map(g => `--drpg-pix-${g.name}`));
    for (const p of props) {
        const value = s.getPropertyValue(p).trim().replace(/\s+/g, "");
        if (!value) continue;
        if (!out.has(value)) out.set(value, []);
        out.get(value).push(p);
    }
    return out;
}

/** A reading against the recorded one: equal, or (in a browser) the recorded token among those the url resolves to. */
export const readingMatches = (recorded, got) => recorded === got || String(got).split("|").includes(recorded);

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

/* ------------------------------ the one prefix (E48 G4) ------------------- */

/** The prefixes G4 retired (11.11.2026): every glyph a rule reads is `--drpg-pix-<name>`, and the slot is `--drpg-glyph`. */
export const OLD_PREFIXES = ["--drpg-" + "px-", "--drpg-" + "g-", "--drpg-" + "r-"];

/** The files R3349 reads beside module.json's stylesheets: the scripts that write a glyph's token or name a glyph. */
export const GLYPH_READERS = ["scripts/ui-kit.mjs", "scripts/projects-tray.mjs", "scripts/projects.mjs", "scripts/voice-tile.mjs",
    "scripts/hud.mjs", "scripts/foundry-windows.mjs", "scripts/diagnostics.mjs"];

/** The glyph names a script reads by name (each becomes `var(--drpg-pix-<name>)` in ui-kit.mjs `pixelGlyph`): the kit's
 *  pixelGlyph, the voice tile's mini and row buttons, a launcher's `glyph`. config.mjs PROJECT_GLYPHS's keys are the
 *  projects tray's, added by the caller. */
export function namedGlyphReads(texts) {
    const out = new Set();
    for (const text of Object.values(texts)) {
        const plain = blankComments(lf(text ?? ""));
        for (const m of plain.matchAll(/pixelGlyph\("([a-z0-9-]+)"\)/g)) out.add(m[1]);
        for (const m of plain.matchAll(/(?:miniButton|rowButton)\("[^"]*",\s*"([a-z0-9-]+)"/g)) out.add(m[1]);
        for (const m of plain.matchAll(/launcher\(\{[^{}]*?\bglyph:\s*"([a-z0-9-]+)"/g)) out.add(m[1]);
    }
    return [...out];
}

/** The one prefix held (R3349): no old prefix in any file handed in, comments included (a comment naming one is a
 *  rule somebody will copy); every `var(--drpg-pix-<name>)` they read outside pixel-icons.css, and every name in
 *  `names`, declared by a legacy row - on :root, for both themes, so it resolves under Monokuma Legacy as well.
 *  pixel-icons.css's own reads are the glass section's, which R3347 holds. */
export function prefixProblems(glyphs, texts, names) {
    const out = [], legacy = new Set(glyphs.filter(g => g.family === "legacy").map(g => g.name));
    if (!legacy.size) out.push("tools/glyphs.json has no legacy row: Monokuma Legacy's drawings are declared nowhere under --drpg-pix-");
    for (const [file, text] of Object.entries(texts)) {
        if (text == null) { out.push(`${file} could not be read`); continue; }
        lf(text).split("\n").forEach((line, i) => {
            for (const p of OLD_PREFIXES) if (line.includes(p)) out.push(`${file}:${i + 1}: ${p} in "${line.trim().slice(0, 70)}" (the one prefix is --drpg-pix-)`);
        });
        if (file === PIXEL_CSS) continue;
        const plain = blankComments(lf(text));
        for (const m of (/\.mjs$/.test(file) ? plain.replace(/(^|[^:\\])\/\/.*$/gm, "$1") : plain).matchAll(/var\(\s*--drpg-pix-([a-z0-9-]+)/g))
            if (!legacy.has(m[1])) out.push(`${file}: reads --drpg-pix-${m[1]}, which no legacy row declares`);
    }
    for (const n of names) if (!legacy.has(n)) out.push(`a script reads the glyph "${n}" by name, which no legacy row declares`);
    return [...new Set(out)];
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
/* Empty since E48 G1: the eye's token (`--drpg-pix-monokuma-eye` since G4, legacy:monokuma-eye, declared on :root
   by pixel-icons.css with Legacy's other drawings; until G4 by hand in danganronpa.css's :root; the chrome row `same`
   as it), and the section in the sheet had no :root block. With
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
   icon, edit its rows in tools/glyphs.json (family chrome) and re-run the tool.
   ========================================================================== */

${varBlock}${base}

${perIcon.join("\n\n")}

/* == /CHROME PIXEL ICONS == */`;
}


/** Monokuma Legacy's icons before E48 G3 (R3348): probe id -> reading, recorded headless on 11.11.2026 at 7b5b4da9 with
 *  G3's probes and HEAD's stylesheets, before pixel-icons.css was regenerated (199 readings: the tiles and Calls on
 *  their hand-drawn tokens, the GM tiles on those or Font Awesome, the crisis rows and FACES on Font Awesome).
 *  E48 G4 (11.11.2026) renamed the 60 token readings to the one prefix and changed no reading: each named a g-prefixed
 *  token (59) or the r-prefixed `trash` and now names `--drpg-pix-<n>` of the legacy row that took that drawing over, pixel for pixel
 *  (tools/glyphs.json's `from` names the old token; `palm` alone was renamed, to `palm-action`, because the px hand the
 *  objection launcher reads keeps `palm`); the 139 `fa:` readings are as recorded. */
export const LEGACY_ICONS = {
    "ACTIONS.search": "--drpg-pix-search",
    "ACTIONS.observe": "--drpg-pix-observe",
    "ACTIONS.analyze": "--drpg-pix-analyze",
    "ACTIONS.project": "--drpg-pix-project",
    "ACTIONS.rest": "--drpg-pix-rest",
    "ACTIONS.listen": "--drpg-pix-listen",
    "ACTIONS.palm": "--drpg-pix-palm-action",
    "ACTIONS.tamper": "--drpg-pix-cleanup",
    "ACTIONS.directMurder": "--drpg-pix-direct-murder",
    "ACTIONS.move": "--drpg-pix-move",
    "ACTIONS.sabotage": "--drpg-pix-sabotage",
    "HOPE_CALLS.support": "--drpg-pix-support",
    "HOPE_CALLS.experience": "--drpg-pix-experience",
    "HOPE_CALLS.ultimate": "--drpg-pix-ultimate",
    "HOPE_CALLS.contribution": "--drpg-pix-contribution",
    "HOPE_CALLS.reroll": "--drpg-pix-reroll",
    "HOPE_CALLS.sprint": "--drpg-pix-sprint",
    "HOPE_CALLS.burst": "--drpg-pix-burst",
    "HOPE_CALLS.relief": "--drpg-pix-relief",
    "HOPE_CALLS.determination": "--drpg-pix-determination",
    "HOPE_CALLS.freeCrit": "--drpg-pix-free-crit",
    "DESPAIR_CALLS.obstacle": "--drpg-pix-obstacle",
    "DESPAIR_CALLS.forTheGame": "--drpg-pix-for-the-game",
    "DESPAIR_CALLS.behindClosedDoors": "--drpg-pix-behind-closed-doors",
    "DESPAIR_CALLS.thisWillHurt": "--drpg-pix-this-will-hurt",
    "DESPAIR_CALLS.paranoia": "--drpg-pix-paranoia",
    "DESPAIR_CALLS.chained": "--drpg-pix-chained",
    "DESPAIR_CALLS.silence": "--drpg-pix-silence",
    "DESPAIR_CALLS.fuelTheCub": "--drpg-pix-fuel-the-cub",
    "DESPAIR_CALLS.gameProtection": "--drpg-pix-game-protection",
    "DESPAIR_CALLS.favoriteProject": "--drpg-pix-favorite-project",
    "DESPAIR_CALLS.feedOverflow": "--drpg-pix-feed-overflow",
    "DESPAIR_CALLS.contraband": "--drpg-pix-contraband",
    "DESPAIR_CALLS.publicAnnouncement": "--drpg-pix-public-announcement",
    "DESPAIR_CALLS.motive": "--drpg-pix-motive",
    "DESPAIR_CALLS.newRule": "--drpg-pix-new-rule",
    "CRISIS_ACTIONS.useItem": "fa:fa-flask",
    "CRISIS_ACTIONS.leaveClue": "fa:fa-fingerprint",
    "CRISIS_ACTIONS.secureTrace": "fa:fa-hand-holding",
    "CRISIS_ACTIONS.selfDefence": "fa:fa-shield-halved",
    "CRISIS_ACTIONS.survive": "fa:fa-person-running",
    "CRISIS_ACTIONS.roleReversal": "fa:fa-arrows-rotate",
    "CRISIS_ACTIONS.strike": "fa:fa-hand-fist",
    "CRISIS_ACTIONS.pin": "fa:fa-down-long",
    "CRISIS_ACTIONS.keepDistance": "fa:fa-arrows-left-right",
    "CRISIS_ACTIONS.weaponAttack": "fa:fa-khanda",
    "CRISIS_ACTIONS.finishingBlow": "fa:fa-skull-crossbones",
    "CRISIS_ACTIONS.sharedEscape": "fa:fa-door-open",
    "CRISIS_ACTIONS.doubleRoleReversal": "fa:fa-repeat",
    "CRISIS_ACTIONS.crimePartners": "fa:fa-handshake",
    "CRISIS_ACTIONS.avertedEyes": "fa:fa-eye-slash",
    "MONOCUB.abilities.meddle": "--drpg-pix-confusion",
    "gm.whoIsAlive": "--drpg-pix-who-is-alive",
    "gm.projects": "--drpg-pix-projects",
    "gm.sound": "fa:fa-volume-high",
    "gm.rules": "--drpg-pix-new-rule",
    "gm.murder": "--drpg-pix-direct-murder",
    "gm.investigation": "--drpg-pix-investigation",
    "gm.trial": "--drpg-pix-trial",
    "gm.jump": "--drpg-pix-jump",
    "gm.gmTeam": "--drpg-pix-gm-team",
    "gm.roomSetup": "--drpg-pix-room-setup",
    "gm.tables": "--drpg-pix-tables",
    "gm.voiceReset": "fa:fa-microphone-lines",
    "gm.seasonSetup": "--drpg-pix-season-setup",
    "gm.mastermind": "--drpg-pix-mastermind",
    /* E105 FT batch 2 (11.11.2026): E49 A1d's Settings tile was added to danganronpa.css's hand-masked tiles with the
       corner gear's drawing (legacy gear, the Look launcher's); one glyph per function, so under Legacy it wears its own
       markup's Font Awesome sliders (gm-panel.mjs `icon: "fa-sliders"`), as the Sound and Voice reset tiles wear theirs. */
    "gm.settings": "fa:fa-sliders",
    "gm.failureLog": "--drpg-pix-failure-log",
    "gm.caseWindow": "fa:fa-box-archive",
    "rule.caution": "fa:fa-hand",
    "rule.project-new": "fa:fa-lightbulb",
    /* E105 FT batch 2 follow-up (11.11.2026): the Projects tray's Manage projects probe; Legacy keeps its Font Awesome gear. */
    "rule.projects-manage": "fa:fa-gear",
    "remnant.search": "--drpg-pix-search",
    "remnant.project": "--drpg-pix-project",
    "remnant.sabotage": "--drpg-pix-sabotage",
    "remnant.dynamic": "--drpg-pix-dynamic",
    "remnant.resolution": "--drpg-pix-cleanup",
    "remnant.incident": "--drpg-pix-direct-murder",
    "remnant.discard": "--drpg-pix-trash",
    "remnant.manual": "--drpg-pix-monokuma-eye",
    "remnant.loot": "--drpg-pix-palm-action",
    "face.fa-magnifying-glass": "fa:fa-magnifying-glass",
    "face.fa-eye": "fa:fa-eye",
    "face.fa-brain": "fa:fa-brain",
    "face.fa-hammer": "fa:fa-hammer",
    "face.fa-bed": "fa:fa-bed",
    "face.fa-ear-listen": "fa:fa-ear-listen",
    "face.fa-hand-sparkles": "fa:fa-hand-sparkles",
    "face.fa-broom": "fa:fa-broom",
    "face.fa-skull": "fa:fa-skull",
    "face.fa-skull-crossbones": "fa:fa-skull-crossbones",
    "face.fa-shoe-prints": "fa:fa-shoe-prints",
    "face.fa-screwdriver-wrench": "fa:fa-screwdriver-wrench",
    "face.fa-hands-holding-circle": "fa:fa-hands-holding-circle",
    "face.fa-graduation-cap": "fa:fa-graduation-cap",
    "face.fa-star": "fa:fa-star",
    "face.fa-rotate-left": "fa:fa-rotate-left",
    "face.fa-arrows-rotate": "fa:fa-arrows-rotate",
    "face.fa-repeat": "fa:fa-repeat",
    "face.fa-person-running": "fa:fa-person-running",
    "face.fa-bolt": "fa:fa-bolt",
    "face.fa-mug-hot": "fa:fa-mug-hot",
    "face.fa-hand-fist": "fa:fa-hand-fist",
    "face.fa-burst": "fa:fa-burst",
    "face.fa-road-barrier": "fa:fa-road-barrier",
    "face.fa-gift": "fa:fa-gift",
    "face.fa-door-closed": "fa:fa-door-closed",
    "face.fa-door-open": "fa:fa-door-open",
    "face.fa-heart-crack": "fa:fa-heart-crack",
    "face.fa-link": "fa:fa-link",
    "face.fa-comment-slash": "fa:fa-comment-slash",
    "face.fa-hand-holding-heart": "fa:fa-hand-holding-heart",
    "face.fa-arrow-trend-down": "fa:fa-arrow-trend-down",
    "face.fa-arrow-trend-up": "fa:fa-arrow-trend-up",
    "face.fa-water": "fa:fa-water",
    "face.fa-trash-can": "fa:fa-trash-can",
    "face.fa-trash-arrow-up": "fa:fa-trash-arrow-up",
    "face.fa-bullhorn": "fa:fa-bullhorn",
    "face.fa-envelope": "fa:fa-envelope",
    "face.fa-gavel": "fa:fa-gavel",
    "face.fa-heart-pulse": "fa:fa-heart-pulse",
    "face.fa-list-check": "fa:fa-list-check",
    "face.fa-volume-high": "fa:fa-volume-high",
    "face.fa-scale-balanced": "fa:fa-scale-balanced",
    "face.fa-calendar-days": "fa:fa-calendar-days",
    "face.fa-users-gear": "fa:fa-users-gear",
    "face.fa-table-list": "fa:fa-table-list",
    "face.fa-wand-magic-sparkles": "fa:fa-wand-magic-sparkles",
    "face.fa-user-secret": "fa:fa-user-secret",
    "face.fa-bug": "fa:fa-bug",
    "face.fa-magnifying-glass-chart": "fa:fa-magnifying-glass-chart",
    "face.fa-fingerprint": "fa:fa-fingerprint",
    "face.fa-flask": "fa:fa-flask",
    "face.fa-lock": "fa:fa-lock",
    "face.fa-box": "fa:fa-box",
    "face.fa-box-open": "fa:fa-box-open",
    "face.fa-heart": "fa:fa-heart",
    "face.fa-plus": "fa:fa-plus",
    "face.fa-minus": "fa:fa-minus",
    "face.fa-chevron-left": "fa:fa-chevron-left",
    "face.fa-chevron-right": "fa:fa-chevron-right",
    "face.fa-chevron-down": "fa:fa-chevron-down",
    "face.fa-down-long": "fa:fa-down-long",
    "face.fa-arrow-up": "fa:fa-arrow-up",
    "face.fa-play": "fa:fa-play",
    "face.fa-pen-to-square": "fa:fa-pen-to-square",
    "face.fa-gear": "fa:fa-gear",
    "face.fa-shield-halved": "fa:fa-shield-halved",
    "face.fa-user-slash": "fa:fa-user-slash",
    "face.fa-eye-slash": "fa:fa-eye-slash",
    "face.fa-moon": "fa:fa-moon",
    "face.fa-comments": "fa:fa-comments",
    "face.fa-hand": "fa:fa-hand",
    "face.fa-hand-holding": "fa:fa-hand-holding",
    "face.fa-hand-pointer": "fa:fa-hand-pointer",
    "face.fa-circle": "fa:fa-circle",
    "face.fa-arrows-left-right": "fa:fa-arrows-left-right",
    "face.fa-khanda": "fa:fa-khanda",
    "face.fa-handshake": "fa:fa-handshake",
    "face.fa-bell": "fa:fa-bell",
    "face.fa-dice": "fa:fa-dice",
    "face.fa-key": "fa:fa-key",
    "face.fa-xmark": "fa:fa-xmark",
    "face.fa-check": "fa:fa-check",
    "face.fa-sort": "fa:fa-sort",
    "face.fa-hourglass": "fa:fa-hourglass",
    "face.fa-sun": "fa:fa-sun",
    "face.fa-note-sticky": "fa:fa-note-sticky",
    "face.fa-music": "fa:fa-music",
    "face.fa-microphone": "fa:fa-microphone",
    "face.fa-align-left": "fa:fa-align-left",
    "face.fa-angles-up": "fa:fa-angles-up",
    "face.fa-circle-info": "fa:fa-circle-info",
    "face.fa-circle-exclamation": "fa:fa-circle-exclamation",
    "face.fa-triangle-exclamation": "fa:fa-triangle-exclamation",
    "face.fa-lightbulb": "fa:fa-lightbulb",
    "face.fa-comment-question": "fa:fa-comment-question",
    "face.fa-crosshairs": "fa:fa-crosshairs",
    "face.fa-eye-low-vision": "fa:fa-eye-low-vision",
    "face.fa-magnifying-glass-location": "fa:fa-magnifying-glass-location",
    "face.fa-magnifying-glass-plus": "fa:fa-magnifying-glass-plus",
    "face.fa-map-location-dot": "fa:fa-map-location-dot",
    "face.fa-image": "fa:fa-image",
    "face.fa-folder-open": "fa:fa-folder-open",
    "face.fa-forward-step": "fa:fa-forward-step",
    "face.fa-id-card": "fa:fa-id-card",
    "face.fa-masks-theater": "fa:fa-masks-theater",
    "face.fa-paper-plane": "fa:fa-paper-plane",
    "face.fa-pen-nib": "fa:fa-pen-nib",
    "face.fa-thumbs-up": "fa:fa-thumbs-up",
    "face.fa-thumbs-down": "fa:fa-thumbs-down",
    "face.fa-user-pen": "fa:fa-user-pen",
    "face.fa-wand-sparkles": "fa:fa-wand-sparkles",
    "face.fa-box-archive": "fa:fa-box-archive",
    "face.fa-dungeon": "fa:fa-dungeon",
    "face.fa-eraser": "fa:fa-eraser",
    "face.fa-microphone-lines": "fa:fa-microphone-lines",
    "face.fa-microphone-slash": "fa:fa-microphone-slash",
    "face.fa-volume-xmark": "fa:fa-volume-xmark",
    "face.fa-camera": "fa:fa-camera",
    /* E105 FT-14 (11.11.2026): FACES's new name, Tamper's Misleading Trail row; Legacy keeps its Font Awesome (option A). */
    "face.fa-signs-post": "fa:fa-signs-post"
};
