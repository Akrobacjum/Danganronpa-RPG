/**
 * What a player outside the incident running now is sent of its cast (E32+E07 fix r2-G2,
 * 03.10.2026; the round-2 reviews' S2-m1, S2-m2, S2-m4 and C2-m6).
 *
 * A player who holds no seat is sent a "standing" packet - nothing, or the betrayal offer
 * alone - carrying the seats' stamps, and those move with the incident: a Role reversal
 * that held stamps the killer and the victim at once. murder.mjs `sendCast` sends such a
 * packet once and repeats it, and keeps what it sent with the GMs' record so that a GM
 * whose browser opens later repeats it too; a player never sent one reads no more than the
 * opening. D1, W1, R1, F1 and F2 were red at 7ae1951 (its murder.mjs and gm-stores.mjs
 * with this scenario, e32run/r2g2red, 03.10.2026; the reviews' probes 92 and 94 made checks);
 * A1, W2 and L1 hold the premises and were green there:
 *   D  a third seated after another left holds who left null (S2-m1);
 *   A  the offer's third asks between two incidents (the first of C2-m6's two requests);
 *   W  a Reroll in the second incident, which the offer's third is not in, sends them
 *      nothing (S2-m4), and nor does the rest of that incident;
 *   R  their ask after a Role reversal that held reads what A read (S2-m2's R1, C2-m6);
 *   F  a player whose first ask comes after the Role reversal reads the opening's seats,
 *      and a GM that sorts first, connecting mid-fight, answers both players as before
 *      (S2-m2's F1, F2 - the stand-in for a primary GM's reload);
 *   L  the offer's third walks into that incident and leaves it: their copy is the offer
 *      alone again (what the memo's "sent a seat's copy" keeps true).
 */
export const layers = ["ci"];
export const timeoutMs = 240000;
export const accounts = [
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true },
    { who: "gm0", id: "USERGA0000000000", name: "Zero GM", role: 4, character: null, color: "#aa0000", late: true }
];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const SEATS = ["killerId", "victimId", "thirdId", "betrayal"];
const seatsOf = stamps => Object.fromEntries(SEATS.map(f => [f, stamps?.[f] ?? null]));

