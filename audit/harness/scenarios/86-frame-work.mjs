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
 * The harness's actor sheet is a stand-in that registers in neither `ui.windows` nor `foundry.applications.instances`
 * (read 27.10.2026), so `clock.refreshSheets.rendered` counts only the stand-ins E88 C4 opens for the Despair write
 * (below); the sheets a write renders on real sheets are E37's 81-render-budget's.
 *
 * WHAT IS CHECKED, AND WHAT IS ONLY RECORDED. The checks hold that the table was laid as asked and that each
 * event was counted on the browsers it reaches - they are true at Base and stay true through E88's optimisations.
 * The numbers themselves are recorded, not judged: the results file's evidence holds every row, and C1-C5 each
 * state their before and after from it. The canvas here is the harness's (client-entry.mjs: a refresh a token a
 * frame, one refresh for a move where v14 slides it; LIVE-E88-05), so a count is the module's work on that model,
 * never a frame time: a table measures that (`game.drpg.fps()`, LIVE-E88-01).
 *
 * E88 C1 (27.10.2026; E88-05): the seams' light drawn once. With no renderer here every halo in the rows above stays
 * on its live filter, as at C0. A last part hands the GM's and p1's browsers a stand-in renderer that counts renders
 * and draws nothing, and checks that at rest no ring carries a live blur, that the 30 Remnants wear one texture and
 * the students one, that a clock move draws only the students' light again, and that the outline of the room Aiko
 * stands in shows its light from a texture of its own, drawn once more when it is struck again.
 *
 * E88 C2 (27.10.2026; E88-06, E88-07): one move, one refresh. In each theme's events, another player's settled move
 * asks no whole visibility pass on the browsers that do not own the token - its own refresh alone in each listener,
 * the next frame's walk of it alone, no other ring drawn again - and an own move asks the whole pass on the mover's
 * browser and draws no ring whose frame did not change. Two more events: the GM moves Botan into Dorm A, where Aiko
 * stands alone ("into my room": he comes onto p1's screen by his own refresh), and back out ("out of my room"). After
 * every move each browser's every token is checked against a whole pass run there and then: none shown or hidden
 * otherwise (E37's risk sentence: a narrowed pass never leaves another player's hidden token visible). State, not only
 * counts.
 *
 * E88 fix G4 (27.10.2026; findings E88-TEST-1, E88R-03): the state check run on the roads that still run the whole
 * pass under C2's narrowed walk - an Eclipse starting and ending, a Truth Bullet given, a Mastermind's lair - each with
 * another player's step after it, and the backstop the narrowing took away: a `visible` written outside a token's own
 * refresh is put right by the once-a-second sweep (visibility.mjs `SWEEP_MS`).
 *
 * E88 C4 (27.10.2026; E88-09): a setting write renders what it changed. For the Despair write each browser holds two
 * stand-in sheets in `ui.windows` - Aiko's and a Monokuma's, counting their renders - and the write renders the
 * Monokuma's alone and builds no status strip (at 7baff238: both rendered, a strip on every browser).
 *
 * E89 C0 (30.10.2026; E89-01, E89-02): the mover's stopwatch. The owner's table lags while tokens move, and on every
 * browser (Q-E89-1). Five more events in each theme, after "own move", each counted on all five browsers and followed
 * by the state check:
 *   own drag                    p1 drags Aiko's preview 20 frames, drops (one update), every browser slides her 20 frames
 *   own path                    the same step as 3 updates, the first two with waypoints pending (`movement.pending`)
 *   own drag let go             the preview's 20 frames and no update
 *   sightRefresh during a move  an own step whose slide fires `sightRefresh` on every frame, on every browser
 *   own move into another room  Aiko written into the Cafeteria by the GM, then put back where she stood, her ledger too
 * The preview, the slide, the path's updates and `sightRefresh` during a move are the harness's model (client-entry.mjs
 * `__preview`, `__slideTo`, `applyRemote`), not v14's: LIVE-E89-02 and LIVE-E89-03, in `environment.unconfirmed`. Every
 * count they produce is on that model. Four counters read the mover's work: `visibility.forget` (the room memos
 * dropped), `visibility.myRooms.walk` (the viewer's rooms walked again), `visibility.applyAll.flags` (the refreshes a
 * whole pass asks), `visibility.sliding` (a sliding sprite tested against the viewer's rooms). Not modelled: a drag
 * onto a route movement.mjs refuses (its put-back is a second update) - a gap of C0.
 *
 * E89 C1 (30.10.2026; E89-04, E89-05): an own move inside the same rooms asks its own token. On Aiko's player's browser
 * her step, her drag's drop and each update of her path inside Dorm A ask her own token's verdict alone (no whole pass),
 * as every other browser already did; her move into the Cafeteria and back still asks every token's (C2 narrows it). At
 * 6ae66c7f p1 paid a whole pass for each: applyAll.tokens 46 for the step and the drop, 138 for the path. The state
 * check runs after every event now, the Despair write, the clock and the ledger among them.
 */
export const layers = ["ci"];
/* Measured alone on 27.10.2026 (E88 C0, under the harness lock): 37.5 s from the cluster's start to its end,
   by run-all's line, and 38.3 s and 41.9 s the next two. 126 s is three times the slowest. E88 fix G4 adds the other
   roads (an Eclipse, a bullet, a lair, the sweep's backstop): 83.1 s twice (27.10.2026, cluster's own line, under the
   harness lock), so 250 s. E89 C0 adds five events a theme, each with its state check: 138.5 s and 129.9 s
   (30.10.2026, run-all's line, under the harness lock), so 420 s. */
export const timeoutMs = 420000;
export const accounts = [{ who: "p4", id: "USERP4S860000000", name: "Player Four", role: 1, character: null, color: "#2a627f" }];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const MOVE = `{ teleport: true, movementAction: "displace", animate: false }`;
// E89 C0: the frames of a drag's preview and of a slide, on the harness's model (client-entry.mjs `__slideTo`).
const SLIDE = 20;
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
    /* E88 C4: two stand-in character sheets in `ui.windows`, the registry clock.mjs `refreshSheets` walks (the harness's
       own sheet registers in none, so the sheets a pass renders were 0 here by construction at C0): Aiko's and a
       Monokuma's, each counting its renders. Taken out by UNPLANT, which hands back the counts. */
    const PLANT = `const renders = globalThis.__s86sheets = { student: 0, monokuma: 0 };
        const sheet = (id, doc) => ({ appId: id, id, document: doc, rendered: true, element: null, position: {},
            render() { renders[id.slice(4)] += 1; return this; }, bringToTop() {}, async close() {} });
        ui.windows["s86-student"] = sheet("s86-student", game.actors.get("${IDS.aiko}"));
        ui.windows["s86-monokuma"] = sheet("s86-monokuma", { type: "character", name: "Monokuma", getFlag: (scope, key) => key === "monokuma" || undefined });
        return true;`;
    const UNPLANT = `delete ui.windows["s86-student"]; delete ui.windows["s86-monokuma"];
        const out = globalThis.__s86sheets; delete globalThis.__s86sheets; return out;`;
    /* E88 C2: each token as this browser shows it now against a whole pass run there and then (its refreshes flushed) -
       a token the narrowed pass left shown or hidden otherwise is named. Botan's own reading is handed back. */
    const STATE = `const V = await import("${repoUrl}/scripts/visibility.mjs");
        const shown = () => Object.fromEntries(canvas.tokens.placeables.map(t => [t.id, Boolean(t.visible)]));
        const now = shown();
        V.applyAll();
        await new Promise(r => setTimeout(r, 250));
        const fresh = shown();
        return { off: Object.keys(fresh).filter(id => fresh[id] !== now[id]).map(id => [canvas.tokens.get(id)?.name ?? id, now[id], fresh[id]]),
            botan: now.TOKBOTAN00000000 ?? null, tokens: Object.keys(now).length };`;
    const stateHolds = async (theme, event) => {
        const read = {};
        for (const [who, c] of Object.entries(clients)) read[who] = await c.eval(STATE);
        check(`${theme}: after ${event} every browser shows each token as a whole pass run there would (E88 C2; E37's risk)`,
            Object.values(read).every(r => r?.tokens === 46 && r.off.length === 0), J(read));
        return read;
    };
    const LISTENERS = ["refreshToken.visibility", "refreshToken.ownRing", "refreshToken.remnantRing", "refreshToken.remnantIcons"];
    const drawn = m => (m["ownRing.rebuilt"] ?? 0) + (m["remnantRing.rebuilt"] ?? 0);
    // Another's move on browser `who`: no whole pass, the moved token's refresh alone in each listener, walked alone the next frame.
    const oneRefresh = (read, who) => { const m = read[who]?.moved ?? {};
        return !m["visibility.applyAll"] && (m["visibility.applyOne"] ?? 0) === 1 && LISTENERS.every(k => (m[k] ?? 0) === 1)
            && (m["visibility.reassert.tokens"] ?? 0) === 1 && drawn(m) <= 1; };
    const moved = read => J(Object.fromEntries(Object.entries(read).map(([who, r]) => [who, r.moved])));
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
    // Botan's, for C2's walk into Dorm A: the room he finds there is forgotten again after the events.
    const botanLedger = await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs"); return F.discoveredFor("${IDS.scene}", "${IDS.botan}");`);
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
        check(`${theme}: C2 - Botan's step costs the browsers that do not own him his own refresh alone: no whole pass, one refresh in each listener, one token walked the next frame, no other ring drawn again (E88-06, E88-07)`,
            ["gm", "p1", "p3", "p4"].every(who => oneRefresh(other, who)), moved(other));
        await stateHolds(theme, "another player's move");
        const own = await measure(theme, "own move", () => p1.eval(`${ACADEMY}
            const t = academy.tokens.get("TOKAIKO000000000"); await t.update({ x: t.x + ${step} }, ${MOVE}); return true;`));
        check(`${theme}: an own move is counted on every browser`,
            Object.keys(clients).every(who => beyondRest(theme, own, who)), J(Object.fromEntries(Object.entries(own).map(([who, r]) => [who, r.moved]))));
        check(`${theme}: E89 C1 - Aiko's step inside Dorm A asks her own token's verdict alone on her player's browser as on every other: no whole pass, one refresh in each listener, one token walked the next frame (E89-04; at 6ae66c7f p1 ran a whole pass of 46)`,
            Object.keys(clients).every(who => oneRefresh(own, who)), moved(own));
        await stateHolds(theme, "an own move");
        /* E89 C0 (30.10.2026; E89-01, E89-02): the mover's own drag, frame by frame, on the harness's model of a
           preview and a slide (client-entry.mjs `__preview`, `__holdDrawn`, `__slideTo`; LIVE-E88-05, LIVE-E89-02/03).
           Aiko is held where she stands on every browser, p1 drags her preview 20 frames, drops (the update), and every
           browser slides her sprite 20 frames to her spot. Then the same drag delivered as a path of 3 updates (the
           first two with waypoints pending), a drag let go of with no update, the same step with `sightRefresh` fired
           each frame of the slide, and Aiko written into the Cafeteria by the GM (her player's browser pays it as an
           own token's move; the GM's is the GM moving a player's token) and put back where she stood. */
        const AIKO = `const aiko = canvas.tokens.get("TOKAIKO000000000");`;
        const slideAll = opts => Promise.all(Object.values(clients).map(c => c.eval(`${AIKO} return aiko.__slideTo(${SLIDE}, ${J(opts)});`)));
        const holdAll = () => Promise.all(Object.values(clients).map(c => c.eval(`${AIKO} aiko.__holdDrawn(); return true;`)));
        const drag = (dx, { drop = true } = {}) => p1.eval(`${AIKO} ${ACADEMY}
            const t = academy.tokens.get("TOKAIKO000000000"), preview = aiko.__preview(), x0 = t.x;
            for (let k = 1; k <= ${SLIDE}; k++) { preview.__dragTo(x0 + ${dx} * k / ${SLIDE}, t.y); await new Promise(r => requestAnimationFrame(r)); }
            await new Promise(r => requestAnimationFrame(r));
            if (${drop}) await t.update({ x: x0 + ${dx} }, ${MOVE});
            return true;`);
        const dragged = await measure(theme, "own drag", async () => {
            await holdAll();
            await drag(step);
            await settle(300);
            await slideAll({});
        });
        /* E89 C1: no whole pass on the mover, her own token asked, and each listener's refreshes at most `most`; at 6ae66c7f
           a whole pass of 46 a drop and of 138 a path. The path's 3 updates are flushed in 1 or 2 frames, as on a watcher
           (C0's rows: 1 and 2), so its bound is one refresh an update. */
        const noWholePass = (read, most) => { const m = read.p1?.moved ?? {};
            return !m["visibility.applyAll"] && !m["visibility.applyAll.tokens"] && (m["visibility.applyOne"] ?? 0) >= 1
                && LISTENERS.every(k => (m[k] ?? 0) <= most); };
        check(`${theme}: E89 C1 - Aiko's drag dropped inside Dorm A asks no whole pass on her player's browser, whose refreshes are a watcher's and the preview's ${SLIDE} frames (E89-04, on the model)`,
            noWholePass(dragged, (dragged.p2?.moved?.["refreshToken.visibility"] ?? 0) + SLIDE), J({ p1: dragged.p1.moved, p2: dragged.p2.moved }));
        await stateHolds(theme, "an own drag");
        const pathLog = await measure(theme, "own path", async () => {
            await p1.eval(`${ACADEMY} const t = academy.tokens.get("TOKAIKO000000000"), x0 = t.x, y = t.y;
                const seen = globalThis.__s86path = [];
                globalThis.__s86pathHook = Hooks.on("updateToken", doc => { if (doc.id === t.id) seen.push(doc.movement?.pending?.waypoints?.length ?? 0); });
                const xs = [x0 - ${step} * 0.3, x0 - ${step} * 0.6, x0 - ${step}];
                for (let k = 0; k < 3; k++) {
                    const waypoints = xs.slice(k + 1).map(x => ({ x, y }));
                    await t.update({ x: xs[k] }, { ...${MOVE}, movement: { [t.id]: { pending: { waypoints } } } });
                }
                return true;`);
        });
        const pathSeen = await p1.eval(`Hooks.off("updateToken", globalThis.__s86pathHook); const seen = globalThis.__s86path;
            delete globalThis.__s86path; delete globalThis.__s86pathHook; return seen;`);
        check(`${theme}: E89 C0 - one drag delivered as 3 updates reaches the mover's browser with 2, 1 and 0 waypoints pending (the model, LIVE-E89-03)`,
            J(pathSeen) === J([2, 1, 0]), J({ pathSeen, p1: pathLog.p1.moved }));
        check(`${theme}: E89 C1 - Aiko's path of 3 updates inside Dorm A asks no whole pass on her player's browser, whose refreshes are a watcher's (E89-04, on the model; at 6ae66c7f applyAll.tokens 138)`,
            noWholePass(pathLog, 3), J({ p1: pathLog.p1.moved, p2: pathLog.p2.moved }));
        await stateHolds(theme, "an own path");
        await measure(theme, "own drag let go", () => drag(step, { drop: false }));
        await stateHolds(theme, "an own drag let go");
        const aikoAt = await gm.eval(`${ACADEMY} const t = academy.tokens.get("TOKAIKO000000000"); return { x: t.x, y: t.y };`);
        const sight = await measure(theme, "sightRefresh during a move", async () => {
            await holdAll();
            await p1.eval(`${ACADEMY} const t = academy.tokens.get("TOKAIKO000000000"); await t.update({ x: t.x + ${step} }, ${MOVE}); return true;`);
            await settle(300);
            await slideAll({ sightRefresh: true });
        });
        check(`${theme}: E89 C0 - sightRefresh fired on every frame of the slide is heard on every browser (the model, LIVE-E89-02)`,
            Object.values(sight).every(r => (r.moved["visibility.sightRefresh"] ?? 0) >= SLIDE), moved(sight));
        await stateHolds(theme, "a move with sightRefresh on every frame");
        const elsewhere = await measure(theme, "own move into another room", () => gm.eval(`${ACADEMY}
            await academy.tokens.get("TOKAIKO000000000").update({ x: 1300, y: 650 }, ${MOVE}); return true;`));
        const away = await stateHolds(theme, "Aiko moved into the Cafeteria");
        check(`${theme}: E89 C0 - Aiko in the Cafeteria: her player's browser shows Botan there, and the move is counted on every browser`,
            away.p1.botan === true && Object.keys(clients).every(who => beyondRest(theme, elsewhere, who)), J({ away, p1: elsewhere.p1.moved }));
        /* E89 C1: a room entered asks every verdict at the update itself, not Aiko's alone with the rest left to the
           re-read at rest (which, on the harness, finds the room changed and runs the whole pass a grace later). */
        check(`${theme}: E89 C1 - Aiko's move into the Cafeteria asks every token's verdict on her player's browser at the update, none for her alone (E89-04)`,
            (elsewhere.p1.moved["visibility.applyAll"] ?? 0) >= 1 && !elsewhere.p1.moved["visibility.applyOne"], J({ p1: elsewhere.p1.moved }));
        await gm.eval(`${ACADEMY} await academy.tokens.get("TOKAIKO000000000").update(${J(aikoAt)}, ${MOVE}); return true;`);
        await settle(1500);
        await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs"); const now = F.discoveredFor("${IDS.scene}", "${IDS.aiko}");
            const extra = now.filter(r => !${J(ledger)}.includes(r));
            if (extra.length) await F.setDiscovery(game.scenes.get("${IDS.scene}"), { actorId: "${IDS.aiko}", rooms: extra, value: false });
            return extra;`);
        await settle(800);
        await stateHolds(theme, "Aiko put back in Dorm A");
        /* Botan walked by the GM into Dorm A, where Aiko stands alone, and back out: on p1's browser he comes on screen by
           his own refresh (the road `applyAll`'s note keeps: Foundry is asked again for a token this file hid) and goes off
           it the same way; every other token stays as it was everywhere. */
        const botanAt = await gm.eval(`${ACADEMY} const t = academy.tokens.get("TOKBOTAN00000000"); return { x: t.x, y: t.y };`);
        const inside = await measure(theme, "into my room", () => gm.eval(`${ACADEMY}
            await academy.tokens.get("TOKBOTAN00000000").update({ x: 600, y: 650 }, ${MOVE}); return true;`));
        const enter = await stateHolds(theme, "Botan walked into Dorm A");
        check(`${theme}: C2 - Botan walked into Dorm A comes onto Aiko's player's screen by his own refresh, and stays off the screens of p3 and p4 (E88-06)`,
            enter.p1.botan === true && enter.p3.botan === false && enter.p4.botan === false && oneRefresh(inside, "p1"), J({ moved: inside.p1.moved, enter }));
        const outside = await measure(theme, "out of my room", () => gm.eval(`${ACADEMY}
            await academy.tokens.get("TOKBOTAN00000000").update(${J(botanAt)}, ${MOVE}); return true;`));
        const leave = await stateHolds(theme, "Botan walked back out of Dorm A");
        check(`${theme}: C2 - Botan walked back out of Dorm A leaves Aiko's player's screen by his own refresh (E88-06)`,
            leave.p1.botan === false && oneRefresh(outside, "p1"), J({ moved: outside.p1.moved, leave }));
        // E88 C4: a student's and a Monokuma's stand-in sheet open on every browser for the write, each counting its renders.
        await Promise.all(Object.values(clients).map(c => c.eval(PLANT)));
        const pool = await measure(theme, "despair", () => gm.eval(`await game.drpg.setDespair(game.user.id, ${Number(despair) === 3 ? 4 : 3}); return true;`));
        const sheets = {};
        for (const [who, c] of Object.entries(clients)) sheets[who] = await c.eval(UNPLANT);
        check(`${theme}: a Despair write is counted on every browser`,
            Object.keys(clients).every(who => beyondRest(theme, pool, who)), J(Object.fromEntries(Object.entries(pool).map(([who, r]) => [who, r.moved]))));
        check(`${theme}: C4 - a Despair write renders the Monokuma's sheet open on every browser and not the student's, and builds no status strip (E88-09)`,
            Object.keys(clients).every(who => J(sheets[who]) === J({ student: 0, monokuma: 1 }) && !pool[who].moved["playerStatus.render"]),
            J({ sheets, strip: Object.fromEntries(Object.entries(pool).map(([who, r]) => [who, r.moved["playerStatus.render"] ?? 0])) }));
        await stateHolds(theme, "a Despair write");
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
        await stateHolds(theme, "a move of the clock");
        await gm.eval(`const C = await import("${repoUrl}/scripts/clock.mjs"); await C.setClock(globalThis.__s86clock); delete globalThis.__s86clock; return true;`, { timeout: 60000 });
        await settle(1200);
        const found = await measure(theme, "ledger", () => gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
            await F.setDiscovery(academy, { actorId: "${IDS.aiko}", rooms: [...${J(ledger)}, "Gym"], value: true }); return true;`));
        check(`${theme}: a discovery ledger write is counted on the GM's browser and on Aiko's player's`,
            ["gm", "p1"].every(who => beyondRest(theme, found, who)), J({ gm: found.gm.moved, p1: found.p1.moved }));
        await stateHolds(theme, "a discovery ledger write");
        await gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
            await F.setDiscovery(academy, { actorId: "${IDS.aiko}", rooms: ${J(ledger)}, value: ${ledger.length > 0} }); return true;`);
        await settle(800);
    }

    if (!botanLedger.includes("Dorm A")) await gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
        await F.setDiscovery(academy, { actorId: "${IDS.botan}", rooms: ["Dorm A"], value: false }); return true;`);
    await settle(800);

    /* ------------------------------ the narrowed pass on its other roads (E88 fix G4) ------------------------------ */
    /* Findings E88-TEST-1 and E88R-03, 27.10.2026. C2 checked its state on another player's move, an own move and a walk
       into and out of a room; the roads that still run the whole pass under the narrowed walk were read, not run, and
       the next-frame walk of every placeable - the second line, since 2026-08-23, against the engine writing `visible`
       after this file - became a walk of the tokens refreshed in the frame. Under Stained Glass, each followed by
       another player's step and the state check above: an Eclipse starting and, with the step, ending; a Truth Bullet
       given to Aiko; a Mastermind (Aiko) with her lair in Dorm B. And the backstop: on p1's browser Chie's `visible` is
       written true outside her own refresh (she stands in Dorm B, off p1's screen) while only Botan refreshes, twice,
       1.2 s apart: the once-a-second sweep (visibility.mjs `SWEEP_MS`) must hide her again. Red at 00bcd809: Chie stood
       on p1's screen after both steps. Everything is put back. */
    phase("the narrowed pass on its other roads (E88 fix G4)");
    await Promise.all(Object.values(clients).map(c => c.eval(`await game.settings.set("${MOD}", "theme", "stainedGlass"); return true;`)));
    await settle(1200);
    let roadStep = 100;
    const botanStep = async () => {
        await p2.eval(`${ACADEMY} const t = academy.tokens.get("TOKBOTAN00000000"); await t.update({ x: t.x + ${roadStep} }, ${MOVE}); return true;`);
        roadStep = -roadStep;
        await settle(1200);
    };
    const roads = {};
    const eclipseOn = await gm.eval(`await game.drpg.startEclipse(); return game.drpg.isEclipse();`, { timeout: 60000 });
    await settle(1500);
    roads.eclipseStart = await stateHolds("stainedGlass", "an Eclipse starting");
    await botanStep();
    roads.eclipseStep = await stateHolds("stainedGlass", "another player's move in an Eclipse");
    await gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs"); await E.endEclipse({ advance: false }); return true;`, { timeout: 60000 });
    await settle(1500);
    const eclipseOff = await gm.eval(`return game.drpg.isEclipse();`);
    roads.eclipseEnd = await stateHolds("stainedGlass", "an Eclipse ending");
    check("fix G4: the Eclipse started and ended for these reads", eclipseOn === true && eclipseOff === false, J({ eclipseOn, eclipseOff }));
    const bulletId = await gm.eval(`const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const item = await B.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "E88 fix G4 bullet", realType: "neutral", visibility: "obvious", playerText: "Seen." });
        return item?.id ?? null;`);
    await settle(1500);
    roads.bullet = await stateHolds("stainedGlass", "a Truth Bullet given to Aiko");
    await botanStep();
    roads.bulletStep = await stateHolds("stainedGlass", "another player's move with Aiko's new bullet");
    await gm.eval(`await game.actors.get("${IDS.aiko}").items.get(${J(bulletId)})?.delete(); return true;`);
    await settle(800);
    const mastermindWas = await gm.eval(`const M = await import("${repoUrl}/scripts/mastermind.mjs"); return { actorId: M.mastermindActor?.()?.id ?? null, room: M.mastermindLair() };`);
    await gm.eval(`const M = await import("${repoUrl}/scripts/mastermind.mjs"); await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Dorm B" }); return true;`);
    await settle(1500);
    const lair = await p1.eval(`const M = await import("${repoUrl}/scripts/mastermind.mjs"); return M.myLairRoom();`);
    roads.lair = await stateHolds("stainedGlass", "Aiko made the Mastermind, her lair Dorm B");
    await botanStep();
    roads.lairStep = await stateHolds("stainedGlass", "another player's move with Aiko's lair in Dorm B");
    check("fix G4: a bullet was given and the Mastermind's lair reached her player's browser for these reads", Boolean(bulletId) && lair === "Dorm B", J({ bulletId, lair, mastermindWas }));
    const M_BACK = mastermindWas.actorId ? `await M.setMastermind(game.actors.get(${J(mastermindWas.actorId)}), { room: ${J(mastermindWas.room)} });` : `await M.clearMastermind();`;
    await gm.eval(`const M = await import("${repoUrl}/scripts/mastermind.mjs"); ${M_BACK} return true;`);
    await settle(1200);
    const planted = await p1.eval(`const t = canvas.tokens.get("TOKCHIE000000000"); const was = Boolean(t?.visible); if (t) t.visible = true; return { was, now: Boolean(t?.visible) };`);
    await botanStep();
    await botanStep();
    const chie = await p1.eval(`return Boolean(canvas.tokens.get("TOKCHIE000000000")?.visible);`);
    roads.backstop = await stateHolds("stainedGlass", "Chie's visible written outside her refresh on p1's browser and two of Botan's steps");
    check("fix G4: a token whose visible the engine wrote outside its own refresh is hidden again within a second by the sweep, while another token refreshes (E88-TEST-1; E37's risk)",
        planted.was === false && planted.now === true && chie === false, J({ planted, chie }));
    const botanBack = await gm.eval(`${ACADEMY} const t = academy.tokens.get("TOKBOTAN00000000"); await t.update(${J(at.TOKBOTAN00000000)}, ${MOVE}); return { x: t.x, y: t.y };`);
    await settle(1200);
    note("fix G4 roads", J({ botanBack, roads: Object.fromEntries(Object.entries(roads).map(([k, r]) => [k, Object.fromEntries(Object.entries(r).map(([w, x]) => [w, x.off.length]))])) }));

    /* ------------------------------ the seams' light drawn once (E88 C1) ------------------------------ */
    /* E88-05. The harness's canvas has no renderer, so every halo above stayed on its live filter (the rows keep C0's
       shape for C2-C5 to compare). Here the GM's and Aiko's player's browsers hand fog-reveal.mjs's baker a stand-in
       renderer that counts its renders (`HALO_IO`; it draws no pixels - those are LIVE-E88-02's), under Stained Glass:
       every ring repainted, the filters on the canvas walked, the textures the rings wear counted; then the clock moved
       (the hour's colour: the students' frames are drawn again, the Remnants' are not); then on p1 the outline of Dorm A
       drawn (fog-reveal.mjs `flashOutline`, into a container of the scenario's own) and struck again (`rewidth`). */
    phase("the seams' light drawn once (E88 C1)");
    const FR = `const FR = await import("${repoUrl}/scripts/fog-reveal.mjs");`;
    const STAND = `${FR} const H = globalThis.__s86halo = { renders: 0, io: FR.HALO_IO.renderer };
        FR.HALO_IO.renderer = () => ({ resolution: 1, render: () => { H.renders++; } });`;
    const WORN = `${FR} const c = await game.drpg.counters();
        const worn = { own: [], remnant: [] };
        for (const t of canvas.tokens.placeables) for (const [kind, ring] of [["own", "drpgOwnRing"], ["remnant", "drpgRemnantRing"]]) {
            const s = t.visible && t[ring] && !t[ring].destroyed && t[ring].visible !== false ? t[ring].children.find(k => k?.name === FR.HALO_BAKED) : null;
            if (s?.visible) worn[kind].push(s);
        }
        const textures = list => new Set(list.map(s => s.texture));
        const H = globalThis.__s86halo;
        H.remnantTexture ??= worn.remnant[0]?.texture ?? null;
        return { ringBlurs: (c.live.byName.drpgOwnRingGlow ?? 0) + (c.live.byName.drpgRemnantRingGlow ?? 0), renders: H.renders, halos: c.halos,
            own: worn.own.length, ownTextures: textures(worn.own).size, ownKeys: new Set(worn.own.map(s => s.drpgHaloKey)).size,
            remnant: worn.remnant.length, remnantTextures: textures(worn.remnant).size, remnantKept: worn.remnant.every(s => s.texture === H.remnantTexture),
            ownKey: worn.own[0]?.drpgHaloKey?.split("|").slice(0, 3).join("|") ?? null };`;
    await Promise.all([gm, p1].map(c => c.eval(`await game.settings.set("${MOD}", "theme", "stainedGlass"); return true;`)));
    await settle(1500);
    await gm.eval(`${STAND} const V = await import("${repoUrl}/scripts/visibility.mjs"); V.applyAll(); return true;`);
    await settle(1500);
    const baked = await gm.eval(WORN);
    note("C1 rest, GM", J(baked));
    check("C1: at rest on the GM's browser no ring carries a live blur; the 30 Remnants wear one texture and the students one, each drawn once",
        baked?.ringBlurs === 0 && baked.remnant === 30 && baked.remnantTextures === 1 && baked.own >= 1 && baked.ownTextures === baked.ownKeys
            && baked.renders === 1 + baked.ownKeys, J(baked));
    /* E88 C2: with the light drawn once, a second whole pass on the GM's browser finds every frame standing - no ring and
       no texture drawn again (at 41cf2e9f each of the 34 was drawn again on every refresh). */
    const again = await gm.eval(`const before = (await game.drpg.counters()).counts;
        const V = await import("${repoUrl}/scripts/visibility.mjs"); V.applyAll();
        await new Promise(r => setTimeout(r, 400));
        const after = (await game.drpg.counters()).counts, d = k => (after[k] ?? 0) - (before[k] ?? 0);
        return { renders: globalThis.__s86halo.renders, rebuilt: d("ownRing.rebuilt") + d("remnantRing.rebuilt"), kept: d("ownRing.kept") + d("remnantRing.kept") };`);
    note("C2 second pass, GM", J(again));
    check("C2: a second pass on the GM's browser with the light drawn once draws no ring and no texture again, every frame kept (E88-06)",
        again?.renders === baked.renders && again.rebuilt === 0 && again.kept >= baked.own + baked.remnant, J({ baked, again }));
    await gm.eval(`const C = await import("${repoUrl}/scripts/clock.mjs");
        const { TIMES_OF_DAY } = await import("${repoUrl}/scripts/config.mjs");
        const before = C.getClock();
        globalThis.__s86clock = { timeOfDay: before.timeOfDay, timeOfDayStartedAt: before.timeOfDayStartedAt ?? null };
        await C.setTimeOfDay(TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(before.timeOfDay) + 1) % TIMES_OF_DAY.length], { resetSearchTokens: false });
        return true;`, { timeout: 60000 });
    await settle(1500);
    const hour = await gm.eval(WORN);
    note("C1 clock, GM", J(hour));
    check("C1: the clock moved on the GM's browser draws the students' light again in the hour's colour and not the Remnants'; still no live blur",
        hour?.ringBlurs === 0 && hour.remnantKept && hour.remnantTextures === 1 && hour.renders - baked.renders === (hour.ownKey !== baked.ownKey ? hour.ownKeys : 0),
        J({ baked, hour }));
    await gm.eval(`const C = await import("${repoUrl}/scripts/clock.mjs"); await C.setClock(globalThis.__s86clock); delete globalThis.__s86clock; return true;`, { timeout: 60000 });
    await settle(1200);
    const outline = await p1.eval(`${STAND} ${ACADEMY}
        const F = await import("${repoUrl}/scripts/fog.mjs");
        const fx = new PIXI.Container();
        FR.flashOutline(fx, F.roomShapeOn(academy, "Dorm A", null), { x: 0, y: 0 }, null, { actor: game.actors.get("${IDS.aiko}") });
        const read = () => { const kids = FR.roomOutline?.group?.children ?? [];
            const halo = kids.find(k => k?.name === "drpgRoomOutlineGlow"), sprite = kids.find(k => k?.name === "drpgRoomOutlineGlowBaked");
            return { halo: Boolean(halo), haloShown: halo?.visible ?? null, haloFilters: halo?.filters?.length ?? 0, sprite: sprite?.visible ?? null,
                owned: Boolean(sprite?.drpgOwnedTexture && sprite.drpgOwnedTexture === sprite.texture), texture: sprite?.texture ?? null, renders: H.renders }; };
        const first = read();
        FR.roomOutline?.rewidth?.();
        const again = read();
        FR.fadeRoomOutline();
        FR.HALO_IO.renderer = H.io;
        return { first: { ...first, texture: undefined }, again: { ...again, texture: undefined }, newTexture: Boolean(again.texture && again.texture !== first.texture) };`);
    note("C1 outline, p1", J(outline));
    check("C1: the outline of the room Aiko stands in shows its light drawn once (its live halo stood down, no filter), and a re-strike draws it once more into a new texture",
        outline?.first?.halo && outline.first.haloShown === false && outline.first.haloFilters === 0 && outline.first.sprite === true && outline.first.owned
            && outline.first.renders === 1 && outline.again.renders === 2 && outline.again.owned && outline.newTexture, J(outline));
    await gm.eval(`${FR} const H = globalThis.__s86halo; FR.HALO_IO.renderer = H.io; delete globalThis.__s86halo;
        const V = await import("${repoUrl}/scripts/visibility.mjs"); V.applyAll(); return true;`);
    await p1.eval(`delete globalThis.__s86halo; return true;`);
    await settle(1000);

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
