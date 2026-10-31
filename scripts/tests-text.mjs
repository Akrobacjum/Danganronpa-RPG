/**
 * Danganronpa RPG - the text lint: what the module says, read as data (E65, 31.10.2026).
 * ---------------------------------------------------------------------------
 * Pure detectors over the module's words - the two language files flattened,
 * config.mjs's English prose - each answering what it found and how much it
 * read. `node tools/check.mjs text` runs them in Node over the files on disk
 * (the ci layer, through `npm test`'s check part), and the suite runs the same
 * functions at a table: R1058 shows each its fixture, R1059 runs the FAIL ones
 * that need nothing but the served language files. So the Node check and the
 * suite cannot disagree about what a finding is.
 *
 * NO IMPORTS, AND NO FOUNDRY GLOBAL, for the reason tests-lint.mjs has none:
 * tools/check.mjs runs in bare Node, where the kit cannot be loaded (it imports
 * settings.mjs, which throws "Hooks is not defined" outside Foundry). The kit
 * imports this file and hands its names on, which is also how the source crawl
 * (moduleSources) reaches it - and, being a suite file (`isSuiteFile`), it is
 * never read by the module-wide scans (otherSources), so its fixtures are not
 * findings. Its own file, not tests-lint.mjs's: that file reads the suite's
 * code against the test author contract; this one reads the module's text
 * against the text rules (docs/text-style.md from E65 C5), and the two grow
 * with different stages.
 *
 * THE CONTRACT, the shape every detector here keeps:
 *   - it takes one plain object of inputs - `en` and `pl` (Maps, key to value, as
 *     `flatLang` gives them), `prose` (config.mjs's English prose by its
 *     `DRPG.Config.*` key, as i18n-config.mjs `walkConfigProse` visits it) - and
 *     reads only the ones it needs, so check.mjs and a tier hand every detector
 *     the same bag;
 *   - it returns `{ found, read }`: each finding `{ key, kind, what }` (`what` a
 *     sentence somebody can act on), and `read` how many candidates it looked
 *     at, the positive control: a detector that read nothing has proved nothing;
 *   - FIXTURES holds an input for it with its findings known, as `"<key> <kind>"`
 *     items, passing cases beside failing ones (a detector that flags everything
 *     proves as little as one that flags nothing); `selfCheck` runs each on its
 *     fixture before anything trusts it on the real files;
 *   - MODES says whether a finding of it is red ("fail") or printed ("report"),
 *     from which stage it is red (`fail`: E65 for the plan's five, a later stage
 *     for a report that turns), and which inputs it reads (`reads`), so a tier
 *     runs only what it can hand it.
 * At E65 C1 three detectors, all FAIL: T1 in two halves (`pluralForms`,
 * `configPlaceholders`) and T2 (`pairParity`). Measured on 99226e59 (31.10.2026,
 * a probe in the stage folder) before they were written: 168 English plural
 * families, each with its four Polish forms; 515 prose strings of config.mjs,
 * none with a placeholder its Polish twin lacks or adds; 4438 keys in both files,
 * none with another set of placeholders or HTML tags in Polish; 336 Polish
 * .few/.many forms, each with its .other's placeholders. So all three are FAIL
 * from the first day with no baseline, which is the plan's reason for them.
 *
 * WHAT IS NOT A TAG. `&nbsp;` and every other entity (none in either file on
 * 31.10, a fixture case so it stays so); `<-`, which DRPG.Music.diag.wins writes
 * in both languages as an arrow; a tag's attributes, which a translation may
 * change (a title). A tag is `<name ...>` or `</name>`, name a letter first.
 */

/** A language file's keys and values, flat, the way Foundry's expandObject reads dotted keys (tools/check.mjs `langEntries`). */
export function flatLang(obj) {
    const out = new Map();
    const walk = (o, p) => {
        for (const [k, v] of Object.entries(o ?? {})) {
            const key = p ? `${p}.${k}` : k;
            if (typeof v === "object" && v !== null) walk(v, key); else out.set(key, v);
        }
    };
    walk(obj, "");
    return out;
}

/** A Map as it is, a plain object of flat keys as a Map: fixtures are written as objects. */
const asMap = x => x instanceof Map ? x : new Map(Object.entries(x ?? {}));

/** The `{name}` placeholders of a string, each once, sorted; `except` leaves some out (`{a}`, as `parity` does). */
export function placeholders(text, { except = [] } = {}) {
    return [...new Set(String(text ?? "").match(/\{\w+\}/g) ?? [])].filter(p => !except.includes(p)).sort();
}

