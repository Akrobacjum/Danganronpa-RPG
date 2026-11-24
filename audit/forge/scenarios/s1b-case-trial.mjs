/**
 * S1b on Forge: the body, the Investigation, the Class Trial, the verdict and the chapter's end (the road to 2.0, F3, S1;
 * 24.11.2026).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s1b-case-trial
 * NEVER RUN on Forge before its first run (run.mjs); written 24.11.2026 and not yet run anywhere.
 *
 * WHERE IT STARTS. From the state s1a-day-murder leaves when it finds it: an incident at Stage 6 whose victim the GMs
 * hold dead and nobody has found, with two living students who were at no part of that death (body.mjs `inThatDeath`:
 * the killer, a third, and the death row's `there`) to find the body. Otherwise it SETS UP ITS OWN INCIDENT: whatever
 * runs is closed (an Eclipse ended without advancing, an incident ended), the phase put to Daily Life, P1-P4 revived,
 * P1 and P3 put alone in a room, GM1 opens P1 -> P3 (up to 3 openings until one succeeds; the dice are not forced) and
 * marks P3 dead in the fight. The note "start" says which. In both cases the killer is P1's character or the incident's,
 * and the finders are taken from P2, P4 and then P1-P4 in that order.
 *
 * WHAT IT CLAIMS (ids as in s1a: a check of a known defect fails on 1.2.129 and passes once 2.0 is in; ["FLOW"] is the
 * scenario's own road):
 *   EXP-GM-02   a lone student who walks into the room of a body nobody found: the second GM is told
 *   MURDER-05   the second witness walks in: the "Students found a body" question reaches the second GM as well
 *   INV-01      an Observe that hits an undescribed trace: the naming window (or a raised card) reaches the second GM
 *   INV-02      the second GM's "Write it here" window closes when the primary answers first
 *   EXP-GM-03   Start the Class Trial while a player's request waits on a GM: the GM is warned before the trial opens
 *   EXP-GM-04   Close and count: the result is not published to the players before the GM has seen it
 *   TRIAL-06    a player disconnected after the ballots went out is not counted against the conviction (the vote's base
 *               is the ballots cast and the players still connected)
 *   TRIAL-03    the verdict pressed by the second GM opens its windows (the class's Level Ups, the Blackened's rule) on
 *               the second GM's screen, not the primary's
 *   TRIAL-07    the second GM ends the trial while the primary is unreachable (its network cut for 15 s): the sentence is
 *               carried out all the same
 *   TRIAL-01    the second GM orders the chapter's end and the primary reloads mid-run: the second GM sees the stopped
 *               end and can finish it
 *
 * PHASES.
 *   setup       the page kit everywhere (lib/s1-kit.mjs); the start above; the incident ended (Stage 6's End the
 *               murder); the killer and every finder moved out of the body's room.
 *   body        finder 1 (P4 first) walks alone into the body's room (a GM's move: the walk-in is read on the primary
 *               from the token's update, as scenario 10 walks); finder 2 walks in; GM1 answers its question
 *               "Announce"; the phase put to Investigation if the announcement did not.
 *   observe     GM1 places an undescribed trace (`placeRemnant`, obvious) in the room; finder 1 Observes ("sweep the
 *               room", from their page; the roll pressed there); on a hit, GM2 opens "Write it here" from its whisper and
 *               GM1 names the find. Up to two Observes (finder 1, then finder 2) for a hit.
 *   analyze     the finder with a Truth Bullet Analyzes it from their page.
 *   trial       finder 2 asks a Dynamic action and no GM rules it; GM2 presses Start the Class Trial; the request is
 *               then refused from its card by GM1. GM2 opens the vote; P4's browser is closed once the ballots are out;
 *               the other living players vote for the killer from their ballots; GM2 closes and counts; P4 logs in again.
 *   verdict     GM2 applies the verdict (correct; the killer executed and Blackened); every window it raises on either GM
 *               is answered with its primary button.
 *   close       GM1's network cut for 15 s (context.setOffline) while GM2 ends the trial; the execution read on P2's page.
 *   chapter     GM2 orders the chapter's end (every choice on); GM1 reloads 0.4 s later; GM2's view of the end read; the
 *               end finished (GM2, else GM1).
 *
 * WHAT IT LEAVES: the next chapter, Daily Life, the next session and morning; the killer executed (dead); the victim
 * dead and found. s1a revives P1-P4 when it starts.
 *
 * WHAT IT WRITES (the test world; the note "what this run wrote" lists it): tokens moved (and created where absent); the
 * incident closed (and, in its own set-up, opened, a death, a revival); the body announced and its traces promoted;
 * the phase; one trace placed and found, a Truth Bullet made and analyzed; a Dynamic action asked and refused; the
 * trial started, a vote, a verdict with its Level Ups and rule, an execution; the chapter's end with every choice
 * (reveal, sweep, Faint, keys, end of trial, next chapter, session and morning).
 *
 * UNMEASURED - ASSUMPTIONS NOT CONFIRMED ON FORGE (read in the code, never run there), beside s1a's on the kit:
 *   - how 2.0 words its warnings: EXP-GM-03 passes on a window or notice during the start that holds the GM console's
 *     "Waiting on a decision" heading (`DRPG.Messenger.gm.waiting`) or the waiting request's own words; EXP-GM-04 on no
 *     result card on P2's page for 6 s after Close and count while a new window stands on GM2's (its primary button is
 *     then pressed); MURDER-05, EXP-GM-02 and INV-01 on a window or a raised card on GM2's page - a whisper in the chat
 *     log alone does not count (the module hides Foundry's chat notifications, F1-verify INV-01);
 *   - that 15 s offline makes GM1 miss GM2's `trial.record` (TIMING.ackMs 8000) without Foundry's server dropping GM1's
 *     socket first, which would make GM2 the primary and the condition TRIAL-07 names would not be reached (the check's
 *     details say who was primary after);
 *   - that GM1's reload 0.4 s after GM2's order lands inside the chapter's end run (TRIAL-01); a run that finished first
 *     is a note "UNMEASURED this run", not a pass;
 *   - that the ballot's radios carry the candidate's actor id (vote.mjs `castBallot`) and the killer is a candidate on
 *     every ballot; a ballot without the killer votes for its first row (the details say so);
 *   - that the GM's question about the Faint Prep Remnants after an announcement, and the windows the trial's start and
 *     the verdict raise, are answered by their primary button (`F.answer` with no named button).
 */

