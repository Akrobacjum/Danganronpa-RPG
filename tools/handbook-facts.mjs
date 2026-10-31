/**
 * The handbook-facts tool (E65 C12, I13, E65-21): a handbook cut into units, and the facts an agent lists of each, held to
 * one shape.
 * ---------------------------------------------------------------------------
 *     node tools/handbook-facts.mjs split <handbook.md> [--section N] [--out <file>]
 *                                  the units, as JSON, into <file> or audit/harness/results/text/handbook-units.<name>.json
 *     node tools/handbook-facts.mjs check <facts.json> --units <units.json>
 *                                  every fact held to the shape below and to a unit of <units.json>; exit 1 on a problem
 *     node tools/handbook-facts.mjs count <facts.json> [--units <units.json>]
 *                                  the facts by kind, and the units with none
 *     node tools/handbook-facts.mjs prompt        the agent prompt below, as text
 *     node tools/handbook-facts.mjs self          the self-check; `node tools/check.mjs text` runs it too
 *
 * Bare Node, no imports beyond node:*. Nothing at a table reads this tool or its files: tools/ is export-ignored, and the
 * facts files E57 writes (docs/handbook-facts.en.json, docs/handbook-facts.pl.json) are export-ignored in .gitattributes.
 *
 * THE UNITS. `split` reads a handbook (CRLF read as LF) line by line and cuts it into units of three kinds:
 *   - `paragraph`: a run of lines up to a blank line, a heading or another block; a list item (`- `, `* `, `+ `, `1. `)
 *     with its continuation lines and its deeper sub-items is one paragraph of its own; a fenced block (```) is one
 *     paragraph, fences included;
 *   - `row`: a table's row (not its header or the line of dashes under it), its cells as written, the header beside it
 *     (`head`); a row that does not end with "|" goes on to the next lines until one does - a row wrapped by hand is
 *     one unit, its place the line it starts on;
 *   - `note`: a block of ">" lines - GitHub's [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] and [!CAUTION] (the marker kept
 *     as `alert`, its line left out of the text) and a plain quote alike; one note is one unit, whatever paragraphs and
 *     list items it holds. A note indented under a list item closes the item and is a note of its own.
 * Headings and horizontal rules are no units. A unit's `place` is its heading path below the title ("8. Traces and
 * evidence > Remnants") and the line it starts on; its `id` is `s<section>.<p|r|n><ordinal>`: the section is the number
 * a "## " heading starts with ("## 8. Traces" is s8), or that heading's ordinal among the "## " headings where it has
 * none (the brochure), s0 before the first; the ordinal counts the units of that kind in that section from 1. So an id
 * does not move when a line is added in another section, and the Polish handbook, written line for line beside the
 * English one, gives the same ids (read by `node tools/check.mjs text` on every pair, and printed).
 *
 * THE FACTS. A facts file is `{ "handbook": "<path>", "facts": [ ... ] }`, each fact exactly
 *   { "id", "unit", "place", "kind", "text", "keywords" }
 * - `unit` an id of the units file, `place` that unit's place copied, `id` `<unit>.f<n>` with n 1, 2, ... in file order
 *   within the unit; `kind` one of KINDS; `text` one sentence, no line break, no U+2013 or U+2014; `keywords` one to
 *   five words or phrases, each standing in the unit's text as written (markup aside, case aside) - so a keyword cannot
 *   carry a word the unit does not hold. `handbook`, where both files name one, is the units file's.
 * `check` names every fault; `count` gives the totals two runs are compared by.
 *
 * THE AGENT PROMPT. Given to an agent that has no editing context, with one units file (`split`'s output) and nothing
 * else - not the module, not the other handbook, not another agent's facts. `node tools/handbook-facts.mjs prompt`
 * prints the text between its two marker lines, so the prompt has one copy.
 *
 * AGENT PROMPT (begin)
 * You are given one file: the units of a handbook (JSON: `handbook`, `units`, each unit `id`, `kind`, `place`, `text`,
 * and for a table row `head`, the table's header). Read only that file. Write one JSON file:
 *   { "handbook": <the units file's handbook>, "facts": [ ... ] }
 * listing the atomic facts each unit states, unit by unit in the units' order.
 *
 * An atomic fact is the smallest statement that is true or false on its own, or one piece of advice. Rules:
 * 1. Nothing merged: a sentence that says two things gives two facts ("X is unremovable and becomes a Y" is two). A
 *    list of the members of one set is one fact ("visibility is Obvious, Evident, Subtle or Hidden"); a list whose
 *    members each get something said of them gives one fact per member. Two verbs, or two objects of one verb, joined
 *    by "and" or "or" give one fact each ("does not let you rename an item or change its picture or description" is
 *    three; "stays and is recorded" is two). A list after a colon or a dash, naming what the sentence before it names,
 *    is one fact of its own, apart from that sentence, of kind rule ("Most of what you do leaves one: a, b, c" is two:
 *    "Most of what you do leaves one" and "What leaves one: a, b, c").
 * 2. Nothing added: state only what the unit says. No inference, no knowledge of the game, nothing from another unit -
 *    except that a list item, or a row, may be read with the lead-in or header it hangs from, to make its fact whole.
 * 3. A table row: one fact per cell after the first, the first cell its subject and the header its predicate
 *    ("Prep Remnant: Observe 9 / 12 / 15 / 18"); a cell of several sentences gives its facts as a paragraph would; a
 *    cell that holds only "-" or nothing gives none.
 * 4. A unit that states nothing (a lead-in that only opens a list, a bare code line) gives no fact.
 * 5. Each fact: `id` "<unit id>.f<n>", n from 1 within the unit; `unit` the unit's id; `place` the unit's place copied
 *    exactly; `text` one sentence in the handbook's language (Polish for a Polish handbook), the unit's own words where
 *    they serve, no line break, "-" for a dash; `keywords` one to five words or short phrases copied from the unit's
 *    text exactly as they stand there (the game's names as written, in the handbook's language and inflection).
 * 6. `kind`, the first of these that fits:
 *    exception  - it carves a case out of another statement ("except on a Truth Bullet", "only the Autopsy");
 *    condition  - it says when or only when something holds ("only once you hold", "if", "unless", "while");
 *    number     - its point is a value: a number, a difficulty, a cost, a count, a ladder;
 *    warning    - it says what goes wrong, what is lost, or what not to do;
 *    reason     - it says why something is so;
 *    example    - it gives an instance as an illustration;
 *    tip        - it advises the reader, or says what to press or where to look;
 *    rule       - any other statement of how the game or the screen works.
 * Write nothing but the JSON file.
 * AGENT PROMPT (end)
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

export const UNIT_KINDS = Object.freeze(["paragraph", "row", "note"]);
export const KINDS = Object.freeze(["rule", "number", "condition", "exception", "example", "tip", "warning", "reason"]);
const KIND_LETTER = Object.freeze({ paragraph: "p", row: "r", note: "n" });
const FACT_FIELDS = Object.freeze(["id", "unit", "place", "kind", "text", "keywords"]);
const DASHES = new RegExp("[\u2013\u2014]");

const lf = text => String(text).replace(/\r\n/g, "\n");
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+/;
const QUOTE = /^(\s*)>\s?/;
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/;
const TABLE = /^\s*\|/;
const DELIMITER = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/**
 * The units of one handbook's text. `file` is only carried into the result. Deterministic: the same text gives the
 * same units, field for field (the self-check splits its fixture twice; `text` splits every handbook twice).
 */
