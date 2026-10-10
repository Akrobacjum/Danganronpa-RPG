/**
 * The chapter, the body's discovery and the season reset, as they are today (E11 C0,
 * 10.10.2026; audit S06-58, the plan's section 2.1).
 *
 * The suite's reset tests read the source (R50 and the cut-first check in tests-tier0.mjs):
 * nothing drove a reset through a world holding a season and read what was left. This plays
 * a season on the seeded GM and players and reads only the world's state, through public
 * functions and documents, so a rewrite of the reset's or the chapter end's steps (E11 C5,
 * C9; E42's `runSteps`) leaves it as it is. The reset lives here and not in the in-Foundry
 * suite because a reset in a GM's real world destroys it.
 *
 * Every reading is asserted at its value at 4aad1fd (1.2.72), measured on this harness, and
 * its check names the E11 commit that changes it; that commit rewrites the check with the
 * code. A reading no E11 commit changes is green today and stays so.
 *   A  two scenes with rooms (the Annex gains one), a project on each, a duplicate of the
 *      first's token on the Annex and an orphan (a project token whose id has no countdown):
 *      four project tokens; whether p1 knows the orphan (C7: it does not).
 *   B  Chie kills Daichi, kept, and the incident is closed: the GM panel's next line (C2); Aiko
 *      and Botan walk in on the body: one discovery card, the hold and the line on it; the gather
 *      that follows, on Aiko's, Botan's and the GM's browsers, and a gather packet a player sends
 *      (C3). The announcing window's note, the GM's Prep question after the card and the toast (C4).
 *      An Eclipse asked for during the hold (C3). Investigation, the Class Trial and a
 *      wrong verdict that executes Botan; a move inside the room after the verdict (already
 *      no card), and a walk in after End the trial: the discovery cards each leaves, and the
 *      discovery's stamp (C1: one row, by the witnesses, naming Daichi).
 *   C  two End of chapter windows opened on one clock in the Investigation, "next chapter"
 *      unticked, the first pressed after the second's end: the refusal, the session, the day
 *      and the phase (C5). Edit campaign moving the time of day back while an
 *      assembly is called: whether the assembly is held (C6).
 *   Q  Q3 (a): Botan kills Daichi, kept; the incident is closed and the chapter ended with
 *      the death still kept; announced by hand in the next chapter, its Blackened reaches
 *      no trial (`trialBlackenedIds`).
 *   D  Chie's suicide at Stage 6, a Level Up offered to Aiko (p1), a Call armed on Botan
 *      (p2), the Final Trial set, Dorm A Aiko's bedroom with its key, and Aiko's Health,
 *      Sanity and Hope moved off their reset values.
 *   R  the reset, every group ticked, answered as 61 answers it: the project tokens the window
 *      counts and those left on every scene (C7: four, none), the offers (E04), the armed
 *      Calls (C10), the Final Trial and the season (E10 C10), the suicide's victim (alive
 *      already; C9 must keep it), Aiko's Health, Sanity and Hope (reset already), her bedroom's
 *      key (C10), the stamps of the bodies found (C1: none left), and the errors.
 *   F  a reset whose chat deletion throws on the GM: whether the GM is told, and that every
 *      other group still ran (C9).
 *   G  a world already reset: two new projects, an orphan, a duplicate and one project's
 *      token deleted by hand, then the primary's canvas drawn again: what the sync leaves (C8).
 * Not readable headless (the plan's section 5): what a player's canvas hides of a project
 * token (`applyToProjectToken` needs `token.object`), and what the gather's camera and the
 * dimmed Eclipse chevron look like: the harness's canvas has an `animatePan` that does nothing,
 * so B1b reads the call each browser makes and where it points, and B2 reads the chevron's
 * `aria-disabled` and its words (E11 C3). The GM panel's next line is read off the panel's content as it is drawn
 * (E11 C2, `NEXT` below), not off a window on screen.
 *
 * Its bound (the plan's M4, set from C0's first readings): its 17 checks took 20.2-21.6 s
 * in seven runs alone on 10.10.2026 (20.7 s for this file as committed, the rest drafts and
 * mutants), about 25 s with the boot - a twelfth of run-all's shared five minutes, so it
 * states no `timeoutMs` of its own. The plan's 480 s was 61's.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p3, check, phase, settle, IDS, repoUrl }) {
    const UNTIL = `const until = async (test, ms = 8000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };`;
    const CARDS = `const cards = () => game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound").length;`;
    const PROJECT_TOKENS = `const projectTokens = () => game.scenes.contents.flatMap(s => s.tokens.filter(t => t.getFlag("${MOD}", "projectId")).map(t => ({ scene: s.id, id: t.id, project: t.getFlag("${MOD}", "projectId") })));`;
    /* The GM panel's next line as the panel draws it (E11 C2): `openGmPanel` with its window answered at
       once and its content kept - [the line, its button's action], or null when it draws none. */
    const NEXT = `const nextLine = async () => { const D = foundry.applications.api.DialogV2, wait = Object.getOwnPropertyDescriptor(D, "wait"); let panel = null;
        D.wait = async config => { if (config?.classes?.includes?.("drpg-gm-panel-window")) panel = config.content; return null; };
        try { await (await import("${repoUrl}/scripts/gm-panel.mjs")).openGmPanel(); } finally { if (wait) Object.defineProperty(D, "wait", wait); else delete D.wait; }
        const next = panel?.querySelector?.(".drpg-gmp-next");
        return next ? [next.querySelector(".drpg-gmp-next-text")?.textContent?.trim() ?? null, next.querySelector(".drpg-gmp-next-go")?.dataset?.drpgRun ?? null] : null; };`;
    const players = [p1, p2, p3].filter(Boolean);
    /* An incident is driven from the GM's client, as 10-murder drives it: the killer's player
       answering the opening roll it is sent would race the GM's own answer below. The
       players' module sockets are put aside for the incident and handed back after it. */
    const mute = () => Promise.all(players.map(c => c.eval(`globalThis.__mutedSocket = (game.socket._handlers.get("module.${MOD}") ?? []).splice(0); return true;`)));
    const unmute = () => Promise.all(players.map(c => c.eval(`(game.socket._handlers.get("module.${MOD}") ?? []).push(...(globalThis.__mutedSocket ?? [])); globalThis.__mutedSocket = []; return true;`)));
    const kill = (killer, victim) => gm.eval(`const academy = game.scenes.get("${IDS.scene}");
        if (canvas.scene?.id !== academy.id) canvas.scene = academy;
        await game.drpg.openMurder({ killerId: "${killer}", victimId: "${victim}", openingTrait: "body" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await game.drpg.passTurn();
        await game.drpg.resolveCrisisAction({ actorId: "${killer}", key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 1700));
        const victim = game.actors.get("${victim}");
        return { stage: game.drpg.murderState()?.stage ?? null, dead: game.drpg.isDeadForGm(victim), flag: game.drpg.isDeceased(victim) };`, { timeout: 60000 });
    /* A walk into a room: the token is placed inside it (or nudged within it when it already
       stands there), which is what the discovery's watcher hears (`updateToken` on the primary).
       A step of 50 px was tried first (09.10.2026) and left Aiko outside the room after the step
       back, so the step names the room rather than a distance. */
    const walkTo = (actorId, room) => gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const academy = game.scenes.get("${IDS.scene}"), t = academy.tokens.find(x => x.actorId === "${actorId}");
        const spot = M.positionIn(${J(room)}, t);
        if (spot.x === t.x && spot.y === t.y) spot.x += 10;
        await t.update(spot, { teleport: true, movementAction: "displace", animate: false });
        await new Promise(r => setTimeout(r, 1500));
        return M.roomOfToken(t);`, { timeout: 30000 });

    /* ------------------------------ A. the board ------------------------------ */
    phase("A: two scenes, a project on each, a duplicate and an orphan", { flow: "season-reset" });
    const ORPHAN = "E11C0ORPHAN00001";
    const setA = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const PM = await import("${repoUrl}/scripts/projects-map.mjs");
        ${PROJECT_TOKENS}
        const academy = game.scenes.get("${IDS.scene}"), annex = game.scenes.get("${IDS.annex}");
        await annex.createEmbeddedDocuments("Region", [{ name: "Annex Hall", shapes: [{ type: "rectangle", x: 200, y: 200, width: 600, height: 600 }],
            flags: {}, behaviors: [] }]);
        const view = canvas.scene;
        canvas.scene = academy;
        const one = await P.createProject({ name: "E11 C0 65 the Cafeteria's project", target: 6, room: "Cafeteria" });
        canvas.scene = annex;
        let two = null;
        try { two = await P.createProject({ name: "E11 C0 65 the Annex's project", target: 6, room: "Annex Hall" }); }
        finally { canvas.scene = view; }
        const first = PM.projectTokenOf(one?.id);
        const like = (t, x, projectId) => ({ name: t.name, actorId: t.actorId, actorLink: false, x, y: t.y, width: t.width, height: t.height,
            texture: { src: t.texture?.src ?? "" }, hidden: false, flags: { "${MOD}": { projectId } } });
        if (first) {
            await annex.createEmbeddedDocuments("Token", [like(first, 300, one.id)]);
            await academy.createEmbeddedDocuments("Token", [like(first, first.x + 100, "${ORPHAN}")]);
        }
        return { one: one?.id ?? null, two: two?.id ?? null, first: first ? { scene: first.parent.id, id: first.id } : null,
            second: (() => { const t = PM.projectTokenOf(two?.id); return t ? { scene: t.parent.id, id: t.id } : null; })(),
            tokens: projectTokens() };`, { timeout: 60000 });
    await settle(500);
    const knowsA = await p1.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        return { orphan: P.knowsProject("${ORPHAN}"), countdowns: P.allProjects().map(p => p.id).includes("${ORPHAN}") };`);
    check("A1: two projects, each with its token on its own scene, a duplicate of the first on the Annex and an orphan on the Academy: four project tokens",
        Boolean(setA.one) && Boolean(setA.two) && setA.first?.scene === IDS.scene && setA.second?.scene === IDS.annex && setA.tokens.length === 4
            && setA.tokens.filter(t => t.project === setA.one).length === 2 && setA.tokens.some(t => t.project === ORPHAN && t.scene === IDS.scene),
        J(setA), { flow: "season-reset" });
    /* At 4aad1fd p1 read the orphan as a project it knew (projects-secrecy.mjs `isSecret` reads a missing countdown as
       public, and `roomOf` a missing row as no room). E11 C7: an id with no countdown is nobody's project. */
    check("A2: p1 does not know the orphan's project, which has no countdown (E11 C7)",
        knowsA.orphan === false && knowsA.countdowns === false, J(knowsA), { flow: "season-reset" });

    /* ------------------------------ B. the discovery ------------------------------ */
    phase("B: a body found by two, the hold, the trial and its verdict", { flow: "body-discovery" });
    await mute();
    const blow = await kill(IDS.chie, IDS.daichi);
    await unmute();
    const waiting = await gm.eval(`${NEXT} const M = await import("${repoUrl}/scripts/movement.mjs");
        const open = Boolean(game.drpg.murderState()?.active);
        await game.drpg.endMurder({ reason: "closed", followUp: false });
        const room = M.roomOfActor(game.actors.get("${IDS.daichi}"));
        return { open, closed: !game.drpg.murderState(), room, line: await nextLine(), text: game.i18n.format("DRPG.Panel.nextBodyWaiting", { room }) };`, { timeout: 60000 });
    /* E11 C2 (audit S13-14): with the incident closed and nobody yet in the room, the line names the body the GMs
       keep and offers the GM's own announcement. At a220f0f it counted the actions left. The incident is closed
       here rather than after the discovery, as a GM closes it before anybody finds the body. */
    check("B0: the incident closed with Daichi's death kept, the GM's next line says a body is waiting in his room and offers the announcement",
        waiting.open === true && waiting.closed === true && Boolean(waiting.room) && J(waiting.line) === J([waiting.text, "bodyDialog"]),
        J(waiting), { flow: "body-discovery" });
    /* E11 C3: every browser's camera calls, kept from here on (the harness canvas's own `animatePan` does nothing). */
    const PANS = `if (!globalThis.__pans) { globalThis.__pans = []; const pan = canvas.animatePan;
        canvas.animatePan = async function (view) { globalThis.__pans.push({ x: view?.x ?? null, y: view?.y ?? null }); return pan.call(this, view); }; } return true;`;
    await Promise.all([gm, p1, p2].map(client => client.eval(PANS)));
    /* E11 C4: the GM's Prep question and toasts, kept from here to B1c. Before any trace is placed, the
       announcing window's note in Daily Life (answered "cancel"); then two Faint Prep traces, this chapter's
       and another's, and the GM's window answered as it is asked - the cards on the table then, its title,
       what it lists - with nothing ticked. Every other window goes to the harness's own answer. */
    const asking = await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs"), R = await import("${repoUrl}/scripts/remnants.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const D = foundry.applications.api.DialogV2, wait = D.wait;
        const parse = config => { const el = document.createElement("div");
            if (typeof config?.content === "string") el.innerHTML = config.content; else if (config?.content) el.append(config.content.cloneNode(true));
            return el; };
        let note = null;
        D.wait = async function (config) { const el = parse(config);
            if (el.querySelector('select[name="room"]')) { note = el.querySelector(".notes")?.textContent?.trim() ?? null; return "cancel"; }
            return wait.call(this, config); };
        try { await C.openBodyDiscoveryDialog(); } finally { D.wait = wait; }
        const chapter = getClock().chapter, academy = game.scenes.get("${IDS.scene}");
        const place = (chapter, subject) => R.placeRemnant({ type: "prep", visibility: "subtle", faint: true, tiedToCrime: false, x: 0, y: 0, scene: academy, chapter, subject });
        const mine = await place(chapter, "65 C4 this chapter"), old = await place(chapter + 1, "65 C4 another chapter");
        globalThis.__c4 = { traces: [mine?.id ?? null, old?.id ?? null], asked: null, told: [], wait, info: ui.notifications.info };
        D.wait = async function (config) { const el = parse(config);
            if (!el.querySelector('input[name="promote"]')) return wait.call(this, config);
            globalThis.__c4.asked ??= { cards: game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound").length, title: config.window?.title ?? null,
                listed: [...el.querySelectorAll("label")].map(l => l.textContent ?? "") };
            return []; };
        ui.notifications.info = function (message, ...rest) { globalThis.__c4.told.push(String(message)); return globalThis.__c4.info.call(this, message, ...rest); };
        return { note, bodyNote: game.i18n.localize("DRPG.Chapter.bodyNote"), placed: Boolean(mine && old), phase: getClock().phase };`, { timeout: 60000 });
    const found = await gm.eval(`${UNTIL} ${CARDS} ${NEXT} const M = await import("${repoUrl}/scripts/movement.mjs");
        const { bodyDiscovery, bodiesFoundIn, getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const academy = game.scenes.get("${IDS.scene}"), daichi = game.actors.get("${IDS.daichi}");
        const room = M.roomOfActor(daichi), before = cards();
        await academy.updateEmbeddedDocuments("Token", ["${IDS.aiko}", "${IDS.botan}"].map(id => {
            const t = academy.tokens.find(x => x.actorId === id);
            return { _id: t.id, ...M.positionIn(room, t) };
        }), { teleport: true, movementAction: "displace", animate: false });
        await until(() => bodyDiscovery());
        await new Promise(r => setTimeout(r, 800));
        const stamps = (bodiesFoundIn?.(getClock().chapter) ?? []).map(row => ({ by: row.by, room: row.room, victimIds: row.victimIds }));
        return { room, before, cards: cards(), hold: bodyDiscovery()?.room ?? null, flag: game.drpg.isDeceased(daichi), stamps,
            line: await nextLine(), holdLine: game.i18n.localize("DRPG.Panel.nextBodyFound") };`, { timeout: 60000 });
    // E11 C1: the discovery is stamped once, by the witnesses, naming the body they found. E11 C2: the line during the hold.
    check("B1: Aiko and Botan walk in on Daichi, kept: one discovery card, the death the table's, the hold on his room, one stamp by the witnesses naming him, the GM's line on the hold",
        blow.dead === true && blow.flag === false && found.before === 0 && found.cards === 1 && found.flag === true && found.hold === found.room
            && J(found.stamps) === J([{ by: "witnesses", room: found.room, victimIds: [IDS.daichi] }]) && J(found.line) === J([found.holdLine, "startInvestigation"]),
        J({ blow, found }), { flow: "body-discovery" });
    const asked = await gm.eval(`${UNTIL} await until(() => globalThis.__c4?.asked, 6000);
        const c4 = globalThis.__c4, D = foundry.applications.api.DialogV2;
        D.wait = c4.wait; ui.notifications.info = c4.info;
        for (const id of c4.traces) { const t = id ? game.scenes.get("${IDS.scene}").tokens.get(id) : null;
            if (t) { try { await (await import("${repoUrl}/scripts/remnants.mjs")).dropRemnantSecret(t); } catch { /* nothing filed */ } await t.delete(); } }
        return { asked: c4.asked, told: c4.told, title: game.i18n.format("DRPG.Chapter.promoteTitle", { room: ${J(found.room)} }),
            done: game.i18n.format("DRPG.Chapter.bodyDone", { room: ${J(found.room)} }) };`, { timeout: 60000 });
    /* E11 C4 (audit S06-44, S13-27). At 2dd4fb9 the GM was asked about Prep traces before the card was on the table
       (no card yet when asked), under a title without the room, about every chapter's Faint Prep; the toast counted
       tokens and "traces made permanent"; and the window's note promised the Prep traces to a world with none.
       Now the card is up when the question comes, headed by the room, listing this chapter's trace alone, the toast
       says where everyone was brought, and the note before any trace is the Daily Life sentence alone. */
    check("B1c: the GM is asked about Prep traces after the card, under the body's room, about this chapter's alone; the toast names the room; the note names no traces when there are none",
        asking.placed === true && asking.phase === "dailyLife" && asking.note === asking.bodyNote && asked.asked?.cards === 1 && asked.asked?.title === asked.title
            && asked.asked.listed.some(t => t.includes("65 C4 this chapter")) && !asked.asked.listed.some(t => t.includes("65 C4 another chapter"))
            && asked.told.includes(asked.done),
        J({ asking, asked }), { flow: "body-discovery" });
    const PANNED = actorId => `${UNTIL} await until(() => globalThis.__pans.length > 0, 4000);
        const t = canvas.scene?.tokens.find(x => x.actorId === "${actorId}");
        return { pans: globalThis.__pans, at: t ? { x: t.center.x, y: t.center.y } : null, scene: canvas.scene?.id ?? null };`;
    const pannedP1 = await p1.eval(PANNED(IDS.aiko)), pannedP2 = await p2.eval(PANNED(IDS.botan));
    const pannedGm = await gm.eval(`return { pans: globalThis.__pans };`);
    await p1.eval(`const t = game.scenes.get("${IDS.scene}").tokens.find(x => x.actorId === "${IDS.botan}");
        game.socket.emit("module.${MOD}", { action: "sync", kind: "gather", data: { room: ${J(found.room)}, scene: "${IDS.scene}", tokenIds: [t.id] } });
        return true;`);
    await settle(1500);
    const forged = await p2.eval(`return globalThis.__pans.length;`);
    /* E11 C3 (audit S06-07): the discovery's gather moved the cast and told no screen - at 9e97646 no browser
       made a camera call. Each player's browser pans to its own student's token where it now stands, the GM's
       (no student of its own) does not, and the same packet sent by a player is not applied (sync.mjs
       `registerSync` takes a packet only from a GM). */
    const at = panned => J(panned.pans) === J([panned.at]);
    check("B1b: the gather after the discovery pans Aiko's and Botan's players to their own tokens and not the GM; a gather packet a player sends pans nobody",
        at(pannedP1) && at(pannedP2) && pannedP1.scene === IDS.scene && pannedGm.pans.length === 0 && forged === pannedP2.pans.length,
        J({ pannedP1, pannedP2, pannedGm, forged }), { flow: "body-discovery" });
    const eclipse = await gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        const { isEclipse, bodyDiscovery } = await import("${repoUrl}/scripts/settings.mjs");
        const held = Boolean(bodyDiscovery()), first = game.i18n.localize("DRPG.Eclipse.bodyFirst"), told = [], warn = ui.notifications.warn;
        ui.notifications.warn = function (message, ...rest) { told.push(String(message)); return warn.call(this, message, ...rest); };
        let answered;
        try { answered = await E.startEclipse(); } finally { ui.notifications.warn = warn; }
        const on = isEclipse();
        if (on) await E.endEclipse({ advance: false });
        const chevron = document.querySelector('#drpg-hud .drpg-hud-button[aria-disabled="true"]');
        return { held, answered: answered ?? null, on, told: told.includes(first), chevron: chevron?.dataset?.tooltip === first, off: !isEclipse() };`, { timeout: 60000 });
    /* At C0 (4aad1fd) the Eclipse opened during the hold. E11 C3 (audit S06-05): refused, the GM told why, and
       the HUD's chevron dimmed with the same words. */
    check("B2: an Eclipse asked for during the hold is refused, the GM told why, and the HUD's Eclipse chevron is dimmed with the same words",
        eclipse.held === true && eclipse.answered === null && eclipse.on === false && eclipse.told === true && eclipse.chevron === true && eclipse.off === true,
        J(eclipse), { flow: "body-discovery" });
    const trial = await gm.eval(`${CARDS} const { setPhase } = await import("${repoUrl}/scripts/clock.mjs");
        const { getClock, bodyDiscovery } = await import("${repoUrl}/scripts/settings.mjs");
        const I = await import("${repoUrl}/scripts/incident-store.mjs");
        await setPhase("investigation");
        const investigation = { phase: getClock().phase, hold: Boolean(bodyDiscovery()) };
        globalThis.__dialogAnswers.push("ok");
        const { startClassTrial } = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const started = await startClassTrial();
        const known = I.trialBlackenedIds();
        await game.drpg.applyVerdict({ correct: false, executedIds: ["${IDS.botan}"], blackenedIds: ["${IDS.chie}"] });
        await new Promise(r => setTimeout(r, 800));
        return { investigation, started, phase: getClock().phase, known, botan: game.drpg.isDeceased(game.actors.get("${IDS.botan}")), cards: cards() };`, { timeout: 90000 });
    const afterVerdictRoom = await walkTo(IDS.chie, found.room);
    const afterVerdict = await gm.eval(`${CARDS} const { bodyDiscovery } = await import("${repoUrl}/scripts/settings.mjs");
        return { cards: cards(), hold: Boolean(bodyDiscovery()) };`);
    /* The plan predicted a second card here (base 2). Measured at 4aad1fd (10.10.2026): 1. Chie moves inside
       the Gym, where both bodies lie, during the Class Trial; `checkBodyFound` admits only the Investigation or
       a hold, and the hold went when the phase changed. So this is already C1's reading, kept as a guard
       rather than a flip; the flip is B4's. */
    check("B3: after a wrong verdict executes Botan, a move inside the room during the trial posts no second discovery card",
        trial.investigation.phase === "investigation" && trial.started === true && trial.phase === "classTrial" && J(trial.known) === J([IDS.chie])
            && trial.botan === true && trial.cards === 1 && afterVerdictRoom === found.room && afterVerdict.cards === 1 && afterVerdict.hold === false,
        J({ trial, afterVerdictRoom, afterVerdict }), { flow: "body-discovery" });
    const ended = await gm.eval(`const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        globalThis.__dialogAnswers.push(true);
        const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        ${CARDS} const { bodyDiscovery } = await import("${repoUrl}/scripts/settings.mjs");
        const ended = await UI.endClassTrial();
        await new Promise(r => setTimeout(r, 1500));
        return { ended, phase: getClock().phase, cards: cards(), hold: Boolean(bodyDiscovery()) };`, { timeout: 60000 });
    const afterEndRoom = await walkTo(IDS.aiko, found.room);
    const afterEnd = await gm.eval(`${CARDS} const { bodyDiscovery, bodiesFoundIn, getClock } = await import("${repoUrl}/scripts/settings.mjs");
        return { cards: cards(), hold: Boolean(bodyDiscovery()), stamps: (bodiesFoundIn?.(getClock().chapter) ?? []).length };`);
    /* At 4aad1fd (C0, 10.10.2026), once the trial had ended, Aiko walking in set off a second discovery: a second
       card and a new hold (the plan's "2 or 3"). Ending the trial posts nothing by itself. Aiko's token reads no
       room afterwards - the walk is charged in Daily Life and put back - but the watcher heard her inside first.
       E11 C1: still one card, no hold, one stamp. What this reads is Daichi's stamp: with the watcher's
       `announced` dropped B4 is red, and with the execution's phase test dropped it stays green (both measured
       10.10.2026), so the executed body is held by R347 and the tier-2 execution test, not here. Whether Botan's
       token still lies in the room after the verdict was not measured. */
    check("B4: after End the trial, Aiko walking into the room posts no second discovery card, no new hold and no second stamp",
        ended.ended === true && ended.phase === "dailyLife" && ended.cards === 1 && ended.hold === false && afterEnd.cards === 1 && afterEnd.hold === false
            && afterEnd.stamps === 1,
        J({ ended, afterEndRoom, afterEnd }), { flow: "body-discovery" });
    // The cast back for the rest of the season, and the hold the last discovery left taken.
    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { clearBodyDiscovery } = await import("${repoUrl}/scripts/settings.mjs");
        for (const id of ["${IDS.botan}", "${IDS.daichi}"]) await C.reviveCharacter(game.actors.get(id), { quiet: true });
        await clearBodyDiscovery();
        return true;`, { timeout: 60000 });

    /* ------------------------------ C. the chapter's end and Edit campaign ------------------------------ */
    phase("C: the chapter ended twice from the Investigation, and Edit campaign with an assembly called", { flow: "clock-day" });
    /* Two End of chapter windows open on the same clock, as two GMs' would be: the one opened first is
       pressed last, after the other's end has run (its answer opens and answers the second window
       before it answers itself). Before E11 C5 the window sent the chapter read when Do it was pressed
       and nothing compared the session, so both ran: two sessions on, and still the Investigation. */
    const twice = await gm.eval(`const { setPhase } = await import("${repoUrl}/scripts/clock.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        await setPhase("investigation");
        const mark = () => ({ chapter: getClock().chapter, session: getClock().session, day: getClock().day ?? 1, phase: getClock().phase });
        const before = mark();
        const twiceText = game.i18n.format("DRPG.Chapter.endTwice", before);
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const told = () => game.messages.filter(m => String(contentOf(m)).includes(twiceText)).length;
        const answer = () => ({ reveal: false, sweep: false, faint: false, keys: false, endTrial: false, nextChapter: false, nextSession: true, nextMorning: true });
        const ends = {};
        globalThis.__dialogAnswers.push(async () => {
            globalThis.__dialogAnswers.push(answer);
            ends.second = Boolean(await C.openChapterEndDialog());
            return answer();
        });
        ends.first = Boolean(await C.openChapterEndDialog());
        return { before, ends, after: mark(), told: told() };`, { timeout: 60000 });
    check("C1: two End of chapter windows opened on the same clock in the Investigation, next chapter unticked: the one pressed second is refused and told, one session and one day on, and Daily Life (E11 C5)",
        twice.before.phase === "investigation" && twice.ends.second === true && twice.ends.first === false && twice.told === 1
            && twice.after.chapter === twice.before.chapter && twice.after.session === twice.before.session + 1
            && twice.after.day === twice.before.day + 1 && twice.after.phase === "dailyLife",
        J(twice), { flow: "clock-day" });
    /* Edit campaign moving the hour back, with an assembly called in the afternoon for the next time of day. Before
       E11 C6 the correction's clock write was the one `runPendingGather` holds an order on (the time of day differs
       from the one it was called in), so the cast was gathered from a window for typos; C0's reading was the order
       gone and the time of day moved. Read: the cards posted after the write that carry Monokuma's banner (an
       assembly held), the order standing, the called-off cards. */
    const edit = await gm.eval(`${UNTIL} const { setPhase, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const CE = await import("${repoUrl}/scripts/call-effects.mjs");
        const G = await import("${repoUrl}/scripts/gm-panel.mjs");
        await setPhase("dailyLife");
        await setClock({ timeOfDay: "afternoon" });
        const view = canvas.scene; canvas.scene = game.scenes.get("${IDS.scene}");
        let order = null;
        try { order = await CE.scheduleGather("Cafeteria"); } finally { canvas.scene = view; }
        const seen = new Set(game.messages.keys());
        const posted = text => game.messages.filter(m => !seen.has(m.id) && String(contentOf(m) ?? "").includes(text)).length;
        const banner = game.i18n.localize("DRPG.Calls.gatherBanner");
        const calledOff = game.i18n.format("DRPG.Calls.gatherCancelled", { room: "Cafeteria" });
        const c = getClock();
        globalThis.__dialogAnswers.push(() => ({ campaignName: c.campaignName ?? "", chapter: c.chapter, day: c.day ?? 1, phase: c.phase,
            session: c.session, timeOfDay: "morning", reset: false }));
        await G.openClockDialog();
        await until(() => posted(banner) > 0, 4000);
        const standing = Boolean(CE.pendingGather());
        if (standing) await CE.cancelGather();
        return { ordered: order?.timeOfDay ?? null, timeOfDay: getClock().timeOfDay, held: posted(banner), standing, calledOff: posted(calledOff) };`, { timeout: 60000 });
    check("C2: Edit campaign moving the time of day back calls off the assembly called in the afternoon and holds nobody (E11 C6)",
        edit.ordered === "afternoon" && edit.timeOfDay === "morning" && edit.held === 0 && edit.standing === false && edit.calledOff === 1,
        J(edit), { flow: "clock-day" });

    /* ------------------------------ Q. Q3 (a): a death kept past its chapter ------------------------------ */
    phase("Q: a death kept past its chapter's end and announced in the next reaches no trial", { flow: "murder-incident" });
    await mute();
    const keptBlow = await kill(IDS.botan, IDS.daichi);
    await unmute();
    const late = await gm.eval(`const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const C = await import("${repoUrl}/scripts/chapter.mjs"); const I = await import("${repoUrl}/scripts/incident-store.mjs");
        const daichi = game.actors.get("${IDS.daichi}");
        await game.drpg.endMurder({ reason: "closed", followUp: false });
        const from = getClock().chapter, register = I.blackenedIds(), livingBefore = C.livingStudents().length;
        globalThis.__dialogAnswers.push(() => ({ reveal: false, sweep: false, faint: false, keys: false, endTrial: false, nextChapter: true, nextSession: true, nextMorning: true }));
        const ended = Boolean(await C.openChapterEndDialog());
        const keptAtEnd = game.drpg.isDeadForGm(daichi) && !game.drpg.isDeceased(daichi);
        const living = [livingBefore, C.livingStudents().length];
        await C.publishDeath(daichi);
        return { from, to: getClock().chapter, ended, register, keptAtEnd, living, announced: game.drpg.isDeceased(daichi), trial: I.trialBlackenedIds() };`, { timeout: 60000 });
    // Q3 (a), the owner's answer of 09.10.2026: today's code already does this (anchors.md section 2 (6), read in the code); this measures it.
    check("Q1: Botan's kill of Daichi, kept through the chapter's end and announced in the next chapter, puts no Blackened before that chapter's trial",
        keptBlow.dead === true && keptBlow.flag === false && late.register.includes(IDS.botan) && late.ended === true && late.to === late.from + 1
            && late.keptAtEnd === true && late.announced === true && J(late.trial) === J([]),
        J({ keptBlow, late }), { flow: "murder-incident" });
    /* The amendment of 26.09.2026: the chapter's end neither reveals a death the GMs hold (Q1's `keptAtEnd`) nor
       counts it - the living the table reads (`livingStudents`, the published flag) are as many after the end
       as before it (E11 C5; green before it too, measured 10.10.2026: no step of the end touches a death). */
    check("Q2: the chapter's end leaves the living count the table reads as it was, with Daichi's death still kept",
        late.ended === true && late.keptAtEnd === true && late.living[0] === late.living[1], J(late), { flow: "murder-incident" });

    /* ------------------------------ D. the season to reset ------------------------------ */
    phase("D: a suicide at Stage 6, an offer, an armed Call, the Final Trial, a bedroom and its key", { flow: "season-reset" });
    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs");
        await C.reviveCharacter(game.actors.get("${IDS.daichi}"), { quiet: true }); return true;`, { timeout: 60000 });
    await mute();
    const suicide = await gm.eval(`await game.drpg.openMurder({ killerId: "${IDS.chie}", victimId: "${IDS.chie}", openingTrait: "body" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await new Promise(r => setTimeout(r, 800));
        const s = game.drpg.murderState();
        return { stage: s?.stage ?? null, self: s?.selfInflicted ?? null, dead: game.drpg.isDeadForGm(game.actors.get("${IDS.chie}")) };`, { timeout: 60000 });
    await unmute();
    const season = await gm.eval(`const L = await import("${repoUrl}/scripts/level-up.mjs"); const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const CE = await import("${repoUrl}/scripts/call-effects.mjs"); const MM = await import("${repoUrl}/scripts/mastermind.mjs");
        const V = await import("${repoUrl}/scripts/vault.mjs"); const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const aiko = game.actors.get("${IDS.aiko}"), botan = game.actors.get("${IDS.botan}");
        await L.recordOffer(aiko.id, { kind: "standard" });
        const armed = await CE.armCall(botan, { key: "support", kind: "hope", grants: "advantage" });
        await MM.setFinalTrial(true);
        await game.scenes.get("${IDS.scene}").regions.find(r => r.name === "Dorm A").setFlag("${MOD}", V.VAULT_FLAGS.owner, aiko.id);
        await V.reconcileBedroomKeys({ silent: true });
        await trustedWrite(aiko, { "system.resources.hitPoints.value": 2, "system.resources.stress.value": 2, "system.resources.hope.value": 0 }, { reason: "gmRuling" });
        const r = aiko.system.resources;
        return { offers: L.offerList(S.offerStore.get(aiko.id)).length, armed: Boolean(armed),
            calls: ["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}", "${IDS.daichi}"].filter(id => game.actors.get(id).getFlag("${MOD}", "pendingCall")).length,
            finalTrial: getClock().finalTrial, season: getClock().season ?? null, key: V.keysHeldBy(aiko).has("Dorm A"),
            sheet: [r.hitPoints.value, r.stress.value, r.hope.value] };`, { timeout: 60000 });
    check("D1: the season to reset - Chie's suicide at Stage 6 and alive, an offer for Aiko, a Call armed on Botan, the Final Trial, Aiko's key to Dorm A",
        suicide.stage === "resolution" && suicide.self === true && suicide.dead === false && season.offers === 1 && season.armed && season.calls === 1
            && season.finalTrial === true && season.season === 1 && season.key === true && J(season.sheet) === J([2, 2, 0]),
        J({ suicide, season }), { flow: "season-reset" });

    /* ------------------------------ R. the reset ------------------------------ */
    phase("R: the season reset, every group ticked", { flow: "season-reset" });
    const RESET = `const R = await import("${repoUrl}/scripts/season-setup.mjs");
        const X = await import("${repoUrl}/scripts/season-exceptions.mjs");
        const { gmStoresIdle } = await import("${repoUrl}/scripts/gm-store.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const L = await import("${repoUrl}/scripts/level-up.mjs");
        const V = await import("${repoUrl}/scripts/vault.mjs"); const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        ${PROJECT_TOKENS}
        const word = game.i18n.localize("DRPG.Season.resetWord");
        // The stamps' setting is C1's: before it, reading it throws, so the count is null and R1 fails as a check.
        const told = globalThis.__notifications.length, seasons = () => { try { return Object.keys(game.settings.get("${MOD}", "bodiesFound") ?? {}).length; } catch { return null; } };
        const stampedBefore = seasons();
        // The window's own count of the project tokens (E11 C7, \`resetTally\`), read off the content it was opened with -
        // an element (\`dialogContent\`), not a string: read as a string it was "[object ...]" and the count null.
        let counted = null;
        globalThis.__dialogAnswers.push(config => { const c = config?.content;
            const line = /(\\d+) project tokens? on the maps/.exec(typeof c === "string" ? c : c?.textContent ?? "");
            counted = line ? Number(line[1]) : null; return { word, ticked: X.RESET_GROUPS.map(g => g.key) }; });
        const result = await R.resetSeason();
        await gmStoresIdle();
        await new Promise(r => setTimeout(r, 800));
        const ids = ["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}", "${IDS.daichi}"], aiko = game.actors.get("${IDS.aiko}"), r = aiko.system.resources;
        const read = { cleared: result?.cleared ?? null, kept: result?.kept ?? null, tokens: projectTokens().length, counted,
            offers: ids.reduce((n, id) => n + L.offerList(S.offerStore.get(id)).length, 0),
            calls: ids.filter(id => game.actors.get(id).getFlag("${MOD}", "pendingCall")).length,
            finalTrial: getClock().finalTrial, season: getClock().season ?? null, victim: { forGm: game.drpg.isDeadForGm(game.actors.get("${IDS.chie}")), flag: game.drpg.isDeceased(game.actors.get("${IDS.chie}")), row: S.deathStore.has("${IDS.chie}") },
            sheet: [r.hitPoints.value, r.stress.value, r.hope.value], key: V.keysHeldBy(aiko).has("Dorm A"), stamped: [stampedBefore, seasons()],
            errors: globalThis.__notifications.slice(told).filter(n => n.level === "error").map(n => n.msg) };`;
    const reset = await gm.eval(`${RESET} return read;`, { timeout: 120000 });
    // E11 C1: the `bodyFound` group clears the season's stamps of the bodies found too (`stamped`: the chapters stamped before, after).
    check("R1: after the reset no Level Up is offered, the Final Trial is off, the season is the second, no body's stamp is left, and no error was told",
        Array.isArray(reset.cleared) && reset.kept?.length === 0 && reset.offers === 0 && reset.finalTrial === false && reset.season === 2
            && reset.stamped[0] > 0 && reset.stamped[1] === 0 && reset.errors.length === 0, J(reset), { flow: "season-reset" });
    /* At 4aad1fd `clearAllProjects` cleared the countdowns and the meta and removed no token: all four stood after the
       reset. E11 C7: the projects step sweeps every project token first, and the window counts them before it asks. */
    check("R2: the reset window counts the four project tokens and the reset leaves none on any scene (E11 C7)",
        reset.counted === 4 && reset.tokens === 0, J(reset), { flow: "season-reset" });
    // Today `seals` clears the seals and not the armed Call. C10: none left.
    check("R3: the reset leaves Botan's armed Call - today's reading; E11 C10 unsets it",
        reset.calls === 1, J(reset), { flow: "season-reset" });
    /* The plan predicted the victim dead at the base (deaths revived before the incident is ended). Measured at
       4aad1fd (10.10.2026): alive - not dead for the GMs, no flag, no row in the death store. So this reading is
       already the one C9 promises; it stays as the guard C9's reordering must keep green. */
    check("R4: the reset leaves the suicide's victim alive - no death for the GMs, no flag, no death row",
        reset.victim?.forGm === false && reset.victim?.flag === false && reset.victim?.row === false, J(reset), { flow: "season-reset" });
    /* The sheet half the plan gave C10 is already there: Aiko's 2, 2, 0 come back as 0, 0 and the starting
       Hope 2 (measured at 4aad1fd, 10.10.2026). The key half is not: the reset takes the key with the cast's
       items and gives none back. C10: a key. */
    check("R5: the reset gives Aiko Health and Sanity 0 and the starting Hope, and leaves her bedroom without its key - today's reading; E11 C10 gives the key",
        J(reset.sheet) === J([0, 0, 2]) && reset.key === false, J(reset), { flow: "season-reset" });

    /* ------------------------------ F. a step that fails ------------------------------ */
    phase("F: a reset whose chat deletion throws", { flow: "season-reset" });
    const failing = await gm.eval(`await ChatMessage.create({ content: "E11 C0 65 F: a card for the reset to delete", flags: { "${MOD}": { drpgMessage: true } } });
        const deleting = ChatMessage.deleteDocuments;
        const asked = { n: 0, size: game.messages.size };
        ChatMessage.deleteDocuments = async () => { asked.n++; throw new Error("E11 C0 65: the chat cannot be deleted"); };
        await (await import("${repoUrl}/scripts/clock.mjs")).setClock({ finalTrial: true });
        try { ${RESET} return { ...read, asked }; } finally { ChatMessage.deleteDocuments = deleting; }`, { timeout: 120000 });
    /* Today a step that throws is logged on the console and no error is told (measured 10.10.2026: with a module card
       in the chat the stub was asked twice, once per chat group, and both fell out of `cleared`). C9: an error
       notification names the module's chat. */
    check("F1: with the chat's deletion throwing, every other group still runs and the GM is told nothing of the failure - today's reading; E11 C9 tells it",
        failing.asked.n === 2 && Array.isArray(failing.cleared) && !failing.cleared.some(l => /chat/.test(l)) && failing.cleared.length === reset.cleared.length - 2
            && failing.season === 3 && failing.finalTrial === false && failing.offers === 0 && failing.errors.length === 0,
        J({ failing, reset: reset.cleared }), { flow: "season-reset" });

    /* ------------------------------ G. a world already reset ------------------------------ */
    phase("G: a world already reset - an orphan, a duplicate and a token deleted by hand, and the canvas drawn again", { flow: "season-reset" });
    const ORPHAN_G = "E11C0ORPHAN00002";
    const swept = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const PM = await import("${repoUrl}/scripts/projects-map.mjs");
        ${PROJECT_TOKENS}
        const academy = game.scenes.get("${IDS.scene}"), annex = game.scenes.get("${IDS.annex}");
        for (const t of projectTokens()) await game.scenes.get(t.scene).tokens.get(t.id)?.delete();
        const view = canvas.scene;
        canvas.scene = academy;
        const three = await P.createProject({ name: "E11 C0 65 G the Cafeteria's project", target: 6, room: "Cafeteria" });
        canvas.scene = annex;
        let four = null;
        try { four = await P.createProject({ name: "E11 C0 65 G the Annex's project", target: 6, room: "Annex Hall" }); }
        finally { canvas.scene = view; }
        const first = PM.projectTokenOf(three?.id), byHand = PM.projectTokenOf(four?.id);
        const like = (t, x, projectId) => ({ name: t.name, actorId: t.actorId, actorLink: false, x, y: t.y, width: t.width, height: t.height,
            texture: { src: t.texture?.src ?? "" }, hidden: false, flags: { "${MOD}": { projectId } } });
        if (first) {
            await annex.createEmbeddedDocuments("Token", [like(first, 300, three.id)]);
            await academy.createEmbeddedDocuments("Token", [like(first, first.x + 100, "${ORPHAN_G}")]);
        }
        const deleted = Boolean(byHand);
        await byHand?.delete();
        const planted = projectTokens();
        const told = globalThis.__notifications.length;
        canvas.scene = annex;
        try {
            Hooks.callAll("canvasReady", canvas);
            await new Promise(r => setTimeout(r, 2000));
        } finally { canvas.scene = view; }
        const after = projectTokens();
        return { three: three?.id ?? null, four: four?.id ?? null, deleted, planted: planted.length,
            orphan: after.some(t => t.project === "${ORPHAN_G}"), duplicates: after.filter(t => t.project === three?.id).length,
            back: after.some(t => t.project === four?.id), warned: globalThis.__notifications.slice(told).filter(n => n.level === "warn").length };`, { timeout: 60000 });
    // Today the primary's sync keeps the orphan and the duplicate unremarked, and puts the token a GM deleted back. C8: the orphan gone,
    // the duplicate kept and warned of, the deleted token left deleted.
    check("G1: the canvas drawn again keeps the orphan and the duplicate without a word and puts back the token deleted by hand - today's reading; E11 C8 changes all three",
        Boolean(swept.three) && Boolean(swept.four) && swept.deleted && swept.planted === 3 && swept.orphan === true && swept.duplicates === 2
            && swept.back === true && swept.warned === 0, J(swept), { flow: "season-reset" });
}
