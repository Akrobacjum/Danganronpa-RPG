const MOD = "danganronpa-rpg";
const SOCKET = `module.${MOD}`;
export async function run({ gm, p1, p2, check, settle, permissionDenials, repoUrl }) {
    const ids = await gm.eval(`return { aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id, chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id };`);

    // 1. XSS via messenger free text (player writes hostile markup)
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
    await p2.eval(`globalThis.__dialogAuto = false; return true;`);
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.botan}", victimId: "${ids.daichi}" });
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
    const early = await gm.eval(`return { dead: game.drpg.isDeceased(game.actors.get("${ids.daichi}")),
        reasons: (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "murder.crisis"')).map(e => e.message) };`);
    check("SECURITY: a finishing blow thrown out of turn by the killer's own player kills nobody and is refused",
        victimTurn === "victim" && early.dead === false && early.reasons.some(r => /not their turn/.test(r)), JSON.stringify({ victimTurn, ...early }));
    await toSide("killer");
    await settle(500);
    const readCrisis = `return { stage: game.drpg.murderState()?.stage ?? null, dead: game.drpg.isDeceased(game.actors.get("${ids.daichi}")) };`;
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

    /*
     * 5. A player calling a GM-side pool write through the API.
     *
     * This was `check(..., true)` - "does not throw uncaught" - and passed whatever
     * happened. What matters is the pool: p1 tries to drain the GM's Despair pool,
     * and the GM's reading must not move. (It used to pass an actor id, which is not
     * what `adjustDespair` takes - pools are keyed by the Monokuma's user id.)
     */
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
     * beside it: the same road taken honestly still works. A "Reroll receipt" is made
     * the way a real Reroll makes one: the player rewrites the rolls of their own
     * character's roll message (reroll-receipts.mjs).
     */
    const refusedFor = async action => gm.eval(`return (await import("${repoUrl}/scripts/utils.mjs")).sessionFailures()
        .filter(e => e.message.includes('Refused a "${action}"')).map(e => e.message);`);
    const clearFailures = () => gm.eval(`(await import("${repoUrl}/scripts/utils.mjs")).clearSessionFailures(); return true;`);
    const toGms = `{ recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) }`;
    /** A roll message of the player's own character, and then its rolls rewritten - a Reroll's receipt. */
    const rerollOn = (client, actorId, { fearBefore = false, fearAfter = false } = {}) => client.eval(`
        const roll = fear => ({ class: "DualityRoll", formula: "1d12 + 1d12", total: 14,
            dHope: { total: fear ? 3 : 9 }, dFear: { total: fear ? 9 : 3 } });
        const m = await ChatMessage.create({ speaker: { actor: "${actorId}" }, content: "roll",
            rolls: [JSON.stringify(roll(${fearBefore}))] });
        await new Promise(r => setTimeout(r, 200));
        await m.update({ rolls: [JSON.stringify(roll(${fearAfter}))] });
        return m.id;`, { timeout: 30000 });

    // 7a. project.unsabotage: a repair id that is not the one the sabotage made.
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
    check("SECURITY: an unsabotage naming a project that is not the repair deletes nothing and thaws nothing",
        Boolean(sabotaged.repair) && mismatched.after.secret && mismatched.after.repair && mismatched.after.frozen
        && mismatched.reasons.some(r => /not what froze|does not repair/.test(r)), JSON.stringify({ sabotaged, mismatched }));
    await clearFailures();
    await p2.eval(`game.socket.emit("${SOCKET}", { action: "project.unsabotage", userId: game.user.id, requestId: "noreceipt",
        targetId: "${projects.pub}", repairId: "${sabotaged.repair}", actorId: "${ids.botan}" }, ${toGms}); return true;`);
    await settle(1200);
    const noReceipt = { after: await gm.eval(readPair), reasons: await refusedFor("project.unsabotage") };
    check("SECURITY: the saboteur's own unsabotage with no Reroll behind it is refused",
        noReceipt.after.frozen && noReceipt.after.repair && noReceipt.reasons.some(r => /no Reroll/.test(r)), JSON.stringify(noReceipt));
    await rerollOn(p2, ids.botan);
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestUndoSabotage("${projects.pub}", "${sabotaged.repair}", "${ids.botan}"); return true;`);
    await settle(1500);
    const undone = await gm.eval(readPair);
    check("control: after a Reroll of Botan's roll, the same unsabotage thaws the project and removes its repair",
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

    // 7c. observe.resolve with somebody else's key.
    const observed = await gm.eval(`
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1400, y: 400, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.chie}", sourceName: "Chie Mori", room: "Cafeteria", subject: "SEC cup" });
        const O = await import("${repoUrl}/scripts/observe.mjs");
        const r = await O.chooseObserveTarget({ actorId: "${ids.botan}", declaration: "general", userId: "${p2.userId}" });
        return { key: r?.key ?? null, ok: r?.ok ?? false, reason: r?.reason ?? null };`, { timeout: 60000 });
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

    // 7d. despair.adjust with no Reroll behind it, then with one, then again.
    const readPool = `return { pool: game.drpg.getDespair(game.user.id) };`;
    const noReroll = await forge("despair.adjust", { targetUserId: gm.userId, delta: -1, actorId: ids.aiko }, readPool);
    check("SECURITY: a player's Despair correction with no Reroll moves no pool",
        noReroll.unchanged && noReroll.reasons.some(r => /no Reroll/.test(r)), JSON.stringify(noReroll));
    await rerollOn(p1, ids.aiko, { fearBefore: false, fearAfter: true });
    await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        await B.requestDespairAdjust("${gm.userId}", 1, { actorId: "${ids.aiko}" }); return true;`);
    await settle(1500);
    const paidPoint = await gm.eval(readPool);
    check("control: after a Reroll that turned Aiko's roll into Despair, her player's +1 lands",
        paidPoint.pool === noReroll.after.pool + 1, JSON.stringify({ before: noReroll.after, after: paidPoint }));
    await clearFailures();
    await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        await B.requestDespairAdjust("${gm.userId}", 1, { actorId: "${ids.aiko}" }); return true;`);
    await settle(1200);
    const secondPoint = { after: await gm.eval(readPool), reasons: await refusedFor("despair.adjust") };
    check("SECURITY: one Reroll pays for one Despair correction",
        secondPoint.after.pool === paidPoint.pool && secondPoint.reasons.some(r => /already undone/.test(r)), JSON.stringify(secondPoint));

    // 7e. token.sendBack to somewhere the token never stood.
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
     * 7j. remnant.edit: a Reroll re-rates the trace its first throw left, and no
     * other. The first E03 build asked "fresh, and no GM has written on it" only of
     * a removal, so a receipt from any Reroll turned a trace a GM had corrected to
     * Hidden (the E03 review). Verified by hand on 24.09.2026: with the retune's
     * `removalRefusal` call taken out of gm-bridge.mjs, the first check FAILED.
     */
    const traceOf = subject => `const R = await import("${repoUrl}/scripts/remnants.mjs");
        const t = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "${subject}");
        return t ? { id: t.id, visibility: R.remnantData(t).visibility } : null;`;
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 1500, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.aiko}", sourceName: "Aiko Hoshino", room: "Cafeteria", subject: "SEC corrected" });
        await R.placeRemnant({ x: 1550, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${ids.aiko}", sourceName: "Aiko Hoshino", room: "Cafeteria", subject: "SEC rerolled" });
        const t = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "SEC corrected");
        await R.markRemnantEdited(t); return true;`, { timeout: 60000 });
    await settle(600);
    const corrected = await gm.eval(traceOf("SEC corrected"));
    const rerolled = await gm.eval(traceOf("SEC rerolled"));
    await clearFailures();
    await rerollOn(p1, ids.aiko);
    await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestRemnantEdit(canvas.scene.id, "${corrected?.id}", { visibility: "hidden" }); return true;`);
    await settle(1500);
    const correctedAfter = { after: await gm.eval(traceOf("SEC corrected")), reasons: await refusedFor("remnant.edit") };
    check("SECURITY: a Reroll does not re-rate a trace a GM has written on",
        Boolean(corrected) && correctedAfter.after?.visibility === corrected.visibility
        && correctedAfter.reasons.some(r => /GM has written/.test(r)), JSON.stringify({ corrected, correctedAfter }));
    await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestRemnantEdit(canvas.scene.id, "${rerolled?.id}", { visibility: "hidden" }); return true;`);
    await settle(1500);
    const rerolledAfter = await gm.eval(traceOf("SEC rerolled"));
    check("control: the same Reroll re-rates the player's own fresh trace",
        Boolean(rerolled) && rerolled.visibility !== "hidden" && rerolledAfter?.visibility === "hidden", JSON.stringify({ rerolled, rerolledAfter }));

    /*
     * 7k. remnant.tieForItem outside a fight (audit S10-11). Holding the object is
     * not enough: the tie is a verdict on evidence, and only a participant of the
     * running incident swings a weapon. No incident runs here, so Aiko's player,
     * holding the object, is refused and the trace stays untied. There is no
     * control beside it - setting up a live incident is 10-murder's work - so it
     * was verified by hand on 24.09.2026: with the incident condition taken out of
     * `handleTieTrace`, this check FAILED (the trace was tied).
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
    const traps = await gm.eval(`const P = await import("${repoUrl}/scripts/projects.mjs");
        const away = await P.createProject({ name: "SEC trap away", target: 4, room: "Storage", secret: true });
        const here = await P.createProject({ name: "SEC trap here", target: 4, room: "Cafeteria", secret: true });
        for (const id of [away.id, here.id]) {
            await P.setProjectMeta(id, { indirectMurder: true, killerId: "${ids.botan}",
                trigger: { kind: "enters", armed: true, firedAt: null } });
        }
        return { away: away.id, here: here.id };`, { timeout: 60000 });
    await settle(600);
    const readTraps = `const P = await import("${repoUrl}/scripts/projects.mjs");
        return { away: P.metaFor("${traps.away}").trigger?.firedAt ?? null, here: P.metaFor("${traps.here}").trigger?.firedAt ?? null };`;
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


    // 7g. search tokens in a room the character is not in, and in the one she is.
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
    await p1.eval(`game.socket.emit("${SOCKET}", { action: "fog.shared",
        store: { [canvas.scene.id]: { "${ids.aiko}": ["Storage", "Gym", "Hall", "Dorm B"] } } }, ${toGms}); return true;`);
    await settle(1200);
    const fogAfter = await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs");
        return F.discoveredFor(canvas.scene.id, "${ids.aiko}");`);
    check("SECURITY: a fog ledger nobody asked for adds no rooms to a character's record",
        !JSON.stringify(fogAfter ?? []).includes("Storage"), JSON.stringify(fogAfter));

    /*
     * 7i. ownership raised past the window's back, and a player's edit of their own bullet.
     *
     * The harness's `noHook` silences the `updateActor` hook as well as the `pre`
     * one (lib/shim.mjs says why), so this proves the road that does not depend on
     * it: the Configure Ownership window closing on the GM who used it. Verified by
     * hand on 24.09.2026: with the close hook's `lowerOwnership` call removed from
     * anonymity.mjs, this check FAILED (ownership stayed 3).
     */
    await gm.eval(`const a = game.actors.get("${ids.daichi}");
        await a.update({ "ownership.default": 3 }, { noHook: true });
        Hooks.callAll("closeDocumentOwnershipConfig", { document: a }); return true;`);
    await settle(1500);
    const ownership = await gm.eval(`return game.actors.get("${ids.daichi}").ownership.default;`);
    check("SECURITY: a character shared as Owner with every player is put back to Observer", ownership === 2, JSON.stringify({ ownership }));
    const bullet = await gm.eval(`return game.actors.get("${ids.botan}").items.find(i => i.getFlag("${MOD}", "isTruthBullet"))?.id ?? null;`);
    const readBullet = `const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        return { text: b?.getFlag("${MOD}", "playerText") ?? null, analyzed: b?.getFlag("${MOD}", "analyzed") ?? null };`;
    const bulletBefore = await gm.eval(readBullet);
    await p2.eval(`const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await b.update({ "flags.${MOD}.playerText": "SEC rewritten", "flags.${MOD}.analyzed": true }); return true;`);
    await settle(1500);
    const bulletAfter = await gm.eval(readBullet);
    check("SECURITY: a player's edit of what their Truth Bullet says or is, is put back",
        Boolean(bullet) && JSON.stringify(bulletAfter) === JSON.stringify(bulletBefore), JSON.stringify({ bulletBefore, bulletAfter }));

    /*
     * A bullet with no record is not called "put back". The record is dropped by
     * hand here - the state every bullet made before E03 was in while the load-time
     * record never ran - and the GM must be told the edit stayed, not that it was
     * undone. Then the text is put right by the GM, so nothing after this reads a
     * rewritten bullet.
     */
    await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await T.setSecret(b.uuid, { guard: null }); return true;`);
    const whispersBefore = await gm.eval(`return game.messages.size;`);
    await p2.eval(`const b = game.actors.get("${ids.botan}").items.get("${bullet}");
        await b.update({ "flags.${MOD}.playerText": "SEC unrecorded" }); return true;`);
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

    // The load-time record of every bullet ran on the GM (the E03 review measured it running 0 times).
    const guardRan = await gm.eval(`const T = await import("${repoUrl}/scripts/truth-bullets.mjs"); return T.bulletGuardStatus();`);
    check("SECURITY: the GM recorded the Truth Bullets that existed at load", guardRan.runs === 1, JSON.stringify(guardRan));

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
    } finally {
        await gm.eval(`const u = game.users.get("${p1.userId}"); if (u.role !== 1) await u.update({ role: 1 }); return true;`);
    }

    // summary of what server refused
    check("SECURITY: server logged permission denials for player writes", (permissionDenials ?? []).length >= 2, JSON.stringify((permissionDenials||[]).slice(0,8)));
}
