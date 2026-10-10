/**
 * The Class Trial as it is today (E10 C0, 09.10.2026; the plan's 2.1 and its doneWhen).
 *
 * 10-murder and 72-canary drive a trial in passing - the ballots on the real road, the verdict by
 * API - and none drives a player who joins after the ballots went out, a GM's reload in the middle
 * of a vote, the verdict's window, a second trial in a chapter, or the Level Ups a correct verdict
 * hands out. This one does, on the seed's GM and three players and three late accounts declared as
 * 61 declares them: `gm2`, a second GM, `p4`, a player given Daichi before it connects, and `gm3`, a
 * third GM (phase V).
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
 *      player's card says three ballots are out, in the plural family's form (C3). Pressed again, the
 *      window is raised and no second one is drawn (C14).
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
 *      card: a row per name and the one sentence that the class accuses Botan (C3). The vote
 *      window's privacy note read against the GMs' store: gm2 keeps who chose whom after the count,
 *      no player's browser holds a row or the store's setting (C14).
 *   F  the verdict's window drawn on gm2 (`__dialogWindows`): the executed select opens on Botan,
 *      whom E's count accused, under the line naming him with his 3 of 4, and its first option is
 *      "Nobody is executed"; the dead victim is listed with " - dead" and cannot be picked
 *      (Q-E10-1 (c)); the footer reads Cancel, the right verdict, the wrong one, Cancel the only
 *      default, so Enter closes the window (C4); Cancel.
 *   G  a wrong verdict executing Botan while p2's forged `deceased: true` on Botan waits for the
 *      sheet audit (the window, made deterministic: gm2's queue on Botan is held by a job, so the
 *      write is heard and not yet judged when the verdict reads it): the verdict waits for the
 *      audit, which puts the flag back, and executes Botan, and its record reads "done" (C5);
 *      every player holds the verdict's one public card - Botan executed, the class got it wrong
 *      (C5) - and nothing a player who does not own Chie holds names her.
 *   H  End the trial, Start it again: after the Start window the chapter's verdict asks, drawn on
 *      gm2 - Cancel its first submit button and only default, so Enter keeps Daily Life and the
 *      verdict (C11); Start again and yes: `verdictApplied` is cleared and `keysCharged` kept; the
 *      vote, its count and the tie are cleared and its round number carried on, so no ballot of the
 *      first trial counts in the second (C1, D17).
 *   I  a second vote names Chie and the verdict is correct: one Level Up window for the class on
 *      gm2, a row per survivor, answered "All: the players pick" - no picker opens, and every
 *      survivor a player owns holds one offer (C7; one picker per survivor before it); p1's sheet
 *      sees Aiko's, p1 picks +1 Health through the bridge and Aiko's `advances` rise by one (C6-C8
 *      read it again).
 *      Then (C6) gm2 offers Aiko two: p1's copy holds both, p1 spends the older and the other stays
 *      lit; gm2's own Level Up menu takes it back, and p1's copy empties and its lit button goes out.
 *      Then (C8) gm2 offers Aiko one more, and p1's pick of an experience Aiko does not have is refused and
 *      told on p1, the offer standing and nothing written; gm2 takes it back. Last (C14), gm2's copy of
 *      the ballots holds the second vote's rows alone, as the privacy note says.
 *   J  (run between H and I) p4 comes back on a machine whose clock runs a minute fast (`clockSkewMs`:
 *      `Date.now` moves, the server's time does not); gm2 opens a five-minute debate in H's second trial,
 *      and p4's count of its seconds and its Event card's clock read what gm2's read (C13); gm2 closes it.
 *   U  (run after the phases above are counted; fix r1-G4) gm2 kills Aiko where nobody finds the body and
 *      draws the verdict's window on a count that accused her: it opens on Aiko, not listed " - dead", and
 *      tells gm2 alone whose death that is; the wrong verdict executes her, p1 holds the card naming her
 *      executed and reads her dead, and gm2 holds no row of her death (the owner's Q-E10-2 (a)).
 *   V  (run after U; fix r2-G4) gm3, a GM that is not the primary, is connected when gm2 opens a vote and
 *      reads its copy of the ballots as not flagged; gm3 loaded again while that vote is open, with no ballot
 *      in, reads "none" - it cannot tell where the ballots are (`ballotCopyStatus`, the round noted at load).
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
 * E10 C5 rewrote G2 and G3, the verdict executes Botan once the audit has put the flag back and every player holds its
 * one public card: 39 checks in 25.4 s (one run, 09.10.2026).
 * E10 C6 added I3 and I4, two offers standing side by side and one taken back from the GM's menu: 41 checks in 17.4 s
 * (one run, 09.10.2026).
 * E10 C7 rewrote I1 and I2, the class's one Level Up window and the offer p1 spends from it: 41 checks in 17.2 s
 * (one run, 10.10.2026).
 * E10 C8 added I5, p1's pick of an experience Aiko does not have, refused and told: 42 checks in 18.0 s (one run,
 * 10.10.2026).
 * E10 C9 added I6, p1's own picker read off its markup (a module panel, no Choice over one pick, no line for whom):
 * 43 checks in 19.4 s (one run, 10.10.2026).
 * E10 C11 rewrote H1 and H2, the second Start's confirmation drawn on gm2 and answered by Enter, then by its yes: 43
 * checks in 18.6 s (one run, 10.10.2026).
 * E10 C13 added J1 and J2, p4 back on a machine a minute fast reading gm2's debate: 46 checks in 23.5 and 20.0 s (two
 * runs, 10.10.2026).
 * E10 C14 added B6, E5 and I7, the second press on the vote window and its privacy note read against the GMs' store:
 * 49 checks in 22.8 and 22.5 s (two runs, 10.10.2026).
 * E10 fix r1-G4 added U1 and U2 on the side line (from C8's 42): 44 checks in 23.8 and 24.0 s (two runs, 10.10.2026).
 * Merged beside C9-C17: 51 checks in 27.8 s (one run, the merge's fast set beside two other lanes, 10.10.2026).
 * E10 fix r2-G4 added V1 and V2 on the side line (from 7ff93ec's 51), gm3 joining twice: 53 checks in 32.0 s (one run,
 * beside a checkpoint's harness run in another lane, 10.10.2026).
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true },
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true },
    // A GM after gm2 in the primary's order (utils.mjs `primaryGmId`), so never the primary while gm2 is connected (V).
    { who: "gm3", id: "USERGM3000000000", name: "Third GM", role: 4, character: null, color: "#66ffaa", late: true }
];

const MOD = "danganronpa-rpg";
const P4 = "USERP4000000000A";
const J = value => JSON.stringify(value);

export async function run({ gm, gm2, gm3, p1, p2, p3, p4, check, phase, settle, connect, disconnect, storageOf, IDS, repoUrl }) {
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
    /* E10 C14 (S06-26): the vote window is one window - pressed again, the one B drew is raised. A second one drawn (the
       answer to the press never comes back, "drawn") is closed here, so that C reads the window B drew. */
    const raised = await gm.eval(`${voteWindow}
        const drawnAll = () => [...foundry.applications.instances.values()]
            .filter(a => a.rendered && a.element?.isConnected && a.options?.window?.title === ${text("DRPG.Vote.openTitle")});
        const second = await Promise.race([(await import("${repoUrl}/scripts/trial-floor-ui.mjs")).openVoteDialog(),
            new Promise(r => setTimeout(() => r("drawn"), 3000))]);
        const read = { second, windows: drawnAll().length, same: voteWindow()?.id === globalThis.__s63voteId };
        for (const app of drawnAll()) if (app.id !== globalThis.__s63voteId) await app.close();
        return read;`, { timeout: 20000 });
    verdict("pressed again, the vote window B drew is raised and no second one is drawn (C14)",
        raised.second === null && raised.windows === 1 && raised.same === true, J(raised));

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
    /* E10 C14 (S13-26; round 1's note): the vote window's privacy note against the store it describes. It said the
       ballots "are counted in memory and are not kept", which stopped being true at C1. Read after the count: gm2's
       copy of the GMs' store (a row per voter, keyed by the voter, with the names chosen) and the same store's client
       setting on gm2 and on every player (the key `gm-store.mjs` reads, so that gm2's being there shows the key is the
       right one); E4 read the totals on the count's card. The note is read in English, by the three things it says. */
    const STORE = `const { ballotStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { SETTINGS } = await import("${repoUrl}/scripts/settings.mjs");
        const kept = game.settings.storage.get("client").getItem("${MOD}." + SETTINGS.gmBallots);
        let rows; try { rows = Object.entries(ballotStore.entries() ?? {}).map(([id, row]) => [id, row?.round ?? null, row?.choice ?? null]).sort(); }
        catch (err) { rows = "threw: " + err.message; }`;
    const privacy = { gm2: await gm2.eval(`${STORE} return { rows, kept: kept !== null, note: ${text("DRPG.Vote.privacyNote")} };`), players: [] };
    for (const c of [p1, p2, p3, p4]) privacy.players.push(await c.eval(`${STORE} return { rows, kept: kept !== null };`));
    const chose = [IDS.p1, IDS.p2, P4].sort().map(id => [id, 1, [IDS.botan]]);
    verdict("the vote window's privacy note is true of the GMs' store: gm2 keeps who chose whom after the count, no player's browser holds a row or the store's setting, and the note says so and that the table sees the totals (C14)",
        J(privacy.gm2.rows) === J(chose) && privacy.gm2.kept === true
            && J(privacy.players) === J(Array(4).fill({ rows: [], kept: false }))
            && ["who chose whom", "no player's browser", "the totals"].every(words => privacy.gm2.note.includes(words)), J(privacy));

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
        const executed = game.i18n.format("DRPG.Vote.wasExecuted", { name: foundry.utils.escapeHTML(botan.name) });
        const record = (await import("${repoUrl}/scripts/vote.mjs")).trialProgress();
        return { heard, done, executed, dead: game.drpg.isDeadForGm(botan), applied: record.verdictApplied, stage: record.verdict?.stage ?? null };`, { timeout: 60000 });
    verdict("held: gm2 hears p2's forged death before the verdict reads it", held && wrong.heard, J({ held, wrong }));
    verdict("the verdict waits for the audit, which puts the forged flag back, and executes Botan; its record reads \"done\" (C5)",
        wrong.applied === true && wrong.dead === true && wrong.stage === "done" && Array.isArray(wrong.done) && wrong.done.includes(wrong.executed), J(wrong));
    await settle(800);
    const verdictCards = [], namesChie = [];
    for (const c of [p1, p2, p3, p4]) {
        const read = await c.eval(`const words = [${text("DRPG.Vote.verdictCardTitle")}, ${text("DRPG.Vote.verdictWrong")},
                game.i18n.format("DRPG.Vote.wasExecuted", { name: foundry.utils.escapeHTML(game.actors.get("${IDS.botan}")?.name ?? "-") })];
            const fresh = game.messages.filter(m => !globalThis.__s63m.has(m.id));
            return { cards: fresh.filter(m => !m.whisper?.length && words.every(w => String(m.content ?? "").includes(w))).length,
                chie: fresh.filter(m => { const s = String(m.content ?? "") + J(m.flags ?? {}); return s.includes("${IDS.chie}") || s.includes("Chie"); }).length };
            function J(v) { return JSON.stringify(v); }`);
        verdictCards.push(read.cards);
        if (c !== p3) namesChie.push(read.chie);
    }
    verdict("every player holds the verdict's one public card: Botan executed, and the class got it wrong (C5)",
        J(verdictCards) === J([1, 1, 1, 1]), J(verdictCards));
    verdict("nothing new on p1, p2 or p4 names Chie, the Blackened the wrong verdict spared", J(namesChie) === J([0, 0, 0]), J(namesChie));

    /* ------------------------------ H. a second trial in the chapter ------------------------------ */

    begin("H", "End the trial, Start it again: asked first, Enter keeps the verdict, yes opens a new trial");
    /* E10 C11 (S06-33; D17): the confirmation is drawn on gm2 (`__dialogWindows`) and answered as Enter answers it - its
       first submit button - then, on a second Start, by its yes. A start window that asked nothing more leaves the queued
       "ok" unanswered; it is taken back so that I is not answered by it. */
    const again = await gm2.eval(`${until} ${V} const UI = await import("${repoUrl}/scripts/trial-floor-ui.mjs");
        const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const askTitle = ${text("DRPG.Floor.newTrialTitle")};
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === askTitle);
        const before = V.trialProgress();
        globalThis.__dialogAnswers.push(true);
        const ended = await UI.endClassTrial();
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const start = async press => {
            const from = globalThis.__dialogLog.length, queued = globalThis.__dialogAnswers.length;
            globalThis.__dialogAnswers.push("ok");
            const pending = UI.startClassTrial();
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const first = el?.querySelector('button[type="submit"]');
            const read = el ? { first: first?.dataset?.action ?? null, said: el.textContent.includes(${text("DRPG.Floor.newTrialConfirm")}),
                defaults: [...el.querySelectorAll("footer button[data-action]")]
                    .filter(b => b.classList.contains("default") || b.hasAttribute("autofocus")).map(b => b.dataset.action) } : null;
            if (press === "enter") el?.querySelector("form")?.requestSubmit(first);
            else el?.querySelector('footer button[data-action="ok"]')?.click();
            const started = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 5000))]);
            if (globalThis.__dialogAnswers.length > queued) globalThis.__dialogAnswers.splice(queued);
            const now = V.trialProgress();
            return { read, started, phase: getClock().phase, asked: globalThis.__dialogLog.slice(from).map(d => d.kind + ":" + d.title),
                verdictApplied: now.verdictApplied, keysCharged: now.keysCharged };
        };
        let enter = null, yes = null;
        try { enter = await start("enter"); yes = await start("ok"); } finally { globalThis.__dialogWindows = was; }
        const after = V.trialProgress();
        return { ended, enter, yes, startTitle: ${text("DRPG.Floor.startTrial")}, askTitle, before: [before.verdictApplied, before.keysCharged],
            round: before.vote?.round ?? null, cleared: { vote: after.vote ?? null, voteClosed: after.voteClosed, tied: after.tied,
                accused: after.accused ?? null, accusedIds: after.accusedIds ?? null, total: after.total ?? null } };`, { timeout: 60000 });
    verdict("the second Start asks first: the confirmation's first submit button, which Enter presses, is Cancel, the only default; Enter keeps Daily Life and the verdict (C11)",
        again.ended === true && J(again.enter?.asked) === J([`wait:${again.startTitle}`, `wait:${again.askTitle}`])
            && again.enter.read?.first === "cancel" && J(again.enter.read.defaults) === J(["cancel"]) && again.enter.read.said === true
            && again.enter.started === null && again.enter.phase === "dailyLife" && again.enter.verdictApplied === true, J(again));
    verdict("its yes opens the second trial, which clears `verdictApplied` and keeps `keysCharged` (C11)",
        again.yes?.started === true && again.yes.phase === "classTrial" && again.before[0] === true && again.yes.verdictApplied === false
            && again.yes.keysCharged === again.before[1], J(again));
    const fresh = again.cleared;
    verdict("the second trial clears the vote, its count and the tie, and carries the round number on (C1, D17)",
        again.round === 1 && fresh.vote?.open === false && fresh.vote.round === 1 && J(fresh.vote.issued) === J([]) && fresh.voteClosed === false
            && fresh.tied === false && J(fresh.accused) === J([]) && J(fresh.accusedIds) === J([]) && fresh.total === 0, J(again));

    /* ------------------------------ J. the debate's clock on a machine a minute fast ------------------------------ */

    /* Before I, not after it: once a verdict has been told, the Event card shows the verdict rather than the floor
       (events.mjs `afterVerdictCard`), and H's second trial has just blanked the first one's. p4 stays on the fast
       machine through I. */
    begin("J", "a debate on gm2, read on p4 whose machine runs a minute fast");
    const p4Fast = await (async () => { await disconnect("p4"); return storageOf("p4"); })();
    await connect("p4", { storage: p4Fast, announceFirst: true, clockSkewMs: 60000 });
    const debate = await gm2.eval(`const F = await import("${repoUrl}/scripts/trial-floor.mjs");
        const { getClock } = await import("${repoUrl}/scripts/settings.mjs");
        const phase = getClock().phase;
        return { phase, opened: Boolean(await F.startFloor({ seconds: 300 })) };`, { timeout: 30000 });
    /* The module's count and the Event card's clock, read on p4 first and on gm2 straight after: the two reads are one
       eval apart, so a second between them is the reading's, not the clock's. */
    const clockOn = client => client.eval(`${until} const F = await import("${repoUrl}/scripts/trial-floor.mjs");
        const face = () => document.querySelector("#drpg-events .drpg-event-clock")?.textContent || null;
        await until(() => F.trialFloor() && face() ? true : null, 8000);
        const m = /^(\\+?)(\\d+):(\\d{2})$/.exec(face() ?? "");
        return { left: F.secondsLeft(), face: face(), faceLeft: m ? (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : null,
            skew: Date.now() - game.time.serverTime };`, { timeout: 20000 });
    const onP4 = await clockOn(p4);
    const onGm = await clockOn(gm2);
    verdict("p4's machine runs a minute fast, and its debate has the seconds left gm2's has, within one (C13; the minute apart before it)",
        debate.opened && onP4.skew >= 59000 && Math.abs(onGm.skew) < 1000 && onGm.left > 290 && Math.abs(onP4.left - onGm.left) <= 1,
        J({ debate, onP4, onGm }));
    verdict("p4's Event card shows the debate's clock gm2's shows, within two seconds (C13; it ticks once a second)",
        onP4.faceLeft !== null && onGm.faceLeft !== null && onGm.faceLeft > 290 && Math.abs(onP4.faceLeft - onGm.faceLeft) <= 2,
        J({ onP4, onGm }));
    await gm2.eval(`await (await import("${repoUrl}/scripts/trial-floor.mjs")).endFloor(); return true;`);

    /* ------------------------------ I. a correct verdict and its Level Ups ------------------------------ */

    begin("I", "a vote for Chie, a correct verdict, and a Level Up picked through the bridge");
    for (const c of [p1, p2, p3, p4]) await c.eval(`globalThis.__s63ballots = 0; ${ballot(IDS.chie)}`);
    const second = await gm2.eval(`${until} ${V} const issued = await game.drpg.openVote();
        await until(() => V.votesIn() === issued ? true : null, 10000);
        const counted = V.votesIn();
        const r = await V.closeVote();
        // The class's window (C7) answered through its own "All: the players pick"; a picker, if one opens, cancelled.
        let queues = 0, pickers = 0, rows = [];
        globalThis.__dialogAnswers.push(async function advance(cfg) {
            const classes = cfg.classes ?? [];
            globalThis.__dialogAnswers.unshift(advance);
            if (classes.includes("drpg-advance")) { pickers++; return "cancel"; }
            if (!classes.includes("drpg-advance-queue")) return null;
            queues++;
            const el = document.createElement("div");
            el.innerHTML = String(cfg.content ?? "");
            rows = [...el.querySelectorAll("[data-actor-id]")].map(row => row.dataset.actorId).sort();
            const all = (cfg.buttons ?? []).find(b => b.action === "allPlayers");
            return all ? all.callback(new window.Event("click"), all, { element: el }) : null;
        });
        let done = null;
        try {
            done = await game.drpg.applyVerdict({ correct: true, executedIds: ["${IDS.chie}"], blackenedIds: ["${IDS.chie}"] });
        } finally {
            const q = globalThis.__dialogAnswers, at = q.findIndex(f => f?.name === "advance");
            if (at >= 0) q.splice(at, 1);
        }
        const living = (await import("${repoUrl}/scripts/chapter.mjs")).livingStudents().map(a => a.id).sort();
        const S = await import("${repoUrl}/scripts/gm-stores.mjs"), L = await import("${repoUrl}/scripts/level-up.mjs");
        const { ownerIdsOf } = await import("${repoUrl}/scripts/utils.mjs");
        const offers = living.map(id => [L.offerList(S.offerStore.get(id)).length, ownerIdsOf(game.actors.get(id)).length > 0 ? 1 : 0]);
        return { issued, counted, accused: r?.accusedIds ?? null, queues, pickers, rows, living, offers, done };`, { timeout: 90000 });
    // Every ballot answer not taken - B's too, where no ballot came - so none of them closes I's Level Up window.
    for (const c of [p1, p2, p3, p4]) await c.eval(`const q = globalThis.__dialogAnswers;
        for (let at = q.findIndex(f => f?.name === "ballot"); at >= 0; at = q.findIndex(f => f?.name === "ballot")) q.splice(at, 1);
        return true;`);
    verdict("the second vote names Chie, and the correct verdict opens one Level Up window for the class; the players pick, and each survivor a player owns holds one offer (C7)",
        second.issued === second.counted && J(second.accused) === J([IDS.chie]) && second.living.length > 1
            && second.queues === 1 && second.pickers === 0 && J(second.rows) === J(second.living)
            && second.offers.every(([held, owned]) => held === owned) && second.living.includes(IDS.aiko), J(second));
    const picked = await p1.eval(`${until} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        const lit = Boolean(await until(() => L.pendingAdvance(aiko), 8000));
        const before = aiko.getFlag("${MOD}", "advances") ?? 0;
        let updates = 0;
        const hook = Hooks.on("updateActor", a => { if (a.id === aiko.id) updates++; });
        let shown = null;
        globalThis.__dialogAnswers.push(async function advance(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-advance")) { globalThis.__dialogAnswers.unshift(advance); return null; }
            const form = document.createElement("div");
            form.innerHTML = String(cfg.content ?? "");
            shown = { classes: [...cfg.classes].sort(), legends: form.querySelectorAll("legend").length, forLine: Boolean(form.querySelector(".drpg-advance-for")),
                intro: form.querySelector("form > p")?.textContent ?? "", reason: game.i18n.localize("DRPG.Advance.reason.standard") };
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
        return { lit, sent, before, after: aiko.getFlag("${MOD}", "advances") ?? 0, updates, still: Boolean(L.pendingAdvance(aiko)), shown };`, { timeout: 60000 });
    verdict("p1's sheet sees Aiko's offer from the class's window, and p1's pick through the bridge raises Aiko's advances by one in one write (C7; C6-C8 read it again)",
        picked.lit && picked.sent?.pending === true && picked.after === picked.before + 1
            && picked.updates === 1 && !picked.still, J({ picked }));

    /* E10 C6 (S03-17): two offers stand side by side - the second overwrote the first before - p1 spends the
       older and the other stays lit; gm2's own Level Up menu holds a row taking it back, and once taken p1's copy
       is empty and a lit button its sheet drew before goes out. The button is drawn as Daggerheart's sheet hands
       its header to the module (`renderCharacterSheet`), lit first as an earlier render left it. */
    const litButton = `const root = document.createElement("div");
        root.innerHTML = '<div class="character-header-sheet"><div class="name-row"><button type="button" class="drpg-advance-button is-offered" data-drpg-advance=""></button></div></div>';
        Hooks.callAll("renderCharacterSheet", { document: aiko, isEditable: true }, root, {}, { isFirstRender: false });
        const button = root.querySelector("[data-drpg-advance]");`;
    // The offers as this browser holds them - the GMs' store on gm2, the owner's copy on p1 - read off the row, as a
    // 1.2.70 row of one offer (`{ kind }`) or a list: the same reading before C6 and after it.
    const offersHeld = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const heldOn = a => { const row = game.user.isGM ? S.offerStore.get(a.id) : S.offerCopy.read()[a.id]; return row?.offers ?? (row?.kind ? [row] : []); };`;
    const twice = await gm2.eval(`${until} ${offersHeld} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        for (const kind of ["standard", "standard"]) await L.offerAdvancement(aiko, kind);
        return heldOn(aiko).map(offer => offer.id ?? null);`, { timeout: 30000 });
    const spentOne = await p1.eval(`${until} ${offersHeld} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        const both = (await until(() => heldOn(aiko).length === 2 ? true : null, 8000)) ? 2 : heldOn(aiko).length;
        const before = aiko.getFlag("${MOD}", "advances") ?? 0;
        globalThis.__dialogAnswers.push(async function advance(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-advance")) { globalThis.__dialogAnswers.unshift(advance); return null; }
            return [{ option: "hp" }];
        });
        const sent = await L.openAdvancement(aiko, "standard");
        await until(() => heldOn(aiko).length < both ? true : null, 10000);
        ${litButton}
        return { held: both, sent: sent?.pending ?? null, rise: (aiko.getFlag("${MOD}", "advances") ?? 0) - before,
            left: heldOn(aiko).map(offer => offer.id ?? null), lit: Boolean(button) };`, { timeout: 60000 });
    verdict("gm2 offers Aiko two Level Ups and p1's copy holds both; p1 spends the older and the other stays lit (C6)",
        twice.length === 2 && spentOne.held === 2 && spentOne.sent === true && spentOne.rise === 1
            && J(spentOne.left) === J([twice[1]]) && spentOne.lit, J({ twice, spentOne }));
    const takenBack = await gm2.eval(`${until} ${offersHeld} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        await until(() => heldOn(aiko).length === 1 ? true : null, 8000);
        let rows = null;
        globalThis.__dialogAnswers.push(cfg => {
            const markup = typeof cfg.content === "string" ? cfg.content : (cfg.content?.outerHTML ?? "");
            rows = [...markup.matchAll(/name="variant" value="([^"]*)"/g)].map(m => m[1]);
            const take = rows.find(value => value.startsWith("take:"));
            return take ? { value: take } : null;
        });
        const taken = await L.openAdvancementFor(aiko);
        return { rows, taken, left: heldOn(aiko).length };`, { timeout: 30000 });
    const outOnP1 = await p1.eval(`${until} ${offersHeld} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        await until(() => heldOn(aiko).length === 0 ? true : null, 8000);
        ${litButton}
        return { left: heldOn(aiko).length, lit: Boolean(button) };`, { timeout: 30000 });
    verdict("gm2's Level Up menu has a row taking the standing offer back; taken, gm2 holds none, p1's copy is empty and its lit button goes out (C6)",
        J(takenBack.rows) === J(["standard", "reinforced", `take:${twice[1]}`]) && takenBack.taken === true && takenBack.left === 0
            && outOnP1.left === 0 && outOnP1.lit === false, J({ takenBack, outOnP1 }));

    /* E10 C8 (S03-22): a pick the sheet cannot take, from p1's browser through the bridge - an experience Aiko does
       not have - is refused by gm2 and told on p1, and the offer stands, lit; it was applied before (a value written
       under an experience nobody named, the advances raised, the offer spent). The request answers that it was sent
       ({ ok, pending }); the refusal comes back as `bridge.refused`, told. gm2 takes the offer back after. */
    const NOBODY = "E10C8NOSUCHEXP01";
    const offeredAgain = await gm2.eval(`${offersHeld} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        await L.offerAdvancement(aiko, "standard");
        return heldOn(aiko).map(offer => offer.id ?? null);`, { timeout: 30000 });
    const refusedOnP1 = await p1.eval(`${until} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        const lit = Boolean(await until(() => L.pendingAdvance(aiko), 8000));
        const before = aiko.getFlag("${MOD}", "advances") ?? 0, n = globalThis.__notifications.length;
        const res = await B.requestAdvancement({ actorId: aiko.id, picks: [{ option: "experienceUp", experience: "${NOBODY}" }], kind: "standard" });
        await new Promise(r => setTimeout(r, 1000));
        const why = game.i18n.localize("DRPG.Bridge.why.missing");
        return { lit, res: res ?? null, told: globalThis.__notifications.slice(n).some(note => String(note.msg).includes(why)),
            still: Boolean(L.pendingAdvance(aiko)), rise: (aiko.getFlag("${MOD}", "advances") ?? 0) - before,
            junk: aiko._source.system?.experiences?.["${NOBODY}"] !== undefined };`, { timeout: 30000 });
    const backAgain = await gm2.eval(`${offersHeld} const L = await import("${repoUrl}/scripts/level-up.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        for (const offer of heldOn(aiko)) await L.takeBackOffer(aiko, offer.id);
        return heldOn(aiko).length;`, { timeout: 30000 });
    verdict("p1's pick of an experience Aiko does not have is refused by gm2 and told on p1; the offer stands, lit, and nothing is written (C8)",
        offeredAgain.length === 1 && refusedOnP1.lit && refusedOnP1.res?.ok === true && refusedOnP1.told && refusedOnP1.still
            && refusedOnP1.rise === 0 && refusedOnP1.junk === false && backAgain === 0, J({ offeredAgain, refusedOnP1, backAgain }));
    /* E10 C9 (S01-16, S03-19): the player's own picker is a module panel too - it carried `drpg-advance` alone - draws no
       "Choice 1" over its one pick and no "For ..." line (that is the GM's), and says the reason in its intro. */
    verdict("p1's own Level Up picker is a module panel: one pick with no Choice legend, the reason in its intro and no line for whom (C9)",
        J(picked.shown?.classes) === J(["drpg-advance", "drpg-panel"]) && picked.shown?.legends === 0 && picked.shown?.forLine === false
            && picked.shown?.reason?.length > 0 && picked.shown.intro.includes(picked.shown.reason), J({ shown: picked.shown }));
    /* E10 C14 (S13-26): the privacy note's "until the next vote is opened", against the store - the second vote's open
       dropped every row of the first (round 1), and its own rows are the ones gm2 keeps now. */
    const nextVote = await gm2.eval(`const { ballotStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { rounds: [...new Set(Object.values(ballotStore.entries() ?? {}).map(row => row?.round ?? null))].sort(),
            note: ${text("DRPG.Vote.privacyNote")} };`);
    verdict("the next vote's open dropped the first vote's rows from gm2's copy - it keeps round 2's alone - as the privacy note says (C14)",
        J(nextVote.rounds) === J([2]) && nextVote.note.includes("until the next vote is opened"), J(nextVote));

    /* ------------------------------ every client clean, every phase measured ------------------------------ */

    const errors = {};
    for (const [who, c] of Object.entries({ gm2, p1, p2, p3, p4 })) errors[who] = await c.eval(`return globalThis.__errors.slice(0, 3).map(e => String(e?.message ?? e).slice(0, 200));`);
    check("no uncaught error on gm2 or any player", Object.values(errors).every(list => list.length === 0), J(errors));
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]) {
        check(`${letter}0: phase ${letter} measured something`, (counts[letter] ?? 0) > 0, J(counts));
    }

    /* ------------------------------ U. a verdict on a death nobody has found ------------------------------ */

    /* E10 fix r1-G4 (1.2.71; round 1's cor F1 = sec F2; the owner's Q-E10-2 (a), 10.10.2026), run after the phases
       above are counted, so their checks stay as they were. gm2 kills Aiko where nobody finds the body (`secret: true`),
       records a count that accused her and draws the verdict's window: it opens on Aiko, who is not listed " - dead",
       and tells gm2 alone whose death that is; its wrong verdict is pressed. p1, Aiko's player, then holds the card
       naming her executed and reads her dead, and gm2 holds no row of her death: the card and every sheet agree. Before
       it the window opened on "Nobody is executed", that verdict's card said so, and p1 read Aiko alive. */
    begin("U", "a wrong verdict on an accused whose body nobody has found");
    const errorsBefore = [await gm2.eval(`return globalThis.__errors.length;`), await p1.eval(`return globalThis.__errors.length;`)];
    await mark(p1);
    const unseen = await gm2.eval(`${until} ${V} const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { deathStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        const kept = Boolean(await C.killCharacter(aiko, { secret: true, keepBullets: true }));
        await V.setTrialProgress({ verdictApplied: false, verdict: null, voteClosed: true, accused: [{ id: aiko.id, n: 2 }],
            accusedIds: [aiko.id], total: 3, majority: 2, noMajority: false, tied: false });
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const title = ${text("DRPG.Vote.verdictTitle")};
        const unfound = game.i18n.format("DRPG.Vote.unfoundDead", { names: aiko.name });
        const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.window?.title === title);
        const pending = game.drpg.verdictDialog();
        let read = null, result = "hung";
        try {
            const el = (await until(() => drawn()?.element, 8000)) ?? null;
            const select = el?.querySelector('select[name="executed"]');
            const option = [...(select?.options ?? [])].find(o => o.value === aiko.id);
            read = el ? { value: select?.value ?? null, disabled: option?.disabled ?? null, words: option?.textContent ?? null,
                told: el.textContent.includes(unfound) } : null;
            el?.querySelector('footer button[data-action="wrong"]')?.click();
            result = await Promise.race([pending, new Promise(r => setTimeout(() => r("hung"), 30000))]);
        } finally {
            globalThis.__dialogWindows = was;
        }
        return { kept, read, name: aiko.name, hung: result === "hung", stage: V.trialProgress().verdict?.stage ?? null,
            row: deathStore.has(aiko.id) };`, { timeout: 60000 });
    verdict("the verdict's window opens on Aiko, whose body nobody has found, offers her as a living student and tells gm2 whose death that is (fix r1-G4)",
        unseen.kept && unseen.read?.value === IDS.aiko && unseen.read?.disabled === false && unseen.read?.words === unseen.name
            && unseen.read?.told === true, J(unseen));
    await settle(800);
    const onP1 = await p1.eval(`${until} const aiko = game.actors.get("${IDS.aiko}");
        const dead = Boolean(await until(() => game.drpg.isDeceased(aiko), 5000));
        const fresh = game.messages.filter(m => !globalThis.__s63m.has(m.id) && !m.whisper?.length);
        const card = fresh.filter(m => String(m.content ?? "").includes(${text("DRPG.Vote.verdictCardTitle")}));
        const executed = game.i18n.format("DRPG.Vote.wasExecuted", { name: foundry.utils.escapeHTML(aiko.name) });
        return { dead, cards: card.length, executed: card.some(m => String(m.content).includes(executed)),
            nobody: card.some(m => String(m.content).includes(${text("DRPG.Vote.nobodyExecuted")})) };`, { timeout: 20000 });
    const errorsAfter = [await gm2.eval(`return globalThis.__errors.length;`), await p1.eval(`return globalThis.__errors.length;`)];
    verdict("its wrong verdict executes Aiko: p1 holds the one card naming her executed and reads her dead, and gm2 holds no row of her death (fix r1-G4)",
        !unseen.hung && unseen.stage === "done" && unseen.row === false && onP1.dead && onP1.cards === 1 && onP1.executed && !onP1.nobody
            && J(errorsAfter) === J(errorsBefore), J({ unseen, onP1, errorsBefore, errorsAfter }));

    /* ------------------------------ V. the round a GM noted at load ------------------------------ */

    /* E10 fix r2-G4 (1.2.71; the round-2 correctness review's m7), run after U. A GM that is not the primary
       flags its copy of the ballots "none" only for the vote that was already open when it loaded (vote.mjs
       `openAtLoad`, noted in `registerVote`; fix r1-G3): it cannot tell whether that vote's ballots are on another
       GM's browser, on none, or not cast. The suite runs on one GM, the primary, and never reached it. gm3 joins,
       gm2 opens a vote with every player's ballot dismissed (their queued answers emptied), and gm3, there at the
       open, reads null; gm3 then loads again into that open vote and reads "none". Each read waits for the GM
       stores' hydration and states the ballots gm2 counts, so a ballot in is not read as the mark. */
    begin("V", "a GM there at the vote's open and one loaded into it read their copy of the ballots apart");
    await connect("gm3");
    await settle(1000);
    const copyOn = async () => ({ ...(await gm3.eval(`${until} ${V} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const { isPrimaryGm } = await import("${repoUrl}/scripts/utils.mjs");
        await until(() => E.gmStoresHydrated(), 10000);
        return { copy: V.ballotCopyStatus(), open: V.trialProgress().vote?.open ?? null, primary: isPrimaryGm() };`, { timeout: 30000 })),
    votesIn: await gm2.eval(`${V} return V.votesIn();`) });
    const beforeOpen = await copyOn();
    for (const c of [p1, p2, p3, p4]) await c.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
    const reopened = await gm2.eval(`return await game.drpg.openVote();`, { timeout: 60000 });
    await settle(1000);
    const atOpen = await copyOn();
    verdict("gm3, a GM that is not the primary, there when gm2 opens a vote and holding no ballot of it, reads its copy as not flagged (fix r2-G4)",
        beforeOpen.open !== true && beforeOpen.primary === false && reopened > 0 && atOpen.open === true && atOpen.votesIn === 0
            && atOpen.copy === null, J({ beforeOpen, reopened, atOpen }));
    await disconnect("gm3");
    await connect("gm3");
    await settle(1000);
    const loaded = await copyOn();
    const gm3Errors = await gm3.eval(`return globalThis.__errors.slice(0, 3).map(e => String(e?.message ?? e).slice(0, 200));`);
    verdict("gm3 loaded again while that vote is open, with no ballot in, reads \"none\": it cannot tell where the ballots are (fix r2-G4)",
        loaded.open === true && loaded.primary === false && loaded.votesIn === 0 && loaded.copy === "none" && gm3Errors.length === 0,
        J({ loaded, gm3Errors }));
    await disconnect("gm3");
    await disconnect("p4");
    await disconnect("gm2");
    return { phases: Object.keys(counts) };
}