export function split(text, { file = null } = {}) {
    const lines = lf(text).split("\n");
    const units = [], problems = [];
    const path = [];
    let section = "0", h2 = 0;
    const ordinals = new Map();
    const sections = new Set(["0"]);
    let open = null;
    const close = () => {
        if (!open) return;
        const body = open.kind === "note" ? open.lines.filter((l, i) => !(i === 0 && ALERT.test(l.trim()))) : open.lines;
        const textOf = open.kind === "row" ? body.map(l => l.trim()).join(" ") : body.join("\n").replace(/^\n+|\n+$/g, "");
        if (textOf.trim()) {
            const k = `${section}.${KIND_LETTER[open.kind]}`;
            const n = (ordinals.get(k) ?? 0) + 1;
            ordinals.set(k, n);
            const unit = { id: `s${section}.${KIND_LETTER[open.kind]}${n}`, kind: open.kind, place: `${path.length ? path.join(" > ") : "(before the first section)"}, line ${open.line}`, text: textOf };
            if (open.kind === "row") unit.head = open.head;
            if (open.alert) unit.alert = open.alert;
            units.push(unit);
        }
        open = null;
    };
    let table = null, fence = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i], at = i + 1;
        if (fence) {
            open.lines.push(line);
            if (FENCE.test(line) && line.trim().startsWith(fence)) { fence = null; close(); }
            continue;
        }
        if (open?.kind === "row" && open.wrapping) {
            if (!line.trim()) { problems.push(`line ${open.line}: a table row that does not end with "|" runs into a blank line`); open.wrapping = false; close(); table = null; continue; }
            open.lines.push(line);
            if (line.trimEnd().endsWith("|")) { open.wrapping = false; close(); }
            continue;
        }
        const heading = HEADING.exec(line);
        if (heading) {
            close(); table = null;
            const level = heading[1].length, title = heading[2];
            if (level === 1) continue;
            if (level === 2) {
                h2 += 1;
                const number = /^(\d+)\./.exec(title);
                section = number ? number[1] : String(h2);
                if (sections.has(section)) problems.push(`line ${at}: section ${section} again ("${title}") - its ids would repeat`);
                sections.add(section);
            }
            path.length = Math.max(0, level - 2);
            path[level - 2] = title;
            for (let j = 0; j < level - 2; j++) if (path[j] === undefined) path[j] = "";
            continue;
        }
        if (!line.trim()) { close(); table = null; continue; }
        if (FENCE.test(line)) {
            close(); table = null;
            fence = line.trim().slice(0, 3);
            open = { kind: "paragraph", line: at, lines: [line] };
            continue;
        }
        if (RULE.test(line) && !TABLE.test(line)) { close(); table = null; continue; }
        if (TABLE.test(line)) {
            if (!table) {
                close();
                table = { head: line.trim() };
                if (i + 1 < lines.length && DELIMITER.test(lines[i + 1]) && lines[i + 1].includes("-")) i += 1;
                continue;
            }
            close();
            open = { kind: "row", line: at, lines: [line], head: table.head };
            if (!line.trimEnd().endsWith("|")) open.wrapping = true;
            else close();
            continue;
        }
        if (table) table = null;
        const quote = QUOTE.exec(line);
        if (quote) {
            const inner = line.slice(quote[0].length);
            if (open?.kind === "note" && open.indent === quote[1].length) { open.lines.push(inner); continue; }
            close();
            const alert = ALERT.exec(inner.trim());
            open = { kind: "note", line: at, lines: [inner], indent: quote[1].length, alert: alert ? alert[1] : null };
            continue;
        }
        const item = ITEM.exec(line);
        if (item) {
            const indent = item[1].length;
            if (open?.item && indent > open.indent) { open.lines.push(line); continue; }
            close();
            open = { kind: "paragraph", line: at, lines: [line], item: true, indent };
            continue;
        }
        if (open && open.kind === "paragraph") { open.lines.push(line); continue; }
        close();
        open = { kind: "paragraph", line: at, lines: [line] };
    }
    if (fence) problems.push(`line ${open.line}: a fenced block that never closes`);
    close();
    const counts = { units: units.length, sections: sections.size, ...Object.fromEntries(UNIT_KINDS.map(k => [k, units.filter(u => u.kind === k).length])) };
    return { handbook: file, units, counts, problems };
}

