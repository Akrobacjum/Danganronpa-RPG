/**
 * 98-chaos: browsers that reload or drop in the middle of things (E38, 13.11.2026; plan docs/dev/plans/E38.md on
 * the planner's branch, its 3.2; the harness README's planned row 85, numbered 98 here).
 *
 * The seed's GM and three players, no second GM: every reload here is the only GM's, the case a table of one GM
 * meets. Each is a real `reload(who)` (cluster.mjs, E38 C1): a new process for the same user with the localStorage
 * its browser closed with, where until E38 a scenario emptied a client's memory by hand. Every check reads something
 * the run made happen first, and says so in its own condition.
 *
 * Phases, in the order they run:
 *   A  a GM's card across the GM's reload: p1 asks the GM (call-gm.mjs `callGm`), the GM reloads before ruling, and
 *      once back it claims the card and settles it, once, and p1's copy reads the ruling (A1-A2).
 *   B  a player offline at a private card: p2's browser is closed, the GM posts a private card to p2 and itself and
 *      one to p2 alone (secret.mjs `postSecret`); p2, back with its storage, reads both cards' words, which the author
 *      GM gives back (B1, B2; the second by `authorHold`, E38), while the GM itself reads the second as a dash.
 *   C  the GM's reload mid-incident: an incident opened with Chie (p3) the killer and Aiko (p1) the victim, the opening
 *      forced to succeed; the GM reloads; the GM, the killer's browser and the victim's read the same incident after,
 *      and the bystander p2 holds no part of it (C1-C2); then the incident is ended.
 *   D  the GM's reload mid-vote: a Class Trial opened, the ballots sent, p1 casts, the GM reloads, p2 casts after: the
 *      GM, back, counts both (D1-D2).
 *
 * Not here (the plan's 85-chaos list; STATUS.md): parallel Eclipses, the pool and Search under a reload, a player
 * with two characters; and every reload of a second GM's (97-two-gms). What this cannot see: a real F5 (no cookie,
 * IndexedDB or cache; v14's order of "inactive", "active" and `ready` is LIVE-E30-05 and LIVE-E04-12) and a real
 * server's delivery times; a reload of the primary during a drawn roll at a table is LIVE-E38-01.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` until `done(value)` or `ms` pass; the last reading either way. */
async function until(read, done, ms = 8000, step = 150) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

