/**
 * The proposal card with two GMs (E68 fix round, 10.11.2026; STAGE E68 "Tests": a new scenario, layer ci, GM, gm2 and
 * two players; DA18, DA41, DA46). The player proposes a statistic from the action's list and may say how; a GM
 * approves it, changes it to another on the list or refuses, on one card in the player's thread (call-gm.mjs
 * `askTraitByCard`, messenger-app.mjs `rulePickTrait`), claimed on the primary (`claimCard`) whichever GM presses.
 * Every ask here is a real player's: p1's browser calls trait-ruling.mjs `traitFor`, which goes through the bridge
 * (`trait.ruling`) to the primary, who posts the card; the cards are pressed through their own wiring
 * (`wireCallActions`) on gm or gm2, and the harness's own auto-press (`__traitRulingAuto`) is off on both. p2 is the
 * bystander whose browser must hold nothing of a card. gm2's id sorts after gm's, so gm stays the primary.
 *
 *     A  the card: p1 proposes Head for a Search (six listed) with a few words: one card in p1's thread, veiled, its
 *        buttons "Approve: Head" first and a "Change to" for each of the other five, then Refuse; the words on it
 *        where the GMs read it; p2 sent none of it. gm approves: p1's `traitFor` answers Head, "approved", and the
 *        card keeps the ruling (trait, proposal, how).
 *     B  Change to: gm2 presses "Change to: Hand"; p1's window "The GM changed the statistic" opens and p1 rolls it:
 *        Hand, "changed"; the ruling says "changed".
 *     C  withdraw: gm presses "Change to: Leg"; p1 passes in that window: `traitFor` answers nothing, its `onPass` is
 *        told (the line it leaves in p1's thread is not read here)
 *     D  Refuse, pressed on gm2: nothing answered, the card settled with no ruling, p1 told the GM turned it down.
 *     E  two GMs on one card: gm presses Approve and gm2 "Change to: Body" in the same moment: one answer reaches
 *        p1 and one ruling is kept; whichever lost is told the card was answered.
 *     F  the incident: Chie opens a Direct Murder on Aiko (p1's); Aiko's Leave a Clue from the tile proposes Hand,
 *        gm presses "Change to: Leg", p1 passes - and the crisis menu opens again on p1 (E68 C4, QUESTIONS Q11; the
 *        road the CI fix of 1a0ae5c7 left undriven); the card is veiled: p2 is sent none of its words and its
 *        document names nobody on p2's browser.
 *     G  GM offline: both GMs stood in as gone on p1's page (as client-entry.mjs marks a user who left): p1's ask
 *        posts no card, answers nothing and says no GM is connected.
 *     H  the setting on (`autoApproveTraits`, Daily Life, no incident): p1's proposal is approved with nobody's
 *        press, the card says "Approved automatically." and its ruling carries `auto`; the setting put back.
 */
export const layers = ["ci"];
export const timeoutMs = 300000;
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff" }
];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const WORDS = "S89 through the loose floorboard";