/** The units of one section (`s8`), or all. */
export function section(result, n) {
    if (n === null || n === undefined) return result;
    const units = result.units.filter(u => u.id.startsWith(`s${n}.`));
    return { ...result, section: String(n), units, counts: { units: units.length, sections: 1, ...Object.fromEntries(UNIT_KINDS.map(k => [k, units.filter(u => u.kind === k).length])) } };
}

const plain = s => String(s).replace(/<\/?[a-z]+[^>]*>/gi, "").replace(/[*`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const isText = v => typeof v === "string" && v.trim().length > 0;

/** Every fault of a facts document against a units document; [] when it holds. */
export function check(facts, units) {
    const out = [];
    if (!units || !Array.isArray(units.units)) return ["the units file has no list of units"];
    if (!facts || typeof facts !== "object" || Array.isArray(facts) || !Array.isArray(facts.facts)) return ["the facts file is not { handbook, facts: [...] }"];
    for (const k of Object.keys(facts)) if (!["$comment", "handbook", "facts"].includes(k)) out.push(`the facts file has a field "${k}" it does not know`);
    if (isText(facts.handbook) && isText(units.handbook) && facts.handbook !== units.handbook) out.push(`the facts are of ${facts.handbook}, the units of ${units.handbook}`);
    const byId = new Map(units.units.map(u => [u.id, u]));
    const seen = new Set(), next = new Map();
    facts.facts.forEach((f, i) => {
        const where = `fact ${i + 1}${f && typeof f.id === "string" ? ` (${f.id})` : ""}`;
        if (!f || typeof f !== "object" || Array.isArray(f)) { out.push(`${where} is no object`); return; }
        for (const k of FACT_FIELDS) if (!Object.hasOwn(f, k)) out.push(`${where} has no "${k}"`);
        for (const k of Object.keys(f)) if (!FACT_FIELDS.includes(k)) out.push(`${where} has a field "${k}" a fact does not have`);
        const unit = byId.get(f.unit);
        if (Object.hasOwn(f, "unit") && !unit) out.push(`${where}'s unit ${JSON.stringify(f.unit)} is no unit of the units file`);
        if (typeof f.id === "string") {
            if (seen.has(f.id)) out.push(`${where}: the id is used twice`);
            seen.add(f.id);
            if (unit) {
                const n = (next.get(unit.id) ?? 0) + 1;
                next.set(unit.id, n);
                if (f.id !== `${unit.id}.f${n}`) out.push(`${where}'s id is not ${unit.id}.f${n}`);
            }
        } else if (Object.hasOwn(f, "id")) out.push(`${where}'s id is not a string`);
        if (unit && Object.hasOwn(f, "place") && f.place !== unit.place) out.push(`${where}'s place ${JSON.stringify(f.place)} is not its unit's, ${JSON.stringify(unit.place)}`);
        if (Object.hasOwn(f, "kind") && !KINDS.includes(f.kind)) out.push(`${where}'s kind ${JSON.stringify(f.kind)} is none of ${KINDS.join(", ")}`);
        if (Object.hasOwn(f, "text")) {
            if (!isText(f.text)) out.push(`${where}'s text is empty`);
            else {
                if (/\n/.test(f.text)) out.push(`${where}'s text breaks a line`);
                if (DASHES.test(f.text)) out.push(`${where}'s text holds an en or em dash (the house rule: "-")`);
            }
        }
        if (Object.hasOwn(f, "keywords")) {
            if (!Array.isArray(f.keywords) || f.keywords.length < 1 || f.keywords.length > 5 || !f.keywords.every(isText)) out.push(`${where}'s keywords are not one to five words or phrases`);
            else if (unit) {
                const body = plain(`${unit.text} ${unit.head ?? ""}`);
                for (const k of f.keywords) if (!body.includes(plain(k))) out.push(`${where}'s keyword ${JSON.stringify(k)} does not stand in its unit's text`);
            }
        }
    });
    return out;
}

