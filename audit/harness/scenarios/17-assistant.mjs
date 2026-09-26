/**
 * An Assistant GM is a GM (E30, 24.09.2026; audit S14-28).
 *
 * Five clients: the seed's GM and three players, and `ag`, an Assistant (role 3)
 * declared below. The module has leaned on Assistants for a long time - utils.mjs
 * prefers a full GM as the primary and falls back to an Assistant, despair.mjs
 * grants one a pool - and until E30 the harness treated role 3 as a player, so
 * none of it ran headless. The sections:
 *   A  who is a GM: every client agrees, the full GM is the primary, and what is
 *      the GMs' reaches the Assistant (a private card, the fog ledger);
 *   B  one writer: with two GM clients, each request is carried out once, by
 *      the primary;
 *   C  what an Assistant may do: a pool when granted one, and not the role or
 *      the users that belong to a Gamemaster;
 *   D  the full GM leaves: the Assistant becomes the primary and carries out
 *      what B's GM did;
 *   E  no exception escaped into Foundry on any client.
 * What v14 itself allows an Assistant is modelled, not measured: LIVE-E30-04,
 * -05 and -06 in audit/AUDIT-1.2.42.md section 9.2.
 */
export const layers = ["ci"];
export const accounts = [{ who: "ag", id: "USERAG0000000000", name: "Assistant", role: 3, character: null, color: "#aa66ff" }];

const MOD = "danganronpa-rpg";
const DH = "system.daggerheart";

