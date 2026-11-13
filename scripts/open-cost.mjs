/**
 * A window's first open: what it fetches, fetched before it is asked for, and what each open cost at this table
 * (perf-open line, 12.11.2026).
 *
 * WHY. The owner, at a table on 1.2.108 (Foundry 14.365 on a hosted server, Daggerheart 2.12.8): the module's windows
 * are slow the first time each one opens, and fine after. What was measured before anything here was written
 * (docs/dev/PERF-OPEN/STATUS.md has the tables and how each number was taken):
 *   - the module's own work, headless (audit/harness/probes/09-open-cost.mjs, jsdom, each window opened three times):
 *     no window's first open costs much more than its second - the largest premiums were Room setup (827 ms against
 *     697 and 700, jsdom's DOM being most of all three), Observe (110 against 62) and the Class Trial console (87
 *     against 47): the code compiled on its first call, on a machine where the DOM is slow;
 *   - the stylesheets, in Chromium (the captured windows inserted three times under the module's sheets): the first
 *     insert's style and layout a few ms over the second's, 27 against 14 ms at most (the Settings window);
 *   - the glass on a window's title band, in Chromium: 1-4 ms a paint, first or not.
 * None of those is the delay the owner describes. What a first open does that a second does not, and that neither the
 * harness nor a local Chromium can time, is ask the server for files: a file reached only by `import()` (the Settings
 * window is three in a row - settings-window.mjs, then look.mjs, then voice-panel.mjs - the Class Trial console three,
 * the notice history one), Daggerheart's templates the first sheet or roll window of a page compiles, and a font's
 * subset the first text in it draws (the Polish letters are their own files). On a hosted server each is a round
 * trip; this file makes them at idle after ready, one small step per idle callback, so a click finds them in the
 * browser's module map, Foundry's template cache and the page's fonts. Whether that was the delay is a reading at the
 * table: `game.drpg.openTimes()` (below) is it.
 *
 * WHAT IS NOT WARMED. The module's static graph is loaded at boot (192 of the 206 files it serves outside the suite at 1.2.108), so a
 * window built from it fetches nothing; the code it runs is compiled on its first call, which no warming can do
 * without running the window. Nothing here renders a window, writes to the world or sends a packet.
 */
import { MODULE_ID } from "./config.mjs";
import { error, log } from "./utils.mjs";

/*
 * The files a window reaches only by `import()`, by who opens it. R4200 holds this list to the code: every file that
 * `import()` reaches and module.mjs's static graph does not is here or in NOT_WARMED, and nothing here is loaded at
 * boot already. A file's own static imports come with it (look.mjs with settings-window.mjs, case-hints.mjs with
 * case-trial.mjs).
 */
export const WARM_IMPORTS = Object.freeze({
    /* The gear's Settings window (settings-window.mjs, its look section look.mjs, its voice section voice-panel.mjs), the
       notice history, a Frisk, and the trial's windows a player is shown (the floor's prompts, the zones, the modes).
       And the e93 line's (merged into the 1.2.111 tree after this list was written, 13.11.2026): Infiltrate's Tail and
       its doors (action-listen.mjs reaches action-tail.mjs and action-doors.mjs), a rest's room actions (action-rest.mjs,
       action-facilities.mjs) and the Reroll that replays an Infiltrate roll (reroll.mjs, infiltrate-reroll.mjs). Each is
       imports and functions, nothing run at load. */
    everyone: Object.freeze(["settings-window.mjs", "look.mjs", "voice-panel.mjs", "notice-history-app.mjs", "frisk.mjs",
        "trial-modes.mjs", "trial-floor-ui.mjs", "trial-zones-ui.mjs",
        "action-tail.mjs", "action-doors.mjs", "action-facilities.mjs", "infiltrate-reroll.mjs"]),
    /* The GMs' own: Room setup's Passages tab and the Class Trial console's case schema and summary; and the room action
       editors of Room setup's Facilities tab and a project's window (facility-editor.mjs, the e93 line's E93 C2). */
    gm: Object.freeze(["passages-tab.mjs", "case-trial.mjs", "case-summary.mjs", "facility-editor.mjs"])
});

/* Reached only by `import()` and left cold, each with its reason (R4200 reads that one is written). */
export const NOT_WARMED = Object.freeze({
    "patches.mjs": "module.mjs's ready hook imports it on every client already (watchSheetRenders), before this runs"
});

