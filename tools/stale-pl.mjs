/**
 * stale-pl (E57 C1, 14.11.2026; T9): which Polish texts were read beside the English they translate, and which of
 * them the English has since moved away from.
 * ---------------------------------------------------------------------------
 *     node tools/stale-pl.mjs --check
 *         every Polish key against its stamp in tools/pl-reviewed.json (scripts/tests-text.mjs `staleTranslations`,
 *         the same function `node tools/check.mjs text` runs as T9, FAIL): one line of counts, each stale key, exit 1
 *         on any. The gate's half is check.mjs's; this is the one to run by hand.
 *     node tools/stale-pl.mjs --sheet [--since <git ref>] [--all] [--out <file>]
 *         the reading sheet, Markdown, into <file> or audit/harness/results/text/stale-pl.md: every key that waits for a
 *         read - stale, rewritten, unstamped - with its English and Polish now; with --since, also every key whose
 *         English or Polish differs from <ref>'s (the plan's `--sheet --since v1.2.56`), with the English at <ref>
 *         beside it. The baseline's stamps (below) are counted, not listed, unless --all.
 *     node tools/stale-pl.mjs --stamp (--key <key> ... | --keys-from <sheet.md> | --all) [--baseline]
 *         writes the stamp of each key named - its English and Polish as they stand now - and drops the stamps of keys
 *         no Polish file holds. Run it only after the Polish of those keys was read beside the English: a stamp says
 *         "read", and nothing else knows whether it was (the plan's risk: a --stamp without a read switches the gate
 *         off without a trace). --baseline marks the stamps ":b", "written, not read"; E57 C1 wrote the first file so.
 *     node tools/stale-pl.mjs --self
 *         the self-check: the detector on its fixture, then a planted copy of this tree's files - an English text
 *         moved under its stamp - which --check must call stale, and one moved in both languages, which it must not.
 *
 * The file (tools/pl-reviewed.json; tools/ is export-ignore, and nothing at a table reads it): { "$comment", "stamped",
 * "keys" }. The plan named it lang/pl.reviewed.json; there `node tools/check.mjs package` reads diagnostics.mjs's
 * `lang/${code}.json` as every lang/*.json a table may load, so an export-ignored JSON file in lang/ is red (measured
 * 14.11.2026), and shipping 400 KB no table reads would be the wrong fix. It stands beside its tool, as
 * tools/tooltip-census.json and tools/css-budget.json stand beside theirs.
 * `keys` holds one "<english hash>:<polish hash>[:b]" per Polish key (tests-text.mjs `stampOf`, `textHash`), in key order,
 * one per line, so a stamp's diff is the keys it stamped. A Polish key's English is lang/en.json's key, or config.mjs's
 * English prose for a DRPG.Config key (walkConfigProse), or for a .few or .many its family's .other.
 *
 * Bare Node: config.mjs, i18n-config.mjs and tests-text.mjs import nothing a browser alone has. `git` for --since.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const T = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-text.mjs")).href);
const config = await import(url.pathToFileURL(path.join(REPO, "scripts", "config.mjs")).href);
const { walkConfigProse } = await import(url.pathToFileURL(path.join(REPO, "scripts", "i18n-config.mjs")).href);

export const REVIEWED = "tools/pl-reviewed.json";

/** This tree's texts, or a directory's en.json and pl.json (`dir`) with this tree's config prose. */
export function readTexts(dir = path.join(REPO, "lang")) {
    const flat = file => T.flatLang(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    const prose = new Map();
    walkConfigProse(config, (key, value) => prose.set(key, value));
    return { en: flat("en.json"), pl: flat("pl.json"), prose };
}

export function readReviewed(file = path.join(REPO, REVIEWED)) {
    if (!fs.existsSync(file)) return { keys: {} };
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Each Polish key's status, as T9 reads it; `byKey` is the detector's reading spelt out for the sheet. */
export function statusOf(texts, reviewed) {
    const E = texts.en, P = texts.pl, R = texts.prose, stamps = reviewed.keys ?? {};
    const byKey = new Map();
    for (const [key, polish] of P) {
        const english = T.englishOf(key, E, R);
        if (typeof polish !== "string" || typeof english !== "string") continue;
        const stamp = stamps[key];
        if (typeof stamp !== "string") { byKey.set(key, "unstamped"); continue; }
        const [enAt, plAt, mark] = stamp.split(":");
        const enSame = enAt === T.textHash(english), plSame = plAt === T.textHash(polish);
        byKey.set(key, enSame ? (mark === "b" ? "baseline" : "ok") : plSame ? "stale" : "rewritten");
    }
    return byKey;
}

/** The file's text: its stamps one per line in key order (a stamp's diff is its keys). */
export function reviewedText(doc) {
    const keys = Object.keys(doc.keys).sort();
    const head = JSON.stringify({ $comment: doc.$comment, stamped: doc.stamped }, null, 2).replace(/\n}$/, "");
    const rows = keys.map(k => `    ${JSON.stringify(k)}: ${JSON.stringify(doc.keys[k])}`).join(",\n");
    return `${head},\n  "keys": {\n${rows}\n  }\n}\n`;
}

const COMMENT = "E57 C1 (T9, stale-pl): per Polish key, the hashes of its English and its Polish when the Polish was last read "
    + "beside the English (scripts/tests-text.mjs stampOf). A stamp ending :b is the baseline written at E57 C1 from the "
    + "tree as it stood, not a read. Written by node tools/stale-pl.mjs --stamp only; read by node tools/check.mjs text (T9, FAIL) "
    + "and node tools/stale-pl.mjs --check. Nothing at a table reads it (export-ignore).";

/** Stamp `keys` (or every Polish key) as they stand in `texts`; answers the new document and how many it wrote and dropped. */
export function stamp(texts, reviewed, keys = null, { baseline = false, note = "", date = new Date().toISOString().slice(0, 10) } = {}) {
    const out = { ...reviewed.keys };
    let wrote = 0, dropped = 0;
    const unknown = [];
    for (const key of keys ?? [...texts.pl.keys()]) {
        const english = T.englishOf(key, texts.en, texts.prose), polish = texts.pl.get(key);
        if (typeof english !== "string" || typeof polish !== "string") { unknown.push(key); continue; }
        out[key] = T.stampOf(english, polish, baseline);
        wrote++;
    }
    for (const key of Object.keys(out)) if (!texts.pl.has(key)) { delete out[key]; dropped++; }
    const stamped = [...(reviewed.stamped ?? []), { date, keys: wrote, dropped, baseline, note }].slice(-20);
    return { doc: { $comment: COMMENT, stamped, keys: out }, wrote, dropped, unknown };
}

/** A key's text at a git ref, or undefined where the ref or the key has none. */
function textsAt(ref) {
    const show = file => {
        try { return JSON.parse(execFileSync("git", ["show", `${ref}:${file}`], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })); }
        catch { return null; }
    };
    const en = show("lang/en.json"), pl = show("lang/pl.json");
    if (!en || !pl) throw new Error(`--since ${ref}: git has no lang/en.json and lang/pl.json there`);
    return { en: T.flatLang(en), pl: T.flatLang(pl) };
}

