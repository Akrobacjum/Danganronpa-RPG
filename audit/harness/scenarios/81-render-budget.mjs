/**
 * What one event renders on every browser, and what each browser shows after it (E37 C5, 01.11.2026; E37-19 to E37-24).
 *
 * The plan's words for E37 (S17-19, S01-35, S07-26): the clock's change ran the visibility pass twice on every browser -
 * once from the bus's clock row and once from visibility.mjs's own listeners on `drpgTimeOfDayChanged` and
 * `drpgEclipseChanged`, which the same row fires - and a pause ran it once for nothing; a move of the Despair pool
 * rendered every student's sheet (E88 C4 took that early); and the incident's Remnants were judged again by no pass when
 * the incident's state or a participant's copy of its cast changed, so a copy that landed after a trace was drawn left
 * it hidden from its own participant. The risk the plan names: a pass taken away may leave another player's hidden
 * token on screen, so every event here is followed by the state check (86's `stateHolds`: each browser shows each
 * token as a whole pass run there and then would) and not only by its counts.
 *
 * The table: the GM and three players (p1 Aiko, p2 Botan, p3 Chie, found by name as lib/seed.mjs and
 * audit/live/seed-world.mjs name them). Counts are read off `game.drpg.counters()` on all four browsers around one
 * event at a time, from just before it to 1.5 s after (the bus's wait, the next frame's refresh), with a listener of the
 * scenario's own on each clock hook (added at A, removed at the end).
 *   A. one character sheet a browser (the GM also the Monokuma's): a real one where `actor.sheet.render(true)` registers
 *      in `foundry.applications.instances` (a real Foundry), else 86's counting stand-ins in `ui.windows` (the harness,
 *      whose actor sheet registers in neither) - each browser's kind is noted. Every sheet counts its renders.
 *   B. the time of day moved and put back (`setTimeOfDay`, then `setClock` with the old time and stamp): one
 *      `visibility.applyAll` a browser and `drpgTimeOfDayChanged` heard once each; one `hud.renderHud` and one
 *      `clock.refreshSheets` for the clock's write back, and at most one more of each for the move forward, whose end of
 *      the seals and silences is `SYNC.restrictions`'s row (B3's note).
 *   C. a pause (a clock write of `pausedAt` alone) and its end: no `drpgTimeOfDayChanged`, no `visibility.applyAll`.
 *   D. with Botan written into Dorm A beside Aiko (so the Eclipse changes what p1 shows), an Eclipse's start
 *      (`game.drpg.startEclipse`) and its end (`endEclipse({ advance: true })`): one `visibility.applyAll` each and
 *      `drpgEclipseChanged` heard once each; the clock and Botan put back after.
 *   E. a Despair write (`setDespair`): the Monokuma's sheet rendered once where one is open, the student's never, no
 *      status strip drawn (`playerStatus.render`).
 *   F. a trial turn's change: a Testimony started by the API, Aiko's turn called done from p1's page through the
 *      bridge's `requestTurn` (as 67 M drives it, without the GM's console): one `hud.renderHud` a browser, no sheet
 *      rendered (`clock.refreshSheets.rendered` 0) - the two counts 67 part M held until E37.
 *   G. the incident's Remnants (S07-26): an incident opened by the API (Chie the killer, Aiko the victim, as 13 does;
 *      Chie's own opening roll held on p3 and the GM ruling it a success), a Remnant placed in Dorm A: p2 (Botan, a
 *      bystander) never shows it, p1 and p3 do; on p3 the cast copy taken away (gm-stores.mjs `castCopy.forget`): the
 *      Remnant leaves p3's screen at once; a second Remnant placed while p3 holds no copy is hidden there; the copy given
 *      back by the road a late `CAST_MINE` packet takes (`castCopy.receive` with the stamps it held): both on p3's screen
 *      at once; after `endMurder` neither on any player's screen.
 *
 * WHAT THE COUNTS ARE. On the harness they are the module's work on the harness's model of a canvas and a sheet (as
 * 86's are), never a frame time or a real sheet's render: the real sheets and the real canvas are the local gate's
 * (LIVE-E37-01, audit/AUDIT-1.2.42.md 9.2, until a v14 sandbox runs it). For that layer `run` asks only what the sandbox
 * adapter gives (audit/live/sandbox-cluster.mjs `missingFrom`): no ids by constant, no harness-only page hook, no canary;
 * its own page state is `globalThis.drpg81` on each browser, taken away at the end. Put back: the clock, the Despair
 * pool, the trial's floor and phase, Botan's place and ledger, the incident, its Remnants and the chat cards written while
 * it ran, and since E37 C5b what B's move and the Eclipse refilled and moved on - every student's budget, the rooms'
 * Search tokens and the seals, read at A as `boundarySnapshot` gives them and written back at the end. The clock is
 * written back, not taken back.
 */
