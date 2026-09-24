/**
 * D2: the discovery ledger is a secret per player. The GM's browser holds the
 * union, each player's browser holds only their own characters' rows, the
 * world setting stays empty, a player can pull their rows, and a primary GM
 * with an empty store can rebuild the union from what the clients hold.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, settle, repoUrl: REPO }) {
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

    // 1. the GM records two characters' discoveries
    await gm.eval(`const F = await import("${REPO}/scripts/fog.mjs");
        await F.setDiscovery(canvas.scene, { actorId: "${ids.aiko}", rooms: ${JSON.stringify(ids.rooms.slice(0, 2))}, value: true });
        await F.setDiscovery(canvas.scene, { actorId: "${ids.botan}", rooms: ${JSON.stringify(ids.rooms.slice(1, 3))}, value: true });
        return true;`, { timeout: 30000 });
    await settle(800);

    const gmStore = await gm.eval(`return { ledger: game.settings.get("${MOD}", "discoveryLedger"), world: game.settings.get("${MOD}", "discoveredRooms") };`);
    check("gm: the union sits in the GM's client store", gmStore.ledger?.[ids.scene]?.[ids.aiko]?.length === 2, JSON.stringify(gmStore.ledger).slice(0, 200));
    check("gm: the world setting is empty", Object.keys(gmStore.world ?? {}).length === 0, JSON.stringify(gmStore.world));

    const mine1 = await p1_.eval(`return { mine: game.settings.get("${MOD}", "discoveryMine"), ledger: game.settings.get("${MOD}", "discoveryLedger"), world: game.settings.get("${MOD}", "discoveredRooms") };`);
    check(`${p1_.who}: holds Aiko's own rows`, (mine1.mine?.[ids.scene]?.[ids.aiko] ?? []).length === 2, JSON.stringify(mine1.mine));
    check(`${p1_.who}: holds nothing of Botan's`, !mine1.mine?.[ids.scene]?.[ids.botan], JSON.stringify(mine1.mine));
    check(`${p1_.who}: no union on a player's browser`, Object.keys(mine1.ledger ?? {}).length === 0, JSON.stringify(mine1.ledger));
    check(`${p1_.who}: the world setting is empty here too`, Object.keys(mine1.world ?? {}).length === 0, JSON.stringify(mine1.world));

    const mine3 = await p3_.eval(`return game.settings.get("${MOD}", "discoveryMine");`);
    check(`${p3_.who}: a bystander holds no rows at all`, !mine3?.[ids.scene]?.[ids.aiko] && !mine3?.[ids.scene]?.[ids.botan], JSON.stringify(mine3));

    // 2. the pull: p2 loses its rows and asks the primary GM for them
    await p2_.eval(`await game.settings.set("${MOD}", "discoveryMine", {}); return true;`);
    await p2_.eval(`game.socket.emit("module.${MOD}", { action: "fog.request" }, { recipients: [game.users.find(u => u.isGM).id] }); return true;`);
    await settle(800);
    const mine2 = await p2_.eval(`return game.settings.get("${MOD}", "discoveryMine");`);
    check(`${p2_.who}: the pull brings Botan's rows back`, (mine2?.[ids.scene]?.[ids.botan] ?? []).length === 2, JSON.stringify(mine2));
    check(`${p2_.who}: and nothing of Aiko's`, !mine2?.[ids.scene]?.[ids.aiko], JSON.stringify(mine2));

    // 3. the rebuild: a primary GM with an empty store asks the clients what they hold
    // Asked the way the primary asks at `ready` (E03: a reply nobody asked for is
    // not taken any more, so the raw packet this used to emit would be answered
    // and ignored - which is the point of the change, not a failure of it).
    await gm.eval(`await game.settings.set("${MOD}", "discoveryLedger", {});
        (await import("${REPO}/scripts/fog.mjs")).askForShares(); return true;`);
    await settle(1000);
    const rebuilt = await gm.eval(`return game.settings.get("${MOD}", "discoveryLedger");`);
    check("gm: the union is rebuilt from the players' rows", (rebuilt?.[ids.scene]?.[ids.aiko] ?? []).length === 2 && (rebuilt?.[ids.scene]?.[ids.botan] ?? []).length === 2, JSON.stringify(rebuilt).slice(0, 300));

    // 4. a player cannot write another character's history into the union
    await p3_.eval(`game.socket.emit("module.${MOD}", { action: "fog.shared", store: { "${ids.scene}": { "${ids.aiko}": ["Forged Room"] } } }, { recipients: [game.users.find(u => u.isGM).id] }); return true;`);
    await settle(600);
    const forged = await gm.eval(`return game.settings.get("${MOD}", "discoveryLedger");`);
    check("gm: a forged row from a bystander is refused", !(forged?.[ids.scene]?.[ids.aiko] ?? []).includes("Forged Room"), JSON.stringify(forged).slice(0, 300));

    // 5. the reset empties everyone
    await gm.eval(`const F = await import("${REPO}/scripts/fog.mjs"); await F.resetLedger(); return true;`);
    await settle(600);
    const after = await p1_.eval(`return game.settings.get("${MOD}", "discoveryMine");`);
    check(`${p1_.who}: the reset reaches the player's rows`, Object.values(after?.[ids.scene] ?? {}).every(r => !r?.length), JSON.stringify(after));
}