export async function run({ gm, p1, p2, p3, p4, gm0, check, phase, settle, connect, disconnect, repoUrl, IDS }) {
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; return true;`);
    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id, aiko: game.actors.getName("Aiko Hoshino").id,
        botan: game.actors.getName("Botan Kage").id, daichi: game.actors.getName("Daichi Sato").id };`);
    // The killer's opening roll is resolved on the GM below; the window on Chie's player's browser is held unanswered.
    const holdOn = id => `const a = game.actors.get("${id}"); globalThis.__heldOpenings = [];
        a.rollTrait = function () { return new Promise(r => globalThis.__heldOpenings.push(r)); }; return true;`;
    const releaseOn = id => `const a = game.actors.get("${id}"); delete a.rollTrait;
        const held = globalThis.__heldOpenings ?? []; delete globalThis.__heldOpenings; for (const r of held) r(null); return held.length;`;
    const CAP = `globalThis.__casts = [];
        game.socket.on("module.${MOD}", p => { if (p?.action === "incident.myCast") globalThis.__casts.push({ cast: p.cast ?? null, stamps: p.stamps ?? null }); });
        return true;`;
    const ASK = to => `const n = globalThis.__casts.length;
        game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${to}"] });
        await new Promise(r => setTimeout(r, 2000));
        const P = globalThis.__casts; return { n: P.length - n, last: P[P.length - 1] ?? null };`;
    const TAKE = `const P = globalThis.__casts ?? []; globalThis.__casts = []; return P;`;
    const HEAD = `const M = await import("${repoUrl}/scripts/murder.mjs");
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        const [chie, aiko, botan, daichi] = ["${ids.chie}", "${ids.aiko}", "${ids.botan}", "${ids.daichi}"].map(id => game.actors.get(id));
        const turnTo = async (a, key) => { for (let i = 0; i < 4 && M.crisisRefusal(a, key)?.why === "not their turn"; i++) await M.passTurn(); };
        const seats = () => M.castPacket("${IDS.p1}", M.murderState()).stamps;`;

    await gm.eval(`const Mi = await import("${repoUrl}/scripts/migrate.mjs"); await Mi.migrationOnLoad();
        const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.whenHydrated(); return true;`, { timeout: 90000 });
    await settle(2000);
    await p2.eval(CAP);
    await p3.eval(holdOn(ids.chie));

    /* D: Daichi (nobody's) walks in and averts his eyes; Botan (p2) walks in after him. */
    phase("D: a later third's copy", { flow: "murder-incident" });
    const first = await gm.eval(`${HEAD}
        for (const a of [chie, aiko, botan, daichi]) if (C.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true });
        await M.openMurder({ killerId: chie.id, victimId: aiko.id, openingTrait: "body" });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        const entered = Boolean(await M.thirdPartyEnters(daichi));
        await M.resolveCrisisAction({ actorId: daichi.id, key: "avertedEyes", total: 0, isCritical: false, withHope: true });
        const botanIn = Boolean(await M.thirdPartyEnters(botan));
        const s = M.murderState() ?? {};
        return { stage: s.stage ?? null, entered, botanIn, thirdId: s.thirdId ?? null, departed: s.departed ?? null };`, { timeout: 90000 });
    await settle(1500);
    const botanCopy = await p2.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { thirdId: c.thirdId ?? null, departed: c.departed ?? null };`);
    check("D1: the GMs hold who left, and the third seated after him holds it null",
        first.stage === "incident" && first.entered && first.botanIn && J(first.departed) === J([ids.daichi])
        && botanCopy.thirdId === ids.botan && botanCopy.departed === null, J({ first, botanCopy }));

    /* The offer: Botan joins Chie, the Finishing blow kills, the incident closes; the offer stands (D18). */
    const close1 = await gm.eval(`${HEAD}
        await M.resolveCrisisAction({ actorId: botan.id, key: "crimePartners", total: 20, isCritical: false, withHope: true });
        await turnTo(chie, "finishingBlow");
        await M.resolveCrisisAction({ actorId: chie.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        await M.endMurder({ reason: "suite", followUp: false });
        return { offer: M.betrayalTarget(botan)?.id ?? null };`, { timeout: 90000 });
    await settle(1500);

    /* A: Botan asks between the two incidents - an answer that repeats the close's packet. */
    phase("A: the offer's third asks between two incidents", { flow: "murder-incident" });
    const closed = (await p2.eval(TAKE)).at(-1) ?? null;
    const asked0 = await p2.eval(ASK(IDS.gm));
    check("A1: the offer's third, asking after the close, is answered with the offer alone and the close's packet",
        close1.offer === ids.chie && asked0.n === 1 && J(Object.keys(asked0.last?.cast ?? {})) === J(["betrayal"])
        && J(asked0.last?.stamps) === J(closed?.stamps), J({ close1, closed, asked0 }));
    await p2.eval(TAKE);

    /* W: the second incident, Chie against Aiko, Botan outside it: Aiko's Leave a clue fails and a
       Reroll takes it back; then her Self-defence, and a Role reversal that holds. */
    phase("W: a Reroll and a Role reversal in an incident the offer's third is not in", { flow: "murder-incident" });
    const second = await gm.eval(`${HEAD}
        if (C.isDeadForGm(aiko)) await C.reviveCharacter(aiko, { quiet: true });
        await M.openMurder({ killerId: chie.id, victimId: aiko.id, openingTrait: "body" });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        const atOpen = seats();
        await turnTo(aiko, "leaveClue");
        await M.resolveCrisisAction({ actorId: aiko.id, key: "leaveClue", total: 1, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 1200));
        const replayed = Boolean(await M.resolveCrisisAction({ actorId: aiko.id, key: "leaveClue", total: 20, isCritical: false, withHope: true, undo: true }));
        const afterReroll = seats();
        return { stage: M.murderState()?.stage ?? null, replayed, atOpen, afterReroll,
            seated: Array.from(M.participantIds(M.murderState()) ?? []).includes(botan.id) };`, { timeout: 90000 });
    await settle(1500);
    const duringReroll = await p2.eval(TAKE);
    check("W1: a Reroll's rewind sends the offer's third nothing, and the offer keeps its stamp",
        second.stage === "incident" && second.replayed && second.seated === false && duringReroll.length === 0
        && second.afterReroll?.betrayal === second.atOpen?.betrayal, J({ second, duringReroll }));
    const reversal = await gm.eval(`${HEAD}
        await turnTo(aiko, "selfDefence");
        await M.resolveCrisisAction({ actorId: aiko.id, key: "selfDefence", total: 99, isCritical: false, withHope: true });
        await turnTo(aiko, "roleReversal");
        await new Promise(r => setTimeout(r, 1200));
        await M.resolveCrisisAction({ actorId: aiko.id, key: "roleReversal", total: 99, isCritical: false, withHope: true });
        const s = M.murderState() ?? {};
        return { stage: s.stage ?? null, swapped: s.killerId === aiko.id && s.victimId === chie.id, afterRR: seats() };`, { timeout: 90000 });
    await settle(1500);
    const duringFight = await p2.eval(TAKE);
    const atOpen = second.atOpen ?? {}, afterRR = reversal.afterRR ?? {};
    check("W2: the Role reversal held, and the offer's third was sent nothing while it ran",
        reversal.stage === "incident" && reversal.swapped && afterRR.killerId > atOpen.killerId && duringFight.length === 0,
        J({ reversal: { ...reversal, afterRR: seatsOf(afterRR) }, atOpen: seatsOf(atOpen), duringFight }));

    /* R: Botan's console asks again after the Role reversal. */
    phase("R: the offer's third asks after a Role reversal", { flow: "murder-incident" });
    const asked1 = await p2.eval(ASK(IDS.gm));
    check("R1: the second answer is the first one - its seats' stamps do not show the Role reversal",
        asked1.n === 1 && J(asked1.last) === J(asked0.last) && (asked1.last?.stamps?.killerId ?? 0) < afterRR.killerId,
        J({ asked1: asked1.last, asked0: asked0.last, afterRR: seatsOf(afterRR) }));

    /* F1: Player Four connects after the Role reversal and asks. */
    phase("F: a player's first answer, and a GM that connects mid-fight", { flow: "murder-incident" });
    await connect("p4");
    await settle(4000);
    await p4.eval(CAP);
    const p4asked = await p4.eval(ASK(IDS.gm));
    const p4stamps = p4asked.last?.stamps ?? {};
    check("F1: a player whose first ask comes after the Role reversal reads the seats as the opening stamped them",
        p4asked.last && J(p4asked.last.cast) === J({}) && p4stamps.killerId === atOpen.killerId && p4stamps.victimId === atOpen.victimId
        && p4stamps.thirdId <= atOpen.thirdId, J({ p4: p4stamps, atOpen: seatsOf(atOpen), afterRR: seatsOf(afterRR) }));
    await p4.eval(TAKE);

    /* F2: a GM whose id sorts first connects and becomes the primary; every player asks it (drpgPrimaryReady). */
    let gm0ok = false;
    try {
        await connect("gm0");
        gm0ok = true;
        await settle(9000);
    } catch (err) {
        check("F2: a late GM that sorts first could connect", false, String(err?.message ?? err));
    }
    if (gm0ok) {
        const primary = await p2.eval(`const { primaryGmId } = await import("${repoUrl}/scripts/utils.mjs"); return primaryGmId();`);
        const p2saw = await p2.eval(TAKE);
        const p4saw = await p4.eval(TAKE);
        check("F2: the GM that connects mid-fight answers the offer's third and the late player with what they were sent before",
            primary === "USERGA0000000000" && p2saw.length > 0 && p2saw.every(p => J(p) === J(asked0.last))
            && p4saw.length > 0 && p4saw.every(p => J(p) === J(p4asked.last)),
            J({ primary, p2saw, p4saw, asked0: asked0.last?.stamps ?? null, p4first: p4stamps }));
        await disconnect("gm0");
        await settle(3000);
    }

    /* L: Botan walks into the second incident and averts his eyes - a seat's copy, then the offer
       alone again, whose value and stamp are the ones he was sent before he walked in. */
    phase("L: the offer's third walks in and leaves", { flow: "murder-incident" });
    await p2.eval(TAKE);
    const walked = await gm.eval(`${HEAD}
        const entered = Boolean(await M.thirdPartyEnters(botan));
        await M.resolveCrisisAction({ actorId: botan.id, key: "avertedEyes", total: 0, isCritical: false, withHope: true });
        const s = M.murderState() ?? {};
        return { entered, thirdId: s.thirdId ?? null, stage: s.stage ?? null };`, { timeout: 60000 });
    await settle(1500);
    const leftCopy = await p2.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); return Object.keys(incidentCast()).sort();`);
    const leftSaw = await p2.eval(TAKE);
    check("L1: a third who holds the offer and leaves the fight is sent the offer alone, and their copy holds nothing else",
        walked.entered && walked.thirdId === null && walked.stage === "incident" && J(leftCopy) === J(["betrayal"])
        && leftSaw.length >= 2 && J(Object.keys(leftSaw.at(-1)?.cast ?? {})) === J(["betrayal"]),
        J({ walked, leftCopy, leftSaw: leftSaw.map(p => Object.keys(p.cast ?? {}).length) }));

    await gm.eval(`${HEAD}
        await M.endMurder({ reason: "suite", followUp: false });
        await M.clearBetrayalOffer();
        for (const a of [chie, aiko]) if (C.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true });
        return true;`, { timeout: 60000 });
    await settle(1200);
    await p3.eval(releaseOn(ids.chie));
}
