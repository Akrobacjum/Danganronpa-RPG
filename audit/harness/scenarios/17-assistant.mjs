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
 *   E  no exception escaped into Foundry on any client;
 *   F  a body's discovery is the primary's: two GMs announcing one body at once
 *      post one card (run before D, while the full GM is here; E11 fix r1-G2);
 *   G  one dice look, the GM's, on every user below full Gamemaster and on their
 *      characters (E16 p1 C3, C4), and an Assistant's write of the GMs' copy
 *      of them refused (E16 fix r1-G2), or of the two switches put back (E16
 *      fix r1b-G1), heard or written with no hook (E16 fix r1b-G2);
 *   H  a character's dice look with no GM watching: `gm2`, a second full
 *      Gamemaster declared late below, leaves before D and comes back to a table
 *      with no other GM (E16 fix early-C4-G1), last on a browser that never
 *      held the GMs' stores (E16 fix r1b-G1); first, with only the Assistant
 *      at the table, to a character's look the GM gave after it left (E16 fix
 *      r1c-G1).
 * What v14 itself allows an Assistant is modelled, not measured: LIVE-E30-04,
 * -05 and -06 in audit/AUDIT-1.2.42.md section 9.2.
 */
export const layers = ["ci"];
export const accounts = [{ who: "ag", id: "USERAG0000000000", name: "Assistant", role: 3, character: null, color: "#aa66ff" },
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }];

const MOD = "danganronpa-rpg";
const DH = "system.daggerheart";

