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

    // 4b. call.arm: p1 arms a Support on Botan, paid for by Botan.
    const call = { key: "support", grants: "advantage", kind: "hope", from: ids.botan };
    const readArm = `return { armed: game.actors.get("${ids.botan}").getFlag("${MOD}", "pendingCall") ?? null };`;
    const arm = await forge("call.arm", { actorId: ids.botan, call }, readArm);
    check("SECURITY: a forged call.arm paid for by Botan changed nothing on the GM", arm.unchanged, JSON.stringify(arm));
    check("SECURITY: the GM refused the forged call.arm for ownership, and told p1",
        arm.forOwnership && arm.told.some(t => t.what === "call.arm"), JSON.stringify({ reasons: arm.reasons, told: arm.told }));
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        await B.requestArmCall("${ids.botan}", ${JSON.stringify(call)}); return true;`);
    await settle(900);
    const armOk = await gm.eval(readArm);
    check("control: the same call.arm from Botan's own player does arm the Call",
        JSON.stringify(armOk) !== JSON.stringify(arm.after) && JSON.stringify(armOk.armed ?? []).includes("support"), JSON.stringify(armOk));

    // 4c. murder.crisis: p1 throws the finishing blow as Botan, the killer.
    //     The incident is opened the way 13-murder-signals opens one; the killer's
    //     player sits still so an opening roll cannot race the GM's.
    await p2.eval(`globalThis.__dialogAuto = false; return true;`);
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.botan}", victimId: "${ids.daichi}" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await game.drpg.passTurn();
        return true;`, { timeout: 60000 });
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

    // summary of what server refused
    check("SECURITY: server logged permission denials for player writes", (permissionDenials ?? []).length >= 2, JSON.stringify((permissionDenials||[]).slice(0,8)));
}
