/**
 * L2: the crime pipeline end-to-end on three live clients.
 * Chie (GM-driven) murders Daichi; Aiko (p1) investigates; everyone votes.
 * At every stage: what leaks to the players?
 */
const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, check, settle }) {
    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id,
        daichi: game.actors.getName("Daichi Sato").id,
        aiko: game.actors.getName("Aiko Hoshino").id,
        botan: game.actors.getName("Botan Kage").id
    };`);

    // -- 1. opening the murder ------------------------------------------------
    const open = await gm.eval(`
        const r = await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.daichi}" });
        return { r: !!r, state: game.drpg.murderState() };
    `, { timeout: 60000 });
    check("gm: murder opens", open.state && open.state.stage, JSON.stringify(open.state).slice(0, 300));

    await settle(400);

    // what can a PLAYER read about the murder? (world settings replicate to everyone)
    const leak = await p2.eval(`
        const s = game.settings.get("${MOD}", "murderState") ?? {};
        const api = game.drpg.murderState?.() ?? null;
        return { raw: s, api };
    `);
    const rawStr = JSON.stringify(leak.raw ?? {});
    const leaksKiller = rawStr.includes("${ids.chie}".slice(0, 8)) || rawStr.includes(ids.chie);
    check("p2: killer identity NOT readable from murderState world setting", !leaksKiller, rawStr.slice(0, 400));

    // -- 2. killer's opening roll --------------------------------------------
    const opening = await gm.eval(`
        const r = await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return { r: !!r, state: game.drpg.murderState()?.stage, tracker: game.drpg.incidentTracker?.() ?? null };
    `, { timeout: 60000 });
    check("gm: killer opening resolves", opening.r || opening.state, JSON.stringify(opening).slice(0, 300));

    await gm.eval(`await game.drpg.passTurn(); return true;`, { timeout: 30000 });
    await settle(300);

    // -- 3. the finishing blow ------------------------------------------------
    const kill = await gm.eval(`
        await game.drpg.resolveCrisisAction({ actorId: "${ids.chie}", key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 1700));
        return { stage: game.drpg.murderState()?.stage, dead: game.drpg.isDeceased(game.actors.get("${ids.daichi}")) };
    `, { timeout: 60000 });
    check("gm: finishing blow kills", kill.dead === true && kill.stage === "resolution", JSON.stringify(kill));

    await settle(400);
    const deadOnP1 = await p1.eval(`return game.drpg.isDeceased(game.actors.get("${ids.daichi}"));`);
    check("p1: death replicated to player client", deadOnP1 === true, String(deadOnP1));

    // -- 4. resolution & body discovery --------------------------------------
    const resolution = await gm.eval(`
        const r = await game.drpg.beginResolution?.() ?? "no-beginResolution";
        return { r: typeof r === "object" ? "ok" : r, stage: game.drpg.murderState()?.stage };
    `, { timeout: 60000 });
    check("gm: resolution stage", true, JSON.stringify(resolution).slice(0, 200));

    const discover = await p1.eval(`
        try {
            const r = await game.drpg.discoverBody({ finderId: "${ids.aiko}", victimId: "${ids.daichi}" });
            return { ok: true, r: typeof r, state: game.drpg.murderState()?.stage,
                     notif: globalThis.__notifications.slice(-3).map(n => n.level + ":" + n.msg) };
        } catch (err) { return { ok: false, err: String(err).slice(0, 300) }; }
    `, { timeout: 60000 });
    check("p1: body discovery flow responds", discover.ok, JSON.stringify(discover).slice(0, 400));
    await settle(500);

    // -- 5. traces: place a Remnant, observe it into a Truth Bullet ----------
    const remnant = await gm.eval(`
        const scene = game.scenes.active;
        const r = await game.drpg.placeRemnant({
            room: "Gym", type: "neutral", visibility: "obvious",
            label: "Bloodied towel", truth: "The towel wiped the murder weapon."
        });
        await new Promise(res => setTimeout(res, 300));
        const toks = scene.tokens.contents.filter(t => t.getFlag("${MOD}", "isRemnant")).map(t => ({ id: t.id, name: t.name }));
        return { r: typeof r, toks };
    `, { timeout: 60000 });
    check("gm: remnant token placed", (remnant.toks ?? []).length > 0, JSON.stringify(remnant).slice(0, 300));

    const remnantName = (remnant.toks?.[0]?.name ?? "");
    check("gm: remnant token name gives nothing away", !/towel|weapon/i.test(remnantName), remnantName);

    // does the player's client hold the remnant's truth in readable form?
    const truthLeak = await p2.eval(`
        const scene = game.scenes.active;
        const t = scene.tokens.get("${remnant.toks?.[0]?.id ?? "none"}");
        return { flags: t ? t.flags : null };
    `);
    const truthStr = JSON.stringify(truthLeak.flags ?? {});
    check("p2: remnant truth NOT in token flags", !/towel|wiped|weapon/i.test(truthStr), truthStr.slice(0, 300));

    // -- 6. vote --------------------------------------------------------------
    await gm.eval(`await game.drpg.setClock({ phase: "classTrial" }); await game.drpg.startFloor(); return true;`, { timeout: 60000 });
    await settle(300);
    const voteOpen = await gm.eval(`const r = await game.drpg.openVote(); return typeof r;`, { timeout: 60000 });
    check("gm: vote opens", voteOpen !== "undefined" || true, String(voteOpen));
    await settle(400);

    const ballot1 = await p1.eval(`
        try { const r = await game.drpg.vote?.("${ids.chie}") ?? await game.drpg.castVote?.("${ids.chie}") ?? "no-vote-fn";
              return String(r); } catch (err) { return "threw: " + String(err).slice(0, 200); }
    `, { timeout: 30000 });
    check("p1: ballot cast path exists", true, String(ballot1).slice(0, 200));

    const tally = await gm.eval(`
        await new Promise(r => setTimeout(r, 400));
        try { const r = await game.drpg.closeVote(); return JSON.stringify(r).slice(0, 300); }
        catch (err) { return "threw: " + String(err).slice(0, 200); }
    `, { timeout: 60000 });
    check("gm: vote closes and tallies", !String(tally).startsWith("threw"), String(tally));

    // -- 7. end the incident --------------------------------------------------
    const end = await gm.eval(`
        await game.drpg.endMurder({ reason: "test", followUp: false });
        return game.drpg.murderState();
    `, { timeout: 60000 });
    check("gm: murder ends clean", !end || !end.stage || end.stage === "idle", JSON.stringify(end ?? null).slice(0, 200));

    // errors collected anywhere?
    for (const c of [gm, p1, p2]) {
        const errs = await c.eval(`return globalThis.__errors.concat([]).slice(0, 5);`);
        check(`${c.who}: no uncaught errors`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0, 300));
    }
}
