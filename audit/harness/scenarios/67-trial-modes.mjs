/**
 * Scenario 67 - the Class Trial's tools beside the debate, on the seed's GM and three players (E70 part 2, 28.10.2026;
 * E70-84). Each commit of E70 part 2 adds its phase; a letter is a phase, so a later one adds a letter.
 *
 *   T (E70 C7, Testimony): the GM opens a Testimony in the order Aiko, Botan, Chie at 60 s a turn; every player reads
 *     the same floor - Aiko's turn - and only p1, Aiko's player, is shown "Your turn - 60 s"; p2's Event panel says who
 *     is next and p3's HUD who speaks. p2 calls Botan's turn done while it is Aiko's (refused, the floor stays), p1
 *     calls Aiko's done from its own page (Botan's turn). Chie objects at Botan, the speaker, and the rebuttal is
 *     skipped: the queue resumes at Chie, whom p3 passes - "Chie Mori passes." and "The Testimony is over." reach every
 *     player and the floor closes.
 *   P (E70 C7, Panic Round, the GM's heartbeat held): the GM's trial ticker held from the round's start (a tab in the
 *     background: trial-floor.mjs's own `setInterval` answers nothing, every other timer runs), a Panic Round at 15 s;
 *     p2's OBJECTION! is refused; Aiko's 15 s run out and the players' browsers move the round to Botan by themselves
 *     ("trial.turn" kind "over"), within 15 + 4 s of its start.
 *   C (E70 C8, the Closing Argument): the GM opens it; every player is asked "I'll sum up?"; p1 volunteers Aiko and
 *     p2 Botan from their own pages, and a canary planted among the GMs' volunteers reaches no player - p3 reads
 *     "Volunteers: 2" and neither world setting names a volunteer or a draw. Skip draws; p2 reads that the GM is
 *     confirming; the GM picks Chie instead (outside the volunteers) and the card says only that Chie gives it. Aiko
 *     objects at Chie, the rebuttal is skipped, p1 reads that the GM decides, and the GM gives the Closing to Aiko (a
 *     new 5:00, told). Botan objects at Aiko and the GM overrules it: Aiko again with the seconds she had. p1 passes
 *     (no window to resign in: Done) - "The Closing Argument is over." on every player, the record done with two
 *     stretches (picked, objection). Then an Overrule in a Testimony's exchange gives the speaker back the turn.
 *   D (E70 C7, the undiscovered dead): Botan killed with nobody told, the trial's voices settled on the primary (the
 *     dead listed), and a Testimony started in the order Aiko, Botan, Chie gives Botan no turn.
 * The canary's player scan runs after every phase (`canary.scan`) on a GM's Key Remnant plan planted at the start.
 *
 * What it cannot see: a round at a table of 14-15 people (LIVE-E70-07), a step over on a real server's latency
 * (LIVE-E70-08), the sound of a turn, a Panic Round's or a Closing's start (the harness plays no audio), the Closing's
 * draw, confirmation and decision with real people (LIVE-E70-09).
 */
export const layers = ["ci"];

