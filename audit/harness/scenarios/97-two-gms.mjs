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
 *   K  (run before I, while gm2 is here) the GMs' drawn fog, `diagnoseFog().shading` on gm and on gm2, with no repaint
 *      asked by the scenario: every student's row emptied on gm (K0), a Fog cell ticked on gm (K1) and unticked on gm2
 *      (K2), p1 walking Aiko into a room nobody found (K3), Room setup's Hide all and Apply on gm2 (K4) (1.2.120 line F).
 *   L  (after K) a full localStorage: gm's refuses the discovery store's key and p1's its fog copy's, and a Fog cell gm
 *      ticks and a room p1 walks into still clear on gm's drawn fog (L1), and the ticked room is under the veil on p1's (L2)
 *      (1.2.120 line F).
 *   V  (after L, gm2 here) 1.2.122 line MURDER, the audit's STG-31: gm2 puts up the lights' veil and ends the lights
 *      through the primary (`mask.veil`): a killer with a declaration veiled, one with none not (V1), lifted at the end (V2).
 *   I  the owner's world of 20.11.2026 (1.2.119 line F): two GM users, gm2 gone, a season reset's discovery cut two
 *      hours ahead of gm's clock, as a reset made on gm2's computer with its clock ahead writes it; p1 walks Aiko into
 *      a room, and gm's record holds it, after gm's reload too, p1's copy holds it, and gm is told once (I1, I2). Last:
 *      the watermark stays ahead for the rest of the run.
 *   J  the owner's flow as they restated it on 20.11.2026: rows of a character put out of the class and of the Monokuma
 *      beside Aiko's, every box of Room setup's Fog tab unticked (Hide all) and Apply, then gm's map (its record and
 *      its shading) at once and after gm's reload, and p1's copy (J1).
 *   K  1.2.121 line M1 (the audit's CORE-20 residue, N119-4): a card rewritten naming Chie while her mask stood, gm2 and
 *      p2 away; the time of day ends the mask, gm2 fetches the words, gm leaves, and gm2 serves p2 with Chie "?" (K1);
 *      gm2's own rewrite reaches p2 cut too (K2). Red at e515907d: K1 and K2 named her. And her reveal on gm reaches
 *      gm2, connected, which forgets the same masked rows (K4; 1.2.122 line CORE, r121-M-3; red at 21bf5d18).
 *   M  1.2.122, the owner's decision of 21.11.2026: the second GM's Play and Stop the track, carried out on the primary
 *      and read there (M1, M2); and the second GM's Silence through `call.world` (M3, the audit's COMM-26); and why a
 *      second GM's Play did not play, told to that GM and not the primary (M4, 1.2.123, the audit's r122-G-6).
 *   N  1.2.124, the owner's OWNER-124-CONSOLE: both GMs' messenger windows open on the Timeline; p1's Search card with
 *      its answers waits on both, its buttons live (N1); gm answers it from its Timeline, and the card leaves gm2's
 *      "Waiting" too, while its line stays in both streams (N2).
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
    const { gm, gm2, p1, p2, check, note, phase, settle, connect, disconnect, storageOf, reload, makePrimary, primaryOn, repoUrl: REPO, IDS } = api;
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
        for (const t of toks) await t.update(M.positionIn(room, t), { ...PLACE });
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
            for (const [id, was] of set.was) await canvas.scene.tokens.get(id)?.update(was, { ...PLACE });
            const aiko = game.actors.get("${IDS.aiko}");
            if (game.drpg.actionsLeft(aiko) !== set.actions) await game.drpg.setActions(aiko, set.actions);
            if (game.settings.get("${MOD}", "friskForce") !== set.force) await game.settings.set("${MOD}", "friskForce", set.force);
        }
        return true;`, { timeout: 60000 });
    await settle(800);

    /* ------------------------------------------------------------------ G */
    /* D153 across two GMs' browsers (E60's Open 50; plan E38 3.3). An Observe's find runs on the primary (observe.mjs
       `mintFindCopy`) in the receiver's finds' queue, which is that browser's memory; Give a Truth Bullet ran its give
       on whichever GM opened the window. Here both, for Chie and the seeded trace, at the same moment: gm's find and
       gm2's Give, asked as the window asks it (bridge-asks.mjs `requestGiveBullet`, `bullet.give` on the primary,
       E38 C4). Read at E38 C2, when the window gave on its own browser (gm-items.mjs `giveBullet` on gm2): Chie held
       2 copies on both GMs. One copy is the rule. */
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
        gm2.eval(`const B = ${imp("gm-bridge.mjs")};
            if (typeof B.requestGiveBullet !== "function") return "no requestGiveBullet";
            while (Date.now() < ${at}) await new Promise(r => setTimeout(r, 5));
            const res = await B.requestGiveBullet(game.actors.get("${IDS.chie}"), { name: "E38 G given", realType: "prep", visibility: "evident",
                playerText: "E38 G", remnantId: "${IDS.trace}", sceneId: "${IDS.annex}" });
            return res.ok ? (res.value?.given ?? "no answer") : "refused: " + (res.reason ?? res.refused ?? "?");`, { timeout: 60000 })
    ]);
    await settle(2000);
    const gAfter = await gm.eval(`${TB} return copies().length;`);
    const gAfter2 = await gm2.eval(`${TB} return copies().length;`);
    note("G: D153 across two GMs - Chie's copies of the seeded trace after gm's find and gm2's give at the same moment",
        J({ before: gBefore, onGm: gAfter, onGm2: gAfter2, found: gFound, gave: gGave }));
    check("G1: a find on gm and a Give asked from gm2 at the same moment for Chie and one trace make one copy, held by both GMs, and the Give answers that she holds it already or that it gave it (D153 across two GMs)",
        gBefore === 0 && gFound?.data === true && ["already", "bullet"].includes(gGave) && gAfter === 1 && gAfter2 === 1,
        J({ gBefore, gFound, gGave, gAfter, gAfter2 }));
    await gm.eval(`${TB} for (const item of copies()) { const uuid = item.uuid; await item.delete().catch(() => {}); await T.dropSecret(uuid).catch(() => {}); }
        return copies().length;`, { timeout: 60000 });
    await settle(1500);

    /* ------------------------------------------------------------------ H */
    /* A SCENE PICKED FOR A PROJECT'S ROOM, DELETED BY ONE GM (Q-SC-4, the owner, 16.11.2026: only a GM deletes a scene, so
       the other GMs are told; projects-map.mjs `onPickedSceneDeleted`). The primary (gm) makes a scene with a Dorm A and
       a project in Dorm A picked onto it by hand, then deletes the scene: the card goes to gm2 alone, through the GMs'
       private road - gm2 reads the project's name in it, p1 does not, and gm is not among its readers. */
    phase("H a picked scene deleted: the other GM is told");
    const NAME_H = "E43 H project on a scene that goes";
    const madeH = await gm.eval(`const P = ${imp("projects.mjs")}, R = ${imp("rooms.mjs")};
        const other = await Scene.create({ name: "E43 H a floor that goes", width: 2000, height: 1000, grid: { size: 100 }, active: false, navigation: false });
        await other.createEmbeddedDocuments("Region", [{ name: "Dorm A", shapes: [{ type: "rectangle", x: 0, y: 0, width: 800, height: 800 }],
            flags: { "${MOD}": { [R.ROOM_FLAG]: true } }, behaviors: [] }]);
        const id = (await P.createProject({ name: ${J(NAME_H)}, target: 3, room: "Dorm A" }))?.id ?? null;
        await P.applyProjectChange(id, P.projectEditChange({ roomScene: other.id, roomSceneByGm: true }), { by: { kind: "gm" } });
        return { id, scene: other.id, picked: P.roomSceneOf(id) === other.id, had: game.messages.contents.map(m => m.id) };`, { timeout: 60000 });
    await gm.eval(`await game.scenes.get(${J(madeH.scene)})?.delete(); return true;`, { timeout: 60000 });
    const CARD_H = `const S = ${imp("secret.mjs")}; const had = new Set(${J(madeH.had)});
        const cards = game.messages.contents.filter(m => !had.has(m.id));`;
    const onGm2H = await until(() => gm2.eval(`${CARD_H} return cards.filter(m => (S.contentOf(m) ?? "").includes(${J(NAME_H)})).map(m => [...(m.whisper ?? [])]);`), v => v?.length > 0);
    const onP1H = await p1.eval(`${CARD_H} return { cards: cards.length, named: cards.filter(m => (S.contentOf(m) ?? "").includes(${J(NAME_H)}) || JSON.stringify(m.toObject()).includes(${J(NAME_H)})).length };`);
    check("H1: the primary deletes a scene picked for a project's room: one card to gm2 alone names the project, p1's browser holds no word of it, and gm is not told",
        madeH.picked === true && J(onGm2H) === J([[GM2]]) && onP1H.named === 0, J({ picked: madeH.picked, onGm2H, onP1H }));
    /* H2: the same, the scene deleted by gm2 while gm stays the primary: the card, written by the primary, goes to gm alone. */
    const madeH2 = await gm.eval(`const P = ${imp("projects.mjs")}, R = ${imp("rooms.mjs")};
        const other = await Scene.create({ name: "E43 H2 a floor gm2 deletes", width: 2000, height: 1000, grid: { size: 100 }, active: false, navigation: false });
        await other.createEmbeddedDocuments("Region", [{ name: "Dorm A", shapes: [{ type: "rectangle", x: 0, y: 0, width: 800, height: 800 }],
            flags: { "${MOD}": { [R.ROOM_FLAG]: true } }, behaviors: [] }]);
        await P.applyProjectChange(${J(madeH.id)}, P.projectEditChange({ roomScene: other.id, roomSceneByGm: true }), { by: { kind: "gm" } });
        return { scene: other.id, picked: P.roomSceneOf(${J(madeH.id)}) === other.id, had: game.messages.contents.map(m => m.id) };`, { timeout: 60000 });
    await settle(1000);
    await gm2.eval(`await game.scenes.get(${J(madeH2.scene)})?.delete(); return true;`, { timeout: 60000 });
    const CARD_H2 = `const S = ${imp("secret.mjs")}; const had = new Set(${J(madeH2.had)});
        const cards = game.messages.contents.filter(m => !had.has(m.id));`;
    const onGmH2 = await until(() => gm.eval(`${CARD_H2} return cards.filter(m => (S.contentOf(m) ?? "").includes(${J(NAME_H)})).map(m => [...(m.whisper ?? [])]);`), v => v?.length > 0);
    const onGm2H2 = await gm2.eval(`${CARD_H2} return cards.filter(m => (S.contentOf(m) ?? "").includes(${J(NAME_H)})).length;`);
    check("H2: gm2 deletes a scene picked for a project's room while gm is the primary: one card to gm alone names the project, and gm2 reads none",
        madeH2.picked === true && J(onGmH2) === J([[IDS.gm]]) && onGm2H2 === 0, J({ picked: madeH2.picked, onGmH2, onGm2H2 }));
    await gm.eval(`const P = ${imp("projects.mjs")}; if (${J(madeH.id)}) await P.deleteProject(${J(madeH.id)}).catch(() => {}); return true;`, { timeout: 60000 });
    await settle(1000);

    /* ------------------------------------------------------------------ K */
    /* 1.2.120 line F (the owner's report of 21.11.2026: "Mgla u GMa nie odswieza sie wcale" - the GM's fog does not refresh
       at all). The GM's DRAWN fog - what the last repaint shaded (`diagnoseFog().shading`), read on gm and on gm2 - after
       each road that changes the class's map, with no repaint called by this scenario: J reads its map after calling
       `repaintFog()` itself, so it never measured that a GM redraws on its own. Roads: a Fog cell ticked on gm, the same
       cell unticked on gm2, a student p1 walks into a room nobody found, Room setup's Hide all and Apply on gm2 (not the
       primary). On e515907d every road followed on both GMs headless (K1-K4 green); the harness renders no texture, so
       the dissolve that can hold every repaint at a table (R8030) is not reached here: LIVE-F120-01. */
    phase("K the GMs' drawn fog follows every road, with no repaint asked", { flow: "discovery-ledger" });
    const SHADE = `const F = ${imp("fog.mjs")}; return F.diagnoseFog().shading ?? null;`;
    const both = async (done, ms = 6000) => ({ gm: await until(() => gm.eval(SHADE), done, ms), gm2: await until(() => gm2.eval(SHADE), done, ms) });
    // Every student's row on the scene emptied on gm first (`setDiscovery` with no actor, as the console's Hide all is),
    // so the rooms K ticks and walks into are rooms nobody has found; the GMs' drawn fog follows that too (K0).
    const allFog = s => Boolean(s) && Object.keys(s).length > 0 && Object.values(s).every(v => v === "fog");
    await gm.eval(`const F = ${imp("fog.mjs")}; await F.setDiscovery(game.scenes.get("${IDS.scene}"), { value: false }); return true;`, { timeout: 60000 });
    const k0 = await both(allFog);
    const darkK = Object.keys(k0.gm ?? {}).sort();
    const aikoAt = await gm.eval(`return (${imp("movement.mjs")}).roomOfToken(game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000"));`);
    const tickK = darkK.find(room => room !== aikoAt) ?? null, walkK = darkK.find(room => room !== aikoAt && room !== tickK) ?? null;
    check("K0: every student's row emptied on gm: every room fogged on gm's drawn fog and on gm2's, with no repaint asked, and two rooms left to tick and to walk into (1.2.120 line F)",
        allFog(k0.gm) && allFog(k0.gm2) && Boolean(tickK && walkK), J({ k0, aikoAt, tickK, walkK }));
    await gm.eval(`const F = ${imp("fog.mjs")}; await F.setDiscovery(game.scenes.get("${IDS.scene}"), { actorId: "${IDS.aiko}", rooms: [${J(tickK)}], value: true }); return true;`, { timeout: 60000 });
    const k1 = await both(s => s?.[tickK] === "clear");
    check("K1: a Fog cell gm ticks clears its room on gm's drawn fog and on gm2's, with no repaint asked (1.2.120 line F)",
        k1.gm?.[tickK] === "clear" && k1.gm2?.[tickK] === "clear", J({ tickK, k1 }));
    await gm2.eval(`const F = ${imp("fog.mjs")}; await F.setDiscovery(game.scenes.get("${IDS.scene}"), { actorId: "${IDS.aiko}", rooms: [], value: true }); return true;`, { timeout: 60000 });
    const k2 = await both(s => s?.[tickK] === "fog");
    check("K2: the same cell unticked on gm2, the other GM: its room is fogged again on both GMs' drawn fog (1.2.120 line F)",
        k2.gm?.[tickK] === "fog" && k2.gm2?.[tickK] === "fog", J({ tickK, k2 }));
    await gm.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000");
        await game.drpg.setActions(t.actor, 3); await t.actor.setFlag("${MOD}", "freeMoveUsed", false); return true;`, { timeout: 60000 });
    await settle(600);
    const walkedK = await p1.eval(`const M = ${imp("movement.mjs")}; const t = game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000");
        const to = M.positionIn(${J(walkK)}, t); await t.update({ x: to.x, y: to.y }); await new Promise(r => setTimeout(r, 1500)); return M.roomOfToken(t);`, { timeout: 60000 });
    const k3 = await both(s => s?.[walkK] === "clear");
    check("K3: p1 walks Aiko into a room nobody had found: it clears on gm's drawn fog and on gm2's, with no repaint asked (1.2.120 line F)",
        walkedK === walkK && k3.gm?.[walkK] === "clear" && k3.gm2?.[walkK] === "clear", J({ walkK, walkedK, k3 }));
    const boxesK = await gm2.eval(`const V = ${imp("vault.mjs")}; let boxes = 0;
        globalThis.__dialogAnswers.push(async config => {
            const ok = (config.buttons ?? []).find(b => b.action === "ok");
            const element = document.createElement("dialog"), form = document.createElement("form");
            if (typeof config.content === "string") form.innerHTML = config.content; else if (config.content) form.append(config.content.cloneNode(true));
            element.append(form);
            for (const box of form.querySelectorAll('input[type="checkbox"][name^="fog:"]')) if (!box.disabled) { box.checked = false; boxes += 1; }
            return ok.callback(new globalThis.window.Event("click"), { form }, { element });
        });
        try { await V.openRoomSetupDialog(); } finally { globalThis.__dialogAnswers.length = 0; }
        return boxes;`, { timeout: 60000 });
    const k4 = await both(allFog);
    check("K4: Hide all and Apply on Room setup's Fog tab on gm2, not the primary: every room fogged on gm's drawn fog and on gm2's, with no repaint asked (1.2.120 line F)",
        boxesK > 0 && allFog(k4.gm) && allFog(k4.gm2), J({ boxesK, k4 }));

    /* ------------------------------------------------------------------ L */
    /* 1.2.120 line F, the owner's reading of 21.11.2026: after Reset the season the GM's fog worked again, and in 1.2.119's
       report F5 had not helped. A store's readers are redrawn by its client setting's `onChange`, which Foundry (and the
       harness) runs only once the value is in localStorage: with the origin full, the store changed in memory and the
       fog never heard of it. Here gm's localStorage refuses the discovery store's key and p1's its fog copy's, as a full
       origin does; on 25231254 the record took the tick and the walk and gm's drawn fog stayed as drawn (L1 red), and
       the reset cured it at the table by emptying the stores. Put back at the phase's end. */
    phase("L a full localStorage: the GM's fog still follows", { flow: "discovery-ledger" });
    const REFUSE = key => `const P = Object.getPrototypeOf(localStorage); globalThis.__lSet ??= P.setItem;
        P.setItem = function (k, v) { if (String(k) === "${MOD}.${key}") { const e = new Error("The quota has been exceeded."); e.name = "QuotaExceededError"; throw e; } return globalThis.__lSet.call(this, k, v); };
        return true;`;
    const PUT_BACK = `if (globalThis.__lSet) { Object.getPrototypeOf(localStorage).setItem = globalThis.__lSet; delete globalThis.__lSet; } return true;`;
    await gm.eval(`const F = ${imp("fog.mjs")}; await F.setDiscovery(game.scenes.get("${IDS.scene}"), { value: false }); return true;`, { timeout: 60000 });
    const l0 = await until(() => gm.eval(SHADE), allFog);
    const aikoL = await gm.eval(`return (${imp("movement.mjs")}).roomOfToken(game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000"));`);
    const darkL = Object.keys(l0 ?? {}).filter(room => room !== aikoL).sort();
    const [tickL, walkL] = darkL;
    await gm.eval(REFUSE("gmDiscovery"));
    await p1.eval(REFUSE("mineFog"));
    let l1, l2, walkedL, p1L, stored;
    try {
        await gm.eval(`const F = ${imp("fog.mjs")}; await F.setDiscovery(game.scenes.get("${IDS.scene}"), { actorId: "${IDS.aiko}", rooms: [${J(tickL)}], value: true }); return true;`, { timeout: 60000 });
        l1 = await until(() => gm.eval(SHADE), s => s?.[tickL] === "clear");
        // Before any move of p1's: a token's step repaints p1's fog on its own, whatever the copy told it.
        p1L = await until(() => p1.eval(SHADE), s => s?.[tickL] === "veil");
        await gm.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000");
            await game.drpg.setActions(t.actor, 3); await t.actor.setFlag("${MOD}", "freeMoveUsed", false); return true;`, { timeout: 60000 });
        await settle(600);
        walkedL = await p1.eval(`const M = ${imp("movement.mjs")}; const t = game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000");
            const to = M.positionIn(${J(walkL)}, t); await t.update({ x: to.x, y: to.y }); await new Promise(r => setTimeout(r, 1500)); return M.roomOfToken(t);`, { timeout: 60000 });
        l2 = await until(() => gm.eval(SHADE), s => s?.[walkL] === "clear");
        // What storage holds of the walk, read back through the store (`persisted`): Aiko's cell, true only had the write gone in.
        stored = await gm.eval(`return (${imp("gm-store.mjs")}).gmStoreByName("discovery").persisted("${IDS.scene}/${IDS.aiko}")?.[${J(walkL)}] === true;`);
    } finally {
        await gm.eval(PUT_BACK);
        await p1.eval(PUT_BACK);
    }
    check("L1: gm's localStorage refuses the discovery store (a full origin): a Fog cell gm ticks clears its room on gm's drawn fog, and so does a room p1 walks Aiko into, though neither is stored (1.2.120 line F)",
        Boolean(tickL && walkL) && l1?.[tickL] === "clear" && walkedL === walkL && l2?.[walkL] === "clear" && stored === false, J({ tickL, walkL, walkedL, l1, l2, stored }));
    check("L2: p1's localStorage refuses its fog copy: the room gm ticked for Aiko is under the veil on p1's drawn fog, found and not stood in, before p1 moves anything (1.2.120 line F)",
        p1L?.[tickL] === "veil", J({ tickL, p1L }));

    /* ------------------------------------------------------------------ V */
    /* 1.2.122 line MURDER (the audit's STG-31): the opening's veil is the primary's to write, and on a GM who is not the
       primary the lights' veil (`veilAtTheLights`) and their end (`lightsJudged`) answered nothing, so an Eclipse ended
       there put the veil up only once the primary heard the incident's write. gm2 asks the primary now (`mask.veil`) and
       waits. A declaration of this Eclipse is written on gm for Aiko alone (`pendingMurderStore`); gm2 asks the lights'
       veil for Aiko and Botan, then ends the lights. Red at 749b35b5: gm2's veil answered 0 and gm held no row. Put back:
       the declaration, any veil left. */
    phase("V the opening's veil asked of the primary by the second GM", { flow: "mask" });
    const VEILS = `const S = ${imp("gm-stores.mjs")}; return [S.veilStore.get("${IDS.aiko}")?.why ?? null, S.veilStore.has("${IDS.botan}")];`;
    await gm.eval(`const S = ${imp("gm-stores.mjs")}; await S.pendingMurderStore.patch("${IDS.aiko}", { killerId: "${IDS.aiko}", eclipse: "SUITE122V", room: null, note: "" }); return true;`, { timeout: 30000 });
    await settle(500);
    let v1 = null, row1 = null, row2 = null;
    try {
        v1 = await gm2.eval(`return (${imp("mask-gm.mjs")}).veilAtTheLights(["${IDS.aiko}", "${IDS.botan}"]);`, { timeout: 30000 });
        row1 = await until(() => gm.eval(VEILS), r => r?.[0] === "lights");
        await gm2.eval(`await (${imp("mask-gm.mjs")}).lightsJudged(); return true;`, { timeout: 30000 });
        row2 = await until(() => gm.eval(VEILS), r => r?.[0] === null);
    } finally {
        await gm.eval(`const S = ${imp("gm-stores.mjs")}; if (S.pendingMurderStore.has("${IDS.aiko}")) await S.pendingMurderStore.drop("${IDS.aiko}");
            if (S.veilStore.get("${IDS.aiko}")) await (${imp("mask-gm.mjs")}).lightsJudged(); return true;`, { timeout: 30000 });
        await settle(500);
    }
    check("V1: gm2, not the primary, puts up the lights' veil through the primary: Aiko, who holds a declaration, veiled for the lights, Botan, who holds none, not (1.2.122, the audit's STG-31)",
        v1 === 1 && J(row1) === J(["lights", false]), J({ v1, row1 }), { flow: "mask" });
    check("V2: gm2's end of the lights lifts the veil through the primary (1.2.122, the audit's STG-31)",
        J(row2) === J([null, false]), J({ row2 }), { flow: "mask" });

    /* ------------------------------------------------------------------ I */
    /* 1.2.119 line F (the owner's item #2 of 20.11.2026: the GM's fog stopped showing the rooms the players found, F5 did
       not bring them back; two GM users, one connected). On The Forge `game.time.serverTime` is an uptime and each GM
       browser stamps on its own clock (config.mjs `epochClock`, E90), so a season reset made on the other GM's computer
       with its clock ahead writes `resetCuts.discovered` ahead of this GM's (season-exceptions.mjs `resetCutPatch`,
       through clock.mjs `setClock` here). On b5a29e73 the walk below left gm's record empty and nobody was told (I1, I2
       red); after the reload gm held only the room the token stands in, which the load's seed writes at a weak stamp. */
    phase("I a reset cut ahead of the GM's clock, the second GM away", { flow: "discovery-ledger" });
    await api.disconnect("gm2");
    await settle(1500);
    const LEDGER = `return (${imp("settings.mjs")}).discoveryLedger()?.["${IDS.scene}"]?.["${IDS.aiko}"] ?? [];`;
    const setI = await gm.eval(`const C = ${imp("clock.mjs")}, M = ${imp("movement.mjs")};
        const scene = game.scenes.get("${IDS.scene}"), t = scene.tokens.get("TOKAIKO000000000");
        await t.update(M.positionIn("Dorm A", t), { teleport: true, movementAction: "displace", animate: false });
        await game.drpg.setActions(t.actor, 3); await t.actor.setFlag("${MOD}", "freeMoveUsed", false);
        await new Promise(r => setTimeout(r, 1200));
        globalThis.__notifications.length = 0;
        const cut = Date.now() + 2 * 3600 * 1000;
        await C.setClock({ resetCuts: { ...(C.getClock().resetCuts ?? {}), discovered: cut } });
        await new Promise(r => setTimeout(r, 600));
        return { cut, from: M.roomOfToken(t), to: M.positionIn("Cafeteria", t), held: (${imp("settings.mjs")}).discoveryLedger()?.["${IDS.scene}"]?.["${IDS.aiko}"] ?? [] };`, { timeout: 60000 });
    const walkedI = await p1.eval(`const M = ${imp("movement.mjs")}; const t = game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000");
        await t.update({ x: ${setI.to?.x}, y: ${setI.to?.y} }); await new Promise(r => setTimeout(r, 3000)); return M.roomOfToken(t);`, { timeout: 60000 });
    const onGmI = await gm.eval(LEDGER);
    const toldI = await gm.eval(`return globalThis.__notifications.map(n => n.level + (n.opts?.permanent ? " (permanent)" : "") + ": " + n.msg);`);
    await reload("gm");
    await settle(2000);
    const reloadedI = await gm.eval(LEDGER);
    const onP1I = await p1.eval(LEDGER);
    check("I1: two GM users, one away, a reset's cut two hours ahead of the GM's clock: the room p1 walks Aiko into is in gm's record, after gm's reload too, and in p1's copy (1.2.119 line F)",
        setI.from === "Dorm A" && !setI.held.includes("Cafeteria") && walkedI === "Cafeteria"
            && onGmI.includes("Cafeteria") && reloadedI.includes("Cafeteria") && onP1I.includes("Cafeteria"),
        J({ setI, walkedI, onGmI, reloadedI, onP1I }));
    check("I2: gm is told once, in a notice that stays up, that the discovery store holds a reset 120 minutes ahead of its clock (1.2.119 line F)",
        toldI.filter(text => /^warn \(permanent\): /.test(text) && /"discovery"/.test(text) && /120 minutes/.test(text)).length === 1, J(toldI));

    /* ------------------------------------------------------------------ J */
    /* 1.2.119 line F, the owner's symptom as restated on 20.11.2026: "mi jako gmowi podświetla pokoje nieodkryte przez
       graczy po hide all w zakładce fog". The Fog tab has a column per student (monokuma.mjs `studentActors`), and the
       GM's map counted every character's row (fog.mjs `ledgerRooms`): on b5a29e73 Hide all and Apply left the rows of
       Chie, put out of the class, and of the Monokuma lit, ["Gym", "Hall"] (R7862). Room setup is answered as 66
       answers it: its own form, every Fog box unticked as Hide all does, then its Apply button's own callback. */
    phase("J Hide all on the Fog tab clears the GM's map", { flow: "discovery-ledger" });
    const MAP = `const F = ${imp("fog.mjs")}; const scene = game.scenes.get("${IDS.scene}"); F.repaintFog();
        return { lit: [...F.ledgerRooms(scene)].sort(), shading: F.diagnoseFog().shading ?? null };`;
    const setJ = await gm.eval(`const F = ${imp("fog.mjs")}, M = ${imp("monokuma.mjs")};
        const scene = game.scenes.get("${IDS.scene}"), chie = game.actors.get("${IDS.chie}");
        await F.setDiscovery(scene, { actorId: chie.id, rooms: ["Gym"], value: true });
        await F.setDiscovery(scene, { actorId: "ACTORMONOKUMA000", rooms: ["Hall"], value: true });
        // An actor deleted since: seven of the thirteen rows at the owner's table on 20.11.2026 were such ids.
        await F.setDiscovery(scene, { actorId: "ACTORGONE97J0000", rooms: ["Storage"], value: true });
        await M.setNotInClass(chie, true);
        await new Promise(r => setTimeout(r, 600));
        return { rows: Object.keys((${imp("settings.mjs")}).discoveryLedger()["${IDS.scene}"] ?? {}).length };`, { timeout: 60000 });
    const beforeJ = await gm.eval(MAP);
    const applied = await gm.eval(`const V = ${imp("vault.mjs")}; let boxes = 0;
        globalThis.__dialogAnswers.push(async config => {
            const ok = (config.buttons ?? []).find(b => b.action === "ok");
            const element = document.createElement("dialog"), form = document.createElement("form");
            if (typeof config.content === "string") form.innerHTML = config.content; else if (config.content) form.append(config.content.cloneNode(true));
            element.append(form);
            for (const box of form.querySelectorAll('input[type="checkbox"][name^="fog:"]')) if (!box.disabled) { box.checked = false; boxes += 1; }
            return ok.callback(new globalThis.window.Event("click"), { form }, { element });
        });
        try { await V.openRoomSetupDialog(); } finally { globalThis.__dialogAnswers.length = 0; }
        await new Promise(r => setTimeout(r, 1000));
        return boxes;`, { timeout: 60000 });
    const afterJ = await gm.eval(MAP);
    await reload("gm");
    await settle(2000);
    const reloadedJ = await gm.eval(MAP);
    const onP1J = await p1.eval(LEDGER);
    await gm.eval(`await (${imp("monokuma.mjs")}).setNotInClass(game.actors.get("${IDS.chie}"), false); return true;`, { timeout: 60000 });
    const fogged = map => ["Cafeteria", "Dorm A", "Gym", "Hall", "Storage"].every(room => map?.shading?.[room] === "fog");
    check("J1: after Hide all and Apply on Room setup's Fog tab, gm's map lights no room - its record and its shading, at once and after gm's reload - though a character out of the class, the Monokuma and a deleted actor hold rows; p1's copy is empty too (1.2.119 line F)",
        setJ.rows >= 4 && beforeJ.lit.length > 0 && applied > 0
            && afterJ.lit.length === 0 && fogged(afterJ) && reloadedJ.lit.length === 0 && fogged(reloadedJ) && onP1I.length > 0 && onP1J.length === 0,
        J({ setJ, beforeJ, applied, afterJ, reloadedJ, onP1J }));

    /* ------------------------------------------------------------------ K */
    /* A MASKED NAME KEPT CUT BY THE SECOND GM (1.2.121 line M1; the audit's CORE-20 residue and N119-4, recheck-119.json).
       1.2.119 keeps, on a GM, who stood behind a mask when a card's words came (secret.mjs `remember`'s `hid`), and cuts
       those names for a reader outside the mask when the words are served or rewritten after the mask ended without a
       reveal. A second GM away while the mask stood held no `hid`: it fetched the words from the first GM after the end
       (`askForWords` at its ready; a GM is given the words uncut) and could then serve the name in clear to a reader who
       was also away - for certain once the first GM had left. Driven here: gm2 and p2 away; gm posts a plain card naming
       Chie to p2 and both GMs (plain because no mask stands yet: one that stood would veil it, `incidentVeils`), masks
       Chie and rewrites the card while the mask stands, so gm keeps `hid`; the time of day ends the mask; gm2 comes and
       fetches the words; gm leaves; p2 comes and is served by gm2 alone (K1); gm2 rewrites the card naming Chie (K2). */
    phase("K a masked name the second GM serves after the mask ended");
    const chieName = await gm.eval(`return game.actors.get("${IDS.chie}").name;`);
    await api.disconnect("p2");
    await settle(800);
    const idK = await gm.eval(`const S = ${imp("secret.mjs")};
        const posted = await S.postSecret({ content: "<p>E120K " + foundry.utils.escapeHTML(game.actors.get("${IDS.chie}").name) + " was seen</p>",
            whisper: ["${IDS.p2}", "${IDS.gm}", "${GM2}"] });
        return posted?.id ?? null;`, { timeout: 60000 });
    const CARD_K = `const S = ${imp("secret.mjs")}; const card = () => game.messages.get(${J(idK)}) ?? null;`;
    const setK = await gm.eval(`${CARD_K} const K = ${imp("mask-gm.mjs")};
        const name = foundry.utils.escapeHTML(game.actors.get("${IDS.chie}").name);
        const masked = await K.maskKiller({ killerId: "${IDS.chie}", victimId: "${IDS.aiko}" });
        await new Promise(r => setTimeout(r, 400));
        await S.updateSecret(card(), "<p>E120K again " + name + " was seen</p>");
        const hid = (game.settings.get("${MOD}", "secretCards")?.[card()?.id]?.hid ?? []).map(r => r.id);
        const ended = await K.endMask("${IDS.chie}", "timeOfDay");
        await new Promise(r => setTimeout(r, 400));
        return { posted: Boolean(card()), masked, veiled: Boolean(card()?.flags?.["${MOD}"]?.veiled), hid, ended, stands: K.maskStands("${IDS.chie}") };`, { timeout: 60000 });
    await connect("gm2");
    const onGm2K = await until(() => gm2.eval(`${CARD_K} return S.secretHtml(card()) ?? null;`), v => typeof v === "string");
    const leftK = await makePrimary("gm2");
    await connect("p2");
    const onP2K = await until(() => p2.eval(`${CARD_K} return S.secretHtml(card()) ?? null;`), v => typeof v === "string");
    check("K1: a card rewritten naming Chie while her mask stood, fetched by gm2 after the time of day ended it, is served by gm2 to p2 - away throughout, outside the mask - with Chie as \"?\" (1.2.121 M1, CORE-20 / N119-4)",
        setK.posted && setK.masked && !setK.veiled && J(setK.hid) === J([IDS.chie]) && setK.ended && !setK.stands
            && typeof onGm2K === "string" && onGm2K.includes(chieName) && J(leftK.left) === J(["gm"])
            && typeof onP2K === "string" && onP2K.includes("E120K again") && !onP2K.includes(chieName),
        J({ setK, onGm2K, leftK: leftK.left, onP2K }));
    await p2.eval(`globalThis.__e120kGot = [];
        game.socket.on("module.${MOD}", payload => { if (payload?.action === "secret.card") globalThis.__e120kGot.push(String(payload.html ?? "")); });
        return true;`);
    await gm2.eval(`${CARD_K} await S.updateSecret(card(), "<p>E120K third " + foundry.utils.escapeHTML(game.actors.get("${IDS.chie}").name) + "</p>"); return true;`);
    const rewrittenK = await until(() => p2.eval(`return globalThis.__e120kGot.filter(h => h.includes("E120K third"));`), v => v.length > 0);
    check("K2: gm2's rewrite of the same card after the mask ended reaches p2 with Chie as \"?\"",
        rewrittenK.length > 0 && rewrittenK.every(h => !h.includes(chieName)), J(rewrittenK));
    await connect("gm");
    await until(primaryOn, on => allRead(on, IDS.gm));
    // A GM's own rewrite to the other GM carries what it kept masked (secret.mjs `sendWords`), as its answer does (K1).
    const toGm2K = await gm.eval(`${CARD_K} const socket = game.socket, send = socket.emit, got = [];
        socket.emit = function (event, packet, options, ...rest) {
            if (packet?.action === "secret.card" && (options?.recipients ?? []).includes("${GM2}")) got.push((packet.hid ?? []).map(r => r.id));
            return send.call(this, event, packet, options, ...rest);
        };
        try { await S.updateSecret(card(), "<p>E120K fourth " + foundry.utils.escapeHTML(game.actors.get("${IDS.chie}").name) + "</p>"); }
        finally { socket.emit = send; }
        return got;`);
    check("K3: gm's rewrite of the card after the mask ended sends gm2 the masked rows it kept (Chie's)",
        toGm2K.length > 0 && toGm2K.every(ids => J(ids) === J([IDS.chie])), J(toGm2K));
    /* K4 (1.2.122 line CORE; the audit of 1.2.121, r121-M-3): Chie reveals herself on gm (mask-gm.mjs `endMask` calls
       secret.mjs `forgetHeldMask` with `tell`), and gm2 - connected - forgets the same rows, so its next serve names her.
       Red at 21bf5d18: gm2 kept Chie's row, and the name stayed "?" on every card it served. */
    const heldOn = c => c.eval(`${CARD_K} return (game.settings.get("${MOD}", "secretCards")?.[card()?.id]?.hid ?? []).map(r => r.id);`);
    const heldBefore = await heldOn(gm2);
    await gm.eval(`const S = ${imp("secret.mjs")}; await S.forgetHeldMask("${IDS.chie}", { tell: true }); return true;`);
    const heldAfter = await until(() => heldOn(gm2), ids => !ids.includes(IDS.chie), 6000);
    check("K4: a reveal on gm takes the revealed killer off the masked rows gm2 keeps (r121-M-3)",
        J(heldBefore) === J([IDS.chie]) && Array.isArray(heldAfter) && !heldAfter.includes(IDS.chie), J({ heldBefore, heldAfter }));
    /* K5 (1.2.122 line CORE; the audit of 1.2.118, CORE-22 and ROLL-22): gm2, not the primary, asks Echoes and a Dash for
       Aiko as a GM playing her would. Each goes over the socket to the GMs, the primary among them, which judges it (`onPrimary`) and comes back read as a
       player's answer is (`localRun`): the reply's fields, not `{ reply }`. The Dash names no roll (a GM's roll is not
       drawn), and the judge takes a GM sender's numbers when no record names one; a total of 0 grants no crossing, so nothing
       is written.
       Red at 21bf5d18: both ran on gm2 itself, nothing was sent, and the values were `{ reply: ... }`. */
    const asked = await gm2.eval(`const B = ${imp("bridge-asks.mjs")};
        const socket = game.socket, send = socket.emit, sent = [];
        socket.emit = function (event, packet, options, ...rest) {
            if (["listen.echoes", "dash.settle"].includes(packet?.action)) sent.push([packet.action, (options?.recipients ?? []).join(",")]);
            return send.call(this, event, packet, options, ...rest);
        };
        let echoes, dash;
        try {
            echoes = await B.requestEchoes({ actorId: "${IDS.aiko}" });
            dash = await B.requestDash({ actorId: "${IDS.aiko}", total: 0 });
        } finally { socket.emit = send; }
        const shape = r => r?.ok ? Object.keys(r.value ?? {}).sort() : (r?.refused ? "refused " + r.reason : "not ok " + (r?.reason ?? ""));
        return { sent, echoes: shape(echoes), dash: shape(dash) };`, { timeout: 60000 });
    check("K5: gm2's own Echoes and Dash for a student go to the primary and come back as the run's reply (CORE-22, ROLL-22)",
        J(asked.sent.map(([action]) => action)) === J(["listen.echoes", "dash.settle"]) && asked.sent.every(([, to]) => to.split(",").includes(IDS.gm))
            && !J(asked.echoes).includes("reply") && !J(asked.dash).includes("reply")
            && Array.isArray(asked.echoes) && Array.isArray(asked.dash), J(asked));
    await gm.eval(`${CARD_K} await card()?.delete(); return true;`);
    await settle(800);

    /* ------------------------------------------------------------------ M */
    /* PLAY AND STOP THE TRACK FROM THE SECOND GM (1.2.122, the owner's decision of 21.11.2026: "Odtworz i zatrzymaj
       muzyke niech dziala u kazdego gma"). gm, the primary, makes an ambient playlist and plays it, and puts a track on
       the cue playlist; gm2 presses Play (music-play.mjs `playTrack`), then Stop the track (`resetMusic`). Read on gm,
       which keeps the music's record: the cue recorded and the ambient held after the Play, and the ambient given back
       after the Stop; and gm2's answers. Red at 21bf5d18 (and through COMM-29): gm2's Play played on gm2 and recorded
       nothing on gm; then (COMM-29) both were refused on gm2. */
    phase("M Play and Stop the track from the second GM", { flow: "music-track" });
    // The harness's CONST has no PLAYLIST_MODES, which the music engine reads: Foundry's values stood in on both GMs, as the
    // tier-2 music test stands them in, and taken off after.
    const MODES = `if (!CONST.PLAYLIST_MODES && Object.isExtensible(CONST)) { Object.defineProperty(CONST, "PLAYLIST_MODES",
        { value: { DISABLED: -1, SEQUENTIAL: 0, SHUFFLE: 1, SIMULTANEOUS: 2 }, configurable: true }); globalThis.__e122modes = true; } return true;`;
    await gm.eval(MODES);
    await gm2.eval(MODES);
    const MUSIC = `const P = ${imp("music-play.mjs")};`;
    const setM = await gm.eval(`${MUSIC} const C = ${imp("config.mjs")};
        const made = [];
        const ambient = await Playlist.create({ name: "E122M ambient", mode: CONST.PLAYLIST_MODES?.SEQUENTIAL ?? 0,
            sounds: [{ name: "E122M ambient one", path: "sounds/lock.wav" }] });
        made.push(ambient.id);
        let cue = P.situationalPlaylist();
        if (!cue) { cue = await Playlist.create({ name: C.SITUATIONAL_PLAYLIST, mode: CONST.PLAYLIST_MODES?.SEQUENTIAL ?? 0 }); made.push(cue.id); }
        const [track] = await cue.createEmbeddedDocuments("PlaylistSound", [{ name: "E122M cue", path: "sounds/notify.wav" }]);
        await ambient.playAll();
        await ambient.sounds.contents[0].update({ playing: true });
        await new Promise(r => setTimeout(r, 400));
        globalThis.__e122m = { made, ambient: ambient.id, cue: cue.id, track: track.id };
        return { ...globalThis.__e122m, playing: ambient.playing, primary: (${imp("utils.mjs")}).isPrimaryGm() };`, { timeout: 60000 });
    const playM = await gm2.eval(`${MUSIC} const U = ${imp("utils.mjs")};
        const sound = await P.playTrack(${J(setM.track)});
        return { primary: U.isPrimaryGm(), played: Boolean(sound) };`, { timeout: 60000 });
    await settle(1500);
    const afterPlayM = await gm.eval(`${MUSIC} return { interrupted: Boolean(P.musicStatus().interrupted),
        ambient: game.playlists.get(${J(setM.ambient)})?.playing ?? null,
        cue: game.playlists.get(${J(setM.cue)})?.sounds.get(${J(setM.track)})?.playing ?? null };`);
    const stopM = await gm2.eval(`${MUSIC} return await P.resetMusic();`, { timeout: 60000 });
    await settle(1500);
    const afterStopM = await gm.eval(`${MUSIC} return { interrupted: Boolean(P.musicStatus().interrupted),
        ambient: game.playlists.get(${J(setM.ambient)})?.playing ?? null,
        cue: game.playlists.get(${J(setM.cue)})?.sounds.get(${J(setM.track)})?.playing ?? null };`);
    check("M1: the second GM's Play of a cue is carried out on the primary: gm2 is told it played, and gm records the cue playing with the ambient held (the owner's decision of 21.11.2026)",
        setM.primary === true && setM.playing === true && playM.primary === false && playM.played === true
            && afterPlayM.interrupted === true && afterPlayM.cue === true && afterPlayM.ambient === false,
        J({ setM, playM, afterPlayM }));
    check("M2: the second GM's Stop the track stops the cue on the primary and gives the ambient back, and gm2 is answered what it did",
        stopM?.stopped >= 1 && stopM?.given >= 1 && afterStopM.interrupted === false && afterStopM.cue === false && afterStopM.ambient === true,
        J({ stopM, afterStopM }));
    await gm.eval(`${MUSIC} const m = globalThis.__e122m;
        for (const id of m.made) { const p = game.playlists.get(id); if (p) { await p.stopAll().catch(() => {}); await p.delete(); } }
        const cue = game.playlists.get(m.cue); if (cue) for (const s of cue.sounds.filter(s => s.name === "E122M cue")) await s.delete();
        delete globalThis.__e122m; return true;`, { timeout: 60000 });
    /* WHY A PLAY DID NOT PLAY, SAID TO THE GM WHO PRESSED (1.2.123, the audit's r122-G-6): gm2 presses Play on a track the
       cue playlist does not hold (the playlist itself is gone when the phase made it). Read: the warnings each GM was shown. Red at 14bb0d92: "Pick a track first." on gm, who
       pressed nothing, and on gm2 the bridge's "was not carried out" alone. */
    const WARNS = `globalThis.__e123warns = []; globalThis.__e123warn = ui.notifications.warn;
        ui.notifications.warn = text => { globalThis.__e123warns.push(String(text)); }; return true;`;
    const UNWARNS = `ui.notifications.warn = globalThis.__e123warn; const got = globalThis.__e123warns;
        delete globalThis.__e123warns; delete globalThis.__e123warn; return got;`;
    await gm.eval(WARNS);
    await gm2.eval(WARNS);
    const missingM = await gm2.eval(`${MUSIC} return Boolean(await P.playTrack("E123 no such track"));`, { timeout: 60000 });
    await settle(800);
    // The cue playlist is gone by now when the world had none (the phase deleted what it made): either reason is the primary's.
    const reasons = await gm.eval(`const C = ${imp("config.mjs")}; return [game.i18n.localize("DRPG.Music.noTrack"),
        game.i18n.format("DRPG.Music.noSituational", { name: C.SITUATIONAL_PLAYLIST })];`);
    const told = list => list.some(w => reasons.includes(w));
    const warnsGm = await gm.eval(UNWARNS);
    const warnsGm2 = await gm2.eval(UNWARNS);
    check("M4: the second GM's Play of a track the cue playlist does not hold (or with no cue playlist) is told why to the second GM, in its words, and not to the primary",
        missingM === false && told(warnsGm2) && !told(warnsGm), J({ missingM, warnsGm, warnsGm2 }));

    /* AND A DESPAIR CALL'S RESTRICTION FROM THE SECOND GM (1.2.122, the audit's COMM-26): gm2's Silence is asked of the
       primary (`call.world`) and written there; read on gm, and the restrictions put back on gm after (a restriction is
       lifted by the end of its time of day, call-world.mjs `clearSeals`, not by a Call). Red at d4d1ddec: the row's
       kind guard read a number, so every such ask from a GM who is not the primary was refused. */
    const W = `const W = ${imp("call-world.mjs")};`;
    const restrictionsWas = await gm.eval(`${W} return foundry.utils.deepClone(W.restrictions());`);
    const silenceN = await gm2.eval(`${W} return await W.restrict(game.actors.get("${IDS.chie}"), { silenced: true });`, { timeout: 60000 });
    await settle(1000);
    const onGmN = await gm.eval(`${W} return W.isCallSilenced(game.actors.get("${IDS.chie}"));`);
    const onGm2N = await gm2.eval(`${W} return W.isCallSilenced(game.actors.get("${IDS.chie}"));`);
    check("M3: the second GM's Silence on Chie is written by the primary, and both GMs read it (call-world.mjs `restrict` through `call.world`)",
        silenceN === true && onGmN === true && onGm2N === true, J({ silenceN, onGmN, onGm2N }));
    await gm.eval(`await game.settings.set("${MOD}", "restrictions", ${J(restrictionsWas)}); return true;`);
    const UNMODES = `if (globalThis.__e122modes) { delete CONST.PLAYLIST_MODES; delete globalThis.__e122modes; } return true;`;
    await gm.eval(UNMODES);
    await gm2.eval(UNMODES);
    await settle(800);

    /* ------------------------------ N. the Timeline on two GMs (1.2.124) ------------------------------ */
    phase("N the Timeline on two GMs: a card ruled on one leaves the other's Waiting", { flow: "messenger" });
    const APP = `const A = ${imp("messenger-app.mjs")};`;
    const OPEN_CONSOLE = `${APP} const app = A.openMessenger(); const end = Date.now() + 3000;
        while (!app?.element?.querySelector(".drpg-console") && Date.now() < end) await new Promise(r => setTimeout(r, 50));
        return Boolean(app?.element?.querySelector(".drpg-console"));`;
    const consoleOpen = { gm: await gm.eval(OPEN_CONSOLE), gm2: await gm2.eval(OPEN_CONSOLE) };
    const WORDS_E124 = `E124 console ${Date.now()}`;
    const askedC = await p1.eval(`const C = ${imp("call-gm.mjs")}; const P = ${imp("action-pipeline.mjs")};
        const actor = game.actors.get("${IDS.aiko}");
        return Boolean(await C.callGm(actor, { title: "E124 N", request: ${J(WORDS_E124)}, actions: [P.ruledMissAction(actor), P.declineAction(actor, null)] }));`,
        { timeout: 60000 });
    await settle(1200);
    // What a GM's Timeline shows of the card: in Waiting (and its live buttons), in the stream.
    const SHOWN = `${APP} const S = ${imp("secret.mjs")}; const M = ${imp("messenger.mjs")};
        const card = M.threadMessages("${IDS.p1}").find(m => S.contentOf(m).includes(${J(WORDS_E124)}));
        const el = A.gmMessengerWindow()?.element;
        const waiting = card ? el?.querySelector('.drpg-console-waiting-list [data-message-id="' + card.id + '"]') : null;
        return { id: card?.id ?? null, waiting: Boolean(waiting), buttons: waiting?.querySelectorAll("[data-drpg-call]").length ?? 0,
            stream: Boolean(card && el?.querySelector('.drpg-console-stream-list [data-message-id="' + card.id + '"]')) };`;
    const c1 = await until(async () => ({ gm: await gm.eval(SHOWN), gm2: await gm2.eval(SHOWN) }), v => v.gm.waiting && v.gm2.waiting);
    check("N1: p1's card waits in the Timeline of both GMs, with its two answers live, and is in both streams",
        consoleOpen.gm && consoleOpen.gm2 && askedC && Boolean(c1.gm.id) && c1.gm.id === c1.gm2.id && c1.gm.buttons === 2 && c1.gm2.buttons === 2
            && c1.gm.stream && c1.gm2.stream, J({ consoleOpen, askedC, c1 }), { flow: "messenger" });
    const ruled = await gm.eval(`${APP} const button = A.gmMessengerWindow()?.element
            ?.querySelector('.drpg-console-waiting-list [data-message-id="${c1.gm.id}"] [data-drpg-call="decline"]');
        button?.click(); return Boolean(button);`);
    const c2 = await until(async () => ({ gm: await gm.eval(SHOWN), gm2: await gm2.eval(SHOWN) }), v => !v.gm.waiting && !v.gm2.waiting, 10000);
    check("N2: gm answers the card from its Timeline; it leaves Waiting on gm and on gm2, and stays in both streams",
        ruled && !c2.gm.waiting && !c2.gm2.waiting && c2.gm.stream && c2.gm2.stream, J({ ruled, c2 }), { flow: "messenger" });
    for (const client of [gm, gm2]) await client.eval(`${APP} await A.gmMessengerWindow()?.close(); return true;`);
    await settle(400);

    /* ------------------------------------------------------------------ O */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM, the owner: "Drugi GM ... powinien byc na rowni z pierwszym gmem"; line CORE's
       inventory row 2). The opening roll a second GM throws itself - its roller has no player at the table, the murder
       opened by that GM - was resolved on that GM's browser, where the opening's mask and the Monocubs' witness marks are
       the primary's alone (mask-gm.mjs `maskKiller`, monocub.mjs `markWitnessesAt`): an opening on Hope put up no "?" for
       the killer. gm2 opens Daichi's murder of Aiko - Daichi has no player, so gm2's own browser throws the opening
       (murder-rules.mjs `rollOpening`), on Hope by its dice (`__forceRoll`). Read on gm: the incident's stage before and
       after, and whether Daichi's mask stands. Red at ed0b1ad3's parent (9eb89710): the stage moved on, no mask. An
       earlier version of this phase had p3's own Chie answer the invitation first, a race (1 in 2 runs). The wait reads both
       facts since 22.11.2026: one run at 1c546cae read the mask up while the stage's write had not landed on gm yet (stage
       "openingRoll", masked true), a wait that ended on the mask alone. */
    phase("O a second GM's own opening roll", { flow: "murder-incident" });
    const opened = await gm2.eval(`if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false });
        globalThis.__forceRoll = { hope: 11, fear: 5 };
        try {
            const r = await game.drpg.openMurder({ killerId: "${IDS.daichi}", victimId: "${IDS.aiko}", openingTrait: "body" });
            return r?.stage ?? null;
        } finally { /* the throw is started by openMurder; the dice are taken off once it has landed, below */ }`, { timeout: 60000 });
    const after = await until(() => gm.eval(`const K = ${imp("mask-gm.mjs")};
        return { stage: game.drpg.murderState()?.stage ?? null, masked: K.maskStands("${IDS.daichi}") };`),
        v => v.masked === true && v.stage !== "openingRoll", 10000);
    await gm2.eval(`delete globalThis.__forceRoll; return true;`);
    await gm.eval(`const K = ${imp("mask-gm.mjs")};
        if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false });
        if (K.maskStands("${IDS.daichi}")) await K.endMask("${IDS.daichi}", "end");
        return true;`, { timeout: 60000 });
    await settle(900);
    check("O1: gm2's own opening roll for a killer with no player, on Hope, is resolved on the primary: the stage moves on and the killer's mask stands (E128)",
        opened === "openingRoll" && after.masked === true && after.stage !== opened, J({ opened, after }), { flow: "murder-incident" });

    /* ------------------------------------------------------------------ P */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM, line CORE's inventory row 5). A Call's yes and a Dynamic action's refusal on an
       ask the primary no longer holds: on the primary the card says the player was no longer waiting and settles; on a
       second GM the primary's refusal came back as the bridge's "not done" and the card stayed open with live buttons. p1
       posts two cards whose answers name an ask nobody holds; gm2 presses Approve on the first and Refuse on the second, in
       its Timeline. Read on gm: whether each card settled with the line the primary writes ("settledGone"), and on gm2 how
       many "not done" notices it was shown. Red at ed0b1ad3: neither settled, two notices. */
    phase("P a second GM's answer to an ask the primary no longer holds", { flow: "messenger" });
    const NOT_DONE = `const N = ${imp("notice-history.mjs")}; return N.noticeEntries().filter(e => e.source === "notDone").length;`;
    await gm2.eval(`${APP} const app = A.openMessenger(); const end = Date.now() + 3000;
        while (!app?.element?.querySelector(".drpg-console") && Date.now() < end) await new Promise(r => setTimeout(r, 50)); return true;`);
    const notDoneBefore = await gm2.eval(NOT_DONE);
    const gone = await gm.eval(`return game.i18n.format("DRPG.Bridge.settledGone", { name: "${"Second GM"}" });`);
    const stale = [];
    for (const [press, label] of [["approveCall", "Approve"], ["refuseDynamic", "Refuse"]]) {
        const words = `E128 P ${press} ${Date.now()}`;
        await p1.eval(`const C = ${imp("call-gm.mjs")};
            return Boolean(await C.callGm(game.actors.get("${IDS.aiko}"), { title: "E128 P", request: ${J(words)},
                actions: [{ action: "${press}", label: "${label}", data: { rid: "E128STALE${press}", asker: "${IDS.p1}" } }] }));`, { timeout: 60000 });
        await settle(1200);
        const FIND = `const S = ${imp("secret.mjs")}; const M = ${imp("messenger.mjs")};
            const card = M.threadMessages("${IDS.p1}").find(m => S.contentOf(m).includes(${J(words)}));`;
        const pressed = await gm2.eval(`${FIND} ${APP} const el = A.gmMessengerWindow()?.element;
            const b = card ? el?.querySelector('.drpg-console-waiting-list [data-message-id="' + card.id + '"] [data-drpg-call="${press}"]') : null;
            b?.click(); return Boolean(b);`);
        const read = await until(() => gm.eval(`${FIND} const text = S.contentOf(card ?? {});
            return { buttons: (text.match(/data-drpg-call=/g) ?? []).length, gone: text.includes(${J(gone)}) };`), v => v.gone, 8000);
        stale.push({ press, pressed, ...read });
    }
    const notDone = (await gm2.eval(NOT_DONE)) - notDoneBefore;
    await gm2.eval(`${APP} await A.gmMessengerWindow()?.close(); return true;`);
    check("P1: gm2's Approve on a Call and Refuse on a Dynamic action the primary no longer holds settle each card as the primary does - the player was no longer waiting - and no \"not done\" is shown (E128)",
        stale.length === 2 && stale.every(r => r.pressed && r.gone && r.buttons === 0) && notDone === 0, J({ stale, notDone, gone }), { flow: "messenger" });

    /* ------------------------------------------------------------------ Q */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM, line CORE's inventory row 3). A second full GM's announcement of a body was
       refused (`DRPG.Chapter.bodyPrimaryOnly`); it is carried out on the primary now (`body.discover`). Daichi's death kept by
       the GMs; gm2 announces it in a room no region has (17-assistant F1's fixture, with a second full GM in place of the
       Assistant), then gm presses too. Read on gm: the discovery cards the presses added and their authors, the stamp rows
       added; on gm2: what its call answered, and whether it was told whose the announcement is. Put back after. Red at
       9eb89710: gm2 told, its press announcing nothing, and the one card gm's own. */
    phase("Q a second GM announces a body", { flow: "body-discovery" });
    const CH = `(await import("${REPO}/scripts/chapter.mjs"))`;
    const bodyCards = `game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound")`;
    const stampRows = `Object.values(game.settings.get("${MOD}", "bodiesFound") ?? {}).flat().length`;
    const q0 = await gm.eval(`const kept = Boolean(await ${CH}.killCharacter(game.actors.get("${IDS.daichi}"), { secret: true, keepBullets: true }));
        return { kept, scene: canvas.scene.id, cards: ${bodyCards}.map(m => m.id), rows: ${stampRows},
            stamps: foundry.utils.deepClone(game.settings.get("${MOD}", "bodiesFound") ?? {}), hold: game.settings.get("${MOD}", "bodyFound") ?? {} };`);
    await settle(800);
    const gm2Mark = await gm2.eval(`return globalThis.__notifications.length;`);
    const announceOn = c => c.eval(`return Boolean(await ${CH}.discoverBody({ room: "E128 Q a room no region has",
        victim: game.actors.get("${IDS.daichi}"), scene: game.scenes.get("${q0.scene}") }));`, { timeout: 60000 });
    try {
        // gm2 alone first - the one card must be its press's, made on the primary - then gm's own, which finds it announced.
        const pressed = [await announceOn(gm2)];
        await settle(1500);
        pressed.push(await announceOn(gm));
        await settle(1200);
        const q1 = { kept: q0.kept, pressed,
            ...await gm.eval(`const before = new Set(${J(q0.cards)});
                return { cards: ${bodyCards}.filter(m => !before.has(m.id)).map(m => m.author?.id ?? m.user?.id ?? null), rows: ${stampRows} - ${q0.rows} };`),
            told: await gm2.eval(`const said = game.i18n.format("DRPG.Chapter.bodyPrimaryOnly", { name: game.users.get("${IDS.gm}")?.name ?? "?" });
                return globalThis.__notifications.slice(${gm2Mark}).some(n => n.msg === said);`) };
        check("Q1: gm2's announcement of a body is carried out on the primary - one card, written by gm, and one stamp row - and gm2 is not told it is the primary's; gm's own press after it adds nothing (E128)",
            q1.kept && q1.pressed[0] === true && J(q1.cards) === J([IDS.gm]) && q1.rows === 1 && q1.told === false, J(q1), { flow: "body-discovery" });
    } finally {
        await gm.eval(`const C = ${CH}; const a = game.actors.get("${IDS.daichi}");
            if (C.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true });
            await game.settings.set("${MOD}", "bodyFound", ${J(q0.hold)});
            await game.settings.set("${MOD}", "bodiesFound", ${J(q0.stamps)}); return true;`);
        await settle(600);
    }

    /* ------------------------------------------------------------------ R */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM, line CORE's inventory row 1). A find's words were asked on the window of the
       browser the find is resolved on, the primary's, and a second GM was only whispered that it waited. The whisper carries
       "Write it here" now. gm places a trace in Dorm A and opens its describing window for Aiko's find as an Observe's
       resolution does (observe.mjs `describeFind`), its window drawn and left unanswered; gm2 finds the whisper, wires it as
       its log would (`wireDescribeHere`), presses the button and answers its own window. Read: what gm's wait answered (the
       find's words), and whether gm2's button left its copy of the card. Red at 9eb89710: no button on the whisper. */
    phase("R a second GM writes a find's words", { flow: "search-observe" });
    const WORDS = { name: "E128 R the words gm2 wrote", playerText: "E128 R what the student sees", analyzedText: "E128 R the reading" };
    const placed = await gm.eval(`const R = ${imp("remnants.mjs")}, OB = ${imp("observe.mjs")};
        const scene = canvas.scene, t = await R.placeRemnant({ type: "prep", visibility: "evident", scene, x: 400, y: 400, room: "Dorm A", note: "E128 R" });
        if (!t) return null;
        globalThis.__e128rWas = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        globalThis.__e128rHad = new Set(game.messages.contents.map(m => m.id));
        const entry = { sceneId: scene.id, tokenId: t.id, room: "Dorm A", data: R.remnantData(R.remnantById(scene.id, t.id)) };
        globalThis.__e128r = { done: false, answer: null };
        OB.describeFind(game.actors.get("${IDS.aiko}"), entry, false, "E128 R fallback", null, { waitMs: 30000 })
            .then(a => { globalThis.__e128r = { done: true, answer: a }; }, () => { globalThis.__e128r = { done: true, answer: "threw" }; });
        return { scene: scene.id, token: t.id };`, { timeout: 60000 });
    await settle(1500);
    const pressed = placed ? await gm2.eval(`const S = ${imp("secret.mjs")}, OB = ${imp("observe.mjs")};
        const end = Date.now() + 8000; let card = null;
        while (!card && Date.now() < end) { card = game.messages.contents.find(m => String(S.contentOf(m) ?? "").includes("${placed.token}") && String(S.contentOf(m) ?? "").includes("data-drpg-describe-find")); if (!card) await new Promise(r => setTimeout(r, 100)); }
        if (!card) return { card: false };
        const body = document.createElement("div"); body.innerHTML = S.contentOf(card); document.body.append(body);
        if (typeof OB.wireDescribeHere === "function") OB.wireDescribeHere(body);
        globalThis.__dialogAnswers.push(() => (${J(WORDS)}));
        const button = body.querySelector("[data-drpg-describe-find]"); button?.click();
        const until = Date.now() + 10000;
        while (body.querySelector("[data-drpg-describe-find]") && Date.now() < until) await new Promise(r => setTimeout(r, 100));
        const left = Boolean(body.querySelector("[data-drpg-describe-find]")); body.remove(); globalThis.__dialogAnswers.length = 0;
        return { card: true, clicked: Boolean(button), left };`, { timeout: 60000 }) : null;
    const waited = await until(() => gm.eval(`return globalThis.__e128r;`), v => v?.done === true, 10000);
    await gm.eval(`const R = ${imp("remnants.mjs")}; globalThis.__dialogWindows = globalThis.__e128rWas;
        for (const w of Object.values(ui.windows ?? {})) if (String(w?.title ?? w?.options?.window?.title ?? "") === game.i18n.localize("DRPG.Observe.describeTitle")) await w.close?.();
        const t = canvas.scene.tokens.get("${placed?.token ?? ""}"); if (t) { await R.dropRemnantSecret(t); await t.delete(); }
        return true;`, { timeout: 60000 });
    await settle(600);
    check("R1: gm2's Write it here on a find waiting on gm's window gives the find gm2's words, and its button leaves gm2's card (E128)",
        Boolean(placed) && pressed?.card === true && pressed.clicked === true && pressed.left === false && waited?.done === true
            && waited.answer?.name === WORDS.name && waited.answer?.playerText === WORDS.playerText && waited.answer?.analyzedText === WORDS.analyzedText,
        J({ placed, pressed, waited }), { flow: "search-observe" });

    /* ------------------------------------------------------------------ S */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM, line CORE's inventory row 8). Fix voice was drawn disabled on a GM that is not
       the primary: the rooms are the primary's to send. gm2's press is asked of the primary now (voice.mjs
       `resetVoiceFromHere`, `voice.reset`). With LiveKit's module stood in as active on gm alone (voice-client.mjs
       `avclientActive` reads the module's `active`), gm2 presses: read what it answered - how many the primary sent, a number -
       and, the module stood in as inactive on gm, that the primary's refusal comes back as null; gm's own entry put back. Red at 9eb89710: no
       `resetVoiceFromHere`. */
    phase("S a second GM's Fix voice", { flow: "voice" });
    const AV = "avclient-livekit";
    await gm.eval(`globalThis.__e128sHad = game.modules.get("${AV}") ?? null; game.modules.set("${AV}", { id: "${AV}", active: true }); return true;`);
    let sentOn = null, refusedOn = null;
    const PRESS = `const V = ${imp("voice.mjs")}; return typeof V.resetVoiceFromHere === "function" ? await V.resetVoiceFromHere() : "none";`;
    try {
        sentOn = await gm2.eval(PRESS, { timeout: 60000 });
        await gm.eval(`game.modules.set("${AV}", { id: "${AV}", active: false }); return true;`);
        refusedOn = await gm2.eval(PRESS, { timeout: 60000 });
    } finally {
        await gm.eval(`const had = globalThis.__e128sHad; if (had) game.modules.set("${AV}", had); else game.modules.delete("${AV}"); return true;`);
    }
    check("S1: gm2's Fix voice is sent by the primary - a count with LiveKit active on gm, null without (E128)",
        Number.isFinite(sentOn) && refusedOn === null, J({ sentOn, refusedOn }), { flow: "voice" });

    /* ------------------------------------------------------------------ T */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM; scenario 61 F9b, at the coordinator's ask). The opening's request card to its
       player was posted on whichever GM asked, after a read of the GMs' memo of the cards (`openingCardStandsFor`) that the
       post did not hold: two asks on one browser both read it before either card was made, and a second GM read a memo the
       primary's card had not reached yet. gm2 opens Aiko's murder of Botan - Aiko is p1's, so the opening goes to p1, whose
       roll is held - and asks the opening again twice while the murder's own ask is in flight, as a tracker's re-ask and a
       ready's do. Read on gm: the cards to p1 posted since, by their words (secret.mjs `wordsOf`), and their authors. Red at
       1c546cae: three cards, each gm2's. The card is the primary's to post now (murder-rules.mjs `postOpeningCard`, asked
       with `murder.openingCard`), and the primary holds it in flight from the memo's read to its write. */
    phase("T the opening's card posted once, by the primary, whoever asks", { flow: "murder-incident" });
    await p1.eval(`globalThis.__e128tHeld = []; const a = game.actors.get("${IDS.aiko}");
        globalThis.__e128tKept = Object.hasOwn(a, "rollTrait") ? a.rollTrait : null;
        a.rollTrait = function () { return new Promise(r => globalThis.__e128tHeld.push(r)); }; return true;`);
    const tFrom = await gm.eval(`return game.messages.contents.length;`);
    const YOURS = `const S = ${imp("secret.mjs")}; const yours = game.i18n.localize("DRPG.Murder.openingYours"), cards = [];
        for (const m of game.messages.contents.slice(${tFrom})) if (String(await S.wordsOf(m, 500) ?? "").includes(yours)) cards.push(m.author?.id ?? m.user?.id ?? null);
        return cards;`;
    let tOpened = null, tCards = null;
    try {
        tOpened = await gm2.eval(`if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false });
            const R = ${imp("murder-rules.mjs")};
            const r = await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.botan}", openingTrait: "body" });
            const again = await Promise.all([R.rollOpening("killer", game.drpg.murderState()), R.rollOpening("killer", game.drpg.murderState())]);
            return { stage: r?.stage ?? null, again: again.map(a => a?.asked ?? null) };`, { timeout: 60000 });
        await until(() => gm.eval(YOURS), v => v.length > 0, 8000);
        await settle(1500);
        tCards = await gm.eval(YOURS);
    } finally {
        await gm.eval(`if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false }); return true;`, { timeout: 60000 });
        await p1.eval(`const a = game.actors.get("${IDS.aiko}"); if (globalThis.__e128tKept) a.rollTrait = globalThis.__e128tKept; else delete a.rollTrait;
            for (const r of globalThis.__e128tHeld ?? []) r(null); delete globalThis.__e128tHeld; delete globalThis.__e128tKept; return true;`);
        await settle(900);
    }
    check("T1: gm2's murder and two more asks of its opening while the first is in flight post one card to the killer's player, written by the primary (E128)",
        tOpened?.stage === "openingRoll" && J(tOpened.again) === J([true, true]) && J(tCards) === J([IDS.gm]), J({ tOpened, tCards }), { flow: "murder-incident" });

    /* ------------------------------------------------------------------ U */
    /* E128, 22.11.2026 (OWNER-128-SECOND-GM, line CORE's inventory row 6, at the coordinator's ask). A verdict stopped half
       way whose GM has left is the primary's to finish (verdict.mjs `verdictRunner`), and a second full GM's Finish was
       greyed on the trial console and refused in `finishVerdict`; it is asked of the primary now (`finishRoute`,
       `verdict.finish`). R8732 reads the route alone, and could not see the greyed button (fixed in 1c546cae). gm writes
       the stopped verdict as tier 2's E10 G2 does - every step done but the bets, its GM a user who is not there; gm2 opens
       the trial console and presses Finish as its footer offers it (a greyed button is not pressed). Read: the button on
       gm2, and on gm the verdict's stage, who finished it and the verdict summaries posted since. Red at 9eb89710: greyed,
       not pressed, the verdict still applying. */
    phase("U a second GM's Finish of a verdict the primary runs", { flow: "class-trial" });
    const VOTE = imp("vote.mjs");
    const uFrom = await gm.eval(`return game.messages.contents.length;`);
    await gm.eval(`const V = ${VOTE}, C = ${imp("settings.mjs")};
        globalThis.__e128uKept = foundry.utils.deepClone(game.settings.get("${MOD}", "trialProgress") ?? {});
        await game.settings.set("${MOD}", "trialProgress", { ...V.trialProgress(), chapter: C.getClock().chapter, verdictApplied: false, executedAt: null, execution: null });
        await V.setTrialProgress({ voteClosed: true, verdictApplied: true, verdict: { stage: "applying", correct: true, executedIds: [], by: "E128U a GM who left",
            at: Date.now(), done: ["sentence", "executions", "card", "levelUps", "overflow"], failed: [] } });
        return true;`, { timeout: 60000 });
    let uSeen = null, uAfter = null;
    try {
        await until(() => gm2.eval(`return (${VOTE}).trialProgress().verdict?.stage ?? null;`), v => v === "applying", 6000);
        uSeen = await gm2.eval(`const UI = ${imp("trial-floor-ui.mjs")}; const D = foundry.applications.api.DialogV2;
            const kept = Object.getOwnPropertyDescriptor(D, "wait"); let seen = null, consoles = 0;
            D.wait = async cfg => {
                if (!(cfg?.classes ?? []).includes("drpg-window-trial") || consoles++) return null;
                const b = (cfg?.buttons ?? []).find(x => x.action === "finishVerdict");
                seen = { shown: Boolean(b), disabled: Boolean(b?.disabled), runner: (${VOTE}).verdictRunner() };
                return b && !b.disabled ? "finishVerdict" : null;
            };
            try { await UI.manageClassTrial(); } finally { if (kept) Object.defineProperty(D, "wait", kept); else delete D.wait; }
            return seen;`, { timeout: 60000 });
        uAfter = await until(() => gm.eval(`const v = (${VOTE}).trialProgress().verdict ?? {}; return { stage: v.stage ?? null, by: v.by ?? null };`),
            v => v.stage === "done", 10000);
        await settle(900);
        uAfter.summaries = await gm.eval(`const S = ${imp("secret.mjs")}; const title = game.i18n.localize("DRPG.Vote.verdictTitle"); let n = 0;
            for (const m of game.messages.contents.slice(${uFrom})) if (String(await S.wordsOf(m, 1000) ?? "").includes(title)) n++;
            return n;`);
    } finally {
        await gm.eval(`await game.settings.set("${MOD}", "trialProgress", globalThis.__e128uKept); delete globalThis.__e128uKept; return true;`);
        await settle(600);
    }
    check("U1: gm2's console offers Finish live on a verdict the primary runs, and its press finishes it once, on gm (E128)",
        uSeen?.shown === true && uSeen.disabled === false && uSeen.runner === IDS.gm && uAfter?.stage === "done" && uAfter.by === IDS.gm
            && uAfter.summaries === 1, J({ uSeen, uAfter }), { flow: "class-trial" });

    /* ------------------------------------------------------------------ W */
    /* E128, 23.11.2026 (the owner's session-0 notes: "kazdy gm ma byc rowny - moc zrobic tyle samo, ile pierwszy/glowny gm.
       upewnijmy sie ze tak jest"; the inventory's "Not covered yet"). The windows the inventory had not read, each pressed
       once on gm2 and read where it lands: the item hub's give (inventory.mjs `grantItem`) on p1's sheet and in the primary's
       sheet audit; the Rules window's rule (rules.mjs `addRule`) on gm; the Mastermind window's pick and lair
       (mastermind.mjs `setMastermind`) on the pick's player, p2 (`myLairRoom`); and the Passages tab's grant and revoke
       (passages-gm.mjs `grantPassage`, `revokePassage`) on p1's copy (passages.mjs `knownPassages`), on a passage gm makes
       as scenario 76 A does. Each is put back after. */
    phase("W a second GM in the item hub, the Rules and Mastermind windows and the Passages tab", { flow: "secret-passages" });
    const WIN = { item: null, rule: null, door: null, passage: null };
    const itemName = `E128 WIN given by gm2 ${Date.now()}`;
    try {
        const given = await gm2.eval(`const INV = ${imp("inventory.mjs")};
            const item = await INV.grantItem(game.actors.get("${IDS.aiko}"), { name: ${J(itemName)}, category: "tool", tier: 1 });
            return Boolean(item);`, { timeout: 60000 });
        await settle(1500);
        WIN.item = { given,
            p1: await p1.eval(`return game.actors.get("${IDS.aiko}").items.some(i => i.name === ${J(itemName)});`),
            audit: await gm.eval(`const A = ${imp("sheet-audit.mjs")}; return JSON.stringify(A.sheetWrites({ quiet: true }) ?? null).includes(${J(itemName)});`) };
    } finally {
        await gm.eval(`const a = game.actors.get("${IDS.aiko}"); const ids = a.items.filter(i => i.name === ${J(itemName)}).map(i => i.id);
            if (ids.length) await a.deleteEmbeddedDocuments("Item", ids); return true;`, { timeout: 60000 });
    }
    const ruleText = `E128 WIN a rule gm2 wrote ${Date.now()}`;
    try {
        await gm2.eval(`const R = ${imp("rules.mjs")}; await R.addRule(${J(ruleText)}); return true;`, { timeout: 60000 });
        WIN.rule = await until(() => gm.eval(`const R = ${imp("rules.mjs")}; return R.rules().some(r => String(r?.text ?? r) === ${J(ruleText)});`), v => v === true, 6000);
    } finally {
        await gm.eval(`const R = ${imp("rules.mjs")}; for (const r of R.rules().filter(r => String(r?.text ?? r) === ${J(ruleText)})) await R.removeRule(r.id); return true;`, { timeout: 60000 });
    }
    const mmWas = await gm.eval(`const S = ${imp("gm-stores.mjs")}; await S.mastermindStore.whenHydrated(); const r = S.mastermindStore.get("record") ?? {};
        return { actorId: r.actorId ?? null, room: r.room ?? null };`);
    try {
        await gm2.eval(`const MM = ${imp("mastermind.mjs")}; await MM.setMastermind(game.actors.get("${IDS.botan}"), { room: "Kitchen" }); return true;`, { timeout: 60000 });
        WIN.door = { was: mmWas, p2: await until(() => p2.eval(`return (${imp("mastermind.mjs")}).myLairRoom() ?? null;`), v => v === "Kitchen", 8000),
            gm: await gm.eval(`const S = ${imp("gm-stores.mjs")}; return S.mastermindStore.get("record")?.actorId ?? null;`) };
    } finally {
        await gm.eval(`const MM = ${imp("mastermind.mjs")}; const was = ${J(mmWas)};
            if (was.actorId) await MM.setMastermind(game.actors.get(was.actorId), { room: was.room }); else await MM.clearMastermind(); return true;`, { timeout: 60000 });
        await settle(900);
    }
    const wallId = await gm.eval(`const scene = game.scenes.get("${IDS.scene}");
        const [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [1100, 400, 1400, 400] }]); return wall?.id ?? null;`);
    let passageId = null;
    try {
        passageId = wallId ? await gm.eval(`const scene = game.scenes.get("${IDS.scene}");
            const cafe = scene.regions.find(r => r.name === "Cafeteria"), shapes = foundry.utils.deepClone(cafe._source.shapes), [box] = shapes;
            await cafe.update({ shapes: [{ ...box, height: 400 - box.y }] });
            const [pantry] = await scene.createEmbeddedDocuments("Region", [{ name: "Pantry", behaviors: [],
                shapes: [{ ...box, y: 400, height: box.y + box.height - 400 }], flags: { "${MOD}": { room: true } } }]);
            let id = null;
            try { id = await game.drpg.passages.create({ sceneId: scene.id, wallId: "${wallId}", seg: { x1: 1200, y1: 400, x2: 1300.5, y2: 400 } }); }
            finally { await scene.deleteEmbeddedDocuments("Region", [pantry.id]); await cafe.update({ shapes }); }
            return id;`, { timeout: 60000 }) : null;
        await settle(900);
        const KNOWN = `const P = ${imp("passages.mjs")}; return Object.keys(P.knownPassages() ?? {}).includes("${passageId}");`;
        const granted = passageId ? await gm2.eval(`return await game.drpg.passages.grant("${passageId}", "${IDS.aiko}");`, { timeout: 60000 }) : null;
        const known = await until(() => p1.eval(KNOWN), v => v === true, 8000);
        const revoked = passageId ? await gm2.eval(`return await game.drpg.passages.revoke("${passageId}", "${IDS.aiko}");`, { timeout: 60000 }) : null;
        const gone = await until(() => p1.eval(KNOWN), v => v === false, 8000);
        WIN.passage = { passageId, granted, known, revoked, gone };
    } finally {
        await gm.eval(`if (${J(passageId)}) await game.drpg.passages.delete(${J(passageId)});
            const wall = game.scenes.get("${IDS.scene}").walls.get(${J(wallId)}); if (wall) await wall.delete(); return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("W1: gm2's item from the item hub lands on p1's sheet and is no write the primary's sheet audit lists (E128)",
        WIN.item?.given === true && WIN.item.p1 === true && WIN.item.audit === false, J(WIN.item), { flow: "sheet-audit" });
    check("W2: gm2's rule from the Rules window stands on gm (E128)", WIN.rule === true, J(WIN.rule));
    check("W3: gm2's Mastermind and lair from the Mastermind window reach the pick's player, p2, and stand in gm's record (E128)",
        WIN.door?.p2 === "Kitchen" && WIN.door.gm === IDS.botan, J(WIN.door), { flow: "mastermind" });
    check("W4: gm2's grant and revoke of a passage from the Passages tab reach p1's copy, each way (E128)",
        typeof WIN.passage?.passageId === "string" && WIN.passage.granted === true && WIN.passage.known === true && WIN.passage.revoked === true && WIN.passage.gone === false,
        J(WIN.passage), { flow: "secret-passages" });

    /* ------------------------------------------------------------------ X */
    /* E128, 23.11.2026 (S0-GMEQUAL, the two smaller differences W's reading found; the coordinator: "fix both"). X1: the
       roller's "the GM is choosing" line, posted by each GM that opened the opening's pick window (murder-rules.mjs
       `tellOpeningRoller`). gm2 opens Aiko's murder of Botan with no statistic picked - its window opens, and is closed -
       then gm asks the opening again as its tracker does, and its window is closed too. Read on gm: the lines to the
       roller posted since, by their words, and their authors. Red at 01c4c2e3: two lines, gm2's and gm's. The line is
       the primary's to post once now (`postOpeningCard`'s `pick`, through `murder.openingCard`).
       X2: the Passages tab's "not yet sent to" line, drawn on the primary alone (passages-gm.mjs `undeliveredOf`
       answered null elsewhere). p2 leaves; gm makes a passage as W does and grants it to Botan, whose only player is
       away; then p2 comes back. Read on both GMs while p2 is away and after it is back: the students the line names.
       Red at 01c4c2e3: gm2's null both times. The primary sends the other GMs what the players were sent
       (`tellGmsTold`), and another GM reads that. */
    phase("X a second GM's opening line and Passages tab, as the primary's", { flow: "murder-incident" });
    const PICK_NULL = `const T = game.i18n.localize("DRPG.TraitRuling.title");
        globalThis.__dialogAnswers.push(cfg => (cfg?.window?.title === T ? null : ((cfg?.buttons ?? []).find(b => b.default) ?? cfg?.buttons?.[0])?.action ?? null));`;
    /* The lines are read in the GMs' memo of the opening's notices, where each is kept as `true` (incident-store.mjs
       `keepOpeningNotice`), and their authors off the chat; a read of their words found none (`wordsOf` on the veiled
       announcement, measured 23.11.2026: [] on both trees while the memo held one line and two). */
    const CHOOSING = `const S = ${imp("gm-stores.mjs")};
        return Object.entries(S.castStore.record()?.openingNotices ?? {}).filter(([, to]) => to === true)
            .map(([id]) => { const m = game.messages.get(id); return m ? m.author?.id ?? m.user?.id ?? null : "gone"; });`;
    let xLines = null, xOpened = null;
    try {
        xOpened = await gm2.eval(`if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false });
            ${PICK_NULL} const r = await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.botan}" });
            return { stage: r?.stage ?? null, trait: r?.openingTrait ?? null };`, { timeout: 60000 });
        await until(() => gm.eval(CHOOSING), v => v.length > 0, 8000);
        await settle(1200);
        await gm.eval(`const R = ${imp("murder-rules.mjs")}; ${PICK_NULL} await R.rollOpening("killer", game.drpg.murderState()); return true;`, { timeout: 60000 });
        await settle(1500);
        xLines = await gm.eval(CHOOSING);
    } finally {
        await gm.eval(`if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false }); return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("X1: the roller's \"the GM is choosing\" line is posted once, by the primary, though two GMs each opened the pick's window (E128)",
        xOpened?.stage === "openingRoll" && J(xLines) === J([IDS.gm]), J({ xOpened, xLines }), { flow: "murder-incident" });

    const xWall = await gm.eval(`const scene = game.scenes.get("${IDS.scene}");
        const [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [1100, 400, 1400, 400] }]); return wall?.id ?? null;`);
    let xPassage = null, xPending = null;
    const PENDING = id => `const G = ${imp("passages-gm.mjs")}; return G.undeliveredOf(${J(id)});`;
    try {
        xPassage = xWall ? await gm.eval(`const scene = game.scenes.get("${IDS.scene}");
            const cafe = scene.regions.find(r => r.name === "Cafeteria"), shapes = foundry.utils.deepClone(cafe._source.shapes), [box] = shapes;
            await cafe.update({ shapes: [{ ...box, height: 400 - box.y }] });
            const [pantry] = await scene.createEmbeddedDocuments("Region", [{ name: "Pantry", behaviors: [],
                shapes: [{ ...box, y: 400, height: box.y + box.height - 400 }], flags: { "${MOD}": { room: true } } }]);
            let id = null;
            try { id = await game.drpg.passages.create({ sceneId: scene.id, wallId: "${xWall}", seg: { x1: 1200, y1: 400, x2: 1300.5, y2: 400 } }); }
            finally { await scene.deleteEmbeddedDocuments("Region", [pantry.id]); await cafe.update({ shapes }); }
            return id;`, { timeout: 60000 }) : null;
        await disconnect("p2");
        await settle(900);
        const granted = xPassage ? await gm.eval(`return await game.drpg.passages.grant("${xPassage}", "${IDS.botan}");`, { timeout: 60000 }) : null;
        const away = await until(async () => ({ gm: await gm.eval(PENDING(xPassage)), gm2: await gm2.eval(PENDING(xPassage)) }),
            v => J(v.gm2) === J([IDS.botan]), 6000);
        await connect("p2", { storage: storageOf("p2") });
        await settle(1500);
        const back = await until(async () => ({ gm: await gm.eval(PENDING(xPassage)), gm2: await gm2.eval(PENDING(xPassage)) }),
            v => J(v.gm) === "[]" && J(v.gm2) === "[]", 8000);
        xPending = { granted, away, back };
    } finally {
        await gm.eval(`if (${J(xPassage)}) await game.drpg.passages.delete(${J(xPassage)});
            const wall = game.scenes.get("${IDS.scene}").walls.get(${J(xWall)}); if (wall) await wall.delete(); return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("X2: a second GM's Passages tab names, as the primary's does, the student whose player has not been sent the passage, and nobody once they have (E128)",
        typeof xPassage === "string" && xPending?.granted === true && J(xPending.away.gm) === J([IDS.botan]) && J(xPending.away.gm2) === J([IDS.botan])
            && J(xPending.back.gm) === "[]" && J(xPending.back.gm2) === "[]", J({ xPassage, xPending }), { flow: "secret-passages" });

    return { primary: { before, joined, afterGmReload, moved, backAgain }, reloads: { p1: r1, gm: r2, card: r3 },
        d153: { before: gBefore, onGm: gAfter, onGm2: gAfter2, found: gFound, gave: gGave } };
}
