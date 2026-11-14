/**
 * The repository's own checks, in Node, without Foundry (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node tools/check.mjs [part ...] [--release vX.Y.Z]   every part when none is named
 *     node tools/check.mjs text --lang <dir>              `text` over <dir>/en.json and <dir>/pl.json
 *     node tools/check.mjs text --all                     `text` with every report finding printed
 *
 * One entry point, so CI and a release run the same command and a part added
 * later is not a new script somebody forgets to call. Each part prints its own
 * numbers - what it read as well as what it found, because a part that read
 * nothing has proved nothing - and the exit code is 1 when any part is red.
 * Only `names`, `moves`, `text` and `comments` need `npm ci` in audit/harness (they
 * parse with espree; `text` since E65 C10, for the screen map); the rest are bare
 * Node, so release.yml runs `stamps notes` before installing anything.
 *
 * Parts:
 *   stamps    module.json's version, the `--drpg-css-version` stamp in
 *             styles/danganronpa.css, the first five lines of each of the six
 *             handbooks and README's "describe version X." agree; with
 *             `--release`, the tag is "v" + that version. These were three
 *             shell steps of release.yml and R125; the handbooks said 1.2.55
 *             under a 1.2.56 module once (audit S14-16). And (E59 C4, 13.11)
 *             the Foundry and Daggerheart rows of the two GM handbooks'
 *             "needs" tables name module.json's minimum and verified
 *             versions, after a planted table with three faults. README's
 *             rows are not held: the owner's rule, beside COMPAT_FILES.
 *   notes     .github/release-notes/v<version>.md exists and is not empty;
 *             and (E59 C5) CHANGELOG.md is what tools/changelog.mjs writes
 *             from that folder, after a planted pair of notes.
 *   dashes    the house rule (CLAUDE.md): no U+2014 or U+2013 in the language
 *             files' decoded keys and values, the handbooks, README and the
 *             release notes and every other .md under docs/ (the R-number
 *             registry, docs/dev/R-REGISTRY.md, among them); no U+2014 in
 *             CLAUDE.md, its path-scoped rules (.claude/rules/*.md, INFRA I5)
 *             or CONTRIBUTING.md outside inline code, nor in the code and
 *             workflows. U+2013 is not ruled
 *             in code: the rule names the em dash, and on 24.09.2026 scripts/,
 *             styles/ and tools/ held 18 en dashes: 15 in comments (page ranges
 *             mostly) and 3 in strings a player or GM sees.
 *   parity    lang/en.json against lang/pl.json, as the tier-1 test "the Polish
 *             file covers every English key" reads them at a table: nothing
 *             missing, no stray key (DRPG.Config.* and .few/.many aside), no
 *             placeholder dropped (`{a}` aside); and CLAUDE.md's plural rule -
 *             every English .one/.other family has its Polish .few and .many.
 *   prose     config.mjs's prose against lang/pl.json (tools/config-prose.mjs), and
 *             that tool's `--check` with no file: its usage and exit 2, red when it
 *             throws or exits otherwise (E66 C1; S13-60).
 *   names     every name scripts/ takes from `./x.mjs` - static imports,
 *             re-exports, and the dynamic forms the module uses, a namespace
 *             held in a variable (`const m = await import(...)`, then `m.a`)
 *             among them - is exported by x.mjs, following `export *`. A dynamic
 *             import with a computed path, and a namespace variable handed on
 *             whole, are counted, not checked. no-undef (npm run lint) cannot
 *             see a renamed export: the importing file still declares the name.
 *   moves     tools/moved-only.mjs's planted pairs alone (E34 C1, 07.10.2026):
 *             the checker a file split runs on its own commit (`node
 *             tools/moved-only.mjs HEAD~1`) judges a fixture with forty
 *             problems to report - a changed moved line, two lines exchanged
 *             in a moved function, a shadowing import, a write to a moved
 *             `let`, a re-export bound to another declaration, a side-effect
 *             import, a dropped re-export, an alias swapped for another of
 *             its name, a demoted name still imported, a listed shrink at
 *             other lengths, a callee R290's crawl cut moved out of its job's
 *             file and the rest, across its eight parts (E34 fix r1-G1,
 *             r2-G1) - and is red
 *             unless it reports exactly those, so it stays honest between the
 *             waves that use it
 *             (E34, E41, E54). It needs git, not a checkout: the fixture is a
 *             repository of its own in a temporary directory.
 *   contract  the test author contract, read off the text: in
 *             scripts/tests-tier*.mjs no cut bounded by a bare indexOf, no
 *             assertion true by construction, no needs() of anything but a
 *             probe (the suite's R156-R158 read the same detectors from
 *             scripts/tests-lint.mjs); in audit/harness/scenarios/*.mjs no
 *             check() that cannot fail, and no raw read or write of a GM
 *             store's key (R171's half the suite cannot read at a table; the
 *             allowance is GM_STORE_SCENARIO_ALLOW, and a stale row is red).
 *             Each detector is run on its fixture first and the part is red
 *             if it does not flag exactly the fixture's violations.
 *             audit/harness/probes/ is not read: a probe records, it does not
 *             verdict.
 *   registry  the harness's scenario numbers (audit/harness/README.md) against
 *             the files and their layers, and the suite's R numbers (the
 *             block in docs/dev/R-REGISTRY.md) against the tier files, unique -
 *             tools/registry.mjs, whose `--write` regenerates the block - and
 *             the flows of scripts/tests-flows.mjs against both.
 *   stages    tools/stages.json and every marker that names a stage
 *             (tools/stages.mjs check; with `--release`, its release rules too,
 *             which need the v* tags - a CI checkout needs fetch-depth: 0).
 *   tree      nothing git tracks under audit/harness/results (the harness
 *             writes there on every run) and no node_modules.
 *   gatecode  audit/gate and audit/live never fill a password, admin key or
 *             licence field: no password-type selector and no fill, type or
 *             press aimed at a field named like one, read a statement at a time
 *             so a locator chain and a call split over lines count. A detector
 *             fixture runs first, as in `contract`, and the part is red when the
 *             gate's writer or the live runner is not there to be read.
 *             And (E59 C0) audit/gate/ci-record.json, when it exists, holds
 *             only rows audit/gate/ci-record.mjs wrote from a run it spawned,
 *             read by that file's own rules after its planted rows refuse.
 *   live      every live check the code, the harness, the tools, the language
 *             files and the handbooks cite as LIVE-E<stage>-<n> is an item of
 *             audit/AUDIT-1.2.42.md section 9.2, written once.
 *   text      the text lint (E65): the guide (docs/text-style.md), the words
 *             (docs/glossary.json) and the lengths (docs/text-budgets.json)
 *             held against the module's texts. It reads lang/en.json and
 *             lang/pl.json (or `--lang <dir>`'s), config.mjs's English prose
 *             (walkConfigProse), the scripts git lists under scripts/ (the
 *             suite's own files out, through tests-lint.mjs's lexer) and every
 *             .md git lists under docs/, the handbooks among them; `npm ci` in
 *             audit/harness first, for espree. In this order:
 *             1. The self-check (scripts/tests-text.mjs selfCheck): each of the
 *                26 detectors on its fixture - red when one does not flag
 *                exactly its fixture's items, or reads nothing of it - and its
 *                controls, each a broken copy the self-check must see: a
 *                detector stubbed to read nothing, T8 blind to its ledger,
 *                glossarySchema and budgetsSchema answering [], the pairs'
 *                parser reading nothing, T27's gone list and counts emptied,
 *                T19 blind to the screen map's marks.
 *             2. The files E65 writes, each held to its shape, a fault red:
 *                docs/glossary.json (glossarySchema, every `stage` a row of
 *                tools/stages.json; "glossary: ..."), docs/text-budgets.json
 *                (budgetsSchema; "budgets: ..."), the screen map and
 *                the audience map built in memory (tools/text-map.mjs,
 *                tools/text-audience.mjs; "screens: ...", "audience: ...", the
 *                audience map also on planted scripts with known answers).
 *             3. Every detector over the files, one line each: its T number,
 *                its mode, what it read, what it found and its counts. The six
 *                FAIL ones - T1 (pluralForms, configPlaceholders), T2
 *                (pairParity), T3 (familyFormats) and T6 (dashesIn), the last
 *                two with a baseline that only shrinks, T14 (tableWordProblems) - are red
 *                on a finding their baseline does not hold and on a baseline row
 *                nothing fills ("take it out of the baseline"). The twenty
 *                report ones print their findings, 25 a detector, never red;
 *                each names in MODES the stage that turns it FAIL, or none. T8
 *                and T28 hold a glossary row once its stage has shipped
 *                (tools/stages.mjs isShipped against module.json) and count
 *                the rows not yet due by stage; T15 reads a render made in
 *                memory (tools/text-render.mjs renderAll), T16 the audience
 *                map, T19 the screen map's marks, T27 the guide's naturalness
 *                pairs N1-N60 (naturalnessPairs: a fault of that table is red,
 *                "pairs: ..."). A detector that read nothing is red.
 *             4. The handbook-facts tool (tools/handbook-facts.mjs): its
 *                self-check with a control that hands it a split cutting
 *                nothing, then each handbook split twice - red when one is
 *                missing, when the second split differs, or on a split problem
 *                (a section number twice, a fence that never closes; E65
 *                decision 81; a table row is its line since the fix round,
 *                trailing "|" or not, as showdown reads it); the Polish ids,
 *                kinds and lines against the English are printed, a reading.
 *             5. The pilot's file, docs/dev/text-pilot.json (tools/text-render.mjs
 *                pilotSchema; "pilot: ..."): 40 strings, each entry's fields,
 *                its key one of lang/en.json or of config.mjs's prose, its
 *                befores texts or a family's forms, its afters null or of the
 *                before's shape, none the key or "before" of a naturalness
 *                pair, and the owner's answers (each string's `owner`, each
 *                question's: `default` or `other`, the owner's note, the date),
 *                counted on one line; with a control, a copy with five faults
 *                planted. Then where the 40 stand in the files (pilotState), a
 *                reading and never red: still the before, the after landed
 *                (E66, E71), or changed since the pilot; with a control, a
 *                copy of pl.json with one after landed and one string edited.
 *             6. The batches (E66 C6, E66-26; tools/text-render.mjs BATCH_FILES,
 *                batchSchema; "batch: ..."): docs/dev/text-batch-B01a.json,
 *                each text's fields, its key in both languages and outside
 *                Appendix C's "Out", its facts each read in a function the file
 *                named spells (or a note saying why not), its afters of the
 *                before's shape with the same placeholders, no digit added and
 *                within the surface's limit, the reviewers' verdicts, the pilot's
 *                eight copies equal to the pilot's approved afters and verdicts,
 *                and an owner's verdict only on a page; counted on one line; with
 *                a control, a copy with seven faults planted. Then where its
 *                texts stand in the files (batchState), a reading, and the
 *                owner's approved afters (E66 C7, E66-28): each text whose
 *                verdict is "ok" reads its after in both languages, or the
 *                part is red - an approved text not landed, or edited since.
 *             The last line: the detectors, how many hold their fixture, what
 *             was read, "FAIL found N beyond the baselines, report found M".
 *             Options: `--lang <dir>` reads en.json and pl.json from <dir>
 *             (config.mjs stays this tree's), which is how a scratch copy with
 *             a planted fault is shown red; `--all` prints every report
 *             finding. `text` writes no file: the maps, the render, the pilot's
 *             sheet and the handbook units are written by their own tools into
 *             audit/harness/results/text/ (audit/harness/README.md, "The text
 *             tools"). Measured 01.11.2026 at E65 C-pilot (47c18e2b), 4 cores:
 *             16 s alone; 26 detectors, report found 3414.
 *   css       the CSS lint (E44 C1b; tools/css-lint.mjs, whose header says
 *             what it reads): scripts/tests-css.mjs's detectors on their own
 *             fixtures first, the budget's ratchet among them, then every sheet
 *             of module.json's `styles` counted - `!important`, colour literals
 *             outside a token, rules written twice, stray comment ends, and R2's
 *             dead classes against the scripts the suite's crawl reaches - and
 *             held to tools/css-budget.json: red above a budget, and red below
 *             it until the budget is lowered in the same commit
 *             (`node tools/css-lint.mjs --write`). Bare Node.
 *   icons     the token pictures tools/token-icons.mjs owns (13.11.2026; E59
 *             C5's item M7, the owner's default of Q-E59-8): every
 *             icons/remnant-*.svg and icons/project-*.svg equal to what the
 *             tool writes from the stylesheets' sprites today, none missing, and
 *             no project-*.svg left for a glyph config.mjs no longer has - so a
 *             sprite redrawn without the tool re-run, or a picture edited by
 *             hand, is red. Bare Node. The nine remnant-*.svg took the tool's
 *             spelling that day, after a pixel comparison in Chromium at 256,
 *             64 and 240 px read every pixel equal.
 *   comments  the comments lint (E56 C1; tools/comments-lint.mjs, whose header says
 *             what it reads, carried from the prep-54 line's 0271bfb2): its
 *             self-check on a planted fixture and the budget's ratchet first, then
 *             every module file of scripts/ counted - backticked names in comments
 *             that no code, language key or stylesheet holds, and two JSDoc blocks
 *             over one declaration - and held to tools/comment-budget.json: red
 *             above a row, and red below it until the row is lowered in the same
 *             commit (`node tools/comments-lint.mjs --write`), so the count only
 *             falls. Needs espree (`npm ci` in audit/harness).
 *   contrast  the themes' text by WCAG 2 (E44 C1c; tools/contrast.mjs, whose
 *             header says what it reads): its self-check, then every pair of
 *             tools/contrast-pairs.json in its theme from the tokens the sheets
 *             declare on :root and the theme's body class - red below AA (4.5
 *             small, 3 large) unless written `known` at that ratio, red on a
 *             `known` that no longer reads; a pair Node cannot resolve printed
 *             as not measured. Bare Node.
 *   glyphs    the pixel glyphs from one source (E48 G1; tools/glyph-map.mjs,
 *             whose header says what it holds; the arithmetic is
 *             scripts/tests-glyphs.mjs's): its self-check first - nine
 *             drifts planted in copies (a pixel of the generated set, a short
 *             row, two rows alike with no `same`, a false `same`, a sheet's
 *             custom property and a chrome rule apart from their rows, a sheet
 *             drawing with no row, pixel-icons.css edited by hand, an FA name
 *             with no glyph), red unless each is named - then tools/glyphs.json
 *             against the sprite, pixel-icons.css, the audit page's symbols,
 *             every SVG data URI of danganronpa.css and stained-glass.css and
 *             the chrome section tools/chrome-icons.mjs writes; then the map
 *             (E48 G2: ELEMENTS against config.mjs's keyed sets and
 *             gm-panel.mjs's tiles, FUTURE, SAME, OPPOSITES), its structure
 *             red, its gaps printed - R3334-R3339 hold them red until the
 *             drawing rounds close them. Bare Node.
 *   package   module.zip as release.yml builds it (`git archive HEAD`, with
 *             the working tree's .gitattributes) ships the module's top level
 *             only, and nothing a table never reads (E59 C5a): every file is
 *             named by a module script that is not a test, a stylesheet or
 *             module.json, comments blanked - a script by any script - or is a
 *             note shipped with its reason (PACKAGE_NOTES); and what a table
 *             reads ships (module.json's paths, a script's ./x.mjs imports,
 *             every module file a reader names; REVIEW-111-e59 finding 1). A
 *             planted package with eight faults first. Red on 421f2395:
 *             macros/ and icons/pixel-sprite.svg. Bare Node and git.
 *   tooltips  the controls with no help (E102 C1, widened after REVIEW-102;
 *             tools/tooltip-census.mjs, whose header lists the kinds of
 *             control it reads and the ones it does not): its self-check of
 *             planted sites, one of every kind, then each control site it
 *             reads with neither a tooltip of its own nor a hint line within
 *             three lines, held to tools/tooltip-census.json by file, unit,
 *             kind and key - red on a new one with no row, on a row no site
 *             needs any more, on a row with no reason, on a count above
 *             origin/main's copy (when that copy can be read; a "help in
 *             code" row whose held pattern is found there may stand for
 *             main's held row of its file, unit and kind), on a stage's
 *             row once the stage shipped, and on a tipAttr/tipText key with no
 *             words in either language. Needs espree (`npm ci` in audit/harness).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const lint = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-lint.mjs")).href);
const registryLib = await import(url.pathToFileURL(path.join(REPO, "tools", "registry.mjs")).href);
const stagesLib = await import(url.pathToFileURL(path.join(REPO, "tools", "stages.mjs")).href);

const argv = process.argv.slice(2);
const releaseAt = argv.indexOf("--release");
const RELEASE = releaseAt >= 0 ? argv[releaseAt + 1] ?? "" : null;
const langAt = argv.indexOf("--lang");
const LANG_DIR = langAt >= 0 ? argv[langAt + 1] ?? "" : null;
const ALL = argv.includes("--all");
/* LF line ends whatever the checkout has (lint.lf; 1.2.80 train, fix crlf-G1): every reader below matches "\n". */
const read = rel => lint.lf(fs.readFileSync(path.join(REPO, rel), "utf8"));
const exists = rel => fs.existsSync(path.join(REPO, rel));
const EM = "\u2014", EN = "\u2013";
const HANDBOOKS = ["gm-handbook", "player-handbook", "player-brochure"].flatMap(b => ["en", "pl"].map(l => `docs/handbooks/${b}.${l}.md`));

