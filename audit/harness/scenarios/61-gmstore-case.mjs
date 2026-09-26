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
 * Phases, in the order they run (the design's section 12; a phase that closes the
 * seed GM runs last, because only a late account can connect again):
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
 *   Z  the browser is lost (the brief's live verify, headless): a GM backs up the
 *      case, every GM leaves, a third GM comes with an empty browser and is alone,
 *      so the primary; its health check opens and names what is missing, Continue
 *      is taken, the file is restored, the answer keys read back and the check is
 *      clean. Last in the file: the seed GM cannot come back.
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
       and still holds Botan; gm2 moves the lair to the Kitchen. */
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
       a third in. gm's store is held (it sends the other GMs nothing; what they send it still
       merges), gm writes every seat and the turn afresh (the health check's "enter the cast
       by hand") and tells p3 itself; gm2, which never saw that, lets Aiko walk in and tells
       the participants a copy older in those parts. */
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
    await disconnect("gm2");
    await settle(300);

    /* ------------------- Z. the browser is lost, and the case comes back ------------------- */

    phase("Z: a GM backs up, every GM leaves, an empty browser comes back alone and restores", { flow: "gm-store" });
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(1500);
    const backup = await gm2.eval(`const file = await game.drpg.backupCase();
        const saved = globalThis.__savedFiles.at(-1) ?? null;
        return { format: file?.format ?? null, rows: Object.keys(file?.stores?.bullets?.e ?? {}).length,
            traces: Object.keys(file?.stores?.remnants?.e ?? {}).sort(), name: saved?.filename ?? null, text: saved?.data ?? null };`);
    check("Z1: the second GM backs the case up to one file, the three answer keys and the two traces' in it",
        backup.format === "drpg-case" && backup.rows === 3 && J(backup.traces) === J([`${IDS.scene}.${placedD[0]}`, seedKey].sort())
        && /^drpg-case-drpg-audit-world-/.test(backup.name ?? "") && Boolean(backup.text),
        J({ ...backup, text: backup.text ? `${backup.text.length} characters` : null }));
    await disconnect("gm");
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
    const restored = await gm3.eval(`const result = await game.drpg.restoreCase(${J(backup.text)});
        await new Promise(r => setTimeout(r, 300));
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const report = await game.drpg.gmStoreHealth();
        return { refused: result?.refused ?? null, missing: report.rows.filter(r => r.level === "missing").map(r => r.id),
            bullets: report.counts.bullets, traces: report.counts.traces };`);
    const keysOnGm3 = await gm3.eval(keyOf(made));
    const tracesOnGm3 = await gm3.eval(traceRows(idsD.slice(0, 2)));
    // The restore runs the Faint pass again: the third bullet's Faint moves off its item into its row.
    const answerKeys = rows => rows.map(r => r.slice(0, 5));
    check("Z3: the file restored on the empty browser brings every answer key and trace back, the Faint pass moves the old flag in, and the check is clean",
        !restored.refused && J(answerKeys(keysOnGm3)) === J(answerKeys(expected)) && keysOnGm3[2][5] === true
        && J(tracesOnGm3) === J(expectD.slice(0, 2)) && J(restored.missing) === J([])
        && restored.bullets.missing === 0 && restored.bullets.noAnswer === 0 && restored.traces.missing === 0, J({ restored, keysOnGm3, tracesOnGm3 }));

    return { phases: ["A", "B", "D", "E", "F", "G", "Z"], gm: IDS.gm };
}
