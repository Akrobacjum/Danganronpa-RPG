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
 * A SECOND TRIAL WITH "NOBODY" (E40, 15.11.2026 on the line claude/e39-40-116): after the close, in the same chapter,
 * the trial ended and started again, a new vote of a later round counted with none of the first one's ballots, and the
 * verdict the window sends for "Nobody is executed", which sentences and executes nobody; scanned after each step.
 * Five mutants, each KILLED here (docs/dev/e40/STATUS.md). In that second vote a player joins late (p4, declared below):
 * handed a fourth ballot at load, asks again, casts, and is told once that the vote is in. Two mutants, KILLED here.
 * Before it, the GM's browser reloads mid-vote (`reload`, as F5; not a late second GM) and counts p1's ballot from the
 * GMs' store; its scans read dice-sync.mjs's world copy, which names every actor alike (world-secrets.mjs
 * `uniformActorRows`, R7405).
 *
 * THE FINAL TRIAL (E40, 15.11.2026, the same line): then a student nobody plays made the Mastermind, the Final Trial's
 * flag up, the trial started again, and a wrong Final verdict on Botan: one public card, the flag down, nobody
 * executed at the close; the scans look for the Mastermind's id and name too. Four mutants, each KILLED here.
 *
 * Not here (63-class-trial's and 72-canary's): the ballot windows drawn, the verdict's
 * window, the Level Ups of a correct verdict; the markers of the GMs' other secrets.
 */
export const layers = ["ci"];
export const timeoutMs = 300000;
/* A player who joins after the second trial's ballots went out (63's p4, as 63 declares it). */
export const accounts = [{ who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true }];
const P4 = "USERP4000000000A";