const cell = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The reading sheet, Markdown. */
export function sheet(texts, reviewed, { since = null, all = false } = {}) {
    const byKey = statusOf(texts, reviewed);
    const then = since ? textsAt(since) : null;
    const rows = [];
    for (const [key, status] of byKey) {
        const english = T.englishOf(key, texts.en, texts.prose), polish = texts.pl.get(key);
        /* config.mjs's prose at <ref> is not read (its tables there would need that tree's imports): null, "(config.mjs)". */
        const englishThen = then ? (key.startsWith("DRPG.Config.") ? null : T.englishOf(key, then.en, new Map())) : undefined;
        const movedSince = then && ((englishThen !== undefined && englishThen !== null && englishThen !== english) || then.pl.get(key) !== polish);
        const waits = status === "stale" || status === "rewritten" || status === "unstamped" || (all && status === "baseline");
        if (waits || movedSince) rows.push({ key, status, english, polish, englishThen, movedSince });
    }
    const order = { stale: 0, rewritten: 1, unstamped: 2, baseline: 3, ok: 4 };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.key.localeCompare(b.key));
    const tally = {};
    for (const s of byKey.values()) tally[s] = (tally[s] ?? 0) + 1;
    const lines = [
        "# The Polish to read beside the English",
        "",
        `Written by \`node tools/stale-pl.mjs --sheet${since ? ` --since ${since}` : ""}${all ? " --all" : ""}\` on ${new Date().toISOString().slice(0, 10)}. `
            + `Polish keys: ${byKey.size}; ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(", ")}. `
            + "A row is a key that waits for a read (stale: the English moved, the Polish not; rewritten: both moved; unstamped: never stamped)"
            + (since ? `, or whose English or Polish differs from ${since}'s` : "") + ". After reading a row and correcting its Polish, "
            + "`node tools/stale-pl.mjs --stamp --key <key>` (or `--keys-from` this file) writes its stamp.",
        "",
        `| Key | Status |${since ? ` English at ${since} |` : ""} English | Polish |`,
        `| --- | --- |${since ? " --- |" : ""} --- | --- |`
    ];
    for (const r of rows) {
        lines.push(`| \`${r.key}\` | ${r.status}${r.movedSince ? ", moved since" : ""} |${since ? ` ${cell(r.englishThen === undefined ? "(none)" : r.englishThen === null ? "(config.mjs)" : r.englishThen)} |` : ""} ${cell(r.english)} | ${cell(r.polish)} |`);
    }
    return { text: `${lines.join("\n")}\n`, rows: rows.length, tally };
}