export async function run({ gm, p1, p2, p3, check, phase, settle, connect, disconnect, storageOf, reload, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;

    /* ------------------------------------------------------------------ A */
    phase("A a GM's card across the GM's reload");
    const WORDS_A = "E38 chaos card asked before a reload";
    const RULED_A = "E38 chaos ruled after the reload";
    const asked = await p1.eval(`const B = ${imp("gm-bridge.mjs")};
        return await B.callGm(game.actors.get("${IDS.aiko}"), { title: "E38 chaos A", request: ${J(WORDS_A)} });`, { timeout: 60000 });
    const FIND = `const S = ${imp("secret.mjs")};
        const card = () => game.messages.find(m => (S.contentOf(m) ?? "").includes(${J(WORDS_A)})) ?? null;`;
    const before = await until(() => gm.eval(`${FIND} return card()?.id ?? null;`), Boolean);
    const rA = await reload("gm");
    const after = await until(() => gm.eval(`${FIND} return card()?.id ?? null;`), Boolean);
    const ruled = await gm.eval(`${FIND} const B = ${imp("gm-bridge.mjs")}; let ran = 0;
        const out = await B.claimCard(card(), async () => { ran++; await B.settleCall(card(), ${J(RULED_A)}); return { settled: true }; });
        const again = await B.claimCard(card(), async () => { ran++; return { settled: true }; });
        return { out: out ?? null, again: again ?? null, ran };`, { timeout: 60000 });
    check("A1: p1's card is on the GM before its reload and after it, the same message",
        asked === true && Boolean(before) && after === before && rA.back === true, J({ asked, before, after, rA }));
    const p1Reads = await until(() => p1.eval(`${FIND} return (S.contentOf(card()) ?? "").includes(${J(RULED_A)});`), v => v === true);
    check("A2: the GM, back, claims and settles the card once - a second press runs nothing - and p1's copy reads the ruling",
        ruled.out?.settled === true && ruled.again === null && ruled.ran === 1 && p1Reads === true, J({ ruled, p1Reads }));

    /* ------------------------------------------------------------------ B */
    phase("B a player offline at a private card");
    /* The words travel once, to the browsers connected as a card is posted; a reader back later asks the GMs for them
       (secret.mjs `askForWords` at its ready), and a GM answers from its own store (`answerWordsRequest`; the file's
       "WORDS AFTER A RETURN"). So: one card to p2 and the GM, one to p2 alone (as utils.mjs `whisperToOwnerOnly` posts
       a tail's or a door's card), both while p2's browser is closed. Since E38 the author GM keeps the words of a card
       it whispered to players alone (`authorHold`) and gives them to its readers on return, so p2 reads both once back;
       before E38 the card to p2 alone came back a dash (no GM held it). The GM, its author, still reads neither card's
       words (its authorHold entry is hidden from its own reads). */
    const WORDS_B = "E38 chaos private words for p2 and the GM", ALONE_B = "E38 chaos private words for p2 alone";
    await p2.eval(`localStorage.setItem("e38.chaos", "p2"); return true;`);
    await disconnect("p2");
    const posted = await gm.eval(`const S = ${imp("secret.mjs")};
        const both = await S.postSecret({ content: "<p>" + ${J(WORDS_B)} + "</p>", whisper: ["${IDS.p2}", game.user.id] });
        const alone = await S.postSecret({ content: "<p>" + ${J(ALONE_B)} + "</p>", whisper: ["${IDS.p2}"] });
        return { both: both?.id ?? null, alone: alone?.id ?? null };`, { timeout: 60000 });
    await connect("p2", { storage: await storageOf("p2") });
    const WORDS_OF = (id, words) => `const S = ${imp("secret.mjs")}; const m = game.messages.get(${J(id)});
        return { has: Boolean(m), words: m ? (S.secretHtml(m) ?? "").includes(${J(words)}) : false };`;
    const p2Reads = await until(() => p2.eval(WORDS_OF(posted.both, WORDS_B)), v => v?.words === true, 12000);
    const p2Kept = await p2.eval(`return localStorage.getItem("e38.chaos");`);
    const p1Has = await p1.eval(WORDS_OF(posted.both, WORDS_B));
    check("B1: a private card to p2 and the GM, posted while p2's browser was closed, is read by p2 once back (its storage kept), and not by p1",
        Boolean(posted.both) && p2Reads?.has === true && p2Reads.words === true && p2Kept === "p2" && p1Has.words === false, J({ posted, p2Reads, p2Kept, p1Has }));
    const alone = await until(() => p2.eval(WORDS_OF(posted.alone, ALONE_B)), v => v?.words === true, 12000);
    const gmReadsAlone = await gm.eval(WORDS_OF(posted.alone, ALONE_B));
    check("B2: a private card to p2 alone, posted while p2 was away, is read by p2 once back - its author GM kept the words and gave them on return (E38); the author GM itself reads a dash",
        Boolean(posted.alone) && alone?.has === true && alone.words === true && gmReadsAlone.has === true && gmReadsAlone.words === false,
        J({ alone, gmReadsAlone }));

    /* ------------------------------------------------------------------ C */
    phase("C the GM's reload mid-incident");
    /* The opening is forced to succeed, as 89 F forces it (a failed opening closes the murder at once). */
    for (const c of [gm, p3]) await c.eval(`globalThis.__forceRoll = { hope: 11, fear: 2 }; return true;`);
    await gm.eval(`await game.drpg.openMurder({ killerId: "${IDS.chie}", victimId: "${IDS.aiko}", openingTrait: "body" }); return true;`, { timeout: 60000 });
    const STAGE = `const M = ${imp("murder.mjs")}; return M.murderState()?.stage ?? null;`;
    const opened = await until(() => gm.eval(STAGE), v => v === "incident", 30000);
    for (const c of [gm, p3]) await c.eval(`delete globalThis.__forceRoll; return true;`);
    const rC = await reload("gm");
    const stages = {
        gm: await until(() => gm.eval(STAGE), v => v === "incident", 15000),
        killer: await until(() => p3.eval(STAGE), v => v === "incident", 15000),
        victim: await until(() => p1.eval(STAGE), v => v === "incident", 15000)
    };
    const bystander = await p2.eval(`const M = ${imp("murder.mjs")}; const s = M.murderState();
        return { stage: s?.stage ?? null, text: JSON.stringify(s ?? null).includes("${IDS.chie}") };`);
    check("C1: the incident is open on the GM before its reload (the opening forced to succeed)", opened === "incident" && rC.back === true, J({ opened, rC }));
    check("C2: after the GM's reload the GM, the killer's browser and the victim's read the incident still running, and the bystander's holds no killer's id",
        stages.gm === "incident" && stages.killer === "incident" && stages.victim === "incident" && bystander.text === false,
        J({ stages, bystander }));
    await gm.eval(`await game.drpg.endMurder({ reason: "suite", followUp: false }); return true;`, { timeout: 60000 });
    const ended = await until(() => gm.eval(STAGE), v => v === null || v === "closed", 15000);
    await settle(1000);

    /* ------------------------------------------------------------------ D */
    phase("D the GM's reload mid-vote", { flow: "class-trial" });
    /* 63-class-trial's set-up, cut down: a fifth student killed, Chie in the register, the trial opened; its ballot
       answer is 63's (`ballot`). 63 D closes the seeded GM's browser in the vote and brings its storage back on gm2;
       here the one GM reloads. */
    const V = `const V = ${imp("vote.mjs")};`;
    const ballot = (pick, gate = null) => `globalThis.__dialogAnswers.push(async function ballot(cfg) {
            if (!(cfg.classes ?? []).includes("drpg-ballot")) { globalThis.__dialogAnswers.unshift(ballot); return null; }
            ${gate ? `while (!globalThis.${gate}) await new Promise(r => setTimeout(r, 100));` : ""}
            const el = document.createElement("dialog");
            if (typeof cfg.content === "string") el.innerHTML = cfg.content; else el.append(cfg.content.cloneNode(true));
            const radio = el.querySelector('input[name="choice0"][value="${pick}"]');
            if (!radio) return null;
            radio.checked = true;
            const button = (cfg.buttons ?? []).find(b => b.default) ?? cfg.buttons?.[0];
            return button.callback(new window.Event("click"), { form: null }, { element: el });
        });
        return true;`;
    const setup = await gm.eval(`const C = ${imp("chapter.mjs")};
        const { blackenedStore } = ${imp("gm-stores.mjs")};
        const { seasonEpoch, getClock } = ${imp("settings.mjs")};
        const victim = await Actor.create({ name: "S98 Victim", type: "character" });
        await C.killCharacter(victim, { secret: false, keepBullets: true });
        await blackenedStore.patch("${IDS.chie}", { chapter: getClock().chapter, epoch: seasonEpoch(), at: Date.now(), victims: [victim.id] });
        globalThis.__dialogAnswers.push("ok");
        const { startClassTrial } = ${imp("trial-floor-ui.mjs")};
        return { victim: victim.id, started: await startClassTrial(), phase: getClock().phase };`, { timeout: 60000 });
    await settle(800);
    await p1.eval(ballot(IDS.botan));
    await p2.eval(ballot(IDS.botan, "__e38GoP2"));
    await p3.eval(`globalThis.__dialogAnswers.push(null); return true;`);
    const issued = await gm.eval(`${V} return await game.drpg.openVote();`, { timeout: 60000 });
    const firstIn = await until(() => gm.eval(`${V} return V.votesIn();`), n => n === 1);
    await gm.eval(`const E = ${imp("gm-store.mjs")}; await E.gmStoresIdle(); return true;`, { timeout: 30000 });
    const rD = await reload("gm");
    const keptIn = await until(() => gm.eval(`${V} const E = ${imp("gm-store.mjs")}; return E.gmStoresHydrated() ? V.votesIn() : -1;`), n => n === 1, 15000);
    await p2.eval(`globalThis.__e38GoP2 = true; return true;`);
    const bothIn = await until(() => gm.eval(`${V} return V.votesIn();`), n => n === 2, 15000);
    const open = await gm.eval(`${V} return V.trialProgress().vote?.open ?? null;`);
    check("D1: the trial opens, three ballots go out, p1's is counted, and after the GM's reload the GM still counts it, the vote still open",
        setup.started === true && setup.phase === "classTrial" && issued === 3 && firstIn === 1 && rD.back === true && keptIn === 1 && open === true,
        J({ setup, issued, firstIn, rD, keptIn, open }));
    check("D2: p2's ballot, cast after the GM came back, is counted beside p1's: two in", bothIn === 2, J({ bothIn }));

    return { reloads: { card: rA, incident: rC, vote: rD }, ended };
}