/** The files git knows here, tracked or new and not ignored; null outside a git checkout. */
function gitFiles(...paths) {
    try {
        return execFileSync("git", ["-C", REPO, "ls-files", "-co", "--exclude-standard", "--", ...paths], { encoding: "utf8" })
            .split("\n").filter(Boolean).filter(f => exists(f));
    } catch { return null; }
}

/** A language file's keys and values, flat, the way Foundry's expandObject reads dotted keys. */
function langEntries(rel) {
    const out = [];
    const walk = (o, p) => {
        for (const [k, v] of Object.entries(o ?? {})) {
            const key = p ? `${p}.${k}` : k;
            if (typeof v === "object" && v !== null) walk(v, key); else out.push([key, v]);
        }
    };
    walk(JSON.parse(lint.lf(fs.readFileSync(path.resolve(REPO, rel), "utf8"))), "");   // resolve: `--lang` may name an absolute dir
    return out;
}

/* ------------------------------ stamps, notes ------------------------------ */

function stamps() {
    const problems = [];
    const version = JSON.parse(read("module.json")).version;
    const places = [];
    const css = read("styles/danganronpa.css").match(/--drpg-css-version:\s*"([^"]*)"/)?.[1] ?? null;
    places.push(["styles/danganronpa.css --drpg-css-version", css === version, `stamps "${css}"`]);
    for (const f of HANDBOOKS) {
        const top = exists(f) ? read(f).split("\n").slice(0, 5).join("\n") : null;
        places.push([f, top !== null && top.includes(version), top === null ? "is missing" : "does not name it in its first five lines"]);
    }
    const readme = read("README.md").match(/describe version (\d+\.\d+\.\d+)\./)?.[1] ?? null;
    places.push(["README.md \"describe version X.\"", readme === version, `says ${readme ?? "no version"}`]);
    for (const [where, ok, what] of places) if (!ok) problems.push(`${where} ${what}; module.json says ${version}`);
    if (RELEASE !== null && RELEASE !== `v${version}`) problems.push(`the tag asked for is "${RELEASE}", module.json says ${version}`);
    const manifest = JSON.parse(read("module.json"));
    const compat = compatibilityProblems(manifest, Object.fromEntries(COMPAT_FILES.map(f => [f, exists(f) ? read(f) : null])));
    const plant = compatibilityProblems(manifest, { "plant.md": "| Foundry VTT | 14.1 or newer (verified on 14.2) |\n| Daggerheart (Foundryborne) | 2.6.5 or newer |\n" });
    problems.push(...compat.problems);
    if (plant.problems.length !== 3) problems.push(`the compatibility self-check's planted table gave ${JSON.stringify(plant.problems)}, not its 3 faults`);
    console.log(`stamps: module.json ${version}; ${places.filter(p => p[1]).length}/${places.length} places agree`
        + (RELEASE !== null ? `; tag ${RELEASE}` : "")
        + `; compatibility ${compat.rows} row(s) in ${COMPAT_FILES.length} file(s) against module.json, ${compat.problems.length} problem(s); `
        + `self-check ${plant.problems.length}/3 planted fault(s) seen`);
    return problems;
}

/*
 * THE VERSIONS THE MODULE NEEDS, SAID ONE WAY (E59 C4's check, 13.11.2026; M12 of the E59 plan). module.json's
 * `compatibility` (Foundry) and its Daggerheart relationship's are the truth; the GM handbook's "needs" table, in
 * English and in Polish, has a row for Foundry VTT and one for Daggerheart, whose first version is the minimum and whose
 * second the verified one ("14.364 or newer (verified on 14.365)", "14.364 lub nowsza (sprawdzone na 14.365)"). A row
 * missing, or either number not module.json's, is red. On 421f2395 the two files' four rows agreed with module.json.
 *
 * README.md IS NOT ONE OF THEM (REVIEW-111-e59 finding 2, 13.11.2026). The owner's rule is that the root README changes
 * only in its version line ("They describe version X.", which `stamps` holds above); its own Foundry and Daggerheart
 * rows (README.md:228-229 on c066123e) are the owner's to keep. Held here, a release that writes a newly verified
 * Foundry or Daggerheart into module.json could not pass `stamps` without a second README edit: with module.json's
 * verified versions planted as 14.366 and 2.12.9, README.md:228 and :229 were two of the six problems.
 */
const COMPAT_FILES = ["docs/handbooks/gm-handbook.en.md", "docs/handbooks/gm-handbook.pl.md"];

function compatibilityProblems(manifest, texts) {
    const daggerheart = (manifest.relationships?.systems ?? []).find(s => s.id === "daggerheart")?.compatibility ?? {};
    const wanted = [["Foundry VTT", /^\|\s*Foundry VTT\s*\|/, manifest.compatibility ?? {}], ["Daggerheart", /^\|\s*\[?Daggerheart\b/, daggerheart]];
    const problems = [];
    let rows = 0;
    for (const [file, text] of Object.entries(texts)) {
        if (text === null) { problems.push(`${file} is missing`); continue; }
        const lines = text.split("\n");
        for (const [name, row, compat] of wanted) {
            const at = lines.findIndex(l => row.test(l));
            if (at < 0) { problems.push(`${file} has no "${name}" row in its table of what the module needs`); continue; }
            rows += 1;
            const cell = lines[at].split("|").slice(2).join("|").replace(/\]\([^)]*\)/g, "]");
            const [minimum, verified] = [...cell.matchAll(/\b\d+\.\d+(?:\.\d+)?\b/g)].map(m => m[0]);
            if (minimum !== compat.minimum) problems.push(`${file}:${at + 1}: ${name}'s minimum reads ${minimum ?? "nothing"}; module.json says ${compat.minimum}`);
            if (verified !== compat.verified) problems.push(`${file}:${at + 1}: ${name}'s verified version reads ${verified ?? "nothing"}; module.json says ${compat.verified}`);
        }
    }
    return { problems, rows };
}

async function notes() {
    const version = RELEASE ? RELEASE.replace(/^v/, "") : JSON.parse(read("module.json")).version;
    const rel = `.github/release-notes/v${version}.md`;
    const size = exists(rel) ? read(rel).trim().length : -1;
    const problems = size > 0 ? [] : [`${rel} is ${size < 0 ? "missing" : "empty"} - the release workflow publishes it as the release's text`];
    /* CHANGELOG.md is tools/changelog.mjs's index of the notes (E59 C5): held to what it would write now, so a notes
       file added, removed or retitled without it written again is red. */
    const C = await import(url.pathToFileURL(path.join(REPO, "tools", "changelog.mjs")).href);
    const notesFiles = C.readNotes(REPO);
    const wanted = C.build(notesFiles);
    const have = exists("CHANGELOG.md") ? read("CHANGELOG.md") : null;
    const plant = C.build({ "v1.2.9.md": "# 1.2.9 - nine\n", "v1.2.10.md": "**Ten.** More.\n", "notes.md": "# not a release\n" });
    const order = /\*\*1\.2\.10\*\* - Ten\.[\s\S]*\*\*1\.2\.9\*\* - nine/.test(plant) && !/not a release/.test(plant);
    console.log(`notes: ${rel} ${size < 0 ? "missing" : `${size} characters`}; CHANGELOG.md ${have === null ? "missing" : have === wanted ? "current" : "stale"} `
        + `against ${Object.keys(notesFiles).length} notes file(s); self-check ${order ? "holds" : "fails"} (version order, the two title forms)`);
    if (have === null) problems.push("CHANGELOG.md is missing - write it with `node tools/changelog.mjs --write`");
    else if (have !== wanted) problems.push("CHANGELOG.md is not what tools/changelog.mjs writes from .github/release-notes - run `node tools/changelog.mjs --write`");
    if (!order) problems.push(`tools/changelog.mjs's planted notes did not come out newest first with both title forms: ${JSON.stringify(plant)}`);
    return problems;
}

/* --------------------------------- dashes ---------------------------------- */

/** `text` with inline code spans blanked (same length), so a rule quoted in backticks is not a use. */
const outsideCode = text => text.replace(/`[^`\n]*`/g, m => " ".repeat(m.length));

function dashes() {
    const problems = [];
    const hits = (text, chars) => text.split("\n").flatMap((line, i) => chars.some(c => line.includes(c)) ? [i + 1] : []);
    let files = 0;
    // The language files: decoded, so an escaped dash counts as one.
    const langs = fs.readdirSync(path.join(REPO, "lang")).filter(f => f.endsWith(".json")).sort();
    for (const f of langs) {
        files++;
        for (const [k, v] of langEntries(`lang/${f}`)) {
            if ([EM, EN].some(c => k.includes(c) || String(v).includes(c))) problems.push(`lang/${f}: ${k} has an en or em dash`);
        }
    }
    const prose = [...HANDBOOKS, "README.md",
        ...fs.readdirSync(path.join(REPO, ".github", "release-notes")).filter(f => f.endsWith(".md")).map(f => `.github/release-notes/${f}`),
        ...(gitFiles("docs") ?? []).filter(f => f.endsWith(".md") && !HANDBOOKS.includes(f))];
    for (const f of new Set(prose)) {
        files++;
        for (const line of hits(read(f), [EM, EN])) problems.push(`${f}:${line}: an en or em dash in prose`);
    }
    /* CLAUDE.md's sections that moved to .claude/rules (INFRA I5) keep its rule. Listed off the disk, not
       through git: a clone's .git/info/exclude may name .claude/ (this machine's did, 18.10.2026), and then
       gitFiles would not list a new rule file until it was added. */
    const rules = exists(".claude/rules")
        ? fs.readdirSync(path.join(REPO, ".claude", "rules")).filter(f => f.endsWith(".md")).sort().map(f => `.claude/rules/${f}`)
        : [];
    for (const f of ["CLAUDE.md", "CONTRIBUTING.md", ...rules]) {
        files++;
        for (const line of hits(outsideCode(read(f)), [EM])) problems.push(`${f}:${line}: an em dash outside inline code`);
    }
    /* Code. audit/handoff is not read: it is a temporary hand-over folder, deleted in
       the 1.2.61 release commit, and not code. */
    const code = gitFiles("scripts", "styles", "tools", "audit/harness", "audit/gate", "audit/live", ".github/workflows", "eslint.config.mjs");
    if (code === null) problems.push("not a git checkout: the code could not be listed");
    for (const f of (code ?? []).filter(f => /\.(mjs|js|cjs|json|css|md|yml|yaml|py|html|hbs|txt)$/.test(f))) {
        files++;
        for (const line of hits(read(f), [EM])) problems.push(`${f}:${line}: an em dash`);
    }
    console.log(`dashes: ${files} files read (${langs.length} language files decoded); ${problems.length} problem(s)`);
    return problems;
}

/* --------------------------------- parity ---------------------------------- */

function parity() {
    const problems = [];
    const en = new Map(langEntries("lang/en.json")), pl = new Map(langEntries("lang/pl.json"));
    const missing = [...en.keys()].filter(k => !pl.has(k));
    const stray = [...pl.keys()].filter(k => !k.startsWith("DRPG.Config.") && !/\.(few|many)$/.test(k) && !en.has(k));
    const holes = [];
    for (const [k, v] of en) {
        if (typeof v !== "string" || typeof pl.get(k) !== "string") continue;
        const have = new Set(pl.get(k).match(/\{\w+\}/g) ?? []);
        for (const h of (v.match(/\{\w+\}/g) ?? []).filter(h => h !== "{a}")) if (!have.has(h)) holes.push(`${k} ${h}`);
    }
    const families = [...new Set([...en.keys()].filter(k => /\.(one|other)$/.test(k)).map(k => k.replace(/\.(one|other)$/, "")))];
    const plural = families.flatMap(f => ["one", "other"].filter(x => !en.has(`${f}.${x}`)).map(x => `en ${f}.${x}`)
        .concat(["one", "few", "many", "other"].filter(x => !pl.has(`${f}.${x}`)).map(x => `pl ${f}.${x}`)));
    problems.push(...missing.map(k => `pl.json lacks ${k}`), ...stray.map(k => `pl.json has ${k}, which en.json does not`),
        ...holes.map(h => `pl.json drops the placeholder ${h}`), ...plural.map(p => `a plural family lacks ${p}`));
    console.log(`parity: en ${en.size} keys, pl ${pl.size}; missing ${missing.length}, stray ${stray.length}, `
        + `placeholders dropped ${holes.length}; ${families.length} plural families, ${plural.length} form(s) missing`);
    if (!en.size || !families.length) problems.push("read no English keys or no plural family");
    return problems;
}

/* ---------------------------------- prose ---------------------------------- */

async function prose() {
    const { proseCoverage } = await import(url.pathToFileURL(path.join(REPO, "tools", "config-prose.mjs")).href);
    const r = proseCoverage(path.join(REPO, "lang", "pl.json"));
    console.log(`prose: ${r.covered}/${r.wanted} of config.mjs's strings in lang/pl.json; missing ${r.missing.length}, extra ${r.extra.length}`);
    /* The command with no file (E66 C1, 01.11.2026; S13-60): it threw in `path.resolve(undefined)` and exited 1. */
    const bare = spawnSync(process.execPath, [path.join(REPO, "tools", "config-prose.mjs"), "--check"], { encoding: "utf8" });
    const usage = /^usage: node tools\/config-prose\.mjs/m.test(bare.stderr ?? "");
    console.log(`prose: config-prose.mjs --check with no file: exit ${bare.status}, ${usage ? "its usage" : "no usage"}${/\bat \S+:\d+:\d+/.test(bare.stderr ?? "") ? ", a stack" : ""}`);
    const noFile = bare.status === 2 && usage && !/\bat \S+:\d+:\d+/.test(bare.stderr ?? "")
        ? [] : [`config-prose.mjs --check with no file exits ${bare.status ?? bare.signal} ${usage ? "" : "without its usage "}- it should print its usage and exit 2 (S13-60)`];
    return [...noFile, ...(r.wanted ? [] : ["config.mjs yielded no prose to cover"]),
        ...r.missing.map(k => `lang/pl.json lacks DRPG.Config.${k}`), ...r.extra.map(k => `lang/pl.json has DRPG.Config.${k}, which config.mjs does not`)];
}

