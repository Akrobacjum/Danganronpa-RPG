/**
 * 72-canary: what a player's browser holds of the GM's secrets and of another
 * player's plans (E30, 24.09.2026; audit S17-07; lib/canary.mjs).
 *
 * The canary's self-test first, so an absence below means something: each surface
 * is shown being read, and a leak planted on purpose comes back as a hit. Then one
 * marker in each secret field the module writes from the GM's side or a killer's -
 * the Key Remnant plan, a trace's note and subject, a Truth Bullet's GM note, a
 * secret project and an indirect murder's condition, a player's pre-session note,
 * a Direct Murder parked in an Eclipse, a hidden token - and one scan of every
 * player's browser once the table is at rest. A marker found where it may not be
 * is a hit: one known-leaks.json describes is that leak, reproduced, and red until
 * its stage; any other fails this run.
 *
 * THROUGH A CHAPTER (E05 C2, 26.09.2026). After "rest" the chapter those secrets
 * belong to is played on, and after each phase the markers are scanned again and
 * p1's and p2's world data - neither is the killer's player's - is read against
 * scripts/world-secrets.mjs and for Chie's actor id (`canary.worldScan`):
 *   trap          the indirect murder's bar filled and its trap armed (it watches Storage);
 *   eclipse       p1 crosses twice; the GM allows Chie's parked Direct Murder;
 *   incident      the lights: Chie kills Botan (p2's), her opening thrown on p3's
 *                 client with forced dice (deleted after use), then a Finishing Blow;
 *   undiscovered  the incident closed with the body not found;
 *   discovery     a Faint Prep trace in Dorm B; Aiko and Daichi walk in, and the
 *                 promotion dialog ticks it;
 *   verdict       a trial naming Daichi, a wrong verdict: Chie survives.
 * Each later E05 commit adds its checks to the phase that shows its secret.
 *
 * E43 extends this to the season (the identity needles of lib/canary.mjs's path).
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS }) {
    phase("selftest");
    await canary.selfTest();

    phase("plant");
    /* The GM's plan for the Key Remnants (investigation.mjs, setKeyPlan). */
    const kp = { name: canary.marker("keyplan.name"), text: canary.marker("keyplan.text"),
        analysis: canary.marker("keyplan.analysis"), note: canary.marker("keyplan.note") };
    await gm.eval(`await game.drpg.setKeyPlan({ chapter: 1, entries: [{ name: "${kp.name}", text: "${kp.text}", analysis: "${kp.analysis}", note: "${kp.note}" }] });
        return true;`);

    /* A trace, not an incident's: hidden, and its note and subject for the GM's ledger only. */
    const trace = { note: canary.marker("remnant.note"), subject: canary.marker("remnant.subject") };
    const traceId = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Gym", type: "prep", visibility: "obvious",
            note: "${trace.note}", subject: "${trace.subject}" });
        return t?.id ?? null;`, { timeout: 60000 });
    check("gm: a trace is placed, its token on the GM's scene", Boolean(traceId), String(traceId));

    /* A Truth Bullet on Aiko (p1's): the bullet is hers to read, its GM note is not. */
    const bulletNote = canary.marker("bullet.note");
    const bullet = await gm.eval(`const item = await game.drpg.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "A torn ticket", playerText: "Half a cinema ticket.", gmNote: "${bulletNote}" });
        return item?.uuid ?? null;`, { timeout: 60000 });
    check("gm: a Truth Bullet is made on Aiko's sheet", Boolean(bullet), String(bullet));

    /* A secret project that is an indirect murder: the killer's (p3's) and the GM's. */
    const project = { name: canary.marker("project.name", { allowed: ["gm", "p3"] }),
        condition: canary.marker("project.condition", { allowed: ["gm", "p3"] }) };
    const made = await gm.eval(`const p = await game.drpg.createProject({ name: "${project.name}", indirectMurder: true, secret: true,
            killerId: "${IDS.chie}", condition: "${project.condition}" });
        return p?.id ?? null;`, { timeout: 60000 });
    check("gm: a secret indirect-murder project is made for Chie", Boolean(made), String(made));

    /* p3's own pre-session note (pre-session-note.mjs), which is for the GMs. */
    const note = canary.marker("note.player", { allowed: ["gm", "p3"] });
    await p3.eval(`const { saveNote } = await import("${repoUrl}/scripts/pre-session-note.mjs");
        await saveNote(game.user.id, "${note}");
        return true;`);

    /* A Direct Murder parked during an Eclipse, by the killer's player (eclipse.mjs). */
    const park = canary.marker("park.note", { allowed: ["gm", "p3"] });
    const eclipse = await gm.eval(`await game.drpg.startEclipse(); return game.drpg.isEclipse();`, { timeout: 60000 });
    check("gm: an Eclipse is open", eclipse === true, String(eclipse));
    await p3.eval(`const { parkDirectMurder } = await import("${repoUrl}/scripts/eclipse.mjs");
        await parkDirectMurder({ killerId: "${IDS.chie}", room: "Gym", note: "${park}" });
        return true;`, { timeout: 60000 });
    await settle(1000);
    const parked = await gm.eval(`return game.settings.get("${MOD}", "pendingMurders")?.["${IDS.chie}"] ? true : false;`);
    check("gm: Chie's Direct Murder is parked, waiting for the GM", parked === true, String(parked));

    /* A token the GM hid. */
    const hidden = canary.marker("token.hidden");
    await gm.eval(`const scene = game.scenes.active ?? canvas.scene;
        const [t] = await scene.createEmbeddedDocuments("Token", [{ name: "${hidden}", hidden: true, x: 3000, y: 2500 }]);
        return t?.id ?? null;`);

    phase("rest");
    await settle(1500);
    await canary.scan({ phase: "rest" });

    /* THE INDIRECT MURDER'S KILLER IS NOT IN WORLD DATA (E05 C1, 26.09.2026; audit S09-05, D3). The
       scan reads the condition's marker; the killer and the builder are actor ids, which carry no
       marker, so they are asked of the setting itself - on the two browsers that are not the
       killer's player's. The project's own row has to be there, or its absence measures nothing.
       Red on 93bbde8 (1.2.63) with this check alone, as known leak S09-05: p1 and p2 each held the
       project's killerId, by, condition and trigger, and Chie's actor id. */
    const metaHolds = p => p.eval(`const meta = game.settings.get("${MOD}", "projectMeta") ?? {};
        const fields = Object.entries(meta).flatMap(([id, row]) => ["killerId", "by", "condition", "trigger"]
            .filter(f => row && typeof row === "object" && Object.hasOwn(row, f)).map(f => id + "." + f));
        return { row: Object.hasOwn(meta, "${made ?? "none"}"), fields, killer: JSON.stringify(meta).includes("${IDS.chie}") };`);
    const metaP1 = await metaHolds(p1), metaP2 = await metaHolds(p2);
    check("p1 and p2: projectMeta holds no killerId, by, condition or trigger, and no character id of the killer",
        Boolean(made) && [metaP1, metaP2].every(m => m.row && !m.fields.length && !m.killer), JSON.stringify({ p1: metaP1, p2: metaP2 }));

    /* An unfound trace is a token, and a token reaches every browser (S17-64): not a
       marker in a field, so it is asked of the scene itself. */
    const holders = [];
    for (const p of [p1, p2, p3]) {
        if (await p.eval(`return Boolean((game.scenes.active ?? canvas.scene)?.tokens.get("${traceId ?? "none"}"));`)) holders.push(p.who);
    }
    check("an unfound trace's token reaches no player's browser", holders.length === 0,
        holders.length ? `trace token ${traceId} on ${holders.join(", ")}` : "", { knownLeak: "S17-64", measured: Boolean(traceId) });

    /* ------------------------------ E05: a chapter ------------------------------ */

    /* The chapter the planted secrets belong to, played on from where plant left it: the
       Eclipse is running and Chie's Direct Murder parked. Each phase waits for the state it
       needs, then `canary.scan` (the markers) and `canary.worldScan` (the world-secrets rule,
       and Chie's actor id in world data) run on p1 and p2. Positions are the GM's to set - a
       GM's move is free (movement.mjs) - so who stands where is the scenario's, not the dice's. */
    const settled = async (name, what, ms = 20000) => {
        const until = Date.now() + ms;
        let v = await what();
        while (!v && Date.now() < until) { await settle(250); v = await what(); }
        return v;
    };
    const scanned = async name => {
        await settle(800);
        await canary.scan({ phase: name });
        await canary.worldScan({ phase: name, ids: [IDS.chie] });
    };
    const PROJ = `const P = await import("${repoUrl}/scripts/projects.mjs"); const T = await import("${repoUrl}/scripts/traps.mjs");`;

    /* trap: the indirect murder's bar is filled and its trap armed - it watches Storage, where
       nobody goes. */
    phase("trap");
    const armedTrap = await gm.eval(`${PROJ}
        await P.updateProject("${made ?? "none"}", { room: "Storage", trigger: { kind: "enters", afterDark: false, notBuilder: true } });
        const row = P.allProjects().find(p => p.id === "${made ?? "none"}");
        if (row) await P.addProgress(row.id, Math.max(1, row.start - row.current), { by: "${IDS.chie}" });
        await new Promise(r => setTimeout(r, 300));
        return { armed: T.diagnoseTraps().armed, complete: P.isComplete(P.allProjects().find(p => p.id === "${made ?? "none"}")) };`, { timeout: 60000 });
    check("gm: the indirect murder's bar is filled and its trap armed", armedTrap.complete === true && armedTrap.armed >= 1, JSON.stringify(armedTrap));
    await scanned("trap");

    /* eclipse: p1 crosses twice (the bridge's own request, as 33 does, so the count is the GM's),
       and the GM allows Chie's parked declaration now, so the lights do not wait on a window. */
    phase("eclipse");
    const crossings = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const first = await B.requestEclipseMove("${IDS.aiko}"), second = await B.requestEclipseMove("${IDS.aiko}");
        return [first?.ok ?? null, second?.ok ?? null];`, { timeout: 60000 });
    const ruled = await gm.eval(`await game.drpg.ruleOnParkedMurder("${IDS.chie}", true);
        return { left: game.drpg.eclipseMovesLeft(game.actors.get("${IDS.aiko}")), eclipse: game.drpg.isEclipse() };`, { timeout: 60000 });
    check("p1: Aiko crosses twice in the Eclipse and has no crossing left", JSON.stringify(crossings) === "[true,true]" && ruled.left === 0 && ruled.eclipse === true,
        JSON.stringify({ crossings, ruled }));
    await scanned("eclipse");

    /* incident: the lights. Botan (p2's) stands beside Chie in Dorm B and nobody else is there;
       the Eclipse ends and the allowed declaration opens the incident. Chie's opening is thrown on
       p3's client with forced dice - a critical, which always opens (61 F) - deleted after use;
       p1 and p2 answer nothing, and the GM resolves the Finishing Blow, as 10-murder does. */
    phase("incident");
    for (const c of [p1, p2]) await c.eval(`globalThis.__dialogAuto = false; return true;`);
    await gm.eval(`await canvas.scene.tokens.get("TOKBOTAN00000000").update({ x: 500, y: 1400 }); return true;`);
    await p3.eval(`globalThis.__forceRoll = { hope: 10, fear: 10 }; return true;`);
    await gm.eval(`await game.drpg.endEclipse(); return true;`, { timeout: 90000 });
    const opened = await settled("incident", () => gm.eval(`const s = game.drpg.murderState(); return s?.stage === "incident" ? s.stage : null;`));
    await p3.eval(`delete globalThis.__forceRoll; globalThis.__dialogAuto = false; return true;`);
    const killed = await gm.eval(`await game.drpg.resolveCrisisAction({ actorId: "${IDS.chie}", key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 1500));
        return { stage: game.drpg.murderState()?.stage ?? null, dead: game.drpg.isDeceased(game.actors.get("${IDS.botan}")) };`, { timeout: 60000 });
    check("gm: at the lights Chie's declaration opens the incident, and her Finishing Blow kills Botan",
        opened === "incident" && killed.dead === true && killed.stage === "resolution", JSON.stringify({ opened, killed }));
    await scanned("incident");

    /* undiscovered: the incident is closed with nobody having found Botan. */
    phase("undiscovered");
    const closed = await gm.eval(`await game.drpg.endMurder({ reason: "closed", followUp: false });
        return { stage: game.drpg.murderState()?.stage ?? null, found: game.settings.get("${MOD}", "bodyFound") ?? null };`, { timeout: 60000 });
    check("gm: the incident closes with the body not yet found", !closed.stage || closed.stage === "idle", JSON.stringify(closed));
    await scanned("undiscovered");

    /* discovery: a Faint Prep trace is left in Dorm B; Aiko and Daichi walk in, the second
       witness sets the discovery off, and the GM's promotion dialog ticks every trace it lists. */
    phase("discovery");
    const prep = await gm.eval(`const t = await game.drpg.placeRemnant({ room: "Dorm B", type: "prep", visibility: "obvious", faint: true, note: "72: a Faint Prep trace" });
        globalThis.__promoted = null;
        globalThis.__dialogAnswers.push(async function promote(cfg) {
            if (cfg.window?.title !== game.i18n.localize("DRPG.Chapter.promoteTitle")) { globalThis.__dialogAnswers.unshift(promote); return null; }
            const el = document.createElement("dialog");
            if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
            const boxes = [...el.querySelectorAll('input[name="promote"]')];
            boxes.forEach(box => { box.checked = true; });
            globalThis.__promoted = boxes.length;
            const ok = (cfg.buttons ?? []).find(b => b.action === "ok");
            return ok.callback(new window.Event("click"), { form: null }, { element: el });
        });
        return t?.id ?? null;`, { timeout: 60000 });
    await gm.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 600, y: 1300 });
        await canvas.scene.tokens.get("TOKDAICHI0000000").update({ x: 650, y: 1500 }); return true;`, { timeout: 60000 });
    const found = await settled("discovery", () => gm.eval(`const b = game.settings.get("${MOD}", "bodyFound"); return b?.room ? { room: b.room, promoted: globalThis.__promoted } : null;`));
    check("gm: Aiko and Daichi find Botan in Dorm B, and the promotion dialog lists the Faint Prep trace",
        Boolean(prep) && found?.room === "Dorm B" && found?.promoted >= 1, JSON.stringify({ prep, found }));
    await scanned("discovery");

    /* verdict: the trial names Daichi, which is wrong - Chie survives, and is the Blackened
       the verdict rewards. p1 votes; p3 (the killer's player) too; p2's student is dead. */
    phase("verdict");
    await gm.eval(`await game.drpg.setClock({ phase: "classTrial" }); await game.drpg.startFloor(); return true;`, { timeout: 60000 });
    for (const c of [p1, p3]) {
        await c.eval(`globalThis.__dialogAuto = true;
            globalThis.__dialogAnswers.push(async function ballot(cfg) {
                if (!(cfg.classes ?? []).includes("drpg-ballot")) { globalThis.__dialogAnswers.unshift(ballot); return null; }
                const el = document.createElement("dialog");
                if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
                const radio = el.querySelector('input[name="choice0"][value="${IDS.daichi}"]');
                if (!radio) return null;
                radio.checked = true;
                const button = (cfg.buttons ?? []).find(b => b.default) ?? cfg.buttons?.[0];
                return button.callback(new window.Event("click"), { form: null }, { element: el });
            });
            return true;`);
    }
    const ballots = await gm.eval(`return await game.drpg.openVote();`, { timeout: 60000 });
    await settled("verdict", () => gm.eval(`const V = await import("${repoUrl}/scripts/vote.mjs"); return V.votesIn() >= 2 ? true : null;`));
    const verdict = await gm.eval(`const r = await game.drpg.closeVote();
        await game.drpg.applyVerdict?.({ correct: false, executedIds: ["${IDS.daichi}"], blackenedIds: ["${IDS.chie}"] });
        const V = await import("${repoUrl}/scripts/vote.mjs");
        return { accused: r?.accusedId ?? null, applied: V.trialProgress().verdictApplied === true,
            chieAlive: !game.drpg.isDeceased(game.actors.get("${IDS.chie}")) };`, { timeout: 90000 });
    check("gm: the vote names Daichi, a wrong verdict, and Chie survives it",
        ballots >= 2 && verdict.accused === IDS.daichi && verdict.applied && verdict.chieAlive, JSON.stringify({ ballots, verdict }));
    await scanned("verdict");
}
