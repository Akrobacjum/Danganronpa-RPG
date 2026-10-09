/**
 * The Class Trial as it is today (E10 C0, 09.10.2026; the plan's 2.1 and its doneWhen).
 *
 * 10-murder and 72-canary drive a trial in passing - the ballots on the real road, the verdict by
 * API - and none drives a player who joins after the ballots went out, a GM's reload in the middle
 * of a vote, the verdict's window, a second trial in a chapter, or the Level Ups a correct verdict
 * hands out. This one does, on the seed's GM and three players and two late accounts declared as
 * 61 declares them: `gm2`, a second GM, and `p4`, a player given Daichi before it connects.
 *
 * Every check below is a reading of the code at 1e9871c, written as what happens today; where an
 * E10 commit changes the answer the check's text names it ("C1 flips it"), and that commit
 * rewrites the check with the code - E10 C1 (1.2.71) rewrote B, D, E, F and H: the vote's state
 * is in the world and the ballots in the GMs' store; E10 C2 (1.2.71) rewrote B to F: a ballot is
 * cast on the bridge and judged by the primary GM, the player is told what the primary answered,
 * and a player who loads while a vote is open asks for theirs; E10 C3 (1.2.71) added B4, B5, C3 and E4:
 * the vote window's bar, the vote's card and the count's card; E10 C4 (1.2.71) rewrote F: the verdict's window
 * opens on the accused, the dead cannot be picked and Enter presses Cancel. Phases are letters, so a later commit adds one
 * without renumbering:
 *   A  setup through the GM's API (not under test): a fifth student, the victim, killed publicly;
 *      the register's row naming Chie the Blackened; p4 OWNER of Daichi. Start the Class Trial:
 *      every player holds the trial's card.
 *   B  Send the ballots: three issued (p1-p3), and the world's trial record holds the vote - open,
 *      round 1, one name, the three handed one (C1). p1 casts Botan and is told its vote is in once
 *      the primary has recorded it (C2); p2 and p3 hold their windows open. The GM's vote window,
 *      drawn and left open, says 1 of 3 ballots are back and a conviction needs 2, and every
 *      player's card says three ballots are out, in the plural family's form (C3).
 *   C  p4 connects after the ballots went out, heard connecting before its world has loaded
 *      (`announceFirst`): it asks the GM for its ballot at load and is handed one, and the record
 *      issues a fourth (C2). The harness's default press dismisses that window, so p4 asks again
 *      as its next load would, casts Botan and is told it is in. The window B drew says 2 of 4 and
 *      needs 3 without being opened again - p4 raised the bar (C3) - and is cancelled.
 *   D  the GM's browser closes (the reload, modelled: `gm2` connects with the seeded GM's
 *      localStorage and a fresh module). p2 casts Botan with no GM connected and is told no GM has
 *      it yet and this browser keeps it (C2); gm2 finds the vote open in the world and p1's and
 *      p4's ballots in its copy of the GMs' store (C1), and p2's kept ballot reaches it once its
 *      world has loaded: three in, and p2 told (C2). p4 closes and comes back with its storage:
 *      no ballot window, and told once that its vote is already in (C2).
 *   E  p3 dismisses its ballot and is warned; gm2's Close and count counts p1's, p2's and p4's
 *      ballots - Botan 3 of 4 issued, the majority, accused (C2; C1 counted p1's alone, a tie) -
 *      and writes it to the world (C1); every player reads the vote closed, and holds the count's
 *      card: a row per name and the one sentence that the class accuses Botan (C3).
 *   F  the verdict's window drawn on gm2 (`__dialogWindows`): the executed select opens on Botan,
 *      whom E's count accused, under the line naming him with his 3 of 4, and its first option is
 *      "Nobody is executed"; the dead victim is listed with " - dead" and cannot be picked
 *      (Q-E10-1 (c)); the footer reads Cancel, the right verdict, the wrong one, Cancel the only
 *      default, so Enter closes the window (C4); Cancel.
 *   G  a wrong verdict executing Botan while p2's forged `deceased: true` on Botan waits for the
 *      sheet audit (the window, made deterministic: gm2's queue on Botan is held by a job, so the
 *      write is heard and not yet judged when the verdict reads it): the verdict skips the
 *      execution and Botan is alive once the audit puts the flag back (C5); no player holds a
 *      verdict card (C5), and nothing a player who does not own Chie holds names her.
 *   H  End the trial, Start it again: only the Start window is asked (C11: a confirmation, Cancel
 *      the default); `verdictApplied` is cleared and `keysCharged` kept; the vote, its count and
 *      the tie are cleared and its round number carried on, so no ballot of the first trial counts
 *      in the second (C1, D17).
 *   I  a second vote names Chie and the verdict is correct: one Level Up window per survivor on
 *      gm2 (C7: one window); gm2 offers Aiko a Level Up, p1's sheet sees it, p1 picks +1 Health
 *      through the bridge and Aiko's `advances` rise by one (C6-C8 read it again).
 *
 * Headless limits: no layout (the Objection card's stacking, the select widths, the text's
 * hierarchy - LIVE-E10-03); no real Enter on Foundry's DialogV2 (F reads the DOM order of the
 * footer; the key press is LIVE-E10-02); no sound (an sfx is a message flag); no real reload (a
 * late GM with the seeded GM's storage models it; Foundry's own session restore is not modelled);
 * the seeded GM cannot connect again (cluster.mjs `connect`), so from D on gm2 is the only GM -
 * the primary. p4 connects heard before its world has loaded (`announceFirst`), as a browser's
 * socket is (61's R1): in the harness's other order its ask at load reaches a GM that does not yet
 * see it active and is refused as from an unknown sender, quietly, as the note's, the cast's and
 * the deaths' asks are (read in the code) - which order v14 takes is LIVE-E04-12. The three
 * accounts from Start to End at a table are LIVE-E10-01.
 *
 * Its bound (the plan's M4: set from C0's first reading): 33 checks in 24.0 s, the cluster's own count, at 1e9871c
 * (one run alone, 09.10.2026) - a twelfth of run-all's shared five minutes, so it states no `timeoutMs` of its own.
 * E10 C1 added H's check of the vote's reset: 34 checks in 26.5 s (one run, 09.10.2026).
 * E10 C2 split C's check in two, the ask at load and the cast: 35 checks in 23.0 s (two runs, 22.6 and 23.0 s, 09.10.2026).
 * E10 C3 added B4, B5, C3 and E4, the vote window, the vote's card and the count's card: 39 checks in 27.6 s (two runs,
 * 27.6 and 24.3 s, 09.10.2026).
 * E10 C4 rewrote F's three checks, the verdict's window: 39 checks in 22.0 s (one run, 09.10.2026).
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true },
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true }
];

const MOD = "danganronpa-rpg";
const P4 = "USERP4000000000A";
const J = value => JSON.stringify(value);

export async function run({ gm, gm2, p1, p2, p3, p4, check, phase, settle, connect, disconnect, storageOf, IDS, repoUrl }) {
    const counts = {};
    let current = null;
    const begin = (letter, name) => { phase(`${letter}: ${name}`, { flow: "class-trial" }); current = letter; counts[letter] = 0; };
    const verdict = (name, ok, details, opts) => { counts[current]++; check(`${current}${counts[current]}: ${name}`, ok, details, opts); };
    const until = `const until = async (test, ms) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 150)); return v; };`;
    const V = `const V = await import("${repoUrl}/scripts/vote.mjs");`;
    /* A ballot answered as a player would: the window is the module's (`drpg-ballot`), the row
       `pick` is checked and Cast pressed; with `gate`, the window stays open until that global is
       set, and a null `pick` is a dismissal. Any other window first is handed back closed. */
    const ballot = (pick, gate = null) => `globalThis.__dialogAnswers.push(async function ballot(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-ballot")) { globalThis.__dialogAnswers.unshift(ballot); return null; }
            globalThis.__s63ballots = (globalThis.__s63ballots ?? 0) + 1;
            ${gate ? `while (!globalThis.${gate}) await new Promise(r => setTimeout(r, 100));` : ""}
            const el = document.createElement("dialog");
            if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
            globalThis.__s63seen = [...el.querySelectorAll('input[name="choice0"]')].map(i => i.value);
            const radio = ${pick ? `el.querySelector('input[name="choice0"][value="${pick}"]')` : "null"};
            if (!radio) return null;
            radio.checked = true;
            const button = (cfg.buttons ?? []).find(b => b.default) ?? cfg.buttons?.[0];
            return button.callback(new window.Event("click"), { form: null }, { element: el });
        });
        return true;`;
    const mark = client => client.eval(`globalThis.__s63n = globalThis.__notifications.length; globalThis.__s63d = globalThis.__dialogLog.length;
        globalThis.__s63m = new Set(game.messages.map(m => m.id)); return true;`);
    const since = client => client.eval(`const ballotTitle = game.i18n.localize("DRPG.Vote.ballotTitle");
        return { notes: globalThis.__notifications.slice(globalThis.__s63n ?? 0).map(n => n.level + ":" + n.msg),
            ballots: globalThis.__dialogLog.slice(globalThis.__s63d ?? 0).filter(d => d.title === ballotTitle).length,
            confirmed: ${text("DRPG.Vote.castConfirmed")} };`);
    const text = key => `game.i18n.localize(${J(key)})`;
    /* How many times `client` has been told `key` since its `mark` (a fresh client: since it loaded), read
       once it has been told it at least once or `ms` has passed - 0 reads it now. */
    const toldOf = (client, key, ms = 5000) => client.eval(`${until} const words = ${text(key)};
        const n = () => globalThis.__notifications.slice(globalThis.__s63n ?? 0).filter(note => note.msg === words).length;
        await until(() => n() || null, ${ms}); return n();`, { timeout: ms + 15000 });

    /* ------------------------------ A. the trial opens ------------------------------ */

    begin("A", "a fifth student killed, Chie in the register, and the trial opened on every player");
    const setup = await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { blackenedStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { seasonEpoch, getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const I = await import("${repoUrl}/scripts/incident-store.mjs");
        const victim = await Actor.create({ name: "S63 Victim", type: "character" });
        const died = await C.killCharacter(victim, { secret: false, keepBullets: true });
        await blackenedStore.patch("${IDS.chie}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [victim.id] });
        await game.actors.get("${IDS.daichi}").update({ "ownership.${P4}": 3 });
        return { victim: victim.id, died: Boolean(died), dead: game.drpg.isDeadForGm(victim), known: I.trialBlackenedIds(),
            students: (await import("${repoUrl}/scripts/monokuma.mjs")).studentActors().map(a => a.id) };`, { timeout: 60000 });
    const victimId = setup.victim;
    verdict("setup: the victim is dead, the register names Chie for the trial, and the class is five",
        setup.dead && J(setup.known) === J([IDS.chie]) && setup.students.length === 5 && setup.students.includes(victimId), J(setup));
    for (const c of [p1, p2, p3]) await mark(c);
    const opened = await gm.eval(`globalThis.__dialogAnswers.push("ok");
        const { startClassTrial } = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        return { started: await startClassTrial(), phase: getClock().phase };`, { timeout: 60000 });
    await settle(800);
    const cards = [];
    for (const c of [p1, p2, p3]) cards.push(await c.eval(`const words = ${text("DRPG.Floor.trialOpened")};
        return game.messages.filter(m => !globalThis.__s63m.has(m.id) && String(m.content ?? "").includes(words)).length;`));
    verdict("Start the Class Trial moves the phase, and p1, p2 and p3 each hold the trial's card",
        opened.started === true && opened.phase === "classTrial" && J(cards) === J([1, 1, 1]), J({ opened, cards }));

    /* ------------------------------ B. the ballots ------------------------------ */

    begin("B", "Send the ballots: three issued, p1 casts, p2 and p3 hold their windows");
    await p1.eval(ballot(IDS.botan));
    await p2.eval(ballot(IDS.botan, "__s63goP2"));
    await p3.eval(ballot(null, "__s63goP3"));
    for (const c of [p1, p2, p3]) await mark(c);
    const sent = await gm.eval(`${V} const issued = await game.drpg.openVote();
        return { issued, vote: V.trialProgress().vote ?? null, players: game.users.filter(u => !u.isGM && u.active).map(u => u.id).sort() };`,
    { timeout: 60000 });
    verdict("openVote issues three ballots (p1-p3), and the world's trial record holds the vote: open, round 1, one name, the three handed one (C1)",
        sent.issued === 3 && sent.vote?.open === true && sent.vote.round === 1 && sent.vote.picks === 1 && sent.players.length === 3
            && J([...(sent.vote.issued ?? [])].sort()) === J(sent.players), J(sent));
    const counted = await gm.eval(`${until} ${V} return await until(() => V.votesIn() === 1 ? 1 : null, 8000) ?? V.votesIn();`, { timeout: 20000 });
    /* Told once the primary's reply has come back, which is after the GM's row: read at once, p1's
       notification landed just after the read in E10 C3's A1's first run (09.10.2026; C2's three
       runs had passed), so it is waited for as the other phases wait for theirs. */
    const p1Told = { seen: await p1.eval(`return globalThis.__s63seen;`), confirmed: await toldOf(p1, "DRPG.Vote.castConfirmed") };
    verdict("p1's ballot lists the five students and Monokuma, the GM counts it, and p1 is told once, on the primary's reply (C2)",
        counted === 1 && p1Told.confirmed === 1 && (p1Told.seen ?? []).length === 6 && p1Told.seen.includes(victimId), J({ counted, p1Told }));
    const holding = [await p2.eval(`return globalThis.__s63ballots ?? 0;`), await p3.eval(`return globalThis.__s63ballots ?? 0;`)];
    verdict("p2 and p3 each hold one ballot window open", J(holding) === J([1, 1]), J(holding));
    /* The GM's vote window, drawn (`__dialogWindows`) and left open into C, where it is read again
       once p4 has been handed a ballot and closed. */
    const voteWindow = `const bar = (r, i, m) => game.i18n.format("DRPG.Vote.barLine", { returned: r, issued: i, majority: m });
        const voteWindow = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === ${text("DRPG.Vote.openTitle")});
        const status = () => voteWindow()?.element?.querySelector(".drpg-vote-status")?.textContent ?? null;`;
    const bar1 = await gm.eval(`${until} ${voteWindow}
        globalThis.__s63windows = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        globalThis.__s63vote = (await import("${repoUrl}/scripts/trial-floor-ui.mjs")).openVoteDialog();
        await until(() => voteWindow()?.element, 8000);
        globalThis.__s63voteId = voteWindow()?.id ?? null;
        return { status: status(), want: bar(1, 3, 2), drawn: globalThis.__s63voteId !== null };`, { timeout: 20000 });
    verdict("the GM's vote window says one of three ballots is back and a conviction needs two (C3)",
        bar1.drawn && typeof bar1.status === "string" && bar1.status.includes(bar1.want), J(bar1));
    const openedCards = [];
    for (const c of [p1, p2, p3]) openedCards.push(await c.eval(`const banner = ${text("DRPG.Vote.banner")};
        const card = game.messages.filter(m => String(m.content ?? "").includes(banner)).at(-1);
        return String(card?.content ?? "").includes(game.i18n.format("DRPG.Vote.opened.other", { n: 3 }));`));
    verdict("p1-p3 each hold the vote's card saying three ballots are out, in the counted sentence's form for three (C3: `DRPG.Vote.opened` is a plural family)",
        J(openedCards) === J([true, true, true]), J(openedCards));

    /* ------------------------------ C. a late joiner ------------------------------ */

    begin("C", "p4 joins after the ballots went out and asks for its own");
    // Heard connecting before its world has loaded (the header's headless limits).
    await connect("p4", { announceFirst: true });
    // Its windows counted once it has been warned: the shim logs a window as it opens, before the press.
    const p4Late = { warned: await toldOf(p4, "DRPG.Vote.dismissed", 10000) };
    Object.assign(p4Late, await p4.eval(`const ballotTitle = game.i18n.localize("DRPG.Vote.ballotTitle");
        return { ballots: globalThis.__dialogLog.filter(d => d.title === ballotTitle).length,
            owner: game.actors.get("${IDS.daichi}")?.isOwner === true };`));
    p4Late.issued = await gm.eval(`${V} return V.trialProgress().vote?.issued ?? null;`);
    verdict("p4, Daichi's owner, asks at load and is handed a ballot: one window, and the world's record issues it a fourth (C2); the harness's default press dismisses it, and p4 is warned once",
        p4Late.owner && p4Late.ballots === 1 && p4Late.warned === 1 && (p4Late.issued ?? []).length === 4 && p4Late.issued.includes(P4), J(p4Late));
    await mark(p4);
    await p4.eval(ballot(IDS.botan));
    // Read as a type first: before C2 there is no `askForBallot`, and the checks below say so rather than the eval throwing.
    const p4Cast = { ask: await p4.eval(`${V} if (typeof V.askForBallot === "function") V.askForBallot(); return typeof V.askForBallot;`) };
    p4Cast.told = await toldOf(p4, "DRPG.Vote.castConfirmed", 10000);
    p4Cast.counted = await gm.eval(`${until} ${V} return await until(() => V.votesIn() === 2 ? 2 : null, 8000) ?? V.votesIn();`, { timeout: 20000 });
    p4Cast.seen = await p4.eval(`return globalThis.__s63seen ?? null;`);
    verdict("p4 asks again, as its next load would (`askForBallot`), and casts Botan: its ballot lists the five students and Monokuma, the GM counts it (2), and p4 is told once (C2)",
        p4Cast.told === 1 && (p4Cast.seen ?? []).length === 6 && p4Cast.seen.includes(victimId) && p4Cast.counted === 2, J(p4Cast));
    const bar2 = await gm.eval(`${until} ${voteWindow}
        const want = bar(2, 4, 3);
        await until(() => (status() ?? "").includes(want) || null, 5000);
        const read = { status: status(), want, same: Boolean(voteWindow()) && voteWindow().id === globalThis.__s63voteId };
        voteWindow()?.element?.querySelector('footer button[data-action="cancel"]')?.click();
        read.result = await Promise.race([globalThis.__s63vote, new Promise(r => setTimeout(() => r("hung"), 5000))]);
        globalThis.__dialogWindows = globalThis.__s63windows;
        return read;`, { timeout: 30000 });
    verdict("the window B drew, never reopened, now says two of four are back and a conviction needs three - p4's ballot raised the bar (C3); Cancel closes it",
        bar2.same && typeof bar2.status === "string" && bar2.status.includes(bar2.want) && bar2.result === null, J(bar2));

    /* ------------------------------ D. the GM's reload ------------------------------ */

    begin("D", "the GM's browser closes in the vote; p2 casts with no GM; gm2 comes with its storage");
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); await E.gmStoresIdle(); return true;`, { timeout: 30000 });
    await disconnect("gm");
    await mark(p2);
    await p2.eval(`globalThis.__s63goP2 = true; return true;`);
    const p2Kept = { kept: await toldOf(p2, "DRPG.Vote.notReceived"), told: await toldOf(p2, "DRPG.Vote.castConfirmed", 0),
        gms: await p2.eval(`return game.users.filter(u => u.isGM && u.active).length;`) };
    verdict("p2 casts Botan with no GM connected: told once that no GM has it yet and this browser keeps it, and not that it is in (C2)",
        p2Kept.gms === 0 && p2Kept.kept === 1 && p2Kept.told === 0, J(p2Kept));
    await connect("gm2", { storage: await storageOf("gm") });
    await settle(1500);
    const reloaded = await gm2.eval(`${until} ${V} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        await until(() => E.gmStoresHydrated(), 10000);
        await until(() => V.votesIn() === 3 ? true : null, 10000);
        return { hydrated: E.gmStoresHydrated(), votesIn: V.votesIn(), open: V.trialProgress().vote?.open ?? null,
            copy: V.ballotCopyStatus(), primary: game.users.filter(u => u.isGM && u.active).map(u => u.id) };`, { timeout: 30000 });
    reloaded.p2Told = await toldOf(p2, "DRPG.Vote.castConfirmed");
    verdict("gm2, the seeded GM's browser reloaded, finds the vote open in the world and p1's and p4's ballots in its store (C1), and p2's kept ballot reaches it once its world has loaded: votesIn() 3, its copy not flagged, and p2 told once (C2)",
        reloaded.hydrated && reloaded.open === true && reloaded.votesIn === 3 && reloaded.copy === null
            && J(reloaded.primary) === J(["USERGM2000000000"]) && reloaded.p2Told === 1, J(reloaded));
    const p4Storage = await (async () => { await disconnect("p4"); return storageOf("p4"); })();
    await connect("p4", { storage: p4Storage, announceFirst: true });
    await toldOf(p4, "DRPG.Vote.alreadyIn", 10000);
    await settle(1000);
    const p4Back = { ...(await since(p4)), already: await toldOf(p4, "DRPG.Vote.alreadyIn", 0) };
    verdict("p4 closes and comes back with its storage: no ballot window, and told once that its vote is already in - not that it is in (C2)",
        p4Back.ballots === 0 && p4Back.already === 1 && !p4Back.notes.some(n => n.endsWith(":" + p4Back.confirmed)), J(p4Back));

    /* ------------------------------ E. the count ------------------------------ */

    begin("E", "p3 dismisses; gm2's Close and count");
    await mark(p3);
    await p3.eval(`globalThis.__s63goP3 = true; return true;`);
    const p3Told = await p3.eval(`${until} const words = ${text("DRPG.Vote.dismissed")};
        return await until(() => globalThis.__notifications.slice(globalThis.__s63n).filter(n => n.msg === words).length || null, 5000) ?? 0;`, { timeout: 20000 });
    verdict("p3 dismisses its ballot and is warned once", p3Told === 1, J(p3Told));
    await mark(gm2);
    const closed = await gm2.eval(`${V} const r = await V.closeVote();
        return { r, notes: globalThis.__notifications.slice(globalThis.__s63n).map(n => n.level + ":" + n.msg),
            notOpen: ${text("DRPG.Vote.notOpen")}, progress: V.trialProgress() };`, { timeout: 30000 });
    const tally = (closed.r?.rows ?? []).map(row => [row.id, row.n]), world = closed.progress;
    verdict("gm2's Close and count counts p1's, p2's and p4's ballots: Botan 3 of 4 issued, the majority of 3 - Botan accused (C2; until C2 p1's alone, a tie) - and the world holds the count (C1)",
        J(tally) === J([[IDS.botan, 3]]) && closed.r?.total === 4 && closed.r.tied === false && J(closed.r.accusedIds) === J([IDS.botan])
            && !closed.notes.includes("warn:" + closed.notOpen) && world.voteClosed === true && world.vote?.open === false
            && J(world.accused) === J([{ id: IDS.botan, n: 3 }]) && world.total === 4 && world.majority === 3 && world.noMajority === false
            && world.tied === false && J(world.accusedIds) === J([IDS.botan]), J(closed));
    await settle(500);
    const panels = [];
    for (const c of [p1, p2, p3, p4]) panels.push(await c.eval(`${V} const ev = await import("${repoUrl}/scripts/events.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const p = V.trialProgress(), card = ev.trialCard(getClock());
        return [p.voteClosed, p.vote?.open ?? null, card?.title === ${text("DRPG.Events.voteTitle")}];`));
    verdict("p1-p4 read the vote closed in the world's record, and no panel shows the vote (C1)",
        J(panels) === J([[true, false, false], [true, false, false], [true, false, false], [true, false, false]]), J(panels));
    const accuses = await gm2.eval(`return game.i18n.format("DRPG.Vote.accusesLine", { names: game.actors.get("${IDS.botan}")?.name, n: 3, total: 4 });`);
    const results = [];
    for (const c of [p1, p2, p3, p4]) results.push(await c.eval(`const banner = ${text("DRPG.Vote.resultBanner")};
        const card = game.messages.filter(m => String(m.content ?? "").includes(banner)).at(-1);
        const el = document.createElement("div"); el.innerHTML = String(card?.content ?? "");
        return [el.querySelectorAll(".drpg-vote-row").length, Boolean(el.querySelector("table")),
            el.querySelector(".drpg-vote-sentence")?.textContent ?? null];`));
    verdict("p1-p4 each hold the count's card: one row for Botan, no table, and the one sentence that the class accuses Botan, 3 of 4, a majority (C3)",
        J(results) === J(Array(4).fill([1, false, accuses])), J({ results, accuses }));

    /* ------------------------------ F. the verdict's window ------------------------------ */

    begin("F", "the verdict's window, drawn on gm2");
    const drawn = await gm2.eval(`${until}
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const title = ${text("DRPG.Vote.verdictTitle")}, dead = ${text("DRPG.Chapter.deadShort")};
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const pending = game.drpg.verdictDialog();
        let read = null, result = "hung";
        try {
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const select = el?.querySelector('select[name="executed"]');
            const victim = [...(select?.options ?? [])].find(o => o.value === "${victimId}");
            const named = game.i18n.format("DRPG.Vote.namedByTable", { names: game.actors.get("${IDS.botan}")?.name, n: 3, total: 4 });
            read = el ? { value: select?.value ?? null, first: select?.options[0]?.value ?? null,
                firstText: select?.options[0]?.textContent ?? null, nobody: ${text("DRPG.Vote.nobodyExecuted")},
                named: el.textContent.includes(named),
                victim: victim?.textContent ?? null, victimDisabled: victim?.disabled ?? null, dead,
                buttons: [...el.querySelectorAll("footer button[data-action]")].map(b => b.dataset.action),
                submitFirst: el.querySelector('button[type="submit"]')?.dataset?.action ?? null,
                defaults: [...el.querySelectorAll("footer button[data-action]")]
                    .filter(b => b.classList.contains("default") || b.hasAttribute("autofocus")).map(b => b.dataset.action),
                blackenedSelect: Boolean(el.querySelector('select[name="blackened"]')) } : null;
            el?.querySelector('footer button[data-action="cancel"]')?.click();
            result = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 5000))]);
        } finally {
            globalThis.__dialogWindows = was;
        }
        return { read, result };`, { timeout: 30000 });
    verdict("the executed select opens on Botan, whom the count accused, under the line naming him with 3 of 4, and its first option is \"Nobody is executed\" (C4)",
        drawn.read?.value === IDS.botan && drawn.read?.first === "" && drawn.read?.firstText === drawn.read?.nobody
            && drawn.read?.named === true && !drawn.read?.blackenedSelect, J(drawn.read));
    verdict("the dead victim is listed, marked \" - dead\", and cannot be picked (C4, Q-E10-1 (c))",
        drawn.read?.victim === `S63 Victim - ${drawn.read?.dead}` && drawn.read?.victimDisabled === true, J(drawn.read));
    verdict("the footer reads cancel, correct, wrong: the first submit button, which Enter presses, is Cancel, the only default (C4); Cancel closes it with nothing applied",
        J(drawn.read?.buttons) === J(["cancel", "correct", "wrong"]) && drawn.read?.submitFirst === "cancel"
            && J(drawn.read?.defaults) === J(["cancel"]) && drawn.result === null, J(drawn));

    /* ------------------------------ G. a wrong verdict in the audit's window ------------------------------ */

    begin("G", "a wrong verdict executes Botan while p2's forged death waits for the audit");
    for (const c of [p1, p2, p3, p4]) await mark(c);
    const held = await gm2.eval(`${until} const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        await A.sheetAuditIdle();
        globalThis.__s63hold = null;
        void A.gmMeansWrite(game.actors.get("${IDS.botan}"), () => new Promise(r => { globalThis.__s63hold = r; }));
        return Boolean(await until(() => globalThis.__s63hold, 5000));`, { timeout: 20000 });
    await p2.eval(`await game.actors.get("${IDS.botan}").setFlag("${MOD}", "deceased", true); return true;`, { timeout: 20000 });
    const wrong = await gm2.eval(`${until} const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const botan = game.actors.get("${IDS.botan}");
        const heard = Boolean(await until(() => game.drpg.isDeceased(botan), 5000));
        // Not awaited: once C5 waits for the audit before reading, an await here would never return.
        const pending = game.drpg.applyVerdict({ correct: false, executedIds: ["${IDS.botan}"], blackenedIds: ["${IDS.chie}"] });
        await new Promise(r => setTimeout(r, 1000));
        globalThis.__s63hold?.();
        const done = await pending;
        await A.sheetAuditIdle();
        await until(() => !game.drpg.isDeceased(botan), 5000);
        const executed = game.i18n.format("DRPG.Vote.wasExecuted", { name: foundry.utils.escapeHTML(botan.name) });
        return { heard, done, executed, dead: game.drpg.isDeadForGm(botan), applied: (await import("${repoUrl}/scripts/vote.mjs")).trialProgress().verdictApplied };`, { timeout: 60000 });
    verdict("held: gm2 hears p2's forged death before the verdict reads it", held && wrong.heard, J({ held, wrong }));
    verdict("the verdict skips Botan's execution on the forged flag and Botan is alive once the audit puts it back (C5 executes Botan)",
        wrong.applied === true && wrong.dead === false && Array.isArray(wrong.done) && !wrong.done.includes(wrong.executed), J(wrong));
    await settle(800);
    const verdictCards = [], namesChie = [];
    for (const c of [p1, p2, p3, p4]) {
        const read = await c.eval(`const words = [${text("DRPG.Vote.verdictTitle")}, ${text("DRPG.Vote.wrongSummary")}];
            const fresh = game.messages.filter(m => !globalThis.__s63m.has(m.id));
            return { cards: fresh.filter(m => words.some(w => String(m.content ?? "").includes(w))).length,
                chie: fresh.filter(m => { const s = String(m.content ?? "") + J(m.flags ?? {}); return s.includes("${IDS.chie}") || s.includes("Chie"); }).length };
            function J(v) { return JSON.stringify(v); }`);
        verdictCards.push(read.cards);
        if (c !== p3) namesChie.push(read.chie);
    }
    verdict("no player holds a card of the verdict - it is whispered to the GMs (C5 posts one public card)",
        J(verdictCards) === J([0, 0, 0, 0]), J(verdictCards));
    verdict("nothing new on p1, p2 or p4 names Chie, the Blackened the wrong verdict spared", J(namesChie) === J([0, 0, 0]), J(namesChie));

    /* ------------------------------ H. a second trial in the chapter ------------------------------ */

    begin("H", "End the trial, Start it again");
    const again = await gm2.eval(`${V} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const before = V.trialProgress();
        globalThis.__dialogAnswers.push(true);
        const ended = await UI.endClassTrial();
        const from = globalThis.__dialogLog.length;
        globalThis.__dialogAnswers.push("ok");
        const started = await UI.startClassTrial();
        const after = V.trialProgress();
        return { ended, started, asked: globalThis.__dialogLog.slice(from).map(d => d.kind + ":" + d.title),
            startTitle: ${text("DRPG.Floor.startTrial")}, before: [before.verdictApplied, before.keysCharged], after: [after.verdictApplied, after.keysCharged],
            round: before.vote?.round ?? null, cleared: { vote: after.vote ?? null, voteClosed: after.voteClosed, tied: after.tied,
                accused: after.accused ?? null, accusedIds: after.accusedIds ?? null, total: after.total ?? null } };`, { timeout: 60000 });
    verdict("the second Start asks only its own window (C11 asks first, Cancel the default)",
        again.ended === true && again.started === true && J(again.asked) === J([`wait:${again.startTitle}`]), J(again));
    verdict("the second trial clears `verdictApplied` and keeps `keysCharged`",
        again.before[0] === true && again.after[0] === false && again.after[1] === again.before[1], J(again));
    const fresh = again.cleared;
    verdict("the second trial clears the vote, its count and the tie, and carries the round number on (C1, D17)",
        again.round === 1 && fresh.vote?.open === false && fresh.vote.round === 1 && J(fresh.vote.issued) === J([]) && fresh.voteClosed === false
            && fresh.tied === false && J(fresh.accused) === J([]) && J(fresh.accusedIds) === J([]) && fresh.total === 0, J(again));

    /* ------------------------------ I. a correct verdict and its Level Ups ------------------------------ */

    begin("I", "a vote for Chie, a correct verdict, and a Level Up picked through the bridge");
    for (const c of [p1, p2, p3, p4]) await c.eval(`globalThis.__s63ballots = 0; ${ballot(IDS.chie)}`);
    const second = await gm2.eval(`${until} ${V} const issued = await game.drpg.openVote();
        await until(() => V.votesIn() === issued ? true : null, 10000);
        const counted = V.votesIn();
        const r = await V.closeVote();
        let windows = 0;
        globalThis.__dialogAnswers.push(async function advance(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-advance")) { globalThis.__dialogAnswers.unshift(advance); return null; }
            windows++;
            globalThis.__dialogAnswers.unshift(advance);
            return "cancel";
        });
        let done = null;
        try {
            done = await game.drpg.applyVerdict({ correct: true, executedIds: ["${IDS.chie}"], blackenedIds: ["${IDS.chie}"] });
        } finally {
            const q = globalThis.__dialogAnswers, at = q.findIndex(f => f?.name === "advance");
            if (at >= 0) q.splice(at, 1);
        }
        const living = (await import("${repoUrl}/scripts/chapter.mjs")).livingStudents().map(a => a.id);
        return { issued, counted, accused: r?.accusedIds ?? null, windows, living, done };`, { timeout: 90000 });
    // Every ballot answer not taken - B's too, where no ballot came - so none of them closes I's Level Up window.
    for (const c of [p1, p2, p3, p4]) await c.eval(`const q = globalThis.__dialogAnswers;
        for (let at = q.findIndex(f => f?.name === "ballot"); at >= 0; at = q.findIndex(f => f?.name === "ballot")) q.splice(at, 1);
        return true;`);
    verdict("the second vote names Chie, and the correct verdict opens one Level Up window per survivor (C7: one window for the class)",
        second.issued === second.counted && J(second.accused) === J([IDS.chie]) && second.living.length > 1
            && second.windows === second.living.length, J(second));
    const offered = await gm2.eval(`const L = await import("${repoUrl}/scripts/level-up.mjs");
        const offer = await L.offerAdvancement(game.actors.get("${IDS.aiko}"), "standard"); return offer?.kind ?? null;`, { timeout: 30000 });
    const picked = await p1.eval(`${until} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        const lit = Boolean(await until(() => L.pendingAdvance(aiko), 8000));
        const before = aiko.getFlag("${MOD}", "advances") ?? 0;
        let updates = 0;
        const hook = Hooks.on("updateActor", a => { if (a.id === aiko.id) updates++; });
        globalThis.__dialogAnswers.push(async function advance(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-advance")) { globalThis.__dialogAnswers.unshift(advance); return null; }
            return [{ option: "hp" }];
        });
        let sent = null;
        try {
            sent = await L.openAdvancement(aiko, "standard");
            await until(() => (aiko.getFlag("${MOD}", "advances") ?? 0) > before ? true : null, 10000);
            await new Promise(r => setTimeout(r, 1000));
        } finally {
            Hooks.off("updateActor", hook);
        }
        return { lit, sent, before, after: aiko.getFlag("${MOD}", "advances") ?? 0, updates, still: Boolean(L.pendingAdvance(aiko)) };`, { timeout: 60000 });
    verdict("gm2 offers Aiko a Level Up, p1's sheet sees it, and p1's pick through the bridge raises Aiko's advances by one in one write (C6-C8 read it again)",
        offered === "standard" && picked.lit && picked.sent?.pending === true && picked.after === picked.before + 1
            && picked.updates === 1 && !picked.still, J({ offered, picked }));

    /* ------------------------------ every client clean, every phase measured ------------------------------ */

    const errors = {};
    for (const [who, c] of Object.entries({ gm2, p1, p2, p3, p4 })) errors[who] = await c.eval(`return globalThis.__errors.slice(0, 3).map(e => String(e?.message ?? e).slice(0, 200));`);
    check("no uncaught error on gm2 or any player", Object.values(errors).every(list => list.length === 0), J(errors));
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I"]) {
        check(`${letter}0: phase ${letter} measured something`, (counts[letter] ?? 0) > 0, J(counts));
    }
    await disconnect("p4");
    await disconnect("gm2");
    return { phases: Object.keys(counts) };
}