/** The HTML tags of a string as `b` and `/b`, every one counted, sorted; attributes and entities are not read. */
export function htmlTags(text) {
    return [...String(text ?? "").matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^<>]*>/gi)].map(m => `${m[1]}${m[2].toLowerCase()}`).sort();
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const shown = list => list.length ? list.join(" ") : "none";

/* ------------------------------- T1, T2 ------------------------------------ */

/**
 * T1, its first half (plan, S13-58): every English plural family - a key ending
 * `.one` or `.other` - has both English forms and the four Polish ones, `.one`,
 * `.few`, `.many` and `.other`. The rule `node tools/check.mjs parity` already
 * holds (CLAUDE.md, "Every English key needs a Polish twin"); here so that the
 * text lint states it and a tier holds it on the files a table serves. A Polish
 * `.few`/`.many` with no English family is not this detector's (none on 31.10).
 */
export function pluralForms({ en, pl } = {}) {
    const E = asMap(en), P = asMap(pl);
    const families = [...new Set([...E.keys()].filter(k => /\.(one|other)$/.test(k)).map(k => k.replace(/\.(one|other)$/, "")))];
    const found = [];
    for (const f of families) {
        for (const form of ["one", "other"]) {
            if (!E.has(`${f}.${form}`)) found.push({ key: `${f}.${form}`, kind: "en", what: `en.json lacks ${f}.${form}, a form of the plural family ${f}` });
        }
        for (const form of ["one", "few", "many", "other"]) {
            if (!P.has(`${f}.${form}`)) found.push({ key: `${f}.${form}`, kind: "pl", what: `pl.json lacks ${f}.${form}, a Polish form of the plural family ${f}` });
        }
    }
    return { found, read: families.length };
}

/**
 * T1, its second half (plan, S13-58's other half): every `DRPG.Config.*` value
 * in pl.json has exactly the placeholders of config.mjs's English prose for that
 * key - none dropped, none added. en.json holds no `DRPG.Config.*` (config.mjs is
 * the English), so `parity` cannot read these, and `prose` counts only that the
 * keys are there. A key the Polish file lacks is `prose`'s, and not read here.
 * Exactly: no `{a}` set aside, because config.mjs's prose holds none (31.10).
 */
export function configPlaceholders({ prose, pl } = {}) {
    const C = asMap(prose), P = asMap(pl);
    const found = [];
    let read = 0;
    for (const [key, english] of C) {
        const polish = P.get(key);
        if (typeof polish !== "string" || typeof english !== "string") continue;
        read++;
        const a = placeholders(english), b = placeholders(polish);
        const dropped = a.filter(p => !b.includes(p)), extra = b.filter(p => !a.includes(p));
        if (dropped.length) found.push({ key, kind: "dropped", what: `pl.json ${key} drops ${dropped.join(" ")}, which config.mjs's English has` });
        if (extra.length) found.push({ key, kind: "extra", what: `pl.json ${key} adds ${extra.join(" ")}, which config.mjs's English does not fill` });
    }
    return { found, read };
}

/**
 * T2 (plan): every key both files hold says the same placeholders - `{a}` set
 * aside on both sides, as `parity` sets it aside - and the same HTML tags, each
 * as often; `parity` reads only a placeholder Polish drops, never one it adds,
 * and no tags. Then every Polish `.few` and `.many` (keys en.json never has)
 * holds the placeholders of its family's `.other`, the English one where there
 * is one (it is the one the code fills), else the Polish.
 */
export function pairParity({ en, pl } = {}) {
    const E = asMap(en), P = asMap(pl);
    const found = [];
    let read = 0;
    const except = ["{a}"];
    for (const [key, english] of E) {
        const polish = P.get(key);
        if (typeof english !== "string" || typeof polish !== "string") continue;
        read++;
        const a = placeholders(english, { except }), b = placeholders(polish, { except });
        if (!same(a, b)) found.push({ key, kind: "placeholders", what: `${key}: en.json fills ${shown(a)}, pl.json ${shown(b)}` });
        const ta = htmlTags(english), tb = htmlTags(polish);
        if (!same(ta, tb)) found.push({ key, kind: "tags", what: `${key}: en.json has the tags ${shown(ta)}, pl.json ${shown(tb)}` });
    }
    for (const [key, polish] of P) {
        const m = key.match(/^(.*)\.(few|many)$/);
        if (!m || E.has(key) || typeof polish !== "string") continue;
        const other = E.has(`${m[1]}.other`) ? E.get(`${m[1]}.other`) : P.get(`${m[1]}.other`);
        if (typeof other !== "string") continue;
        read++;
        const a = placeholders(other, { except }), b = placeholders(polish, { except });
        if (!same(a, b)) found.push({ key, kind: "plural", what: `pl.json ${key} fills ${shown(b)}, and its family's .other ${shown(a)}` });
    }
    return { found, read };
}

