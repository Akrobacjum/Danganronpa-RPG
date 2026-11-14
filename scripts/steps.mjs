/**
 * Danganronpa RPG - one runner for the procedures that cannot be taken back.
 * ---------------------------------------------------------------------------
 * The verdict, the chapter's end and the season's reset are each a list of
 * steps that change the world for good: a death, a card, a Level Up, the clock
 * moved, a season's state cleared. Each grew its own loop (verdict.mjs
 * `runVerdict` since E10 C5, chapter.mjs `endChapterNow` since E11 C5,
 * season-setup.mjs `wipeSeason` since E11 C9), and each said in its own words
 * what it did, what it left and what failed - or did not say it (E42, 1.2.97;
 * audit S17-30). `runSteps` is the one loop now, and `stepsReport` the one
 * report.
 *
 * WHAT THE THREE SHARE. A step runs in its own try/catch, so one that throws is
 * named and the rest still run. The procedure's own record - which steps are
 * done, which failed - is handed in as it stands and saved after every step
 * that ran, so a procedure stopped half way (a step that failed, a GM's tab
 * closed) is finished by handing the same record back: a step the record calls
 * done is not run again. A step the GM left out (`ask` false: the reset's
 * unticked group) is kept, and its `keep` runs; a step that needs another
 * (`needs`) waits until that one is done; and a procedure that must stop when
 * the table moved under it (`stop`: the primary GM changed, the phase moved)
 * says so before every step, and every step from there is not run.
 *
 * WHY EACH STEP READS ITS TARGET FROM THE RECORD. The record is saved after the
 * step's work, never with it: a tab closed between the two leaves the work done
 * and the record saying it is not. So a Finish runs that step again, and the
 * step must find its work already there and do nothing - the verdict's card
 * looks for its own card in the chat (`verdictCardPosted`), the execution reads
 * who the table already knows dead, a Level Up row reads the offers and the
 * advances it gave (level-up.mjs `runAdvancementBatch`'s `giving`). The runner
 * cannot know what a step's work was; it can only make the second run safe to
 * ask for.
 *
 * A LEAF. This file imports utils.mjs and nothing else, so any procedure takes
 * it statically without closing an import cycle (R161), and it holds no text:
 * each procedure hands `stepsReport` its own keys and labels (R1250, R1251).
 */

import { error, listOf, cardWarn } from "./utils.mjs";

/**
 * Run `steps` in order over `record` (the procedure's own: `{ done: [key], failed: [key], ... }`). Each step is
 * `{ key, run(context), ask?(context), keep?(context), needs?, after?(context) }`:
 * - a key in `record.done` is not run again (a Finish);
 * - `stop(context)` is asked before every step, and true makes this and every later step not run (`notRun`);
 * - a step whose `needs` is not done is not run;
 * - `ask(context)` false keeps the step (`kept`) and runs its `keep(context)` instead;
 * - `run(context)` answers a line (a string), several (an array), null or undefined (done, nothing to say), or false
 *   (failed); a throw is failed, logged with `label` and the key;
 * - `after(context)` runs once the step is done and its record saved (the verdict's execution after its card); its
 *   lines are collected, its throw logged and the step stays done.
 * `save(record, { key })` is awaited after every step that ran (done, failed or kept), and `save(record, { end: true })`
 * once at the end; a save that throws fails the step it followed - its work may have landed: the step reads it the
 * next time - and every later step is not run.
 *
 * Answers `{ done, kept, failed, notRun, lines, record }`: the keys of this run in each group, the lines in order, and
 * the record with `done` as it stands and `failed` this run's (a key done now leaves `failed`).
 */
