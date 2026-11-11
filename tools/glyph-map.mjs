/**
 * The module's pixel glyphs from one source (E48 G1, 10.11.2026).
 * ---------------------------------------------------------------------------
 *     node tools/glyph-map.mjs           writes the generated files from tools/glyphs.json
 *     node tools/glyph-map.mjs --check   writes nothing; exit 1 on any problem below
 *
 * tools/glyphs.json holds every drawing the module wears - 240 on 10.11.2026: the 86 of the generated px set, the
 * stylesheets' 73 `--drpg-g-`, 7 `--drpg-r-`, 10 `--drpg-pix-` and one `--drpg-px-star-outline`, and the 63 chrome
 * masks - each as rows of "." and "#", one string a row. Its header says what each field means.
 *
 * WHAT IT WRITES, from the rows of family px that name no sheet, in the file's order: icons/pixel-sprite.svg (each as
 * `<symbol id="px-NAME">`), styles/pixel-icons.css (each as `--drpg-px-NAME` on the body, then `FA` below masked to
 * its glyph under Stained Glass) and the `<symbol>` block of docs/design/identity-audit-v13.html. These are the three
 * tools/pixel-icons.py wrote, and the text is that script's, line for line, so the move changed no byte but
 * pixel-icons.css's first line (the generator's name): measured at E48 G1 against 120a8003, the sprite and the audit
 * page byte-equal, pixel-icons.css different in line 1 alone. The chrome rows are tools/chrome-icons.mjs's art; that
 * tool writes danganronpa.css's chrome section from them (`chromeCss`).
 *
 * WHAT `--check` HOLDS (`glyphProblems`, which the suite's R3333 runs on the files Foundry serves):
 *   - each row of glyphs.json: a known shape of fields, a name unique in its family, `grid` rows each `grid` wide of
 *     "." and "#" only, at least one "#"; no two rows draw the same pixels on the same grid unless one says `same`
 *     naming the other, and a `same` that names a row drawing other pixels is a fault;
 *   - the three generated files equal to what this writes (the first differing line is named);
 *   - every `FA` name maps to a glyph of the generated set;
 *   - every SVG data URI in danganronpa.css and stained-glass.css equal to its row pixel for pixel: a custom property
 *     `--drpg-<family>-<name>: url(...)` to the row whose `prop` it is, a rule's `mask-image` and `-webkit-mask-image`
 *     (the two the same) to the row whose `rule` is the rule's first selector; a URI with no row, and a row whose URI
 *     the sheet no longer holds, are faults. Pixel for pixel, not byte for byte: the sheets spell their rectangles
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