/* --------------------------------- modes ----------------------------------- */

/**
 * Each detector's T number, whether its finding is red, from which stage, and
 * what it reads. The plan's five FAIL tests are T1, T2, T3, T6 and T14 (its
 * risk: a lint in FAIL from the first day would stop the gate on debt this stage
 * does not make); every other detector reports until the stage named in `fail`.
 */
export const MODES = Object.freeze({
    pluralForms: Object.freeze({ test: "T1", mode: "fail", fail: "E65", reads: Object.freeze(["lang"]) }),
    configPlaceholders: Object.freeze({ test: "T1", mode: "fail", fail: "E65", reads: Object.freeze(["lang", "prose"]) }),
    pairParity: Object.freeze({ test: "T2", mode: "fail", fail: "E65", reads: Object.freeze(["lang"]) })
});

export const DETECTORS = Object.freeze({ pluralForms, configPlaceholders, pairParity });

/** A finding as a fixture names it. */
export const itemOf = f => `${f.key} ${f.kind}`;

/* -------------------------------- fixtures --------------------------------- */

/**
 * Each detector's input with its findings known (`flags`, as `itemOf` writes
 * them). Here and not in a tier file for tests-lint.mjs's reason: the scans of
 * the module must not meet them. Every case that should pass is named in a
 * comment beside it; a fixture's dash or minus, when one is needed, is written
 * as an escape ("\u2013"), never the character (`dashes` reads code).
 */
