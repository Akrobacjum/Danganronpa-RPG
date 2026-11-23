/**
 * Scenario 67 - the Class Trial's tools beside the debate, on the seed's GM and three players (E70 part 2, 28.10.2026;
 * E70-84). Each commit of E70 part 2 adds its phase; a letter is a phase, so a later one adds a letter.
 *
 *   T (E70 C7, Testimony): the GM opens a Testimony in the order Aiko, Botan, Chie at 60 s a turn; every player reads
 *     the same floor - Aiko's turn - and only p1, Aiko's player, is shown "Your turn - 60 s"; p2's Event panel says who
 *     is next and p3's HUD who speaks. p2 calls Botan's turn done while it is Aiko's (refused, the floor stays), p1
 *     calls Aiko's done from its own page (Botan's turn). Chie objects at Botan, the speaker, and the rebuttal is
 *     skipped: the queue resumes at Chie, whom p3 passes - "Chie Mori passes." and "The Testimony is over." reach every
 *     player and the floor closes.
 *   P (E70 C7, Panic Round, the GM's heartbeat held): the GM's trial ticker held from the round's start (a tab in the
 *     background: trial-floor.mjs's own `setInterval` answers nothing, every other timer runs), a Panic Round at 15 s;
 *     p2's OBJECTION! is refused; Aiko's 15 s run out and the players' browsers move the round to Botan by themselves
 *     ("trial.turn" kind "over"), within 15 + 4 s of its start.
 *   C (E70 C8, the Closing Argument): the GM opens it; every player is asked "I'll sum up?"; p1 volunteers Aiko and
 *     p2 Botan from their own pages, and a canary planted among the GMs' volunteers reaches no player - p3 reads
 *     "Volunteers: 2" and neither world setting names a volunteer or a draw. Skip draws; p2 reads that the GM is
 *     confirming; the GM picks Chie instead (outside the volunteers) and the card says only that Chie gives it. Aiko
 *     objects at Chie, the rebuttal is skipped, p1 reads that the GM decides, and the GM gives the Closing to Aiko (a
 *     new 5:00, told). Botan objects at Aiko and the GM overrules it: Aiko again with the seconds she had. p1 passes
 *     (no window to resign in: Done) - "The Closing Argument is over." on every player, the record done with two
 *     stretches (picked, objection). Then an Overrule in a Testimony's exchange gives the speaker back the turn.
 *   D (E70 C7, the undiscovered dead): Botan killed with nobody told, the trial's voices settled on the primary (the
 *     dead listed), and a Testimony started in the order Aiko, Botan, Chie gives Botan no turn. While it runs (E51 C4,
 *     D3) its card stands on the GM's Events panel and the participants', and p2, Botan's player, is told no turn. D2 reads Botan on the
 *     trial's list of the dead in p1's world data while nothing else there says he is dead: known-leaks.json TR30,
 *     red on purpose until E72 (part A, formerly E67) (E70 C13).
 *   R (E70 C9, Monokuma's Reveal; E70-60 to E70-64): a Key Remnant the GM wrote into this chapter's plan and never
 *     placed, with the fee's count set to one; no player holds or reads its words; the GM reveals it from the API (the
 *     console's row and its confirmation are tier 1 R1044's): Aiko's and Chie's players each hold one copy - typed Key,
 *     not read, open to Analyze in the trial (E16's one filter, amend 5 (c)) - Botan, dead with nobody told since D,
 *     none; nothing left to reveal, the Key found on the plan.
 *   S (E70 C10, Present's copies; E70-70 to E70-72): p1 presents Aiko's analysed Truth Bullet from its own page
 *     ("trial.present") without the Analyze result: one card, a GM's, without the reading, and Chie's player one copy
 *     as shown (Neutral, not read; the reading on no other student's sheet), Botan - dead with nobody told since D -
 *     none; then with the result: the second card reads it, and still one copy.
 *   M (E70 C13, what a turn's change costs; E70-83): a Testimony's turn passes from Aiko to Chie by p1's Done with the
 *     GM's console and Aiko's sheet open on p1: the console stays one window whose live region is rebuilt by its
 *     one-second tick and the change (live.mjs `diagnoseLive`), and on p1 Aiko's sheet is not rendered while its row's
 *     Present is painted in place - held, "Only Chie Mori can present right now.". Measured 28.10.2026 at
 *     4c58d5a7+edits: hud 1 on each of the four, sheets 0, the console's region 2 in 1.5 s, the sheet's renders 0. The
 *     two counts - the HUD drawn once on each browser, no sheet rendered through the clock's pass - are 81-render-budget
 *     part F's since E37 C5 (E37-23), on sheets that register where the pass looks; M still records them in its log.
 *   K (1.2.122, Keep speaking): p1 draws its windows; in a Testimony Your turn shows the seconds left, Keep speaking
 *     closes it, and 20 s later it stands again in the same turn with Done, which ends the turn.
 *   B (1.2.122, a ballot): p1 draws its windows; the GM sends the ballots and closes the vote with p1's unanswered: p1's
 *     ballot closes itself and p1 is told the vote has moved on.
 *   S (E129 S0-SKIP, the owner's note of 23.11.2026): Aiko objects at Botan in a debate; p1 alone is shown "Finish your
 *     turn now?"; Keep speaking closes it for that Objection; a second Objection's Finish my turn starts the rebuttal, the
 *     table's card and the GMs' whisper say so.
 *   V (E110 C1, C2, the owner's 14.11.2026): Aiko objects at Chie; on the primary Botan's and Chie's players' BROADCAST_AUDIO
 *     is off, Aiko's on, and p2 and p3 read "The floor is Aiko's" (voice.mjs `trialVoiceLine`). The GM redirects the
 *     Objection at Botan: every player reads the floor aimed at Botan and the public card. The Rebuttal gives Botan's
 *     player the microphone back and keeps Chie's (the pair's line). End this mode gives every microphone back and the
 *     GMs' store keeps no row. Whether avclient-livekit stops sending when the permission flips is LIVE-E70-04's.
 * The canary's player scan runs after every phase (`canary.scan`) on a GM's Key Remnant plan planted at the start.
 *
 * What it cannot see: a round at a table of 14-15 people (LIVE-E70-07), a step over on a real server's latency
 * (LIVE-E70-08), the sound of a turn, a Panic Round's or a Closing's start (the harness plays no audio), the Closing's
 * draw, confirmation and decision with real people (LIVE-E70-09), Enter in the Reveal's window on v14 (LIVE-E70-10),
 * and what a turn's change costs on a real sheet and a real canvas (81-render-budget's case, E37): M counts the
 * module's own work on jsdom.
 */
export const layers = ["ci"];

