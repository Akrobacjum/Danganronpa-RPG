/**
 * The work one event costs every browser (E88 C0, 27.10.2026; E88-03).
 *
 * The owner's live session of 27.10 on 1.2.85: the table lagged with several players, with many Remnants, and for
 * some players standing in a room with everything else under fog. Every suspect E88's spec names was found by
 * reading the code. This scenario counts, on all five browsers at once (the GM and four players), what the module
 * does for one event at a time, through the counters perf-counters.mjs keeps (`game.drpg.counters()`): the
 * `refreshToken` runs of each listener, the ring paints drawn and skipped, the visibility passes and the tokens
 * they flag, the next-frame walks, the colour reads, the fog's repaints, the sheets rendered, the HUD and the
 * status strip, the curtain's pulse frames - and the filters left on the canvas after it.
 *
 * The table: 4 players (p1-p3 drive Aiko, Botan and Chie; p4 drives a student made here), 16 tokens on the scene on
 * screen (the seed's five, eleven students made here, none in Dorm A, where Aiko stands alone) and 30 Remnants
 * placed by the module's own `placeRemnant` across the six rooms. The events, each read on every browser from a
 * snapshot taken just before it to one taken 1.5 s after (the sync, the next frame's refresh and its reassert):
 *   rest       nothing at all, the same wait: the background every other row sits on (the pulse runs on its own)
 *   other move p2 steps Botan inside the Cafeteria: another player's settled move on four browsers, an own on p2's
 *   own move   p1 steps Aiko inside Dorm A
 *   despair    the GM's Despair pool written (`setDespair`), SYNC.despair on every browser
 *   clock      the time of day moved and put back (`setTimeOfDay`, then `setClock`, as 13 does)
 *   ledger     a room discovered for Aiko (fog.mjs `setDiscovery`), the discovery ledger's write
 * Under Stained Glass and again under Monokuma Legacy (the theme is each browser's own setting, put back after).
 * No sheet is counted rendered: the harness's actor sheet is a stand-in that registers in neither `ui.windows` nor
 * `foundry.applications.instances` (read 27.10.2026), so `clock.refreshSheets.rendered` is 0 here by construction;
 * the sheets a write renders are E37's 81-render-budget's, on real sheets.
 *
 * WHAT IS CHECKED, AND WHAT IS ONLY RECORDED. The checks hold that the table was laid as asked and that each
 * event was counted on the browsers it reaches - they are true at Base and stay true through E88's optimisations.
 * The numbers themselves are recorded, not judged: the results file's evidence holds every row, and C1-C5 each
 * state their before and after from it. The canvas here is the harness's (client-entry.mjs: a refresh a token a
 * frame, one refresh for a move where v14 slides it; LIVE-E88-05), so a count is the module's work on that model,
 * never a frame time: a table measures that (`game.drpg.fps()`, LIVE-E88-01).
 */
export const layers = ["ci"];
/* Measured alone on 27.10.2026 (E88 C0, under the harness lock): 37.5 s from the cluster's start to its end,
   by run-all's line, and 38.3 s and 41.9 s the next two. 126 s is three times the slowest. */
export const timeoutMs = 126000;
export const accounts = [{ who: "p4", id: "USERP4S860000000", name: "Player Four", role: 1, character: null, color: "#2a627f" }];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const MOVE = `{ teleport: true, movementAction: "displace", animate: false }`;
/* Inside the six seeded rooms (lib/seed.mjs): Dorm A 200-800 x 200-800, Cafeteria 1200-2000 x 200-800, Dorm B
   200-800 x 1200-1800, Gym 1200-2000 x 1200-1800, Hall 2200-2800 x 200-800, Storage 2200-2800 x 1200-1800. */
const ROOMS = [[1200, 200, 800, 600], [200, 1200, 600, 600], [1200, 1200, 800, 600], [2200, 200, 600, 600], [2200, 1200, 600, 600], [200, 200, 600, 600]];

