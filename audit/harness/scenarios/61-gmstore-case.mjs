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
 *   Z  the browser is lost (the brief's live verify, headless): a GM backs up the
 *      case, every GM leaves, a third GM comes with an empty browser and is alone,
 *      so the primary; its health check opens and names what is missing, Continue
 *      is taken, the file is restored, the answer keys read back and the check is
 *      clean. Last in the file: the seed GM cannot come back.
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true },
    { who: "gm3", id: "USERGM3000000000", name: "Third GM", role: 4, character: null, color: "#66ffaa", late: true }
];

const PROBE_KEY = "drpg-harness.probe";
const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, gm2, gm3, p1, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS, repoUrl }) {
    const GM2 = "USERGM2000000000";

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
    await connect("gm2", { storage: { [PROBE_KEY]: probe } });
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
    check("A5: two GMs whose stores are equal (empty) exchange digests and nothing more: hellos and dones, no state, no delta",
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

    /* ------------------- Z. the browser is lost, and the case comes back ------------------- */

    phase("Z: a GM backs up, every GM leaves, an empty browser comes back alone and restores", { flow: "gm-store" });
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(1500);
    const backup = await gm2.eval(`const file = await game.drpg.backupCase();
        const saved = globalThis.__savedFiles.at(-1) ?? null;
        return { format: file?.format ?? null, rows: Object.keys(file?.stores?.bullets?.e ?? {}).length, name: saved?.filename ?? null, text: saved?.data ?? null };`);
    check("Z1: the second GM backs the case up to one file, the three answer keys in it",
        backup.format === "drpg-case" && backup.rows === 3 && /^drpg-case-drpg-audit-world-/.test(backup.name ?? "") && Boolean(backup.text),
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
        && /3 Truth Bullets \(of 3\) have no answer key/.test(seenOnGm3.dialogs[0]?.content ?? "") && seenOnGm3.warning, J(seenOnGm3));
    const restored = await gm3.eval(`const result = await game.drpg.restoreCase(${J(backup.text)});
        await new Promise(r => setTimeout(r, 300));
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const report = await game.drpg.gmStoreHealth();
        return { refused: result?.refused ?? null, missing: report.rows.filter(r => r.level === "missing").map(r => r.id),
            bullets: report.counts.bullets };`);
    const keysOnGm3 = await gm3.eval(keyOf(made));
    // The restore runs the Faint pass again: the third bullet's Faint moves off its item into its row.
    const answerKeys = rows => rows.map(r => r.slice(0, 5));
    /* The seeded trace's answer key is not a GM store until the traces move (C4), so an empty
       browser cannot get it back from a file here: the one row left missing is the traces'. */
    check("Z3: the file restored on the empty browser brings every answer key back, the Faint pass moves the old flag in, and only the traces' row is left (C4 moves them)",
        !restored.refused && J(answerKeys(keysOnGm3)) === J(answerKeys(expected)) && keysOnGm3[2][5] === true
        && J(restored.missing) === J(["traces"]) && restored.bullets.missing === 0 && restored.bullets.noAnswer === 0, J({ restored, keysOnGm3 }));

    return { phases: ["A", "B", "Z"], gm: IDS.gm };
}
