export const layers = ["ci"];

const MOD = "danganronpa-rpg";
const SOCKET = `module.${MOD}`;
export async function run({ gm, p1, p2, p3, check, phase, settle, permissionDenials, repoUrl, canary }) {
    const ids = await gm.eval(`return { aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id, chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id };`);

    // 1. XSS via messenger free text (player writes hostile markup)
    phase("messenger markup", { flow: "messenger" });
    const xss = await p1.eval(`
        const M = await import("${repoUrl}/scripts/messenger.mjs");
        const evil = "<img src=x onerror=alert(1)><script>window.__pwned=1<\\/script>";
        const sent = await M.sendMessage(game.user.id, evil);
        // A thread card is a private card (COMM-03): the document holds a stub and the
        // words live in the sender's own store - escaped there, or nowhere.
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const raw = sent ? S.contentOf(sent) : "";
        const doc = sent ? (sent._source.content ?? "") : "";
        return { id: sent?.id ?? null, stored: raw.slice(0, 300), escaped: raw.includes("&lt;img") || raw.includes("&lt;"), rawTagPresent: /<img|<script/i.test(raw) || /<img|<script/i.test(doc) };
    `, { timeout: 60000 });
    check("XSS: messenger escapes hostile markup at write", xss.escaped && !xss.rawTagPresent, JSON.stringify(xss));

    // 2. player writes another player's actor directly (server must refuse)
    phase("actor writes");
    const writeOther = await p1.eval(`
        try { await game.actors.get("${ids.botan}").update({ "system.resources.hope.value": 99 }); return "WRITE SUCCEEDED"; }
        catch (err) { return "denied: " + err.message; }
    `);
    check("SECURITY: player cannot write another player's actor", String(writeOther).startsWith("denied"), String(writeOther));

    // 3. player writes an actor nobody at the table owns (Daichi) - the server refuses.
    //    This step used to write Chie and call her an NPC; Chie is p3's student, so it
    //    was step 2 again. Daichi is the one actor with no owner but the GM.
    const writeUnowned = await p1.eval(`
        try { await game.actors.get("${ids.daichi}").update({ "system.resources.hope.value": 99 }); return "WRITE SUCCEEDED"; }
        catch (err) { return "denied: " + err.message; }
    `);
    check("SECURITY: player cannot write an actor no player owns", String(writeUnowned).startsWith("denied"), String(writeUnowned));

    /*
     * 4. FORGED GM-BRIDGE REQUESTS, AND THE REAL ACTION NAMES THIS TIME.
     *
     * This step sent `action: "observeTarget"`. The bridge's name is "observe.target",
     * so the packet reached no handler, and the check after it - Botan's Hope is not
     * 99 - could not fail: nothing in that packet would have set it (audit S14-08).
     * The suite runs on the GM alone, who owns everything, and R1b reads the source;
     * so there was no behavioural test anywhere that a gm-bridge handler turns away a
     * player acting as somebody else's character.
     *
     * Each request below is sent three ways:
     *   - FORGED by p1, naming p2's Botan, with p2's user id in the payload's own
     *     `userId` claim. The bridge must judge by Foundry's `senderId` instead.
     *   - It must CHANGE NOTHING on the GM, and the GM must say why - the refusal
     *     reason for ownership in its log, and a `bridge.refused` packet to p1.
     *     The reason is checked and not only the packet, because `call.arm` has a
     *     second guard (is this a real Call) that refuses with the same packet.
     *   - The SAME REQUEST from Botan's own player, through the module's own
     *     request function, must take effect. Without this, "nothing changed" could
     *     be a request that would not have worked for anybody.
     * The scene is arranged so that ownership is the only thing in the way: Aiko is
     * moved into Botan's room, because a handover between two rooms is refused by
     * handover.mjs for a different reason.
     *
     * Verified by hand the day it was written (1.2.56): with the `ownsActor` guard
     * disabled in the three handlers in scripts/gm-bridge.mjs (`handleShareBulletOr
     * GiveItem`, `handleArm`, `handleCrisis`), all six SECURITY checks below FAILED
     * - the wrench moved, the Call armed, Daichi died, and no refusal was sent - and
     * the scenario read 9/15. Then the file was restored.
     */
    phase("an item handed over", { flow: "give-take-stash" });
    await p1.eval(`
        globalThis.__refused = [];
        game.socket.on("${SOCKET}", (payload, senderId) => {
            if (payload?.action === "bridge.refused") globalThis.__refused.push({ what: payload.what, requestId: payload.requestId ?? null, from: senderId });
        });
        return true;`);
    const setup = await gm.eval(`
        const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const { sameRoom } = await import("${repoUrl}/scripts/movement.mjs");
        await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 1500, y: 300 });
        const botan = game.actors.get("${ids.botan}");
        const item = await INV.grantItem(botan, { name: "SEC wrench", category: "tool", tier: 1 });
        await game.drpg.setDespair(game.user.id, 6);
        return { itemId: item?.id ?? null, sameRoom: sameRoom(game.actors.get("${ids.aiko}"), botan) };`, { timeout: 60000 });
    check("setup: Aiko stands in Botan's room and Botan holds an item to give", setup.sameRoom === true && Boolean(setup.itemId), JSON.stringify(setup));
    await settle(300);

    /** Send one forged packet from p1 and report what the GM did about it. */
    const forge = async (action, fields, read) => {
        await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
        const before = await gm.eval(read);
        await p1.eval(`
            globalThis.__refused.length = 0;
            game.socket.emit("${SOCKET}", { action: "${action}", userId: "${p2.userId}", requestId: "forge-${action}", ...${JSON.stringify(fields)} },
                { recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) });
            return true;`);
        await settle(900);
        const after = await gm.eval(read);
        const reasons = await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
            .filter(e => e.message.includes('Refused a "${action}"')).map(e => e.message);`);
        const told = await p1.eval(`return globalThis.__refused.slice();`);
        return {
            before, after, reasons, told,
            unchanged: JSON.stringify(before) === JSON.stringify(after),
            forOwnership: reasons.some(r => /sender does not own/.test(r))
        };
    };
    /* A ROLL OF THE PLAYER'S OWN, DRAWN BY THE GM (E08+E28 C14, 04.10.2026). An Observe, an Analyze
       and a search for a hidden stash are scored on the GMs' record of the roll their packet names
       (bridge-guards.mjs `rollRefusal`), so a packet of this scenario's names one: `client` throws
       `actorId`'s statistic for `actionKey` on `faces`, the GM draws it, and the message the GM wrote
       for it is read off the roll (action-rolls.mjs `DRAWN_ROLL`) - null when it was not drawn. A roll is drawn for
       an action being taken (E08+E28 fix r2-H1, roll-draw.mjs `drawRefusal`): unless `pay` is false, `client` first pays
       one action as an action's own code does (actions.mjs `spendAction`), handing the character one if it has none;
       a crisis action's roll is its turn's and names its crisis action (`context`), and pays nothing. */
    const payFor = actorId => `{ const { spendAction, actionsLeft } = await import("${repoUrl}/scripts/actions.mjs");
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const who = game.actors.get("${actorId}");
        if (actionsLeft(who) < 1) await trustedWrite(who, { "system.resources.actions.value": 1 }, { reason: "gmRuling" });
        await spendAction(who, 1, { quiet: true }); }`;
    const drawnRoll = (client, actorId, actionKey, trait, faces, { context = null, remember = false, pay = actionKey !== "crisis" } = {}) => client.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        ${pay ? payFor(actorId) : ""}
        globalThis.__forceRoll = ${JSON.stringify(faces)};
        let out = null, err = null;
        try { out = await A.rollTrait(game.actors.get("${actorId}"), "${trait}", { actionKey: "${actionKey}", remember: ${remember},
            context: ${JSON.stringify(context)} }); }
        catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        finally { delete globalThis.__forceRoll; }
        return { messageId: out?.raw?.[A.DRAWN_ROLL]?.messageId ?? null, total: out?.total ?? null, err };`, { timeout: 60000 });

    // 4a. handover.item: p1 gives Botan's wrench to Aiko.
    const readHandover = `const b = game.actors.get("${ids.botan}"), a = game.actors.get("${ids.aiko}");
        return { botanHas: b.items.has("${setup.itemId}"), aikoWrenches: a.items.contents.filter(i => i.name === "SEC wrench").length };`;
    const hand = await forge("handover.item", { fromId: ids.botan, toId: ids.aiko, itemId: setup.itemId }, readHandover);
    check("SECURITY: a forged handover.item of Botan's item changed nothing on the GM",
        hand.unchanged && hand.after.botanHas === true && hand.after.aikoWrenches === 0, JSON.stringify(hand));
    check("SECURITY: the GM refused the forged handover.item for ownership, and told p1",
        hand.forOwnership && hand.told.some(t => t.what === "handover.item"), JSON.stringify({ reasons: hand.reasons, told: hand.told }));
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestGiveItem({ fromId: "${ids.botan}", toId: "${ids.aiko}", itemId: "${setup.itemId}" }); return true;`);
    await settle(900);
    const handOk = await gm.eval(readHandover);
    check("control: the same handover.item from Botan's own player does move the item",
        handOk.botanHas === false && handOk.aikoWrenches === 1, JSON.stringify(handOk));

    // 4b. call.arm: p1 arms a Support on Aiko, paid for by Botan.
    //     E03 (audit S10-09): the honest shape is a Support bought by one student for
    //     ANOTHER student's character, and the GM takes the Hope for it. So the
    //     control arms Botan's Support on Aiko, and reads Botan's Hope before and
    //     after - it has to go down by exactly the price, once, on the GM.
    phase("a Call armed", { flow: "call-arm" });
    const call = { key: "support", grants: "advantage", kind: "hope", from: ids.botan };
    const readArm = `return { armed: game.actors.get("${ids.aiko}").getFlag("${MOD}", "pendingCall") ?? null,
        hope: game.actors.get("${ids.botan}").system.resources.hope.value };`;
    await gm.eval(`await game.actors.get("${ids.botan}").update({ "system.resources.hope.value": 4 }); return true;`);
    const arm = await forge("call.arm", { actorId: ids.aiko, call }, readArm);
    check("SECURITY: a forged call.arm paid for by Botan changed nothing on the GM", arm.unchanged, JSON.stringify(arm));
    check("SECURITY: the GM refused the forged call.arm for ownership, and told p1",
        arm.forOwnership && arm.told.some(t => t.what === "call.arm"), JSON.stringify({ reasons: arm.reasons, told: arm.told }));
    // A Despair Call from a player's own client - Obstacle on a rival, paid with
    // nothing, because a Despair Call is a Monokuma's and a Monokuma is a GM.
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    await p2.eval(`game.socket.emit("${SOCKET}", { action: "call.arm", userId: game.user.id, requestId: "forge-obstacle",
            actorId: "${ids.aiko}", call: { key: "obstacle", grants: "disadvantage", kind: "despair", from: "${ids.botan}" } },
        { recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) }); return true;`);
    await settle(900);
    const obstacle = await gm.eval(`return { after: (${readArm.replace(/^return /, "").replace(/;$/, "")}),
        reasons: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "call.arm"')).map(e => e.message) };`);
    check("SECURITY: a player's Despair Call through call.arm arms nothing and is refused as not a Hope Call",
        obstacle.after.armed === null && obstacle.reasons.some(r => /not a Hope Call/.test(r)), JSON.stringify(obstacle));
    const armAnswer = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestArmCall("${ids.aiko}", ${JSON.stringify({ ...call, nonce: "sec-support-1" })});`, { timeout: 30000 });
    await settle(900);
    const armOk = await gm.eval(readArm);
    check("control: the same Support from Botan's own player is armed on Aiko and answered",
        JSON.stringify(armOk.armed ?? []).includes("support") && armAnswer?.ok === true, JSON.stringify({ armOk, armAnswer }));
    check("control: the GM took the Support's price from Botan once",
        armOk.hope === arm.before.hope - 1, JSON.stringify({ before: arm.before.hope, after: armOk.hope }));

    /* 4b2. A CALL THAT WAITS FOR THE GM'S YES, FROM p1'S CONSOLE (E29 fix r2-H4, 05.10.2026; the round-2
       reviews' sec M4 and cor M1, their probe 98 Q1). Aiko at 3 Hope, her armed list emptied (4b's control left
       a Support on it, which an Ultimate's advantage would meet first), and p1 sends what its own browser never
       sends: an arm of an Ultimate and of an Experience with no ruling asked; the ask of an Experience, which puts
       the card up in p1's thread; p1's own yes to that ask (`call.yes`); and the arm the ask named. Read on the
       GM: Aiko's Hope, her armed list in the document and in the GMs' mark, and the refusals it logged - two
       rows, the three arms' one sentence kept once with its count (utils.mjs `record`; a first run of this check
       counted rows, 05.10.2026, and read 2 where it expected 4); on p1, every answer to the three arms and the
       yes. Her list and Hope are put back after. Until this fix the first two were armed and paid, Hope 3 -> 1,
       and nothing was told. */
    phase("a Call that waits for the GM's yes", { flow: "hope-call" });
    const yesWas = await gm.eval(`const a = game.actors.get("${ids.aiko}");
        const was = { hope: a.system.resources.hope.value, calls: a.getFlag("${MOD}", "pendingCall") ?? null };
        await a.unsetFlag("${MOD}", "pendingCall");
        await a.update({ "system.resources.hope.value": 3 });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        (await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures();
        return was;`);
    let yesRoad = null;
    try {
        const told = await p1.eval(`
            const got = [], mine = ["SECH4ULTIMATE", "SECH4EXPERIENCE", "SECH4ASK", "SECH4OWNYES", "SECH4ASKED"];
            const on = payload => {
                if (!mine.includes(payload?.requestId) || payload.userId !== game.user.id) return;
                if (payload.action === "bridge.refused" || payload.action === "bridge.done") got.push([payload.requestId, payload.action, payload.reason ?? null]);
            };
            game.socket.on("${SOCKET}", on);
            const toGms = { recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) };
            const arm = (key, grants, nonce) => ({ action: "call.arm", actorId: "${ids.aiko}", call: { key, kind: "hope", grants, from: "${ids.aiko}", nonce } });
            for (const [requestId, packet] of [
                ["SECH4ULTIMATE", arm("ultimate", "advantage", "SECH4ULTIMATE01")],
                ["SECH4EXPERIENCE", arm("experience", "experience", "SECH4EXPERIENCE01")],
                ["SECH4ASK", { action: "call.approve", actorId: "${ids.aiko}", key: "experience", note: "SEC H4", nonce: "SECH4EXPERIENCE02" }],
                ["SECH4OWNYES", { action: "call.yes", rid: "SECH4ASK", asker: game.user.id }],
                ["SECH4ASKED", arm("experience", "experience", "SECH4EXPERIENCE02")]
            ]) {
                game.socket.emit("${SOCKET}", { ...packet, userId: game.user.id, requestId }, toGms);
                await new Promise(r => setTimeout(r, 1500));
            }
            game.socket.off?.("${SOCKET}", on);
            return got;`, { timeout: 60000 });
        await settle(600);
        const after = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            const a = game.actors.get("${ids.aiko}"), keys = v => (Array.isArray(v) ? v : v ? [v] : []).map(e => e?.key ?? null);
            return { hope: a.system.resources.hope.value, doc: keys(a.getFlag("${MOD}", "pendingCall")),
                mark: keys(S.sheetMarkStore.get("${ids.aiko}")?.flags?.pendingCall),
                logged: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
                    .filter(e => /Refused a "call\\.(arm|yes)"/.test(e.message)).map(e => [e.message, e.count]) };`);
        yesRoad = { told, after };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}"), was = ${JSON.stringify(yesWas)};
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await a.update({ "system.resources.hope.value": was.hope });
            if (was.calls) await a.setFlag("${MOD}", "pendingCall", was.calls); else await a.unsetFlag("${MOD}", "pendingCall");
            return true;`);
    }
    check("SECURITY: p1's console arms no Ultimate or Experience without a GM's yes, and its own yes is no GM's - each refused and told, nothing paid or armed",
        Boolean(yesRoad) && JSON.stringify(yesRoad.told) === JSON.stringify([
            ["SECH4ULTIMATE", "bridge.refused", "callNotApproved"], ["SECH4EXPERIENCE", "bridge.refused", "callNotApproved"],
            ["SECH4OWNYES", "bridge.refused", "gmOnly"], ["SECH4ASKED", "bridge.refused", "callNotApproved"]])
            && yesRoad.after.hope === 3 && !yesRoad.after.doc.length && !yesRoad.after.mark.length && yesRoad.after.logged.length === 2
            && yesRoad.after.logged.some(([m, n]) => /"call\.arm".*: no GM's yes stands for that Call/.test(m) && n === 3)
            && yesRoad.after.logged.some(([m, n]) => /"call\.yes".*: only a GM says yes to a Call/.test(m) && n === 1),
        JSON.stringify(yesRoad), { flow: "hope-call" });

    /* 4b3. A GM'S CALL IS NOT THE PLAYER'S TO DROP (E29 fix r2-H7, 06.10.2026; the round-2 reviews' sec M3 and cor M4,
       the owner's Q3 (a) and the orchestrator's decision (b) of the same day). The GM arms an Obstacle on Aiko by its
       own road (call-effects.mjs `armCall` on its browser), and p1's console writes her armed list without it, with no
       roll of its own. Read on the GM once its audit has judged - it waits up to two seconds for a roll of p1's that
       covers the write (sheet-audit.mjs `callsCover`): whether the document, the mark and the list the GMs hold armed
       still name it, the rows since; on p1, what it was told. Then the control: the GMs' own spend (`spendCallsByNonce`)
       takes it off, and it stays off. Until this fix the console's write stood - document, mark and held list all lost
       it, with no row - and the next drawn roll threw no hostile die (the review's probe 99 P2 at 070b72b; this fix's
       probe on 82830f9, e29run/scratch/r2h7-probe). Her list is put back after. */
    phase("a GM's Call taken off", { flow: "call-arm" });
    const obstacleWas = await gm.eval(`const a = game.actors.get("${ids.aiko}"), was = a.getFlag("${MOD}", "pendingCall") ?? null;
        await a.unsetFlag("${MOD}", "pendingCall");
        await (await import("${repoUrl}/scripts/call-effects.mjs")).armCall(a, { key: "obstacle", kind: "despair", grants: "disadvantage", nonce: "SECH7OBSTACLE001" });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return was;`);
    const obstacleHeld = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"), A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        await A.sheetAuditIdle();
        const a = game.actors.get("${ids.aiko}"), named = v => (Array.isArray(v) ? v : v ? [v] : []).some(e => e?.nonce === "SECH7OBSTACLE001");
        const held = await A.armedCallsHeld(a);
        return { doc: named(a.getFlag("${MOD}", "pendingCall")), mark: named(S.sheetMarkStore.get("${ids.aiko}")?.flags?.pendingCall),
            held: held ? held.has("SECH7OBSTACLE001") : null };`;
    let takenOff = null;
    try {
        const armed = await gm.eval(obstacleHeld);
        const from = await gm.eval(`return Date.now();`);
        await p1.eval(`globalThis.__h7Told = [];
            if (!globalThis.__h7ToldHook) {
                globalThis.__h7ToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__h7Told.push(payload.reason); });
            }
            const a = game.actors.get("${ids.aiko}"), had = a.getFlag("${MOD}", "pendingCall");
            await a.update({ "flags.${MOD}.pendingCall": (Array.isArray(had) ? had : had ? [had] : []).filter(e => e?.nonce !== "SECH7OBSTACLE001") });
            return true;`);
        const backIn = await gm.eval(`const a = game.actors.get("${ids.aiko}"), end = Date.now() + 8000;
            const named = () => { const f = a.getFlag("${MOD}", "pendingCall"); return (Array.isArray(f) ? f : f ? [f] : []).some(e => e?.nonce === "SECH7OBSTACLE001"); };
            await new Promise(r => setTimeout(r, 300));
            while (!named() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            return Date.now() < end;`, { timeout: 30000 });
        await settle(600);
        const after = await gm.eval(obstacleHeld);
        const rows = await gm.eval(`return (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetWrites({ quiet: true })
            .filter(r => Date.parse(r.at) >= ${from} && r.character === "Aiko Hoshino" && r.change.includes("pendingCall")).map(r => r.verdict);`);
        const told = await p1.eval(`return globalThis.__h7Told.slice();`);
        await gm.eval(`await (await import("${repoUrl}/scripts/call-effects.mjs")).spendCallsByNonce(game.actors.get("${ids.aiko}"), ["SECH7OBSTACLE001"]);
            return true;`);
        await settle(600);
        takenOff = { armed, backIn, after, rows, told, spent: await gm.eval(obstacleHeld) };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}"), was = ${JSON.stringify(obstacleWas)};
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            if (was) await a.setFlag("${MOD}", "pendingCall", was); else await a.unsetFlag("${MOD}", "pendingCall");
            return true;`);
    }
    check("SECURITY: a GM's Obstacle p1's console takes off Aiko with no roll of its own is put back - on the document, in the mark and in what the GMs hold armed - with a row, and p1 is told",
        Boolean(takenOff) && takenOff.armed.doc && takenOff.armed.mark && takenOff.backIn === true
            && takenOff.after.doc && takenOff.after.mark && takenOff.after.held === true
            && JSON.stringify(takenOff.rows) === JSON.stringify(["putBack"]) && takenOff.told.includes("sheetPutBack"),
        JSON.stringify(takenOff), { flow: "call-arm" });
    check("control: the GMs' own spend takes the Obstacle off Aiko, and it stays off",
        Boolean(takenOff) && !takenOff.spent.doc && !takenOff.spent.mark && takenOff.spent.held === false,
        JSON.stringify(takenOff?.spent ?? null), { flow: "call-arm" });

    // 4c. murder.crisis: p1 throws the finishing blow as Botan, the killer.
    //     The incident is opened the way 13-murder-signals opens one; the killer's
    //     player sits still so an opening roll cannot race the GM's.
    phase("crisis actions", { flow: "murder-incident" });
    await p2.eval(`globalThis.__dialogAuto = false; return true;`);
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.botan}", victimId: "${ids.daichi}", openingTrait: "body" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return true;`, { timeout: 60000 });
    await settle(500);
    /* OUT OF TURN (E03, 24.09.2026; audit S04-09). The turn, the stage and the locks
       were checked on the acting player's own client only. With the victim to act,
       Botan's own player sends Botan's finishing blow - the honest request function,
       from the right owner, at the wrong moment - and the GM has to refuse it. */
    const toSide = side => gm.eval(`for (let i = 0; i < 4 && game.drpg.murderState()?.turnSide !== "${side}"; i++) await game.drpg.passTurn();
        return game.drpg.murderState()?.turnSide ?? null;`, { timeout: 60000 });
    const victimTurn = await toSide("victim");
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestCrisisResult({ actorId: "${ids.botan}", key: "finishingBlow", total: 99, isCritical: false, withHope: true }); return true;`);
    await settle(1700);
    // Dead as the GMs know it (E05 C10): a killing is the GMs' own until the body is found, so the flag would read "alive" either way.
    const early = await gm.eval(`return { dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")),
        reasons: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "murder.crisis"')).map(e => e.message) };`);
    check("SECURITY: a finishing blow thrown out of turn by the killer's own player kills nobody and is refused",
        victimTurn === "victim" && early.dead === false && early.reasons.some(r => /not their turn/.test(r)), JSON.stringify({ victimTurn, ...early }));
    /* AND ITS ROLL IS NOT DRAWN OUT OF TURN (E08+E28 fix r2-H1, 04.10.2026; review S2-1). The GM judged the
       turn at the packet only, so a console drew crisis rolls ahead of its turn and spent the best. At the
       victim's turn Botan's own player throws Botan's Finishing blow roll: the GM refuses it as it would
       refuse the blow, and writes no message and keeps no record. */
    const aheadRows = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return Object.values(S.rollStore?.entries() ?? {}).filter(r => r?.actorId === "${ids.botan}" && r.actionKey === "crisis").length;`;
    const aheadBefore = await gm.eval(aheadRows);
    const ahead = await drawnRoll(p2, ids.botan, "crisis", "body", { hope: 12, fear: 11 }, { context: { crisis: "finishingBlow" } });
    await settle(900);
    const aheadAfter = { rows: await gm.eval(aheadRows), reasons: await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => e.message.includes('Refused a "roll.draw"')).map(e => e.message);`) };
    check("SECURITY: a crisis roll thrown at the other side's turn is not drawn, and the GM keeps no record of it",
        ahead.messageId === null && aheadAfter.rows === aheadBefore && aheadAfter.reasons.some(r => /not their turn/.test(r)),
        JSON.stringify({ ahead, aheadBefore, aheadAfter }));
    await toSide("killer");
    await settle(500);
    const readCrisis = `return { stage: game.drpg.murderState()?.stage ?? null, dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")) };`;
    const blow = await forge("murder.crisis", { actorId: ids.botan, key: "finishingBlow", total: 99, isCritical: false, withHope: true }, readCrisis);
    await settle(1200); // a killing lands after a beat (10-murder waits 1.7 s); wait it out before calling it unchanged
    const blowLater = await gm.eval(readCrisis);
    check("SECURITY: a forged murder.crisis finishing blow as Botan killed nobody",
        blow.unchanged && JSON.stringify(blowLater) === JSON.stringify(blow.before) && blowLater.dead === false,
        JSON.stringify({ ...blow, later: blowLater }));
    check("SECURITY: the GM refused the forged murder.crisis for ownership, and told p1",
        blow.forOwnership && blow.told.some(t => t.what === "murder.crisis"), JSON.stringify({ reasons: blow.reasons, told: blow.told }));
    /* SCORED ON THE RECORD (E08+E28 C17, 04.10.2026; audit S10-06). The same blow from Botan's own
       player was the control, and killed on the 99 its packet said. A crisis action is scored on
       the GMs' record of the roll its packet names now (bridge-guards.mjs `rollRefusal`), and one
       that names none is refused (`guardCrisisRoll`). At Botan's turn his player sends the blow
       saying 99 and naming no roll - refused, nobody dies; then saying 99 and naming Botan's
       crisis roll the GM drew on 2 and 1 - not refused, scored on the record, nobody dies, and the
       GM's console says the packet's 99 lost. At Botan's turn again, the control: the blow saying
       0 and naming a roll the GM drew on 6 and 6, a critical, which kills. Red at C16's runtime:
       the first blow kills. */
    const crisisSaid = () => gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return { reasons: U.sessionFailures().filter(e => e.message.includes('Refused a "murder.crisis"')).map(e => e.message),
            said: U.sessionFailures().filter(e => e.message.includes("said total 99; the GMs' record of its roll says")).map(e => e.message) };`);
    const blowFrom = (total, rollId) => p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestCrisisResult({ actorId: "${ids.botan}", key: "finishingBlow", total: ${total}, isCritical: false, withHope: true, rollId: ${JSON.stringify(rollId)} });`,
        { timeout: 60000 });
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const unnamed = { answer: await blowFrom(99, null) };
    await settle(1200);
    Object.assign(unnamed, await gm.eval(readCrisis), await crisisSaid());
    const lowRoll = await drawnRoll(p2, ids.botan, "crisis", "body", { hope: 2, fear: 1 }, { context: { crisis: "finishingBlow" } });
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const onRecord = { answer: await blowFrom(99, lowRoll.messageId) };
    await settle(2200);
    Object.assign(onRecord, await gm.eval(readCrisis), await crisisSaid());
    check("SECURITY: a finishing blow from Botan's own player saying 99 is refused without its roll, and scored on the GMs' record of the roll it names - nobody dies",
        unnamed.answer?.ok === false && unnamed.answer?.reason === "rollUnknown" && unnamed.dead === false
            && Boolean(lowRoll.messageId) && onRecord.answer?.ok === true && onRecord.dead === false && !onRecord.reasons.length && onRecord.said.length > 0,
        JSON.stringify({ unnamed, lowRoll, onRecord }), { flow: "murder-incident" });
    await toSide("killer");
    await settle(500);
    /* Thrown as a crisis action throws it, kept for a Reroll (`remember`): the Reroll asked below is of this blow. */
    const critRoll = await drawnRoll(p2, ids.botan, "crisis", "body", { hope: 6, fear: 6 }, { context: { crisis: "finishingBlow" }, remember: true });
    const critAnswer = await blowFrom(0, critRoll.messageId);
    await settle(2200);
    const blowOk = await gm.eval(readCrisis);
    check("control: a finishing blow from Botan's own player saying 0, naming a critical the GM drew, does kill",
        Boolean(critRoll.messageId) && critAnswer?.ok === true && blowOk.dead === true, JSON.stringify({ critRoll, critAnswer, blowOk }), { flow: "murder-incident" });

    /* A BLOW THAT KILLED IS NOT TAKEN BACK (E32+E07 C8b, 28.09.2026; AUDIT-1.2.42 section 9,
       the owner's answer (A)). Botan's own player sends the undo of the blow that just killed -
       a Reroll's packet, a total of 0 and no Reroll behind it. Until 1.2.66 the guards let it
       as far as the Reroll receipt (refused there as "noReroll", and a player with one had the
       blow taken back and Daichi left dead); the GM refused it first, for the death, from C8b.
       Since E08+E28 C8 no player's undo is taken at all - the GM's own Reroll takes an action
       back - so it is refused before the death is asked (`undoIsTheGms`), and nothing moves:
       Daichi dead, the stage and the action's receipt as they were. */
    const readUndo = `const s = game.drpg.murderState();
        return { stage: s?.stage ?? null, dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")), receipt: JSON.stringify(s?.lastCrisis ?? null) };`;
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const undoBefore = await gm.eval(readUndo);
    const undoAnswer = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestCrisisResult({ actorId: "${ids.botan}", key: "finishingBlow", total: 0, isCritical: false, withHope: true, undo: true });`,
        { timeout: 30000 });
    await settle(900);
    const undoAfter = await gm.eval(readUndo);
    const undoReasons = await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => e.message.includes('Refused a "murder.crisis"')).map(e => e.message);`);
    check("SECURITY: the undo of the finishing blow that killed is refused on the GM, and the death stands",
        undoBefore.dead === true && JSON.stringify(undoAfter) === JSON.stringify(undoBefore) && undoAnswer?.ok === false
            && undoAnswer?.reason === "undoIsTheGms" && undoReasons.some(r => /an undo is the GM's own Reroll's/.test(r)),
        JSON.stringify({ undoBefore, undoAfter, undoAnswer, undoReasons }));

    /* THE REROLL IS ASKED OF THE GM (E08+E28 C4a, 03.10.2026; audit S02-47). One request,
       `reroll.ask { actorId }`, and the GM pays and makes all of it - so the request is the
       one gate. p1 asks a Reroll of Botan, p2's character: refused for ownership, told to p1,
       Botan's Hope and roll as they were. Then p2 throws Botan's crisis roll, as a player's
       crisis action throws it, and asks its Reroll from Botan's own browser: the blow before it
       killed (the incident's receipt), so the GM refuses it for the death before anything is
       paid, and tells p2. The harness's roll message has no `Roll#reroll`; on the GM it reads
       as one of the scenario's (`REROLLABLE`), so the refusal is the death's, not the roll's.
       Both checks carry the `reroll` flow inside the crisis actions' phase. Since fix r2-H1 the
       roll is the killing blow's own (`critRoll`, kept for a Reroll): a crisis roll is drawn only
       at its character's turn, and the incident is at Stage 6 by now. */
    const readReroll = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = S.rerollBookmarkStore?.get("${ids.botan}");
        return { hope: game.actors.get("${ids.botan}").system.resources.hope.value, row: row ? { messageId: row.messageId, total: row.total } : null,
            journal: Boolean(S.rerollJournalStore?.has("${ids.botan}")), dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")),
            receipt: JSON.stringify(game.drpg.murderState()?.lastCrisis ?? null) };`;
    const botanRoll = critRoll.messageId;
    await settle(900);
    const REROLLABLE = `const m = game.messages.get("${botanRoll}");
        class Thrown {
            constructor(formula, data = {}, options = {}) { this._formula = formula; this.options = options; this.faces = { hope: 9, fear: 4 }; }
            get dHope() { return { total: this.faces.hope }; } get dFear() { return { total: this.faces.fear }; }
            get total() { return this.faces.hope + this.faces.fear; }
            get withHope() { return this.faces.hope > this.faces.fear; } get withFear() { return this.faces.hope < this.faces.fear; }
            get isCritical() { return this.faces.hope === this.faces.fear; }
            async reroll() { const r = new Thrown(this._formula, {}, this.options); r.faces = { hope: 2, fear: 11 }; return r; }
            toJSON() { return { class: "DualityRoll", formula: this._formula, total: this.total, evaluated: true }; }
        }
        if (m) Object.defineProperty(m, "rolls", { configurable: true, get: () => [new Thrown("1d12 + 1d12", {}, {})] });
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const botan = game.actors.get("${ids.botan}");
        await trustedWrite(botan, { "system.resources.hope.value": Math.max(4, botan.system.resources.hope.value) }, { reason: "gmRuling" });
        return true;`;
    await gm.eval(REROLLABLE, { timeout: 30000 });
    await settle(500);
    const forgedReroll = await forge("reroll.ask", { actorId: ids.botan }, readReroll);
    check("SECURITY: a reroll.ask for another player's character is refused for ownership, told to p1, and pays and rewrites nothing",
        Boolean(botanRoll) && forgedReroll.unchanged && forgedReroll.forOwnership && forgedReroll.told.some(t => t.what === "reroll.ask")
            && forgedReroll.after.row?.messageId === botanRoll,
        JSON.stringify(forgedReroll), { flow: "reroll" });
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const lethalBefore = await gm.eval(readReroll);
    const lethalAsk = await p2.eval(`globalThis.__rerollRefused = [];
        game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused" && payload.what === "reroll.ask") globalThis.__rerollRefused.push(payload.reason ?? null); });
        const C = await import("${repoUrl}/scripts/calls.mjs");
        const out = await C.spendHopeCall(game.actors.get("${ids.botan}"), "reroll");
        await new Promise(r => setTimeout(r, 300));
        return { made: Boolean(out), told: globalThis.__rerollRefused.slice() };`, { timeout: 60000 });
    await settle(900);
    const lethalAfter = await gm.eval(readReroll);
    const lethalReasons = await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => e.message.includes('Refused a "reroll.ask"')).map(e => e.message);`);
    check("SECURITY: a Reroll of the crisis action that killed is refused on the GM with deathStands, nothing paid, and the death stands",
        lethalBefore.dead === true && JSON.stringify(lethalAfter) === JSON.stringify(lethalBefore) && lethalAsk.made === false
            && JSON.stringify(lethalAsk.told) === JSON.stringify(["deathStands"]) && lethalReasons.some(r => /the death stands/.test(r)),
        JSON.stringify({ lethalBefore, lethalAfter, lethalAsk, lethalReasons }), { flow: "reroll" });
    await gm.eval(`const m = game.messages.get("${botanRoll}"); if (m) delete m.rolls; await m?.delete();
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        if (S.rerollBookmarkStore?.has("${ids.botan}")) await S.rerollBookmarkStore.drop("${ids.botan}");
        return true;`, { timeout: 30000 });

    /* STAGE 6 IS DECIDED ON THE GM'S SIDE (E03; audit S05-04). The Tamper list with
       `mine: false` is the whole room, types and all, and it used to be the asking
       client that decided it was Stage 6. A hidden trace nobody has found lies in
       the Cafeteria, where the killer and Aiko both stand. */
    const planted6 = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        const t = await R.placeRemnant({ x: 1700, y: 500, sceneId: canvas.scene.id, type: "prep", visibility: "hidden",
            sourceActor: "${ids.chie}", sourceName: "Chie Mori", room: "Cafeteria", subject: "SEC stage six" });
        return { id: t?.id ?? null, stage: game.drpg.murderState()?.stage ?? null };`, { timeout: 30000 });
    const killerList = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestCleanableTraces("${ids.botan}", { mine: false });`, { timeout: 30000 });
    const aikoWhole = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestCleanableTraces("${ids.aiko}", { mine: false });`, { timeout: 30000 });
    const aikoMine = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestCleanableTraces("${ids.aiko}", { mine: true });`, { timeout: 30000 });
    check("control: the killer in Stage 6 is shown the whole room",
        planted6.stage === "resolution" && (killerList ?? []).some(t => t.id === planted6.id), JSON.stringify({ planted6, killerList }));
    check("SECURITY: anybody else asking for the whole room gets only what they know",
        !(aikoWhole ?? []).some(t => t.id === planted6.id) && JSON.stringify(aikoWhole) === JSON.stringify(aikoMine),
        JSON.stringify({ aikoWhole, aikoMine }));
    await gm.eval(`await game.drpg.endMurder({ reason: "test", followUp: false }); return true;`, { timeout: 60000 });

    /* A ROLE REVERSAL THE OPENING TOOK AWAY (E32+E07 C11a, 02.10.2026; audit S04-06). Botan
       opens on Chie with a Despair success, which takes Role reversal from the victim; the
       panel stopped drawing it, and the GM, asked, carried it out - its judgement read the
       locks of an action in the side's list and let one missing from it through. Chie's own
       player sends it on Chie's turn, through the honest request function: the GM refuses it
       for what was taken away, tells p3 why, and the seats do not move. Chie's Health and
       Sanity are put back after (the opening fills her Sanity). */
    phase("a Role reversal the opening took away", { flow: "murder-incident" });
    const chieWas = await gm.eval(`const r = game.actors.get("${ids.chie}").system.resources;
        return { hp: r.hitPoints.value, stress: r.stress.value };`);
    const readSeats = `const s = game.drpg.murderState();
        return { stage: s?.stage ?? null, killerId: s?.killerId ?? null, victimId: s?.victimId ?? null, turnSide: s?.turnSide ?? null,
            denied: s?.deniedToVictim ?? null };`;
    const denyOpen = await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.botan}", victimId: "${ids.chie}", openingTrait: "body" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: false });
        (await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures();
        ${readSeats}`, { timeout: 60000 });
    const denyAnswer = await p3.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestCrisisResult({ actorId: "${ids.chie}", key: "roleReversal", total: 99, isCritical: false, withHope: true });`,
        { timeout: 30000 });
    await settle(900);
    const denyAfter = await gm.eval(readSeats);
    const denyReasons = await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => e.message.includes('Refused a "murder.crisis"')).map(e => e.message);`);
    await gm.eval(`await game.drpg.endMurder({ reason: "test", followUp: false });
        await game.actors.get("${ids.chie}").update({ "system.resources.hitPoints.value": ${Number(chieWas?.hp) || 0},
            "system.resources.stress.value": ${Number(chieWas?.stress) || 0} });
        return true;`, { timeout: 60000 });
    check("SECURITY: a Role reversal the Despair opening took away, sent by the victim's own player, is refused on the GM and told",
        denyOpen.stage === "incident" && denyOpen.turnSide === "victim" && (denyOpen.denied ?? []).includes("roleReversal")
            && denyAnswer?.ok === false && denyAnswer?.reason === "actionDenied"
            && denyAfter.killerId === ids.botan && denyAfter.victimId === ids.chie
            && denyReasons.some(r => /that action is not open to that character now/.test(r)),
        JSON.stringify({ denyOpen, denyAnswer, denyAfter, denyReasons }), { flow: "murder-incident" });

    /* A STATISTIC RULING NOBODY MAY ASK (E32+E07 C11b, 02.10.2026; audit S04-23). The card a
       ruling raises names the action in its player's thread, so the GM asks the world before it
       posts one (bridge-guards.mjs `guardTraitRuling`): p1 asks, through the honest request
       function, for Botan's Strike - not Aiko's to ask for - for Aiko's own with no incident
       running, and for an opening's statistic, which only a GM's own client picks. Each is
       refused on the GM and told to p1 with its reason; no card goes up and the harness's GM
       presses nothing (client-entry.mjs `__traitRulings`). */
    phase("a statistic ruling nobody may ask", { flow: "trait-ruling" });
    const rulingMark = await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures();
        globalThis.__traitRulings.length = 0;
        return game.messages.contents.length;`);
    const rulingAsked = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        if (typeof B.requestTraitRuling !== "function") return "no requestTraitRuling";
        const ask = async (actorId, kind, key) => { const r = await B.requestTraitRuling({ actorId, kind, key }); return [r?.ok ?? null, r?.reason ?? null]; };
        return [await ask("${ids.botan}", "crisis", "strike"), await ask("${ids.aiko}", "crisis", "strike"), await ask("${ids.aiko}", "opening", "killer")];`,
        { timeout: 60000 });
    await settle(600);
    const rulingAfter = await gm.eval(`return { cards: game.messages.contents.length - ${Number(rulingMark) || 0}, pressed: globalThis.__traitRulings.length,
        logged: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "trait.ruling"')).length };`);
    check("SECURITY: a statistic ruling for another player's character, for a crisis action with no incident, or for an opening is refused on the GM, told, and puts no card up",
        JSON.stringify(rulingAsked) === JSON.stringify([[false, "notYours"], [false, "notInIncident"], [false, "gmOnly"]])
            && rulingAfter.cards === 0 && rulingAfter.pressed === 0 && rulingAfter.logged === 3,
        JSON.stringify({ rulingAsked, rulingAfter }), { flow: "trait-ruling" });

    /*
     * 4d. A CALL ON A BODY NOBODY HAS FOUND (E05 fix r2-G3, 27.09.2026; review S2-m1). Daichi is
     * the blow's kept death now. The GM refused a Call on him as "cannot now" before it asked
     * for the price, so p1 with no Hope was told "cannotNow" for Daichi and "notEnoughHope" for
     * Chie - which of the class had died unseen, free. It is asked last now: with no Hope both
     * are refused for the Hope, and with the Hope for it Daichi's is still refused, paid for by
     * nobody. Red on 8c6dfd6: Daichi's came back cannotNow with no Hope held.
     */
    phase("a Call on a body nobody has found", { flow: "call-arm" });
    const aikoHope = await gm.eval(`const a = game.actors.get("${ids.aiko}"); const was = a.system.resources.hope.value;
        await a.update({ "system.resources.hope.value": 0 }); return was;`);
    const support = (target, nonce) => p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        return await B.requestArmCall("${target}", ${JSON.stringify({ key: "support", grants: "advantage", kind: "hope", from: ids.aiko, nonce })});`,
        { timeout: 30000 });
    const poor = { kept: await support(ids.daichi, "sec-kept-poor"), living: await support(ids.chie, "sec-living-poor") };
    await gm.eval(`await game.actors.get("${ids.aiko}").update({ "system.resources.hope.value": 4 }); return true;`);
    const rich = await support(ids.daichi, "sec-kept-paid");
    await settle(600);
    const readSupport = await gm.eval(`const d = game.actors.get("${ids.daichi}");
        return { kept: game.drpg.isDeadForGm(d) && !game.drpg.isDeceased(d), hope: game.actors.get("${ids.aiko}").system.resources.hope.value,
            armed: JSON.stringify([d.getFlag("${MOD}", "pendingCall") ?? null, game.actors.get("${ids.chie}").getFlag("${MOD}", "pendingCall") ?? null]) };`);
    await gm.eval(`await game.actors.get("${ids.aiko}").update({ "system.resources.hope.value": ${Number(aikoHope) || 0} }); return true;`);
    check("SECURITY: with no Hope, a Support for a body nobody has found and one for a living student are refused alike (notEnoughHope)",
        readSupport.kept && poor.kept?.ok === false && poor.living?.ok === false && poor.kept.reason === "notEnoughHope"
        && poor.living.reason === "notEnoughHope", JSON.stringify({ poor, readSupport }));
    check("control: with the Hope for it, the Support for the body nobody has found is still refused as cannotNow - nothing paid, nothing armed",
        rich?.ok === false && rich.reason === "cannotNow" && readSupport.hope === 4 && !readSupport.armed.includes("sec-"),
        JSON.stringify({ rich, readSupport }));

    /*
     * 5. A player calling a GM-side pool write through the API.
     *
     * This was `check(..., true)` - "does not throw uncaught" - and passed whatever
     * happened. What matters is the pool: p1 tries to drain the GM's Despair pool,
     * and the GM's reading must not move. (It used to pass an actor id, which is not
     * what `adjustDespair` takes - pools are keyed by the Monokuma's user id.)
     */
    phase("the GM's pool", { flow: "despair" });
    const poolBefore = await gm.eval(`return game.drpg.getDespair(game.user.id);`);
    const selfGrant = await p1.eval(`
        try { const r = await game.drpg.adjustDespair("${gm.userId}", -5); return { threw: null, r }; }
        catch (err) { return { threw: err.message }; }
    `);
    await settle(400);
    const poolAfter = await gm.eval(`return game.drpg.getDespair(game.user.id);`);
    check("SECURITY: a player calling adjustDespair on the GM's pool moves nothing",
        poolBefore > 0 && poolAfter === poolBefore, JSON.stringify({ poolBefore, poolAfter, selfGrant }));

    /*
     * 6. SCRIPT FROM A PLAYER'S CONSOLE ON THE GM'S SCREEN (E02, 24.09.2026; audit
     * S01-03, S11-01, S10-02).
     *
     * A private card's words travel by socket and go into `innerHTML` on the reader's
     * screen without passing Foundry's server, which is what cleans a document's
     * `content`. So a player who posts a card of their own and then sends its words
     * by hand chose what the GM's browser draws. Measured on the GM: what the store
     * hands back for the card, which is what the chat log, the messenger and the
     * notice all draw.
     *
     * jsdom does not fetch images, so an `onerror` would never FIRE here even left in;
     * the check is that the attribute is gone, which is what stops it firing in a
     * browser. The button with its `data-*` is the half that must survive: a GM's
     * ruling card is made of them.
     */
    phase("private cards", { flow: "messenger" });
    const EVIL = '<img src=x onerror="window.__pwned=1"><button type="button" data-drpg-call="probe" data-rid="r1">ok</button>';
    const posted = await p1.eval(`
        const msg = await ChatMessage.create({
            content: '<p class="notes" data-drpg-secret>-</p>',
            whisper: ["${gm.userId}"],
            flags: { "${MOD}": { secret: true } }
        });
        game.socket.emit("${SOCKET}", { action: "secret.card", id: msg.id, html: ${JSON.stringify(EVIL)}, at: Date.now(), pin: true });
        return msg.id;
    `, { timeout: 30000 });
    await settle(1200);
    const seen = await gm.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const m = game.messages.get(${JSON.stringify(posted)});
        const html = m ? S.contentOf(m) : null;
        const box = document.createElement("div");
        box.innerHTML = html ?? "";
        return { html: (html ?? "").slice(0, 300),
            handler: Boolean(box.querySelector("[onerror]")),
            button: box.querySelector("button[data-drpg-call]")?.dataset.rid ?? null,
            pinned: Boolean(game.settings.get("${MOD}", "secretCards")?.[${JSON.stringify(posted)}]?.pin) };
    `);
    check("XSS: a player's private-card words reach the GM without their handler",
        seen.html !== null && !seen.handler, JSON.stringify(seen));
    check("XSS: the card's button and data attributes survive the cleaning",
        seen.button === "r1", JSON.stringify(seen));
    check("XSS: a player's packet cannot pin its card in the GM's store", seen.pinned === false, JSON.stringify(seen));

    /* A CARD'S FACTS FROM A PLAYER (E05 C7, 26.09.2026). They travel with the words now and
       the GM's day summary reads them, so what a player sends is kept as plain fields only,
       and not at all when they name a character the player does not own: p1 plays Aiko,
       not Botan. Two cards of p1's own, each with a packet as a console would write it. */
    const facts = await p1.eval(`
        const post = async summary => {
            const msg = await ChatMessage.create({ content: '<p class="notes" data-drpg-secret>-</p>',
                whisper: ["${gm.userId}"], flags: { "${MOD}": { secret: true } } });
            game.socket.emit("${SOCKET}", { action: "secret.card", id: msg.id, html: "<p>SEC facts</p>", at: Date.now(), summary });
            return msg.id;
        };
        return { other: await post({ actorId: "${ids.botan}", action: "Search", item: "SEC not yours" }),
            own: await post({ actorId: "${ids.aiko}", action: "Search", item: "SEC yours", extra: "SEC extra", total: { v: 1 } }) };
    `, { timeout: 30000 });
    await settle(1200);
    const factsKept = await gm.eval(`
        const store = game.settings.get("${MOD}", "secretCards") ?? {};
        return { other: store[${JSON.stringify(facts.other)}]?.summary ?? null, own: store[${JSON.stringify(facts.own)}]?.summary ?? null,
            words: Boolean(store[${JSON.stringify(facts.other)}]?.html) };
    `);
    check("SECURITY: a player's card cannot put facts about another player's character in the GM's day summary",
        factsKept.words && factsKept.other === null, JSON.stringify(factsKept));
    check("SECURITY: a player's facts about their own character are kept as plain fields only",
        factsKept.own?.item === "SEC yours" && !("extra" in (factsKept.own ?? {})) && factsKept.own?.total === null, JSON.stringify(factsKept));

    /* A CARD'S META FROM A PLAYER (E06 C7a, 27.09.2026). What a private card says of itself
       travels with its words now, and the GM's popup and ruling wiring read it there - so a
       player's meta is judged as a player's facts are: it cannot ask the GMs for a notice
       (`gmPopup`, `popupForce`) or put a ruling's buttons on a card (`callCard`); what else
       it says of the player's own card is kept. Nor, since E08+E28 fix r2-H5, name somebody as
       the one who asked a GM to post it (`askedBy`, which `cardWriter` reads on a GM's card).
       p1's own card, its packet as a console would write it. */
    const metaCard = await p1.eval(`
        const msg = await ChatMessage.create({ content: '<p class="notes" data-drpg-secret>-</p>',
            whisper: ["${gm.userId}"], flags: { "${MOD}": { secret: true } } });
        game.socket.emit("${SOCKET}", { action: "secret.card", id: msg.id, html: "<p>SEC meta</p>", at: Date.now(),
            meta: { gmPopup: true, popupForce: true, callCard: true, askedBy: "${gm.userId}", popupTitle: "SEC meta title" } });
        return msg.id;
    `, { timeout: 30000 });
    await settle(1200);
    const metaKept = await gm.eval(`
        const store = game.settings.get("${MOD}", "secretCards") ?? {};
        return { words: Boolean(store[${JSON.stringify(metaCard)}]?.html), meta: store[${JSON.stringify(metaCard)}]?.meta ?? null };
    `);
    check("SECURITY: a player's card cannot ask the GMs for a notice, carry a ruling's buttons or name who asked for it, and keeps its own title",
        metaKept.words && JSON.stringify(metaKept.meta) === JSON.stringify({ popupTitle: "SEC meta title" }), JSON.stringify(metaKept));

    /* THE SAFEWORD'S SIREN FROM A PLAYER'S PRIVATE CARD (E06 fix r1-G5, 28.09.2026; the
       round-1 review's m3). The siren ignores the volume slider, and a player rings it only
       with the real safeword card, whose marker on the document pauses the game. p1's
       private card to the GM carries the siren and the marker in its meta, as `postSecret`
       sends them: on the GM the marker is not kept, the card asks for no sound, and the
       game is not paused. */
    const siren = await p1.eval(`
        const { postSecret } = await import("${repoUrl}/scripts/secret.mjs");
        const msg = await postSecret({ content: "<p>SEC siren</p>", whisper: ["${gm.userId}"],
            flags: { "${MOD}": { sfx: { key: "safeword", gm: true }, safeword: true } } });
        return msg?.id ?? null;
    `, { timeout: 30000 });
    await settle(1200);
    const sirenOnGm = await gm.eval(`
        const { soundFromMessage } = await import("${repoUrl}/scripts/sfx.mjs");
        const m = game.messages.get(${JSON.stringify(siren)});
        const kept = (game.settings.get("${MOD}", "secretCards") ?? {})[${JSON.stringify(siren)}];
        return m ? { words: Boolean(kept?.html), marker: kept?.meta?.safeword ?? null,
            sound: soundFromMessage(m), paused: game.paused } : null;
    `);
    check("SECURITY: a player's private card cannot ring the safeword's siren at the GMs without calling the safeword",
        Boolean(sirenOnGm?.words) && sirenOnGm.marker === null && sirenOnGm.sound === null && !sirenOnGm.paused,
        JSON.stringify(sirenOnGm));

    /* A RULING CARD SETTLED (E06 C7a). `settleCall` wrote `settled` on the card's document,
       which told every browser a ruling was made; it goes with the receipt's words now, and
       the thread's player - one of the card's readers - reads it there. */
    const ruled = await gm.eval(`
        const { postToThread } = await import("${repoUrl}/scripts/messenger.mjs");
        const { settleCall } = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const msg = await postToThread("${p1.userId}", '<p>SEC ruling</p><div class="drpg-call-actions"><button type="button" data-drpg-call="probe">x</button></div>');
        await settleCall(msg, "SEC ruled");
        return msg?.id ?? null;
    `, { timeout: 30000 });
    await settle(1200);
    const ruledOnP1 = await p1.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const m = game.messages.get(${JSON.stringify(ruled)});
        // Through the document on a tree without cardFlag (red first), so the check reads it there.
        const flag = S.cardFlag ?? ((doc, key) => doc.getFlag("${MOD}", key));
        return m ? { settled: flag(m, "settled") ?? null, onDocument: m.toObject().flags?.["${MOD}"]?.settled ?? null,
            receipt: S.contentOf(m).includes("SEC ruled") } : null;
    `);
    check("p1: a settled ruling card in p1's thread is settled from its words, and not on its document",
        Boolean(ruled) && ruledOnP1?.settled === true && ruledOnP1.onDocument === null && ruledOnP1.receipt, JSON.stringify({ ruled, ruledOnP1 }));
    await gm.eval(`await game.messages.get(${JSON.stringify(ruled)})?.delete(); return true;`);

    /* THE GMS' PROSE STAYS THEIRS (E06 C7b, 27.09.2026; audit L17, S11-05). A ruling card's
       GM half - the reference prose (`.drpg-gm-only`) and the ruling's buttons
       (`.drpg-call-actions`) - went to the thread's player with the rest of its words, into
       p1's store and p1's Chat tab. p1 is sent the words without both now, as posted and as
       settled, and the GM keeps them. The Chat tab is read by running the swap's hook on an
       element as a log would (the harness draws no log). Then the belt: words holding both
       blocks put into p1's store by hand, as ones kept from before this was fixed, and drawn
       the same way. */
    const gmProse = await gm.eval(`
        const { postToThread } = await import("${repoUrl}/scripts/messenger.mjs");
        const { settleCall } = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const html = '<p>SEC ruling prose</p><div class="drpg-gm-only"><p>SEC GM table</p></div><div class="drpg-call-actions"><button type="button" data-drpg-call="probe">x</button></div>';
        const posted = await postToThread("${p1.userId}", html);
        const settled = await postToThread("${p1.userId}", html);
        if (settled) await settleCall(settled, "SEC prose ruled");
        const kept = [posted, settled].map(m => m ? S.contentOf(m) : "");
        return { ids: [posted?.id ?? null, settled?.id ?? null], gmKeeps: kept.every(w => w.includes("SEC GM table")) };
    `, { timeout: 30000 });
    await settle(1200);
    const proseOnP1 = await p1.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const drawn = m => {
            const el = document.createElement("li");
            el.innerHTML = '<div class="message-content"><p class="notes" data-drpg-secret>-</p></div>';
            Hooks.callAll("renderChatMessageHTML", m, el);
            return el.innerHTML;
        };
        const leaks = w => ["drpg-gm-only", "drpg-call-actions", "SEC GM table"].filter(x => w.includes(x));
        return ${JSON.stringify(gmProse.ids)}.map(id => {
            const m = game.messages.get(id);
            const words = m ? S.contentOf(m) : "";
            return m ? { words: words.includes("SEC ruling prose"), stored: leaks(words), chat: leaks(drawn(m)) } : null;
        });
    `);
    check("SECURITY: p1's copy of a ruling card, posted and settled, holds no GM-only prose or ruling button, in the store or the Chat tab",
        gmProse.gmKeeps && proseOnP1.length === 2 && proseOnP1.every(c => c?.words && !c.stored.length && !c.chat.length),
        JSON.stringify({ gmProse, proseOnP1 }));
    const belt = await p1.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const id = ${JSON.stringify(gmProse.ids[0])};
        const m = game.messages.get(id);
        if (!m) return null;
        const store = foundry.utils.deepClone(game.settings.get("${MOD}", "secretCards") ?? {});
        store[id] = { ...store[id], html: '<p>SEC old words</p><div class="drpg-gm-only"><p>SEC GM table</p></div><div class="drpg-call-actions"><button type="button" data-drpg-call="probe">x</button></div>', at: Date.now() };
        await game.settings.set("${MOD}", "secretCards", store);
        S.forgetSecrets();
        const held = S.contentOf(m);
        const el = document.createElement("li");
        el.innerHTML = '<div class="message-content"><p class="notes" data-drpg-secret>-</p></div>';
        Hooks.callAll("renderChatMessageHTML", m, el);
        return { held: ["drpg-gm-only", "drpg-call-actions"].filter(x => held.includes(x)),
            drawn: el.innerHTML.includes("SEC old words"), chat: ["drpg-gm-only", "drpg-call-actions", "SEC GM table"].filter(x => el.innerHTML.includes(x)) };
    `);
    check("SECURITY: p1's Chat tab takes the GM-only prose and the ruling's buttons off words kept from before",
        belt?.held.length === 2 && belt.drawn && !belt.chat.length, JSON.stringify(belt));
    await gm.eval(`for (const id of ${JSON.stringify(gmProse.ids)}) await game.messages.get(id)?.delete(); return true;`);

    /* The same words, stored before this was fixed: an entry with no trust mark is
       cleaned when it is read, whoever wrote it. */
    const legacy = await gm.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const msg = await ChatMessage.create({ content: '<p class="notes" data-drpg-secret>-</p>',
            whisper: [game.user.id], flags: { "${MOD}": { secret: true } } });
        const store = foundry.utils.deepClone(game.settings.get("${MOD}", "secretCards") ?? {});
        store[msg.id] = { html: ${JSON.stringify(EVIL)}, at: Date.now() };
        await game.settings.set("${MOD}", "secretCards", store);
        S.forgetSecrets();
        const html = S.contentOf(msg);
        return { handler: /onerror/i.test(html), html: html.slice(0, 200) };
    `, { timeout: 30000 });
    check("XSS: words stored before the fix are cleaned when they are read", !legacy.handler, JSON.stringify(legacy));

    /* The Hope Call card's price came from the packet and was printed raw into the
       GM's card. p1 asks about their own Aiko, so ownership is not what stops it. */
    phase("a Hope Call card", { flow: "hope-call" });
    const beforeCall = await gm.eval(`return game.messages.size;`);
    await p1.eval(`
        game.socket.emit("${SOCKET}", { action: "call.approve", requestId: "xss-${Date.now()}", userId: game.user.id,
            actorId: "${ids.aiko}", actorName: "Aiko Hoshino", key: "experience", callLabel: "Experience",
            effect: "fine", note: "please", cost: '<img src=x onerror="window.__pwned=2">' });
        return true;
    `);
    await settle(1500);
    const callCard = await gm.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const fresh = [...game.messages].slice(${beforeCall});
        const words = fresh.map(m => S.contentOf(m)).join(" ");
        return { cards: fresh.length, handler: /onerror/i.test(words), cost: /approveCost|1/.test(words), sample: words.slice(0, 300) };
    `);
    check("XSS: a Hope Call card is raised for the player's own character", callCard.cards > 0, JSON.stringify(callCard));
    check("XSS: the Hope Call card prints the price from the GM's table, not the packet's markup",
        callCard.cards > 0 && !callCard.handler, JSON.stringify(callCard));

    /* A CHARACTER'S NAME ON A CARD THE GM'S OWN BROWSER WRITES (E02 review). The GM's
       note about an Observe with no record printed the observer's name raw, and a
       card written on the GM's client is stored as the GM's own and never cleaned.
       p1 renames their own Aiko - a player owns their character - and resolves an
       Observe the GM has no record of. */
    phase("an Observe note", { flow: "search-observe" });
    const nameBefore = await gm.eval(`return game.actors.get("${ids.aiko}").name;`);
    const renamed = await p1.eval(`
        try { await game.actors.get("${ids.aiko}").update({ name: '<img src=x onerror="window.__pwned=3">Aiko' }); return true; }
        catch (err) { return err.message; }`);
    await settle(600);
    // The resolve names a roll of Aiko's the GM drew, or it is refused before the note is written (E08+E28 C14).
    const lostRoll = await drawnRoll(p1, ids.aiko, "observe", "eye", { hope: 4, fear: 3 });
    const beforeLost = await gm.eval(`return game.messages.size;`);
    await p1.eval(`
        game.socket.emit("${SOCKET}", { action: "observe.resolve", requestId: "lost-${Date.now()}", userId: game.user.id,
            actorId: "${ids.aiko}", key: "no-such-key", total: 7, rollId: ${JSON.stringify(lostRoll.messageId)} },
            { recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) });
        return true;`);
    await settle(1500);
    const lostCard = await gm.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const fresh = [...game.messages].slice(${beforeLost});
        const words = fresh.map(m => S.contentOf(m)).join(" ");
        const box = document.createElement("template");
        box.innerHTML = words;
        return { cards: fresh.length, renamed: game.actors.get("${ids.aiko}").name.includes("onerror"),
            handler: Boolean(box.content.querySelector("[onerror]")), sample: words.slice(0, 300) };
    `);
    await gm.eval(`await game.actors.get("${ids.aiko}").update({ name: ${JSON.stringify(nameBefore)} }); return true;`);
    check("XSS: a renamed character's name reaches the GM's own Observe note as text",
        renamed === true && Boolean(lostRoll.messageId) && lostCard.renamed && lostCard.cards > 0 && !lostCard.handler,
        JSON.stringify({ renamed, lostRoll, ...lostCard }));

    /* ONE BROWSER, SEVERAL WORLDS (E02 review). The store of private cards is a client
       setting: one entry in the browser for every world it opens. The start-up tidy
       took out every card not in THIS world's chat log, so opening a second world
       emptied the first one's. Planted on p1: a card of another world, a card of this
       world whose message is gone, and one from before cards recorded their world. */
    phase("the private card store", { flow: "messenger" });
    const prune = await p1.eval(`
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const saved = foundry.utils.deepClone(game.settings.get("${MOD}", "secretCards") ?? {});
        const store = foundry.utils.deepClone(saved);
        store.otherWorld0000001 = { html: "theirs", at: Date.now(), world: "some-other-world" };
        store.thisWorldGone0001 = { html: "ours, deleted", at: Date.now(), world: game.world.id };
        store.unstampedGone0001 = { html: "unknown", at: Date.now() };
        await game.settings.set("${MOD}", "secretCards", store);
        S.forgetSecrets();
        await S.pruneOrphans();
        const after = game.settings.get("${MOD}", "secretCards") ?? {};
        const result = { other: "otherWorld0000001" in after, gone: "thisWorldGone0001" in after, unstamped: "unstampedGone0001" in after };
        await game.settings.set("${MOD}", "secretCards", saved);
        S.forgetSecrets();
        return result;
    `, { timeout: 30000 });
    check("store: the start-up tidy keeps another world's private cards and this world's unknown ones",
        prune.other === true && prune.unstamped === true, JSON.stringify(prune));
    check("store: the start-up tidy removes this world's cards whose message is gone", prune.gone === false, JSON.stringify(prune));

    /*
     * 7. THE GM BRIDGE JUDGES WHAT A PLAYER ASKS FOR (E03, 24.09.2026; audit S10-03,
     * S05-03, S10-40, S05-13, S10-10, S09-02, S07-17, S11-04, S05-12).
     *
     * Each block below sends one request a player's own client never sends - or
     * sends it without the Reroll that is the only honest reason for it - and checks
     * on the GM that nothing changed and that the GM said why. Each has a control
     * beside it: the same road taken honestly still works. Until E08+E28 C8 a "Reroll
     * receipt" paid for an undo, made the way a real Reroll made one: the player
     * rewrote the rolls of their own character's roll message. Since C8 no player's
     * undo is taken (`undoIsTheGms`) - the GM's own Reroll takes an action back - and
     * the primary puts such a rewrite back (reroll-receipts.mjs); `rerollOn` still
     * makes one, to show it pays for nothing.
     */
    const refusedFor = async action => gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => e.message.includes('Refused a "${action}"')).map(e => e.message);`);
    const clearFailures = () => gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const toGms = `{ recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) }`;
    /** A roll message of the player's own character, and then its rolls rewritten - a receipt until E08+E28 C8. */
    const rerollOn = (client, actorId, { fearBefore = false, fearAfter = false } = {}) => client.eval(`
        const roll = fear => ({ class: "DualityRoll", formula: "1d12 + 1d12", total: 14,
            dHope: { total: fear ? 3 : 9 }, dFear: { total: fear ? 9 : 3 } });
        const m = await ChatMessage.create({ speaker: { actor: "${actorId}" }, content: "roll",
            rolls: [JSON.stringify(roll(${fearBefore}))] });
        await new Promise(r => setTimeout(r, 200));
        await m.update({ rolls: [JSON.stringify(roll(${fearAfter}))] });
        return m.id;`, { timeout: 30000 });

    // 7a. project.unsabotage: a repair id that is not the one the sabotage made.
    phase("projects", { flow: "projects" });
    /* A PLAYER'S SABOTAGE IS THE REPAIR ITS ROLL EARNED (E08+E28 C16, 04.10.2026): the GM reads it off
       its record of the roll the packet names (gm-bridge.mjs `repairOf`), and a roll settles one. So p2
       throws a Sabotage of Botan's the GM draws, on faces that earn a repair, before p1's chat is
       marked - this phase scans what p1 is shown of the sabotages, not of a roll thrown for the test -
       and the first freeze below names it; each later one throws its own just before (since fix r2-H1
       a settlement takes the newest roll of an action, so a roll thrown ahead of a newer one of its
       action settles nothing). Since fix r2-H2 a Sabotage's roll is drawn for the project it names
       (roll-draw.mjs `keepRecord`, `project`) and settles no other, so the projects are made first. */
    const projects = await gm.eval(`
        const P = await import("${repoUrl}/scripts/projects.mjs");
        const pub = await P.createProject({ name: "SEC public", target: 6, room: "Cafeteria", secret: false });
        const sec = await P.createProject({ name: "SEC secret", target: 6, room: "Gym", secret: true });
        return { pub: pub.id, sec: sec.id };`, { timeout: 60000 });
    const sabotageRollOf = async (client, actorId, targetId, faces = { hope: 9, fear: 5 }) =>
        (await drawnRoll(client, actorId, "sabotage", "eye", faces, { context: { targetProjectId: targetId } })).messageId;
    const firstSabotage = await sabotageRollOf(p2, ids.botan, projects.pub);
    const sabotageFromP2 = async (targetId, rollId = null) => {
        const named = rollId ?? await sabotageRollOf(p2, ids.botan, targetId);
        return p2.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
            const r = await P.sabotageProject("${targetId}", 3, { rollId: ${JSON.stringify(named)}, actorId: "${ids.botan}" });
            return r?.repair?.id ?? null;`, { timeout: 60000 });
    };
    await canary.chatMark({ who: ["p1"] });
    const sabotaged = { repair: await sabotageFromP2(projects.pub, firstSabotage) };
    const readPair = `const P = await import("${repoUrl}/scripts/projects.mjs");
        const ids = P.allProjects().map(p => p.id);
        return { secret: ids.includes("${projects.sec}"), repair: ids.includes("${sabotaged.repair}"), frozen: P.isFrozen("${projects.pub}") };`;
    const mismatched = await forge("project.unsabotage", { targetId: projects.pub, repairId: projects.sec, actorId: ids.aiko }, readPair);
    // Since E08+E28 C8 a player's unsabotage is refused before its pair is asked: a thaw is the GM's own Reroll's.
    const UNDO_IS_THE_GMS = /an undo is the GM's own Reroll's/;
    check("SECURITY: an unsabotage naming a project that is not the repair is refused as the GM's own undo, and deletes nothing and thaws nothing",
        Boolean(sabotaged.repair) && mismatched.after.secret && mismatched.after.repair && mismatched.after.frozen
        && mismatched.reasons.some(r => UNDO_IS_THE_GMS.test(r)), JSON.stringify({ sabotaged, mismatched }));
    /* WHO SABOTAGED IS THE GMS' (E05 fix r1-G1, 27.09.2026; the security review's S1-m1). p2's user
       id sat on the repair's projectMeta row, `saboteur`, which every browser holds, until the
       repair was finished; it is a field of the GMs' store now. p1 reads the repair's row, the GM
       its store; and p1 asking to take back p2's sabotage is refused for not being who asked,
       which the GM reads from the store. */
    const whoAsked = {
        p1: await p1.eval(`return (game.settings.get("${MOD}", "projectMeta") ?? {})["${sabotaged.repair}"] ?? null;`),
        gm: await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
            return S.projectSecretStore.get("${sabotaged.repair}")?.saboteur ?? null;`)
    };
    check("SECURITY: who sabotaged a project is not in projectMeta on p1 - the GMs' store holds p2's user id",
        Boolean(whoAsked.p1?.repairs) && !Object.hasOwn(whoAsked.p1, "saboteur") && whoAsked.gm === p2.userId, JSON.stringify(whoAsked));
    /* WHAT P1'S CHAT SAYS OF THE SABOTAGE (E06 C1; lib/canary.mjs `chatScan`): the cards p1 was
       sent since the phase began, read for Botan, p2 and the sabotage's titles. */
    const sabotageTitles = await gm.eval(`const C = await import("${repoUrl}/scripts/config.mjs");
        return [C.ACTIONS.sabotage?.label, game.i18n.localize("DRPG.Roll.concealIntent")].filter(t => typeof t === "string" && t.trim() && !t.startsWith("DRPG."));`);
    await canary.chatScan({ who: ["p1"], actorIds: [ids.botan], names: ["Botan Kage"], userIds: [p2.userId], titles: sabotageTitles });
    const notTheirs = await forge("project.unsabotage", { targetId: projects.pub, repairId: sabotaged.repair, actorId: ids.aiko }, readPair);
    check("SECURITY: p1 taking back p2's sabotage is refused as the GM's own undo, and nothing is thawed",
        notTheirs.unchanged && notTheirs.after.frozen && notTheirs.reasons.some(r => UNDO_IS_THE_GMS.test(r)), JSON.stringify(notTheirs));
    await clearFailures();
    await p2.eval(`game.socket.emit("${SOCKET}", { action: "project.unsabotage", userId: game.user.id, requestId: "noreceipt",
        targetId: "${projects.pub}", repairId: "${sabotaged.repair}", actorId: "${ids.botan}" }, ${toGms}); return true;`);
    await settle(1200);
    const noReceipt = { after: await gm.eval(readPair), reasons: await refusedFor("project.unsabotage") };
    check("SECURITY: the saboteur's own unsabotage with no Reroll behind it is refused as the GM's own undo",
        noReceipt.after.frozen && noReceipt.after.repair && noReceipt.reasons.some(r => UNDO_IS_THE_GMS.test(r)), JSON.stringify(noReceipt));
    /* A REWRITE PAYS FOR NOTHING (E08+E28 C8; audit S02-19). p2 rewrites the rolls of a roll of
       Botan's - Hope to Fear - which bought the same thaw until C8: it is refused all the same,
       and the primary puts the rolls back as they were thrown, on p2's browser as on its own. */
    await clearFailures();
    const rewroteOn = await rerollOn(p2, ids.botan, { fearAfter: true });
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestUndoSabotage("${projects.pub}", "${sabotaged.repair}", "${ids.botan}"); return true;`);
    await settle(1500);
    const fearOf = `const r = game.messages.get("${rewroteOn}")?.rolls?.[0]; return r?.dFear?.total ?? null;`;
    const afterRewrite = { after: await gm.eval(readPair), reasons: await refusedFor("project.unsabotage"),
        fear: { gm: await gm.eval(fearOf), p2: await p2.eval(fearOf) } };
    check("SECURITY: a rewrite of Botan's roll pays for no unsabotage, and its dice are put back on every browser",
        afterRewrite.after.frozen && afterRewrite.after.repair && afterRewrite.reasons.some(r => UNDO_IS_THE_GMS.test(r))
        && afterRewrite.fear.gm === 3 && afterRewrite.fear.p2 === 3, JSON.stringify(afterRewrite), { flow: "reroll" });
    await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        await P.undoSabotage("${projects.pub}", "${sabotaged.repair}"); return true;`, { timeout: 60000 });
    await settle(1500);
    const undone = await gm.eval(readPair);
    check("control: the GM's own undo of the same sabotage thaws the project and removes its repair",
        undone.frozen === false && undone.repair === false && undone.secret === true, JSON.stringify(undone));

    // 7b. project.progress onto a sabotaged project, and project.share of a public one.
    const frozenAgain = await sabotageFromP2(projects.pub);
    const readProgress = `const P = await import("${repoUrl}/scripts/projects.mjs");
        const c = P.allProjects().find(p => p.id === "${projects.pub}"); return { current: c?.current ?? null };`;
    const onFrozen = await forge("project.progress", { countdownId: projects.pub, amount: 2, actorId: ids.aiko }, readProgress);
    // `current` is read off the project row (`allProjects`), which is where the bar's
    // figure is: read off the wrong field, this check was null == null and measured
    // nothing - found by taking the frozen guard out and watching it still pass.
    // Refused since E08+E28 C16 (bridge-guards.mjs `guardProjectFrozen`), where it was answered "did not move".
    check("SECURITY: progress onto a sabotaged project is refused and does not move it",
        Boolean(frozenAgain) && typeof onFrozen.before.current === "number" && onFrozen.unchanged
        && onFrozen.reasons.some(r => /that project is frozen until its repair is finished/.test(r)), JSON.stringify(onFrozen));

    /* 7b+. WHAT A CONSOLE'S PROGRESS ADDS (E08+E28 C16, 04.10.2026; audit S10-08). A Work on a Project
       names its roll, and the GM adds what that roll earned on its record (gm-bridge.mjs `progressOf`),
       the character standing in the project's room when it has one (bridge-guards.mjs `guardProjectRoom`).
       p1 throws two Work on a Project rolls of Aiko's that the GM draws, on 9 and 5; the GM makes a
       public project in Aiko's room and one in a room nobody stands in; p1's console asks +12 on the
       first, naming one roll, and +1 on the second, naming the other. Read: each bar before and after,
       against the band of ACTIONS.project the roll's total reaches, and the GM's reasons. */
    const worked = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs"), C = await import("${repoUrl}/scripts/config.mjs");
        const here = M.locateActor(game.actors.get("${ids.aiko}"))?.room ?? null;
        const near = await P.createProject({ name: "SEC worked here", target: 12, room: here });
        const beside = await P.createProject({ name: "SEC worked here too", target: 12, room: here });
        const far = await P.createProject({ name: "SEC worked elsewhere", target: 12, room: "SEC nowhere" });
        return { here, near: near?.id ?? null, beside: beside?.id ?? null, far: far?.id ?? null, bands: C.ACTIONS.project.thresholds };`, { timeout: 60000 });
    // A Work's roll is drawn for the project it names (fix r2-H2), so each names the one its packet scores on.
    const workRollOf = countdownId => drawnRoll(p1, ids.aiko, "project", "eye", { hope: 9, fear: 5 }, { context: { projectId: countdownId } });
    const workRolls = [await workRollOf(worked.near)];
    const barOf = id => `const P = await import("${repoUrl}/scripts/projects.mjs");
        return { current: P.allProjects().find(p => p.id === "${id}")?.current ?? null };`;
    const earned = Math.max(0, ...worked.bands.filter(b => (workRolls[0].total ?? 0) >= b.min).map(b => b.progress));
    const plus12 = await forge("project.progress", { countdownId: worked.near, amount: 12, actorId: ids.aiko, rollId: workRolls[0].messageId }, barOf(worked.near));
    /* The bar moves after forge's 900 ms: the run first waits up to 1500 ms for the sender's bookmark of the roll
       (gm-bridge.mjs `handleProgress`, `rollOfSenderNaming`), and a roll thrown for the test is bookmarked by
       nobody - measured on A1's first run (04.10.2026): "0 -> 1" was logged after the check had read 0. */
    const settled = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const read = () => P.allProjects().find(p => p.id === "${worked.near}")?.current ?? null;
        for (let i = 0; i < 60 && read() === ${JSON.stringify(plus12.before.current)}; i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 500));
        return read();`, { timeout: 30000 });
    check("SECURITY: a console's +12 on a project adds what the roll it names earned on the GMs' record, and no more",
        Boolean(worked.here && worked.near && workRolls[0].messageId) && earned > 0
        && settled - plus12.before.current === earned && !plus12.reasons.length, JSON.stringify({ workRolls, worked, earned, plus12, settled }));
    // Thrown once the first has settled: a newer Work roll of Aiko's would have replaced it (fix r2-H1).
    workRolls.push(await workRollOf(worked.far));
    const farOff = await forge("project.progress", { countdownId: worked.far, amount: 1, actorId: ids.aiko, rollId: workRolls[1].messageId }, barOf(worked.far));
    check("SECURITY: a console's progress on a project in a room its character does not stand in is refused and moves nothing",
        Boolean(worked.far && workRolls[1].messageId) && farOff.unchanged && farOff.reasons.some(r => /the character is not in that room/.test(r))
        && farOff.told.some(t => t.what === "project.progress"), JSON.stringify(farOff));
    /* 7b++. A PROJECT'S PACKETS ARE HELD TO THEIR ROLL, THEIR PROJECT AND THEIR ROOM (E08+E28 fix r2-H2, 05.10.2026;
       review S2-4, S2-5, S2-6). The round-2 review's probes, from p1's console for Aiko: a Sabotage of a project in a
       room she does not stand in froze it and made its repair (bridge-guards.mjs `guardSabotageRoom` now); progress
       naming no roll added 2 three times from another room, 0 -> 6, and a Contribution nobody paid for was taken
       (`guardCallProgress`: a Hope Call, its amount, its room, its price paid once); and a Work's roll drawn for one
       project scored on another in the room (the record's `project`, `rollRefusal`). Each refused, told, and moving
       nothing. A Call's refusal waits for its payment (roll-draw.mjs `takeCallPayment`, 1500 ms), so it is read
       once its line is logged. The progress comes before the Sabotage: a Sabotage that got through froze "SEC worked
       elsewhere", and its progress was then refused as frozen - measured on this fix's first red run (05.10.2026),
       where it hid the review's 0 -> 6 at fix r2-H1's runtime. */
    // No Hope of Aiko's this GM saw p1 pay earlier in the scenario may stand for the Contribution below.
    await gm.eval(`(await import("${repoUrl}/scripts/roll-draw.mjs")).forgetPayments?.("${ids.aiko}"); return true;`);
    const callRoad = [];
    for (const fields of [{ countdownId: worked.far, amount: 2 }, { countdownId: worked.far, amount: 2 }, { countdownId: worked.far, amount: 2 },
        { countdownId: worked.near, amount: 1, call: "contribution" }]) {
        await clearFailures();
        await p1.eval(`globalThis.__refused.length = 0;
            game.socket.emit("${SOCKET}", { action: "project.progress", userId: game.user.id, requestId: "h2-call-road", actorId: "${ids.aiko}",
                ...${JSON.stringify(fields)} }, ${toGms}); return true;`);
        for (let i = 0; i < 40 && !(await refusedFor("project.progress")).length; i++) await settle(100);
        await settle(300);
        callRoad.push({ reasons: await refusedFor("project.progress"),
            told: (await p1.eval(`return globalThis.__refused.slice();`)).filter(t => t.what === "project.progress").length });
    }
    const callBars = { far: (await gm.eval(barOf(worked.far))).current, near: (await gm.eval(barOf(worked.near))).current };
    check("SECURITY: progress naming no roll - +2 three times from another room, and a Contribution nobody paid for - is refused, told, and moves no bar",
        callRoad.length === 4 && callRoad.every(r => r.told === 1) && callRoad.slice(0, 3).every(r => r.reasons.some(x => /the character is not in that room/.test(x)))
        && callRoad[3].reasons.some(x => /no payment of that character's stands for that Call/.test(x))
        && callBars.far === 0 && callBars.near === settled, JSON.stringify({ callRoad, callBars, settled }));
    const elsewhere = await forge("project.sabotage", { targetId: worked.far, difficulty: 3, actorId: ids.aiko, penalty: 0, relief: 0,
        rollId: await sabotageRollOf(p1, ids.aiko, worked.far) }, `const P = await import("${repoUrl}/scripts/projects.mjs");
        return { frozen: P.isFrozen("${worked.far}"), repairs: P.allProjects().filter(p => P.repairs(p.id) === "${worked.far}").length };`);
    check("SECURITY: a console's Sabotage of a project in a room its character does not stand in is refused, told, and freezes nothing",
        elsewhere.unchanged && elsewhere.after.frozen === false && elsewhere.after.repairs === 0
        && elsewhere.reasons.some(r => /the character is not in that room/.test(r)) && elsewhere.told.some(t => t.what === "project.sabotage"),
        JSON.stringify(elsewhere));
    workRolls.push(await workRollOf(worked.near));
    const beside = await forge("project.progress", { countdownId: worked.beside, amount: 1, actorId: ids.aiko, rollId: workRolls[2].messageId }, barOf(worked.beside));
    check("SECURITY: a console's progress naming a Work roll drawn for another project in the room is refused, told, and moves nothing",
        Boolean(worked.beside && workRolls[2].messageId) && beside.unchanged && beside.reasons.some(r => /that roll was not thrown for that action/.test(r))
        && beside.told.some(t => t.what === "project.progress"), JSON.stringify(beside));
    await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        for (const id of ${JSON.stringify([worked.near, worked.beside, worked.far].filter(Boolean))}) await P.deleteProject(id).catch(() => {});
        return true;`, { timeout: 60000 });
    const shared = await forge("project.share", { countdownId: projects.pub, targetUserId: p1.userId },
        `const P = await import("${repoUrl}/scripts/projects.mjs"); return { secret: P.isSecret("${projects.pub}") };`);
    check("SECURITY: sharing a public project is refused and leaves it public",
        shared.unchanged && shared.reasons.some(r => /not secret/.test(r)), JSON.stringify(shared));

    /* 7b'. A SECRET PROJECT'S SABOTAGE (E06 C10, 28.09.2026; audit S09-01, L20). Its repair was a
       public countdown named "Repair: <the project>", and its end was announced to the table. p2
       can see "SEC hidden work" and sabotages it; p1 cannot. p1's copy of Daggerheart's countdowns
       holds the repair under a name that is not the project's and keeps p1 out of it; the GM
       finishes the repair, and the cards that reach p1 since - documents and any words p1 holds -
       name no project, while p2, who can see it, is told. Then the chat scan for the name. */
    const SECRET_WORK = "SEC hidden work";
    const hiddenWork = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        return (await P.createProject({ name: "${SECRET_WORK}", target: 6, room: "Cafeteria", secret: true, viewers: ["${p2.userId}"] }))?.id ?? null;`,
    { timeout: 60000 });
    const hiddenRepair = await sabotageFromP2(hiddenWork);
    await settle(1000);
    const repairOnP1 = await p1.eval(`const c = game.settings.get("daggerheart", "Countdowns")?.countdowns?.["${hiddenRepair}"] ?? null;
        return c ? { name: c.name, p1: c.ownership?.[game.user.id] ?? null } : null;`);
    const countOn = c => c.eval(`return game.messages.size;`);
    const heldBefore = { p1: await countOn(p1), p2: await countOn(p2) };
    const thawed = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        await P.addProgress("${hiddenRepair}", 3); return !P.isFrozen("${hiddenWork}");`, { timeout: 60000 });
    await settle(1500);
    const endOn = (c, from) => c.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const fresh = game.messages.contents.slice(${from});
        const names = m => JSON.stringify(m.toObject()).includes("${SECRET_WORK}") || (S.secretHtml(m) ?? "").includes("${SECRET_WORK}");
        return { cards: fresh.length, veiled: fresh.filter(m => S.isVeiled(m)).length, named: fresh.filter(names).length };`);
    const repairEnd = { p1: await endOn(p1, heldBefore.p1), p2: await endOn(p2, heldBefore.p2) };
    check("SECURITY: a secret project's repair reaches p1 under no name of the project, sealed, and its end is told to p2 alone",
        Boolean(hiddenWork && hiddenRepair) && typeof repairOnP1?.name === "string" && !repairOnP1.name.includes(SECRET_WORK) && repairOnP1.p1 === 0
        && thawed && repairEnd.p1.veiled >= 1 && repairEnd.p1.named === 0 && repairEnd.p2.named >= 1,
        JSON.stringify({ hiddenWork, hiddenRepair, repairOnP1, thawed, repairEnd }));
    await canary.chatScan({ who: ["p1"], titles: [SECRET_WORK], phase: "projects: a secret project's sabotage" });

    /* 7b''. A PROJECT'S STATISTIC (E32+E07 C11d, 02.10.2026; the owner's rules of 28.09.2026). A
       project's roll - Work on it, or a Sabotage of it - takes the project's statistic, and only a
       project stored without one asks a GM, by its id, on a card that names it in the asker's
       thread (bridge-guards.mjs `guardTraitRuling`). p1 asks, through the honest request function,
       for "SEC secret" (not p1's to see), for a project that does not exist, and for a public
       project that demands Leg - each refused and told, no card up - and, the control, for a public
       one with no statistic: the harness's GM presses Hand and the project keeps it. Then Botan,
       stood alone in Storage beside a project there that demands Leg, sabotages it from p2's
       browser (its Project window answered with that project); his `rollTrait` notes the
       statistic and throws nothing, and nobody is asked. */
    phase("a project's statistic", { flow: "trait-ruling" });
    const statProjects = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        (await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures();
        globalThis.__traitRulings.length = 0;
        const make = async (name, trait, room) => (await P.createProject({ name, target: 6, room, trait }))?.id ?? null;
        return { given: await make("SEC statistic given", "leg", null), open: await make("SEC no statistic", null, null),
            storage: await make("SEC leg work", "leg", "Storage"), mark: game.messages.contents.length,
            room: (await import("${repoUrl}/scripts/movement.mjs")).roomOfActor(game.actors.get("${ids.aiko}")) };`, { timeout: 60000 });
    const statAsked = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const ask = async key => { const r = await B.requestTraitRuling({ actorId: "${ids.aiko}", kind: "project", key }); return [r?.ok ?? null, r?.ok ? r.value : r?.reason ?? null]; };
        return [await ask("${projects.sec}"), await ask("SECNOPROJECT0000"), await ask("${statProjects.given}"), await ask("${statProjects.open}")];`,
    { timeout: 120000 });
    await settle(600);
    const statAfter = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        return { cards: game.messages.contents.length - ${Number(statProjects.mark) || 0}, pressed: globalThis.__traitRulings.length,
            kept: P.allProjects().find(p => p.id === "${statProjects.open}")?.trait ?? null,
            logged: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "trait.ruling"'))
                .reduce((n, e) => n + (e.count ?? 1), 0) };`);
    check("SECURITY: a statistic ruling for a project p1 cannot see, one that does not exist, or one with a statistic is refused on the GM, told, and puts no card up; one with none is asked and kept",
        JSON.stringify(statAsked) === JSON.stringify([[false, "notThere"], [false, "notThere"], [false, "badRequest"], [true, "hand"]])
            && statAfter.cards === 1 && statAfter.pressed === 1 && statAfter.logged === 3 && statAfter.kept === "hand",
        JSON.stringify({ statProjects, statAsked, statAfter }), { flow: "trait-ruling" });
    /* A RULING IS A GM'S CARD'S (E29 fix r2-H2, 05.10.2026; the round-2 security review's B2). The GM read a statistic's pick
       (roll-draw.mjs `gmPickOf`) and a Dynamic action's difficulty (gm-bridge.mjs `dynamicRulingOf`) off any card carrying a
       `ruling`, the document's flag first, whoever wrote it: the review's console posted one and the GM threw Body for a
       clean-up, which does not list it, as the GM's pick (its probe 96 H, at 070b72b's runtime). Here p1's console posts a pick
       card for a project stored without a statistic, naming the highest of the four a project lists as Aiko's sheet holds
       them, and draws a Work on it claiming that one; then the GM settles a pick card of its own for the project naming
       another it lists, p1's console posts a second card, newer, and draws again. Then the GM posts a difficulty card for
       Aiko, and p1's console a newer one. Read on the GM: each Work's statistic thrown, the card that held it and its
       statistic flags, and the difficulty its reader finds. The cards and the project are deleted after. At a4a7f25's
       runtime (e29run/r2h2red/30.log) both Works were thrown on the claimed Hand, each held by a card of p1's - the second by
       the newer one, over the GM's - with nothing flagged, and the difficulty read was p1's 3. */
    phase("a pick or a difficulty only a GM's card makes", { flow: "trait-ruling" });
    const forgery = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const { ACTIONS, TRAITS } = await import("${repoUrl}/scripts/config.mjs");
        const a = game.actors.get("${ids.aiko}"), value = t => Number(a.system.traits?.[TRAITS[t]?.dh]?.value) || 0;
        const listed = ACTIONS.project.traits.filter(t => Object.hasOwn(TRAITS, t));
        const highest = listed.reduce((h, t) => (value(t) > value(h) ? t : h)), lowest = listed.reduce((l, t) => (value(t) < value(l) ? t : l));
        return { project: (await P.createProject({ name: "SEC r2-H2 no statistic", target: 6, room: null, trait: null }))?.id ?? null,
            highest, lowest, other: listed.find(t => t !== highest && t !== lowest) ?? null };`, { timeout: 60000 });
    const forgedRuling = ruling => p1.eval(`const m = await ChatMessage.create({ content: "<p>SEC r2-H2</p>",
            whisper: game.users.filter(u => u.isGM).map(u => u.id), flags: { "${MOD}": { ruling: ${JSON.stringify(ruling)} } } });
        return m?.id ?? null;`);
    const pickOf = trait => ({ type: "trait", actorId: ids.aiko, kind: "project", key: forgery.project, variant: null, trait });
    const workOn = async () => {
        const { messageId } = await drawnRoll(p1, ids.aiko, "project", forgery.highest, { hope: 9, fear: 4 }, { context: { projectId: forgery.project } });
        return gm.eval(`const r = (await import("${repoUrl}/scripts/roll-draw.mjs")).drawnRecordOf(game.messages.get(${JSON.stringify(messageId ?? "none")}));
            return r ? { thrown: r.scored?.trait ?? null, pick: r.legal?.pick ?? null, from: r.legal?.traitFrom ?? null,
                flags: (r.flags ?? []).filter(f => f.kind === "trait" || f.kind === "pick").map(f => [f.kind, f.expected, f.claimed]) } : null;`);
    };
    const forgedPick = await forgedRuling(pickOf(forgery.highest));
    const forgedAlone = await workOn();
    const gmPick = await gm.eval(`const { whisperToGms } = await import("${repoUrl}/scripts/utils.mjs");
        const { settleCall } = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const m = await whisperToGms("<p>SEC r2-H2 the GM's pick</p>");
        if (m) await settleCall(m, "SEC r2-H2", ${JSON.stringify(pickOf(forgery.other))});
        return m?.id ?? null;`);
    const forgedAfter = await forgedRuling(pickOf(forgery.highest));
    const forgedBeside = await workOn();
    const gmDifficulty = await gm.eval(`const m = await ChatMessage.create({ content: "<p>SEC r2-H2 the GM's difficulty</p>", whisper: [game.user.id],
            flags: { "${MOD}": { ruling: { type: "dynamic", actorId: "${ids.aiko}", tier: 1 } } } });
        return m?.id ?? null;`);
    const forgedDifficulty = await forgedRuling({ type: "dynamic", actorId: ids.aiko, tier: 3 });
    await settle(300);
    const difficulty = await gm.eval(`return (await import("${repoUrl}/scripts/gm-bridge.mjs")).dynamicRulingOf({ actorId: "${ids.aiko}", at: Date.now() })?.tier ?? null;`);
    await gm.eval(`for (const id of ${JSON.stringify([forgedPick, gmPick, forgedAfter, gmDifficulty, forgedDifficulty])}) await game.messages.get(id ?? "")?.delete();
        if (${JSON.stringify(forgery.project)}) await (await import("${repoUrl}/scripts/projects.mjs")).deleteProject(${JSON.stringify(forgery.project)});
        return true;`, { timeout: 60000 });
    check("SECURITY: a pick card or a difficulty card p1's console writes is no GM's ruling: its Work is thrown on the lowest a project lists and flagged, a GM's own pick beside a newer forged one holds, and the GM's difficulty stands",
        Boolean(forgery.project && forgery.other && forgedPick && gmPick && forgedAfter && gmDifficulty && forgedDifficulty) && forgery.highest !== forgery.lowest
            && JSON.stringify(forgedAlone) === JSON.stringify({ thrown: forgery.lowest, pick: null, from: "gm", flags: [["trait", forgery.lowest, forgery.highest], ["pick", "1", "0"]] })
            && JSON.stringify(forgedBeside) === JSON.stringify({ thrown: forgery.other, pick: gmPick, from: "gm", flags: [["trait", forgery.other, forgery.highest]] })
            && difficulty === 1,
        JSON.stringify({ forgery, forgedPick, gmPick, forgedAfter, forgedAlone, forgedBeside, forgedDifficulty, difficulty }), { flow: "trait-ruling" });
    const PLACE = `{ teleport: true, movementAction: "displace", animate: false }`;
    const stoodBotan = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const actor = game.actors.get("${ids.botan}"); const t = canvas.scene.tokens.find(x => x.actorId === actor.id);
        const was = { x: t.x, y: t.y };
        await t.update(M.positionIn("Storage", t), ${PLACE});
        await game.drpg.setActions(actor, game.drpg.actionsMax(actor));
        await new Promise(r => setTimeout(r, 400));
        return { was, room: M.roomOfActor(actor), others: M.othersInRoom(actor).map(a => a.name) };`, { timeout: 30000 });
    await settle(600);
    const sabotaged2 = await p2.eval(`const actor = game.actors.get("${ids.botan}");
        const rolled = [];
        actor.rollTrait = async key => { rolled.push(key); return null; };
        let err = null;
        globalThis.__notifications.length = 0;
        // p2 sits still since the crisis phase (__dialogAuto false): the Project window is answered as its callback answers.
        globalThis.__dialogAnswers.unshift(() => ({ id: "${statProjects.storage}" }));
        try { await game.drpg.performAction(actor, "sabotage", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        delete actor.rollTrait;
        return { rolled, err, dialogs: globalThis.__dialogLog.map(d => d.title).slice(-3),
            notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg).slice(-4) };`, { timeout: 60000 });
    const sabotageAfter = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const t = canvas.scene.tokens.find(x => x.actorId === "${ids.botan}");
        await t.update(${JSON.stringify(stoodBotan.was)}, ${PLACE});
        const pressed = globalThis.__traitRulings.length;
        for (const id of ${JSON.stringify([statProjects.given, statProjects.open, statProjects.storage].filter(Boolean))}) await P.deleteProject(id);
        return { pressed, frozen: P.isFrozen("${statProjects.storage}") };`, { timeout: 60000 });
    check("a Sabotage rolls the statistic of the project it targets (Leg), and nobody is asked",
        stoodBotan.room === "Storage" && !stoodBotan.others.length && !sabotaged2.err
            && JSON.stringify(sabotaged2.rolled) === JSON.stringify(["agility"]) && sabotageAfter.pressed === 1,
        JSON.stringify({ stoodBotan, sabotaged2, sabotageAfter }), { flow: "projects" });

    // 7c. observe.resolve with somebody else's key.
    phase("Observe keys", { flow: "search-observe" });
    const observed = await gm.eval(`
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1400, y: 400, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.chie}", sourceName: "Chie Mori", room: "Cafeteria", subject: "SEC cup" });
        const O = await import("${repoUrl}/scripts/observe.mjs");
        const r = await O.chooseObserveTarget({ actorId: "${ids.botan}", declaration: "general", userId: "${p2.userId}" });
        return { key: r?.key ?? null, ok: r?.ok ?? false, reason: r?.reason ?? null };`, { timeout: 60000 });
    /* observe.target for another player's character (E30 fix, 25.09.2026). The handler's
       ownsActor check was read by R1b alone: with it taken out, this scenario stayed
       green (E30's gate mutation run). Here p1 asks for a key to Botan's Observe; the
       GM's store of pending Observes must not grow, and the same request from Botan's
       own player must. Measured with the check taken out of handleObserveTarget on a
       scratch copy: this check failed, the control passed. */
    // Through the store (E04, 1.2.63): the declarations are the local GM store `observeStore`.
    const readKeys = `const { observeStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { pending: Object.keys(observeStore.entries()).length };`;
    const targeted = await forge("observe.target", { actorId: ids.botan, declaration: "general", request: "" }, readKeys);
    check("SECURITY: a forged observe.target for Botan mints no Observe key, and the GM refuses it for ownership and tells p1",
        targeted.unchanged && targeted.forOwnership && targeted.told.some(t => t.what === "observe.target"), JSON.stringify(targeted));
    const ownTarget = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const r = await B.requestObserveTarget({ actorId: "${ids.botan}", declaration: "general" });
        return { ok: r?.ok ?? null, key: Boolean(r?.key) };`, { timeout: 30000 });
    const keysAfter = await gm.eval(readKeys);
    check("control: the same observe.target from Botan's own player does mint a key",
        ownTarget.ok === true && ownTarget.key && keysAfter.pending === targeted.after.pending + 1,
        JSON.stringify({ ownTarget, before: targeted.after, after: keysAfter }));

    const readBullets = `return { botan: game.actors.get("${ids.botan}").items.filter(i => i.getFlag("${MOD}", "isTruthBullet")).length,
        botanStress: game.actors.get("${ids.botan}").system.resources.stress.value };`;
    /* Since E08+E28 C14 each resolve below names an Observe roll of its own character's that the GM
       drew (`drawnRoll`), so what is refused is the key, not a missing roll; the roll's own checks
       follow the forged undo. */
    const stolenRoll = await drawnRoll(p1, ids.aiko, "observe", "eye", { hope: 12, fear: 11 });
    const stolenKey = await forge("observe.resolve", { actorId: ids.aiko, key: observed.key, total: 0, rollId: stolenRoll.messageId }, readBullets);
    check("SECURITY: an Observe resolved with another character's key changes nothing and is refused",
        observed.ok && Boolean(stolenRoll.messageId) && stolenKey.unchanged && stolenKey.reasons.some(r => /another character/.test(r)),
        JSON.stringify({ observed, stolenRoll, stolenKey }));
    const ownRoll = await drawnRoll(p2, ids.botan, "observe", "eye", { hope: 12, fear: 11 });
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestObserveResolve({ actorId: "${ids.botan}", key: "${observed.key}", total: 30, isCritical: false, rollId: ${JSON.stringify(ownRoll.messageId)} }); return true;`);
    await settle(1500);
    const found = await gm.eval(readBullets);
    check("control: Botan's own player resolving Botan's key does find the trace",
        found.botan === stolenKey.after.botan + 1, JSON.stringify({ before: stolenKey.after, after: found, ownRoll }));
    const twiceRoll = await drawnRoll(p2, ids.botan, "observe", "eye", { hope: 12, fear: 11 });
    await clearFailures();
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestObserveResolve({ actorId: "${ids.botan}", key: "${observed.key}", total: 30, isCritical: false, rollId: ${JSON.stringify(twiceRoll.messageId)} }); return true;`);
    await settle(1200);
    const twice = { after: await gm.eval(readBullets), reasons: await refusedFor("observe.resolve") };
    check("SECURITY: the same Observe key resolves once",
        twice.after.botan === found.botan && twice.reasons.some(r => /already been resolved/.test(r)), JSON.stringify(twice));
    /* A FORGED OBSERVE UNDO (E08+E28 C8, 03.10.2026; audit S10-06). Botan's own player takes
       back the Observe that found the trace - a Reroll's packet, with no Reroll asked of the GM.
       Until C8 it went as far as the receipt; the GM's own Reroll takes an Observe back now, so
       it is refused first, and the bullet stays. */
    await clearFailures();
    await p2.eval(`game.socket.emit("${SOCKET}", { action: "observe.resolve", userId: game.user.id, requestId: "forged-undo",
        actorId: "${ids.botan}", key: "${observed.key}", total: 0, isCritical: false, undo: true }, ${toGms}); return true;`);
    await settle(1200);
    const forgedUndo = { after: await gm.eval(readBullets), reasons: await refusedFor("observe.resolve") };
    check("SECURITY: a forged Observe undo is refused as the GM's own undo, and the bullet it found stays",
        forgedUndo.after.botan === found.botan && forgedUndo.reasons.some(r => /an undo is the GM's own Reroll's/.test(r)),
        JSON.stringify(forgedUndo));

    /*
     * A CONSOLE'S TOTALS (E08+E28 C14, 04.10.2026; audit S10-06). The GM scored an Observe, an
     * Analyze and a search for a hidden stash on the `total` and `isCritical` the packet carried,
     * so a console could send 30 and a critical and be answered with a find, a bullet's real type
     * or somebody's stash. Each is scored now on the GMs' record of the roll the packet names
     * (bridge-guards.mjs `rollRefusal`). For each, a packet saying 30 and a critical from the
     * player's own browser, first naming no roll - refused, nothing changes - then naming a roll of
     * that character's for that action the GM drew on 2 and 1: no refusal, the GM's log says the
     * packet's numbers were not the record's, and the result is the record's miss. Red at C13's
     * runtime: the first packet finds, analyses or opens.
     */
    const sendAs = (client, action, fields) => client.eval(`game.socket.emit("${SOCKET}", { action: "${action}", userId: game.user.id,
        requestId: "console-${action}-" + Date.now(), ...${JSON.stringify(fields)} }, ${toGms}); return true;`);
    const recordSaid = () => gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => String(e.message).includes("the GMs' record of its roll says")).map(e => e.message);`);
    const consoleObserve = await gm.eval(`
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1400, y: 400, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.chie}", sourceName: "Chie Mori", room: "Cafeteria", subject: "SEC cup again" });
        const O = await import("${repoUrl}/scripts/observe.mjs");
        const r = await O.chooseObserveTarget({ actorId: "${ids.botan}", declaration: "general", userId: "${p2.userId}" });
        return { key: r?.key ?? null, ok: r?.ok ?? false };`, { timeout: 60000 });
    await clearFailures();
    await sendAs(p2, "observe.resolve", { actorId: ids.botan, key: consoleObserve.key, total: 30, isCritical: true });
    await settle(1200);
    const observeNoRoll = { after: await gm.eval(readBullets), reasons: await refusedFor("observe.resolve") };
    const observeRoll = await drawnRoll(p2, ids.botan, "observe", "eye", { hope: 2, fear: 1 });
    await clearFailures();
    await sendAs(p2, "observe.resolve", { actorId: ids.botan, key: consoleObserve.key, total: 30, isCritical: true, rollId: observeRoll.messageId });
    await settle(1500);
    const observeOnRecord = { after: await gm.eval(readBullets), reasons: await refusedFor("observe.resolve"), said: await recordSaid() };
    check("SECURITY: a console's Observe saying 30 and a critical is refused without its roll, and scored on the GMs' record of the roll it names - a miss",
        consoleObserve.ok && observeNoRoll.after.botan === found.botan && observeNoRoll.reasons.some(r => /no roll the GM drew is named/.test(r))
            && Boolean(observeRoll.messageId) && observeOnRecord.after.botan === found.botan && !observeOnRecord.reasons.length
            && observeOnRecord.said.length > 0,
        JSON.stringify({ consoleObserve, observeNoRoll, observeRoll, observeOnRecord }));

    phase("a console's Analyze", { flow: "analyze" });
    const consoleBullet = await gm.eval(`const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const C = await import("${repoUrl}/scripts/config.mjs");
        const b = await B.createTruthBullet(game.actors.get("${ids.aiko}"), { name: "SEC a console's Analyze", realType: "neutral", visibility: "obvious" });
        return { id: b?.id ?? null, dc: C.analyzeDc("obvious", "neutral") };`, { timeout: 30000 });
    await settle(600);
    const bulletState = `const i = game.actors.get("${ids.aiko}").items.get("${consoleBullet.id}");
        return { analyzed: i?.getFlag("${MOD}", "analyzed") ?? false, locked: i?.getFlag("${MOD}", "lockedChapter") ?? null,
            chapter: (await import("${repoUrl}/scripts/clock.mjs")).getClock().chapter };`;
    await clearFailures();
    await sendAs(p1, "analyze.resolve", { actorId: ids.aiko, itemId: consoleBullet.id, total: 30, isCritical: true });
    await settle(1200);
    const analyzeNoRoll = { state: await gm.eval(bulletState), reasons: await refusedFor("analyze.resolve") };
    const analyzeRoll = await drawnRoll(p1, ids.aiko, "analyze", "head", { hope: 2, fear: 1 });
    await clearFailures();
    await sendAs(p1, "analyze.resolve", { actorId: ids.aiko, itemId: consoleBullet.id, total: 30, isCritical: true, rollId: analyzeRoll.messageId });
    await settle(1500);
    const analyzeOnRecord = { state: await gm.eval(bulletState), reasons: await refusedFor("analyze.resolve"), said: await recordSaid() };
    await gm.eval(`const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const i = game.actors.get("${ids.aiko}").items.get("${consoleBullet.id}");
        if (i) { const uuid = i.uuid; await i.delete(); await B.dropSecret?.(uuid); }
        return true;`, { timeout: 30000 });
    check("SECURITY: a console's Analyze saying 30 and a critical is refused without its roll, and scored on the GMs' record of the roll it names - locked, not analysed",
        Boolean(consoleBullet.id) && !analyzeNoRoll.state.analyzed && analyzeNoRoll.state.locked === null
            && analyzeNoRoll.reasons.some(r => /no roll the GM drew is named/.test(r))
            && Boolean(analyzeRoll.messageId) && analyzeRoll.total < consoleBullet.dc
            && !analyzeOnRecord.state.analyzed && analyzeOnRecord.state.locked === analyzeOnRecord.state.chapter
            && !analyzeOnRecord.reasons.length && analyzeOnRecord.said.length > 0,
        JSON.stringify({ consoleBullet, analyzeNoRoll, analyzeRoll, analyzeOnRecord }), { flow: "analyze" });

    phase("a console's search for a hidden stash", { flow: "give-take-stash" });
    const consoleStash = await gm.eval(`
        const V = await import("${repoUrl}/scripts/vault.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        const room = M.roomOfActor(aiko);
        const region = room ? V.regionsByName().get(room) : null;
        if (!region) return { room, err: "no region" };
        const keys = [V.VAULT_FLAGS.stashes, V.VAULT_FLAGS.hinders, V.VAULT_FLAGS.favours];
        globalThis.__c14Stash = { room, keys, before: keys.map(k => foundry.utils.deepClone(region.getFlag("${MOD}", k))),
            found: foundry.utils.deepClone(aiko.getFlag("${MOD}", V.VAULT_FLAGS.found) ?? null) };
        await region.update({ ["flags.${MOD}." + V.VAULT_FLAGS.stashes]: [{ actorId: "${ids.daichi}", concealed: true }],
            ["flags.${MOD}." + V.VAULT_FLAGS.hinders]: [], ["flags.${MOD}." + V.VAULT_FLAGS.favours]: [] });
        return { room, threshold: (await import("${repoUrl}/scripts/config.mjs")).ACTIONS.analyze?.stashThreshold ?? 16 };`, { timeout: 30000 });
    const stashFound = `const V = await import("${repoUrl}/scripts/vault.mjs");
        return V.hasFoundStash(game.actors.get("${ids.aiko}"), ${JSON.stringify(consoleStash.room ?? "")}, "${ids.daichi}");`;
    await clearFailures();
    await sendAs(p1, "vault.findStash", { actorId: ids.aiko, total: 30, isCritical: true });
    await settle(1200);
    const stashNoRoll = { found: await gm.eval(stashFound), reasons: await refusedFor("vault.findStash") };
    const stashRoll = await drawnRoll(p1, ids.aiko, "analyze", "head", { hope: 2, fear: 1 });
    await clearFailures();
    await sendAs(p1, "vault.findStash", { actorId: ids.aiko, total: 30, isCritical: true, rollId: stashRoll.messageId });
    await settle(1500);
    const stashOnRecord = { found: await gm.eval(stashFound), reasons: await refusedFor("vault.findStash"), said: await recordSaid() };
    await gm.eval(`const V = await import("${repoUrl}/scripts/vault.mjs");
        const { forcedDeletion } = await import("${repoUrl}/scripts/utils.mjs");
        const { room, keys, before, found } = globalThis.__c14Stash ?? {};
        delete globalThis.__c14Stash;
        const region = room ? V.regionsByName().get(room) : null;
        if (region) await region.update(Object.fromEntries(keys.map((k, i) => ["flags.${MOD}." + k, before[i] === undefined ? forcedDeletion() : before[i]])));
        const aiko = game.actors.get("${ids.aiko}");
        if (found === null) await aiko.unsetFlag("${MOD}", V.VAULT_FLAGS.found);
        else await aiko.setFlag("${MOD}", V.VAULT_FLAGS.found, found);
        return true;`, { timeout: 30000 });
    check("SECURITY: a console's search for a hidden stash saying 30 and a critical is refused without its roll, and scored on the GMs' record of the roll it names - not found",
        !consoleStash.err && stashNoRoll.found === false && stashNoRoll.reasons.some(r => /no roll the GM drew is named/.test(r))
            && Boolean(stashRoll.messageId) && stashRoll.total < consoleStash.threshold
            && stashOnRecord.found === false && !stashOnRecord.reasons.length && stashOnRecord.said.length > 0,
        JSON.stringify({ consoleStash, stashNoRoll, stashRoll, stashOnRecord }), { flow: "give-take-stash" });

    /*
     * A CONSOLE'S STEAL (E08+E28 C15, 04.10.2026; audit S10-06). A Palm was scored on the two
     * totals its packet carried, and a critical hand lets the thief pick the item. Both are the
     * GMs' record of the rolls the packet names now (gm-bridge.mjs `palmRolls`). Botan holds an
     * item; from p1's browser a Steal of it by Aiko saying 30 and a critical for both rolls, first
     * naming no roll - refused, Botan keeps it - then naming a hand's roll and an unseen roll of
     * Aiko's the GM drew on 2 and 1: no refusal, the GM's log says the packet's numbers were not
     * the record's, and Botan keeps it - the record's miss. Red at C14's runtime: the first takes it.
     */
    phase("a console's Steal", { flow: "give-take-stash" });
    const consoleSteal = await gm.eval(`
        const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");
        const item = await INV.grantItem(game.actors.get("${ids.botan}"), { name: "SEC pocket", category: "usable", tier: 1, override: true, quiet: true });
        return { itemId: item?.id ?? null, rooms: ["${ids.aiko}", "${ids.botan}"].map(id => M.locateActor(game.actors.get(id))?.room ?? null),
            bar: (await import("${repoUrl}/scripts/config.mjs")).ACTIONS.palm.threshold };`, { timeout: 30000 });
    await settle(600);
    const pocket = `return game.actors.get("${ids.botan}").items.has(${JSON.stringify(consoleSteal.itemId ?? "")});`;
    const stealFields = { thiefId: ids.aiko, victimId: ids.botan, itemId: consoleSteal.itemId, total: 30, isCritical: true, unseenTotal: 30, unseenCritical: true };
    await clearFailures();
    await sendAs(p1, "action.steal", stealFields);
    await settle(1200);
    const stealNoRoll = { kept: await gm.eval(pocket), reasons: await refusedFor("action.steal") };
    const handRoll = await drawnRoll(p1, ids.aiko, "steal", "hand", { hope: 2, fear: 1 });
    const unseenRoll = await drawnRoll(p1, ids.aiko, "palm", "shadow", { hope: 2, fear: 1 });
    await clearFailures();
    await sendAs(p1, "action.steal", { ...stealFields, rollId: handRoll.messageId, unseenRollId: unseenRoll.messageId });
    await settle(1500);
    const stealOnRecord = { kept: await gm.eval(pocket), reasons: await refusedFor("action.steal"), said: await recordSaid() };
    await gm.eval(`for (const id of ["${ids.botan}", "${ids.aiko}"]) for (const i of game.actors.get(id).items.filter(i => i.name === "SEC pocket")) await i.delete();
        return true;`, { timeout: 30000 });
    check("SECURITY: a console's Steal saying 30 and a critical is refused without its rolls, and scored on the GMs' record of the two it names - a miss",
        Boolean(consoleSteal.itemId) && Boolean(consoleSteal.rooms[0]) && consoleSteal.rooms[0] === consoleSteal.rooms[1]
            && stealNoRoll.kept === true && stealNoRoll.reasons.some(r => /no roll the GM drew is named/.test(r))
            && Boolean(handRoll.messageId) && Boolean(unseenRoll.messageId) && handRoll.total < consoleSteal.bar
            && stealOnRecord.kept === true && !stealOnRecord.reasons.length && stealOnRecord.said.length > 0,
        JSON.stringify({ consoleSteal, stealNoRoll, handRoll, unseenRoll, stealOnRecord }), { flow: "give-take-stash" });

    // 7d. despair.adjust from a player, with no Reroll behind it and with a rewrite of a roll (a receipt until E08+E28 C8).
    phase("Despair corrections", { flow: "despair" });
    const readPool = `return { pool: game.drpg.getDespair(game.user.id) };`;
    const noReroll = await forge("despair.adjust", { targetUserId: gm.userId, delta: -1, actorId: ids.aiko }, readPool);
    check("SECURITY: a player's Despair correction with no Reroll moves no pool",
        noReroll.unchanged && noReroll.reasons.some(r => /an undo is the GM's own Reroll's/.test(r)), JSON.stringify(noReroll));
    await rerollOn(p1, ids.aiko, { fearBefore: false, fearAfter: true });
    const paidPoint = await forge("despair.adjust", { targetUserId: gm.userId, delta: 1, actorId: ids.aiko }, readPool);
    check("SECURITY: a player's Despair correction after a rewrite of Aiko's roll into Despair moves no pool either",
        paidPoint.unchanged && paidPoint.reasons.some(r => /an undo is the GM's own Reroll's/.test(r)), JSON.stringify(paidPoint));

    // 7e. token.sendBack to somewhere the token never stood.
    phase("a send-back", { flow: "crossing-fee-refund" });
    const readToken = `const t = canvas.scene.tokens.get("TOKAIKO000000000"); return { x: t.x, y: t.y, elevation: t.elevation ?? 0 };`;
    const sceneId = await gm.eval(`return canvas.scene.id;`);
    const teleport = await forge("token.sendBack", { sceneId, tokenId: "TOKAIKO000000000",
        position: { x: 2500, y: 1500, elevation: 50, level: "bogus" } }, readToken);
    check("SECURITY: a send-back to a place the token never stood moves nothing",
        teleport.unchanged && teleport.reasons.some(r => /did not stand there/.test(r)), JSON.stringify(teleport));
    const start = teleport.after;
    await p1.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: ${start.x + 100}, y: ${start.y} }); return true;`);
    await settle(800);
    await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestSendBack(canvas.scene.id, "TOKAIKO000000000", { x: ${start.x}, y: ${start.y} }); return true;`);
    await settle(1500);
    const back = await gm.eval(readToken);
    check("control: a send-back to where the token stood a moment ago puts it there",
        back.x === start.x && back.y === start.y, JSON.stringify({ start, back }));

    // 7f. remnant.place: who left it, where, and what it points at, rebuilt on the GM. A discarded
    //     item's trace: a Search's names its roll since E08+E28 C15, and is measured below.
    phase("a player's traces", { flow: "trace-remnant" });
    await p1.eval(`game.socket.emit("${SOCKET}", { action: "remnant.place", userId: game.user.id, requestId: "forge-trace",
        data: { sourceActor: "${ids.aiko}", sourceName: "Botan Kage", room: "Storage", pointsAt: "${ids.chie}",
            type: "tamper", visibility: "evident", x: 2300, y: 1300, sceneId: canvas.scene.id, reinforced: true,
            tiedToCrime: false, faint: true, action: "discard", note: "planted", subject: "SEC knife" } }, ${toGms}); return true;`);
    await settle(1500);
    const planted = await gm.eval(`
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        const hit = canvas.scene.tokens.contents.map(t => R.remnantData(t)).filter(Boolean).find(d => d.subject === "SEC knife");
        return hit ? { sourceName: hit.sourceName, room: hit.room, pointsAt: hit.pointsAt ?? null, type: hit.type,
            reinforced: hit.reinforced } : null;`);
    check("SECURITY: a player's trace is written with their own name, their own room, pointing at nobody, as Preparation",
        planted && planted.sourceName === "Aiko Hoshino" && planted.room === "Cafeteria" && planted.pointsAt === null
        && planted.type === "prep" && planted.reinforced === false, JSON.stringify(planted));
    const badBand = await forge("remnant.place", { data: { sourceActor: ids.aiko, visibility: "x", action: "discard", subject: "SEC bad band" } },
        `const R = await import("${repoUrl}/scripts/remnants.mjs");
        return { n: canvas.scene.tokens.contents.map(t => R.remnantData(t)).filter(d => d?.subject === "SEC bad band").length };`);
    check("SECURITY: a trace with a visibility that does not exist is refused",
        badBand.after.n === 0 && badBand.reasons.some(r => /not a visibility/.test(r)), JSON.stringify(badBand));

    /*
     * A TRACE'S BAND IS THE GM'S (E08+E28 C15, 04.10.2026; audit S10-06). A Search's trace was
     * placed at the visibility its packet named, so a console could leave every trace of its
     * Searches hidden. It names its roll now and is placed at the band the GMs' record of that
     * roll earns (gm-bridge.mjs `traceBandOf`). From p1's browser, a Search's trace asking
     * "hidden": first naming no roll - refused, nothing placed - then naming a Search roll of
     * Aiko's the GM drew on 12 and 11 (18 or more: "evident" in the Search's table). Read on the
     * GM: the visibility of each trace placed, the refusals and the GM's log of the packet's band.
     * Red at C14's runtime: both are placed hidden.
     */
    const bandOf = subject => `const R = await import("${repoUrl}/scripts/remnants.mjs");
        return canvas.scene.tokens.contents.map(t => R.remnantData(t)).filter(d => d?.subject === "${subject}").map(d => d.visibility);`;
    const hiddenTrace = subject => ({ data: { sourceActor: ids.aiko, visibility: "hidden", action: "search", type: "prep", subject } });
    await clearFailures();
    await sendAs(p1, "remnant.place", hiddenTrace("SEC band unnamed"));
    await settle(1200);
    const bandNoRoll = { placed: await gm.eval(bandOf("SEC band unnamed")), reasons: await refusedFor("remnant.place") };
    const bandRoll = await drawnRoll(p1, ids.aiko, "search", "eye", { hope: 12, fear: 11 });
    await clearFailures();
    await sendAs(p1, "remnant.place", { ...hiddenTrace("SEC band named"), rollId: bandRoll.messageId });
    await settle(1500);
    const bandOnRecord = { placed: await gm.eval(bandOf("SEC band named")), reasons: await refusedFor("remnant.place"),
        said: await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
            .filter(e => String(e.message).includes("said data.visibility hidden")).length;`) };
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        for (const t of canvas.scene.tokens.contents.filter(t => /^SEC band /.test(R.remnantData(t)?.subject ?? ""))) await t.delete();
        return true;`, { timeout: 30000 });
    check("SECURITY: a console's Search trace asking hidden is refused without its roll, and placed at the band the GMs' record of the roll it names earns",
        bandNoRoll.placed.length === 0 && bandNoRoll.reasons.some(r => /no roll the GM drew is named/.test(r))
            && Boolean(bandRoll.messageId) && bandRoll.total >= 18 && JSON.stringify(bandOnRecord.placed) === '["evident"]'
            && !bandOnRecord.reasons.length && bandOnRecord.said > 0,
        JSON.stringify({ bandNoRoll, bandRoll, bandOnRecord }), { flow: "trace-remnant" });

    /*
     * 7j. remnant.edit: until E08+E28 C8 a Reroll receipt paid for one re-rating of one
     * fresh trace of the rerolling player's own character that no GM had written on (the
     * E03 review; verified by hand on 24.09.2026 with `removalRefusal` taken out). Since C8
     * the GM's own Reroll re-rates a trace on its own client, so a player's edit is refused
     * whatever trace it names and whatever rewrite of a roll is behind it - a trace a GM has
     * written on, one two hours old, and the player's own fresh one alike - and the control
     * is the GM's own re-rating.
     */
    const traceOf = subject => `const R = await import("${repoUrl}/scripts/remnants.mjs");
        const t = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "${subject}");
        return t ? { id: t.id, visibility: R.remnantData(t).visibility } : null;`;
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1500, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.aiko}", sourceName: "Aiko Hoshino", room: "Cafeteria", subject: "SEC corrected" });
        await R.placeRemnant({ x: 1550, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.aiko}", sourceName: "Aiko Hoshino", room: "Cafeteria", subject: "SEC rerolled" });
        await R.placeRemnant({ x: 1500, y: 500, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.aiko}", sourceName: "Aiko Hoshino", room: "Cafeteria", subject: "SEC stale" });
        const stale = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "SEC stale");
        await R.setRemnantSecret(stale, { placedAt: Date.now() - 2 * 3600_000 });
        const t = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "SEC corrected");
        await R.markRemnantEdited(t); return true;`, { timeout: 60000 });
    await settle(600);
    const corrected = await gm.eval(traceOf("SEC corrected"));
    const rerolled = await gm.eval(traceOf("SEC rerolled"));
    const staleBefore = await gm.eval(traceOf("SEC stale"));
    await clearFailures();
    await rerollOn(p1, ids.aiko);
    await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        for (const id of ${JSON.stringify([corrected?.id, staleBefore?.id, rerolled?.id])}) B.requestRemnantEdit(canvas.scene.id, id, { visibility: "hidden" });
        return true;`);
    await settle(1500);
    const edits = { corrected: await gm.eval(traceOf("SEC corrected")), stale: await gm.eval(traceOf("SEC stale")),
        rerolled: await gm.eval(traceOf("SEC rerolled")),
        // Three refusals with one text are one row of the session log with a count of 3
        // (utils.mjs `record`), so they are counted, not listed: `refusedFor` read 1 here.
        undos: await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
            .filter(e => e.message.includes('Refused a "remnant.edit"') && e.message.includes("an undo is the GM's own Reroll's"))
            .reduce((n, e) => n + (e.count ?? 1), 0);`) };
    check("SECURITY: a player's re-rating is refused as the GM's own undo - of a trace a GM wrote on, of one two hours old, and of their own fresh one",
        Boolean(corrected && staleBefore && rerolled) && edits.corrected?.visibility === corrected.visibility
        && edits.stale?.visibility === staleBefore.visibility && edits.rerolled?.visibility === rerolled.visibility
        && edits.undos === 3, JSON.stringify({ corrected, staleBefore, rerolled, edits }));
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.retuneRemnant(canvas.scene.id, "${rerolled?.id}", { visibility: "hidden" }); return true;`, { timeout: 30000 });
    await settle(600);
    const rerolledAfter = await gm.eval(traceOf("SEC rerolled"));
    check("control: the GM's own re-rating of the player's fresh trace lands",
        Boolean(rerolled) && rerolled.visibility !== "hidden" && rerolledAfter?.visibility === "hidden", JSON.stringify({ rerolled, rerolledAfter }));

    /*
     * 7j'. What a player is told when an edit is refused (E31 review): one reason for the
     * player's own trace and for another character's. Chie's player, p3, edits one trace of
     * Chie's and one of Botan's. Both checks were red on the tree before the E31 fix; the
     * second, that neither refusal came back before the receipt's retry, went with the
     * receipts in E08+E28 C8 - nothing is retried now, and the reason is `undoIsTheGms`.
     */
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1650, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.chie}", sourceName: "Chie Mori", room: "Cafeteria", subject: "SEC own, no receipt" });
        await R.placeRemnant({ x: 1650, y: 500, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.botan}", sourceName: "Botan Kage", room: "Cafeteria", subject: "SEC other, no receipt" });
        return true;`, { timeout: 60000 });
    await settle(600);
    const ownTrace = await gm.eval(traceOf("SEC own, no receipt"));
    const otherTrace = await gm.eval(traceOf("SEC other, no receipt"));
    const toldEdits = await p3.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const out = {};
        for (const [k, id] of [["own", "${ownTrace?.id}"], ["other", "${otherTrace?.id}"]]) {
            const r = await B.requestRemnantEdit(canvas.scene.id, id, { visibility: "hidden" });
            out[k] = { ok: r.ok, refused: r.refused ?? false, reason: r.reason ?? null };
        }
        return out;`, { timeout: 60000 });
    const editsAfter = { own: await gm.eval(traceOf("SEC own, no receipt")), other: await gm.eval(traceOf("SEC other, no receipt")) };
    check("SECURITY: an edit with no Reroll behind it is told the same reason for the player's own trace and for another character's",
        Boolean(ownTrace && otherTrace) && toldEdits.own?.refused === true && toldEdits.other?.refused === true
        && toldEdits.own.reason === "undoIsTheGms" && toldEdits.other.reason === "undoIsTheGms"
        && editsAfter.own?.visibility === ownTrace.visibility && editsAfter.other?.visibility === otherTrace.visibility,
        JSON.stringify({ toldEdits, ownTrace, otherTrace, editsAfter }));

    /*
     * 7k. remnant.tieForItem outside a fight (audit S10-11). Holding the object is
     * not enough: the tie is a verdict on evidence, and only a participant of the
     * running incident swings a weapon. No incident runs here, so Aiko's player,
     * holding the object, is refused and the trace stays untied. There is no
     * control beside it - setting up a live incident is 10-murder's work - so it
     * was verified by hand on 24.09.2026: with the incident condition taken out of
     * `handleTieTrace`, this check FAILED (the trace was tied). The condition has
     * since moved, unchanged, into `guardTieTraceHolder`, which the handler asks.
     */
    const tie = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1600, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.aiko}", sourceName: "Aiko Hoshino", room: "Cafeteria", subject: "SEC weapon trace",
            itemIdentity: "SECWEAPON0000001" });
        await game.actors.get("${ids.aiko}").createEmbeddedDocuments("Item", [{ name: "SEC weapon", type: "loot",
            flags: { "${MOD}": { drpgItemId: "SECWEAPON0000001" } } }]);
        const M = await import("${repoUrl}/scripts/murder.mjs");
        return { stage: M.murderState()?.stage ?? null };`, { timeout: 60000 });
    const readTie = `const R = await import("${repoUrl}/scripts/remnants.mjs");
        const t = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "SEC weapon trace");
        return { found: Boolean(t), tied: Boolean(t && R.remnantData(t).tiedToCrime) };`;
    const tiedOutside = await forge("remnant.tieForItem", { identity: "SECWEAPON0000001" }, readTie);
    check("SECURITY: a trace is not tied to the crime by its holder while no fight is running",
        tie.stage !== "incident" && tiedOutside.after.found && !tiedOutside.after.tied
        && tiedOutside.reasons.some(r => /running incident/.test(r)), JSON.stringify({ tie, tiedOutside }));

    /*
     * 7l. a trap relay naming a room the character is not in (audit S08-08). The
     * relay named its room, and the trap there went off - a trap is stamped as fired
     * before its card is sent, so a loop of these disarmed every trap on the map.
     * Two traps are armed, one in Storage (Aiko is not there) and one in the
     * Cafeteria (she is); only the second may fire. Verified by hand on 24.09.2026:
     * with the `standsIn` call taken out of traps.mjs, the first check FAILED.
     */
    phase("traps", { flow: "trap-fire" });
    const traps = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const away = await P.createProject({ name: "SEC trap away", target: 4, room: "Storage", secret: true });
        const here = await P.createProject({ name: "SEC trap here", target: 4, room: "Cafeteria", secret: true });
        for (const id of [away.id, here.id]) {
            await P.setProjectMeta(id, { indirectMurder: true, killerId: "${ids.botan}",
                trigger: { kind: "enters", armed: true, firedAt: null } });
        }
        return { away: away.id, here: here.id };`, { timeout: 60000 });
    await settle(600);
    // The trigger is the GMs' store's since E05 (C1; audit S09-05): `setProjectMeta` above routes it there.
    const readTraps = `const P = await import("${repoUrl}/scripts/projects.mjs");
        return { away: P.secretsOf("${traps.away}").trigger?.firedAt ?? null, here: P.secretsOf("${traps.here}").trigger?.firedAt ?? null };`;
    const relayTo = room => p1.eval(`game.socket.emit("${SOCKET}", { action: "trap.event", kind: "crossing",
        actorId: "${ids.aiko}", to: "${room}" }, ${toGms}); return true;`);
    await relayTo("Storage");
    await settle(1500);
    const trapAway = await gm.eval(readTraps);
    check("SECURITY: a crossing into a room the character is not in sets off no trap there",
        trapAway.away === null, JSON.stringify(trapAway));
    await relayTo("Cafeteria");
    await settle(1500);
    const trapHere = await gm.eval(readTraps);
    check("control: a crossing into the room the character stands in sets off the trap there",
        trapHere.here !== null && trapHere.away === null, JSON.stringify(trapHere));
    /* 7l2. The alert that trap sent the GMs names it in its words alone (E05's fix round, S1-m2,
       27.09.2026). The card is whispered to the GMs, and its flags are on every browser: its
       popup's title said "SEC trap here - something set it off" on p2's copy. The GM finds the
       card by its words; p2's copy of it - the whole document - holds no name of the trap.
       Red on the fix's parent: p2's popupTitle named it. */
    const alertId = await gm.eval(`const { wordsOf, cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
        for (const m of game.messages.contents.filter(m => m.getFlag("${MOD}", "secret")).reverse()) {
            if (!(await wordsOf(m) ?? "").includes("SEC trap here")) continue;
            const flag = cardFlag ?? ((doc, key) => doc.getFlag("${MOD}", key));
            return flag(m, "callCard") && flag(m, "gmPopup") ? m.id : null;
        }
        return null;`);
    const alertOnP2 = await p2.eval(`const m = game.messages.get(${JSON.stringify(alertId)});
        return m ? { held: true, named: JSON.stringify(m.toObject()).includes("SEC trap here"), title: m.getFlag("${MOD}", "popupTitle") ?? null,
            flags: Object.keys(m.toObject().flags?.["${MOD}"] ?? {}).sort() } : { held: false };`);
    check("SECURITY: a trap's alert card names the trap in the GMs' words, and nowhere in p2's copy of the card",
        Boolean(alertId) && alertOnP2.held && !alertOnP2.named, JSON.stringify({ alertId, alertOnP2 }));
    /* E06 C7a: nor does p2's copy say what the card is - a ruling to make, its sound, its
       popup: the GM found those in the words' meta above, and the document keeps two flags. */
    check("SECURITY: p2's copy of the trap's alert holds no flag but secret and drpgMessage",
        Boolean(alertId) && JSON.stringify(alertOnP2.flags) === JSON.stringify(["drpgMessage", "secret"]), JSON.stringify({ alertId, alertOnP2 }));


    // 7g. search tokens in a room the character is not in, and in the one she is.
    phase("search tokens", { flow: "search-observe" });
    const readTokens = room => `return { left: game.drpg.tokensLeft("${room}") };`;
    const before = await gm.eval(readTokens("Dorm B"));
    const away = await p1.eval(`return await game.drpg.searchTokens.spend("Dorm B", canvas.scene.id, { actorId: "${ids.aiko}" });`, { timeout: 30000 });
    await settle(600);
    const afterAway = await gm.eval(readTokens("Dorm B"));
    check("SECURITY: a search token is not spent in a room the character is not in",
        away === false && afterAway.left === before.left, JSON.stringify({ away, before, afterAway }));
    const hereBefore = await gm.eval(readTokens("Cafeteria"));
    const here = await p1.eval(`return await game.drpg.searchTokens.spend("Cafeteria", canvas.scene.id, { actorId: "${ids.aiko}" });`, { timeout: 30000 });
    await settle(600);
    const hereAfter = await gm.eval(readTokens("Cafeteria"));
    check("control: a search token is spent in the room the character stands in",
        here === true && hereAfter.left === hereBefore.left - 1, JSON.stringify({ here, hereBefore, hereAfter }));

    // 7h. fog.shared that nobody asked for.
    phase("the fog ledger", { flow: "discovery-ledger" });
    await p1.eval(`game.socket.emit("${SOCKET}", { action: "fog.shared",
        store: { [canvas.scene.id]: { "${ids.aiko}": ["Storage", "Gym", "Hall", "Dorm B"] } } }, ${toGms}); return true;`);
    await settle(1200);
    const fogAfter = await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs");
        return F.discoveredFor(canvas.scene.id, "${ids.aiko}");`);
    check("SECURITY: a fog ledger nobody asked for adds no rooms to a character's record",
        !JSON.stringify(fogAfter ?? []).includes("Storage"), JSON.stringify(fogAfter));

    /*
     * 7h2. A Direct Murder parked in another's name (E05 C3, 26.09.2026; audit S10-01). The
     * declaration is the GMs' store's since E05, not the world setting every browser held: p1
     * forges one for Chie (p3's), and nothing reaches the store; Chie's own player parks one, and
     * the store holds it while the world's old key, read on p1, holds nothing.
     *
     * Only in an Eclipse (E05 fix r1-G3, 27.09.2026; review S1-m8): with none running, Chie's own
     * player's murder.park is refused on the GM as cannotNow and told to p3, and nothing is written
     * or put to the GMs - red on ced3cad, where the row was filed named for no Eclipse and the GMs
     * were asked to rule on it. The control then parks in an Eclipse opened by its clock flag.
     */
    phase("a Direct Murder parked", { flow: "murder-incident" });
    const readPark = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); return { row: S.pendingMurderStore.get("${ids.chie}") ?? null };`;
    const park = await forge("murder.park", { killerId: ids.chie, room: "Gym", note: "SEC forged declaration" }, readPark);
    check("SECURITY: a forged murder.park for Chie changed nothing in the GMs' store",
        park.unchanged && park.after.row === null, JSON.stringify(park));
    check("SECURITY: the GM refused the forged murder.park for ownership, and told p1",
        park.forOwnership && park.told.some(t => t.what === "murder.park"), JSON.stringify({ reasons: park.reasons, told: park.told }));
    await gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const shutFrom = await gm.eval(`return game.messages.size;`);
    const parkShut = await p3.eval(`return await (await import("${repoUrl}/scripts/gm-bridge.mjs")).requestParkMurder({ killerId: "${ids.chie}", room: "Gym", note: "SEC declared in daylight" });`, { timeout: 30000 });
    await settle(900);
    const shutAfter = { ...(await gm.eval(readPark)), posted: (await gm.eval(`return game.messages.size;`)) - shutFrom,
        logged: await gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "murder.park"') && e.message.includes("no Eclipse is running")).length;`) };
    check("SECURITY: with no Eclipse running, Chie's own player's murder.park is refused and told as cannotNow - nothing filed, no GM asked",
        parkShut?.ok === false && parkShut?.reason === "cannotNow" && shutAfter.row === null && shutAfter.posted === 0 && shutAfter.logged === 1,
        JSON.stringify({ parkShut, shutAfter }));
    const parkClock = await gm.eval(`const c = game.drpg.getClock(); await game.drpg.setClock({ timeOfDay: "morning", eclipse: true, eclipseStartedAt: Date.now() });
        return { timeOfDay: c.timeOfDay, timeOfDayStartedAt: c.timeOfDayStartedAt };`);
    await settle(300);
    await p3.eval(`const { parkDirectMurder } = await import("${repoUrl}/scripts/eclipse.mjs");
        await parkDirectMurder({ killerId: "${ids.chie}", room: "Gym", note: "SEC Chie's own declaration" }); return true;`, { timeout: 30000 });
    await settle(900);
    const parkOk = await gm.eval(readPark);
    const parkWorld = await p1.eval(`return game.settings.get("${MOD}", "pendingMurders") ?? null;`);
    check("control: Chie's own player parks a declaration: the GMs' store holds it, and the world's old key on p1 holds nothing",
        parkOk.row?.note === "SEC Chie's own declaration" && JSON.stringify(parkWorld) === "{}", JSON.stringify({ parkOk, parkWorld }));

    /*
     * 7h2b. A betrayal declared in the dark with no offer (E32 C5b, 28.09.2026; the owner's Q3).
     * In an Eclipse a betrayal is a declaration the GM's client parks with the direct murders,
     * and the offer is the world's to say: p1 sends murder.betrayal for their own Aiko, who has
     * no betrayal on offer, in the Eclipse still open above. Ownership passes; the GM refuses it
     * as cannotNow and tells p1, and nothing is parked or offered.
     */
    const readBetrayal = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        return { row: S.pendingMurderStore.get("${ids.aiko}") ?? null, offer: incidentCast().betrayal ?? null };`;
    const betray = await forge("murder.betrayal", { actorId: ids.aiko, note: "SEC a betrayal nobody offered" }, readBetrayal);
    check("SECURITY: in an Eclipse, a murder.betrayal for Aiko, who has no betrayal on offer, is refused as cannotNow and told to p1 - nothing parked",
        betray.unchanged && betray.after.row === null && betray.after.offer === null && !betray.forOwnership
            && betray.reasons.some(r => r.includes("that cannot be done now")) && betray.told.some(t => t.what === "murder.betrayal"),
        JSON.stringify(betray));

    /*
     * 7h2c. A betrayal declared twice in one Eclipse (E32+E07 fix r1-G2, 01.10.2026; the round-1
     * security review's m4). The offer stays in the cast until the lights now, so the tile stays
     * lit after a declaration: Aiko is offered the betrayal on Botan and has declared it (the
     * GMs' row, written as `parkBetrayal` writes it), and p1 sends murder.betrayal for her again.
     * The GM refuses it as alreadyDone and tells p1; the row and the offer are as they were.
     */
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { eclipseId } = await import("${repoUrl}/scripts/settings.mjs");
        const c = game.drpg.getClock(), offer = { thirdId: "${ids.aiko}", killerId: "${ids.botan}", chapter: c.chapter, day: c.day };
        await S.castStore.patch("record", { betrayal: offer });
        await S.pendingMurderStore.patch("${ids.aiko}", { room: null, note: "SEC declared once", at: Date.now(), approved: null, eclipse: eclipseId(), betrayal: offer });
        return true;`);
    const again = await forge("murder.betrayal", { actorId: ids.aiko, note: "SEC declared twice" }, readBetrayal);
    check("SECURITY: in an Eclipse, a second murder.betrayal for Aiko, who has declared hers, is refused as alreadyDone and told to p1 - the row and the offer as they were",
        again.unchanged && again.after.row?.note === "SEC declared once" && again.after.offer?.killerId === ids.botan && !again.forOwnership
            && again.reasons.some(r => r.includes("that betrayal is already declared")) && again.told.some(t => t.what === "murder.betrayal"),
        JSON.stringify(again));
    await gm.eval(`await (await import("${repoUrl}/scripts/murder.mjs")).clearBetrayalOffer(); return true;`);
    await gm.eval(`await (await import("${repoUrl}/scripts/eclipse.mjs")).clearParkedMurders();
        await game.drpg.setClock({ eclipse: false, ...${JSON.stringify(parkClock)} }); return true;`);

    /*
     * 7h3. An Eclipse crossing for another's character (E05 C4, 26.09.2026; audit S10-39). The
     * crossings are counted in the GMs' store since E05, the allowance judged there: p1 forges a
     * crossing for Botan (p2's), and nothing is counted; Botan's own player crosses, and the store
     * counts it, answered with the count. In an Eclipse opened by its clock flag and name alone,
     * leading into noon, and closed again.
     *
     * The card names the room crossed into (E05 fix r1-G3, 27.09.2026; review M8): on a route
     * through two rooms the bridge carried no room and each card named the room the token ended
     * in - red on ced3cad, the card of a crossing into another room named Botan's. The room is a
     * claim: one that is no room of Botan's scene is not put in the card, which names where the
     * GM stands the token, and the crossing is counted all the same.
     */
    phase("an Eclipse crossing", { flow: "eclipse-route-veto" });
    const clockWas = await gm.eval(`const c = game.drpg.getClock(); await game.drpg.setClock({ timeOfDay: "morning", eclipse: true, eclipseStartedAt: Date.now() });
        return { timeOfDay: c.timeOfDay, timeOfDayStartedAt: c.timeOfDayStartedAt };`);
    const readMoves = `const X = await import("${repoUrl}/scripts/eclipse.mjs"); return { used: X.movesUsed(game.actors.get("${ids.botan}")) };`;
    const cross = await forge("eclipse.move", { actorId: ids.botan }, readMoves);
    check("SECURITY: a forged eclipse.move for Botan counted no crossing",
        cross.unchanged && cross.after.used === 0, JSON.stringify(cross));
    check("SECURITY: the GM refused the forged eclipse.move for ownership, and told p1",
        cross.forOwnership && cross.told.some(t => t.what === "eclipse.move"), JSON.stringify({ reasons: cross.reasons, told: cross.told }));
    const where = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs"); const X = await import("${repoUrl}/scripts/eclipse.mjs");
        const here = M.roomOfActor(game.actors.get("${ids.botan}"));
        return { here, into: M.allRooms().find(r => here && !r.includes(here) && !here.includes(r)) ?? null, allowance: X.eclipseAllowance() };`);
    const cardsFrom = await p2.eval(`return game.messages.size;`);
    const crossOk = await p2.eval(`return await (await import("${repoUrl}/scripts/gm-bridge.mjs")).requestEclipseMove("${ids.botan}", ${JSON.stringify(where.into)});`, { timeout: 30000 });
    await settle(600);
    const crossAfter = await gm.eval(readMoves);
    check("control: Botan's own player crosses, and the GMs' store counts it, answered with the count",
        crossOk?.ok === true && crossOk?.value?.used === 1 && crossAfter.used === 1, JSON.stringify({ crossOk, crossAfter }));
    const crossLie = await p2.eval(`return await (await import("${repoUrl}/scripts/gm-bridge.mjs")).requestEclipseMove("${ids.botan}", "SEC no such room");`, { timeout: 30000 });
    await settle(600);
    const crossCards = await p2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return game.messages.contents.slice(${cardsFrom}).map(m => contentOf(m));`);
    check("control: the card of Botan's crossing names the room crossed into, not the one the token stands in",
        Boolean(where.here && where.into) && crossCards.length === 2 && crossCards[0].includes(where.into) && !crossCards[0].includes(where.here),
        JSON.stringify({ where, crossCards }));
    check("SECURITY: a crossing that names no room of Botan's scene is counted, and its card names where the GM stands the token",
        where.allowance >= 2 && crossLie?.ok === true && crossLie?.value?.used === 2 && crossCards.length === 2
        && crossCards[1].includes(where.here) && !crossCards[1].includes("SEC no such room"), JSON.stringify({ where, crossLie, crossCards }));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.eclipseMoveStore.drop("${ids.botan}");
        await game.drpg.setClock({ eclipse: false, ...${JSON.stringify(clockWas)} }); return true;`);

    /*
     * 7h4. A pre-session note for another user (E05 C6, 26.09.2026; audit S11-03, S01-08). A player's
     * note is written through the primary GM since E05, under the user Foundry names as the sender:
     * p2 saves one of their own, then p1 sends `note.save` carrying p2's id - as the address, and as
     * a field of its own. p2's note is unchanged, in the GMs' store and in p2's flag; p1's own note
     * is what p1 sent, since the packet names nobody and the only note it can write is its sender's.
     * Nothing is refused. Put back: both rows dropped and both flags as they were.
     */
    phase("a pre-session note", { flow: "pre-session-note" });
    const NOTE = `const N = await import("${repoUrl}/scripts/pre-session-note.mjs");`;
    const noteUsers = [p1.userId, p2.userId];
    const noteFlagsWas = await gm.eval(`return ${JSON.stringify(noteUsers)}.map(id => game.users.get(id).getFlag("${MOD}", "preSessionNote") ?? null);`);
    const p2Saved = await p2.eval(`${NOTE} return await N.saveNote(game.user.id, "SEC p2's own note");`, { timeout: 30000 });
    await settle(600);
    const readNotes = `${NOTE} return { p1: N.noteFor("${p1.userId}"), p2: N.noteFor("${p2.userId}"),
        p2Flag: game.users.get("${p2.userId}").getFlag("${MOD}", "preSessionNote") ?? null };`;
    const forgedNote = await forge("note.save", { text: "SEC p1's words for p2", noteUserId: p2.userId }, readNotes);
    check("SECURITY: a note.save carrying p2's id changes only its sender's own note - p2's stays, p1's is what p1 sent",
        p2Saved === "sent" && forgedNote.before.p2 === "SEC p2's own note" && forgedNote.after.p2 === "SEC p2's own note"
        && JSON.stringify(forgedNote.after.p2Flag) === JSON.stringify(forgedNote.before.p2Flag) && forgedNote.after.p1 === "SEC p1's words for p2"
        && !forgedNote.reasons.length, JSON.stringify({ p2Saved, forgedNote }));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const { replaceFlag } = await import("${repoUrl}/scripts/utils.mjs");
        // A tree before C6 has no store to take them from (its red run, 26.09): the flags alone are put back there.
        if (S.noteStore) await S.noteStore.dropMany(${JSON.stringify(noteUsers)});
        const was = ${JSON.stringify(noteFlagsWas)};
        for (const [i, id] of ${JSON.stringify(noteUsers)}.entries()) {
            const user = game.users.get(id);
            if (was[i] === null) await user.unsetFlag("${MOD}", "preSessionNote");
            else await replaceFlag(user, "preSessionNote", was[i]);
        }
        return true;`);

    /*
     * 7m. A roll's bookmark (E08+E28 C2, 03.10.2026). The roller's browser tells the GMs what it
     * rolled for the Reroll's bookmark (`roll.bookmark`), and the GM keeps it only from the
     * character's own player, for a module roll that player wrote (`owns`, `guardRollAuthor`).
     * p1 throws Aiko's roll and p2 Botan's, each kept; then p1 names Botan for its own roll, and
     * Aiko for p2's roll. Each forgery is refused and logged, told to nobody (a report nobody
     * waits on is quiet), and no row moves.
     */
    phase("a roll's bookmark", { flow: "reroll" });
    const throwKept = (client, actorId) => client.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        try {
            const out = await A.rollTrait(game.actors.get("${actorId}"), "eye", { remember: true });
            return out?.raw?.message?.id ?? null;
        } finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
    const readRows = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = id => { const r = S.rerollBookmarkStore?.get(id); return r ? { messageId: r.messageId, by: r.by, claims: r.claims } : null; };
        return { aiko: row("${ids.aiko}"), botan: row("${ids.botan}") };`;
    const p1Roll = await throwKept(p1, ids.aiko);
    const p2Roll = await throwKept(p2, ids.botan);
    await settle(1200);
    const keptRows = await gm.eval(readRows);
    check("control: each player's own roll is kept on the GMs' bookmark, by its roller",
        Boolean(p1Roll && p2Roll) && keptRows.aiko?.messageId === p1Roll && keptRows.aiko?.by === p1.userId
        && keptRows.botan?.messageId === p2Roll && keptRows.botan?.by === p2.userId, JSON.stringify({ p1Roll, p2Roll, keptRows }));
    const forgedOther = await forge("roll.bookmark", { actorId: ids.botan, messageId: p1Roll, actionKey: "search",
        context: { itemId: "SECFORGEDITEM000" } }, readRows);
    check("SECURITY: a roll.bookmark naming another player's character is refused for ownership, told to nobody, and changes no row",
        forgedOther.unchanged && forgedOther.forOwnership && !forgedOther.told.length, JSON.stringify(forgedOther));
    const forgedRoll = await forge("roll.bookmark", { actorId: ids.aiko, messageId: p2Roll, actionKey: "search",
        context: { itemId: "SECFORGEDITEM000" } }, readRows);
    check("SECURITY: a roll.bookmark naming another player's roll message is refused by its author, told to nobody, and changes no row",
        forgedRoll.unchanged && forgedRoll.reasons.some(r => /sender did not write that roll message/.test(r)) && !forgedRoll.told.length,
        JSON.stringify(forgedRoll));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        for (const id of ${JSON.stringify([p1Roll, p2Roll])}) await game.messages.get(id ?? "")?.delete();
        if (S.rerollBookmarkStore) await S.rerollBookmarkStore.dropMany(["${ids.aiko}", "${ids.botan}"]);
        return true;`);

    /*
     * 7n. A roll for the GM to draw (E08+E28 C12a, 04.10.2026; the plan's 3.3). A player's action
     * roll is thrown on the primary GM (`roll.draw`): the GM throws it for the sender's own
     * character only (`owns`), and only a duality roll nobody has thrown, carrying the nonce the
     * packet names (`guardDrawnRoll`). p1 asks a draw for Botan, p2's character, and one for
     * Aiko with a roll already thrown to 30. Each is refused and logged, and the GM writes no
     * message and keeps no record. 40-flow drives the legal draw.
     */
    phase("a roll for the GM to draw", { flow: "gm-rolls-total" });
    const readDraws = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { drawn: game.messages.filter(m => m.getFlag("${MOD}", "drawn")).length, rows: Object.keys(S.rollStore?.entries() ?? {}).length };`;
    const die = (cls, extra = {}) => ({ class: cls, number: 1, faces: 12, modifiers: [], results: [], evaluated: false, ...extra });
    const unthrown = { class: "DualityRoll", formula: "1d12 + 1d12 + 0", evaluated: false, total: null,
        terms: [die("HopeDie"), { class: "OperatorTerm", operator: "+", evaluated: true }, die("FearDie"),
            { class: "OperatorTerm", operator: "+", evaluated: true }, { class: "NumericTerm", number: 0, evaluated: true }],
        options: { drpgRollNonce: "SECDRAWNONCE", actionType: "action", roll: { type: "trait" } } };
    const forgedDraw = await forge("roll.draw", { actorId: ids.botan, actionKey: "search", nonce: "SECDRAWNONCE", claimed: true,
        loaded: null, costs: [], roll: unthrown }, readDraws);
    check("SECURITY: a roll.draw for another player's character is refused for ownership, and the GM writes no message and keeps no record",
        forgedDraw.unchanged && forgedDraw.forOwnership, JSON.stringify(forgedDraw));
    const thrownAlready = { ...unthrown, evaluated: true, total: 30,
        terms: [die("HopeDie", { results: [{ result: 12, active: true }], evaluated: true }), unthrown.terms[1],
            die("FearDie", { results: [{ result: 12, active: true }], evaluated: true }), unthrown.terms[3], { class: "NumericTerm", number: 6, evaluated: true }] };
    const forgedThrown = await forge("roll.draw", { actorId: ids.aiko, actionKey: "search", nonce: "SECDRAWNONCE", claimed: true,
        loaded: null, costs: [], roll: thrownAlready }, readDraws);
    check("SECURITY: a roll.draw carrying a roll already thrown is refused, and the GM writes no message and keeps no record",
        forgedThrown.unchanged && forgedThrown.reasons.some(r => /that is not a duality roll nobody has thrown/.test(r)), JSON.stringify(forgedThrown));
    /* A DRAW IS AN ACTION'S, AND ITS WINDOW COSTS ITS EXPERIENCES' HOPE (E08+E28 fix r2-H1, 04.10.2026; the
       round-2 reviews' S2-1 and M2). p1's console asks a draw of a Work on a Project roll of Aiko's, its own
       character's, with no action paid - the GM drew it until the fix (the review's probe drew three with Aiko's
       actions 3 -> 3) and refuses it now, once the payment it waits for has not come (roll-draw.mjs
       `drawRefusal`). Then a draw naming no action whose window asks a Fear cost of 12 - drawn until the fix,
       the 12 taken off the GM's Fear (bridge-guards.mjs `guardDrawnCosts`). Each is refused and logged, told to
       p1, and the GM writes no message and keeps no record, and its Fear stays where it was. */
    const readDrawsFear = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { drawn: game.messages.filter(m => m.getFlag("${MOD}", "drawn")).length, rows: Object.keys(S.rollStore?.entries() ?? {}).length,
            fear: game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear) };`;
    const askedDraw = async (requestId, fields) => {
        // No payment of Aiko's this GM saw earlier in the scenario - a crossing's - may stand for this one.
        await gm.eval(`(await import("${repoUrl}/scripts/roll-draw.mjs")).forgetPayments?.("${ids.aiko}"); return true;`);
        await clearFailures();
        const before = await gm.eval(readDrawsFear);
        await p1.eval(`globalThis.__refused.length = 0;
            game.socket.emit("${SOCKET}", { action: "roll.draw", userId: game.user.id, requestId: "${requestId}", actorId: "${ids.aiko}", nonce: "SECDRAWNONCE",
                claimed: true, loaded: null, roll: ${JSON.stringify(unthrown)}, ...${JSON.stringify(fields)} }, ${toGms});
            return true;`);
        for (let i = 0; i < 40 && !(await refusedFor("roll.draw")).length; i++) await settle(100);
        await settle(300);
        return { before, after: await gm.eval(readDrawsFear), reasons: await refusedFor("roll.draw"),
            told: (await p1.eval(`return globalThis.__refused.slice();`)).filter(t => t.what === "roll.draw" && t.requestId === requestId).length };
    };
    const unpaid = await askedDraw("unpaid-draw", { actionKey: "project", costs: [] });
    check("SECURITY: a roll.draw for an action its character has not paid for is refused, and the GM writes no message and keeps no record",
        JSON.stringify(unpaid.after) === JSON.stringify(unpaid.before) && unpaid.reasons.some(r => /no payment of that character's stands for that roll/.test(r))
        && unpaid.told === 1, JSON.stringify(unpaid));
    /* The Fear cost names an experience Aiko holds, so the cost's key is the one thing the guard refuses: with none
       named, one cost is already one more than the experiences allow, and the check stayed green with the key's test
       taken out of `guardDrawnCosts` (fix r2-H1's mutant h1-any-cost, 131/131 on 05.10.2026). */
    const aikoExperience = await gm.eval(`return Object.keys(game.actors.get("${ids.aiko}")?.system?.experiences ?? {})[0] ?? null;`);
    const fearCost = await askedDraw("fear-cost-draw", { actionKey: null, experiences: [aikoExperience],
        costs: [{ key: "fear", value: 12, enabled: true }] });
    check("SECURITY: a roll.draw whose window asks a Fear cost is refused, and the GM's Fear does not move",
        aikoExperience !== null && JSON.stringify(fearCost.after) === JSON.stringify(fearCost.before)
        && fearCost.reasons.some(r => /asks a cost no roll of this game pays/.test(r)) && fearCost.told === 1, JSON.stringify({ aikoExperience, ...fearCost }));
    // Put back if it moved, so a later check of Fear reads its own (at a63256f's runtime the 12 came off: 0 -> -11, the roll's own Fear added).
    if (fearCost.after.fear !== fearCost.before.fear) {
        await gm.eval(`await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, ${Number(fearCost.before.fear) || 0}); return true;`);
    }
    /* A DRAWN ROLL IS THROWN ON THE GM'S TERMS (E08+E28 fix r2-H8, 05.10.2026). The GM threw the roll a packet wrote:
       its dice's faces and keep, a critical its options guarantee, its kind and Daggerheart's steps it skips
       (roll-draw.mjs `onGmTerms`), and any term at all (bridge-guards.mjs `guardDrawnRoll`). p1's console pays one of
       Aiko's actions and asks a Search's draw of a roll it wrote: a Hope and a Fear die of one face, two Hope dice
       kept high, a critical guaranteed, a reaction with its resource step, countdowns and triggers skipped. Read on the
       GM: the newest record's dice (faces, how many thrown), its critical against its dice, and the kind and the skips
       its message keeps. Then a draw naming no action whose roll adds `(10)`: refused, told, and nothing written.
       At 33bc497's runtime the GM's record read dice [[1,2],[1,1]], a critical, a reaction and the three skips, and the
       `(10)` draw was written (drawn messages 19 -> 20, records 22 -> 23). Since E29 fix r2-H1 a packet's options may
       not carry `skips` at all - it is refused, the next check's rule - so this roll asks the critical and the kind
       alone, and the skips read are the GM's own. */
    const termsFrom = await gm.eval(`return Date.now();`);
    const readNewest = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = Object.values(S.rollStore?.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${termsFrom})
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0] ?? null;
        const m = row ? game.messages.get(row.messageId) : null;
        return row ? { dice: row.dice.map(d => [d.faces, d.results.length]), critical: row.isCritical, sameDice: row.hope === row.fear,
            kind: m?.rolls?.[0]?.options?.actionType ?? null, skips: m?.rolls?.[0]?.options?.skips ?? null } : null;`;
    const forgedDice = { ...unthrown, formula: "2d1kh + 1d1 + 0",
        terms: [die("HopeDie", { number: 2, faces: 1, modifiers: ["kh"] }), unthrown.terms[1], die("FearDie", { faces: 1 }), ...unthrown.terms.slice(3)],
        options: { ...unthrown.options, guaranteedCritical: true, actionType: "reaction" } };
    await p1.eval(`${payFor(ids.aiko)}
        game.socket.emit("${SOCKET}", { action: "roll.draw", userId: game.user.id, requestId: "gm-terms-draw", actorId: "${ids.aiko}", nonce: "SECDRAWNONCE",
            actionKey: "search", claimed: true, loaded: null, costs: [], roll: ${JSON.stringify(forgedDice)} }, ${toGms});
        return true;`);
    let onGmTerms = null;
    for (let i = 0; i < 60 && !onGmTerms; i++) {
        onGmTerms = await gm.eval(readNewest);
        if (!onGmTerms) await settle(100);
    }
    check("SECURITY: a console's roll.draw is thrown on the GM's dice and kind - d12s, one Hope die, a critical only of equal dice, an action with every step",
        Boolean(onGmTerms) && JSON.stringify(onGmTerms.dice) === JSON.stringify([[12, 1], [12, 1]]) && onGmTerms.critical === onGmTerms.sameDice
        && onGmTerms.kind === "action" && JSON.stringify(onGmTerms.skips) === "{}", JSON.stringify(onGmTerms), { flow: "gm-rolls-total" });
    const parenthesis = await askedDraw("parenthesis-draw", { actionKey: null, costs: [],
        roll: { ...unthrown, terms: [...unthrown.terms, unthrown.terms[1], { class: "ParentheticalTerm", term: "10", evaluated: false }] } });
    check("SECURITY: a roll.draw holding a term that is neither a die, a number nor + or - is refused, and the GM writes no message and keeps no record",
        JSON.stringify(parenthesis.after) === JSON.stringify(parenthesis.before)
        && parenthesis.reasons.some(r => /holds a term no roll of this game is built of/.test(r)) && parenthesis.told === 1, JSON.stringify(parenthesis));
    /* A DRAWN ROLL'S OPTIONS ARE THE GM'S (E29 fix r2-H1, 05.10.2026; review round 2's sec B1). The GM threw a drawn roll with
       every option its packet carried beyond the ones it wrote over, and Daggerheart's resource step pays the difference from
       a `rerolledRoll` (dualityRoll.mjs `addDualityResourceUpdates`): the review's console took one of the GM's Fear with a
       Hope result (its probe 99 P1, at 070b72b's runtime: 1 -> 0, no flag on the record). The GM now writes every option itself
       (roll-draw.mjs `drawnOptions`), and a packet holding a key past the ones a window may say is refused (bridge-guards.mjs
       `guardDrawnRoll`). p1's console asks a draw naming no action whose options carry a `rerolledRoll` of a Fear result, the
       GM's dice set to a Hope result (9 and 2) and its Fear to 2 first: refused and told, nothing written, the Fear still 2.
       At 070b72b's runtime (this file kept, e29run/r2h1bred): drawn (drawn messages 21 -> 22, records 24 -> 25), the Fear
       2 -> 1, nothing refused. */
    const fearWas = await gm.eval(`return game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);`);
    await gm.eval(`await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, 2); globalThis.__forceRoll = { hope: 9, fear: 2 }; return true;`);
    const rerolledDraw = await askedDraw("rerolled-draw", { actionKey: null, costs: [],
        roll: { ...unthrown, options: { ...unthrown.options, rerolledRoll: { result: { duality: -1 }, isCritical: false } } } });
    await gm.eval(`delete globalThis.__forceRoll; await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, ${Number(fearWas) || 0}); return true;`);
    check("SECURITY: a roll.draw whose options carry Daggerheart's rerolledRoll is refused and told, and the GM writes nothing and its Fear does not move",
        rerolledDraw.before.fear === 2 && JSON.stringify(rerolledDraw.after) === JSON.stringify(rerolledDraw.before)
        && rerolledDraw.reasons.some(r => /options hold what no roll of this game is drawn with: rerolledRoll/.test(r)) && rerolledDraw.told === 1,
        JSON.stringify(rerolledDraw), { flow: "gm-rolls-total" });
    /* AN ARMED CALL IS THE GMS' (E29 C8, 05.10.2026; the plan's 1.5 item 5 and 3.3). p1's console writes a Loaded Die onto
       Aiko's armed list itself - a Call nobody paid for, past its own browser's courtesy - pays one of Aiko's actions and asks
       a Search's draw naming it, among its Calls and as its loaded mark. Read on the GM once its audit has judged Aiko's
       writes: whether the list still holds the entry, and the newest record's Calls used and whether it was loaded; on p1,
       whether it was told of a put-back. Until C8 the entry stood (listed by the audit since C3) and the GM loaded its 12. */
    const forgedDie = { key: "freeCrit", kind: "hope", grants: "critical", amount: null, nonce: "SECFORGEDDIE0001" };
    const dieFrom = await gm.eval(`return Date.now();`);
    await p1.eval(`globalThis.__refused.length = 0;
        if (!globalThis.__dieToldHook) {
            globalThis.__dieToldHook = true; globalThis.__dieTold = [];
            game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__dieTold.push(payload.reason); });
        }
        globalThis.__dieTold.length = 0;
        ${payFor(ids.aiko)}
        const a = game.actors.get("${ids.aiko}"), had = a.getFlag("${MOD}", "pendingCall");
        await a.update({ "flags.${MOD}.pendingCall": [...(Array.isArray(had) ? had : had ? [had] : []), ${JSON.stringify(forgedDie)}] }, { drpgAutomated: true });
        game.socket.emit("${SOCKET}", { action: "roll.draw", userId: game.user.id, requestId: "forged-die-draw", actorId: "${ids.aiko}", nonce: "SECDIEDRAWNONCE",
            actionKey: "search", claimed: true, loaded: "${forgedDie.nonce}", calls: ["${forgedDie.nonce}"], costs: [],
            roll: ${JSON.stringify({ ...unthrown, options: { ...unthrown.options, drpgRollNonce: "SECDIEDRAWNONCE" } })} }, ${toGms});
        return true;`);
    const readDieDraw = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        const row = Object.values(S.rollStore?.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${dieFrom})
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0] ?? null;
        const f = game.actors.get("${ids.aiko}").getFlag("${MOD}", "pendingCall");
        return { armed: (Array.isArray(f) ? f : f ? [f] : []).some(e => e?.nonce === "${forgedDie.nonce}"),
            row: row ? { calls: row.used?.calls ?? null, loaded: row.used?.loaded ?? null, hope: row.hope } : null };`;
    let dieDraw = null;
    for (let i = 0; i < 60 && !dieDraw?.row; i++) {
        dieDraw = await gm.eval(readDieDraw);
        if (!dieDraw.row) await settle(100);
    }
    dieDraw.told = await p1.eval(`return globalThis.__dieTold.slice();`);
    check("SECURITY: a Loaded Die a console writes on its own student is put back, and a drawn roll naming it is not loaded",
        Boolean(dieDraw.row) && dieDraw.armed === false && dieDraw.row.loaded === false && !(dieDraw.row.calls ?? []).includes(forgedDie.nonce)
        && dieDraw.told.includes("sheetPutBack"), JSON.stringify(dieDraw), { flow: "call-arm" });
    /* THE GM THROWS ITS OWN LIST (E29 C10, 05.10.2026; D2 option 2; the stage plan's 3.4 and 3.5). p1's console pays one of
       Aiko's actions and asks a Search's draw of a roll that adds 5 after her Eye's value, which no Call, experience or
       effect of hers explains. Read on the GM: the newest record's total against its Hope and Fear and Aiko's Eye, its
       flags, the claim's and the thrown flat sums, and the GMs' whispers that say its modifier flag; on p1 and on p2,
       whether the words of a card since the draw say the roller's line (roll-draw.mjs `rollerLine`). Until C10 the GM
       counted the 5 - flagged, and scored as drawn. The other forged rolls of this phase claim nothing the GM does not
       count beyond their dice, and are told nothing. */
    const fiveHad = { gm: await gm.eval(`return game.messages.contents.map(m => m.id);`), p1: await p1.eval(`return game.messages.contents.map(m => m.id);`),
        p2: await p2.eval(`return game.messages.contents.map(m => m.id);`) };
    const fiveFrom = await gm.eval(`return Date.now();`);
    const eye = await gm.eval(`return Number(game.actors.get("${ids.aiko}")?.system?.traits?.instinct?.value) || 0;`);
    const plusFive = { ...unthrown, formula: `1d12 + 1d12 + ${eye} + 5`,
        terms: [...unthrown.terms.slice(0, 4), { class: "NumericTerm", number: eye, evaluated: true }, unthrown.terms[3], { class: "NumericTerm", number: 5, evaluated: true }],
        options: { ...unthrown.options, drpgRollNonce: "SECFIVEDRAWNONCE" } };
    await p1.eval(`${payFor(ids.aiko)}
        game.socket.emit("${SOCKET}", { action: "roll.draw", userId: game.user.id, requestId: "plus-five-draw", actorId: "${ids.aiko}", nonce: "SECFIVEDRAWNONCE",
            actionKey: "search", claimed: true, loaded: null, costs: [], trait: "instinct", roll: ${JSON.stringify(plusFive)} }, ${toGms});
        return true;`);
    const readFive = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"), D = await import("${repoUrl}/scripts/roll-draw.mjs");
        const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const row = Object.values(S.rollStore?.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${fiveFrom})
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0] ?? null;
        if (!row) return null;
        const flag = (row.flags ?? []).find(f => f.kind === "modifier"), line = flag ? D.flagText(flag) : null;
        let toGms = 0;
        for (const m of game.messages.contents.filter(m => !${JSON.stringify(fiveHad.gm)}.includes(m.id) && m.id !== row.messageId)) {
            if (line && String(await wordsOf(m, 500) ?? "").includes(line)) toGms++;
        }
        return { total: row.total, hope: row.hope, fear: row.fear, flags: (row.flags ?? []).map(f => f.kind), claim: row.claim?.flat ?? null,
            scored: row.scored?.flat ?? null, toGms, told: typeof D.rollerLine === "function" ? D.rollerLine(row) : null };`;
    // The record is kept before the GMs are told and the roller's card is written (roll-draw.mjs `throwDrawn`): read until both are.
    let five = null;
    for (let i = 0; i < 60 && !(five?.toGms >= 1); i++) {
        five = await gm.eval(readFive);
        if (!(five?.toGms >= 1)) await settle(100);
    }
    await settle(300);
    const heardFive = (client, had) => client.eval(`const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const told = ${JSON.stringify(five?.told ?? null)};
        if (!told) return null;
        for (const m of game.messages.contents.filter(m => !${JSON.stringify(had)}.includes(m.id))) {
            if (String(await wordsOf(m, 1500) ?? "").includes(foundry.utils.escapeHTML(told))) return true;
        }
        return false;`);
    if (five) Object.assign(five, { p1: await heardFive(p1, fiveHad.p1), p2: await heardFive(p2, fiveHad.p2) });
    check("SECURITY: a console's roll.draw is thrown on the GM's own list - a 5 nothing of Aiko's explains is not counted, is flagged to the GMs, and its roller alone is told",
        Boolean(five) && five.total === five.hope + five.fear + eye && five.flags.includes("modifier") && five.claim === eye + 5 && five.scored === eye
        && five.toGms === 1 && five.p1 === true && five.p2 === false, JSON.stringify({ eye, five }), { flow: "gm-rolls-total" });
    /* WHAT THE GM THROWS IS READ IN ONE STEP (E29 fix r2-H3, 06.10.2026; the round-2 security review's M1). The GM read a
       drawn roll's list after the roll's own waits - a pick's, up to two seconds - off Aiko as she stood then, so a write that
       landed during them and that the GMs' audit had not put back yet was thrown: the review's probe 99 P3, at 070b72b's
       runtime, had p1's console make effects guaranteeing a critical, four every 10 ms, while a clean-up waited for a pick,
       and the GM threw a critical. Here the audit's put-back waits behind a GM's own write of Aiko's means, which holds the
       audit's queue while it is on its way (sheet-audit.mjs `gmMeansWrite`), so the put-back lands when this check lets that
       write go rather than wherever a flood leaves it. p1's console pays one of Aiko's actions and asks a Work's draw on a
       project stored without a statistic (Hope 3, Fear 8), which waits for a pick nobody makes; once the GM has taken the
       payment, the GM's write is begun, and p1's console makes one such effect and writes the four statistics a project lists
       at 9; four seconds after the draw was asked the GM's write goes. Read on the GM once its audit is idle: the record's
       critical and the critical its list read, the statistic thrown and its value against Aiko's as the GMs hold her, and
       what of the effect and the 9s is left. At 7a040b9's runtime (e29run/r2h3red/30.log): both critical, and Hand thrown at
       the 9 where the GMs hold Body lowest at 0; nothing left - the audit put the effect and the 9s back after the throw. */
    const midway = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const { ACTIONS, TRAITS } = await import("${repoUrl}/scripts/config.mjs");
        const a = game.actors.get("${ids.aiko}"), value = t => Number(a.system.traits?.[TRAITS[t]?.dh]?.value) || 0;
        const listed = ACTIONS.project.traits.filter(t => Object.hasOwn(TRAITS, t));
        globalThis.__forceRoll = { hope: 3, fear: 8 };
        return { from: Date.now(), project: (await P.createProject({ name: "SEC r2-H3 no statistic", target: 6, room: null, trait: null }))?.id ?? null,
            dh: Object.fromEntries(listed.map(t => [t, TRAITS[t].dh])), held: Object.fromEntries(listed.map(t => [t, value(t)])),
            lowest: listed.reduce((l, t) => (value(t) < value(l) ? t : l)) };`, { timeout: 60000 });
    const midAsked = Date.now();
    await p1.eval(`${payFor(ids.aiko)}
        game.socket.emit("${SOCKET}", { action: "roll.draw", userId: game.user.id, requestId: "midway-draw", actorId: "${ids.aiko}", nonce: "SECMIDDRAWNONCE",
            actionKey: "project", claimed: true, loaded: null, costs: [], trait: ${JSON.stringify(midway.dh[midway.lowest] ?? null)},
            context: { projectId: ${JSON.stringify(midway.project)} }, roll: ${JSON.stringify({ ...unthrown, options: { ...unthrown.options, drpgRollNonce: "SECMIDDRAWNONCE" } })} }, ${toGms});
        return true;`);
    // The payment taken is the draw begun (roll-draw.mjs `drawRefusal`): the GM's write is begun within the pick's wait.
    const paidFor = `return (await import("${repoUrl}/scripts/roll-draw.mjs")).paymentsOf("${ids.aiko}").some(t => t.kinds.includes("project"));`;
    for (let i = 0; i < 40 && !(await gm.eval(paidFor)); i++) await settle(50);
    await settle(200);
    await gm.eval(`const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        let release = null; const gate = new Promise(r => { release = r; });
        globalThis.__secMidway = { release, writing: A.gmMeansWrite(game.actors.get("${ids.aiko}"), () => gate) };
        return true;`);
    await p1.eval(`const a = game.actors.get("${ids.aiko}");
        await a.createEmbeddedDocuments("ActiveEffect", [{ name: "SEC r2-H3 critical",
            system: { changes: [{ key: "system.rules.roll.guaranteedCritical", type: "override", value: "true" }] } }]);
        await a.update(${JSON.stringify(Object.fromEntries(Object.values(midway.dh).map(k => [`system.traits.${k}.value`, 9])))}, { drpgAutomated: true });
        return true;`);
    const midSeen = await gm.eval(`const a = game.actors.get("${ids.aiko}");
        return { effect: a.effects.contents.some(e => e.name === "SEC r2-H3 critical"),
            nines: ${JSON.stringify(Object.values(midway.dh))}.every(k => Number(a.system.traits?.[k]?.value) === 9) };`);
    await settle(Math.max(0, 4000 - (Date.now() - midAsked)));
    await gm.eval(`globalThis.__secMidway?.release?.(); await globalThis.__secMidway?.writing; return true;`);
    let mid = null;
    for (let i = 0; i < 100 && !mid; i++) {
        mid = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
            const r = Object.values(S.rollStore?.entries() ?? {}).filter(x => x?.actorId === "${ids.aiko}" && x.actionKey === "project" && x.at >= ${midway.from})
                .sort((x, y) => (y.at ?? 0) - (x.at ?? 0))[0] ?? null;
            return r ? { critical: r.isCritical, listed: r.legal?.read?.kind?.critical ?? null, trait: r.scored?.trait ?? null, value: r.scored?.traitValue ?? null } : null;`);
        if (!mid) await settle(100);
    }
    const midLeft = await gm.eval(`await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        delete globalThis.__forceRoll; delete globalThis.__secMidway;
        const a = game.actors.get("${ids.aiko}"), held = ${JSON.stringify(midway.held)}, dh = ${JSON.stringify(midway.dh)};
        const effects = a.effects.contents.filter(e => e.name === "SEC r2-H3 critical").map(e => e.id);
        const raised = Object.keys(held).filter(t => (Number(a.system.traits?.[dh[t]]?.value) || 0) !== held[t]);
        if (effects.length) await a.deleteEmbeddedDocuments("ActiveEffect", effects);
        if (raised.length) await a.update(Object.fromEntries(raised.map(t => ["system.traits." + dh[t] + ".value", held[t]])));
        if (${JSON.stringify(midway.project)}) await (await import("${repoUrl}/scripts/projects.mjs")).deleteProject(${JSON.stringify(midway.project)});
        return { effects: effects.length, raised };`, { timeout: 60000 });
    check("SECURITY: what p1's console writes on Aiko while the GM's draw waits for a pick is not thrown - no critical, the statistic at the GMs' value - and the GMs' audit puts it back",
        Boolean(midway.project) && midSeen.effect === true && midSeen.nines === true
            && JSON.stringify(mid) === JSON.stringify({ critical: false, listed: false, trait: midway.lowest, value: midway.held[midway.lowest] })
            && midLeft.effects === 0 && midLeft.raised.length === 0,
        JSON.stringify({ midway, midSeen, mid, midLeft }), { flow: "gm-rolls-total" });
    // The draws above are this check's alone: their records and messages go.
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const ids = Object.entries(S.rollStore?.entries() ?? {}).filter(([, r]) => r?.actorId === "${ids.aiko}" && r.at >= ${termsFrom});
        for (const [, r] of ids) await game.messages.get(r.messageId ?? "")?.delete();
        if (ids.length) await S.rollStore.dropMany(ids.map(([id]) => id));
        return true;`);

    phase("a trace the GM's Reroll meets", { flow: "reroll" });
    /*
     * 7k. The trace a Reroll may no longer touch (E08+E28 fix r1-G3, 04.10.2026; the round-1
     * reviews' S1 = M2). Until C8 the two checks of 7j asked a player's Reroll edit not to
     * re-rate a trace a GM had written on, nor one older than a Reroll can reach
     * (`removalRefusal`, E03); since C4a the GM's own Reroll makes the edit and nothing asked it,
     * so a Reroll deleted a trace another student had already copied into a Truth Bullet (the
     * review's probe 99c). Put back against the GM-made Reroll (reroll.mjs `traceKept`): Aiko's
     * Dynamic, rerolled on the GM onto a band that re-rates its trace (19, Hidden) or a miss
     * that removes it (5). A trace a GM has written on, one somebody has found (copied into
     * Chie's bullet; asked of a removal) and one two hours old stay as they were, the row keeps
     * naming them, the card says it could not be adjusted and the GMs are told; the control is a
     * fresh, unfound trace, re-rated and removed by the same Reroll.
     */
    const rerollOverTrace = (subject, how, next) => gm.eval(`
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const X = await import("${repoUrl}/scripts/reroll.mjs");
        const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const who = game.actors.get("${ids.aiko}");
        const trace = await R.placeRemnant({ x: 1700, y: 550, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: who.id, sourceName: who.name, room: "Cafeteria", action: "dynamic", subject: "${subject}" });
        const copy = "${how}" === "found" ? await B.createTruthBullet(game.actors.get("${ids.chie}"), { name: "${subject}, a copy",
            realType: "prep", visibility: "obvious", remnantId: trace?.id, sceneId: canvas.scene.id }) : null;
        if ("${how}" === "edited") await R.markRemnantEdited(trace);
        if ("${how}" === "stale") await R.setRemnantSecret(trace, { placedAt: Date.now() - 2 * 3600_000 });
        const m = await ChatMessage.create({ content: "SEC a Dynamic to reroll" });
        class Thrown {
            constructor(formula, data = {}, options = {}) { this._formula = formula; this.options = options; this.faces = { hope: 11, fear: 9 }; }
            get dHope() { return { total: this.faces.hope }; } get dFear() { return { total: this.faces.fear }; }
            get total() { return this.faces.hope + this.faces.fear; }
            get withHope() { return this.faces.hope > this.faces.fear; } get withFear() { return this.faces.hope < this.faces.fear; }
            get isCritical() { return this.faces.hope === this.faces.fear; }
            async reroll() { const r = new Thrown(this._formula, {}, this.options); r.faces = ${JSON.stringify(next)}; return r; }
            toJSON() { return { class: "DualityRoll", formula: this._formula, total: this.total, evaluated: true }; }
        }
        Object.defineProperty(m, "rolls", { configurable: true, get: () => [new Thrown("1d12 + 1d12", {}, {})] });
        const hopeWas = who.system.resources.hope.value;
        await trustedWrite(who, { "system.resources.hope.value": 5 }, { reason: "gmRuling" });
        if (S.rerollBookmarkStore.has(who.id)) await S.rerollBookmarkStore.drop(who.id);
        await S.rerollBookmarkStore.patch(who.id, { messageId: m.id, reportMessageId: null, actionKey: "dynamic", trait: "eye", experiences: [],
            claims: { bandIndex: 3, description: "${subject}" }, total: 20, withFear: false, isCritical: false, first: [], room: "Cafeteria",
            at: Date.now(), by: game.user.id, facts: { remnantId: trace?.id ?? null, remnantScene: canvas.scene.id } });
        const told = [];
        // A whisper's words are secret.mjs's, not the document's (a private card holds a stub).
        const hook = Hooks.on("createChatMessage", doc => { if (doc.whisper?.length) told.push(doc); });
        let out = null;
        try { out = await X.rerollOnGm(who, game.user); } finally { Hooks.off("createChatMessage", hook); }
        const t = trace ? canvas.scene.tokens.get(trace.id) : null;
        const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        const words = await Promise.all(told.map(doc => wordsOf(doc)));
        const result = { placed: Boolean(trace) && ("${how}" !== "found" || Boolean(copy)), lines: out?.lines ?? null, refused: out?.refused ?? null,
            standing: Boolean(t), visibility: t ? R.remnantData(t)?.visibility ?? null : null,
            rowNames: Boolean(trace) && S.rerollBookmarkStore.get(who.id)?.facts?.remnantId === trace.id,
            cardSays: (out?.lines ?? []).includes(game.i18n.localize("DRPG.Reroll.remnantManual")),
            gmsTold: words.some(c => String(c ?? "").includes("${subject}")) };
        delete m.rolls; await m.delete();
        await S.rerollBookmarkStore.drop(who.id);
        await trustedWrite(who, { "system.resources.hope.value": hopeWas }, { reason: "gmRuling" });
        if (t) { await R.dropRemnantSecret(t); await t.delete(); }
        await copy?.delete();
        return result;`, { timeout: 60000 });
    const RETUNE = { hope: 10, fear: 9 }, REMOVE = { hope: 3, fear: 2 };
    const keptAsWas = r => r.placed && r.standing && r.visibility === "obvious" && r.rowNames && r.cardSays && r.gmsTold;
    const gmWritten = await rerollOverTrace("SEC dynamic, GM-written", "edited", RETUNE);
    await settle(300);
    check("SECURITY: the GM's Reroll does not re-rate a trace a GM has written on; the card and the GMs say so",
        keptAsWas(gmWritten), JSON.stringify(gmWritten));
    const foundTrace = await rerollOverTrace("SEC dynamic, found", "found", REMOVE);
    await settle(300);
    check("SECURITY: the GM's Reroll does not remove a trace somebody has already found",
        keptAsWas(foundTrace), JSON.stringify(foundTrace));
    const stale = await rerollOverTrace("SEC dynamic, stale", "stale", RETUNE);
    await settle(300);
    check("SECURITY: the GM's Reroll does not re-rate a trace older than a Reroll can reach",
        keptAsWas(stale), JSON.stringify(stale));
    const freshRetuned = await rerollOverTrace("SEC dynamic, fresh re-rated", "fresh", RETUNE);
    await settle(300);
    const freshRemoved = await rerollOverTrace("SEC dynamic, fresh removed", "fresh", REMOVE);
    await settle(300);
    check("control: the same Reroll re-rates and removes a fresh trace nobody has found, and tells the GMs nothing",
        freshRetuned.placed && freshRetuned.standing && freshRetuned.visibility === "hidden" && !freshRetuned.cardSays && !freshRetuned.gmsTold
        && freshRemoved.placed && !freshRemoved.standing && !freshRemoved.cardSays && !freshRemoved.gmsTold,
        JSON.stringify({ freshRetuned, freshRemoved }));

    phase("a Listen the GM's Reroll answers", { flow: "reroll" });
    /*
     * 7l. What a Listen's Reroll hears (E08+E28 fix r1-G4, 04.10.2026; the round-1 review's S3).
     * Since C4a the replay ran on the GM and built the lines with the GM's knowledge, so a death
     * the GMs' store held and nobody had found left the body out of the room: the review's probe
     * A - p1's own browser named Botan Kage in the Cafeteria, and p1's Listen rerolled from 14 to
     * 19 came back "In Cafeteria: empty". The GM answers the dice and the rooms now, and p1's
     * browser hears them (reroll.mjs `heardLines`). p1 throws Aiko's Listen at Botan's room (13),
     * the GM holds Botan's death in its store only and makes the Reroll throw 20 (the named band),
     * and p1 asks it as the Call does. Read: what p1's own browser names there, and p1's card.
     */
    const rooms = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        return { here: M.roomOfActor(game.actors.get("${ids.aiko}")), there: M.roomOfActor(game.actors.get("${ids.botan}")) };`);
    // A Listen paid for, as the action pays before its roll (a roll is an action's since fix r2-H1).
    const listened = await p1.eval(`${payFor(ids.aiko)}
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        try { const A = await import("${repoUrl}/scripts/action-rolls.mjs");
            const o = await A.rollTrait(game.actors.get("${ids.aiko}"), "shadow", { actionKey: "listen",
                context: { room: "${rooms.here}", target: "${rooms.there}" } });
            return o?.raw?.message?.id ?? null; }
        finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
    await settle(1500);
    const armed = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const { isDeadForGm } = await import("${repoUrl}/scripts/settings.mjs");
        const who = game.actors.get("${ids.aiko}"), row = S.rerollBookmarkStore.get(who.id);
        const m = game.messages.get(row?.messageId ?? "");
        class Thrown {
            constructor(formula, data = {}, options = {}) { this._formula = formula; this.options = options; this.faces = { hope: 9, fear: 4 }; }
            get dHope() { return { total: this.faces.hope }; } get dFear() { return { total: this.faces.fear }; }
            get total() { return this.faces.hope + this.faces.fear; }
            get withHope() { return this.faces.hope > this.faces.fear; } get withFear() { return this.faces.hope < this.faces.fear; }
            get isCritical() { return this.faces.hope === this.faces.fear; }
            async reroll() { const r = new Thrown(this._formula, {}, this.options); r.faces = { hope: 11, fear: 9 }; return r; }
            toJSON() { return { class: "DualityRoll", formula: this._formula, total: this.total, evaluated: true }; }
        }
        if (m) Object.defineProperty(m, "rolls", { configurable: true, get: () => [new Thrown("1d12 + 1d12", {}, {})] });
        globalThis.__secListenHope = who.system.resources.hope.value;
        await trustedWrite(who, { "system.resources.hope.value": 6 }, { reason: "gmRuling" });
        await S.deathStore.patch("${ids.botan}", { chapter: 99, day: 1, timeOfDay: "night", at: Date.now(), keepBullets: true, known: [] });
        return { row: row?.messageId === "${listened}" && row?.actionKey === "listen" && row?.claims?.target === "${rooms.there}",
            gmDead: isDeadForGm(game.actors.get("${ids.botan}")) };`, { timeout: 30000 });
    await settle(500);
    const heard = await p1.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const C = await import("${repoUrl}/scripts/calls.mjs");
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        const sees = M.occupantsOf("${rooms.there}", aiko).map(a => a.name);
        const at = game.messages.contents.length;
        const made = Boolean(await C.spendHopeCall(aiko, "reroll"));
        await new Promise(r => setTimeout(r, 800));
        const card = game.messages.contents.slice(at).map(m => String(S.contentOf(m) ?? "")).find(t => t.includes("Reroll")) ?? null;
        return { sees, made, card: card ? card.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 400) : null };`, { timeout: 90000 });
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const m = game.messages.get("${listened}");
        if (m) { delete m.rolls; await m.delete(); }
        await S.deathStore.drop("${ids.botan}");
        if (S.rerollBookmarkStore.has("${ids.aiko}")) await S.rerollBookmarkStore.drop("${ids.aiko}");
        await trustedWrite(game.actors.get("${ids.aiko}"), { "system.resources.hope.value": globalThis.__secListenHope }, { reason: "gmRuling" });
        delete globalThis.__secListenHope;
        return true;`, { timeout: 30000 });
    await settle(300);
    check("SECURITY: a Listen's Reroll names whom the roller's own browser hears - a death only the GMs hold is not told by it",
        Boolean(listened) && armed.row && armed.gmDead && heard.made && heard.sees.includes("Botan Kage")
        && Boolean(heard.card) && heard.card.includes("Botan Kage"), JSON.stringify({ rooms, listened, armed, heard }));

    /*
     * 7o. A CONSOLE'S STARTING SHEET (E29 C2, 05.10.2026; audit S03-45, its code part). Setting
     * a student up writes the maxima, Health, Sanity and Hope and stamps the season's baseline;
     * putting a sheet back to that baseline writes the traits and the advance counter. Both are on
     * a player's console - `game.drpg.initCharacter`, and an import - and only the sheet's wand
     * and the season reset in front of them were a GM's. The GM gives Aiko a sheet each call would
     * change (Hope 4, Health 1 marked, two advances, a baseline whose agility is -1), p1 calls both
     * on her, and nothing moves on the GM or on p1, and p1 is told twice. What she held is put back
     * whatever the check says. Red at 025bf9e: both calls answered and wrote.
     */
    phase("a console's starting sheet");
    const readStart = `const a = game.actors.get("${ids.aiko}"); const r = a.system.resources;
        return { hp: [r.hitPoints.value, r.hitPoints.max], stress: [r.stress.value, r.stress.max], hope: r.hope.value,
            agility: a.system.traits.agility.value, advances: a.getFlag("${MOD}", "advances") ?? null,
            baseline: a.getFlag("${MOD}", "sheetAtStart") ?? null };`;
    const startWas = await gm.eval(`const a = game.actors.get("${ids.aiko}"); const r = a.system.resources;
        const was = { hope: r.hope.value, hp: r.hitPoints.value, hpMax: r.hitPoints.max, stressMax: r.stress.max,
            agility: a.system.traits.agility.value, advances: a.getFlag("${MOD}", "advances"), sheetAtStart: a.getFlag("${MOD}", "sheetAtStart") };
        await a.update({ "system.resources.hope.value": 4, "system.resources.hitPoints.value": 1, "flags.${MOD}.advances": 2,
            "flags.${MOD}.sheetAtStart": { traits: { agility: -1 }, experiences: {}, at: 1 } });
        return was;`);
    let startSheet = null;
    try {
        const startBefore = await gm.eval(readStart);
        await p1.eval(`const a = game.actors.get("${ids.aiko}"); const end = Date.now() + 6000;
            while (a.getFlag("${MOD}", "advances") !== 2 && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return true;`);
        const called = await p1.eval(`const a = game.actors.get("${ids.aiko}"); const C = await import("${repoUrl}/scripts/character.mjs");
            const from = globalThis.__notifications.length;
            const init = await game.drpg.initCharacter(a);
            const restore = await C.restoreStartingSheet(a);
            const told = globalThis.__notifications.slice(from).filter(n => n.msg === game.i18n.localize("DRPG.Panel.gmOnly")).length;
            return { init: init === null, restore: restore === null, told };`);
        await settle(1000);
        startSheet = { startBefore, called, after: await Promise.all([gm, p1].map(c => c.eval(readStart))) };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}"); const was = ${JSON.stringify(startWas ?? {})};
            await a.update({ "system.resources.hope.value": was.hope, "system.resources.hitPoints.value": was.hp,
                "system.resources.hitPoints.max": was.hpMax, "system.resources.stress.max": was.stressMax, "system.traits.agility.value": was.agility });
            for (const key of ["advances", "sheetAtStart"]) {
                await a.unsetFlag("${MOD}", key);
                if (was[key] !== undefined && was[key] !== null) await a.setFlag("${MOD}", key, was[key]);
            }
            return true;`);
    }
    check("SECURITY: a player's console sets nobody up and puts no sheet back - initCharacter and restoreStartingSheet refuse on the caller's browser, write nothing, and say so",
        Boolean(startSheet) && startSheet.called.init && startSheet.called.restore && startSheet.called.told === 2
            && startSheet.after.every(seen => JSON.stringify(seen) === JSON.stringify(startSheet.startBefore)),
        JSON.stringify(startSheet));

    /*
     * WHAT A ROLL IS BUILT FROM, WRITTEN BY HAND (E29 C3, 05.10.2026; audit S02-41; the plan's 2.4).
     * p1's console steps past its own browser's guard with the option the guard stands aside for
     * (resource-guard.mjs SYSTEM_WRITE) and, in one write, raises Aiko's Agility by 3 and her Health
     * maximum by 2, sets a roll rule (`system.rules.dualityRoll.defaultHopeDice` 20) and makes her a
     * Monokuma (a flag guardSabotageRoom, projectWithinReach and expectedFor read); then it puts an
     * effect with a roll bonus of 5 on her. The primary GM puts each back (sheet-audit.mjs): every
     * client reads the sheet as it was, p1 is told once per write - its notice naming the first field
     * in its language - and the GMs are whispered once per write. Until C3 all of it stood.
     */
    phase("a console's sheet", { flow: "sheet-audit" });
    const readSheet = `const a = game.actors.get("${ids.aiko}");
        return { agility: a.system.traits.agility.value, hpMax: a.system.resources.hitPoints.max,
            hopeDice: a.system.rules?.dualityRoll?.defaultHopeDice ?? null, monokuma: a.getFlag("${MOD}", "monokuma") ?? null,
            effects: a.effects.contents.filter(e => e.name === "SEC console bonus").length };`;
    // A GM whisper is a private card: its flags other than the document's own are read through secret.mjs's `cardFlag`.
    const whispered = `const S = await import("${repoUrl}/scripts/secret.mjs");
        return game.messages.contents.filter(m => S.cardFlag(m, "sheetAudit") === "${ids.aiko}").length;`;
    const sheetWas = await gm.eval(readSheet);
    let consoleSheet = null;
    try {
        const whispersFrom = await gm.eval(whispered);
        await p1.eval(`globalThis.__sheetTold = 0; globalThis.__notifications.length = 0;
            if (!globalThis.__sheetToldHook) {
                globalThis.__sheetToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused" && payload.reason === "sheetPutBack") globalThis.__sheetTold++; });
            }
            const a = game.actors.get("${ids.aiko}");
            await a.update({ "system.traits.agility.value": ${sheetWas.agility + 3}, "system.resources.hitPoints.max": ${sheetWas.hpMax + 2},
                "system.rules.dualityRoll.defaultHopeDice": 20, "flags.${MOD}.monokuma": true }, { drpgAutomated: true });
            return true;`);
        const untilBack = test => `const end = Date.now() + 6000; const read = async () => { ${readSheet} };
            while (!(${test})(await read()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return read();`;
        await gm.eval(untilBack(`s => s.agility === ${sheetWas.agility} && s.monokuma === null`));
        await settle(800);
        const written = { after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readSheet))),
            told: await p1.eval(`return globalThis.__sheetTold;`),
            named: await p1.eval(`return globalThis.__notifications.some(n => n.msg.includes(game.i18n.localize("DRPG.Audit.field.traits")));`),
            whispers: (await gm.eval(whispered)) - whispersFrom };
        await p1.eval(`await game.actors.get("${ids.aiko}").createEmbeddedDocuments("ActiveEffect", [{ name: "SEC console bonus",
            system: { changes: [{ key: "system.bonuses.roll.bonus", type: "add", value: 5 }] } }]); return true;`);
        await settle(400);
        await gm.eval(untilBack(`s => s.effects === 0`));
        await settle(800);
        const effect = { after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readSheet))),
            told: await p1.eval(`return globalThis.__sheetTold;`), whispers: (await gm.eval(whispered)) - whispersFrom };
        consoleSheet = { sheetWas, written, effect };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}"); const U = await import("${repoUrl}/scripts/utils.mjs");
            const was = ${JSON.stringify(sheetWas)};
            const fix = {};
            if (a.system.traits.agility.value !== was.agility) fix["system.traits.agility.value"] = was.agility;
            if (a.system.resources.hitPoints.max !== was.hpMax) fix["system.resources.hitPoints.max"] = was.hpMax;
            if (a._source.system.rules !== undefined && was.hopeDice === null) fix["system.rules"] = U.forcedDeletion();
            if (Object.keys(fix).length) await a.update(fix);
            if (a.getFlag("${MOD}", "monokuma") !== undefined && was.monokuma === null) await a.unsetFlag("${MOD}", "monokuma");
            const left = a.effects.contents.filter(e => e.name === "SEC console bonus").map(e => e.id);
            if (left.length) await a.deleteEmbeddedDocuments("ActiveEffect", left);
            return true;`);
    }
    const sheetAsWas = seen => seen.agility === sheetWas.agility && seen.hpMax === sheetWas.hpMax && seen.hopeDice === null && seen.monokuma === null;
    check("SECURITY: a player's console raising its statistic and Health maximum, setting a roll rule and making itself a Monokuma is put back on every client, told to it once in its words and whispered to the GMs once",
        Boolean(consoleSheet) && consoleSheet.written.after.every(sheetAsWas) && consoleSheet.written.told === 1
            && consoleSheet.written.named === true && consoleSheet.written.whispers === 1,
        JSON.stringify(consoleSheet), { flow: "sheet-audit" });
    check("SECURITY: an effect a player's console puts a roll bonus on is taken off on every client, told to it once and whispered to the GMs once",
        Boolean(consoleSheet) && consoleSheet.effect.after.every(seen => seen.effects === 0) && consoleSheet.effect.told === 2
            && consoleSheet.effect.whispers === 2,
        JSON.stringify(consoleSheet?.effect ?? null), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S HOPE (E29 C4, 05.10.2026; audit S02-41; the plan's 2.4, 2.5, 2.7). Aiko's Hope at 2, p1's
     * console raises it to 6 by hand; then asks Daggerheart's relay for 6 with no roll behind it; then raises it
     * to 6 again and asks the GM for a Resolve (3 Hope) at once; then writes the forged 6 and a Call's payment
     * (6 -> 3, stamped `call`) back to back, before the GMs have judged either. Expected: the first put back on
     * every client, told to p1 once and whispered to the GMs once; the relay's refused (code `relay`) with
     * nothing written; the Resolve refused and nothing paid (2); the last ends at 0 on every client - a
     * put-back is a delta, so the payment comes out of the Hope Aiko really had, not out of the forged four.
     * Before C4 the first two stood (6, 6) and a Resolve bought at once left 3; nothing judged a crossing then,
     * so by reading it ended at 3 too.
     */
    phase("a console's Hope", { flow: "sheet-audit" });
    const readHope = `return game.actors.get("${ids.aiko}").system.resources.hope.value;`;
    const hopeWas = await gm.eval(`const a = game.actors.get("${ids.aiko}");
        const was = { hope: a.system.resources.hope.value, calls: a.getFlag("${MOD}", "pendingCall") ?? null };
        await a.update({ "system.resources.hope.value": 2 }); return was;`);
    const untilHope = n => gm.eval(`const end = Date.now() + 6000; const read = () => { ${readHope} };
        while (read() !== ${n} && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return read();`);
    let consoleHope = null;
    try {
        await settle(400);
        const whispersFrom = await gm.eval(whispered);
        await p1.eval(`globalThis.__hopeTold = [];
            if (!globalThis.__hopeToldHook) {
                globalThis.__hopeToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__hopeTold.push(payload.reason); });
            }
            await game.actors.get("${ids.aiko}").update({ "system.resources.hope.value": 6 }); return true;`);
        await untilHope(2);
        await settle(800);
        const raised = { after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readHope))),
            told: await p1.eval(`return globalThis.__hopeTold.slice();`), whispers: (await gm.eval(whispered)) - whispersFrom };
        await p1.eval(`globalThis.__hopeTold.length = 0;
            game.socket.emit("system.daggerheart", { action: "DhGMUpdate", data: { action: "DhGMUpdateDocument",
                uuid: game.actors.get("${ids.aiko}").uuid, data: { "system.resources.hope.value": 6 } } }); return true;`);
        await settle(1500);
        const relayed = { after: await gm.eval(readHope), told: await p1.eval(`return globalThis.__hopeTold.slice();`) };
        const bought = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
            const a = game.actors.get("${ids.aiko}");
            globalThis.__hopeTold.length = 0;
            const forged = a.update({ "system.resources.hope.value": 6 });
            const res = await B.requestArmCall(a.id, { key: "determination", kind: "hope", grants: "trait", amount: null, from: a.id, nonce: "SECFORGEDRESOLVE" });
            await forged;
            return Boolean(res?.ok && res.value);`, { timeout: 30000 });
        await untilHope(2);
        await settle(1200);
        const spent = { bought, after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readHope))),
            armed: await gm.eval(`const f = game.actors.get("${ids.aiko}").getFlag("${MOD}", "pendingCall");
                return (Array.isArray(f) ? f : f ? [f] : []).some(c => c?.nonce === "SECFORGEDRESOLVE");`),
            told: await p1.eval(`return globalThis.__hopeTold.slice();`) };
        await p1.eval(`const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
            const a = game.actors.get("${ids.aiko}");
            await Promise.all([a.update({ "system.resources.hope.value": 6 }), trustedWrite(a, { "system.resources.hope.value": 3 }, { reason: "call" })]);
            return true;`);
        await untilHope(0);
        await settle(1200);
        const crossed = { after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readHope))) };
        consoleHope = { raised, relayed, spent, crossed };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await a.update({ "system.resources.hope.value": ${hopeWas.hope} });
            const calls = ${JSON.stringify(hopeWas.calls)};
            if (calls === null) await a.unsetFlag("${MOD}", "pendingCall"); else await a.setFlag("${MOD}", "pendingCall", calls);
            return true;`);
    }
    check("SECURITY: a player's console raising its own Hope is put back on every client, told to it once and whispered to the GMs once",
        Boolean(consoleHope) && consoleHope.raised.after.every(n => n === 2) && JSON.stringify(consoleHope.raised.told) === JSON.stringify(["sheetPutBack"])
            && consoleHope.raised.whispers === 1, JSON.stringify(consoleHope?.raised ?? null), { flow: "sheet-audit" });
    check("RELAY: a player's Hope raised through Daggerheart's relay with no roll behind it is refused, nothing written, and the player told",
        Boolean(consoleHope) && consoleHope.relayed.after === 2 && consoleHope.relayed.told.includes("relay"),
        JSON.stringify(consoleHope?.relayed ?? null), { flow: "sheet-audit" });
    /* E29 C8 (05.10.2026): the Resolve is bought on the GM now, which asks the Hope it holds once the audit has judged the
       forged write (gm-bridge.mjs `call.arm`'s `prepare`): 2 of 3, refused, nothing paid. ASKED OF THE GM, NOT OF THE SHEET
       (E29 fix r1-G9; the round-1 review's cor m5). Until the fix this step bought the Resolve by the sheet's own road
       (`spendHopeCall`), which reads p1's own Hope first: when the audit's put-back reached p1 before that reading, p1's
       browser refused it and the GM was never asked - a race, red 5 times under C4's reading (0, the C4-era payment by a
       delta) and since C8 green on either road (G7's and G8's runs), so which road it measured was chance. The console asks the GM itself now,
       as a console can, in the same breath as the forged write, and the GM's reading is the one measured. The payment by a delta that C4's check meant is the
       crossing below: the forged 6 and the payment sent from one call, so both land before the audit's first put-back
       (e29run/r1g9probe: 0 on every client in 10 runs of 10; the GM's hooks, read in 5 of them: p1's 6, p1's 3, the
       put-back to 2, then the payment's correction to 0). */
    check("SECURITY: a forged Hope spent at once on a 3-Hope Call is refused - nothing paid, 2 on every client",
        Boolean(consoleHope) && consoleHope.spent.bought === false && consoleHope.spent.armed === false && consoleHope.spent.after.every(n => n === 2),
        JSON.stringify(consoleHope?.spent ?? null), { flow: "sheet-audit" });
    check("SECURITY: a forged Hope and a Call's payment written back to back from a console - the rise put back by its delta, the payment kept: 0 on every client",
        Boolean(consoleHope) && consoleHope.crossed.after.every(n => n === 0),
        JSON.stringify(consoleHope?.crossed ?? null), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S HEALTH AND ACTIONS (E29 C5, 05.10.2026; audit S02-41; the plan's 2.4, 2.8). Aiko at two
     * Health marks and 1 action; p1's console heals both marks and raises the actions by 2, past its own
     * browser's guard. Expected: the write stands on every client, one card reaches the GMs with Undo and
     * Keep, and p1 is told nothing and holds neither the card's words nor its row; the GM's Undo, clicked on the card as its browser
     * draws it, brings the marks and the actions back on every client and decides the row. Before C5 the
     * write stood, listed, with no card.
     */
    phase("a console's Health and actions", { flow: "sheet-audit" });
    const readMeans = `const r = game.actors.get("${ids.aiko}").system.resources; return [r.hitPoints.value, r.actions.value];`;
    const meansWas = await gm.eval(`const a = game.actors.get("${ids.aiko}"); const r = a.system.resources;
        const was = { hp: r.hitPoints.value, hpMax: r.hitPoints.max, actions: r.actions.value, actionsMax: r.actions.max };
        await a.update({ "system.resources.hitPoints.value": 2, "system.resources.actions.value": 1 }); return was;`);
    // The flagged row of this phase, on the GM, once the audit has judged what it heard; and the card as the GM's chat draws it.
    const flaggedOnGm = from => `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const rows = () => Object.entries(S.sheetWriteStore?.entries?.() ?? {}).filter(([, r]) => r?.actorId === "${ids.aiko}" && r.verdict === "flagged" && r.at >= ${from});
        const end = Date.now() + 8000;
        while (!rows().length && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await A.sheetAuditIdle?.();
        const [id, row] = rows()[0] ?? [];
        const card = game.messages.get(row?.messageId ?? "");
        const drawn = () => {
            const el = document.createElement("li");
            el.innerHTML = '<div class="message-content"><p class="notes" data-drpg-secret>-</p></div>';
            if (card) Hooks.callAll("renderChatMessageHTML", card, el);
            return el;
        };`;
    let consoleMeans = null;
    try {
        await settle(400);
        const from = await gm.eval(`return Date.now();`);
        await p1.eval(`globalThis.__meansTold = [];
            if (!globalThis.__meansToldHook) {
                globalThis.__meansToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__meansTold.push(payload.reason); });
            }
            await game.actors.get("${ids.aiko}").update({ "system.resources.hitPoints.value": 0, "system.resources.actions.value": 3 }, { drpgAutomated: true });
            return true;`);
        const asked = await gm.eval(`${flaggedOnGm(from)}
            return { rows: rows().length, id: id ?? null, change: row?.change ?? null, card: row?.messageId ?? null,
                buttons: [...drawn().querySelectorAll("[data-drpg-audit]")].map(b => b.dataset.drpgAudit) };`);
        await settle(800);
        const stood = { after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readMeans))),
            told: await p1.eval(`return globalThis.__meansTold.slice();`),
            // Every browser receives a whisper's document (utils.mjs `gmReport`'s note); its words and its flags are the GMs'.
            p1Card: await p1.eval(`const S = await import("${repoUrl}/scripts/secret.mjs"); const m = game.messages.get(${JSON.stringify(asked.card ?? "")});
                return { words: m ? S.contentOf(m).includes("drpg-audit") : false, row: m ? S.cardFlag(m, "sheetFlagged") ?? null : null };`) };
        const undone = await gm.eval(`${flaggedOnGm(from)}
            drawn().querySelector('[data-drpg-audit="undo"]')?.click();
            const read = () => { ${readMeans} };
            const done = Date.now() + 8000;
            while (!(read()[0] === 2 && read()[1] === 1 && S.sheetWriteStore.get(id)?.decided) && Date.now() < done) await new Promise(r => setTimeout(r, 100));
            await A.sheetAuditIdle?.();
            const words = (await import("${repoUrl}/scripts/secret.mjs")).contentOf(card);
            return { decided: S.sheetWriteStore.get(id)?.decided ?? null, me: game.user.id, undoneLine: words.includes("drpg-audit-undone"),
                buttonsLeft: words.includes("data-drpg-audit") };`);
        await settle(800);
        consoleMeans = { meansWas, asked, stood, undone, after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readMeans))) };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await a.update({ "system.resources.hitPoints.value": ${meansWas.hp}, "system.resources.actions.value": ${meansWas.actions} });
            return true;`);
    }
    const HPV = "system.resources.hitPoints.value", ACTV = "system.resources.actions.value";
    check("SECURITY: a player's console healing its student's two Health marks and raising its actions by 2 stands, flagged to the GMs on one card with Undo and Keep, and nothing reaches the player",
        Boolean(consoleMeans) && meansWas.hpMax >= 2 && meansWas.actionsMax >= 3 && consoleMeans.asked.rows === 1
            && JSON.stringify(consoleMeans.asked.change?.[HPV]) === "[2,0]" && JSON.stringify(consoleMeans.asked.change?.[ACTV]) === "[1,3]"
            && JSON.stringify(consoleMeans.asked.buttons) === JSON.stringify(["undo", "keep"])
            && consoleMeans.stood.after.every(v => JSON.stringify(v) === "[0,3]") && consoleMeans.stood.told.length === 0
            && consoleMeans.stood.p1Card?.words === false && consoleMeans.stood.p1Card.row === null,
        JSON.stringify({ meansWas, asked: consoleMeans?.asked ?? null, stood: consoleMeans?.stood ?? null }), { flow: "sheet-audit" });
    check("SECURITY: Undo on the GMs' card puts the Health marks and the actions back on every client and decides the row, by that GM",
        Boolean(consoleMeans) && consoleMeans.after.every(v => JSON.stringify(v) === "[2,1]") && consoleMeans.undone.decided?.how === "undo"
            && consoleMeans.undone.decided.by === consoleMeans.undone.me && JSON.stringify([...(consoleMeans.undone.decided.undone ?? [])].sort()) === JSON.stringify([ACTV, HPV].sort())
            && consoleMeans.undone.decided.moved?.length === 0 && consoleMeans.undone.undoneLine === true && consoleMeans.undone.buttonsLeft === false,
        JSON.stringify({ undone: consoleMeans?.undone ?? null, after: consoleMeans?.after ?? null }), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S ITEMS (E29 C6, 05.10.2026; audit S08-57; the plan's 2.6). The GM gives Aiko a bandage (one
     * of it), a Tool, and a stash in a room she does not stand in. p1's console raises the bandage's count to 3,
     * and writes the Tool into that stash - its location and its room, as `stow` writes them - past its own
     * browser's checks. Expected: both put back on every client that holds the items, with a row each on the
     * GMs and p1 told once for each. Before C6 both stood.
     */
    phase("a console's items", { flow: "sheet-audit" });
    const itemsSet = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const V = await import("${repoUrl}/scripts/vault.mjs"); const M = await import("${repoUrl}/scripts/movement.mjs");
        const aiko = game.actors.get("${ids.aiko}"), here = M.roomOfActor(aiko);
        const room = M.allRooms().find(name => name !== here && !V.stashIn(name, aiko.id)) ?? null;
        if (room) await V.setStash(room, aiko.id, { present: true });
        const bandage = await INV.grantItem(aiko, { name: "E29 C6 30 bandage", category: "usable", tier: 1, goal: "healing", override: true, quiet: true });
        const tool = await INV.grantItem(aiko, { name: "E29 C6 30 tool", category: "tool", tier: 1, override: true, quiet: true });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return { here, hereMine: here ? Boolean(V.stashIn(here, aiko.id)) : null, room, mine: room ? Boolean(V.stashIn(room, aiko.id)) : false, bandage: bandage?.id ?? null, tool: tool?.id ?? null, from: Date.now() };`,
        { timeout: 30000 });
    const readItems = `const a = game.actors.get("${ids.aiko}"), b = a?.items.get("${itemsSet.bandage}"), t = a?.items.get("${itemsSet.tool}");
        return b && t ? [b.system.quantity, t.getFlag("${MOD}", "location") ?? "carried", t.getFlag("${MOD}", "stashRoom") ?? null] : null;`;
    let consoleItems = null;
    try {
        await settle(400);
        await p1.eval(`globalThis.__itemsTold = [];
            if (!globalThis.__itemsToldHook) {
                globalThis.__itemsToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__itemsTold.push(payload.reason); });
            }
            const a = game.actors.get("${ids.aiko}");
            await a.items.get("${itemsSet.bandage}")?.update({ "system.quantity": 3 }, { drpgAutomated: true });
            await a.items.get("${itemsSet.tool}")?.update({ "flags.${MOD}.location": "vault", "flags.${MOD}.stashRoom": ${JSON.stringify(itemsSet.room)} }, { drpgAutomated: true });
            return true;`);
        const judged = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
            const rows = () => Object.values(S.sheetWriteStore?.entries?.() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${itemsSet.from}
                && ["${itemsSet.bandage}", "${itemsSet.tool}"].includes(r.itemId));
            const end = Date.now() + 8000;
            while (rows().length < 2 && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            await A.sheetAuditIdle?.();
            return rows().map(r => r.verdict + ":" + Object.keys(r.change ?? {}).map(k => k.split(".").slice(2).join(".")).sort().join(",")).sort();`);
        await settle(800);
        consoleItems = { judged, after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readItems))), told: await p1.eval(`return globalThis.__itemsTold.slice();`) };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            for (const id of ["${itemsSet.bandage}", "${itemsSet.tool}"]) await a.items.get(id)?.delete();
            if (${JSON.stringify(itemsSet.room)}) await (await import("${repoUrl}/scripts/vault.mjs")).setStash(${JSON.stringify(itemsSet.room)}, a.id, { present: false });
            return true;`);
    }
    check("SECURITY: a player's console raising a bandage's count, and stashing a Tool from a room with no stash of its student's, is put back on every client, with a row each and the player told",
        Boolean(consoleItems) && Boolean(itemsSet.here) && itemsSet.hereMine === false && Boolean(itemsSet.room) && itemsSet.mine && Boolean(itemsSet.bandage) && Boolean(itemsSet.tool)
            && JSON.stringify(consoleItems.judged) === JSON.stringify([`putBack:flags.${MOD}.location,flags.${MOD}.stashRoom`, "putBack:system.quantity"])
            && consoleItems.after[0] !== null && consoleItems.after[1] !== null
            && consoleItems.after.every(v => v === null || JSON.stringify(v) === JSON.stringify([1, "carried", null]))
            && JSON.stringify(consoleItems.told) === JSON.stringify(["sheetPutBack", "sheetPutBack"]),
        JSON.stringify({ itemsSet, consoleItems }), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S ITEM RECORDS (E29 fix r1-G2, 05.10.2026; review round 1 sec M3 = cor M5, sec B2). p1's
     * console writes `roles` and `usableKind` on a Tool Aiko carries - what it serves as, what a usable
     * restores - and, once that is put back on its browser, replaces the Tool's module flags whole with
     * another category and tier (v14's forced replacement, as the harness models it). Expected: both put
     * back on every client that holds the Tool (the GM's and p1's at least, as the items check above reads
     * them), a row each, and none reads it as a crime tool. The review's probe
     * on 69deef0 measured the first standing with no row and the GM reading a crime tool; here at
     * d7bf69d (05.10.2026, e29run/r1g2red) both stood on every client with no row - a crime tool, then
     * a tier-3 weapon.
     */
    phase("a console's item records", { flow: "sheet-audit" });
    const recordsSet = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const tool = await INV.grantItem(game.actors.get("${ids.aiko}"), { name: "E29 G2 30 tool", category: "tool", tier: 1, override: true, quiet: true });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return { tool: tool?.id ?? null, from: Date.now() };`);
    const readRecords = `const INV = await import("${repoUrl}/scripts/inventory.mjs"), t = game.actors.get("${ids.aiko}")?.items.get("${recordsSet.tool}");
        return t ? [t.getFlag("${MOD}", "roles") ?? null, t.getFlag("${MOD}", "usableKind") ?? null, t.getFlag("${MOD}", "category"), t.getFlag("${MOD}", "tier"),
            INV.servesAs(t, "crimeTool")] : null;`;
    const recordRows = n => `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const rows = () => Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.itemId === "${recordsSet.tool}" && r.at >= ${recordsSet.from});
        const end = Date.now() + 8000;
        while (rows().length < ${n} && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await A.sheetAuditIdle();
        return rows().map(r => r.verdict + ":" + Object.keys(r.change ?? {}).map(k => k.split(".").pop()).sort().join(",")).sort();`;
    let consoleRecords = null;
    try {
        await settle(400);
        await p1.eval(`await game.actors.get("${ids.aiko}").items.get("${recordsSet.tool}")?.update({ "flags.${MOD}.roles": ["crimeTool", "cleaningTool"],
            "flags.${MOD}.usableKind": "stress" }, { drpgAutomated: true }); return true;`);
        const first = await gm.eval(recordRows(1));
        await p1.eval(`const t = game.actors.get("${ids.aiko}").items.get("${recordsSet.tool}"), end = Date.now() + 6000;
            while (t?.getFlag("${MOD}", "roles") !== undefined && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            const f = foundry.utils.deepClone(t._source.flags["${MOD}"]); f.category = "weapon"; f.tier = 3;
            await t.update({ "flags.${MOD}": foundry.data.operators.ForcedReplacement.create(f) }, { drpgAutomated: true }); return true;`);
        const judged = await gm.eval(recordRows(2));
        await settle(800);
        consoleRecords = { first, judged, after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readRecords))) };
    } finally {
        await gm.eval(`await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await game.actors.get("${ids.aiko}").items.get("${recordsSet.tool}")?.delete(); return true;`);
    }
    check("SECURITY: a player's console writing a Tool's roles and usable kind, then replacing its module flags whole with another category and tier, is put back on every client with a row each",
        Boolean(consoleRecords) && Boolean(recordsSet.tool) && JSON.stringify(consoleRecords.first) === JSON.stringify(["putBack:roles,usableKind"])
            && JSON.stringify(consoleRecords.judged) === JSON.stringify(["putBack:category,tier", "putBack:roles,usableKind"])
            && consoleRecords.after[0] !== null && consoleRecords.after[1] !== null
            && consoleRecords.after.every(v => v === null || JSON.stringify(v) === JSON.stringify([null, null, "tool", 1, false])),
        JSON.stringify({ recordsSet, consoleRecords }), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S WRITES IN A ROW (E29 fix r1-G1, 05.10.2026; review round 1 sec B1 = cor B1, cor M6). p1's
     * console sends its writes back to back, so the later ones land on the GM while the judge is still
     * putting the first back: a forged Hope, then Agility raised; a forged Hope, then the Monokuma flag, then
     * Agility raised alone; a forged Hope awaited, then the GM's roll penalty deleted. Expected: each write
     * put back on every client, with a row of its own. Then a Hope spent behind an Agility being put back,
     * the GM's own Hope written as the spend lands (a GM hook, as the review's probe wrote it): the GM's Hope
     * stands on every client and in the GMs' mark. Before the fix the later writes stood - the Monokuma
     * flag, and with it every write after it - and the spend's judgement wrote 4 over the GM's Hope (the
     * reviews' probes on 69deef0, which wrote 9 where this writes 6). Measured here at 65e5aec (05.10.2026,
     * e29run/r1g1red): Agility 4 for 1 on every client and in the mark, one row; the flag on every client,
     * then the lone Agility at 4; the penalty gone everywhere, one row; Hope 4 everywhere, 6 in the mark.
     */
    phase("a console's writes in a row", { flow: "sheet-audit" });
    const readRow = `const a = game.actors.get("${ids.aiko}"); return { agility: a.system.traits.agility.value, hope: a.system.resources.hope.value,
        monokuma: a.getFlag("${MOD}", "monokuma") ?? null, penalty: a.effects.contents.filter(e => e.name === "SEC G1 penalty").length };`;
    const audited = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();`;
    const markRow = `${audited} const m = S.sheetMarkStore.get("${ids.aiko}");
        return { agility: m?.traits?.agility?.value ?? null, hope: m?.resources?.hope?.value ?? null, monokuma: m?.flags?.monokuma ?? null };`;
    const rowsOf = from => `${audited} return Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${from})
        .map(r => r.verdict + ":" + Object.keys(r.change ?? {}).map(k => k.replace(/^effects\\..+$/, "effects.<id>")).join(",")).sort();`;
    const rowWas = await gm.eval(`${audited} const a = game.actors.get("${ids.aiko}");
        return { agility: a.system.traits.agility.value, hope: a.system.resources.hope.value, monokuma: a.getFlag("${MOD}", "monokuma") ?? null };`);
    // Aiko as she was, the test's penalty gone and Hope at `hope`; answers the time, for the rows written after it.
    const rowBack = hope => gm.eval(`${audited} const a = game.actors.get("${ids.aiko}"), was = ${JSON.stringify(rowWas)};
        if (a.getFlag("${MOD}", "monokuma") !== undefined && was.monokuma === null) await a.unsetFlag("${MOD}", "monokuma");
        const left = a.effects.contents.filter(e => e.name === "SEC G1 penalty").map(e => e.id);
        if (left.length) await a.deleteEmbeddedDocuments("ActiveEffect", left);
        const fix = { "system.traits.agility.value": was.agility, "system.resources.hope.value": ${hope ?? "was.hope"} };
        if (a.system.traits.agility.value !== fix["system.traits.agility.value"] || a.system.resources.hope.value !== fix["system.resources.hope.value"]) await a.update(fix);
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return Date.now();`);
    // Up to 6 s for the GM's reading to come out as `test` says, every judgement finished, then every client's.
    const settledRow = async test => {
        await gm.eval(`const end = Date.now() + 6000; const read = async () => { ${readRow} };
            while (!(${test})(await read()) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
        await settle(800);
        return Promise.all([gm, p1, p2, p3].map(c => c.eval(readRow)));
    };
    let inRow = null;
    try {
        const fromA = await rowBack(2);
        await p1.eval(`const a = game.actors.get("${ids.aiko}");
            a.update({ "system.resources.hope.value": 6 });
            a.update({ "system.traits.agility.value": ${rowWas.agility + 3} }, { drpgAutomated: true });
            return true;`);
        const agility = { after: await settledRow(`s => s.hope === 2 && s.agility === ${rowWas.agility}`), mark: await gm.eval(markRow), rows: await gm.eval(rowsOf(fromA)) };
        const fromF = await rowBack(2);
        await p1.eval(`const a = game.actors.get("${ids.aiko}");
            a.update({ "system.resources.hope.value": 6 });
            a.update({ "flags.${MOD}.monokuma": true }, { drpgAutomated: true });
            return true;`);
        const flagged = await settledRow(`s => s.hope === 2 && s.monokuma === null`);
        await p1.eval(`await game.actors.get("${ids.aiko}").update({ "system.traits.agility.value": ${rowWas.agility + 3} }, { drpgAutomated: true }); return true;`);
        const monokuma = { flagged, alone: await settledRow(`s => s.agility === ${rowWas.agility}`), mark: await gm.eval(markRow), rows: await gm.eval(rowsOf(fromF)) };
        await rowBack(2);
        await gm.eval(`await game.actors.get("${ids.aiko}").createEmbeddedDocuments("ActiveEffect", [{ name: "SEC G1 penalty",
            system: { changes: [{ key: "system.bonuses.roll.bonus", type: "add", value: -2 }] } }]);
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
        const fromG = await gm.eval(`return Date.now();`);
        const deleting = await p1.eval(`const a = game.actors.get("${ids.aiko}"), e = a.effects.contents.find(x => x.name === "SEC G1 penalty");
            await a.update({ "system.resources.hope.value": 6 }); e?.delete(); return Boolean(e);`);
        const penalty = { deleting, after: await settledRow(`s => s.hope === 2 && s.penalty === 1`), rows: await gm.eval(rowsOf(fromG)) };
        await rowBack(5);
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            globalThis.__g1Hook = Hooks.on("updateActor", (doc, changes, options, userId) => {
                if (doc.id !== a.id || userId !== "${p1.userId}" || !foundry.utils.hasProperty(changes, "system.resources.hope.value")) return;
                Hooks.off("updateActor", globalThis.__g1Hook);
                delete globalThis.__g1Hook;
                void a.update({ "system.resources.hope.value": 6 });
            });
            return true;`);
        await p1.eval(`const a = game.actors.get("${ids.aiko}");
            const w0 = a.update({ "system.traits.agility.value": ${rowWas.agility + 1} }, { drpgAutomated: true });
            const w1 = a.update({ "system.resources.hope.value": 4 }, { drpgAutomated: true, drpgWrite: { reason: "price", ref: null } });
            await Promise.all([w0, w1]); return true;`);
        const spent = { after: await settledRow(`s => s.agility === ${rowWas.agility} && s.hope === 6`), mark: await gm.eval(markRow) };
        inRow = { agility, monokuma, penalty, spent };
    } finally {
        await gm.eval(`if (globalThis.__g1Hook !== undefined) Hooks.off("updateActor", globalThis.__g1Hook); delete globalThis.__g1Hook; return true;`);
        await rowBack(null);
    }
    const everyClient = (seen, want) => Array.isArray(seen) && seen.length === 4 && seen.every(s => Object.entries(want).every(([key, value]) => s?.[key] === value));
    const HOPE_ROW = "putBack:system.resources.hope.value", AGILITY_ROW = "putBack:system.traits.agility.value";
    check("SECURITY: Agility a player's console raises right behind a forged Hope is put back with it on every client and in the GMs' mark, a row each",
        Boolean(inRow) && everyClient(inRow.agility.after, { hope: 2, agility: rowWas.agility }) && inRow.agility.mark.agility === rowWas.agility
            && JSON.stringify(inRow.agility.rows) === JSON.stringify([HOPE_ROW, AGILITY_ROW]),
        JSON.stringify(inRow?.agility ?? null), { flow: "sheet-audit" });
    check("SECURITY: the Monokuma flag a player's console writes right behind a forged Hope is put back on every client, and Agility raised alone after it is put back too",
        Boolean(inRow) && everyClient(inRow.monokuma.flagged, { hope: 2, monokuma: null }) && everyClient(inRow.monokuma.alone, { agility: rowWas.agility, monokuma: null })
            && inRow.monokuma.mark.monokuma === null
            && JSON.stringify(inRow.monokuma.rows) === JSON.stringify([`putBack:flags.${MOD}.monokuma`, HOPE_ROW, AGILITY_ROW]),
        JSON.stringify(inRow?.monokuma ?? null), { flow: "sheet-audit" });
    check("SECURITY: a GM's roll penalty a player's console deletes right behind a forged Hope is made again on every client, a row each",
        Boolean(inRow) && inRow.penalty.deleting === true && everyClient(inRow.penalty.after, { hope: 2, penalty: 1 })
            && JSON.stringify(inRow.penalty.rows) === JSON.stringify(["putBack:effects.<id>", HOPE_ROW]),
        JSON.stringify(inRow?.penalty ?? null), { flow: "sheet-audit" });
    check("SECURITY: a GM's Hope written while a player's spend waits behind a statistic being put back stands on every client and in the GMs' mark",
        Boolean(inRow) && everyClient(inRow.spent.after, { hope: 6, agility: rowWas.agility }) && inRow.spent.mark.hope === 6,
        JSON.stringify(inRow?.spent ?? null), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S WRITES OVER A WHOLE PART (E29 fix r1-G2, 05.10.2026; review round 1 sec B2, B4). p1's console
     * replaces Aiko's `system.resources` whole (v14's forced replacement, as the harness models it): Hope 2
     * to 4, its maximum up 2, two Health marks healed; then her module flags whole, with the Monokuma flag
     * in them, and raises Agility alone after it; then writes Daggerheart's level-up selections - Agility
     * twice - and raises the hit points of a class the GM gave her. Expected: Hope and its maximum put back
     * on every client and in the GMs' mark, the healing flagged to the GMs; the flag put back, then Agility;
     * the selections and the class's hit points put back - each with its row. The review's probes on
     * 69deef0 measured every one of these standing with no row, the mark taking the maximum; so did
     * this at d7bf69d (05.10.2026, e29run/r1g2red): Hope 4 and its maximum 8 on every client and 8 in
     * the mark, the flag and then Agility 4, the selections and 9 hit points - and no row.
     */
    phase("a console's writes over a whole part", { flow: "sheet-audit" });
    const readWhole = `const a = game.actors.get("${ids.aiko}"), c = a.items.find(i => i.name === "E29 G2 30 class"), r = a._source.system.resources;
        return { hope: r.hope.value, hopeMax: r.hope.max, hp: r.hitPoints.value, monokuma: a.getFlag("${MOD}", "monokuma") ?? null,
            agility: a.system.traits.agility.value, level: Boolean(a._source.system?.levelData?.levelups?.["7"]), classHp: c?.system?.hitPoints ?? null };`;
    const wholeWas = await gm.eval(`${audited} const a = game.actors.get("${ids.aiko}"), r = a._source.system.resources;
        const was = { hope: r.hope.value, hp: r.hitPoints.value, hopeMax: r.hope.max, agility: a.system.traits.agility.value, level: a._source.system?.levelData !== undefined };
        await a.update({ "system.resources.hope.value": 2, "system.resources.hitPoints.value": 2 });
        await a.createEmbeddedDocuments("Item", [{ name: "E29 G2 30 class", type: "class", system: { hitPoints: 6 } }]);
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return { ...was, from: Date.now() };`);
    const wholeRows = from => `${audited} return Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${from})
        .map(r => r.verdict + ":" + Object.keys(r.change ?? {}).map(k => k.replace(/^items\\.[^.]+/, "items.<id>")).sort().join(",")).sort();`;
    // Up to 6 s for the GM's reading to come out as `test` says, every judgement finished, then every client's.
    const settledWhole = async test => {
        await gm.eval(`const end = Date.now() + 6000; const read = async () => { ${readWhole} };
            while (!(${test})(await read()) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
        await settle(800);
        return Promise.all([gm, p1, p2, p3].map(c => c.eval(readWhole)));
    };
    let overWhole = null;
    try {
        await settle(400);
        await p1.eval(`const a = game.actors.get("${ids.aiko}"), r = foundry.utils.deepClone(a._source.system.resources);
            r.hope.value = 4; r.hope.max += 2; r.hitPoints.value = 0;
            await a.update({ "system.resources": foundry.data.operators.ForcedReplacement.create(r) }, { drpgAutomated: true }); return true;`);
        const resources = { after: await settledWhole(`s => s.hope === 2 && s.hopeMax === ${wholeWas.hopeMax}`),
            mark: await gm.eval(`${audited} const m = S.sheetMarkStore.get("${ids.aiko}"); return { hope: m?.resources?.hope?.value, hopeMax: m?.resources?.hope?.max };`),
            rows: await gm.eval(wholeRows(wholeWas.from)) };
        const fromF = await gm.eval(`return Date.now();`);
        await p1.eval(`const a = game.actors.get("${ids.aiko}"), f = foundry.utils.deepClone(a._source.flags?.["${MOD}"] ?? {}); f.monokuma = true;
            await a.update({ "flags.${MOD}": foundry.data.operators.ForcedReplacement.create(f) }, { drpgAutomated: true }); return true;`);
        const flagged = await settledWhole(`s => s.monokuma === null`);
        await p1.eval(`await game.actors.get("${ids.aiko}").update({ "system.traits.agility.value": ${wholeWas.agility + 3} }, { drpgAutomated: true }); return true;`);
        const flags = { flagged, alone: await settledWhole(`s => s.agility === ${wholeWas.agility}`), rows: await gm.eval(wholeRows(fromF)) };
        const fromL = await gm.eval(`return Date.now();`);
        await p1.eval(`const a = game.actors.get("${ids.aiko}"), pick = { tier: 2, level: 7, type: "trait", data: ["agility"], value: 1 };
            await a.update({ "system.levelData.levelups.7": { achievements: {}, selections: [pick, { ...pick }] } }, { drpgAutomated: true });
            await a.items.find(i => i.name === "E29 G2 30 class")?.update({ "system.hitPoints": 9 }, { drpgAutomated: true }); return true;`);
        const level = { after: await settledWhole(`s => !s.level && s.classHp === 6`), rows: await gm.eval(wholeRows(fromL)) };
        overWhole = { resources, flags, level };
    } finally {
        await gm.eval(`${audited} const a = game.actors.get("${ids.aiko}"), U = await import("${repoUrl}/scripts/utils.mjs"), was = ${JSON.stringify(wholeWas)};
            if (a.getFlag("${MOD}", "monokuma") !== undefined) await a.unsetFlag("${MOD}", "monokuma");
            const fix = { "system.resources.hope.value": was.hope, "system.resources.hitPoints.value": was.hp, "system.resources.hope.max": was.hopeMax,
                "system.traits.agility.value": was.agility };
            if (!was.level && a._source.system?.levelData !== undefined) fix["system.levelData"] = U.forcedDeletion();
            else if (a._source.system?.levelData?.levelups?.["7"]) fix["system.levelData.levelups.7"] = U.forcedDeletion();
            await a.update(fix);
            const left = a.items.filter(i => i.name === "E29 G2 30 class").map(i => i.id);
            if (left.length) await a.deleteEmbeddedDocuments("Item", left);
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
    }
    check("SECURITY: Hope and its maximum a player's console raises by replacing system.resources whole are put back on every client and in the GMs' mark, and the Health it heals so is flagged to the GMs",
        Boolean(overWhole) && everyClient(overWhole.resources.after, { hope: 2, hopeMax: wholeWas.hopeMax, hp: 0 })
            && overWhole.resources.mark.hopeMax === wholeWas.hopeMax && overWhole.resources.mark.hope === 2
            && JSON.stringify(overWhole.resources.rows) === JSON.stringify(["flagged:system.resources.hitPoints.value", "putBack:system.resources.hope.max,system.resources.hope.value"]),
        JSON.stringify(overWhole?.resources ?? null), { flow: "sheet-audit" });
    check("SECURITY: the Monokuma flag a player's console writes by replacing the module's flags whole is put back on every client, and Agility raised alone after it is put back too",
        Boolean(overWhole) && everyClient(overWhole.flags.flagged, { monokuma: null }) && everyClient(overWhole.flags.alone, { monokuma: null, agility: wholeWas.agility })
            && JSON.stringify(overWhole.flags.rows) === JSON.stringify([`putBack:flags.${MOD}.monokuma`, "putBack:system.traits.agility.value"]),
        JSON.stringify(overWhole?.flags ?? null), { flow: "sheet-audit" });
    check("SECURITY: Daggerheart's level-up selections and a class's hit points a player's console writes are put back on every client, a row each",
        Boolean(overWhole) && everyClient(overWhole.level.after, { level: false }) && overWhole.level.after[0].classHp === 6 && overWhole.level.after[1].classHp === 6
            && overWhole.level.after.every(s => s.classHp === null || s.classHp === 6)
            && JSON.stringify(overWhole.level.rows) === JSON.stringify(["putBack:items.<id>.system.hitPoints", "putBack:system.levelData.levelups.7.selections"]),
        JSON.stringify(overWhole?.level ?? null), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S EFFECTS (E29 fix r1-G3, 05.10.2026; review round 1 sec B3 = cor M4, cor M3). p1's console puts
     * an effect on a Tool Aiko carries - +5 to every roll and Agility up 3, which Daggerheart 2.10.5 applies to
     * the student carrying it; then three on Aiko herself - Hope's value up 5, Health's overridden to 0, the
     * Monokuma flag set; then makes an item on her carrying an Agility rise. Expected: the Tool's effect and
     * Aiko's three taken off on every client, the item deleted on every client, a put-back row each, and p1
     * told once a write. The review's probe on 69deef0 measured Aiko's three standing with no row; the Tool's
     * could not be made here until this fix modelled an effect on an actor's item (lib/shim.mjs `_embeddedOp`).
     * At b5769e7 (05.10.2026, e29run/r1g3red) all of it stood on every client: the Tool's effect and Aiko's three
     * with no row, the item with a flagged row only, and p1 was told nothing.
     */
    phase("a console's effects", { flow: "sheet-audit" });
    const readEffects = `const a = game.actors.get("${ids.aiko}"), t = a.items.find(i => i.name === "E29 G3 30 tool");
        return { tool: t ? t.effects.contents.filter(e => e.name === "SEC G3 tool bonus").length : null,
            own: a.effects.contents.filter(e => e.name.startsWith("SEC G3 own")).length, gift: a.items.filter(i => i.name === "E29 G3 30 gift").length };`;
    const effectsWas = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs"), a = game.actors.get("${ids.aiko}");
        const tool = await INV.grantItem(a, { name: "E29 G3 30 tool", category: "tool", tier: 1, override: true, quiet: true });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return { tool: tool?.id ?? null, from: Date.now() };`);
    const effectRows = from => `${audited} return Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${from})
        .map(r => r.verdict + ":" + (r.itemId === "${effectsWas.tool}" ? "tool:" : "") + Object.keys(r.change ?? {}).map(k => k.split(".")[0]).sort().join(",")).sort();`;
    // Up to 6 s for the GM's reading to come out as `test` says, every judgement finished, then every client's.
    const settledEffects = async test => {
        await gm.eval(`const end = Date.now() + 6000; const read = async () => { ${readEffects} };
            while (!(${test})(await read()) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
        await settle(800);
        return Promise.all([gm, p1, p2, p3].map(c => c.eval(readEffects)));
    };
    const toldSince = () => p1.eval(`const n = globalThis.__sheetTold; globalThis.__sheetTold = 0; return n;`);
    let consoleEffects = null;
    try {
        await settle(400);
        await p1.eval(`globalThis.__sheetTold = 0;
            if (!globalThis.__sheetToldHook) {
                globalThis.__sheetToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused" && payload.reason === "sheetPutBack") globalThis.__sheetTold++; });
            }
            await game.actors.get("${ids.aiko}").items.get("${effectsWas.tool}").createEmbeddedDocuments("ActiveEffect", [{ name: "SEC G3 tool bonus",
                system: { changes: [{ key: "system.bonuses.roll.bonus", type: "add", value: 5 }, { key: "system.traits.agility.value", type: "add", value: 3 }] } }]);
            return true;`);
        const tool = { after: await settledEffects(`s => s.tool === 0`), rows: await gm.eval(effectRows(effectsWas.from)), told: await toldSince() };
        const fromOwn = await gm.eval(`return Date.now();`);
        await p1.eval(`await game.actors.get("${ids.aiko}").createEmbeddedDocuments("ActiveEffect", [
            { name: "SEC G3 own Hope", system: { changes: [{ key: "system.resources.hope.value", type: "add", value: 5 }] } },
            { name: "SEC G3 own Health", system: { changes: [{ key: "system.resources.hitPoints.value", type: "override", value: 0 }] } },
            { name: "SEC G3 own Monokuma", system: { changes: [{ key: "flags.${MOD}.monokuma", type: "override", value: "true" }] } }]); return true;`);
        const own = { after: await settledEffects(`s => s.own === 0`), rows: await gm.eval(effectRows(fromOwn)), told: await toldSince() };
        const fromGift = await gm.eval(`return Date.now();`);
        await p1.eval(`await game.actors.get("${ids.aiko}").createEmbeddedDocuments("Item", [{ name: "E29 G3 30 gift", type: "loot", system: { quantity: 1 },
            effects: [{ name: "SEC G3 gift Agility", system: { changes: [{ key: "system.traits.agility.value", type: "add", value: 3 }] } }] }], { drpgAutomated: true });
            return true;`);
        const gift = { after: await settledEffects(`s => s.gift === 0`), rows: await gm.eval(effectRows(fromGift)), told: await toldSince() };
        consoleEffects = { tool, own, gift };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            const own = a.effects.contents.filter(e => e.name.startsWith("SEC G3 own")).map(e => e.id);
            if (own.length) await a.deleteEmbeddedDocuments("ActiveEffect", own);
            const items = a.items.filter(i => ["E29 G3 30 tool", "E29 G3 30 gift"].includes(i.name)).map(i => i.id);
            if (items.length) await a.deleteEmbeddedDocuments("Item", items);
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
    }
    check("SECURITY: an effect a player's console puts on an item its student carries - a roll bonus and an Agility rise, which Daggerheart applies to the student - is taken off on every client, its row naming the item, the player told",
        Boolean(consoleEffects) && Boolean(effectsWas.tool) && everyClient(consoleEffects.tool.after, { tool: 0 })
            && JSON.stringify(consoleEffects.tool.rows) === JSON.stringify(["putBack:tool:itemEffects"]) && consoleEffects.tool.told === 1,
        JSON.stringify({ effectsWas, tool: consoleEffects?.tool ?? null }), { flow: "sheet-audit" });
    check("SECURITY: effects a player's console puts on its student's Hope, Health and Monokuma flag are taken off on every client, a row each, the player told each time",
        Boolean(consoleEffects) && everyClient(consoleEffects.own.after, { own: 0 })
            && JSON.stringify(consoleEffects.own.rows) === JSON.stringify(["putBack:effects", "putBack:effects", "putBack:effects"]) && consoleEffects.own.told === 3,
        JSON.stringify(consoleEffects?.own ?? null), { flow: "sheet-audit" });
    check("SECURITY: an item a player's console makes carrying an Agility rise is put back - deleted on every client - with a row naming it and its effect, the player told",
        Boolean(consoleEffects) && everyClient(consoleEffects.gift.after, { gift: 0 })
            && JSON.stringify(consoleEffects.gift.rows) === JSON.stringify(["putBack:itemEffects,items"]) && consoleEffects.gift.told === 1,
        JSON.stringify(consoleEffects?.gift ?? null), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S EFFECTS THROUGH THEIR PARENT (E29 fix r2-H8, 06.10.2026; review round 2 cor M5). The GM puts a
     * penalty - 2 off every roll - on Aiko and one on a Tool she carries; p1's console turns each into a +5 through
     * the parent's own update, `actor.update({ effects })` and `item.update({ effects })`, which fire no effect hook
     * here, only the parent's. Expected: both back at -2 on every client, a put-back row each (the Tool's naming
     * it), p1 told twice. At 0d86603 (06.10.2026, e29run/r2h8red) both +5s stood on every client, Aiko's with
     * a listed row and the Tool's with none, and p1 was told nothing.
     */
    phase("a console's effects through their parent", { flow: "sheet-audit" });
    const parentWas = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs"), a = game.actors.get("${ids.aiko}");
        const penalty = name => ({ name, system: { changes: [{ key: "system.bonuses.roll.bonus", type: "add", value: -2 }] } });
        const [own] = await a.createEmbeddedDocuments("ActiveEffect", [penalty("SEC H8 own penalty")]);
        const tool = await INV.grantItem(a, { name: "E29 H8 30 tool", category: "tool", tier: 1, override: true, quiet: true });
        const [onTool] = tool ? await tool.createEmbeddedDocuments("ActiveEffect", [penalty("SEC H8 tool penalty")]) : [];
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return { own: own?.id ?? null, tool: tool?.id ?? null, onTool: onTool?.id ?? null, from: Date.now() };`);
    const readParent = `const a = game.actors.get("${ids.aiko}"), t = a.items.get("${parentWas.tool}");
        return { own: a.effects.get("${parentWas.own}")?.system?.changes?.[0]?.value ?? null, tool: t?.effects?.get("${parentWas.onTool}")?.system?.changes?.[0]?.value ?? null };`;
    const bonusFive = `system: { changes: [{ key: "system.bonuses.roll.bonus", type: "add", value: 5 }] }`;
    // Up to 6 s for the GM to read `want` of `key`, every judgement finished.
    const parentSettled = key => gm.eval(`const end = Date.now() + 6000; const read = () => { ${readParent} };
        while (read().${key} !== -2 && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
    let consoleParent = null;
    try {
        await toldSince();
        await p1.eval(`await game.actors.get("${ids.aiko}").update({ effects: [{ _id: "${parentWas.own}", ${bonusFive} }] }); return true;`);
        await parentSettled("own");
        await p1.eval(`await game.actors.get("${ids.aiko}").items.get("${parentWas.tool}").update({ effects: [{ _id: "${parentWas.onTool}", ${bonusFive} }] }); return true;`);
        await parentSettled("tool");
        await settle(800);
        consoleParent = { after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readParent))), told: await toldSince(),
            rows: await gm.eval(`${audited} return Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.at >= ${parentWas.from})
                .map(r => r.verdict + ":" + (r.itemId === "${parentWas.tool}" ? "tool:" : "") + Object.keys(r.change ?? {}).map(k => k.split(".")[0]).sort().join(",")).sort();`) };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            if (a.effects.has("${parentWas.own}")) await a.deleteEmbeddedDocuments("ActiveEffect", ["${parentWas.own}"]);
            if (a.items.has("${parentWas.tool}")) await a.deleteEmbeddedDocuments("Item", ["${parentWas.tool}"]);
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
    }
    check("SECURITY: an effect a player's console changes through its student's or its item's own update is put back on every client, a row each, the player told",
        Boolean(consoleParent) && Boolean(parentWas.own && parentWas.onTool) && everyClient(consoleParent.after, { own: -2, tool: -2 })
            && JSON.stringify(consoleParent.rows) === JSON.stringify(["putBack:effects", "putBack:tool:itemEffects"]) && consoleParent.told === 2,
        JSON.stringify({ parentWas, consoleParent }), { flow: "sheet-audit" });

    /*
     * A CONSOLE'S CREDIT AND FREE USES (E29 fix r1-G4, 05.10.2026; review round 1 cor M1, cor M2, cor m9 = sec m3).
     * The GM pays 2 of Aiko's Hope for a Reroll and gives them back, as reroll.mjs does when one does not stand;
     * then p1's console, with the hooks a real write fires: gives the same 2 Hope "back" (`refund`); uses a tier-3
     * kit (2 Hope, both Health marks) and, for its consumption, raises the kit's count 1 -> 2; gives Aiko's free
     * Move back (`game.drpg.restoreFreeMove`). Expected: the refund put back on every client; the use's Hope put
     * back, its Health flagged, the count put back; the free Move flagged to the GMs and standing, p1 told nothing
     * of it. At fd7c61f (05.10.2026, e29run/r1g4red) all three stood on every client: Hope 4 after the refund with
     * no row; Hope 4 and both marks after the use, the count's put-back its only row; the free Move given back
     * with no row.
     */
    phase("a console's credit and free uses", { flow: "sheet-audit" });
    const readUses = `const a = game.actors.get("${ids.aiko}"), r = a.system.resources;
        return { hope: r.hope.value, hp: r.hitPoints.value, free: a.getFlag("${MOD}", "freeMoveUsed") ?? null,
            kit: a.items.find(i => i.name === "E29 G4 30 kit")?.system?.quantity ?? null };`;
    const usesWas = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs"), a = game.actors.get("${ids.aiko}");
        const was = { hope: a.system.resources.hope.value, hp: a.system.resources.hitPoints.value, free: a.getFlag("${MOD}", "freeMoveUsed") ?? null };
        await a.update({ "system.resources.hope.value": 2, "system.resources.hitPoints.value": 2, "flags.${MOD}.freeMoveUsed": true });
        const kit = await INV.grantItem(a, { name: "E29 G4 30 kit", category: "usable", tier: 3, goal: "healing", override: true, quiet: true });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return { ...was, kit: kit?.id ?? null, user: ${JSON.stringify(await p1.eval(`return game.user.id;`))} };`);
    // From a clean credit: the GM's own writes, each judged before the next, and the moment the player's begin.
    const usesStart = (paid = false) => gm.eval(`const R = await import("${repoUrl}/scripts/resource-guard.mjs"), a = game.actors.get("${ids.aiko}");
        const A = await import("${repoUrl}/scripts/sheet-audit.mjs"), S = await import("${repoUrl}/scripts/gm-stores.mjs");
        await a.update({ "system.resources.hope.value": 2, "system.resources.hitPoints.value": 2 }); await A.sheetAuditIdle();
        await S.sheetMarkStore.patch(a.id, { credit: {} });
        if (${paid}) {
            await R.trustedWrite(a, { "system.resources.hope.value": 0 }, { reason: "reroll" }); await A.sheetAuditIdle();
            await R.trustedWrite(a, { "system.resources.hope.value": 2 }, { reason: "refund" }); await A.sheetAuditIdle();
        }
        return Date.now();`);
    const usesRows = from => `${audited} return Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.actorId === "${ids.aiko}" && r.userId === "${usesWas.user}" && r.at >= ${from})
        .map(r => r.verdict + ":" + Object.keys(r.change ?? {}).map(k => k.replace("${usesWas.kit}", "<kit>")).sort().join(",")).sort();`;
    const settledUses = async (test, ms = 6000) => {
        await gm.eval(`const end = Date.now() + ${ms}; const read = () => { ${readUses} };
            while (!(${test})(read()) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
        await settle(800);
        return Promise.all([gm, p1, p2, p3].map(c => c.eval(readUses)));
    };
    let consoleUses = null;
    try {
        await p1.eval(`globalThis.__usesTold = [];
            if (!globalThis.__usesToldHook) {
                globalThis.__usesToldHook = true;
                game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__usesTold.push(payload.reason); });
            }
            return true;`);
        const toldNow = () => p1.eval(`const told = globalThis.__usesTold.slice(); globalThis.__usesTold.length = 0; return told;`);
        const fromRefund = await usesStart(true);
        await p1.eval(`await game.actors.get("${ids.aiko}").update({ "system.resources.hope.value": 4 }, { drpgAutomated: true, drpgWrite: { reason: "refund", ref: null } });
            return true;`);
        const refund = { after: await settledUses(`s => s.hope === 2`), rows: await gm.eval(usesRows(fromRefund)), told: await toldNow() };
        const fromUse = await usesStart();
        await p1.eval(`const a = game.actors.get("${ids.aiko}");
            await a.update({ "system.resources.hope.value": 4, "system.resources.hitPoints.value": 0 }, { drpgAutomated: true, drpgWrite: { reason: "itemUse", ref: "${usesWas.kit}" } });
            await a.items.get("${usesWas.kit}").update({ "system.quantity": 2 }, { drpgAutomated: true });
            return true;`);
        const use = { after: await settledUses(`s => s.hope === 2 && s.kit === 1`, 8000), rows: await gm.eval(usesRows(fromUse)), told: await toldNow() };
        const fromMove = await gm.eval(`return Date.now();`);
        await p1.eval(`await game.drpg.restoreFreeMove(game.actors.get("${ids.aiko}")); return true;`);
        const move = { after: await settledUses(`s => s.free === false`), rows: await gm.eval(usesRows(fromMove)), told: await toldNow() };
        consoleUses = { refund, use, move };
    } finally {
        await gm.eval(`const a = game.actors.get("${ids.aiko}");
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await a.items.get("${usesWas.kit}")?.delete();
            await a.update({ "system.resources.hope.value": ${usesWas.hope}, "system.resources.hitPoints.value": ${usesWas.hp} });
            if (${JSON.stringify(usesWas.free)} === null) await a.unsetFlag("${MOD}", "freeMoveUsed"); else await a.setFlag("${MOD}", "freeMoveUsed", ${JSON.stringify(usesWas.free)});
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
    }
    const HP_PATH = "system.resources.hitPoints.value", HOPE_PATH = "system.resources.hope.value";
    check("SECURITY: a refund the GM gave back leaves nothing to take - a player's console giving the same Hope back is put back on every client, the player told",
        Boolean(consoleUses) && everyClient(consoleUses.refund.after, { hope: 2 })
            && JSON.stringify(consoleUses.refund.rows) === JSON.stringify([`putBack:${HOPE_PATH}`]) && JSON.stringify(consoleUses.refund.told) === JSON.stringify(["sheetPutBack"]),
        JSON.stringify(consoleUses?.refund ?? null), { flow: "sheet-audit" });
    check("SECURITY: a kit a player's console uses with its count raised for the consumption is no use - its Hope put back, its Health flagged, the count put back",
        Boolean(consoleUses) && Boolean(usesWas.kit) && everyClient(consoleUses.use.after, { hope: 2, hp: 0 })
            && consoleUses.use.after.slice(0, 2).every(s => s.kit === 1)
            && JSON.stringify(consoleUses.use.rows) === JSON.stringify([`flagged:${HP_PATH}`, "putBack:items.<kit>.system.quantity", `putBack:${HOPE_PATH}`]),
        JSON.stringify({ usesWas, use: consoleUses?.use ?? null }), { flow: "sheet-audit" });
    check("SECURITY: the free Move a player's console gives back stands flagged to the GMs, a row and nothing told",
        Boolean(consoleUses) && everyClient(consoleUses.move.after, { free: false })
            && JSON.stringify(consoleUses.move.rows) === JSON.stringify([`flagged:flags.${MOD}.freeMoveUsed`]) && consoleUses.move.told.length === 0,
        JSON.stringify(consoleUses?.move ?? null), { flow: "sheet-audit" });

    /*
     * A FORGED HOPE UNDER A CALL BOUGHT ON THE GM (E29 fix r1-G5, 05.10.2026; review round 1 sec M1). The
     * review's probe (e29-review/sec-probe5.log): Botan at 0 real Hope, p2's console writes Hope 3 and, not
     * waiting for it, asks the GM for a Support on Aiko (1 Hope) - at 69deef0 bought, and Botan at 2 in the
     * GMs' mark. Then Botan at 1 real Hope, the request sent before the forged write twice and after it
     * twice. Expected: refused with 0, bought with 1, and Botan at 0 on every client and in the mark each
     * time. At 6c7f9d2 (05.10.2026, e29run/r1g5q/head-probe.log) the first was refused - C8's wait before
     * the purchase's guards - and with 1 real Hope the forged write's put-back, computed before the GM's
     * payment was heard, landed after it: Botan back at 1 on every client, 0 in the mark, in 5 runs of 12;
     * this check, run there, read it on its second run (e29run/r1g5red/30.log).
     */
    phase("a console's Hope under a Call bought on the GM", { flow: "call-arm" });
    const readBought = `const b = game.actors.get("${ids.botan}"), a = game.actors.get("${ids.aiko}");
        return { hope: b.system.resources.hope.value,
            armed: (a.getFlag("${MOD}", "pendingCall") ?? []).filter(e => String(e?.nonce ?? "").startsWith("g5sec")).length };`;
    const boughtWas = await gm.eval(`const b = game.actors.get("${ids.botan}"), a = game.actors.get("${ids.aiko}");
        return { hope: b.system.resources.hope.value, calls: a.getFlag("${MOD}", "pendingCall") ?? null };`);
    const boughtFrom = (hope, calls) => gm.eval(`const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const b = game.actors.get("${ids.botan}"), a = game.actors.get("${ids.aiko}");
        await A.sheetAuditIdle();
        await b.update({ "system.resources.hope.value": ${hope} });
        const calls = ${calls};
        if (calls !== null) await a.setFlag("${MOD}", "pendingCall", calls); else if (a.getFlag("${MOD}", "pendingCall") !== undefined) await a.unsetFlag("${MOD}", "pendingCall");
        await A.sheetAuditIdle(); return true;`);
    const keptCalls = `(game.actors.get("${ids.aiko}").getFlag("${MOD}", "pendingCall") ?? []).filter(e => !String(e?.nonce ?? "").startsWith("g5sec"))`;
    const bought = [];
    try {
        const support = { key: "support", grants: "advantage", kind: "hope", from: ids.botan };
        for (const [n, real, requestFirst] of [[1, 0, false], [2, 1, true], [3, 1, true], [4, 1, false], [5, 1, false]]) {
            await boughtFrom(real, keptCalls);
            await settle(600);
            const ask = `B.requestArmCall("${ids.aiko}", ${JSON.stringify({ ...support, nonce: `g5sec${n}` })})`;
            const answer = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs"), b = game.actors.get("${ids.botan}");
                ${requestFirst ? `const asked = ${ask}; b.update({ "system.resources.hope.value": 3 }); return await asked;`
                    : `b.update({ "system.resources.hope.value": 3 }); return await ${ask};`}`, { timeout: 30000 });
            await gm.eval(`const end = Date.now() + 4000; const read = () => { ${readBought} };
                while (read().hope !== 0 && Date.now() < end) await new Promise(r => setTimeout(r, 100));
                await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle(); return true;`);
            await settle(800);
            bought.push({ n, real, requestFirst, answer: answer?.ok ? answer.value?.left ?? null : answer?.reason ?? null,
                after: await Promise.all([gm, p1, p2, p3].map(c => c.eval(readBought))),
                mark: await gm.eval(`return (await import("${repoUrl}/scripts/gm-stores.mjs")).sheetMarkStore.get("${ids.botan}")?.resources?.hope?.value ?? null;`) });
        }
    } finally {
        await boughtFrom(boughtWas.hope, JSON.stringify(boughtWas.calls));
    }
    check("SECURITY: a forged Hope under a Support bought on the GM buys nothing - refused with no real Hope, paid from the real one whichever left first, Botan at 0 on every client and in the GMs' mark",
        bought.length === 5 && bought.every(r => r.mark === 0 && r.after.every(s => s.hope === 0 && s.armed === r.real))
            && bought[0].answer === "notEnoughHope" && bought.slice(1).every(r => r.answer === 0),
        JSON.stringify(bought), { flow: "call-arm" });

    /*
     * 7i. ownership raised past the window's back, and a player's edit of their own bullet.
     *
     * The harness's `noHook` silences the `updateActor` hook as well as the `pre`
     * one (lib/shim.mjs says why), so this proves the road that does not depend on
     * it: the Configure Ownership window closing on the GM who used it. Verified by
     * hand on 24.09.2026: with the close hook's `lowerOwnership` call removed from
     * anonymity.mjs, this check FAILED (ownership stayed 3). The harness has one
     * GM, who is also the primary, so this passes the same under the old
     * primary-only rule: a GM who is not the primary closing the window is not
     * measured (AUDIT §9.2, item 20).
     */
    phase("ownership");
    await gm.eval(`const a = game.actors.get("${ids.daichi}");
        await a.update({ "ownership.default": 3 }, { noHook: true });
        Hooks.callAll("closeDocumentOwnershipConfig", { document: a }); return true;`);
    await settle(1500);
    const ownership = await gm.eval(`return game.actors.get("${ids.daichi}").ownership.default;`);
    check("SECURITY: a character shared as Owner with every player is put back to Observer", ownership === 2, JSON.stringify({ ownership }));
    phase("Truth Bullet edits", { flow: "truth-bullets" });
    const bullet = await gm.eval(`return game.actors.get("${ids.botan}").items.find(i => i.getFlag("${MOD}", "isTruthBullet"))?.id ?? null;`);
    const readBullet = `const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        return { text: b?.getFlag("${MOD}", "playerText") ?? null, analyzed: b?.getFlag("${MOD}", "analyzed") ?? null };`;
    const bulletBefore = await gm.eval(readBullet);
    /*
     * THE COURTESY HALF AND THE BACKSTOP (E30, 24.09.2026). resource-guard.mjs refuses an
     * edit of a bullet's guarded flags on the player's own client, and the primary GM puts
     * back whatever gets past it. Until the harness let a preUpdate listener edit the update
     * it is given, the refusal changed nothing here, so the two checks after this one passed
     * on edits a player's client would not have sent. Measured once it did: the plain edit
     * never left p2's client - the first check then passed on nothing having happened, and
     * the second failed. A console gets past the courtesy half with the guard's own option
     * (`drpgAutomated`, resource-guard.mjs SYSTEM_WRITE), which is what the backstop exists
     * for; the two backstop checks send their edit that way, and this one checks the half
     * that now works headless.
     */
    await p2.eval(`globalThis.__notifications.length = 0; const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await b.update({ "flags.${MOD}.playerText": "SEC plain edit" }); return true;`);
    await settle(1000);
    const plainEdit = { gm: await gm.eval(readBullet),
        warned: await p2.eval(`return globalThis.__notifications.some(n => n.level === "warn" && n.msg === game.i18n.localize("DRPG.Guard.itemLocked"));`) };
    check("SECURITY: a player's plain edit of their Truth Bullet is refused on their own client and never reaches the GM",
        JSON.stringify(plainEdit.gm) === JSON.stringify(bulletBefore) && plainEdit.warned === true, JSON.stringify({ bulletBefore, plainEdit }));
    /* What the GMs were told since a message count, read the way the check after this
       one reads it: a GM whisper is a private card, its words in the store (secret.mjs). */
    const gmSaid = from => gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const said = game.messages.contents.slice(${from}).map(m => S.contentOf(m) || m.content || "").join(" ");
        return { reverted: said.includes(game.i18n.format("DRPG.TruthBullet.editReverted", { player: "", bullet: "" }).slice(-40)),
            unrestored: said.includes(game.i18n.format("DRPG.TruthBullet.editUnrestored", { player: "", bullet: "" }).slice(-40)) };`);
    const beforeRewrite = await gm.eval(`return game.messages.size;`);
    await p2.eval(`const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await b.update({ "flags.${MOD}.playerText": "SEC rewritten", "flags.${MOD}.analyzed": true }, { drpgAutomated: true }); return true;`);
    await settle(1500);
    const bulletAfter = await gm.eval(readBullet);
    /* And the GMs were told it was put back (E30 fix, 25.09.2026): an unchanged bullet
       alone is also what an edit that never reached the GM looks like. Measured with the
       option taken off this edit, so p2's own guard cancels it: the unchanged-bullet
       half passed, this check failed. */
    const toldRewrite = await gmSaid(beforeRewrite);
    check("SECURITY: a player's edit of what their Truth Bullet says or is, is put back, and the GMs are told so",
        Boolean(bullet) && JSON.stringify(bulletAfter) === JSON.stringify(bulletBefore) && toldRewrite.reverted && !toldRewrite.unrestored,
        JSON.stringify({ bulletBefore, bulletAfter, toldRewrite }));

    /*
     * A bullet with no record is not called "put back". The GM's copy is dropped
     * by hand here - the state a bullet is in on a browser that never saw a GM
     * write it - and the GM must be told the edit stayed, not that it was undone.
     * Then the text is put right by the GM, so nothing after this reads a
     * rewritten bullet.
     */
    await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        T.forgetBulletGuard(b.uuid); return true;`);
    const whispersBefore = await gm.eval(`return game.messages.size;`);
    await p2.eval(`const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await b.update({ "flags.${MOD}.playerText": "SEC unrecorded" }, { drpgAutomated: true }); return true;`);
    await settle(1500);
    // A GM whisper is a private card: the words live in the store, not on the message (secret.mjs).
    const unrecorded = await gm.eval(`const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const said = game.messages.contents.slice(${whispersBefore}).map(m => S.contentOf(m) || m.content || "").join(" ");
        return { text: b?.getFlag("${MOD}", "playerText") ?? null,
            unrestored: said.includes(game.i18n.format("DRPG.TruthBullet.editUnrestored", { player: "", bullet: "" }).slice(-40)),
            reverted: said.includes(game.i18n.format("DRPG.TruthBullet.editReverted", { player: "", bullet: "" }).slice(-40)) };`);
    check("SECURITY: an edit with no record to restore it from is reported as staying, not as put back",
        unrecorded.text === "SEC unrecorded" && unrecorded.unrestored && !unrecorded.reverted, JSON.stringify(unrecorded));
    await gm.eval(`const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await b.update({ "flags.${MOD}.playerText": ${JSON.stringify(bulletBefore.text)} }); return true;`);
    await settle(800);

    /*
     * The load-time record ran on the GM, once (the E03 review measured it running
     * 0 times), and the GM holds a copy of every bullet in the world now - the ones
     * made during this scenario by a GM's write. The fixture world has no bullet at
     * load, so this does NOT show a bullet that existed at load being recorded;
     * that is `guardAllBullets` walking `bulletsOf`, read, not measured here.
     */
    const guardRan = await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const bullets = game.actors.contents.flatMap(a => T.bulletsOf(a)).length;
        return { ...T.bulletGuardStatus(), bullets };`);
    check("SECURITY: the GM's record of the Truth Bullets ran once at load and covers every bullet in the world",
        guardRan.runs === 1 && guardRan.bullets > 0 && guardRan.known === guardRan.bullets, JSON.stringify(guardRan));
    /*
     * And it never touches the answer key. The first E03 build kept the copy in the
     * bullet's secret, stamped fresh at load, and the ledger's newest-wins merge
     * then threw away the other GMs' real entries (the E03 second review). The copy
     * lives in the GM's memory now; the secret must not carry it.
     */
    const inLedger = await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        return game.actors.contents.flatMap(a => T.bulletsOf(a)).filter(b => "guard" in (T.secretOf(b.uuid) ?? {})).length;`);
    check("SECURITY: the GM's copy of a bullet's fields is not written into the Truth Bullet answer key",
        inLedger === 0 && guardRan.bullets > 0, JSON.stringify({ inLedger, bullets: guardRan.bullets }));

    /*
     * 8. DAGGERHEART'S GM RELAY (E03, 24.09.2026; audit S16-01).
     *
     * Daggerheart's own relay is copied verbatim into lib/dh-relay.mjs and registered
     * the way Daggerheart registers it. Each packet below is one a player's
     * Daggerheart never sends; each must change nothing on the GM, be logged by
     * name, warn the GM and tell the player. Then the three shapes Daggerheart
     * really does send for a player must still land.
     *
     * Verified by hand the day it was written (24.09.2026): with `registerRelayGuard`
     * commented out of scripts/module.mjs, the five RELAY checks below FAILED, and
     * the tick control passed on nothing, which is why it now also asks that the
     * Projects are still there.
     */
    phase("Daggerheart's relay");
    const DH = "system.daggerheart";
    const relayWorld = `return {
        role: game.users.get("${p1.userId}").role,
        users: game.users.size,
        countdowns: JSON.stringify(game.settings.get("daggerheart", "Countdowns")),
        botanOwnership: JSON.stringify(game.actors.get("${ids.botan}").ownership),
        automation: JSON.stringify(game.settings.get("daggerheart", "Automation"))
    };`;
    await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        await P.createProject({ name: "SEC relay project", target: 6, room: "Hall", secret: true }); return true;`, { timeout: 60000 });
    await clearFailures();
    await gm.eval(`globalThis.__notifications.length = 0; return true;`);
    const relayBefore = await gm.eval(relayWorld);
    await p1.eval(`globalThis.__refused.length = 0;
        const send = data => game.socket.emit("${DH}", data);
        send({ action: "DhGMUpdate", data: { action: "DhGMUpdateDocument", uuid: game.user.uuid, data: { role: 4 } } });
        send({ action: "DhGMUpdate", data: { action: "DhGMUpdateCountdowns", data: {} } });
        send({ action: "DhGMUpdate", data: { action: "DhGMUpdateCountdowns", data: { countdowns: {} } } });
        send({ action: "DhGMCreate", data: { documentType: "User", data: { name: "SEC user", role: 4 } } });
        send({ action: "DhGMUpdate", data: { action: "DhGMUpdateSetting", uuid: "Automation", data: { hope: false } } });
        send({ action: "DhGMUpdate", data: { action: "DhGMUpdateDocument", uuid: game.actors.get("${ids.botan}").uuid,
            data: { "ownership.${p1.userId}": 3 } } });
        return true;`);
    await settle(2500);
    try {
        const relayAfter = await gm.eval(relayWorld);
        check("RELAY: a player's own role is not raised through Daggerheart's relay", relayAfter.role === relayBefore.role, JSON.stringify({ relayBefore: relayBefore.role, relayAfter: relayAfter.role }));
        check("RELAY: the Countdowns setting - every Project - is not overwritten", relayAfter.countdowns === relayBefore.countdowns,
            JSON.stringify({ changed: relayAfter.countdowns !== relayBefore.countdowns }));
        check("RELAY: no user is created, no setting written and no ownership granted",
            relayAfter.users === relayBefore.users && relayAfter.automation === relayBefore.automation
            && relayAfter.botanOwnership === relayBefore.botanOwnership, JSON.stringify({ relayBefore, relayAfter }));
        const told = await gm.eval(`return {
            log: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes("Refused a Daggerheart")).map(e => e.message),
            toasts: (globalThis.__notifications ?? []).filter(n => String(n.msg ?? "").includes("PlayerOne")).length };`);
        const heard = await p1.eval(`return globalThis.__refused.slice();`);
        check("RELAY: every refusal is logged on the GM by the sender's name",
            told.log.length >= 6 && told.log.every(line => line.includes("PlayerOne")), JSON.stringify(told.log));
        check("RELAY: the GM is warned, and the player is told", told.toasts > 0 && heard.some(r => r.what === "daggerheart"),
            JSON.stringify({ toasts: told.toasts, heard }));

        // The shapes Daggerheart really sends for a player.
        const fearBefore = await gm.eval(`return game.settings.get("daggerheart", "ResourcesFear");`);
        await p1.eval(`game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateFear",
            data: ${fearBefore + 1}, uuid: null, refresh: null } }); return true;`);
        await settle(1200);
        const fearAfter = await gm.eval(`return game.settings.get("daggerheart", "ResourcesFear");`);
        check("control: a player's roll with Fear still moves Fear by one", fearAfter === fearBefore + 1, JSON.stringify({ fearBefore, fearAfter }));

        const hopeBefore = await gm.eval(`return game.actors.get("${ids.aiko}").system.resources.hope.value;`);
        await p1.eval(`game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateDocument",
            uuid: game.actors.get("${ids.aiko}").uuid, data: { "system.resources.hope.value": ${Math.max(0, hopeBefore - 1)} } } }); return true;`);
        await settle(1200);
        const hopeAfter = await gm.eval(`return game.actors.get("${ids.aiko}").system.resources.hope.value;`);
        check("control: a player's roll still spends their own character's Hope", hopeAfter === Math.max(0, hopeBefore - 1), JSON.stringify({ hopeBefore, hopeAfter }));

        const tick = await gm.eval(`
            const all = game.settings.get("daggerheart", "Countdowns");
            const data = foundry.utils.deepClone(all?.toObject?.() ?? all);
            data.countdowns.SECTICK000000000 = { name: "SEC tick", type: "encounter", hidden: false, ownership: {},
                progress: { current: 3, start: 6, type: "actionRoll", looping: "noLooping" } };
            await game.settings.set("daggerheart", "Countdowns", data);
            return { projects: Object.keys(data.countdowns).filter(id => id !== "SECTICK000000000") };`);
        await settle(300);
        await p1.eval(`const all = game.settings.get("daggerheart", "Countdowns");
            const data = foundry.utils.deepClone(all?.toObject?.() ?? all);
            data.countdowns.SECTICK000000000.progress.current = 2;
            for (const id of Object.keys(data.countdowns)) if (id !== "SECTICK000000000") data.countdowns[id].progress.current = 0;
            game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateCountdowns", data,
                refresh: { refreshType: "DhCoundownRefresh" } } }); return true;`);
        await settle(1500);
        const ticked = await gm.eval(`const all = game.settings.get("daggerheart", "Countdowns");
            const data = all?.toObject?.() ?? all;
            return { tick: data.countdowns.SECTICK000000000?.progress?.current,
                projects: Object.fromEntries(Object.entries(data.countdowns)
                    .filter(([id]) => id !== "SECTICK000000000").map(([id, c]) => [id, c.progress?.current])) };`);
        const projectsBefore = JSON.parse(relayBefore.countdowns).countdowns ?? {};
        check("control: an automatic countdown tick from a player's roll lands, and no Project moves with it",
            // The Projects have to be THERE to have not moved: with the guard off, the
            // emptied Countdowns above had already wiped them and this passed on nothing.
            ticked.tick === 2 && Object.keys(ticked.projects).length > 0 && Object.entries(ticked.projects).every(([id, current]) =>
                projectsBefore[id] === undefined || projectsBefore[id].progress?.current === current),
            JSON.stringify({ ticked, tick: tick.projects.length }));

        /*
         * 2.10.8's item transfer (E08+E28 C9, 04.10.2026; the owner's Q1 (a), 03.10). The
         * copy in lib/dh-relay.mjs is 2.10.8's, so the guard must know every case it has;
         * a player's transfer moves nothing, every packet is logged, each sender is told,
         * and the GM hears of it once a session - two players, three packets, one toast
         * (a 30-second window per sender would make two). The target's `transferItem` is
         * a recorder, which the control then hands the same packet through the copied
         * relay itself: an item that did not move must be a refusal, not a relay with
         * no such case (2.10.5's had none).
         */
        const guard = await gm.eval(`return game.drpg.relayGuard();`);
        check("RELAY: the guard has reviewed every case of the copied relay (2.10.8), so none is called unreviewed",
            guard.state === "ok" && guard.fingerprint.includes("TransferItem") && guard.unreviewed.length === 0,
            JSON.stringify({ state: guard.state, fingerprint: guard.fingerprint, unreviewed: guard.unreviewed }));
        const parcel = await gm.eval(`
            const [item] = await game.actors.get("${ids.aiko}").createEmbeddedDocuments("Item", [{ name: "SEC parcel", type: "loot" }]);
            const target = game.actors.get("${ids.botan}");
            globalThis.__secTransfers = [];
            target.transferItem = ({ item, quantity }) => globalThis.__secTransfers.push({ item: item?.uuid ?? null, quantity });
            globalThis.__notifications.length = 0;
            (await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures();
            return { item: item.uuid, target: target.uuid };`);
        const transfer = `game.socket.emit("${DH}", { action: "DhTransferItem",
            data: { item: "${parcel.item}", targetActor: "${parcel.target}", quantity: 1 } });`;
        const listen = `if (!globalThis.__refused) {
                globalThis.__refused = [];
                game.socket.on("${SOCKET}", (payload, senderId) => {
                    if (payload?.action === "bridge.refused") globalThis.__refused.push({ what: payload.what, from: senderId });
                });
            }
            globalThis.__refused.length = 0;`;
        await p2.eval(`${listen} return true;`);
        await p1.eval(`${listen} ${transfer} ${transfer} return true;`);
        await settle(600);
        await p2.eval(`${transfer} return true;`);
        await settle(1500);
        const transferred = await gm.eval(`return {
            moved: globalThis.__secTransfers.slice(),
            left: game.actors.get("${ids.aiko}").items.filter(i => i.name === "SEC parcel").length,
            logged: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
                .filter(e => e.message.includes('Refused a Daggerheart "DhTransferItem"')).reduce((n, e) => n + (e.count ?? 1), 0),
            toasts: (globalThis.__notifications ?? []).filter(n => String(n.msg ?? "").includes("an item transfer")).length };`);
        const transferHeard = await Promise.all([p1, p2].map(p => p.eval(`return globalThis.__refused.filter(r => r.what === "daggerheart").length;`)));
        check("RELAY: a player's DhTransferItem is refused on the GM - nothing moves, every packet is logged, each player is told and the GM once a session",
            transferred.moved.length === 0 && transferred.left === 1 && transferred.logged === 3 && transferred.toasts === 1
            && transferHeard.every(n => n >= 1), JSON.stringify({ transferred, transferHeard }));
        const direct = await gm.eval(`const R = await import("${repoUrl}/audit/harness/lib/dh-relay.mjs");
            globalThis.__secTransfers.length = 0;
            await R.handleSocketEvent({ action: "DhTransferItem",
                data: { item: "${parcel.item}", targetActor: "${parcel.target}", quantity: 1 } });
            const calls = globalThis.__secTransfers.slice();
            delete game.actors.get("${ids.botan}").transferItem;
            await fromUuidSync("${parcel.item}")?.delete();
            return calls;`);
        check("control: the same packet run through the copied relay itself hands the item to the target",
            direct.length === 1 && direct[0].item === parcel.item && direct[0].quantity === 1, JSON.stringify(direct));
    } finally {
        await gm.eval(`const u = game.users.get("${p1.userId}"); if (u.role !== 1) await u.update({ role: 1 }); return true;`);
    }

    // summary of what server refused
    check("SECURITY: server logged permission denials for player writes", (permissionDenials ?? []).length >= 2, JSON.stringify((permissionDenials||[]).slice(0,8)));
}
