const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, check, settle }) {
    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id,
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    // set an accomplice (thirdId) too, if the API supports it
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.daichi}", thirdId: "${ids.botan}" });
        return true;
    `, { timeout: 60000 });
    await settle(300);

    // Phase 1: incident active. Can an uninvolved player (aiko/p1) read the killer?
    const p1read = await p1.eval(`
        const s = game.settings.get("${MOD}", "murderState") ?? {};
        return { killerId: s.killerId ?? null, thirdId: s.thirdId ?? null, victimId: s.victimId ?? null, stage: s.stage };
    `);
    check("SECRECY p1 during incident: killerId hidden", !p1read.killerId, `killerId=${p1read.killerId}`);
    check("SECRECY p1 during incident: accomplice hidden", !p1read.thirdId, `thirdId=${p1read.thirdId}`);

    // Drive to resolution + discovery + trial
    await gm.eval(`
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await game.drpg.passTurn();
        await game.drpg.resolveCrisisAction({ actorId: "${ids.chie}", key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 1700));
        return true;
    `, { timeout: 90000 });
    await settle(400);
    await p1.eval(`try { await game.drpg.discoverBody({ finderId: "${ids.aiko}", victimId: "${ids.daichi}" }); } catch {} return true;`, { timeout: 60000 });
    await gm.eval(`await game.drpg.setClock({ phase: "classTrial" }); await game.drpg.startFloor(); return true;`, { timeout: 60000 });
    await settle(400);

    // Phase 2: class trial in progress - the killer is THE mystery being solved.
    const p1trial = await p1.eval(`
        const s = game.settings.get("${MOD}", "murderState") ?? {};
        return { killerId: s.killerId ?? null, thirdId: s.thirdId ?? null, active: s.active, stage: s.stage };
    `);
    check("SECRECY p1 during class trial: killerId hidden", !p1trial.killerId, JSON.stringify(p1trial));
    check("SECRECY p1 during class trial: accomplice hidden", !p1trial.thirdId, JSON.stringify(p1trial));

    // Also: is killer legible off any actor flag / token the player can read?
    const flagLeak = await p1.eval(`
        const out = [];
        for (const a of game.actors) {
            const f = a.flags?.["${MOD}"] ?? {};
            for (const k of ["blackened","isKiller","killer","accomplice","murderer"]) if (k in f) out.push(a.name + "." + k + "=" + JSON.stringify(f[k]));
        }
        return out;
    `);
    check("SECRECY p1: no killer/blackened flag readable on actors", (flagLeak ?? []).length === 0, JSON.stringify(flagLeak).slice(0, 400));

    await gm.eval(`await game.drpg.endMurder({ reason: "test", followUp: false }); return true;`, { timeout: 60000 });
}