export async function run({ gm, ag, p1, p2, p3, check, settle, opLog, socketTraffic, disconnect, IDS, repoUrl }) {
    const utils = `(await import("${repoUrl}/scripts/utils.mjs"))`;
    const scene = IDS.scene;

    /* ------------------------------ A. who is a GM ------------------------------ */

    const self = await ag.eval(`return { role: game.user.role, isGM: game.user.isGM };`);
    check("A1: the Assistant is role 3 and a GM on its own client", self.role === 3 && self.isGM === true, JSON.stringify(self));

    const seen = {};
    for (const c of [gm, p1, p2]) seen[c.who] = await c.eval(`return game.users.get("${IDS.ag}")?.isGM ?? null;`);
    check("A2: the GM and the players see the Assistant as a GM", Object.values(seen).every(v => v === true), JSON.stringify(seen));

    const primary = {};
    for (const c of [gm, ag, p1, p2]) primary[c.who] = await c.eval(`const U = ${utils}; return { primary: U.primaryGmId(), me: U.isPrimaryGm() };`);
    check("A3: every client names the full GM as the primary, and only the GM's client says it is",
        Object.values(primary).every(v => v.primary === IDS.gm) && Object.entries(primary).every(([who, v]) => v.me === (who === "gm")),
        JSON.stringify(primary));

    const guard = await ag.eval(`return game.drpg.relayGuard().state;`);
    check("A4: the relay guard stands on the Assistant's client", guard === "ok", guard);

    const card = await gm.eval(`const m = await game.drpg.whisperToGms("<p>E30 Assistant probe card</p>"); return m?.id ?? null;`);
    await settle(600);
    const words = c => c.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const m = game.messages.get("${card}"); return m ? { held: true, words: S.contentOf(m) } : { held: false };`);
    const cardOn = { ag: await words(ag), p1: await words(p1) };
    check("A5: a card whispered to the GMs gives the Assistant its words, and a player the message without them",
        Boolean(card) && cardOn.ag.held && String(cardOn.ag.words).includes("E30 Assistant probe card")
        && cardOn.p1.held && !String(cardOn.p1.words).includes("E30 Assistant probe card"), JSON.stringify({ card, cardOn }));

    await gm.eval(`const F = await import("${repoUrl}/scripts/fog.mjs");
        await F.setDiscovery(game.scenes.get("${scene}"), { actorId: "${IDS.aiko}", rooms: ["Gym"], value: true }); return true;`);
    await settle(800);
    // Through the leaf (E04): the GMs' store on the Assistant's browser, a player's own copy on theirs.
    const ledgerOn = c => c.eval(`return (await import("${repoUrl}/scripts/settings.mjs")).discoveryLedger();`);
    const fog = {
        ag: (await ledgerOn(ag))?.[scene]?.[IDS.aiko] ?? null,
        p1: (await ledgerOn(p1))?.[scene]?.[IDS.aiko] ?? null,
        p2: await ledgerOn(p2)
    };
    check("A6: the GM's fog discovery reaches the Assistant whole, Aiko's player as their own row, and another player not at all",
        Boolean(fog.ag?.includes("Gym")) && Boolean(fog.p1?.includes("Gym")) && !JSON.stringify(fog.p2 ?? {}).includes(IDS.aiko),
        JSON.stringify(fog));

    /* ------------------------------ B. one writer ------------------------------- */

    const hopeOf = (c, id) => c.eval(`return game.actors.get("${id}").system.resources.hope.value;`);
    const writesTo = (mark, id) => opLog.slice(mark).filter(w => w.coll === "Actor" && w.docId === id).map(w => `${w.who} ${w.action}`);
    const refusalsOn = c => c.eval(`return ${utils}.sessionFailures().filter(e => e.message.includes("Refused a Daggerheart")).map(e => e.message);`);
    const clearRefusals = cs => Promise.all(cs.map(c => c.eval(`${utils}.clearSessionFailures(); return true;`)));
    const relayHope = (id, value) => p1.eval(`game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateDocument",
        uuid: "Actor.${id}", data: { "system.resources.hope.value": ${value} } } }); return true;`);
    const fogRowsAfter = mark => socketTraffic.slice(mark).filter(s => s.action === "fog.rows").map(s => ({ from: s.from, to: s.to }));
    const askFog = () => p2.eval(`game.socket.emit("module.${MOD}", { action: "fog.request" }, { recipients: ${utils}.activeGmIds() }); return true;`);

    // The shape 30-security sends for a player's own roll: Aiko's Hope, from Aiko's player.
    let mark = opLog.length;
    const hope0 = await hopeOf(gm, IDS.aiko);
    const hope1 = hope0 > 0 ? hope0 - 1 : hope0 + 1;
    await relayHope(IDS.aiko, hope1);
    await settle(1200);
    const b1 = { writes: writesTo(mark, IDS.aiko), gm: await hopeOf(gm, IDS.aiko), ag: await hopeOf(ag, IDS.aiko) };
    check("B1: a player's own Hope through Daggerheart's relay is written once, by the primary GM, and both GMs read it",
        JSON.stringify(b1.writes) === JSON.stringify(["gm update"]) && b1.gm === hope1 && b1.ag === hope1, JSON.stringify({ hope0, hope1, ...b1 }));

    await clearRefusals([gm, ag]);
    mark = opLog.length;
    const botan0 = await hopeOf(gm, IDS.botan);
    await relayHope(IDS.botan, botan0 === 6 ? 5 : 6);
    await settle(1200);
    const b2 = { writes: writesTo(mark, IDS.botan), botan: await hopeOf(gm, IDS.botan), gm: await refusalsOn(gm), ag: await refusalsOn(ag) };
    check("B2: a player's change to another student through the relay changes nothing, and is refused once, by the primary GM",
        b2.writes.length === 0 && b2.botan === botan0 && b2.gm.length === 1 && b2.ag.length === 0, JSON.stringify({ botan0, ...b2 }));

    let traffic = socketTraffic.length;
    await askFog();
    await settle(800);
    const b3 = fogRowsAfter(traffic);
    check("B3: a player's fog request to every GM is answered once, by the primary GM",
        b3.length === 1 && b3[0].from === "gm" && JSON.stringify(b3[0].to) === JSON.stringify([IDS.p2]), JSON.stringify(b3));

    // 30-security's control handover: Botan's own player gives Aiko an item, in one room.
    const itemId = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 1500, y: 300 });
        const item = await INV.grantItem(game.actors.get("${IDS.botan}"), { name: "E30 wrench", category: "tool", tier: 1 });
        return item?.id ?? null;`, { timeout: 60000 });
    await settle(400);
    mark = opLog.length;
    await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        B.requestGiveItem({ fromId: "${IDS.botan}", toId: "${IDS.aiko}", itemId: "${itemId}" }); return true;`);
    await settle(1200);
    const b4 = {
        writes: opLog.slice(mark).filter(w => w.embeddedName === "Item").map(w => `${w.who} ${w.action} ${w.docId}`).sort(),
        aiko: await gm.eval(`return game.actors.get("${IDS.aiko}").items.filter(i => i.name === "E30 wrench").length;`)
    };
    check("B4: a handover a player asks for moves the item once - one create and one delete, both by the primary GM",
        Boolean(itemId) && JSON.stringify(b4.writes) === JSON.stringify([`gm embedded-create ${IDS.aiko}`, `gm embedded-delete ${IDS.botan}`])
        && b4.aiko === 1, JSON.stringify({ itemId, ...b4 }));

    /* --------------------------- C. what an Assistant may do --------------------------- */

    const pools = c => c.eval(`return { candidates: game.drpg.poolCandidates().map(u => u.id), pools: game.drpg.monokumas().map(u => u.id) };`);
    const before = await pools(gm);
    await gm.eval(`await game.drpg.addPool("${IDS.ag}"); return true;`);
    await settle(400);
    const granted = { gm: await pools(gm), p1: await pools(p1) };
    await gm.eval(`await game.drpg.removePool("${IDS.ag}"); return true;`);
    await settle(400);
    const revoked = await pools(gm);
    check("C4: the Assistant is offered a Despair pool, has one on every client once granted, and none once it is revoked",
        before.candidates.includes(IDS.ag) && !before.pools.includes(IDS.ag) && granted.gm.pools.includes(IDS.ag)
        && granted.p1.pools.includes(IDS.ag) && !revoked.pools.includes(IDS.ag), JSON.stringify({ before, granted, revoked }));

    const roleOfAg = () => gm.eval(`return game.users.get("${IDS.ag}").role;`);
    const putBack = () => gm.eval(`const u = game.users.get("${IDS.ag}"); if (u.role !== 3) await u.update({ role: 3 });
        for (const extra of game.users.filter(x => x.name === "E30 relay user")) await extra.delete();
        return true;`);
    try {
        const c1 = await ag.eval(`try { await game.user.update({ role: 4 }); return "WRITE SUCCEEDED"; } catch (err) { return "denied: " + err.message; }`);
        const c1Role = await roleOfAg();
        check("C1: the Assistant's own write of role 4 is refused (the harness's model of v14, LIVE-E30-04)",
            String(c1).startsWith("denied") && c1Role === 3, JSON.stringify({ c1, c1Role }));

        /* C2 and C3 also ask for the refusal, on the primary GM and nowhere else (E30 fix,
           25.09.2026): "the role did not change" alone passes as well on a request that
           never arrived. Measured with the two emits sent to a channel nobody listens on:
           the old checks passed, these two failed. */
        await clearRefusals([gm, ag]);
        await ag.eval(`game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateDocument",
            uuid: game.user.uuid, data: { role: 4 } } }); return true;`);
        await settle(1200);
        const c2 = { role: await roleOfAg(), gm: await refusalsOn(gm), ag: await refusalsOn(ag) };
        check("C2: a request through Daggerheart's relay does not give the Assistant role 4, and the primary GM refuses it",
            c2.role === 3 && c2.gm.length === 1 && c2.gm[0].includes("from Assistant") && c2.ag.length === 0, JSON.stringify(c2));
        // Put back before C3: a role-4 Assistant would sort ahead of the GM and become the primary.
        await putBack();
        await settle(400);

        await clearRefusals([gm, ag]);
        const usersBefore = await gm.eval(`return game.users.size;`);
        await ag.eval(`game.socket.emit("${DH}", { action: "DhGMCreate", data: { documentType: "User",
            data: { name: "E30 relay user", role: 4 } } }); return true;`);
        await settle(1200);
        const usersAfter = await gm.eval(`return game.users.size;`);
        const c3 = { usersBefore, usersAfter, gm: await refusalsOn(gm), ag: await refusalsOn(ag) };
        check("C3: a request through Daggerheart's relay does not create a user, and the primary GM refuses it",
            usersAfter === usersBefore && c3.gm.length === 1 && c3.gm[0].includes("from Assistant") && c3.ag.length === 0, JSON.stringify(c3));
    } finally {
        await putBack();
        await settle(400);
    }

    /* ---------------------------- D. the full GM leaves ----------------------------- */

    const gmErrors = await gm.eval(`return (globalThis.__errors ?? []).map(e => e.where + ": " + e.message);`);
    check("E: no exception escaped into Foundry on the GM's client", gmErrors.length === 0, JSON.stringify(gmErrors));

    await disconnect("gm");
    await settle(600);
    const primaryAfter = {};
    for (const c of [ag, p1, p2]) primaryAfter[c.who] = await c.eval(`return ${utils}.primaryGmId();`);
    check("D1: with the GM gone, every client names the Assistant as the primary",
        Object.values(primaryAfter).every(v => v === IDS.ag), JSON.stringify(primaryAfter));

    mark = opLog.length;
    const hope2 = await hopeOf(ag, IDS.aiko);
    const hope3 = hope2 > 0 ? hope2 - 1 : hope2 + 1;
    await relayHope(IDS.aiko, hope3);
    await settle(1200);
    const d2 = { writes: writesTo(mark, IDS.aiko), ag: await hopeOf(ag, IDS.aiko), p1: await hopeOf(p1, IDS.aiko) };
    check("D2: a player's own Hope through the relay is written once, by the Assistant",
        JSON.stringify(d2.writes) === JSON.stringify(["ag update"]) && d2.ag === hope3 && d2.p1 === hope3, JSON.stringify({ hope2, hope3, ...d2 }));

    await clearRefusals([ag]);
    mark = opLog.length;
    const botan1 = await hopeOf(ag, IDS.botan);
    await relayHope(IDS.botan, botan1 === 6 ? 5 : 6);
    await settle(1200);
    const d3 = { writes: writesTo(mark, IDS.botan), botan: await hopeOf(ag, IDS.botan), ag: await refusalsOn(ag) };
    check("D3: a player's change to another student is refused by the Assistant, and changes nothing",
        d3.writes.length === 0 && d3.botan === botan1 && d3.ag.length === 1, JSON.stringify({ botan1, ...d3 }));

    traffic = socketTraffic.length;
    await askFog();
    await settle(800);
    const d4 = fogRowsAfter(traffic);
    check("D4: a player's fog request is answered once, by the Assistant",
        d4.length === 1 && d4[0].from === "ag" && JSON.stringify(d4[0].to) === JSON.stringify([IDS.p2]), JSON.stringify(d4));

    const errors = {};
    for (const c of [ag, p1, p2, p3]) errors[c.who] = await c.eval(`return (globalThis.__errors ?? []).map(e => e.where + ": " + e.message);`);
    check("E: no exception escaped into Foundry on any client still at the table",
        Object.values(errors).every(list => list.length === 0), JSON.stringify(errors));
}