export async function run({ gm, ag, gm2, p1, p2, p3, check, settle, opLog, socketTraffic, connect, disconnect, storageOf, IDS, repoUrl }) {
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

    /* B5 (E29 fix r2-H12, 06.10.2026): a Truth Bullet's text Botan's player writes through Botan's update
       (`items: [{ _id, flags }]`, which fires no item hook here) is put back once, by the primary GM, with the
       Assistant's client holding the same copy of the bullet; the GMs are told once. At dd67545 (e29run/r2h12red)
       the rewritten text stayed on all three clients, nothing wrote it back and the GMs were told nothing. */
    const bulletId = await gm.eval(`const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const item = await B.createTruthBullet(game.actors.get("${IDS.botan}"), { name: "E29 H12 bullet", realType: "neutral", visibility: "obvious", playerText: "Seen." });
        return item?.id ?? null;`);
    await settle(600);
    mark = opLog.length;
    const said0 = await gm.eval(`return game.messages.size;`);
    await p2.eval(`await game.actors.get("${IDS.botan}").update({ items: [{ _id: "${bulletId}", flags: { "${MOD}": { playerText: "E29 H12 rewritten" } } }] },
        { drpgAutomated: true }); return true;`);
    await settle(1500);
    const textOn = c => c.eval(`return game.actors.get("${IDS.botan}").items.get("${bulletId}")?.getFlag("${MOD}", "playerText") ?? null;`);
    const b5 = {
        writes: opLog.slice(mark).filter(w => w.embeddedName === "Item").map(w => `${w.who} ${w.action} ${w.docId}`),
        texts: [await textOn(gm), await textOn(ag), await textOn(p2)],
        told: await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
            const put = game.i18n.format("DRPG.TruthBullet.editReverted", { player: "", bullet: "" }).slice(-40);
            return game.messages.contents.slice(${said0}).filter(m => String(S.contentOf(m) || m.content || "").includes(put)).length;`)
    };
    await gm.eval(`await game.actors.get("${IDS.botan}").items.get("${bulletId}")?.delete(); return true;`);
    await settle(400);
    check("B5: a player's Truth Bullet text written through their student's update is put back once, by the primary GM, and the GMs are told once",
        Boolean(bulletId) && JSON.stringify(b5.writes) === JSON.stringify([`gm embedded-update ${IDS.botan}`]) && b5.texts.every(t => t === "Seen.")
        && b5.told === 1, JSON.stringify({ bulletId, ...b5 }));

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

    /* ------------------------- F. one discovery, the primary's ------------------------- */

    /* E11 fix r1-G2 (10.10.2026; round 1's goal K6 and sec F1). The GM's announcement ran on
       whichever GM pressed it, and each GM's queue orders its own browser only: two GMs announcing
       one body at once each posted a card and each wrote the stamp from its own copy. Daichi's death
       kept by the GMs; the GM and the Assistant announce it at the same moment, in a room no region
       has (nobody is gathered). Read on the GM: the discovery cards the two presses added and their
       authors, and the stamp rows added; on the Assistant: whether it was told the primary's name.
       Put back after: Daichi revived, the hold and the stamps as they were. */
    const chapterJs = `(await import("${repoUrl}/scripts/chapter.mjs"))`;
    const bodyCards = `game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound")`;
    const stampRows = `Object.values(game.settings.get("${MOD}", "bodiesFound") ?? {}).flat().length`;
    const f0 = await gm.eval(`const kept = Boolean(await ${chapterJs}.killCharacter(game.actors.get("${IDS.daichi}"), { secret: true, keepBullets: true }));
        return { kept, cards: ${bodyCards}.map(m => m.id), rows: ${stampRows},
            stamps: foundry.utils.deepClone(game.settings.get("${MOD}", "bodiesFound") ?? {}), hold: game.settings.get("${MOD}", "bodyFound") ?? {} };`);
    await settle(800);
    const agMark = await ag.eval(`return globalThis.__notifications.length;`);
    const announceOn = c => c.eval(`await ${chapterJs}.discoverBody({ room: "E11 G2 a room no region has",
        victim: game.actors.get("${IDS.daichi}"), scene: game.scenes.get("${scene}") }); return true;`);
    try {
        await Promise.all([announceOn(gm), announceOn(ag)]);
        await settle(1200);
        const f1 = {
            kept: f0.kept,
            ...await gm.eval(`const before = new Set(${JSON.stringify(f0.cards)});
                return { cards: ${bodyCards}.filter(m => !before.has(m.id)).map(m => m.author?.id ?? m.user?.id ?? null), rows: ${stampRows} - ${f0.rows} };`),
            told: await ag.eval(`const said = game.i18n.format("DRPG.Chapter.bodyPrimaryOnly", { name: game.users.get("${IDS.gm}")?.name ?? "?" });
                return globalThis.__notifications.slice(${agMark}).some(n => n.msg === said);`)
        };
        check("F1: two GMs announcing one body at once post one card and one stamp row, the primary's, and the Assistant is told whose the announcement is",
            f1.kept && JSON.stringify(f1.cards) === JSON.stringify([IDS.gm]) && f1.rows === 1 && f1.told === true, JSON.stringify(f1));
    } finally {
        await gm.eval(`const C = ${chapterJs}; const a = game.actors.get("${IDS.daichi}");
            if (C.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true });
            await game.settings.set("${MOD}", "bodyFound", ${JSON.stringify(f0.hold)});
            await game.settings.set("${MOD}", "bodiesFound", ${JSON.stringify(f0.stamps)}); return true;`);
        await settle(600);
    }

    /* ------------------- G. one dice look: the GM's, on every user below it ------------------- */
    /* E16 p1 C3, 19.10.2026 (E16-15, E16-19; the owner's Q3 of 19.10: Assistant GMs are forced too). The GM gives
       themself a Dice So Nice look; then p1 and the Assistant each write a look of their own from their own console,
       the road a player's browser takes past every hook of the module's (written by that user, as Foundry stamps it).
       Read: each user's flags on every client against the GM's look as the GM's dice-sync.mjs gives it, who wrote
       the User after the console's write (opLog), and the line p1 is told. D5 below asks the same of the Assistant
       once it is the primary. */
    const DSN = "dice-so-nice";
    const syncJs = `(await import("${repoUrl}/scripts/dice-sync.mjs"))`;
    const lookOn = (c, id) => c.eval(`const f = game.users.get("${id}")?.flags?.["${DSN}"] ?? {};
        return JSON.stringify([f.appearance ?? null, f.sfxList ?? null]);`);
    const canonOn = c => c.eval(`const l = ${syncJs}.canonicalLook(); return l ? JSON.stringify([l.appearance, l.sfxList]) : null;`);
    const userWrites = (from, id) => opLog.slice(from).filter(w => w.coll === "User" && w.docId === id).map(w => `${w.who} ${w.action}`);
    await gm.eval(`await game.user.update({ "flags.${DSN}.appearance": { global: { colorset: "fire" } }, "flags.${DSN}.sfxList": [] }); return true;`);
    await settle(1500);
    const canon = await canonOn(gm);
    mark = opLog.length;
    const p1Told = await p1.eval(`return globalThis.__notifications.length;`);
    await p1.eval(`await game.user.setFlag("${DSN}", "appearance", { global: { colorset: "black" }, d6: { colorset: "bloodmoon" } }); return true;`);
    await ag.eval(`await game.user.setFlag("${DSN}", "appearance", { global: { colorset: "emerald" } }); return true;`);
    await settle(1500);
    const g1 = { canon, writes: { p1: userWrites(mark, IDS.p1), ag: userWrites(mark, IDS.ag) }, held: {},
        told: await p1.eval(`return globalThis.__notifications.slice(${p1Told}).map(n => n.msg);`) };
    for (const c of [gm, ag, p1, p2]) g1.held[c.who] = [await lookOn(c, IDS.p1) === canon, await lookOn(c, IDS.ag) === canon];
    check("G1: a player's and an Assistant's own dice look written from their consoles go back to the GM's on every client, written by the primary GM, and the player is told once",
        Boolean(canon) && JSON.parse(canon)[0]?.global?.colorset === "fire" && Object.values(g1.held).every(([a, b]) => a && b)
        && JSON.stringify(g1.writes) === JSON.stringify({ p1: ["p1 update", "gm update"], ag: ["ag update", "gm update"] })
        && JSON.stringify(g1.told) === JSON.stringify(["Your dice look is set by the GM."]), JSON.stringify(g1));

    /* E16 p1 C4, 19.10.2026 (E16-21, E16-22). DSN lays an actor's own `flags.dice-so-nice.appearance` over its
       user's look, so G2: the GM gives p2's character an overlay; then p2 and the Assistant each write one of their
       own on it from their own consoles (Foundry stamps each with its writer), and the GM gives Daichi, a student no
       player owns, one of its own. Read: the overlays on every client, who wrote each actor after the GM's write
       (opLog), and the line p2 is told. G3: p1 writes its own look with `noHook` from its console, which no hook
       hears, then posts a message as its character: the GM puts the look back then. */
    const overlayOn = (c, id) => c.eval(`return JSON.stringify(game.actors.get("${id}")?.flags?.["${DSN}"]?.appearance ?? null);`);
    const actorWrites = (from, id) => opLog.slice(from).filter(w => w.coll === "Actor" && w.docId === id).map(w => `${w.who} ${w.action}`);
    const gmOverlay = JSON.stringify({ global: { colorset: "ice" } });
    await gm.eval(`await game.actors.get("${IDS.botan}").update({ "flags.${DSN}.appearance": ${gmOverlay} }); return true;`);
    await settle(1200);
    mark = opLog.length;
    const p2Told = await p2.eval(`return globalThis.__notifications.length;`);
    await p2.eval(`await game.actors.get("${IDS.botan}").setFlag("${DSN}", "appearance", { global: { colorset: "black" }, d6: { colorset: "bloodmoon" } }); return true;`);
    await settle(1500);
    await ag.eval(`await game.actors.get("${IDS.botan}").setFlag("${DSN}", "appearance", { global: { colorset: "emerald" } }); return true;`);
    await settle(1500);
    await gm.eval(`await game.actors.get("${IDS.daichi}").setFlag("${DSN}", "appearance", { global: { colorset: "fire" } }); return true;`);
    await settle(1500);
    const g2 = { writes: { botan: actorWrites(mark, IDS.botan), daichi: actorWrites(mark, IDS.daichi) }, held: {},
        told: await p2.eval(`return globalThis.__notifications.slice(${p2Told}).map(n => n.msg);`) };
    for (const c of [gm, ag, p1, p2]) g2.held[c.who] = [await overlayOn(c, IDS.botan) === gmOverlay, JSON.parse(await overlayOn(c, IDS.daichi))?.global?.colorset ?? null];
    check("G2: a character's dice look written by its player or an Assistant goes back to the GM's on every client, written by the primary GM, the player told once, and a GM's own on a student no player owns stands",
        Object.values(g2.held).every(([back, own]) => back && own === "fire")
        && JSON.stringify(g2.writes) === JSON.stringify({ botan: ["p2 update", "gm update", "ag update", "gm update"], daichi: ["gm update"] })
        && JSON.stringify(g2.told) === JSON.stringify(["Your dice look is set by the GM."]), JSON.stringify(g2));

    mark = opLog.length;
    await p1.eval(`await game.user.update({ "flags.${DSN}.appearance": { global: { colorset: "black" } } }, { noHook: true }); return true;`);
    await settle(1500);
    const g3 = { quiet: await lookOn(gm, IDS.p1) !== canon, writesQuiet: userWrites(mark, IDS.p1) };
    await p1.eval(`await ChatMessage.create({ content: "E16 throw", speaker: { actor: "${IDS.aiko}" } }); return true;`);
    await settle(1500);
    Object.assign(g3, { writes: userWrites(mark, IDS.p1), held: [await lookOn(gm, IDS.p1) === canon, await lookOn(p1, IDS.p1) === canon] });
    check("G3: a player's own dice look written with no hook stands until its next message, and the GM puts it back then",
        g3.quiet && JSON.stringify(g3.writesQuiet) === JSON.stringify(["p1 update"])
        && JSON.stringify(g3.writes) === JSON.stringify(["p1 update", "gm update"]) && g3.held.every(Boolean), JSON.stringify(g3));

    /* E16 fix r1-G2, 19.10.2026 (finding sec-3). The GMs' copy of each character's overlay (gm-stores.mjs
       `diceLookStore`) is what the primary holds Botan to, and the stores merged a delta from any GM, an Assistant
       too. G4: the Assistant's console writes Botan's row through the store's handle, then sends a delta of its own
       on the module's socket with the newest stamp, the road a console takes past the handle; then p2 posts a
       message as Botan. Read: the GM's copy of Botan's row, Botan's overlay on the GM and who wrote Botan after the
       Assistant's writes (opLog). At feb3be8: the row and the overlay the Assistant's, written by the GM. */
    const lookStoreJs = `(await import("${repoUrl}/scripts/gm-stores.mjs")).diceLookStore`;
    const emerald = JSON.stringify({ global: { colorset: "emerald" } });
    mark = opLog.length;
    await ag.eval(`await ${lookStoreJs}.patch("${IDS.botan}", { look: ${emerald} }); return true;`);
    await ag.eval(`game.socket.emit("module.${MOD}", { action: "gms.delta", world: String(game.world.id), store: "diceLooks",
        delta: { e: { "${IDS.botan}": { look: ${emerald} } }, t: { "${IDS.botan}": Math.floor(game.time.serverTime) + 1000 }, d: {}, cleared: 0 } },
        { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(1500);
    const g4 = { row: await gm.eval(`return JSON.stringify(${lookStoreJs}.get("${IDS.botan}")?.look ?? null);`) };
    await p2.eval(`await ChatMessage.create({ content: "E16 throw as Botan", speaker: { actor: "${IDS.botan}" } }); return true;`);
    await settle(1500);
    Object.assign(g4, { held: await overlayOn(gm, IDS.botan), writes: actorWrites(mark, IDS.botan) });
    check("G4: an Assistant's write of the GMs' copy of a character's dice look, through the store or its own packet, is refused, and the character keeps the GM's look at its player's next throw",
        g4.row === gmOverlay && g4.held === gmOverlay && g4.writes.length === 0, JSON.stringify(g4));

    /* E16 fix r1b-G1, 19.10.2026 (finding E16-COR-2; the owner's Q5 runs on its default (a)). Foundry lets an
       Assistant write a world setting, so the Assistant's console switched `forceDiceLook` off - and threw in its own
       look from then on - or pointed `diceLookSource` at gm2, a full Gamemaster offline with no look, which the
       primary then spread to every player. G5: the Assistant's console does both, 1.5 s apart. Read: both settings on
       every client against what they were, p1's look against the GM's, and the GM's notices naming the Assistant.
       At d0c7e6e: off and gm2's on every client, p1 in gm2's look, nothing said. */
    const switchesOn = c => c.eval(`return JSON.stringify([game.settings.get("${MOD}", "forceDiceLook"), game.settings.get("${MOD}", "diceLookSource")]);`);
    const gm2Id = accounts.find(a => a.who === "gm2").id;
    const switches = await switchesOn(gm);
    const gmTold = await gm.eval(`return globalThis.__notifications.length;`);
    await ag.eval(`await game.settings.set("${MOD}", "forceDiceLook", false); return true;`);
    await settle(1500);
    await ag.eval(`await game.settings.set("${MOD}", "diceLookSource", "${gm2Id}"); return true;`);
    await settle(1500);
    const g5 = { switches, held: {}, p1: await lookOn(gm, IDS.p1) === canon,
        told: await gm.eval(`const said = game.i18n.format("DRPG.DiceLook.settingBack", { name: game.users.get("${IDS.ag}").name });
            return globalThis.__notifications.slice(${gmTold}).filter(n => n.msg === said).length;`) };
    for (const c of [gm, ag, p1]) g5.held[c.who] = await switchesOn(c) === switches;
    check("G5: an Assistant's switch of the table's dice look off, or to another full Gamemaster's, is put back on every client, the players keep the GM's look, and the GM is told once",
        JSON.parse(switches)[0] === true && JSON.parse(switches)[1] === IDS.gm && Object.values(g5.held).every(Boolean) && g5.p1 && g5.told === 1, JSON.stringify(g5));

    /* E16 fix r1b-G2, 19.10.2026 (finding OWNER-DEFAULT-a). A world setting written with `noHook` reaches no client's
       `updateSetting` listener (the harness models it from this fix on, as a document's; v14: LIVE-E16-04), so G5's
       put-back never heard the Assistant's console switch `forceDiceLook` off that way. G6: the Assistant's console does,
       then p1's console writes its own look with `noHook`, then p1 posts a message as its character. Read: the switch on
       every client after the write and after the message, p1's look against the GM's, and the GM's notices of a
       put-back (none more: G5's came less than a minute before, and the GM reads one a minute).
       At 857a51a: the switch stays off on every client and p1 keeps its own look. */
    const gmToldG6 = await gm.eval(`return globalThis.__notifications.length;`);
    await ag.eval(`await game.settings.set("${MOD}", "forceDiceLook", false, { noHook: true }); return true;`);
    await settle(600);
    const g6 = { landed: await gm.eval(`return game.settings.get("${MOD}", "forceDiceLook");`), held: {} };
    await p1.eval(`await game.user.update({ "flags.${DSN}.appearance": { global: { colorset: "black" } } }, { noHook: true }); return true;`);
    await settle(600);
    await p1.eval(`await ChatMessage.create({ content: "E16 throw after a switch no hook heard", speaker: { actor: "${IDS.aiko}" } }); return true;`);
    await settle(1500);
    for (const c of [gm, ag, p1]) g6.held[c.who] = await switchesOn(c) === switches;
    Object.assign(g6, { p1: await lookOn(gm, IDS.p1) === canon,
        told: await gm.eval(`const said = [game.i18n.localize("DRPG.DiceLook.settingBackUnheard"), game.i18n.format("DRPG.DiceLook.settingBack", { name: game.users.get("${IDS.ag}").name })];
            return globalThis.__notifications.slice(${gmToldG6}).filter(n => said.includes(n.msg)).length;`) });
    check("G6: an Assistant's switch of the table's dice look written with no hook is put back on every client at the next message, and the player throws in the GM's look",
        g6.landed === false && Object.values(g6.held).every(Boolean) && g6.p1 && g6.told === 0, JSON.stringify(g6));

    /* E16 fix early-C4-G1, 19.10.2026 (finding E16-C4-F1). gm2, a second full Gamemaster on a browser of its own, joins
       while the GM and the Assistant are here, takes the GMs' stores from them, and leaves with what they held - Botan's
       overlay the GM's, from G2 - before D, so that the Assistant is the primary there. H brings it back. */
    const storesJs = `(await import("${repoUrl}/scripts/gm-store.mjs"))`;
    await connect("gm2");
    await gm2.eval(`const E = ${storesJs}; await E.whenGmStoresHydrated(); await E.gmStoresIdle(); return true;`);
    await disconnect("gm2");
    await settle(600);
    /* E16 fix r1c-G1 (fd-2): with gm2 gone the GM gives Botan another look, which gm2's browser never hears. H5 brings
       gm2 back to it with only the Assistant at the table. */
    const frost = JSON.stringify({ global: { colorset: "frost" } });
    await gm.eval(`await game.actors.get("${IDS.botan}").update({ "flags.${DSN}.appearance": ${frost} }); return true;`);
    await settle(1500);

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

    /* E16 p1 C3 (LIVE-E16-04 asks it of v14): with the full GM gone the Assistant is the primary and puts a player's
       look back to the full GM's, which stays the source while that GM is offline. */
    mark = opLog.length;
    await p2.eval(`await game.user.setFlag("${DSN}", "appearance", { global: { colorset: "black" } }); return true;`);
    await settle(1500);
    const d5 = { writes: userWrites(mark, IDS.p2), held: await lookOn(ag, IDS.p2) === canon, canon: await canonOn(ag) === canon };
    check("D5: with the GM gone a player's own dice look goes back to the GM's, written by the Assistant",
        JSON.stringify(d5.writes) === JSON.stringify(["p2 update", "ag update"]) && d5.held && d5.canon, JSON.stringify(d5));

    const errors = {};
    for (const c of [ag, p1, p2, p3]) errors[c.who] = await c.eval(`return (globalThis.__errors ?? []).map(e => e.where + ": " + e.message);`);
    check("E: no exception escaped into Foundry on any client still at the table",
        Object.values(errors).every(list => list.length === 0), JSON.stringify(errors));

    /* ------------------- H. a character's dice look with no GM watching ------------------- */
    /* E16 fix early-C4-G1, 19.10.2026 (finding E16-C4-F1, a blocker of the review's). The GMs' copy of each character's
       overlay lived in each GM browser's memory, taken from the world as Dice So Nice got ready (dice-sync.mjs
       `takeActorLooks` at f26c3d7), so the next GM's load took whatever a player had left there for the GMs'. H1: the
       Assistant leaves too, p2 writes Botan's overlay with no GM at the table, and gm2 comes back on the browser it left
       with. H2: p2 writes it six times about a second apart - five put-backs are the fuse's, the sixth write stands -
       and gm2 reloads. Read: Botan's overlay on every client, who wrote Botan from p2's first write on (opLog), and
       gm2's warning. At f26c3d7 p2's overlay stood after both loads, and nothing wrote Botan. */
    const back = async () => {
        await connect("gm2", { storage: await storageOf("gm2") });
        await gm2.eval(`const E = ${storesJs}; await E.whenGmStoresHydrated(); return true;`);
        await settle(1500);
    };
    const colourOn = async (c, id) => JSON.parse(await overlayOn(c, id))?.global?.colorset ?? null;
    const worldCopyOn = c => c.eval(`try { return JSON.stringify(game.settings.get("${MOD}", "diceLookWorld")?.e?.["${IDS.botan}"]?.look ?? null); }
        catch { return null; }`);

    /* E16 fix r1c-G1, 19.10.2026 (findings OWNER-DEFAULT-Q6b and the fix-diff review's fd-2; the owner's Q6 runs on its
       default (b)). gm2 left before the GM gave Botan frost (above D), so its browser's copy of the GMs' store holds
       Botan in ice; the Assistant's browser sends none of that store (`fullGmOnly`). H5: gm2 comes back on the browser
       it left with while only the Assistant is here. Read: Botan's overlay on every client and who wrote Botan from
       gm2's connect on (opLog). At 442f563: gm2 puts the full GM's frost back to its own ice. Then gm2 gives Botan
       ice again and leaves, and the Assistant's console writes the world's copy of the store with Botan in emerald,
       stamped a minute ahead (H1 reads it). */
    mark = opLog.length;
    await back();
    const h5 = { writes: actorWrites(mark, IDS.botan), held: {} };
    for (const c of [gm2, ag, p2]) h5.held[c.who] = await colourOn(c, IDS.botan);
    check("H5: a full Gamemaster's newer dice look on a character stands when another full Gamemaster's browser with an older copy loads while only an Assistant is at the table",
        Object.values(h5.held).every(colour => colour === "frost") && h5.writes.length === 0, JSON.stringify(h5));
    await gm2.eval(`await game.actors.get("${IDS.botan}").update({ "flags.${DSN}.appearance": ${gmOverlay} }); return true;`);
    await settle(1500);
    await gm2.eval(`const E = ${storesJs}; await E.gmStoresIdle(); return true;`);
    await disconnect("gm2");
    await settle(600);
    const forged = await ag.eval(`try {
            const value = foundry.utils.deepClone(game.settings.get("${MOD}", "diceLookWorld") ?? {});
            value.e ??= {}; value.t ??= {};
            value.e["${IDS.botan}"] = { look: ${emerald} };
            value.t["${IDS.botan}"] = Math.floor(game.time.serverTime) + 60000;
            await game.settings.set("${MOD}", "diceLookWorld", value);
            return true;
        } catch (err) { return String(err?.message ?? err); }`);
    await settle(600);
    await disconnect("ag");
    await settle(600);
    mark = opLog.length;
    await p2.eval(`await game.actors.get("${IDS.botan}").setFlag("${DSN}", "appearance", { global: { colorset: "black" }, d4: { colorset: "bloodmoon" } }); return true;`);
    await settle(1200);
    const h1 = { stood: await colourOn(p2, IDS.botan) };
    await back();
    Object.assign(h1, { writes: actorWrites(mark, IDS.botan), held: {} });
    for (const c of [gm2, p1, p2]) h1.held[c.who] = await overlayOn(c, IDS.botan) === gmOverlay;
    // E16 fix r1c-G1 (OWNER-DEFAULT-Q6b): the world's copy the Assistant wrote above is not taken, and gm2 writes its own.
    Object.assign(h1, { forged, world: await worldCopyOn(gm2) });
    check("H1: a character's dice look its player wrote while no GM was connected goes back to the GMs' when a full Gamemaster's browser that holds their copy loads, and a world copy an Assistant wrote is not taken",
        h1.stood === "black" && Object.values(h1.held).every(Boolean) && h1.forged === true && h1.world === gmOverlay
        && JSON.stringify(h1.writes) === JSON.stringify(["p2 update", "gm2 update"]), JSON.stringify(h1));

    mark = opLog.length;
    const gm2Told = await gm2.eval(`return globalThis.__notifications.length;`);
    for (let i = 0; i < 6; i++) {
        await p2.eval(`await game.actors.get("${IDS.botan}").setFlag("${DSN}", "appearance", { global: { colorset: "black-${i}" } }); return true;`);
        await settle(1000);
    }
    const h2 = { stood: await colourOn(gm2, IDS.botan),
        told: await gm2.eval(`const said = game.i18n.format("DRPG.DiceLook.stopped", { name: game.actors.get("${IDS.botan}").name });
            return globalThis.__notifications.slice(${gm2Told}).filter(n => n.msg === said).length;`) };
    await gm2.eval(`const E = ${storesJs}; await E.gmStoresIdle(); return true;`);
    await disconnect("gm2");
    await settle(600);
    await back();
    Object.assign(h2, { writes: actorWrites(mark, IDS.botan), held: {} });
    for (const c of [gm2, p1, p2]) h2.held[c.who] = await overlayOn(c, IDS.botan) === gmOverlay;
    const answered = ["p2 update", "gm2 update"];
    check("H2: past the fuse a character's dice look stands, the GM is told once, and it goes back to the GMs' when the primary GM reloads",
        h2.stood === "black-5" && h2.told === 1 && Object.values(h2.held).every(Boolean)
        && JSON.stringify(h2.writes) === JSON.stringify([...answered, ...answered, ...answered, ...answered, ...answered, ...answered]), JSON.stringify(h2));

    /* E16 fix r1b-G1, 19.10.2026 (findings sec-5 and E16-COR-3). H1 holds only because gm2 comes back with the storage
       it left with: the GMs' copy is each GM browser's store, and a GM alone on a browser that never held it took
       every overlay as found. H4: gm2 leaves, p2 writes Botan's overlay with no GM at the table, and gm2 comes back on
       an empty browser. Read: Botan's overlay on every client, Daichi's (no player owns it: the GM's from G2 stands)
       and who wrote Botan from p2's write on. At d0c7e6e: p2's black on Botan, written by p2 only. Until E16 fix
       r1c-G1 Botan went back to none (p2 owns it, and the empty browser had no row); the world's copy a full
       Gamemaster's browser writes (OWNER-DEFAULT-Q6b) gives the empty browser the GMs' ice. */
    await gm2.eval(`const E = ${storesJs}; await E.gmStoresIdle(); return true;`);
    await disconnect("gm2");
    await settle(600);
    mark = opLog.length;
    await p2.eval(`await game.actors.get("${IDS.botan}").setFlag("${DSN}", "appearance", { global: { colorset: "black" } }); return true;`);
    await settle(1200);
    const h4 = { stood: await colourOn(p2, IDS.botan) };
    await connect("gm2");
    await gm2.eval(`const E = ${storesJs}; await E.whenGmStoresHydrated(); return true;`);
    await settle(1500);
    Object.assign(h4, { writes: actorWrites(mark, IDS.botan), held: {} });
    for (const c of [gm2, p1, p2]) h4.held[c.who] = [await overlayOn(c, IDS.botan), await colourOn(c, IDS.daichi)];
    check("H4: on a GM browser that never held the GMs' copy, a character's dice look its player wrote with no GM connected goes back to the GMs' from the world's copy, and a GM's look on a student no player owns stands",
        h4.stood === "black" && Object.values(h4.held).every(([botan, daichi]) => botan === gmOverlay && daichi === "fire")
        && JSON.stringify(h4.writes) === JSON.stringify(["p2 update", "gm2 update"]), JSON.stringify(h4));

    const late = {};
    for (const c of [gm2, p1, p2, p3]) late[c.who] = await c.eval(`return (globalThis.__errors ?? []).map(e => e.where + ": " + e.message);`);
    check("H3: no exception escaped into Foundry on gm2's client or a player's after the GMs came back",
        Object.values(late).every(list => list.length === 0), JSON.stringify(late));
}