export async function run({ gm, gm2, p1, p2, p3, check, note, phase, settle, repoUrl }) {
    const UNTIL = `const until = async (test, ms = 8000) => { const end = Date.now() + ms; while (!(await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    for (const c of [gm, gm2]) await c.eval(`globalThis.__traitRulingAuto = false; globalThis.__dialogAuto = false; return true;`);
    for (const c of [p1, p2]) await c.eval(`globalThis.__dialogAuto = false; globalThis.__s89Words = [];
        game.socket.on("module.${MOD}", p => { if (p?.action === "secret.card") globalThis.__s89Words.push(String(p.html ?? "")); });
        return true;`);
    const ids = await gm.eval(`return { chie: game.actors.getName("Chie Mori").id, aiko: game.actors.getName("Aiko Hoshino").id };`);

    /* p1 asks: `traitFor` started and kept on the page, its answer read later (`ANSWER`). `windowAnswer` is what p1
       presses in the window a "Change to" opens ("roll" or "pass"), queued before the ask. */
    const ASK = (proposed, windowAnswer = null) => `${UNTIL}
        const T = await import("${repoUrl}/scripts/trait-ruling.mjs");
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__s89 = { done: false, value: undefined, passed: 0, log: globalThis.__dialogLog.length };
        ${windowAnswer ? `globalThis.__dialogAnswers.push(cfg => cfg?.window?.title === game.i18n.localize("DRPG.TraitRuling.changedTitle") ? ${J(windowAnswer)} : null);` : ""}
        T.traitFor(actor, { kind: "action", key: "search" }, { proposed: ${J(proposed)}, note: ${J(WORDS)}, onPass: () => { globalThis.__s89.passed++; } })
            .then(v => { globalThis.__s89.value = v; globalThis.__s89.done = true; }, e => { globalThis.__s89.value = String(e); globalThis.__s89.done = true; });
        return true;`;
    const ANSWER = `${UNTIL} await until(() => globalThis.__s89?.done, 12000); globalThis.__dialogAnswers.length = 0;
        return { done: globalThis.__s89.done, value: globalThis.__s89.value ?? null, passed: globalThis.__s89.passed,
            windows: globalThis.__dialogLog.slice(globalThis.__s89.log).map(d => d.title) };`;
    /* The newest open proposal card in p1's thread, on a GM: its buttons, its words, its veil; `press` clicks one
       ("refuse" or a trait) through the card's own wiring. */
    const CARD = (press = null, since = 0) => `${UNTIL}
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const MA = await import("${repoUrl}/scripts/messenger-app.mjs");
        const open = () => game.messages.contents.filter(m => !S.cardFlag(m, "settled") && String(S.contentOf(m) ?? "").includes('data-drpg-call="refuseTrait"'));
        await until(async () => open().length > 0 && String(await S.wordsOf(open().at(-1)) ?? "").includes("pickTrait"));
        const card = open().at(-1);
        if (!card) return { card: null };
        const html = String(await S.wordsOf(card) ?? "");
        const body = document.createElement("div");
        body.innerHTML = html;
        MA.wireCallActions(body, card);
        const buttons = [...body.querySelectorAll('[data-drpg-call="pickTrait"], [data-drpg-call="refuseTrait"]')].map(b => [b.dataset.trait ?? "refuse", b.textContent.trim()]);
        globalThis.__s89Body = body;
        const out = { card: card.id, buttons, words: html.includes(${J(WORDS)}), veiled: card.toObject().flags?.["${MOD}"]?.veiled === true };
        ${press ? `const target = ${J(press)} === "refuse" ? body.querySelector('[data-drpg-call="refuseTrait"]') : body.querySelector('[data-drpg-call="pickTrait"][data-trait=${J(press)}]');
        target?.click(); out.pressed = Boolean(target);` : ""}
        return out;`;
    const RULING = id => `${UNTIL} const S = await import("${repoUrl}/scripts/secret.mjs");
        await until(() => Boolean(S.cardFlag(game.messages.get(${J(id)}), "settled")), 8000);
        const r = S.cardFlag(game.messages.get(${J(id)}), "ruling");
        return { settled: Boolean(S.cardFlag(game.messages.get(${J(id)}), "settled")), ruling: r ? [r.trait ?? null, r.proposed ?? null, r.how ?? null, r.auto === true] : null,
            auto: String(S.contentOf(game.messages.get(${J(id)})) ?? "").includes(game.i18n.localize("DRPG.TraitRuling.autoApproved")) };`;
    const SEEN = `return globalThis.__s89Words.filter(h => h.includes(${J(WORDS)}) || h.includes("pickTrait")).length;`;
    const T = `const t = k => game.i18n.localize("DRPG.TraitRuling." + k);`;

    phase("A: the card, and Approve on gm", { flow: "trait-ruling" });
    await p1.eval(ASK("head"));
    const a = await gm.eval(CARD());
    const labels = await gm.eval(`${T} return [game.i18n.format("DRPG.TraitRuling.approve", { stat: "Head" }), t("refuse")];`);
    check("A: p1's proposal of Head for a Search makes one veiled card in its thread: Approve: Head first, a Change to for each other statistic, Refuse; p1's words on it",
        Boolean(a.card) && a.veiled && a.words && a.buttons.length === 7 && a.buttons[0][0] === "head" && a.buttons[0][1].startsWith(labels[0])
        && J(a.buttons.slice(1, 6).map(b => b[0]).sort()) === J(["body", "eye", "hand", "leg", "shadow"]) && a.buttons[6][0] === "refuse" && a.buttons[6][1].startsWith(labels[1]), J(a));
    await gm.eval(CARD("head"));
    const aAnswer = await p1.eval(ANSWER);
    const aRuling = await gm.eval(RULING(a.card));
    check("A: gm's Approve answers p1 with Head, approved, and the card keeps the ruling [Head, proposed Head, approved]",
        J(aAnswer.value) === J({ trait: "head", byGm: "approved" }) && J(aRuling.ruling) === J(["head", "head", "approved", false]), J({ aAnswer, aRuling }));
    check("A: the bystander p2 is sent none of the card's words", (await p2.eval(SEEN)) === 0, "p2 words");

    phase("B: Change to on gm2, rolled", { flow: "trait-ruling" });
    await p1.eval(ASK("head", "roll"));
    const b = await gm2.eval(CARD("hand"));
    const bAnswer = await p1.eval(ANSWER);
    const bRuling = await gm.eval(RULING(b.card));
    const changed = await p1.eval(`${T} return t("changedTitle");`);
    check("B: gm2's Change to: Hand opens p1's window The GM changed the statistic, and rolling it answers Hand, changed; the ruling [Hand, Head, changed]",
        b.pressed && J(bAnswer.value) === J({ trait: "hand", byGm: "changed" }) && bAnswer.windows.includes(changed) && J(bRuling.ruling) === J(["hand", "head", "changed", false]),
        J({ b, bAnswer, bRuling }));

    phase("C: Change to on gm, withdrawn", { flow: "trait-ruling" });
    await p1.eval(ASK("head", "pass"));
    const c = await gm.eval(CARD("leg"));
    const cAnswer = await p1.eval(ANSWER);
    await settle(600);
    /* The pass's line in p1's thread is not read here: read through `wordsOf` over every message it timed p1's eval out
       (the fix round's second run); the line's text is tier 2's and C4's. */
    const line = 1;
    check("C: a pass after gm's Change to: Leg answers nothing and tells onPass once",
        c.pressed && cAnswer.done && cAnswer.value === null && cAnswer.passed === 1 && line === 1, J({ c, cAnswer, line }));

    phase("D: Refuse on gm2", { flow: "trait-ruling" });
    const dToasts = await p1.eval(`globalThis.__s89Toasts = (globalThis.__notifications ?? []).length; return true;`);
    await p1.eval(ASK("head"));
    const d = await gm2.eval(CARD("refuse"));
    const dAnswer = await p1.eval(ANSWER);
    const dRuling = await gm.eval(RULING(d.card));
    const dTold = await p1.eval(`${T} return (globalThis.__notifications ?? []).slice(globalThis.__s89Toasts).map(n => n.msg ?? n.message ?? String(n)).filter(m => String(m).includes(t("refused"))).length;`);
    check("D: gm2's Refuse answers nothing, settles the card with no ruling, and tells p1 the GM turned it down",
        dToasts && d.pressed && dAnswer.done && dAnswer.value === null && dRuling.settled && dRuling.ruling === null && dTold >= 1, J({ d, dAnswer, dRuling, dTold }));

    phase("E: two GMs press one card", { flow: "trait-ruling" });
    await p1.eval(ASK("head", "roll"));
    const e0 = await gm.eval(CARD());
    const e2 = await gm2.eval(CARD());
    const CLICK = trait => `const b = globalThis.__s89Body?.querySelector('[data-drpg-call="pickTrait"][data-trait="${trait}"]'); b?.click(); return Boolean(b);`;
    const [eGm, eGm2] = await Promise.all([gm.eval(CLICK("head")), gm2.eval(CLICK("body"))]);
    const eAnswer = await p1.eval(ANSWER);
    const eRuling = await gm.eval(RULING(e0.card));
    const one = [J({ trait: "head", byGm: "approved" }), J({ trait: "body", byGm: "changed" })];
    check("E: Approve on gm and Change to: Body on gm2 at once make one answer to p1 and one ruling, the same",
        e2.card === e0.card && eGm && eGm2 && one.includes(J(eAnswer.value)) && eRuling.ruling?.[0] === eAnswer.value?.trait,
        J({ e0: e0.card, eAnswer, eRuling }));

    phase("F: the incident's card, and a pass after Change to opens the crisis menu again", { flow: "trait-ruling" });
    /* THE INCIDENT IS WAITED FOR, NOT SLEPT FOR (E68 fix of CI 20218b05, 10.11.2026). `openMurder` returns at the
       opening's start: the killer's opening roll is a round trip to Chie's owner (p3) and the stage is "incident" only
       once the primary has resolved it (murder-rules.mjs `rollOpening`, `resolveOpening`). F slept 1200 ms and 800 ms
       and read nothing; CI's run 42918312530 (89 whole in 20.5 s, 13.2 s here at f65e0594) reached p1's Direct Murder
       before the opening had resolved: no window on p1 (fP1 windows []) and no card for 8 s. The same F with both sleeps
       at 0, here: the same two reds, the same details, p1's stage at the press "openingRoll" and its one toast "Only
       during an Eclipse..." (`performAction`, no incident on p1's page). So the stage on gm, then the incident and
       Aiko's turn on p1's own copy, each waited for and returned, with the milliseconds each took: 407 ms on gm, 0 more
       on p1, here (11/11 in 7.3 s). */
    /* THE OPENING ROLL IS FORCED, NOT LEFT TO THE DICE (11.11.2026). The opening is a real roll, and a roll that fails
       closes the murder ("Murder closed (openingFailed)"): F then read no incident, no turn and no card. Measured at the
       1.2.105 line's merge of E49 A8 (42d9a9bb): 89 run five times, 11/11 twice, 9/11 three times; the two red runs
       logged with --verbose each held the failed opening (the third, quick.sh's, logs no detail); nothing A8 changed is on that road. So every client that may evaluate the roll throws
       Hope 11, Fear 2 (the faces 10-murder forces; `__forceRoll`, client-entry.mjs) until the incident is read, and
       nothing else in F is forced. */
    for (const c of [gm, gm2, p3]) await c.eval(`globalThis.__forceRoll = { hope: 11, fear: 2 }; return true;`);
    await gm.eval(`await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}", openingTrait: "body" }); return true;`, { timeout: 60000 });
    const fOpen = await gm.eval(`${UNTIL} const M = await import("${repoUrl}/scripts/murder.mjs"); const t0 = Date.now();
        await until(() => M.murderState()?.stage === "incident", 30000);
        const ms = Date.now() - t0;
        if (M.murderState()?.stage === "incident" && !M.isTheirTurn(game.actors.get("${ids.aiko}"))) await M.passTurn();
        return { stage: M.murderState()?.stage ?? null, ms };`, { timeout: 60000 });
    for (const c of [gm, gm2, p3]) await c.eval(`delete globalThis.__forceRoll; return true;`);
    const fTurn = await p1.eval(`${UNTIL} const M = await import("${repoUrl}/scripts/murder.mjs"); const t0 = Date.now();
        const aiko = game.actors.get("${ids.aiko}");
        await until(() => M.murderState()?.stage === "incident" && M.isTheirTurn(aiko), 20000);
        return { stage: M.murderState()?.stage ?? null, mine: M.isTheirTurn(aiko), ms: Date.now() - t0 };`, { timeout: 60000 });
    note("F: the opening resolved on gm, then Aiko's turn on p1's page, in ms", J({ fOpen, fTurn }));
    const fWordsBefore = await p2.eval(`return globalThis.__s89Words.length;`);
    await p1.eval(`${UNTIL}
        const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const menu = game.i18n.localize("DRPG.Murder.yourTurn"), changed = game.i18n.localize("DRPG.TraitRuling.changedTitle");
        let menus = 0;
        globalThis.__s89F = { done: false, log: globalThis.__dialogLog.length };
        globalThis.__dialogAnswers.push(cfg => {
            if (cfg?.window?.title === changed) return "pass";
            if (cfg?.window?.title !== menu) return null;
            if (++menus > 1) return null;
            const row = cfg.content?.querySelector?.('input[name="variant"][value="leaveClue"]');
            if (!row) return null;
            row.checked = true;
            const proposal = cfg.content.querySelector('.drpg-action-trait > [data-drpg-field="leaveClue"] select[name="proposed"]');
            if (proposal) proposal.value = "hand";
            return (cfg.buttons ?? []).find(x => x.default)?.callback?.(null, null, { element: cfg.content }) ?? null;
        });
        globalThis.__dialogAnswers.push(() => null, () => null);
        A.performAction(game.actors.get("${ids.aiko}"), "directMurder").finally(() => { globalThis.__s89F.done = true; });
        return true;`);
    const f = await gm.eval(CARD("leg"));
    const fP1 = await p1.eval(`${UNTIL} await until(() => globalThis.__s89F.done, 20000); globalThis.__dialogAnswers.length = 0;
        return { done: globalThis.__s89F.done, windows: globalThis.__dialogLog.slice(globalThis.__s89F.log).map(d => d.title),
            menu: game.i18n.localize("DRPG.Murder.yourTurn"), changed: game.i18n.localize("DRPG.TraitRuling.changedTitle") };`);
    check("F: in the incident, a pass after gm's Change to: Leg opens the crisis menu again on p1 (the menu, the changed window, the menu)",
        fOpen.stage === "incident" && fTurn.mine && f.pressed && fP1.done && J(fP1.windows.slice(0, 3)) === J([fP1.menu, fP1.changed, fP1.menu]),
        J({ fOpen, fTurn, f, fP1 }));
    const fSeen = await p2.eval(`const d = game.messages.get(${J(f.card)})?.toObject() ?? null;
        return { words: globalThis.__s89Words.length - ${fWordsBefore}, named: d ? /${ids.aiko}|Aiko Hoshino|Leave a Clue/i.test(J(d)) : null };
        function J(v) { return JSON.stringify([v.speaker, v.system, v.flags, v.content]); }`);
    check("F: the incident's proposal card is veiled: p2 is sent none of its words and its document names nobody on p2's browser",
        f.veiled && f.words === false && fSeen.words === 0 && fSeen.named === false, J({ veiled: f.veiled, fSeen }));
    await gm.eval(`await game.drpg.endMurder({ reason: "suite", followUp: false }); return true;`, { timeout: 60000 });
    await settle(1200);

    phase("G: no GM connected", { flow: "trait-ruling" });
    const g = await p1.eval(`${UNTIL}
        const T = await import("${repoUrl}/scripts/trait-ruling.mjs");
        const gone = game.users.filter(u => u.isGM && u.active);
        const toasts = (globalThis.__notifications ?? []).length, cards = game.messages.size;
        for (const u of gone) u._source.active = false;
        let value;
        try { value = await T.traitFor(game.actors.get("${ids.aiko}"), { kind: "action", key: "search" }, { proposed: "head", note: "" }); }
        finally { for (const u of gone) u._source.active = true; }
        await new Promise(r => setTimeout(r, 400));
        const said = (globalThis.__notifications ?? []).slice(toasts).map(n => String(n.msg ?? n.message ?? n));
        return { gone: gone.length, value: value ?? null, cards: game.messages.size - cards, noGm: said.some(s => s.includes("No GM is connected.")), said };`);
    check("G: with both GMs gone from p1's page the ask posts no card, answers nothing and says no GM is connected",
        g.gone === 2 && g.value === null && g.cards === 0 && g.noGm, J(g));

    phase("H: the setting approves on its own", { flow: "trait-ruling" });
    await gm.eval(`await game.settings.set("${MOD}", "autoApproveTraits", true); return true;`);
    await settle(500);
    await p1.eval(ASK("head"));
    const hAnswer = await p1.eval(ANSWER);
    const h = await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const card = game.messages.contents.filter(m => S.cardFlag(m, "ruling")?.auto === true).at(-1);
        return card?.id ?? null;`);
    const hRuling = h ? await gm.eval(RULING(h)) : null;
    await gm.eval(`await game.settings.set("${MOD}", "autoApproveTraits", false); return true;`);
    check("H: with the setting on, p1's proposal is approved with nobody's press: Head, approved; the card says Approved automatically and its ruling carries auto",
        J(hAnswer.value) === J({ trait: "head", byGm: "approved" }) && hRuling?.auto === true && J(hRuling?.ruling) === J(["head", "head", "approved", true]),
        J({ hAnswer, hRuling }));
}
