/**
 * 97-two-gms: two Gamemasters at one table, a reload and a change of primary (E38, 13.11.2026; plan
 * docs/dev/plans/E38.md on the planner's branch, its 3.1-3.2; the harness README's planned row 82, numbered 97 here).
 *
 * The seed's GM and three players, and `gm2`, a second Gamemaster declared late whose id sorts after the seed
 * GM's, so the seed GM stays the primary while both are connected (utils.mjs `primaryGmId`: the smallest id of
 * the connected full GMs). Every check reads something the run made happen first, and says so in its own
 * condition: a check that would pass on an empty reading is guarded by the reading's count.
 *
 * Phases, in the order they run:
 *   A  the harness's own preconditions (cluster.mjs `reload`, `makePrimary`, `primaryOn`, E38 C1): gm2 joins and
 *      the primary does not move, on any client (A1); p1 reloads - the others hear it leave and come back, and a
 *      key its localStorage held is there after (A2); the primary reloads while gm2 is here, and is the primary
 *      again once it is back, on every client (A3); `makePrimary("gm2")` takes the seed GM off the table and every
 *      client reads gm2, and the seed GM back makes it the primary again (A4).
 *   B  the GMs' store both ways: a row gm2 writes is held by gm, a row gm writes by gm2, each by the store's own
 *      exchange (gm-store.mjs), and a removal on one is a removal on the other (B1-B3).
 *
 * What this cannot see: a real F5 (a new process with the old localStorage, no cookie, IndexedDB or cache; the
 * order of "inactive", "active" and `ready` on v14 is LIVE-E30-05 and LIVE-E04-12), and a real server's delivery
 * times. A third account on a live v14 is LIVE-E38-01 and -02 (audit/AUDIT-1.2.42.md 9.2).
 */
export const layers = ["ci"];

