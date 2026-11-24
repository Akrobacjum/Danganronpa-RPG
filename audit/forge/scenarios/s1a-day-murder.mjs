/**
 * S1a on Forge: a day with two GMs, an Eclipse, and a Direct Murder's opening (the road to 2.0, F3, S1; 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s1a-day-murder
 * NEVER RUN on Forge before its first run (run.mjs); written 24.11.2026 and not yet run anywhere.
 *
 * WHAT IT CLAIMS. Each check is the owner's 2.0 decision (docs/dev/v2/DECISIONS.md) or a triage row (docs/dev/v2/F1-*.md),
 * named in its `ids`; on 1.2.129 the checks of a known defect fail (the baseline) and pass once 2.0 is in. A check with
 * ids ["FLOW"] is the scenario's own road (a ruling reached its player, a move was counted) and names no triage row.
 *   MURDER-01   outside an Eclipse the killer's token stays on the victim's and a witness's map until the opening's result
 *   D2-12       on Hope or a critical outside an Eclipse the "?" goes on at once (within 3 s of the stage the page saw)
 *   D2-08/D2-10 a failed opening tells the victim of the attempt, and names nobody
 *   D2-09/D2-11 the opening roll and a crisis roll give no Hope and no Despair; an ordinary roll (two Daily Life
 *               Dynamic actions, and a bystander's during the incident) moves them as its dice say (the control)
 *   D2-06       the victim survived: the "?" stays after the incident's end (MURDER-02), and comes off when the killer
 *               leaves the room
 *   MURDER-03   the dead victim (a Spectator from the death) does not read the masked killer's name over the "?"
 *   EXP-PL-02   the Eclipse road: a declaration refused at the lights does not make the killer's token appear in the
 *               victim's room after dawn
 *   DAY-01      the morning line GM1 wrote shows when GM2 starts the Morning Eclipse
 *
 * PHASES.
 *   setup       the page kit in every browser (lib/s1-kit.mjs); the world read on GM1; a running Eclipse ended without
 *               advancing, a running incident closed, the phase put to Daily Life and a dead P1-P4 revived, where found;
 *               four rooms of the active scene picked by the module's room code (rooms.mjs `roomNames` without the
 *               bedrooms, movement.mjs `neighbouringRooms`): the crime's room M (P1, P2), A (P3) and C (P4), each with a
 *               neighbour that is not M, and K (the Monokumas GM1 and GM2); tokens created where absent and moved; the
 *               game unpaused; P3 and P4 given their actions back where they have fewer than 2.
 *   rulings     P3's Dynamic action ruled by GM1, P4's by GM2, from the ruling card (messenger-app.mjs `pressCard`) and
 *               the difficulty window; each roll pressed in the player's roll window.
 *   clock       GM1 moves the clock one time of day (skipped when it is Night), then on to Night.
 *   eclipse     GM1 writes a morning line (its own browser's draft, gm-campaign.mjs's setting); GM2 starts the Morning
 *               Eclipse; P3 and P4 each cross into a neighbouring room; P1 declares a Direct Murder from the sheet's
 *               road (`performAction`, the confirm and the note windows answered on P1's page); GM1 ends the Eclipse
 *               and, 5 s after the lights' window "Open the incident?" appears, answers it No - P2's canvas sampled
 *               throughout.
 *   incident-A  P3 joins P1 and P2 in M; GM1 opens P1 -> P2 (`openMurder`, the Murder window's road, Body); P1's
 *               page presses the opening's roll window. Up to 3 openings until one masks: each a failure (D2-08/10),
 *               a Despair success (no mask: closed, opened again) or a mask (D2-12). In the first fight: P4's Dynamic
 *               action as a bystander (ruled by GM2), then P2's crisis action from P2's page (Survive where it is
 *               listed). Then D2-06: the incident ends - by the crisis, or GM1's End the murder - and P1 is moved
 *               into P4's room.
 *   incident-B  P1 and P3 in M, P2 moved to A (so that s1b's finders were at no death); GM1 opens P1 -> P3, up to
 *               3 openings until one succeeds; GM1 marks P3 dead (the Students window's Kill, `killCharacter`) and
 *               answers "Stage 6" in the window it raises; MURDER-03 read on P3's page.
 *   end         the kit's standing answers stopped; GM1's and GM2's morning drafts put back.
 *
 * DICE. Nothing is forced. The opening's band is read off the roll (despair-award.mjs `readDuality`) and the stage
 * GM1 holds, and the run branches: a check that the outcome did not reach is a note "UNMEASURED this run", never a
 * pass. The killer's opening beats 8 (config.mjs MURDER_OPENING), so a failure - D2-08/D2-10 - comes up in about
 * one run in seven or eight (2d12 + the statistic under 8; not measured); a run that never fails measures neither.
 *
 * WHAT IT LEAVES (s1b-case-trial's starting state): Morning of the next day, Daily Life, an incident P1 -> P3 at Stage 6
 * with P3's body not found, P1 and P3 in room M, P2 in room A, P4 in the room it crossed to, the game unpaused. Each run moves
 * the clock to the next morning and on; the scenario sets up from whatever time it finds.
 *
 * WHAT IT WRITES (all in the test world; the note "what this run wrote" lists it): tokens created and moved; the pause;
 * the clock (one time of day, then to Night, the Morning Eclipse and its end); P3's and P4's actions where refilled;
 * two Dynamic actions and their cards; one Direct Murder declaration; up to six incidents with their cards, masks and
 * whispers; P3 marked dead; GM1's and GM2's client setting `morningLineDraft` (their browsers' storage), put back.
 *
 * UNMEASURED - ASSUMPTIONS NOT CONFIRMED ON FORGE (read in the code, never run there):
 *   - that `import()` of the module's files from the URL the browser loaded them from answers the module's own
 *     instances on Forge (lib/s1-kit.mjs; `install` reports `fromEntries` per page in the note "kit");
 *   - that Daggerheart 2.12.8's roll window is `game.system.api.dice.DualityRoll.DefaultDialog` with a
 *     `submitRoll` button, as tests-tier2.mjs `pressingRoll` reads it;
 *   - that a player's own token update into a neighbouring room is counted as an Eclipse crossing (v14's movement
 *     rules may refuse a straight `update` through a wall; the move's check says so if it does);
 *   - that "drawn" (the placeable's and the mesh's `visible`, the mesh's alpha) is what the player sees: the module
 *     hides a token by those (visibility.mjs `hide`); a frame rendered between two samples (100 ms) is not read;
 *   - that GM1's End the murder after a crisis roll is a "victim survived" end for D2-06 when Survive did not hit
 *     (the decision names the incident's end with the victim alive; the road is said in the check's details);
 *   - what 2.0's notice to the victim of a failed opening looks like (D2-08): any notice, popup, window or whisper
 *     to P2 in the 4 s after the result counts.
 */

