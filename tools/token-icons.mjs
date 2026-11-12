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
 *
 * Writes icons/remnant-*.svg. The fill is pure white on purpose: Foundry
 * multiplies the texture by the token's tint, so the document's neutral grey
 * (and any future per-type colour) decides the hue, not the file.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const here = dirname(fileURLToPath(import.meta.url));
/* Since E48 G4 the custom properties are tools/glyph-map.mjs's, on :root in pixel-icons.css (Monokuma Legacy's
   drawings first, then Stained Glass's over the same names: the first match is Legacy's, the one these files carried),
   and the chrome rule the eye comes from is danganronpa.css's generated section. Re-run, the files' path text comes out
   in the generator's spelling (M0 0h3v1h-3z, not the hand sheets' H0z): the same pixels. */
const css = (await readFile(join(here, "..", "styles", "pixel-icons.css"), "utf8"))
    + (await readFile(join(here, "..", "styles", "danganronpa.css"), "utf8"));

function dataUriFor(source) {
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

const outDir = join(here, "..", "icons");
await mkdir(outDir, { recursive: true });

for (const [key, source] of Object.entries(SOURCES)) {
    await writeFile(join(outDir, `remnant-${key}.svg`), tokenSvg(dataUriFor(source)), "utf8");
}
console.log(`Wrote ${Object.keys(SOURCES).length} token icons into icons/`);
