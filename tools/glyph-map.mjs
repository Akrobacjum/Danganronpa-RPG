/**
 * The module's pixel glyphs from one source (E48 G1, 10.11.2026).
 * ---------------------------------------------------------------------------
 *     node tools/glyph-map.mjs           writes the generated files from tools/glyphs.json
 *     node tools/glyph-map.mjs --check   writes nothing; exit 1 on any problem below
 *
 * tools/glyphs.json holds every drawing the module wears - 470 rows on 11.11.2026 (E48 G4): the 86 of the generated px
 * set (the sprite's, and Stained Glass's fallback), 131 legacy (Monokuma Legacy's drawings as they were: the 89 the
 * stylesheets held by hand until G4 - 71 action, Call, crisis and GM tiles, 7 sheet row buttons, 10 pips, markers and
 * launcher faces, one star outline - and 42 px drawings a sheet or a script reads by name), 190 glass (the drawing
 * rounds' approved set) and the 63 chrome masks - each as rows of "." and "#", one string a row. Its header says what
 * each field means.
 *
 * WHAT IT WRITES: icons/pixel-sprite.svg (each px row as `<symbol id="px-NAME">`, each glass row as `pix-NAME`), the
 * audit page's symbols, and styles/pixel-icons.css: every legacy row as `--drpg-pix-NAME` on :root, for both themes;
 * then FACES's Font Awesome classes masked to their glass glyph under Stained Glass through the `--drpg-glyph` slot;
 * then the glass section (`glassCssOf`), each glyph Stained Glass wears declared as `--drpg-pix-NAME` on the theme's
 * body over Legacy's of the same name, keyed on the element (`glassRules`). THE ONE PREFIX (G4): no rule reads a
 * glyph under any other; R3349 holds it, and that every name a sheet or a script reads is a legacy row.
 * At G1 the text was tools/pixel-icons.py's, line for line, so the move changed no byte but
 * pixel-icons.css's first line (the generator's name): measured at E48 G1 against 120a8003, the sprite and the audit
 * page byte-equal, pixel-icons.css different in line 1 alone. The chrome rows are tools/chrome-icons.mjs's art; that
 * tool writes danganronpa.css's chrome section from them (`chromeCss`), the one block of data URIs a sheet still holds.
 *
 * WHAT `--check` HOLDS (`glyphProblems`, which the suite's R3333 runs on the files Foundry serves):
 *   - each row of glyphs.json: a known shape of fields, a name unique in its family, `grid` rows each `grid` wide of
 *     "." and "#" only, at least one "#"; no two rows draw the same pixels on the same grid unless one says `same`
 *     naming the other, and a `same` that names a row drawing other pixels is a fault;
 *   - the three generated files equal to what this writes (the first differing line is named);
 *   - every `FA` name maps to a glyph of the generated set;
 *   - every SVG data URI in danganronpa.css and stained-glass.css equal to its row pixel for pixel: a rule's
 *     `mask-image` and `-webkit-mask-image` (the two the same) to the row whose `rule` is the rule's first selector (a
 *     custom property's URI to the row whose `prop` it is, none since G4); a URI with no row, and a row whose URI the
 *     sheet no longer holds, are faults. Pixel for pixel, not byte for byte: the sheets spell their rectangles
 *     several ways (`h-3z`, `H3z`, `v2`), and what the eye sees is the pixels;
 *   - danganronpa.css's chrome section equal to what chrome-icons.mjs writes from the chrome rows.
 * `selfCheck` plants a drift of each kind in a copy and is red unless each is seen; `node tools/check.mjs glyphs` runs
 * both.
 *
 * The arithmetic is scripts/tests-glyphs.mjs's, which imports nothing (as tests-css.mjs), so the suite runs the same
 * functions; this file re-exports it and is the CLI.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { GLYPH_FILES, SPRITE, PIXEL_CSS, AUDIT_PAGE, parseGlyphs, dataProblems, generated, spriteOf, pixelCssOf, auditPageOf,
    glyphProblems, FA } from "../scripts/tests-glyphs.mjs";

export * from "../scripts/tests-glyphs.mjs";

const lf = text => String(text).replace(/\r\n/g, "\n");

/* ------------------------------ the CLI ------------------------------------- */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const files = Object.fromEntries(GLYPH_FILES.map(f => {
        try { return [f, fs.readFileSync(path.join(REPO, f), "utf8")]; } catch { return [f, null]; }
    }));
    if (process.argv.includes("--check")) {
        const { problems, counts } = glyphProblems(files);
        for (const p of problems) console.log(`glyph-map: ${p}`);
        console.log(`glyph-map: ${JSON.stringify(counts)}; ${problems.length} problem(s)`);
        process.exitCode = problems.length ? 1 : 0;
    } else {
        const { glyphs, problems } = parseGlyphs(files["tools/glyphs.json"] ?? "");
        const bad = [...problems, ...(problems.length ? [] : dataProblems(glyphs))];
        if (bad.length) { for (const p of bad) console.log(`glyph-map: ${p}`); process.exit(1); }
        fs.writeFileSync(path.join(REPO, SPRITE), spriteOf(glyphs));
        fs.writeFileSync(path.join(REPO, PIXEL_CSS), pixelCssOf(glyphs));
        fs.writeFileSync(path.join(REPO, AUDIT_PAGE), auditPageOf(glyphs, lf(files[AUDIT_PAGE])));
        console.log(`glyph-map: wrote ${generated(glyphs).length} glyphs of ${glyphs.length} into ${SPRITE}, ${PIXEL_CSS}, ${AUDIT_PAGE}; fa ${Object.keys(FA).length}`);
    }
}