/** The totals two runs are compared by. */
export function count(facts, units = null) {
    const list = Array.isArray(facts?.facts) ? facts.facts : [];
    const byKind = Object.fromEntries(KINDS.map(k => [k, list.filter(f => f?.kind === k).length]));
    const perUnit = new Map();
    for (const f of list) perUnit.set(f?.unit, (perUnit.get(f?.unit) ?? 0) + 1);
    const out = { facts: list.length, units: perUnit.size, byKind };
    if (units && Array.isArray(units.units)) {
        out.unitsRead = units.units.length;
        out.withNone = units.units.filter(u => !perUnit.has(u.id)).map(u => u.id);
        out.byUnit = Object.fromEntries(units.units.map(u => [u.id, perUnit.get(u.id) ?? 0]));
    }
    return out;
}

/* ------------------------------- the self-check ------------------------------- */

/* A handbook of three sections (two numbered, one not, as the brochure's are), each edge of the slice once: a table with
   a row wrapped by hand across a line break, a [!NOTE] inside a list, a [!WARNING] of two paragraphs, a fenced block, a
   rule, a lead-in before the first section and a sub-item that stays its item's. CRLF on purpose: read as LF. */
export const FIXTURE = [
    "# A Handbook", "", "*For testing.*", "", "> [!NOTE]", "> Names stay English.", "", "---", "",
    "## 1. First", "", "A paragraph", "over two lines.", "", "- an item,", "  continued;", "  - a sub-item", "- a second item",
    "   > [!NOTE]", "   > A note inside the list.", "", "### Sub", "", "```", "code line", "```", "",
    "## 2. Second", "", "| Thing | Cost |", "|---|---|", "| One | 2 |", "| Two, wrapped | 3", "and more |", "| Three | - |", "",
    "> [!WARNING]", "> First paragraph.", ">", "> Second paragraph.", "",
    "## Unnumbered", "", "1. Step one.", "2. Step two.", ""
].join("\r\n");

