/**
 * D2: the discovery ledger is a secret per player. The GMs' browsers hold every
 * character's cells, each player's browser holds only their own characters' rows,
 * the world setting stays empty, a player can pull their rows, and a primary GM
 * with an empty store can rebuild the ledger from what the players hold.
 *
 * Read through the leaves since E04 (1.2.63; audit S07-01): the ledger is a GM
 * store (`discoveryStore`, a cell per character and room) and a player's rows a
 * copy of it (`fogCopy`), and a lost browser is made with the stores' own
 * `forget()`. And a room a GM unticked stays unticked when a player whose copy
 * still holds it answers the primary's rebuild: the union used to take it back.
 */
export const layers = ["ci", "local-gate"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl: REPO }) {
    // Who owns whom is read off the world, not assumed: the harness hands each
    // player one character, and this scenario needs two players with a
    // character each and one who owns neither of those two.
    const clients = [p1, p2, p3];
    const users = {};
    for (const c of clients) users[c.who] = await c.eval(`return game.user.id;`);
    const world = await gm.eval(`return {
        scene: canvas.scene.id,
        rooms: (await import("${REPO}/scripts/movement.mjs")).allRooms().slice(0, 3),
        owners: Object.fromEntries(game.actors.filter(a => a.type === "character").map(a =>
            [a.id, game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER")).map(u => u.id)])) };`);
    const owned = who => Object.entries(world.owners).find(([, us]) => us.length === 1 && us[0] === users[who])?.[0] ?? null;
    const pA = clients.find(c => owned(c.who)), pB = clients.find(c => c !== pA && owned(c.who));
    const pZ = clients.find(c => c !== pA && c !== pB);
    check("gm: two players own one character each, a third owns neither", Boolean(pA && pB && pZ), JSON.stringify(world.owners));
    const ids = { aiko: owned(pA.who), botan: owned(pB.who), scene: world.scene, rooms: world.rooms };
    check("gm: the harness scene has rooms to discover", ids.rooms.length >= 2, JSON.stringify(ids.rooms));
    const [p1_, p2_, p3_] = [pA, pB, pZ];
    // What a client may know of the ledger (settings.mjs `discoveryLedger`), and the world setting it left.
    const ledger = c => c.eval(`return (await import("${REPO}/scripts/settings.mjs")).discoveryLedger();`);
    const worldCopy = c => c.eval(`return game.settings.get("${MOD}", "discoveredRooms") ?? {};`);
    const stores = `const S = await import("${REPO}/scripts/gm-stores.mjs");`;

    // 1. the GM records two characters' discoveries
    phase("record", { flow: "discovery-ledger" });
    await gm.eval(`const F = await import("${REPO}/scripts/fog.mjs");
        await F.setDiscovery(canvas.scene, { actorId: "${ids.aiko}", rooms: ${JSON.stringify(ids.rooms.slice(0, 2))}, value: true });
        await F.setDiscovery(canvas.scene, { actorId: "${ids.botan}", rooms: ${JSON.stringify(ids.rooms.slice(1, 3))}, value: true });
        return true;`, { timeout: 30000 });
    await settle(800);

    const gmLedger = await ledger(gm), gmWorld = await worldCopy(gm);
    check("gm: the ledger sits in the GMs' store", gmLedger?.[ids.scene]?.[ids.aiko]?.length === 2, JSON.stringify(gmLedger).slice(0, 200));
    check("gm: the world setting is empty", Object.keys(gmWorld ?? {}).length === 0, JSON.stringify(gmWorld));

    const mine1 = { mine: await ledger(p1_), world: await worldCopy(p1_) };
    check(`${p1_.who}: holds Aiko's own rows`, (mine1.mine?.[ids.scene]?.[ids.aiko] ?? []).length === 2, JSON.stringify(mine1.mine));
    check(`${p1_.who}: holds nothing of Botan's`, !mine1.mine?.[ids.scene]?.[ids.botan], JSON.stringify(mine1.mine));
    check(`${p1_.who}: the world setting is empty here too`, Object.keys(mine1.world ?? {}).length === 0, JSON.stringify(mine1.world));

    const mine3 = await ledger(p3_);
    check(`${p3_.who}: a bystander holds no rows at all`, !mine3?.[ids.scene]?.[ids.aiko] && !mine3?.[ids.scene]?.[ids.botan], JSON.stringify(mine3));

    // 2. the pull: p2 loses its rows and asks the primary GM for them
    phase("pull", { flow: "discovery-ledger" });
    await p2_.eval(`${stores} await S.fogCopy.forget(); return true;`);
    const lost2 = await ledger(p2_);
    await p2_.eval(`game.socket.emit("module.${MOD}", { action: "fog.request" }, { recipients: [game.users.find(u => u.isGM).id] }); return true;`);
    await settle(800);
    const mine2 = await ledger(p2_);
    check(`${p2_.who}: the pull brings Botan's rows back`, !lost2?.[ids.scene]?.[ids.botan] && (mine2?.[ids.scene]?.[ids.botan] ?? []).length === 2,
        JSON.stringify({ lost2, mine2 }));
    check(`${p2_.who}: and nothing of Aiko's`, !mine2?.[ids.scene]?.[ids.aiko], JSON.stringify(mine2));

    // 3. the rebuild: a primary GM with an empty store asks the players what they hold
    phase("rebuild", { flow: "discovery-ledger" });
    // Asked the way the primary asks at `ready` when its store holds nothing (E03: a reply
    // nobody asked for is not taken, so a raw packet would be answered and ignored).
    await gm.eval(`${stores} await S.discoveryStore.forget();
        (await import("${REPO}/scripts/fog.mjs")).askForShares(); return true;`);
    await settle(1000);
    const rebuilt = await ledger(gm);
    check("gm: the ledger is rebuilt from the players' rows", (rebuilt?.[ids.scene]?.[ids.aiko] ?? []).length === 2 && (rebuilt?.[ids.scene]?.[ids.botan] ?? []).length === 2, JSON.stringify(rebuilt).slice(0, 300));

    // 4. a player cannot write another character's history into the ledger
    phase("forged history", { flow: "discovery-ledger" });
    await p3_.eval(`game.socket.emit("module.${MOD}", { action: "fog.shared", store: { "${ids.scene}": { "${ids.aiko}": ["Forged Room"] } } }, { recipients: [game.users.find(u => u.isGM).id] }); return true;`);
    await settle(600);
    const forged = await ledger(gm);
    check("gm: a forged row from a bystander is refused", !(forged?.[ids.scene]?.[ids.aiko] ?? []).includes("Forged Room"), JSON.stringify(forged).slice(0, 300));

    // 5. an untick stays: Aiko's first room is hidden while her player's browser hears nothing
    //    (its listeners taken off and put back), so its copy still holds the room when it
    //    answers the primary's next rebuild - which the union took back on 1.2.62 (S07-01).
    phase("unticked stays unticked", { flow: "discovery-ledger" });
    const hidden = ids.rooms[0];
    await p1_.eval(`globalThis.drpgFogMuted = [...game.socket.listeners("module.${MOD}")];
        for (const fn of globalThis.drpgFogMuted) game.socket.off("module.${MOD}", fn); return true;`);
    await gm.eval(`const F = await import("${REPO}/scripts/fog.mjs");
        await F.applyDiscoveryChanges(canvas.scene, [{ actorId: "${ids.aiko}", room: ${JSON.stringify(hidden)}, value: false }]); return true;`);
    await settle(600);
    await p1_.eval(`for (const fn of globalThis.drpgFogMuted ?? []) game.socket.on("module.${MOD}", fn); return true;`);
    const staleOnP1 = (await ledger(p1_))?.[ids.scene]?.[ids.aiko] ?? [];
    await gm.eval(`(await import("${REPO}/scripts/fog.mjs")).askForShares(); return true;`);
    await settle(1000);
    const afterRebuild = (await ledger(gm))?.[ids.scene]?.[ids.aiko] ?? [];
    check("gm: a room unticked stays unticked when a player whose copy still holds it answers the rebuild",
        staleOnP1.includes(hidden) && !afterRebuild.includes(hidden) && afterRebuild.length === 1, JSON.stringify({ hidden, staleOnP1, afterRebuild }));

    // 6. the reset empties everyone
    phase("reset", { flow: "discovery-ledger" });
    await gm.eval(`const F = await import("${REPO}/scripts/fog.mjs"); await F.resetLedger(); return true;`);
    await settle(600);
    const after = await ledger(p1_);
    check(`${p1_.who}: the reset reaches the player's rows`, Object.values(after?.[ids.scene] ?? {}).every(r => !r?.length), JSON.stringify(after));
}
