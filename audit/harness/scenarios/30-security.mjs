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
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestCrisisResult({ actorId: "${ids.botan}", key: "finishingBlow", total: 99, isCritical: false, withHope: true }); return true;`);
    await settle(2200);
    const blowOk = await gm.eval(readCrisis);
    check("control: the same finishing blow from Botan's own player does kill", blowOk.dead === true, JSON.stringify(blowOk));

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
       Both checks carry the `reroll` flow inside the crisis actions' phase. */
    const readReroll = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = S.rerollBookmarkStore?.get("${ids.botan}");
        return { hope: game.actors.get("${ids.botan}").system.resources.hope.value, row: row ? { messageId: row.messageId, total: row.total } : null,
            journal: Boolean(S.rerollJournalStore?.has("${ids.botan}")), dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")),
            receipt: JSON.stringify(game.drpg.murderState()?.lastCrisis ?? null) };`;
    const botanRoll = await p2.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        try { const out = await A.rollTrait(game.actors.get("${ids.botan}"), "body", { actionKey: "crisis", context: { crisis: "finishingBlow" } });
            return out?.raw?.message?.id ?? null; }
        finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
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
        const { automatedUpdate } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const botan = game.actors.get("${ids.botan}");
        await automatedUpdate(botan, { "system.resources.hope.value": Math.max(4, botan.system.resources.hope.value) });
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
       it says of the player's own card is kept. p1's own card, its packet as a console would
       write it. */
    const metaCard = await p1.eval(`
        const msg = await ChatMessage.create({ content: '<p class="notes" data-drpg-secret>-</p>',
            whisper: ["${gm.userId}"], flags: { "${MOD}": { secret: true } } });
        game.socket.emit("${SOCKET}", { action: "secret.card", id: msg.id, html: "<p>SEC meta</p>", at: Date.now(),
            meta: { gmPopup: true, popupForce: true, callCard: true, popupTitle: "SEC meta title" } });
        return msg.id;
    `, { timeout: 30000 });
    await settle(1200);
    const metaKept = await gm.eval(`
        const store = game.settings.get("${MOD}", "secretCards") ?? {};
        return { words: Boolean(store[${JSON.stringify(metaCard)}]?.html), meta: store[${JSON.stringify(metaCard)}]?.meta ?? null };
    `);
    check("SECURITY: a player's card cannot ask the GMs for a notice or carry a ruling's buttons, and keeps its own title",
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
    const beforeLost = await gm.eval(`return game.messages.size;`);
    await p1.eval(`
        game.socket.emit("${SOCKET}", { action: "observe.resolve", requestId: "lost-${Date.now()}", userId: game.user.id,
            actorId: "${ids.aiko}", key: "no-such-key", total: 7 },
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
        renamed === true && lostCard.renamed && lostCard.cards > 0 && !lostCard.handler, JSON.stringify({ renamed, ...lostCard }));

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
    await canary.chatMark({ who: ["p1"] });
    const projects = await gm.eval(`
        const P = await import("${repoUrl}/scripts/projects.mjs");
        const pub = await P.createProject({ name: "SEC public", target: 6, room: "Cafeteria", secret: false });
        const sec = await P.createProject({ name: "SEC secret", target: 6, room: "Gym", secret: true });
        return { pub: pub.id, sec: sec.id };`, { timeout: 60000 });
    const sabotaged = await p2.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const r = await P.sabotageProject("${projects.pub}", 3); return { repair: r?.repair?.id ?? null };`, { timeout: 60000 });
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
    const frozenAgain = await p2.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const r = await P.sabotageProject("${projects.pub}", 3); return r?.repair?.id ?? null;`, { timeout: 60000 });
    const readProgress = `const P = await import("${repoUrl}/scripts/projects.mjs");
        const c = P.allProjects().find(p => p.id === "${projects.pub}"); return { current: c?.current ?? null };`;
    const onFrozen = await forge("project.progress", { countdownId: projects.pub, amount: 2, actorId: ids.aiko }, readProgress);
    // `current` is read off the project row (`allProjects`), which is where the bar's
    // figure is: read off the wrong field, this check was null == null and measured
    // nothing - found by taking the frozen guard out and watching it still pass.
    check("SECURITY: progress onto a sabotaged project does not move it",
        Boolean(frozenAgain) && typeof onFrozen.before.current === "number" && onFrozen.unchanged, JSON.stringify(onFrozen));
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
    const hiddenRepair = await p2.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const r = await P.sabotageProject("${hiddenWork}", 3); return r?.repair?.id ?? null;`, { timeout: 60000 });
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
    const stolenKey = await forge("observe.resolve", { actorId: ids.aiko, key: observed.key, total: 0 }, readBullets);
    check("SECURITY: an Observe resolved with another character's key changes nothing and is refused",
        observed.ok && stolenKey.unchanged && stolenKey.reasons.some(r => /another character/.test(r)), JSON.stringify({ observed, stolenKey }));
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestObserveResolve({ actorId: "${ids.botan}", key: "${observed.key}", total: 30, isCritical: false }); return true;`);
    await settle(1500);
    const found = await gm.eval(readBullets);
    check("control: Botan's own player resolving Botan's key does find the trace",
        found.botan === stolenKey.after.botan + 1, JSON.stringify({ before: stolenKey.after, after: found }));
    await clearFailures();
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestObserveResolve({ actorId: "${ids.botan}", key: "${observed.key}", total: 30, isCritical: false }); return true;`);
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

    // 7f. remnant.place: who left it, where, and what it points at, rebuilt on the GM.
    phase("a player's traces", { flow: "trace-remnant" });
    await p1.eval(`game.socket.emit("${SOCKET}", { action: "remnant.place", userId: game.user.id, requestId: "forge-trace",
        data: { sourceActor: "${ids.aiko}", sourceName: "Botan Kage", room: "Storage", pointsAt: "${ids.chie}",
            type: "tamper", visibility: "evident", x: 2300, y: 1300, sceneId: canvas.scene.id, reinforced: true,
            tiedToCrime: false, faint: true, action: "search", note: "planted", subject: "SEC knife" } }, ${toGms}); return true;`);
    await settle(1500);
    const planted = await gm.eval(`
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        const hit = canvas.scene.tokens.contents.map(t => R.remnantData(t)).filter(Boolean).find(d => d.subject === "SEC knife");
        return hit ? { sourceName: hit.sourceName, room: hit.room, pointsAt: hit.pointsAt ?? null, type: hit.type,
            reinforced: hit.reinforced } : null;`);
    check("SECURITY: a player's trace is written with their own name, their own room, pointing at nobody, as Preparation",
        planted && planted.sourceName === "Aiko Hoshino" && planted.room === "Cafeteria" && planted.pointsAt === null
        && planted.type === "prep" && planted.reinforced === false, JSON.stringify(planted));
    const badBand = await forge("remnant.place", { data: { sourceActor: ids.aiko, visibility: "x", action: "search", subject: "SEC bad band" } },
        `const R = await import("${repoUrl}/scripts/remnants.mjs");
        return { n: canvas.scene.tokens.contents.map(t => R.remnantData(t)).filter(d => d?.subject === "SEC bad band").length };`);
    check("SECURITY: a trace with a visibility that does not exist is refused",
        badBand.after.n === 0 && badBand.reasons.some(r => /not a visibility/.test(r)), JSON.stringify(badBand));

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
        const { automatedUpdate } = await import("${repoUrl}/scripts/resource-guard.mjs");
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
        await automatedUpdate(who, { "system.resources.hope.value": 5 });
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
        await automatedUpdate(who, { "system.resources.hope.value": hopeWas });
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
    const listened = await p1.eval(`globalThis.__forceRoll = { hope: 9, fear: 4 };
        try { const A = await import("${repoUrl}/scripts/action-rolls.mjs");
            const o = await A.rollTrait(game.actors.get("${ids.aiko}"), "shadow", { actionKey: "listen",
                context: { room: "${rooms.here}", target: "${rooms.there}" } });
            return o?.raw?.message?.id ?? null; }
        finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
    await settle(1500);
    const armed = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const { automatedUpdate } = await import("${repoUrl}/scripts/resource-guard.mjs");
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
        await automatedUpdate(who, { "system.resources.hope.value": 6 });
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
        const { automatedUpdate } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const m = game.messages.get("${listened}");
        if (m) { delete m.rolls; await m.delete(); }
        await S.deathStore.drop("${ids.botan}");
        if (S.rerollBookmarkStore.has("${ids.aiko}")) await S.rerollBookmarkStore.drop("${ids.aiko}");
        await automatedUpdate(game.actors.get("${ids.aiko}"), { "system.resources.hope.value": globalThis.__secListenHope });
        delete globalThis.__secListenHope;
        return true;`, { timeout: 30000 });
    await settle(300);
    check("SECURITY: a Listen's Reroll names whom the roller's own browser hears - a death only the GMs hold is not told by it",
        Boolean(listened) && armed.row && armed.gmDead && heard.made && heard.sees.includes("Botan Kage")
        && Boolean(heard.card) && heard.card.includes("Botan Kage"), JSON.stringify({ rooms, listened, armed, heard }));

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
