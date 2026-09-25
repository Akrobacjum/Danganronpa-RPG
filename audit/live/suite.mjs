/**
 * The live parts: the suite's tier 2 in both themes, and the whole-world diff around them (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 * NEVER RUN against a real Foundry (audit/live/README.md). Called by foundry.mjs.
 *
 * live-stained-glass, live-monokuma-legacy: the GM's client setting
 * `danganronpa-rpg.theme` is set, the page reloads, and runTests({ tier: 2,
 * confirmed: game.world.id }) runs - the D25 confirmation a caller that cannot
 * answer the window gives. Its `text` is the evidence, verbatim, under the
 * header verify-gate.mjs reads. The three players are logged in and stay idle,
 * as at a table. The GM's theme is put back afterwards.
 *
 * live-world-diff: worldDump() (scripts/tests-kit.mjs, S17-04) taken around
 * each run - after the reload that set the theme and after the suite - plus
 * once at the start and once after the theme is put back, so that what a run
 * left behind and what the whole visit left behind are both seen, and a theme
 * change that is the runner's own is not counted against the suite. Each dump
 * is written as one JSON file per dumped path under audit/gate/.work/, and only
 * the paths that differ go into the evidence, never world content. A raw diff
 * of the world's LevelDB folders would differ after any write, even a perfect
 * restore - LevelDB appends and compacts - so the brief's "empty diff -rq" is
 * taken over these per-document dumps.
 */

import fs from "node:fs";
import path from "node:path";

const THEME = "danganronpa-rpg.theme";

async function dump(page) {
    return page.evaluate(async () => {
        const kit = await import("/modules/danganronpa-rpg/scripts/tests-kit.mjs");
        const map = await kit.worldDump();
        return [...map.entries()].map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]);
    });
}

function writeDump(dir, entries) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const [k, v] of entries) fs.writeFileSync(path.join(dir, `${encodeURIComponent(k)}.json`), v);
}

function differs(a, b) {
    const left = new Map(a), right = new Map(b);
    return [...new Set([...left.keys(), ...right.keys()])].filter(k => left.get(k) !== right.get(k)).sort();
}

export async function runLive({ repo, url: base, users, browser, parts, login, pageEnv, evidence, evidenceDir, commit }) {
    const out = [];
    const gm = await login(browser, base, users.gm);
    const players = [];
    for (const who of ["p1", "p2", "p3"]) players.push(await login(browser, base, users[who]));
    const work = path.join(repo, "audit", "gate", ".work");
    const setTheme = value => gm.evaluate(([key, v]) => game.settings.set(...key.split(/\.(.+)/, 2), v), [THEME, value]);
    const initial = await dump(gm);
    writeDump(path.join(work, "initial"), initial);
    const was = await gm.evaluate(key => game.settings.get(...key.split(/\.(.+)/, 2)), THEME);
    const changed = [];
    try {
        for (const p of parts.filter(p => p.theme)) {
            const startedAt = new Date().toISOString();
            await setTheme(p.theme);
            await gm.reload({ waitUntil: "domcontentloaded" });
            await gm.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 120_000 });
            const before = await dump(gm);
            writeDump(path.join(work, `${p.id}-before`), before);
            const t0 = Date.now();
            const r = await gm.evaluate(() => game.drpg.runTests({ tier: 2, confirmed: game.world.id }), null);
            const env = await pageEnv(gm);
            const header = [`drpg-evidence/1 ${p.id}`,
                `module ${env.module} | commit ${commit} | foundry ${env.foundry} | daggerheart ${env.systemVersion} | world ${env.world} | theme ${p.theme} | renderer ${env.renderer}`,
                `started ${startedAt} | finished ${new Date().toISOString()}`, "---"].join("\n");
            const ev = evidence(evidenceDir, repo, `${p.id}.txt`, `${header}\n${r?.text ?? "(runTests returned nothing)"}\n`);
            const after = await dump(gm);
            writeDump(path.join(work, `${p.id}-after`), after);
            changed.push(...differs(before, after).map(k => `${p.id}: ${k}`));
            out.push({ ...p, status: r && r.failed === 0 && !r.refused ? "passed" : "failed", ranAt: startedAt, ms: Date.now() - t0,
                summary: r ? { passed: r.passed, failed: r.failed, skipped: r.skipped } : null, env, evidence: [ev] });
        }
    } finally {
        await setTheme(was).catch(() => {});
    }
    const final = await dump(gm).catch(() => null);
    for (const page of [gm, ...players]) await page.context().close().catch(() => {});
    const diff = parts.find(p => p.id === "live-world-diff");
    if (diff) {
        if (final === null) return [...out, { ...diff, status: "error", why: "the last dump failed, so the visit's diff is unknown", evidence: [] }];
        writeDump(path.join(work, "final"), final);
        changed.push(...differs(initial, final).map(k => `the whole visit, the theme put back: ${k}`));
        const env = out[0]?.env ?? null;
        const text = JSON.stringify({ evidence: "drpg-evidence/1", part: diff.id, env, body: { dumped: initial.length, differs: changed } }, null, 2);
        out.push({ ...diff, status: changed.length ? "failed" : "passed", env, evidence: [evidence(evidenceDir, repo, `${diff.id}.json`, text)] });
    }
    return out;
}
