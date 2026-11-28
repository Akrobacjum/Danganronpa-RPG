/**
 * A scenario on Forge: the runner (the road to 2.0, F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=... node audit/forge/run.mjs s1-session [s2-second-gm ...]
 *
 * Each scenario is a module in audit/forge/scenarios/ that exports
 *   meta = { id, title, roles: ["gm1", "gm2", "p1", ...], writes: true|false, triage: ["CALLS-01", ...] }
 *   async run(ctx)
 * and the runner logs `meta.roles` in (lib.mjs `openTable`, which refuses any world but the test world), hands the
 * scenario `ctx`, and writes audit/forge/out/<id>-<time>/report.json. NEVER RUN on Forge before its first run.
 *
 * ctx:
 *   c.<role>.eval(code, { timeout })   the code's body as an async function in that page; answers its return value
 *   c.<role>.page                       the Playwright page, for clicks and reads a scenario cannot do from code
 *   check(name, ok, details, { ids })    one assertion; `ids` names the triage items (docs/dev/v2/) it measures, so a
 *                                       baseline run's failure and the final check's pass are the same row
 *   note(name, details)                 something seen, no verdict
 *   phase(name)                         the label of the checks that follow
 *   settle(ms)                          wait
 *   shot(role, name, { clip })          a screenshot into the report's folder (a part of the page with `clip`); answers the image
 *   reload(role)                        F5, waiting for game.ready again
 *   offline(role, ms)                   the browser's network cut for `ms`, then back (context.setOffline)
 *   leave(role) / rejoin(role)          the account's browser closed / logged in again
 *   errors(role)                        `window.__errors` and missing i18n keys in that page so far
 *   until(role, code, { timeout, every }) poll the code's value in that page until truthy; answers it or null
 *   refuse(why)                         stop the scenario: the world is not one it can vouch for (its report keeps
 *                                       `refused`, its notes and checks so far; no "ran no check" failure)
 *
 * A check is a claim about the 2.0 behaviour the owner decided (the triage and docs/dev/v2/DECISIONS.md): on 1.2.129
 * a check of a known defect fails, and the same check passes when the fix is in. That is the before/after reading.
 *
 * Exit: 0 when every check passed; 1 on a failed check or a broken scenario; 2 on a refusal (lib.mjs's, which stops
 * the run at once, or a scenario's `refuse`, after which the next scenario named still runs; a failure elsewhere in
 * the run makes it 1).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { launch, openTable, outDir, config, login } from "./lib.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

function client(page) {
    return {
        page,
        eval: (code, { timeout = 60_000 } = {}) => Promise.race([
            page.evaluate(async body => {
                const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
                return await new AsyncFunction(body)();
            }, code),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`eval timed out after ${timeout} ms`)), timeout))
        ])
    };
}

async function runOne(file) {
    const scenario = await import(url.pathToFileURL(file).href);
    const meta = scenario.meta ?? {};
    const id = meta.id ?? path.basename(file, ".mjs");
    const dir = outDir(id);
    const report = { id, title: meta.title ?? null, triage: meta.triage ?? [], startedAt: new Date().toISOString(),
        checks: [], notes: [], failures: [], shots: [], phases: [] };
    const browser = await launch();
    let phaseName = "start";
    try {
        const roles = meta.roles ?? ["gm1"];
        const { pages, failures } = await openTable(browser, roles, { name: id });
        report.failures.push(...failures);
        const c = Object.fromEntries(Object.entries(pages).map(([r, p]) => [r, client(p)]));
        const ctx = {
            c, meta,
            check: (name, ok, details = "", { ids = [] } = {}) => report.checks.push({ phase: phaseName, name, ok: Boolean(ok), ids, details: String(details ?? "").slice(0, 3000) }),
            note: (name, details = "") => report.notes.push({ phase: phaseName, name, details: String(details ?? "").slice(0, 3000) }),
            phase: name => { phaseName = name; report.phases.push({ name, at: new Date().toISOString() }); },
            /* A scenario that finds the world in a state it cannot vouch for stops here, writing nothing more, and the
               run exits 2 as lib.mjs `refuse` does for a world that is not the test world - but with the report
               written, so its notes (the world as found) are kept (2.0 line T4, F3PC2-S1-STATE, 27.11.2026). */
            refuse: why => { const err = new Error(String(why)); err.refusal = true; throw err; },
            settle: (ms = 500) => new Promise(r => setTimeout(r, ms)),
            /* `clip` (a viewport rectangle) takes a part of the page, and the image comes back for a scenario that
               compares two (s7-look's fog-leak; 2.0 line T4, EXP-PL-04, 27.11.2026); null when it was not taken. */
            shot: async (role, name, { clip = null } = {}) => {
                const fileName = `${role}-${name}.png`.replace(/[^\w.-]+/g, "_");
                try {
                    const image = await c[role].page.screenshot({ path: path.join(dir, fileName), timeout: 120_000, ...(clip ? { clip } : {}) });
                    report.shots.push(fileName);
                    return image;
                } catch (err) { report.shots.push(`${fileName}: not taken - ${String(err.message).split("\n")[0]}`); return null; }
            },
            reload: async role => {
                const page = c[role].page;
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 180_000 });
            },
            offline: async (role, ms) => {
                const ctxB = c[role].page.context();
                await ctxB.setOffline(true);
                await new Promise(r => setTimeout(r, ms));
                await ctxB.setOffline(false);
            },
            leave: async role => { await c[role].page.context().close().catch(() => {}); delete c[role]; },
            rejoin: async role => { c[role] = client(await login(browser, config.base, config.users[role], { storage: config.light })); },
            errors: role => c[role].eval("return { errors: [...(window.__errors ?? [])], missingI18n: [...new Set(window.__missingI18n ?? [])] };"),
            until: async (role, code, { timeout = 60_000, every = 1000 } = {}) => {
                const t0 = Date.now();
                while (Date.now() - t0 < timeout) {
                    try { const v = await c[role].eval(code, { timeout: every * 10 }); if (v) return v; } catch { /* the page may be reloading */ }
                    await new Promise(r => setTimeout(r, every));
                }
                return null;
            }
        };
        await scenario.run(ctx);
        for (const [role, cl] of Object.entries(c)) {
            const e = await cl.eval("return { errors: [...(window.__errors ?? [])], missingI18n: [...new Set(window.__missingI18n ?? [])] };").catch(() => null);
            if (e) report.notes.push({ phase: "end", name: `${role}: errors and missing keys`, details: JSON.stringify(e).slice(0, 3000) });
        }
    } catch (err) {
        if (err?.refusal) report.refused = { phase: phaseName, why: String(err.message) };
        else report.failures.push(`the scenario broke in phase "${phaseName}": ${String(err.stack ?? err).split("\n").slice(0, 4).join(" / ")}`);
    } finally {
        await browser.close().catch(() => {});
    }
    report.finishedAt = new Date().toISOString();
    const failed = report.checks.filter(k => !k.ok);
    if (!report.checks.length && !report.refused) report.failures.push("the scenario ran no check");
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
    console.log(`${id}: ${report.checks.length - failed.length} of ${report.checks.length} checks passed; report in ${path.relative(process.cwd(), dir)}`);
    if (report.refused) console.log(`${id}: refused - ${report.refused.why}`);
    for (const k of failed) console.log(`  FAIL [${k.phase}] ${k.name}${k.ids.length ? ` (${k.ids.join(", ")})` : ""}`);
    for (const f of report.failures) console.log(`  - ${f}`);
    if (failed.length || report.failures.length) return false;
    return report.refused ? "refused" : true;
}

const names = process.argv.slice(2);
if (!names.length) { console.log("usage: node audit/forge/run.mjs <scenario> [...] (audit/forge/scenarios/)"); process.exit(2); }
let ok = true, refused = false;
for (const n of names) {
    const file = path.join(HERE, "scenarios", n.endsWith(".mjs") ? n : `${n}.mjs`);
    if (!fs.existsSync(file)) { console.log(`${n}: no such scenario (${path.relative(process.cwd(), file)})`); ok = false; continue; }
    const result = await runOne(file);
    if (result === "refused") refused = true;
    else ok = result && ok;
}
process.exit(!ok ? 1 : refused ? 2 : 0);
