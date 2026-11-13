/**
 * Danganronpa RPG - standalone SVG icons for Remnant tokens.
 * ---------------------------------------------------------------------------
 * A Remnant token wears the pixel icon of the ACTION that left it - but only
 * for the GM, and for a player only once their own Truth Bullet from that
 * trace is identified. Until then every client renders the token's actual
 * texture: the same 8x8 question mark the Despair pool shows (Dawid, 26.08:
 * "ten sam, co w despair pool").
 *
 * The art is NOT drawn here. Every glyph already exists in the stylesheets as
 * a CSS mask sprite - the action tiles, the row buttons, the Monokuma eye -
 * and this tool re-publishes those exact data URIs as standalone files a
 * token texture can load. One drawing per glyph, wherever it appears: editing
 * the sprite in the stylesheet (or its generator) and re-running this keeps
 * the map and the panels pixel-identical.
 *
 * Run with any Node-flavoured runtime:
 *
 *     ELECTRON_RUN_AS_NODE=1 "<foundry>.exe" tools/token-icons.mjs
 *     node tools/token-icons.mjs            writes the files
 *     node tools/token-icons.mjs --check    writes nothing; exit 1 when a file differs from what this would write
 *
 * `node tools/check.mjs icons` runs `iconProblems` below (13.11.2026; E59 C5's item M7, the owner's default of
 * Q-E59-8: regenerate after a pixel comparison and hold the files with a check), so a sprite edited in the
 * stylesheets without this re-run, or a file edited by hand, is red in CI's check job. `tokenIconFiles` is the one
 * place the files' text is made: the writer and the check read it alike.
 *
 * Writes icons/remnant-*.svg. The fill is pure white on purpose: Foundry
 * multiplies the texture by the token's tint, so the document's neutral grey
 * (and any future per-type colour) decides the hue, not the file.
 *
 * AND icons/project-<key>.svg, one per glyph a GM can choose for a project
 * (config.mjs PROJECT_GLYPHS, read from there, not listed here): the drawing
 * the tray paints for that glyph (`var(--drpg-pix-<key>)`, projects-tray.mjs),
 * as the project's token wears it on the map (the owner's choice of 13.11.2026:
 * a project's token wears its chosen glyph, public or secret; projects-map.mjs
 * `projectTokenIcon`). The same first match as the Remnants' files: the drawing
 * on :root, which is Monokuma Legacy's - a token's texture is one file for every
 * browser, whatever its theme, and 11 of the 21 glyphs are drawn otherwise under
 * Stained Glass (read 13.11.2026: pixel-icons.css holds each twice).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

/**
 * file (icons/remnant-<key>.svg) → where its art lives in the stylesheet.
 *   var:      a custom property holding url("data:image/svg+xml,…")
 *   selector: a generated chrome rule (for sprites that never got a var)
 */
const SOURCES = {
    // The pre-analysis face of every trace - the Despair pool's question mark.
    unknown: { var: "--drpg-pix-query" },

    // One per `action` a Remnant can record - see REMNANT_FLAGS.action.
    search: { var: "--drpg-pix-search" },
    project: { var: "--drpg-pix-project" },
    sabotage: { var: "--drpg-pix-sabotage" },
    dynamic: { var: "--drpg-pix-dynamic" },
    resolution: { var: "--drpg-pix-cleanup" },
    incident: { var: "--drpg-pix-direct-murder" },
    discard: { var: "--drpg-pix-trash" },
    // Taking something off a body (handover.mjs, `lootBody`) - the hand that Palm uses.
    loot: { var: "--drpg-pix-palm-action" },
    // A GM-placed trace (Key Remnants, the Final Truth) was left by Monokuma's
    // own hand, and says so.
    manual: { selector: "#drpg-gm-launcher i::before" }
};

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(HERE, "..");
/* Since E48 G4 the custom properties are tools/glyph-map.mjs's, on :root in pixel-icons.css (Monokuma Legacy's
   drawings first, then Stained Glass's over the same names: the first match is Legacy's, the one these files carried),
   and the chrome rule the eye comes from is danganronpa.css's generated section. Re-run, the files' path text comes out
   in the generator's spelling (M0 0h3v1h-3z, not the hand sheets' H0z): the same pixels - measured 13.11.2026 in
   Chromium at 256 and 64 px over the nine remnant-*.svg committed until then, every pixel equal. */