const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl, IDS }) {
    const counts = {};
    let current = null;
    const begin = (letter, name) => { phase(`${letter}: ${name}`, { flow: "class-trial" }); current = letter; counts[letter] = 0; };
    const verdict = (name, ok, details) => { counts[current]++; check(`${current}${counts[current]}: ${name}`, ok, details); };
    const until = `const until = async (test, ms) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 150)); return v; };`;
    const F = `const F = await import("${repoUrl}/scripts/trial-floor.mjs");`;
    const order = [IDS.aiko, IDS.botan, IDS.chie];
    const floorOn = client => client.eval(`${F} const f = F.trialFloor(); return f ? { mode: f.mode, holder: f.holderId, step: f.round?.step ?? null, order: f.round?.order ?? null } : null;`);
    const turnFrom = (client, actorId, kind) => client.eval(`${F} const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestTurn({ actorId: "${actorId}", kind: "${kind}", step: F.trialFloor()?.round?.step ?? F.trialFloor()?.closing?.step ?? 0 });
        return { ok: res.ok === true, reason: res.reason ?? null };`, { timeout: 30000 });
    const mark = client => client.eval(`globalThis.__s67d = globalThis.__dialogLog.length; globalThis.__s67m = new Set(game.messages.map(m => m.id)); return true;`);

    /* ------------------------------ setup ------------------------------ */
    const plan = { name: canary.marker("keyplan.name"), text: canary.marker("keyplan.text") };
    await gm.eval(`await game.drpg.setKeyPlan({ chapter: 1, entries: [{ name: "${plan.name}", text: "${plan.text}" }] });
        const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await setClock({ ...getClock(), phase: "classTrial" });
        await game.settings.set("danganronpa-rpg", "trialQueue", {});
        return true;`, { timeout: 60000 });
    // A player's turn window is answered by the scenario (the harness would press its default at once): recorded, closed.
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; return true;`);
    await settle(800);

    /* ------------------------------ T. Testimony ------------------------------ */
    begin("T", "a Testimony with an Objection at the speaker and the queue back");
    for (const c of [p1, p2, p3]) await mark(c);
    const started = await gm.eval(`const f = await game.drpg.startTestimony({ seconds: 60, order: ${J(order)} });
        return f ? { mode: f.mode, holder: f.holderId, order: f.round?.order ?? null } : null;`, { timeout: 60000 });
    await settle(1500);
    const seen = [];
    for (const c of [p1, p2, p3]) seen.push(await floorOn(c));
    const windows = [];
    for (const c of [p1, p2, p3]) {
        // The seconds on the title are those left since 1.2.122 (CASE-64): 60, or a second under it when the window opens
        // a moment after the start.
        windows.push(await c.eval(`const head = game.i18n.format("DRPG.Trial.turn.title", { seconds: "#" }).split("#")[0];
            const secondsOf = t => Number(String(t ?? "").slice(head.length).match(/\\d+/)?.[0] ?? NaN);
            return globalThis.__dialogLog.slice(globalThis.__s67d ?? 0).filter(d => String(d.title ?? "").startsWith(head) && secondsOf(d.title) >= 57 && secondsOf(d.title) <= 60).length;`));
    }
    const panel = await p2.eval(`const E = await import("${repoUrl}/scripts/events.mjs"); const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const card = E.trialCard(getClock()); return { title: card?.title ?? null, sub: card?.sub ?? null, meta: card?.meta ?? null,
            next: game.i18n.format("DRPG.Events.trialNext", { name: game.actors.get("${IDS.botan}").name }) };`);
    const hud = await p3.eval(`const H = await import("${repoUrl}/scripts/hud.mjs"); const slot = H.trialSlot();
        return { label: slot?.label ?? null, speaker: slot?.speaker ?? null, want: game.i18n.format("DRPG.Hud.trialSpeaks", { name: game.actors.get("${IDS.aiko}").name }) };`);
    verdict("the GM's Testimony is Aiko's turn on every player, in the order given",
        J(started?.order) === J(order) && seen.every(s => s?.mode === "testimony" && s.holder === IDS.aiko && J(s.order) === J(order)), J({ started, seen }));
    verdict("only p1, Aiko's player, is shown \"Your turn - 60 s\"", J(windows) === J([1, 0, 0]), J(windows));
    verdict("p2's Event panel names the speaker and who is next; p3's HUD says who speaks",
        panel.sub === "Aiko Hoshino" && panel.meta === panel.next && hud.speaker === hud.want, J({ panel, hud }));
    await canary.scan({ phase: "T-start" });

    const early = await turnFrom(p2, IDS.botan, "done");
    await settle(500);
    const afterEarly = await floorOn(gm);
    const done = await turnFrom(p1, IDS.aiko, "done");
    await settle(800);
    const afterDone = [];
    for (const c of [gm, p1, p2, p3]) afterDone.push(await floorOn(c));
    verdict("p2 calling Botan's turn done during Aiko's is refused, and the floor stays Aiko's",
        early.ok === false && early.reason === "notYourTurn" && afterEarly?.holder === IDS.aiko, J({ early, afterEarly }));
    verdict("p1 calls Aiko's turn done from its own page: Botan's turn, the next step, on every browser",
        done.ok === true && afterDone.every(s => s?.mode === "testimony" && s.holder === IDS.botan && s.step === 2), J({ done, afterDone }));

    const exchange = await gm.eval(`${F}
        const wrong = await F.openObjection("${IDS.chie}", "${IDS.aiko}", {});
        const opened = await F.openObjection("${IDS.chie}", "${IDS.botan}", {});
        const atObjection = F.trialFloor()?.mode ?? null;
        await F.openRebuttal();
        const atRebuttal = F.trialFloor()?.mode ?? null;
        await game.drpg.skipStep();
        await new Promise(r => setTimeout(r, 500));
        const f = F.trialFloor();
        return { wrong: wrong ?? null, opened: Boolean(opened), atObjection, atRebuttal, mode: f?.mode ?? null, holder: f?.holderId ?? null };`, { timeout: 60000 });
    verdict("an Objection is aimed only at the speaker; its rebuttal skipped, the queue resumes at Chie",
        exchange.wrong === null && exchange.opened && exchange.atObjection === "objection" && exchange.atRebuttal === "rebuttal"
            && exchange.mode === "testimony" && exchange.holder === IDS.chie, J(exchange));
    await canary.scan({ phase: "T-exchange" });

    const passed = await turnFrom(p3, IDS.chie, "pass");
    await settle(1200);
    const cards = [];
    for (const c of [p1, p2, p3]) {
        cards.push(await c.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
            const passes = game.i18n.format("DRPG.Floor.round.passes", { name: "Chie Mori" });
            const over = game.i18n.format("DRPG.Floor.round.over", { mode: game.i18n.localize("DRPG.Floor.mode.testimony") });
            return [fresh.some(t => t.includes(passes)), fresh.some(t => t.includes(over))];`));
    }
    verdict("p3 passes Chie's turn, the last: every player holds \"Chie Mori passes.\" and \"The Testimony is over.\", and the floor is closed",
        passed.ok === true && cards.every(c => J(c) === J([true, true])) && (await floorOn(gm)) === null, J({ passed, cards }));
    await canary.scan({ phase: "T-end" });

    /* ------------------------------ P. Panic Round, the heartbeat held ------------------------------ */
    begin("P", "a Panic Round moved on by the players' browsers while the GM's heartbeat is held");
    await gm.eval(`const real = globalThis.setInterval; globalThis.__s67interval = real;
        globalThis.setInterval = (fn, ms, ...rest) => (String(new Error().stack).includes("trial-floor.mjs") ? 0 : real(fn, ms, ...rest));
        return true;`);
    let panic = null;
    try {
        panic = await gm.eval(`${F} const f = await game.drpg.startPanicRound({ seconds: 15, order: ${J(order)} });
            return f ? { mode: f.mode, holder: f.holderId, at: Date.now() } : null;`, { timeout: 60000 });
        await settle(800);
        const objected = await p2.eval(`const T = await import("${repoUrl}/scripts/trial.mjs");
            return await T.raiseObjection(game.actors.get("${IDS.botan}"));`, { timeout: 30000 });
        const stood = await floorOn(gm);
        verdict("a Panic Round of 15 s opens on Aiko; p2's OBJECTION! is refused and the round stands",
            panic?.mode === "panic" && panic.holder === IDS.aiko && objected === false && stood?.mode === "panic" && stood.holder === IDS.aiko, J({ panic, objected, stood }));
        const moved = await gm.eval(`${until} ${F} const t0 = Date.now();
            const f = await until(() => (F.trialFloor()?.holderId === "${IDS.botan}" ? F.trialFloor() : null), 22000);
            return { holder: f?.holderId ?? null, step: f?.round?.step ?? null, after: Math.round((Date.now() - ${panic?.at ?? 0}) / 1000) };`, { timeout: 40000 });
        verdict("with the GM's heartbeat held, Aiko's 15 s run out and the players' browsers move the round to Botan within 19 s",
            moved.holder === IDS.botan && moved.step === 2 && moved.after <= 19, J(moved));
    } finally {
        await gm.eval(`if (globalThis.__s67interval) globalThis.setInterval = globalThis.__s67interval; return true;`);
    }
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); F.renderTrialFloor(); return true;`, { timeout: 30000 });
    await settle(800);
    await canary.scan({ phase: "P" });

    /* ------------------------------ C. the Closing Argument ------------------------------ */
    begin("C", "a Closing Argument: volunteers kept by the GMs, the draw changed, an exchange decided, an Overrule in both modes");
    for (const c of [p1, p2, p3]) await mark(c);
    const closingOn = client => client.eval(`${F} const f = F.trialFloor(); const H = await import("${repoUrl}/scripts/hud.mjs");
        const keyed = v => v && typeof v === "object" && Object.entries(v).some(([k, x]) => k === "volunteers" || k === "drawn" || keyed(x));
        return { mode: f?.mode ?? null, phase: f?.closing?.phase ?? null, holder: f?.holderId ?? null, count: f?.closing?.count ?? null,
            hud: H.trialSlot()?.speaker ?? null, words: { two: game.i18n.format("DRPG.Floor.closing.volunteers", { n: 2 }),
                confirming: game.i18n.localize("DRPG.Floor.closing.confirming"), deciding: game.i18n.localize("DRPG.Floor.closing.deciding") }, keyed: keyed(game.settings.get("danganronpa-rpg", "trialQueue")) || keyed(game.settings.get("danganronpa-rpg", "trialProgress")) };`);
    const gmClosing = (body, timeout = 60000) => gm.eval(`${F} const api = game.drpg; ${body}`, { timeout });
    const claimMarker = canary.marker("closing.volunteer");
    const opened = await gmClosing(`const f = await api.startClosing(); return f ? f.closing?.phase ?? null : null;`);
    await settle(1500);
    const asked = [];
    for (const c of [p1, p2, p3]) {
        asked.push(await c.eval(`const title = game.i18n.localize("DRPG.Floor.mode.closing");
            return globalThis.__dialogLog.slice(globalThis.__s67d ?? 0).filter(d => d.title === title).length;`));
    }
    const claimFrom = (client, actorId) => client.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestClaim({ actorId: "${actorId}" }); return { ok: res.ok === true, count: res.value?.count ?? null };`, { timeout: 30000 });
    const claimed = [await claimFrom(p1, IDS.aiko), await claimFrom(p2, IDS.botan)];
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { RECORD } = await import("${repoUrl}/scripts/gm-store.mjs");
        await S.closingClaimStore.patch(RECORD, { volunteers: [...(S.closingClaimStore.get(RECORD)?.volunteers ?? []), "${claimMarker}"] }); return true;`);
    await settle(800);
    const volunteering = await closingOn(p3);
    verdict("the GM opens the Closing Argument and every player is asked to volunteer, once",
        opened === "volunteer" && J(asked) === J([1, 1, 1]), J({ opened, asked }));
    verdict("p1 and p2 volunteer from their own pages; p3 reads \"Volunteers: 2\" and no world setting names a volunteer",
        claimed.every(c => c.ok) && claimed[1].count === 2 && volunteering.phase === "volunteer" && volunteering.count === 2 && !volunteering.keyed
            && volunteering.hud === volunteering.words.two, J({ claimed, volunteering }));
    await canary.scan({ phase: "C-volunteers" });

    await gmClosing(`await api.skipStep(); return true;`);
    await settle(800);
    const confirming = await closingOn(p2);
    const drawnOk = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { RECORD } = await import("${repoUrl}/scripts/gm-store.mjs");
        return ["${IDS.aiko}", "${IDS.botan}"].includes(S.closingClaimStore.get(RECORD)?.drawn);`);
    await gmClosing(`await api.pickClosingSpeaker("${IDS.chie}"); return true;`);
    await settle(1200);
    const chieOn = [];
    for (const c of [p1, p2, p3]) chieOn.push(await closingOn(c));
    const pickedCards = await p1.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
        return [fresh.some(t => t.includes(game.i18n.format("DRPG.Floor.closing.speaks", { name: "Chie Mori" }))), fresh.some(t => /Drawn|draw/i.test(t))];`);
    verdict("Skip draws one of the two volunteers and p2 reads that the GM is confirming; the GM picks Chie, and the card names Chie and no draw",
        confirming.phase === "choice" && confirming.hud === confirming.words.confirming && drawnOk
            && chieOn.every(f => f.phase === "speak" && f.holder === IDS.chie && !f.keyed) && J(pickedCards) === J([true, false]), J({ confirming, drawnOk, chieOn, pickedCards }));

    const decided = await gmClosing(`await F.openObjection("${IDS.aiko}", "${IDS.chie}", {}); await F.openRebuttal(); await api.skipStep();
        await new Promise(r => setTimeout(r, 500)); return F.trialFloor()?.closing?.phase ?? null;`);
    await settle(800);
    const deciding = await closingOn(p1);
    await gmClosing(`await api.continueClosing("${IDS.aiko}"); return true;`);
    await settle(1200);
    const aikoOn = await closingOn(p2);
    const continued = await p2.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
        return fresh.some(t => t.includes(game.i18n.format("DRPG.Floor.closing.continues", { name: "Aiko Hoshino", time: "5:00" })));`);
    verdict("Aiko's Objection at Chie, its rebuttal skipped: p1 reads that the GM decides; the GM gives the Closing to Aiko - \"(5:00)\" on p2",
        decided === "decide" && deciding.hud === deciding.words.deciding && aikoOn.phase === "speak" && aikoOn.holder === IDS.aiko
            && continued, J({ decided, deciding, aikoOn, continued }));

    /* The speaker's decision too (E70 fix p2-G5; the review's E70P2-R03; E70-54, E70-84 "both decisions"): Botan objects at
       Aiko, the rebuttal is skipped, and the GM lets Aiko continue with the seconds she had - their m:ss on p3's card. */
    const speakerAgain = await gmClosing(`await F.openObjection("${IDS.botan}", "${IDS.aiko}", {}); await F.openRebuttal(); await api.skipStep();
        await new Promise(r => setTimeout(r, 500)); const left = F.trialFloor()?.closing?.left ?? null;
        await api.continueClosing("${IDS.aiko}"); await new Promise(r => setTimeout(r, 300));
        return { left, mode: F.trialFloor()?.mode ?? null, holder: F.trialFloor()?.holderId ?? null };`);
    await settle(1200);
    const restTime = Number.isFinite(speakerAgain.left) ? `${Math.floor(speakerAgain.left / 60)}:${String(speakerAgain.left % 60).padStart(2, "0")}` : null;
    const restRead = await p3.eval(`const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
        return fresh.some(t => t.includes(game.i18n.format("DRPG.Floor.closing.continues", { name: "Aiko Hoshino", time: ${J(restTime)} })));`);
    verdict("Botan's Objection at Aiko, its rebuttal skipped: the GM lets Aiko continue with the seconds she had - their m:ss on p3's card",
        speakerAgain.mode === "closing" && speakerAgain.holder === IDS.aiko && speakerAgain.left > 0 && speakerAgain.left < 300 && restRead,
        J({ speakerAgain, restTime, restRead }));

    const overruled = await gmClosing(`await F.openObjection("${IDS.botan}", "${IDS.aiko}", {}); const at = F.trialFloor()?.before?.at(-1)?.leftAtObjection ?? null;
        await api.overruleObjection(); await new Promise(r => setTimeout(r, 300)); const f = F.trialFloor();
        return { mode: f?.mode ?? null, holder: f?.holderId ?? null, close: Math.abs(F.secondsLeft() - at) <= 2 };`);
    const resigned = await turnFrom(p1, IDS.aiko, "pass");
    await settle(1200);
    const ended = [];
    for (const c of [p1, p2, p3]) {
        ended.push(await c.eval(`${F} const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id)).map(m => String(m.content ?? ""));
            return [fresh.some(t => t.includes(game.i18n.localize("DRPG.Floor.closing.over"))), F.trialFloor()];`));
    }
    const record = await gm.eval(`const V = await import("${repoUrl}/scripts/vote.mjs"); const c = V.trialProgress().closing; return { done: c?.done ?? null, via: (c?.speakers ?? []).map(s => s.via) };`);
    verdict("Botan's Objection at Aiko overruled: Aiko again with her seconds; p1's Pass ends the Closing - every player told, the record done",
        overruled.mode === "closing" && overruled.holder === IDS.aiko && overruled.close && resigned.ok
            && ended.every(e => J(e) === J([true, null])) && record.done === true && J(record.via) === J(["chosen", "objection", "speaker"]), J({ overruled, resigned, ended, record }));

    const testimonyOverrule = await gmClosing(`await api.startTestimony({ seconds: 60, order: ${J(order)} });
        await F.openObjection("${IDS.chie}", "${IDS.aiko}", {}); await F.openRebuttal(); await api.overruleObjection();
        await new Promise(r => setTimeout(r, 300)); const f = F.trialFloor(); const out = { mode: f?.mode ?? null, holder: f?.holderId ?? null };
        if (F.trialFloor()) await api.endMode(); return out;`);
    verdict("an Overrule in a Testimony's exchange gives Aiko her turn back", testimonyOverrule.mode === "testimony" && testimonyOverrule.holder === IDS.aiko,
        J(testimonyOverrule));
    await settle(800);
    await canary.scan({ phase: "C" });

    /* ------------------------------ D. the undiscovered dead ------------------------------ */
    begin("D", "a death nobody has found takes no turn");
    for (const c of [p1, p2, p3]) await mark(c);
    const dead = await gm.eval(`${F} const C = await import("${repoUrl}/scripts/chapter.mjs"); const Vo = await import("${repoUrl}/scripts/voice.mjs");
        const V = await import("${repoUrl}/scripts/vote.mjs");
        const botan = game.actors.get("${IDS.botan}");
        const killed = Boolean(await C.killCharacter(botan, { secret: true, keepBullets: true }));
        await Vo.settleTrialVoices();
        const f = await game.drpg.startTestimony({ seconds: 60, order: ${J(order)} });
        return { killed, published: game.drpg.isDeceased(botan), participants: V.trialParticipants().map(p => p.actor.id), order: f?.round?.order ?? null };`,
    { timeout: 60000 });
    await settle(1500);
    verdict("Botan, killed with nobody told, is not a participant and gets no turn: the Testimony's order is Aiko, Chie",
        dead.killed && dead.published === false && !dead.participants.includes(IDS.botan) && J(dead.order) === J([IDS.aiko, IDS.chie]), J(dead));
    /* THE TESTIMONY'S TURN CARD AND WHO HOLDS IT (E51 C4, 31.10.2026; E51-29, D44a - the stage's entry condition). The
       turns of E70's modes are told on the Events panel alone, so while this Testimony runs - Aiko's turn, Chie next -
       its card must stand on the GM's panel and the participants' (p1, Aiko's player; p3, Chie's), and no turn of its
       own may reach p2, Botan's player, whose student takes no part. Read off each panel as the browser drew it (its
       signature: kind, title, sub, meta, note, due, mine) and the turn windows each was shown since the Testimony began.
       What p2's panel holds besides is written down, not judged: the trial card is the trial's public state on every
       browser by E70's design, as the HUD's row is (T3 reads p3's), so a bystander here is told no turn of their own,
       not kept from the card. A guard: green at C4's parent; shown able to fail by a planted mutant (the round's card
       marked as every reader's own). */
    const turnTitle = onGm => `const want = game.i18n.localize("DRPG.Hud.trial.testimony"); const turn = game.i18n.format("DRPG.Trial.turn.title", { seconds: "#" }).split("#")[0];
        const E = await import("${repoUrl}/scripts/events.mjs"); E.renderEvents();
        const sig = JSON.parse(document.getElementById("drpg-events")?.dataset.signature ?? "[]");
        return { cards: sig.filter(c => c[0] === "trial" && c[1] === want).map(c => ({ sub: c[2], meta: c[3], mine: c[6] ?? null })),
            mine: sig.filter(c => c[6]).map(c => c[0]), windows: ${onGm ? "0" : "globalThis.__dialogLog.slice(globalThis.__s67d ?? 0).filter(d => String(d.title ?? '').startsWith(turn)).length"},
            next: game.i18n.format("DRPG.Events.trialNext", { name: game.actors.get("${IDS.chie}")?.name ?? "" }), aiko: game.actors.get("${IDS.aiko}")?.name ?? null };`;
    const panels = {};
    for (const [who, c] of [["gm", gm], ["p1", p1], ["p2", p2], ["p3", p3]]) panels[who] = await c.eval(turnTitle(who === "gm"));
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); return true;`, { timeout: 30000 });
    /* THE TRIAL'S LIST OF THE DEAD, A DEATH NOBODY HAS FOUND ON IT (E70-24; the owner's TR30 = 2, "Tak, ona tez wyciszona").
       The list (trialProgress.mutedDead, voice.mjs `settleTrialVoices`) is world data every browser holds, so in the trial
       p1's browser reads Botan on it while nothing else of p1's world says he is dead: public on purpose while the trial
       runs (world-secrets.mjs lifts its rule only then; 72-canary reads it gone after the trial), and a known leak until
       E72 (part A, formerly E67) keeps the list in the GMs' store (known-leaks.json TR30). Red on purpose: it passes the day the list stops
       naming him on a player's browser, and then the entry goes. */
    const listOnP1 = await p1.eval(`const r = game.settings.get("danganronpa-rpg", "trialProgress") ?? {}, c = game.settings.get("danganronpa-rpg", "clock") ?? {};
        const b = game.actors.get("${IDS.botan}");
        return { phase: c.phase ?? null, listed: (r.mutedDead ?? []).includes("${IDS.botan}"), flag: b?.getFlag("danganronpa-rpg", "deceased") ?? null };`);
    counts.D++;
    check("D2: no death nobody has found reaches a player's browser on the trial's list of the dead (TR30, E70-24)",
        !(listOnP1.listed && listOnP1.flag === null), J(listOnP1),
        { knownLeak: "TR30", measured: dead.killed && dead.published === false && listOnP1.phase === "classTrial" });
    const turnCardHeld = read => read?.cards?.length === 1 && read.cards[0].sub === read.aiko && read.cards[0].meta === read.next;
    verdict("the Testimony's card - Aiko's turn, Chie next - stands on the GM's Events panel and on p1's and p3's, the participants'; p2, whose student takes no part, is told no turn of its own: no card marked its own and no turn window (E51-29)",
        ["gm", "p1", "p3"].every(who => turnCardHeld(panels[who])) && panels.p2?.mine?.length === 0 && panels.p2?.windows === 0
            && [panels.p1, panels.p3].every(p => p?.mine?.length === 0) && panels.p1?.windows === 1,
        J(panels));
    await canary.scan({ phase: "D" });

    /* ------------------------------ R. Monokuma's Reveal ------------------------------ */
    begin("R", "Monokuma's Reveal: a Key Remnant nobody found, to every participant as a find");
    const words = "S67 R the words of the revealed Key";
    const holds = client => client.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const mine = game.actors.filter(a => a.isOwner && a.type === "character");
        const copies = mine.flatMap(a => a.items.filter(i => T.isTruthBullet(i) && (T.truthBulletData(i)?.playerText ?? "") === ${J(words)}).map(i => ({ a, i })));
        return { n: copies.length, seen: JSON.stringify(game.actors.contents.map(a => a.items.contents.map(i => i.flags))).includes(${J(words)}),
            typed: copies.map(({ i }) => [T.truthBulletData(i).shownType, T.hasReading(i)]),
            analysable: copies.map(({ a, i }) => T.analysableBullets(a).some(b => b.id === i.id) && !A.analyzeRowShut("bullet", { bullet: i })) };`);
    const before = [];
    for (const c of [p1, p2, p3]) before.push(await holds(c));
    const revealed = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const M = await import("${repoUrl}/scripts/trial-modes.mjs");
        const I = await import("${repoUrl}/scripts/investigation.mjs"); const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const ch = getClock().chapter;
        await S.keyPlanStore.patch(ch + ":11", { scale: "standard", name: "S67 R Key", text: ${J(words)} });
        await S.keyPlanStore.patch(ch + ":reveal", { paid: 1, revealed: [] });
        const listed = (await game.drpg.missingKeys()).find(r => r.name === "S67 R Key")?.id ?? null;
        const out = await game.drpg.revealMissingKey(listed);
        await new Promise(r => setTimeout(r, 500));
        return { listed, copies: out?.copies ?? null, left: M.revealLeft(I.keyRevealRecord(ch)),
            still: (await game.drpg.missingKeys()).some(r => r.id === listed), found: I.keyPlanStatus().entries[11]?.found ?? null };`, { timeout: 60000 });
    await settle(800);
    const after = [];
    for (const c of [p1, p2, p3]) after.push(await holds(c));
    verdict("before the Reveal no player holds or reads the Key Remnant's words",
        before.every(b => b.n === 0 && !b.seen), J(before));
    verdict("the Reveal hands Aiko and Chie one copy each - typed Key, not read, open to Analyze in the trial - and Botan, dead with nobody told, none; the count spent, the Key found",
        revealed.listed === "11" && revealed.copies === 2 && revealed.left === 0 && revealed.still === false && revealed.found === true
            && J(after.map(a => a.n)) === J([1, 0, 1]) && [after[0], after[2]].every(a => J(a.typed) === J([["key", false]]) && J(a.analysable) === J([true])),
        J({ revealed, after }));
    await canary.scan({ phase: "R" });
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const { getClock } = await import("${repoUrl}/scripts/clock.mjs"); const ch = getClock().chapter;
        for (const a of game.actors) for (const i of a.items.filter(i => T.isTruthBullet(i) && (T.truthBulletData(i)?.playerText ?? "") === ${J(words)})) {
            const uuid = i.uuid; await i.delete(); await T.dropSecret(uuid);
        }
        await S.keyPlanStore.dropMany([ch + ":11", ch + ":reveal"]);
        return true;`, { timeout: 60000 });
    /* ------------------------------ S. Present's copies ------------------------------ */
    begin("S", "Present: the card and a copy as shown to every other participant, from the presenter's own page");
    const shown = { text: "S67 S the words on the presented bullet", reading: "S67 S the reading only the Analyze of Aiko gave" };
    const made = await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const item = await T.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "S67 S evidence", realType: "incident", shownType: "incident",
            analyzed: true, playerText: ${J(shown.text)}, analyzedText: ${J(shown.reading)} });
        return item?.id ?? null;`, { timeout: 60000 });
    await settle(800);
    const present = (analysis) => p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestPresent({ actorId: "${IDS.aiko}", itemId: ${J(made)}, comment: "S67", analysis: ${analysis} });
        return { ok: res.ok === true, copies: res.value?.copies ?? null };`, { timeout: 30000 });
    const heldBy = client => client.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const mine = game.actors.filter(a => a.isOwner && a.type === "character" && a.id !== "${IDS.aiko}");
        const copies = mine.flatMap(a => a.items.filter(i => T.isTruthBullet(i) && i.name === "S67 S evidence"));
        const cards = game.messages.filter(m => m.content.includes(${J(shown.text)}));
        return { n: copies.length, typed: copies.map(i => [T.truthBulletData(i).shownType, T.hasReading(i)]),
            reads: JSON.stringify(game.actors.contents.filter(a => a.id !== "${IDS.aiko}").map(a => a.items.contents.map(i => [i.flags, i.system?.description ?? ""]))).includes(${J(shown.reading)}),
            cards: cards.map(m => [m.author?.isGM === true, m.content.includes(${J(shown.reading)})]) };`);
    const bare = await present(false);
    await settle(1200);
    const first = { p2: await heldBy(p2), p3: await heldBy(p3) };
    verdict("p1 presents Aiko's analysed bullet without the Analyze result: one card, a GM's, without the reading; Chie's player holds one copy as shown - Neutral, not read, the reading nowhere on another student's sheet - and Botan, dead with nobody told, none",
        made && bare.ok && bare.copies === 1 && first.p3.n === 1 && J(first.p3.typed) === J([["neutral", false]]) && !first.p3.reads
            && J(first.p3.cards) === J([[true, false]]) && first.p2.n === 0, J({ made, bare, first }));
    const full = await present(true);
    await settle(1200);
    const second = await heldBy(p3);
    verdict("p1 presents it again with the Analyze result: the second card reads it, and Chie's player still holds one copy",
        full.ok && full.copies === 0 && second.n === 1 && J(second.cards) === J([[true, false], [true, true]]), J({ full, second }));
    await canary.scan({ phase: "S" });
    await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        for (const a of game.actors) for (const i of a.items.filter(i => T.isTruthBullet(i) && i.name === "S67 S evidence")) {
            const uuid = i.uuid; await i.delete(); await T.dropSecret(uuid);
        }
        const cards = game.messages.filter(m => m.content.includes(${J(shown.text)}) || m.content.includes("S67 S evidence")).map(m => m.id);
        if (cards.length) await ChatMessage.deleteDocuments(cards);
        return true;`, { timeout: 60000 });

    /* ------------------------------ M. what a turn's change costs ------------------------------ */
    /* E70-83 (on E88's counters): a Testimony's turn passing from Aiko to Chie, with the GM's console open and Aiko's
       sheet open on p1, is read on every browser - the console's live region rebuilt and whether its window was opened
       again (live.mjs `diagnoseLive`, the window's element), and on p1 how often Aiko's sheet was rendered and whether its
       row's Present was painted in place. The HUD's and the sheet pass's counts are logged, not judged: 81-render-budget
       part F holds them since E37 C5 (E37-23). */
    begin("M", "a turn's change: one console region, no sheet rendered beyond its Present button");
    const mItem = await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const item = await T.createTruthBullet(game.actors.get("${IDS.aiko}"), { name: "S67 M evidence", realType: "incident", shownType: "incident",
            playerText: "S67 M the words" });
        await game.drpg.startTestimony({ seconds: 60, order: ${J(order)} });
        return item?.id ?? null;`, { timeout: 60000 });
    await settle(800);
    const consoleOpen = await gm.eval(`${until} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        globalThis.__s67mWas = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        globalThis.__s67mPending = UI.manageClassTrial();
        const title = game.i18n.localize("DRPG.Floor.manageTrial");
        const el = await until(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title)?.element, 8000);
        globalThis.__s67mConsole = el ?? null;
        return Boolean(el);`, { timeout: 30000 });
    /* Aiko's sheet as Daggerheart's would hand it to the module's render hook (tier 2's `drawnSheet`: the harness's
       actor sheet draws no inventory), its row's Present drawn by sheet-inventory.mjs `addPresentButton`; a sheet rendered again
       in the window below is either the hook heard again or the actor sheet's own render asked. */
    const sheetOpen = await p1.eval(`${until} const a = game.actors.get("${IDS.aiko}");
        const element = document.createElement("div"); element.className = "drpg-s67m-sheet";
        element.innerHTML = '<section data-application-part="inventory"></section>'; document.body.append(element);
        Hooks.callAll("renderCharacterSheet", { document: a, isEditable: true, element, rendered: true }, element, {}, { isFirstRender: true });
        const button = await until(() => element.querySelector('.drpg-row-present[data-drpg-actor-id="${IDS.aiko}"]'), 8000);
        globalThis.__s67mRenders = 0;
        globalThis.__s67mHook = Hooks.on("renderCharacterSheet", () => { globalThis.__s67mRenders++; });
        const sheet = a.sheet, render = sheet.render.bind(sheet);
        sheet.render = (...args) => { globalThis.__s67mRenders++; return render(...args); };
        globalThis.__s67mSheet = sheet; globalThis.__s67mElement = element; globalThis.__s67mButton = button ?? null;
        return { button: Boolean(button), held: button?.getAttribute("aria-disabled") === "true" };`, { timeout: 30000 });
    await settle(1200);
    const SNAP = `const c = await game.drpg.counters(); globalThis.__s67mBefore = c.counts; globalThis.__s67mAt = Date.now();
        globalThis.__s67mLive = (game.drpg.diagnoseLive?.() ?? []).filter(r => r.region === ".drpg-trial-console").reduce((n, r) => n + r.refreshes, 0);
        return true;`;
    const READ = `const c = await game.drpg.counters(); const before = globalThis.__s67mBefore ?? {}; const d = k => (c.counts[k] ?? 0) - (before[k] ?? 0);
        const live = (game.drpg.diagnoseLive?.() ?? []).filter(r => r.region === ".drpg-trial-console");
        const title = game.i18n.localize("DRPG.Floor.manageTrial");
        const el = [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title)?.element ?? null;
        return { hud: d("hud.renderHud"), sheets: d("clock.refreshSheets.rendered"), seconds: (Date.now() - globalThis.__s67mAt) / 1000,
            consoleRefreshes: live.length ? live.reduce((n, r) => n + r.refreshes, 0) - (globalThis.__s67mLive ?? 0) : null,
            sameConsole: globalThis.__s67mConsole ? el === globalThis.__s67mConsole : null,
            renders: globalThis.__s67mRenders ?? null,
            button: globalThis.__s67mButton ? { connected: globalThis.__s67mButton.isConnected, held: globalThis.__s67mButton.getAttribute("aria-disabled") === "true",
                tip: globalThis.__s67mButton.dataset.tooltip ?? null } : null };`;
    for (const client of [gm, p1, p2, p3]) await client.eval(SNAP);
    const turned = await turnFrom(p1, IDS.aiko, "done");
    await settle(1500);
    const cost = { gm: await gm.eval(READ), p1: await p1.eval(READ), p2: await p2.eval(READ), p3: await p3.eval(READ) };
    const mFloor = await floorOn(p1);
    const onlyChie = await p1.eval(`return game.i18n.format("DRPG.Trial.presentOnly", { name: game.actors.get("${IDS.chie}").name });`);
    console.log(`[67 M] ${J({ consoleOpen, sheetOpen, turned, mFloor, cost })}`);
    verdict("p1 calls Aiko's turn done with the GM's console and Aiko's sheet open: the floor is Chie's",
        consoleOpen && sheetOpen.button && !sheetOpen.held && turned.ok && mFloor?.holder === IDS.chie, J({ consoleOpen, sheetOpen, turned, mFloor }));
    verdict("the GM's console stays the same window and rebuilds its live region no more than its one-second tick and the change itself",
        cost.gm.sameConsole === true && cost.gm.consoleRefreshes !== null && cost.gm.consoleRefreshes >= 1
            && cost.gm.consoleRefreshes <= Math.ceil(cost.gm.seconds) + 1, J(cost.gm));
    verdict("on p1 Aiko's sheet is not rendered, and its row's Present is painted in place: held, \"Only Chie Mori can present right now.\"",
        cost.p1.renders === 0 && cost.p1.button?.connected === true && cost.p1.button.held && cost.p1.button.tip === onlyChie, J({ p1: cost.p1, onlyChie }));
    await p1.eval(`const s = globalThis.__s67mSheet; if (s) delete s.render; Hooks.off("renderCharacterSheet", globalThis.__s67mHook);
        globalThis.__s67mElement?.remove(); return true;`, { timeout: 30000 });
    await gm.eval(`${F} const el = globalThis.__s67mConsole; el?.querySelector('footer button[data-action="close"]')?.click();
        await Promise.race([globalThis.__s67mPending, new Promise(r => setTimeout(r, 5000))]);
        globalThis.__dialogWindows = globalThis.__s67mWas;
        if (F.trialFloor()) await game.drpg.endMode();
        const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        for (const a of game.actors) for (const i of a.items.filter(i => T.isTruthBullet(i) && i.name === "S67 M evidence")) {
            const uuid = i.uuid; await i.delete(); await T.dropSecret(uuid);
        }
        return ${J(mItem)} !== null;`, { timeout: 60000 });
    await settle(600);
    await canary.scan({ phase: "M" });

    /* ------------------------------ V. The floor's microphones and the GM's redirect ------------------------------ */
    begin("V", "an Objection mutes who may not speak, the GM redirects it, its Rebuttal opens the pair, the end gives back");
    const perms = () => gm.eval(`return ${J([IDS.p1, IDS.p2, IDS.p3])}.map(id => { const own = (game.users.get(id)._source ?? {}).permissions ?? {};
        return own.BROADCAST_AUDIO === false ? "off" : "on"; });`);
    const vFloor = client => client.eval(`${F} const f = F.trialFloor(); return f ? [f.mode, f.holderId, f.targetId] : null;`);
    const vLine = client => client.eval(`const V = await import("${repoUrl}/scripts/voice.mjs"); return V.trialVoiceLine()?.reason ?? null;`);
    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const botan = game.actors.get("${IDS.botan}");
        if (C.isDeadForGm(botan)) await C.reviveCharacter(botan, { quiet: true });
        ${F} if (F.trialFloor()) await F.endFloor(); await F.startFloor({});
        await F.openObjection("${IDS.aiko}", "${IDS.chie}", {});
        return true;`, { timeout: 60000 });
    await settle(2000);
    const vObjection = { perms: await perms(), floor: await vFloor(p2), lines: [await vLine(p1), await vLine(p2), await vLine(p3)] };
    verdict("Aiko's Objection blocks Botan's and Chie's players' microphones, not Aiko's, and p2 and p3 read why",
        J(vObjection.perms) === J(["on", "off", "off"]) && vObjection.floor?.[0] === "objection"
            && J(vObjection.lines) === J([null, "floorHeld", "floorHeld"]), J(vObjection));
    for (const c of [p1, p2, p3]) await mark(c);
    const vRedirect = await gm.eval(`${F} return Boolean(await F.repointObjection("${IDS.botan}"));`, { timeout: 30000 });
    await settle(1500);
    const vSeen = [];
    for (const c of [p1, p2, p3]) vSeen.push([await vFloor(c), await c.eval(`const line = game.i18n.format("DRPG.Floor.repointed", { name: game.actors.get("${IDS.aiko}").name, target: game.actors.get("${IDS.botan}").name });
        return game.messages.filter(m => !globalThis.__s67m.has(m.id)).some(m => String(m.content ?? "").includes(line));`)]);
    verdict("the GM's redirect at Botan: every player reads the floor aimed at Botan and the public card naming both",
        vRedirect && vSeen.every(([f, card]) => f?.[2] === IDS.botan && card === true), J({ vRedirect, vSeen }));
    await gm.eval(`${F} await F.openRebuttal(); return true;`, { timeout: 30000 });
    await settle(2000);
    const vRebuttal = { perms: await perms(), line: await vLine(p3) };
    verdict("the Rebuttal gives Botan's player the microphone back and keeps Chie's held (\"floorHeldPair\")",
        J(vRebuttal.perms) === J(["on", "on", "off"]) && vRebuttal.line === "floorHeldPair", J(vRebuttal));
    await gm.eval(`await game.drpg.endMode(); return true;`, { timeout: 30000 });
    await settle(2000);
    const vEnd = { perms: await perms(), rows: await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); return Object.keys(S.trialMuteStore.entries()).length;`) };
    verdict("the floor's end gives every microphone back and leaves no row in the GMs' store",
        J(vEnd.perms) === J(["on", "on", "on"]) && vEnd.rows === 0, J(vEnd));
    await canary.scan({ phase: "V" });

    /* ------------------------------ K. Keep speaking (1.2.122) ------------------------------ */
    /* CTRL-03, CASE-38, CASE-64, REFR-66: p1 draws its windows as a person's browser does (`__dialogWindows`); a Testimony
       of 60 s a turn, Aiko first. Read on p1: Your turn drawn with its seconds; Keep speaking closes it; 20 s later
       (`KEEP_SPEAKING_MS`) it stands again in the same turn, its title and its line the seconds left, under 45; its Done
       ends Aiko's turn. Red at 21bf5d18: the window came once a turn, so Keep speaking left the speaker no Done. */
    begin("K", "Keep speaking hides Your turn for a while; it comes back with the seconds left and Done");
    await p1.eval(`globalThis.__s67kWas = globalThis.__dialogWindows; globalThis.__dialogWindows = true; return true;`);
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); await game.drpg.startTestimony({ seconds: 60, order: ${J(order)} }); return true;`, { timeout: 60000 });
    const turnWindow = ms => p1.eval(`${until} const find = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.isConnected && a.options?.classes?.includes("drpg-your-turn"));
        const app = await until(() => find(), ${ms});
        if (!app) return null;
        const left = app.element.querySelector("[data-drpg-left]")?.textContent ?? null;
        return { title: app.options?.window?.title ?? null, left: Number(left), buttons: [...app.element.querySelectorAll("footer button[data-action]")].map(b => b.dataset.action) };`, { timeout: 30000 });
    const pressTurn = action => p1.eval(`const app = [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.isConnected && a.options?.classes?.includes("drpg-your-turn"));
        const b = app?.element?.querySelector('footer button[data-action="${action}"]'); if (!b) return false; b.click(); return true;`);
    const k1 = await turnWindow(6000);
    verdict("p1 is shown Your turn with Keep speaking, Done and Pass, its line the seconds left",
        Boolean(k1) && ["keep", "done", "pass"].every(a => k1.buttons.includes(a)) && k1.left >= 50 && k1.left <= 60, J(k1));
    await pressTurn("keep");
    await settle(1500);
    const hidden = await turnWindow(200);
    await settle(20000);
    const k2 = await turnWindow(4000);
    const k2Floor = await floorOn(gm);
    const k2Title = Number(String(k2?.title ?? "").match(/\d+/)?.[0] ?? NaN);
    verdict("Keep speaking closes it, and 20 s later it stands again in the same turn with Done, its seconds those left",
        hidden === null && Boolean(k2) && k2.buttons.includes("done") && k2.left > 0 && k2.left <= 45 && k2Floor?.holder === IDS.aiko && k2Title <= 45,
        J({ hidden, k2, k2Floor }));
    await pressTurn("done");
    await settle(1500);
    const kAfter = await floorOn(gm);
    verdict("its Done ends Aiko's turn: Botan's on the floor", kAfter?.holder === IDS.botan, J(kAfter));
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); return true;`, { timeout: 30000 });
    await p1.eval(`globalThis.__dialogWindows = globalThis.__s67kWas; for (const a of [...foundry.applications.instances.values()]) if (a.options?.classes?.includes("drpg-your-turn")) await a.close(); return true;`);
    await settle(800);
    await canary.scan({ phase: "K" });

    /* ------------------------------ B. a ballot closes with its round (1.2.122) ------------------------------ */
    /* REFR-72: p1 draws its windows; the GM sends the ballots and p1's ballot stands; the GM closes and counts the vote
       with p1's ballot unanswered: p1's window closes itself within 2 s, and p1 is told the vote has moved on, not that
       the ballot was dismissed. Red at 21bf5d18: the ballot stood after the count, its Cast answered "The vote has moved on". */
    begin("B", "a ballot left open closes when its vote is counted");
    await p1.eval(`globalThis.__s67bWas = globalThis.__dialogWindows; globalThis.__dialogWindows = true; globalThis.__s67info = [];
        const own = ui.notifications.info; globalThis.__s67ownInfo = own;
        ui.notifications.info = (text, ...rest) => { globalThis.__s67info.push(String(text)); return own.call(ui.notifications, text, ...rest); }; return true;`);
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); await game.drpg.openVote(); return true;`, { timeout: 60000 });
    const ballotOpen = ms => p1.eval(`${until} return Boolean(await until(() => [...foundry.applications.instances.values()].some(a => a.rendered && a.element?.isConnected && a.options?.classes?.includes("drpg-ballot")), ${ms}));`, { timeout: 30000 });
    const bDrawn = await ballotOpen(8000);
    await gm.eval(`const V = await import("${repoUrl}/scripts/vote.mjs"); await V.closeVote(); return true;`, { timeout: 60000 });
    await settle(2500);
    const bAfter = await p1.eval(`return { open: [...foundry.applications.instances.values()].some(a => a.rendered && a.element?.isConnected && a.options?.classes?.includes("drpg-ballot")),
        told: globalThis.__s67info.includes(game.i18n.localize("DRPG.Vote.movedOn")) };`);
    verdict("p1's ballot stood while the vote was open, and closed itself once it was counted, p1 told the vote has moved on",
        bDrawn === true && bAfter.open === false && bAfter.told === true, J({ bDrawn, bAfter }));
    await p1.eval(`globalThis.__dialogWindows = globalThis.__s67bWas; ui.notifications.info = globalThis.__s67ownInfo; return true;`);
    await canary.scan({ phase: "B" });

    /* ------------------------------ S. the objector finishes their own seconds (E129 S0-SKIP) ------------------------------ */
    /* The owner's note of 23.11.2026 ("niech maja od tego pop up"): p1 and p2 draw their windows; the GM opens a debate and
       Aiko objects at Botan with the bullet on the table. Read: p1, Aiko's player, is shown "Finish your turn now?" with
       Keep speaking and Finish my turn, p2 nothing; Keep speaking closes it, and it is not offered again for that
       Objection; a second Objection, its Finish my turn: the rebuttal on the floor, the card "Aiko Hoshino finishes their
       Objection early." posted, and the GMs told in a whisper. Red at 2e28785a: no window, and "trial.turn" refused a Done
       outside a round. */
    begin("S", "the objector may finish their own seconds from a window in the middle of the screen");
    for (const c of [p1, p2]) await c.eval(`globalThis.__s67sWas = globalThis.__dialogWindows; globalThis.__dialogWindows = true; return true;`);
    for (const c of [gm, p1]) await mark(c);
    const finishOn = (c, ms) => c.eval(`${until} const find = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.isConnected && a.options?.classes?.includes("drpg-finish-turn"));
        const app = await until(() => find(), ${ms});
        return app ? { title: app.options?.window?.title ?? null, want: game.i18n.localize("DRPG.Trial.finish.title"), buttons: [...app.element.querySelectorAll("footer button[data-action]")].map(b => b.dataset.action) } : null;`, { timeout: 30000 });
    const pressFinish = action => p1.eval(`const app = [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.isConnected && a.options?.classes?.includes("drpg-finish-turn"));
        const b = app?.element?.querySelector('footer button[data-action="${action}"]'); if (!b) return false; b.click(); return true;`);
    const object = () => gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); await F.startFloor({}); await F.openObjection("${IDS.aiko}", "${IDS.botan}", {});
        return F.trialFloor()?.mode ?? null;`, { timeout: 60000 });
    const sOpened = await object();
    const s1 = await finishOn(p1, 6000);
    const s1Other = await finishOn(p2, 1500);
    verdict("only p1, the objector's player, is shown \"Finish your turn now?\" with Keep speaking and Finish my turn",
        sOpened === "objection" && Boolean(s1) && s1.title === s1.want && ["keep", "done"].every(a => s1.buttons.includes(a)) && s1Other === null,
        J({ sOpened, s1, s1Other }));
    await pressFinish("keep");
    await settle(3000);
    const sKept = [await finishOn(p1, 300), (await floorOn(gm))?.mode ?? null];
    verdict("Keep speaking closes it, the Objection runs on, and it is not offered again for that Objection",
        sKept[0] === null && sKept[1] === "objection", J(sKept));
    await object();
    const s2 = await finishOn(p1, 6000);
    await pressFinish("done");
    await settle(1500);
    const sDone = await gm.eval(`${F} const f = F.trialFloor(); const fresh = game.messages.filter(m => !globalThis.__s67m.has(m.id));
        const name = game.actors.get("${IDS.aiko}").name;
        const card = game.i18n.format("DRPG.Floor.turnFinished", { name }), told = game.i18n.format("DRPG.Floor.finishedGm", { name });
        // A whisper's words are the secret store's on this GM (secret.mjs \`contentOf\`), not the message's content.
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return { mode: f?.mode ?? null, card: fresh.some(m => String(m.content ?? "").includes(card)),
            told: fresh.some(m => String(contentOf(m) ?? "").includes(told) && (m.whisper ?? []).length > 0 && (m.whisper ?? []).every(id => game.users.get(id)?.isGM)) };`);
    verdict("its Finish my turn starts the rebuttal as the GM's Skip would; the card says Aiko finished early and the GMs are whispered",
        Boolean(s2) && sDone.mode === "rebuttal" && sDone.card && sDone.told, J({ s2, sDone }));
    await gm.eval(`${F} if (F.trialFloor()) await game.drpg.endMode(); return true;`, { timeout: 30000 });
    for (const c of [p1, p2]) await c.eval(`globalThis.__dialogWindows = globalThis.__s67sWas; for (const a of [...foundry.applications.instances.values()]) if (a.options?.classes?.includes("drpg-finish-turn")) await a.close(); return true;`);
    await settle(800);
    await canary.scan({ phase: "S" });

    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"); const botan = game.actors.get("${IDS.botan}");
        if (C.isDeadForGm(botan)) await C.reviveCharacter(botan, { quiet: true });
        const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        await setClock({ ...getClock(), phase: "dailyLife" });
        return true;`, { timeout: 60000 });
    await settle(500);
    return { phases: Object.keys(counts) };
}
