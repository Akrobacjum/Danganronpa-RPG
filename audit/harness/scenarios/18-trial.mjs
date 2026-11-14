/**
 * 18-trial: the Class Trial step by step with real ballots, and a player leak scan after every step (E40 C5, 13.11.2026;
 * plan docs/dev/plans/E40.md on the planner's branch, item 1: "18-trial on FLOWS with playerLeakScan after every step";
 * the README's planned row, "plan v2 calls it 15-trial; 15 is 15-held").
 *
 * The GM and three players. A fifth student is killed in public and Chie (p3's) is the chapter's Blackened in the GMs'
 * register; the class gets it wrong, so her identity must stay the GMs' to the end. Each step is driven on the browser
 * that does it at a table:
 *   opened    the GM starts the Class Trial;
 *   ballots   the GM sends the ballots, and p1, p2 and p3 - the killer's player too - each cast Botan through the bridge
 *             (bridge-asks.mjs `requestBallotCast`, the road the ballot window takes), each answered by the primary;
 *   count     the GM closes and counts: Botan accused;
 *   verdict   the GM gives the wrong verdict: Botan sentenced, Chie the Blackened (DC36: nobody dies at the verdict);
 *   close     the trial's end carries the sentence out (vote.mjs `executeAtExit`): Botan executed.
 * After every step, on p1 and p2 - neither is Chie's player - their world data is read against world-secrets.mjs and for
 * Chie's actor id (`canary.worldScan`), and the cards that reached them since the last read for Chie, her name and her
 * player (`canary.chatScan`): nothing names her, outside known-leaks.json. The cluster's state check reads the world
 * after the run as after every scenario (E40 C3).
 *
 * TWO BLACKENED (E40, 14.11.2026 on the line claude/e39-43-113; the plan's "two Blackened", left open by C5): a second
 * public death, Daichi's (nobody's student), is in the register beside Chie's, so the trial counts two Blackened, the
 * vote asks each ballot for two names (`picks`, measured: a ballot of one is refused `wrongCount`), so each player casts
 * Botan and Aiko, both are accused, sentenced by the wrong verdict that names both Blackened and executed at the close,
 * and every scan below looks for both Blackened's ids and names; Chie's player is the one cast player to look for
 * (Daichi has none).
 *
 * Not here (63-class-trial's and 72-canary's): the ballot windows, a late player, a GM's reload in the vote, the verdict's
 * window, a second trial, the Level Ups of a correct verdict; the markers of the GMs' other secrets.
 */
export const layers = ["ci"];
export const timeoutMs = 300000;

