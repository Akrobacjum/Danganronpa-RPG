/**
 * Danganronpa RPG — the hand-drawn pixel icons for Foundry's chrome.
 * ---------------------------------------------------------------------------
 * Every icon on the scene-controls rail and the sidebar tabs, redrawn by hand
 * on a 12x12 grid. Each sprite is ASCII art below — `#` is a filled pixel —
 * so editing an icon means editing a picture, not a path string.
 *
 * Run with any Node-flavoured runtime:
 *
 *     ELECTRON_RUN_AS_NODE=1 "<foundry>.exe" tools/chrome-icons.mjs
 *
 * It rewrites the CHROME PIXEL ICONS section of styles/danganronpa.css in
 * place (between the GENERATED markers). Nothing else in the stylesheet is
 * touched. Art smaller than the grid is centred automatically, so a 10x10
 * sketch is fine.
 *
 * The mapping keys are Font Awesome class names as they appear on the buttons
 * (`fa-user-large`, `icon-fa-cone`, …). A button whose class has no sprite
 * here keeps its vector glyph — another module's tool degrades gracefully
 * rather than turning into a blank square.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const GRID = 12;

/* ==========================================================================
 * THE ART
 * ========================================================================== */

const ICONS = {

    /* ---- token layer ---- */

    // A student, head and shoulders.
    "fa-user-large": [
        "...####...",
        "..######..",
        "..######..",
        "..######..",
        "...####...",
        "..........",
        ".########.",
        "##########",
        "##########",
        "##########"
    ],

    // Target: ring with a heart pixel.
    "fa-bullseye": [
        "...####...",
        ".##....##.",
        ".#......#.",
        "#...##...#",
        "#..####..#",
        "#..####..#",
        "#...##...#",
        ".#......#.",
        ".##....##.",
        "...####..."
    ],

    // Ruler, diagonal with ticks.
    "fa-ruler": [
        ".......###",
        "......####",
        ".....##.##",
        "....####..",
        "...##.##..",
        "..####....",
        ".##.##....",
        "####......",
        "###.......",
        "##........"
    ],

    // Ghost.
    "fa-ghost": [
        "...####...",
        "..######..",
        ".########.",
        ".##.##.##.",
        ".########.",
        ".########.",
        ".########.",
        ".########.",
        ".########.",
        ".#.#..#.#."
    ],

    /* ---- regions layer ---- */

    // Game board: checker.
    "fa-game-board": [
        "##########",
        "#..##..###",
        "#..##..###",
        "###..##..#",
        "###..##..#",
        "#..##..###",
        "#..##..###",
        "###..##..#",
        "###..##..#",
        "##########"
    ],

    // Select: expand arrows to the corners.
    "fa-expand": [
        "####...###",
        "##......##",
        "#.#....#.#",
        "...#..#...",
        "..........",
        "..........",
        "...#..#...",
        "#.#....#.#",
        "##......##",
        "####...###"
    ],

    // Combined rulers: an L of ticks.
    "fa-ruler-combined": [
        "#####.....",
        "#####.....",
        "##..#.....",
        "#####.....",
        "##..#.....",
        "#####.....",
        "##..######",
        "#####...##",
        "####..#.##",
        "##########"
    ],

    "icon-fa-rectangle": [
        "##########",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        "##########"
    ],

    // Filled circle.
    "fa-circle": [
        "...####...",
        ".########.",
        ".########.",
        "##########",
        "##########",
        "##########",
        "##########",
        ".########.",
        ".########.",
        "...####..."
    ],

    // Ring (regular circle).
    "fa-circle-regular": [
        "...####...",
        ".##....##.",
        ".#......#.",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        ".#......#.",
        ".##....##.",
        "...####..."
    ],

    "icon-fa-ellipse": [
        "...####...",
        ".##....##.",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        ".##....##.",
        "...####..."
    ],

    "icon-fa-cone": [
        "....##....",
        "....##....",
        "...#..#...",
        "...#..#...",
        "..#....#..",
        "..#....#..",
        ".#......#.",
        ".#......#.",
        "#........#",
        "##########"
    ],

    // Eye.
    "fa-eye": [
        "...####...",
        ".##....##.",
        "#...##...#",
        "#..####..#",
        "#..####..#",
        "#...##...#",
        ".##....##.",
        "...####..."
    ],

    // Line.
    "fa-horizontal-rule": [
        "..........",
        "..........",
        "..........",
        "##########",
        "##########",
        "..........",
        "..........",
        ".........."
    ],

    // Emanation: dot with arcs.
    "fa-podcast": [
        ".#......#.",
        "#..####..#",
        "#.#....#.#",
        "#.#.##.#.#",
        "#.#.##.#.#",
        "#.#....#.#",
        "#..####..#",
        ".#......#."
    ],

    // Polygon with vertex dots.
    "fa-draw-polygon": [
        "##....##..",
        "##...###..",
        ".#..#..#..",
        ".#.#....#.",
        ".##.....#.",
        ".#.......#",
        ".#......##",
        "##.....#..",
        "##..###...",
        ".####....."
    ],

    // Hole: a square with a bite taken out.
    "fa-object-subtract": [
        "########..",
        "########..",
        "##....##..",
        "##....##..",
        "##....####",
        "##....#..#",
        "########.#",
        "########.#",
        "....#....#",
        "....######"
    ],

    "fa-trash": [
        "...####...",
        "##########",
        "##########",
        ".#......#.",
        ".#.#.##.#.",
        ".#.#.##.#.",
        ".#.#.##.#.",
        ".#.#.##.#.",
        ".#......#.",
        ".########."
    ],

    /* ---- drawings layer ---- */

    "fa-pencil": [
        ".......###",
        "......####",
        ".....####.",
        "....####..",
        "...####...",
        "..####....",
        ".####.....",
        "####......",
        "##........",
        "#........."
    ],

    // Freehand: a signature squiggle.
    "fa-signature": [
        "..........",
        "..##......",
        ".#..#.....",
        ".#..#..##.",
        ".#.#..#..#",
        ".#.#..#..#",
        "#..##.#.#.",
        "#.........",
        "##########",
        ".........."
    ],

    "fa-font": [
        "....##....",
        "...####...",
        "...#..#...",
        "..##..##..",
        "..#....#..",
        ".########.",
        ".#......#.",
        "##......##",
        "###....###",
        ".........."
    ],

    "fa-palette": [
        "...#####..",
        ".##.....#.",
        "#..#..#..#",
        "#........#",
        "#.#......#",
        "#....##..#",
        "#.#..####.",
        ".#....##..",
        "..######..",
        ".........."
    ],

    /* ---- tiles layer ---- */

    "fa-cubes": [
        "....##....",
        "..######..",
        ".##....##.",
        ".#..##..#.",
        "..######..",
        ".##....##.",
        "#..####..#",
        "#..#..#..#",
        ".##....##.",
        "...####..."
    ],

    "fa-cube": [
        "...####...",
        ".##....##.",
        "#........#",
        "#.##..##.#",
        "#...##...#",
        "#...##...#",
        ".#..##..#.",
        ".##.##.##.",
        "...####...",
        "..........",
    ],

    "fa-folder": [
        "..........",
        "#####.....",
        "#...##....",
        "##########",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        "##########",
        ".........."
    ],

    /* ---- walls layer ---- */

    "fa-block-brick": [
        "##########",
        "#..#..#..#",
        "##########",
        "#....#...#",
        "##########",
        "#..#..#..#",
        "##########",
        "#....#...#",
        "##########",
        ".........."
    ],

    // Wall chain: nodes and links.
    "fa-share-nodes": [
        "........##",
        ".......###",
        "......#.##",
        ".....#....",
        "....#.....",
        "...#......",
        "##.#......",
        "###.......",
        "##........",
        ".........."
    ],

    "fa-bars": [
        "..........",
        "##########",
        "##########",
        "..........",
        "##########",
        "##########",
        "..........",
        "##########",
        "##########",
        ".........."
    ],

    "fa-mountain": [
        ".....#....",
        "....###...",
        "...##.##..",
        "...#####..",
        "..##...##.",
        ".##.....##",
        ".#.......#",
        "##########"
    ],

    "fa-eye-slash": [
        "#.........",
        ".#..###...",
        ".##....##.",
        "#.#.##...#",
        "#..#.##..#",
        "#..##.#..#",
        "#...##.#.#",
        ".##...#.#.",
        "...###..#.",
        ".........#"
    ],

    // Ethereal: a plain mask.
    "fa-mask": [
        "..######..",
        ".########.",
        "##########",
        "#..#..#..#",
        "#..#..#..#",
        "##########",
        ".###..###.",
        "..##..##..",
        "...####...",
        ".........."
    ],

    "fa-door-open": [
        "....######",
        "....#....#",
        "....#..#.#",
        "....#..#.#",
        "....#....#",
        "....#....#",
        "....#....#",
        "....#....#",
        "..###....#",
        "##########"
    ],

    "fa-user-secret": [
        "...####...",
        "...####...",
        ".########.",
        "..######..",
        "...####...",
        "..........",
        ".########.",
        "##..##..##",
        "##########",
        "##########"
    ],

    "fa-window-frame": [
        "##########",
        "#....#...#",
        "#....#...#",
        "#....#...#",
        "##########",
        "#....#...#",
        "#....#...#",
        "#....#...#",
        "##########",
        ".........."
    ],

    "fa-door-closed": [
        "..######..",
        "..#....#..",
        "..#....#..",
        "..#...##..",
        "..#...##..",
        "..#....#..",
        "..#....#..",
        "..#....#..",
        "..#....#..",
        "##########"
    ],

    /* ---- sounds layer ---- */

    "fa-music": [
        "...#######",
        "...#######",
        "...#.....#",
        "...#.....#",
        "...#.....#",
        "...#.....#",
        "..##....##",
        ".###...###",
        ".###...###",
        "..#.....#."
    ],

    "fa-volume-high": [
        "....#...#.",
        "...##.#..#",
        "####.#.#.#",
        "#..#.#.#.#",
        "#..#.#.#.#",
        "#..#.#.#.#",
        "####.#.#.#",
        "...##.#..#",
        "....#...#.",
        ".........."
    ],

    "fa-headphones": [
        "...####...",
        ".##....##.",
        ".#......#.",
        "#........#",
        "#........#",
        "##......##",
        "###....###",
        "###....###",
        "##......##",
        ".........."
    ],

    /* ---- lighting layer ---- */

    "fa-lightbulb": [
        "...####...",
        ".##....##.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".##....##.",
        "..#....#..",
        "..######..",
        "...#..#...",
        "...####..."
    ],

    "fa-sun": [
        "..#.##.#..",
        ".#.####.#.",
        "..######..",
        "##########",
        ".########.",
        ".########.",
        "##########",
        "..######..",
        ".#.####.#.",
        "..#.##.#.."
    ],

    "fa-moon": [
        "....####..",
        "..###.....",
        ".###......",
        ".##.......",
        "###.......",
        "###.......",
        ".##.......",
        ".###......",
        "..###.....",
        "....####.."
    ],

    "fa-cloud": [
        "..........",
        "...###....",
        "..#...##..",
        ".#......#.",
        "#........#",
        "#........#",
        ".########.",
        ".........."
    ],

    /* ---- notes layer ---- */

    "fa-bookmark": [
        ".########.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".#..##..#.",
        ".##.##.##.",
        ".##....##."
    ],

    "fa-book-open": [
        "..........",
        "####..####",
        "#...##...#",
        "#...##...#",
        "#...##...#",
        "#...##...#",
        "#...##...#",
        "#.######.#",
        "###....###",
        ".........."
    ],

    "fa-map-pin": [
        "...####...",
        ".##....##.",
        ".#......#.",
        ".#......#.",
        ".##....##.",
        "...####...",
        "....##....",
        "....##....",
        "....##....",
        "....##...."
    ],

    /* ---- sidebar tabs ---- */

    "fa-comments": [
        "########..",
        "#......#..",
        "#......#..",
        "#......###",
        "########.#",
        "..#....#.#",
        "...#...#.#",
        "....####.#",
        ".......###",
        ".........."
    ],

    "fa-swords": [
        "#.......##",
        "##.....###",
        ".##...##..",
        "..##.##...",
        "...###....",
        "...###....",
        "..##.##...",
        ".##...##..",
        "###.....##",
        "##.......#"
    ],

    "fa-map": [
        "..........",
        "#..######.",
        "##.#....##",
        "##.#..#.##",
        "#..#..#..#",
        "#..#..#..#",
        "##.#..#.##",
        "##....#.##",
        ".######..#",
        ".........."
    ],

    "fa-puzzle-piece": [
        "....##....",
        "...####...",
        "########..",
        "#......###",
        "#......###",
        "#..#...#..",
        "#.###..#..",
        "#..#...#..",
        "########..",
        ".........."
    ],

    "fa-user": [
        "...####...",
        "..######..",
        "..######..",
        "...####...",
        "..........",
        "..######..",
        ".########.",
        "##########",
        "##########",
        ".........."
    ],

    "fa-suitcase": [
        "...####...",
        "...#..#...",
        "##########",
        "#........#",
        "#.#....#.#",
        "#.#....#.#",
        "#.#....#.#",
        "#........#",
        "##########",
        ".........."
    ],

    "fa-table-list": [
        "##########",
        "#........#",
        "##########",
        "#.#......#",
        "##########",
        "#.#......#",
        "##########",
        "#.#......#",
        "##########",
        ".........."
    ],

    "fa-cards": [
        "..#####...",
        "..#...#..#",
        "..#...#.##",
        "..#...####",
        "..#...#..#",
        "#######..#",
        "#..#..#..#",
        "#..#######",
        "#..#......",
        "####......"
    ],

    "fa-code": [
        "..........",
        ".##....##.",
        "##......##",
        "#..#..#..#",
        "#.#....#.#",
        "#.#....#.#",
        "#..#..#..#",
        "##......##",
        ".##....##.",
        ".........."
    ],

    "fa-book-atlas": [
        ".########.",
        "##......#.",
        "#...##..#.",
        "#..#..#.#.",
        "#..####.#.",
        "#..#..#.#.",
        "#...##..#.",
        "##......#.",
        ".########.",
        ".........."
    ],

    "fa-dice-d20": [
        "....##....",
        "..##..##..",
        ".#..##..#.",
        "#..#..#..#",
        "#.#....#.#",
        "#.#....#.#",
        "#..#..#..#",
        ".#..##..#.",
        "..##..##..",
        "....##...."
    ],

    "fa-gears": [
        ".#..#.....",
        "########..",
        ".######...",
        "##.##.##..",
        ".######..#",
        "########.#",
        ".#..#.####",
        "......####",
        ".....##.##",
        "......####"
    ],

    "fa-caret-left": [
        "......##..",
        ".....###..",
        "....####..",
        "...#####..",
        "..######..",
        "...#####..",
        "....####..",
        ".....###..",
        "......##..",
        ".........."
    ],

    // Kept for any chrome button that carries the class — the GM launcher,
    // which this was drawn for, wears the eye below instead (Dawid, 26.08).
    "fa-clock": [
        "...####...",
        ".##....##.",
        ".#...#..#.",
        "#....#...#",
        "#....#...#",
        "#....##..#",
        "#........#",
        ".#......#.",
        ".##....##.",
        "...####..."
    ],

    /* ---- the GM launcher ---- */

    // Monokuma's jagged red eye, the point slashing outward. The key is not a
    // Font Awesome class on purpose: the launcher is its only wearer, and the
    // generator routes this sprite to `#drpg-gm-launcher i` directly, so the
    // `<i>`'s own class stays a plain fallback glyph.
    // Drawn against Dawid's reference (26.08), corrected once more to it:
    // the TOP is not one smooth sweep — a horn rises at about a third of the
    // width and a concave notch drops behind it before the long climb to the
    // tall right tip. The left tip is a one-pixel point. Below, two scooped
    // arcs hang cusps of different depths: the first claw (~38% width)
    // reaches lowest, the second sits further right (~71%) and higher. On
    // the 24 grid, not 12: these curves die at 12px. The generator picks the
    // viewBox per sprite, so this one costs the others nothing.
    "drpg-monokuma-eye": [
        ".......................#",
        "......................##",
        "....................###.",
        "...................####.",
        ".................######.",
        ".......#........######..",
        "......###.....########..",
        ".....#####..#########...",
        "....#################...",
        "....##########..####....",
        "....#######......#......",
        "..#######...............",
        ".###....#...............",
        "##......................"
    ],

    /* ---- window headers ---- */

    // The close X, chunky and symmetric. Worn by every window's close button
    // (Dawid, 26.08: the close and toggle-controls glyphs go pixel wherever
    // they appear) — targeted by SPECIAL selectors, since the header buttons
    // live outside the rail-and-sidebar HOSTS.
    "drpg-x-close": [
        "##......##",
        "###....###",
        ".###..###.",
        "..######..",
        "...####...",
        "...####...",
        "..######..",
        ".###..###.",
        "###....###",
        "##......##"
    ],

    // Toggle controls: the vertical ellipsis, three square dots.
    "drpg-toggle-controls": [
        "###",
        "###",
        "###",
        "...",
        "###",
        "###",
        "###",
        "...",
        "###",
        "###",
        "###"
    ],

    /* ---- the Daggerheart menu ---- */

    // The system's sidebar button ships an <img> logo, not a Font Awesome
    // class — the one button on the rail the mask set could not reach. A
    // dagger, point down; the stylesheet hides the logo and this takes the
    // rail's own bone, like every neighbour (Dawid, 26.08).
    "drpg-daggerheart": [
        "...####...",
        "....##....",
        "....##....",
        "##########",
        "##########",
        "...####...",
        "...####...",
        "...####...",
        "...####...",
        "....##....",
        "....##....",
        "....##...."
    ]
};

