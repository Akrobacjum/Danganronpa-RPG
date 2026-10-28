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
 *   D (E70 C7, the undiscovered dead): Botan killed with nobody told, the trial's voices settled on the primary (the
 *     dead listed), and a Testimony started in the order Aiko, Botan, Chie gives Botan no turn.
 * The canary's player scan runs after every phase (`canary.scan`) on a GM's Key Remnant plan planted at the start.
 *
 * What it cannot see: a round at a table of 14-15 people (LIVE-E70-07), a step over on a real server's latency
 * (LIVE-E70-08), the sound of a turn or a Panic Round's start (the harness plays no audio).
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
        const res = await B.requestTurn({ actorId: "${actorId}", kind: "${kind}", step: F.trialFloor()?.round?.step ?? 0 });
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
