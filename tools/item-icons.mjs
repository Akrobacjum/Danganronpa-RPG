/**
 * Danganronpa RPG - placeholder pixel icons for the item categories.
 * ---------------------------------------------------------------------------
 * Every item this module creates used to wear one of Foundry's own painted
 * icons - an oil-painted apple next to a pixel-art sheet, and two categories
 * (Tool, Room Key) with no icon at all, which is a blank frame. These are six
 * hand-drawn placeholders in the register the rest of the module is drawn in.
 *
 * PLACEHOLDERS, said out loud (Dawid, 28.08). One drawing per CATEGORY, not
 * per item: a Hammer and a Crowbar are both "Tool" here. Replacing any of them
 * later means editing the picture below and re-running this - the art is ASCII,
 * so an icon is edited as a picture rather than as a path string, the same rule
 * `tools/chrome-icons.mjs` follows.
 *
 * Three layers, because these are read on a light sheet as well as on a dark
 * map and a white-only glyph disappears on one of them:
 *
 *     #   ink      the outline, always
 *     o   bone     the body
 *     x   accent   one colour per category, so the six read apart at 24px
 *
 * Run with any Node-flavoured runtime:
 *
 *     ELECTRON_RUN_AS_NODE=1 "<foundry>.exe" tools/item-icons.mjs
 *
 * Writes icons/item-<category>.svg. The keys are the keys of ITEM_CATEGORIES
 * in config.mjs; `inventory.mjs` builds the path from the same key, so adding a
 * category here and there is the whole of adding an icon.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const GRID = 12;

const INK = "#1a1620";
const BONE = "#e8e3ec";

/* ==========================================================================
 * THE ART
 * ========================================================================== */

const ICONS = {
    // A flask. Not an apple: half the tier-0 Usables are not food, and a
    // bottle reads as "drink me" at twelve pixels in a way a fruit does not.
    usable: {
        accent: "#4fb286",
        art: [
            "...######...",
            "...#oooo#...",
            "...#oooo#...",
            "..##oooo##..",
            "..#oooooo#..",
            ".#oooooooo#.",
            ".#ooxxxxoo#.",
            ".#oxxxxxxo#.",
            ".#oxxxxxxo#.",
            "..#oxxxxo#..",
            "..########..",
            "............"
        ]
    },

    // A knife, blade up. The one category whose icon has to look like harm.
    crimeTool: {
        accent: "#c2415a",
        art: [
            "..........#.",
            ".........##.",
            "........###.",
            ".......###o.",
            "......###oo.",
            ".....###oo..",
            "....###oo...",
            "...###oo....",
            "..####o.....",
            ".##xx#......",
            ".#xx##......",
            ".####......."
        ]
    },

    // A broom: handle, head, bristles.
    cleaningTool: {
        accent: "#4a90c2",
        art: [
            ".........##.",
            "........##..",
            ".......##...",
            "......##....",
            ".....##.....",
            "....##......",
            "...####.....",
            "..#xxxx#....",
            ".#xxxxxx#...",
            ".#xxxxxx#...",
            ".#x#x#x#x#..",
            "..#.#.#.#..."
        ]
    },

    // A wrench. Work, not harm - the difference the category is about.
    tool: {
        accent: "#c9a227",
        art: [
            "......##.##.",
            ".....##.##..",
            ".....######.",
            "......####..",
            ".....#xx#...",
            "....#xx#....",
            "...#xx#.....",
            "..#xx#......",
            ".#xx#.......",
            "#xx#........",
            "##..........",
            "............"
        ]
    },

    // A cartridge, because that is what a Truth Bullet is called.
    truthBullet: {
        accent: "#9d4edd",
        art: [
            ".....##.....",
            "....#oo#....",
            "...#oooo#...",
            "..#oooooo#..",
            "..#oooooo#..",
            "..########..",
            "..#xxxxxx#..",
            "..#xxxxxx#..",
            "..#xxxxxx#..",
            "..#xxxxxx#..",
            "..########..",
            "............"
        ]
    },

    // A key, bow and bit.
    bedroomKey: {
        accent: "#d98b3a",
        art: [
            "...####.....",
            "..#oooo#....",
            ".#oo##oo#...",
            ".#o#xx#o#...",
            ".#oo##oo#...",
            "..#oooo#....",
            "...#oo#.....",
            "....#o#.....",
            "....#o###...",
            "....#o#.....",
            "....#o###...",
            "....###....."
        ]
    }
};

/* ==========================================================================
 * THE PRESS
 * ========================================================================== */

/** One layer's rectangles, as a single path. Runs are merged along a row. */
function pathFor(art, mark, offsetX, offsetY) {
    const parts = [];
    art.forEach((row, y) => {
        let run = 0;
        for (let x = 0; x <= row.length; x++) {
            if (row[x] === mark) { run++; continue; }
            if (run) {
                const startX = x - run + offsetX;
                parts.push(`M${startX} ${y + offsetY}h${run}v1H${startX}z`);
                run = 0;
            }
        }
    });
    return parts.join("");
}

function svgFor({ art, accent }) {
    const width = Math.max(...art.map(r => r.length));
    const offsetX = Math.floor((GRID - width) / 2);
    const offsetY = Math.floor((GRID - art.length) / 2);

    // A breath of padding, and an explicit raster size: PIXI otherwise
    // rasterises the viewBox at its own scale and stretches it. Same wrapper
    // `tools/token-icons.mjs` writes, for the same reason.
    const pad = 2;
    const size = GRID + pad * 2;

    const layers = [[INK, "#"], [BONE, "o"], [accent, "x"]]
        .map(([colour, mark]) => [colour, pathFor(art, mark, offsetX, offsetY)])
        .filter(([, d]) => d)
        .map(([colour, d]) => `<path fill="${colour}" d="${d}"/>`)
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" `
        + `viewBox="${-pad} ${-pad} ${size} ${size}" shape-rendering="crispEdges">`
        + layers
        + `</svg>\n`;
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "icons");
await mkdir(out, { recursive: true });

for (const [key, icon] of Object.entries(ICONS)) {
    const wide = icon.art.find(row => row.length > GRID);
    if (wide) throw new Error(`${key}: a row is ${wide.length} wide, grid is ${GRID}`);
    const file = join(out, `item-${key}.svg`);
    await writeFile(file, svgFor(icon), "utf8");
    console.log(`item-${key}.svg  ${icon.art.length}x${Math.max(...icon.art.map(r => r.length))}`);
}
console.log(`${Object.keys(ICONS).length} item icons written to icons/`);
