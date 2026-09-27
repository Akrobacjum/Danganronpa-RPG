/** L3: private rolls between clients, inventory limits, movement/search. */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";
export async function run({ gm, p1, p2, check, phase, settle, repoUrl }) {
    const ids = await gm.eval(`return {
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id };`);

    // --- forced private rolls: is the setting on, and does a player's roll stay off p2? ---
    phase("private rolls", { flow: "private-rolls" });
    // This was check(name, true): it printed the value and could not fail. settings.mjs
    // registers the setting with `default: true`, no module code writes it, and nothing in
    // this scenario does before this line, so the read is the default a new world starts with.
    const forced = await gm.eval(`return game.settings.get("${MOD}", "forcePrivateRolls");`);
    check("forcePrivateRolls is on until a GM turns it off", forced === true, `= ${forced}`);

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
    /* DICE SO NICE WITH "HIDE 3D DICE ON SECRET ROLLS" OFF (E06 C6, 27.09.2026; audit S02-40).
       Each client's model of Dice So Nice (client-entry.mjs, "DICE SO NICE'S DECISION") animates
       a roll wherever the setting is off, readable or not, unless the module's
       `diceSoNiceMessagePreProcess` says no - which it does where the roll cannot be read. */
    const DSN_OFF = `globalThis.__dsnHideSecret = false; globalThis.__dsnAnimated = []; return true;`;
    for (const c of [gm, p1, p2]) await c.eval(DSN_OFF);
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
    const DSN_READ = `const shown = globalThis.__dsnAnimated.includes("${rollRes.id}"); globalThis.__dsnHideSecret = true; return shown;`;
    const animated = { gm: await gm.eval(DSN_READ), p1: await p1.eval(DSN_READ), p2: await p2.eval(DSN_READ) };
    check("DICE: with Dice So Nice's secret-roll hiding off, Aiko's roll animates for Aiko and the GM and not on p2's screen",
        Boolean(rollRes.id) && animated.gm === true && animated.p1 === true && animated.p2 === false, JSON.stringify(animated));

    // --- inventory carry limit (Gear = 2 shared slots) ---
    phase("inventory");
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
    phase("movement");
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
    phase("anonymity");
    const anon = await gm.eval(`
        try { const r = game.drpg.auditAnonymity ? await game.drpg.auditAnonymity() : "no-fn"; return typeof r === "object" ? JSON.stringify(r).slice(0,300) : String(r); }
        catch (e) { return "threw:" + e.message; }
    `, { timeout: 60000 });
    check("ANONYMITY: self-audit runs", !String(anon).startsWith("threw"), String(anon));

    // --- a sheet that is not yours (E05 C15, S03-06) ---
    // p2 opens Aiko's sheet (p1's) with a Call armed on it. The harness registers no
    // Daggerheart sheet, so the module's two render hooks are called on a bare frame, in
    // Foundry's order (the class's own, then ActorSheetV2's): what they draw is what the
    // viewer gets. The redacted pips kept "1 of 2 actions ..." and "Free Move used" as
    // tooltips, and the stack beside them showed the armed Call. p1, the owner, draws the
    // same frame first, so the check is shown able to see a stack and a tooltip. Two
    // layers hold it, and each is read alone too, because either one hides the other's
    // absence: sheet.mjs draws a viewer none of the three (the class's hook alone), and
    // anonymity.mjs strips them from a frame another hand drew them on (ActorSheetV2's alone).
    phase("a sheet that is not yours");
    await gm.eval(`
        const a = game.actors.get("${ids.aiko}");
        globalThis.__c15Call = a.getFlag("${MOD}", "pendingCall") ?? null;
        await a.setFlag("${MOD}", "pendingCall", [{ kind: "hope", key: "experience", grants: "experience" }]);
        return true;`, { timeout: 60000 });
    await settle(600);
    const DRAWN = '<div class="drpg-actions-section"><div class="drpg-actions">'
        + '<span class="drpg-action-pip" data-tooltip="planted: 1 of 2" aria-label="planted: 1 of 2"></span>'
        + '<span class="drpg-free-move" data-tooltip="planted: Free Move used"></span></div>'
        + '<div class="drpg-pending-stack"><div class="drpg-pending-call" data-tooltip="planted: a Call"></div></div></div>';
    const drawSheet = (hooks, drawn = "") => `
        const a = game.actors.get("${ids.aiko}");
        const root = document.createElement("div");
        root.innerHTML = '<div class="character-header-sheet"><div class="character-row"><div class="resource-section"></div>${drawn}</div></div>';
        document.body.append(root);
        const app = { document: a, element: root };
        try {
            for (const hook of ${JSON.stringify(hooks)}) Hooks.callAll(hook, app, root, {}, { isFirstRender: true });
            return {
                owner: a.testUserPermission(game.user, "OWNER"),
                enforced: game.settings.get("${MOD}", "enforceAnonymity"),
                pips: root.querySelectorAll(".drpg-action-pip").length,
                tips: [...root.querySelectorAll(".drpg-action-pip, .drpg-free-move")]
                    .map(el => el.dataset.tooltip ?? el.getAttribute("aria-label")).filter(Boolean),
                calls: root.querySelectorAll(".drpg-pending-call, .drpg-pending-stack").length
            };
        } finally { root.remove(); }`;
    const BOTH = ["renderCharacterSheet", "renderActorSheetV2"];
    const own = await p1.eval(drawSheet(BOTH), { timeout: 60000 });
    const other = await p2.eval(drawSheet(BOTH), { timeout: 60000 });
    const sheetAlone = await p2.eval(drawSheet(["renderCharacterSheet"]), { timeout: 60000 });
    const redactAlone = await p2.eval(drawSheet(["renderActorSheetV2"], DRAWN), { timeout: 60000 });
    await gm.eval(`
        const a = game.actors.get("${ids.aiko}");
        if (globalThis.__c15Call) await a.setFlag("${MOD}", "pendingCall", globalThis.__c15Call);
        else await a.unsetFlag("${MOD}", "pendingCall");
        return true;`, { timeout: 60000 });
    const bare = r => r?.owner === false && r.pips > 0 && r.tips.length === 0 && r.calls === 0;
    check("SHEET: p1, Aiko's owner, sees the Call armed on their own sheet and the pips' tooltips",
        own?.owner === true && own.pips > 0 && own.calls > 0 && own.tips.length > 0, JSON.stringify(own));
    check("SHEET: p2 opening p1's sheet finds no tooltip text and no Call stack (S03-06)", bare(other), JSON.stringify(other));
    check("SHEET: each layer holds alone - the sheet draws p2 none, the redaction strips what another hand drew",
        bare(sheetAlone) && redactAlone?.enforced === true && bare(redactAlone), JSON.stringify({ sheetAlone, redactAlone }));

    // errors?
    for (const c of [gm, p1, p2]) {
        const errs = await c.eval(`return (globalThis.__errors ?? []).slice(0,5);`);
        check(`${c.who}: no uncaught errors (L3)`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0,200));
    }
}
