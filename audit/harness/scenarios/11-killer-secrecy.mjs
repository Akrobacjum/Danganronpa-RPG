export const layers = ["ci"];

const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, p3, check, settle }) {
    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id,
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    // set an accomplice (thirdId) too, if the API supports it
    const cards0 = await p1.eval(`return game.messages.contents.length;`);
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

    /* The incident's chat cards, as the uninvolved player's browser holds them.
       Not askable until 1.2.56: the harness kept whispers off clients they were not
       addressed to, so p1 held none of these and a card naming the killer in its
       speaker, or addressed to her player alone, would have passed unseen (audit
       S14-04; CASE-03 in AUDIT-1.2.42). Every card is read whole - content, speaker,
       flags - and "addressed to them alone" means a whisper list naming the killer's
       or the accomplice's player but not p1, which a veiled card never is.

       READ ONCE STAGE 4 HAS BEEN ANSWERED, and required to have been. The killer's
       own client throws the opening roll (murder.mjs `rollOpening` asks the owner),
       then sends the result to the GM, whose state leaves "openingRoll"; the roll
       document went through the relay before that packet, so by then p1 has it.
       The first version read 300 ms after `openMurder`, and in one of four runs
       under load the roll had not been thrown yet - it read two veiled cards and
       passed for that reason. p3's roll is not forced here, and what the stage
       reads next varies: six parallel runs (1.2.56) read "incident" four times and
       no running incident twice, with the roll on p1 in all six. */
    const stage = await gm.eval(`
        for (let i = 0; i < 80 && game.drpg.murderState()?.stage === "openingRoll"; i++) await new Promise(r => setTimeout(r, 100));
        return game.drpg.murderState()?.stage ?? null;`, { timeout: 30000 });
    await settle(300);
    const incidentCards = await p1.eval(`return game.messages.contents.slice(${cards0}).map(m => ({ w: m.whisper, doc: JSON.stringify(m._source) }));`);
    const naming = incidentCards.filter(c => [ids.chie, "Chie Mori", ids.botan, "Botan Kage"].some(s => c.doc.includes(s))
        || ([p3.userId, p2.userId].some(u => c.w.includes(u)) && !c.w.includes(p1.userId)));
    check("SECRECY p1 during incident [known leak S04-02, fixed in E06]: no chat card names the killer or accomplice, or is addressed to them alone",
        stage !== "openingRoll" && incidentCards.length > 0 && naming.length === 0,
        JSON.stringify({ stage, held: incidentCards.length, naming: naming.map(c => ({ whisper: c.w, doc: c.doc.slice(0, 260) })) }).slice(0, 1600));

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