/* How long after ready the first step waits: the boot's own work - the GM stores, the migration, the first canvas
   draw - goes first. Then one step an idle callback, with NO deadline (R4203; the coordinator, 12.11.2026): the boards
   and the curtain of 1.2.109 play at load and at a change of day and no event marks their end, so a page that is busy
   simply waits rather than being handed a step after a few seconds. What a step starts - a file's parse, a template's
   compile - still runs as its own task when the server's answer lands, outside the idle period: each step is one file,
   six templates or one face, so that is kept small. */
const START_DELAY_MS = 4000;
/* Templates asked of the server at once: a hosted server answers a handful in parallel as fast as one. */
const TEMPLATE_BATCH = 6;
/* A font's two subsets (the stylesheets' unicode-range): Latin, and the Latin Extended file Polish letters live in. */
const FONT_FAMILIES = Object.freeze(["DRPG Pixel", "VT323", "Special Elite"]);
const FONT_SAMPLES = Object.freeze(["Aa", "ąęłńóśźżĄĘŁ"]);

const state = { started: null, finished: null, held: {}, imports: { ok: 0, failed: [] }, templates: { ok: 0, failed: [], skipped: null }, fonts: { ok: 0, failed: [], skipped: null } };
let warming = null;

/* What plays on the page that a step must not land in (the coordinator's ask, 12.11.2026, on 1.2.109; R4204): a board or
   cut-in of sequence.mjs (`data-drpg-sequence` on the body for as long as it plays), the curtain's turn (glass.mjs,
   `data-drpg-turning`), the transitions' flicker (transitions.mjs, `drpg-flicker`), and a transition's span after the
   clock's hooks: `t.dur + 200` ms, about 3 s at most (the Investigation's flashes, 2.8 s, the longest read on 1.2.109),
   so QUIET_AFTER_CLOCK_MS. Read off the body rather than imported: sequence.mjs reaches api.mjs's graph. */
export const QUIET_AFTER_CLOCK_MS = 3500;
/* How long a held step waits before it asks for the next idle period again. */
export const RECHECK_MS = 400;
/* The clock's three hooks (transitions.mjs `registerTransitions`). The body's announcement is not one of them: its name is
   spelt in chapter.mjs alone (R3145), and its flicker marks the body `drpg-flicker` for each of its four onsets. */
const CLOCK_HOOKS = Object.freeze(["drpgTimeOfDayChanged", "drpgPhaseChanged", "drpgEclipseChanged"]);
let clockHeardAt = -Infinity;

/** What plays on `body` now that a warming step waits for - "sequence", "turn", "flicker", "transition" - or null. */
export function playingNow(body = globalThis.document?.body, { now = performance.now(), heardAt = clockHeardAt } = {}) {
    if (body?.hasAttribute?.("data-drpg-sequence")) return "sequence";
    if (body?.hasAttribute?.("data-drpg-turning")) return "turn";
    if (body?.classList?.contains?.("drpg-flicker")) return "flicker";
    if (now - heardAt < QUIET_AFTER_CLOCK_MS) return "transition";
    return null;
}

/** One step's wait: the browser's next idle period (`requestIdleCallback`, no deadline), or 50 ms where it has none
 *  (Safari); then, while something plays (`playingNow`), RECHECK_MS and the next idle period again, the step counted
 *  in `warmState().held` by what held it. `ric`, `later`, `body` and `heardAt` stand in for the page's in R4203, R4204. */
export function whenIdle({ ric = undefined, later = undefined, body = undefined, heardAt = () => clockHeardAt } = {}) {
    // Each called where it is named, never taken as a value (R571): a browser runs a window's function on the window.
    const asked = ric === undefined ? typeof globalThis.requestIdleCallback === "function" : typeof ric === "function";
    const wait = (fn, ms) => { if (later) later(fn, ms); else setTimeout(fn, ms); };
    return new Promise(resolve => {
        const check = () => {
            const why = playingNow(body === undefined ? globalThis.document?.body : body, { now: performance.now(), heardAt: heardAt() });
            if (!why) { resolve(); return; }
            state.held[why] = (state.held[why] ?? 0) + 1;
            wait(ask, RECHECK_MS);
        };
        function ask() {
            if (!asked) wait(check, 50);
            else if (ric) ric(check);
            else globalThis.requestIdleCallback(check);
        }
        ask();
    });
}
const idle = () => whenIdle();

/** The files this browser warms: everyone's, and the GMs' on a GM. */
export function warmPlan({ gm = Boolean(globalThis.game?.user?.isGM) } = {}) {
    return [...WARM_IMPORTS.everyone, ...(gm ? WARM_IMPORTS.gm : [])];
}

