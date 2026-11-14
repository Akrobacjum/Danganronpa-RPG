/**
 * rules-parity (E57 C2, 14.11.2026): the rule numbers the handbooks state, held to scripts/config.mjs and to the code
 * that composes a number a reader is shown.
 * ---------------------------------------------------------------------------
 *     node tools/rules-parity.mjs            every rule below over the six handbooks; one line of counts, each problem;
 *                                            exit 1 on any problem
 *     node tools/rules-parity.mjs --json     the same as JSON (what `node tools/check.mjs rules` reads)
 *     node tools/rules-parity.mjs --self     the planted faults: a copy of config.mjs's tables with one number changed in
 *                                            each table the rules read, and the trap card's old "four to six" planted
 *                                            back into a copy of the GM handbook; each must be red, naming its rule
 *
 * WHY (docs/dev/e57/PLAN.md F1, F2). Measured on 1.2.109 (MEASURE-numbers.md) the handbooks' numbers already agreed with
 * the code save one, and that one - the trap card's "four to six actions" - was a copy of a number the code composes
 * (murder-ui.mjs `indirectCostText`), which no config table holds. So this is a guard against drift, built to be red
 * when a number moves on either side: its first run on this tree is green, and `--self` is what shows it can be red.
 *
 * HOW A RULE READS. The handbooks are cut into units by tools/handbook-facts.mjs `split` (a paragraph, a table row, a
 * note), markup stripped (`**`, `*`, backticks, `<ins>`, a link to its words). Three kinds of rule:
 *   - an anchor (RULES): a regular expression on the English unit's text with capture groups, each group the number a
 *     config path gives. Every match in the book must give the config's numbers, and the book must match at least once,
 *     so a sentence reworded out of the anchor's reach is red ("no unit states it") rather than silently unread;
 *   - a table row (generated from config, `rowRules`): each Hope and Despair Call by its label in a row's first cell,
 *     its cost the next cell; each crisis action by its label in a cell, its threshold the next cell's last number;
 *   - a composed number (COMPOSED): the function a reader's card is built by, called under a stand-in of Foundry with
 *     lang/en.json (`withFoundryStandIn`), its numbers held to an anchor as above.
 * The Polish unit is the one with the English unit's id (handbook-facts.mjs: the Polish handbook is written line for
 * line, and `check.mjs text` holds the ids equal); each number an English match gave must stand in it in digits, or as a
 * number word of NUMBER_WORDS. A number written in words, in either language, is reported (`words`) and not red: rule
 * numbers in digits is T7 (docs/text-style.md M-rules), whose FAIL for the handbooks comes with their rewrite, not here.
 *
 * WHAT IT DOES NOT READ. A rule stated in words only ("costs a little Sanity") has no number to hold; a number with no
 * rule below is unread (MEASURE-numbers.md's ~307 distinct numbers against the rules here is the gap, named in
 * docs/dev/e57/SPEC.md); a Polish sentence that gives the number elsewhere in another unit is red here, by design.
 *
 * Bare Node: config.mjs imports nothing; the composed numbers import the module's scripts behind a stand-in, in this
 * process only (check.mjs runs this file as a child process, so the stand-in never reaches its other parts).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const facts = await import(url.pathToFileURL(path.join(REPO, "tools", "handbook-facts.mjs")).href);

export const BOOKS = Object.freeze({ gm: "gm-handbook", player: "player-handbook", brochure: "player-brochure" });

/** A unit's text as a reader sees it: markup out, a link to its words, whitespace as one space. */
export function plain(text) {
    return String(text)
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/<\/?ins>/g, "")
        .replace(/\*\*|`/g, "")
        .replace(/(^|[\s(|])\*(?=\S)|(?<=\S)\*(?=[\s).,;:|]|$)/g, "$1")
        .replace(/\s+/g, " ");
}

/** Number words a handbook may use for a rule number (T7 is what wants digits): English and Polish, 0-12. */
export const NUMBER_WORDS = Object.freeze({
    en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
    pl: [["zero"], ["jeden", "jedna", "jedno", "jednej", "jednego", "jedną"], ["dwa", "dwie", "dwóch", "dwu"], ["trzy", "trzech"],
        ["cztery", "czterech"], ["pięć", "pięciu"], ["sześć", "sześciu"], ["siedem", "siedmiu"], ["osiem", "ośmiu"],
        ["dziewięć", "dziewięciu"], ["dziesięć", "dziesięciu"], ["jedenaście"], ["dwanaście"]]
});

/** A captured number as a value: digits as they are, an English number word as its value (`word: true`). */
function valueOf(token) {
    const t = String(token).trim().toLowerCase();
    if (/^\d+(\.\d+)?$/.test(t)) return { n: Number(t), word: false };
    const i = NUMBER_WORDS.en.indexOf(t);
    return i >= 0 ? { n: i, word: true } : { n: NaN, word: false };
}

/** Whether a Polish unit states `n`: as digits (a decimal comma read as a point), or as one of its number words. */
function polishStates(text, n) {
    const t = text.replace(/(\d),(\d)/g, "$1.$2");
    if (new RegExp(`(^|[^\\d.])${String(n).replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(t)) return { ok: true, word: false };
    const words = NUMBER_WORDS.pl[n] ?? [];
    if (words.some(w => new RegExp(`(^|[^\\p{L}])${w}(?![\\p{L}])`, "iu").test(text))) return { ok: true, word: true };
    return { ok: false, word: false };
}