/* What the fixture must give: each unit's id, kind and place line. */
export const FIXTURE_UNITS = Object.freeze([
    "s0.p1 paragraph 3", "s0.n1 note 5",
    "s1.p1 paragraph 12", "s1.p2 paragraph 15", "s1.p3 paragraph 18", "s1.n1 note 19", "s1.p4 paragraph 24",
    "s2.r1 row 32", "s2.r2 row 33", "s2.r3 row 35", "s2.n1 note 37",
    "s3.p1 paragraph 44", "s3.p2 paragraph 45"
]);

/* Facts on the fixture: CLEAN holds; FAULTY carries one fault per line of FAULTS, which `check` must name, no more. */
const placeOf = id => split(FIXTURE).units.find(u => u.id === id)?.place;
const fact = (id, unit, kind, text, keywords, extra = {}) => ({ id, unit, place: placeOf(unit), kind, text, keywords, ...extra });
export function fixtureFacts() {
    const clean = { handbook: "fixture.md", facts: [
        fact("s0.n1.f1", "s0.n1", "rule", "Names stay English.", ["Names"]),
        fact("s1.p1.f1", "s1.p1", "rule", "A paragraph runs over two lines.", ["two lines"]),
        fact("s2.r1.f1", "s2.r1", "number", "One costs 2.", ["One", "Cost"]),
        fact("s2.r2.f1", "s2.r2", "number", "Two costs 3.", ["wrapped", "and more"]),
        fact("s2.r2.f2", "s2.r2", "rule", "Two is wrapped.", ["Two"])
    ] };
    const faulty = { handbook: "fixture.md", facts: [
        fact("s0.n1.f1", "s0.n1", "rule", "Names stay English.", ["Names"]),
        fact("s0.n1.f1", "s0.n1", "rule", "Twice.", ["Names"]),
        fact("s9.p1.f1", "s9.p1", "rule", "No such unit.", ["x"]),
        { ...fact("s1.p1.f1", "s1.p1", "rule", "A wrong place.", ["paragraph"]), place: "First, line 1" },
        fact("s1.p2.f1", "s1.p2", "guess", "A kind of none.", ["item"]),
        fact("s1.p3.f1", "s1.p3", "rule", "A keyword the unit lacks.", ["elephant"]),
        fact("s1.p4.f2", "s1.p4", "rule", "Out of sequence.", ["code"]),
        fact("s2.r1.f1", "s2.r1", "rule", "A dash \u2014 here.", ["One"]),
        fact("s2.r3.f1", "s2.r3", "rule", "", []),
        fact("s3.p1.f1", "s3.p1", "tip", "An extra field.", ["Step one"], { note: "x" })
    ] };
    delete faulty.facts[faulty.facts.length - 2].keywords;
    return { clean, faulty };
}
export const FAULTS = Object.freeze([
    "fact 2 (s0.n1.f1): the id is used twice",
    "fact 2 (s0.n1.f1)'s id is not s0.n1.f2",
    "fact 3 (s9.p1.f1)'s unit \"s9.p1\" is no unit of the units file",
    "fact 4 (s1.p1.f1)'s place \"First, line 1\" is not its unit's, \"1. First, line 12\"",
    "fact 5 (s1.p2.f1)'s kind \"guess\" is none of rule, number, condition, exception, example, tip, warning, reason",
    "fact 6 (s1.p3.f1)'s keyword \"elephant\" does not stand in its unit's text",
    "fact 7 (s1.p4.f2)'s id is not s1.p4.f1",
    "fact 8 (s2.r1.f1)'s text holds an en or em dash (the house rule: \"-\")",
    "fact 9 (s2.r3.f1) has no \"keywords\"",
    "fact 9 (s2.r3.f1)'s text is empty",
    "fact 10 (s3.p1.f1) has a field \"note\" a fact does not have"
]);