export const layers = ["ci", "local-gate"];
/* Measured on the harness 01.11.2026 (E37 C5, under the harness lock): 44.4 s, 44.8 s and 47.2 s by the cluster's own
   line. 300 s, the runner's default, is six times the slowest. */
export const timeoutMs = 300000;

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
/* Keys sorted at every depth: a store written back can hold its rooms in another order than it was read in. */
const sortedJson = value => JSON.stringify(value, (key, v) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v));
const MOVE = `{ teleport: true, movementAction: "displace", animate: false }`;
const NAMES = { aiko: "Aiko Hoshino", botan: "Botan Kage", chie: "Chie Mori" };
const OWN = { gm: NAMES.aiko, p1: NAMES.aiko, p2: NAMES.botan, p3: NAMES.chie };

export async function run({ gm, p1, p2, p3, check, note, phase, settle, repoUrl }) {
    const clients = { gm, p1, p2, p3 };
    const players = { p1, p2, p3 };
    const all = async code => Object.fromEntries(await Promise.all(Object.entries(clients).map(async ([who, c]) => [who, await c.eval(code(who))])));
    const actorId = name => `game.actors.find(a => a.name === ${J(name)})?.id`;

    /* ------------------------------ A. the table ------------------------------ */
    phase("A: the table - four browsers, a sheet each");
    const start = await gm.eval(`const C = await import("${repoUrl}/scripts/clock.mjs");
        const scene = canvas.scene;
        /* What B's move of the time of day and D's Eclipse refill and move on - every student's budget, the rooms' Search
           tokens, the seals (clock.mjs \`boundarySnapshot\`) - read before them and put back at the end, so the local gate's
           whole-world diff around this scenario names nothing it changed (E37 C5b; STATUS Open 26). */
        const boundary = await C.boundarySnapshot();
        return { clock: C.getClock(), boundary, messages: game.messages.map(m => m.id), scene: scene?.id ?? null,
            ids: { aiko: ${actorId(NAMES.aiko)} ?? null, botan: ${actorId(NAMES.botan)} ?? null, chie: ${actorId(NAMES.chie)} ?? null },
            despair: game.drpg.getDespair(game.user.id), murder: Boolean(game.drpg.murderState()) };`, { timeout: 60000 });
    check("A1: the table is as seeded - Aiko, Botan and Chie, a scene on screen, Daily Life, no Eclipse and no incident",
        start.ids.aiko && start.ids.botan && start.ids.chie && start.scene && start.clock?.phase === "dailyLife"
            && start.clock?.eclipse !== true && !start.murder, J(start));
    const ids = start.ids;

    const sheets = await all(who => `const S = globalThis.drpg81 = { heard: { timeOfDay: 0, eclipse: 0 }, hooks: [], sheets: [], kind: null };
        S.hooks.push(["drpgTimeOfDayChanged", Hooks.on("drpgTimeOfDayChanged", () => { S.heard.timeOfDay++; })]);
        S.hooks.push(["drpgEclipseChanged", Hooks.on("drpgEclipseChanged", () => { S.heard.eclipse++; })]);
        const student = game.actors.find(a => a.name === ${J(OWN[who])});
        const monokuma = ${who === "gm"} ? game.actors.find(a => a.type === "character" && a.getFlag("${MOD}", "monokuma")) : null;
        const registered = app => [...(foundry.applications?.instances?.values() ?? [])].includes(app);
        const count = (key, app) => { const render = app.render; const row = { key, app, renders: 0, own: Object.hasOwn(app, "render") ? render : null };
            app.render = function (...args) { row.renders++; return render.apply(this, args); }; S.sheets.push(row); };
        /* A real sheet first: rendered, and counted where it registers as an application. */
        const real = student?.sheet;
        try { await real?.render(true); } catch { /* the stand-ins below */ }
        const end = Date.now() + 5000;
        while (real && !registered(real) && Date.now() < end && real.rendered !== false) await new Promise(r => setTimeout(r, 100));
        if (real && registered(real)) {
            S.kind = "real";
            count("student", real);
            if (monokuma) {
                await monokuma.sheet.render(true);
                const until = Date.now() + 5000;
                while (!registered(monokuma.sheet) && Date.now() < until) await new Promise(r => setTimeout(r, 100));
                if (registered(monokuma.sheet)) count("monokuma", monokuma.sheet);
            }
        } else {
            /* 86's stand-ins in the registry the sheet pass walks (clock.mjs refreshSheets): this browser's student and a
               Monokuma, each counting its renders - on every browser, as 86 plants them. */
            S.kind = "stand-in";
            const mono = monokuma ?? game.actors.find(a => a.type === "character" && a.getFlag("${MOD}", "monokuma"));
            for (const [key, doc] of [["student", student], ["monokuma", mono]]) {
                if (!doc) continue;
                const app = { appId: "drpg81-" + key, id: "drpg81-" + key, document: doc, rendered: true, element: null, position: {},
                    render() { return this; }, bringToTop() {}, async close() {} };
                ui.windows[app.appId] = app;
                count(key, app);
                S.sheets.at(-1).planted = true;
            }
        }
        return { kind: S.kind, sheets: S.sheets.map(r => r.key) };`);
    note("A: the sheets each browser counts", J(sheets));
    check("A2: every browser holds its student's sheet, counted (a real sheet or the harness's stand-in, noted)",
        Object.values(sheets).every(s => s?.sheets?.includes("student")), J(sheets));
    // The boot's own writes (the migration's stamp, the first fog repaint) land in the first seconds: waited out.
    await settle(3000);

    /* ------------------------------ one event, read everywhere ------------------------------ */
    const SNAP = `const S = globalThis.drpg81; const c = await game.drpg.counters();
        S.before = { counts: c.counts, heard: { ...S.heard }, renders: Object.fromEntries(S.sheets.map(r => [r.key, r.renders])) };
        return true;`;
    const READ = `const S = globalThis.drpg81; const c = await game.drpg.counters(); const b = S.before;
        const moved = {}; for (const [k, v] of Object.entries(c.counts)) { const d = v - (b.counts[k] ?? 0); if (d) moved[k] = d; }
        const renders = Object.fromEntries(S.sheets.map(r => [r.key, r.renders - (b.renders[r.key] ?? 0)]));
        delete S.before;
        return { moved, heard: { timeOfDay: S.heard.timeOfDay - b.heard.timeOfDay, eclipse: S.heard.eclipse - b.heard.eclipse }, renders };`;
    const measure = async (event, act, wait = 1500) => {
        await Promise.all(Object.values(clients).map(c => c.eval(SNAP)));
        const acted = await act();
        await settle(wait);
        const read = {};
        for (const [who, c] of Object.entries(clients)) read[who] = await c.eval(READ);
        note(event, Object.entries(read).map(([who, r]) => `${who}: ${J({ ...r.moved, heard: r.heard, renders: r.renders })}`).join(" | "));
        return { read, acted };
    };
    const n = (read, who, key) => read[who]?.moved?.[key] ?? 0;
    const each = (read, test) => Object.keys(clients).every(who => test(who, read[who]));
    const counts = (read, ...keys) => J(Object.fromEntries(Object.entries(read).map(([who, r]) =>
        [who, Object.fromEntries([...keys.map(k => [k, r.moved[k] ?? 0]), ["heard", r.heard], ["renders", r.renders]])])));

    /* Each token as this browser shows it now, against a whole pass run there and then (its refreshes flushed): a token
       shown or hidden otherwise is named (86's `stateHolds`). */
    const STATE = `const V = await import("${repoUrl}/scripts/visibility.mjs");
        const shown = () => Object.fromEntries(canvas.tokens.placeables.map(t => [t.id, Boolean(t.visible)]));
        const now = shown();
        V.applyAll();
        await new Promise(r => setTimeout(r, 250));
        const fresh = shown();
        return { off: Object.keys(fresh).filter(id => fresh[id] !== now[id]).map(id => [canvas.tokens.get(id)?.name ?? id, now[id], fresh[id]]),
            tokens: Object.keys(now).length };`;
    const stateHolds = async (label, event) => {
        const read = {};
        for (const [who, c] of Object.entries(clients)) read[who] = await c.eval(STATE);
        check(`${label}: after ${event} every browser shows each token as a whole pass run there would (E37-21)`,
            Object.values(read).every(r => r?.tokens > 0 && r.off.length === 0), J(read));
        return read;
    };
    const CLOCK = `const C = await import("${repoUrl}/scripts/clock.mjs");`;

    /* ------------------------------ B. the time of day ------------------------------ */
    phase("B: a move of the time of day");
    const moves = [];
    moves.push(await measure("B: setTimeOfDay forward", () => gm.eval(`${CLOCK}
        const { TIMES_OF_DAY } = await import("${repoUrl}/scripts/config.mjs");
        const before = C.getClock();
        await C.setTimeOfDay(TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(before.timeOfDay) + 1) % TIMES_OF_DAY.length], { resetSearchTokens: false });
        return C.getClock().timeOfDay;`, { timeout: 60000 })));
    await stateHolds("B1", "the time of day moved");
    moves.push(await measure("B: the time of day put back", () => gm.eval(`${CLOCK}
        await C.setClock({ timeOfDay: ${J(start.clock.timeOfDay)}, timeOfDayStartedAt: ${J(start.clock.timeOfDayStartedAt ?? null)},
            day: ${J(start.clock.day)} });
        return C.getClock().timeOfDay;`, { timeout: 60000 })));
    await stateHolds("B2", "the time of day put back");
    /* `setTimeOfDay` also ends the time of day's seals and silences (call-effects.mjs `clearSeals`: `sealedRooms` and
       `restrictions` written and announced), which is `SYNC.restrictions`'s row - the sheets and the HUD once more, no
       pass: read off the bus's debug lines on p1 and the GM, 01.11.2026. The clock written back by `setClock` asks the
       clock's row alone. */
    const [forward, back] = moves;
    check(`B3: the time of day moved (${forward.acted}): one visibility pass on each browser, drpgTimeOfDayChanged heard once, the HUD and a sheet pass for the clock and at most once more for the seals' end (E37-20)`,
        each(forward.read, who => n(forward.read, who, "visibility.applyAll") === 1 && forward.read[who].heard.timeOfDay === 1
            && [n(forward.read, who, "hud.renderHud"), n(forward.read, who, "clock.refreshSheets")].every(v => v >= 1 && v <= 2)),
        counts(forward.read, "visibility.applyAll", "hud.renderHud", "clock.refreshSheets"));
    check(`B4: the time of day put back (${back.acted}): one visibility pass, one HUD and one sheet pass on each browser, drpgTimeOfDayChanged heard once (E37-20)`,
        each(back.read, who => n(back.read, who, "visibility.applyAll") === 1 && n(back.read, who, "hud.renderHud") === 1
            && n(back.read, who, "clock.refreshSheets") === 1 && back.read[who].heard.timeOfDay === 1),
        counts(back.read, "visibility.applyAll", "hud.renderHud", "clock.refreshSheets"));

    /* ------------------------------ C. a pause ------------------------------ */
    phase("C: a pause");
    const pause = [];
    pause.push(await measure("C: paused", () => gm.eval(`${CLOCK} await C.setClock({ pausedAt: Date.now() }); return C.getClock().pausedAt !== null;`, { timeout: 60000 })));
    pause.push(await measure("C: the pause put back", () => gm.eval(`${CLOCK}
        await C.setClock({ pausedAt: ${J(start.clock.pausedAt ?? null)}, pausedTotalMs: ${J(start.clock.pausedTotalMs ?? 0)} });
        return C.getClock().pausedAt ?? null;`, { timeout: 60000 })));
    await stateHolds("C1", "a pause and its end");
    pause.forEach(({ read }, k) => check(`C${2 + k}: ${k ? "the pause's end" : "a pause"} runs no visibility pass and tells no drpgTimeOfDayChanged on any browser (E37-20)`,
        each(read, who => n(read, who, "visibility.applyAll") === 0 && read[who].heard.timeOfDay === 0),
        counts(read, "visibility.applyAll", "hud.renderHud")));

    /* ------------------------------ D. an Eclipse ------------------------------ */
    phase("D: an Eclipse's start and end, Botan beside Aiko");
    const botanAt = await gm.eval(`const t = canvas.scene.tokens.find(d => d.actorId === "${ids.botan}" && !d.getFlag("${MOD}", "isRemnant"));
        const F = await import("${repoUrl}/scripts/fog.mjs");
        return t ? { id: t.id, x: t.x, y: t.y, ledger: F.discoveredFor(canvas.scene.id, "${ids.botan}") } : null;`);
    const aikoAt = await gm.eval(`const t = canvas.scene.tokens.find(d => d.actorId === "${ids.aiko}" && !d.getFlag("${MOD}", "isRemnant")); return t ? { x: t.x, y: t.y } : null;`);
    await gm.eval(`await canvas.scene.tokens.get(${J(botanAt?.id)}).update({ x: ${(aikoAt?.x ?? 300) + 200}, y: ${aikoAt?.y ?? 300} }, ${MOVE}); return true;`);
    await settle(1500);
    const beside = await p1.eval(`return Boolean(canvas.tokens.get(${J(botanAt?.id)})?.visible);`);
    check("D1: Botan written into Aiko's room is on p1's screen before the Eclipse", beside === true, J({ botanAt, aikoAt, beside }));
    await stateHolds("D2", "Botan written beside Aiko");
    const eclipseStart = await measure("D: an Eclipse started", () => gm.eval(`await game.drpg.startEclipse(); return game.drpg.isEclipse();`, { timeout: 60000 }), 2000);
    const dark = await p1.eval(`return Boolean(canvas.tokens.get(${J(botanAt?.id)})?.visible);`);
    await stateHolds("D3", "an Eclipse's start");
    const eclipseEnd = await measure("D: the Eclipse ended", () => gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        await E.endEclipse({ advance: true }); return game.drpg.isEclipse();`, { timeout: 60000 }), 2000);
    const light = await p1.eval(`return Boolean(canvas.tokens.get(${J(botanAt?.id)})?.visible);`);
    await stateHolds("D4", "an Eclipse's end");
    check("D5: the Eclipse started and ended, Botan off p1's screen in it and back on it after",
        eclipseStart.acted === true && eclipseEnd.acted === false && dark === false && light === true, J({ dark, light }));
    [eclipseStart, eclipseEnd].forEach(({ read }, k) => check(`D${6 + k}: an Eclipse's ${k ? "end" : "start"}: one visibility pass on each browser, drpgEclipseChanged heard once (E37-20)`,
        each(read, who => n(read, who, "visibility.applyAll") === 1 && read[who].heard.eclipse === 1),
        counts(read, "visibility.applyAll", "hud.renderHud", "clock.refreshSheets")));
    await gm.eval(`${CLOCK} const c = ${J(start.clock)};
        await C.setClock({ season: c.season, chapter: c.chapter, day: c.day, session: c.session, timeOfDay: c.timeOfDay,
            timeOfDayStartedAt: c.timeOfDayStartedAt ?? null, eclipse: false });
        await canvas.scene.tokens.get(${J(botanAt?.id)}).update({ x: ${botanAt?.x ?? 1300}, y: ${botanAt?.y ?? 300} }, ${MOVE});
        return true;`, { timeout: 60000 });
    await settle(1500);
    if (botanAt && !botanAt.ledger.includes("Dorm A")) await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs");
        await F.setDiscovery(canvas.scene, { actorId: "${ids.botan}", rooms: ["Dorm A"], value: false }); return true;`);
    await settle(800);
    await stateHolds("D8", "the clock and Botan put back");

    /* ------------------------------ E. a Despair write ------------------------------ */
    phase("E: a Despair write");
    const pool = await measure("E: the GM's Despair pool written", () => gm.eval(`await game.drpg.setDespair(game.user.id, ${Number(start.despair) === 3 ? 4 : 3}); return true;`));
    check("E1: a Despair write renders the Monokuma's sheet once where one is open and no student's, and draws no status strip, on every browser (E37-23)",
        each(pool.read, (who, r) => r.renders.student === 0 && (r.renders.monokuma ?? 1) === 1 && n(pool.read, who, "playerStatus.render") === 0),
        counts(pool.read, "clock.refreshSheets", "clock.refreshSheets.rendered", "playerStatus.render"));
    await stateHolds("E2", "a Despair write");
    await gm.eval(`await game.drpg.setDespair(game.user.id, ${J(start.despair)}); return true;`);
    await settle(800);

    /* ------------------------------ F. a trial turn ------------------------------ */
    phase("F: a trial turn's change");
    const FLOOR = `const F = await import("${repoUrl}/scripts/trial-floor.mjs");`;
    await gm.eval(`${CLOCK} await C.setClock({ phase: "classTrial" }); await game.settings.set("${MOD}", "trialQueue", {});
        await game.drpg.startTestimony({ seconds: 60, order: ${J([ids.aiko, ids.botan, ids.chie])} }); return true;`, { timeout: 60000 });
    await settle(1500);
    const turn = await measure("F: Aiko's turn called done from p1's page", () => p1.eval(`${FLOOR}
        const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestTurn({ actorId: "${ids.aiko}", kind: "done", step: F.trialFloor()?.round?.step ?? 0 });
        return res.ok === true;`, { timeout: 30000 }));
    const holder = await p2.eval(`${FLOOR} return F.trialFloor()?.holderId ?? null;`);
    check("F1: p1 calls Aiko's turn done: the floor is Botan's on p2", turn.acted === true && holder === ids.botan, J({ acted: turn.acted, holder }));
    check("F2: the turn's change draws the HUD once on each browser and renders no sheet (E37-23; 67 part M's two counts until E37)",
        each(turn.read, who => n(turn.read, who, "hud.renderHud") === 1 && n(turn.read, who, "clock.refreshSheets.rendered") === 0),
        counts(turn.read, "hud.renderHud", "clock.refreshSheets.rendered"));
    await stateHolds("F3", "a trial turn's change");
    await gm.eval(`${FLOOR} if (F.trialFloor()) await game.drpg.endMode();
        await game.settings.set("${MOD}", "trialQueue", {});
        ${CLOCK} await C.setClock({ phase: ${J(start.clock.phase)}, timeOfDayStartedAt: ${J(start.clock.timeOfDayStartedAt ?? null)} }); return true;`, { timeout: 60000 });
    await settle(1500);

    /* ------------------------------ G. the incident's Remnants ------------------------------ */
    phase("G: the incident's Remnants (S07-26)");
    const HELD = `const a = game.actors.get("${ids.chie}"); globalThis.drpg81.held = [];
        a.rollTrait = function () { return new Promise(r => globalThis.drpg81.held.push(r)); };
        return true;`;
    const RELEASE = `const a = game.actors.get("${ids.chie}"); delete a.rollTrait;
        const held = globalThis.drpg81.held ?? []; delete globalThis.drpg81.held; for (const r of held) r(null); return held.length;`;
    await p3.eval(HELD);
    const opened = await gm.eval(`const out = await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}", openingTrait: "body" });
        return out?.stage ?? null;`, { timeout: 60000 });
    await settle(900);
    await gm.eval(`await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true }); return true;`, { timeout: 60000 });
    await settle(1200);
    const released = await p3.eval(RELEASE);
    const PLACE = label => `const t = await game.drpg.placeRemnant({ type: "incident", visibility: "evident", x: ${(aikoAt?.x ?? 300) + 100}, y: ${(aikoAt?.y ?? 300) + 150},
        scene: canvas.scene, note: "S81 ${label}" });
        return t ? { id: t.id, hidden: t.hidden, marked: Boolean(t.getFlag("${MOD}", "fromIncident")) } : null;`;
    const first = await gm.eval(PLACE("an incident's trace"), { timeout: 60000 });
    await settle(1500);
    const SEEN = list => `return ${J(list)}.map(id => { const t = canvas.tokens.get(id); return t ? Boolean(t.visible) : null; });`;
    const atFirst = {};
    for (const [who, c] of Object.entries(players)) atFirst[who] = await c.eval(SEEN([first?.id]));
    check("G1: the incident opened and its Remnant is placed un-hidden and marked; p1 (the victim) and p3 (the killer) show it, p2 (a bystander) does not",
        opened && released === 1 && first?.hidden === false && first.marked
            && atFirst.p1[0] === true && atFirst.p3[0] === true && atFirst.p2[0] === false, J({ opened, released, first, atFirst }));
    await stateHolds("G2", "an incident's Remnant placed");

    /* Through the copy's own road (gm-stores.mjs `castCopy`): `forget` takes this browser's copy away, and `receive` with
       the stamps it held is what incident-store.mjs's `CAST_MINE` listener calls when the primary's packet lands. */
    const COPY = `const G = await import("${repoUrl}/scripts/gm-stores.mjs");`;
    const copy = await p3.eval(`${COPY} globalThis.drpg81.cast = { value: G.castCopy.read(), stamps: G.castCopy.stamps() };
        await G.castCopy.forget();
        return Object.keys(globalThis.drpg81.cast.value ?? {}).length;`);
    await settle(600);
    const away = await p3.eval(SEEN([first?.id]));
    check("G3: on p3 the cast copy taken away: the Remnant leaves p3's screen at once (E37-22)", copy > 0 && away[0] === false, J({ copy, away }));
    await stateHolds("G4", "p3's cast copy taken away");
    const second = await gm.eval(PLACE("a trace placed before p3's copy came back"), { timeout: 60000 });
    await settle(1500);
    const beforeCopy = { p1: await p1.eval(SEEN([second?.id])), p3: await p3.eval(SEEN([second?.id])) };
    const given = await p3.eval(`${COPY} const held = globalThis.drpg81.cast; delete globalThis.drpg81.cast;
        return G.castCopy.receive(held.value, held.stamps);`);
    await settle(600);
    const late = await p3.eval(SEEN([first?.id, second?.id]));
    check("G5: a Remnant placed while p3 held no copy is on p1's screen and not p3's; the copy given back, both are on p3's screen at once (E37-22)",
        beforeCopy.p1[0] === true && beforeCopy.p3[0] === false && given === true && late[0] === true && late[1] === true, J({ second, beforeCopy, given, late }));
    await stateHolds("G6", "p3's cast copy given back");

    await gm.eval(`await game.drpg.endMurder({ reason: "suite", followUp: false }); return true;`, { timeout: 60000 });
    await settle(1500);
    const closed = {};
    for (const [who, c] of Object.entries(players)) closed[who] = await c.eval(SEEN([first?.id, second?.id]));
    check("G7: after endMurder neither Remnant nobody copied is on any player's screen (E37-22)",
        Object.values(closed).every(r => r[0] === false && r[1] === false), J(closed));
    await stateHolds("G8", "the incident closed");

    /* ------------------------------ put back ------------------------------ */
    phase("put back");
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        for (const id of ${J([first?.id, second?.id].filter(Boolean))}) {
            const t = canvas.scene.tokens.get(id); if (!t) continue;
            try { await R.dropRemnantSecret(t); } catch { /* nothing filed */ }
            await t.delete();
        }
        if (game.drpg.murderState()) await game.drpg.endMurder({ reason: "suite", followUp: false });
        ${CLOCK} const c = ${J(start.clock)};
        await C.setClock({ season: c.season, chapter: c.chapter, day: c.day, session: c.session, timeOfDay: c.timeOfDay, phase: c.phase,
            timeOfDayStartedAt: c.timeOfDayStartedAt ?? null, pausedAt: c.pausedAt ?? null, pausedTotalMs: c.pausedTotalMs ?? 0, eclipse: false });
        const keep = new Set(${J(start.messages)});
        const fresh = game.messages.filter(m => !keep.has(m.id)).map(m => m.id);
        if (fresh.length) await ChatMessage.deleteDocuments(fresh);
        const b = ${J(start.boundary)};
        const A = await import("${repoUrl}/scripts/actions.mjs");
        const { SearchTokens } = await import("${repoUrl}/scripts/search-tokens.mjs");
        const W = await import("${repoUrl}/scripts/call-world.mjs");
        await A.putBackBudgets(b.actions);
        await SearchTokens.putBack(b.tokens);
        await W.putBackSeals({ sealed: b.sealed, restrictions: b.restrictions });
        return true;`, { timeout: 60000 });
    await settle(1200);
    const boundaryNow = await gm.eval(`${CLOCK} return C.boundarySnapshot();`, { timeout: 60000 });
    check("put back: every student's budget, the rooms' Search tokens and the seals as the scenario found them (E37 C5b)",
        sortedJson(boundaryNow) === sortedJson(start.boundary), J({ was: start.boundary, now: boundaryNow }));
    const left = await all(() => `const S = globalThis.drpg81;
        for (const [name, id] of S.hooks) Hooks.off(name, id);
        for (const row of S.sheets) {
            if (row.planted) delete ui.windows[row.app.appId];
            else { if (row.own) row.app.render = row.own; else delete row.app.render; try { await row.app.close(); } catch { /* closed */ } }
        }
        delete globalThis.drpg81;
        return Object.keys(ui.windows).filter(k => k.startsWith("drpg81-")).length;`);
    check("put back: every browser's sheets, listeners and page state taken away", Object.values(left).every(v => v === 0), J(left));
}