import { kit, J, readWorld, pickRooms, placeTokens, unpause, readyPlayers, i18n, dynamicAction, economyAsDiceSay,
    runOpening, resultSeenAt, crisisRoll, closeIncident, playerMove, series, firstWhere } from "./lib/s1-kit.mjs";

export const meta = {
    id: "s1a-day-murder",
    title: "A day with two GMs, an Eclipse and a Direct Murder's opening",
    roles: ["gm1", "gm2", "p1", "p2", "p3", "p4"],
    writes: true,
    triage: ["MURDER-01", "D2-12", "D2-08", "D2-10", "D2-09", "D2-11", "D2-06", "MURDER-02", "MURDER-03", "EXP-PL-02", "DAY-01"]
};

const RUN = Date.now().toString(36);
const OPENINGS = 3;

export async function run(ctx) {
    const { check, note, phase, settle } = ctx;
    const K = kit(ctx);
    const wrote = [];
    const drafts = {};
    try {
        // ---------------------------------------------------------------- setup
        phase("setup");
        const missing = meta.roles.filter(r => !ctx.c[r]);
        if (missing.length) throw new Error(`not logged in: ${missing.join(", ")} - every role is needed`);
        const kits = {};
        for (const role of meta.roles) kits[role] = await K.install(role);
        note("kit", J(kits));
        const L = await i18n(K, "gm1", ["DRPG.Mask.askTitle", "DRPG.Action.murderOpensTitle", "DRPG.Chapter.stageSixTitle"]);

        await K.on("gm1", `F.auto("pre-lights", { title: ${J(L["DRPG.Action.murderOpensTitle"])}, press: "no" }); return true;`);
        const pre = await K.on("gm1", `
            const wrote = [];
            if (game.drpg.isEclipse()) { await game.drpg.endEclipse({ advance: false }); wrote.push("a running Eclipse ended without advancing"); }
            const s = game.drpg.murderState();
            if (s?.active) { await game.drpg.endMurder({ reason: "closed", followUp: false }); wrote.push("a running incident closed (stage " + s.stage + ")"); }
            if (game.drpg.getClock().phase !== "dailyLife") { const was = game.drpg.getClock().phase; await game.drpg.setPhase("dailyLife"); wrote.push("phase " + was + " -> dailyLife"); }
            for (const n of ["P1", "P2", "P3", "P4"]) {
                const a = game.actors.getName(n);
                if (a && game.drpg.isDeadForGm(a)) { await game.drpg.reviveCharacter(a, { quiet: true }); wrote.push(n + " revived"); }
            }
            await F.sleep(1500);
            return wrote;`, { timeout: 180_000 });
        await K.on("gm1", `return F.stopAuto("pre-lights");`);
        wrote.push(...pre);

        let world = await readWorld(K);
        note("world as found", J({ scene: world.sceneName, isPlace: world.isPlace, rooms: world.rooms.length, clock: world.clock,
            paused: world.paused, primary: world.primary, actors: world.actors }));
        const A = world.actors;
        for (const n of ["P1", "P2", "P3", "P4"]) if (!A[n]?.id) throw new Error(`no actor named ${n}`);
        if (!world.isPlace) throw new Error(`the active scene "${world.sceneName}" holds no room`);
        const plan = pickRooms(world, { count: 4, movers: 2 });
        if (!plan) throw new Error(`the active scene's rooms do not give four rooms with the neighbours this needs: ${J(world.nb)}`);
        const [M, RA, RC, RK] = plan.rooms;
        const toA = plan.moves[RA], toC = plan.moves[RC];
        note("rooms", J({ crime: M, p3: RA, p3crosses: toA, p4: RC, p4crosses: toC, monokumas: RK }));

        const monos = ["GM1", "GM2"].map(n => A[n]).filter(a => a?.id);
        const placed = await placeTokens(K, { [A.P1.id]: M, [A.P2.id]: M, [A.P3.id]: RA, [A.P4.id]: RC,
            ...Object.fromEntries(monos.map(a => [a.id, RK])) });
        wrote.push(...placed.wrote);
        if (placed.missing.length) throw new Error(`could not place: ${placed.missing.join(", ")}`);
        if (await unpause(K)) wrote.push("the game unpaused");
        const refilled = await K.on("gm1", `const out = [];
            for (const id of ${J([A.P3.id, A.P4.id])}) { const a = game.actors.get(id);
                if (game.drpg.actionsLeft(a) < 2) { await game.drpg.resetActionsFor(a); out.push(a.name + "'s actions refilled"); } }
            return out;`);
        wrote.push(...refilled);
        world = await readWorld(K);
        const T = Object.fromEntries(["P1", "P2", "P3", "P4"].map(n => [n, world.actors[n].token]));
        await readyPlayers(K, ["p1", "p2", "p3", "p4"], world.scene, { rollDelay: 2500 });
        await readyPlayers(K, ["gm1", "gm2"], world.scene, { rollDelay: 1500 });
        // The killer is asked "Stay hidden?" when the "?" goes on (mask-gm.mjs `askReveal`): P1 stays hidden.
        await K.on("p1", `F.auto("mask", { title: ${J(L["DRPG.Mask.askTitle"])}, press: "stay" }); return true;`);

        // ---------------------------------------------------------------- rulings
        phase("rulings");
        const rulings = [
            { role: "p3", actorId: A.P3.id, gm: "gm1", tag: "p3", words: `S1A ${RUN}: P3 tries to pry open the vending machine's coin box` },
            { role: "p4", actorId: A.P4.id, gm: "gm2", tag: "p4", words: `S1A ${RUN}: P4 tries to rig the classroom door to creak` }
        ];
        for (const r of rulings) {
            const out = await dynamicAction(ctx, K, r);
            const gmName = r.gm === "gm1" ? "GM1" : "GM2";
            check(`flow: ${r.tag.toUpperCase()}'s Daily Life Dynamic action, ruled by ${gmName} from its card, is rolled and ends`,
                out.ok, J({ why: out.why, asked: out.asked?.ok, card: Boolean(out.card), ruled: out.ruled?.ok, press: out.press, job: out.job, duality: out.duality }),
                { ids: ["FLOW"] });
            if (out.ok && out.econ.informative) {
                check(`D2-11 (control): ${r.tag.toUpperCase()}'s ordinary roll moves Hope and Despair as its dice say`,
                    economyAsDiceSay(out.econ, out.duality), J({ duality: out.duality, econ: out.econ, before: out.before, after: out.after }), { ids: ["D2-11"] });
            } else note(`UNMEASURED this run: D2-11 control on ${r.tag.toUpperCase()}'s roll`, J({ ok: out.ok, econ: out.econ, duality: out.duality }));
        }

        // ---------------------------------------------------------------- clock
        phase("clock");
        const c0 = await K.on("gm1", "return F.safe(game.drpg.getClock());");
        if (c0.timeOfDay !== "night") {
            const moved = await K.on("gm1", `await game.drpg.advanceTimeOfDay(); await F.sleep(2500); return F.safe(game.drpg.getClock());`, { timeout: 90_000 });
            wrote.push(`the clock ${c0.timeOfDay} -> ${moved.timeOfDay}`);
            const seen = {};
            for (const role of ["p1", "p2", "p3", "p4"]) seen[role] = await K.until(role, `const c = game.drpg.getClock(); return c.timeOfDay === ${J(moved.timeOfDay)} ? c.timeOfDay : null;`, { timeout: 20_000 });
            check(`flow: GM1 moves the clock to the next time of day (${c0.timeOfDay} -> ${moved.timeOfDay}) and every player's clock reads it`,
                moved.timeOfDay !== c0.timeOfDay && Object.values(seen).every(Boolean), J({ c0: c0.timeOfDay, moved: moved.timeOfDay, seen }), { ids: ["FLOW"] });
        } else note("clock: it is Night already; the step to the next time of day is the Morning Eclipse below", J(c0));
        for (let i = 0; i < 5; i++) {
            const now = await K.on("gm1", "return game.drpg.getClock().timeOfDay;");
            if (now === "night") break;
            const next = await K.on("gm1", `await game.drpg.advanceTimeOfDay(); await F.sleep(2500); return game.drpg.getClock().timeOfDay;`, { timeout: 90_000 });
            wrote.push(`the clock ${now} -> ${next}`);
        }
        const atNight = await K.on("gm1", "return F.safe(game.drpg.getClock());");
        if (atNight.timeOfDay !== "night") throw new Error(`the clock did not reach Night: ${J(atNight)}`);

        // ---------------------------------------------------------------- eclipse
        phase("eclipse");
        const LINE = `S1A ${RUN}: the fountain has been switched off overnight`;
        drafts.gm1 = await K.on("gm1", `try { return String(game.settings.get(F.MOD, "morningLineDraft") ?? ""); } catch { return ""; }`);
        drafts.gm2 = await K.on("gm2", `try { return String(game.settings.get(F.MOD, "morningLineDraft") ?? ""); } catch { return ""; }`);
        await K.on("gm2", `await game.settings.set(F.MOD, "morningLineDraft", ""); return true;`);
        await K.on("gm1", `await game.settings.set(F.MOD, "morningLineDraft", ${J(LINE)}); return true;`);
        wrote.push("GM1's morning line draft written; GM2's emptied (both put back at the end)");
        const started = await K.on("gm2", `const r = await game.drpg.startEclipse(); await F.sleep(1500); return { r: F.safe(r), eclipse: game.drpg.isEclipse(), clock: F.safe(game.drpg.getClock()) };`, { timeout: 90_000 });
        wrote.push("GM2 started the Morning Eclipse");
        if (!started.eclipse) throw new Error(`GM2's Morning Eclipse did not start: ${J(started)}`);
        const line = await K.until("p2", `const c = game.drpg.getClock(); const board = document.body.innerText.includes(${J(LINE)});
            return c.morningLine === ${J(LINE)} || board ? { clock: c.morningLine ?? null, board } : null;`, { timeout: 25_000 });
        const lineAfter = line ?? await K.on("p2", `return { clock: game.drpg.getClock().morningLine ?? null, board: document.body.innerText.includes(${J(LINE)}) };`);
        check("DAY-01: the morning line GM1 wrote shows on P2's screen when GM2 starts the Morning Eclipse",
            Boolean(line), J({ line: LINE, p2: lineAfter, gm2Clock: started.clock?.morningLine ?? null }), { ids: ["DAY-01"] });
        await settle(8000);   // the start-of-day board plays over the map

        for (const [role, actor, to] of [["p3", "P3", toA], ["p4", "P4", toC]]) {
            const mv = await playerMove(K, role, { tokenId: T[actor], actorId: A[actor].id, room: to });
            check(`flow: ${actor} crosses into a neighbouring room in the Eclipse from their own page, and the crossing is counted`,
                mv.ok && (mv.left0 === null || mv.left1 < mv.left0), J(mv), { ids: ["FLOW"] });
        }

        await K.on("p1", `F.start("decl", () => game.drpg.performAction(game.actors.get(${J(A.P1.id)}), "directMurder")); return true;`);
        const confirm = await K.on("p1", `return await F.answerSoon({ press: "yes" }, 20000);`, { timeout: 30_000 });
        const noteWin = await K.on("p1", `return await F.answerSoon({ has: 'textarea[name="note"]', fill: { note: ${J(`S1A ${RUN}: P1 waits behind the door`)} }, press: "ok" }, 20000);`, { timeout: 30_000 });
        const decl = await K.until("p1", `const j = F.job("decl"); return j?.done ? j : null;`, { timeout: 60_000 });
        check("flow: P1 declares a Direct Murder in the Eclipse from their own page, and it is parked",
            Boolean(decl?.value?.parked), J({ confirm, noteWin, decl }), { ids: ["FLOW"] });

        await K.on("p2", `F.sample("lights", ${J(T.P1)}, 100); return true;`);
        const tLights = await K.on("gm1", `const at = Date.now(); F.start("lights", () => game.drpg.endEclipse()); return at;`);
        const asked = await K.until("gm1", `return F.findApp({ title: ${J(L["DRPG.Action.murderOpensTitle"])} }) ? Date.now() : null;`, { timeout: 45_000, every: 300 });
        let answered = null;
        if (asked) {
            await settle(5000);   // the GM reads the question
            answered = await K.on("gm1", `return F.answer({ title: ${J(L["DRPG.Action.murderOpensTitle"])}, press: "no" });`);
        }
        const lit = await K.until("gm1", `const j = F.job("lights"); return j?.done ? j : null;`, { timeout: 90_000 });
        await settle(4000);
        const lightRows = await K.on("p2", `return F.samples("lights");`);
        const dawn = lightRows.find(r => !r.eclipse) ?? null;
        const post = series(lightRows, { from: dawn?.at ?? Infinity, ok: r => r.drawn });
        const afterLights = await K.on("gm1", `const s = game.drpg.murderState(); return { murder: Boolean(s?.active), stage: s?.stage ?? null, clock: F.safe(game.drpg.getClock()), eclipse: game.drpg.isEclipse() };`);
        wrote.push("GM1 ended the Eclipse (the clock to Morning) and refused the declaration at the lights");
        if (asked && answered?.ok) {
            check("EXP-PL-02: a declaration refused at the lights does not make P1's token appear in P2's room after dawn - P1 is on P2's map from the first frame of the day",
                post.n >= 5 && post.bad === 0, J({ n: post.n, hiddenRows: post.bad, firstHidden: post.firstBad, dawn, askedAfterMs: asked - tLights, answered, lit }), { ids: ["EXP-PL-02"] });
        } else {
            note("UNMEASURED this run: EXP-PL-02 - the lights asked no question about P1's declaration", J({ asked, answered, lit, afterLights, rows: lightRows.length }));
        }
        if (afterLights.murder) wrote.push(`an incident the lights opened, closed: ${J(await closeIncident(K))}`);

        // ---------------------------------------------------------------- incident A
        phase("incident-A");
        wrote.push(...(await placeTokens(K, { [A.P1.id]: M, [A.P2.id]: M, [A.P3.id]: M })).wrote);
        await settle(2000);
        let masked = null, crisisDone = false;
        for (let i = 1; i <= OPENINGS && !masked; i++) {
            const tag = `A${i}`;
            const o = await runOpening(ctx, K, { killerId: A.P1.id, killerToken: T.P1, killerRole: "p1", victimId: A.P2.id, victimRole: "p2", watchers: ["p2", "p3"] });
            wrote.push(`incident ${tag} opened (P1 -> P2): ${o.ok ? o.band : o.why}`);
            if (!o.ok) { note(`incident ${tag}: the opening did not run`, J(o)); await closeIncident(K); break; }
            readOpening(ctx, o, { tag, killerName: A.P1.name, victimRole: "p2", watchers: ["p2", "p3"] });
            if (!o.success) continue;
            if (!crisisDone && o.result.stage === "incident") {
                crisisDone = true;
                const by = await dynamicAction(ctx, K, { role: "p4", actorId: A.P4.id, gm: "gm2", tag: "p4-incident",
                    words: `S1A ${RUN}: P4, elsewhere, tries to bake bread in the kitchen` });
                if (by.ok && by.econ.informative) {
                    check("D2-11: a bystander's ordinary roll during the incident (P4, ruled by GM2) moves Hope and Despair as its dice say",
                        economyAsDiceSay(by.econ, by.duality), J({ duality: by.duality, econ: by.econ }), { ids: ["D2-11"] });
                } else note("UNMEASURED this run: D2-11 on a bystander's roll during the incident", J({ ok: by.ok, why: by.why, econ: by.econ }));
                const cr = await crisisRoll(ctx, K, { role: "p2", actorId: A.P2.id, gm: "gm2", prefer: ["survive", "selfDefence", "leaveClue"] });
                if (cr.ok && cr.econ.informative) {
                    check(`D2-09/D2-11: P2's crisis roll (${cr.key}) gives no Hope and no Despair`,
                        cr.econ.d.hope === 0 && cr.econ.d.despair === 0 && cr.econ.d.overflow === 0, J({ key: cr.key, duality: cr.duality, econ: cr.econ, state: cr.state }),
                        { ids: ["D2-09", "D2-11"] });
                } else note("UNMEASURED this run: D2-09 on a crisis roll", J({ ok: cr.ok, why: cr.why, key: cr.key, available: cr.available, econ: cr.econ, duality: cr.duality }));
                masked = o.band === "hope" || o.band === "critical" ? { o, cr } : null;
            } else if (o.band === "hope" || o.band === "critical") masked = { o, cr: null };
            if (!masked) wrote.push(`incident ${tag} closed to open again for a mask: ${J(await closeIncident(K))}`);
        }
        if (masked) {
            const still = await K.on("gm1", "const s = game.drpg.murderState(); return { active: Boolean(s?.active), stage: s?.stage ?? null, endedBy: s?.endedBy ?? null };");
            let road = masked.cr?.state?.endedBy ?? (masked.cr?.state?.active === false ? "the crisis ended it" : null);
            if (still.active) {
                const closed = await closeIncident(K);
                road = masked.cr ? "GM1's End the murder after the crisis roll" : "GM1's End the murder (no crisis roll in this incident)";
                wrote.push(`incident closed by GM1: ${J(closed)}`);
            }
            const p2alive = await K.on("gm1", `return !game.drpg.isDeadForGm(game.actors.get(${J(A.P2.id)}));`);
            for (const role of ["p2", "p3"]) await K.on(role, `F.sample("d206", ${J(T.P1)}, 150); return true;`);
            await settle(6000);
            for (const role of ["p2", "p3"]) {
                const rows = await K.on(role, `return F.samples("d206");`);
                const s = series(rows, { ok: r => r.masked && r.drawn });
                check(`D2-06/MURDER-02: P2 survived (${road}); the "?" stays on P1's token on ${role.toUpperCase()}'s map after the incident's end, P1 still in the room`,
                    p2alive && s.n >= 10 && s.bad === 0, J({ road, p2alive, n: s.n, bad: s.bad, firstBad: s.firstBad, last: s.last }), { ids: ["D2-06", "MURDER-02"] });
            }
            wrote.push(...(await placeTokens(K, { [A.P1.id]: toC })).wrote);
            await settle(4000);
            const seenByP4 = await K.on("p4", `return F.tokenState(${J(T.P1)});`);
            check("D2-06: P1 leaves the room - P4, in the room P1 walks into, sees P1 by name, the \"?\" off",
                seenByP4.placed && !seenByP4.masked && seenByP4.name === A.P1.name, J(seenByP4), { ids: ["D2-06"] });
        } else {
            note("UNMEASURED this run: D2-06, D2-12 on incident A - no opening of up to three masked P1", "");
            await closeIncident(K);
        }

        // ---------------------------------------------------------------- incident B
        phase("incident-B");
        // P2 out of the room, so that s1b's two finders (P2 and P4) were "there" at no death (body.mjs `inThatDeath`).
        wrote.push(...(await placeTokens(K, { [A.P1.id]: M, [A.P3.id]: M, [A.P2.id]: RA })).wrote);
        await settle(2000);
        let killed = false;
        for (let i = 1; i <= OPENINGS && !killed; i++) {
            const tag = `B${i}`;
            const o = await runOpening(ctx, K, { killerId: A.P1.id, killerToken: T.P1, killerRole: "p1", victimId: A.P3.id, victimRole: "p3", watchers: ["p3"] });
            wrote.push(`incident ${tag} opened (P1 -> P3): ${o.ok ? o.band : o.why}`);
            if (!o.ok) { note(`incident ${tag}: the opening did not run`, J(o)); await closeIncident(K); break; }
            readOpening(ctx, o, { tag, killerName: A.P1.name, victimRole: "p3", watchers: ["p3"] });
            if (!o.success || o.result.stage !== "incident") { if (o.success) await closeIncident(K); continue; }
            await K.on("gm1", `F.start("kill", () => game.drpg.killCharacter(game.actors.get(${J(A.P3.id)}))); return true;`);
            const six = await K.on("gm1", `return await F.answerSoon({ title: ${J(L["DRPG.Chapter.stageSixTitle"])}, press: "yes" }, 20000);`, { timeout: 30_000 });
            const kill = await K.until("gm1", `const j = F.job("kill"); return j?.done ? j : null;`, { timeout: 60_000 });
            await settle(4000);
            const after = await K.on("gm1", `const s = game.drpg.murderState(); return { stage: s?.stage ?? null, dead: game.drpg.isDeadForGm(game.actors.get(${J(A.P3.id)})) };`);
            killed = after.dead;
            wrote.push(`P3 marked dead by GM1 in incident ${tag} (Stage 6 window: ${six?.ok ? "answered" : "not seen"}; stage now ${after.stage})`);
            check("flow: GM1 marks P3 dead in the fight and the incident goes to Stage 6", after.dead && after.stage === "resolution", J({ six, kill, after }), { ids: ["FLOW"] });
            if (o.band === "hope" || o.band === "critical") {
                const st = await K.on("p3", `const S = await F.imp("spectator"); return { ...F.tokenState(${J(T.P1)}), spectator: Boolean(S.spectatorViewer?.()) };`);
                check("MURDER-03: dead P3, a Spectator now, does not read the masked killer's name over the \"?\"",
                    st.masked && !String(st.plate ?? "").includes(A.P1.name) && st.name !== A.P1.name, J(st), { ids: ["MURDER-03"] });
            } else note(`UNMEASURED this run: MURDER-03 - incident ${tag} opened on ${o.band}, no mask`, "");
        }
        if (!killed) note("incident B: no opening of up to three succeeded; s1b will set up its own incident", "");
    } finally {
        phase("end");
        for (const role of Object.keys(ctx.c)) await K.on(role, "for (const id of Object.keys(F.autos)) F.stopAuto(id); for (const k of Object.keys(F.samplers)) F.samples(k); return true;").catch(() => null);
        if ("gm1" in drafts) await K.on("gm1", `await game.settings.set(F.MOD, "morningLineDraft", ${J(drafts.gm1)}); return true;`).catch(() => null);
        if ("gm2" in drafts) await K.on("gm2", `await game.settings.set(F.MOD, "morningLineDraft", ${J(drafts.gm2)}); return true;`).catch(() => null);
        note("what this run wrote", J(wrote));
    }
}

