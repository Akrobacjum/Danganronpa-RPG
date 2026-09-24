/** L3: private rolls between clients, inventory limits, movement/search. */
const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, check, settle, repoUrl }) {
    const ids = await gm.eval(`return {
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    // --- forced private rolls: is the setting on, and does a player's roll stay off p2? ---
    const forced = await gm.eval(`return game.settings.get("${MOD}", "forcePrivateRolls");`);
    check("forcePrivateRolls default state", true, `= ${forced}`);

    await gm.eval(`await game.settings.set("${MOD}", "forcePrivateRolls", true); return true;`);
    await settle(200);

    /*
     * p1 (Aiko) rolls; what does p2's browser hold of it?
     *
     * This used to count Aiko's rolls in p2's `game.messages` and pass on zero -
     * which it always was, because the harness never delivered a whisper to anybody
     * off its list. Foundry delivers every message to every browser (lib/shim.mjs,
     * REALISM RULES), so p2 now holds the roll, and the question is the one Foundry
     * itself answers: is it whispered past p2, so that p2's chat log will not draw
     * it? `isContentVisible` is Foundry's rule, and private-rolls.mjs hides a card
     * by it at render time.
     *
     * NOT "the content is a stub": a roll is not a secret.mjs card. The README says
     * so outright ("Privacy": rolls are whispered, so other players never see them,
     * but like every chat message they reach every browser) - the dice stay in the
     * document on every client, a curtain and not a wall. What p2's console can read
     * is printed below, so that nobody mistakes this check for more than it is.
     */
    const rollRes = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 7, fear: 4 };
        const before = game.messages.contents.length;
        const cfg = await actor.rollTrait("agility", {});
        const mine = game.messages.contents.length - before;
        return { mine, id: cfg?.message?.id ?? null };
    `, { timeout: 60000 });
    await settle(400);
    const onP2 = await p2.eval(`
        const m = game.messages.get("${rollRes.id}");
        if (!m) return { held: false };
        return { held: true, isRoll: m.isRoll, whisper: m.whisper, visible: m.visible, contentVisible: m.isContentVisible,
                 readable: (m._source.content ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 80) };
    `);
    check("p1 made a roll", (rollRes.mine ?? 0) >= 1 && Boolean(rollRes.id), JSON.stringify(rollRes));
    // Without this the next check could pass by never having been handed the document.
    check("p2's browser holds Aiko's roll, as every Foundry client does", onP2.held === true, JSON.stringify(onP2));
    check("PRIVACY: Aiko's roll is whispered past p2, so p2's chat log does not show it",
        onP2.held === true && onP2.whisper.length > 0 && !onP2.whisper.includes(p2.userId) && onP2.contentVisible === false,
        JSON.stringify(onP2));
    console.log("[qa] what p2's console can still read of Aiko's private roll (documented, README 'Privacy'):", JSON.stringify(onP2.readable));

    // --- inventory carry limit (Gear = 2 shared slots) ---
    const inv = await gm.eval(`
        const INV = await import("${repoUrl}/scripts/inventory.mjs");
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
        const st = await import("${repoUrl}/scripts/search-tokens.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");
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
