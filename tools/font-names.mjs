/**
 * What each shipped font says about itself, against fonts/README.md (E26 prep, 14.11.2026).
 * ---------------------------------------------------------------------------
 *     node tools/check.mjs fonts
 *
 * Reads the `name` table of every fonts/*.woff2 in bare Node (the WOFF2 header, its table directory and the one
 * Brotli stream, `zlib.brotliDecompressSync`; `name` is never transformed) and holds fonts/README.md's licence table
 * to it:
 *   - every woff2 in fonts/ has a row, and a row names a woff2 that is there;
 *   - the row's licence is the one the font's own licence URL (name ID 14, else 13) names: the OFL or the Apache
 *     License 2.0;
 *   - a font whose copyright (name ID 0) reserves a font name and whose row says "modified" carries that name in none
 *     of its family, full, PostScript or typographic family names (IDs 1, 4, 6, 16): the OFL's condition 3.
 * Why: at 1463f22b the README called Special Elite OFL while its own name table said Apache 2.0, and the two pixel
 * files, redrawn on 13.11.2026 (62e6e1d2), still called themselves "Press Start 2P", the name their copyright
 * reserves. A planted set with three faults and a control runs first; the part fails when it does not see each.
 * It reads names, not glyphs: whether a file is modified is the README's word, which nothing here can measure.
 */

import zlib from "node:zlib";

/* WOFF2's known-table tags by their 6-bit index (the W3C WOFF2 recommendation, 5.1); 10 and 11 are glyf and loca,
   whose transform version 0 means transformed - for every other table a version other than 0 does. */
const KNOWN = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ",
    "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB",
    "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar",
    "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf",
    "Glat", "Gloc", "Feat", "Sill"];

/** The `name` table of a WOFF2 file as `{ id: text }`, Windows Unicode records first; throws on a file that is not one. */
export function woff2Names(buf) {
    if (buf.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error("not a WOFF2 file");
    const numTables = buf.readUInt16BE(12);
    const compressed = buf.readUInt32BE(20);
    let off = 48;
    const base128 = () => {
        let v = 0;
        for (let i = 0; i < 5; i++) {
            const b = buf[off++];
            v = v * 128 + (b & 0x7f);
            if (!(b & 0x80)) return v;
        }
        throw new Error("a UIntBase128 longer than five bytes");
    };
    const tables = [];
    for (let i = 0; i < numTables; i++) {
        const flags = buf[off++];
        let tag;
        if ((flags & 0x3f) === 63) { tag = buf.subarray(off, off + 4).toString("latin1"); off += 4; } else tag = KNOWN[flags & 0x3f];
        const version = flags >> 6;
        const orig = base128();
        const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
        tables.push({ tag, length: transformed ? base128() : orig });
    }
    if (buf.readUInt32BE(4) === 0x74746366) throw new Error("a font collection - not read here");
    const data = zlib.brotliDecompressSync(buf.subarray(off, off + compressed));
    let at = 0;
    let name = null;
    for (const t of tables) {
        if (t.tag === "name") name = data.subarray(at, at + t.length);
        at += t.length;
    }
    if (!name) throw new Error("no name table");
    const count = name.readUInt16BE(2), strings = name.readUInt16BE(4);
    const out = {};
    const records = [];
    for (let i = 0; i < count; i++) {
        const r = 6 + i * 12;
        records.push({ platform: name.readUInt16BE(r), id: name.readUInt16BE(r + 6), len: name.readUInt16BE(r + 8), at: name.readUInt16BE(r + 10) });
    }
    for (const r of records.sort((a, b) => (b.platform === 3) - (a.platform === 3))) {
        if (r.id in out) continue;
        const raw = name.subarray(strings + r.at, strings + r.at + r.len);
        out[r.id] = r.platform === 3 || r.platform === 0 ? Buffer.from(raw.subarray(0, raw.length & ~1)).swap16().toString("utf16le") : raw.toString("latin1");
    }
    return out;
}

/** fonts/README.md's licence table: `{ file: { face, licence, text } }`, from its "## Licences" section. */
export function licenceRows(readme) {
    const section = /^## Licences\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(readme.replace(/\r\n/g, "\n"))?.[1] ?? "";
    return Object.fromEntries([...section.matchAll(/^\| `([\w-]+\.woff2)` \| ([^|]+?) \| ([^|]+?) \| `([\w.-]+)` \|$/gm)]
        .map(m => [m[1], { face: m[2], licence: m[3], text: m[4] }]));
}

/** What the fonts `{ file: names }` and the table's rows disagree on, one line a fault. */
export function fontProblems(fonts, rows) {
    const problems = [];
    for (const file of Object.keys(rows)) if (!(file in fonts)) problems.push(`${file} has a licence row and is not in fonts/`);
    for (const [file, names] of Object.entries(fonts)) {
        const row = rows[file];
        if (!row) { problems.push(`${file} has no row in fonts/README.md's licence table`); continue; }
        const url = `${names[14] ?? ""} ${names[13] ?? ""}`;
        const kind = /apache/i.test(url) ? "Apache License 2.0" : /\bOFL\b|openfontlicense/i.test(url) ? "SIL Open Font License 1.1" : null;
        if (!kind) problems.push(`${file}: its name table names no licence the check knows ("${url.trim()}")`);
        else if (row.licence !== kind) problems.push(`${file}: the README says "${row.licence}", the font's own name table ${kind}`);
        const reserved = /Reserved Font Names?\s*"([^"]+)"/i.exec(names[0] ?? "")?.[1];
        if (reserved && /\bmodified\b/i.test(row.face)) {
            const squeezed = reserved.replace(/\s+/g, "").toLowerCase();
            const carries = [1, 4, 6, 16].filter(id => names[id] && (names[id].toLowerCase().includes(reserved.toLowerCase())
                || names[id].replace(/[\s-]+/g, "").toLowerCase().includes(squeezed)));
            if (carries.length) problems.push(`${file}: modified, and name ID ${carries.join(", ")} still carries the reserved font name "${reserved}"`);
        }
    }
    return problems;
}

/** The self-check: three planted faults and a control, each seen exactly once. */
export function fontSelfCheck() {
    const ofl = "http://scripts.sil.org/OFL", apache = "http://www.apache.org/licenses/LICENSE-2.0";
    const rfn = 'Copyright 2012 Someone, with Reserved Font Name "Pixel Face"';
    const fonts = {
        "a.woff2": { 0: "Copyright 2010 Someone", 1: "Typewriter", 14: apache },
        "b.woff2": { 0: rfn, 1: "Pixel Face", 4: "Pixel Face Regular", 6: "PixelFace-Regular", 14: ofl },
        "c.woff2": { 0: rfn, 1: "Our Pixel", 4: "Our Pixel Regular", 6: "OurPixel-Regular", 14: ofl },
        "d.woff2": { 0: "Copyright", 1: "Terminal", 14: ofl }
    };
    const rows = {
        "a.woff2": { face: "Typewriter", licence: "SIL Open Font License 1.1" },
        "b.woff2": { face: "Pixel Face, modified", licence: "SIL Open Font License 1.1" },
        "c.woff2": { face: "Pixel Face, modified", licence: "SIL Open Font License 1.1" }
    };
    const got = fontProblems(fonts, rows);
    const want = ["a.woff2: the README says", "b.woff2: modified, and name ID 1, 4, 6", "d.woff2 has no row"];
    return { want: want.length, seen: want.filter(w => got.filter(g => g.startsWith(w)).length === 1).length, got };
}