/*
 * Daggerheart's templates a first open compiles: the parts of the character and party sheets this world registers,
 * and of every application class the system's API exposes with `PARTS` (its roll windows, the countdowns). Foundry's
 * ApplicationV2 loads a class's parts the first time one of its windows renders; asked here, the same paths are in
 * Foundry's template cache by then. Read off the classes as they stand, so a Daggerheart that renames a template is
 * read as it is, and a class with no `PARTS` adds nothing.
 */
export function templatePaths({ config = globalThis.CONFIG, api = globalThis.game?.system?.api } = {}) {
    const paths = new Set();
    const take = cls => {
        let parts = null;
        try { parts = cls?.PARTS; } catch { parts = null; }
        if (!parts || typeof parts !== "object") return;
        for (const part of Object.values(parts)) {
            for (const path of [part?.template, ...(Array.isArray(part?.templates) ? part.templates : [])]) {
                if (typeof path === "string" && /\.(hbs|html)$/.test(path)) paths.add(path);
            }
        }
    };
    for (const type of ["character", "party"]) {
        for (const entry of Object.values(config?.Actor?.sheetClasses?.[type] ?? {})) take(entry?.cls);
    }
    const seen = new Set();
    const walk = (node, depth) => {
        if (!node || depth > 3 || seen.has(node)) return;
        seen.add(node);
        for (const value of Object.values(node)) {
            if (typeof value === "function") take(value);
            else if (value && typeof value === "object" && !Array.isArray(value)) walk(value, depth + 1);
        }
    };
    walk(api?.applications, 0);
    return [...paths];
}

async function warmImports(files) {
    for (const file of files) {
        await idle();
        try {
            await import(`./${file}`);
            state.imports.ok++;
        } catch (err) {
            state.imports.failed.push(file);
            error(`Could not fetch ${file} ahead of its window`, err);
        }
    }
}

async function warmTemplates() {
    const H = globalThis.foundry?.applications?.handlebars;
    const load = typeof H?.getTemplate === "function" ? path => H.getTemplate(path)
        : typeof H?.loadTemplates === "function" ? path => H.loadTemplates([path]) : null;
    if (!load) { state.templates.skipped = "this Foundry has no foundry.applications.handlebars.getTemplate or loadTemplates"; return; }
    const paths = templatePaths();
    for (let i = 0; i < paths.length; i += TEMPLATE_BATCH) {
        await idle();
        const batch = paths.slice(i, i + TEMPLATE_BATCH);
        const results = await Promise.allSettled(batch.map(path => load(path)));
        results.forEach((result, k) => {
            if (result.status === "fulfilled") state.templates.ok++;
            else state.templates.failed.push(batch[k]);
        });
    }
}

async function warmFonts() {
    const fonts = globalThis.document?.fonts;
    if (typeof fonts?.load !== "function") { state.fonts.skipped = "this page has no document.fonts"; return; }
    for (const family of FONT_FAMILIES) {
        await idle();
        const results = await Promise.allSettled(FONT_SAMPLES.map(sample => fonts.load(`16px "${family}"`, sample)));
        results.forEach((result, k) => {
            if (result.status === "fulfilled") state.fonts.ok++;
            else state.fonts.failed.push(`${family} (${k ? "Latin Extended" : "Latin"})`);
        });
    }
}

/** Warm everything once (a second call answers the first's promise). Never throws; what failed is in `warmState()`. */
export function warmFirstOpens({ delayMs = START_DELAY_MS } = {}) {
    warming ??= (async () => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        state.started = performance.now();
        await warmImports(warmPlan());
        await warmTemplates().catch(err => { state.templates.skipped = String(err?.message ?? err); });
        await warmFonts().catch(err => { state.fonts.skipped = String(err?.message ?? err); });
        state.finished = performance.now();
        log(`first opens warmed in ${Math.round(state.finished - state.started)} ms: ${state.imports.ok} file(s), ${state.templates.ok} template(s), ${state.fonts.ok} font subset(s)`);
        return warmState();
    })();
    return warming;
}

/** What the warming has done so far: a copy, with its time in ms once it has finished. */
export function warmState() {
    return {
        held: { ...state.held },
        ms: state.finished === null || state.started === null ? null : Math.round(state.finished - state.started),
        imports: { ok: state.imports.ok, failed: [...state.imports.failed] },
        templates: { ok: state.templates.ok, failed: [...state.templates.failed], skipped: state.templates.skipped },
        fonts: { ok: state.fonts.ok, failed: [...state.fonts.failed], skipped: state.fonts.skipped }
    };
}

/* ---- the reading at the table ------------------------------------------------------------------------------- */