export const FIXTURES = Object.freeze({
    pluralForms: {
        flags: ["DRPG.Fx.figs.many pl", "DRPG.Fx.figs.other pl", "DRPG.Fx.pears.few pl", "DRPG.Fx.plums.one en"],
        input: {
            en: {
                "DRPG.Fx.apples.one": "{n} apple", "DRPG.Fx.apples.other": "{n} apples",       // whole in both: passes
                "DRPG.Fx.pears.one": "{n} pear", "DRPG.Fx.pears.other": "{n} pears",           // pl lacks .few
                "DRPG.Fx.plums.other": "{n} plums",                                             // en lacks .one
                "DRPG.Fx.figs.one": "{n} fig", "DRPG.Fx.figs.other": "{n} figs",               // pl lacks .many and .other
                "DRPG.Fx.single": "One sentence"                                                // no family: passes
            },
            pl: {
                "DRPG.Fx.apples.one": "{n} jabłko", "DRPG.Fx.apples.few": "{n} jabłka", "DRPG.Fx.apples.many": "{n} jabłek", "DRPG.Fx.apples.other": "{n} jabłka",
                "DRPG.Fx.pears.one": "{n} gruszka", "DRPG.Fx.pears.many": "{n} gruszek", "DRPG.Fx.pears.other": "{n} gruszki",
                "DRPG.Fx.plums.one": "{n} śliwka", "DRPG.Fx.plums.few": "{n} śliwki", "DRPG.Fx.plums.many": "{n} śliwek", "DRPG.Fx.plums.other": "{n} śliwki",
                "DRPG.Fx.figs.one": "{n} figa", "DRPG.Fx.figs.few": "{n} figi",
                "DRPG.Fx.single": "Jedno zdanie",
                "DRPG.Fx.polishOnly.few": "{n} razy", "DRPG.Fx.polishOnly.many": "{n} razy"     // Polish forms, no English family: passes
            }
        }
    },
    configPlaceholders: {
        flags: ["DRPG.Config.FX.hint.y extra", "DRPG.Config.FX.label.w dropped", "DRPG.Config.FX.label.w extra", "DRPG.Config.FX.label.x dropped"],
        input: {
            prose: {
                "DRPG.Config.FX.label.x": "Lose {hp} Hit Points",          // pl drops {hp}
                "DRPG.Config.FX.hint.y": "No placeholder here",            // English fills none, pl adds {n}
                "DRPG.Config.FX.effect.z": "{who} gains {n} Hope",         // the same two, another order: passes
                "DRPG.Config.FX.label.w": "{n} left",                      // pl drops {n} and adds {count}
                "DRPG.Config.FX.label.v": "Not translated yet"             // pl lacks it: prose's, not read
            },
            pl: {
                "DRPG.Config.FX.label.x": "Tracisz Punkty Wytrzymałości",
                "DRPG.Config.FX.hint.y": "Tu jest {n}",
                "DRPG.Config.FX.effect.z": "{n} Nadziei dla {who}",
                "DRPG.Config.FX.label.w": "zostało {count}",
                "DRPG.Config.FX.label.u": "Tylko po polsku"                // no English prose: prose's extra, not read
            }
        }
    },
    pairParity: {
        flags: ["DRPG.Fx.bold tags", "DRPG.Fx.cards.few plural", "DRPG.Fx.dropped placeholders", "DRPG.Fx.extraWho placeholders", "DRPG.Fx.items.many plural"],
        input: {
            en: {
                "DRPG.Fx.same": "{name} opens {room}",                      // the same two, another order: passes
                "DRPG.Fx.extraWho": "{name} waits",                         // pl adds {who}
                "DRPG.Fx.dropped": "{name} takes {item}",                   // pl drops {item}
                "DRPG.Fx.article": "{a} {item}",                            // {a} set aside: passes
                "DRPG.Fx.bold": "<b>{name}</b> wins",                       // pl drops the <b>
                "DRPG.Fx.boldKept": "<b>{name}</b> wins",                   // passes
                "DRPG.Fx.entity": "one&nbsp;line",                          // an entity is no tag: passes
                "DRPG.Fx.arrow": " <- wins",                                // an arrow is no tag: passes
                "DRPG.Fx.attr": "<span title=\"Room\">{n}</span>",          // another attribute: passes
                "DRPG.Fx.items.one": "{n} item", "DRPG.Fx.items.other": "{n} items",
                "DRPG.Fx.cards.one": "{n} card", "DRPG.Fx.cards.other": "{n} cards",
                "DRPG.Fx.onlyEnglish": "{name} alone"                       // pl lacks it: parity's, not read
            },
            pl: {
                "DRPG.Fx.same": "{room}: {name} otwiera",
                "DRPG.Fx.extraWho": "{name} czeka na {who}",
                "DRPG.Fx.dropped": "{name} bierze",
                "DRPG.Fx.article": "{item}",
                "DRPG.Fx.bold": "{name} wygrywa",
                "DRPG.Fx.boldKept": "<b>{name}</b> wygrywa",
                "DRPG.Fx.entity": "jedna linia",
                "DRPG.Fx.arrow": " <- wygrywa",
                "DRPG.Fx.attr": "<span title=\"Pokój\">{n}</span>",
                "DRPG.Fx.items.one": "{n} rzecz", "DRPG.Fx.items.few": "{n} rzeczy", "DRPG.Fx.items.many": "rzeczy", "DRPG.Fx.items.other": "{n} rzeczy",
                "DRPG.Fx.cards.one": "{n} karta", "DRPG.Fx.cards.few": "{n} karty dla {who}", "DRPG.Fx.cards.many": "{n} kart", "DRPG.Fx.cards.other": "{n} karty"
            }
        }
    }
});

/**
 * Every detector on its fixture: [] when each flags exactly its fixture's items
 * and read something, else one sentence a mismatch. `detectors` defaults to this
 * file's; check.mjs and R1058 pass nothing, a planted fault passes its own.
 */
export function selfCheck(detectors = DETECTORS) {
    const out = [];
    const names = new Set([...Object.keys(MODES), ...Object.keys(FIXTURES)]);
    for (const name of names) {
        if (!MODES[name]) { out.push(`${name} has a fixture and no mode`); continue; }
        const fx = FIXTURES[name];
        if (!fx) { out.push(`${name} has a mode and no fixture`); continue; }
        const run = detectors?.[name];
        if (typeof run !== "function") { out.push(`${name} is not a detector`); continue; }
        let r;
        try { r = run(fx.input); } catch (err) { out.push(`${name} throws on its fixture (${err?.message ?? err})`); continue; }
        const items = (r?.found ?? []).map(itemOf).sort(), want = [...fx.flags].sort();
        if (!same(items, want)) out.push(`${name} flags ${items.length ? items.join(", ") : "none"} of its fixture, not ${want.join(", ")} - the detector is broken`);
        if (!(r?.read > 0)) out.push(`${name} read nothing of its fixture`);
    }
    return out;
}