export async function run({ gm, p1, p2, p3, p4, check, note, phase, settle, IDS, repoUrl }) {
    const clients = { gm, p1, p2, p3, p4 };
    const ACADEMY = `const academy = game.scenes.get("${IDS.scene}");`;

    /* ------------------------------ the table ------------------------------ */
    phase("the table: 4 players, 16 tokens, 30 Remnants");
    const set = await gm.eval(`${ACADEMY}
        const { placeRemnant } = await import("${repoUrl}/scripts/remnants.mjs");
        const S = globalThis.__s86 = { actors: [], tokens: [], traces: [] };
        const rooms = ${J(ROOMS)};
        for (let k = 1; k <= 11; k++) {
            const ownership = k === 1 ? { default: 0, USERP4S860000000: 3 } : { default: 0 };
            const actor = await Actor.create({ name: "S86 Student " + k, type: "character", ownership });
            S.actors.push(actor.id);
            const [x, y, w, h] = rooms[(k - 1) % 5];
            const [t] = await academy.createEmbeddedDocuments("Token", [{ name: "S86 " + k, actorId: actor.id, actorLink: true,
                x: x + 100 + ((k * 130) % (w - 200)), y: y + 100 + ((k * 70) % (h - 200)), width: 1, height: 1, hidden: false,
                texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 }]);
            S.tokens.push(t.id);
        }
        for (let k = 0; k < 30; k++) {
            const [x, y, w, h] = rooms[k % 6];
            const trace = await placeRemnant({ type: "prep", visibility: "evident", x: x + 50 + ((k * 90) % (w - 100)), y: y + 50 + ((k * 50) % (h - 100)),
                scene: academy, note: "S86 trace " + k });
            if (trace?.id) S.traces.push(trace.id);
        }
        return { tokens: academy.tokens.filter(t => !t.getFlag("${MOD}", "isRemnant")).length,
            remnants: academy.tokens.filter(t => t.getFlag("${MOD}", "isRemnant")).length,
            players: game.users.filter(u => !u.isGM && u.active).length };`, { timeout: 120000 });
    check("the table is laid: 4 players connected, 16 tokens and 30 Remnants on the scene on screen",
        set?.players === 4 && set?.tokens === 16 && set?.remnants === 30, J(set));
    await settle(2000);

    /* ------------------------------ one event, counted everywhere ------------------------------ */
    const SNAP = `const c = await game.drpg.counters(); globalThis.__s86before = c.counts; return true;`;
    const READ = `const c = await game.drpg.counters(); const before = globalThis.__s86before ?? {};
        const moved = {}; for (const [k, v] of Object.entries(c.counts)) { const d = v - (before[k] ?? 0); if (d) moved[k] = d; }
        delete globalThis.__s86before;
        return { moved, live: { filters: c.live.filters, blurs: c.live.blurs, masks: c.live.masks, byName: c.live.byName },
            glass: document.body.classList.contains("drpg-theme-stained-glass") };`;
    const rows = {};
    const measure = async (theme, event, act) => {
        await Promise.all(Object.values(clients).map(c => c.eval(SNAP)));
        await act();
        await settle(1500);
        const read = {};
        for (const [who, c] of Object.entries(clients)) read[who] = await c.eval(READ);
        (rows[theme] ??= {})[event] = read;
        note(`${theme} ${event}`, Object.entries(read).map(([who, r]) => `${who}: ${J(r.moved)} live ${r.live.filters}`).join(" | "));
        return read;
    };
    // Beyond the background: a counter the rest row did not move on that browser, or one it moved by half as much again.
    const beyondRest = (theme, read, who) => Object.entries(read[who]?.moved ?? {}).some(([k, v]) => {
        const rest = rows[theme]?.rest?.[who]?.moved?.[k] ?? 0;
        return rest ? v > rest * 1.5 + 1 : v > 0;
    });

    const at = await gm.eval(`${ACADEMY} return Object.fromEntries(["TOKAIKO000000000", "TOKBOTAN00000000"].map(id => [id, { x: academy.tokens.get(id).x, y: academy.tokens.get(id).y }]));`);
    const despair = await gm.eval(`return game.drpg.getDespair(game.user.id);`);
    const ledger = await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs"); return F.discoveredFor("${IDS.scene}", "${IDS.aiko}");`);
    const themes = {};
    for (const [who, c] of Object.entries(clients)) themes[who] = await c.eval(`return game.settings.get("${MOD}", "theme");`);

    for (const theme of ["stainedGlass", "monokumaLegacy"]) {
        phase(`the events under ${theme}`);
        await Promise.all(Object.values(clients).map(c => c.eval(`await game.settings.set("${MOD}", "theme", "${theme}"); return true;`)));
        await settle(1500);
        let step = theme === "stainedGlass" ? 100 : -100;
        await measure(theme, "rest", async () => {});
        const other = await measure(theme, "other move", () => p2.eval(`${ACADEMY}
            const t = academy.tokens.get("TOKBOTAN00000000"); await t.update({ x: t.x + ${step} }, ${MOVE}); return true;`));
        check(`${theme}: another player's settled move is counted on every browser, the moved token refreshed on each`,
            Object.keys(clients).every(who => beyondRest(theme, other, who) && (other[who].moved["refreshToken.visibility"] ?? 0) >= 1),
            J(Object.fromEntries(Object.entries(other).map(([who, r]) => [who, r.moved]))));
        const own = await measure(theme, "own move", () => p1.eval(`${ACADEMY}
            const t = academy.tokens.get("TOKAIKO000000000"); await t.update({ x: t.x + ${step} }, ${MOVE}); return true;`));
        check(`${theme}: an own move is counted on every browser`,
            Object.keys(clients).every(who => beyondRest(theme, own, who)), J(Object.fromEntries(Object.entries(own).map(([who, r]) => [who, r.moved]))));
        const pool = await measure(theme, "despair", () => gm.eval(`await game.drpg.setDespair(game.user.id, ${Number(despair) === 3 ? 4 : 3}); return true;`));
        check(`${theme}: a Despair write is counted on every browser`,
            Object.keys(clients).every(who => beyondRest(theme, pool, who)), J(Object.fromEntries(Object.entries(pool).map(([who, r]) => [who, r.moved]))));
        await gm.eval(`await game.drpg.setDespair(game.user.id, ${J(despair)}); return true;`);
        await settle(800);
        const clock = await measure(theme, "clock", () => gm.eval(`
            const C = await import("${repoUrl}/scripts/clock.mjs");
            const { TIMES_OF_DAY } = await import("${repoUrl}/scripts/config.mjs");
            const before = C.getClock();
            globalThis.__s86clock = { timeOfDay: before.timeOfDay, timeOfDayStartedAt: before.timeOfDayStartedAt ?? null };
            await C.setTimeOfDay(TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(before.timeOfDay) + 1) % TIMES_OF_DAY.length], { resetSearchTokens: false });
            return true;`, { timeout: 60000 }));
        check(`${theme}: a move of the clock is counted on every browser`,
            Object.keys(clients).every(who => beyondRest(theme, clock, who)), J(Object.fromEntries(Object.entries(clock).map(([who, r]) => [who, r.moved]))));
        await gm.eval(`const C = await import("${repoUrl}/scripts/clock.mjs"); await C.setClock(globalThis.__s86clock); delete globalThis.__s86clock; return true;`, { timeout: 60000 });
        await settle(1200);
        const found = await measure(theme, "ledger", () => gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
            await F.setDiscovery(academy, { actorId: "${IDS.aiko}", rooms: [...${J(ledger)}, "Gym"], value: true }); return true;`));
        check(`${theme}: a discovery ledger write is counted on the GM's browser and on Aiko's player's`,
            ["gm", "p1"].every(who => beyondRest(theme, found, who)), J({ gm: found.gm.moved, p1: found.p1.moved }));
        await gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
            await F.setDiscovery(academy, { actorId: "${IDS.aiko}", rooms: ${J(ledger)}, value: ${ledger.length > 0} }); return true;`);
        await settle(800);
    }

    /* ------------------------------ restore ------------------------------ */
    await Promise.all(Object.entries(clients).map(([who, c]) => c.eval(`await game.settings.set("${MOD}", "theme", ${J(themes[who])}); return true;`)));
    await gm.eval(`${ACADEMY} const { dropRemnantSecret } = await import("${repoUrl}/scripts/remnants.mjs");
        const S = globalThis.__s86;
        for (const id of S.traces) { const t = academy.tokens.get(id); if (t) { try { await dropRemnantSecret(t); } catch {} await t.delete(); } }
        if (S.tokens.length) await academy.deleteEmbeddedDocuments("Token", S.tokens.filter(id => academy.tokens.get(id)));
        for (const id of S.actors) await game.actors.get(id)?.delete();
        for (const [id, { x, y }] of Object.entries(${J(at)})) await academy.tokens.get(id).update({ x, y }, ${MOVE});
        delete globalThis.__s86; return true;`, { timeout: 120000 });
    await settle(1000);
    return { rows };
}