/* ---------------------------------- names ---------------------------------- */

/* The walk is the scratch probe of 24.09.2026 (the E30 design, 0.4) made a part:
   on 411d4da it read 2118 static and 1068 dynamic names in 108 files, found 0
   unresolved and 2 computed paths, and reported both planted faults - a static
   import of a name observe.mjs's source does not export, and a renamed
   destructure of `await import("./murder.mjs")` in gm-bridge.mjs. */
function names() {
    let espree;
    try { espree = createRequire(path.join(REPO, "audit", "harness", "package.json"))("espree"); }
    catch { return ["espree is not installed - run `npm ci` in audit/harness first"]; }
    const dir = path.join(REPO, "scripts");
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".mjs")).sort();
    const trees = new Map(), exported = new Map(), stars = new Map();
    const bindings = (p, into) => {
        if (!p) return;
        if (p.type === "Identifier") into.add(p.name);
        else if (p.type === "ObjectPattern") p.properties.forEach(q => bindings(q.value ?? q.argument, into));
        else if (p.type === "ArrayPattern") p.elements.forEach(e => bindings(e, into));
        else if (p.type === "RestElement") bindings(p.argument, into);
        else if (p.type === "AssignmentPattern") bindings(p.left, into);
    };
    const problems = [];
    for (const f of files) {
        let tree;
        try { tree = espree.parse(fs.readFileSync(path.join(dir, f), "utf8"), { ecmaVersion: "latest", sourceType: "module", loc: true }); }
        catch (err) { problems.push(`scripts/${f}: does not parse (${err.message})`); continue; }
        trees.set(f, tree);
        const own = new Set(), from = [];
        for (const n of tree.body) {
            if (n.type === "ExportNamedDeclaration") {
                if (n.declaration?.id) own.add(n.declaration.id.name);
                for (const v of n.declaration?.declarations ?? []) bindings(v.id, own);
                for (const s of n.specifiers ?? []) own.add(s.exported.name ?? s.exported.value);
            } else if (n.type === "ExportDefaultDeclaration") own.add("default");
            else if (n.type === "ExportAllDeclaration") { if (n.exported) own.add(n.exported.name); else from.push(path.basename(n.source.value)); }
        }
        exported.set(f, own); stars.set(f, from);
    }
    const all = (f, seen = new Set()) => {
        const out = new Set(exported.get(f) ?? []);
        if (seen.has(f)) return out;
        seen.add(f);
        for (const s of stars.get(f) ?? []) for (const x of all(s, seen)) if (x !== "default") out.add(x);
        return out;
    };
    const count = { static: 0, dynamic: 0, computed: 0, namespaces: 0, namespaceReads: 0, namespaceWhole: 0 };
    const visit = (node, fn, parent = null) => {
        if (!node || typeof node.type !== "string") return;
        fn(node, parent);
        for (const [k, v] of Object.entries(node)) {
            if (k === "parent") continue;
            if (Array.isArray(v)) v.forEach(c => c && typeof c.type === "string" && visit(c, fn, node));
            else if (v && typeof v.type === "string") visit(v, fn, node);
        }
    };
    const SCOPES = /^(?:Program|BlockStatement|StaticBlock|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
    const local = src => src?.type === "Literal" && String(src.value).startsWith(".");
    const want = (f, line, target, name, how) => {
        if (!exported.has(target)) { problems.push(`scripts/${f}:${line}: ${how} a file that is not in scripts/ (${target})`); return; }
        if (!all(target).has(name)) problems.push(`scripts/${f}:${line}: ${how} ${target} for ${name}, which it does not export`);
    };
    for (const [f, tree] of trees) {
        const parentOf = new Map();
        visit(tree, (node, parent) => parentOf.set(node, parent));
        for (const n of tree.body) {
            if (!((n.type === "ImportDeclaration" || n.type === "ExportNamedDeclaration") && local(n.source))) continue;
            for (const s of n.specifiers ?? []) {
                if (s.type === "ImportNamespaceSpecifier") continue;
                count.static++;
                want(f, n.loc.start.line, path.basename(n.source.value),
                    s.type === "ImportDefaultSpecifier" ? "default" : (s.imported?.name ?? s.imported?.value ?? s.local.name), "imports from");
            }
        }
        visit(tree, node => {
            if (node.type === "ImportExpression" && node.source.type !== "Literal") count.computed++;
            // const { a, b } = await import("./x.mjs")
            if (node.type === "VariableDeclarator" && node.id.type === "ObjectPattern") {
                const init = node.init?.type === "AwaitExpression" ? node.init.argument : node.init;
                if (init?.type === "ImportExpression" && local(init.source)) {
                    for (const p of node.id.properties) {
                        if (p.type !== "Property" || p.computed) continue;
                        count.dynamic++;
                        want(f, node.loc.start.line, path.basename(init.source.value), p.key.name ?? p.key.value, "destructures import() of");
                    }
                }
            }
            /* const calls = await import("./call-effects.mjs"); ... calls.shieldCalls() - the namespace held in a
               variable, every plain member read of it in the block that declares it (E30 review, 25.09.2026: 15
               such variables in the runtime scripts were read by nothing here, and a renamed shieldCalls in
               call-effects.mjs left this part green). A use that is not a plain member read - the namespace
               handed on whole, `calls[key]` - is counted, not checked. */
            if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
                const imp = node.init?.type === "AwaitExpression" ? node.init.argument : null;
                if (imp?.type === "ImportExpression" && local(imp.source)) {
                    const target = path.basename(imp.source.value), name = node.id.name;
                    let scope = parentOf.get(node);
                    while (scope && !SCOPES.test(scope.type)) scope = parentOf.get(scope);
                    count.namespaces++;
                    const seen = new Set();   // a shorthand property's key and value: two nodes, one place in the text
                    visit(scope, (m, parent) => {
                        if (m.type !== "Identifier" || m.name !== name || m === node.id || seen.has(m.start)) return;
                        seen.add(m.start);
                        if (parent?.type === "MemberExpression" && parent.property === m && !parent.computed) return;
                        if (parent?.type === "Property" && parent.key === m && !parent.computed && !parent.shorthand) return;
                        if (parent?.type === "MemberExpression" && parent.object === m && !parent.computed) {
                            count.namespaceReads++;
                            want(f, parent.loc.start.line, target, parent.property.name, `reads the namespace ${name} = import() of`);
                        } else if (parent?.type === "VariableDeclarator" && parent.init === m && parent.id.type === "ObjectPattern") {
                            // const { a, b } = calls
                            for (const p of parent.id.properties) {
                                if (p.type !== "Property" || p.computed) { count.namespaceWhole++; continue; }
                                count.namespaceReads++;
                                want(f, parent.loc.start.line, target, p.key.name ?? p.key.value, `destructures the namespace ${name} = import() of`);
                            }
                        } else count.namespaceWhole++;
                    }, parentOf.get(scope) ?? null);
                }
            }
            // (await import("./x.mjs")).a
            if (node.type === "MemberExpression" && !node.computed && node.object?.type === "AwaitExpression") {
                const imp = node.object.argument;
                if (imp?.type === "ImportExpression" && local(imp.source)) {
                    count.dynamic++;
                    want(f, node.loc.start.line, path.basename(imp.source.value), node.property.name, "reads import() of");
                }
            }
            // import("./x.mjs").then(({ a }) => ...) and .then(m => m.a)
            if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.property?.name === "then"
                && node.callee.object?.type === "ImportExpression" && local(node.callee.object.source)) {
                const target = path.basename(node.callee.object.source.value);
                const fn = node.arguments[0], param = fn?.params?.[0];
                if (param?.type === "ObjectPattern") {
                    for (const q of param.properties) {
                        if (q.type !== "Property" || q.computed) continue;
                        count.dynamic++;
                        want(f, node.loc.start.line, target, q.key.name ?? q.key.value, "destructures import().then of");
                    }
                } else if (param?.type === "Identifier") {
                    visit(fn.body, m => {
                        if (m.type === "MemberExpression" && !m.computed && m.object?.type === "Identifier" && m.object.name === param.name) {
                            count.dynamic++;
                            want(f, m.loc.start.line, target, m.property.name, "reads import().then of");
                        }
                    });
                }
            }
        });
    }
    console.log(`names: ${files.length} files, ${count.static} names imported statically, ${count.dynamic} taken from dynamic imports, `
        + `${count.namespaceReads} read through ${count.namespaces} namespace variable(s) (${count.namespaceWhole} other use(s) of one, not checked), `
        + `${count.computed} dynamic import(s) with a computed path (not checked); ${problems.length} unresolved`);
    if (!count.static) problems.push("read no import at all");
    return problems;
}

async function moves() {
    try {
        const tool = await import(url.pathToFileURL(path.join(REPO, "tools", "moved-only.mjs")).href);
        return tool.selfCheck(line => console.log(line.replace(/^self:/, "moves:")));
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") return ["espree is not installed - run `npm ci` in audit/harness first"];
        return [`the planted pairs could not be judged (${String(err.message).split("\n")[0]})`];
    }
}

function contract() {
    const problems = [];
    for (const name of ["bareCuts", "vacuousAsserts", "needsArgs", "vacuousChecks", "rawTextReads"]) {
        const fx = lint.FIXTURES[name];
        const lines = lint[name](fx.text).found.map(f => f.line).sort((a, b) => a - b);
        if (JSON.stringify(lines) !== JSON.stringify(fx.flags)) {
            problems.push(`${name} flags lines ${lines.join(",") || "none"} of its fixture, not ${fx.flags.join(",")} - the detector is broken`);
        }
    }
    const tiers = fs.readdirSync(path.join(REPO, "scripts")).filter(f => lint.TEST_FILE.test(f)).sort();
    const count = { tests: 0, cuts: 0, asserts: 0, needs: 0, checks: 0, reads: 0 };
    for (const file of tiers) {
        const text = read(`scripts/${file}`);
        count.tests += lint.testsIn(text).length;
        for (const [key, detector] of [["cuts", lint.bareCuts], ["asserts", lint.vacuousAsserts], ["needs", lint.needsArgs]]) {
            const r = detector(text);
            count[key] += r.read;
            problems.push(...r.found.map(f => `scripts/${file}:${f.line}: ${f.what}`));
        }
    }
    const scenarios = fs.readdirSync(path.join(REPO, "audit", "harness", "scenarios")).filter(f => f.endsWith(".mjs")).sort();
    for (const file of scenarios) {
        const r = lint.vacuousChecks(read(`audit/harness/scenarios/${file}`));
        count.checks += r.read;
        problems.push(...r.found.map(f => `audit/harness/scenarios/${file}:${f.line}: ${f.what}`));
    }
    /* Every served file the suite reads, read with lf (1.2.80 train, fix crlf-G1): the kit, the runner and the
       tiers - every suite file - not the tier files alone, since the kit's readers are the ones most tests use. */
    const suiteFiles = fs.readdirSync(path.join(REPO, "scripts")).filter(f => /^tests(-[\w-]+)?\.mjs$/.test(f)).sort();
    for (const file of suiteFiles) {
        const r = lint.rawTextReads(read(`scripts/${file}`));
        count.reads += r.read;
        problems.push(...r.found.map(f => `scripts/${file}:${f.line}: ${f.what}`));
    }
    if (!count.reads) problems.push("no read of a served file was seen in the suite's files - rawTextReads read nothing");
    if (!tiers.length || !count.tests) problems.push("no tier file with tests was read");
    if (!scenarios.length || !count.checks) problems.push("no scenario with checks was read");
    /* R171's half over the harness scenarios (E04, 26.09.2026): no scenario reads or
       writes a GM store's key, an old key or a player's copy raw, but through the stores.
       Here in Node because a table's Foundry does not serve audit/, so the suite cannot
       read the scenarios there; the keys are read off settings.mjs and gm-stores.mjs's
       text, and the detector is the one R171 runs, shown its fixture first. */
    const fxs = lint.FIXTURES.storeKeyAccess;
    const fxLines = lint.storeKeyAccess(fxs.text, fxs).found.map(f => f.line).sort((a, b) => a - b);
    if (JSON.stringify(fxLines) !== JSON.stringify(fxs.flags)) {
        problems.push(`storeKeyAccess flags lines ${fxLines.join(",") || "none"} of its fixture, not ${fxs.flags.join(",")} - the detector is broken`);
    }
    const watched = lint.gmStoreSettingsFromSource(read("scripts/settings.mjs"), read("scripts/gm-stores.mjs"));
    if (!watched.keys.length) problems.push("no GM store key was read off settings.mjs and gm-stores.mjs - R171's scenario half read nothing");
    const allowed = new Set();
    let storeReads = 0, rawReads = 0;
    for (const file of scenarios) {
        const r = lint.storeKeyAccess(read(`audit/harness/scenarios/${file}`), watched);
        storeReads += r.read;
        for (const f of r.found) {
            rawReads++;
            const row = `${file}#${f.name}`;
            if (lint.GM_STORE_SCENARIO_ALLOW[row]) allowed.add(row);
            else problems.push(`audit/harness/scenarios/${file}:${f.line}: ${f.what} - a GM store's key read raw (R171); read it through the stores`);
        }
    }
    for (const row of Object.keys(lint.GM_STORE_SCENARIO_ALLOW)) {
        if (!allowed.has(row)) problems.push(`GM_STORE_SCENARIO_ALLOW (scripts/tests-lint.mjs) ${row}: no such raw read is left - take the row out`);
    }
    console.log(`contract: ${tiers.length} files of tests (the tiers and the grid), ${count.tests} tests, ${count.cuts} slice/split calls, `
        + `${count.asserts} ok/equal/needs calls, ${count.needs} needs() calls, ${count.reads} served-file reads in ${suiteFiles.length} suite files; ${scenarios.length} scenarios, `
        + `${count.checks} check() calls; R171: ${watched.keys.length} GM store keys, ${storeReads} settings reads in the scenarios, `
        + `${rawReads} raw on a store key (${allowed.size} allowed rows); ${problems.length} problem(s)`);
    return problems;
}

