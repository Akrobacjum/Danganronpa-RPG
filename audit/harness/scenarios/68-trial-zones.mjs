/**
 * Scenario 68 - the trial hall's zones on the seed's GM and three players (E73 C7, 12.11.2026; Q-E73-1's default).
 * A hall of the scenario's own - Zone A the left half, Zone B the right - is linked as the trial hall with its zones,
 * and Aiko's, Botan's and Chie's hall tokens stand on stands: Aiko in Zone A, Botan and Chie in Zone B.
 *
 *   N (no zones): the zones unpicked, the GM's Straw Poll is refused and no floor opens.
 *   S (Straw Poll): every player reads the same sides as the GM; p2 moves Botan's token into Zone A from its own page;
 *     the GM's Count now gives the Finding "Inside" (2:1) on every player's chat, and every token back on its stand. A
 *     second poll with Chie's token moved out of both zones by p3 (off the hall) is a split (1:1): its card on every
 *     player, and Scrum Debate the GM's next step.
 *   P (a side picked): Chie's hall token taken off the hall, a Straw Poll: p3 picks Zone A from its own page
 *     ("trial.side"); every browser counts Chie in Zone A; a pick for Aiko, who stands in the hall, refused.
 *   D (Logic Dive): a set of two questions in the GMs' store, a canary marker in its name and its conclusion; every
 *     player reads the first question and its two answers, and no player's world or chat holds the marker or a
 *     `truth`; all three into Zone A, Count now, Skip the pause: right, the second question on every player; Botan back
 *     to Zone B and Chie out of both: a tie (1:1), the set ended unrevealed - no Finding, the marker on no player - and
 *     the GM's window warns where it ended before a replay.
 *   C (Scrum Debate): the camps as they stand (Zone A Aiko, Botan; Zone B Chie), Skip the Sides ("Sides set"): Camps
 *     confer on every player with the camps kept, regional voice off - the GMs told once that the voices are not split,
 *     no player told; Skip the Confer: Zone B first, Chie the speaker, and no second notice; p3's thesis from its own page
 *     ("trial.keyword") on p1's chat; p3 moves Chie into Zone A - Zone B empty - and the GM's heartbeat ends the Scrum with
 *     Zone A's answer as a Finding, on every player.
 *   V (the camps' voice rooms; the owner's 13.11.2026): regional voice on (the harness counts avclient-livekit active,
 *     so the primary's `voice.assign` reaches each player's `desiredRoom`), the same camps: in Confer p1 and p2 are sent
 *     Zone A's room and p3 Zone B's, and no notice; p1's page asks again as a reload does (its told room forgotten,
 *     `catchUpVoice`) and is sent Zone A's room again; a second GM connects mid-Confer, reads the phase and decides the
 *     same rooms in its own dry pass, and is not moved into a camp; Skip the Confer: every player back in the trial's
 *     room for the turns. Then a second Scrum: in Confer, End this mode from the second GM: every player back in the
 *     trial's room, no floor.
 *   G (a second GM's Skip; audit A113-C3-2, 13.11.2026): a Straw Poll on the seed's GM, `gm3` connects - a GM after it
 *     in the primary's order, never the primary while it is here - and presses the bar's Skip (`advanceFloorNow`, the
 *     bridge's "floor.now"): the primary counts the poll at once, and gm3 is not told the floor moved on. Red at
 *     ceb9e9c8: the row's sanitizer named five modes, the primary read the poll's mode as null and refused "movedOn".
 * The canary's player scan runs after every phase (`canary.scan`).
 *
 * What it cannot see (LIVE-E73-01..04): v14 regions with holes and Levels, a move on a real server's latency, the
 * zones drawn on a canvas and the entry's animation and sound, a GM reload during a question on a real Foundry. Not
 * driven here, named for the next round: a latecomer joining mid-question, the export and import of a case with a set.
 */