/**
 * The self-check: the fixture's units as FIXTURE_UNITS says, the same on a second split, no id twice, the wrapped row
 * and the note in the list read as one unit each, no split problem; `check` names FAULTS exactly and passes the clean
 * facts; `count` reads the clean facts. Returns its problems; [] when it holds.
 */
export function selfCheck(splitter = split, checker = check) {
    const out = [];
    const first = splitter(FIXTURE, { file: "fixture.md" }), second = splitter(FIXTURE, { file: "fixture.md" });
    const got = first.units.map(u => `${u.id} ${u.kind} ${/line (\d+)$/.exec(u.place)?.[1]}`);
    if (JSON.stringify(got) !== JSON.stringify(FIXTURE_UNITS)) out.push(`split cuts the fixture into ${JSON.stringify(got)}, not ${JSON.stringify(FIXTURE_UNITS)}`);
    if (JSON.stringify(first) !== JSON.stringify(second)) out.push("split gives the fixture other units on a second run - its ids are not stable");
    if (new Set(first.units.map(u => u.id)).size !== first.units.length) out.push("split gives one id twice on the fixture");
    if (first.units.find(u => u.id === "s2.r2")?.text !== "| Two, wrapped | 3 and more |") out.push(`split reads the wrapped row as ${JSON.stringify(first.units.find(u => u.id === "s2.r2")?.text)}, not "| Two, wrapped | 3 and more |"`);
    if (first.units.find(u => u.id === "s1.n1")?.text !== "A note inside the list.") out.push(`split reads the note inside the list as ${JSON.stringify(first.units.find(u => u.id === "s1.n1")?.text)}`);
    if (first.units.find(u => u.id === "s2.n1")?.alert !== "WARNING") out.push("split does not keep the warning's marker");
    if (first.problems.length) out.push(`split finds problems in the fixture: ${first.problems.join("; ")}`);
    const { clean, faulty } = fixtureFacts();
    const cleanFaults = checker(clean, first);
    if (cleanFaults.length) out.push(`check faults the clean facts: ${cleanFaults.join("; ")}`);
    const faults = checker(faulty, first);
    if (JSON.stringify(faults) !== JSON.stringify(FAULTS)) out.push(`check names ${JSON.stringify(faults)}, not ${JSON.stringify(FAULTS)}`);
    const c = count(clean, first);
    if (c.facts !== 5 || c.units !== 4 || c.byKind.number !== 2 || c.withNone.length !== first.units.length - 4) out.push(`count reads the clean facts as ${JSON.stringify({ facts: c.facts, units: c.units, number: c.byKind.number, withNone: c.withNone.length })}, `
        + `not 5 facts on 4 units, 2 numbers, ${first.units.length - 4} unit(s) with none`);
    return out;
}