async function registry() {
    const { problems, summary } = await registryLib.registryProblems(REPO);
    console.log(summary);
    return problems;
}

function stages() {
    const doc = stagesLib.loadStages(REPO);
    const modVersion = stagesLib.moduleVersion(REPO);
    const markers = stagesLib.stageMarkers(REPO);
    const problems = stagesLib.problems(doc, { modVersion, markers });
    if (RELEASE !== null) {
        let tags = [];
        try { tags = execFileSync("git", ["-C", REPO, "tag", "-l", "v*"], { encoding: "utf8" }).split("\n").filter(Boolean); }
        catch { /* not a git checkout: every tag reads as missing, and releaseProblems says why */ }
        problems.push(...stagesLib.releaseProblems(doc, RELEASE, { modVersion, tags }));
    }
    const shipped = doc.stages.filter(r => stagesLib.isShipped(r, modVersion));
    console.log(`stages: ${doc.stages.length} in the ledger, ${shipped.length} shipped, module.json ${modVersion}; ${markers.length} marker(s) naming a stage`);
    return problems;
}

function tree() {
    let listed;
    try { listed = execFileSync("git", ["-C", REPO, "ls-files", "--", "audit/harness/results", ":(glob)**/node_modules/**", ":(glob)**/node_modules"], { encoding: "utf8" }).split("\n").filter(Boolean); }
    catch (err) { return [`not a git checkout (${err.message.split("\n")[0]})`]; }
    console.log(`tree: ${listed.length} tracked file(s) under audit/harness/results or node_modules`);
    return listed.slice(0, 20).map(f => `${f} is tracked - it is written by a run or an install, never committed`);
}

/* ------------------------------ package ------------------------------ */

/*
 * THE PACKAGE SHIPS WHAT A TABLE READS (E59 C5a, 13.11.2026; D47, E59 plan M6). release.yml builds module.zip with
 * `git archive --format=zip -o module.zip HEAD`, which leaves out what .gitattributes marks `export-ignore`. This
 * part lists that archive the same way (`git archive --format=tar --worktree-attributes HEAD`: the committed files,
 * and the working tree's .gitattributes, so an export rule is judged before its commit) and holds it to three rules:
 *   - its top level is the module's: PACKAGE_TOP;
 *   - every file in it is read at a table: named in the code (comments blanked) of a module script that is not a
 *     test, a stylesheet or module.json - a path written out, or one built from a template (`icons/item-${kind}.svg`
 *     reads every `icons/item-*.svg`); a script may be named by any script, the suite's among them, since the suite
 *     runs at a table (`game.drpg.runTests`); and PACKAGE_NOTES ship with no reader, each with its reason.
 * A test that reads a file only where the repository's tools/ is served (R3333's `needs(env.tools())`) is not a
 * reader at a table: an installed zip has no tools/. On 421f2395 (1.2.109) the archive held 275 files and two
 * things nothing reads: macros/ (5 files; eslint.config.mjs's own note calls them Foundry macro bodies) and
 * icons/pixel-sprite.svg (named by two stylesheet comments and by the glyph tests). A pattern with no letter of
 * its own outside the extension (`${name}.svg`) names nothing: it would read every file of its kind.
 *   - and the other way (REVIEW-111-e59 finding 1, 13.11.2026): what a table reads ships - every path module.json
 *     names (esmodules, scripts, styles, languages), every `./x.mjs` a shipped script imports, and every path a
 *     shipped reader that is not a test names, where the commit holds a file of the module's (under PACKAGE_TOP) it
 *     matches: `packageMissing`. Until then the part answered no problem with lang/pl.json, scripts/ui-kit.mjs or
 *     fonts/ export-ignored, each a zip that does not load or draws without its fonts (measured on 68bc5f3e).
 */
const PACKAGE_TOP = ["module.json", "README.md", "LICENSE", "lang/", "scripts/", "styles/", "icons/", "fonts/", "docs/handbooks/"];
const PACKAGE_NOTES = {
    "module.json": "Foundry reads it to install and load the module",
    "README.md": "the module's description, shown where the package is browsed",
    "LICENSE": "the module's licence, which ships with it",
    "fonts/README.md": "the fonts' licence table and their authors, which the licences ask to ship with the fonts",
    /* E26 prep, 14.11.2026: each licence's own text, which the OFL (condition 2) and the Apache License 2.0 (4(a)) ask to
       ship with every copy of the font; a table reads none of them. */
    "fonts/OFL-PressStart2P.txt": "the SIL Open Font License 1.1 of pixel.woff2 and pixel-ext.woff2",
    "fonts/OFL-VT323.txt": "the SIL Open Font License 1.1 of the VT323 files",
    "fonts/LICENSE-SpecialElite.txt": "the Apache License 2.0 of the Special Elite files"
};
const PACKAGE_EXT = "mjs|js|css|json|svg|png|webp|jpe?g|gif|woff2?|ttf|otf|md|ogg|mp3|wav|webm";

/** The files of a tar archive (ustar and pax `path=`), directories left out, each `{ name, data }` (a Buffer). */
function tarEntries(buf) {
    const names = [];
    let off = 0, pax = null;
    while (off + 512 <= buf.length) {
        const head = buf.subarray(off, off + 512);
        if (head.every(b => b === 0)) break;
        const field = (a, b) => head.subarray(a, b).toString("utf8").replace(/\0[\s\S]*$/, "");
        const size = Number.parseInt(field(124, 136).trim() || "0", 8);
        const type = head[156] ? String.fromCharCode(head[156]) : "0";
        const body = buf.subarray(off + 512, off + 512 + size).toString("utf8");
        if (type === "x") pax = /\d+ path=([^\n]*)\n/.exec(body)?.[1] ?? null;
        else if (type === "0" || type === "7") {
            const prefix = field(345, 500);
            names.push({ name: pax ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100)), data: buf.subarray(off + 512, off + 512 + size) });
            pax = null;
        } else if (type !== "g") pax = null;
        off += 512 + Math.ceil(size / 512) * 512;
    }
    return names;
}

/** The paths a reader's code names, as patterns: `${...}` a wildcard within one path step, `./`, `../` and `modules/<id>/` off. */
function namedPaths(code) {
    const out = [];
    const text = code.replace(/\$\{[^}]*\}/g, "*");
    for (const [ref] of text.matchAll(new RegExp(String.raw`[\w*.\-/]+\.(?:${PACKAGE_EXT})\b`, "g"))) {
        const p = ref.replace(/^(?:\.{1,2}\/)+/, "").replace(/^\/?modules\/[^/]+\//, "");
        if (!/[a-z]/i.test(p.replace(new RegExp(String.raw`\.(?:${PACKAGE_EXT})$`), "").replace(/\*/g, ""))) continue;
        out.push(Object.assign(new RegExp(String.raw`(^|/)${p.replace(/[.+?^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`), { path: p }));
    }
    return out;
}

/**
 * What a table reads that the package of `files` leaves out: `tracked` is every file of the commit, `readers` the
 * shipped readers as `packageProblems` takes them. module.json's paths must ship whatever the commit holds; a script's
 * `./x.mjs` import must ship where the commit holds scripts/x.mjs (the suite's fixtures write imports of files that
 * do not exist - an import of a deleted file is R161's and lint's, not the package's); and a path another reader
 * names must ship where the commit holds a file under PACKAGE_TOP it matches - every file a template matches, since
 * the code picks one at run time (`lang/${lang}.json` reads lang/pl.json on a Polish page; module.json names English
 * alone) - and a name that matches no file of the module's is not this rule's: a URL, a world's file, a system's.
 * One line per file left out, by its first reader.
 */