/* A window counts as opened by the last click or key when it renders within this long of it. */
const INPUT_WINDOW_MS = 10000;
const OPENS_KEPT = 300;
const opens = [];
const seenKeys = new Set();
let inputAt = null;

/* The module's windows (the kit's frame, the panels, the messenger) and every actor's sheet. */
const watched = (app, el) => Boolean(el?.matches?.(".drpg-ui, .drpg-panel, .drpg-messenger")) || app?.document?.documentName === "Actor";

/** A window's name in the reading: its class and its title, the same for each open of the same window on this page. */
export function openKey(app) {
    const kind = app?.document?.documentName === "Actor" ? `sheet ${app?.constructor?.name ?? "?"}` : app?.constructor?.name ?? "?";
    return `${kind}: ${String(app?.title ?? "").trim() || app?.id || "?"}`;
}

function onRender(app, element, _context, options) {
    if (!options?.isFirstRender) return;
    const el = element ?? app?.element;
    if (!watched(app, el)) return;
    const now = performance.now();
    const key = openKey(app);
    const row = { key, first: !seenKeys.has(key), toRender: null, toFrame: null };
    seenKeys.add(key);
    if (inputAt !== null && now - inputAt >= 0 && now - inputAt < INPUT_WINDOW_MS) row.toRender = Math.round(now - inputAt);
    const from = inputAt;
    inputAt = null;
    opens.push(row);
    if (opens.length > OPENS_KEPT) opens.shift();
    // Two frames after the render: the first frame that shows the window has been drawn by then.
    if (from !== null && row.toRender !== null && typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(() => { row.toFrame = Math.round(performance.now() - from); }));
    }
}

/**
 * The opens read, one row a window: its first open on this page and the middle of its later ones, from the click (or
 * key) before it to its render (`render`) and to two frames after (`shown`), in ms. Pure: R4201 runs it on a fixture.
 */
export function summarizeOpens(rows) {
    const byKey = new Map();
    for (const row of rows) {
        if (!byKey.has(row.key)) byKey.set(row.key, { window: row.key, firstRender: null, firstShown: null, later: [] });
        const out = byKey.get(row.key);
        if (row.first) { out.firstRender = row.toRender; out.firstShown = row.toFrame; } else out.later.push(row);
    }
    const middle = values => {
        const v = values.filter(x => typeof x === "number").sort((a, b) => a - b);
        return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
    };
    return [...byKey.values()].map(out => ({
        window: out.window,
        firstRender: out.firstRender,
        firstShown: out.firstShown,
        laterRender: middle(out.later.map(r => r.toRender)),
        laterShown: middle(out.later.map(r => r.toFrame)),
        laterOpens: out.later.length
    }));
}

/**
 * `game.drpg.openTimes()`: each window opened on this page since it loaded - its first open against the middle of its
 * later ones, from the click to the render and to the frame that shows it - and what the warming did. Console only,
 * nothing written; `{ reset: true }` forgets the opens read (the windows already seen still count as seen).
 */
export function openTimes({ reset = false } = {}) {
    const rows = summarizeOpens(opens);
    const warm = warmState();
    console.log(`${MODULE_ID} | window opens on this page, ms from the click (render: the window built; shown: two frames later); `
        + "a blank is an open no click came just before");
    if (typeof console.table === "function") console.table(rows);
    console.log(`${MODULE_ID} | warmed: ${warm.ms === null ? "not finished" : `${warm.ms} ms`}; steps held by what played: ${JSON.stringify(warm.held)}; files ${warm.imports.ok} (failed ${warm.imports.failed.length}), `
        + `templates ${warm.templates.ok} (failed ${warm.templates.failed.length}${warm.templates.skipped ? `; ${warm.templates.skipped}` : ""}), `
        + `fonts ${warm.fonts.ok} (failed ${warm.fonts.failed.length}${warm.fonts.skipped ? `; ${warm.fonts.skipped}` : ""})`);
    if (reset) opens.length = 0;
    return { rows, warm };
}

let registered = false;
/** At ready, every client: the reading starts, and the warming after START_DELAY_MS. */
export function registerOpenCost() {
    if (registered) return;
    registered = true;
    const mark = event => { inputAt = event.timeStamp; };
    globalThis.addEventListener?.("pointerdown", mark, { capture: true, passive: true });
    globalThis.addEventListener?.("keydown", mark, { capture: true, passive: true });
    Hooks.on("renderApplicationV2", onRender);
    for (const hook of CLOCK_HOOKS) Hooks.on(hook, () => { clockHeardAt = performance.now(); });
    warmFirstOpens().catch(err => error("Could not warm the windows' first opens", err));
}