/** --check's reading: the detector's own result over the texts. */
export function check(texts, reviewed) {
    return T.staleTranslations({ en: texts.en, pl: texts.pl, prose: texts.prose, reviewed });
}

/** The self-check: the fixture, then this tree's files copied with one English moved alone and one moved with its Polish. */
export function selfCheck() {
    const out = [];
    const fx = T.FIXTURES.staleTranslations, r = T.staleTranslations(fx.input);
    if (JSON.stringify(r.found.map(T.itemOf)) !== JSON.stringify(fx.flags)) out.push(`the detector flags ${r.found.map(T.itemOf).join(", ") || "none"} of its fixture, not ${fx.flags.join(", ")}`);
    const texts = readTexts();
    const [first, second] = [...texts.pl.keys()].filter(k => texts.en.has(k)).slice(0, 2);
    const reviewed = stamp(texts, { keys: {} }).doc;
    const clean = check(texts, reviewed);
    if (clean.found.length || clean.counts.ok !== clean.read) out.push(`the tree stamped whole reads ${clean.found.length} stale and ${clean.counts.ok} ok of ${clean.read}, not 0 and all`);
    const planted = { ...texts, en: new Map(texts.en).set(first, `${texts.en.get(first)} (moved)`).set(second, `${texts.en.get(second)} (moved)`),
        pl: new Map(texts.pl).set(second, `${texts.pl.get(second)} (poprawione)`) };
    const red = check(planted, reviewed);
    const want = [`${first} stale`];
    if (JSON.stringify(red.found.map(T.itemOf)) !== JSON.stringify(want) || red.counts.rewritten !== 1) {
        out.push(`a planted English moved alone (${first}) and one moved with its Polish (${second}) read ${red.found.map(T.itemOf).join(", ") || "none"} and ${red.counts.rewritten} rewritten, not ${want.join(", ")} and 1`);
    }
    return { problems: out, planted: [first, second] };
}

/* ---------------------------------- the command ---------------------------------- */

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const argv = process.argv.slice(2);
    const opt = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
    const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : []));
    const texts = readTexts(), reviewed = readReviewed();
    if (argv.includes("--check")) {
        const r = check(texts, reviewed);
        console.log(`stale-pl: ${r.read} Polish key(s): ${Object.entries(r.counts).map(([k, n]) => `${k} ${n}`).join(", ")}`);
        for (const f of r.found) console.log(`stale-pl: ${f.what}`);
        process.exit(r.found.length || !(r.read > 0) ? 1 : 0);
    } else if (argv.includes("--sheet")) {
        const s = sheet(texts, reviewed, { since: opt("--since"), all: argv.includes("--all") });
        const out = path.resolve(REPO, opt("--out") ?? "audit/harness/results/text/stale-pl.md");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, s.text);
        console.log(`stale-pl: the sheet, ${s.rows} row(s), written to ${path.relative(REPO, out)} (${Object.entries(s.tally).map(([k, n]) => `${k} ${n}`).join(", ")})`);
    } else if (argv.includes("--stamp")) {
        let keys = many("--key");
        const from = opt("--keys-from");
        if (from) keys.push(...[...fs.readFileSync(path.resolve(from), "utf8").matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1]));
        if (argv.includes("--all")) keys = null;
        else if (!keys.length) { console.error("stale-pl: --stamp names what was read: --key <key> (again for more), --keys-from <sheet.md> or --all"); process.exit(2); }
        const r = stamp(texts, reviewed, keys, { baseline: argv.includes("--baseline"), note: opt("--note") ?? "" });
        if (r.unknown.length) { console.error(`stale-pl: no Polish key with an English holds ${r.unknown.join(", ")} - nothing written`); process.exit(1); }
        fs.writeFileSync(path.join(REPO, REVIEWED), reviewedText(r.doc));
        console.log(`stale-pl: ${r.wrote} stamp(s) written${argv.includes("--baseline") ? " as the baseline (not a read)" : ""}, ${r.dropped} dropped, in ${REVIEWED}`);
    } else if (argv.includes("--self")) {
        const s = selfCheck();
        for (const p of s.problems) console.log(`stale-pl: self: ${p}`);
        console.log(`stale-pl: self-check ${s.problems.length ? "RED" : "green"}: the fixture, the tree stamped whole, and ${s.planted.join(" moved alone, ")} moved with its Polish`);
        process.exit(s.problems.length ? 1 : 0);
    } else {
        console.error("stale-pl: --check, --sheet [--since <ref>] [--all] [--out <file>], --stamp (--key <key> | --keys-from <sheet> | --all) [--baseline], or --self");
        process.exit(2);
    }
}
