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

    /* NO GM STORE ON A PLAYER'S BROWSER (E04's fix round; the round-2 reviews' R2-m1 and m1). The
       check C9 took out read the GMs' key on p1 ("no union on a player's browser"), and nothing read
       it since. Through the engine: on each player every store's section is empty and its key is not
       in the browser's storage, and a write through a handle there is refused. */
    for (const c of [p1_, p3_]) {
        const held = await c.eval(`const E = await import("${REPO}/scripts/gm-store.mjs");
            const rows = E.gmStoreHandles().map(h => { const s = h.section();
                return [h.name, Object.keys(s.e).length + Object.keys(s.d).length + (s.cleared ? 1 : 0), game.settings.storage.get("client").getItem("${MOD}." + h.spec.key) !== null]; });
            await E.gmStoreByName("discovery").patch("R60PLANTED", { "Forged Room": true });
            return { dirty: rows.filter(([, n, key]) => n || key), stores: rows.length, planted: E.gmStoreByName("discovery").get("R60PLANTED") };`);
        check(`${c.who}: no GM store is held on a player's browser, and a write there is refused`,
            held.stores >= 10 && held.dirty.length === 0 && held.planted === null, JSON.stringify(held));
    }

    /* 1b. WHAT A REFUSAL NAMES (E06 C11, 28.09.2026; audit S07-19), on the browser whose rows
       were just recorded - the one place `roomsKnownToMe` is not a GM's null. A crossing refused
       towards a room Aiko has not found names only where she stands; one towards a room she has
       found still names it; and of two rooms the GM marks for a Short Rest, one found and one
       not, the Rest list names the found one alone. The marks are put back. */
    phase("what a refusal names", { flow: "discovery-ledger" });
    const J = JSON.stringify;
    const unknownRoom = await p1_.eval(`const M = await import("${REPO}/scripts/movement.mjs"); const k = M.roomsKnownToMe();
        return k ? M.allRooms().find(r => !k.has(r)) ?? null : null;`);
    const restRooms = [ids.rooms[0], unknownRoom];
    const marks = await gm.eval(`const V = await import("${REPO}/scripts/vault.mjs");
        const out = {}; for (const room of ${J(restRooms)}) { const g = V.regionsByName().get(room); if (!g) continue;
            out[room] = g.getFlag("${MOD}", "restShort") ?? null; await g.update({ "flags.${MOD}.restShort": true }); }
        return out;`);
    await settle(800);
    const refusal = await p1_.eval(`const M = await import("${REPO}/scripts/movement.mjs"); const R = await import("${REPO}/scripts/rest.mjs");
        const k = M.roomsKnownToMe(), say = (from, to, next) => typeof M.notConnectedText === "function" ? M.notConnectedText(from, to, [next]) : "";
        return { known: k ? [...k] : null, marked: R.restRooms("short"),
            rest: typeof R.restRoomsSentence === "function" ? R.restRoomsSentence("short", "DRPG.Rest.allowedIn") : "",
            unknown: say(${J(ids.rooms[0])}, ${J(unknownRoom)}, ${J(ids.rooms[1])}),
            found: say(${J(ids.rooms[0])}, ${J(ids.rooms[1])}, ${J(ids.rooms[0])}),
            cannot: game.i18n.format("DRPG.Move.cannotReach", { from: ${J(ids.rooms[0])} }) };`);
    await gm.eval(`const V = await import("${REPO}/scripts/vault.mjs"); const { forcedDeletion } = await import("${REPO}/scripts/utils.mjs");
        for (const [room, was] of Object.entries(${J(marks)})) await V.regionsByName().get(room)?.update({ "flags.${MOD}.restShort": was ?? forcedDeletion() });
        return true;`);
    check(`${p1_.who}: a refusal and the Rest list name no room Aiko has not found, and still name the ones she has`,
        Boolean(unknownRoom) && Object.keys(marks).length === 2 && refusal.marked.includes(unknownRoom)
            && refusal.unknown === refusal.cannot && !refusal.unknown.includes(unknownRoom) && refusal.found.includes(ids.rooms[1])
            && refusal.rest.includes(ids.rooms[0]) && !refusal.rest.includes(unknownRoom),
        J({ unknownRoom, marks, refusal }), { flow: "discovery-ledger" });

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

    /* 5b. A TRACE PUT BACK UNDER ITS ID KEEPS A LIVE ROW (E08+E28 C3, 03.10.2026; audit S05-07). A
       clean-up's Reroll puts the trace it erased back under the id it had (`placeRemnant`'s
       `keepId`), so the trace's ledger key is the key the erase tombstoned - by `removeRemnant`, and
       by the primary's `deleteToken` hook after it. The row written for the trace put back is a
       revive the remnant store keeps, not one the tombstone cuts: read on the GM after the
       deletion's writes have settled and the store has been written out and read back from its
       storage. The trace is taken away after. */
    phase("a trace put back under its id", { flow: "murder-incident" });
    const putBack = await gm.eval(`const R = await import("${REPO}/scripts/remnants.mjs"); ${stores}
        const floor = canvas.scene, note = "E08 C3 60 a trace put back", wait = ms => new Promise(r => setTimeout(r, ms));
        const trace = await R.placeRemnant({ type: "prep", visibility: "subtle", x: 0, y: 0, scene: floor, note });
        const id = trace?.id ?? null, key = id ? floor.id + "." + id : null;
        if (trace) await R.removeRemnant(trace);
        await wait(300);
        const dead = Boolean(key) && S.remnantStore.tombstone(key) > 0 && !S.remnantStore.has(key);
        const back = trace ? await R.placeRemnant({ _id: id, type: "prep", visibility: "subtle", x: 0, y: 0, scene: floor, note }, { keepId: true }) : null;
        await wait(500);
        await S.remnantStore.idle();
        S.remnantStore.reload();
        const row = key ? S.remnantStore.get(key) : null;
        const out = { id, back: back?.id ?? null, dead, note: row?.note ?? null, type: row?.type ?? null,
            after: key ? S.remnantStore.stampOf(key) > S.remnantStore.tombstone(key) : false };
        if (back) await R.removeRemnant(back);
        return out;`, { timeout: 30000 });
    check("gm: a trace put back under its id has a live ledger row, written after the deletion's tombstone and read back from storage",
        Boolean(putBack.id) && putBack.back === putBack.id && putBack.dead === true && putBack.note === "E08 C3 60 a trace put back"
            && putBack.type === "prep" && putBack.after === true, JSON.stringify(putBack), { flow: "murder-incident" });

    // 6. the reset empties everyone
    phase("reset", { flow: "discovery-ledger" });
    await gm.eval(`const F = await import("${REPO}/scripts/fog.mjs"); await F.resetLedger(); return true;`);
    await settle(600);
    const after = await ledger(p1_);
    check(`${p1_.who}: the reset reaches the player's rows`, Object.values(after?.[ids.scene] ?? {}).every(r => !r?.length), JSON.stringify(after));
}
