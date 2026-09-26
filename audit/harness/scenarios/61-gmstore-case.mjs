/**
 * The GM store with a second GM (E04, 1.2.63; audit S05-01, S05-09, S05-10).
 *
 * The seed's GM and three players, and GMs who join late: `gm2`, a second
 * Gamemaster whose id sorts after the seed GM's, so the seed GM stays the
 * primary while both are connected. A late account is seeded inactive and has no
 * client until `connect` (cluster.mjs) starts one, with the localStorage and the
 * world id it is given - an empty browser, the same browser coming back, or the
 * same browser in another world on one server.
 *
 * Phases, in the order they run (the design's section 12; the phases after the seed
 * GM closes run last, because only a late account can connect again):
 *   A  the harness's own preconditions: a late GM boots with the storage it was
 *      given, the others see it connect, its storage is read back after it left,
 *      and its clock can be off while the server's is not.
 *   B  the Truth Bullet answer key survives a second GM joining with an empty
 *      browser (S05-01, the brief's verify, headless): on 1.2.62 the joining GM
 *      rebuilt a row for every bullet from its item's Faint flag and the newer,
 *      partial rows replaced the full ones on the first GM; a gms.delta forged by
 *      a player changes nothing.
 *   D  the traces (S05-10): they survive a second GM's empty join; a token a GM
 *      deletes takes its row off both GMs; and the seed GM's browser, copied, opens
 *      a second world on the same server - its hello is refused there as another
 *      world's, it claims the same old rows (a duplicated world), its clear drops
 *      world B's rows only, and back in world A the same browser reads its traces
 *      intact without a GM having to send them.
 *   E  the Mastermind's door (S06-19): the pick reaches its player's copy with the
 *      record's stamps, and what each player is sent is read off the packets; a
 *      second GM whose browser holds no pick is asked and does not answer (the
 *      primary alone does); a GM that lost the pick and picks somebody else still
 *      takes the part away from the first player (Q3); a GM that has not merged a
 *      newer pick moves the lair and the former Mastermind learns nothing (B1); and
 *      the upgrade day's clear is put to the primary whichever browser held it and
 *      whenever the pick arrives, with no player told the part meanwhile (M1).
 *   F  the incident's cast (S04-24, the cast half of S06-19): a participant's copy
 *      is stamped part by part, and what the primary answers is read off the
 *      packets; a second GM with an empty browser does not answer for it; a GM that
 *      has not merged a newer write lets a third in, and the primary tells the
 *      participants what the GMs agree on (B1); and the second GM closes the
 *      incident: both GMs' records and the copy are cleared by one stamp.
 *   G  a trap's planted object (S08-19): a second GM plants it, the primary - who
 *      hands a player's Search its find - finds it and gives it to the searcher,
 *      and its use sets the trap off on the primary's chat.
 *   I  the fog ledger (S07-01): rooms found and one unticked while the second GM
 *      is away reach it when it comes back, the untick with them.
 *   H1 a Level Up offered on the primary (S03-11): its owner's copy is lit at the
 *      offer's stamp, and the second GM holds the offer.
 *   K  the upgrade day's claim of the old cast (the round-2 review's R2-B1): two GM
 *      browsers claim theirs while an incident runs, one of them the previous
 *      incident's; the running one's "no third" stands on every GM, and the third
 *      of the previous one is sent nothing.
 *   J1 the season reset is the primary's (S06-20, D12): a Mastermind is picked while
 *      the second GM is here, and its reset is refused, names the primary GM and
 *      opens no window; it leaves with its browser.
 *   J2 the primary resets twice through the window, the answers queued: the traces
 *      and the Mastermind, then the traces alone - the window names the GMs who are
 *      away, each reset writes its cut in the clock before its steps, and the Level
 *      Up is kept both times.
 *   J3 the seed GM leaves for good; the second GM comes back alone, so the primary:
 *      its traces from before the second reset and its pick from before the first
 *      are gone by the clock's cuts alone, group by group, and its offer is kept.
 *   H2 the primary alone answers the owner with the offer and spends it; it offers
 *      again and, its store emptied, answers stamp 0 - the owner's button stays lit,
 *      and the spend is refused as not offered, with the GM told.
 *   H3 an owner whose character went to another player still takes the next offer
 *      (the round-2 review's M2).
 *   Z  the browser is lost (the brief's live verify, headless): the GM left from
 *      H2 picks the Mastermind and places two traces (J's resets took the others),
 *      backs up the case and leaves, a third GM comes with an empty browser and is
 *      alone, so the primary; its health check opens and names what is missing, and
 *      Continue is taken. Another GM with an empty browser restores the file: the
 *      primary's answer keys read back by merge, its check - and the panel's line -
 *      clear without a reload, and the GM who restored sends every player their
 *      copies again (E04's fix round).
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true },
    { who: "gm3", id: "USERGM3000000000", name: "Third GM", role: 4, character: null, color: "#66ffaa", late: true },
    // The seed GM's browser, copied: in world B (gmb), then back in world A (gma).
    { who: "gma", id: "USERGMA000000000", name: "GM A", role: 4, character: null, color: "#aa66ff", late: true },
    { who: "gmb", id: "USERGMB000000000", name: "GM B", role: 4, character: null, color: "#ffaa66", late: true },
    // A browser that ran 1.2.62 and holds nothing but its old store's clear of the Mastermind (E7).
    { who: "gmc", id: "USERGMC000000000", name: "GM C", role: 4, character: null, color: "#aaff66", late: true }
];

const PROBE_KEY = "drpg-harness.probe";
const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, gm2, gm3, gma, gmb, gmc, p1, p2, p3, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS, repoUrl }) {
    const GM2 = "USERGM2000000000", GMA = "USERGMA000000000";

    /* ------------------------------ A. the harness ------------------------------ */

    phase("A: a GM that joins late", { flow: "gm-store" });
    await gm.eval(`globalThis.__e04Connected = [];
        Hooks.on("userConnected", (user, connected) => globalThis.__e04Connected.push([user.id, connected]));
        return true;`);
    const before = await gm.eval(`const u = game.users.get("${GM2}"); return { known: Boolean(u), active: u?.active ?? null, isGM: u?.isGM ?? null };`);
    let unreachable = null;
    try { await gm2.eval("return 1;"); } catch (err) { unreachable = err.message; }
    check("A1: a late account is a GM the world knows, inactive, with no client until it connects",
        before.known && before.active === false && before.isGM === true && /not connected/.test(unreachable ?? ""),
        JSON.stringify({ before, unreachable }));

    const probe = JSON.stringify({ visit: 1 });
    // A copy of the seed GM's browser, so that the two GMs' stores are equal (A5).
    await connect("gm2", { storage: { ...(await storageOf("gm")), [PROBE_KEY]: probe } });
    await settle(400);
    const onGm2 = await gm2.eval(`return { held: localStorage.getItem("${PROBE_KEY}"), me: game.user.id, isGM: game.user.isGM,
        world: game.world.id, drpg: Boolean(game.drpg) };`);
    check("A2: it boots as itself, with the localStorage it was given, before the module read a setting",
        onGm2.held === probe && onGm2.me === GM2 && onGm2.isGM && onGm2.drpg && onGm2.world === "drpg-audit-world", JSON.stringify(onGm2));

    const seen = await gm.eval(`return { connected: globalThis.__e04Connected, active: game.users.get("${GM2}")?.active ?? null };`);
    check("A3: the GM already at the table sees it connect (userConnected, true) and active",
        seen.active === true && seen.connected.some(([id, on]) => id === GM2 && on === true), JSON.stringify(seen));

    const clocks = await gm2.eval(`return { server: game.time.serverTime, local: Date.now() };`);
    const here = Date.now();
    check("A4: its game.time.serverTime is the server's clock, and a finite number",
        Number.isFinite(clocks.server) && Math.abs(clocks.server - here) < 5000 && Math.abs(clocks.local - clocks.server) < 5000,
        JSON.stringify({ ...clocks, cluster: here }));

    const traffic = socketTraffic.filter(t => String(t.action ?? "").startsWith("gms."));
    check("A5: two GMs whose stores are equal (the second browser a copy of the first) exchange digests and nothing more: hellos and dones, no state, no delta",
        traffic.some(t => t.action === "gms.hello") && traffic.every(t => t.action === "gms.hello" || t.action === "gms.done"),
        JSON.stringify(traffic.slice(0, 8)));

    await gm2.eval(`localStorage.setItem("${PROBE_KEY}", JSON.stringify({ visit: 2 })); return true;`);
    await disconnect("gm2");
    await settle(300);
    const kept = await storageOf("gm2");
    const gone = await gm.eval(`return { connected: globalThis.__e04Connected, active: game.users.get("${GM2}")?.active ?? null };`);
    check("A6: after it leaves, the others see it go, and its localStorage is read back as it closed",
        kept?.[PROBE_KEY] === JSON.stringify({ visit: 2 }) && gone.active === false
        && gone.connected.some(([id, on]) => id === GM2 && on === false), JSON.stringify({ kept: kept?.[PROBE_KEY] ?? null, gone }));

    await connect("gm2", { storage: kept, world: "drpg-world-b", clockSkewMs: 5 * 60 * 1000 });
    const again = await gm2.eval(`return { held: localStorage.getItem("${PROBE_KEY}"), world: game.world.id,
        skew: Date.now() - game.time.serverTime };`);
    check("A7: it comes back with the browser it left, in another world if told, and a clock off by five minutes moves Date.now alone",
        again.held === JSON.stringify({ visit: 2 }) && again.world === "drpg-world-b" && Math.abs(again.skew - 300000) < 2000,
        JSON.stringify(again));
    await disconnect("gm2");
    await settle(300);

    /* ------------------- B. the answer key when a GM joins empty ------------------- */

    phase("B: a second GM joins with an empty browser, and the answer key survives", { flow: "truth-bullets" });
    const made = await gm.eval(`
        const actor = game.actors.get("${IDS.aiko}");
        const out = [];
        for (const [n, realType] of [[1, "key"], [2, "incident"]]) {
            const item = await game.drpg.createTruthBullet(actor, { name: "E04 bullet " + n, realType, visibility: "evident",
                playerText: "Seen.", analyzedText: "Read " + n, remnantId: "E04TRACE" + n, sceneId: "${IDS.scene}",
                sourceAction: "prep", tiedToCrime: true });
            out.push(item.uuid);
        }
        // A bullet as a world made before 1.2.47 left it: Faint on the item, none in its row.
        const [old] = await actor.createEmbeddedDocuments("Item", [{ name: "E04 bullet 3", type: "loot",
            flags: { "${MOD}": { category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "evident", faint: true } } }]);
        await game.drpg.setSecret(old.uuid, { realType: "final", remnantId: "E04TRACE3", analyzedText: "Read 3", sourceAction: "clean", tiedToCrime: false });
        out.push(old.uuid);
        return out;`);
    const keyOf = uuids => `const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        return ${J(uuids)}.map(u => { const s = B.secretOf(u); return [s.realType, s.remnantId, s.analyzedText, s.sourceAction, s.tiedToCrime, "faint" in s]; });`;
    const expected = [["key", "E04TRACE1", "Read 1", "prep", true, true], ["incident", "E04TRACE2", "Read 2", "prep", true, true],
        ["final", "E04TRACE3", "Read 3", "clean", false, false]];
    const onGmBefore = await gm.eval(keyOf(made));
    check("B1: the GM holds three bullets' answer keys, the third with no Faint in its row", J(onGmBefore) === J(expected),
        J({ made, onGmBefore }));

    await connect("gm2");
    await settle(1500);
    const keysOnGm = await gm.eval(keyOf(made)), keysOnGm2 = await gm2.eval(keyOf(made));
    check("B2: after an empty browser joined, both GMs hold every field of every answer key (S05-01)",
        J(keysOnGm) === J(expected) && J(keysOnGm2) === J(expected), J({ keysOnGm, keysOnGm2 }));
    const faintFlag = await gm.eval(`return fromUuidSync("${made[2]}")?.getFlag("${MOD}", "faint") ?? null;`);
    check("B3: the old Faint flag on the third bullet's item was left where it was", faintFlag === true, J(faintFlag));
    const held = await gm2.eval(`const { bulletStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");
        return { live: Object.keys(bulletStore.entries()).length, hydration: E.gmStoreHydration().state };`);
    check("B4: the joining GM's store holds the three rows, and it was answered by the GM already there",
        held.live === 3 && held.hydration === "answered", J(held));

    await p1.eval(`game.socket.emit("module.${MOD}", { action: "gms.delta", world: game.world.id, store: "bullets",
        delta: { e: { "${made[0]}": { realType: "neutral" } }, t: { "${made[0]}": ${Number.MAX_SAFE_INTEGER} }, d: {}, cleared: 0 } },
        { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(500);
    const afterForged = await gm.eval(keyOf([made[0]]));
    const warned = await gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return U.sessionFailures().filter(e => /refused gms\.delta/.test(e.message)).map(e => e.message);`);
    check("B5: a gms.delta forged by a player changes nothing on the GM, and the GM's log names the refusal",
        J(afterForged) === J([expected[0]]) && warned.length >= 1, J({ afterForged, warned }), { flow: "gm-store" });
    await disconnect("gm2");
    await settle(300);

    /* ------- D. the traces: a join, a deletion, and one browser in two worlds ------- */

    phase("D: the traces through a second GM, a deletion, and one browser in two worlds", { flow: "trace-remnant" });
    const REM = `const R = await import("${repoUrl}/scripts/remnants.mjs");
        const { remnantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");`;
    const placedD = await gm.eval(`${REM}
        const scene = game.scenes.get("${IDS.scene}");
        const out = [];
        for (const [n, type] of [[1, "incident"], [2, "prep"]]) {
            const token = await R.placeRemnant({ type, visibility: "subtle", x: 100 * n, y: 100, scene, tiedToCrime: n === 1,
                note: "E04 trace " + n, sourceName: "E04" });
            out.push(token.id);
        }
        return out;`);
    // Each trace by its ledger key, `sceneId.tokenId`: the seed's stands in the annex.
    const traceRows = keys => `${REM}
        return ${J(keys)}.map(key => { const [sceneId, tokenId] = key.split(".");
            const t = game.scenes.get(sceneId)?.tokens?.get(tokenId); const d = t ? R.remnantData(t) : null;
            return d ? [d.type, d.note ?? "", d.tiedToCrime] : null; });`;
    const seedKey = `${IDS.annex}.${IDS.trace}`;
    const seedRow = ["prep", "", false];
    const expectD = [seedRow, ["incident", "E04 trace 1", true], ["prep", "E04 trace 2", false]];
    const idsD = [seedKey, ...placedD.map(id => `${IDS.scene}.${id}`)];
    await connect("gm2");
    await settle(1500);
    const tracesOnGm = await gm.eval(traceRows(idsD)), tracesOnGm2 = await gm2.eval(traceRows(idsD));
    check("D1: the seed's trace and two placed on the GM survive a second GM joining with an empty browser, on both GMs",
        J(tracesOnGm) === J(expectD) && J(tracesOnGm2) === J(expectD), J({ tracesOnGm, tracesOnGm2 }));

    await gm2.eval(`await game.scenes.get("${IDS.scene}").tokens.get("${placedD[1]}").delete(); return true;`);
    await settle(800);
    const goneKey = `${IDS.scene}.${placedD[1]}`;
    const dropped = client => client.eval(`${REM} return { has: remnantStore.has("${goneKey}"), tombstone: remnantStore.tombstone("${goneKey}") > 0 };`);
    const dropGm = await dropped(gm), dropGm2 = await dropped(gm2);
    check("D2: the second GM deletes a trace's token, and the primary's tombstone takes its row off both GMs",
        !dropGm.has && dropGm.tombstone && !dropGm2.has && dropGm2.tombstone, J({ dropGm, dropGm2 }));

    const KEY = `${MOD}.gmRemnants`;
    const worldA = "drpg-audit-world", worldB = "drpg-world-b";
    const sectionIn = (storage, wid) => {
        try { return J(JSON.parse(storage?.[KEY] ?? "null")?.worlds?.[wid] ?? null); } catch { return "unreadable"; }
    };
    const copied = await storageOf("gm");
    const aBefore = sectionIn(copied, worldA);
    await connect("gmb", { storage: copied, world: worldB });
    await settle(9500);
    const inB = await gmb.eval(`${REM}
        const live = Object.keys(remnantStore.entries());
        const census = remnantStore.census();
        const hydration = E.gmStoreHydration().state;
        const cleared = await R.clearRemnantLedger();
        await E.gmStoresIdle();
        return { world: game.world.id, hydration, census, live, cleared, after: Object.keys(remnantStore.entries()).length,
            tombstone: remnantStore.tombstone("${seedKey}") > 0 };`);
    const refusedAs = client => client.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return U.sessionFailures().filter(e => /refused gms\.hello from GM B: the packet is another world's/.test(e.message)).length;`);
    const saidGm = await refusedAs(gm), saidGm2 = await refusedAs(gm2);
    check("D3: the same browser in world B: the GMs of world A refuse its hello as another world's and say so, it times out, claims the same old rows (a duplicated world), and its clear drops world B's rows",
        inB.world === worldB && inB.hydration === "timedOut" && inB.census?.claimed === 1 && J(inB.live) === J([seedKey])
        && inB.cleared === 1 && inB.after === 0 && inB.tombstone && saidGm >= 1 && saidGm2 >= 1, J({ inB, saidGm, saidGm2 }));

    await disconnect("gmb");
    await settle(300);
    const leftB = await storageOf("gmb");
    const bSection = JSON.parse(sectionIn(leftB, worldB));
    check("D4: in that browser's storage world A's section is byte for byte what it was, and world B's holds its tombstone and no row",
        aBefore !== "null" && sectionIn(leftB, worldA) === aBefore && Object.keys(bSection?.e ?? { x: 1 }).length === 0 && bSection?.d?.[seedKey] > 0,
        J({ aBefore: aBefore.length, aAfter: sectionIn(leftB, worldA).length, bSection }));

    const trafficFrom = socketTraffic.length;
    await connect("gma", { storage: leftB });
    await settle(1500);
    const tracesOnA = await gma.eval(traceRows(idsD.slice(0, 2)));
    const statesForA = socketTraffic.slice(trafficFrom).filter(t => t.action === "gms.state"
        && (t.from === "gma" || (Array.isArray(t.to) && t.to.includes(GMA))));
    check("D5: the same browser back in world A reads its traces intact, and no GM had to send it a section",
        J(tracesOnA) === J(expectD.slice(0, 2)) && !statesForA.length, J({ tracesOnA, statesForA: statesForA.slice(0, 4) }));
    await disconnect("gma");
    await disconnect("gm2");
    await settle(300);

    /* ------------------- E. the Mastermind's door, stamped ------------------- */

    phase("E: the Mastermind's door through the primary GM, stamped", { flow: "mastermind" });
    const MM = `const M = await import("${repoUrl}/scripts/mastermind.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");`;
    const doorOf = client => client.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const { iAmTheMastermind } = await import("${repoUrl}/scripts/settings.mjs");
        return { mine: iAmTheMastermind(), stamp: E.mineStamp("door"), copy: E.readMine("door") };`);
    /* What each door packet says, as p1 and p2 receive it (the review's M2, 26.09): a copy
       refuses an answer at a stamp it already holds, so the copy alone cannot show what the
       primary answered - on the C5 tree a primary that told every asker "yes" passed E3. */
    const RECORD_DOORS = `globalThis.__doors = [];
        game.socket.on("module.${MOD}", (payload, senderId) => {
            if (payload?.action === "mastermind.door") globalThis.__doors.push({ from: senderId, value: payload.value, room: payload.room ?? null, stamps: payload.stamps ?? null });
        });
        return true;`;
    await p1.eval(RECORD_DOORS);
    await p2.eval(RECORD_DOORS);
    const doorsNow = client => client.eval(`return globalThis.__doors.length;`);
    const doorsSince = (client, n) => client.eval(`return globalThis.__doors.slice(${n});`);
    const yesAt = (at, room) => ({ from: IDS.gm, value: true, room, stamps: { actorId: at, room: at } });
    const noAt = at => ({ from: IDS.gm, value: false, room: null, stamps: { actorId: at } });
    const pickedAt = await gm.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Main Hall" });
        return S.mastermindStore.stampOf("record");`);
    await settle(600);
    const p1First = await doorOf(p1);
    const sentFirst = { p1: await doorsSince(p1, 0), p2: await doorsSince(p2, 0) };
    check("E1: the Mastermind picked on the GM reaches its player's copy, the lair with it, at the record's stamps; the other player is sent no, with the pick's stamp alone",
        p1First.mine === true && p1First.copy?.room === "Main Hall" && p1First.stamp === pickedAt && pickedAt > 0
        && J(sentFirst.p1) === J([yesAt(pickedAt, "Main Hall")]) && J(sentFirst.p2) === J([noAt(pickedAt)]), J({ pickedAt, p1First, sentFirst }));

    await connect("gm2");
    await settle(1500);
    const doorsFrom = from => socketTraffic.filter(t => t.from === from && t.action === "mastermind.door").length;
    const beforeAsk = { gm: doorsFrom("gm"), gm2: doorsFrom("gm2") };
    await p1.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${GM2}"] }); return true;`);
    await settle(500);
    const afterGm2 = await doorOf(p1);
    check("E2: a second GM with an empty browser, asked for the door, does not answer (the primary alone does), and the player keeps the part",
        doorsFrom("gm2") === beforeAsk.gm2 && afterGm2.mine === true && afterGm2.stamp === pickedAt, J({ beforeAsk, gm2Sent: doorsFrom("gm2"), afterGm2 }));

    const askGm = client => client.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    const asked3 = { p1: await doorsNow(p1), p2: await doorsNow(p2) };
    await askGm(p1);
    await askGm(p2);
    await settle(500);
    const afterGm = await doorOf(p1);
    const answered3 = { p1: await doorsSince(p1, asked3.p1), p2: await doorsSince(p2, asked3.p2) };
    check("E3: the primary answers each player about themselves: the Mastermind's yes with the lair and both parts' stamps, the other's no with the pick's stamp alone",
        doorsFrom("gm") > beforeAsk.gm && afterGm.mine === true && afterGm.stamp === pickedAt
        && J(answered3.p1) === J([yesAt(pickedAt, "Main Hall")]) && J(answered3.p2) === J([noAt(pickedAt)]), J({ answered3, afterGm }));

    const botanAt = await gm.eval(`${MM} await S.mastermindStore.forget();
        const lost = M.mastermindActor();
        await M.setMastermind(game.actors.get("${IDS.botan}"));
        return { lost: lost?.id ?? null, stamp: S.mastermindStore.stampOf("record") };`);
    await settle(600);
    const p1After = await doorOf(p1), p2After = await doorOf(p2);
    const pickOnGm2 = await gm2.eval(`${MM} return M.mastermindActor()?.id ?? null;`);
    check("E4: a GM whose browser lost the pick picks another: the first player's copy says no at the new stamp, the new one's yes, and the other GM holds the new pick (Q3)",
        botanAt.lost === null && p1After.mine === false && p1After.copy?.room === null && p1After.stamp === botanAt.stamp
        && p2After.mine === true && pickOnGm2 === IDS.botan, J({ botanAt, p1After, p2After, pickOnGm2 }));

    /* E5-E6, the review's B1 (26.09): a GM that has not merged a newer pick moves the
       lair. gm2 leaves holding Botan; gm picks Aiko again; gm's store is held - it
       answers nobody, as a primary busy with tier 2 does - so gm2 comes back, times out
       and still holds Botan; gm2 moves the lair to the Kitchen. Let go, gm holds the
       record against what it last told the players and tells Aiko's player the lair
       (`tellDoorChange`). */
    await disconnect("gm2");
    await settle(300);
    await gm.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}")); return true;`);
    await settle(600);
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(true); return true;`);
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(9500);
    const stale = await gm2.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const held = M.mastermindActor()?.id ?? null;
        await M.setMastermindLair("Kitchen");
        return { held, hydration: E.gmStoreHydration().state };`);
    await settle(800);
    const formerAfterStale = await doorOf(p2);
    check("E5: a GM that has not merged a newer pick moves the lair: the former Mastermind's player stays not the Mastermind, and learns no lair",
        stale.held === IDS.botan && stale.hydration === "timedOut" && formerAfterStale.mine === false && formerAfterStale.copy?.room === null,
        J({ stale, formerAfterStale }));

    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(false); return true;`);
    await settle(1500);
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(600);
    const realAfter = await doorOf(p1), formerAfter = await doorOf(p2);
    const converged = await gm2.eval(`${MM} return { pick: M.mastermindActor()?.id ?? null, lair: M.mastermindLair() };`);
    check("E6: once the GMs converge, the Mastermind's player holds the new lair, and the former's answer from the primary is still no",
        converged.pick === IDS.aiko && converged.lair === "Kitchen" && realAfter.mine === true && realAfter.copy?.room === "Kitchen"
        && formerAfter.mine === false && formerAfter.copy?.room === null, J({ converged, realAfter, formerAfter }));
    await gm.eval(`${MM} await M.clearMastermind(); return true;`);
    await disconnect("gm2");
    await settle(300);

    /* E7-E8, the review's M1 (26.09): the upgrade day's clear (the design's H4) is put to
       the primary whichever GM's browser held it, and whenever a pick older than it
       arrives; until a GM decides, no player is told the part. The primary's window is
       answered by a queued answer that waits, so what happens while it is open can be
       read, and then pressed. */
    const WAIT_FOR_WINDOW = `globalThis.__h4 = globalThis.__h4 ?? [];
        globalThis.__dialogAnswers.push(config => new Promise(resolve => globalThis.__h4.push({
            health: config.window?.title === game.i18n.localize("DRPG.Case.healthTitle"),
            buttons: (config.buttons ?? []).map(b => b.action), answer: resolve })));
        return true;`;
    const windowsOnGm = () => gm.eval(`return (globalThis.__h4 ?? []).map(w => ({ health: w.health, buttons: w.buttons }));`);
    const press = choice => gm.eval(`const open = globalThis.__h4?.at(-1); open?.answer?.(${J(choice)}); return Boolean(open);`);
    const decides = w => Boolean(w?.health && w.buttons.includes("keepMastermind") && w.buttons.includes("clearMastermind"));
    const pickStampOn = client => client.eval(`${MM} return { pick: M.mastermindActor()?.id ?? null, at: S.mastermindStore.stampOf("record", "actorId"),
        note: S.mastermindStore.record().legacyClearedAt ?? null };`);

    // E7: the pick on the primary, as its own old store's claim brought it (at an old stamp, through the store,
    // as the claim writes); the clear in the old store of a GM who joins later - a browser that ran 1.2.62.
    const clearedAt = (await pickStampOn(gm)).at;
    await gm.eval(`${MM} await S.mastermindStore.patch("record", { actorId: "${IDS.aiko}", room: "Library" }, { stamp: ${clearedAt + 10} }); return true;`);
    await settle(600);
    await gm.eval(WAIT_FOR_WINDOW);
    // The old store's key, as that browser holds it: the fixture this check is about.
    await connect("gmc", { storage: { [`${MOD}.mastermind`]: J({ actorId: null, room: null, updated: clearedAt + 20 }) } });
    await settle(1500);
    const asked7 = await doorsNow(p1);
    await askGm(p1);
    await settle(500);
    const held7 = await doorsSince(p1, asked7), windows7 = await windowsOnGm(), onGm7 = await pickStampOn(gm);
    check("E7: a clear in a later GM's old store reaches the primary, which asks Keep or Clear, and meanwhile answers the pick's player no",
        onGm7.note === clearedAt + 20 && onGm7.pick === IDS.aiko && windows7.length === 1 && decides(windows7[0])
        && held7.length >= 1 && held7.every(d => J(d) === J(noAt(clearedAt + 10))), J({ onGm7, windows7, held7 }));

    const beforeKeep = await doorsNow(p1);
    await press("keepMastermind");
    await settle(800);
    const keptOnGm = await pickStampOn(gm), keptOnGmc = await pickStampOn(gmc), toldKept = await doorsSince(p1, beforeKeep), p1Kept = await doorOf(p1);
    check("E7b: Keep stamps the pick again: its player is told yes at the new stamp, and the later GM holds the same pick",
        keptOnGm.pick === IDS.aiko && keptOnGm.at > clearedAt + 20 && keptOnGmc.pick === IDS.aiko && keptOnGmc.at === keptOnGm.at
        && toldKept.at(-1)?.value === true && toldKept.at(-1)?.stamps?.actorId === keptOnGm.at && p1Kept.mine === true,
        J({ keptOnGm, keptOnGmc, toldKept, p1Kept }));

    // E8: the clear already held by the primary, and a pick older than it arriving by merge after the check ran.
    await gm.eval(`${MM} await M.clearMastermind(); return true;`);
    await settle(600);
    const clearedAgain = (await pickStampOn(gm)).at;
    const mergeOnGm = (fields, at) => gm.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const theirs = E.emptySection();
        E.writeFields(theirs, "record", ${J(fields)}, ${at}, S.mastermindStore.spec);
        await S.mastermindStore.mergeIn(theirs, { source: "sync" });
        return true;`);
    await gm.eval(WAIT_FOR_WINDOW);
    await mergeOnGm({ legacyClearedAt: clearedAgain + 20 }, clearedAgain + 20);
    await settle(600);
    const windowsNoPick = (await windowsOnGm()).length;
    const asked8 = await doorsNow(p1);
    await mergeOnGm({ actorId: IDS.aiko, room: "Library" }, clearedAgain + 10);
    await settle(800);
    const windows8 = await windowsOnGm(), told8 = await doorsSince(p1, asked8), p1Held = await doorOf(p1);
    check("E8: a pick older than a clear the primary holds, arriving by merge after its check ran, is put to it too, and its player is told no",
        windowsNoPick === 1 && windows8.length === 2 && decides(windows8[1]) && p1Held.mine === false
        && told8.length >= 1 && told8.every(d => J(d) === J(noAt(clearedAgain + 10))), J({ windowsNoPick, windows8, told8, p1Held }));

    await press("clearMastermind");
    await settle(800);
    const clearedE8 = { gm: await pickStampOn(gm), gmc: await pickStampOn(gmc), p1: await doorOf(p1) };
    check("E8b: Clear takes the pick away on every GM, and its player stays not the Mastermind",
        clearedE8.gm.pick === null && clearedE8.gmc.pick === null && clearedE8.gm.at > clearedAgain + 20 && clearedE8.p1.mine === false, J(clearedE8));

    /* E9, the fix list's 14 (DS-m7, 26.09): the window's Keep and Clear act on the record it
       showed. It opens for Aiko's pick under a newer clear; while it is open a newer pick,
       Botan's, arrives by merge - no longer a decision at all. Read at the click, Keep stamped
       Botan's pick afresh, a pick no GM had seen in the window. */
    const shownAt = clearedE8.gm.at;
    await gm.eval(WAIT_FOR_WINDOW);
    await mergeOnGm({ legacyClearedAt: shownAt + 20 }, shownAt + 20);
    await mergeOnGm({ actorId: IDS.aiko, room: "Library" }, shownAt + 10);
    await settle(800);
    const windows9 = await windowsOnGm();
    await mergeOnGm({ actorId: IDS.botan, room: "Kitchen" }, shownAt + 30);
    await settle(600);
    await press("keepMastermind");
    await settle(800);
    const after9 = await pickStampOn(gm), windowsAfter9 = await windowsOnGm();
    check("E9: a pick that arrived while the window was open is not what Keep stamps - the window acts on the record it showed",
        decides(windows9.at(-1)) && after9.pick === IDS.botan && after9.at === shownAt + 30 && windowsAfter9.length === windows9.length,
        J({ windows9: windows9.length, after9, windowsAfter9: windowsAfter9.length }));
    await gm.eval(`${MM} await M.clearMastermind(); return true;`);
    await settle(600);
    await gm.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
    await disconnect("gmc");
    await settle(300);

    /* ------------------- F. the incident's cast, stamped ------------------- */

    phase("F: the incident's cast through the primary GM, and closed by another", { flow: "murder-incident" });
    const CAST = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const M = await import("${repoUrl}/scripts/murder.mjs");`;
    const castOn = client => client.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const cast = incidentCast();
        return { killer: cast.killerId ?? null, victim: cast.victimId ?? null, third: cast.thirdId ?? null, stamp: E.mineStamp("cast"),
            stamps: E.mineStamps("cast") };`);
    const recordOn = client => client.eval(`${CAST} const r = S.castStore.record();
        return { killer: r.killerId ?? null, state: M.murderState()?.killerId ?? null, stamp: S.castStore.stampOf("record", "killerId") };`);
    // What each cast packet says, as p3 (the killer's player) and p1 (a bystander) receive it - as for the door (M2).
    const RECORD_CASTS = `globalThis.__casts = [];
        game.socket.on("module.${MOD}", (payload, senderId) => {
            if (payload?.action === "incident.myCast") globalThis.__casts.push({ from: senderId, cast: payload.cast ?? null, stamps: payload.stamps ?? null });
        });
        return true;`;
    await p3.eval(RECORD_CASTS);
    await p1.eval(RECORD_CASTS);
    const castsNow = client => client.eval(`return globalThis.__casts.length;`);
    const castsSince = (client, n) => client.eval(`return globalThis.__casts.slice(${n});`);
    const castStampsOn = client => client.eval(`${CAST} return Object.fromEntries(["killerId", "killerTurnId", "victimId", "thirdId", "thirdSide", "lastCrisis", "betrayal"]
        .map(f => [f, S.castStore.stampOf("record", f)]));`);
    /* The killer's opening roll is thrown on p3's client with the harness's dice: forced to a
       critical, which always opens the incident. Left random, it failed once in six runs
       ("Murder closed (openingFailed)", the C7 run, 26.09) and F read a closed incident. */
    await p3.eval(`globalThis.__forceRoll = { hope: 10, fear: 10 }; return true;`);
    const openedAt = await gm.eval(`${CAST} await M.openMurder({ killerId: "${IDS.chie}", victimId: "${IDS.daichi}" });
        return S.castStore.stampOf("record");`);
    await settle(800);
    const p3First = await castOn(p3);
    check("F1: the incident opened on the GM reaches the killer's player's copy, at the record's stamp",
        p3First.killer === IDS.chie && p3First.victim === IDS.daichi && p3First.stamp === openedAt && openedAt > 0, J({ openedAt, p3First }));

    await connect("gm2");
    await settle(1500);
    const castsFrom = from => socketTraffic.filter(t => t.from === from && t.action === "incident.myCast").length;
    const castBefore = { gm: castsFrom("gm"), gm2: castsFrom("gm2") };
    await p3.eval(`game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${GM2}"] }); return true;`);
    await settle(500);
    const p3AfterGm2 = await castOn(p3);
    check("F2: a second GM with an empty browser, asked for the cast, does not answer, and the participant keeps it",
        castsFrom("gm2") === castBefore.gm2 && p3AfterGm2.killer === IDS.chie && p3AfterGm2.stamp === openedAt, J({ castBefore, gm2Sent: castsFrom("gm2"), p3AfterGm2 }));

    const askedF = { p3: await castsNow(p3), p1: await castsNow(p1) };
    await p3.eval(`game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await p1.eval(`game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(500);
    const p3AfterGm = await castOn(p3), onGmF = await recordOn(gm), onGm2F = await recordOn(gm2);
    const answeredF = { p3: await castsSince(p3, askedF.p3), p1: await castsSince(p1, askedF.p1) }, stampsF = await castStampsOn(gm);
    const seatsF = { killerId: stampsF.killerId, victimId: stampsF.victimId, thirdId: stampsF.thirdId, betrayal: stampsF.betrayal };
    check("F3: the primary answers the killer's player with the cast and every part's stamp, a bystander with nothing and the seats' stamps alone, and both GMs hold the killer",
        castsFrom("gm") > castBefore.gm && p3AfterGm.stamp === openedAt && onGmF.state === IDS.chie && onGm2F.state === IDS.chie
        && answeredF.p3.length === 1 && answeredF.p3[0].cast?.killerId === IDS.chie && answeredF.p3[0].cast?.victimId === IDS.daichi
        && !("swung" in (answeredF.p3[0].cast ?? {})) && J(answeredF.p3[0].stamps) === J(stampsF)
        && J(answeredF.p1) === J([{ from: IDS.gm, cast: {}, stamps: seatsF }]), J({ answeredF, stampsF, p3AfterGm, onGmF, onGm2F }));

    /* F5, the review's B1 for the cast (26.09): a GM that has not merged a newer write lets
       a third in. gm's store is held (it sends the other GMs nothing and, since the fix round,
       no player anything; what they send it still merges), gm writes every seat and the turn
       afresh (the health check's "enter the cast by hand"); gm2, which never saw that, lets
       Aiko walk in and tells the participants a copy older in those parts. Let go, gm holds
       the cast against what it last told them and tells the change (`tellCastChange`): on
       the fix round's first draft, which took the cast at the release as told, the killer's
       player and the third kept gm2's older turn (measured 26.09: this check failed on it). */
    await gm.eval(`const w = game.settings.get("${MOD}", "murderState"); await game.settings.set("${MOD}", "murderState", { ...w, stage: "incident" }); return true;`);
    await settle(400);
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(true); return true;`);
    await gm.eval(`${CAST} await M.enterCast({ killerId: "${IDS.chie}", victimId: "${IDS.daichi}" }); return true;`);
    await settle(400);
    const enteredAt = (await castStampsOn(gm)).killerTurnId;
    const askedF5 = await castsNow(p3);
    await gm2.eval(`${CAST} await M.thirdPartyEnters(game.actors.get("${IDS.aiko}")); return true;`);
    await settle(800);
    const fromGm2 = (await castsSince(p3, askedF5)).filter(d => d.from === GM2);
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(false); return true;`);
    await settle(1500);
    const p3Merged = await castOn(p3), p1Merged = await castOn(p1), onGm2F5 = await castStampsOn(gm2);
    check("F5: a GM that has not merged a newer write lets a third in: its copy is older in the turn, and once the GMs agree the primary tells the killer's player and the third the cast with both",
        enteredAt > openedAt && fromGm2.length === 1 && fromGm2[0].cast?.thirdId === IDS.aiko && fromGm2[0].stamps?.killerTurnId < enteredAt
        && p3Merged.third === IDS.aiko && p3Merged.stamps?.killerTurnId === enteredAt && p1Merged.third === IDS.aiko
        && p1Merged.stamps?.killerTurnId === enteredAt && onGm2F5.killerTurnId === enteredAt, J({ enteredAt, fromGm2, p3Merged, p1Merged, onGm2F5 }));

    /* F6, the round-2 review's M1 (26.09): a GM whose browser lost the cast - here forgotten, as a
       lost browser has it - presses Pass the turn while the GM that kept it is away. Every field of
       the record was stamped, the absent ones null, so the killer read null on every GM and in the
       killer's player's copy once they met again (their scenario 97, P1). The turn is refused now,
       with the way back named, and the write stamps only what it names. */
    await disconnect("gm2");
    await settle(300);
    const passedF6 = await gm.eval(`${CAST} await S.castStore.forget();
        const n = globalThis.__notifications.length;
        const result = await M.passTurn();
        return { result: result === null ? null : "passed", warned: globalThis.__notifications.slice(n).filter(x => x.level === "warn").map(x => x.msg) };`);
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(1500);
    const afterF6 = { gm: await recordOn(gm), gm2: await recordOn(gm2), p3: await castOn(p3) };
    check("F6: a GM whose browser lost the cast is refused the turn, told the way back, and once the GM that kept it is back every record and the killer's copy still name the killer",
        passedF6.result === null && passedF6.warned.some(m => m.includes("Enter the cast by hand"))
        && afterF6.gm.killer === IDS.chie && afterF6.gm2.killer === IDS.chie && afterF6.p3.killer === IDS.chie, J({ passedF6, afterF6 }));

    await gm2.eval(`${CAST} await M.endMurder({ reason: "E04 61F", followUp: false }); return true;`);
    await settle(800);
    const closedGm = await recordOn(gm), closedGm2 = await recordOn(gm2), closedP3 = await castOn(p3);
    check("F4: the second GM closes the incident: both GMs' records and the participant's copy are cleared, by one stamp",
        closedGm.killer === null && closedGm2.killer === null && closedP3.killer === null && closedGm.stamp > openedAt
        && closedGm.stamp === closedGm2.stamp && closedP3.stamp === closedGm.stamp, J({ closedGm, closedGm2, closedP3 }));
    await p3.eval(`delete globalThis.__forceRoll; return true;`);
    await disconnect("gm2");
    await settle(300);

    /* ------------------- G. a trap planted on another GM ------------------- */

    phase("G: a plant left by a second GM, found through the primary, and its trap", { flow: "trap-fire" });
    const TRAP = `const T = await import("${repoUrl}/scripts/traps.mjs");
        const P = await import("${repoUrl}/scripts/projects.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");`;
    const trap = await gm.eval(`${TRAP}
        const room = M.roomOfActor(game.actors.get("${IDS.aiko}"));
        const made = await P.createProject({ name: "E04 poisoned kit", target: 1, room, indirectMurder: true, killerId: "${IDS.botan}",
            condition: "E04 61G", trigger: { kind: "item", afterDark: false, notBuilder: true } });
        await P.addProgress(made.id, 1, { by: "${IDS.botan}" });
        await new Promise(r => setTimeout(r, 300));
        return { id: made?.id ?? null, room, armed: T.diagnoseTraps().armed, scene: canvas?.scene?.id ?? game.scenes.current?.id ?? null };`);
    await connect("gm2");
    await settle(1500);
    const identity = await gm2.eval(`${TRAP}
        return T.plantItem("${trap.id}", "${trap.room}", { sceneId: "${trap.scene}", name: "E04 planted kit" });`);
    await settle(800);
    const onPrimary = await gm.eval(`${TRAP} const { trapPlantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { trap: T.trapForItemId("${identity}"), planted: Object.values(trapPlantStore?.entries?.() ?? {}).some(p => p?.drpgItemId === "${identity}") };`);
    check("G1: a trap armed on the GM, and an object planted for it by the second GM, reach the primary GM",
        Boolean(trap.id) && trap.armed >= 1 && Boolean(identity) && onPrimary.trap === trap.id && onPrimary.planted, J({ trap, identity, onPrimary }));

    const search = await p1.eval(`const actor = game.actors.get("${IDS.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        let err = null;
        try { await game.drpg.performAction(actor, "search", {}); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        await new Promise(r => setTimeout(r, 800));
        const item = actor.items.find(i => i.getFlag("${MOD}", "drpgItemId") === "${identity}");
        return { err, item: item ? { id: item.id, name: item.name } : null };`, { timeout: 90000 });
    await settle(600);
    const stillPlanted = await gm.eval(`const { trapPlantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return Object.values(trapPlantStore?.entries?.() ?? {}).some(p => p?.drpgItemId === "${identity}");`);
    check("G2: p1's Search in that room is handed the planted object by the primary, and the plant is gone",
        !search.err && search.item?.name === "E04 planted kit" && !stillPlanted, J({ search, stillPlanted }));

    const cardsBefore = await gm.eval(`return game.messages.size;`);
    const used = await p1.eval(`const actor = game.actors.get("${IDS.aiko}");
        const item = actor.items.get("${search.item?.id ?? ""}");
        let r = null, err = null;
        try { r = await game.drpg.useItem(actor, item); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        return { r: r === null ? null : typeof r, err };`, { timeout: 60000 });
    await settle(1200);
    const alert = await gm.eval(`const msgs = game.messages.contents.slice(${cardsBefore});
        return msgs.filter(m => /E04 poisoned kit/.test(m.content ?? "") || /E04 poisoned kit/.test(JSON.stringify(m.flags ?? {}))).length;`);
    check("G3: its use sets the trap off on the primary GM",
        !used.err && alert >= 1, J({ used, alert, cardsBefore }));
    // p1's dice go back to the harness's own (the round-2 review's m2): a later roll must not use G's.
    await p1.eval(`delete globalThis.__forceRoll; return true;`);
    await disconnect("gm2");
    await settle(300);

    /* ------------------- I. the fog ledger reaches a GM who joins ------------------- */

    /* gm finds two rooms for Aiko and unticks one while gm2 is away; gm2 comes back with
       its browser: the store's exchange brings it the same cells, the untick with them -
       the old GM-to-GM copy was the union, which had no way to say "unticked" (S07-01). */
    phase("I: the fog ledger's cells reach a GM who joins, an untick with them", { flow: "discovery-ledger" });
    const FOG = `const F = await import("${repoUrl}/scripts/fog.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");`;
    const fogRooms = await gm.eval(`${FOG} const rooms = (await import("${repoUrl}/scripts/movement.mjs")).allRooms().slice(0, 2);
        await F.setDiscovery(canvas.scene, { actorId: "${IDS.aiko}", rooms, value: true });
        await F.applyDiscoveryChanges(canvas.scene, [{ actorId: "${IDS.aiko}", room: rooms[0], value: false }]);
        return rooms;`);
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(1500);
    const fogOn = client => client.eval(`${FOG} return { digest: E.sectionDigest(S.discoveryStore.section()),
        aiko: F.discoveredFor(canvas.scene.id, "${IDS.aiko}"), cell: S.discoveryStore.get(canvas.scene.id + "/${IDS.aiko}")?.[${J(fogRooms[0])}] ?? null };`);
    const fogGm = await fogOn(gm), fogGm2 = await fogOn(gm2);
    check("I1: a GM who joins holds the same fog cells as the primary, the unticked room unticked",
        fogRooms.length === 2 && J(fogGm2.digest) === J(fogGm.digest) && J(fogGm2.aiko) === J([fogRooms[1]]) && fogGm2.cell === false,
        J({ fogRooms, fogGm, fogGm2 }));

    /* ------------------- H1. a Level Up offered, synced ------------------- */

    phase("H1: a Level Up offered on the primary lights its owner's button, and the second GM holds it", { flow: "class-trial" });
    const LV = `const L = await import("${repoUrl}/scripts/level-up.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");`;
    // What each offers packet says, as p1 receives it (as for the door and the cast, the review's M2).
    // And the refusals addressed to p1: a spend is answered "got it" first, and refused after (E31).
    await p1.eval(`globalThis.__offers = []; globalThis.__refusals = [];
        game.socket.on("module.${MOD}", (payload, senderId) => {
            if (payload?.action === "advancement.offers") globalThis.__offers.push({ from: senderId, offers: payload.offers ?? null, stamps: payload.stamps ?? null });
            if (payload?.action === "bridge.refused") globalThis.__refusals.push({ from: senderId, what: payload.what ?? null, reason: payload.reason ?? null });
        });
        return true;`);
    const offersSince = n => p1.eval(`return globalThis.__offers.slice(${n});`);
    const offersNow = () => p1.eval(`return globalThis.__offers.length;`);
    const litOn = client => client.eval(`${LV} const a = game.actors.get("${IDS.aiko}");
        return { offer: L.pendingAdvance(a)?.kind ?? null, stamp: game.user.isGM ? (S.offerStore?.newest("${IDS.aiko}") ?? null) : (E.mineStamps("offers")["${IDS.aiko}"] ?? 0),
            advances: a.getFlag("${MOD}", "advances") ?? 0 };`);
    const offeredAt = await gm.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.aiko}"), "standard");
        return S.offerStore?.newest("${IDS.aiko}") ?? null;`);
    await settle(800);
    const litH1 = await litOn(p1), onGm2H1 = await litOn(gm2);
    check("H1: a Standard Level Up offered on the primary reaches Aiko's player at its stamp, and the second GM holds it",
        offeredAt > 0 && J([litH1.offer, litH1.stamp]) === J(["standard", offeredAt]) && J([onGm2H1.offer, onGm2H1.stamp]) === J(["standard", offeredAt]),
        J({ offeredAt, litH1, onGm2H1 }));

    /* ------------------- K. the upgrade day's claim of an old cast, one of them stale ------------------- */

    /* K (the round-2 review's R2-B1, 26.09.2026): a 1.2.62 cast entry is written whole, and its
       nulls are decisions - "no third" at its `updated`. Two GMs' browsers first open 1.2.63 while
       an incident runs: gmb's old key holds the running one (Chie kills Daichi, no third), gmc's
       the previous one, which gmc last saw (Botan and Daichi, Aiko its third on the killer's side,
       older). The claim took only the non-null fields, so gmc's older third filled the running
       incident on every GM, and the primary sent Aiko's player the cast, its killer included
       (measured on d32f8f2 in the review's scenario 94). The primary clears the cast store first,
       so no newer stamp left from F decides it in the fix's place, and both again after. */
    phase("K: two GMs' old casts are claimed on the upgrade day, one of them stale", { flow: "murder-incident" });
    const castK = client => client.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const r = S.castStore.record(); return { killerId: r.killerId ?? null, thirdId: r.thirdId ?? null, thirdSide: r.thirdSide ?? null,
            claimed: S.castStore.census()?.claimed ?? null };`);
    const stateBeforeK = await gm.eval(`return foundry.utils.deepClone(game.settings.get("${MOD}", "murderState") ?? {});`);
    const clearedK = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.clear();
        await game.settings.set("${MOD}", "murderState", { active: true, stage: "incident", turn: 2, turnSide: "killer", indirect: false });
        return S.castStore.cleared();`);
    await settle(1200);
    const runningK = { killerId: IDS.chie, victimId: IDS.daichi, killerTurnId: IDS.chie, thirdId: null, thirdSide: null, lastCrisis: null, updated: clearedK + 600 };
    const staleK = { killerId: IDS.botan, victimId: IDS.daichi, killerTurnId: IDS.botan, thirdId: IDS.aiko, thirdSide: "killer", updated: clearedK + 300 };
    const castsK = await p1.eval(`return globalThis.__casts.length;`);
    await connect("gmb", { storage: { [`${MOD}.incidentCast`]: J(runningK) } });
    await settle(1500);
    await connect("gmc", { storage: { [`${MOD}.incidentCast`]: J(staleK) } });
    await settle(2000);
    const onGmK = await castK(gm), onGmbK = await castK(gmb), onGmcK = await castK(gmc);
    // What p1 was sent, as it receives it (F records it): a "not in it" answer to its own ask carries nobody.
    const castToP1 = (await p1.eval(`return globalThis.__casts.slice(${castsK});`)).filter(d => Object.keys(d.cast ?? {}).length);
    check("K1: both GM browsers claimed their old cast, and every record keeps the running incident's \"no third\" - the previous incident's third is not in it",
        onGmbK.claimed === 1 && onGmcK.claimed === 1 && [onGmK, onGmbK, onGmcK].every(r => r.killerId === IDS.chie && r.thirdId === null && r.thirdSide === null),
        J({ onGmK, onGmbK, onGmcK }));
    check("K2: Aiko's player, in no part of the running incident, is sent no cast", castToP1.length === 0, J({ castToP1 }));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.clear();
        await game.settings.set("${MOD}", "murderState", ${J(stateBeforeK)}); return true;`);
    await settle(800);
    await disconnect("gmb");
    await disconnect("gmc");
    await settle(300);

    /* ------------------- J. the season reset is the primary's, and the clock cuts ------------------- */

    /* J1: a Mastermind is picked on the primary while gm2 is here, so gm2's browser holds a
       pick (E ended with none) - and gm2, not the primary while the seed GM is, is refused the
       reset. A queued "cancel" stands in for the GM at the window, should one open (on 1.2.62
       it did, for any GM), so the run never waits on it. */
    phase("J1: a GM who is not the primary is refused the season reset and told whose it is", { flow: "gm-store" });
    const RESET = `const R = await import("${repoUrl}/scripts/season-setup.mjs");`;
    const cutsOn = client => client.eval(`return (await import("${repoUrl}/scripts/clock.mjs")).getClock().resetCuts ?? {};`);
    await gm.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Library" }); return true;`);
    await settle(800);
    const pickedJ1 = await gm2.eval(`${MM} return S.mastermindStore.record().actorId ?? null;`);
    const gmName = await gm.eval(`return game.user.name;`);
    const cutsBefore = await cutsOn(gm);
    const refusedJ1 = await gm2.eval(`${RESET} const title = game.i18n.localize("DRPG.Season.resetTitle");
        const n = globalThis.__notifications.length, d = globalThis.__dialogLog.length;
        globalThis.__dialogAnswers.push("cancel");
        const result = await R.resetSeason();
        return { result, warned: globalThis.__notifications.slice(n).filter(x => x.level === "warn").map(x => x.msg),
            windows: globalThis.__dialogLog.slice(d).filter(x => x.title === title).length };`, { timeout: 30000 });
    const cutsAfterJ1 = await cutsOn(gm);
    check("J1: the second GM's season reset is refused and names the primary GM; no window opens and the clock is not cut",
        pickedJ1 === IDS.aiko && refusedJ1.result === null && refusedJ1.warned.some(m => m.includes(gmName)) && refusedJ1.windows === 0
        && J(cutsAfterJ1) === J(cutsBefore), J({ pickedJ1, gmName, refusedJ1, cutsBefore, cutsAfterJ1 }));

    /* J1b (the round-2 reviews' R2-M1 and M3, the fix list's 13, 26.09): tier 2 writes its fixtures
       into this world's records with the stores held, and puts them back before it lets go. While
       held, the primary told the players the fixture's pick, and answered a player's request from it
       at a stamp that stayed (their scenario 93: p1 believed they were the Mastermind with no GM
       holding a pick). Now: nothing is sent while held, the request waits, and once the record is
       back and the hold let go it is answered from the real record - no player's copy says
       anything else (the record put back here is written afresh, so Aiko's player is told it again
       at its new stamps). */
    const doorPackets = n => socketTraffic.slice(n).filter(t => t.action === "mastermind.door");
    const fromJ1b = socketTraffic.length;
    await gm.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(true);
        await S.mastermindStore.patch("record", { actorId: "${IDS.botan}", room: "J1b fixture lair" }); return true;`);
    await settle(500);
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(800);
    const whileHeld = doorPackets(fromJ1b).map(t => t.to);
    const fromRelease = socketTraffic.length;
    await gm.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        await S.mastermindStore.patch("record", { actorId: "${IDS.aiko}", room: "Library" }); E.gmStoreHold(false); return true;`);
    await settle(1200);
    const afterRelease = doorPackets(fromRelease).map(t => t.to);
    const p1J1b = await doorOf(p1), p2J1b = await doorOf(p2);
    check("J1b: while the stores are held a fixture pick is told to no player and a request waits; let go, the request is answered from the real record and no copy moved",
        whileHeld.length === 0 && afterRelease.some(to => Array.isArray(to) && to.includes(IDS.p2))
        && p1J1b.copy?.mastermind === true && p1J1b.copy?.room === "Library" && p2J1b.copy?.mastermind === false,
        J({ whileHeld, afterRelease, p1J1b, p2J1b }));
    await disconnect("gm2");
    await settle(300);

    /* J2: the primary resets through the window, the answer queued as a GM gives it (the
       word and the ticks): the traces and the Mastermind, then the traces alone. */
    phase("J2: the primary resets twice: the traces and the Mastermind, then the traces alone", { flow: "gm-store" });
    const resetOnce = ticked => gm.eval(`${RESET} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const word = game.i18n.localize("DRPG.Season.resetWord");
        let shown = null;
        globalThis.__dialogAnswers.push(config => {
            shown = typeof config.content === "string" ? config.content : (config.content?.outerHTML ?? "");
            return { word, ticked: ${J(ticked)} };
        });
        const result = await R.resetSeason();
        await E.gmStoresIdle();
        const clock = (await import("${repoUrl}/scripts/clock.mjs")).getClock();
        return { cleared: result?.cleared ?? null, offline: /Second GM/.test(shown ?? ""), cuts: clock.resetCuts ?? {},
            season: clock.seasonStartedAt ?? null,
            watermarks: { remnants: S.remnantStore.cleared(), mastermind: S.mastermindStore.cleared(), offers: S.offerStore.cleared() },
            traces: Object.keys(S.remnantStore.entries()).length,
            tokens: game.scenes.contents.reduce((n, scene) => n + scene.tokens.filter(t => t.getFlag("${MOD}", "isRemnant")).length, 0),
            pick: S.mastermindStore.record().actorId ?? null, offer: S.offerStore.get("${IDS.aiko}")?.kind ?? null };`, { timeout: 60000 });
    const firstReset = await resetOnce(["remnants", "mastermind"]);
    await settle(600);
    const secondReset = await resetOnce(["remnants"]);
    await settle(600);
    const cutJ2 = firstReset.cuts;
    check("J2a: the first reset names the GMs away, cuts the traces and the Mastermind at one stamp its steps come after, and keeps the Level Up",
        J(firstReset.cleared) === J(["Remnants", "the Mastermind"]) && firstReset.offline
        && cutJ2.remnants > 0 && cutJ2.mastermind === cutJ2.remnants && !("advancement" in cutJ2) && firstReset.season === null
        && firstReset.watermarks.remnants > cutJ2.remnants && firstReset.watermarks.mastermind >= cutJ2.mastermind
        && firstReset.traces === 0 && firstReset.tokens === 0 && firstReset.pick === null && firstReset.offer === "standard", J(firstReset));
    // With no trace left the primary still clears the store, after the cut (the review's C-m5: it cleared only with a live row to see).
    check("J2b: the second cuts the traces again and clears them with none left, leaves the Mastermind's cut where the first put it, and keeps the Level Up",
        J(secondReset.cleared) === J(["Remnants"]) && secondReset.cuts.remnants > cutJ2.remnants && secondReset.watermarks.remnants > secondReset.cuts.remnants
        && secondReset.cuts.mastermind === cutJ2.mastermind && !("advancement" in secondReset.cuts) && secondReset.offer === "standard", J(secondReset));

    /* J3: the seed GM leaves here for good (a late account can come back, it cannot), and
       gm2 comes back with the browser it left in J1, alone and so the primary: nobody sends
       it the clears, so what it lost it lost by the clock. */
    phase("J3: the second GM comes back alone, and the clock's cuts take what the resets wiped", { flow: "gm-store" });
    const storedSection = (storage, key) => {
        try { return JSON.parse(storage?.[`${MOD}.${key}`] ?? "null")?.worlds?.[worldA] ?? null; } catch { return null; }
    };
    const leftGm2 = await storageOf("gm2");
    const heldGm2 = { traces: Object.keys(storedSection(leftGm2, "gmRemnants")?.e ?? {}).length,
        pick: storedSection(leftGm2, "gmMastermind")?.e?.record?.actorId ?? null };
    /* And two tombstones a month old in its answer keys, written into the browser it brings:
       one of a bullet that is gone, one of an actor that is here - compaction (C10) runs on
       every GM once its stores have the others' copies, alone included. */
    const monthAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const goneBullet = "Actor.J3GONE0000000000.Item.J3GONE0000000000", hereSubject = `Actor.${IDS.aiko}`;
    const bulletsKey = `${MOD}.gmBullets`;
    const bullets = JSON.parse(leftGm2[bulletsKey] ?? "null");
    if (bullets?.worlds?.[worldA]) Object.assign(bullets.worlds[worldA].d ??= {}, { [goneBullet]: monthAgo, [hereSubject]: monthAgo });
    const withTombstones = { ...leftGm2, [bulletsKey]: JSON.stringify(bullets) };
    await disconnect("gm");
    const fromJ3 = socketTraffic.length;
    await connect("gm2", { storage: withTombstones });
    await settle(1500);
    /* J3c (the fix list's 15, the round-2 review's m4): a primary arriving is asked by every
       player for the door, the cast and the fog, on its world's load - the bridge's "a GM is
       listening" signal. They asked on `userConnected`, which on a live reload fires before
       the GM's listeners exist (LIVE-E30-05 is which comes first on v14), and the fog not at all. */
    const ASKS = ["mastermind.doorRequest", "incident.myCastRequest", "fog.request"];
    const asksJ3 = socketTraffic.slice(fromJ3).filter(t => ASKS.includes(t.action) && Array.isArray(t.to) && t.to.includes(GM2));
    check("J3c: a primary GM arriving is asked by every player for the door, the cast and the fog",
        ["p1", "p2", "p3"].every(who => ASKS.every(a => asksJ3.some(t => t.from === who && t.action === a))), J(asksJ3.map(t => [t.from, t.action])));
    const onGm2J3 = await gm2.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const U = await import("${repoUrl}/scripts/utils.mjs");
        return { primary: U.isPrimaryGm(), hydration: E.gmStoreHydration().state,
            watermarks: { remnants: S.remnantStore.cleared(), mastermind: S.mastermindStore.cleared() },
            traces: Object.keys(S.remnantStore.entries()).length, pick: S.mastermindStore.record().actorId ?? null,
            offer: S.offerStore.get("${IDS.aiko}")?.kind ?? null, offerAt: S.offerStore.newest("${IDS.aiko}") };`);
    check("J3: alone after both resets, its traces are cut at the second reset's stamp and its pick at the first's, by the clock alone, and its Level Up is kept",
        heldGm2.traces >= 2 && heldGm2.pick === IDS.aiko && onGm2J3.primary && onGm2J3.hydration === "alone"
        && onGm2J3.watermarks.remnants === secondReset.cuts.remnants && onGm2J3.watermarks.mastermind === cutJ2.mastermind
        && onGm2J3.traces === 0 && onGm2J3.pick === null && onGm2J3.offer === "standard" && onGm2J3.offerAt === offeredAt,
        J({ heldGm2, onGm2J3, cuts: secondReset.cuts }));
    const compacted = await gm2.eval(`${MM} return { gone: S.bulletStore.tombstone(${J(goneBullet)}), here: S.bulletStore.tombstone(${J(hereSubject)}),
        rows: Object.keys(S.bulletStore.entries()).length };`);
    check("J3b: and its stores are compacted once it is alone: a month-old tombstone of a gone bullet goes, one whose subject is here stays, and no row goes",
        Boolean(bullets?.worlds?.[worldA]) && compacted.gone === 0 && compacted.here === monthAgo && compacted.rows === 3, J({ monthAgo, compacted }));

    /* ------------------- H2. the primary alone, and its store empty ------------------- */

    /* gm2 is here since J3, alone and so the primary: it holds the offer from H1. */
    phase("H2: a primary alone answers the owner, spends the offer, and with its store emptied takes nothing away", { flow: "class-trial" });
    // The owner asks as its bridge does (E31's advancement.ask, a report nobody waits on).
    const askOffers = () => p1.eval(`const B = await import("${repoUrl}/scripts/bridge-guards.mjs");
        await B.bridgeRequest("advancement.ask", {}, { settle: "none", quiet: true }); return true;`);
    const askedH2 = await offersNow();
    await askOffers();
    await settle(800);
    const answeredOnJoin = await offersSince(askedH2), litH2 = await litOn(p1);
    const apply = () => p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestAdvancement({ actorId: "${IDS.aiko}", picks: [{ option: "hp" }], kind: "standard" });
        return { ok: Boolean(res?.ok), reason: res?.reason ?? null };`, { timeout: 60000 });
    const spent = await apply();
    await settle(800);
    const afterSpend = await litOn(p1), onGm2Spent = await litOn(gm2);
    check("H2a: the primary alone answers the owner's ask with the offer at its stamp, and spends it: the Level Up is written and the button goes out",
        answeredOnJoin.some(d => d.from === GM2 && d.offers?.[IDS.aiko]?.kind === "standard" && d.stamps?.[IDS.aiko] === offeredAt)
        && litH2.offer === "standard" && spent.ok && afterSpend.offer === null && afterSpend.stamp > offeredAt
        && onGm2Spent.advances === litH2.advances + 1, J({ answeredOnJoin, litH2, spent, afterSpend, onGm2Spent }));

    const secondAt = await gm2.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.aiko}"), "standard");
        const at = S.offerStore?.newest("${IDS.aiko}") ?? null;
        await S.offerStore?.forget();
        return at;`);
    await settle(800);
    const askedEmpty = await offersNow();
    await askOffers();
    await settle(800);
    const emptyAnswer = await offersSince(askedEmpty), litEmpty = await litOn(p1);
    const whispersBefore = await gm2.eval(`return game.messages.size;`);
    const refusalsBefore = await p1.eval(`return globalThis.__refusals.length;`);
    await apply();
    await settle(800);
    const refused = await p1.eval(`return globalThis.__refusals.slice(${refusalsBefore});`);
    // A GM's whisper keeps its words off the card (secret.mjs): read them the way the chat log does.
    const told = await gm2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return game.messages.contents.slice(${whispersBefore}).filter(m => /holds no offer/.test(contentOf(m))).length;`);
    check("H2b: the primary's store emptied, its answer carries stamp 0 and the owner's button stays lit; the spend is refused as not offered, and the GM is told",
        secondAt > afterSpend.stamp && emptyAnswer.length >= 1 && emptyAnswer.every(d => J(d.offers) === "{}" && (d.stamps?.[IDS.aiko] ?? 0) === 0)
        && J([litEmpty.offer, litEmpty.stamp]) === J(["standard", secondAt])
        && J(refused) === J([{ from: GM2, what: "advancement.apply", reason: "notOffered" }]) && told === 1,
        J({ secondAt, emptyAnswer, litEmpty, refused, told }));

    /* H3, the round-2 review's M2 (26.09): Aiko, whose offers p1's copy holds, goes to p2, and
       Daichi to p1; an offer to Daichi must light p1's button. Weighed as a part of every answer,
       the character that left p1's set read as 0 in each answer after it, older than the copy,
       and every answer was refused for the rest of the season. Put back after. */
    phase("H3: an owner whose character went to another player still takes the next offer", { flow: "class-trial" });
    await gm2.eval(`await game.actors.get("${IDS.aiko}").update({ ownership: { "${IDS.p1}": 0, "${IDS.p2}": 3 } });
        await game.actors.get("${IDS.daichi}").update({ ownership: { "${IDS.p1}": 3 } }); return true;`);
    await settle(800);
    const offeredH3 = await gm2.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.daichi}"), "standard");
        return S.offerStore?.newest("${IDS.daichi}") ?? null;`);
    await settle(800);
    const litH3 = await p1.eval(`${LV} return { daichi: L.pendingAdvance(game.actors.get("${IDS.daichi}"))?.kind ?? null, stamps: E.mineStamps("offers") };`);
    check("H3: p1, whose Aiko went to p2, takes the offer to Daichi, now theirs: the button lights at the offer's stamp",
        offeredH3 > 0 && litH3.daichi === "standard" && litH3.stamps[IDS.daichi] === offeredH3 && !(IDS.aiko in litH3.stamps), J({ offeredH3, litH3 }));
    await gm2.eval(`${LV} await L.recordOffer("${IDS.daichi}", null);
        await game.actors.get("${IDS.daichi}").update({ ownership: { "${IDS.p1}": 0 } });
        await game.actors.get("${IDS.aiko}").update({ ownership: { "${IDS.p1}": 3, "${IDS.p2}": 0 } }); return true;`);
    await settle(800);

    /* ------------------- Z. the browser is lost, and the case comes back ------------------- */

    phase("Z: a GM backs up, every GM leaves, an empty browser comes back alone, and another restores", { flow: "gm-store" });
    // gm2 is here since J3, alone; the seed GM left there. J's resets took every trace and the pick, so two traces
    // are placed again and Aiko is picked: the restore below has a door to tell p1 about.
    await gm2.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Z lair" }); return true;`);
    const placedZ = await gm2.eval(`${REM}
        const scene = game.scenes.get("${IDS.scene}");
        const out = [];
        for (const [n, type] of [[1, "incident"], [2, "prep"]]) {
            const token = await R.placeRemnant({ type, visibility: "subtle", x: 100 * n, y: 100, scene, tiedToCrime: n === 1,
                note: "E04 trace " + n, sourceName: "E04" });
            out.push(token.id);
        }
        return out;`);
    const idsZ = placedZ.map(id => `${IDS.scene}.${id}`);
    const expectZ = [["incident", "E04 trace 1", true], ["prep", "E04 trace 2", false]];
    const backup = await gm2.eval(`const file = await game.drpg.backupCase();
        const saved = globalThis.__savedFiles.at(-1) ?? null;
        return { format: file?.format ?? null, rows: Object.keys(file?.stores?.bullets?.e ?? {}).length,
            traces: Object.keys(file?.stores?.remnants?.e ?? {}).sort(), name: saved?.filename ?? null, text: saved?.data ?? null };`);
    check("Z1: the second GM backs the case up to one file, the three answer keys and the two traces' in it",
        backup.format === "drpg-case" && backup.rows === 3 && J(backup.traces) === J([...idsZ].sort())
        && /^drpg-case-drpg-audit-world-/.test(backup.name ?? "") && Boolean(backup.text),
        J({ ...backup, text: backup.text ? `${backup.text.length} characters` : null }));
    await disconnect("gm2");
    await settle(300);
    await connect("gm3");
    await settle(1500);
    const seenOnGm3 = await gm3.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");
        return { primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm(), hydration: E.gmStoreHydration().state,
            dialogs: globalThis.__dialogLog.filter(d => d.title === game.i18n.localize("DRPG.Case.healthTitle")),
            warning: Boolean(S.caseWarning()) };`);
    check("Z2: the empty browser, alone and so the primary, opens the health check naming the missing answer keys, and Continue leaves the warning up",
        seenOnGm3.primary && seenOnGm3.hydration === "alone" && seenOnGm3.dialogs.length === 1
        && /3 Truth Bullets \(of 3\) have no answer key/.test(seenOnGm3.dialogs[0]?.content ?? "")
        && /2 traces on the map \(of 2\) have no answer key/.test(seenOnGm3.dialogs[0]?.content ?? "") && seenOnGm3.warning, J(seenOnGm3));
    /* Z3-Z4 (E04's fix round): the file is restored by ANOTHER GM with an empty browser, gma, whose
       id sorts after gm3's, so gm3 stays the primary with its warning up. Its rows arrive by merge:
       its check runs again on the change and the panel's line goes (the review's C-m15, until then
       up until a reload). And the GM who restored sends every player their copies again (S-m3 =
       C-m7): the door, the offers and the fog, read off the packets. */
    await connect("gma");
    await settle(1500);
    const fromZ = socketTraffic.length;
    const restored = await gma.eval(`const result = await game.drpg.restoreCase(${J(backup.text)});
        return { refused: result?.refused ?? null, primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm() };`);
    await settle(1500);
    const afterZ = await gm3.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const report = await game.drpg.gmStoreHealth();
        return { warning: Boolean(S.caseWarning()), missing: report.rows.filter(r => r.level === "missing").map(r => r.id),
            bullets: report.counts.bullets, traces: report.counts.traces };`);
    const keysOnGm3 = await gm3.eval(keyOf(made));
    const tracesOnGm3 = await gm3.eval(traceRows(idsZ));
    // The restore runs the Faint pass again: the third bullet's Faint moves off its item into its row.
    const answerKeys = rows => rows.map(r => r.slice(0, 5));
    check("Z3: a second empty browser restores the file; the primary's answer keys and traces come back by merge, the Faint pass moves the old flag in, and its check - and the panel's warning - clear without a reload",
        !restored.refused && !restored.primary && J(answerKeys(keysOnGm3)) === J(answerKeys(expected)) && keysOnGm3[2][5] === true
        && J(tracesOnGm3) === J(expectZ) && J(afterZ.missing) === J([]) && !afterZ.warning
        && afterZ.bullets.missing === 0 && afterZ.bullets.noAnswer === 0 && afterZ.traces.missing === 0,
        J({ restored, afterZ, keysOnGm3, tracesOnGm3 }));
    const toldZ = socketTraffic.slice(fromZ).filter(t => t.from === "gma" && !String(t.action ?? "").startsWith("gms."));
    const toEach = action => [IDS.p1, IDS.p2, IDS.p3].every(id => toldZ.some(t => t.action === action && Array.isArray(t.to) && t.to.includes(id)));
    const doorP1 = await p1.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); return E.readMine("door");`);
    check("Z4: the GM who restored sends every player their copies again - the door, the offers and the fog - and p1 holds the part",
        toEach("mastermind.door") && toEach("advancement.offers") && toEach("fog.rows") && doorP1?.mastermind === true,
        J({ told: toldZ.map(t => [t.action, t.to]), doorP1 }));

    /* Z5, the round-2 review's R2-m3 (26.09): gm3 leaves, so gma - not the primary when it loaded -
       is now; gmb comes back and moves the lair. The primary tells a merge that changes the record
       (the review's B1): on a GM that became the primary later, the first change it merged was
       only its baseline, and it told nobody. Read off the packets gma sends p1. */
    await disconnect("gm3");
    await settle(300);
    await connect("gmb", { storage: await storageOf("gmb") });
    await settle(1500);
    const fromZ5 = socketTraffic.length;
    await gmb.eval(`${MM} await M.setMastermindLair("Z5 lair"); return true;`);
    await settle(1500);
    const gmaTold = socketTraffic.slice(fromZ5).filter(t => t.from === "gma" && t.action === "mastermind.door" && Array.isArray(t.to) && t.to.includes(IDS.p1)).length;
    const doorZ5 = await p1.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); return E.readMine("door");`);
    check("Z5: a GM that became the primary after it loaded tells the Mastermind's player a lair another GM moved",
        gmaTold >= 1 && doorZ5?.mastermind === true && doorZ5?.room === "Z5 lair", J({ gmaTold, doorZ5 }));

    return { phases: ["A", "B", "D", "E", "F", "G", "I", "H1", "K", "J1", "J2", "J3", "H2", "H3", "Z"], gm: IDS.gm };
}
