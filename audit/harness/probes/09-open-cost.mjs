/**
 * Probe: what a window costs the first time it opens and the second (perf-open line, 12.11.2026).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/09-open-cost.mjs                (from audit/harness)
 *     DRPG_OPEN_ONLY=gm-panel,sound node cluster.mjs probes/09-open-cost.mjs
 *
 * Each window of probe 08's WINDOWS that needs no seed taken away after it is opened three times on its client, closed unanswered between,
 * and timed from the opener's call to the first `renderApplicationV2` of an application that was not there before
 * (`performance.now()` on that client; the hook is the harness's, the same Foundry hook every module window takes).
 * The three times are kept per window, with the first open's share of the three. WHAT THE NUMBER IS: the module's work on
 * jsdom - building the HTML, the dynamic `import()` of a file not yet loaded, the render hooks, awaits - and NOT a frame
 * time: jsdom lays nothing out, paints nothing, fetches no font, no image and decodes no sound. A first open that is slow
 * here is slow for a reason in the module's own code; a first open that is slow only at a table is slow for a reason
 * this probe cannot see. The first window is opened DRPG_OPEN_SETTLE_MS (12 s) after the boot, as a table's first click
 * comes some seconds after ready. It asserts nothing (probes/README.md).
 */
import { WINDOWS } from "./08-capture-windows.mjs";

export const layers = ["probe"];

const ONLY = (process.env.DRPG_OPEN_ONLY ?? "").split(",").map(s => s.trim()).filter(Boolean);
const ROUNDS = Number(process.env.DRPG_OPEN_ROUNDS ?? 3) || 3;
const SETTLE_MS = Number(process.env.DRPG_OPEN_SETTLE_MS ?? 12000) || 0;

const timed = (repoUrl, w) => `
    const before = new Set(foundry.applications.instances.keys());
    const keep = { windows: globalThis.__dialogWindows, answers: [...globalThis.__dialogAnswers] };
    globalThis.__dialogWindows = true;
    globalThis.__dialogAnswers.length = 0;
    let rendered = null, threw = null, settled = null;
    const hook = Hooks.on("renderApplicationV2", app => { if (rendered === null && !before.has(app.id)) rendered = performance.now(); });
    const repoUrl = "${repoUrl}";
    ${w.before ?? ""}
    const t0 = performance.now();
    let imported = null;
    try {
        const m = await import("${repoUrl}/scripts/${w.module}");
        imported = performance.now() - t0;
        Promise.resolve(${w.call}).then(() => { settled = performance.now(); }, err => { threw = String(err?.message ?? err).slice(0, 200); });
    } catch (err) { threw = String(err?.message ?? err).slice(0, 200); }
    for (let i = 0; i < 3000 && rendered === null && !threw; i++) await new Promise(r => setTimeout(r, 1));
    Hooks.off("renderApplicationV2", hook);
    const out = { ms: rendered === null ? null : +(rendered - t0).toFixed(1), importMs: imported === null ? null : +imported.toFixed(1), threw };
    await new Promise(r => setTimeout(r, 100));
    for (const a of [...foundry.applications.instances.values()]) if (!before.has(a.id)) { try { await a.close(); } catch {} }
    await new Promise(r => setTimeout(r, 100));
    globalThis.__dialogWindows = keep.windows;
    globalThis.__dialogAnswers.length = 0; globalThis.__dialogAnswers.push(...keep.answers);
    return out;
`;

export async function run({ gm, p1, note, settle, repoUrl }) {
    const clients = { gm, p1 };
    /* A row whose `before` builds nothing it must take away (no `after`: the Give windows' student; the notice history's
       250 notices in p1's own browser are left out: three opens would read 250, 500 and 750) is opened too; a seeded row is 08's. */
    const list = WINDOWS.filter(w => !w.after && w.id !== "notices-player-250" && !w.press && !w.open && !w.click && (!ONLY.length || ONLY.includes(w.id)));
    /* As a table is used: the first click comes some seconds after ready, by when open-cost.mjs has warmed what it warms
       (it starts 4 s after ready). */
    await settle(SETTLE_MS);
    const rows = [];
    for (const w of list) {
        const client = clients[w.client ?? "gm"];
        const times = [];
        for (let i = 0; i < ROUNDS; i++) {
            let got;
            try { got = await client.eval(timed(repoUrl, w), { timeout: 30000 }); } catch (err) { got = { ms: null, threw: String(err?.message ?? err).slice(0, 200) }; }
            times.push(got);
        }
        const ms = times.map(t => t.ms);
        rows.push({ id: w.id, client: w.client ?? "gm", ms, importMs: times.map(t => t.importMs), threw: times.find(t => t.threw)?.threw ?? null });
        note(w.id, `${ms.join(" / ")} ms (import ${times.map(t => t.importMs).join(" / ")})${times.find(t => t.threw) ? `; threw ${times.find(t => t.threw).threw}` : ""}`);
    }
    /* The roll road's `import()`s (the dh-212 line's a5/b5/b10: action-pipeline.mjs, roll-draw.mjs, bridge-guards.mjs and
       the other roll files), each timed on its first call on p1 and on the GM. A file already in the module map answers
       from it; one that is not is fetched (from disk here, from the server at a table). */
    const ROLL_IMPORTS = ["call-effects", "calls", "cleanup", "despair", "forced-roll", "frisk", "gm-bridge", "gm-stores", "handover", "live",
        "monocub", "monokuma", "movement", "murder", "notice-history", "passages-gm", "private-rolls", "projects", "remnants", "reroll",
        "resource-guard", "roll-dialog", "roll-draw", "secret", "settings", "sheet-audit", "trait-ruling", "traps", "use-items", "vault"];
    const rollImports = {};
    for (const who of ["p1", "gm"]) {
        rollImports[who] = await clients[who].eval(`const out = {};
            for (const f of ${JSON.stringify(ROLL_IMPORTS)}) { const t = performance.now(); await import("${repoUrl}/scripts/" + f + ".mjs"); out[f] = +(performance.now() - t).toFixed(2); }
            return out;`, { timeout: 30000 });
        const slow = Object.entries(rollImports[who]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, ms]) => `${f} ${ms}`).join(", ");
        note(`roll road imports on ${who}`, `${ROLL_IMPORTS.length} files, the slowest three: ${slow} ms`);
    }
    return { rounds: ROUNDS, rows, rollImports };
}