/** The checks every opening carries: MURDER-01 on each watcher, D2-09 on the killer's economy, and its outcome's. */
function readOpening(ctx, o, { tag, killerName, victimRole, watchers }) {
    const { check, note } = ctx;
    note(`opening ${tag}`, J({ band: o.band, result: o.result, duality: o.duality, rolls: o.rolls }));
    for (const role of watchers) {
        const s = series(o.samples[role], { from: o.opened.at, to: resultSeenAt(o, role), ok: r => r.drawn });
        check(`MURDER-01 (${tag}): until the opening roll's result, P1's token stays on ${role.toUpperCase()}'s map`,
            s.n >= 5 && s.bad === 0, J({ n: s.n, hidden: s.bad, firstHidden: s.firstBad, band: o.band }), { ids: ["MURDER-01"] });
    }
    if (o.econ.informative) {
        check(`D2-09/D2-11 (${tag}): the opening roll (${o.band}) gives P1 no Hope and no Despair`,
            o.econ.d.hope === 0 && o.econ.d.despair === 0 && o.econ.d.overflow === 0, J({ duality: o.duality, econ: o.econ, before: o.before, after: o.after }),
            { ids: ["D2-09", "D2-11"] });
    } else note(`UNMEASURED this run: D2-09 on opening ${tag} - its dice could move nothing the reading sees`, J({ duality: o.duality, before: o.before }));
    if (!o.success) {
        const told = (o.victimSaw ?? []).filter(e => (e.kind !== "chat" || e.toMe) && !(e.kind === "window" && /roll/i.test(e.cls?.join(" ") ?? "")));
        check(`D2-08 (${tag}): the opening failed - ${victimRole.toUpperCase()}, the victim, is told of the attempt`,
            told.length > 0, J(told), { ids: ["D2-08"] });
        check(`D2-10 (${tag}): the victim's notice of the failed attempt names nobody`,
            told.length > 0 && told.every(e => !String(e.text ?? e.title ?? "").includes(killerName)), J(told), { ids: ["D2-10"] });
        return;
    }
    if (o.band === "hope" || o.band === "critical") {
        for (const role of watchers) {
            const at = resultSeenAt(o, role);
            const on = firstWhere(o.samples[role], at === Infinity ? o.result.at : at, r => r.masked && r.drawn);
            check(`D2-12 (${tag}): the opening succeeded on ${o.band} outside an Eclipse - the "?" goes on P1's token on ${role.toUpperCase()}'s map at once`,
                Boolean(on) && on.at - (at === Infinity ? o.result.at : at) <= 3000, J({ seenAt: at, on }), { ids: ["D2-12"] });
        }
    } else note(`opening ${tag}: success on ${o.band} - no mask (mask-gm.mjs \`opensMask\`), D2-12 not reached`, "");
}