/** The prompt between its two marker lines of this file's header. */
export function promptText(source = fs.readFileSync(url.fileURLToPath(import.meta.url), "utf8")) {
    const lines = lf(source).split("\n");
    const from = lines.findIndex(l => /AGENT PROMPT \(begin\)/.test(l)), to = lines.findIndex(l => /AGENT PROMPT \(end\)/.test(l));
    if (from < 0 || to <= from) return null;
    return lines.slice(from + 1, to).map(l => l.replace(/^ \* ?/, "")).join("\n") + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const [command, ...rest] = process.argv.slice(2);
    const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
    const readJson = f => JSON.parse(fs.readFileSync(path.resolve(f), "utf8"));
    const say = line => console.log(`handbook-facts: ${line}`);
    if (command === "split") {
        const file = rest.find(a => !a.startsWith("--") && a !== opt("--section") && a !== opt("--out"));
        if (!file) { say("split takes a handbook"); process.exit(2); }
        const rel = path.relative(REPO, path.resolve(file)).split(path.sep).join("/");
        const result = section(split(fs.readFileSync(path.resolve(file), "utf8"), { file: rel }), opt("--section"));
        const out = opt("--out") ?? path.join(REPO, "audit", "harness", "results", "text", `handbook-units.${path.basename(file, ".md")}${opt("--section") ? `.s${opt("--section")}` : ""}.json`);
        fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
        fs.writeFileSync(path.resolve(out), JSON.stringify(result, null, 1) + "\n");
        const c = result.counts;
        say(`split ${rel}${result.section ? ` section ${result.section}` : ""}: ${c.units} unit(s) - paragraph ${c.paragraph}, row ${c.row}, note ${c.note} - in ${c.sections} section(s); ${result.problems.length} problem(s)${result.problems.length ? `: ${result.problems.join("; ")}` : ""}; wrote ${path.relative(process.cwd(), path.resolve(out))}`);
        process.exit(result.problems.length ? 1 : 0);
    } else if (command === "check" || command === "count") {
        const factsFile = rest.find(a => !a.startsWith("--") && a !== opt("--units"));
        if (!factsFile || (command === "check" && !opt("--units"))) { say(`${command} takes <facts.json>${command === "check" ? " --units <units.json>" : " [--units <units.json>]"}`); process.exit(2); }
        const facts = readJson(factsFile), units = opt("--units") ? readJson(opt("--units")) : null;
        if (command === "check") {
            const faults = check(facts, units);
            for (const f of faults) say(`check: ${f}`);
            say(`check ${factsFile}: ${Array.isArray(facts?.facts) ? facts.facts.length : 0} fact(s) against ${units.units?.length ?? 0} unit(s); ${faults.length} problem(s)`);
            process.exit(faults.length ? 1 : 0);
        }
        const c = count(facts, units);
        say(`count ${factsFile}: ${c.facts} fact(s) on ${c.units} unit(s)${c.unitsRead !== undefined ? ` of ${c.unitsRead}, ${c.withNone.length} with none${c.withNone.length ? ` (${c.withNone.join(", ")})` : ""}` : ""}; by kind ${KINDS.map(k => `${k} ${c.byKind[k]}`).join(", ")}`);
        if (c.byUnit) say(`count by unit: ${Object.entries(c.byUnit).map(([u, n]) => `${u} ${n}`).join(", ")}`);
    } else if (command === "prompt") {
        const p = promptText();
        if (!p) { say("the prompt's marker lines are not in the header"); process.exit(1); }
        process.stdout.write(p);
    } else if (command === "self") {
        const problems = selfCheck();
        for (const p of problems) say(`self: ${p}`);
        say(`self: ${FIXTURE_UNITS.length} fixture unit(s), ${FAULTS.length} planted fault(s); ${problems.length} problem(s)`);
        process.exit(problems.length ? 1 : 0);
    } else {
        say("split <handbook> [--section N] [--out <file>] | check <facts.json> --units <units.json> | count <facts.json> [--units <units.json>] | prompt | self");
        process.exit(2);
    }
}
