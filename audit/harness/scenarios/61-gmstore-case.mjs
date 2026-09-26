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
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const PROBE_KEY = "drpg-harness.probe";

export async function run({ gm, gm2, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS }) {
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
    check("A5: with no store in the table, the GM store's engine sends nothing between the two GMs",
        traffic.length === 0, JSON.stringify(traffic.slice(0, 5)));

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

    return { phases: ["A"], gm: IDS.gm };
}
