/**
 * L2: the crime pipeline end-to-end on three live clients.
 * Chie (GM-driven) murders Daichi; Aiko (p1) investigates; everyone votes.
 * At every stage: what leaks to the players?
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl, canary }) {
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
    phase("opening", { flow: "murder-incident" });
    const open = await gm.eval(`
        const r = await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.daichi}", openingTrait: "body" });
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
    phase("opening roll", { flow: "murder-incident" });
    const opening = await gm.eval(`
        const r = await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return { r: !!r, state: game.drpg.murderState()?.stage, tracker: game.drpg.incidentTracker?.() ?? null };
    `, { timeout: 60000 });
    check("gm: killer opening resolves", opening.r || opening.state, JSON.stringify(opening).slice(0, 300));

    await gm.eval(`await game.drpg.passTurn(); return true;`, { timeout: 30000 });
    await settle(300);

    // -- 3. the finishing blow ------------------------------------------------
    /* A critical (E32+E07 C13, 03.10.2026; audit S04-07, the owner's D13): its first clean-up
       attempt costs Chie no Sanity, read with the gloves' scrub below. */
    phase("finishing blow", { flow: "murder-incident" });
    const kill = await gm.eval(`
        await game.drpg.resolveCrisisAction({ actorId: "${ids.chie}", key: "finishingBlow", total: 99, isCritical: true, withHope: true });
        await new Promise(r => setTimeout(r, 1700));
        const daichi = game.actors.get("${ids.daichi}");
        return { stage: game.drpg.murderState()?.stage, dead: game.drpg.isDeadForGm(daichi), flag: game.drpg.isDeceased(daichi) };
    `, { timeout: 60000 });
    /* TWO PHASES (E05 C10, 26.09.2026; audit S06-11): the blow kills for the GMs, and the table
       learns of it when the body is found - the flag used to reach p1 with the blow. */
    check("gm: finishing blow kills, for the GMs, with no flag yet", kill.dead === true && kill.flag === false && kill.stage === "resolution", JSON.stringify(kill));

    await settle(400);
    const deadOnP1 = await p1.eval(`const a = game.actors.get("${ids.daichi}"); return { flag: game.drpg.isDeceased(a), known: game.drpg.isDeadForGm(a) };`);
    check("p1: the death is not on p1's client before the body is found", deadOnP1.flag === false && deadOnP1.known === false, JSON.stringify(deadOnP1));

    // -- 4. resolution & body discovery --------------------------------------
    phase("discovery", { flow: "body-discovery" });
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
    /* The GM's discovery (a player's call above does nothing) publishes the death: the flag reaches p1 now.
       ON THE BODY'S SCENE (E05 fix r2-G3, 27.09.2026; review F6). The watcher runs on the primary GM
       whatever scene it is looking at, and the discovery published the kept bodies of a same-named
       room on the scene in view. So the GM looks at the Annex here; Botan is killed and kept too and
       lies in Daichi's room, and Aiko and Chie walk in together: the watcher names the first body it
       finds (Botan), and Daichi has to be found in the room by the discovery itself. Botan is revived
       after, for the vote. Red on 8c6dfd6: Daichi stayed a death nobody had found. */
    /* THE GLOVES THE CLEAN-UP USED (E32+E07 C12, 02.10.2026; audit S05-38, the owner's D13). The
       discovery broke the Cleaning Tool in the killer's hand when the body was found, so gloves put
       away after the clean-up were kept. Chie readies gloves, scrubs a trace laid at her feet (the
       GM's `resolveCleanup`, as the bridge calls it) and puts them away; the discovery below must
       break them from the GMs' `usedTools` row, and take the row. The trace goes with the scrub, or
       is taken away here if it stood.
       THE CRITICAL'S FREE ATTEMPT (E32+E07 C13): that scrub is Chie's first attempt after a critical
       Finishing blow, and costs her no Sanity; a second scrub, of a second trace, costs one. Her
       Sanity is set clear for the two and put back after; the grant is read before and after the
       first (`freeCleanup`, the GMs' cast). */
    const gloves = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        const CL = await import("${repoUrl}/scripts/cleanup.mjs"); const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const chie = game.actors.get("${ids.chie}"), floor = canvas.scene, at = floor.tokens.find(t => t.actorId === chie.id);
        const [item] = await chie.createEmbeddedDocuments("Item", [{ name: "E32 C12 10 gloves", type: "loot",
            flags: { "${MOD}": { category: "cleaningTool", equipped: true, tier: 1 } } }]);
        const sanity = () => chie.system.resources.stress.value, was = sanity();
        await chie.update({ "system.resources.stress.value": 0 });
        const grant = game.drpg.murderState()?.freeCleanup ?? null;
        const scrub = async note => {
            const trace = await R.placeRemnant({ type: "incident", visibility: "evident", x: at.x, y: at.y, scene: floor, note });
            const before = sanity();
            await CL.resolveCleanup({ actorId: chie.id, tokenId: trace?.id, total: 30, isCritical: false, withHope: true });
            const stood = trace ? floor.tokens.get(trace.id) : null;
            if (stood) { try { await R.dropRemnantSecret(stood); } catch {} await stood.delete(); }
            return { placed: Boolean(trace), stood: Boolean(stood), cost: sanity() - before };
        };
        const first = await scrub("E32 C12 10 a trace Chie scrubs");
        const left = game.drpg.murderState()?.freeCleanup ?? null;
        const second = await scrub("E32 C13 10 a second trace Chie scrubs");
        await chie.update({ "system.resources.stress.value": was });
        const row = S.usedToolStore?.get(chie.id)?.cleaning ?? [];
        await item.update({ "flags.${MOD}.equipped": false });
        return { id: item.id, placed: first.placed, stood: first.stood, written: row.includes(item.id),
            free: { named: grant === chie.id, first: first.cost, left, second: second.cost, placed: second.placed } };`, { timeout: 60000 });
    check("gm: a critical Finishing blow's first clean-up costs the killer no Sanity and spends the grant, and the second costs one",
        gloves.placed && gloves.free.placed && gloves.free.named === true && gloves.free.first === 0 && gloves.free.left === null
            && gloves.free.second === 1, JSON.stringify(gloves.free), { flow: "murder-incident" });
    const found = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        const daichi = game.actors.get("${ids.daichi}"), botan = game.actors.get("${ids.botan}");
        const floor = canvas.scene, room = M.roomOfActor(daichi);
        const PLACE = { teleport: true, movementAction: "displace", animate: false };
        const tok = a => floor.tokens.find(t => t.actorId === a.id);
        canvas.scene = game.scenes.get("SCENEANNEX000000");
        try {
            await C.killCharacter(botan, { secret: true, keepBullets: true });
            await tok(botan).update(M.positionIn(room, tok(botan)), PLACE);
            await floor.updateEmbeddedDocuments("Token", ["${ids.aiko}", "${ids.chie}"].map(id => {
                const t = floor.tokens.find(x => x.actorId === id);
                return { _id: t.id, ...M.positionIn(room, t) };
            }), PLACE);
            const end = Date.now() + 8000;
            while (!game.drpg.bodyDiscovery?.() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            await new Promise(r => setTimeout(r, 500));
        } finally {
            canvas.scene = floor;
        }
        const out = { room, viewed: "annex", found: game.drpg.bodyDiscovery?.()?.room ?? null, flag: game.drpg.isDeceased(daichi), botan: game.drpg.isDeceased(botan) };
        await C.reviveCharacter(botan, { quiet: true });
        return out;`, { timeout: 60000 });
    await settle(500);
    const deadOnP1After = await p1.eval(`return game.drpg.isDeceased(game.actors.get("${ids.daichi}"));`);
    check("p1: the body's discovery makes the death the table's, on p1's client too - both bodies in the room, on the body's scene while the GM looks at another",
        found.found === found.room && found.flag === true && found.botan === true && deadOnP1After === true, JSON.stringify({ found, deadOnP1After }));
    const glovesAfter = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { isBroken } = await import("${repoUrl}/scripts/inventory.mjs");
        const chie = game.actors.get("${ids.chie}"), item = chie.items.get("${gloves.id}");
        const out = { broken: Boolean(item) && isBroken(item), row: Boolean(S.usedToolStore?.has(chie.id)) };
        await item?.delete();
        return out;`);
    check("gm: the discovery breaks the gloves the killer scrubbed with and put away, and takes their row",
        gloves.placed && gloves.written && glovesAfter.broken === true && glovesAfter.row === false, JSON.stringify({ gloves, glovesAfter }));

    // -- 5. traces: place a Remnant, observe it into a Truth Bullet ----------
    phase("traces", { flow: "trace-remnant" });
    /* WHAT THE TRACE SAYS IS A MARKER (E30, 24.09.2026). It was `label: "Bloodied
       towel", truth: "..."`, two fields placeRemnant never reads, so the checks below
       looked for words nothing had written and could not fail. `note` and `subject`
       are what it keeps for the GM, and the canary reads every player's browser for them. */
    const secret = { note: canary.marker("remnant.note"), subject: canary.marker("remnant.subject") };
    const remnant = await gm.eval(`
        const scene = game.scenes.active;
        const r = await game.drpg.placeRemnant({
            room: "Gym", type: "neutral", visibility: "obvious",
            note: "${secret.note}", subject: "${secret.subject}"
        });
        await new Promise(res => setTimeout(res, 300));
        const toks = scene.tokens.contents.filter(t => t.getFlag("${MOD}", "isRemnant")).map(t => ({ id: t.id, name: t.name }));
        return { r: typeof r, toks };
    `, { timeout: 60000 });
    check("gm: remnant token placed", (remnant.toks ?? []).length > 0, JSON.stringify(remnant).slice(0, 300));

    const remnantName = (remnant.toks?.[0]?.name ?? "");
    check("gm: remnant token name gives nothing away", !remnantName.includes(secret.note) && !remnantName.includes(secret.subject), remnantName);

    // does the player's client hold the remnant's truth in readable form?
    const truthLeak = await p2.eval(`
        const scene = game.scenes.active;
        const t = scene.tokens.get("${remnant.toks?.[0]?.id ?? "none"}");
        return { flags: t ? t.flags : null };
    `);
    const truthStr = JSON.stringify(truthLeak.flags ?? {});
    check("p2: remnant truth NOT in token flags", !truthStr.includes(secret.note) && !truthStr.includes(secret.subject), truthStr.slice(0, 300));
    await canary.scan({ phase: "traces" });

    // -- 6. vote --------------------------------------------------------------
    phase("trial", { flow: "class-trial" });
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
    phase("end", { flow: "murder-incident" });
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