function dataUriFor(css, source) {
    const pattern = source.var
        ? new RegExp(`${source.var}:\\s*url\\("data:image/svg\\+xml,([^"]+)"\\)`)
        : new RegExp(`${source.selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{[\\s\\S]*?mask-image: url\\("data:image/svg\\+xml,([^"]+)"\\)`);
    const hit = css.match(pattern);
    if (!hit) throw new Error(`No sprite found for ${source.var ?? source.selector}`);
    return decodeURIComponent(hit[1]);
}

/**
 * Re-wrap one decoded sprite as a token texture: same path, white fill, a
 * breath of padding (the glyph should sit in the grid square, not bleed to
 * its edges), and an explicit raster size so PIXI renders it crisp at token
 * scale instead of rasterising a 12px canvas and stretching it.
 */
function tokenSvg(decoded) {
    const box = decoded.match(/viewBox='0 0 (\d+) (\d+)'/);
    const d = decoded.match(/ d='([^']+)'/);
    if (!box || !d) throw new Error(`Unparseable sprite: ${decoded.slice(0, 80)}`);

    const grid = Math.max(Number(box[1]), Number(box[2]));
    const pad = Math.round(grid / 6);
    const size = grid + 2 * pad;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" `
        + `viewBox="${-pad} ${-pad} ${size} ${size}" shape-rendering="crispEdges">`
        + `<path fill="#ffffff" d="${d[1]}"/></svg>\n`;
}

/**
 * Every file this tool owns, as it would write it: `Map<"icons/<name>.svg", text>` - the Remnants' (SOURCES) and one
 * per project glyph (config.mjs PROJECT_GLYPHS, read from `repo`'s scripts/config.mjs).
 */
export async function tokenIconFiles(repo = DEFAULT_REPO) {
    const css = (await readFile(join(repo, "styles", "pixel-icons.css"), "utf8"))
        + (await readFile(join(repo, "styles", "danganronpa.css"), "utf8"));
    const files = new Map();
    for (const [key, source] of Object.entries(SOURCES)) files.set(`icons/remnant-${key}.svg`, tokenSvg(dataUriFor(css, source)));
    const { PROJECT_GLYPHS } = await import(pathToFileURL(join(repo, "scripts", "config.mjs")).href);
    for (const key of Object.keys(PROJECT_GLYPHS)) files.set(`icons/project-${key}.svg`, tokenSvg(dataUriFor(css, { var: `--drpg-pix-${key}` })));
    return files;
}

/**
 * The check: one line per file that is missing or differs from what `tokenIconFiles` makes (CRLF read as LF), and per
 * icons/project-*.svg the tool would not write (a glyph removed from PROJECT_GLYPHS leaves its file behind).
 * `files` stands in for what the tool would write - the check's control hands it an empty set.
 */
export async function iconProblems(repo = DEFAULT_REPO, { files = null } = {}) {
    files ??= await tokenIconFiles(repo);
    const problems = [];
    // An empty set compares nothing and would pass (REVIEW-111 1): said, so the check cannot read nothing and be green.
    if (!files.size) problems.push("no token picture to compare - the generator read no source");
    for (const [rel, want] of files) {
        let have = null;
        try { have = (await readFile(join(repo, rel), "utf8")).replace(/\r\n?/g, "\n"); } catch { /* missing */ }
        if (have === null) problems.push(`${rel}: missing - run node tools/token-icons.mjs`);
        else if (have !== want) problems.push(`${rel}: differs from what tools/token-icons.mjs writes from the stylesheets - re-run it, or the sprite changed`);
    }
    const { readdir } = await import("node:fs/promises");
    for (const name of await readdir(join(repo, "icons"))) {
        if (/^project-.+\.svg$/.test(name) && !files.has(`icons/${name}`)) problems.push(`icons/${name}: no project glyph of config.mjs writes it - remove it`);
    }
    return { problems, count: files.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes("--check")) {
        const { problems, count } = await iconProblems();
        for (const p of problems) console.log(`icons: ${p}`);
        console.log(`icons: ${count} file(s) the generator owns; ${problems.length} problem(s)`);
        process.exitCode = problems.length ? 1 : 0;
    } else {
        const files = await tokenIconFiles();
        await mkdir(join(DEFAULT_REPO, "icons"), { recursive: true });
        for (const [rel, text] of files) await writeFile(join(DEFAULT_REPO, rel), text, "utf8");
        console.log(`Wrote ${files.size} token icons into icons/`);
    }
}
