export const layers = ["ci"];

const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl }) {
    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id,
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    /* THE KILLER'S PLAN, WRITTEN BEFORE THE SESSION (E30, 24.09.2026). p3 plays Chie,
       and saves the pre-session note that is for the GMs; the canary reads p1's and
       p2's browsers for it after the incident and the trial (lib/canary.mjs). */
    phase("before the session");
    const plan = canary.marker("note.player", { allowed: ["gm", "p3"] });
    const planSaved = await p3.eval(`const { saveNote } = await import("${repoUrl}/scripts/pre-session-note.mjs");
        return await saveNote(game.user.id, "${plan}");`, { timeout: 30000 });
    await settle(200);
    /* The note goes to the GMs since E05 C6 (26.09.2026; audit S11-03): through the primary GM into
       its store, and not onto p3's User document, which every browser holds - where the canary found
       it until then. Red on 50a79af (C5) with this check and S11-03 taken out (26.09): saveNote
       answered true, the flag held the plan's text, and the closing scan found it on p1 and p2. */
    const planOn = await gm.eval(`const N = await import("${repoUrl}/scripts/pre-session-note.mjs");
        return { text: N.noteFor("${p3.userId}"), flag: game.users.get("${p3.userId}").getFlag("${MOD}", "preSessionNote") ?? null };`);
    check("p3's plan is sent to the GMs and kept in their store, and p3's User flag carries no text",
        planSaved === "sent" && planOn.text === plan && planOn.flag?.written === true && !Object.hasOwn(planOn.flag ?? {}, "text"),
        JSON.stringify({ planSaved, planOn }), { flow: "pre-session-note" });

    // set an accomplice (thirdId) too, if the API supports it
    const cards0 = await p1.eval(`return game.messages.contents.length;`);
    /* EVERY WORLD HALF p1's BROWSER RECEIVES THROUGH THE INCIDENT (E32 C2, 28.09.2026), recorded as it
       arrives: p3's opening roll is not forced here, so a read at one moment finds the incident opening,
       running or closed by a failed roll (measured 28.09: one run read it running, the next read `{}`). */
    await p1.eval(`globalThis.__worldHalves = [];
        globalThis.__worldHalvesFn = s => { if (s?.key === "${MOD}.murderState") globalThis.__worldHalves.push(Object.keys(game.settings.get("${MOD}", "murderState") ?? {}).sort()); };
        Hooks.on("updateSetting", globalThis.__worldHalvesFn);
        return true;`);
    const opened = await gm.eval(`
        const M = await import("${repoUrl}/scripts/murder.mjs");
        const s = await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.daichi}", thirdId: "${ids.botan}", openingTrait: "body" });
        return { stage: s?.stage ?? null, told: M.incidentAudienceIds(s) };
    `, { timeout: 60000 });
    await settle(300);

    // Phase 1: incident active. Can an uninvolved player (aiko/p1) read the killer?
    phase("incident", { flow: "murder-incident" });
    /* WHO IS SENT THE CAST AT THE OPENING (E06 C2, 27.09.2026; the owner's D6): a direct murder's
       killers, not its victim. Read on the GM from the state `openMurder` answers, before p3's roll
       can move it. Daichi has no player here, so this reads the same with the victim seated - it
       holds that nobody else is told; the victim's own browser is 13-murder-signals' "opening". */
    check("incident: at a direct murder's opening the cast goes to the killer's player alone",
        opened.stage === "openingRoll" && JSON.stringify(opened.told) === JSON.stringify([p3.userId]), JSON.stringify(opened));
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
    const incidentCards = await p1.eval(`return game.messages.contents.slice(${cards0}).map(m => ({ w: m.whisper, doc: JSON.stringify(m._source),
        author: m._source.author ?? null, speaker: m._source.speaker?.actor ?? null, rolls: (m._source.rolls ?? []).length,
        claimed: Boolean(m._source.flags?.["${MOD}"]?.supersededRoll) }));`);
    const naming = incidentCards.filter(c => [ids.chie, "Chie Mori", ids.botan, "Botan Kage"].some(s => c.doc.includes(s))
        || ([p3.userId, p2.userId].some(u => c.w.includes(u)) && !c.w.includes(p1.userId)));
    /* The precondition is its own check, so the leak check can only be red for the
       leak (E30): an expected red that could also mean "the roll was never thrown"
       would hide a broken scenario behind a known leak. */
    const reached = stage !== "openingRoll" && incidentCards.length > 0;
    check("p1 holds the incident's cards once the opening roll is thrown", reached, JSON.stringify({ stage, held: incidentCards.length }));
    /* The fight is the cast's since E32 C2 (1.2.66) - the round, whose side acts, what is spent: every
       world half the uninvolved player's browser was sent, the open's first, says that an incident runs
       and its stage, nothing more. */
    const halves = await p1.eval(`Hooks.off("updateSetting", globalThis.__worldHalvesFn); return globalThis.__worldHalves;`);
    check("SECRECY p1 during incident: every world half p1's browser received holds that an incident runs and its stage, nothing more",
        halves.some(h => h.includes("active")) && halves.every(h => h.every(k => k === "active" || k === "stage")), JSON.stringify(halves));
    /* THE KNOWN CARD APART FROM THE REST (E30 fix, 25.09.2026). S04-02 is the killer's
       own opening roll: thrown on the killer's player's client, so p3 wrote it, Chie
       speaks it, and it holds a roll. Any other card that names the killer or the
       accomplice is a plain check, so a second leak cannot stay red under the first.
       Measured with a public card naming Chie posted during the incident: the plain
       check failed, the known one stayed expected red. A plain check since E06 C5b: a
       roll the module throws is whispered to the GMs alone and its document is emptied
       as it is created (private-rolls.mjs `neutralRollSource`), so nothing in it but its
       author says whose it was - and the author is the next check's. */
    const killersRoll = c => c.author === p3.userId && c.speaker === ids.chie && c.rolls > 0;
    const card = c => ({ whisper: c.w, doc: c.doc.slice(0, 260) });
    const knownCard = naming.filter(killersRoll), otherCards = naming.filter(c => !killersRoll(c));
    check("SECRECY p1 during incident: no card but the killer's own opening roll names the killer or accomplice, or is addressed to them alone",
        otherCards.length === 0,
        JSON.stringify({ stage, held: incidentCards.length, naming: otherCards.map(card) }).slice(0, 1600));
    check("SECRECY p1 during incident: the killer's opening roll names neither the killer nor, in its whisper list, the killer's player",
        knownCard.length === 0,
        JSON.stringify({ stage, held: incidentCards.length, naming: knownCard.map(card) }).slice(0, 1600));
    /* WHO WROTE IT (E06 C5b, 27.09.2026; the owner's answer Q2 (a)). Foundry records as a
       message's author the user whose browser created it, on the server, and every browser
       holds that: p3 threw Chie's opening roll, so p3 was its author on p1's copy, whatever
       the document said - known-leaks.json's `roll-author` until E08+E28 C12a (04.10.2026),
       which draws a player's action roll on the primary GM, who writes its message
       (roll-draw.mjs): its author is the GM. A plain check since. The roll is found by what
       it is - a roll the module threw, the only one of this window - so the check is red for
       the author alone, and not for a roll that never came. A statistic thrown from the sheet
       is drawn the same way since C13 (12-social reads one), and none is thrown in this window. */
    const openingRolls = incidentCards.filter(c => c.claimed && c.rolls > 0);
    check("SECRECY p1 during incident: the killer's opening roll does not name the killer's player as its author",
        openingRolls.length > 0 && openingRolls.every(c => c.author !== p3.userId),
        JSON.stringify({ stage, rolls: openingRolls.map(c => ({ author: c.author, speaker: c.speaker, whisper: c.w })) }));

    // Drive to resolution + discovery + trial
    phase("discovery", { flow: "body-discovery" });
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
    phase("trial", { flow: "class-trial" });
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
