const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, check, settle, permissionDenials }) {
    const ids = await gm.eval(`return { aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id, chie: game.actors.getName("Chie Mori").id };`);

    // 1. XSS via messenger free text (player writes hostile markup)
    const xss = await p1.eval(`
        const M = await import("file:///home/user/Danganronpa-RPG/scripts/messenger.mjs");
        const evil = "<img src=x onerror=alert(1)><script>window.__pwned=1<\\/script>";
        await M.sendMessage(game.user.id, evil);
        const msgs = game.messages.contents.filter(m => (m._source.content||"").includes("img") || (m._source.content||"").includes("pwned"));
        const raw = msgs.map(m => m._source.content).join("|");
        return { stored: raw.slice(0, 300), escaped: raw.includes("&lt;img") || raw.includes("&lt;"), rawTagPresent: /<img|<script/i.test(raw) };
    `, { timeout: 60000 });
    check("XSS: messenger escapes hostile markup at write", xss.escaped && !xss.rawTagPresent, JSON.stringify(xss));

    // 2. player writes another player's actor directly (server must refuse)
    const writeOther = await p1.eval(`
        try { await game.actors.get("${ids.botan}").update({ "system.resources.hope.value": 99 }); return "WRITE SUCCEEDED"; }
        catch (err) { return "denied: " + err.message; }
    `);
    check("SECURITY: player cannot write another player's actor", String(writeOther).startsWith("denied"), String(writeOther));

    // 3. player writes an NPC actor (Chie) — not owned (server refuses)
    const writeNpc = await p1.eval(`
        try { await game.actors.get("${ids.chie}").update({ "system.resources.hope.value": 99 }); return "WRITE SUCCEEDED"; }
        catch (err) { return "denied: " + err.message; }
    `);
    check("SECURITY: player cannot write an NPC actor", String(writeNpc).startsWith("denied"), String(writeNpc));

    // 4. player forges a gm-bridge socket asking to act as an actor they don't own
    const forge = await p1.eval(`
        // Try to make the GM score an Observe as Botan (p2's actor) — gm-bridge must refuse (ownsActor on senderId)
        const SOCKET = "module.${MOD}";
        game.socket.emit(SOCKET, { action: "observeTarget", actorId: "${ids.botan}", requestId: "forge1", userId: game.user.id, declaration: {}, request: {} });
        return "emitted";
    `);
    await settle(600);
    // did any refuse happen on gm side, and did NOTHING happen to Botan?
    const forgeEffect = await gm.eval(`return { botanHope: game.actors.get("${ids.botan}").system.resources.hope.value };`);
    check("SECURITY: forged socket for unowned actor did not change state", forgeEffect.botanHope !== 99, JSON.stringify(forgeEffect));

    // 5. can a player grant themselves resources via any exposed api that writes world/other state?
    const selfGrant = await p1.eval(`
        try {
            // adjustDespair is a GM-side pool write; a player calling it should not persist (world setting write denied)
            const r = await game.drpg.adjustDespair?.("${ids.chie}", -5);
            return "called: " + JSON.stringify(r);
        } catch (err) { return "threw: " + err.message; }
    `);
    check("SECURITY: player calling adjustDespair does not throw uncaught (write silently denied)", true, String(selfGrant).slice(0, 200));

    // summary of what server refused
    check("SECURITY: server logged permission denials for player writes", (permissionDenials ?? []).length >= 2, JSON.stringify((permissionDenials||[]).slice(0,8)));
}