const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    const p3User = await p3.eval(`return game.user.id;`);
    const chieName = await gm.eval(`return game.actors.get("${IDS.chie}")?.name ?? null;`);
    const daichiName = await gm.eval(`return game.actors.get("${IDS.daichi}")?.name ?? null;`);
    const BLACKENED = [IDS.chie, IDS.daichi].sort();
    const ACCUSED = [IDS.botan, IDS.aiko];
    /* The scan after a step: p1's and p2's world data and their new cards, for Chie, her name and her player. */
    const scan = async step => {
        await canary.worldScan({ phase: step, who: ["p1", "p2"], ids: [IDS.chie, IDS.daichi] });
        await canary.chatScan({ phase: step, who: ["p1", "p2"], actorIds: [IDS.chie, IDS.daichi], names: [chieName, daichiName], userIds: [p3User] });
    };
    await canary.chatMark({ who: ["p1", "p2"] });

    phase("opened", { flow: "class-trial" });
    const opened = await gm.eval(`const C = ${imp("chapter.mjs")}, { blackenedStore } = ${imp("gm-stores.mjs")};
        const { seasonEpoch, getClock } = ${imp("settings.mjs")}, I = ${imp("incident-store.mjs")};
        const victim = await Actor.create({ name: "S18 Victim", type: "character" });
        const second = await Actor.create({ name: "S18 Second Victim", type: "character" });
        globalThis.__s18 = { victim: victim.id, second: second.id, clock: foundry.utils.deepClone(getClock()) };
        await C.killCharacter(victim, { secret: false, keepBullets: true });
        await C.killCharacter(second, { secret: false, keepBullets: true });
        await blackenedStore.patch("${IDS.chie}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [victim.id] });
        await blackenedStore.patch("${IDS.daichi}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [second.id] });
        globalThis.__dialogAnswers.push("ok");
        const { startClassTrial } = ${imp("trial-floor-ui.mjs")};
        return { started: await startClassTrial(), phase: getClock().phase, known: I.trialBlackenedIds().slice().sort() };`, { timeout: 60000 });
    await settle(1000);
    check("opened: the Class Trial starts on two public deaths, with Chie and Daichi the register's Blackened",
        opened?.started === true && opened.phase === "classTrial" && J(opened.known) === J(BLACKENED), J(opened));
    await scan("opened");

    try {
        phase("ballots", { flow: "class-trial" });
        const sent = await gm.eval(`const V = ${imp("vote.mjs")}; const issued = await game.drpg.openVote();
            return { issued, round: V.trialProgress().vote?.round ?? null, picks: V.trialProgress().vote?.picks ?? null };`, { timeout: 60000 });
        await settle(1200);
        const cast = c => c.eval(`const B = ${imp("gm-bridge.mjs")};
            const r = await B.requestBallotCast(${J(sent?.round ?? 1)}, ${J(ACCUSED)});
            return { ok: r?.ok ?? null, reason: r?.reason ?? null };`, { timeout: 30000 });
        const answers = { p1: await cast(p1), p2: await cast(p2), p3: await cast(p3) };
        await settle(1200);
        const inNow = await gm.eval(`return (${imp("vote.mjs")}).votesIn();`);
        check("ballots: three handed out, each asking two names for two Blackened, and p1, p2 and p3 - Chie's player too - each cast Botan and Aiko through the bridge, answered by the primary and counted",
            sent?.issued === 3 && sent.picks === 2 && Object.values(answers).every(a => a.ok === true) && inNow === 3, J({ sent, answers, inNow }));
        await scan("ballots");

        phase("count", { flow: "class-trial" });
        const count = await gm.eval(`const V = ${imp("vote.mjs")}; const counted = await V.closeVote();
            const p = V.trialProgress(); return { counted: Boolean(counted), closed: p.voteClosed, accused: p.accusedIds ?? null };`, { timeout: 60000 });
        await settle(1200);
        check("count: the vote is closed and counted, Botan and Aiko accused", count?.closed === true && J([...(count.accused ?? [])].sort()) === J([...ACCUSED].sort()), J(count));
        await scan("count");

        phase("verdict", { flow: "class-trial" });
        const verdict = await gm.eval(`const V = ${imp("vote.mjs")}, D = foundry.applications.api.DialogV2, own = Object.getOwnPropertyDescriptor(D, "wait");
            D.wait = async () => null;
            try { await V.applyVerdict({ correct: false, executedIds: ${J(ACCUSED)}, blackenedIds: ${J([IDS.chie, IDS.daichi])} }); }
            finally { if (own) Object.defineProperty(D, "wait", own); else delete D.wait; }
            const p = V.trialProgress();
            return { stage: p.verdict?.stage ?? null, sentenced: p.verdict?.sentenced ?? null, botanDead: game.drpg.isDeadForGm(game.actors.get("${IDS.botan}")),
                blackenedAlive: ${J([IDS.chie, IDS.daichi])}.every(id => !game.drpg.isDeadForGm(game.actors.get(id))) };`,
        { timeout: 60000 });
        await settle(1500);
        check("verdict: the wrong verdict is given, both Blackened missed - Botan and Aiko sentenced and, by DC36, not dead yet; Chie and Daichi alive",
            verdict?.stage === "done" && J([...(verdict.sentenced ?? [])].sort()) === J([...ACCUSED].sort()) && verdict.botanDead === false && verdict.blackenedAlive === true, J(verdict));
        await scan("verdict");

        phase("close", { flow: "class-trial" });
        const closed = await gm.eval(`const V = ${imp("vote.mjs")}; const done = await V.executeAtExit();
            return { executed: [...(done?.executed ?? [])].sort(), at: Boolean(V.trialProgress().executedAt), botanDead: game.drpg.isDeadForGm(game.actors.get("${IDS.botan}")),
                aikoDead: game.drpg.isDeadForGm(game.actors.get("${IDS.aiko}")) };`,
        { timeout: 60000 });
        await settle(1500);
        check("close: the trial's end executes Botan and Aiko once and stamps the record",
            J(closed?.executed) === J([...ACCUSED].sort()) && closed.at === true && closed.botanDead === true && closed.aikoDead === true, J(closed));
        await scan("close");
    } finally {
        await gm.eval(`const C = ${imp("chapter.mjs")}, { blackenedStore } = ${imp("gm-stores.mjs")}, w = globalThis.__s18 ?? {};
            for (const id of ${J(ACCUSED)}) { const a = game.actors.get(id);
                if (a && game.drpg.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true }).catch(() => null); }
            for (const id of ${J([IDS.chie, IDS.daichi])}) if (blackenedStore.has(id)) await blackenedStore.drop(id);
            if (w.clock) await game.drpg.setClock({ phase: w.clock.phase });
            for (const id of [w.victim, w.second]) if (id) await game.actors.get(id)?.delete();
            return true;`, { timeout: 60000 }).catch(() => null);
    }
}