import { kit, J, readWorld, pickRooms, placeTokens, unpause, readyPlayers, i18n, runOpening, closeIncident } from "./lib/s1-kit.mjs";

export const meta = {
    id: "s1b-case-trial",
    title: "The body, the Investigation, the Class Trial, the verdict and the chapter's end",
    roles: ["gm1", "gm2", "p1", "p2", "p3", "p4"],
    writes: true,
    triage: ["EXP-GM-02", "MURDER-05", "INV-01", "INV-02", "EXP-GM-03", "EXP-GM-04", "TRIAL-06", "TRIAL-03", "TRIAL-07", "TRIAL-01"]
};

const RUN = Date.now().toString(36);
const ROLE = { P1: "p1", P2: "p2", P3: "p3", P4: "p4" };
const TOLD = e => e.kind === "window" || e.kind === "popup" || e.kind === "notice";

export async function run(ctx) {
    const { check, note, phase, settle } = ctx;
    const K = kit(ctx);
    const wrote = [];
    try {
        // ---------------------------------------------------------------- setup
        phase("setup");
        const missing = meta.roles.filter(r => !ctx.c[r]);
        if (missing.length) throw new Error(`not logged in: ${missing.join(", ")} - every role is needed`);
        const kits = {};
        for (const role of meta.roles) kits[role] = await K.install(role);
        note("kit", J(kits));
        const L = await i18n(K, "gm1", ["DRPG.Chapter.pendingTitle", "DRPG.Observe.describeTitle", "DRPG.Floor.startTrial",
            "DRPG.Messenger.gm.waiting", "DRPG.Vote.resultBanner", "DRPG.Chapter.stageSixTitle", "DRPG.Action.murderOpensTitle", "DRPG.Mask.askTitle"]);
        let world = await readWorld(K);
        const A = world.actors;
        for (const n of ["P1", "P2", "P3", "P4"]) if (!A[n]?.id) throw new Error(`no actor named ${n}`);
        if (!world.isPlace) throw new Error(`the active scene "${world.sceneName}" holds no room`);
        await readyPlayers(K, ["p1", "p2", "p3", "p4"], world.scene, { rollDelay: 2500 });
        await readyPlayers(K, ["gm1", "gm2"], world.scene, { rollDelay: 1500 });
        await K.on("p1", `F.auto("mask", { title: ${J(L["DRPG.Mask.askTitle"])}, press: "stay" }); return true;`);
        if (await unpause(K)) wrote.push("the game unpaused");

        // The state s1a leaves, when it is here and usable.
        const found = await K.on("gm1", `
            const S = await F.imp("gm-stores"), M = await F.imp("movement");
            const s = game.drpg.murderState();
            if (!s?.active || s.stage !== "resolution" || !s.victimId) return null;
            const victim = game.actors.get(s.victimId);
            if (!victim || !game.drpg.isDeadForGm(victim) || game.drpg.isDeceased(victim)) return null;
            const row = S.deathStore?.get?.(victim.id) ?? null;
            const there = new Set([s.killerId, s.thirdId, ...(Array.isArray(s.departed) ? s.departed : []), ...(Array.isArray(row?.there) ? row.there : [])].filter(Boolean));
            return { killerId: s.killerId, victimId: victim.id, room: M.roomOfActor(victim), there: [...there] };`);
        const plan = pickRooms(world, { count: 4, movers: 0 });
        if (!plan) throw new Error(`the active scene gives no four rooms: ${J(world.rooms)}`);
        const byId = Object.fromEntries(Object.entries(A).filter(([, a]) => a?.id).map(([n, a]) => [a.id, n]));
        let start = null;
        if (found) {
            const finders = ["P2", "P4", "P1", "P3"].filter(n => A[n].id !== found.victimId && A[n].id !== found.killerId && !found.there.includes(A[n].id));
            if (found.room && finders.length >= 2 && byId[found.killerId]) start = { from: "s1a", ...found, killer: byId[found.killerId], victim: byId[found.victimId], finders };
            else note("start: s1a's incident is here but not usable", J({ found, finders }));
        }
        if (!start) start = await ownIncident(ctx, K, { A, world, plan, L, wrote });
        note("start", J(start));
        world = await readWorld(K);
        const M = start.room;
        const away = plan.rooms.filter(r => r !== M);
        const [F1, F2] = start.finders;
        const killer = start.killer;

        wrote.push(`the incident ended at Stage 6: ${J(await closeIncident(K, { reason: "closed", followUp: false }))}`);
        // Everybody but the body out of the room: the killer to one room, each finder to another.
        wrote.push(...(await placeTokens(K, { [A[killer].id]: away[0], [A[F1].id]: away[1], [A[F2].id]: away[2] })).wrote);
        await settle(3000);

        // ---------------------------------------------------------------- body
        phase("body");
        const tWalk1 = await K.on("gm2", "return Date.now();");
        wrote.push(...(await placeTokens(K, { [A[F1].id]: M })).wrote);
        await settle(9000);
        const finderSaw = await K.on(ROLE[F1], `return F.since(${tWalk1}).filter(e => e.kind !== "murder");`);
        const gm2Lone = await K.on("gm2", `return F.since(${tWalk1}).filter(e => e.kind !== "murder");`);
        const loneTold = gm2Lone.filter(e => TOLD(e) && (String(e.text ?? e.title ?? "").includes(A[F1].name) || String(e.text ?? "").includes(M)));
        check(`EXP-GM-02: ${F1} walks alone into the room of a body nobody found - GM2 is told (a window, a raised card or a notice naming ${F1} or the room)`,
            loneTold.length > 0, J({ told: loneTold, gm2: gm2Lone, finder: finderSaw.slice(0, 6) }), { ids: ["EXP-GM-02"] });

        const tWalk2 = await K.on("gm2", "return Date.now();");
        wrote.push(...(await placeTokens(K, { [A[F2].id]: M })).wrote);
        const asked = await K.until("gm1", `return F.findApp({ title: ${J(L["DRPG.Chapter.pendingTitle"])} }) ? Date.now() : null;`, { timeout: 30_000 });
        await settle(6000);
        const gm2Two = await K.on("gm2", `return { apps: F.apps().map(a => a.title), events: F.since(${tWalk2}).filter(e => e.kind !== "murder") };`);
        const twoTold = gm2Two.events.filter(e => TOLD(e) && (String(e.title ?? "").includes(L["DRPG.Chapter.pendingTitle"]) || String(e.text ?? "").includes(M)));
        if (asked) {
            check(`MURDER-05: ${F2}, the second witness, walks in - GM2 gets the "Students found a body" question too (or a raised card naming the room), not only GM1`,
                twoTold.length > 0 || gm2Two.apps.includes(L["DRPG.Chapter.pendingTitle"]), J({ gm1AskedAt: asked - tWalk2, told: twoTold, gm2Two }), { ids: ["MURDER-05"] });
        } else note("UNMEASURED this run: MURDER-05 - GM1 was not asked about a pending body either", J(gm2Two));
        // GM1 announces; GM2's window, if 2.0 gave it one, is left to close with the answer.
        const announced = await K.on("gm1", `return await F.answerSoon({ title: ${J(L["DRPG.Chapter.pendingTitle"])}, press: "announce" }, 15000);`, { timeout: 25_000 });
        const bodyNow = await K.until("p2", `return game.drpg.isDeceased(game.actors.get(${J(A[start.victim].id)})) ? true : null;`, { timeout: 30_000 });
        wrote.push("the body announced by GM1");
        check(`flow: GM1 announces the body and P2's page holds ${start.victim} dead`, Boolean(announced?.ok && bodyNow), J({ announced, bodyNow }), { ids: ["FLOW"] });
        await settle(4000);
        // A question about Faint Prep after the announcement (body.mjs `askPromotion`), when there is one: its primary.
        const after = await K.on("gm1", "return F.apps().map(a => ({ title: a.title, buttons: a.buttons }));");
        note("GM1's windows after the announcement", J(after));
        const phaseNow = await K.on("gm1", "return game.drpg.getClock().phase;");
        if (phaseNow !== "investigation") {
            await K.on("gm1", `await game.drpg.setPhase("investigation"); await F.sleep(2000); return true;`, { timeout: 60_000 });
            wrote.push(`phase ${phaseNow} -> investigation (set by GM1: the announcement did not)`);
        }

        // ---------------------------------------------------------------- observe
        phase("observe");
        const refill = await K.on("gm1", `const out = [];
            for (const id of ${J([A[F1].id, A[F2].id])}) { const a = game.actors.get(id); if (game.drpg.actionsLeft(a) < 2) { await game.drpg.resetActionsFor(a); out.push(a.name + "'s actions refilled"); } }
            return out;`);
        wrote.push(...refill);
        const trace = await K.on("gm1", `const M = await F.imp("movement"); const scene = game.scenes.get(${J(world.scene)});
            const spot = M.positionIn(${J(M)}, { parent: scene, width: 1, height: 1 });
            const size = scene.grid?.size ?? 100;
            const t = await game.drpg.placeRemnant({ type: "incident", visibility: "obvious", x: spot.x + size, y: spot.y + size, scene,
                note: ${J(`S1B ${RUN}: an undescribed trace`)} });
            return t?.id ?? null;`, { timeout: 60_000 });
        wrote.push(`a trace placed in ${M}: ${trace}`);
        let described = null;
        for (const who of [F1, F2]) {
            const t0 = await K.on("gm1", "return Date.now();");
            await K.on(ROLE[who], `F.start("observe", () => game.drpg.performAction(game.actors.get(${J(A[who].id)}), "observe")); return true;`);
            const chose = await K.on(ROLE[who], `return await F.answerSoon({ radio: "general", press: "ok" }, 25000);`, { timeout: 40_000 });
            const win = await K.until("gm1", `return F.findApp({ title: ${J(L["DRPG.Observe.describeTitle"])} }) ? Date.now() : null;`, { timeout: 90_000 });
            if (!win) {
                const job = await K.until(ROLE[who], `const j = F.job("observe"); return j?.done ? j : null;`, { timeout: 60_000 });
                note(`observe by ${who}: no naming window on GM1 (a miss, or a trace already described)`, J({ chose, job }));
                continue;
            }
            await settle(5000);
            const gm2 = await K.on("gm2", `return { apps: F.apps().map(a => a.title), events: F.since(${t0}).filter(e => e.kind !== "murder") };`);
            const raised = gm2.events.filter(e => (e.kind === "window" && String(e.title).includes(L["DRPG.Observe.describeTitle"]))
                || (e.kind === "popup" && String(e.text ?? "").includes(A[who].name)));
            check(`INV-01: ${who}'s Observe hits an undescribed trace - the naming window (or a raised card) reaches GM2 as well as GM1`,
                raised.length > 0 || gm2.apps.includes(L["DRPG.Observe.describeTitle"]), J({ raised, gm2 }), { ids: ["INV-01"] });
            // GM2 opens "Write it here" from its whisper, then GM1 answers first.
            const here = await K.on("gm2", `const O = await F.imp("observe");
                for (const m of [...game.messages].reverse()) {
                    const box = document.createElement("div"); box.innerHTML = String((await F.imp("secret")).contentOf(m) ?? "");
                    const button = box.querySelector("[data-drpg-describe-find]");
                    if (!button) continue;
                    document.body.append(box); box.style.display = "none";
                    O.wireDescribeHere(box);
                    box.querySelector("[data-drpg-describe-find]").click();
                    await F.sleep(2500);
                    box.remove();
                    return { message: m.id, open: Boolean(F.findApp({ title: ${J(L["DRPG.Observe.describeTitle"])} })) };
                }
                return { message: null, open: false };`, { timeout: 30_000 });
            const named = await K.on("gm1", `return F.answer({ title: ${J(L["DRPG.Observe.describeTitle"])}, press: "ok" });`);
            await settle(6000);
            const gm2Open = await K.on("gm2", `return Boolean(F.findApp({ title: ${J(L["DRPG.Observe.describeTitle"])} }));`);
            if (here.open) {
                check("INV-02: GM2's \"Write it here\" window closes when GM1 names the find first",
                    !gm2Open, J({ here, named, gm2StillOpen: gm2Open }), { ids: ["INV-02"] });
            } else note("UNMEASURED this run: INV-02 - GM2's \"Write it here\" did not open a window", J({ here, named }));
            await K.on("gm2", `const app = F.findApp({ title: ${J(L["DRPG.Observe.describeTitle"])} }); if (app) await app.close(); return true;`);
            const job = await K.until(ROLE[who], `const j = F.job("observe"); return j?.done ? j : null;`, { timeout: 90_000 });
            described = { who, job, named };
            wrote.push(`${who}'s Observe found the trace, named by GM1`);
            break;
        }
        if (!described) note("UNMEASURED this run: INV-01, INV-02 - no Observe of two hit the undescribed trace", "");

        // ---------------------------------------------------------------- analyze
        phase("analyze");
        const holder = await K.on("gm1", `for (const id of ${J([A[F1].id, A[F2].id])}) { const a = game.actors.get(id);
            const b = (game.drpg.analysableBullets?.(a) ?? []); if (b.length) return { id, n: b.length }; } return null;`);
        if (holder) {
            const who = byId[holder.id];
            await K.on(ROLE[who], `F.start("analyze", () => game.drpg.performAction(game.actors.get(${J(holder.id)}), "analyze")); return true;`);
            const chose = await K.on(ROLE[who], `return await F.answerSoon({ radio: "bullet", press: "ok" }, 25000);`, { timeout: 40_000 });
            const job = await K.until(ROLE[who], `const j = F.job("analyze"); return j?.done ? j : null;`, { timeout: 150_000, every: 1000 });
            wrote.push(`${who} analyzed a Truth Bullet`);
            check(`flow: ${who} Analyzes a Truth Bullet from their page and the action ends`, Boolean(job?.done && job.ok), J({ chose, job }), { ids: ["FLOW"] });
        } else note("analyze: no finder holds a Truth Bullet to analyze; skipped", "");

        // ---------------------------------------------------------------- trial
        phase("trial");
        const WAIT = `S1B ${RUN}: a request no GM has answered yet`;
        const t0 = await K.on("gm2", "return Date.now();");
        await K.on(ROLE[F2], `F.start("waiting", () => game.drpg.performAction(game.actors.get(${J(A[F2].id)}), "dynamic")); return true;`);
        const waitAsked = await K.on(ROLE[F2], `return await F.answerSoon({ has: 'textarea[name="request"]', fill: { request: ${J(WAIT)} }, press: "send" }, 25000);`, { timeout: 40_000 });
        const waitCard = await K.until("gm1", `const c = await F.cards("setDifficulty", { since: ${t0} }); return c.find(x => x.data.by === ${J(A[F2].id)}) ?? null;`, { timeout: 45_000 });
        wrote.push(`${F2}'s Dynamic action asked and left waiting`);
        const appsBefore = await K.on("gm2", "return F.apps().map(a => a.id);");
        const tStart = await K.on("gm2", `const at = Date.now(); F.start("trial", async () => (await F.imp("trial-floor-ui")).startClassTrial()); return at;`);
        const shown = [];
        const endStart = Date.now() + 60_000;
        while (Date.now() < endStart) {
            const s = await K.on("gm2", `return { phase: game.drpg.getClock().phase, job: F.job("trial"), apps: F.apps() };`);
            if (s.phase === "classTrial" || s.job?.done) { shown.push({ final: s.phase, job: s.job }); break; }
            for (const app of s.apps) {
                if (appsBefore.includes(app.id) || shown.some(x => x.id === app.id)) continue;
                shown.push({ id: app.id, title: app.title, text: app.text, buttons: app.buttons });
                await settle(1500);
                const r = await K.on("gm2", `return F.answer({ id: ${J(app.id)} });`);
                shown.push({ answered: app.title, r });
            }
            await settle(800);
        }
        const startEvents = await K.on("gm2", `return F.since(${tStart}).filter(e => e.kind === "notice" || e.kind === "popup");`);
        const texts = [...shown.map(x => `${x.title ?? ""} ${x.text ?? ""}`), ...startEvents.map(e => e.text ?? "")];
        const warned = texts.some(t => t.includes(L["DRPG.Messenger.gm.waiting"]) || t.includes(WAIT));
        check("EXP-GM-03: GM2 presses Start the Class Trial while a player's request waits on a GM - GM2 is warned before the trial opens",
            Boolean(waitCard) && warned, J({ waitAsked: waitAsked?.ok ?? false, waitCard: Boolean(waitCard), shown, startEvents }), { ids: ["EXP-GM-03"] });
        const inTrial = await K.until("gm1", `return game.drpg.getClock().phase === "classTrial" ? true : null;`, { timeout: 30_000 });
        if (!inTrial) throw new Error(`the Class Trial did not start: ${J(shown)}`);
        wrote.push("GM2 started the Class Trial");
        if (waitCard) {
            await K.on("gm1", `F.press("refuse-wait", ${J(waitCard.id)}, "refuseDynamic", ${J(waitCard.data)}); return true;`);
            await K.until(ROLE[F2], `const j = F.job("waiting"); return j?.done ? true : null;`, { timeout: 60_000 });
            wrote.push(`${F2}'s waiting request refused by GM1 from its card`);
        }
        await settle(5000);

        // The vote: P4's browser closed once the ballots are out.
        const voters = ["P1", "P2", "P3", "P4"].filter(n => n !== start.victim);
        const opened = await K.on("gm2", `await game.drpg.openVote(); await F.sleep(3000); const p = game.drpg.trialProgress();
            return { open: Boolean(p?.vote?.open), round: p?.vote?.round ?? null, issued: [...(p?.vote?.issued ?? [])] };`, { timeout: 60_000 });
        wrote.push("GM2 opened the vote");
        const ballots = {};
        for (const n of voters) ballots[n] = await K.until(ROLE[n], `return F.findApp({ cls: "drpg-ballot" }) ? true : null;`, { timeout: 30_000 });
        const gone = voters.includes("P4") ? "P4" : voters[voters.length - 1];
        await ctx.leave(ROLE[gone]);
        wrote.push(`${gone}'s browser closed after the ballots went out`);
        await settle(6000);
        const cast = {};
        for (const n of voters.filter(v => v !== gone)) {
            cast[n] = await K.on(ROLE[n], `return F.answer({ cls: "drpg-ballot", radio: ${J(A[killer].id)}, radioAny: true });`);
        }
        const inBox = await K.until("gm2", `const V = await F.imp("vote"); const n = V.votesIn(); return n >= ${voters.length - 1} ? n : null;`, { timeout: 30_000 });
        const closeBefore = await K.on("gm2", "return F.apps().map(a => a.id);");
        const tClose = await K.on("gm2", `const at = Date.now(); F.start("close", () => game.drpg.closeVote()); return at;`);
        await settle(6000);
        const p2Card = await K.on("p2", `return F.since(${tClose}).filter(e => e.kind === "chat" && String(e.text).includes(${J(L["DRPG.Vote.resultBanner"])}));`);
        const gm2New = (await K.on("gm2", "return F.apps();")).filter(a => !closeBefore.includes(a.id));
        check("EXP-GM-04: Close and count - the result is not on P2's screen before GM2 has seen it (a new window on GM2, nothing on P2 for 6 s)",
            p2Card.length === 0 && gm2New.length > 0, J({ p2Card, gm2New }), { ids: ["EXP-GM-04"] });
        if (gm2New.length) await K.on("gm2", `return F.answer({ id: ${J(gm2New[0].id)} });`);
        await K.until("gm2", `const j = F.job("close"); return j?.done ? j : null;`, { timeout: 30_000 });
        await settle(3000);
        const counted = await K.on("gm2", `const p = game.drpg.trialProgress();
            return { total: p?.total ?? null, majority: p?.majority ?? null, noMajority: p?.noMajority ?? null, accused: F.safe(p?.accused), issued: [...(p?.vote?.issued ?? [])] };`);
        const goneUser = world.users[gone];
        check(`TRIAL-06: ${gone}, disconnected after the ballots went out, is not counted against the conviction - the vote's base is the ${inBox ?? "?"} ballots cast`,
            Number.isFinite(inBox) && counted.total === inBox, J({ gone, goneIssued: (opened.issued ?? []).includes(goneUser), opened, cast, inBox, counted }), { ids: ["TRIAL-06"] });
        await ctx.rejoin(ROLE[gone]);
        await K.reinstall(ROLE[gone]);
        await readyPlayers(K, [ROLE[gone]], world.scene, { rollDelay: 2500 });
        wrote.push(`${gone} logged in again`);

        // ---------------------------------------------------------------- verdict
        phase("verdict");
        const before = { gm1: await K.on("gm1", "return F.apps().map(a => a.id);"), gm2: await K.on("gm2", "return F.apps().map(a => a.id);") };
        const tV = await K.on("gm2", `const at = Date.now();
            F.start("verdict", () => game.drpg.applyVerdict({ correct: true, executedIds: [${J(A[killer].id)}], blackenedIds: [${J(A[killer].id)}] })); return at;`);
        const raisedOn = { gm1: [], gm2: [] };
        const endV = Date.now() + 120_000;
        while (Date.now() < endV) {
            const job = await K.on("gm2", `return F.job("verdict");`);
            for (const gm of ["gm1", "gm2"]) {
                const apps = await K.on(gm, "return F.apps();");
                for (const app of apps) {
                    if (before[gm].includes(app.id) || raisedOn[gm].some(x => x.id === app.id)) continue;
                    raisedOn[gm].push({ id: app.id, title: app.title, at: Date.now() - tV, buttons: app.buttons });
                    await settle(1500);
                    await K.on(gm, `return F.answer({ id: ${J(app.id)} });`);
                }
            }
            if (job?.done) break;
            await settle(1000);
        }
        const verdictJob = await K.on("gm2", `return F.job("verdict");`);
        wrote.push("GM2 applied the verdict (correct; the killer executed and Blackened)");
        if (raisedOn.gm1.length || raisedOn.gm2.length) {
            check("TRIAL-03: the verdict GM2 pressed opens its windows on GM2's screen, none on GM1's",
                raisedOn.gm2.length > 0 && raisedOn.gm1.length === 0, J({ raisedOn, verdictJob }), { ids: ["TRIAL-03"] });
        } else note("UNMEASURED this run: TRIAL-03 - the verdict raised no window on either GM", J({ verdictJob }));

        // ---------------------------------------------------------------- close
        phase("close");
        const cut = ctx.offline("gm1", 15_000);
        await settle(1000);
        await K.on("gm2", `F.start("closeTrial", () => game.drpg.closeTrial()); return true;`);
        await cut;
        await settle(30_000);
        const executed = await K.on("p2", `return { dead: game.drpg.isDeceased(game.actors.get(${J(A[killer].id)})), phase: game.drpg.getClock().phase };`);
        const closeJob = await K.on("gm2", `return { job: F.job("closeTrial"), primary: game.users.get((await F.imp("utils")).primaryGmId?.() ?? "")?.name ?? null };`);
        wrote.push("GM2 ended the trial while GM1's network was cut for 15 s");
        check(`TRIAL-07: GM2 ends the trial while GM1 is unreachable - ${killer}'s sentence is carried out (P2's page holds ${killer} dead 30 s after GM1 is back)`,
            executed.dead, J({ executed, closeJob }), { ids: ["TRIAL-07"] });

        // ---------------------------------------------------------------- chapter
        phase("chapter");
        const ch0 = await K.on("gm2", "return F.safe(game.drpg.getClock());");
        await K.on("gm2", `F.start("chapter", () => game.drpg.applyChapterEnd({ reveal: true, sweep: true, faint: true, keys: true, endTrial: true,
            nextChapter: true, nextSession: true, nextMorning: true })); return true;`);
        await settle(400);
        await ctx.reload("gm1");
        await K.reinstall("gm1");
        await settle(8000);
        const seen = await K.on("gm2", `const C = await F.imp("chapter");
            let rec = null; try { rec = F.safe(game.settings.get(F.MOD, "chapterEnd")); } catch { rec = null; }
            return { rec, stopped: Boolean(C.chapterEndStopped?.()), job: F.job("chapter"), clock: F.safe(game.drpg.getClock()) };`);
        wrote.push("GM2 ordered the chapter's end; GM1 reloaded during it");
        if (seen.rec?.stage === "applying") {
            check("TRIAL-01: the chapter's end GM2 ordered stopped when GM1 reloaded - GM2 sees it stopped (Finish / Drop), not a fresh form",
                seen.stopped, J(seen), { ids: ["TRIAL-01"] });
            const fin = await K.on("gm2", `const r = await game.drpg.finishChapterEnd(); await F.sleep(4000); return { r: F.safe(r), clock: F.safe(game.drpg.getClock()) };`, { timeout: 120_000 });
            if (Number(fin.clock?.chapter) === Number(ch0.chapter)) {
                const fin1 = await K.on("gm1", `const r = await game.drpg.finishChapterEnd(); await F.sleep(4000); return { r: F.safe(r), clock: F.safe(game.drpg.getClock()) };`, { timeout: 120_000 });
                wrote.push(`the stopped end finished by GM1 (GM2's Finish did not move the chapter): ${J(fin1.clock?.chapter)}`);
            } else wrote.push(`the stopped end finished by GM2: chapter ${fin.clock?.chapter}`);
        } else {
            note("UNMEASURED this run: TRIAL-01 - the chapter's end ran through before GM1's reload stopped it", J(seen));
        }
        const ch1 = await K.until("p2", `const c = game.drpg.getClock(); return Number(c.chapter) > ${Number(ch0.chapter) || 0} ? F.safe(c) : null;`, { timeout: 60_000 });
        check("flow: the chapter ends - P2's clock reads the next chapter", Boolean(ch1), J({ ch0: ch0.chapter, ch1 }), { ids: ["FLOW"] });
    } finally {
        phase("end");
        for (const role of Object.keys(ctx.c)) await K.on(role, "for (const id of Object.keys(F.autos)) F.stopAuto(id); for (const k of Object.keys(F.samplers)) F.samples(k); return true;").catch(() => null);
        note("what this run wrote", J(wrote));
    }
}

