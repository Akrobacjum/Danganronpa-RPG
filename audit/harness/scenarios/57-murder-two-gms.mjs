/**
 * 57-murder-two-gms: the murder, the death and the Eclipse at a table of two Gamemasters (2.0 line T1, 27.11.2026;
 * docs/dev/v2/LINE-T1.md section 3, "Harness"). The seed's GM and three players, and `gm2`, a second full Gamemaster
 * declared late, whose id sorts after the seed GM's, so the seed GM stays the primary (utils.mjs `primaryGmId`), as in
 * 97-two-gms. Each part is named by the item of the line it measures, and each check reads something the part made happen
 * first. Every part puts back what it wrote (`finally`).
 *
 * Parts, in the order they run:
 *   MURDER-05  a discovery waiting for the GMs' word is asked of both GMs; gm2 answers Not yet, and gm's window, drawn
 *              here (`__dialogWindows`), closes by itself; the row names gm2's answer, and nothing is announced.
 *   EXP-GM-02  Botan killed as the GMs keep a death, Aiko alone with the body in the Storage: gm2 is raised one card
 *              naming the finder, the body and the room; a second walk raises none.
 *   MURDER-08  gm2 announces a body in a chapter with a Faint Prep trace and a case row: the Prep question and the case's
 *   INV-06     question at a body are asked on gm2, and neither on gm (both read off each browser's window log).
 *   DAY-03     an Eclipse with Aiko's declaration: gm2's lights ask the primary (`eclipse.judge`), and the answer is the
 *              primary's own reading of the room.
 *   MURDER-04  p1 connected and invited (its roll held), gm2 presses Throw for the player: the roll is thrown on gm2 with
 *              gm2 named as the thrower on gm, p1 is told which GM throws, and no second invitation goes to p1.
 *   MURDER-06  p1, whose roll the opening waits on, leaves: one card on each GM, raised as a notice, naming Aiko, and the
 *              tracker's warning on gm2.
 *   MURDER-11  with p1 away gm2 throws for Aiko (its window held); p1 comes back: no invitation to p1, one line naming gm2.
 *   MURDER-09  two killers and a spent victim: the question on gm (drawn) and on gm2; gm2 ends it, gm's window closes,
 *              and the incident is at Stage 6 once.
 *   MURDER-03  a masked token's name: gm2's canvas draws it, p2's (no GM) keeps the "?".
 *   EXP-PL-10  a Spectator's message to the GMs on p1's page: its own thread to gm and gm2 passes, one with a player
 *              in its whisper does not.
 *   D2-09      a forged crisis roll: p1's own Despair message carrying the GM's flag (`incidentFree`) feeds the pool as
 *              any player's roll does - the exemption is read off a GM's message alone.
 *
 * What this cannot see: a real browser's windows and timing, a real server, a third GM; the parts' roll windows are held
 * stand-ins (`rollTrait` replaced), as 97's Z holds Aiko's.
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
    const { gm, gm2, p1, p2, check, phase, settle, connect, disconnect, repoUrl: REPO, IDS } = api;
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const GM2 = accounts[0].id;
    const STORAGE = { a: { x: 2300, y: 1300 }, b: { x: 2550, y: 1450 } };
    const PLACE = `{ teleport: true, movementAction: "displace", animate: false }`;
    await connect("gm2");
    await settle(1500);
    const endIncident = `if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false });`;

    /* ------------------------------------------------------------ MURDER-05 */
    phase("MURDER-05 the 'Students found a body' window on both GMs, the first answer settles it", { flow: "body-discovery" });
    const m05Key = "T1M57:" + IDS.daichi;
    let m05 = null;
    try {
        await gm2.eval(`globalThis.__dialogAnswers.length = 0;
            globalThis.__dialogAnswers.push(async cfg => { await new Promise(r => setTimeout(r, 1500)); return "close"; }); return true;`);
        m05 = await gm.eval(`const S = ${imp("gm-stores.mjs")}, { seasonEpoch } = ${imp("settings.mjs")};
            const title = game.i18n.localize("DRPG.Chapter.pendingTitle");
            const drawn = () => [...foundry.applications.instances.values()].some(a => a?.rendered && a.element?.isConnected && a.options?.window?.title === title);
            const had = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
            const clock = game.settings.get("danganronpa-rpg", "clock");
            try {
                await S.deathStore.patch("${IDS.daichi}", { chapter: clock.chapter, day: 1, timeOfDay: "night", at: Date.now(), keepBullets: true, known: [] });
                await new Promise(r => setTimeout(r, 1500));
                await S.pendingBodyStore.patch("${m05Key}", { room: "T1 57 room", sceneId: null, victimId: "${IDS.daichi}", deathId: null,
                    witnessIds: ["${IDS.aiko}"], chapter: clock.chapter, epoch: seasonEpoch(), at: 1 });
                let open = false; for (let i = 0; i < 40 && !open; i++) { await new Promise(r => setTimeout(r, 150)); open = drawn(); }
                let shut = false; for (let i = 0; i < 60 && !shut; i++) { await new Promise(r => setTimeout(r, 150)); shut = !drawn(); }
                const row = S.pendingBodyStore.get("${m05Key}") ?? null;
                return { open, shut, by: row?.answeredBy ?? null, answer: row?.answer ?? null, announced: Boolean(game.settings.get("danganronpa-rpg", "bodyFound")?.room) };
            } finally { globalThis.__dialogWindows = had; }`, { timeout: 60000 });
    } finally {
        await gm.eval(`const S = ${imp("gm-stores.mjs")};
            for (const app of [...foundry.applications.instances.values()]) if (app?.options?.window?.title === game.i18n.localize("DRPG.Chapter.pendingTitle")) await app.close().catch(() => {});
            if (S.pendingBodyStore.has("${m05Key}")) await S.pendingBodyStore.drop("${m05Key}");
            if (S.deathStore.has("${IDS.daichi}")) await S.deathStore.drop("${IDS.daichi}"); return true;`);
        await gm2.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
        await settle(900);
    }
    check("MURDER-05: a waiting discovery is asked of gm and gm2; gm2's Not yet closes gm's window and is written on the row, and nothing is announced",
        J(m05) === J({ open: true, shut: true, by: GM2, answer: "notYet", announced: false }), J(m05), { flow: "body-discovery" });

    /* ------------------------------------------------------------ EXP-GM-02 */
    phase("EXP-GM-02 a lone finder raises one GM card", { flow: "body-discovery" });
    const positions = await gm.eval(`return Object.fromEntries([...canvas.scene.tokens].map(t => [t.id, { x: t.x, y: t.y }]));`);
    const putTokensBack = `const was = ${J(positions)}; for (const t of [...canvas.scene.tokens]) { const at = was[t.id]; if (at && (t.x !== at.x || t.y !== at.y)) await t.update(at, ${PLACE}); }`;
    const gm2From = await gm2.eval(`return game.messages.contents.length;`);
    const lone = `const S = ${imp("secret.mjs")}; const mine = game.messages.contents.slice(FROM);
        const cards = mine.filter(m => S.cardFlag(m, "gmPopup") === true);
        const words = []; for (const m of cards) words.push(String(await S.wordsOf(m, 2000) ?? ""));
        return { cards: cards.length, names: words.map(w => [w.includes("Aiko"), w.includes("Botan"), w.includes("Storage")]) };`;
    let g02a = null, g02b = null;
    try {
        await gm.eval(`const C = ${imp("chapter.mjs")}; await C.killCharacter(game.actors.get("${IDS.botan}"), { secret: true, keepBullets: true });
            const tb = canvas.scene.tokens.find(t => t.actorId === "${IDS.botan}"); await tb.update(${J(STORAGE.b)}, ${PLACE});
            const ta = canvas.scene.tokens.find(t => t.actorId === "${IDS.aiko}"); await ta.update(${J(STORAGE.a)}, ${PLACE}); return true;`, { timeout: 60000 });
        await settle(1500);
        g02a = await gm2.eval(lone.replace("FROM", String(gm2From)));
        await gm.eval(`const C = ${imp("chapter.mjs")}; await C.maybeBodyFound(canvas.scene.tokens.find(t => t.actorId === "${IDS.aiko}")); return true;`, { timeout: 60000 });
        await settle(1200);
        g02b = await gm2.eval(lone.replace("FROM", String(gm2From)));
    } finally {
        await gm.eval(`const C = ${imp("chapter.mjs")}; const b = game.actors.get("${IDS.botan}"); if (C.isDeadForGm(b)) await C.reviveCharacter(b, { quiet: true });
            ${putTokensBack} return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("EXP-GM-02: Aiko alone with Botan's body raises one card on gm2 naming Aiko, Botan and the Storage, and a second look raises none",
        J(g02a) === J({ cards: 1, names: [[true, true, true]] }) && J(g02b) === J(g02a), J({ g02a, g02b }), { flow: "body-discovery" });

    /* ------------------------------------------------------------ MURDER-08, INV-06 */
    phase("MURDER-08 INV-06 the questions after the announcement are the announcer's", { flow: "body-discovery" });
    const titles = `const L = k => game.i18n.localize(k); const log = globalThis.__dialogLog.slice(FROM);
        return { prep: log.filter(e => e.title === game.i18n.format("DRPG.Chapter.promoteTitle", { room: "T1 57 a room nobody stands in" })).length,
            caseAsk: log.filter(e => e.title === L("DRPG.CaseRealize.askTitle")).length };`;
    const logAt = c => c.eval(`return globalThis.__dialogLog.length;`);
    let m08 = null;
    const ROOM = "T1 57 a room nobody stands in";
    const caseKey = `T1M57CASE`;
    let chapter = null;
    // The discovery's hold and stamps, put back after (a hold left up refuses the next part's Eclipse).
    const held = await gm.eval(`return { found: foundry.utils.deepClone(game.settings.get("danganronpa-rpg", "bodyFound") ?? {}),
        stamps: foundry.utils.deepClone(game.settings.get("danganronpa-rpg", "bodiesFound") ?? {}) };`);
    try {
        chapter = await gm.eval(`const R = ${imp("remnants.mjs")}, CS = ${imp("gm-stores.mjs")}; const clock = game.settings.get("danganronpa-rpg", "clock");
            const anchor = canvas.scene.tokens.find(t => t.x || t.y);
            globalThis.__t157 = await R.placeRemnant({ type: "prep", visibility: "subtle", faint: true, tiedToCrime: false, x: anchor.x, y: anchor.y, scene: canvas.scene, chapter: clock.chapter, subject: "SUITE 57 MURDER-08" });
            await CS.caseSchemaStore.patch(clock.chapter + ":${caseKey}", { kind: "bullet", name: "SUITE 57 INV-06" });
            const C = ${imp("chapter.mjs")}; await C.killCharacter(game.actors.get("${IDS.daichi}"), { secret: true, keepBullets: true });
            return clock.chapter;`, { timeout: 60000 });
        await settle(1200);
        const [fromGm, fromGm2] = [await logAt(gm), await logAt(gm2)];
        await gm2.eval(`globalThis.__dialogAnswers.length = 0; globalThis.__dialogAnswers.push(null, "later"); return true;`);
        await gm2.eval(`const C = ${imp("chapter.mjs")}; await C.discoverBody({ room: "${ROOM}", victim: game.actors.get("${IDS.daichi}"), scene: canvas.scene }); return true;`, { timeout: 90000 });
        await settle(2500);
        m08 = { gm: await gm.eval(titles.replace("FROM", String(fromGm))), gm2: await gm2.eval(titles.replace("FROM", String(fromGm2))) };
    } finally {
        await gm2.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
        await gm.eval(`const R = ${imp("remnants.mjs")}, CS = ${imp("gm-stores.mjs")}, C = ${imp("chapter.mjs")};
            const t = globalThis.__t157; if (t) { try { await R.dropRemnantSecret(t); } catch {} try { await t.delete(); } catch {} } delete globalThis.__t157;
            for (const key of Object.keys(CS.caseSchemaStore.entries() ?? {})) if (key === "${chapter}:${caseKey}" || key === "${chapter}:meta") await CS.caseSchemaStore.drop(key);
            const d = game.actors.get("${IDS.daichi}"); if (C.isDeadForGm(d)) await C.reviveCharacter(d, { quiet: true });
            await game.settings.set("danganronpa-rpg", "bodyFound", ${J(held.found)});
            await game.settings.set("danganronpa-rpg", "bodiesFound", ${J(held.stamps)});
            ${putTokensBack} return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("MURDER-08: gm2's announcement asks the Faint Prep question on gm2 and not on gm", m08?.gm2?.prep === 1 && m08?.gm?.prep === 0, J(m08), { flow: "body-discovery" });
    check("INV-06: gm2's announcement asks the case's question at a body on gm2 and not on gm", m08?.gm2?.caseAsk === 1 && m08?.gm?.caseAsk === 0, J(m08), { flow: "body-discovery" });

    /* ------------------------------------------------------------ DAY-03 */
    phase("DAY-03 a second GM's lights read the room through the primary", { flow: "murder-incident" });
    let d03 = null;
    try {
        // Aiko and Botan alone in Dorm A (Botan stood beside Aiko), and Aiko's declaration there.
        await gm.eval(`const E = ${imp("eclipse.mjs")}, S = ${imp("gm-stores.mjs")};
            const tb = canvas.scene.tokens.find(t => t.actorId === "${IDS.botan}"); await tb.update({ x: 550, y: 450 }, ${PLACE});
            await E.startEclipse(); await new Promise(r => setTimeout(r, 800));
            await S.pendingMurderStore.patch("${IDS.aiko}", { room: "Dorm A", note: "", at: 1, approved: null, eclipse: E.eclipseId() });
            return E.eclipseId();`, { timeout: 60000 });
        await settle(1200);
        d03 = await gm2.eval(`const B = ${imp("bridge-asks.mjs")}, E = ${imp("eclipse.mjs")}; const res = await B.requestEclipseJudge({ eclipse: E.eclipseId() });
            return { ok: res.ok, value: res.value ?? null };`, { timeout: 60000 });
        d03.primary = await gm.eval(`const E = ${imp("eclipse.mjs")}; return await E.standingsOnPrimary(E.eclipseId());`);
    } finally {
        await gm.eval(`const E = ${imp("eclipse.mjs")}, S = ${imp("gm-stores.mjs")};
            if (S.pendingMurderStore.has("${IDS.aiko}")) await S.pendingMurderStore.drop("${IDS.aiko}");
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {}); ${putTokensBack} return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("DAY-03: gm2's lights ask the primary, and are answered the primary's own reading of Aiko's declaration",
        d03?.ok === true && J(d03.value) === J(d03.primary) && Boolean(d03.value?.[IDS.aiko]), J(d03), { flow: "murder-incident" });

    /* ------------------------------------------------------------ MURDER-04, MURDER-06, MURDER-11 */
    const holdP1 = `globalThis.__t157Asked = 0; const a = game.actors.get("${IDS.aiko}"); globalThis.__t157Kept = Object.hasOwn(a, "rollTrait") ? a.rollTrait : null;
        a.rollTrait = function () { globalThis.__t157Asked++; return new Promise(r => (globalThis.__t157Held ??= []).push(r)); }; return true;`;
    const freeP1 = `const a = game.actors.get("${IDS.aiko}"); if (globalThis.__t157Kept) a.rollTrait = globalThis.__t157Kept; else delete a.rollTrait;
        for (const r of globalThis.__t157Held ?? []) r(null); delete globalThis.__t157Held; delete globalThis.__t157Kept; return globalThis.__t157Asked ?? 0;`;
    const told = (gmName, since) => `const S = ${imp("secret.mjs")}; const said = game.i18n.format("DRPG.Murder.openingThrownByGm", { gm: "${gmName}" }); let n = 0;
        for (const m of game.messages.contents.filter(m => (m.timestamp ?? 0) >= ${since})) if (String(await S.wordsOf(m, 1000) ?? "").includes(said)) n++; return n;`;
    phase("MURDER-04 Throw for the player on gm2 with p1 connected", { flow: "murder-incident" });
    let m04 = null;
    try {
        await p1.eval(holdP1);
        const p1From = Date.now() - 1000;
        await gm.eval(`${endIncident} await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.botan}", openingTrait: "body" }); return true;`, { timeout: 60000 });
        await until(() => p1.eval(`return globalThis.__t157Asked ?? 0;`), v => v >= 1, 6000);
        await until(() => gm2.eval(`return game.drpg.murderState()?.stage ?? null;`), v => v === "openingRoll", 6000);
        m04 = await gm2.eval(`const R = ${imp("murder-rules.mjs")}; const a = game.actors.get("${IDS.aiko}"); const seen = [];
            const kept = Object.hasOwn(a, "rollTrait") ? a.rollTrait : null;
            a.rollTrait = async () => { seen.push(game.drpg.murderState()?.openingThrower?.userId ?? null); return null; };
            try { await R.throwForPlayer(); } finally { if (kept) a.rollTrait = kept; else delete a.rollTrait; }
            return { seen };`, { timeout: 90000 });
        await settle(1500);
        m04.told = await p1.eval(told("Second GM", p1From));
        m04.after = await gm.eval(`return game.drpg.murderState()?.openingThrower ?? null;`);
    } finally {
        // The incident first, so p1's held window's loop ends when let go (`openingStillWanted`).
        await gm.eval(`${endIncident} return true;`, { timeout: 60000 });
        await settle(600);
        m04 = { ...(m04 ?? {}), asked: await p1.eval(freeP1) };
        await settle(900);
    }
    // The held stand-in answers no roll, so the window is offered again up to its three attempts (`throwOpeningRoll`), each on gm2.
    check("MURDER-04: gm2's Throw for the player throws Aiko's opening on gm2 with gm2 named the thrower, p1 told once, invited once, and the thrower cleared after",
        m04?.seen?.length >= 1 && m04.seen.every(id => id === GM2) && m04.told === 1 && m04.after === null && m04.asked === 1, J(m04), { flow: "murder-incident" });

    phase("MURDER-06 MURDER-11 the roller leaves, gm2 throws for them, and their return is not invited", { flow: "murder-incident" });
    let m06 = null, m11 = null;
    try {
        await p1.eval(holdP1);
        const [gmFrom, gm2From2] = [await gm.eval(`return game.messages.contents.length;`), await gm2.eval(`return game.messages.contents.length;`)];
        await gm.eval(`${endIncident} await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.botan}", openingTrait: "body" }); return true;`, { timeout: 60000 });
        await until(() => p1.eval(`return globalThis.__t157Asked ?? 0;`), v => v >= 1, 6000);
        // p1's page goes with its held window: nothing of it is let go, so nothing on it throws the opening.
        await disconnect("p1");
        await settle(2000);
        const away = from => `const S = ${imp("secret.mjs")}, U = ${imp("murder-ui.mjs")}, cleanup = ${imp("cleanup.mjs")};
            const cards = game.messages.contents.slice(${from}).filter(m => S.cardFlag(m, "gmPopup") === true); const words = [];
            for (const m of cards) words.push(String(await S.wordsOf(m, 2000) ?? ""));
            const mark = U.incidentTrackerHtml(game.drpg.murderState(), cleanup).includes(game.i18n.localize("DRPG.Murder.awayHint.openingRoll"));
            return { cards: words.filter(w => w.includes("Aiko")).length, mark };`;
        m06 = { gm: await gm.eval(away(gmFrom)), gm2: await gm2.eval(away(gm2From2)) };
        // gm2 throws for the absent owner, its window held (MURDER-11).
        await gm2.eval(`const R = ${imp("murder-rules.mjs")}; const a = game.actors.get("${IDS.aiko}");
            globalThis.__t157Kept2 = Object.hasOwn(a, "rollTrait") ? a.rollTrait : null;
            a.rollTrait = () => new Promise(r => { globalThis.__t157Free2 = r; });
            globalThis.__t157Throw = R.throwForPlayer(); return true;`, { timeout: 60000 });
        const stood = await until(() => gm.eval(`return game.drpg.murderState()?.openingThrower?.userId ?? null;`), v => v === GM2, 6000);
        await gm.eval(`globalThis.__t157Asks = 0; const s = game.socket; globalThis.__t157Emit = s.emit;
            s.emit = function (e, p, o, ...r) { if (p?.action === "murder.openingAsk" && (o?.recipients ?? []).includes("${IDS.p1}")) globalThis.__t157Asks++; return globalThis.__t157Emit.call(this, e, p, o, ...r); };
            return true;`);
        const back = Date.now() - 500;
        await connect("p1");
        await settle(2000);
        /* The page's own ask at its ready reaches the primary before it counts p1 connected here ("unknown sender",
           refused); a page asks again at each primary's ready (gm-bridge.mjs `askForOffers`), as it does here. */
        await p1.eval(`await (${imp("bridge-table.mjs")}).ask("advancement.ask", {}); return true;`, { timeout: 30000 });
        await settle(3000);
        m11 = { stood, asks: await gm.eval(`return globalThis.__t157Asks;`), told: await p1.eval(told("Second GM", back)),
            toP1: await gm.eval(`return game.messages.contents.filter(m => (m.timestamp ?? 0) >= ${back} && (m.whisper ?? []).includes("${IDS.p1}")).length;`) };
    } finally {
        await gm.eval(`if (globalThis.__t157Emit) game.socket.emit = globalThis.__t157Emit; delete globalThis.__t157Emit; ${endIncident} return true;`, { timeout: 60000 });
        await settle(600);
        await gm2.eval(`const a = game.actors.get("${IDS.aiko}"); globalThis.__t157Free2?.(null);
            if (globalThis.__t157Kept2) a.rollTrait = globalThis.__t157Kept2; else delete a.rollTrait;
            await globalThis.__t157Throw?.catch?.(() => null); delete globalThis.__t157Throw; delete globalThis.__t157Free2; delete globalThis.__t157Kept2; return true;`, { timeout: 60000 });
        await gm.eval(`${endIncident} return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("MURDER-06: p1 leaves while Aiko's opening waits on them, and gm and gm2 each hold one card naming Aiko, with the tracker's warning",
        J(m06) === J({ gm: { cards: 1, mark: true }, gm2: { cards: 1, mark: true } }), J(m06), { flow: "murder-incident" });
    check("MURDER-11: p1 back while gm2 throws for Aiko is sent no invitation and told once that gm2 throws",
        m11?.stood === GM2 && m11.asks === 0 && m11.told === 1, J(m11), { flow: "murder-incident" });

    /* ------------------------------------------------------------ MURDER-09 */
    phase("MURDER-09 the spent-victim question on both GMs, answered once", { flow: "murder-incident" });
    let m09 = null;
    const was09 = await gm.eval(`const r = game.actors.get("${IDS.botan}").system.resources; return { hp: r.hitPoints.value, stress: r.stress.value };`);
    try {
        await gm2.eval(`globalThis.__dialogAnswers.length = 0;
            globalThis.__dialogAnswers.push(async cfg => { await new Promise(r => setTimeout(r, 1500)); return cfg?.window?.title === game.i18n.localize("DRPG.Murder.ranOutTitle") ? true : null; }); return true;`);
        m09 = await gm.eval(`const M = game.drpg; const R = ${imp("murder.mjs")};
            const title = game.i18n.localize("DRPG.Murder.ranOutTitle");
            const drawn = () => [...foundry.applications.instances.values()].filter(a => a?.rendered && a.element?.isConnected && a.options?.window?.title === title).length;
            ${endIncident}
            await M.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.botan}", openingTrait: "body" });
            if (M.murderState()?.stage === "openingRoll") await R.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await R.thirdPartyEnters(game.actors.get("${IDS.chie}"));
            await R.resolveCrisisAction({ actorId: "${IDS.chie}", key: "crimePartners", total: 20, isCritical: false, withHope: true });
            const had = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
            try {
                const v = game.actors.get("${IDS.botan}"); const r = v.system.resources;
                await v.update({ "system.resources.hitPoints.value": r.hitPoints.max, "system.resources.stress.value": r.stress.max });
                let most = 0; for (let i = 0; i < 40 && !most; i++) { await new Promise(res => setTimeout(res, 150)); most = drawn(); }
                for (let i = 0; i < 60 && drawn(); i++) await new Promise(res => setTimeout(res, 150));
                for (let i = 0; i < 40 && M.murderState()?.stage !== "resolution"; i++) await new Promise(res => setTimeout(res, 150));
                return { drawn: most, shut: drawn() === 0, stage: M.murderState()?.stage ?? null, answeredBy: M.murderState()?.question?.answeredBy ?? null };
            } finally { globalThis.__dialogWindows = had; }`, { timeout: 120000 });
    } finally {
        await gm2.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
        await gm.eval(`const C = ${imp("chapter.mjs")}; ${endIncident}
            const v = game.actors.get("${IDS.botan}"); await v.update({ "system.resources.hitPoints.value": ${was09.hp}, "system.resources.stress.value": ${was09.stress} });
            for (const id of ["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"]) { const a = game.actors.get(id); if (C.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true }); }
            return true;`, { timeout: 60000 });
        await settle(900);
    }
    check("MURDER-09: the spent victim's question is drawn on gm and answered End now on gm2; gm's window closes and the incident is at Stage 6, answered by gm2",
        J(m09) === J({ drawn: 1, shut: true, stage: "resolution", answeredBy: GM2 }), J(m09), { flow: "murder-incident" });

    /* ------------------------------------------------------------ MURDER-03, EXP-PL-10 */
    phase("MURDER-03 EXP-PL-10 the masked name and a Spectator's thread", { flow: "mask" });
    const nameRead = `const K = ${imp("mask-gm.mjs")}; const t = { document: { flags: { "danganronpa-rpg": { masked: true } }, actor: { name: "Aiko Hoshino" } }, nameplate: { text: "?", visible: false } };
        K.drawMaskName(t); return t.nameplate.text;`;
    const m03 = { gm2: await gm2.eval(nameRead), p2: await p2.eval(nameRead) };
    check("MURDER-03: a masked token's name is drawn on gm2's canvas and not on p2's", J(m03) === J({ gm2: "? (Aiko Hoshino)", p2: "?" }), J(m03), { flow: "mask" });
    const pl10 = await p1.eval(`const U = ${imp("spectator-ui.mjs")}; const me = game.user;
        const msg = whisper => ({ whisper, flags: { "danganronpa-rpg": { thread: me.id, kind: "dm" } } });
        return [U.spectatorMessageAllowed(msg([me.id, "${IDS.gm}", "${GM2}"]), me), U.spectatorMessageAllowed(msg([me.id, "${IDS.p2}"]), me)];`);
    check("EXP-PL-10: on p1's page a Spectator's own thread to gm and gm2 passes, and one whispered to p2 does not", J(pl10) === J([true, false]), J(pl10), { flow: "mask" });

    /* ------------------------------------------------------------ D2-09 */
    phase("D2-09 a forged crisis roll still feeds Despair", { flow: "gm-rolls-total" });
    let d09 = null;
    const pool = `const { getDespair } = ${imp("despair.mjs")}, { monokumaFor } = ${imp("assignments.mjs")};
        const mono = monokumaFor(game.actors.get("${IDS.aiko}")); return mono ? Number(getDespair(mono.id) ?? 0) : null;`;
    const forge = flag => `const a = game.actors.get("${IDS.aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: 13, evaluated: true, dHope: { total: 4 }, dFear: { total: 9 },
            dice: [{ faces: 12, total: 4, results: [{ result: 4, active: true }] }, { faces: 12, total: 9, results: [{ result: 9, active: true }] }],
            options: { actionType: "action", actionKey: "crisis" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll }, flags: { "danganronpa-rpg": ${flag ? `{ incidentFree: true }` : "{}"} } });
        return m?.id ?? null;`;
    const cards = [];
    let poolWas = null;
    try {
        poolWas = await gm.eval(pool);
        cards.push(await p1.eval(forge(true)));
        await settle(1800);
        const forged = await gm.eval(pool);
        cards.push(await p1.eval(forge(false)));
        await settle(1800);
        const plain = await gm.eval(pool);
        d09 = { forged: forged - poolWas, plain: plain - forged };
    } finally {
        for (const id of cards.filter(Boolean)) await p1.eval(`await game.messages.get("${id}")?.delete(); return true;`);
        const now = await gm.eval(pool);
        if (poolWas !== null && now !== poolWas) await gm.eval(`const { adjustDespair } = ${imp("despair.mjs")}, { monokumaFor } = ${imp("assignments.mjs")};
            await adjustDespair(monokumaFor(game.actors.get("${IDS.aiko}")).id, ${poolWas} - ${now}); return true;`);
        await settle(900);
    }
    check("D2-09: p1's own Despair message flagged as the GM's incident roll feeds the pool as one without the flag does",
        J(d09) === J({ forged: 1, plain: 1 }), J(d09), { flow: "gm-rolls-total" });

    await disconnect("gm2");
    return { m05, g02a, g02b, m08, d03, m04, m06, m11, m09, m03, pl10, d09 };
}