function packageMissing(files, tracked, readers) {
    const shipped = new Set(files);
    const moduleFiles = tracked.filter(f => PACKAGE_TOP.some(t => (t.endsWith("/") ? f.startsWith(t) : f === t)));
    const tracked1 = new Set(tracked);
    const problems = new Map();
    const miss = (f, why) => { if (!problems.has(f)) problems.set(f, `${f} ${why} and does not ship: take its export-ignore out of .gitattributes`); };
    for (const { file, code } of readers) {
        if (file === "module.json") {
            let manifest = null;
            try { manifest = JSON.parse(code); } catch { problems.set("module.json", "module.json does not parse - its paths could not be read"); continue; }
            const named = [...["esmodules", "scripts", "styles"].flatMap(k => (manifest[k] ?? []).map(p => [k, p])),
                ...(manifest.languages ?? []).map(l => ["languages", l.path])];
            for (const [key, p] of named) {
                const rel = String(p).replace(/^\.\//, "");
                if (!shipped.has(rel)) miss(rel, `is named by module.json (${key})`);
            }
            continue;
        }
        if (file.endsWith(".mjs")) {
            for (const m of code.matchAll(/(?:\bfrom|\bimport\s*\()\s*["'`]\.\/([\w-]+\.mjs)["'`]/g)) {
                const rel = `scripts/${m[1]}`;
                if (tracked1.has(rel) && !shipped.has(rel)) miss(rel, `is imported by ${file}`);
            }
        }
        if (/^scripts\/tests[\w-]*\.mjs$/.test(file)) continue;
        for (const re of namedPaths(code)) {
            const wanted = moduleFiles.filter(f => re.test(f));
            for (const f of wanted) if (!shipped.has(f)) miss(f, `is named by ${file}${re.path.includes("*") ? ` (${re.path})` : ""}`);
        }
    }
    return [...problems.values()];
}

/** What a package of `files` ships that it should not: `readers` is `[{ file, code }]`, code with comments blanked. */
function packageProblems(files, readers) {
    const problems = [];
    const top = f => (f.includes("/") ? `${f.split("/")[0]}/` : f);
    for (const f of files) {
        if (!PACKAGE_TOP.some(t => (t.endsWith("/") ? f.startsWith(t) : f === t))) problems.push(`${f} ships, and ${top(f)} is not the module's (PACKAGE_TOP): export-ignore it in .gitattributes or remove it`);
    }
    const scriptNames = [], assetNames = [];
    for (const { file, code } of readers) {
        const named = namedPaths(code);
        scriptNames.push(...named);
        if (!/^scripts\/tests[\w-]*\.mjs$/.test(file)) assetNames.push(...named);
    }
    for (const f of files) {
        if (PACKAGE_NOTES[f] || !PACKAGE_TOP.some(t => t.endsWith("/") && f.startsWith(t))) continue;
        const names = f.endsWith(".mjs") ? scriptNames : assetNames;
        if (!names.some(re => re.test(f))) problems.push(`${f} ships, and nothing at a table reads it: export-ignore it in .gitattributes, or name its reader`);
    }
    return problems;
}

/** One reader: its code with the comments blanked, a script's by lint.blankComments, a stylesheet's block comments. */
function readerOf(file, text) {
    const code = file.endsWith(".mjs") ? lint.blankComments(text) : file.endsWith(".css") ? text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")) : text;
    return { file, code };
}

/* The readers' text is the archive's own (REVIEW-111 L3): the file list and what names a file come from one tree, so an
   uncommitted delete or edit neither stops the part nor changes its reading. */
function packageReaders(entries) {
    return entries.filter(({ name }) => /^scripts\/[\w-]+\.mjs$/.test(name) || /^styles\/[\w-]+\.css$/.test(name) || name === "module.json")
        .map(({ name, data }) => readerOf(name, lint.lf(data.toString("utf8"))));
}

function packageList() {
    const buf = execFileSync("git", ["-C", REPO, "archive", "--format=tar", "--worktree-attributes", "HEAD"], { maxBuffer: 512 * 1024 * 1024 });
    return tarEntries(buf);
}

/** Every file of the commit the archive is made from, export rules or not. */
function packageTracked() {
    return execFileSync("git", ["-C", REPO, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
}

function pkg() {
    let entries;
    let tracked;
    try { entries = packageList(); tracked = packageTracked(); }
    catch (err) { return [`not a git checkout, or git archive failed (${String(err.message).split("\n")[0]})`]; }
    const files = entries.map(e => e.name);
    /* The self-check: a planted package of seven, four of them faults - a folder that is not the module's, an icon
       named only in a script's comment, an icon named only by a test (the sprite's case: R3333 reads it, at a table it
       never does) and an icon named only in a stylesheet's comment (the sprite's other mention; REVIEW-111 M1) - and
       three that are read: an icon by a template, one by a literal path, a script by a test only. Through readerOf, the
       real readers' own blanking. */
    const plant = packageProblems(
        ["macros/x.js", "icons/item-tool.svg", "icons/unread.svg", "icons/state-dead.svg", "scripts/tests-only.mjs", "icons/test-only.svg", "icons/css-comment.svg"],
        [readerOf("scripts/config.mjs", "const a = `modules/${MODULE_ID}/icons/item-${kind}.svg`, b = \"icons/state-dead.svg\"; // icons/unread.svg\n"),
            readerOf("scripts/tests.mjs", "await import(\"./tests-only.mjs\"); fetch(\"icons/test-only.svg\");"),
            readerOf("styles/x.css", "/* icons/css-comment.svg */ a { color: red; }")]);
    /* And three a table reads and the planted package leaves out (packageMissing): a language a script's template
       reads (module.json names English alone, as the real one does), a script a shipped script imports, a font a
       stylesheet's url() names - lang/pl.json, scripts/ui-kit.mjs and fonts/ export-ignored, the three faults the part
       did not see on 68bc5f3e - beside a language, a script and a font that ship, and a path that names no file of
       the module's (`icons/svg/mystery-man.svg`, Foundry's own); and a fourth, a stylesheet module.json names
       (`styles/gone.css`), without which the self-check stayed 7/7 with module.json's road switched off. */
    const missPlant = packageMissing(
        ["module.json", "lang/en.json", "scripts/module.mjs", "styles/x.css", "fonts/kept.woff2"],
        ["module.json", "lang/en.json", "lang/pl.json", "scripts/module.mjs", "scripts/ui-kit.mjs", "styles/x.css", "styles/gone.css", "fonts/kept.woff2", "fonts/gone.woff2"],
        [readerOf("module.json", JSON.stringify({ esmodules: ["scripts/module.mjs"], styles: ["styles/x.css", "styles/gone.css"], languages: [{ path: "lang/en.json" }] })),
            readerOf("scripts/module.mjs", "import { drpgWindow } from \"./ui-kit.mjs\"; const icon = \"icons/svg/mystery-man.svg\";\n"
                + "const file = `modules/${MODULE_ID}/lang/${lang}.json`;\n"),
            readerOf("styles/x.css", "@font-face { src: url(\"../fonts/kept.woff2?v=1\"); } @font-face { src: url(../fonts/gone.woff2?v=2); }")]);
    const missPlanted = ["styles/gone.css is named by module.json", "lang/pl.json is named by scripts/module.mjs", "scripts/ui-kit.mjs is imported by", "fonts/gone.woff2 is named by styles/x.css"];
    const planted = ["macros/x.js ships", "icons/unread.svg ships", "icons/test-only.svg ships", "icons/css-comment.svg ships"];
    const seen = planted.filter(p => plant.some(q => q.startsWith(p))).length + missPlanted.filter(p => missPlant.some(q => q.startsWith(p))).length;
    const plantedCount = planted.length + missPlanted.length, plantedGave = plant.length + missPlant.length;
    const readers = packageReaders(entries);
    const problems = [...packageProblems(files, readers), ...packageMissing(files, tracked, readers)];
    /* The tests' exclusion reads something: a rename of the suite's files would leave it holding nothing. */
    if (!readers.some(r => /^scripts\/tests[\w-]*\.mjs$/.test(r.file))) problems.push("no reader matches scripts/tests*.mjs - the tests' exclusion reads nothing; rename it with the suite");
    const tops = [...new Set(files.map(f => (f.includes("/") ? `${f.split("/")[0]}/` : f)))];
    if (!files.length) problems.push("the archive listed no file - this part read nothing");
    if (seen !== plantedCount || plantedGave !== plantedCount) problems.push(`the self-check's planted package gave ${JSON.stringify([...plant, ...missPlant])}`);
    console.log(`package: git archive HEAD (the working tree's .gitattributes): ${files.length} file(s), top level ${tops.join(" ")}; `
        + `${Object.keys(PACKAGE_NOTES).length} note(s) shipped with no reader; self-check ${seen}/${plantedCount} planted fault(s) seen, `
        + `${plantedGave - seen} other(s); ${problems.length} problem(s)`);
    return problems;
}

/*
 * Aimed at a secret: a password-type selector; a fill, type or press whose own
 * arguments name a password, an admin key or a licence; or one that a locator
 * naming one leads to in the same statement - `page.locator('input[name=
 * "password"]').fill(pw)`, `page.getByLabel("Password").fill(pw)`, the form
 * Playwright's own documentation writes. Read a statement at a time, with
 * comments blanked (a sentence saying what the runner never does is not a hit):
 * a statement ends at a `;` outside brackets, or at a line end outside brackets
 * unless the next line goes on with `.` or `?.`, so `page.fill(` with its
 * selector on the next line and a locator chain written one call per line are
 * each one statement. Brackets are counted on lint.blankLiterals, so one inside
 * a selector or a regex does not count. The locator form stops at a `;`, so a
 * statement cannot lend its word to the next one.
 *
 * Until 25.09.2026 the test was one line at a time and only the first two
 * forms: the fixture below, read that way, flagged lines 1, 3 and 5 of the
 * eight it flags now - a locator chain, getByLabel, a two-line page.fill(,
 * press and a chain one call per line all went through.
 */
const SECRET_WORD = String.raw`(?:passw|admin[-_ ]?key|licen[cs]e)`;
const SECRET_ACTION = String.raw`\.(?:fill|type|press|pressSequentially|setInputFiles)\s*\(`;
const SECRET_FIELD = new RegExp(String.raw`type\s*=\s*\\?["']?password|${SECRET_ACTION}[^)]*?${SECRET_WORD}|${SECRET_WORD}[^;]*?${SECRET_ACTION}`, "i");
const GATECODE_FIXTURE = {
    text: [
        'await page.fill("input[name=password]", pw);',
        "// the runner never types a password",
        "await page.locator('input[type=\"password\"]').count();",
        'await page.fill("#world-search", id);',
        "await page.locator('#key').type(LICENSE);",
        'const why = "password-required";',
        "await page.locator('input[name=\"password\"]').fill(pw);",
        'await page.getByLabel("Password").fill(pw);',
        "await page.fill(",
        '    "input[name=password]", pw);',
        "await page.press('input[name=\"password\"]', \"Enter\");",
        'const hint = "admin key"; await page.fill("#world-search", hint);',
        'await page.getByPlaceholder("Admin Key")',
        "    .fill(key);",
        'await page.getByRole("button", { name: "Join" })',
        "    .click();"
    ].join("\n"),
    flags: [1, 3, 5, 7, 8, 9, 11, 13]
};

/** The statements of `text` with comments blanked, as SECRET_FIELD reads them: `[{ line, text }]`, a statement's lines joined by spaces. */
function statementsOf(text) {
    const code = lint.blankComments(text), blank = lint.blankLiterals(code);
    const out = [];
    let depth = 0, start = 0;
    const flush = end => {
        const piece = code.slice(start, end);
        if (piece.trim()) out.push({ line: lint.lineAt(code, start + piece.search(/\S/)), text: piece.replace(/\s*\n\s*/g, " ") });
        start = end;
    };
    for (let i = 0; i < blank.length; i++) {
        const c = blank[i];
        if (c === "(" || c === "[") depth++;
        else if ((c === ")" || c === "]") && depth > 0) depth--;
        else if (depth === 0 && (c === ";" || (c === "\n" && !/^\s*\??\./.test(blank.slice(i + 1, i + 200))))) flush(i + 1);
    }
    flush(code.length);
    return out;
}

async function gatecode() {
    const problems = [];
    const hitsIn = text => statementsOf(text).filter(s => SECRET_FIELD.test(s.text)).map(s => s.line);
    const fx = hitsIn(GATECODE_FIXTURE.text);
    if (JSON.stringify(fx) !== JSON.stringify(GATECODE_FIXTURE.flags)) {
        problems.push(`the detector flags lines ${fx.join(",") || "none"} of its fixture, not ${GATECODE_FIXTURE.flags.join(",")} - it is broken`);
    }
    const files = (gitFiles("audit/gate", "audit/live") ?? []).filter(f => /\.(mjs|js)$/.test(f));
    /* The writer and the live runner are what it exists to read: without them it read nothing. */
    for (const need of ["audit/gate/local-gate.mjs", "audit/live/foundry.mjs"]) if (!files.includes(need)) problems.push(`${need} is missing - nothing that logs into Foundry was read`);
    for (const f of files) for (const line of hitsIn(read(f))) problems.push(`${f}:${line}: aims at a password, admin key or licence field`);
    /* THE CI RECORD (E59 C0, 13.11.2026): audit/gate/ci-record.json is written only by audit/gate/ci-record.mjs from a
       run it spawned; this reads it with the writer's own rules (`recordProblems`), after planted rows each must refuse.
       The file may be absent: no run recorded yet. */
    let rec = { rows: 0, planted: "not read" };
    if (!exists("audit/gate/ci-record.mjs")) problems.push("audit/gate/ci-record.mjs is missing - nothing writes or reads the ci record");
    else {
        const R = await import(url.pathToFileURL(path.join(REPO, "audit", "gate", "ci-record.mjs")).href);
        const self = R.selfCheck();
        rec.planted = `${self.refused}/${self.planted} planted row(s) refused, the control ${self.controlOk ? "accepted" : "refused"}`;
        if (self.refused !== self.planted || !self.controlOk) problems.push(`the ci record's self-check: ${rec.planted} (${self.missed.join("; ")})`);
        if (exists(R.RECORD_FILE)) {
            let record = null;
            try { record = JSON.parse(read(R.RECORD_FILE)); } catch (err) { problems.push(`${R.RECORD_FILE} is not JSON (${err.message})`); }
            if (record) {
                rec.rows = (record.rows ?? []).length;
                problems.push(...R.recordProblems(record).map(p => `${R.RECORD_FILE}: ${p}`));
                /* REVIEW-111 L2: a row's commit is one this repository has, and an ancestor of HEAD - not a made-up id
                   with its digest recomputed. A shallow clone cannot tell, and says so instead of guessing. */
                let shallow = false;
                try { shallow = execFileSync("git", ["-C", REPO, "rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "true"; } catch { shallow = true; }
                const commits = [...new Set((record.rows ?? []).map(r => r?.commit).filter(c => /^[0-9a-f]{40}$/.test(String(c))))];
                if (shallow) rec.commits = `${commits.length} commit(s) not checked (a shallow clone)`;
                else {
                    for (const c of commits) {
                        const ok = spawnSync("git", ["-C", REPO, "merge-base", "--is-ancestor", c, "HEAD"]).status === 0;
                        if (!ok) problems.push(`${R.RECORD_FILE}: commit ${c} is not in this repository's history up to HEAD`);
                    }
                    rec.commits = `${commits.length} commit(s) checked against HEAD's history`;
                }
            }
        }
    }
    console.log(`gatecode: ${files.length} file(s) in audit/gate and audit/live; ci record ${rec.rows} row(s)${rec.commits ? ` (${rec.commits})` : ""}, ${rec.planted}; ${problems.length} problem(s)`);
    return problems;
}

/* ---------------------------------- live ---------------------------------- */

/* A CITED LIVE CHECK IS A WRITTEN ONE (E77 C9, 13.10.2026). A comment that says "what a real Foundry does
   is LIVE-E77-11" hands a question to the table, and the table reads AUDIT 9.2, not the comment. Through E77
   C8 four of the stage's ids (03, 09, 10, 11) were cited in scripts/, styles/ and the harness and written
   nowhere (git grep over C8's tree, 13.10.2026: every other id of the E<stage> form cited outside AUDIT was
   an item); C9 wrote items 205-217, and this part then read 193 items and 335 citations in 247 files, all
   written. LIVE-REOPEN-01, a reading of 20.09 older than the numbered list, is not of that form and not
   asked here. audit/AUDIT-1.2.42.md does not
   ship (.gitattributes), so this is the repository's check and not the suite's. The table smoke's stages (H81,
   20.10.2026) write theirs as LIVE-H<stage>-<n>, read here as the E ids are. */
function live() {
    const problems = [];
    const audit = exists("audit/AUDIT-1.2.42.md") ? read("audit/AUDIT-1.2.42.md") : "";
    const from = audit.search(/^### 9\.2 /m);
    if (from < 0) return ["audit/AUDIT-1.2.42.md has no section 9.2 - nothing was read"];
    const rest = audit.slice(audit.indexOf("\n", from) + 1), next = rest.search(/^#{2,3} /m);
    const items = new Map();
    for (const m of (next < 0 ? rest : rest.slice(0, next)).matchAll(/^(\d+)\. \*\*(LIVE-[EH]\d+-\d+) - /gm)) {
        if (items.has(m[2])) problems.push(`AUDIT 9.2 writes ${m[2]} twice: items ${items.get(m[2])} and ${m[1]}`);
        items.set(m[2], m[1]);
    }
    const files = (gitFiles("scripts", "styles", "tools", "lang", "docs/handbooks", "audit/harness", "audit/gate", "audit/live", "audit/glass-harness.html", "audit/glass-sweep.mjs", "audit/pack-harness.html") ?? [])
        .filter(f => /\.(mjs|js|css|html|md|json)$/.test(f));
    let cites = 0;
    for (const f of files) {
        read(f).split("\n").forEach((line, i) => {
            for (const [id] of line.matchAll(/\bLIVE-[EH]\d+-\d+\b/g)) {
                cites++;
                if (!items.has(id)) problems.push(`${f}:${i + 1}: ${id} is cited, and AUDIT 9.2 has no item of it`);
            }
        });
    }
    if (!items.size || !cites) problems.push(`read ${items.size} item(s) and ${cites} citation(s) - nothing was compared`);
    console.log(`live: ${items.size} item(s) in AUDIT 9.2, ${cites} citation(s) in ${files.length} file(s); ${problems.length} problem(s)`);
    return problems;
}

/* ---------------------------------- text ---------------------------------- */

/* THE TEXT LINT (E65 C1, 31.10.2026). The detectors are scripts/tests-text.mjs's, which imports
   nothing, so this part and the suite's R1058 and R1059 run the same functions; this is the half that
   reads config.mjs's English prose, which a table cannot (at i18nInit a Polish client has already put
   the Polish into config's tables), and the half CI runs. Every detector is shown its fixture first. */
async function text() {
    const T = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-text.mjs")).href);
    const config = await import(url.pathToFileURL(path.join(REPO, "scripts", "config.mjs")).href);
    const { walkConfigProse } = await import(url.pathToFileURL(path.join(REPO, "scripts", "i18n-config.mjs")).href);
    const dir = LANG_DIR === null ? path.join(REPO, "lang") : path.resolve(LANG_DIR);
    const where = path.relative(REPO, dir) || ".";
    /* The lexer the detectors that read code are handed: tests-lint.mjs's, which tests-text.mjs cannot import (E65 C2). */
    const lexer = { blankComments: lint.blankComments, blankLiterals: lint.blankLiterals, callArgs: lint.callArgs };
    const fixtures = T.selfCheck(T.DETECTORS, { lexer });
    const problems = [...fixtures];
    /* The self-check's own control (R1058 asks the same): a detector stubbed to flag nothing and read nothing,
       the shape of each before it was written, is seen. A self-check that answered [] whatever ran would leave
       this part green over a broken detector. */
    const first = Object.keys(T.MODES)[0];
    if (T.selfCheck({ ...T.DETECTORS, [first]: () => ({ found: [], read: 0 }) }, { lexer }).filter(p => p.startsWith(`${first} `)).length !== 2) {
        problems.push(`the self-check does not see ${first} stubbed to flag nothing and read nothing - it would pass a broken detector`);
    }
    /* And its second ledger (E65 C4): T8 run as if only the first ledger's stages had shipped, whatever it is handed, is
       seen on the fixture's case 2 - a self-check that ran only the first case would pass a detector blind to the ledger. */
    const blind = bag => T.DETECTORS.glossaryHits({ ...bag, shipped: T.FIXTURES.glossaryHits.input.shipped });
    if (!T.selfCheck({ ...T.DETECTORS, glossaryHits: blind }, { lexer }).some(p => p.startsWith("glossaryHits flags ") && p.includes("case 2"))) {
        problems.push("the self-check does not see glossaryHits blind to the ledger it is handed - it would pass a broken stage rule");
    }
    /* And the two schemas' own cases (E65 C6; C5's Open 34): each stubbed to answer [] is one mismatch of the self-check. Its
       line for either removed, a schema broken to pass everything would leave this part green on a valid file (C5's
       mutant M13 lived so). */
    for (const schema of ["glossarySchema", "budgetsSchema"]) {
        if (!T.selfCheck(T.DETECTORS, { lexer }, { [schema]: () => [] }).some(p => p.startsWith(`${schema} answers [] `))) {
            problems.push(`the self-check does not see ${schema} stubbed to answer [] - a broken schema would pass its file`);
        }
    }
    /* And the parser of the guide's naturalness pairs (E65 C9): stubbed to read no pair and no fault, one mismatch. */
    if (!T.selfCheck(T.DETECTORS, { lexer }, { naturalnessPairs: () => ({ pairs: [], faults: [] }) }).some(p => p.startsWith("naturalnessPairs reads "))) {
        problems.push("the self-check does not see naturalnessPairs stubbed to read nothing - a broken pairs table would pass");
    }
    /* And what T27 lists apart and counts (E65 C9): the detector with its gone list and counts emptied is seen on both, so a
       self-check that stopped reading either would leave this part green over a T27 that misreads a changed string. */
    const goneBlind = bag => ({ ...T.DETECTORS.naturalnessBefore(bag), gone: [], counts: {} });
    const blindSeen = T.selfCheck({ ...T.DETECTORS, naturalnessBefore: goneBlind }, { lexer });
    if (!blindSeen.some(p => p.startsWith("naturalnessBefore lists nothing ")) || !blindSeen.some(p => p.startsWith("naturalnessBefore counts "))) {
        problems.push("the self-check does not see naturalnessBefore with its gone pairs and counts emptied - it would pass a T27 that misreads a changed string");
    }
    /* And T19's second case (E65 C10): T19 blind to the screen map's marks it is handed is seen on that case, by its flags and its
       counts, so a self-check that stopped running a fixture's `also` cases, or their counts, would leave this part green. */
    const unmarked = bag => T.DETECTORS.contractions({ ...bag, marks: undefined });
    const marksSeen = T.selfCheck({ ...T.DETECTORS, contractions: unmarked }, { lexer }).filter(p => p.startsWith("contractions ") && p.includes("case 2"));
    if (!marksSeen.some(p => p.startsWith("contractions flags ")) || !marksSeen.some(p => p.startsWith("contractions counts "))) {
        problems.push("the self-check does not see contractions blind to the screen map's marks - it would pass a T19 that ignores them");
    }
    const fileOf = name => path.join(dir, name);
    for (const name of ["en.json", "pl.json"]) if (!fs.existsSync(fileOf(name))) problems.push(`${path.join(where, name)} is missing - nothing was read`);
    if (problems.some(p => p.endsWith("nothing was read"))) return problems;
    const en = new Map(langEntries(fileOf("en.json"))), pl = new Map(langEntries(fileOf("pl.json")));
    const prose = new Map();
    walkConfigProse(config, (key, value) => prose.set(key, value));
    /* The scripts the module serves, as git lists them (the suite's own files out: tests.mjs and tests-*.mjs quote
       what they hunt for, and R1's otherSources leaves them out too), and every .md under docs/ (E65 C2). */
    const listed = gitFiles("scripts"), docList = gitFiles("docs");
    if (listed === null || docList === null) { problems.push("not a git checkout: the scripts and docs could not be listed - nothing was read"); return problems; }
    const scripts = new Map(listed.filter(f => f.endsWith(".mjs") && !/^tests(-[\w-]+)?\.mjs$/.test(path.basename(f))).map(f => [f, read(f)]));
    const docs = new Map(docList.filter(f => f.endsWith(".md")).map(f => [f, read(f)]));
    /* T14's bag (E65 C3): the words a table's name is built from, as config.mjs freezes them, and the legacy lists, in
       tables-pools.mjs since E41 C8 (tables.mjs's until then). */
    /* T8's and T28's (E65 C4): docs/glossary.json, held to its shape first (a fault in it is red: a file E65 owns, not text
       debt), and the stages that have shipped by tools/stages.mjs's rule - an entry holds only from its stage. */
    const ledger = stagesLib.loadStages(REPO), modVersion = stagesLib.moduleVersion(REPO);
    const shipped = ledger.stages.filter(r => stagesLib.isShipped(r, modVersion)).map(r => r.id);
    let glossary = null;
    if (!exists("docs/glossary.json")) problems.push("glossary: docs/glossary.json is missing - T8 and T28 have nothing to read");
    else {
        try { glossary = JSON.parse(read("docs/glossary.json")); } catch (err) { problems.push(`glossary: docs/glossary.json does not parse (${err.message})`); }
        if (glossary) problems.push(...T.glossarySchema(glossary, ledger.stages.map(r => r.id)).map(p => `glossary: ${p}`));
    }
    /* The budgets (E65 C5): docs/text-budgets.json held to its shape the same way (budgetsSchema: every `until` and `fail` a
       ledger row; a fault is red), and one line of what it holds. T4, T5 and T21 (E65 C6) read it as `budgets`. */
    let budgets = null;
    if (!exists("docs/text-budgets.json")) problems.push("budgets: docs/text-budgets.json is missing - the surfaces' budgets have nothing to read");
    else {
        try { budgets = JSON.parse(read("docs/text-budgets.json")); } catch (err) { problems.push(`budgets: docs/text-budgets.json does not parse (${err.message})`); }
        if (budgets) {
            const faults = T.budgetsSchema(budgets, ledger.stages.map(r => r.id));
            problems.push(...faults.map(p => `budgets: ${p}`));
            const surfaces = Object.values(budgets.surfaces ?? {}), rules = Array.isArray(budgets.rules) ? budgets.rules : [];
            console.log(`text: budgets: ${surfaces.length} surface(s), ${surfaces.filter(s => s?.limit !== null).length} with a limit; `
                + `${rules.length} rule(s), ${rules.filter(r => r && Object.hasOwn(r, "keys")).length} by key and ${rules.filter(r => r && Object.hasOwn(r, "sender")).length} by sender; `
                + `${Array.isArray(budgets.allow) ? budgets.allow.length : 0} allow row(s); ${faults.length} schema fault(s)`);
        }
    }
    const inputs = { en, pl, prose, scripts, docs, lexer, words: config.TABLE_NAME_WORDS, ...T.legacyListsFrom(read("scripts/tables-pools.mjs")), glossary, shipped, budgets };
    /* The screen map and the render (E65 C10): tools/text-map.mjs reads the scripts with espree (a SCREENS row that names
       no unit is red: the hand table is a file E65 writes), tools/text-render.mjs fills every string with its fixtures in
       memory; T15 reads the render, T19 the map's marks (decision 52). The files themselves only by the two tools. */
    const textMap = await import(url.pathToFileURL(path.join(REPO, "tools", "text-map.mjs")).href);
    const textRender = await import(url.pathToFileURL(path.join(REPO, "tools", "text-render.mjs")).href);
    const espree = textMap.loadEspree(REPO);
    let screenMap = null;
    if (!espree) problems.push("screens: espree is not installed - run `npm ci` in audit/harness first (the screen map reads the scripts with it)");
    else {
        const configTables = [...new Set([...prose.keys()].map(k => k.split(".")[2]))];
        screenMap = textMap.buildScreenMap({ scripts, keys: [...en.keys(), ...pl.keys(), ...prose.keys()], espree, configTables });
        problems.push(...screenMap.problems.map(p => `screens: ${p}`));
        inputs.marks = textMap.marksOf(screenMap);
    }
    /* The audience map (E65 C11): who reads each key a send reaches, read with the same parse; T16 reads it. */
    let audienceMap = null;
    if (espree) {
        const textAudience = await import(url.pathToFileURL(path.join(REPO, "tools", "text-audience.mjs")).href);
        audienceMap = textAudience.buildAudienceMap({ scripts, keys: [...en.keys(), ...pl.keys(), ...prose.keys()], espree });
        problems.push(...audienceMap.problems.map(p => `audience: ${p}`));
        inputs.audience = audienceMap.keys;
        /* And the map on planted scripts (E65 C11): each sender, a toast, a wrapper and the notice history once, with the readers
           each must give; a send that spells its own key and fills a parameter in (`fill`: no wrapper), an `announce` of a file
           that is no sender's, a two-segment template (`DRPG.Plant.${choice}`: no key), and one notice-history file left out,
           which is the one problem. T16's fixture hands it a map; this is what holds the map itself, so a sender, a reader or
           the wrapper rounds read wrong turn the part red here rather than as a quieter count. */
        const plant = textAudience.buildAudienceMap({ espree, keys: ["room", "incident", "all", "gms", "owner", "toast", "wrapped", "own", "unsent", "filled", "arg", "notSent"].map(k => `DRPG.Plant.${k}`), scripts: new Map([
            ["scripts/utils.mjs", "export function announce(data) { return data; }\nexport function whisperToGms(content, extra) { return content; }\n"
                + "export function whisperToOwner(actor, content, extra) { return content; }\nexport function roomAudience(room) { return [room]; }\n"
                + "export function incidentAudienceIds(state) { return state.ids; }\n"],
            ["scripts/plant.mjs", "import { announce, whisperToGms, whisperToOwner, roomAudience, incidentAudienceIds } from \"./utils.mjs\";\n"
                + "import { announce as say } from \"./other.mjs\";\n"
                + "function tell(text) { return announce({ content: text }); }\nexport function plant(actor, room, state) {\n"
                + "  announce({ content: game.i18n.localize(\"DRPG.Plant.room\"), whisper: roomAudience(room) });\n"
                + "  const ids = incidentAudienceIds(state);\n  announce({ content: game.i18n.localize(\"DRPG.Plant.incident\"), whisper: ids });\n"
                + "  announce({ content: game.i18n.localize(\"DRPG.Plant.all\") });\n  whisperToGms(game.i18n.localize(\"DRPG.Plant.gms\"));\n"
                + "  whisperToOwner(actor, game.i18n.localize(\"DRPG.Plant.owner\"));\n  ui.notifications.warn(game.i18n.localize(\"DRPG.Plant.toast\"));\n"
                + "  tell(game.i18n.localize(\"DRPG.Plant.wrapped\"));\n  fill(game.i18n.localize(\"DRPG.Plant.arg\"));\n"
                + "  say({ content: game.i18n.localize(\"DRPG.Plant.notSent\") });\n}\n"
                + "function fill(n) { return announce({ content: game.i18n.format(\"DRPG.Plant.filled\", { n }) }); }\n"
                + "function pick(choice) { ui.notifications.info(game.i18n.localize(`DRPG.Plant.${choice}`)); }\n"],
            ["scripts/other.mjs", "export function announce(x) { return x; }\n"],
            ["scripts/notice-history.mjs", "export function show() { return game.i18n.localize(\"DRPG.Plant.own\"); }\n"]
        ]) });
        const planted = JSON.stringify(Object.fromEntries([...plant.keys].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, sends]) => [k.slice(11), sends.map(x => `${x.sender.replace(/ \(.*$/, "").replace(/^scripts\/plant\.mjs:/, "")}:${[...x.readers].sort().join("+")}`).join(",")])));
        const want = JSON.stringify({ all: "announce:everyone", filled: "announce:everyone", gms: "whisperToGms:gms", incident: "announce:incident", own: "the notice history:own", owner: "whisperToOwner:owner",
            room: "announce:room", toast: "ui.notifications:browser", wrapped: "tell:everyone" });
        const wantProblems = ["scripts/notice-history-app.mjs is not among the scripts read - the notice history's entry has no keys"];
        if (JSON.stringify(plant.problems) !== JSON.stringify(wantProblems) || planted !== want) {
            problems.push(`audience: the planted senders read ${planted} with the problems ${JSON.stringify(plant.problems)}, not ${want} with ${JSON.stringify(wantProblems)}`);
        }
    }
    inputs.render = textRender.renderAll({ en, pl, prose });
    /* Each key's surface, as T4 reads it (the budgets' rules, the senders read off the scripts): C6's report counts every
       finding by it and by the key's top-level group. A handbook line is "handbook". */
    const surfaces = T.surfacesOf(inputs);
    const tally = (list, of) => Object.entries(list.reduce((acc, f) => ({ ...acc, [of(f)]: (acc[of(f)] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
    const shownTally = (pairs, most) => pairs.slice(0, most).map(([k, n]) => `${k} ${n}`).join(", ") + (pairs.length > most ? `, ${pairs.length - most} more (${pairs.slice(most).reduce((n, [, c]) => n + c, 0)})` : "");
    if (screenMap) {
        const c = screenMap.counts, marks = [...inputs.marks.values()];
        console.log(`text: screens: ${c.screens} screen(s), ${c.hand} by SCREENS; ${c.entries} entry point(s) in ${c.files} script(s); keys ${c.keys}: ${c.assigned} assigned `
            + `(${c.byPrefixOnly} by prefix or table only), ${c.unassigned} unassigned; marks: rule ${marks.filter(x => x === "rule").length}, safety ${marks.filter(x => x === "safety").length}`);
        const split = textMap.readerSplit(screenMap, key => surfaces.surfaceOf(key), ["button", "window-title", "tab", "tooltip"]);
        console.log(`text: screens: the window surfaces by reader (decision 38; gm/player/unknown/unassigned): `
            + Object.entries(split).map(([id, r]) => `${id} ${r.gm}/${r.player}/${r.unknown}/${r.unassigned}`).join(", "));
    }
    if (audienceMap) {
        const c = audienceMap.counts;
        console.log(`text: audience: ${c.sends} send(s), ${c.keyed} with a key, ${c.wrappers} wrapper(s); keys ${c.keys}: ${c.assigned} assigned, ${c.unassigned} unassigned; `
            + `more than one reader ${c.many}, a list not read ${c.maybe}; by sender (sends/keys): `
            + Object.entries(c.bySender).sort((a, b) => b[1].keys - a[1].keys).map(([sn, v]) => `${sn} ${v.sends}/${v.keys}`).join(", "));
        console.log(`text: audience: keys by reader: ${Object.entries(c.byReader).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", ")}; `
            + `the notice history ${audienceMap.noticeHistory.keys} key(s), "${audienceMap.noticeHistory.readers}"`);
    }
    let fails = 0, reports = 0;
    for (const [name, m] of Object.entries(T.MODES)) {
        const r = T.DETECTORS[name](inputs);
        const rows = T.BASELINES[name];
        const b = rows ? T.againstBaseline(r, rows) : null;
        const counts = Object.entries(r.counts ?? {}).map(([k, n]) => `${k} ${n}`).join(", ");
        console.log(`text: ${m.test} ${m.mode} ${name} read ${r.read} found ${r.found.length}`
            + (b ? `; baseline ${rows.length} row(s), ${b.rows} site(s): ${b.matched} matched, ${b.left.length} new, ${b.stale.length} gone` : "")
            + (counts ? ` (${counts})` : ""));
        /* How much of what T4 and T19 read a surface rule placed (E65 fix round, 01.11.2026; correctness review m3): T4
           counts in `read` only the strings with a surface and the rest as `unclassified`, T19 reads every English string
           and files the unplaced under "unclassified". A reading: nothing floors it, and the stage that turns T4 to FAIL
           (E71, MODES) decides whether its FAIL needs one (E65 STATUS, the fix round's Open). */
        const placed = name === "lengthOver" ? [r.read, r.read + (r.counts?.unclassified ?? 0)]
            : name === "contractions" ? [r.read - (r.perSurface?.unclassified?.strings ?? 0), r.read] : null;
        if (placed) console.log(`text:   ${m.test} classified ${placed[0]} of ${placed[1]} string(s) it read (${placed[1] ? Math.round(1000 * placed[0] / placed[1]) / 10 : 0}%); `
            + `the rest have no surface - a reading, no floor (FAIL from ${m.fail ?? "no stage"})`);
        /* A detector that reads a file E65 writes carries that file's faults (T27: the guide's pairs table, E65 C9): red. */
        if (Array.isArray(r.faults)) problems.push(...r.faults.map(f => `pairs: docs/text-style.md: ${f}`));
        if (!(r.read > 0)) problems.push(`${name} read nothing of ${m.reads.join(" and ")}${LANG_DIR === null ? "" : ` (the language files of ${where})`} - it has proved nothing`);
        const live = b ? b.left : r.found;
        if (m.mode === "fail") {
            fails += live.length;
            problems.push(...live.map(f => `${m.test} (${name}): ${f.what}`), ...(b?.stale ?? []).map(s => `${m.test} (${name}): ${T.staleRow(name, s)}`));
        } else {
            reports += live.length;
            for (const f of ALL ? live : live.slice(0, 25)) console.log(`text:   ${m.test} report: ${f.what}`);
            if (!ALL && live.length > 25) console.log(`text:   ${m.test} report: ${live.length - 25} more not printed (node tools/check.mjs text --all)`);
        }
        /* C6's report detectors (their findings carry `lang`): by surface and by top-level key group, then each one's own. */
        if (live.length && live.every(f => f.lang)) {
            const handbook = f => /^docs\//.test(String(f.key));
            console.log(`text:   ${m.test} by surface: ${shownTally(tally(live, f => (handbook(f) ? "handbook" : surfaces.surfaceOf(f.key) ?? "unclassified")), 14)}`);
            console.log(`text:   ${m.test} by group: ${shownTally(tally(live, f => (handbook(f) ? String(f.key).split(":")[0] : T.groupOf(f.key))), 10)}`);
        }
        /* What a detector lists apart (T27's pairs whose before is gone, E65 C9): every one, they are the table's models. */
        if (Array.isArray(r.gone)) {
            console.log(`text:   ${m.test} gone: ${r.gone.length}`);
            for (const g of r.gone) console.log(`text:   ${m.test} gone: ${g.what}`);
        }
        /* T15's placeholders with no fixture (E65 C10), each with where it stands. */
        if (Array.isArray(r.unknown)) console.log(`text:   ${m.test} unknown placeholders: ${r.unknown.length ? r.unknown.map(u => `${u.name} (${u.where.length})`).join(", ") : "none"}`);
        /* C8's detectors, which read code (T13, T20): their findings carry `file` and no `lang`, counted by file. */
        if (live.length && live.every(f => f.file && !f.lang)) console.log(`text:   ${m.test} by file: ${shownTally(tally(live, f => f.file), 14)}`);
        if (r.bySurface) {
            console.log(`text:   ${m.test} strings by surface (over the target / over the limit / allowed): `
                + Object.entries(r.bySurface).map(([id, c]) => `${id} ${c.strings} (${c.target}/${c.limit}/${c.allowed})`).join(", ")
                + `; unclassified ${r.counts.unclassified}; over a limit that is red from a stage: ${r.found.filter(f => f.fail).length} (${shownTally(tally(r.found.filter(f => f.fail), f => f.fail), 4) || "none"})`
                + (r.counts.calls !== undefined ? `; senders read: ${r.counts.calls} call(s), ${r.counts.keyed} with a key, ${r.counts.private} private, ${r.counts.unresolved} key(s) built by a template` : ""));
        }
        if (r.byRule) {
            console.log(`text:   ${m.test} by rule (en/pl): ` + Object.entries(r.byRule).map(([id, c]) => (c.by ? `${id} read by ${c.by}` : `${id} ${c.en}/${c.pl}`)).join(", "));
        }
        if (r.byCount) console.log(`text:   ${m.test} strings by colons: ${Object.entries(r.byCount).map(([n, c]) => `${n}: ${c}`).join(", ")}`);
        /* C7's shares (T19, T22): each surface's strings or pairs, then what the detector counts in them. */
        if (r.perSurface) {
            console.log(`text:   ${m.test} per surface: ` + Object.entries(r.perSurface).sort((a, b) => (b[1].strings ?? b[1].pairs) - (a[1].strings ?? a[1].pairs))
                .map(([id, c]) => { const { strings, pairs, ...rest } = c; return `${id} ${strings ?? pairs} (${Object.entries(rest).map(([k, n]) => `${k} ${n}`).join(", ")})`; }).join(", "));
        }
        /* A detector that splits by stage (T8, T28): its debt above, then each entry of a shipped stage that looked and found
           nothing (one that forbids nothing is counted apart: it measured nothing), and what the entries not yet due find, by
           stage - the report each entry's stage starts from (E65-11). */
        if (Array.isArray(r.entries)) {
            const held = r.entries.filter(e => e.due && e.checked && !e.hits), unread = r.entries.filter(e => e.due && !e.checked), notDue = r.entries.filter(e => !e.due && e.hits);
            const debt = r.entries.filter(e => e.due && e.hits).map(e => `${e.id} (${e.stage}) ${e.hits}`);
            const byStage = {};
            for (const e of notDue) byStage[e.stage] = (byStage[e.stage] ?? 0) + e.hits;
            console.log(`text:   ${m.test} debt: ${debt.length ? debt.join(", ") : "none"}; held, of a shipped stage: ${held.length} (${held.map(e => e.id).join(", ")}); `
                + `of a shipped stage with nothing to look for: ${unread.length}`);
            console.log(`text:   ${m.test} not yet due: ${r.pending.length} finding(s) in ${notDue.length} entr${notDue.length === 1 ? "y" : "ies"}`
                + (notDue.length ? ` - ${Object.entries(byStage).map(([st, n]) => `${st} ${n}`).join(", ")}: ${notDue.map(e => `${e.id} ${e.hits}`).join(", ")}` : ""));
        }
    }
    /* The handbook-facts tool (E65 C12, E65-21): its self-check (the fixture handbook's units, the same on a second split, and
       `check` naming its planted faults exactly) red here, with its control - the self-check handed a split that cuts nothing
       must see it; then every handbook split twice, one line each: its units by kind, whether the second split gave the same,
       what split could not read, and whether the Polish handbook gives the English one's ids, kinds and lines. Red: a
       handbook missing, one that gives other units on a second split (the ids E57's facts files point at would not
       hold), and every split problem (a section number twice, a fence that never closes: E65 decision 81, 31.10 - a
       broken split lets E57 measure nothing; a table row that ran into a blank line was the third until the fix round of
       01.11, when a row became its line, trailing "|" or not, as showdown renders it). So a handbook edit of any stage
       that split cannot read turns `text` red. The Polish against the English stays a reading for E57. */
    const facts = await import(url.pathToFileURL(path.join(REPO, "tools", "handbook-facts.mjs")).href);
    problems.push(...facts.selfCheck().map(p => `handbook-facts: ${p}`));
    if (!facts.selfCheck(() => ({ handbook: null, units: [], counts: {}, problems: [] })).some(p => p.startsWith("split cuts the fixture into []"))) {
        problems.push("handbook-facts: the self-check does not see a split that cuts nothing - it would pass a broken split");
    }
    const cut = {};
    for (const f of HANDBOOKS) {
        if (!exists(f)) { problems.push(`handbook-facts: ${f} is missing - nothing was split`); continue; }
        const once = facts.split(read(f), { file: f }), again = facts.split(read(f), { file: f });
        cut[f] = once;
        if (JSON.stringify(once) !== JSON.stringify(again)) problems.push(`handbook-facts: ${f} gives other units on a second split`);
        problems.push(...once.problems.map(p => `handbook-facts: ${f}: ${p}`));
        const c = once.counts, pair = f.endsWith(".pl.md") ? cut[f.replace(/\.pl\.md$/, ".en.md")] : null;
        const shape = r => JSON.stringify(r.units.map(u => `${u.id} ${u.kind} ${/line (\d+)$/.exec(u.place)?.[1]}`));
        console.log(`text: handbook-facts: ${f}: ${c.units} unit(s) - paragraph ${c.paragraph}, row ${c.row}, note ${c.note} - in ${c.sections} section(s); `
            + `the same on a second split: ${JSON.stringify(once) === JSON.stringify(again) ? "yes" : "no"}; ${once.problems.length} split problem(s)${once.problems.length ? ` (${once.problems.join("; ")})` : ""}`
            + (pair ? `; ids, kinds and lines as in English: ${shape(once) === shape(pair) ? "yes" : "no"}` : ""));
    }
    /* The pilot's working file (E65 C14, E65-23): docs/dev/text-pilot.json, the 40 strings the owner reads in C-pilot, held
       to its shape against this tree's files (tools/text-render.mjs pilotSchema) - a file E65 writes, so a fault is red - and
       one line of how far it is. Its control: the schema shown a copy of the file with five faults planted (39 strings, an
       entry with a field missing, a key no language file holds, the key of a naturalness pair and, since C-pilot, a
       question's owner with a verdict the sheet does not offer) must name each, or a schema broken to pass everything would
       leave this part green on a malformed pilot. */
    const PILOT_FILE = "docs/dev/text-pilot.json";
    if (!exists(PILOT_FILE)) problems.push(`pilot: ${PILOT_FILE} is missing - the pilot has nothing to render`);
    else {
        let pilot = null;
        try { pilot = JSON.parse(read(PILOT_FILE)); } catch (err) { problems.push(`pilot: ${PILOT_FILE} does not parse (${err.message})`); }
        const { pairs } = T.naturalnessPairs(exists(T.NATURALNESS_GUIDE) ? read(T.NATURALNESS_GUIDE) : "");
        const against = { en: new Map([...en, ...prose]), pl, pairs, surfaces: Object.keys(budgets?.surfaces ?? {}) };
        if (pilot !== null) {
            const faults = textRender.pilotSchema(pilot, against);
            problems.push(...faults.map(p => `pilot: ${PILOT_FILE}: ${p}`));
            const strings = Array.isArray(pilot.strings) ? pilot.strings : [];
            const n = test => strings.filter(x => { try { return test(x); } catch { return false; } }).length;
            console.log(`text: pilot: ${PILOT_FILE}: ${strings.length} string(s), ${Array.isArray(pilot.questions) ? pilot.questions.length : 0} question(s); `
                + `facts for ${n(x => x.facts.length > 0)}; afters written en ${n(x => x.en.after !== null)}, pl ${n(x => x.pl.after !== null)}; `
                + `reviews left open ${n(x => Object.values(x.reviews).some(r => r !== null))}; owner's verdicts ${n(x => x.owner !== null)}`
                + ` (ok ${n(x => x.owner.verdict === "ok")}); questions answered ${(Array.isArray(pilot.questions) ? pilot.questions : []).filter(q => q?.owner).length}; ${faults.length} problem(s)`);
            /* Where the 40 stand in lang/ and config.mjs (E65 fix round, 01.11.2026): a reading, never red - an after that
               E66 or E71 applies is "landed", any other edit of one of the 40 "changed since the pilot". Its control: a
               copy of the files with one approved after written in and another string edited must read as one landed and
               one changed, and the schema must name neither, or the stage that applies the afters turns this part red. */
            const state = textRender.pilotState(pilot, against);
            console.log(`text: pilot: in this tree's files (a reading): ${state.read} text(s) read; still the before en ${state.before.en}, pl ${state.before.pl}; `
                + `the after landed en ${state.landed.en}, pl ${state.landed.pl}; changed since the pilot ${state.changed.length}${state.changed.length ? ` (${state.changed.join(", ")})` : ""}`);
            const movable = strings.filter(x => typeof x?.pl?.before === "string" && typeof x?.pl?.after === "string" && x.pl.after !== x.pl.before && pl.get(x.key) === x.pl.before);
            if (movable.length >= 2) {
                const [landed, edited] = movable, moved = new Map(pl);
                moved.set(landed.key, landed.pl.after);
                moved.set(edited.key, `${edited.pl.before} (edited)`);
                const after = textRender.pilotState(pilot, { ...against, pl: moved }), named = textRender.pilotSchema(pilot, { ...against, pl: moved });
                const wrong = [
                    ...(after.landed.pl === state.landed.pl + 1 ? [] : [`landed pl ${after.landed.pl}, not ${state.landed.pl + 1}`]),
                    ...(after.changed.includes(`${edited.key} pl`) ? [] : [`${edited.key} pl not read as changed`]),
                    ...named.filter(p => p.includes(`(${landed.key})`) || p.includes(`(${edited.key})`)).map(p => `the schema names "${p}"`)
                ];
                if (wrong.length) problems.push(`pilot: a copy of pl.json with ${landed.key}'s after landed and ${edited.key} edited reads wrong: ${wrong.join("; ")} - applying an approved after would read wrong or turn this part red`);
            } else problems.push(`pilot: the reading's control has nothing to move (${movable.length} string(s) whose Polish before is pl.json's text and whose after differs)`);
            const pair = pairs.find(p => p.key && against.en.has(p.key) && pl.has(p.key));
            if (strings.length >= 3 && pair && Array.isArray(pilot.questions) && pilot.questions.length) {
                const copy = JSON.parse(JSON.stringify(pilot));
                copy.strings = copy.strings.slice(0, textRender.PILOT_SIZE - 1);
                delete copy.strings[0].owner;
                copy.strings[1].key = "DRPG.Plant.noSuchKey";
                copy.strings[2] = { ...copy.strings[2], key: pair.key, en: { before: against.en.get(pair.key), after: null }, pl: { before: pl.get(pair.key), after: null } };
                copy.questions[0] = { ...copy.questions[0], owner: { verdict: "maybe", text: "", date: "01.11.2026" } };
                const seen = textRender.pilotSchema(copy, against);
                const want = [`strings holds ${textRender.PILOT_SIZE - 1} string(s)`, `(${copy.strings[0].key}) is not {`, "(DRPG.Plant.noSuchKey): not a key", `the key of naturalness pair ${pair.id}`,
                    `questions[0] (${copy.questions[0].id}): owner is neither`];
                const unseen = want.filter(w => !seen.some(p => p.includes(w)));
                if (unseen.length) problems.push(`pilot: the schema does not see ${unseen.map(w => JSON.stringify(w)).join(", ")} planted in a copy of ${PILOT_FILE} - it would pass a malformed pilot`);
            } else problems.push(`pilot: the schema's control has nothing to plant in (${strings.length} string(s), ${pair ? "a" : "no"} naturalness pair with a key in both files, ${Array.isArray(pilot.questions) ? pilot.questions.length : 0} question(s))`);
        }
    }
    /* The batches (E66 C6, E66-26): docs/dev/text-batch-B01a.json, held to its shape against this tree's files
       (tools/text-render.mjs batchSchema; a fault is red: a text with no facts, a fact with no function, a key out of
       Appendix C, an after that changes a placeholder, adds a digit or runs over its surface's limit, a pilot copy that is not
       the approved after, an owner's verdict on no page), one line of its counts - the budgets' "over a limit" among them,
       which the schema makes red - and where its texts stand in the files (batchState, a reading). Its control: a copy with
       seven faults planted must have each named, or a schema broken to pass everything would leave this part green on a batch
       with no facts (eight since E66 fix r2: an English .one given a placeholder its Polish .one lacks, which T2 run on the afters
       must name). Since C7 (E66-28, 01.11.2026) a text the owner approved ("ok") must read its after in both languages: the
       landed line is red, naming the texts, while one still reads its before or was edited after the approval. */
    const pilotDoc = (() => { try { return JSON.parse(read(PILOT_FILE)); } catch { return null; } })();
    for (const BATCH_FILE of textRender.BATCH_FILES) {
        if (!exists(BATCH_FILE)) { problems.push(`batch: ${BATCH_FILE} is missing - the batch has nothing to render`); continue; }
        let batch = null;
        try { batch = JSON.parse(read(BATCH_FILE)); } catch (err) { problems.push(`batch: ${BATCH_FILE} does not parse (${err.message})`); continue; }
        const { pairs } = T.naturalnessPairs(exists(T.NATURALNESS_GUIDE) ? read(T.NATURALNESS_GUIDE) : "");
        const against = { en: new Map([...en, ...prose]), pl, pairs, surfaces: budgets?.surfaces ?? null, pilot: pilotDoc,
            source: f => (exists(f) ? read(f) : null), count: T.wordCount, parity: T.pairParity };
        const faults = textRender.batchSchema(batch, against);
        problems.push(...faults.map(p => `batch: ${BATCH_FILE}: ${p}`));
        const c = textRender.batchCounts(batch, against);
        console.log(`text: batch: ${BATCH_FILE}: ${c.texts} text(s) (written ${c.written}, the pilot's ${c.pilot}); facts ${c.facts} (read in a function ${c.inCode}, `
            + `with a note ${c.notInCode}); afters written en ${c.afters.en}, pl ${c.afters.pl}; over the target ${c.overTarget}, over a limit ${c.overLimit}; `
            + `reviews left open en ${c.reviews.en}, coldEn ${c.reviews.coldEn}, pl ${c.reviews.pl}, mechanics ${c.reviews.mechanics}; owner's verdicts ${c.owner}; ${faults.length} problem(s)`);
        const state = textRender.batchState(batch, against);
        console.log(`text: batch: in this tree's files (a reading): ${state.read} text(s) read; still the before en ${state.before.en}, pl ${state.before.pl}; `
            + `the after landed en ${state.landed.en}, pl ${state.landed.pl}; changed since the batch ${state.changed.length}${state.changed.length ? ` (${state.changed.join(", ")})` : ""}`);
        const texts = Array.isArray(batch?.texts) ? batch.texts : [];
        /* A text the owner later asked to change (text-render.mjs BATCH_LATER; E47-FC) is not held to its approved after;
           each is named, and a key there that is no approved text of this batch is a problem. */
        const later = Object.keys(textRender.BATCH_LATER ?? {});
        const strayLater = later.filter(key => !texts.some(t => t?.key === key && t?.owner?.verdict === "ok"));
        if (strayLater.length) problems.push(`batch: ${BATCH_FILE}: BATCH_LATER names ${strayLater.join(", ")}, no text of this batch the owner approved`);
        if (later.length) console.log(`text: batch: the owner's later word supersedes the approved after of ${later.length} text(s): ${later.map(key => `${key} (${textRender.BATCH_LATER[key].page} ${textRender.BATCH_LATER[key].card}, ${textRender.BATCH_LATER[key].date})`).join(", ")}`);
        const approved = texts.filter(t => t?.owner?.verdict === "ok" && !later.includes(t.key));
        const unlanded = approved.flatMap(t => {
            const one = textRender.batchState({ texts: [t] }, against);
            return ["en", "pl"].filter(lang => !one.landed[lang]).map(lang => `${t.key} ${lang}`);
        });
        console.log(`text: batch: the owner's approved afters: ${approved.length} text(s); landed in this tree's files en `
            + `${approved.length - unlanded.filter(u => u.endsWith(" en")).length}, pl ${approved.length - unlanded.filter(u => u.endsWith(" pl")).length}; not landed ${unlanded.length}`);
        if (unlanded.length) problems.push(`batch: ${BATCH_FILE}: ${unlanded.length} approved after(s) not in the files (${unlanded.slice(0, 6).join(", ")}`
            + `${unlanded.length > 6 ? `, and ${unlanded.length - 6} more` : ""}) - every after the owner approved is the text of config.mjs and lang/ (E66-28)`);
        const copyOf = texts.findIndex(t => t?.source === "pilot" && typeof t?.en?.before === "string");
        const marked = texts.findIndex(t => t?.source === "written" && typeof t?.en?.before === "string" && /\{\w+\}/.test(t.en.before));
        const plain = texts.findIndex((t, i) => t?.source === "written" && typeof t?.en?.before === "string" && i !== marked);
        if (copyOf >= 0 && marked >= 0 && plain >= 0 && texts.length >= 4) {
            const copy = JSON.parse(JSON.stringify(batch));
            const t0 = copy.texts.findIndex((t, i) => ![copyOf, marked, plain].includes(i));
            const limit = budgets?.surfaces?.[copy.texts[plain].surface]?.limit ?? 45;
            const name = copy.texts[marked].en.before.match(/\{(\w+)\}/)[1];
            copy.texts[t0].facts = [];
            copy.texts[marked] = { ...copy.texts[marked], kept: [0], en: { ...copy.texts[marked].en, after: copy.texts[marked].en.before.replace(`{${name}}`, "{planted}") } };
            copy.texts[plain] = { ...copy.texts[plain], kept: [0], en: { ...copy.texts[plain].en, after: `${"word ".repeat(limit)}and 7 more` } };
            copy.texts[copyOf] = { ...copy.texts[copyOf], pl: { ...copy.texts[copyOf].pl, after: `${copy.texts[copyOf].pl.after} (edited)` } };
            const owned = copy.texts.findIndex((t, i) => t.owner && i !== copyOf);
            if (owned >= 0) copy.texts[owned] = { ...copy.texts[owned], owner: { verdict: "ok", text: "", date: "01.11.2026" } };
            copy.texts.push({ ...copy.texts[plain], key: "DRPG.Plant.noSuchKey", en: { ...copy.texts[plain].en, after: null }, kept: null });
            /* A family whose Polish .one fills fewer placeholders than its English .other: its English .one given the .other's words. */
            const holes = s => (typeof s === "string" ? [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join() : null);
            const family = copy.texts.findIndex((t, i) => ![t0, marked, plain, copyOf, owned].includes(i) && typeof t?.en?.after?.other === "string"
                && typeof t?.en?.after?.one === "string" && typeof t?.pl?.after?.one === "string" && holes(t.en.after.other) !== holes(t.pl.after.one));
            if (family >= 0) copy.texts[family] = { ...copy.texts[family], en: { ...copy.texts[family].en, after: { ...copy.texts[family].en.after, one: copy.texts[family].en.after.other } } };
            else problems.push(`batch: the schema's control found no family to plant T2's fault in (an English .other whose placeholders its Polish .one lacks)`);
            const seen = textRender.batchSchema(copy, against);
            const want = [`(${copy.texts[t0].key}): facts is not a non-empty list`, `(${copy.texts[marked].key}): en.after's placeholders`,
                `(${copy.texts[plain].key}): en.after adds the digit(s) 7`, `(${copy.texts[plain].key}): en.after is ${limit + 3} words, over the`,
                `(${copy.texts[copyOf].key}): pl.after is not the pilot's approved after`, "(DRPG.Plant.noSuchKey): not a key",
                ...(owned >= 0 ? [`(${copy.texts[owned].key}): owner is neither null nor`] : []),
                ...(family >= 0 ? [`(${copy.texts[family].key}): the afters break T2 (pairParity)`] : [])];
            const unseen = want.filter(w => !seen.some(p => p.includes(w)));
            if (unseen.length) problems.push(`batch: the schema does not see ${unseen.map(w => JSON.stringify(w)).join(", ")} planted in a copy of ${BATCH_FILE} - it would pass a malformed batch`);
        } else problems.push(`batch: the schema's control has nothing to plant in (${texts.length} text(s); a pilot copy ${copyOf >= 0 ? "found" : "missing"}, a written text with a placeholder ${marked >= 0 ? "found" : "missing"})`);
    }
    const held = Object.keys(T.MODES).filter(name => !fixtures.some(p => p.startsWith(`${name} `))).length;
    console.log(`text: ${Object.keys(T.MODES).length} detector(s), ${held} hold their fixture; ${where}: en ${en.size} keys, pl ${pl.size}; `
        + `config.mjs prose ${prose.size}; scripts ${scripts.size}, docs ${docs.size}; FAIL found ${fails} beyond the baselines, `
        + `report found ${reports}; ${problems.length} problem(s)`);
    return problems;
}

/* ---------------------------------- css ----------------------------------- */

/* THE CSS LINT (E44 C1b, 04.11.2026). The detectors are scripts/tests-css.mjs's, which imports nothing, so this part
   and the suite's R2, R1310 and R1311 run the same functions; tools/css-lint.mjs reads the files and holds the budget. */
async function css() {
    const { cssLint } = await import(url.pathToFileURL(path.join(REPO, "tools", "css-lint.mjs")).href);
    const { problems, summary } = await cssLint(REPO);
    console.log(summary);
    return problems;
}

/* --------------------------------- icons ---------------------------------- */

/* THE TOKEN PICTURES (13.11.2026): tools/token-icons.mjs makes the text; this holds the files to it. */
async function icons() {
    const { iconProblems } = await import(url.pathToFileURL(path.join(REPO, "tools", "token-icons.mjs")).href);
    const { problems, count } = await iconProblems(REPO);
    /* The control (the review of 13.11.2026, REVIEW-111 1): a generator that reads no source - SOURCES emptied, or
       PROJECT_GLYPHS read as empty - would compare nothing and answer no problem. Handed an empty set, the check must
       say so; if it does not, the part is red here, whatever the files are. */
    const control = await iconProblems(REPO, { files: new Map() });
    const blind = !control.problems.some(p => /no token picture to compare/.test(p));
    console.log(`icons: ${count} file(s) the token-icons tool owns; ${problems.length} problem(s); the empty set ${blind ? "NOT reported" : "reported"}`);
    return [...problems, ...(blind ? ["the check answers no problem for an empty set of pictures - it would read nothing and pass"] : [])];
}

/* -------------------------------- comments -------------------------------- */

/* THE COMMENTS LINT (E56 C1): tools/comments-lint.mjs reads the files and holds the budget. */
async function comments() {
    const { commentsLint } = await import(url.pathToFileURL(path.join(REPO, "tools", "comments-lint.mjs")).href);
    const { problems, summary } = await commentsLint(REPO);
    console.log(summary);
    return problems;
}

/* -------------------------------- contrast -------------------------------- */

/* THE CONTRAST (E44 C1c, 04.11.2026; D29 = 2): the arithmetic is tests-css.mjs's, which R1312 runs on the served files. */
async function contrast() {
    const { contrastCheck } = await import(url.pathToFileURL(path.join(REPO, "tools", "contrast.mjs")).href);
    const { problems, summary, lines } = await contrastCheck(REPO);
    for (const line of lines.filter(l => !/, ok$/.test(l))) console.log(line);
    console.log(summary);
    return problems;
}

/* --------------------------------- glyphs --------------------------------- */

/* ONE SOURCE FOR THE GLYPHS (E48 G1, 10.11.2026): scripts/tests-glyphs.mjs's `glyphProblems` and `selfCheck` (tools/glyph-map.mjs's
   `--check`), which R3333 runs on the files Foundry serves. */
async function glyphs() {
    const G = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-glyphs.mjs")).href);
    const files = Object.fromEntries(G.GLYPH_FILES.map(f => [f, exists(f) ? read(f) : null]));
    const { misses, plants } = G.selfCheck(files);
    const { problems, counts } = G.glyphProblems(files);
    console.log(`glyphs: ${counts ? `${counts.glyphs} glyph(s) (${Object.entries(counts.families).map(([f, n]) => `${f} ${n}`).join(", ")}), `
        + `${counts.same} same; generated ${counts.generated}, fa ${counts.fa}, ${counts.current}/3 generated file(s) current; `
        + `${counts.sheetHeld}/${counts.sheetRows} sheet drawing(s) equal to their rows; chrome section ${counts.chrome}` : "nothing read"}; `
        + `self-check ${plants - misses.length}/${plants} plant(s) seen; ${problems.length + misses.length} problem(s)`);
    /* THE MAP (E48 G2): its structure is red here; its gaps are a reading, each held red by its own test (R3334-R3339)
       until the drawing rounds empty it. */
    const C = await import(url.pathToFileURL(path.join(REPO, "scripts", "config.mjs")).href);
    const keyed = G.keyedElements(C, read("scripts/gm-panel.mjs"));
    const structure = G.mapProblems(keyed);
    const { glyphs: rows } = G.parseGlyphs(files["tools/glyphs.json"] ?? "");
    const gaps = G.mapGaps(rows, { keyed, danganronpaCss: files["styles/danganronpa.css"] ?? "" });
    console.log(`glyphs: map: ${keyed.length} keyed element(s), ${G.FUTURE.length} FUTURE row(s), ${G.SAME.length} SAME, `
        + `${G.OPPOSITES.length} OPPOSITES; ${structure.length} structure problem(s); gaps (the drawing rounds close them): `
        + `keyed undrawn ${gaps.keyedUndrawn.length}, dead tiles ${gaps.deadTiles.length}, opposites alike ${gaps.opposites.length}, `
        + `FUTURE undrawn ${gaps.futureUndrawn.length}, shared not SAME ${gaps.shared.length} (of ${gaps.counts.sharedToday} shared, `
        + `${gaps.counts.sameJoined} joined), Glass off the 24 grid ${gaps.offGrid.length}`);
    return [...misses, ...problems, ...structure];
}

/* ------------------------------ tooltips ------------------------------ */

async function tooltips() {
    try {
        const tool = await import(url.pathToFileURL(path.join(REPO, "tools", "tooltip-census.mjs")).href);
        await tool.loadShipped(REPO);
        return tool.check(line => console.log(line));
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") return ["espree is not installed - run `npm ci` in audit/harness first"];
        return [`the census could not run (${String(err.message).split("\n")[0]})`];
    }
}

const PARTS = { stamps, notes, dashes, parity, prose, names, moves, contract, registry, stages, tree, gatecode, live, text, css, icons, contrast, glyphs, tooltips };

const asked = argv.filter((a, i) => !a.startsWith("--") && !(releaseAt >= 0 && i === releaseAt + 1) && !(langAt >= 0 && i === langAt + 1));
if (RELEASE === "" || (RELEASE !== null && !/^v\d+\.\d+\.\d+$/.test(RELEASE))) {
    console.log(`check: --release takes a tag like v1.2.61, got "${RELEASE}"`);
    process.exit(2);
}
if (LANG_DIR === "" || (LANG_DIR !== null && LANG_DIR.startsWith("--"))) {
    console.log(`check: --lang takes a directory that holds en.json and pl.json, got "${LANG_DIR}"`);
    process.exit(2);
}
/* `package` (E59 C5a) is registered on a line of its own, not in PARTS' list: three lines adding a part each rewrote that
   one line on 13.11.2026 (prep-54's comments, project-token-icon's icons and this), and a merge of any two conflicted. */
PARTS.package = pkg;
// E56 C1: on its own line, as `package` is, so a line that adds a part to PARTS above does not meet this one.
PARTS.comments = comments;
const unknown = asked.filter(name => !PARTS[name]);
if (unknown.length) {
    console.log(`check: no part named ${unknown.join(", ")} (parts: ${Object.keys(PARTS).join(", ")})`);
    process.exit(2);
}
let red = false;
const redParts = [];
for (const name of asked.length ? asked : Object.keys(PARTS)) {
    const problems = await PARTS[name]();
    for (const p of problems) console.log(`${name}: ${p}`);
    if (problems.length) { red = true; redParts.push(name); }
}
const ran = asked.length ? asked : Object.keys(PARTS);
console.log(`check: ${ran.length} part(s), ${red ? `red: ${redParts.join(", ")}` : "all green"}`);
process.exitCode = red ? 1 : 0;