/**
 * THE SCENARIO'S OWN INCIDENT, when s1a's is not here: whatever runs closed, P1-P4 alive, P1 and P3 alone in the first
 * room, P2 and P4 elsewhere; GM1 opens P1 -> P3 (up to three openings until one succeeds) and marks P3 dead in the
 * fight, answering Stage 6. Answers the start row, or throws.
 */
async function ownIncident(ctx, K, { A, world, plan, L, wrote }) {
    const { note, settle } = ctx;
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
    const [M, R2, R3] = plan.rooms;
    wrote.push(...(await placeTokens(K, { [A.P1.id]: M, [A.P3.id]: M, [A.P2.id]: R2, [A.P4.id]: R3 })).wrote);
    await settle(2000);
    const fresh = await readWorld(K);
    for (let i = 1; i <= 3; i++) {
        const o = await runOpening(ctx, K, { killerId: A.P1.id, killerToken: fresh.actors.P1.token, killerRole: "p1", victimId: A.P3.id, victimRole: "p3", watchers: [] });
        wrote.push(`own incident ${i} opened (P1 -> P3): ${o.ok ? o.band : o.why}`);
        if (!o.ok || !o.success || o.result.stage !== "incident") { if (o.ok && o.success) await closeIncident(K); continue; }
        await K.on("gm1", `F.start("kill", () => game.drpg.killCharacter(game.actors.get(${J(A.P3.id)}))); return true;`);
        const six = await K.on("gm1", `return await F.answerSoon({ title: ${J(L["DRPG.Chapter.stageSixTitle"])}, press: "yes" }, 20000);`, { timeout: 30_000 });
        await K.until("gm1", `const j = F.job("kill"); return j?.done ? j : null;`, { timeout: 60_000 });
        await settle(4000);
        const st = await K.on("gm1", `const s = game.drpg.murderState(); return { stage: s?.stage ?? null, dead: game.drpg.isDeadForGm(game.actors.get(${J(A.P3.id)})) };`);
        wrote.push(`P3 marked dead by GM1 (Stage 6 window: ${six?.ok ? "answered" : "not seen"}; stage ${st.stage})`);
        if (st.dead) return { from: "own", killerId: A.P1.id, victimId: A.P3.id, room: M, there: [], killer: "P1", victim: "P3", finders: ["P2", "P4"] };
    }
    note("own incident: no opening of three reached a death", J(world.clock));
    throw new Error("no incident to investigate: three openings did not reach a death");
}
