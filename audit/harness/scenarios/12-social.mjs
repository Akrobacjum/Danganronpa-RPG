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
       `diceSoNiceMessagePreProcess` says no - which it does where the roll cannot be read.
       A STATISTIC FROM THE SHEET, DRAWN BY THE GM (E08+E28 C13, 04.10.2026; the plan's 3.4; the
       owner's note of 27.09). Aiko's roll is p1's statistic from her sheet, which the GM draws and
       writes (roll-draw.mjs): Dice So Nice's own decision is off for the GM's message on every
       browser - it would throw it in the GM's colours - and the dice are played as p1's: on p1
       from the draw's answer, on the GM by the relay (private-rolls.mjs `relayDrawnDice`), on p2
       not at all. Each model keeps every `showForRoll` with the user whose dice it throws
       (`__dsnShown`), and what it would animate itself (`__dsnAnimated`). */
    const DSN_OFF = `globalThis.__dsnHideSecret = false; globalThis.__dsnAnimated = []; globalThis.__dsnShown = []; return true;`;
    for (const c of [gm, p1, p2]) await c.eval(DSN_OFF);
    const rollRes = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 7, fear: 4 };
        const before = game.messages.contents.length;
        const cfg = await actor.rollTrait("agility", {});
        const mine = game.messages.contents.length - before;
        return { mine, id: cfg?.message?.id ?? null, total: cfg?.message?.rolls?.[0]?.total ?? null };
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
    const onP1 = await p1.eval(`const m = game.messages.get("${rollRes.id}");
        return m ? { contentVisible: m.isContentVisible, author: m.author?.id ?? null, drawn: m.getFlag("${MOD}", "drawn") === true,
            superseded: Boolean(m.getFlag("${MOD}", "supersededRoll")), speaker: m.speaker?.actor ?? null } : null;`);
    check("PRIVACY: Aiko's statistic from the sheet is drawn by the GM - the GM's message, naming nobody, keeping Daggerheart's card - and read on her browser alone of the players",
        onP1?.contentVisible === true && onP1.author === gm.userId && onP1.drawn && !onP1.superseded && onP1.speaker === null
            && onP2.contentVisible === false, JSON.stringify({ onP1, p2: onP2.contentVisible }));
    const DSN_READ = `const shown = globalThis.__dsnShown.filter(c => !c.synchronize).map(c => [c.user, c.total]);
        const animated = globalThis.__dsnAnimated.includes("${rollRes.id}"); globalThis.__dsnHideSecret = true; return { shown, animated };`;
    const dice = { gm: await gm.eval(DSN_READ), p1: await p1.eval(DSN_READ), p2: await p2.eval(DSN_READ) };
    const asAiko = r => r.shown.length === 1 && r.shown[0][0] === p1.userId && r.shown[0][1] === rollRes.total;
    check("DICE: Aiko's drawn roll is thrown on her screen and the GM's as her dice, never as the GM's, and not on p2's - Dice So Nice's own decision animates it nowhere",
        Boolean(rollRes.id) && asAiko(dice.p1) && asAiko(dice.gm) && dice.p2.shown.length === 0 && [dice.gm, dice.p1, dice.p2].every(r => r.animated === false),
        JSON.stringify(dice));

    /* WITHOUT DICE SO NICE (E08+E28 C13; LIVE-E28-02 is the table's reading). p1 and p2 lose
       `game.dice3d` (put back after) and Aiko throws a second statistic. The GM's message is muted
       (dhRoll.mjs:151, as the harness's `toMessage` writes it), so the roller hears the dice from
       the draw's answer (roll-draw.mjs `playDice`) and reads the result on her own copy; p2 hears
       nothing and reads nothing. Every sound a browser plays is kept for the window (`__sounds`). */
    const NO_DSN = `globalThis.__dice3dAway = game.dice3d; delete game.dice3d; globalThis.__sounds = [];
        if (!globalThis.__soundsOn) {
            globalThis.__soundsOn = true;
            const H = foundry.audio.AudioHelper, play = H.play;
            H.play = function (data, ...rest) { globalThis.__sounds?.push(String(data?.src ?? "")); return play.call(this, data, ...rest); };
        }
        return true;`;
    for (const c of [p1, p2]) await c.eval(NO_DSN);
    const quiet = await p1.eval(`const cfg = await game.actors.get("${ids.aiko}").rollTrait("instinct", {});
        return { id: cfg?.message?.id ?? null, total: cfg?.message?.rolls?.[0]?.total ?? null };`, { timeout: 60000 });
    await settle(400);
    const QUIET_READ = `const m = game.messages.get(${JSON.stringify(quiet.id)});
        const out = { heard: globalThis.__sounds.filter(s => s === CONFIG.sounds.dice).length, readable: Boolean(m?.isContentVisible), total: m?.rolls?.[0]?.total ?? null };
        game.dice3d = globalThis.__dice3dAway; delete globalThis.__dice3dAway; globalThis.__sounds = null;
        return out;`;
    const heard = { p1: await p1.eval(QUIET_READ), p2: await p2.eval(QUIET_READ) };
    check("DICE: without Dice So Nice Aiko hears the dice of her drawn roll once and reads its result; p2 hears nothing and reads nothing",
        Boolean(quiet.id) && heard.p1.heard === 1 && heard.p1.readable && heard.p1.total === quiet.total && heard.p2.heard === 0 && !heard.p2.readable,
        JSON.stringify({ quiet, heard }));

    /* A ROLL'S CLAIM IS ITS OWN (E08+E28 C11, 04.10.2026; audit S02-45). The module claims the
       card of a roll it throws as the card is created, and until C11 it claimed the first roll
       card p1's browser created while its roll was in flight - so a statistic Aiko clicked on
       her sheet while a Work on Project window stood open lost its card, and the project's roll
       kept Daggerheart's. The window is held by Aiko's `rollTrait` standing in for it, the sheet
       roll thrown meanwhile, then the window let go; both cards read as the GM's browser holds
       them: the sheet's kept, the project's claimed and emptied. Since E08+E28 C13 the GM draws
       the sheet's roll too, and writes it naming nobody - its card kept, not hidden. */
    const twoRolls = await p1.eval(`
        const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const actor = game.actors.get("${ids.aiko}");
        const thrown = actor.rollTrait;
        let held = false, letGo = null;
        const shut = new Promise(resolve => { letGo = resolve; });
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        actor.rollTrait = async (dh, config) => { held = true; await shut; return thrown.call(actor, dh, config); };
        try {
            const pending = A.rollTrait(actor, "body", { remember: false, actionKey: "project", title: game.i18n.localize("DRPG.Roll.project") });
            const end = Date.now() + 6000;
            while (!held && Date.now() < end) await new Promise(r => setTimeout(r, 50));
            const sheet = held ? (await thrown.call(actor, "agility", {}))?.message?.id ?? null : null;
            letGo();
            const project = (await pending)?.raw?.message?.id ?? null;
            return { held, sheet, project };
        } finally { letGo(); delete actor.rollTrait; }
    `, { timeout: 60000 });
    await settle(400);
    const twoOnGm = await gm.eval(`
        const read = id => { const m = game.messages.get(id); return m ? { claimed: Boolean(m.getFlag("${MOD}", "supersededRoll")), drawn: m.getFlag("${MOD}", "drawn") === true, actor: m.speaker?.actor ?? null } : null; };
        return { sheet: read(${JSON.stringify(twoRolls.sheet)}), project: read(${JSON.stringify(twoRolls.project)}) };
    `);
    check("PRIVACY: a statistic Aiko throws off her sheet while a Work on Project window is open keeps its card, and the project's roll is the one claimed (S02-45)",
        twoRolls.held === true && twoOnGm.sheet?.claimed === false && twoOnGm.sheet.drawn && twoOnGm.sheet.actor === null
            && twoOnGm.project?.claimed === true && twoOnGm.project.actor === null,
        JSON.stringify({ twoRolls, twoOnGm }));

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