const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p3, p4, check, phase, settle, canary, repoUrl, IDS, connect, reload }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    const p3User = await p3.eval(`return game.user.id;`);
    const chieName = await gm.eval(`return game.actors.get("${IDS.chie}")?.name ?? null;`);
    const daichiName = await gm.eval(`return game.actors.get("${IDS.daichi}")?.name ?? null;`);
    const BLACKENED = [IDS.chie, IDS.daichi].sort();
    const ACCUSED = [IDS.botan, IDS.aiko];
    /* The scan after a step: p1's and p2's world data and their new cards, for Chie, her name and her player. */
    /* The Final Trial's steps add the Mastermind's id and name (`also`). */
    const also = { ids: [], names: [] };
    const scan = async step => {
        await canary.worldScan({ phase: step, who: ["p1", "p2"], ids: [IDS.chie, IDS.daichi, ...also.ids] });
        await canary.chatScan({ phase: step, who: ["p1", "p2"], actorIds: [IDS.chie, IDS.daichi, ...also.ids], names: [chieName, daichiName, ...also.names], userIds: [p3User] });
    };
    await canary.chatMark({ who: ["p1", "p2"] });

    phase("opened", { flow: "class-trial" });
    const opened = await gm.eval(`const C = ${imp("chapter.mjs")}, { blackenedStore } = ${imp("gm-stores.mjs")};
        const { seasonEpoch, getClock } = ${imp("settings.mjs")}, I = ${imp("incident-store.mjs")};
        const victim = await Actor.create({ name: "S18 Victim", type: "character" });
        const second = await Actor.create({ name: "S18 Second Victim", type: "character" });
        /* The Final Trial's Mastermind (below), made now with the other fixtures: dice-sync.mjs's world copy, written at the
           primary's load, then holds a row for it like every actor's (world-secrets.mjs \`uniformActorRows\`). */
        const mm = await Actor.create({ name: "S18 Mastermind", type: "character" });
        const fx = { victim: victim.id, second: second.id, mastermind: mm.id, clock: foundry.utils.deepClone(getClock()) };
        await C.killCharacter(victim, { secret: false, keepBullets: true });
        await C.killCharacter(second, { secret: false, keepBullets: true });
        await blackenedStore.patch("${IDS.chie}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [victim.id] });
        await blackenedStore.patch("${IDS.daichi}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [second.id] });
        globalThis.__dialogAnswers.push("ok");
        const { startClassTrial } = ${imp("trial-floor-ui.mjs")};
        return { fx, started: await startClassTrial(), phase: getClock().phase, known: I.trialBlackenedIds().slice().sort() };`, { timeout: 60000 });
    /* What the finally takes back, kept here and not on the GM's page, which the reload below clears. */
    const FX = { ...(opened?.fx ?? {}) };
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

        /* A SECOND TRIAL, AND ITS VERDICT "NOBODY" (E40, 15.11.2026 on the line claude/e39-40-116; the plan's "a second
           trial (D17)" and "a verdict with ... 'Nobody'"). 63 H drives the second trial's start on its own GMs and 63 F
           reads that the verdict's window offers "Nobody is executed"; no scenario gave that verdict and read what it
           leaves. Here, in the same chapter: Botan and Aiko put back by the GM (a fixture step, as the finally does), the
           trial ended and started again (yes to "a new trial"), a new vote - no ballot of the first one counted, its
           round carried on - cast and counted on Botan and Aiko again, and the verdict the window sends for "Nobody is
           executed" (verdict.mjs `read`: `executedIds: []`), wrong, naming both Blackened. Nobody is sentenced, and the
           trial's close kills nobody: Botan and Aiko alive after it. The scans run after every step, as above. */
        phase("second trial", { flow: "class-trial" });
        const again = await gm.eval(`const C = ${imp("chapter.mjs")}, V = ${imp("vote.mjs")}, UI = ${imp("trial-floor-ui.mjs")};
            const { getClock } = ${imp("settings.mjs")};
            for (const id of ${J(ACCUSED)}) await C.reviveCharacter(game.actors.get(id), { quiet: true });
            const late = await Actor.create({ name: "S18 Late", type: "character", ownership: { default: 0, "${P4}": 3 } });
            globalThis.__dialogAnswers.push(true);
            const ended = await UI.endClassTrial();
            const between = getClock().phase;
            globalThis.__dialogAnswers.push("ok", "ok");
            const started = await UI.startClassTrial();
            const p = V.trialProgress();
            return { late: late.id, ended: Boolean(ended), between, started, phase: getClock().phase, verdictApplied: Boolean(p.verdictApplied),
                vote: p.vote ?? null, executedAt: p.executedAt ?? null,
                alive: ${J(ACCUSED)}.every(id => !game.drpg.isDeadForGm(game.actors.get(id))) };`, { timeout: 60000 });
        FX.late = again?.late ?? null;
        await settle(1200);
        check("second trial: ended and started again in the same chapter - Daily Life between, the Class Trial after, the first verdict's lock and its execution's stamp cleared, Botan and Aiko alive",
            again?.between !== "classTrial" && again.started === true && again.phase === "classTrial" && again.verdictApplied === false
                && again.executedAt === null && again.alive === true, J(again));
        await scan("second trial");

        /* A GM'S RELOAD AND A LATE PLAYER, IN THE SECOND VOTE (E40, 15.11.2026, the same line; the plan's "a GM reload during
           the vote" and "a late player with ack"; 63 C and D drive both, on a second GM, without the scans). The vote opens
           with three ballots (p4, the owner of "S18 Late", not connected); p1 casts; the GM's browser reloads (`reload`,
           its storage kept, as F5) and the GM that comes back counts p1's ballot from the GMs' store. Then p4 connects,
           heard before its world has loaded, asks the primary at load and is handed a fourth ballot - the record's
           `issued` grows to four - which the harness's default press dismisses (warned once); it asks again (vote.mjs
           `askForBallot`, as its next load would), casts Botan and Aiko in the window, and is told once that its vote is
           in (the ack). p2 and p3 cast; four in. */
        phase("second ballots", { flow: "class-trial" });
        const sent2 = await gm.eval(`const V = ${imp("vote.mjs")}; const issued = await game.drpg.openVote();
            return { issued, round: V.trialProgress().vote?.round ?? null, picks: V.trialProgress().vote?.picks ?? null, inAtOpen: V.votesIn() };`, { timeout: 60000 });
        await settle(1200);
        const cast2 = c => c.eval(`const B = ${imp("gm-bridge.mjs")};
            const r = await B.requestBallotCast(${J(sent2?.round ?? 0)}, ${J(ACCUSED)});
            return { ok: r?.ok ?? null, reason: r?.reason ?? null };`, { timeout: 30000 });
        const answers2 = { p1: await cast2(p1) };
        await settle(1200);
        check("second ballots: three handed out for a round after the first trial's, none of the first trial's ballots counted at the open, and p1's cast and counted",
            sent2?.issued === 3 && sent2.round > (sent?.round ?? Infinity) && sent2.picks === 2 && sent2.inAtOpen === 0 && answers2.p1.ok === true,
            J({ sent2, firstRound: sent?.round ?? null, answers2 }));
        await scan("second ballots");

        phase("gm reload", { flow: "class-trial" });
        const reloaded = await reload("gm");
        const afterReload = await gm.eval(`const V = ${imp("vote.mjs")}, { ballotStore } = ${imp("gm-stores.mjs")};
            await ballotStore.whenHydrated?.();
            const deadline = Date.now() + 8000;
            while (V.votesIn() !== 1 && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
            return { open: V.trialProgress().vote?.open ?? null, votesIn: V.votesIn(), round: V.trialProgress().vote?.round ?? null };`, { timeout: 30000 });
        check("gm reload: the GM's browser reloaded mid-vote finds the vote open and p1's ballot in the GMs' store - one in",
            reloaded?.back === true && afterReload?.open === true && afterReload.votesIn === 1 && afterReload.round === sent2?.round,
            J({ reloaded, afterReload }));
        await scan("gm reload");

        phase("late player", { flow: "class-trial" });
        const words = key => `game.i18n.localize(${J(key)})`;
        const told = (key, ms = 10000) => p4.eval(`const w = ${words(key)}; const deadline = Date.now() + ${ms};
            const n = () => globalThis.__notifications.filter(note => note.msg === w).length;
            while (!n() && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
            return n();`, { timeout: ms + 15000 });
        await connect("p4", { announceFirst: true });
        const lateAsk = { warned: await told("DRPG.Vote.dismissed") };
        lateAsk.issued = await gm.eval(`return (${imp("vote.mjs")}).trialProgress().vote?.issued ?? null;`);
        /* The window p4's next ask draws, answered as a player answers it: Botan in the first list, Aiko in the second. */
        await p4.eval(`globalThis.__dialogAnswers.push(async function ballot(cfg) {
                if (!(cfg.classes ?? []).includes("drpg-ballot")) { globalThis.__dialogAnswers.unshift(ballot); return null; }
                const el = document.createElement("dialog");
                if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
                ${J(ACCUSED)}.forEach((id, i) => { const radio = el.querySelector('input[name="choice' + i + '"][value="' + id + '"]'); if (radio) radio.checked = true; });
                const button = (cfg.buttons ?? []).find(b => b.default) ?? cfg.buttons?.[0];
                return button.callback(new window.Event("click"), { form: null }, { element: el });
            });
            (${imp("vote.mjs")}).askForBallot(); return true;`);
        lateAsk.ack = await told("DRPG.Vote.castConfirmed");
        lateAsk.counted = await gm.eval(`const V = ${imp("vote.mjs")}; const deadline = Date.now() + 8000;
            while (V.votesIn() !== 2 && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
            return V.votesIn();`, { timeout: 20000 });
        check("late player: p4 connects after the ballots went out and is handed a fourth at load (dismissed by the harness's press, warned once), asks again, casts, is told once its vote is in, and the GM counts it",
            lateAsk.warned === 1 && (lateAsk.issued ?? []).length === 4 && lateAsk.issued.includes(P4) && lateAsk.ack === 1 && lateAsk.counted === 2,
            J(lateAsk));
        await scan("late player");

        Object.assign(answers2, { p2: await cast2(p2), p3: await cast2(p3) });
        await settle(1200);
        const inNow2 = await gm.eval(`return (${imp("vote.mjs")}).votesIn();`);
        check("second ballots in: p2 and p3 cast too - four in",
            Object.values(answers2).every(a => a.ok === true) && inNow2 === 4, J({ answers2, inNow2 }));
        await scan("second ballots in");

        phase("second count", { flow: "class-trial" });
        const count2 = await gm.eval(`const V = ${imp("vote.mjs")}; await V.closeVote();
            const p = V.trialProgress(); return { closed: p.voteClosed, accused: p.accusedIds ?? null };`, { timeout: 60000 });
        await settle(1200);
        check("second count: closed and counted, Botan and Aiko accused again",
            count2?.closed === true && J([...(count2.accused ?? [])].sort()) === J([...ACCUSED].sort()), J(count2));
        await scan("second count");

        phase("nobody", { flow: "class-trial" });
        const nobody = await gm.eval(`const V = ${imp("vote.mjs")}, D = foundry.applications.api.DialogV2, own = Object.getOwnPropertyDescriptor(D, "wait");
            D.wait = async () => null;
            const from = game.messages.size;
            try { await V.applyVerdict({ correct: false, executedIds: [], blackenedIds: ${J([IDS.chie, IDS.daichi])} }); }
            finally { if (own) Object.defineProperty(D, "wait", own); else delete D.wait; }
            const p = V.trialProgress();
            const card = game.messages.contents.slice(from).find(m => m.getFlag("danganronpa-rpg", "verdictAt") === p.verdict?.at);
            return { stage: p.verdict?.stage ?? null, sentenced: p.verdict?.sentenced ?? null,
                saysNobody: Boolean(card?.content?.includes(game.i18n.localize("DRPG.Vote.nobodyExecuted"))),
                cut: card?.getFlag("danganronpa-rpg", "verdictCut")?.sentenced ?? null };`, { timeout: 60000 });
        await settle(1500);
        check("nobody: the wrong verdict that executes nobody is given - nobody sentenced, its public card says \"Nobody is executed\" and its cut-in names nobody",
            nobody?.stage === "done" && J(nobody.sentenced) === J([]) && nobody.saysNobody === true && J(nobody.cut) === J([]), J(nobody));
        await scan("nobody");

        phase("second close", { flow: "class-trial" });
        const closed2 = await gm.eval(`const V = ${imp("vote.mjs")}; const done = await V.executeAtExit();
            return { executed: [...(done?.executed ?? [])], deadNow: [...${J(ACCUSED)}, "${IDS.chie}", "${IDS.daichi}"].filter(id => game.drpg.isDeadForGm(game.actors.get(id))) };`,
        { timeout: 60000 });
        await settle(1500);
        check("second close: the trial's end after \"Nobody\" executes nobody - Botan, Aiko, Chie and Daichi all alive",
            J(closed2?.executed) === J([]) && J(closed2.deadNow) === J([]), J(closed2));
        await scan("second close");

        /* THE FINAL TRIAL (E40, 15.11.2026 on the line claude/e39-40-116; the plan's "Final Trial"). 63 K drives the Final
           verdict's lock across two GMs and 65 D the flag through a season reset; neither scans a player's browser for the
           Mastermind along the way. Here, in the same chapter after the second trial: a student nobody plays made the
           Mastermind (mastermind.mjs `setMastermind`, the GMs' store), the Final Trial's flag up, the trial ended and
           started again, and the class wrong - the Final verdict on Botan. The Mastermind is the GMs' (mastermind.mjs's
           header): the scans after each step look for their id and name too, and the close executes nobody. */
        phase("final trial", { flow: "class-trial" });
        const final = await gm.eval(`const V = ${imp("vote.mjs")}, UI = ${imp("trial-floor-ui.mjs")}, MM = ${imp("mastermind.mjs")};
            const { getClock } = ${imp("settings.mjs")}, { mastermindStore } = ${imp("gm-stores.mjs")};
            const mm = game.actors.get(${J(FX.mastermind ?? "")});
            const pickBefore = mastermindStore.record()?.actorId ?? null;
            globalThis.__dialogAnswers.push(true);
            await UI.endClassTrial();
            await MM.setMastermind(mm);
            await MM.setFinalTrial(true);
            globalThis.__dialogAnswers.push("ok", "ok");
            const started = await UI.startClassTrial();
            return { id: mm.id, pickBefore, name: mm.name, started, phase: getClock().phase, final: MM.inFinalTrial(), pick: MM.mastermindActor()?.id ?? null };`, { timeout: 60000 });
        await settle(1200);
        if (final?.id) { also.ids.push(final.id); also.names.push(final.name); FX.pick = final.pickBefore; }
        const pSees = await p1.eval(`const MM = ${imp("mastermind.mjs")}; return { final: MM.inFinalTrial(), pick: MM.mastermindActor()?.id ?? null };`);
        check("final trial: the Final Trial starts in the same chapter, its Mastermind the GMs' pick - on the GM, and none on p1",
            final?.started === true && final.phase === "classTrial" && final.final === true && final.pick === final.id
                && pSees?.final === true && pSees.pick === null, J({ final, pSees }));
        await scan("final trial");

        phase("final verdict", { flow: "class-trial" });
        /* Every window answered null, as the verdict step above: the Final verdict's Level Up window, drawn on the GM and
           pressed, threw in the harness (level-up.mjs `readFormData`: the shim has no FormDataExtended, and Node's own
           FormData cannot read a jsdom form - a gap of the shim, measured 15.11.2026, not a road of v14's). */
        const fv = await gm.eval(`const V = ${imp("vote.mjs")}, D = foundry.applications.api.DialogV2, own = Object.getOwnPropertyDescriptor(D, "wait");
            D.wait = async () => null;
            const from = game.messages.size;
            let given = null;
            try { given = await game.drpg.applyFinalVerdict({ correct: false, accusedId: "${IDS.botan}" }); }
            finally { if (own) Object.defineProperty(D, "wait", own); else delete D.wait; }
            const p = V.trialProgress();
            return { given, flagAfter: (${imp("mastermind.mjs")}).inFinalTrial(), stage: p.verdict?.stage ?? null, final: p.verdict?.final ?? null, pending: p.verdict?.sentencePending ?? null,
                cards: game.messages.contents.slice(from).filter(m => !m.whisper?.length).length,
                botanDead: game.drpg.isDeadForGm(game.actors.get("${IDS.botan}")), mmDead: game.drpg.isDeadForGm(game.actors.get("${final?.id ?? ""}")) };`,
        { timeout: 60000 });
        await settle(1500);
        check("final verdict: the wrong Final verdict is given - the record final and done, no sentence waiting, one public card, the Final Trial's flag down, Botan and the Mastermind alive",
            fv?.given?.executed === false && fv.flagAfter === false && fv.stage === "done" && fv.final === true && !fv.pending && fv.cards === 1
                && fv.botanDead === false && fv.mmDead === false, J(fv));
        await scan("final verdict");

        phase("final close", { flow: "class-trial" });
        const fc = await gm.eval(`const V = ${imp("vote.mjs")}; const done = await V.executeAtExit();
            return { executed: [...(done?.executed ?? [])], deadNow: [...${J(ACCUSED)}, "${IDS.chie}", "${IDS.daichi}", "${final?.id ?? ""}"].filter(id => game.drpg.isDeadForGm(game.actors.get(id))) };`,
        { timeout: 60000 });
        await settle(1500);
        check("final close: the trial's end after a wrong Final verdict executes nobody",
            J(fc?.executed) === J([]) && J(fc.deadNow) === J([]), J(fc));
        await scan("final close");
    } finally {
        await gm.eval(`const C = ${imp("chapter.mjs")}, { blackenedStore } = ${imp("gm-stores.mjs")}, w = ${J(FX)};
            for (const id of ${J(ACCUSED)}) { const a = game.actors.get(id);
                if (a && game.drpg.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true }).catch(() => null); }
            for (const id of ${J([IDS.chie, IDS.daichi])}) if (blackenedStore.has(id)) await blackenedStore.drop(id);
            if (Object.hasOwn(w, "pick")) { const MM = ${imp("mastermind.mjs")}; const pick = w.pick ? game.actors.get(w.pick) : null;
                if (pick) await MM.setMastermind(pick); else await MM.clearMastermind(); }
            if (w.clock) await game.drpg.setClock({ phase: w.clock.phase, finalTrial: Boolean(w.clock.finalTrial) });
            for (const id of [w.victim, w.second, w.mastermind, w.late]) if (id) await game.actors.get(id)?.delete();
            return true;`, { timeout: 60000 }).catch(() => null);
    }
}
