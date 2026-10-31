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
 *
 * E89 fix FG2 (30.10.2026; findings SEC-1, SEC-2, COR-3, G3 of the reviews of 15c68d96): the viewer's rooms changed with
 * no token of theirs moving - a region updated, created or deleted, a scene's update carrying its regions, a Teleport put
 * on a piece and taken off, the player regions' record, an actor's ownership - each read on p1 and p3 and followed by the
 * state check (red at 15c68d96: Chie and the Dorm B students stayed off p1's screen after Dorm A was enlarged over them
 * and stayed on it after it was put back); a token this file hid, refreshed for its bars and entitled by a change only
 * sightRefresh reports, given back by the pass after it (red at 15c68d96: not given back); and the waits for a token at
 * rest and the fog's reading of a move counted on "own move".
 *
 * E51 C3 (31.10.2026; E51-19, E51-20, the owner's D43b = 1): the fog switched off and a placed token, after the rest.
 * With both room sounds mapped and the Room fog off, Aiko written into the Cafeteria asks a room sound on no browser,
 * and her player's browser keeps no fog layer and draws no outline, while the primary GM's ledger records the room;
 * switched back on, no browser asks a sound. A second token of Aiko's placed in the Gym plays its arrival on her
 * player's browser alone, at once, and its step inside the Gym plays nothing and draws no outline again.
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
    /* E89 C2: the tokens a browser asks Foundry to refresh the visibility of (`refreshVisibility`, the un-hide road) by
       the time Aiko's update has passed through every `updateToken` listener (this one is registered after
       visibility.mjs's) - the move's own pass, before the ledger's write comes back (sync.mjs `SYNC.fog` runs a whole
       pass on the GM and on her player's browser for a room entered the first time: the road that shows a public
       project there). Against the characters standing in Dorm A or the Cafeteria read off the documents by the
       rectangles of lib/seed.mjs - not by visibility.mjs - and the Remnants among them. */
    const SPY = `const flagged = new Set(); globalThis.__s86spy = { flagged, atUpdate: null };
        for (const t of canvas.tokens.placeables) { const set = t.renderFlags.set; t.__s86set = set;
            t.renderFlags.set = flags => { if (flags?.refreshVisibility) flagged.add(t.id); return set.call(t.renderFlags, flags); }; }
        globalThis.__s86spy.hook = Hooks.on("updateToken", doc => {
            if (doc?.id === "TOKAIKO000000000" && !globalThis.__s86spy.atUpdate) globalThis.__s86spy.atUpdate = [...flagged].sort(); });
        return true;`;
    const UNSPY = `const spy = globalThis.__s86spy; delete globalThis.__s86spy; Hooks.off("updateToken", spy.hook);
        const seen = spy.atUpdate ?? [];
        for (const t of canvas.tokens.placeables) if (t.__s86set) { t.renderFlags.set = t.__s86set; delete t.__s86set; }
        const inside = (d, [x, y, w, h]) => d.x >= x && d.x < x + w && d.y >= y && d.y < y + h;
        const named = canvas.tokens.placeables.filter(t => !t.document.getFlag("${MOD}", "isRemnant") && t.actor?.type === "character"
            && (inside(t.document, ${J(ROOMS[5])}) || inside(t.document, ${J(ROOMS[0])}))).map(t => t.id).sort();
        return { seen, named, remnants: seen.filter(id => canvas.tokens.get(id)?.document.getFlag("${MOD}", "isRemnant")).length };`;
    const askedOnly = (read, flags) => { const m = read.p1?.moved ?? {};
        return (m["visibility.applyAll"] ?? 0) <= (read.gm?.moved?.["visibility.applyAll"] ?? 0) && !m["visibility.applyOne"]
            && m["visibility.applyRooms"] === 1
            && m["visibility.applyRooms.tokens"] === flags.named.length && flags.remnants === 0 && J(flags.seen) === J(flags.named)
            && flags.named.length > 1; };
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
        /* E89 fix FG2 (30.10.2026; finding G3): the waits for a token at rest (movement.mjs `whenAtRest`: fog.mjs's on every
           browser, visibility.mjs's on the mover's) and the fog's reading of a move (fog.mjs `reactToMove`, at the update
           and again at rest; its walks of the viewer's tokens) are counted, so a row holds them. Recorded, not bounded. */
        const waits = Object.fromEntries(Object.entries(own).map(([who, r]) => [who, ["movement.whenAtRest", "movement.whenAtRest.polls",
            "fog.reactToMove", "fog.reactToMove.walks"].map(k => r.moved[k] ?? 0)]));
        check(`${theme}: fix FG2 G3 - Aiko's step starts a wait for her at rest and the fog's reading of it on every browser, each counted`,
            Object.values(waits).every(([rest, , reads]) => rest >= 1 && reads >= 1), J(waits));
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
        /* E89 C3 (30.10.2026; E89-07): a frame of the drag drops no memo of the viewer's rooms - only the drop (an owned
           document's move) and the re-read at rest do. At e9e41f58 visibility.forget 21/43/0/0/0 over this drag and
           visibility.myRooms.walk 3 on p1 (on the model). */
        const forgets = Object.fromEntries(Object.entries(dragged).map(([who, r]) => [who, [r.moved["visibility.forget"] ?? 0, r.moved["visibility.myRooms.walk"] ?? 0]]));
        check(`${theme}: E89 C3 - Aiko's ${SLIDE}-frame drag and slide drop the memo of the viewer's rooms at most twice on every browser and walk the scene for them at most twice on her player's (E89-07, on the model)`,
            Object.values(forgets).every(([forget]) => forget <= 2) && forgets.p1[1] <= 2, J(forgets));
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
        /* E89 C4 (30.10.2026; E89-08): the hooks of a frame ask one pass on the next, which flags only a token this file
           hid and may now show. At e9e41f58 visibility.applyAll 20 and applyAll.tokens 920 on every browser (on the model). */
        const sightPasses = Object.fromEntries(Object.entries(sight).map(([who, r]) => [who, ["visibility.applyAll", "visibility.sightPass",
            "visibility.sightPass.flags", "refreshToken.visibility"].map(k => r.moved[k] ?? 0)]));
        check(`${theme}: E89 C4 - sightRefresh on each of the slide's ${SLIDE} frames asks no whole pass on any browser, at most one pass a frame (E89-08, on the model)`,
            Object.values(sightPasses).every(([all, passes]) => all === 0 && passes >= 1 && passes <= SLIDE + 1), J(sightPasses));
        await p1.eval(SPY);
        const elsewhere = await measure(theme, "own move into another room", () => gm.eval(`${ACADEMY}
            await academy.tokens.get("TOKAIKO000000000").update({ x: 1300, y: 650 }, ${MOVE}); return true;`));
        const flagsThere = await p1.eval(UNSPY);
        const away = await stateHolds(theme, "Aiko moved into the Cafeteria");
        check(`${theme}: E89 C0 - Aiko in the Cafeteria: her player's browser shows Botan there, and the move is counted on every browser`,
            away.p1.botan === true && Object.keys(clients).every(who => beyondRest(theme, elsewhere, who)), J({ away, p1: elsewhere.p1.moved }));
        /* E89 C1: a room entered asks more than Aiko's verdict at the update itself, not hers alone with the rest left to
           the re-read at rest. E89 C2: the tokens a room change can touch, and no more - on her player's browser the
           characters in Dorm A and the Cafeteria are flagged and asked at the update, no Remnant, and no whole pass but
           the ledger's, which the GM's browser runs as well (at 6bee0e69 p1 ran two, applyAll.tokens 92: the update's
           and the ledger's). */
        check(`${theme}: E89 C2 - Aiko's move into the Cafeteria flags and asks on her player's browser the characters of Dorm A and the Cafeteria alone, at the update: no whole pass but the ledger's, no Remnant, none for her alone (E89-06, on the model)`,
            askedOnly(elsewhere, flagsThere), J({ p1: elsewhere.p1.moved, flagsThere }));
        await p1.eval(SPY);
        const back = await measure(theme, "own move back into her room", () => gm.eval(`${ACADEMY}
            await academy.tokens.get("TOKAIKO000000000").update(${J(aikoAt)}, ${MOVE}); return true;`));
        const flagsBack = await p1.eval(UNSPY);
        check(`${theme}: E89 C2 - Aiko put back from the Cafeteria into Dorm A flags and asks the same characters alone on her player's browser (E89-06, on the model)`,
            askedOnly(back, flagsBack), J({ p1: back.p1.moved, flagsBack }));
        await stateHolds(theme, "Aiko moved back into Dorm A, before her ledger is put back");
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

    /* E89 fix FG2 (30.10.2026; findings SEC-1, SEC-2, COR-3): the viewer's rooms change while none of their tokens moves.
       Since C3 the memo of the viewer's rooms is dropped on an owned document's move alone, so the roads that change
       those rooms otherwise are driven here, each read on p1 (Chie and the Dorm B students) and on p3 (Aiko) and followed
       by the state check (which runs a whole pass, so each road starts from a screen drawn right):
       - the GM enlarges Dorm A down over Dorm B (a region's update): Chie and the Dorm B students now stand in Dorm A
         (`roomAt` takes the first name), so they come onto p1's screen and Aiko onto p3's;
       - the GM records Dorm A among the regions a player drew (the setting `playerRegions`, which makes it no room): they
         leave those screens, the leak direction; the record put back, they come back;
       - Dorm A put back by the GM through the scene's own update (`changes.regions`, which fires no `updateRegion`):
         they leave again;
       - the GM draws a second piece of Dorm A over Dorm B (a region created): they come back; a Teleport behaviour on it
         (no room): they leave; the behaviour deleted: they come back; the piece deleted: they leave;
       - the GM gives p1 Chie's actor (an actor's ownership): Chie and the Dorm B students come onto p1's screen, and
         leave it when the GM takes her back;
       - on p1's browser alone the same enlargement written into the region's source (no hook: what a sightRefresh
         reports and no document hook does - the floor on screen changing, LIVE-E12-02), Chie's bars refreshed (a
         refresh that is not of her visibility, SEC-2), then `sightRefresh`: the pass after it gives Chie, hidden by this
         file, back to Foundry (visibility.sightPass.flags >= 1, COR-3: the road m7 cuts), and hides her again when the
         source is put back. */
    const DORM_A = "REGDORMA00000000", DORM_A_WIDE = [{ type: "rectangle", x: 200, y: 200, width: 600, height: 1600 }];
    const dormAWas = await gm.eval(`${ACADEMY} return academy.regions.get("${DORM_A}").toObject().shapes;`);
    const playersWas = await gm.eval(`return game.settings.get("${MOD}", "playerRegions") ?? [];`);
    const SEEN = `const inside = (d, [x, y, w, h]) => d.x >= x && d.x < x + w && d.y >= y && d.y < y + h;
        const dormB = canvas.tokens.placeables.filter(t => !t.document.getFlag("${MOD}", "isRemnant") && t.actor?.type === "character"
            && inside(t.document, ${J(ROOMS[1])}));`;
    const seenNow = async () => ({
        p1: await p1.eval(`${SEEN} return dormB.map(t => Boolean(t.visible));`),
        p3: await p3.eval(`return Boolean(canvas.tokens.get("TOKAIKO000000000")?.visible);`)
    });
    const all = list => list.length > 1 && list.every(Boolean), none = list => list.length > 1 && !list.some(Boolean);
    const roomRoad = { before: await seenNow() };
    const roomStep = async (label, act) => {
        const read = await measure("stainedGlass", label, act);
        roomRoad[label] = { ...(await seenNow()), passes: ["p1", "p3"].map(who => read[who]?.moved?.["visibility.roomsChanged"] ?? 0) };
        roads[label] = await stateHolds("stainedGlass", label);
        return roomRoad[label];
    };
    const want = { "Dorm A enlarged": true, "Dorm A recorded as a player's region": false, "the record put back": true, "Dorm A put back": false,
        "a piece of Dorm A drawn over Dorm B": true, "a Teleport on that piece": false, "the Teleport deleted": true, "the piece deleted": false };
    await roomStep("Dorm A enlarged", () => gm.eval(`${ACADEMY} await academy.regions.get("${DORM_A}").update({ shapes: ${J(DORM_A_WIDE)} }); return true;`));
    await roomStep("Dorm A recorded as a player's region", () => gm.eval(`await game.settings.set("${MOD}", "playerRegions", ${J([...playersWas, DORM_A])}); return true;`));
    await roomStep("the record put back", () => gm.eval(`await game.settings.set("${MOD}", "playerRegions", ${J(playersWas)}); return true;`));
    await roomStep("Dorm A put back", () => gm.eval(`${ACADEMY} await academy.update({ regions: [{ _id: "${DORM_A}", shapes: ${J(dormAWas)} }] }); return true;`));
    let piece = null;
    await roomStep("a piece of Dorm A drawn over Dorm B", async () => { piece = await gm.eval(`${ACADEMY}
        const [r] = await academy.createEmbeddedDocuments("Region", [{ name: "Dorm A", shapes: [{ type: "rectangle", x: 200, y: 1200, width: 600, height: 600 }],
            flags: { "${MOD}": { room: true } }, behaviors: [] }]); return r.id;`); });
    roomRoad.piece = piece;
    await roomStep("a Teleport on that piece", () => gm.eval(`${ACADEMY} const r = academy.regions.get(${J(piece)});
        const [b] = await r.createEmbeddedDocuments("RegionBehavior", [{ name: "S86 teleport", type: "teleportToken", system: {} }]);
        globalThis.__s86behaviour = b?.id ?? null; return true;`));
    await roomStep("the Teleport deleted", () => gm.eval(`${ACADEMY} const r = academy.regions.get(${J(piece)});
        await r.deleteEmbeddedDocuments("RegionBehavior", [globalThis.__s86behaviour]); return true;`));
    await roomStep("the piece deleted", () => gm.eval(`${ACADEMY} await academy.deleteEmbeddedDocuments("Region", [${J(piece)}]); return true;`));
    const roomsRight = Object.entries(want).map(([label, shown]) => [label, roomRoad[label]
        && (shown ? all(roomRoad[label].p1) && roomRoad[label].p3 === true : none(roomRoad[label].p1) && roomRoad[label].p3 === false)
        && roomRoad[label].passes.every(n => n >= 1)]);
    check("fix FG2 SEC-1: Chie and the Dorm B students come onto Aiko's player's screen and Aiko onto Chie's player's exactly while Dorm B's ground reads as Dorm A - a region updated, created or deleted, a behaviour added or taken off, the player regions' record written - with none of their tokens moving, and a whole pass asked on both browsers each time",
        none(roomRoad.before.p1) && roomRoad.before.p3 === false && roomsRight.every(([, right]) => right), J({ roomsRight, roomRoad }));
    const ownRoad = { before: (await seenNow()).p1 };
    await measure("stainedGlass", "an actor given by the GM", () => gm.eval(`
        await game.actors.get("${IDS.chie}").update({ ownership: { ${IDS.p1}: 3 } }); return true;`));
    ownRoad.given = (await seenNow()).p1;
    roads.actorGiven = await stateHolds("stainedGlass", "Chie's actor given to Aiko's player");
    await measure("stainedGlass", "an actor taken back by the GM", () => gm.eval(`
        await game.actors.get("${IDS.chie}").update({ ownership: { ${IDS.p1}: 0 } }); return true;`));
    ownRoad.taken = (await seenNow()).p1;
    roads.actorTaken = await stateHolds("stainedGlass", "Chie's actor taken back from Aiko's player");
    check("fix FG2 SEC-1: Chie's actor given to Aiko's player brings Chie and the Dorm B students onto that screen, and taken back takes them off again",
        none(ownRoad.before) && all(ownRoad.given) && none(ownRoad.taken), J(ownRoad));
    const sightRoad = await p1.eval(`${ACADEMY} ${SEEN} const C = await import("${repoUrl}/scripts/perf-counters.mjs");
        const frames = async k => { for (let i = 0; i < k; i++) await new Promise(r => requestAnimationFrame(() => r())); };
        const region = academy.regions.get("${DORM_A}"), was = region.toObject().shapes, chie = canvas.tokens.get("TOKCHIE000000000");
        const hidden = !chie.visible;
        const b0 = C.snapshot();
        region.updateSource({ shapes: ${J(DORM_A_WIDE)} });
        chie.renderFlags.set({ refreshBars: true });
        await frames(2);
        Hooks.callAll("sightRefresh");
        await frames(3);
        const shown = Boolean(chie.visible), flags = C.delta(b0, C.snapshot())["visibility.sightPass.flags"] ?? 0;
        region.updateSource({ shapes: was });
        Hooks.callAll("sightRefresh");
        await frames(3);
        return { hidden, shown, flags, back: !chie.visible };`);
    roads.sightRoad = await stateHolds("stainedGlass", "Dorm A enlarged on p1's browser alone, reported by sightRefresh, and put back");
    check("fix FG2 COR-3, SEC-2: a token this file hid, entitled by a change only sightRefresh reports and refreshed meanwhile for its bars, is given back by the pass after sightRefresh (sightPass.flags >= 1) and hidden again when the change is put back",
        sightRoad?.hidden === true && sightRoad.shown === true && sightRoad.flags >= 1 && sightRoad.back === true, J(sightRoad));

    const planted =await p1.eval(`const t = canvas.tokens.get("TOKCHIE000000000"); const was = Boolean(t?.visible); if (t) t.visible = true; return { was, now: Boolean(t?.visible) };`);
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

    /* ------------------------------ the fog off, and a placed token (E51 C3) ------------------------------ */
    /* E51 C3, 31.10.2026; audit S07-28 and S07-30, the owner's D43b = 1. Both room sounds are mapped (a file the harness
       never plays: `sfx.played` counts a file handed to the audio layer, E50 C4) and the Room fog is switched off. Aiko
       is written into the Cafeteria by the GM, as in "own move into another room": no browser asks a room sound, her
       player's browser keeps no fog layer and draws no outline, and the primary GM's ledger records the Cafeteria for
       her all the same. Put back in Dorm A with her ledger, the fog is switched on again: no browser asks a sound (no
       burst for the rooms already known) and her player's fog no longer says it is off (the layer itself is not read:
       the harness renders no fog texture, so a repaint stands down before it mounts one). Then a second token of Aiko's
       is placed in the Gym, a room she has not found: her player's browser plays the arrival at once - the room's
       sound and its outline - and no other browser does; a step inside the Gym after that plays nothing on any browser
       and draws no outline again. Red at f2b503e7: the fog off, p1 asked the room's sound and kept its layer with the
       Cafeteria outlined; the placed token played nothing, and its first step played the arrival. */
    phase("the fog off, then a placed token (E51 C3)");
    const SFX = `const ST = await import("${repoUrl}/scripts/settings.mjs");`;
    const sfxWas = await gm.eval(`${SFX} const was = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.sfxMap) ?? {});
        await ST.setSetting(ST.SETTINGS.sfxMap, { ...was, roomEntered: "sounds/s86-room.ogg", roomDiscovered: "sounds/s86-room.ogg" }); return was;`, { timeout: 60000 });
    await settle(900);
    const VIEW = `const FR = await import("${repoUrl}/scripts/fog-reveal.mjs"); const F = await import("${repoUrl}/scripts/fog.mjs");
        const view = { layer: Boolean(FR.findLayer()), outline: FR.roomOutline?.room ?? null, marked: Boolean(FR.roomOutline?.__s86e51),
            off: /setting is off/.test(F.diagnoseFog().lastReason ?? "") };`;
    const played = read => Object.fromEntries(Object.entries(read).map(([who, r]) => [who, r.moved["sfx.played"] ?? 0]));
    const silent = read => Object.values(played(read)).every(n => n === 0);
    const LEDGER = `const F = await import("${repoUrl}/scripts/fog.mjs"); return F.discoveredFor("${IDS.scene}", "${IDS.aiko}");`;
    const aikoHere = await gm.eval(`${ACADEMY} const t = academy.tokens.get("TOKAIKO000000000"); return { x: t.x, y: t.y };`);
    await gm.eval(`await game.settings.set("${MOD}", "regionFog", false); return true;`, { timeout: 60000 });
    await settle(1500);
    const offWalk = await measure("E51 C3", "the fog off: Aiko into the Cafeteria", () => gm.eval(`${ACADEMY}
        await academy.tokens.get("TOKAIKO000000000").update({ x: 1300, y: 650 }, ${MOVE}); return true;`));
    const offView = await p1.eval(`${VIEW} return view;`);
    const offLedger = await gm.eval(LEDGER);
    check("E51 C3: the fog off - Aiko written into the Cafeteria asks a room sound on no browser, and her player's browser keeps no fog layer and draws no outline (D43b = 1, E51-19)",
        silent(offWalk) && offView.layer === false && offView.outline === null && offView.off === true, J({ played: played(offWalk), offView }));
    check("E51 C3: the fog off - the primary GM's ledger still records the Cafeteria for Aiko (D43b = 1: the ledger keeps recording for the projects)",
        !ledger.includes("Cafeteria") && offLedger.includes("Cafeteria"), J({ ledger, offLedger }));
    await gm.eval(`${ACADEMY} await academy.tokens.get("TOKAIKO000000000").update(${J(aikoHere)}, ${MOVE}); return true;`);
    await settle(1200);
    await gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
        await F.setDiscovery(academy, { actorId: "${IDS.aiko}", rooms: ${J(ledger)}, value: ${ledger.length > 0} }); return true;`);
    await settle(800);
    const onAgain = await measure("E51 C3", "the fog switched back on", () => gm.eval(`await game.settings.set("${MOD}", "regionFog", true); return true;`, { timeout: 60000 }));
    const onView = await p1.eval(`${VIEW} return view;`);
    check("E51 C3: the fog switched back on asks a room sound on no browser - no burst for the rooms already known - and her player's fog no longer says it is off",
        silent(onAgain) && onView.off === false, J({ played: played(onAgain), onView }));

    const placed = await measure("E51 C3", "a token of Aiko's placed in the Gym", () => gm.eval(`${ACADEMY}
        const [t] = await academy.createEmbeddedDocuments("Token", [{ name: "S86 placed Aiko", actorId: "${IDS.aiko}", actorLink: true, x: 1700, y: 1600,
            width: 1, height: 1, hidden: false, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 }]);
        globalThis.__s86placed = t.id; return true;`));
    const placedView = await p1.eval(`${VIEW} if (FR.roomOutline) FR.roomOutline.__s86e51 = true; return view;`);
    check("E51 C3: a token of Aiko's placed in the Gym, a room she has not found, plays its arrival on her player's browser at once - the room's sound and its outline - and on no other (E51-20)",
        J(played(placed)) === J({ gm: 0, p1: 1, p2: 0, p3: 0, p4: 0 }) && placedView.outline === "Gym", J({ played: played(placed), placedView }));
    const stepped = await measure("E51 C3", "the placed token stepped inside the Gym", () => gm.eval(`${ACADEMY}
        await academy.tokens.get(globalThis.__s86placed).update({ x: 1600 }, ${MOVE}); return true;`));
    const steppedView = await p1.eval(`${VIEW} return view;`);
    check("E51 C3: the placed token's step inside the Gym plays nothing on any browser and draws the outline on her player's browser no second time (the room set it entered is remembered, `lastMineSignature`)",
        silent(stepped) && steppedView.outline === "Gym" && steppedView.marked === true, J({ played: played(stepped), steppedView }));
    await gm.eval(`${ACADEMY} const F = await import("${repoUrl}/scripts/fog.mjs");
        await academy.tokens.get(globalThis.__s86placed)?.delete(); delete globalThis.__s86placed;
        await F.setDiscovery(academy, { actorId: "${IDS.aiko}", rooms: ${J(ledger)}, value: ${ledger.length > 0} });
        const ST = await import("${repoUrl}/scripts/settings.mjs"); await ST.setSetting(ST.SETTINGS.sfxMap, ${J(sfxWas)}); return true;`, { timeout: 60000 });
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