export const layers = ["ci"];
export const accounts = [
    // After the seed's GM in the primary's order (utils.mjs `primaryGmId`), as scenario 63's gm3: never the primary here (G).
    { who: "gm3", id: "USERGM3000000000", name: "Third GM", role: 4, character: null, color: "#66ffaa", late: true },
    // A second GM who joins mid-Confer (V).
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const J = value => JSON.stringify(value);

export async function run({ gm, gm2, gm3, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS, connect, disconnect }) {
    const counts = {};
    let current = null;
    const begin = (letter, name) => { phase(`${letter}: ${name}`, { flow: "class-trial" }); current = letter; counts[letter] = 0; };
    const verdict = (name, ok, details) => { counts[current]++; check(`${current}${counts[current]}: ${name}`, ok, details); };
    const F = `const F = await import("${repoUrl}/scripts/trial-floor.mjs");`;
    const Z = `const Z = await import("${repoUrl}/scripts/trial-zones.mjs");`;
    const sidesOn = client => client.eval(`${Z} const s = Z.sidesNow(); return { a: s.a, b: s.b };`);
    const floorOn = client => client.eval(`${F} const f = F.trialFloor(); return f ? { mode: f.mode, phase: f.zone?.phase ?? null, question: f.zone?.question ?? null,
        answers: f.zone?.answers ?? null, holder: f.holderId ?? null } : null;`);
    const moveOn = (client, actorId, x, y) => client.eval(`const hall = game.scenes.get(globalThis.__s68hall ?? "");
        const t = hall?.tokens.find(t => t.actorId === "${actorId}"); if (!t) return false; await t.update({ x: ${x}, y: ${y} }); return true;`, { timeout: 30000 });
    /* A card the GM posts reaches each player's chat when that player's socket delivers it, not when the GM's own call
       returns. 1.2.110's second CI run (43377699418, bucket b7, on 03b293f5) read C3's card on p3 and not yet on p1 and p2
       ({"seenEmpty":[false,false,true]}), the GM's floor already ended; the first run on 12a7e309 read it on all three. So
       each player's chat is waited for, up to 5 s, before it counts as not holding the card. */
    const chatHas = (client, text) => client.eval(`const end = Date.now() + 5000;
        const has = () => game.messages.some(m => String(m.content).includes(${J(text)}));
        while (!has() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return has();`, { timeout: 30000 });

    /* ------------------------------ setup ------------------------------ */
    const hallId = await gm.eval(`const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        const hall = await Scene.create({ name: "S68 the trial hall", width: 2000, height: 1000, grid: { size: 100 }, active: false, navigation: false });
        const [a, b] = await hall.createEmbeddedDocuments("Region", [
            { name: "S68 Zone A", shapes: [{ type: "rectangle", x: 0, y: 0, width: 1000, height: 1000 }], behaviors: [] },
            { name: "S68 Zone B", shapes: [{ type: "rectangle", x: 1000, y: 0, width: 1000, height: 1000 }], behaviors: [] }]);
        const tokens = [["${IDS.aiko}", 100], ["${IDS.botan}", 1100], ["${IDS.chie}", 1300]].map(([id, x]) => {
            const actor = game.actors.get(id); return { actorId: id, actorLink: true, name: actor.name, x, y: 100, width: 1, height: 1 }; });
        await hall.createEmbeddedDocuments("Token", tokens);
        globalThis.__s68roles = foundry.utils.deepClone(game.settings.get("danganronpa-rpg", "sceneRoles") ?? {});
        globalThis.__s68zones = { a: a.id, b: b.id };
        await game.settings.set("danganronpa-rpg", "sceneRoles", { ...globalThis.__s68roles, trial: hall.id });
        await setClock({ ...getClock(), phase: "classTrial" });
        await game.settings.set("danganronpa-rpg", "trialQueue", {});
        return hall.id;`, { timeout: 60000 });
    for (const c of [gm, p1, p2, p3]) await c.eval(`globalThis.__s68hall = "${hallId}"; globalThis.__dialogAuto = false; return true;`);
    await settle(800);
    const linkZones = () => gm.eval(`await game.settings.set("danganronpa-rpg", "sceneRoles", { ...globalThis.__s68roles, trial: "${hallId}", zones: globalThis.__s68zones });
        return true;`, { timeout: 30000 });
    const backOnStands = async () => {
        await moveOn(gm, IDS.aiko, 100, 100);
        await moveOn(gm, IDS.botan, 1100, 100);
        await moveOn(gm, IDS.chie, 1300, 100);
        await settle(400);
    };

    /* ------------------------------ N. no zones ------------------------------ */
    begin("N", "a hall without zones refuses a zone mode");
    const refused = await gm.eval(`const f = await game.drpg.startStrawPoll({ question: "S68 none", a: "Yes", b: "No" }); ${F} return { written: f ?? null, floor: F.trialFloor() };`, { timeout: 30000 });
    verdict("the GM's Straw Poll with no zones picked opens no floor", refused.written === null && refused.floor === null, J(refused));
    await canary.scan({ phase: "N" });

    /* ------------------------------ S. Straw Poll ------------------------------ */
    begin("S", "a Straw Poll: a Finding, the stands back, then a split");
    await linkZones();
    await settle(600);
    await gm.eval(`await game.drpg.startStrawPoll({ question: "S68 locked from where?", a: "Inside", b: "Outside" }); return true;`, { timeout: 30000 });
    await settle(1000);
    const sides = [];
    for (const c of [gm, p1, p2, p3]) sides.push(await sidesOn(c));
    verdict("every player reads the GM's sides off the hall's tokens (Zone A Aiko, Zone B Botan and Chie)",
        sides.every(s => J(s) === J({ a: [IDS.aiko], b: [IDS.botan, IDS.chie] })), J(sides));
    const moved = await moveOn(p2, IDS.botan, 300, 300);
    await settle(800);
    await gm.eval(`await game.drpg.countNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const finding = await gm.eval(`return game.i18n.format("DRPG.Zones.straw.finding", { answer: "Inside", a: 2, b: 1 });`);
    const seenFinding = [];
    for (const c of [p1, p2, p3]) seenFinding.push(await chatHas(c, finding));
    const stand = await gm.eval(`const t = game.scenes.get("${hallId}").tokens.find(t => t.actorId === "${IDS.botan}"); ${F}
        const { trialProgress } = await import("${repoUrl}/scripts/vote.mjs");
        return { x: t.x, y: t.y, floor: F.trialFloor(), findings: (trialProgress().findings ?? []).map(f => f.text) };`);
    verdict("p2 moves Botan into Zone A from its own page; Count now: the Finding \"Inside\" on every player's chat",
        moved && seenFinding.every(Boolean) && J(stand.findings) === J(["Inside"]) && stand.floor === null, J({ moved, seenFinding, stand }));
    verdict("Botan's token is back on its stand", stand.x === 1100 && stand.y === 100, J(stand));
    await gm.eval(`await game.drpg.startStrawPoll({ question: "S68 again", a: "Inside", b: "Outside" }); return true;`, { timeout: 30000 });
    await settle(800);
    await moveOn(p3, IDS.chie, 1500, 2500);
    await settle(800);
    await gm.eval(`await game.drpg.countNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const split = await gm.eval(`return game.i18n.format("DRPG.Zones.straw.split", { a: 1, b: 1 });`);
    const next = await gm.eval(`${F} return F.trialNextStep(F.trialStepView());`);
    const seenSplit = [];
    for (const c of [p1, p2, p3]) seenSplit.push(await chatHas(c, split));
    verdict("Chie outside both zones: a split (1:1) on every player, and Scrum Debate the GM's next step", seenSplit.every(Boolean) && next === "scrum", J({ seenSplit, next }));
    await backOnStands();
    await canary.scan({ phase: "S" });

    /* ------------------------------ P. a side picked ------------------------------ */
    begin("P", "a participant with no hall token picks a side");
    await gm.eval(`const t = game.scenes.get("${hallId}").tokens.find(t => t.actorId === "${IDS.chie}"); globalThis.__s68chie = t.toObject(); await t.delete();
        await game.drpg.startStrawPoll({ question: "S68 pick", a: "Inside", b: "Outside" }); return true;`, { timeout: 30000 });
    await settle(1000);
    const picked = await p3.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs"); const res = await B.requestTrialSide({ actorId: "${IDS.chie}", side: "a" });
        return { ok: res.ok === true, reason: res.reason ?? null };`, { timeout: 30000 });
    const forged = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs"); const res = await B.requestTrialSide({ actorId: "${IDS.aiko}", side: "b" });
        return { ok: res.ok === true, reason: res.reason ?? null };`, { timeout: 30000 });
    await settle(800);
    const pickedSides = [];
    for (const c of [gm, p1, p2, p3]) pickedSides.push(await sidesOn(c));
    verdict("p3 picks Zone A for Chie, who has no hall token: every browser counts her there",
        picked.ok && pickedSides.every(s => s.a.includes(IDS.chie)), J({ picked, pickedSides }));
    verdict("a pick for Aiko, who stands in the hall, is refused", forged.ok === false && forged.reason === "cannotNow", J(forged));
    await gm.eval(`await game.drpg.endMode(); const data = globalThis.__s68chie; delete data._id; await game.scenes.get("${hallId}").createEmbeddedDocuments("Token", [data]); return true;`, { timeout: 30000 });
    await settle(800);
    await canary.scan({ phase: "P" });

    /* ------------------------------ D. Logic Dive ------------------------------ */
    begin("D", "a Logic Dive: right, then a tie, unrevealed");
    const secret = { name: canary.marker("dive.set.name"), conclusion: canary.marker("dive.set.conclusion") };
    await gm.eval(`const { diveSetStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        await diveSetStore.patch("s68set", { name: "${secret.name}", conclusion: "${secret.conclusion}", made: Date.now(), questions: [
            { question: "S68 Q1 the window?", a: "Shut", b: "Open", truth: "a" }, { question: "S68 Q2 the hour?", a: "Night", b: "Morning", truth: "b" }] });
        await game.drpg.startLogicDive("s68set"); return true;`, { timeout: 30000 });
    await settle(1000);
    const q1 = [];
    for (const c of [p1, p2, p3]) q1.push(await floorOn(c));
    const clean = [];
    for (const c of [p1, p2, p3]) clean.push(await c.eval(`const raw = JSON.stringify(game.settings.get("danganronpa-rpg", "trialQueue"));
        return !/"truth"/.test(raw);`));
    // The set's name and its Finding are canary markers: a player's code may not carry them, so the scan below looks.
    verdict("every player reads the first question and its two answers, and no player's floor holds a truth",
        q1.every(f => f?.mode === "dive" && f.question === "S68 Q1 the window?" && f.answers?.a === "Shut") && clean.every(Boolean), J({ q1, clean }));
    await canary.scan({ phase: "D-question" });
    await moveOn(p2, IDS.botan, 300, 300);
    await moveOn(p3, IDS.chie, 500, 300);
    await settle(800);
    await gm.eval(`await game.drpg.countNow(); ${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const q2 = [];
    for (const c of [p1, p2, p3]) q2.push(await floorOn(c));
    verdict("all three in Zone A, Count now, Skip the pause: right, the second question on every player",
        q2.every(f => f?.mode === "dive" && f.question === "S68 Q2 the hour?" && f.phase === "vote"), J(q2));
    await moveOn(p2, IDS.botan, 1100, 100);
    await moveOn(p3, IDS.chie, 1500, 2500);
    await settle(800);
    await gm.eval(`await game.drpg.countNow(); ${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const ended = await gm.eval(`${F} const { diveSetStore } = await import("${repoUrl}/scripts/gm-stores.mjs"); const U = await import("${repoUrl}/scripts/trial-zones-ui.mjs");
        const { trialProgress } = await import("${repoUrl}/scripts/vote.mjs"); const row = diveSetStore.get("s68set");
        return { floor: F.trialFloor(), outcome: row?.outcome ?? null, findings: (trialProgress().findings ?? []).length, warning: U.replayWarning({ id: "s68set", ...row }) };`);
    const tieCard = await gm.eval(`return game.i18n.format("DRPG.Zones.dive.tie", { a: 1, b: 1 });`);
    const seenTie = [];
    for (const c of [p1, p2, p3]) seenTie.push(await chatHas(c, tieCard));
    verdict("a tie (1:1): the set ended unrevealed on every player - no floor, no new Finding, its outcome in the GMs' store",
        ended.floor === null && ended.outcome === "tie" && ended.findings === 1 && seenTie.every(Boolean), J({ ended, seenTie }));
    verdict("the GM is warned where the set ended before a replay", typeof ended.warning === "string" && ended.warning.length > 10, J(ended.warning));
    await backOnStands();
    await canary.scan({ phase: "D" });

    /* ------------------------------ C. Scrum Debate ------------------------------ */
    begin("C", "a Scrum Debate: the smaller camp first, a thesis, a crossing empties a camp");
    await moveOn(p2, IDS.botan, 300, 300);
    await settle(600);
    // The GMs' notice that the voices are not split, counted on a client by its words (secret.mjs `wordsOf`).
    const noVoiceTail = await gm.eval(`return game.i18n.localize("DRPG.Zones.scrum.noVoice").split(": ")[1].split(".")[0];`);
    const notices = client => client.eval(`const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs"); let n = 0;
        for (const m of game.messages.contents) if (String(await wordsOf(m, 2000) ?? "").includes(${J(noVoiceTail)})) n++;
        return n;`, { timeout: 30000 });
    const voiceWas = await gm.eval(`return game.settings.get("danganronpa-rpg", "voiceEnabled");`);
    await gm.eval(`await game.settings.set("danganronpa-rpg", "voiceEnabled", false); return true;`);
    const toldBefore = await notices(gm);
    await gm.eval(`await game.drpg.startScrumDebate({ question: "S68 who?", a: "Inside", b: "Outside" }); ${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const conferring = [];
    for (const c of [p1, p2, p3]) conferring.push(await c.eval(`${F} const f = F.trialFloor(); return f ? { phase: f.zone?.phase ?? null, camps: f.zone?.camps ?? null } : null;`));
    const toldGm = await notices(gm) - toldBefore, toldP1 = await notices(p1);
    verdict("the Sides set (Skip): the camps confer on every player, kept as they stood - Aiko and Botan in Zone A, Chie in Zone B",
        conferring.every(f => f?.phase === "confer" && J(f.camps?.a) === J([IDS.aiko, IDS.botan]) && J(f.camps?.b) === J([IDS.chie])), J(conferring));
    verdict("regional voice off: the GMs are told once that the camps' voices are not split, and no player is",
        toldGm === 1 && toldP1 === 0, J({ toldGm, toldP1 }));
    await gm.eval(`${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const turn = [];
    for (const c of [p1, p2, p3]) turn.push(await floorOn(c));
    const toldAfter = await notices(gm) - toldBefore;
    verdict("the Confer ended (Skip): Zone B, the smaller camp, speaks first - Chie on every player - and the GMs are not told again",
        turn.every(f => f?.mode === "scrum" && f.phase === "speak" && f.holder === IDS.chie) && toldAfter === 1, J({ turn, toldAfter }));
    const thesis = await p3.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs"); const res = await B.requestTrialKeyword({ actorId: "${IDS.chie}", text: "S68 nobody went in" });
        return { ok: res.ok === true, reason: res.reason ?? null };`, { timeout: 30000 });
    await settle(800);
    const thesisCard = await gm.eval(`return game.i18n.format("DRPG.Zones.scrum.thesis", { zone: "B", text: "S68 nobody went in" });`);
    verdict("p3's thesis for Chie reaches p1's chat", thesis.ok && await chatHas(p1, thesisCard), J({ thesis }));
    await moveOn(p3, IDS.chie, 500, 500);
    const over = await gm.eval(`${F} const end = Date.now() + 6000; while (F.trialFloor() && Date.now() < end) await new Promise(r => setTimeout(r, 200));
        const { trialProgress } = await import("${repoUrl}/scripts/vote.mjs"); return { floor: F.trialFloor(), findings: (trialProgress().findings ?? []).map(f => f.text) };`, { timeout: 30000 });
    const emptyCard = await gm.eval(`return game.i18n.format("DRPG.Zones.scrum.empty", { zone: "B", answer: "Inside" });`);
    const seenEmpty = [];
    for (const c of [p1, p2, p3]) seenEmpty.push(await chatHas(c, emptyCard));
    verdict("Chie crosses into Zone A: Zone B empty, the heartbeat ends the Scrum with Zone A's answer, on every player",
        over.floor === null && over.findings.at(-1) === "Inside" && seenEmpty.every(Boolean), J({ over, seenEmpty }));
    await canary.scan({ phase: "C" });

    /* ------------------------------ V. the camps' voice rooms ------------------------------ */
    begin("V", "the camps confer in their own voice rooms and come back to the trial's");
    await backOnStands();
    await moveOn(p2, IDS.botan, 300, 300);
    await settle(600);
    const rooms = await gm.eval(`const VC = await import("${repoUrl}/scripts/voice-client.mjs"); return VC.SCRUM_ROOMS;`);
    await gm.eval(`await game.settings.set("danganronpa-rpg", "voiceEnabled", true); return true;`);
    await settle(800);
    // Each player's room as the primary last sent it (voice-client.mjs `desiredRoom`), waited for up to 5 s.
    const roomOn = (client, want) => client.eval(`const VC = await import("${repoUrl}/scripts/voice-client.mjs"); const end = Date.now() + 5000;
        while ((VC.desiredRoom() ?? null) !== ${J(want)} && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return VC.desiredRoom() ?? null;`, { timeout: 30000 });
    const toldV = await notices(gm);
    await gm.eval(`await game.drpg.startScrumDebate({ question: "S68 how?", a: "Door", b: "Window" }); ${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const inCamps = [await roomOn(p1, rooms.a), await roomOn(p2, rooms.a), await roomOn(p3, rooms.b)];
    const gmPlan = await gm.eval(`const V = await import("${repoUrl}/scripts/voice.mjs"); const { byUser } = await V.voiceTargets();
        return ["${IDS.gm}", "${IDS.p1}", "${IDS.p2}", "${IDS.p3}"].map(id => byUser.get(id)?.target ?? null);`, { timeout: 30000 });
    verdict("in Confer p1 and p2 are sent Zone A's room and p3 Zone B's - none the other camp's - and the GM stays in the trial's room",
        J(inCamps) === J([rooms.a, rooms.a, rooms.b]) && J(gmPlan) === J([null, rooms.a, rooms.a, rooms.b]), J({ inCamps, gmPlan }));
    verdict("regional voice on: no notice that the voices are not split", await notices(gm) === toldV, J({ toldV }));
    // A reload, as a seeded client can have one: p1's told room forgotten and the question asked again (`catchUpVoice`).
    await p1.eval(`const VC = await import("${repoUrl}/scripts/voice-client.mjs"); VC.forgetDesiredRoom(); await VC.catchUpVoice(); return true;`, { timeout: 30000 });
    const reloaded = await roomOn(p1, rooms.a);
    verdict("p1 asks again mid-Confer, as a page that reloads does, and is sent Zone A's room", reloaded === rooms.a, J({ reloaded }));
    await connect("gm2");
    await settle(1500);
    const second = await gm2.eval(`${F} const V = await import("${repoUrl}/scripts/voice.mjs"); const f = F.trialFloor(); const { byUser } = await V.voiceTargets();
        return { phase: f?.zone?.phase ?? null, plan: ["USERGM2000000000", "${IDS.p1}", "${IDS.p2}", "${IDS.p3}"].map(id => byUser.get(id)?.target ?? null) };`, { timeout: 30000 });
    const stillIn = [await roomOn(p1, rooms.a), await roomOn(p3, rooms.b)];
    verdict("a second GM joins mid-Confer: it reads the phase, its own dry pass decides the same camps' rooms, it is not put in a camp, and the players stay in theirs",
        second.phase === "confer" && J(second.plan) === J([null, rooms.a, rooms.a, rooms.b]) && J(stillIn) === J([rooms.a, rooms.b]), J({ second, stillIn }));
    await gm.eval(`${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const debating = { floor: await floorOn(p1), rooms: [await roomOn(p1, null), await roomOn(p2, null), await roomOn(p3, null)] };
    verdict("the Confer ended (Skip): the turns run and every player is back in the trial's room",
        debating.floor?.phase === "speak" && debating.rooms.every(r => r === null), J(debating));
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); return true;`, { timeout: 30000 });
    await settle(800);
    await backOnStands();
    await moveOn(p2, IDS.botan, 300, 300);
    await settle(600);
    await gm.eval(`await game.drpg.startScrumDebate({ question: "S68 when?", a: "Night", b: "Day" }); ${F} await F.advanceFloorNow(); return true;`, { timeout: 30000 });
    await settle(1200);
    const again = [await roomOn(p1, rooms.a), await roomOn(p3, rooms.b)];
    await gm2.eval(`await game.drpg.endMode(); return true;`, { timeout: 30000 });
    await settle(1500);
    const endedEarly = { floor: await floorOn(p2), rooms: [await roomOn(p1, null), await roomOn(p2, null), await roomOn(p3, null)] };
    verdict("a second Scrum's Confer ended early by the second GM's End this mode: no floor, every player back in the trial's room",
        J(again) === J([rooms.a, rooms.b]) && endedEarly.floor === null && endedEarly.rooms.every(r => r === null), J({ again, endedEarly }));
    await disconnect("gm2");
    await gm.eval(`await game.settings.set("danganronpa-rpg", "voiceEnabled", ${J(voiceWas)}); return true;`);
    await backOnStands();
    await canary.scan({ phase: "V" });

    /* ------------------------------ G. a second GM's Skip ------------------------------ */
    begin("G", "a GM that is not the primary skips a Straw Poll's clock, and the primary counts it");
    await backOnStands();
    await gm.eval(`await game.drpg.startStrawPoll({ question: "S68 skipped by gm3", a: "Inside", b: "Outside" }); return true;`, { timeout: 30000 });
    await connect("gm3");
    await settle(1500);
    const skip = await gm3.eval(`${F} const U = await import("${repoUrl}/scripts/utils.mjs");
        const end = Date.now() + 5000; while (!F.trialFloor() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const seen = F.trialFloor()?.mode ?? null;
        const warned = []; const warn = ui.notifications.warn; ui.notifications.warn = (msg, ...rest) => { warned.push(String(msg)); return warn.call(ui.notifications, msg, ...rest); };
        try { await F.advanceFloorNow(); } finally { ui.notifications.warn = warn; }
        return { primary: U.isPrimaryGm(), seen, warned, movedOn: game.i18n.localize("DRPG.Floor.nowMovedOn") };`, { timeout: 30000 });
    const counted = await gm.eval(`${F} const end = Date.now() + 6000; while (F.trialFloor() && Date.now() < end) await new Promise(r => setTimeout(r, 200));
        return { floor: F.trialFloor()?.mode ?? null };`, { timeout: 30000 });
    verdict("gm3, not the primary, presses Skip in a Straw Poll: the primary counts it at once and gm3 is not told the floor moved on",
        skip.primary === false && skip.seen === "straw" && !skip.warned.includes(skip.movedOn) && counted.floor === null, J({ skip, counted }));
    await disconnect("gm3");
    await settle(500);
    await canary.scan({ phase: "G" });

    /* ------------------------------ restore ------------------------------ */
    await gm.eval(`${F} if (F.trialFloor()) await F.endFloor();
        const { diveSetStore } = await import("${repoUrl}/scripts/gm-stores.mjs"); await diveSetStore.drop("s68set");
        await game.settings.set("danganronpa-rpg", "sceneRoles", globalThis.__s68roles);
        const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await setClock({ ...getClock(), phase: "dailyLife" });
        await game.scenes.get("${hallId}")?.delete();
        return true;`, { timeout: 60000 });
    await settle(500);
    return { phases: Object.keys(counts) };
}
