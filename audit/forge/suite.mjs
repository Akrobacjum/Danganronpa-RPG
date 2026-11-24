/**
 * The module's own suite on Forge, the tiers that only read, and the world's inventory (the road to 2.0, F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=... node audit/forge/suite.mjs
 *
 * GM1 and three players log in (the local gate's shape, audit/live/suite.mjs; DRPG_ROLES=gm1 for GM1 alone); on GM1 it runs
 * `game.drpg.runTests({ tier: 1 })` - tiers 0 and 1, which read and never write (scripts/tests.mjs: the default since
 * tier 2 opened incidents in a table's world) - then `game.drpg.diagnose({ show: false })` and a read of the world: its
 * scenes, rooms and tokens, the actors and their roles, the clock, the incident, and the settings scenarios lean on.
 * Writes nothing to the world. NEVER RUN before its first Forge run; what it assumes about the page is marked.
 *
 * Exit: 0 when the suite ran with no failure; 1 otherwise; 2 on a refusal (lib.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import { launch, openTable, outDir } from "./lib.mjs";

const dir = outDir("suite");
const browser = await launch();
const report = { startedAt: new Date().toISOString(), failures: [] };
try {
    const { pages, failures } = await openTable(browser, (process.env.DRPG_ROLES || "gm1,p1,p2,p3").split(","), { name: "forge suite" });
    report.failures.push(...failures);
    const gm = pages.gm1;
    if (!gm) throw new Error("GM1 did not log in");
    await new Promise(r => setTimeout(r, 20_000));
    /* The first Forge run (24.11.2026) lost the suite to "Execution context was destroyed": GM1's page navigated while
       runTests ran. The suite now starts in the page and keeps its result on `window`, the runner polls for it, and every
       navigation of every page is recorded with its time and address, so the next run says what reloaded and when. */
    report.navigations = [];
    for (const [role, page] of Object.entries(pages)) {
        page.on("framenavigated", f => { if (f === page.mainFrame()) report.navigations.push({ role, at: new Date().toISOString(), url: f.url() }); });
    }
    const t0 = Date.now();
    await gm.evaluate(() => {
        window.__forgeSuite = { running: true };
        game.drpg.runTests({ tier: 1 }).then(r => {
            window.__forgeSuite = r && { passed: r.passed, failed: r.failed, skipped: r.skipped, red: r.red, refused: r.refused ?? null, text: r.text ?? null,
                notPassed: (r.results ?? []).filter(x => x.outcome !== "pass").map(x => ({ tier: x.tier, name: x.name, outcome: x.outcome, message: String(x.message ?? "").slice(0, 600) })) };
        }, e => { window.__forgeSuite = { threw: String(e?.stack ?? e) }; });
    });
    let suite = null;
    while (Date.now() - t0 < 40 * 60_000) {
        await new Promise(r => setTimeout(r, 5000));
        let got;
        try { got = await gm.evaluate(() => window.__forgeSuite ?? { lost: true }); }
        catch { continue; }
        if (got.lost) { report.failures.push("suite: GM1's page reloaded before the suite finished (navigations below)"); break; }
        if (!got.running) { suite = got; break; }
    }
    report.suite = suite && { ...suite, ms: Date.now() - t0 };
    if (!suite || suite.failed || suite.refused || suite.threw) report.failures.push(`suite: ${!suite ? "no result" : suite.threw ? `threw ${suite.threw.slice(0, 200)}` : `${suite.failed} failed${suite.refused ? `, refused ${suite.refused}` : ""}`}`);
    report.diagnose = await gm.evaluate(async () => { try { return await game.drpg.diagnose({ show: false }); } catch (e) { return `diagnose threw: ${e.message}`; } });
    /* UNMEASURED on v14: `scene.regions`, a token's `actor`, the module's role flags; read defensively. */
    report.inventory = await gm.evaluate(() => {
        const safe = f => { try { return f(); } catch (e) { return `threw: ${e.message}`; } };
        return {
            activeScene: game.scenes.active?.name ?? null,
            scenes: game.scenes.map(s => ({ name: s.name, active: s.active, regions: s.regions?.size ?? null,
                tokens: s.tokens.map(t => t.name), levels: safe(() => s.levels?.size ?? null) })),
            actors: game.actors.map(a => ({ name: a.name, type: a.type, owners: game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER")).map(u => u.name),
                flags: Object.keys(a.flags?.["danganronpa-rpg"] ?? {}) })),
            users: game.users.map(u => ({ name: u.name, role: u.role, character: u.character?.name ?? null })),
            clock: safe(() => game.settings.get("danganronpa-rpg", "clock")),
            murderActive: safe(() => game.settings.get("danganronpa-rpg", "murderState")?.active ?? null),
            voiceEnabled: safe(() => game.settings.get("danganronpa-rpg", "voiceEnabled")),
            paused: game.paused
        };
    });
} catch (err) {
    report.failures.push(`the runner broke: ${String(err.stack ?? err).split("\n").slice(0, 3).join(" / ")}`);
} finally {
    await browser.close().catch(() => {});
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
const s = report.suite;
console.log(`forge suite: ${s ? `${s.passed} passed, ${s.failed} failed, ${s.skipped} skipped${s.red ? `, ${s.red} red` : ""} in ${Math.round(s.ms / 1000)} s` : "no suite result"}; report in ${path.relative(process.cwd(), dir)}`);
for (const f of report.failures) console.log(`  - ${f}`);
process.exit(report.failures.length ? 1 : 0);