export async function runSteps({ steps = [], record = {}, save = null, stop = null, context = {}, label = "procedure" } = {}) {
    let current = { ...record, done: [...(record?.done ?? [])], failed: [] };
    const result = { done: [], kept: [], failed: [], notRun: [], lines: [] };
    const collect = said => {
        for (const line of [said].flat()) if (typeof line === "string" && line) result.lines.push(line);
    };
    let stopped = false;
    for (const step of steps) {
        const key = step.key;
        if (current.done.includes(key)) continue;
        if (!stopped && stop) {
            try {
                stopped = Boolean(await stop(context));
            } catch (err) {
                error(`The ${label} could not ask whether to stop before its step "${key}"`, err);
                stopped = true;
            }
        }
        if (stopped || (step.needs && !current.done.includes(step.needs))) {
            result.notRun.push(key);
            continue;
        }
        let outcome = "done";
        try {
            if (step.ask && !(await step.ask(context))) {
                outcome = "kept";
                if (step.keep) collect(await step.keep(context));
            } else {
                const said = await step.run(context);
                if (said === false) outcome = "failed";
                else collect(said);
            }
        } catch (err) {
            error(`The ${label} stopped at its step "${key}"`, err);
            outcome = "failed";
        }
        if (outcome === "done") current = { ...current, done: [...current.done, key], failed: current.failed.filter(k => k !== key) };
        else if (outcome === "failed") current = { ...current, failed: [...current.failed, key] };
        try {
            if (save) await save(current, { key });
        } catch (err) {
            error(`The ${label} could not save its record after its step "${key}"`, err);
            if (outcome === "done") current = { ...current, done: current.done.filter(k => k !== key) };
            if (!current.failed.includes(key)) current = { ...current, failed: [...current.failed, key] };
            outcome = "failed";
            stopped = true;
        }
        result[outcome].push(key);
        if (outcome === "done" && step.after) {
            try {
                collect(await step.after(context));
            } catch (err) {
                error(`The ${label} could not finish what follows its step "${key}"`, err);
            }
        }
    }
    try {
        if (save) await save(current, { end: true });
    } catch (err) {
        error(`The ${label} could not save its record at its end`, err);
    }
    return { ...result, record: current };
}

/** The groups of a run (`runSteps`' answer) in the order a report says them. */
const REPORT_GROUPS = Object.freeze(["done", "kept", "failed", "notRun"]);

/**
 * The GMs' report of a run (`runSteps`' answer), one shape for every procedure: its `lines` first, then a sentence
 * per group that holds a step, in the fixed order done, kept, failed, notRun - `groups[name]` is a translation key, or
 * `{ key, list, data }` (the list's placeholder, "steps" by default, and the key's other values), and a group with no
 * key is not said - each naming its steps by `label(key)` in one list (`listOf`). Answers `{ lines, notes, content,
 * toast }`: the notes in order, the card's HTML (the lines a list, each note a paragraph, a failed or notRun one a
 * warning) and the toast, `{ level: "error", text }` with the failed and notRun notes when either holds a step, else
 * `{ level: "info", text: done }`, the procedure's done words as it says them (null when none). No text of its own.
 */
export function stepsReport(result, { lines = result?.lines ?? [], groups = {}, label = key => key, done = null } = {}) {
    const notes = [], warnings = [];
    for (const name of REPORT_GROUPS) {
        const keys = result?.[name] ?? [];
        const spec = typeof groups[name] === "string" ? { key: groups[name] } : groups[name];
        if (!keys.length || !spec?.key) continue;
        const note = game.i18n.format(spec.key, { ...(spec.data ?? {}), [spec.list ?? "steps"]: listOf(keys.map(label)) });
        notes.push(note);
        if (name === "failed" || name === "notRun") warnings.push(note);
    }
    const stoppedHere = Boolean(result?.failed?.length || result?.notRun?.length);
    const content = `${lines.length ? `<ul>${lines.map(line => `<li>${line}</li>`).join("")}</ul>` : ""}${
        notes.map(note => warnings.includes(note) ? cardWarn(note) : `<p>${note}</p>`).join("")}`;
    const toast = stoppedHere ? { level: "error", text: warnings.join(" ") } : { level: "info", text: done ?? null };
    return { lines: [...lines], notes, warnings, content, toast };
}