export const accounts = [
    { who: "gm2", id: "USERGM2E38000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` until `done(value)` or `ms` pass; the last reading either way. */
async function until(read, done, ms = 6000, step = 150) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

export async function run(api) {
    const { gm, gm2, p1, p2, check, note, phase, settle, connect, reload, makePrimary, primaryOn, repoUrl: REPO, IDS } = api;
    const MOD = "danganronpa-rpg";
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const GM2 = accounts[0].id;
    const allRead = (on, id) => Object.keys(on).length >= 5 && Object.values(on).every(v => v === id);

    /* ------------------------------------------------------------------ A */
    phase("A harness");
    const before = await primaryOn();
    check("A0: before gm2 joins, the four clients take the seed GM for the primary",
        Object.keys(before).length === 4 && Object.values(before).every(v => v === IDS.gm), J(before));
    await gm.eval(`globalThis.__e38Heard = [];
        Hooks.on("userConnected", (user, active) => globalThis.__e38Heard.push([user.id, Boolean(active)]));
        return true;`);

    await connect("gm2");
    const joined = await until(primaryOn, on => Object.keys(on).length === 5);
    check("A1: gm2, whose id sorts after the seed GM's, joins and the primary does not move: all five clients read the seed GM",
        GM2 > IDS.gm && allRead(joined, IDS.gm), J(joined));

    await p1.eval(`localStorage.setItem("e38.reload.mark", "kept"); return true;`);
    const r1 = await reload("p1");
    const p1Back = await p1.eval(`return { mark: localStorage.getItem("e38.reload.mark"), user: game.user.id, ready: game.ready === true,
        drpg: Boolean(game.drpg) };`);
    const heard = await gm.eval(`return globalThis.__e38Heard.filter(([id]) => id === "${IDS.p1}");`);
    check("A2: p1 reloads: gm hears p1 leave then come back, and p1's browser boots again as p1 with the key its localStorage held",
        r1.left === true && r1.back === true && J(heard) === J([[IDS.p1, false], [IDS.p1, true]])
            && p1Back?.mark === "kept" && p1Back.user === IDS.p1 && p1Back.ready && p1Back.drpg,
        J({ r1, p1Back, heard }));

    await gm.eval(`localStorage.setItem("e38.reload.mark", "gm"); return true;`);
    const r2 = await reload("gm");
    const afterGmReload = await until(primaryOn, on => allRead(on, IDS.gm));
    const gmBack = await gm.eval(`globalThis.__e38Heard = []; Hooks.on("userConnected", (u, a) => globalThis.__e38Heard.push([u.id, Boolean(a)]));
        return { mark: localStorage.getItem("e38.reload.mark"), user: game.user.id, gm: game.user.isGM };`);
    check("A3: the primary GM reloads while gm2 is here, and once back it is the primary again on all five clients, its localStorage kept",
        r2.left === true && r2.back === true && allRead(afterGmReload, IDS.gm) && gmBack?.mark === "gm" && gmBack.user === IDS.gm && gmBack.gm,
        J({ r2, afterGmReload, gmBack }));

    const moved = await makePrimary("gm2");
    check("A4a: makePrimary(\"gm2\") takes the seed GM off the table, and the four clients left read gm2",
        J(moved.left) === J(["gm"]) && moved.agreed === true && Object.keys(moved.on).length === 4 && Object.values(moved.on).every(v => v === GM2),
        J(moved));
    await connect("gm");
    const backAgain = await until(primaryOn, on => allRead(on, IDS.gm));
    check("A4b: the seed GM connects again and is the primary on all five clients",
        allRead(backAgain, IDS.gm), J(backAgain));
    await settle(1500);

    /* ------------------------------------------------------------------ B */
    phase("B store both ways");
    const KEY2 = "97:gm2", KEY1 = "97:gm";
    await gm2.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.patch("${KEY2}", { name: "E38 written on gm2" }); return true;`);
    await gm.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.patch("${KEY1}", { name: "E38 written on gm" }); return true;`);
    const readBoth = who => () => who.eval(`const S = ${imp("gm-stores.mjs")};
        return { a: S.keyPlanStore.get("${KEY2}")?.name ?? null, b: S.keyPlanStore.get("${KEY1}")?.name ?? null };`);
    const onGm = await until(readBoth(gm), v => v?.a !== null);
    const onGm2 = await until(readBoth(gm2), v => v?.b !== null);
    check("B1: a row gm2 wrote is held by gm", onGm?.a === "E38 written on gm2" && onGm.b === "E38 written on gm", J(onGm));
    check("B2: a row gm wrote is held by gm2", onGm2?.b === "E38 written on gm" && onGm2.a === "E38 written on gm2", J(onGm2));
    await gm2.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.drop("${KEY1}"); return true;`);
    await gm.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.drop("${KEY2}"); return true;`);
    const goneGm = await until(readBoth(gm), v => v?.a === null && v?.b === null);
    const goneGm2 = await until(readBoth(gm2), v => v?.a === null && v?.b === null);
    check("B3: each GM's removal of the other's row is a removal on both",
        onGm?.a !== null && goneGm?.a === null && goneGm.b === null && goneGm2?.a === null && goneGm2.b === null, J({ goneGm, goneGm2 }));

    /* ------------------------------------------------------------------ C */
    /* One card, one settlement, across a primary's reload (plan E38 1: "one settlement of a card through card.claim, a
       change of primary"). p1 asks the GM (call-gm.mjs `callGm`); gm2 claims the card (bridge-asks.mjs `claimCard`,
       `card.claim` on the primary) and holds its work open while the primary reloads; then it settles the card, and
       the primary, back, presses the same card: its work never runs. 89-proposal-card E has two GMs pressing at once
       with no reload. */
    phase("C card across a reload");
    const WORDS_C = "E38 C one card two GMs";
    await p1.eval(`const B = ${imp("gm-bridge.mjs")};
        return await B.callGm(game.actors.get("${IDS.aiko}"), { title: "E38 C", request: ${J(WORDS_C)} });`, { timeout: 60000 });
    const FIND = `const S = ${imp("secret.mjs")};
        const card = () => game.messages.find(m => (S.contentOf(m) ?? "").includes(${J(WORDS_C)})) ?? null;`;
    const seen = await until(() => gm2.eval(`${FIND} return card()?.id ?? null;`), id => Boolean(id));
    await gm2.eval(`${FIND} const B = ${imp("gm-bridge.mjs")};
        globalThis.__e38Work = 0; globalThis.__e38Go = false;
        globalThis.__e38Claim = B.claimCard(card(), async () => {
            globalThis.__e38Work++;
            for (let i = 0; i < 300 && !globalThis.__e38Go; i++) await new Promise(r => setTimeout(r, 100));
            await B.settleCall(card(), "E38 C ruled on gm2");
            return { settled: true };
        }).then(out => out, err => ({ err: String(err) }));
        return true;`);
    const holding = await until(() => gm2.eval(`return globalThis.__e38Work;`), n => n === 1);
    const r3 = await reload("gm");
    await gm2.eval(`globalThis.__e38Go = true; return true;`);
    const claimed = await gm2.eval(`const out = await globalThis.__e38Claim; delete globalThis.__e38Claim; return out;`, { timeout: 60000 });
    await settle(1500);
    const gmPress = await gm.eval(`${FIND} const B = ${imp("gm-bridge.mjs")}; let ran = 0;
        const out = await B.claimCard(card(), async () => { ran++; return { settled: true }; });
        return { out: out ?? null, ran };`, { timeout: 60000 });
    const ROW = `${FIND} const St = ${imp("gm-stores.mjs")}, m = card();
        return { id: m?.id ?? null, settled: Boolean(m && (S.cardFlag(m, "settled") || S.cardMeta?.(m, "settled"))),
            row: m ? St.ruledCardStore.get(m.id) : null, work: globalThis.__e38Work ?? null };`;
    const onGmC = await until(() => gm.eval(ROW), v => v?.row && v.row.pending === false);
    const onGm2C = await gm2.eval(ROW);
    check("C1: p1's card reaches gm2, which claims it and holds its work open (one run)", Boolean(seen) && holding === 1, J({ seen, holding }));
    check("C2: the primary reloads while gm2 holds the claim; gm2's work then ends and the card is settled once, by gm2",
        r3.back === true && claimed?.settled === true && onGm2C.settled === true && onGm2C.work === 1, J({ r3, claimed, onGm2C }));
    check("C3: the primary, back, presses the same card: its work never runs, and both GMs hold the card ruled by gm2",
        gmPress.ran === 0 && gmPress.out === null && onGmC?.row?.by === GM2 && onGmC.row.pending === false
            && onGm2C.row?.by === GM2 && onGm2C.row.pending === false,
        J({ gmPress, onGmC, onGm2C }));

    /* ------------------------------------------------------------------ D */
    /* One roll, one record, whichever GM is the primary (plan E38 1: "one rollId record"). p1 throws Aiko's Eye (an
       action roll, drawn on the primary: roll-draw.mjs, the store `rolls`) with gm the primary, then with gm2 the
       primary while gm is away, then gm comes back. Read: the rows of the store `rolls` each GM holds for Aiko that
       were not there before. */
    phase("D a roll's record across a change of primary");
    const ROLLS = `const St = ${imp("gm-stores.mjs")};
        return Object.entries(St.rollStore.entries() ?? {}).filter(([, r]) => r.actorId === "${IDS.aiko}").map(([id, r]) => ({ id, total: r.total ?? null })).sort((a, b) => a.id < b.id ? -1 : 1);`;
    const aikoWas = await gm.eval(`const a = game.actors.get("${IDS.aiko}"); return { hope: a.system.resources.hope.value, actions: game.drpg.actionsLeft(a) };`);
    const rollsBefore = new Set((await gm.eval(ROLLS)).map(r => r.id));
    const ROLL = `const A = ${imp("action-rolls.mjs")}; const r = await A.rollTrait(game.actors.get("${IDS.aiko}"), "eye", {}); return { total: r?.total ?? null };`;
    const fresh = rows => rows.filter(r => !rollsBefore.has(r.id));
    const d1 = await p1.eval(ROLL, { timeout: 90000 });
    const d1Gm = await until(async () => fresh(await gm.eval(ROLLS)), rows => rows.length >= 1);
    const d1Gm2 = await until(async () => fresh(await gm2.eval(ROLLS)), rows => rows.length >= 1);
    check("D1: with gm the primary, p1's roll is one record, and gm2 holds the same one",
        d1?.total !== null && d1Gm.length === 1 && J(d1Gm2) === J(d1Gm), J({ d1, d1Gm, d1Gm2 }));
    const toGm2 = await makePrimary("gm2");
    const d2 = await p1.eval(ROLL, { timeout: 90000 });
    const d2Gm2 = await until(async () => fresh(await gm2.eval(ROLLS)), rows => rows.length >= 2);
    await connect("gm");
    const d2Gm = await until(async () => fresh(await gm.eval(ROLLS)), rows => rows.length >= 2, 10000);
    const d2Gm2After = fresh(await gm2.eval(ROLLS));
    check("D2: with gm2 the primary, p1's next roll is drawn there - one more record, two in all - and gm, back, holds both, each once",
        toGm2.agreed === true && d2?.total !== null && d2Gm2.length === 2 && new Set(d2Gm2.map(r => r.id)).size === 2
            && J(d2Gm) === J(d2Gm2After) && d2Gm.length === 2,
        J({ toGm2: toGm2.left, d2, d2Gm2, d2Gm, d2Gm2After }));
    await until(primaryOn, on => allRead(on, IDS.gm));
    await gm.eval(`const a = game.actors.get("${IDS.aiko}"), was = ${J(aikoWas)};
        if (a.system.resources.hope.value !== was.hope) await a.update({ "system.resources.hope.value": was.hope });
        if (game.drpg.actionsLeft(a) !== was.actions) await game.drpg.setActions(a, was.actions);
        return true;`);

    /* ------------------------------------------------------------------ F */
    /* A Frisk whose primary leaves mid-ask (decision of 13.10, A11: "a primary change mid-request"). The ask lives in the
       primary's memory (frisk.mjs `friskAsks`): when that GM leaves for another who takes over, the searcher's wait ends
       at once and its browser hands the action back, with no dice thrown (bridge-asks.mjs `requestFriskAsk`; the
       design's risk 3). p1 frisks Botan openly (40-flow 6h's recipe); p2 holds the ask's window; the primary leaves. */
    phase("F a Frisk's ask when the primary leaves", { flow: "frisk-openly" });
    const FR = `const M = ${imp("movement.mjs")}, F = ${imp("frisk.mjs")};
        const PLACE = { teleport: true, movementAction: "displace", animate: false };
        const tokenOf = id => canvas.scene.tokens.find(t => t.actorId === id) ?? null;`;
    const fSet = await gm.eval(`${FR}
        const actors = ["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"].map(id => game.actors.get(id)), toks = actors.map(a => tokenOf(a.id));
        if (toks.some(t => !t)) return { err: "no token" };
        const room = M.allRooms(canvas.scene).find(r => M.othersInNamedRoom(r).length === 0) ?? null;
        if (!room) return { err: "no empty room" };
        globalThis.__e38Frisk = { was: toks.map(t => [t.id, { x: t.x, y: t.y }]), actions: game.drpg.actionsLeft(actors[0]),
            force: game.settings.get("${MOD}", "friskForce") };
        for (const t of toks) await t.update(M.positionIn(room, t), PLACE);
        if (game.settings.get("${MOD}", "friskForce") !== false) await game.settings.set("${MOD}", "friskForce", false);
        F.forgetFriskAsks();
        await game.drpg.setActions(actors[0], 2);
        return { room, others: M.othersInRoom(actors[0]).map(a => a.id).sort() };`, { timeout: 60000 });
    await settle(800);
    const askTitle = await p2.eval(`return game.i18n.localize("DRPG.Frisk.askTitle");`);
    await p2.eval(`globalThis.__e38Windows = globalThis.__dialogWindows; globalThis.__dialogWindows = true; return true;`);
    await p1.eval(`const actor = game.actors.get("${IDS.aiko}");
        for (let i = 0; i < 50 && game.drpg.actionsLeft(actor) !== 2; i++) await new Promise(r => setTimeout(r, 100));
        globalThis.__dialogAnswers.push(() => ({ value: "frisk", form: { querySelector: sel => sel.includes("who") ? { value: "${IDS.botan}" }
            : sel.includes("friskMode") ? { value: "openly" } : null } }));
        globalThis.__e38Thrown = 0;
        const own = Object.getPrototypeOf(actor).rollTrait;
        actor.rollTrait = async function (key, options) { globalThis.__e38Thrown++; return own.call(actor, key, options); };
        globalThis.__e38Run = game.drpg.performAction(actor, "palm", {}).then(r => ({ r }), e => ({ err: String(e?.stack ?? e).slice(0, 300) }))
            .finally(() => { delete actor.rollTrait; });
        return true;`);
    const asking = await until(async () => ({
        state: await gm.eval(`${FR} return [...F.friskAsks.values()].find(r => r.searcherId === "${IDS.aiko}")?.state ?? null;`),
        drawn: await p2.eval(`return globalThis.__dialogLog.some(d => d.title === ${J(askTitle)});`)
    }), v => v.state === "asking" && v.drawn, 15000);
    const fT0 = Date.now();
    const fMoved = await makePrimary("gm2");
    const fOut = await p1.eval(`const out = await globalThis.__e38Run; delete globalThis.__e38Run;
        await new Promise(r => setTimeout(r, 500));
        return { err: out.err ?? null, asked: out.r?.asked ?? null, left: game.drpg.actionsLeft(game.actors.get("${IDS.aiko}")), thrown: globalThis.__e38Thrown };`,
        { timeout: 120000 });
    const fMs = Date.now() - fT0;
    const fGm2Rows = await gm2.eval(`${FR} return F.friskAsks.size;`);
    check("F1: p1's open Frisk of Botan is asking on the primary and drawn on p2's page before the primary leaves",
        !fSet.err && asking.state === "asking" && asking.drawn === true, J({ fSet, asking }));
    check("F2: the primary leaves for gm2 mid-ask: p1's wait ends well before the ask's own clock, the action is handed back, no dice are thrown, and gm2 holds no ask",
        fMoved.agreed === true && fOut.err === null && fOut.left === 2 && fOut.thrown === 0 && fMs < 30000 && fGm2Rows === 0,
        J({ fMoved: fMoved.left, fOut, fMs, fGm2Rows }));
    await connect("gm");
    await until(primaryOn, on => allRead(on, IDS.gm));
    await p2.eval(`globalThis.__dialogWindows = globalThis.__e38Windows; delete globalThis.__e38Windows; globalThis.__dialogAnswers.length = 0; return true;`);
    await p1.eval(`globalThis.__dialogAnswers.length = 0; delete globalThis.__e38Thrown; return true;`);
    await gm.eval(`${FR} const set = globalThis.__e38Frisk; delete globalThis.__e38Frisk; F.forgetFriskAsks();
        if (set) {
            for (const [id, was] of set.was) await canvas.scene.tokens.get(id)?.update(was, PLACE);
            const aiko = game.actors.get("${IDS.aiko}");
            if (game.drpg.actionsLeft(aiko) !== set.actions) await game.drpg.setActions(aiko, set.actions);
            if (game.settings.get("${MOD}", "friskForce") !== set.force) await game.settings.set("${MOD}", "friskForce", set.force);
        }
        return true;`, { timeout: 60000 });
    await settle(800);

    /* ------------------------------------------------------------------ G */
    /* D153 across two GMs' browsers (E60's Open 50; plan E38 3.3). A Give from a Remnant runs on the GM whose window it
       is (gm-items.mjs `giveBullet`), an Observe's find on the primary (observe.mjs `mintFindCopy`); each runs in the
       receiver's finds' queue, which is that browser's memory. Here both, for Chie and the seeded trace, at the same
       moment, gm's find and gm2's give. Q-E38-2's default (the plan; default taken, the owner to confirm): the fix, a
       bridge row carrying the give to the primary, stays with the verification chat, so this records what happens -
       a note, not a verdict - and checks only that it measured something. */
    phase("G D153: a give and a find on two GMs at once", { flow: "truth-bullets" });
    const TB = `const T = ${imp("truth-bullets.mjs")};
        const copies = () => T.bulletsOf(game.actors.get("${IDS.chie}")).filter(i => T.secretOf(i.uuid)?.remnantId === "${IDS.trace}");`;
    const gBefore = await gm.eval(`${TB} return copies().length;`);
    const at = Date.now() + 1500;
    const [gFound, gGave] = await Promise.all([
        gm.eval(`const O = ${imp("observe.mjs")}, R = ${imp("remnants.mjs")};
            const ref = R.remnantById("${IDS.annex}", "${IDS.trace}");
            const data = ref ? R.remnantData(ref) : null;
            while (Date.now() < ${at}) await new Promise(r => setTimeout(r, 5));
            const out = data ? await O.mintFindCopy(game.actors.get("${IDS.chie}"), { tokenId: "${IDS.trace}", sceneId: "${IDS.annex}", room: null, data },
                { name: "E38 G found", playerText: "E38 G", tell: false }) : null;
            return { data: Boolean(data), made: Boolean(out?.id) };`, { timeout: 60000 }),
        gm2.eval(`const G = ${imp("gm-items.mjs")};
            while (Date.now() < ${at}) await new Promise(r => setTimeout(r, 5));
            const out = await G.giveBullet(game.actors.get("${IDS.chie}"), { name: "E38 G given", realType: "prep", visibility: "evident",
                playerText: "E38 G", remnantId: "${IDS.trace}", sceneId: "${IDS.annex}" });
            return out === G.GIVEN_ALREADY ? "given already" : out?.id ? "a bullet" : String(out);`, { timeout: 60000 })
    ]);
    await settle(2000);
    const gAfter = await gm.eval(`${TB} return copies().length;`);
    const gAfter2 = await gm2.eval(`${TB} return copies().length;`);
    note("G: D153 across two GMs - Chie's copies of the seeded trace after gm's find and gm2's give at the same moment (Q-E38-2: the fix stays with the verification chat; one copy is the rule, two the known edge)",
        J({ before: gBefore, onGm: gAfter, onGm2: gAfter2, found: gFound, gave: gGave }));
    check("G1: D153 measured - the find ran on gm with the trace's answer key and gm2's give answered, and Chie holds at least one copy on both GMs",
        gBefore === 0 && gFound?.data === true && typeof gGave === "string" && gAfter >= 1 && gAfter2 === gAfter,
        J({ gBefore, gFound, gGave, gAfter, gAfter2 }));
    await gm.eval(`${TB} for (const item of copies()) { const uuid = item.uuid; await item.delete().catch(() => {}); await T.dropSecret(uuid).catch(() => {}); }
        return copies().length;`, { timeout: 60000 });
    await settle(1500);

    return { primary: { before, joined, afterGmReload, moved, backAgain }, reloads: { p1: r1, gm: r2, card: r3 },
        d153: { before: gBefore, onGm: gAfter, onGm2: gAfter2, found: gFound, gave: gGave } };
}