const get = (obj, p) => p.split(".").reduce((o, k) => o?.[k], obj);
const sec = ms => ms / 1000;

/**
 * The hand-written rules: the numbers the plan's C2 names (topic A, C, D and the A10/A11 lists of the 05.10 and 13.10
 * amends, Call costs, Rest, Palm and Frisk, the crisis, the opening, the trial's timings), one anchor each, read on this
 * tree's handbooks (14.11.2026). `n` gives the numbers in the order of the anchor's groups.
 */
export const RULES = Object.freeze([
    { id: "starting", book: "brochure", n: C => [C.STARTING.hp, C.STARTING.stress, C.STARTING.hope, C.STARTING.hopeMax],
        anchor: /Health (\d+), Sanity (\d+), Hope (\d+) \(max (\d+)\)/g },
    { id: "search.tiers", book: "brochure", n: C => C.ACTIONS.search.thresholds.map(t => t.min),
        anchor: /(\d+)\+ Tier 0, (\d+)\+ Tier 1, (\d+)\+ Tier 2/g },
    { id: "palm.brochure", book: "brochure",
        n: C => [C.ACTIONS.palm.threshold, C.ACTIONS.palm.unseen.threshold, C.ACTIONS.palm.plant.threshold, C.ACTIONS.palm.plant.unseen,
            C.ACTIONS.palm.frisk.threshold, C.ACTIONS.palm.rummage.unseen, C.ACTIONS.palm.rummage.threshold],
        anchor: /Take \((\d+)\+, unseen (\d+)\+\) or plant \((\d+)\+, unseen (\d+)\+\).*?Body (\d+)\+ after a refusal; unseen Shadow (\d+)\+ then Hand (\d+)\+/g },
    { id: "palm.gm", book: "gm",
        n: C => [C.ACTIONS.palm.threshold, C.ACTIONS.palm.unseen.threshold, C.ACTIONS.palm.plant.threshold, C.ACTIONS.palm.plant.unseen,
            sec(C.TIMING.friskAnswerMs), C.ACTIONS.palm.frisk.threshold, C.ACTIONS.palm.rummage.unseen, C.ACTIONS.palm.rummage.threshold],
        anchor: /Take: (\d+) to succeed, (\d+) on Shadow to stay unseen\. Plant: (\d+), unseen (\d+)\. Frisk: .*?answers within (\d+) s.*?Body (\d+) after a refusal or no answer, unseen Shadow (\d+) then Hand (\d+)/g },
    { id: "rest.brochure", book: "brochure", n: C => [C.REST.short.actionCost, C.REST.short.picks, C.REST.long.actionCost, C.REST.long.picks],
        anchor: /Short: (\d+) actions?, pick (\d+), once per time of day\. Long: (\d+) actions?, pick (\d+), once per session/g },
    { id: "rest.gm", book: "gm", n: C => [C.REST.long.actionCost, C.REST.long.picks, C.REST.short.actionCost, C.REST.short.picks],
        anchor: /A Long Rest costs (\d+) actions?, picks (\d+) of the three options, once per session\. A Short Rest costs (\d+) actions?, picks (\d+), once per time of day/g },
    { id: "conceal.intent", book: "gm", n: C => [C.INDIRECT_MURDER.concealIntent.threshold],
        anchor: /rolls Shadow against (\d+) to conceal their intent/g },
    { id: "opening.killer", book: "gm", n: C => [C.MURDER_OPENING.killer.threshold],
        anchor: /opens on the killer's roll: Body or Hand against (\d+)/g },
    { id: "opening.victim", book: "brochure", n: C => [C.MURDER_OPENING.victim.threshold],
        anchor: /A trap asks you to roll \(Eye or Head vs (\d+)\)/g },
    { id: "crisis.brochure", book: "brochure", n: C => [C.CRISIS_ACTIONS.leaveClue.threshold, C.CRISIS_ACTIONS.secureTrace.threshold, C.CRISIS_ACTIONS.selfDefence.threshold],
        anchor: /Leave a Clue \((\d+)\), Secure a Trace \((\d+)\), Self-Defense \((\d+)/g },
    { id: "trap.keyRemnants", book: "gm", n: C => [C.KEY_REMNANTS.prepared],
        anchor: /A trap always leaves the case its full (\d+) Key Remnants/g },
    { id: "overflow.threshold", book: "gm", n: C => [C.OVERFLOW.threshold, C.OVERFLOW.range.min, C.OVERFLOW.range.max],
        anchor: /At the threshold \(default (\d+), editable between (\d+) and (\d+)/g },
    { id: "trial.debate", book: "gm", n: C => [C.TRIAL.speakSeconds, C.TRIAL.debateMinSeconds],
        anchor: /Open Debate with a budget in seconds \(default (\d+), at least (\d+)/g },
    { id: "trial.testimony", book: "gm", n: C => [C.TRIAL.modes.round.testimony.offered, C.TRIAL.modes.round.testimony.min, C.TRIAL.modes.round.testimony.max],
        anchor: /\| Testimony \| one participant at a time, in order \| (\d+) s a turn offered, (\d+) to (\d+) s \|/g },
    { id: "trial.rounds", book: "gm",
        n: C => { const r = C.TRIAL.modes.round; return [r.testimony.offered, r.testimony.min, r.testimony.max, r.panic.offered, r.panic.small, r.panic.smallFrom, r.panic.min, r.panic.max]; },
        anchor: /offers the seconds a turn - (\d+) s for Testimony at every size of table, typed again at each start, (\d+) to (\d+) s; (\d+) s for a Panic Round, (\d+) s from (\d+) participants on, (\d+) to (\d+) s/g },
    { id: "trap.budget", book: "gm",
        n: C => { const p = C.INDIRECT_MURDER.subProjects; return [p.reduce((s, x) => s + Math.min(...x.progress), 0), p.reduce((s, x) => s + Math.max(...x.progress), 0)]; },
        anchor: /The card advises about (\d+)-(\d+) progress in total/g }
]);

/** The table rows, generated: each Call by its label and cost, each crisis action by its label and threshold. */
export function rowRules(C) {
    const out = [];
    for (const [table, calls] of [["HOPE_CALLS", C.HOPE_CALLS], ["DESPAIR_CALLS", C.DESPAIR_CALLS]]) {
        for (const [key, call] of Object.entries(calls ?? {})) {
            /* A Call inside another (Talent's Experience and Ultimate, `inside`) is priced by its parent's row. A row is a
               Call's only where its second cell is a number: "Silence" is also an Overflow effect's row ("state"). */
            if (typeof call?.label !== "string" || typeof call?.cost !== "number" || call.inside) continue;
            out.push({ id: `${table}.${key}.cost`, label: call.label, want: [call.cost], cell: cells => (cells[0] === call.label && /^\d+$/.test(cells[1] ?? "") ? cells[1] : null), whole: true });
        }
    }
    for (const [key, a] of Object.entries(C.CRISIS_ACTIONS ?? {})) {
        if (typeof a?.label !== "string" || typeof a?.threshold !== "number") continue;
        out.push({ id: `CRISIS_ACTIONS.${key}.threshold`, label: a.label, want: [a.threshold],
            cell: cells => { const i = cells.indexOf(a.label); return i >= 0 && i + 1 < cells.length ? cells[i + 1] : null; }, last: true });
    }
    return out;
}

/**
 * The numbers composed by code a reader sees (F2). Each `read` is called with the module's scripts behind the stand-in
 * and answers the numbers its text holds; `anchor` finds the handbook's sentence, its groups those numbers in order.
 */
export const COMPOSED = Object.freeze([
    { id: "murder-ui.indirectCostText", book: "gm",
        read: async () => {
            const m = await import(url.pathToFileURL(path.join(REPO, "scripts", "murder-ui.mjs")).href);
            const text = m.indirectCostText();
            return { text, n: (text.match(/\d+/g) ?? []).map(Number) };
        },
        anchor: /The card advises about (\d+)-(\d+) progress in total, the two parts' sums at their smallest and largest scales, (\w+) to (\w+) actions/g }
]);

/** The six handbooks, split and in plain text: `books.gm.en` is the list of units, each `{ id, text, row }`. */
export function readBooks(dir = path.join(REPO, "docs", "handbooks"), override = {}) {
    const books = {};
    for (const [book, file] of Object.entries(BOOKS)) {
        books[book] = {};
        for (const lang of ["en", "pl"]) {
            const name = `${file}.${lang}.md`;
            const text = override[name] ?? fs.readFileSync(path.join(dir, name), "utf8");
            books[book][lang] = facts.split(text, { file: name }).units.map(u => ({ id: u.id, kind: u.kind, text: plain(u.text) }));
        }
    }
    return books;
}

/** One rule's matches over one book: problems, matches and words counted into `tally`. */
function holdAnchor(rule, want, books, tally) {
    const problems = [];
    const en = books[rule.book].en, pl = new Map(books[rule.book].pl.map(u => [u.id, u]));
    let matches = 0;
    for (const unit of en) {
        for (const m of unit.text.matchAll(rule.anchor)) {
            matches++;
            const got = m.slice(1).map(valueOf);
            if (got.length !== want.length || got.some((g, i) => g.n !== want[i])) {
                problems.push(`${rule.id}: ${BOOKS[rule.book]}.en.md ${unit.id} says ${got.map(g => (Number.isNaN(g.n) ? "?" : g.n)).join(", ")}, the code ${want.join(", ")} ("${m[0].slice(0, 160)}")`);
                continue;
            }
            tally.words += got.filter(g => g.word).length;
            const plUnit = pl.get(unit.id);
            if (!plUnit) { problems.push(`${rule.id}: ${BOOKS[rule.book]}.pl.md has no unit ${unit.id}, where the English states it`); continue; }
            /* In digits, the numbers must stand in the English order (a subsequence of the Polish unit's numbers), so a
               Polish number changed beside another that is the same is seen; a number with no digits in the unit may be
               a number word (reported). */
            const digits = (plUnit.text.replace(/(\d),(\d)/g, "$1.$2").match(/\d+(\.\d+)?/g) ?? []).map(Number);
            const inDigits = want.every(n => digits.includes(n));
            if (inDigits) {
                let at = 0;
                for (const d of digits) if (at < want.length && d === want[at]) at++;
                if (at < want.length) problems.push(`${rule.id}: ${BOOKS[rule.book]}.pl.md ${unit.id} gives ${digits.join(", ")}, not ${want.join(", ")} in its English unit's order`);
                continue;
            }
            for (const n of new Set(want)) {
                const s = polishStates(plUnit.text, n);
                if (!s.ok) problems.push(`${rule.id}: ${BOOKS[rule.book]}.pl.md ${unit.id} does not state ${n}, which its English unit states`);
                else if (s.word) tally.words++;
            }
        }
    }
    if (!matches) problems.push(`${rule.id}: no unit of ${BOOKS[rule.book]}.en.md states it any longer (/${rule.anchor.source.slice(0, 80)}/) - the sentence was reworded: write the anchor again, or take the rule out with the reason`);
    return { problems, matches };
}

/** Every rule, over `books`, against the config namespace `C` and the composed numbers given (`composed`, by id). */
export function parity(C, books, composed = {}) {
    const problems = [], tally = { rules: 0, matches: 0, words: 0, rows: 0 };
    for (const rule of RULES) {
        let want;
        try { want = rule.n(C); } catch (err) { problems.push(`${rule.id}: config.mjs gives no value (${err?.message ?? err})`); continue; }
        tally.rules++;
        const r = holdAnchor(rule, want, books, tally);
        tally.matches += r.matches;
        problems.push(...r.problems);
    }
    for (const rule of COMPOSED) {
        const c = composed[rule.id];
        if (!c) { problems.push(`${rule.id}: the function was not called`); continue; }
        tally.rules++;
        const r = holdAnchor(rule, c.n, books, tally);
        tally.matches += r.matches;
        problems.push(...r.problems);
    }
    /* The rows: a label every book's tables leave out is no problem (a Call the brochure does not list), but one that no
       handbook's table holds at all is - the generated rule would otherwise read nothing. */
    for (const rule of rowRules(C)) {
        tally.rules++;
        let seen = 0;
        for (const book of Object.keys(BOOKS)) {
            const pl = new Map(books[book].pl.map(u => [u.id, u]));
            for (const unit of books[book].en) {
                if (unit.kind !== "row") continue;
                const cells = unit.text.split("|").slice(1, -1).map(c => c.trim());
                const cell = rule.cell(cells);
                if (cell === null || cell === undefined) continue;
                seen++;
                tally.rows++;
                const nums = (cell.match(/\d+/g) ?? []).map(Number);
                const got = rule.last ? nums.at(-1) : (rule.whole && /^\d+$/.test(cell) ? Number(cell) : NaN);
                if (got !== rule.want[0]) {
                    problems.push(`${rule.id}: ${BOOKS[book]}.en.md ${unit.id}'s "${rule.label}" row says ${Number.isNaN(got) || got === undefined ? `"${cell.slice(0, 60)}"` : got}, the code ${rule.want[0]}`);
                    continue;
                }
                const plUnit = pl.get(unit.id);
                if (!plUnit || !polishStates(plUnit.text, rule.want[0]).ok) problems.push(`${rule.id}: ${BOOKS[book]}.pl.md ${unit.id} does not state ${rule.want[0]}, which its English row states`);
            }
        }
        if (!seen) problems.push(`${rule.id}: no handbook table has a row for "${rule.label}"`);
    }
    return { problems, tally };
}

/**
 * The stand-in of Foundry the composed numbers are called behind: `game.i18n` formatting from lang/en.json, and every
 * other Foundry global a proxy that answers itself, so the module's scripts import. Set once, in this process.
 */
export async function withFoundryStandIn() {
    const en = JSON.parse(fs.readFileSync(path.join(REPO, "lang", "en.json"), "utf8"));
    const lookup = key => get(en, key) ?? en[key];
    const any = new Proxy(function standIn() {}, {
        get: (t, k) => (k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : any), apply: () => any, construct: () => any
    });
    for (const name of ["foundry", "Hooks", "CONFIG", "CONST", "ui", "canvas", "Application", "document"]) globalThis[name] ??= any;
    globalThis.window ??= globalThis;
    const format = (key, data = {}) => String(typeof lookup(key) === "string" ? lookup(key) : key).replace(/{(\w+)}/g, (m, k) => (Object.hasOwn(data, k) ? String(data[k]) : m));
    globalThis.game ??= { i18n: { lang: "en", has: key => typeof lookup(key) === "string", localize: key => format(key), format }, settings: { get: () => undefined }, user: { isGM: true } };
}

/** The composed numbers on this tree. */
export async function composedNow() {
    await withFoundryStandIn();
    const out = {};
    for (const rule of COMPOSED) out[rule.id] = await rule.read();
    return out;
}

/**
 * The planted faults: one number changed in a deep copy of each config table a rule reads - each must turn its rule
 * red - and the trap card's "four to six actions" (the fault F2 found) planted back into a copy of the GM handbook,
 * which the composed rule must call red. Answers each plant that was not seen.
 */
export async function selfCheck(C, books, composed) {
    const missed = [];
    const clean = parity(C, books, composed);
    if (clean.problems.length) missed.push(`the tree itself is not green (${clean.problems.length} problem(s)), so a plant cannot be read`);
    const copy = () => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(C).filter(([, v]) => typeof v !== "function"))));
    const plants = [
        ["starting", c => { c.STARTING.hp += 1; }],
        ["search.tiers", c => { c.ACTIONS.search.thresholds[1].min += 1; }],
        ["palm.gm", c => { c.TIMING.friskAnswerMs += 1000; }],
        ["rest.gm", c => { c.REST.long.actionCost += 1; }],
        ["conceal.intent", c => { c.INDIRECT_MURDER.concealIntent.threshold += 1; }],
        ["opening.killer", c => { c.MURDER_OPENING.killer.threshold += 1; }],
        ["crisis.brochure", c => { c.CRISIS_ACTIONS.leaveClue.threshold += 1; }],
        ["overflow.threshold", c => { c.OVERFLOW.range.max += 1; }],
        ["trial.rounds", c => { c.TRIAL.modes.round.panic.smallFrom += 1; }],
        ["trap.budget", c => { c.INDIRECT_MURDER.subProjects[0].progress[0] += 1; }],
        ["HOPE_CALLS.support.cost", c => { c.HOPE_CALLS.support.cost += 1; }],
        ["DESPAIR_CALLS.obstacle.cost", c => { c.DESPAIR_CALLS.obstacle.cost += 1; }]
    ];
    for (const [id, change] of plants) {
        const c = copy();
        change(c);
        const r = parity(c, books, composed);
        if (!r.problems.some(p => p.startsWith(`${id}:`))) missed.push(`a number changed under ${id} was not seen`);
    }
    /* And a Polish number changed where its English unit states it, beside an equal number that stays ("6" twice). */
    const brochure = fs.readFileSync(path.join(REPO, "docs", "handbooks", "player-brochure.pl.md"), "utf8");
    const changed = brochure.replace("(maks. 6)", "(maks. 7)");
    if (changed === brochure) missed.push("the Polish brochure has no \"(maks. 6)\" to plant over");
    else if (!parity(C, readBooks(undefined, { "player-brochure.pl.md": changed }), composed).problems.some(p => p.startsWith("starting:"))) {
        missed.push("a Polish number changed in the brochure (maks. 6 -> 7) was not seen");
    }
    const gm = fs.readFileSync(path.join(REPO, "docs", "handbooks", "gm-handbook.en.md"), "utf8");
    const back = gm.replace(/four to five actions/, "four to six actions");
    if (back === gm) missed.push("the GM handbook has no \"four to five actions\" to plant the old words over");
    else {
        const r = parity(C, readBooks(undefined, { "gm-handbook.en.md": back }), composed);
        if (!r.problems.some(p => p.startsWith("murder-ui.indirectCostText:"))) missed.push("the trap card's \"four to six actions\" planted back was not seen");
    }
    return { missed, plants: plants.length + 2 };
}

/* ---------------------------------- the command ---------------------------------- */

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const argv = process.argv.slice(2);
    const C = await import(url.pathToFileURL(path.join(REPO, "scripts", "config.mjs")).href);
    const books = readBooks();
    const composed = await composedNow();
    const r = parity(C, books, composed);
    const self = argv.includes("--self") || argv.includes("--json") ? await selfCheck(C, books, composed) : null;
    if (argv.includes("--json")) {
        console.log(JSON.stringify({ problems: r.problems, tally: r.tally, self }));
        process.exit(0);
    }
    const t = r.tally;
    console.log(`rules-parity: ${t.rules} rule(s) (${RULES.length} by anchor, ${COMPOSED.length} composed, ${t.rules - RULES.length - COMPOSED.length} by table row); `
        + `${t.matches} sentence(s) and ${t.rows} row(s) read; ${t.words} number(s) in words (T7's, reported); ${r.problems.length} problem(s)`);
    for (const p of r.problems) console.log(`rules-parity: ${p}`);
    if (self) {
        for (const m of self.missed) console.log(`rules-parity: self: ${m}`);
        console.log(`rules-parity: self-check ${self.missed.length ? "RED" : "green"}: ${self.plants - self.missed.length} of ${self.plants} plant(s) seen`);
    }
    process.exit(r.problems.length || self?.missed.length ? 1 : 0);
}