/* ==========================================================================
 * THE GENERATOR
 * ========================================================================== */

/** Which sprite each Font Awesome class wears. Most are 1:1; the exceptions
 *  are the regular/solid pairs that share one drawing. */
const MAPPING = {
    ...Object.fromEntries(Object.keys(ICONS).map(k => [k, k])),
    // The regions "ring" tool is `fa-regular fa-circle`; the shape select's
    // circle is solid. Only the DOM class distinguishes them, and `fa-circle`
    // appears in both — the ring wins, because a filled 10px disc reads as a
    // blob while a ring reads as a circle.
    "fa-circle": "fa-circle-regular"
};

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
 * that wants the same drawing outside the selector map — the Remnant card's
 * header glyph wears the eye for GM-placed traces. One source of art: edit
 * the ASCII above, re-run, and the variable moves with the button.
 */
const EMIT_VARS = {
    "drpg-monokuma-eye": "--drpg-g-monokuma-eye"
};

function buildCss() {
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
       and comes out twice as big, flipped, and shoved out of its own tile —
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
   CHROME PIXEL ICONS — GENERATED by tools/chrome-icons.mjs. DO NOT EDIT HERE.
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

/* ---- write it into the stylesheet -------------------------------------- */

const css = buildCss();
const here = dirname(fileURLToPath(import.meta.url));
const sheet = join(here, "..", "styles", "danganronpa.css");
const text = await readFile(sheet, "utf8");

const START = "/* ==========================================================================\n   CHROME PIXEL ICONS — GENERATED";
const END = "/* == /CHROME PIXEL ICONS == */";

let out;
if (text.includes(END)) {
    const a = text.indexOf(START);
    const b = text.indexOf(END) + END.length;
    out = text.slice(0, a) + css + text.slice(b);
} else {
    out = text.replace(/\s*$/, "\n\n") + css + "\n";
}
await writeFile(sheet, out, "utf8");
console.log(`Wrote ${Object.keys(MAPPING).length} icon mappings (${Object.keys(ICONS).length} sprites) into danganronpa.css`);
