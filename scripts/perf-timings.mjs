/**
 * Danganronpa RPG - how long the module's named costs took, as they happened.
 * ---------------------------------------------------------------------------
 * E53 C1 (15.11.2026; the plan's item 1, docs/dev/plans/E53.md on the planning line's branch). E53's goal names costs
 * that `perf()` had no line for: a ring drawn again, the primary GM's judgement of a sheet write (E29's audit), the
 * canvas drawn entering and leaving the trial hall, a chat card painted, the case dashboard rebuilt in place and the
 * fog repainted. perf-counters.mjs counts how often work runs and takes no time on purpose (its header); this leaf is
 * the other half: each cost hands in its own duration where the work runs, and the last `KEPT` of each name are kept
 * in memory, as roll-draw.mjs keeps the last fifty round trips of a roll. `game.drpg.perf()` reads them.
 *
 * Passive, not provoked: nothing here makes the work happen, so a line is "none since this browser loaded" until the
 * table has done the thing, and a number is what the table's own work cost on this browser - never a loop run for the
 * report. Only the expensive branch of a cost is timed (a ring rebuilt, not a ring kept), so a drag pays two
 * `performance.now()` reads per ring actually redrawn and nothing for the rest.
 *
 * Headless every millisecond here is jsdom's (audit/perf-baseline.json `headless.verdict`): the suite asserts that a
 * name is fed and how the statistics are taken, never a number. Lost on a reload, on purpose.
 *
 * No imports: own-ring.mjs, remnant-ring.mjs, fog.mjs, live.mjs, sheet-audit.mjs and private-rolls.mjs import this
 * one, and a leaf can be imported by anything without a cycle (R161).
 *
 * THE NAMES (each fed where the work runs):
 *   ownRing.rebuilt, remnantRing.rebuilt   one token's ring drawn again (not one kept or skipped)
 *   fog.repaint                            one `repaintFog()` past the dissolve's queue, a stand-down included,
 *                                          with the doors' refresh every way out pays
 *   live.<region>                          one rebuild in place of a live window's region (live.mjs `keepLive`);
 *                                          the case dashboard is `live..drpg-case-live`
 *   audit.judged, audit.waited             the primary GM's judgement of one sheet write, and how long that write
 *                                          waited behind the writes before it on its student (sheet-audit.mjs)
 *   canvas.draw, canvas.draw.trial         the canvas drawn, from `canvasTearDown` to `canvasReady`; `.trial` also when
 *   canvas.draw.leaveTrial                 the scene drawn is the linked trial hall, `.leaveTrial` when the one
 *                                          before it was (perf-timings is fed by diagnostics.mjs's two hooks)
 *   chatCard.paint                         one module chat card painted on render (private-rolls.mjs `paintChatCard`)
 */

/** How many of each name are kept: the newest, as roll-draw.mjs keeps its trips. */
export const KEPT = 50;

const kept = new Map();

/** One duration of `name`, in ms. A non-finite or negative reading is not kept: it says nothing about a cost. */
export function sample(name, ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 0) return;
    let list = kept.get(name);
    if (!list) kept.set(name, list = []);
    list.push(n);
    if (list.length > KEPT) list.splice(0, list.length - KEPT);
}

/** A clock read where `performance` exists, else Date's: jsdom and Node both have the first. */
export function now() {
    return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * The statistics of `name`: `{ n, p50, p95, max }`, or `{ n: 0 }` when nothing was kept. A percentile is the value at
 * the nearest rank (the ceil(p * n)-th of the sorted readings): with five readings p95 is the slowest, which is what it
 * is with five, and never a value between two that nobody measured.
 */
export function stats(name) {
    const list = [...(kept.get(name) ?? [])].sort((a, b) => a - b);
    if (!list.length) return { n: 0 };
    const rank = p => list[Math.min(list.length, Math.max(1, Math.ceil(p * list.length))) - 1];
    return { n: list.length, p50: rank(0.5), p95: rank(0.95), max: list[list.length - 1] };
}

/** Every name kept, sorted. */
export function names() {
    return [...kept.keys()].sort();
}

/** One name's readings forgotten (the suite forgets its own, and never the table's). */
export function forget(name) {
    kept.delete(name);
}
