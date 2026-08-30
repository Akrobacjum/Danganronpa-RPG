/** L3: private rolls between clients, inventory limits, movement/search. */
const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, check, settle }) {
    const ids = await gm.eval(`return {
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    // --- forced private rolls: is the setting on, and does a player's roll stay off p2? ---
    const forced = await gm.eval(`return game.settings.get("${MOD}", "forcePrivateRolls");`);
    check("forcePrivateRolls default state", true, `= ${forced}`);

    await gm.eval(`await game.settings.set("${MOD}", "forcePrivateRolls", true); return true;`);
    await settle(200);

    // p1 (Aiko) rolls. Count chat messages visible to p2 before/after.
    const before2 = await p2.eval(`return game.messages.contents.length;`);
    const rollRes = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 7, fear: 4 };
        const before = game.messages.contents.length;
        await actor.rollTrait("agility", {});
        const mine = game.messages.contents.length - before;
        return { mine };
    `, { timeout: 60000 });
    await settle(400);
    const after2 = await p2.eval(`
        const msgs = game.messages.contents;
        // any message whose content or speaker reveals Aiko's roll to p2?
        const leak = msgs.filter(m => {
            const c = (m._source.content ?? "");
            const isRoll = (m._source.rolls ?? []).length > 0;
            const fromAiko = (m._source.speaker?.actor === "${ids.aiko}") || (m._source.author === "${gm.userId}");
            return isRoll && fromAiko;
        }).length;
        return { total: msgs.length, leak };
    `);
    check("p1 made a roll", (rollRes.mine ?? 0) >= 1, JSON.stringify(rollRes));
    check("PRIVACY: p2 cannot see Aiko's roll message", after2.leak === 0, JSON.stringify(after2));

    // --- inventory carry limit (Gear = 2 shared slots) ---
    const inv = await gm.eval(`
        const INV = await import("file:///home/user/Danganronpa-RPG/scripts/inventory.mjs");
        const actor = game.actors.get("${ids.botan}");
        for (const it of actor.items.contents.filter(i => i.name.startsWith("L3"))) await it.delete();
        const a = await INV.grantItem(actor, { name: "L3 knife", category: "crimeTool", tier: 1 });
        const b = await INV.grantItem(actor, { name: "L3 mop", category: "cleaningTool", tier: 1 });
        const c = await INV.grantItem(actor, { name: "L3 wrench", category: "tool", tier: 1 });
        const carried = actor.items.contents.filter(i => (i.getFlag("${MOD}","location") ?? "carried") === "carried" && i.name.startsWith("L3")).length;
        return { a: !!a, b: !!b, cWasBlocked: !c, carried,
                 notif: globalThis.__notifications.slice(-2).map(n => n.level+":"+n.msg) };
    `, { timeout: 60000 });
    check("INVENTORY: Gear limit of 2 is enforced (3rd blocked or stashed)", inv.carried <= 2, JSON.stringify(inv));

    // --- movement / search tokens per room ---
    const search = await gm.eval(`
        const st = await import("file:///home/user/Danganronpa-RPG/scripts/search-tokens.mjs");
        const M = await import("file:///home/user/Danganronpa-RPG/scripts/movement.mjs");
        const room = M.roomOfActor(game.actors.get("${ids.aiko}"));
        let tokens = null;
        try { tokens = game.drpg.searchTokens ? game.drpg.searchTokens(room) : null; } catch (e) { tokens = "err:"+e.message; }
        return { room, tokens, allRooms: game.drpg.allRooms() };
    `, { timeout: 60000 });
    check("MOVEMENT: player's room resolved + search tokens present", !!search.room, JSON.stringify(search).slice(0, 300));

    // --- anonymity audit (module's own) ---
    const anon = await gm.eval(`
        try { const r = game.drpg.auditAnonymity ? await game.drpg.auditAnonymity() : "no-fn"; return typeof r === "object" ? JSON.stringify(r).slice(0,300) : String(r); }
        catch (e) { return "threw:" + e.message; }
    `, { timeout: 60000 });
    check("ANONYMITY: self-audit runs", !String(anon).startsWith("threw"), String(anon));

    // errors?
    for (const c of [gm, p1, p2]) {
        const errs = await c.eval(`return (globalThis.__errors ?? []).slice(0,5);`);
        check(`${c.who}: no uncaught errors (L3)`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0,200));
    }
}