const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS }) {
    const counts = {};
    let current = null;
    const begin = (letter, name) => { phase(`${letter}: ${name}`, { flow: "class-trial" }); current = letter; counts[letter] = 0; };
    const verdict = (name, ok, details) => { counts[current]++; check(`${current}${counts[current]}: ${name}`, ok, details); };
    const until = `const until = async (test, ms) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 150)); return v; };`;
    const F = `const F = await import("${repoUrl}/scripts/trial-floor.mjs");`;
    const order = [IDS.aiko, IDS.botan, IDS.chie];
    const floorOn = client => client.eval(`${F} const f = F.trialFloor(); return f ? { mode: f.mode, holder: f.holderId, step: f.round?.step ?? null, order: f.round?.order ?? null } : null;`);
    const turnFrom = (client, actorId, kind) => client.eval(`${F} const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestTurn({ actorId: "${actorId}", kind: "${kind}", step: F.trialFloor()?.round?.step ?? F.trialFloor()?.closing?.step ?? 0 });
        return { ok: res.ok === true, reason: res.reason ?? null };`, { timeout: 30000 });
    const mark = client => client.eval(`globalThis.__s67d = globalThis.__dialogLog.length; globalThis.__s67m = new Set(game.messages.map(m => m.id)); return true;`);

    /* ------------------------------ setup ------------------------------ */
    const plan = { name: canary.marker("keyplan.name"), text: canary.marker("keyplan.text") };
    await gm.eval(`await game.drpg.setKeyPlan({ chapter: 1, entries: [{ name: "${plan.name}", text: "${plan.text}" }] });
        const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await setClock({ ...getClock(), phase: "classTrial" });
        await game.settings.set("danganronpa-rpg", "trialQueue", {});
        return true;`, { timeout: 60000 });
    // A player's turn window is answered by the scenario (the harness would press its default at once): recorded, closed.
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; return true;`);
    await settle(800);

    /* ------------------------------ T. Testimony ------------------------------ */
    begin("T", "a Testimony with an Objection at the speaker and the queue back");
    for (const c of [p1, p2, p3]) await mark(c);
    const started = await gm.eval(`const f = await game.drpg.startTestimony({ seconds: 60, order: ${J(order)} });
        return f ? { mode: f.mode, holder: f.holderId, order: f.round?.order ?? null } : null;`, { timeout: 60000 });
    await settle(1500);
    const seen = [];
    for (const c of [p1, p2, p3]) seen.push(await floorOn(c));
    const windows = [];
    for (const c of [p1, p2, p3]) {
        windows.push(await c.eval(`const title = game.i18n.format("DRPG.Trial.turn.title", { seconds: 60 });
            return globalThis.__dialogLog.slice(globalThis.__s67d ?? 0).filter(d => d.title === title).length;`));
    }
    const panel = await p2.eval(`const E = await import("${repoUrl}/scripts/events.mjs"); const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const card = E.trialCard(getClock()); return { title: card?.title ?? null, sub: card?.sub ?? null, meta: card?.meta ?? null,
            next: game.i18n.format("DRPG.Events.trialNext", { name: game.actors.get("${IDS.botan}").name }) };`);
    const hud = await p3.eval(`const H = await import("${repoUrl}/scripts/hud.mjs"); const slot = H.trialSlot();
        return { label: slot?.label ?? null, speaker: slot?.speaker ?? null, want: game.i18n.format("DRPG.Hud.trialSpeaks", { name: game.actors.get("${IDS.aiko}").name }) };`);
    verdict("the GM's Testimony is Aiko's turn on every player, in the order given",
        J(started?.order) === J(order) && seen.every(s => s?.mode === "testimony" && s.holder === IDS.aiko && J(s.order) === J(order)), J({ started, seen }));
    verdict("only p1, Aiko's player, is shown \"Your turn - 60 s\"", J(windows) === J([1, 0, 0]), J(windows));
    verdict("p2's Event panel names the speaker and who is next; p3's HUD says who speaks",
        panel.sub === "Aiko Hoshino" && panel.meta === panel.next && hud.speaker === hud.want, J({ panel, hud }));
    await canary.scan({ phase: "T-start" });

    const early = await turnFrom(p2, IDS.botan, "done");
    await settle(500);
    const afterEarly = await floorOn(gm);
    const done = await turnFrom(p1, IDS.aiko, "done");
    await settle(800);
    const afterDone = [];
    for (const c of [gm, p1, p2, p3]) afterDone.push(await floorOn(c));
    verdict("p2 calling Botan's turn done during Aiko's is refused, and the floor stays Aiko's",
        early.ok === false && early.reason === "notYourTurn" && afterEarly?.holder === IDS.aiko, J({ early, afterEarly }));
    verdict("p1 calls Aiko's turn done from its own page: Botan's turn, the next step, on every browser",
        done.ok === true && afterDone.every(s => s?.mode === "testimony" && s.holder === IDS.botan && s.step === 2), J({ done, afterDone }));

    const exchange = await gm.eval(`${F}
        const wrong = await F.openObjection("${IDS.chie}", "${IDS.aiko}", {});
        const opened = await F.openObjection("${IDS.chie}", "${IDS.botan}", {});
        const atObjection = F.trialFloor()?.mode ?? null;
        await F.openRebuttal();
        const atRebuttal = F.trialFloor()?.mode ?? null;
        await game.drpg.skipStep();
        await new Promise(r => setTimeout(r, 500));
        const f = F.trialFloor();
        return { wrong: wrong ?? null, opened: Boolean(opened), atObjection, atRebuttal, mode: f?.mode ?? null, holder: f?.holderId ?? null };`, { timeout: 60000 });
    verdict("an Objection is aimed only at the speaker; its rebuttal skipped, the queue resumes at Chie",
        exchange.wrong === null && exchange.opened && exchange.atObjection === "objection" && exchange.atRebuttal === "rebuttal"
            && exchange.mode === "testimony" && exchange.holder === IDS.chie, J(exchange));
    await canary.scan({ phase: "T-exchange" });

    const passed = await turnFrom(p3, IDS.chie, "pass");
    await settle(1200);
    const cards = [];
    for (const c of [p1, p2, p3]) {
        cards.push(await c.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
            const passes = game.i18n.format("DRPG.Floor.round.passes", { name: "Chie Mori" });
            const over = game.i18n.format("DRPG.Floor.round.over", { mode: game.i18n.localize("DRPG.Floor.mode.testimony") });
            return [fresh.some(t => t.includes(passes)), fresh.some(t => t.includes(over))];`));
    }
    verdict("p3 passes Chie's turn, the last: every player holds \"Chie Mori passes.\" and \"The Testimony is over.\", and the floor is closed",
        passed.ok === true && cards.every(c => J(c) === J([true, true])) && (await floorOn(gm)) === null, J({ passed, cards }));
    await canary.scan({ phase: "T-end" });

    /* ------------------------------ P. Panic Round, the heartbeat held ------------------------------ */
    begin("P", "a Panic Round moved on by the players' browsers while the GM's heartbeat is held");
    await gm.eval(`const real = globalThis.setInterval; globalThis.__s67interval = real;
        globalThis.setInterval = (fn, ms, ...rest) => (String(new Error().stack).includes("trial-floor.mjs") ? 0 : real(fn, ms, ...rest));
        return true;`);
    let panic = null;
    try {
        panic = await gm.eval(`${F} const f = await game.drpg.startPanicRound({ seconds: 15, order: ${J(order)} });
            return f ? { mode: f.mode, holder: f.holderId, at: Date.now() } : null;`, { timeout: 60000 });
        await settle(800);
        const objected = await p2.eval(`const T = await import("${repoUrl}/scripts/trial.mjs");
            return await T.raiseObjection(game.actors.get("${IDS.botan}"));`, { timeout: 30000 });
        const stood = await floorOn(gm);
        verdict("a Panic Round of 15 s opens on Aiko; p2's OBJECTION! is refused and the round stands",
            panic?.mode === "panic" && panic.holder === IDS.aiko && objected === false && stood?.mode === "panic" && stood.holder === IDS.aiko, J({ panic, objected, stood }));
        const moved = await gm.eval(`${until} ${F} const t0 = Date.now();
            const f = await until(() => (F.trialFloor()?.holderId === "${IDS.botan}" ? F.trialFloor() : null), 22000);
            return { holder: f?.holderId ?? null, step: f?.round?.step ?? null, after: Math.round((Date.now() - ${panic?.at ?? 0}) / 1000) };`, { timeout: 40000 });
        verdict("with the GM's heartbeat held, Aiko's 15 s run out and the players' browsers move the round to Botan within 19 s",
            moved.holder === IDS.botan && moved.step === 2 && moved.after <= 19, J(moved));
    } finally {
        await gm.eval(`if (globalThis.__s67interval) globalThis.setInterval = globalThis.__s67interval; return true;`);
    }
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); F.renderTrialFloor(); return true;`, { timeout: 30000 });
    await settle(800);
    await canary.scan({ phase: "P" });

    /* ------------------------------ C. the Closing Argument ------------------------------ */
    begin("C", "a Closing Argument: volunteers kept by the GMs, the draw changed, an exchange decided, an Overrule in both modes");
    for (const c of [p1, p2, p3]) await mark(c);
    const closingOn = client => client.eval(`${F} const f = F.trialFloor(); const H = await import("${repoUrl}/scripts/hud.mjs");
        const keyed = v => v && typeof v === "object" && Object.entries(v).some(([k, x]) => k === "volunteers" || k === "drawn" || keyed(x));
        return { mode: f?.mode ?? null, phase: f?.closing?.phase ?? null, holder: f?.holderId ?? null, count: f?.closing?.count ?? null,
            hud: H.trialSlot()?.speaker ?? null, words: { two: game.i18n.format("DRPG.Floor.closing.volunteers", { n: 2 }),
                confirming: game.i18n.localize("DRPG.Floor.closing.confirming"), deciding: game.i18n.localize("DRPG.Floor.closing.deciding") }, keyed: keyed(game.settings.get("danganronpa-rpg", "trialQueue")) || keyed(game.settings.get("danganronpa-rpg", "trialProgress")) };`);
    const gmClosing = (body, timeout = 60000) => gm.eval(`${F} const api = game.drpg; ${body}`, { timeout });
    const claimMarker = canary.marker("closing.volunteer");
    const opened = await gmClosing(`const f = await api.startClosing(); return f ? f.closing?.phase ?? null : null;`);
    await settle(1500);
    const asked = [];
    for (const c of [p1, p2, p3]) {
        asked.push(await c.eval(`const title = game.i18n.localize("DRPG.Floor.mode.closing");
            return globalThis.__dialogLog.slice(globalThis.__s67d ?? 0).filter(d => d.title === title).length;`));
    }
    const claimFrom = (client, actorId) => client.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestClaim({ actorId: "${actorId}" }); return { ok: res.ok === true, count: res.value?.count ?? null };`, { timeout: 30000 });
    const claimed = [await claimFrom(p1, IDS.aiko), await claimFrom(p2, IDS.botan)];
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { RECORD } = await import("${repoUrl}/scripts/gm-store.mjs");
        await S.closingClaimStore.patch(RECORD, { volunteers: [...(S.closingClaimStore.get(RECORD)?.volunteers ?? []), "${claimMarker}"] }); return true;`);
    await settle(800);
    const volunteering = await closingOn(p3);
    verdict("the GM opens the Closing Argument and every player is asked to volunteer, once",
        opened === "volunteer" && J(asked) === J([1, 1, 1]), J({ opened, asked }));
    verdict("p1 and p2 volunteer from their own pages; p3 reads \"Volunteers: 2\" and no world setting names a volunteer",
        claimed.every(c => c.ok) && claimed[1].count === 2 && volunteering.phase === "volunteer" && volunteering.count === 2 && !volunteering.keyed
            && volunteering.hud === volunteering.words.two, J({ claimed, volunteering }));
    await canary.scan({ phase: "C-volunteers" });

    await gmClosing(`await api.skipStep(); return true;`);
    await settle(800);
    const confirming = await closingOn(p2);
    const drawnOk = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { RECORD } = await import("${repoUrl}/scripts/gm-store.mjs");
        return ["${IDS.aiko}", "${IDS.botan}"].includes(S.closingClaimStore.get(RECORD)?.drawn);`);
    await gmClosing(`await api.pickClosingSpeaker("${IDS.chie}"); return true;`);
    await settle(1200);
    const chieOn = [];
    for (const c of [p1, p2, p3]) chieOn.push(await closingOn(c));
    const pickedCards = await p1.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
        return [fresh.some(t => t.includes(game.i18n.format("DRPG.Floor.closing.speaks", { name: "Chie Mori" }))), fresh.some(t => /Drawn|draw/i.test(t))];`);
    verdict("Skip draws one of the two volunteers and p2 reads that the GM is confirming; the GM picks Chie, and the card names Chie and no draw",
        confirming.phase === "choice" && confirming.hud === confirming.words.confirming && drawnOk
            && chieOn.every(f => f.phase === "speak" && f.holder === IDS.chie && !f.keyed) && J(pickedCards) === J([true, false]), J({ confirming, drawnOk, chieOn, pickedCards }));

    const decided = await gmClosing(`await F.openObjection("${IDS.aiko}", "${IDS.chie}", {}); await F.openRebuttal(); await api.skipStep();
        await new Promise(r => setTimeout(r, 500)); return F.trialFloor()?.closing?.phase ?? null;`);
    await settle(800);
    const deciding = await closingOn(p1);
    await gmClosing(`await api.continueClosing("${IDS.aiko}"); return true;`);
    await settle(1200);
    const aikoOn = await closingOn(p2);
    const continued = await p2.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
        return fresh.some(t => t.includes(game.i18n.format("DRPG.Floor.closing.continues", { name: "Aiko Hoshino", time: "5:00" })));`);
    verdict("Aiko's Objection at Chie, its rebuttal skipped: p1 reads that the GM decides; the GM gives the Closing to Aiko - \"(5:00)\" on p2",
        decided === "decide" && deciding.hud === deciding.words.deciding && aikoOn.phase === "speak" && aikoOn.holder === IDS.aiko
            && continued, J({ decided, deciding, aikoOn, continued }));

    const overruled = await gmClosing(`await F.openObjection("${IDS.botan}", "${IDS.aiko}", {}); const at = F.trialFloor()?.before?.at(-1)?.leftAtObjection ?? null;
        await api.overruleObjection(); await new Promise(r => setTimeout(r, 300)); const f = F.trialFloor();
        return { mode: f?.mode ?? null, holder: f?.holderId ?? null, close: Math.abs(F.secondsLeft() - at) <= 2 };`);
    const resigned = await turnFrom(p1, IDS.aiko, "pass");
    await settle(1200);
    const ended = [];
    for (const c of [p1, p2, p3]) {
        ended.push(await c.eval(`${F} const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
            return [fresh.some(t => t.includes(game.i18n.localize("DRPG.Floor.closing.over"))), F.trialFloor()];`));
    }
    const record = await gm.eval(`const V = await import("${repoUrl}/scripts/vote.mjs"); const c = V.trialProgress().closing; return { done: c?.done ?? null, via: (c?.speakers ?? []).map(s => s.via) };`);
    verdict("Botan's Objection at Aiko overruled: Aiko again with her seconds; p1's Pass ends the Closing - every player told, the record done",
        overruled.mode === "closing" && overruled.holder === IDS.aiko && overruled.close && resigned.ok
            && ended.every(e => J(e) === J([true, null])) && record.done === true && J(record.via) === J(["picked", "objection"]), J({ overruled, resigned, ended, record }));

    const testimonyOverrule = await gmClosing(`await api.startTestimony({ seconds: 60, order: ${J(order)} });
        await F.openObjection("${IDS.chie}", "${IDS.aiko}", {}); await F.openRebuttal(); await api.overruleObjection();
        await new Promise(r => setTimeout(r, 300)); const f = F.trialFloor(); const out = { mode: f?.mode ?? null, holder: f?.holderId ?? null };
        if (F.trialFloor()) await api.endMode(); return out;`);
    verdict("an Overrule in a Testimony's exchange gives Aiko her turn back", testimonyOverrule.mode === "testimony" && testimonyOverrule.holder === IDS.aiko,
        J(testimonyOverrule));
    await settle(800);
    await canary.scan({ phase: "C" });

    /* ------------------------------ D. the undiscovered dead ------------------------------ */
    begin("D", "a death nobody has found takes no turn");
    const dead = await gm.eval(`${F} const C = await import("${repoUrl}/scripts/chapter.mjs"); const Vo = await import("${repoUrl}/scripts/voice.mjs");
        const V = await import("${repoUrl}/scripts/vote.mjs");
        const botan = game.actors.get("${IDS.botan}");
        const killed = Boolean(await C.killCharacter(botan, { secret: true, keepBullets: true }));
        await Vo.settleTrialVoices();
        const f = await game.drpg.startTestimony({ seconds: 60, order: ${J(order)} });
        const out = { killed, published: game.drpg.isDeceased(botan), participants: V.trialParticipants().map(p => p.actor.id), order: f?.round?.order ?? null };
        if (F.trialFloor()) await game.drpg.endMode();
        return out;`, { timeout: 60000 });
    verdict("Botan, killed with nobody told, is not a participant and gets no turn: the Testimony's order is Aiko, Chie",
        dead.killed && dead.published === false && !dead.participants.includes(IDS.botan) && J(dead.order) === J([IDS.aiko, IDS.chie]), J(dead));
    await canary.scan({ phase: "D" });
    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const botan = game.actors.get("${IDS.botan}");
        if (C.isDeadForGm(botan)) await C.reviveCharacter(botan, { quiet: true });
        const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await setClock({ ...getClock(), phase: "dailyLife" });
        return true;`, { timeout: 60000 });
    await settle(500);
    return { phases: Object.keys(counts) };
}
