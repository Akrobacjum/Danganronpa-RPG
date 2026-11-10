/**
 * Danganronpa RPG - the hand-drawn pixel icons for Foundry's chrome.
 * ---------------------------------------------------------------------------
 * Every icon on the scene-controls rail and the sidebar tabs, redrawn by hand
 * on a 12x12 grid. The art is tools/glyphs.json's family `chrome` since E48 G1
 * (10.11.2026): each row a string, `#` a filled pixel, so editing an icon means
 * editing a picture, not a path string. It was this file's ICONS table; it moved
 * there whole, each drawing centred on its grid as this file's encode() centred
 * it, so the section this writes came out byte-equal (measured on a copy of
 * 120a8003's danganronpa.css). One drawing changed its row: `fa-circle` holds the
 * ring it was always drawn with (MAPPING sent it to `fa-circle-regular`), and
 * its own filled-circle art, which no button ever wore, is gone.
 *
 * Run with any Node-flavoured runtime:
 *
 *     ELECTRON_RUN_AS_NODE=1 "<foundry>.exe" tools/chrome-icons.mjs
 *
 * It rewrites the CHROME PIXEL ICONS section of styles/danganronpa.css in
 * place (between the GENERATED markers). Nothing else in the stylesheet is
 * touched. `node tools/glyph-map.mjs --check` holds the section to what this
 * writes, so an edit to the rows not run here is red there.
 *
 * The mapping keys are Font Awesome class names as they appear on the buttons
 * (`fa-user-large`, `icon-fa-cone`, ...), each row's `key`. A button whose
 * class has no sprite here keeps its vector glyph - another module's tool
 * degrades gracefully rather than turning into a blank square.
 *
 * The generator is scripts/tests-glyphs.mjs's `chromeCss` (it imports
 * nothing, so the suite's R3332 runs it on the served files); this file reads
 * the rows and writes the sheet.
 */

import { chromeCss } from "../scripts/tests-glyphs.mjs";

/* The generator (encode, HOSTS, SPECIAL, EMIT_VARS, chromeCss) is scripts/tests-glyphs.mjs's since E48 G1, moved
   whole, so tools/glyph-map.mjs and the suite's R3332 hold the sheet's section to it. */

/* ---- write it into the stylesheet -------------------------------------- */

if (typeof process !== "undefined" && process.versions?.node && process.argv?.[1]) {
    const { pathToFileURL, fileURLToPath } = await import("node:url");
    if (import.meta.url === pathToFileURL(process.argv[1]).href) {
        const { readFile, writeFile } = await import("node:fs/promises");
        const { dirname, join } = await import("node:path");
        const here = dirname(fileURLToPath(import.meta.url));
        const css = chromeCss(JSON.parse(await readFile(join(here, "glyphs.json"), "utf8")).glyphs);
        const sheet = join(here, "..", "styles", "danganronpa.css");
        // LF line ends (1.2.80 train, fix crlf-G1): START holds a "\n", and on a CRLF checkout indexOf(START) was -1 while END
        // was found - the splice below then kept the whole sheet, the old block in it, cut its last character and appended the
        // new block and the sheet's tail a second time (measured on a small CRLF text).
        const text = (await readFile(sheet, "utf8")).replace(/\r\n/g, "\n");

        const START = "/* ==========================================================================\n   CHROME PIXEL ICONS - GENERATED";
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
        console.log(`Wrote ${(css.match(/-webkit-mask-image/g) ?? []).length} icon mappings into danganronpa.css`);
    }
}
