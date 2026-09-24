/**
 * L2: the crime pipeline end-to-end on three live clients.
 * Chie (GM-driven) murders Daichi; Aiko (p1) investigates; everyone votes.
 * At every stage: what leaks to the players?
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, settle, repoUrl }) {
    // This scenario drives the incident from the GM's client and measures state between its
    // own steps; the killer's player client answering an opening roll it was sent would race it.
    // The players' module socket handlers are PUT ASIDE, not thrown away: the vote in step 6
    // reaches a player only through them, and they are handed back before it opens.
    for (const c of [p1, p2, p3].filter(Boolean)) await c.eval(`globalThis.__dialogAuto = false; globalThis.__mutedSocket = (game.socket._handlers.get("module.danganronpa-rpg") ?? []).splice(0); return true;`);
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
    // By id or by name. The first half of this used to be `"${ids.chie}".slice(0, 8)` in
    // plain quotes - the literal text "${ids.c", which no setting will ever contain.
    const leaksKiller = rawStr.includes(ids.chie) || rawStr.includes("Chie Mori");
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
    // The finishing blow has already moved the incident to "resolution" (Stage 6), so
    // asking for it again must be a no-op: `beginResolution` answers null and writes
    // nothing unless the stage is still "incident". This was `check(..., true)`, and
    // its eval turned the null into "ok" on the way out (`typeof null` is "object").
    const resolution = await gm.eval(`
        const r = await game.drpg.beginResolution();
        return { isNull: r === null, stage: game.drpg.murderState()?.stage };
    `, { timeout: 60000 });
    check("gm: a second beginResolution in Stage 6 changes nothing", resolution.isNull && resolution.stage === "resolution", JSON.stringify(resolution).slice(0, 200));

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
    /*
     * CAST THE WAY A PLAYER CASTS IT. This step used to call `game.drpg.vote` and
     * `game.drpg.castVote`, neither of which exists, and check `true` and
     * `... || true` around them - so the Class Trial's vote could have been broken
     * outright and this file would still have read 17/17 (audit S01-57, S14-19).
     *
     * The real road: `openVote` on the GM sends each player with a living student a
     * `vote.open` packet; their client opens the ballot window (vote.mjs `castBallot`)
     * with one radio per candidate; pressing the button sends `vote.ballot` to the
     * GMs, who tally it by Foundry's sender id. So all three players get their socket
     * handlers back, and p1 and p2 an answer queued that ticks Chie's radio IN THE
     * WINDOW'S OWN CONTENT and presses its own button - a candidate missing from the
     * list means no vote. p3 dismisses theirs, which the tally has to count as
     * silence, not as a vote.
     *
     * Expected, from vote.mjs as it stands: three ballots out (Aiko, Botan, Chie -
     * Daichi is dead and the dead do not vote), two returned for Chie, a majority
     * of floor(3 / 2) + 1 = 2, so Chie is accused and the vote is not tied.
     */
    await gm.eval(`await game.drpg.setClock({ phase: "classTrial" }); await game.drpg.startFloor(); return true;`, { timeout: 60000 });
    await settle(300);
    for (const c of [p1, p2, p3]) {
        await c.eval(`
            (game.socket._handlers.get("module.danganronpa-rpg") ?? []).push(...(globalThis.__mutedSocket ?? []));
            globalThis.__mutedSocket = [];
            globalThis.__ballotSeen = null;
            if ("${c.who}" !== "p3") globalThis.__dialogAnswers.push(async function ballot(cfg) {
                // Some other window first: hand the answer back and close that one.
                if (!(cfg.classes ?? []).includes("drpg-ballot")) { globalThis.__dialogAnswers.unshift(ballot); return null; }
                const el = document.createElement("dialog");
                if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
                globalThis.__ballotSeen = [...el.querySelectorAll('input[name="choice0"]')].map(i => i.value);
                const radio = el.querySelector('input[name="choice0"][value="${ids.chie}"]');
                if (!radio) return null;
                radio.checked = true;
                const button = (cfg.buttons ?? []).find(b => b.default) ?? cfg.buttons?.[0];
                return button.callback(new window.Event("click"), { form: null }, { element: el });
            });
            return true;`);
    }
    const voteOpen = await gm.eval(`return await game.drpg.openVote();`, { timeout: 60000 });
    check("gm: the vote opens to the three players with a living student", voteOpen === 3, JSON.stringify(voteOpen));
    await settle(800);

    // `castConfirmed` is raised only after the `vote.ballot` emit returned (vote.mjs `castBallot`).
    const ballot1 = await p1.eval(`return { seen: globalThis.__ballotSeen, confirmed: game.i18n.localize("DRPG.Vote.castConfirmed"),
        notifs: globalThis.__notifications.slice(-3).map(n => n.level + ":" + n.msg) };`);
    check("p1: the ballot window listed Chie and p1's vote was sent", (ballot1.seen ?? []).includes(ids.chie)
        && ballot1.notifs.includes(`info:${ballot1.confirmed}`), JSON.stringify(ballot1).slice(0, 400));

    const tally = await gm.eval(`
        const V = await import("${repoUrl}/scripts/vote.mjs");
        const inBefore = V.votesIn();
        const pending = (V.pendingVoters() ?? []).map(v => v.user.id);
        const r = await game.drpg.closeVote();
        return { inBefore, pending, r };
    `, { timeout: 60000 });
    const chieRow = (tally.r?.rows ?? []).find(row => row.id === ids.chie);
    check("gm: both ballots arrived and p3 is still outstanding",
        tally.inBefore === 2 && tally.pending.length === 1 && tally.pending[0] === p3.userId, JSON.stringify(tally).slice(0, 400));
    check("gm: the vote closes with Chie accused on two of three ballots",
        chieRow?.n === 2 && tally.r?.total === 3 && tally.r?.tied === false && tally.r?.accusedId === ids.chie,
        JSON.stringify(tally.r).slice(0, 400));

    // -- 7. end the incident --------------------------------------------------
    const end = await gm.eval(`
        await game.drpg.endMurder({ reason: "test", followUp: false });
        return game.drpg.murderState();
    `, { timeout: 60000 });
    check("gm: murder ends clean", !end || !end.stage || end.stage === "idle", JSON.stringify(end ?? null).slice(0, 200));

    // errors collected anywhere?
    for (const c of [gm, p1, p2, p3]) {
        const errs = await c.eval(`return globalThis.__errors.concat([]).slice(0, 5);`);
        check(`${c.who}: no uncaught errors`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0, 300));
    }
}
