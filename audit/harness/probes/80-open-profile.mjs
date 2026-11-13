/**
 * Probe: where a window's first open spends what its second does not (perf-open line, 13.11.2026).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/80-open-profile.mjs                       (from audit/harness)
 *     DRPG_OPEN_ONLY=rooms-bedrooms,students node cluster.mjs probes/80-open-profile.mjs
 *
 * Probe 09 times a window's opens; this one asks V8 why the first costs more. Each window of probe 08's WINDOWS named
 * (by default the ones probe 09 read the largest first-open premium on) is opened twice on its client, 12 s after the
 * boot (as 09), each open under V8's sampling profiler in that client's own process (`node:inspector`, a sample every
 * 100 us), from the opener's call to the window's first `renderApplicationV2` and 150 ms after. Each profile's self
 * time is summed by function (name, file, line); the rows kept are the functions whose self time in the first open
 * exceeds the second's by the most, with V8's own buckets apart: `(program)` (compiling and the engine's own work,
 * which a function's first call pays), `(garbage collector)`. WHAT IT IS: the module's code on jsdom in Node, whose V8
 * compiles as a browser's does and whose DOM is far slower than a browser's; a premium found here in the module's own
 * functions is in the module's code, a premium in jsdom's is the harness's. It asserts nothing (probes/README.md).
 */
import { WINDOWS } from "./08-capture-windows.mjs";

export const layers = ["probe"];

const DEFAULT = ["rooms-bedrooms", "students", "season-checklist", "action-observe", "sound-player", "gm-panel", "look-gm", "projects", "investigation"];
const ONLY = (process.env.DRPG_OPEN_ONLY ?? "").split(",").map(s => s.trim()).filter(Boolean);
const SETTLE_MS = Number(process.env.DRPG_OPEN_SETTLE_MS ?? 12000) || 0;
const TOP = Number(process.env.DRPG_PROFILE_TOP ?? 12) || 12;

const profiled = (repoUrl, w) => `
    const inspector = await import("node:inspector");
    const session = new inspector.Session();
    session.connect();
    const post = (method, params = {}) => new Promise((res, rej) => session.post(method, params, (err, out) => (err ? rej(err) : res(out))));
    await post("Profiler.enable");
    await post("Profiler.setSamplingInterval", { interval: 100 });
    const repoUrl = "${repoUrl}";
    ${w.before ?? ""}
    const rounds = [];
    for (let round = 0; round < 2; round++) {
        const before = new Set(foundry.applications.instances.keys());
        const keep = { windows: globalThis.__dialogWindows, answers: [...globalThis.__dialogAnswers] };
        globalThis.__dialogWindows = true;
        globalThis.__dialogAnswers.length = 0;
        let rendered = null, threw = null;
        const hook = Hooks.on("renderApplicationV2", app => { if (rendered === null && !before.has(app.id)) rendered = performance.now(); });
        await post("Profiler.start");
        const t0 = performance.now();
        try {
            const m = await import("${repoUrl}/scripts/${w.module}");
            Promise.resolve(${w.call}).catch(err => { threw = String(err?.message ?? err).slice(0, 200); });
        } catch (err) { threw = String(err?.message ?? err).slice(0, 200); }
        for (let i = 0; i < 3000 && rendered === null && !threw; i++) await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 150));
        const { profile } = await post("Profiler.stop");
        Hooks.off("renderApplicationV2", hook);
        const ms = rendered === null ? null : +(rendered - t0).toFixed(1);
        // self time per node, then per function
        const self = new Map();
        const byId = new Map(profile.nodes.map(n => [n.id, n]));
        for (let i = 0; i < profile.samples.length; i++) {
            const id = profile.samples[i];
            self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
        }
        const fns = {};
        for (const [id, t] of self) {
            const f = byId.get(id).callFrame;
            const file = (f.url || "").split("/").pop() || "";
            const key = file ? (f.functionName || "(anonymous)") + " " + file + ":" + (f.lineNumber + 1) : f.functionName || "(root)";
            fns[key] = (fns[key] ?? 0) + t;
        }
        // and charged to the nearest function of the module's own above it (scripts/), with the harness's own (lib/,
        // the shim) named as such: which of the module's functions asked jsdom for the time
        const parent = new Map();
        for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
        const owner = new Map();
        const ownerOf = id => {
            if (owner.has(id)) return owner.get(id);
            let at = id, out = "(no module frame)";
            while (at !== undefined) {
                const f = byId.get(at).callFrame;
                if ((f.url || "").includes("/scripts/") && (f.url || "").endsWith(".mjs")) { out = (f.functionName || "(anonymous)") + " " + f.url.split("/").pop() + ":" + (f.lineNumber + 1); break; }
                at = parent.get(at);
            }
            owner.set(id, out);
            return out;
        };
        const mods = {};
        for (const [id, t] of self) { const k = ownerOf(id); mods[k] = (mods[k] ?? 0) + t; }
        rounds.push({ ms, threw, fns, mods });
        for (const a of [...foundry.applications.instances.values()]) if (!before.has(a.id)) { try { await a.close(); } catch {} }
        await new Promise(r => setTimeout(r, 150));
        globalThis.__dialogWindows = keep.windows;
        globalThis.__dialogAnswers.length = 0; globalThis.__dialogAnswers.push(...keep.answers);
    }
    await post("Profiler.disable");
    session.disconnect();
    const keys = new Set([...Object.keys(rounds[0].fns), ...Object.keys(rounds[1].fns)]);
    const diff = [...keys].map(k => [k, +((rounds[0].fns[k] ?? 0) - (rounds[1].fns[k] ?? 0)).toFixed(2), +(rounds[0].fns[k] ?? 0).toFixed(2), +(rounds[1].fns[k] ?? 0).toFixed(2)])
        .sort((a, b) => b[1] - a[1]);
    const mkeys = new Set([...Object.keys(rounds[0].mods), ...Object.keys(rounds[1].mods)]);
    const mdiff = [...mkeys].map(k => [k, +((rounds[0].mods[k] ?? 0) - (rounds[1].mods[k] ?? 0)).toFixed(2), +(rounds[0].mods[k] ?? 0).toFixed(2), +(rounds[1].mods[k] ?? 0).toFixed(2)])
        .sort((a, b) => b[1] - a[1]);
    const sum = r => +Object.values(r.fns).reduce((n, v) => n + v, 0).toFixed(1);
    return { ms: rounds.map(r => r.ms), sampled: rounds.map(sum), threw: rounds.map(r => r.threw), top: diff.slice(0, ${TOP}), modules: mdiff.slice(0, ${TOP}),
        buckets: ["(program)", "(garbage collector)", "(idle)"].map(k => [k, ...rounds.map(r => +(r.fns[k] ?? 0).toFixed(1))]) };
`;

export async function run({ gm, p1, note, settle, repoUrl }) {
    const clients = { gm, p1 };
    const wanted = ONLY.length ? ONLY : DEFAULT;
    const list = WINDOWS.filter(w => wanted.includes(w.id) && !w.after);
    await settle(SETTLE_MS);
    const rows = [];
    for (const w of list) {
        let got;
        try { got = await clients[w.client ?? "gm"].eval(profiled(repoUrl, w), { timeout: 60000 }); } catch (err) { got = { error: String(err?.message ?? err).slice(0, 300) }; }
        rows.push({ id: w.id, ...got });
        if (got.error) { note(w.id, `profile failed: ${got.error}`); continue; }
        note(w.id, `opens ${got.ms.join(" / ")} ms; sampled ${got.sampled.join(" / ")} ms; ${got.buckets.map(b => `${b[0]} ${b[1]} / ${b[2]}`).join(", ")}`);
        for (const [k, d, a, b] of got.top.slice(0, 8)) note(`  ${w.id}`, `+${d} ms (${a} -> ${b}) ${k}`);
        for (const [k, d, a, b] of got.modules.slice(0, 5)) note(`  ${w.id} by module`, `+${d} ms (${a} -> ${b}) ${k}`);
    }
    return { rows };
}
