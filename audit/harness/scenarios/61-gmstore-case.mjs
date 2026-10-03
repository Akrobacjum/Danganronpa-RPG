/**
 * The GM store with a second GM (E04, 1.2.63; audit S05-01, S05-09, S05-10).
 *
 * The seed's GM and three players, and GMs who join late: `gm2`, a second
 * Gamemaster whose id sorts after the seed GM's, so the seed GM stays the
 * primary while both are connected. A late account is seeded inactive and has no
 * client until `connect` (cluster.mjs) starts one, with the localStorage and the
 * world id it is given - an empty browser, the same browser coming back, or the
 * same browser in another world on one server.
 *
 * Phases, in the order they run (the design's section 12; the phases after the seed
 * GM closes run last, because only a late account can connect again):
 *   A  the harness's own preconditions: a late GM boots with the storage it was
 *      given, the others see it connect, its storage is read back after it left,
 *      and its clock can be off while the server's is not.
 *   C  the chat cards 1.2.64 left (E06 C12): the primary's clause rewrites a roll naming its
 *      character, a private card's facts and a report's words, and a GM that joins after with
 *      an empty browser holds them rewritten, as a player does.
 *   C2 the cards 1.2.64 posted about an incident's people (E06 fix r2-G1): a trap's receipt,
 *      Confusion's card and a fight's roll name nobody on a bystander after the rewrite, and the
 *      receipt keeps its thread on its player's browser and the primary's.
 *   B  the Truth Bullet answer key survives a second GM joining with an empty
 *      browser (S05-01, the brief's verify, headless): on 1.2.62 the joining GM
 *      rebuilt a row for every bullet from its item's Faint flag and the newer,
 *      partial rows replaced the full ones on the first GM; a gms.delta forged by
 *      a player changes nothing.
 *   D  the traces (S05-10): they survive a second GM's empty join; a token a GM
 *      deletes takes its row off both GMs; and the seed GM's browser, copied, opens
 *      a second world on the same server - its hello is refused there as another
 *      world's, it claims the same old rows (a duplicated world), its clear drops
 *      world B's rows only, and back in world A the same browser reads its traces
 *      intact without a GM having to send them.
 *   E  the Mastermind's door (S06-19): the pick reaches its player's copy with the
 *      record's stamps, and what each player is sent is read off the packets; a
 *      second GM whose browser holds no pick is asked and does not answer (the
 *      primary alone does); a GM that lost the pick and picks somebody else still
 *      takes the part away from the first player (Q3); a GM that has not merged a
 *      newer pick moves the lair and the former Mastermind learns nothing (B1); and
 *      the upgrade day's clear is put to the primary whichever browser held it and
 *      whenever the pick arrives, with no player told the part meanwhile (M1).
 *   L  a running incident's fight at the update (E32 C3): the primary's clause lifts it out of the
 *      world half into its record and the killer's player's copy, and a GM that joins after with an
 *      empty browser holds it; the clause run on that GM, not the primary, lifts and stamps nothing.
 *   F  the incident's cast (S04-24, the cast half of S06-19): a participant's copy
 *      is stamped part by part, and what the primary answers is read off the
 *      packets; a second GM with an empty browser does not answer for it; the fight
 *      (E32 C2) syncs with it, and a bystander holds the stage alone; a GM that
 *      has not merged a newer write lets a third in, and the primary tells the
 *      participants what the GMs agree on (B1); and the second GM closes the
 *      incident: both GMs' records and the copy are cleared by one stamp.
 *   F9 the opening's statistic (E32+E07 C11c): the primary picks it as the roll goes out,
 *      and a second GM's re-ask reads the pick from the cast and sends it, asking nobody.
 *   G  a trap's planted object (S08-19): a second GM plants it, the primary - who
 *      hands a player's Search its find - finds it and gives it to the searcher,
 *      and its use sets the trap off on the primary's chat.
 *   P  the same trap's killer, condition and trigger (E05, S09-05): the second GM,
 *      which joined G with an empty browser, holds them by the store's exchange,
 *      and projectMeta none of them; its Rearm reaches the primary's armed map. And
 *      a Direct Murder parked through the primary in an Eclipse (S10-01) is held by
 *      the second GM, whose lights judge it. And the Key Remnant plan (S01-01): each
 *      GM writes one slot from a plan read before either wrote, and both keep both.
 *   I  the fog ledger (S07-01): rooms found and one unticked while the second GM
 *      is away reach it when it comes back, the untick with them.
 *   H1 a Level Up offered on the primary (S03-11): its owner's copy is lit at the
 *      offer's stamp, and the second GM holds the offer.
 *   K  the upgrade day's claim of the old cast (the round-2 review's R2-B1): two GM
 *      browsers claim theirs while an incident runs, one of them the previous
 *      incident's; the running one's "no third" stands on every GM, and the third
 *      of the previous one is sent nothing.
 *   J1 the season reset is the primary's (S06-20, D12): a Mastermind is picked while
 *      the second GM is here, and its reset is refused, names the primary GM and
 *      opens no window; it leaves with its browser.
 *   J2 the primary resets twice through the window, the answers queued: the traces
 *      and the Mastermind, then the traces alone - the window names the GMs who are
 *      away, each reset writes its cut in the clock before its steps, and the Level
 *      Up is kept both times.
 *   J3 the seed GM leaves for good; the second GM comes back alone, so the primary:
 *      its traces from before the second reset and its pick from before the first
 *      are gone by the clock's cuts alone, group by group, and its offer is kept.
 *   H2 the primary alone answers the owner with the offer and spends it; it offers
 *      again and, its store emptied, answers stamp 0 - the owner's button stays lit,
 *      and the spend is refused as not offered, with the GM told.
 *   H3 an owner whose character went to another player still takes the next offer
 *      (the round-2 review's M2).
 *   J4 a reset with "advancement" ticked takes a standing offer off its owner's copy
 *      and sheet (the owner's Q4, measured on a real client).
 *   Z  the browser is lost (the brief's live verify, headless): the GM left from
 *      H2 picks the Mastermind and places two traces (J's resets took the others),
 *      backs up the case and leaves, a third GM comes with an empty browser and is
 *      alone, so the primary; its health check opens and names what is missing, and
 *      Continue is taken. Another GM with an empty browser restores the file: the
 *      primary's answer keys read back by merge, its check - and the panel's line -
 *      clear without a reload, and the GM who restored sends every player their
 *      copies again (E04's fix round).
 *   M  the answer keys held past the bound (E04's fix round 10): with the primary's
 *      bullets store held unhydrated, p1's Analyze and handover are refused within
 *      TIMING.gmStoreOpenMs with keysNotOpen, the Analyze's price comes back, nothing
 *      is scored or copied, and the GM is told once; a hydration three seconds late
 *      is waited for and the throw scored and paid for; and the missing key's refusal
 *      hands the price back too.
 *   N  an owner's ask for their Eclipse crossings (E05 fix r1-G3): with the primary's
 *      crossings store held unhydrated nothing is sent; the row another GM counted
 *      arrives, the hold ends, and the owner's copy reads it.
 *   O  the pre-session note (E05 fix r1-G4): a player's ask is answered only once the
 *      primary's notes store holds the other GMs' rows; then every GM leaves, p1 keeps
 *      a note, and a GM that p1 hears connect before its world has loaded gets it.
 *   Q  the owed Despair (E05 fix r2-G2): two GMs convert from one pool, neither having heard
 *      the other, and both hold both debts; the time of day pays the pool once, and a GM that
 *      comes back alone with the rows its browser held does not pay them again.
 *   R  a death taken back while its owner's browser was closed (E05 fix r2-G3): p4 holds a
 *      kept death, leaves, the GM revives it, and p4 back reads its character alive.
 *   S  two GMs' loots of one body nobody has found (E05 fix r2-G3): each serves one without
 *      having heard of the other, both are owed, and the publication gives both takers theirs.
 *   T  the Cleaning Tools a clean-up used (E32+E07 C12): a row the primary writes reaches the
 *      second GM, whose discovery breaks the gloves and takes the row off both.
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true },
    { who: "gm3", id: "USERGM3000000000", name: "Third GM", role: 4, character: null, color: "#66ffaa", late: true },
    // The seed GM's browser, copied: in world B (gmb), then back in world A (gma).
    { who: "gma", id: "USERGMA000000000", name: "GM A", role: 4, character: null, color: "#aa66ff", late: true },
    { who: "gmb", id: "USERGMB000000000", name: "GM B", role: 4, character: null, color: "#ffaa66", late: true },
    // A browser that ran 1.2.62 and holds nothing but its old store's clear of the Mastermind (E7).
    { who: "gmc", id: "USERGMC000000000", name: "GM C", role: 4, character: null, color: "#aaff66", late: true },
    // A player whose browser closes and comes back (R, E05 fix r2-G3): the seeded three cannot.
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true }
];

const PROBE_KEY = "drpg-harness.probe";
const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, gm2, gm3, gma, gmb, gmc, p1, p2, p3, p4, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS, repoUrl }) {
    const GM2 = "USERGM2000000000", GMA = "USERGMA000000000";

    /* ------------------------------ A. the harness ------------------------------ */

    phase("A: a GM that joins late", { flow: "gm-store" });
    await gm.eval(`globalThis.__e04Connected = [];
        Hooks.on("userConnected", (user, connected) => globalThis.__e04Connected.push([user.id, connected]));
        return true;`);
    const before = await gm.eval(`const u = game.users.get("${GM2}"); return { known: Boolean(u), active: u?.active ?? null, isGM: u?.isGM ?? null };`);
    let unreachable = null;
    try { await gm2.eval("return 1;"); } catch (err) { unreachable = err.message; }
    check("A1: a late account is a GM the world knows, inactive, with no client until it connects",
        before.known && before.active === false && before.isGM === true && /not connected/.test(unreachable ?? ""),
        JSON.stringify({ before, unreachable }));

    const probe = JSON.stringify({ visit: 1 });
    // A copy of the seed GM's browser, so that the two GMs' stores are equal (A5).
    await connect("gm2", { storage: { ...(await storageOf("gm")), [PROBE_KEY]: probe } });
    await settle(400);
    const onGm2 = await gm2.eval(`return { held: localStorage.getItem("${PROBE_KEY}"), me: game.user.id, isGM: game.user.isGM,
        world: game.world.id, drpg: Boolean(game.drpg) };`);
    check("A2: it boots as itself, with the localStorage it was given, before the module read a setting",
        onGm2.held === probe && onGm2.me === GM2 && onGm2.isGM && onGm2.drpg && onGm2.world === "drpg-audit-world", JSON.stringify(onGm2));

    const seen = await gm.eval(`return { connected: globalThis.__e04Connected, active: game.users.get("${GM2}")?.active ?? null };`);
    check("A3: the GM already at the table sees it connect (userConnected, true) and active",
        seen.active === true && seen.connected.some(([id, on]) => id === GM2 && on === true), JSON.stringify(seen));

    const clocks = await gm2.eval(`return { server: game.time.serverTime, local: Date.now() };`);
    const here = Date.now();
    check("A4: its game.time.serverTime is the server's clock, and a finite number",
        Number.isFinite(clocks.server) && Math.abs(clocks.server - here) < 5000 && Math.abs(clocks.local - clocks.server) < 5000,
        JSON.stringify({ ...clocks, cluster: here }));

    const traffic = socketTraffic.filter(t => String(t.action ?? "").startsWith("gms."));
    check("A5: two GMs whose stores are equal (the second browser a copy of the first) exchange digests and nothing more: hellos and dones, no state, no delta",
        traffic.some(t => t.action === "gms.hello") && traffic.every(t => t.action === "gms.hello" || t.action === "gms.done"),
        JSON.stringify(traffic.slice(0, 8)));

    await gm2.eval(`localStorage.setItem("${PROBE_KEY}", JSON.stringify({ visit: 2 })); return true;`);
    await disconnect("gm2");
    await settle(300);
    const kept = await storageOf("gm2");
    const gone = await gm.eval(`return { connected: globalThis.__e04Connected, active: game.users.get("${GM2}")?.active ?? null };`);
    check("A6: after it leaves, the others see it go, and its localStorage is read back as it closed",
        kept?.[PROBE_KEY] === JSON.stringify({ visit: 2 }) && gone.active === false
        && gone.connected.some(([id, on]) => id === GM2 && on === false), JSON.stringify({ kept: kept?.[PROBE_KEY] ?? null, gone }));

    await connect("gm2", { storage: kept, world: "drpg-world-b", clockSkewMs: 5 * 60 * 1000 });
    const again = await gm2.eval(`return { held: localStorage.getItem("${PROBE_KEY}"), world: game.world.id,
        skew: Date.now() - game.time.serverTime };`);
    check("A7: it comes back with the browser it left, in another world if told, and a clock off by five minutes moves Date.now alone",
        again.held === JSON.stringify({ visit: 2 }) && again.world === "drpg-world-b" && Math.abs(again.skew - 300000) < 2000,
        JSON.stringify(again));
    await disconnect("gm2");
    await settle(300);

    /* ------------- C. the chat log 1.2.64 left, and a GM that joins after its rewrite ------------- */

    /* E06 C12 (28.09.2026; the owner's Q1 (a)): three cards as 1.2.64 left them - a roll the module
       threw naming Aiko, a private card whose flags say its action and tone beside its thread, a
       music report with its words as the content - rewritten by the clause on the primary (the
       runner, `only` the clause and forced, as this world is stamped already); then gm2 joins with
       an empty browser and holds the three as the primary does, and so does p1. The pass reads
       the whole log, which here holds no other card of the three kinds. The cards are deleted. */
    phase("C: the chat cards 1.2.64 left are rewritten on the primary, and a GM that joins after holds them rewritten", { flow: "gm-store" });
    const DIGEST_C = ids => `const ids = ${J(ids)};
        return ids.map(id => game.messages.get(id)).map(m => m ? { alias: m.speaker?.alias ?? null, actor: m.speaker?.actor ?? null,
            flavor: m.flavor ?? "", rolls: (m.rolls ?? []).map(r => { const o = r.options ?? {}; return [o.title ?? "", "id" in (o.data ?? {}), "name" in (o.data ?? {})]; }),
            gmsOnly: m.whisper.length > 0 && m.whisper.every(u => game.users.get(u)?.isGM), flags: Object.keys(m.flags?.["${MOD}"] ?? {}).sort(),
            words: String(m.content ?? "").includes("E06 C12"), stub: String(m.content ?? "").includes("data-drpg-secret") } : null);`;
    const c1 = await gm.eval(`const G = await import("${repoUrl}/scripts/migrate.mjs"); const U = await import("${repoUrl}/scripts/utils.mjs");
        const aiko = game.actors.get("${IDS.aiko}");
        const roll = await ChatMessage.create({ content: "7", speaker: { alias: aiko.name, actor: aiko.id }, flavor: "E06 C12 Strike",
            whisper: [...U.gmIds(), "${IDS.p1}"], flags: { "${MOD}": { supersededRoll: true } },
            rolls: [JSON.stringify({ formula: "1d12", total: 7, options: { title: "E06 C12 Strike", data: { id: aiko.id, name: aiko.name } } })] });
        const card = await ChatMessage.create({ content: '<p class="notes" data-drpg-secret>-</p>', whisper: [game.user.id],
            flags: { "${MOD}": { secret: true, drpgMessage: true, thread: "E06-C12", kind: "call", gmAsk: true, settled: true,
                popupTitle: "E06 C12 Search", popupTone: "hope" } } });
        const report = await ChatMessage.create({ whisper: [game.user.id],
            content: '<h3>Music diagnostics</h3><pre style="white-space:pre-wrap;font-size:0.85em">E06 C12 the music report</pre>' });
        const planted = [roll.speaker?.actor === aiko.id, Boolean(card.flags?.["${MOD}"]?.popupTitle), String(report.content).includes("E06 C12")];
        const pass = await G.migrate1_2_0({ force: true, quiet: true, only: ["neutraliseOldCards"] });
        return { ids: [roll.id, card.id, report.id], name: aiko.name, planted, primary: U.isPrimaryGm(), failed: pass?.failed ?? null,
            done: pass?.clauses?.neutraliseOldCards ?? null };`);
    const onGmC = await gm.eval(DIGEST_C(c1.ids));
    await connect("gm2");
    await settle(1500);
    const onGm2C = await gm2.eval(DIGEST_C(c1.ids)), onP1C = await p1.eval(DIGEST_C(c1.ids));
    const wantC = [
        { alias: onGmC[0]?.alias, actor: null, flavor: "", rolls: [["", false, false]], gmsOnly: true, flags: ["supersededRoll"], words: false, stub: false },
        { alias: onGmC[1]?.alias, actor: null, flavor: "", rolls: [], gmsOnly: true,
            flags: ["drpgMessage", "gmAsk", "kind", "secret", "settled", "thread"], words: false, stub: true },
        { alias: onGmC[2]?.alias, actor: null, flavor: "", rolls: [], gmsOnly: true, flags: ["drpgMessage", "secret"], words: false, stub: true }];
    check("C1: the primary rewrites a roll naming its character, a private card's facts and a report's words, and a GM that joins after with an empty browser holds them rewritten, as p1 does",
        c1.primary && c1.planted.every(Boolean) && J(c1.failed) === "[]" && c1.done?.rolls >= 1 && c1.done?.cards >= 1 && c1.done?.reports >= 1
        && onGmC[0]?.alias !== c1.name && J(onGmC) === J(wantC) && J(onGm2C) === J(onGmC) && J(onP1C) === J(onGmC),
        J({ c1, onGmC, onGm2C, onP1C }), { flow: "gm-store" });
    await gm.eval(`for (const id of ${J(c1.ids)}) await game.messages.get(id)?.delete(); return true;`);
    await disconnect("gm2");
    await settle(300);

    /* E06 fix r2-G1 (28.09.2026; review round 2's MJ1, whose D1 measured the receipt): three cards
       1.2.64 posted about an incident's people - a trap's receipt in p3's thread as `callGm` posted
       it then, its Plant button in the words the primary holds; Confusion's card to p2, known by its
       sound; a statistic Chie threw at the GM's request in a fight, its list naming Botan's player as
       well - rewritten by the clause on the primary. On p1, a bystander, the receipt and the card
       name nobody and the roll's list no longer names p2; on p3 the receipt keeps its place in the
       thread, from the meta its words were sent with, as on the primary; gm2, joining after with an
       empty browser, holds the receipt veiled and places it nowhere - the cost the clause states. */
    phase("C2: the cards 1.2.64 posted about an incident's people name nobody after the rewrite, and a receipt keeps its thread on its player's browser", { flow: "gm-store" });
    const c2 = await gm.eval(`const G = await import("${repoUrl}/scripts/migrate.mjs"); const U = await import("${repoUrl}/scripts/utils.mjs");
        const S = await import("${repoUrl}/scripts/secret.mjs");
        const gms = U.gmIds(), chie = game.actors.get("${IDS.chie}"), botan = game.actors.get("${IDS.botan}");
        const receipt = await S.postSecret({ whisper: ["${IDS.p3}", ...gms], flags: { "${MOD}": { thread: "${IDS.p3}", kind: "action", gmAsk: true } },
            content: "<h3>" + game.i18n.localize("DRPG.Trap.armedTitle") + "</h3><p>E06 r2-G1 receipt</p>"
                + '<div class="drpg-call-actions"><button type="button" class="drpg-call-action" data-drpg-call="plantTrapItem" data-project="E06R2G1PROJECT01">Plant</button></div>' });
        const meddle = await ChatMessage.create({ content: S.STUB, speaker: ChatMessage.getSpeaker({ actor: botan }), whisper: ["${IDS.p2}", ...gms],
            flags: { "${MOD}": { secret: true, drpgMessage: true, sfx: "meddle" } } });
        const asked = await ChatMessage.create({ content: "7", speaker: ChatMessage.getSpeaker({ actor: chie }), whisper: [...gms, "${IDS.p3}", "${IDS.p2}"],
            rolls: [JSON.stringify({ formula: "1d12", total: 7, options: {} })] });
        const planted = [receipt?.flags?.["${MOD}"]?.thread === "${IDS.p3}", Boolean(S.secretHtml(receipt)), Boolean(asked?.whisper?.includes("${IDS.p2}"))];
        const pass = await G.migrate1_2_0({ force: true, quiet: true, only: ["neutraliseOldCards"] });
        return { ids: [receipt.id, meddle.id, asked.id], gms, planted, failed: pass?.failed ?? null, done: pass?.clauses?.neutraliseOldCards ?? null };`);
    await settle(800);
    const DIGEST_C2 = `const S = await import("${repoUrl}/scripts/secret.mjs"); const M = await import("${repoUrl}/scripts/messenger.mjs");
        const [receipt, meddle, asked] = ${J(c2.ids)}.map(id => game.messages.get(id));
        const everybody = JSON.stringify(game.users.map(u => u.id).sort());
        const named = m => ({ veiled: m?.flags?.["${MOD}"]?.veiled === true, all: JSON.stringify([...(m?.whisper ?? [])].sort()) === everybody,
            actor: m?.speaker?.actor ?? null, thread: m?.flags?.["${MOD}"]?.thread ?? null });
        return { receipt: named(receipt), meddle: named(meddle), asked: [...(asked?.whisper ?? [])].sort(),
            placed: S.cardFlag(receipt, "thread") ?? null, inThread: M.threadMessages("${IDS.p3}").some(m => m.id === receipt?.id),
            words: Boolean(S.secretHtml(receipt)) };`;
    const onGmC2 = await gm.eval(DIGEST_C2), onP1C2 = await p1.eval(DIGEST_C2), onP3C2 = await p3.eval(DIGEST_C2);
    await connect("gm2");
    await settle(1500);
    const onGm2C2 = await gm2.eval(DIGEST_C2);
    const veilC2 = { veiled: true, all: true, actor: null, thread: null };
    const askedC2 = [...c2.gms, IDS.p3].sort();
    check("C2: after the rewrite a bystander's copy of a 1.2.64 receipt, Confusion's card and a fight's roll names nobody of the incident, and the receipt keeps its thread on p3 and the primary",
        c2.planted.every(Boolean) && J(c2.failed) === "[]" && c2.done?.cards >= 2 && c2.done?.rolls >= 1
        && [onGmC2, onP1C2, onP3C2, onGm2C2].every(d => J(d.receipt) === J(veilC2) && J(d.meddle) === J(veilC2) && J(d.asked) === J(askedC2))
        && !onP1C2.placed && !onP1C2.inThread && !onP1C2.words && onP3C2.placed === IDS.p3 && onP3C2.inThread && onP3C2.words
        && onGmC2.placed === IDS.p3 && onGmC2.inThread && !onGm2C2.placed && !onGm2C2.inThread,
        J({ c2, onGmC2, onP1C2, onP3C2, onGm2C2 }), { flow: "gm-store" });
    await gm.eval(`for (const id of ${J(c2.ids)}) await game.messages.get(id)?.delete(); return true;`);
    await disconnect("gm2");
    await settle(300);

    /* ------------------- B. the answer key when a GM joins empty ------------------- */

    phase("B: a second GM joins with an empty browser, and the answer key survives", { flow: "truth-bullets" });
    const made = await gm.eval(`
        const actor = game.actors.get("${IDS.aiko}");
        const out = [];
        for (const [n, realType] of [[1, "key"], [2, "incident"]]) {
            const item = await game.drpg.createTruthBullet(actor, { name: "E04 bullet " + n, realType, visibility: "evident",
                playerText: "Seen.", analyzedText: "Read " + n, remnantId: "E04TRACE" + n, sceneId: "${IDS.scene}",
                sourceAction: "prep", tiedToCrime: true });
            out.push(item.uuid);
        }
        // A bullet as a world made before 1.2.47 left it: Faint on the item, none in its row.
        const [old] = await actor.createEmbeddedDocuments("Item", [{ name: "E04 bullet 3", type: "loot",
            flags: { "${MOD}": { category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "evident", faint: true } } }]);
        await game.drpg.setSecret(old.uuid, { realType: "final", remnantId: "E04TRACE3", analyzedText: "Read 3", sourceAction: "clean", tiedToCrime: false });
        out.push(old.uuid);
        return out;`);
    const keyOf = uuids => `const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        return ${J(uuids)}.map(u => { const s = B.secretOf(u); return [s.realType, s.remnantId, s.analyzedText, s.sourceAction, s.tiedToCrime, "faint" in s]; });`;
    const expected = [["key", "E04TRACE1", "Read 1", "prep", true, true], ["incident", "E04TRACE2", "Read 2", "prep", true, true],
        ["final", "E04TRACE3", "Read 3", "clean", false, false]];
    const onGmBefore = await gm.eval(keyOf(made));
    check("B1: the GM holds three bullets' answer keys, the third with no Faint in its row", J(onGmBefore) === J(expected),
        J({ made, onGmBefore }));

    await connect("gm2");
    await settle(1500);
    const keysOnGm = await gm.eval(keyOf(made)), keysOnGm2 = await gm2.eval(keyOf(made));
    check("B2: after an empty browser joined, both GMs hold every field of every answer key (S05-01)",
        J(keysOnGm) === J(expected) && J(keysOnGm2) === J(expected), J({ keysOnGm, keysOnGm2 }));
    const faintFlag = await gm.eval(`return fromUuidSync("${made[2]}")?.getFlag("${MOD}", "faint") ?? null;`);
    check("B3: the old Faint flag on the third bullet's item was left where it was", faintFlag === true, J(faintFlag));
    const held = await gm2.eval(`const { bulletStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");
        return { live: Object.keys(bulletStore.entries()).length, hydration: E.gmStoreHydration().state };`);
    check("B4: the joining GM's store holds the three rows, and it was answered by the GM already there",
        held.live === 3 && held.hydration === "answered", J(held));

    await p1.eval(`game.socket.emit("module.${MOD}", { action: "gms.delta", world: game.world.id, store: "bullets",
        delta: { e: { "${made[0]}": { realType: "neutral" } }, t: { "${made[0]}": ${Number.MAX_SAFE_INTEGER} }, d: {}, cleared: 0 } },
        { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(500);
    const afterForged = await gm.eval(keyOf([made[0]]));
    const warned = await gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return U.sessionFailures().filter(e => /refused gms\.delta/.test(e.message)).map(e => e.message);`);
    check("B5: a gms.delta forged by a player changes nothing on the GM, and the GM's log names the refusal",
        J(afterForged) === J([expected[0]]) && warned.length >= 1, J({ afterForged, warned }), { flow: "gm-store" });
    await disconnect("gm2");
    await settle(300);

    /* ------- D. the traces: a join, a deletion, and one browser in two worlds ------- */

    phase("D: the traces through a second GM, a deletion, and one browser in two worlds", { flow: "trace-remnant" });
    const REM = `const R = await import("${repoUrl}/scripts/remnants.mjs");
        const { remnantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");`;
    const placedD = await gm.eval(`${REM}
        const scene = game.scenes.get("${IDS.scene}");
        const out = [];
        for (const [n, type] of [[1, "incident"], [2, "prep"]]) {
            const token = await R.placeRemnant({ type, visibility: "subtle", x: 100 * n, y: 100, scene, tiedToCrime: n === 1,
                note: "E04 trace " + n, sourceName: "E04" });
            out.push(token.id);
        }
        return out;`);
    // Each trace by its ledger key, `sceneId.tokenId`: the seed's stands in the annex.
    const traceRows = keys => `${REM}
        return ${J(keys)}.map(key => { const [sceneId, tokenId] = key.split(".");
            const t = game.scenes.get(sceneId)?.tokens?.get(tokenId); const d = t ? R.remnantData(t) : null;
            return d ? [d.type, d.note ?? "", d.tiedToCrime] : null; });`;
    const seedKey = `${IDS.annex}.${IDS.trace}`;
    const seedRow = ["prep", "", false];
    const expectD = [seedRow, ["incident", "E04 trace 1", true], ["prep", "E04 trace 2", false]];
    const idsD = [seedKey, ...placedD.map(id => `${IDS.scene}.${id}`)];
    await connect("gm2");
    await settle(1500);
    const tracesOnGm = await gm.eval(traceRows(idsD)), tracesOnGm2 = await gm2.eval(traceRows(idsD));
    check("D1: the seed's trace and two placed on the GM survive a second GM joining with an empty browser, on both GMs",
        J(tracesOnGm) === J(expectD) && J(tracesOnGm2) === J(expectD), J({ tracesOnGm, tracesOnGm2 }));

    await gm2.eval(`await game.scenes.get("${IDS.scene}").tokens.get("${placedD[1]}").delete(); return true;`);
    await settle(800);
    const goneKey = `${IDS.scene}.${placedD[1]}`;
    const dropped = client => client.eval(`${REM} return { has: remnantStore.has("${goneKey}"), tombstone: remnantStore.tombstone("${goneKey}") > 0 };`);
    const dropGm = await dropped(gm), dropGm2 = await dropped(gm2);
    check("D2: the second GM deletes a trace's token, and the primary's tombstone takes its row off both GMs",
        !dropGm.has && dropGm.tombstone && !dropGm2.has && dropGm2.tombstone, J({ dropGm, dropGm2 }));

    const KEY = `${MOD}.gmRemnants`;
    const worldA = "drpg-audit-world", worldB = "drpg-world-b";
    const sectionIn = (storage, wid) => {
        try { return J(JSON.parse(storage?.[KEY] ?? "null")?.worlds?.[wid] ?? null); } catch { return "unreadable"; }
    };
    const copied = await storageOf("gm");
    const aBefore = sectionIn(copied, worldA);
    await connect("gmb", { storage: copied, world: worldB });
    await settle(9500);
    const inB = await gmb.eval(`${REM}
        const live = Object.keys(remnantStore.entries());
        const census = remnantStore.census();
        const hydration = E.gmStoreHydration().state;
        const cleared = await R.clearRemnantLedger();
        await E.gmStoresIdle();
        return { world: game.world.id, hydration, census, live, cleared, after: Object.keys(remnantStore.entries()).length,
            tombstone: remnantStore.tombstone("${seedKey}") > 0 };`);
    const refusedAs = client => client.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return U.sessionFailures().filter(e => /refused gms\.hello from GM B: the packet is another world's/.test(e.message)).length;`);
    const saidGm = await refusedAs(gm), saidGm2 = await refusedAs(gm2);
    check("D3: the same browser in world B: the GMs of world A refuse its hello as another world's and say so, it times out, claims the same old rows (a duplicated world), and its clear drops world B's rows",
        inB.world === worldB && inB.hydration === "timedOut" && inB.census?.claimed === 1 && J(inB.live) === J([seedKey])
        && inB.cleared === 1 && inB.after === 0 && inB.tombstone && saidGm >= 1 && saidGm2 >= 1, J({ inB, saidGm, saidGm2 }));

    await disconnect("gmb");
    await settle(300);
    const leftB = await storageOf("gmb");
    const bSection = JSON.parse(sectionIn(leftB, worldB));
    check("D4: in that browser's storage world A's section is byte for byte what it was, and world B's holds its tombstone and no row",
        aBefore !== "null" && sectionIn(leftB, worldA) === aBefore && Object.keys(bSection?.e ?? { x: 1 }).length === 0 && bSection?.d?.[seedKey] > 0,
        J({ aBefore: aBefore.length, aAfter: sectionIn(leftB, worldA).length, bSection }));

    const trafficFrom = socketTraffic.length;
    await connect("gma", { storage: leftB });
    await settle(1500);
    const tracesOnA = await gma.eval(traceRows(idsD.slice(0, 2)));
    const statesForA = socketTraffic.slice(trafficFrom).filter(t => t.action === "gms.state"
        && (t.from === "gma" || (Array.isArray(t.to) && t.to.includes(GMA))));
    check("D5: the same browser back in world A reads its traces intact, and no GM had to send it a section",
        J(tracesOnA) === J(expectD.slice(0, 2)) && !statesForA.length, J({ tracesOnA, statesForA: statesForA.slice(0, 4) }));
    await disconnect("gma");
    await disconnect("gm2");
    await settle(300);

    /* ------------------- E. the Mastermind's door, stamped ------------------- */

    phase("E: the Mastermind's door through the primary GM, stamped", { flow: "mastermind" });
    const MM = `const M = await import("${repoUrl}/scripts/mastermind.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");`;
    const doorOf = client => client.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const { iAmTheMastermind } = await import("${repoUrl}/scripts/settings.mjs");
        return { mine: iAmTheMastermind(), stamp: E.mineStamp("door"), copy: E.readMine("door") };`);
    /* What each door packet says, as p1 and p2 receive it (the review's M2, 26.09): a copy
       refuses an answer at a stamp it already holds, so the copy alone cannot show what the
       primary answered - on the C5 tree a primary that told every asker "yes" passed E3. */
    const RECORD_DOORS = `globalThis.__doors = [];
        game.socket.on("module.${MOD}", (payload, senderId) => {
            if (payload?.action === "mastermind.door") globalThis.__doors.push({ from: senderId, value: payload.value, room: payload.room ?? null, stamps: payload.stamps ?? null });
        });
        return true;`;
    await p1.eval(RECORD_DOORS);
    await p2.eval(RECORD_DOORS);
    const doorsNow = client => client.eval(`return globalThis.__doors.length;`);
    const doorsSince = (client, n) => client.eval(`return globalThis.__doors.slice(${n});`);
    const yesAt = (at, room) => ({ from: IDS.gm, value: true, room, stamps: { actorId: at, room: at } });
    const noAt = at => ({ from: IDS.gm, value: false, room: null, stamps: { actorId: at } });
    const pickedAt = await gm.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Main Hall" });
        return S.mastermindStore.stampOf("record");`);
    await settle(600);
    const p1First = await doorOf(p1);
    const sentFirst = { p1: await doorsSince(p1, 0), p2: await doorsSince(p2, 0) };
    check("E1: the Mastermind picked on the GM reaches its player's copy, the lair with it, at the record's stamps; the other player is sent no, with the pick's stamp alone",
        p1First.mine === true && p1First.copy?.room === "Main Hall" && p1First.stamp === pickedAt && pickedAt > 0
        && J(sentFirst.p1) === J([yesAt(pickedAt, "Main Hall")]) && J(sentFirst.p2) === J([noAt(pickedAt)]), J({ pickedAt, p1First, sentFirst }));

    await connect("gm2");
    await settle(1500);
    const doorsFrom = from => socketTraffic.filter(t => t.from === from && t.action === "mastermind.door").length;
    const beforeAsk = { gm: doorsFrom("gm"), gm2: doorsFrom("gm2") };
    await p1.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${GM2}"] }); return true;`);
    await settle(500);
    const afterGm2 = await doorOf(p1);
    check("E2: a second GM with an empty browser, asked for the door, does not answer (the primary alone does), and the player keeps the part",
        doorsFrom("gm2") === beforeAsk.gm2 && afterGm2.mine === true && afterGm2.stamp === pickedAt, J({ beforeAsk, gm2Sent: doorsFrom("gm2"), afterGm2 }));

    const askGm = client => client.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    const asked3 = { p1: await doorsNow(p1), p2: await doorsNow(p2) };
    await askGm(p1);
    await askGm(p2);
    await settle(500);
    const afterGm = await doorOf(p1);
    const answered3 = { p1: await doorsSince(p1, asked3.p1), p2: await doorsSince(p2, asked3.p2) };
    check("E3: the primary answers each player about themselves: the Mastermind's yes with the lair and both parts' stamps, the other's no with the pick's stamp alone",
        doorsFrom("gm") > beforeAsk.gm && afterGm.mine === true && afterGm.stamp === pickedAt
        && J(answered3.p1) === J([yesAt(pickedAt, "Main Hall")]) && J(answered3.p2) === J([noAt(pickedAt)]), J({ answered3, afterGm }));

    const botanAt = await gm.eval(`${MM} await S.mastermindStore.forget();
        const lost = M.mastermindActor();
        await M.setMastermind(game.actors.get("${IDS.botan}"));
        return { lost: lost?.id ?? null, stamp: S.mastermindStore.stampOf("record") };`);
    await settle(600);
    const p1After = await doorOf(p1), p2After = await doorOf(p2);
    const pickOnGm2 = await gm2.eval(`${MM} return M.mastermindActor()?.id ?? null;`);
    check("E4: a GM whose browser lost the pick picks another: the first player's copy says no at the new stamp, the new one's yes, and the other GM holds the new pick (Q3)",
        botanAt.lost === null && p1After.mine === false && p1After.copy?.room === null && p1After.stamp === botanAt.stamp
        && p2After.mine === true && pickOnGm2 === IDS.botan, J({ botanAt, p1After, p2After, pickOnGm2 }));

    /* E5-E6, the review's B1 (26.09): a GM that has not merged a newer pick moves the
       lair. gm2 leaves holding Botan; gm picks Aiko again; gm's store is held - it
       answers nobody, as a primary busy with tier 2 does - so gm2 comes back, times out
       and still holds Botan; gm2 moves the lair to the Kitchen. Let go, gm holds the
       record against what it last told the players and tells Aiko's player the lair
       (`tellDoorChange`). */
    await disconnect("gm2");
    await settle(300);
    await gm.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}")); return true;`);
    await settle(600);
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(true); return true;`);
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(9500);
    const stale = await gm2.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const held = M.mastermindActor()?.id ?? null;
        await M.setMastermindLair("Kitchen");
        return { held, hydration: E.gmStoreHydration().state };`);
    await settle(800);
    const formerAfterStale = await doorOf(p2);
    check("E5: a GM that has not merged a newer pick moves the lair: the former Mastermind's player stays not the Mastermind, and learns no lair",
        stale.held === IDS.botan && stale.hydration === "timedOut" && formerAfterStale.mine === false && formerAfterStale.copy?.room === null,
        J({ stale, formerAfterStale }));

    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(false); return true;`);
    await settle(1500);
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(600);
    const realAfter = await doorOf(p1), formerAfter = await doorOf(p2);
    const converged = await gm2.eval(`${MM} return { pick: M.mastermindActor()?.id ?? null, lair: M.mastermindLair() };`);
    check("E6: once the GMs converge, the Mastermind's player holds the new lair, and the former's answer from the primary is still no",
        converged.pick === IDS.aiko && converged.lair === "Kitchen" && realAfter.mine === true && realAfter.copy?.room === "Kitchen"
        && formerAfter.mine === false && formerAfter.copy?.room === null, J({ converged, realAfter, formerAfter }));
    await gm.eval(`${MM} await M.clearMastermind(); return true;`);
    await disconnect("gm2");
    await settle(300);

    /* E7-E8, the review's M1 (26.09): the upgrade day's clear (the design's H4) is put to
       the primary whichever GM's browser held it, and whenever a pick older than it
       arrives; until a GM decides, no player is told the part. The primary's window is
       answered by a queued answer that waits, so what happens while it is open can be
       read, and then pressed. */
    const WAIT_FOR_WINDOW = `globalThis.__h4 = globalThis.__h4 ?? [];
        globalThis.__dialogAnswers.push(config => new Promise(resolve => globalThis.__h4.push({
            health: config.window?.title === game.i18n.localize("DRPG.Case.healthTitle"),
            buttons: (config.buttons ?? []).map(b => b.action), answer: resolve })));
        return true;`;
    const windowsOnGm = () => gm.eval(`return (globalThis.__h4 ?? []).map(w => ({ health: w.health, buttons: w.buttons }));`);
    const press = choice => gm.eval(`const open = globalThis.__h4?.at(-1); open?.answer?.(${J(choice)}); return Boolean(open);`);
    const decides = w => Boolean(w?.health && w.buttons.includes("keepMastermind") && w.buttons.includes("clearMastermind"));
    const pickStampOn = client => client.eval(`${MM} return { pick: M.mastermindActor()?.id ?? null, at: S.mastermindStore.stampOf("record", "actorId"),
        note: S.mastermindStore.record().legacyClearedAt ?? null };`);

    // E7: the pick on the primary, as its own old store's claim brought it (at an old stamp, through the store,
    // as the claim writes); the clear in the old store of a GM who joins later - a browser that ran 1.2.62.
    const clearedAt = (await pickStampOn(gm)).at;
    await gm.eval(`${MM} await S.mastermindStore.patch("record", { actorId: "${IDS.aiko}", room: "Library" }, { stamp: ${clearedAt + 10} }); return true;`);
    await settle(600);
    await gm.eval(WAIT_FOR_WINDOW);
    // The old store's key, as that browser holds it: the fixture this check is about.
    await connect("gmc", { storage: { [`${MOD}.mastermind`]: J({ actorId: null, room: null, updated: clearedAt + 20 }) } });
    await settle(1500);
    const asked7 = await doorsNow(p1);
    await askGm(p1);
    await settle(500);
    const held7 = await doorsSince(p1, asked7), windows7 = await windowsOnGm(), onGm7 = await pickStampOn(gm);
    check("E7: a clear in a later GM's old store reaches the primary, which asks Keep or Clear, and meanwhile answers the pick's player no",
        onGm7.note === clearedAt + 20 && onGm7.pick === IDS.aiko && windows7.length === 1 && decides(windows7[0])
        && held7.length >= 1 && held7.every(d => J(d) === J(noAt(clearedAt + 10))), J({ onGm7, windows7, held7 }));

    const beforeKeep = await doorsNow(p1);
    await press("keepMastermind");
    await settle(800);
    const keptOnGm = await pickStampOn(gm), keptOnGmc = await pickStampOn(gmc), toldKept = await doorsSince(p1, beforeKeep), p1Kept = await doorOf(p1);
    check("E7b: Keep stamps the pick again: its player is told yes at the new stamp, and the later GM holds the same pick",
        keptOnGm.pick === IDS.aiko && keptOnGm.at > clearedAt + 20 && keptOnGmc.pick === IDS.aiko && keptOnGmc.at === keptOnGm.at
        && toldKept.at(-1)?.value === true && toldKept.at(-1)?.stamps?.actorId === keptOnGm.at && p1Kept.mine === true,
        J({ keptOnGm, keptOnGmc, toldKept, p1Kept }));

    // E8: the clear already held by the primary, and a pick older than it arriving by merge after the check ran.
    await gm.eval(`${MM} await M.clearMastermind(); return true;`);
    await settle(600);
    const clearedAgain = (await pickStampOn(gm)).at;
    const mergeOnGm = (fields, at) => gm.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const theirs = E.emptySection();
        E.writeFields(theirs, "record", ${J(fields)}, ${at}, S.mastermindStore.spec);
        await S.mastermindStore.mergeIn(theirs, { source: "sync" });
        return true;`);
    await gm.eval(WAIT_FOR_WINDOW);
    await mergeOnGm({ legacyClearedAt: clearedAgain + 20 }, clearedAgain + 20);
    await settle(600);
    const windowsNoPick = (await windowsOnGm()).length;
    const asked8 = await doorsNow(p1);
    await mergeOnGm({ actorId: IDS.aiko, room: "Library" }, clearedAgain + 10);
    await settle(800);
    const windows8 = await windowsOnGm(), told8 = await doorsSince(p1, asked8), p1Held = await doorOf(p1);
    check("E8: a pick older than a clear the primary holds, arriving by merge after its check ran, is put to it too, and its player is told no",
        windowsNoPick === 1 && windows8.length === 2 && decides(windows8[1]) && p1Held.mine === false
        && told8.length >= 1 && told8.every(d => J(d) === J(noAt(clearedAgain + 10))), J({ windowsNoPick, windows8, told8, p1Held }));

    await press("clearMastermind");
    await settle(800);
    const clearedE8 = { gm: await pickStampOn(gm), gmc: await pickStampOn(gmc), p1: await doorOf(p1) };
    check("E8b: Clear takes the pick away on every GM, and its player stays not the Mastermind",
        clearedE8.gm.pick === null && clearedE8.gmc.pick === null && clearedE8.gm.at > clearedAgain + 20 && clearedE8.p1.mine === false, J(clearedE8));

    /* E9, the fix list's 14 (DS-m7, 26.09): the window's Keep and Clear act on the record it
       showed. It opens for Aiko's pick under a newer clear; while it is open a newer pick,
       Botan's, arrives by merge - no longer a decision at all. Read at the click, Keep stamped
       Botan's pick afresh, a pick no GM had seen in the window. */
    const shownAt = clearedE8.gm.at;
    await gm.eval(WAIT_FOR_WINDOW);
    await mergeOnGm({ legacyClearedAt: shownAt + 20 }, shownAt + 20);
    await mergeOnGm({ actorId: IDS.aiko, room: "Library" }, shownAt + 10);
    await settle(800);
    const windows9 = await windowsOnGm();
    await mergeOnGm({ actorId: IDS.botan, room: "Kitchen" }, shownAt + 30);
    await settle(600);
    await press("keepMastermind");
    await settle(800);
    const after9 = await pickStampOn(gm), windowsAfter9 = await windowsOnGm();
    check("E9: a pick that arrived while the window was open is not what Keep stamps - the window acts on the record it showed",
        decides(windows9.at(-1)) && after9.pick === IDS.botan && after9.at === shownAt + 30 && windowsAfter9.length === windows9.length,
        J({ windows9: windows9.length, after9, windowsAfter9: windowsAfter9.length }));
    await gm.eval(`${MM} await M.clearMastermind(); return true;`);
    await settle(600);
    await gm.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
    await disconnect("gmc");
    await settle(300);

    /* ------------- L. a running incident's fight, lifted at the update ------------- */

    /* E32 C3 (28.09.2026; the owner's Q1 (a)): an incident a 1.2.65 table left running - its names
       and method in the cast as 1.2.65 wrote them, its fight in the world half - is lifted by the
       clause on the primary (the runner, `only` the clause and forced, as this world is stamped
       already). No incident has run in this scenario before, so no GM's record and no copy holds a
       stamp for the fight, as none did at 1.2.65 (read first, L1). Then every browser's world half
       holds the stage alone, the killer's player's copy holds the fight, and gm2, which joins after
       the clause with an empty browser, holds it in its record by the stores' exchange. The
       incident is closed on the primary before F opens its own. */
    phase("L: a running incident's fight is lifted out of the world half at the update, and a GM that joins after holds it", { flow: "murder-incident" });
    const FIGHT_L = { turn: 2, turnSide: "killer", keyRemnants: 3, deniedToVictim: ["survive"], hindered: { victim: {}, killer: {} },
        blocked: { victim: {}, killer: {} }, unlocked: [], drainStopped: false, advantageNext: { victim: false, killer: false },
        spent: [], freeResolution: null, thirdActed: null };
    const LIFT_L = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const M = await import("${repoUrl}/scripts/murder.mjs");`;
    const fightL = client => client.eval(`${LIFT_L} const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const held = r => S.INCIDENT_FIGHT.map(f => [f, r[f] ?? null]);
        return { record: game.user.isGM ? held(S.castStore.record()) : null, copy: game.user.isGM ? null : held(incidentCast()),
            turn: M.murderState()?.turn ?? null, world: Object.keys(game.settings.get("${MOD}", "murderState") ?? {}).sort() };`);
    const l1 = await gm.eval(`${LIFT_L} const G = await import("${repoUrl}/scripts/migrate.mjs");
        const stamped = S.INCIDENT_FIGHT.filter(f => S.castStore.stampOf("record", f) > 0);
        await S.castStore.patch("record", { killerId: "${IDS.chie}", victimId: "${IDS.daichi}", killerTurnId: "${IDS.chie}", thirdId: null,
            thirdSide: null, indirect: false, selfInflicted: false, openedAt: Date.now() });
        await game.settings.set("${MOD}", "murderState", { active: true, stage: "incident", ...${J(FIGHT_L)} });
        const before = Object.keys(game.settings.get("${MOD}", "murderState") ?? {}).length;
        const pass = await G.migrate1_2_0({ force: true, quiet: true, only: ["liftIncidentFight"] });
        return { stamped, before, failed: pass?.failed ?? null, done: pass?.clauses?.liftIncidentFight ?? null };`);
    await settle(800);
    // Field by field, in one order on both sides: the record answers in INCIDENT_FIGHT's.
    const sortL = pairs => J([...(pairs ?? [])].sort(([a], [b]) => a.localeCompare(b)));
    const heldL = sortL(Object.entries(FIGHT_L));
    // The Key Remnants' count stays the GMs': no player's copy holds it (murder.mjs `castFor`, E32+E07 fix r1-G1).
    const copyL = sortL(Object.entries({ ...FIGHT_L, keyRemnants: null }));
    const liftedL = { gm: await fightL(gm), p3: await fightL(p3), p1: await fightL(p1) };
    check("L1: the clause lifts a running incident's fight out of the world half on the primary: its record and the killer's player's copy hold it, and every browser's world half holds the stage alone",
        J(l1.stamped) === "[]" && l1.before === 14 && J(l1.failed) === "[]" && J(l1.done) === J({ lifted: 10, dropped: 2, kept: 0 })
        && sortL(liftedL.gm.record) === heldL && sortL(liftedL.p3.copy) === copyL && liftedL.p3.turn === 2 && liftedL.p1.turn === null
        && Object.values(liftedL).every(r => J(r.world) === J(["active", "stage"])), J({ l1, liftedL }));

    await connect("gm2");
    await settle(1500);
    const joinedL = await fightL(gm2);
    check("L2: a GM that joins after the clause with an empty browser holds the lifted fight in its record, and its world half the stage alone",
        sortL(joinedL.record) === heldL && joinedL.turn === 2 && J(joinedL.world) === J(["active", "stage"]), J(joinedL));
    /* E32+E07 fix r1-G4 (02.10.2026; the security review's m2): the clause run by hand on gm2, which
       is not the primary, lifts nothing and writes no stamp, and the GM is told. Until then its lift
       answered the null "nothing to do", the runner stamped the world over it, and no later load
       lifted what a 1.2.65 table left. A fight field goes back into the world half and the stamp back
       to an older version first; the primary's pass after gm2's lifts the field and stamps. E04's lift of
       the names, which still answers a plain null on gm2, is held to no stamp by the runner's own question. */
    const stampL = await gm.eval(`const was = game.settings.get("${MOD}", "migratedVersion");
        await game.settings.set("${MOD}", "murderState", { ...game.settings.get("${MOD}", "murderState"), turn: 9 });
        await game.settings.set("${MOD}", "migratedVersion", "1.2.64");
        return was;`);
    await settle(600);
    const passL = (client, quiet, key = "liftIncidentFight") => client.eval(`${LIFT_L} const G = await import("${repoUrl}/scripts/migrate.mjs");
        const told = [], warn = ui.notifications.warn;
        ui.notifications.warn = text => { told.push(String(text)); return null; };
        try {
            const pass = await G.migrate1_2_0({ force: true, quiet: ${quiet}, only: ["${key}"] });
            return { failed: pass?.failed ?? null, notPrimary: pass?.notPrimary ?? null, done: pass?.clauses?.["${key}"] ?? null, told,
                stamp: game.settings.get("${MOD}", "migratedVersion"), turn: M.murderState()?.turn ?? null,
                world: Object.keys(game.settings.get("${MOD}", "murderState") ?? {}).sort() };
        } finally {
            ui.notifications.warn = warn;
        }`);
    const l3 = await passL(gm2, false);
    await settle(400);
    const l3s = await passL(gm2, true, "liftIncidentSecrets");
    await settle(400);
    const l3p = await passL(gm, true);
    await settle(400);
    check("L3: the clause on a GM that is not the primary lifts nothing, writes no stamp and tells the GM, nor does E04's lift there, which answers a plain null; the primary's pass after them lifts the field and stamps",
        l3.stamp === "1.2.64" && J(l3.failed) === "[]" && J(l3.notPrimary) === J(["liftIncidentFight"]) && l3.done === null
        && l3.told.length === 1 && !l3.told[0].startsWith("DRPG.") && J(l3.world) === J(["active", "stage", "turn"])
        && l3s.stamp === "1.2.64" && J(l3s.failed) === "[]" && J(l3s.notPrimary) === "[]" && l3s.done === null && l3s.told.length === 0
        && l3p.stamp === stampL && J(l3p.failed) === "[]" && J(l3p.notPrimary) === "[]" && J(l3p.done) === J({ lifted: 1, dropped: 0, kept: 0 })
        && l3p.turn === 2 && J(l3p.world) === J(["active", "stage"]), J({ stampL, l3, l3s, l3p }));
    await gm.eval(`${LIFT_L} await M.endMurder({ reason: "E32 61L", followUp: false }); return true;`);
    await settle(800);
    await disconnect("gm2");
    await settle(300);

    /* ------------------- F. the incident's cast, stamped ------------------- */

    phase("F: the incident's cast through the primary GM, and closed by another", { flow: "murder-incident" });
    const CAST = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const M = await import("${repoUrl}/scripts/murder.mjs");`;
    const castOn = client => client.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const cast = incidentCast();
        return { killer: cast.killerId ?? null, victim: cast.victimId ?? null, third: cast.thirdId ?? null, stamp: E.mineStamp("cast"),
            stamps: E.mineStamps("cast") };`);
    const recordOn = client => client.eval(`${CAST} const r = S.castStore.record();
        return { killer: r.killerId ?? null, state: M.murderState()?.killerId ?? null, stamp: S.castStore.stampOf("record", "killerId") };`);
    // What each cast packet says, as p3 (the killer's player) and p1 (a bystander) receive it - as for the door (M2).
    const RECORD_CASTS = `globalThis.__casts = [];
        game.socket.on("module.${MOD}", (payload, senderId) => {
            if (payload?.action === "incident.myCast") globalThis.__casts.push({ from: senderId, cast: payload.cast ?? null, stamps: payload.stamps ?? null });
        });
        return true;`;
    await p3.eval(RECORD_CASTS);
    await p1.eval(RECORD_CASTS);
    const castsNow = client => client.eval(`return globalThis.__casts.length;`);
    const castsSince = (client, n) => client.eval(`return globalThis.__casts.slice(${n});`);
    // Every field but the swing memo, as a copy is sent them - the method among them since E05 C8.
    const castStampsOn = client => client.eval(`${CAST} return Object.fromEntries(S.CAST_FIELDS.filter(f => f !== "swung")
        .map(f => [f, S.castStore.stampOf("record", f)]));`);
    /* The killer's opening roll is thrown on p3's client with the harness's dice: forced to a
       critical, which always opens the incident. Left random, it failed once in six runs
       ("Murder closed (openingFailed)", the C7 run, 26.09) and F read a closed incident. */
    await p3.eval(`globalThis.__forceRoll = { hope: 10, fear: 10 }; return true;`);
    const openedAt = await gm.eval(`${CAST} await M.openMurder({ killerId: "${IDS.chie}", victimId: "${IDS.daichi}", openingTrait: "body" });
        return S.castStore.stampOf("record");`);
    /* The opening resolves on p3's roll, and since E32 C2 (28.09.2026) what it writes - the round, the
       side to act, the Key Remnants' count - is the cast's, so the record's stamp moves with it: until
       then the copy was read at the open's stamp (red on the C2 tree, 28.09: the copy stood 313 ms
       later). The copy is read against the record as it stands once the incident runs. */
    const castAt = await gm.eval(`${CAST} const end = Date.now() + 6000;
        while (M.murderState()?.stage !== "incident" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return S.castStore.stampOf("record");`);
    await settle(800);
    const p3First = await castOn(p3);
    check("F1: the incident opened on the GM reaches the killer's player's copy, at the record's stamp",
        p3First.killer === IDS.chie && p3First.victim === IDS.daichi && p3First.stamp === castAt && castAt >= openedAt && openedAt > 0,
        J({ openedAt, castAt, p3First }));

    await connect("gm2");
    await settle(1500);
    const castsFrom = from => socketTraffic.filter(t => t.from === from && t.action === "incident.myCast").length;
    const castBefore = { gm: castsFrom("gm"), gm2: castsFrom("gm2") };
    await p3.eval(`game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${GM2}"] }); return true;`);
    await settle(500);
    const p3AfterGm2 = await castOn(p3);
    check("F2: a second GM with an empty browser, asked for the cast, does not answer, and the participant keeps it",
        castsFrom("gm2") === castBefore.gm2 && p3AfterGm2.killer === IDS.chie && p3AfterGm2.stamp === castAt, J({ castBefore, gm2Sent: castsFrom("gm2"), p3AfterGm2 }));

    const askedF = { p3: await castsNow(p3), p1: await castsNow(p1) };
    await p3.eval(`game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await p1.eval(`game.socket.emit("module.${MOD}", { action: "incident.myCastRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(500);
    const p3AfterGm = await castOn(p3), onGmF = await recordOn(gm), onGm2F = await recordOn(gm2);
    const answeredF = { p3: await castsSince(p3, askedF.p3), p1: await castsSince(p1, askedF.p1) }, stampsF = await castStampsOn(gm);
    const seatsF = { killerId: stampsF.killerId, victimId: stampsF.victimId, thirdId: stampsF.thirdId, betrayal: stampsF.betrayal };
    /* The opening's statistic is the GMs' (E32+E07 C11c): the killer's copy holds it null, and its stamp reads as the
       newest of the parts the copy shows (murder.mjs `castPacket`), as the Key Remnants' count's does - which the
       opening's result wrote last, so its stamp is that newest already. Who struck a critical Finishing blow
       (`freeCleanup`, E32+E07 C13) was withheld the same way until fix r2-G3 (03.10.2026; the round-2 review's
       C2-m1), and is the killers' to read now - p3's copy holds it with the record's stamp. The fight's last turns (`recent`, E32+E07 C17) are the
       GMs' as well, and withheld the same way; so, since fix r2-G2 (03.10.2026), are the Reroll receipt and who
       walked into the fight and out of it (`lastCrisis`, `departed`). */
    const withheldF = ["keyRemnants", "openingTrait", "recent", "lastCrisis", "departed"];
    const shownF = Math.max(0, ...Object.entries(stampsF).filter(([f]) => !withheldF.includes(f)).map(([, t]) => t ?? 0));
    const heldStampsF = { ...stampsF, openingTrait: shownF, recent: shownF, lastCrisis: shownF, departed: shownF };
    check("F3: the primary answers the killer's player with the cast and every part's stamp, a bystander with nothing and the seats' stamps alone, and both GMs hold the killer",
        castsFrom("gm") > castBefore.gm && p3AfterGm.stamp === castAt && onGmF.state === IDS.chie && onGm2F.state === IDS.chie
        && answeredF.p3.length === 1 && answeredF.p3[0].cast?.killerId === IDS.chie && answeredF.p3[0].cast?.victimId === IDS.daichi
        && !("swung" in (answeredF.p3[0].cast ?? {})) && J(answeredF.p3[0].stamps) === J(heldStampsF)
        && J(answeredF.p1.map(a => [a.from, a.cast])) === J([[IDS.gm, {}]]) && J(Object.keys(answeredF.p1[0].stamps ?? {}).sort()) === J(Object.keys(seatsF).sort())
        && Object.keys(seatsF).every(k => answeredF.p1[0].stamps[k] <= seatsF[k]), J({ answeredF, stampsF, p3AfterGm, onGmF, onGm2F }));
    /* The bystander's "not in it" is the one they were last sent, repeated (murder.mjs `sendCast`, E32+E07 fix
       r1-G1, 29.09.2026, and r2-G2): the seats' stamps it carries are no newer than the record's and need not be the record's -
       an answer that moved with them timed a Role reversal or a third's arrival for a browser outside the incident. */

    /* F7 (E05 C8; audit S04-08): the incident's method is the cast's now, and syncs with it -
       gm2, which connected after the open, holds what the primary wrote; the killer's player's
       copy holds it; and a bystander's world half holds none of it. */
    const methodOn = client => client.eval(`${CAST} const r = S.castStore.record();
        return { indirect: r.indirect ?? null, selfInflicted: r.selfInflicted ?? null, openedAt: r.openedAt ?? null, endedBy: r.endedBy ?? null };`);
    const methodGm = await methodOn(gm), methodGm2 = await methodOn(gm2);
    const methodP3 = await p3.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { indirect: c.indirect ?? null, openedAt: c.openedAt ?? null };`);
    const worldP1 = await p1.eval(`return Object.keys(game.settings.get("${MOD}", "murderState") ?? {});`);
    check("F7: the incident's method syncs with the cast - both GMs and the killer's player's copy hold it, a bystander's world half none of it",
        Number.isFinite(methodGm.openedAt) && J(methodGm2) === J(methodGm) && methodGm.indirect === false && methodGm.selfInflicted === false
        && methodP3.indirect === false && methodP3.openedAt === methodGm.openedAt
        && !worldP1.some(k => ["indirect", "selfInflicted", "keyRemnantsStale", "openedAt", "endedBy"].includes(k)) && worldP1.includes("active"),
        J({ methodGm, methodGm2, methodP3, worldP1 }));

    /* F5, the review's B1 for the cast (26.09): a GM that has not merged a newer write lets
       a third in. gm's store is held (it sends the other GMs nothing and, since the fix round,
       no player anything; what they send it still merges), gm writes every seat and the turn
       afresh (the health check's "enter the cast by hand"); gm2, which never saw that, lets
       Aiko walk in and tells the participants a copy older in those parts. Let go, gm holds
       the cast against what it last told them and tells the change (`tellCastChange`): on
       the fix round's first draft, which took the cast at the release as told, the killer's
       player and the third kept gm2's older turn (measured 26.09: this check failed on it). */
    await gm.eval(`const w = game.settings.get("${MOD}", "murderState"); await game.settings.set("${MOD}", "murderState", { ...w, stage: "incident" }); return true;`);
    await settle(400);

    /* F8 (E32 C2, 28.09.2026): the fight is the cast's since 1.2.66 and syncs with it - a turn the
       primary passes reaches the second GM's record and the killer's player's copy at its stamp,
       and the bystander's browser holds the stage alone and reads no turn. */
    const passedF8 = await gm.eval(`${CAST} await M.passTurn(); const s = M.murderState();
        return { turn: s?.turn ?? null, side: s?.turnSide ?? null, stamp: S.castStore.stampOf("record", "turnSide") };`, { timeout: 60000 });
    await settle(800);
    const fightOn = client => client.eval(`const M = await import("${repoUrl}/scripts/murder.mjs"); const s = M.murderState();
        return { turn: s?.turn ?? null, side: s?.turnSide ?? null, world: Object.keys(game.settings.get("${MOD}", "murderState") ?? {}).sort() };`);
    const fightF8 = { gm2: await fightOn(gm2), p3: await fightOn(p3), p1: await fightOn(p1) }, p3StampsF8 = (await castOn(p3)).stamps;
    const turnOf = r => J([r.turn, r.side]);
    check("F8: the fight syncs with the cast - a turn the primary passes reaches the second GM and the killer's player's copy at its stamp, and the bystander's browser holds the stage alone",
        typeof passedF8.side === "string" && Number.isFinite(passedF8.turn) && passedF8.stamp > openedAt
        && turnOf(fightF8.gm2) === turnOf(passedF8) && turnOf(fightF8.p3) === turnOf(passedF8) && p3StampsF8?.turnSide === passedF8.stamp
        && fightF8.p1.turn === null && fightF8.p1.side === null && Object.values(fightF8).every(r => J(r.world) === J(["active", "stage"])),
        J({ passedF8, fightF8, p3StampsF8 }));

    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(true); return true;`);
    await gm.eval(`${CAST} await M.enterCast({ killerId: "${IDS.chie}", victimId: "${IDS.daichi}" }); return true;`);
    await settle(400);
    const enteredAt = (await castStampsOn(gm)).killerTurnId;
    const askedF5 = await castsNow(p3);
    await gm2.eval(`${CAST} await M.thirdPartyEnters(game.actors.get("${IDS.aiko}")); return true;`);
    await settle(800);
    const fromGm2 = (await castsSince(p3, askedF5)).filter(d => d.from === GM2);
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(false); return true;`);
    await settle(1500);
    const p3Merged = await castOn(p3), p1Merged = await castOn(p1), onGm2F5 = await castStampsOn(gm2);
    check("F5: a GM that has not merged a newer write lets a third in: its copy is older in the turn, and once the GMs agree the primary tells the killer's player and the third the cast with both",
        enteredAt > openedAt && fromGm2.length === 1 && fromGm2[0].cast?.thirdId === IDS.aiko && fromGm2[0].stamps?.killerTurnId < enteredAt
        && p3Merged.third === IDS.aiko && p3Merged.stamps?.killerTurnId === enteredAt && p1Merged.third === IDS.aiko
        && p1Merged.stamps?.killerTurnId === enteredAt && onGm2F5.killerTurnId === enteredAt, J({ enteredAt, fromGm2, p3Merged, p1Merged, onGm2F5 }));

    /* F10 (E32+E07 C17, 03.10.2026; audit S04-29): the fight's last turns are the cast's and the GMs'. The
       primary scores Aiko's Averted eyes - the third's, which passes no turn and marks nothing - and the
       second GM's record holds the turn, and its tracker lists it. The killer's player holds none of it in
       the packet that carried the write: their copy is read once its receipt's stamp (`lastCrisis`, written
       with the turns and held null in it as well) is the one the primary sends them - since fix r2-G2 the
       newest of what their copy shows, not the record's (murder.mjs `castPacket`). Aiko's player leaves with
       her. Until C17 the tracker kept no history at all. */
    await gm.eval(`${CAST} await M.resolveCrisisAction({ actorId: "${IDS.aiko}", key: "avertedEyes", total: 0, isCritical: false, withHope: true });
        return true;`, { timeout: 60000 });
    const writtenF10 = await gm.eval(`${CAST} return M.castPacket("${IDS.p3}", M.murderState()).stamps.lastCrisis;`);
    const historyF10 = await gm2.eval(`${CAST} const CL = await import("${repoUrl}/scripts/cleanup.mjs");
        const { CRISIS_ACTIONS } = await import("${repoUrl}/scripts/config.mjs");
        const end = Date.now() + 6000;
        while (!(M.murderState()?.recent ?? []).length && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const recent = M.murderState()?.recent ?? [];
        const line = game.i18n.format("DRPG.Murder.trackerTurnLine", { turn: recent[0]?.turn, side: game.i18n.localize("DRPG.Murder.side.third"),
            action: foundry.utils.escapeHTML(CRISIS_ACTIONS.avertedEyes.label), result: game.i18n.localize("DRPG.Murder.trackerResult.free") });
        return { recent: recent.map(e => [e.side, e.key, e.band, e.changes?.length ?? null]), listed: M.incidentTrackerHtml(M.murderState(), CL).includes("<li>" + line + "</li>") };`);
    const copyF10 = await p3.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const end = Date.now() + 6000;
        while ((E.mineStamps("cast")?.lastCrisis ?? 0) < ${writtenF10} && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return { stamp: E.mineStamps("cast")?.lastCrisis ?? null, recent: incidentCast().recent ?? null };`);
    check("F10: the fight's last turns reach the second GM's record and its tracker, and not the killer's player's copy",
        J(historyF10.recent) === J([["third", "avertedEyes", null, 0]]) && historyF10.listed === true
        && copyF10.stamp === writtenF10 && copyF10.recent === null, J({ writtenF10, historyF10, copyF10 }));

    /* F6, the round-2 review's M1 (26.09): a GM whose browser lost the cast - here forgotten, as a
       lost browser has it - presses Pass the turn while the GM that kept it is away. Every field of
       the record was stamped, the absent ones null, so the killer read null on every GM and in the
       killer's player's copy once they met again (their scenario 97, P1). The turn is refused now,
       with the way back named, and the write stamps only what it names. */
    await disconnect("gm2");
    await settle(300);
    const passedF6 = await gm.eval(`${CAST} await S.castStore.forget();
        const n = globalThis.__notifications.length;
        const result = await M.passTurn();
        return { result: result === null ? null : "passed", warned: globalThis.__notifications.slice(n).filter(x => x.level === "warn").map(x => x.msg) };`);
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(1500);
    const afterF6 = { gm: await recordOn(gm), gm2: await recordOn(gm2), p3: await castOn(p3) };
    check("F6: a GM whose browser lost the cast is refused the turn, told the way back, and once the GM that kept it is back every record and the killer's copy still name the killer",
        passedF6.result === null && passedF6.warned.some(m => m.includes("Enter the cast by hand"))
        && afterF6.gm.killer === IDS.chie && afterF6.gm2.killer === IDS.chie && afterF6.p3.killer === IDS.chie, J({ passedF6, afterF6 }));

    await gm2.eval(`${CAST} await M.endMurder({ reason: "E04 61F", followUp: false }); return true;`);
    await settle(800);
    const closedGm = await recordOn(gm), closedGm2 = await recordOn(gm2), closedP3 = await castOn(p3);
    check("F4: the second GM closes the incident: both GMs' records and the participant's copy are cleared, by one stamp",
        closedGm.killer === null && closedGm2.killer === null && closedP3.killer === null && closedGm.stamp > openedAt
        && closedGm.stamp === closedGm2.stamp && closedP3.stamp === closedGm.stamp, J({ closedGm, closedGm2, closedP3 }));
    await p3.eval(`delete globalThis.__forceRoll; return true;`);
    await disconnect("gm2");
    await settle(300);

    /* F9 (E32+E07 C11c, 02.10.2026; audit S04-23, the owner's Q4 as corrected). The murder opens
       with no statistic picked: the primary's window picks it (answered Hand - not the first
       listed) and keeps it in the cast, and the invitation carries it to p3, whose roll is held
       and notes the statistic and whether it is shown as the GM's. gm2, joined with an empty
       browser, re-asks as its tracker does (murder.mjs `rollOpening`, which the tracker's button
       calls behind a cooldown): it reads the pick from its record and opens no window, and p3 is
       sent the same statistic again. */
    phase("F9: the opening's statistic, picked on the primary, is the one a second GM's re-ask sends", { flow: "trait-ruling" });
    await connect("gm2");
    await settle(1500);
    await p3.eval(`globalThis.__heldOpenings = []; globalThis.__heldTraits = []; const a = game.actors.get("${IDS.chie}");
        const { TRAIT_BY_GM } = await import("${repoUrl}/scripts/action-rolls.mjs");
        a.rollTrait = function (dh, config) {
            globalThis.__heldTraits.push([dh, config?.[TRAIT_BY_GM] === true]);
            return new Promise(r => globalThis.__heldOpenings.push(r));
        };
        return true;`);
    const PICKS = `const T = game.i18n.localize("DRPG.TraitRuling.title"); return globalThis.__dialogLog.filter(d => d.title === T).length;`;
    const picksBefore = { gm: await gm.eval(PICKS), gm2: await gm2.eval(PICKS) };
    const f9open = await gm.eval(`${CAST} const T = game.i18n.localize("DRPG.TraitRuling.title");
        globalThis.__dialogAnswers.push(cfg => (cfg?.window?.title === T ? "hand" : ((cfg?.buttons ?? []).find(b => b.default) ?? cfg?.buttons?.[0])?.action ?? null));
        const opened = await M.openMurder({ killerId: "${IDS.chie}", victimId: "${IDS.daichi}" });
        const end = Date.now() + 6000;
        while (!M.murderState()?.openingTrait && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return { stage: opened?.stage ?? null, trait: M.murderState()?.openingTrait ?? null };`, { timeout: 60000 });
    const f9reask = await gm2.eval(`${CAST} const end = Date.now() + 6000;
        while (M.murderState()?.openingTrait !== "hand" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const held = M.murderState()?.openingTrait ?? null;
        const asked = await M.rollOpening("killer", M.murderState());
        return { held, asked: asked?.asked ?? null };`, { timeout: 60000 });
    await settle(800);
    const f9p3 = await p3.eval(`return { held: globalThis.__heldTraits, copy: (await import("${repoUrl}/scripts/settings.mjs")).incidentCast().openingTrait ?? null };`);
    const picksAfter = { gm: await gm.eval(PICKS), gm2: await gm2.eval(PICKS) };
    check("F9: the primary's pick is kept in the cast and a second GM's re-ask sends it without asking again; the killer's player throws Hand both times, as the GM's, and their copy holds no pick",
        f9open.stage === "openingRoll" && f9open.trait === "hand" && f9reask.held === "hand" && f9reask.asked === true
        && picksAfter.gm - picksBefore.gm === 1 && picksAfter.gm2 === picksBefore.gm2
        && J(f9p3.held) === J([["finesse", true], ["finesse", true]]) && f9p3.copy === null,
        J({ f9open, f9reask, f9p3, picksBefore, picksAfter }), { flow: "trait-ruling" });
    await gm.eval(`${CAST} await M.endMurder({ reason: "E32+E07 61F9", followUp: false }); return true;`);
    await settle(800);
    await p3.eval(`const a = game.actors.get("${IDS.chie}"); delete a.rollTrait;
        for (const r of globalThis.__heldOpenings ?? []) r(null); delete globalThis.__heldOpenings; delete globalThis.__heldTraits; return true;`);
    await disconnect("gm2");
    await settle(300);

    /* ------------------- G. a trap planted on another GM ------------------- */

    phase("G: a plant left by a second GM, found through the primary, and its trap", { flow: "trap-fire" });
    const TRAP = `const T = await import("${repoUrl}/scripts/traps.mjs");
        const P = await import("${repoUrl}/scripts/projects.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");`;
    const trap = await gm.eval(`${TRAP}
        const room = M.roomOfActor(game.actors.get("${IDS.aiko}"));
        const made = await P.createProject({ name: "E04 poisoned kit", target: 1, room, indirectMurder: true, killerId: "${IDS.botan}",
            condition: "E04 61G", trigger: { kind: "item", afterDark: false, notBuilder: true } });
        await P.addProgress(made.id, 1, { by: "${IDS.botan}" });
        await new Promise(r => setTimeout(r, 300));
        return { id: made?.id ?? null, room, armed: T.diagnoseTraps().armed, scene: canvas?.scene?.id ?? game.scenes.current?.id ?? null };`);
    await connect("gm2");
    await settle(1500);
    const identity = await gm2.eval(`${TRAP}
        return T.plantItem("${trap.id}", "${trap.room}", { sceneId: "${trap.scene}", name: "E04 planted kit" });`);
    await settle(800);
    const onPrimary = await gm.eval(`${TRAP} const { trapPlantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { trap: T.trapForItemId("${identity}"), planted: Object.values(trapPlantStore?.entries?.() ?? {}).some(p => p?.drpgItemId === "${identity}") };`);
    check("G1: a trap armed on the GM, and an object planted for it by the second GM, reach the primary GM",
        Boolean(trap.id) && trap.armed >= 1 && Boolean(identity) && onPrimary.trap === trap.id && onPrimary.planted, J({ trap, identity, onPrimary }));

    const search = await p1.eval(`const actor = game.actors.get("${IDS.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        let err = null;
        try { await game.drpg.performAction(actor, "search", {}); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        await new Promise(r => setTimeout(r, 800));
        const item = actor.items.find(i => i.getFlag("${MOD}", "drpgItemId") === "${identity}");
        return { err, item: item ? { id: item.id, name: item.name } : null };`, { timeout: 90000 });
    await settle(600);
    const stillPlanted = await gm.eval(`const { trapPlantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return Object.values(trapPlantStore?.entries?.() ?? {}).some(p => p?.drpgItemId === "${identity}");`);
    check("G2: p1's Search in that room is handed the planted object by the primary, and the plant is gone",
        !search.err && search.item?.name === "E04 planted kit" && !stillPlanted, J({ search, stillPlanted }));

    const cardsBefore = await gm.eval(`return game.messages.size;`);
    const used = await p1.eval(`const actor = game.actors.get("${IDS.aiko}");
        const item = actor.items.get("${search.item?.id ?? ""}");
        let r = null, err = null;
        try { r = await game.drpg.useItem(actor, item); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        return { r: r === null ? null : typeof r, err };`, { timeout: 60000 });
    await settle(1200);
    /* The alert is found by its words, which a GM holds (secret.mjs `wordsOf`): the document's
       content is a stub, and since E05's fix round (S1-m2, 27.09.2026) its flags no longer carry
       the trap's name in `popupTitle` - which is where this read found it until then. */
    const alert = await gm.eval(`const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        let n = 0;
        for (const m of game.messages.contents.slice(${cardsBefore})) if (/E04 poisoned kit/.test(await wordsOf(m) ?? "")) n++;
        return n;`);
    check("G3: its use sets the trap off on the primary GM",
        !used.err && alert >= 1, J({ used, alert, cardsBefore }));
    // p1's dice go back to the harness's own (the round-2 review's m2): a later roll must not use G's.
    await p1.eval(`delete globalThis.__forceRoll; return true;`);

    /* ------------------- P. the trap's secrets on a GM who joined empty, and its Rearm ------------------- */

    /* P (E05 C1, 26.09.2026; audit S09-05, D3): gm2 joined G with an empty browser after the trap
       was made, and its killer, condition and trigger are the GM store `projectSecrets` now, not
       projectMeta - so gm2 holds them by the store's exchange alone. The primary's alert in G3
       stamped the trap fired and took it off the armed map, which P1 reads (and so builds) on the
       primary; gm2's Rearm is a write on gm2's browser, and reaches that map only as a merge of the
       store (traps.mjs's clientSettingChanged listener). */
    phase("P: an indirect murder's secrets reach a GM who joined empty, and its Rearm reaches the primary's armed map", { flow: "trap-fire" });
    const secretsOn = client => client.eval(`${TRAP} const s = P.secretsOf("${trap.id}");
        return { killerId: s.killerId ?? null, condition: s.condition ?? null, kind: s.trigger?.kind ?? null, armed: s.trigger?.armed ?? null,
            firedAt: s.trigger?.firedAt ?? null, inMeta: P.PROJECT_SECRET_FIELDS.filter(f => Object.hasOwn(P.metaFor("${trap.id}"), f)),
            mapped: T.armedIn("${trap.room}").some(t => t.id === "${trap.id}") };`);
    const onGm2P = await secretsOn(gm2), onGmP = await secretsOn(gm);
    check("P1: a GM who joined with an empty browser holds the trap's killer, condition and trigger, fired - and projectMeta holds none of the four",
        onGm2P.killerId === IDS.botan && onGm2P.condition === "E04 61G" && onGm2P.kind === "item" && onGm2P.firedAt !== null
        && onGm2P.inMeta.length === 0 && onGmP.firedAt !== null && onGmP.mapped === false, J({ onGm2P, onGmP }));
    await gm2.eval(`${TRAP} await T.rearmTrap("${trap.id}"); return true;`);
    await settle(1200);
    const rearmedP = await secretsOn(gm);
    check("P2: the second GM's Rearm reaches the primary's store and its armed map",
        rearmedP.firedAt === null && rearmedP.armed === true && rearmedP.mapped === true, J({ rearmedP }));
    /* P3 (E05 C3, 26.09.2026; audit S10-01): a Direct Murder declared in the dark is the GM store
       `pendingMurders` now, not a world setting, so a declaration p3 parks through the primary -
       and the primary allows - reaches gm2 by the store's exchange alone, and gm2 ends the Eclipse
       and judges it. Chie is stood in Storage, where nobody is, so the lights cancel it: gm2 tells
       the GMs, and the row is gone on both. Chie goes back where she stood. The Eclipse is the
       clock's flag and its name, written as `startEclipse` writes them and without the rest of
       the opening: its refill rewrites every action budget's maximum, and phase M counts a price
       handed back against that maximum - on the first run of this (26.09) M1 and M5 read 2
       actions where the refund gives 3. */
    const ECL = `const X = await import("${repoUrl}/scripts/eclipse.mjs"); const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const M = await import("${repoUrl}/scripts/movement.mjs");`;
    const chieWas = await gm.eval(`${ECL} const t = canvas.scene.tokens.get("TOKCHIE000000000");
        const was = { x: t.x, y: t.y };
        await t.update(M.positionIn("Storage", t), { teleport: true, movementAction: "displace", animate: false });
        await game.drpg.setClock({ eclipse: true, eclipseStartedAt: Date.now() });
        return { was, alone: M.othersInRoom(game.actors.get("${IDS.chie}")).length === 0 && M.roomOfActor(game.actors.get("${IDS.chie}")) === "Storage" };`, { timeout: 60000 });
    await p3.eval(`const X = await import("${repoUrl}/scripts/eclipse.mjs");
        await X.parkDirectMurder({ killerId: "${IDS.chie}", room: "Storage", note: "E05 61 P3" }); return true;`, { timeout: 60000 });
    await settle(900);
    await gm.eval(`await game.drpg.ruleOnParkedMurder("${IDS.chie}", true); return true;`, { timeout: 30000 });
    await settle(1200);
    const heldP3 = await gm2.eval(`${ECL} const r = S.pendingMurderStore.get("${IDS.chie}");
        return r ? { approved: r.approved, named: r.eclipse === X.eclipseId() && Boolean(r.eclipse) } : null;`);
    const beforeP3 = await gm2.eval(`return game.messages.size;`);
    await gm2.eval(`${ECL} await X.endEclipse({ advance: false }); return true;`, { timeout: 60000 });
    await settle(1200);
    const judgedP3 = {
        onGm2: await gm2.eval(`${ECL} return S.pendingMurderStore.has("${IDS.chie}");`),
        onGm: await gm.eval(`${ECL} return S.pendingMurderStore.has("${IDS.chie}");`),
        told: await gm2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            return game.messages.contents.slice(${beforeP3}).filter(m => m.author?.id === game.user.id && m.whisper.length
                && m.whisper.every(u => game.users.get(u)?.isGM) && contentOf(m).includes("Chie Mori")).length;`),
        eclipse: await gm.eval(`return game.drpg.isEclipse();`), incident: await gm.eval(`return game.drpg.murderState()?.stage ?? null;`)
    };
    check("P3: a declaration parked through the primary and allowed there is held by the second GM, whose lights judge it, and it is gone from both GMs",
        chieWas.alone === true && heldP3?.approved === true && heldP3?.named === true && judgedP3.onGm2 === false && judgedP3.onGm === false
        && judgedP3.told >= 1 && judgedP3.eclipse === false && judgedP3.incident === null, J({ chieWas, heldP3, judgedP3 }));
    await gm.eval(`await canvas.scene.tokens.get("TOKCHIE000000000").update(${J(chieWas.was)}, { teleport: true, movementAction: "displace", animate: false });
        return true;`, { timeout: 30000 });
    /* P4 (E05 C5, 26.09.2026; audit S01-01, S05-02): the Key Remnant plan is the GM store `keyPlan`
       now, a row per chapter and slot, not a world setting. Each GM reads the plan first, as a
       dashboard drawn before either wrote; the primary writes slot 0's name, and once that has
       reached gm2, gm2 writes slot 1's note from the plan it read before - the plan it read as
       its `base`, which is what the dashboard passes. Both GMs then hold both, and p1's plan is
       blank. Written against the store alone, gm2's stale blank name would be a clear, and the
       primary's name would go (setKeyPlan's comment). The two rows are taken away after. */
    const planRead = client => client.eval(`return game.drpg.keyPlan();`);
    const shownGm = await planRead(gm), shownGm2 = await planRead(gm2);
    await gm.eval(`const base = ${J(shownGm)}; const plan = foundry.utils.deepClone(base);
        plan.entries[0].name = "E05 61 P4 by the primary"; await game.drpg.setKeyPlan(plan, { base }); return true;`, { timeout: 30000 });
    await settle(1200);
    const arrived = await gm2.eval(`return game.drpg.keyPlan().entries[0].name;`);
    await gm2.eval(`const base = ${J(shownGm2)}; const plan = foundry.utils.deepClone(base);
        plan.entries[1].note = "E05 61 P4 by the second GM"; await game.drpg.setKeyPlan(plan, { base }); return true;`, { timeout: 30000 });
    await settle(1200);
    const slotsOn = client => client.eval(`const plan = game.drpg.keyPlan(); return [plan.chapter, plan.entries[0].name, plan.entries[1].note];`);
    const planP4 = { arrived, gm: await slotsOn(gm), gm2: await slotsOn(gm2), p1: await slotsOn(p1) };
    check("P4: two GMs each writing one slot of the Key Remnant plan from a plan read before either wrote both keep theirs, on both GMs - and p1's is blank",
        arrived === "E05 61 P4 by the primary" && [planP4.gm, planP4.gm2].every(r => r[1] === "E05 61 P4 by the primary" && r[2] === "E05 61 P4 by the second GM")
        && !planP4.p1[1] && !planP4.p1[2], J(planP4));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        await S.keyPlanStore.dropMany(["${shownGm.chapter}:0", "${shownGm.chapter}:1"]); return true;`);
    /* P5 (E05 C6, 26.09.2026; audit S11-03, S01-08): a player's pre-session note is the GM store
       `notes` now, not a flag on the player's User document, which every browser holds. p1 saves one
       through the primary; gm2, which joined empty, holds it once it has merged, p1 holds its own
       copy, p2 nothing of it, and p1's flag, read on p2, says a note is written and holds no text.
       Taken away after: the row dropped, p1 sent its copy of the drop, and its flag put back. */
    const NOTE61 = `const N = await import("${repoUrl}/scripts/pre-session-note.mjs");`;
    const flagP5Was = await gm.eval(`return game.users.get("${IDS.p1}").getFlag("${MOD}", "preSessionNote") ?? null;`);
    const savedP5 = await p1.eval(`${NOTE61} return await N.saveNote(game.user.id, "E05 61 P5 p1's note");`, { timeout: 30000 });
    await settle(1200);
    const noteP5 = { saved: savedP5, flag: await p2.eval(`return game.users.get("${IDS.p1}").getFlag("${MOD}", "preSessionNote") ?? null;`) };
    for (const [who, client] of [["gm", gm], ["gm2", gm2], ["p1", p1], ["p2", p2]]) noteP5[who] = await client.eval(`${NOTE61} return N.noteFor("${IDS.p1}");`);
    check("P5: a note p1 saves through the primary reaches the second GM, p1 holds its own copy, p2 nothing, and p1's flag holds no text",
        noteP5.saved === "sent" && [noteP5.gm, noteP5.gm2, noteP5.p1].every(t => t === "E05 61 P5 p1's note") && noteP5.p2 === ""
        && noteP5.flag?.written === true && !Object.hasOwn(noteP5.flag ?? {}, "text"), J(noteP5), { flow: "pre-session-note" });
    /* P5b (E05 fix r2-G5, 27.09.2026; review S2-m9): p1's Note tab was drawn with P5's note; the
       primary edits it; p1 saves what was typed there, with the text the tab was drawn from as its
       base. The GM's edit stays and p1 is answered "changed"; a second Save, drawn from the note p1
       now holds, puts p1's words in place. Red on ff588ab: the first Save answered "sent" and wrote
       over the GM's edit. Taken away with P5's row below. */
    await gm.eval(`${NOTE61} await N.writeNote("${IDS.p1}", "E05 61 P5b the GM's edit", { byGm: true }); return true;`, { timeout: 30000 });
    await settle(1200);
    const noteP5b = await p1.eval(`${NOTE61} const copy = N.noteFor(game.user.id);
        return { copy, saved: await N.saveNote(game.user.id, "E05 61 P5b typed by p1", { base: "E05 61 P5 p1's note" }) };`, { timeout: 30000 });
    await settle(1200);
    noteP5b.gmAfterFirst = await gm.eval(`${NOTE61} return N.noteFor("${IDS.p1}");`);
    noteP5b.again = await p1.eval(`${NOTE61} return await N.saveNote(game.user.id, "E05 61 P5b typed by p1", { base: N.noteFor(game.user.id) });`, { timeout: 30000 });
    await settle(1200);
    noteP5b.gmAfterAgain = await gm.eval(`${NOTE61} return N.noteFor("${IDS.p1}");`);
    check("P5b: p1's Save of a note a GM edited after p1's tab was drawn leaves the GM's edit and says so; a second Save puts p1's words in place",
        noteP5b.copy === "E05 61 P5b the GM's edit" && noteP5b.saved === "changed" && noteP5b.gmAfterFirst === "E05 61 P5b the GM's edit"
        && noteP5b.again === "sent" && noteP5b.gmAfterAgain === "E05 61 P5b typed by p1", J(noteP5b), { flow: "pre-session-note" });
    await gm.eval(`${NOTE61} const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const U = await import("${repoUrl}/scripts/utils.mjs");
        // A tree before C6 has no store to take it from (its red run, 26.09): the flag alone is put back there.
        if (S.noteStore) {
            await S.noteStore.drop("${IDS.p1}");
            N.sendNoteTo("${IDS.p1}");
        }
        const was = ${J(flagP5Was)}, user = game.users.get("${IDS.p1}");
        if (was === null) await user.unsetFlag("${MOD}", "preSessionNote");
        else await U.replaceFlag(user, "preSessionNote", was);
        return true;`);

    // Taken away again: no later phase is to meet an armed item trap with nothing planted for it.
    await gm.eval(`${TRAP} await P.deleteProject("${trap.id}"); return true;`);
    await settle(600);
    await disconnect("gm2");
    await settle(300);

    /* ------------------- I. the fog ledger reaches a GM who joins ------------------- */

    /* gm finds two rooms for Aiko and unticks one while gm2 is away; gm2 comes back with
       its browser: the store's exchange brings it the same cells, the untick with them -
       the old GM-to-GM copy was the union, which had no way to say "unticked" (S07-01). */
    phase("I: the fog ledger's cells reach a GM who joins, an untick with them", { flow: "discovery-ledger" });
    const FOG = `const F = await import("${repoUrl}/scripts/fog.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");`;
    const fogRooms = await gm.eval(`${FOG} const rooms = (await import("${repoUrl}/scripts/movement.mjs")).allRooms().slice(0, 2);
        await F.setDiscovery(canvas.scene, { actorId: "${IDS.aiko}", rooms, value: true });
        await F.applyDiscoveryChanges(canvas.scene, [{ actorId: "${IDS.aiko}", room: rooms[0], value: false }]);
        return rooms;`);
    await connect("gm2", { storage: await storageOf("gm2") });
    await settle(1500);
    const fogOn = client => client.eval(`${FOG} return { digest: E.sectionDigest(S.discoveryStore.section()),
        aiko: F.discoveredFor(canvas.scene.id, "${IDS.aiko}"), cell: S.discoveryStore.get(canvas.scene.id + "/${IDS.aiko}")?.[${J(fogRooms[0])}] ?? null };`);
    const fogGm = await fogOn(gm), fogGm2 = await fogOn(gm2);
    check("I1: a GM who joins holds the same fog cells as the primary, the unticked room unticked",
        fogRooms.length === 2 && J(fogGm2.digest) === J(fogGm.digest) && J(fogGm2.aiko) === J([fogRooms[1]]) && fogGm2.cell === false,
        J({ fogRooms, fogGm, fogGm2 }));

    /* ------------------- H1. a Level Up offered, synced ------------------- */

    phase("H1: a Level Up offered on the primary lights its owner's button, and the second GM holds it", { flow: "class-trial" });
    const LV = `const L = await import("${repoUrl}/scripts/level-up.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");`;
    // What each offers packet says, as p1 receives it (as for the door and the cast, the review's M2).
    // And the refusals addressed to p1: a spend is answered "got it" first, and refused after (E31).
    await p1.eval(`globalThis.__offers = []; globalThis.__refusals = [];
        game.socket.on("module.${MOD}", (payload, senderId) => {
            if (payload?.action === "advancement.offers") globalThis.__offers.push({ from: senderId, offers: payload.offers ?? null, stamps: payload.stamps ?? null });
            if (payload?.action === "bridge.refused") globalThis.__refusals.push({ from: senderId, what: payload.what ?? null, reason: payload.reason ?? null });
        });
        return true;`);
    const offersSince = n => p1.eval(`return globalThis.__offers.slice(${n});`);
    const offersNow = () => p1.eval(`return globalThis.__offers.length;`);
    const litOn = client => client.eval(`${LV} const a = game.actors.get("${IDS.aiko}");
        return { offer: L.pendingAdvance(a)?.kind ?? null, stamp: game.user.isGM ? (S.offerStore?.newest("${IDS.aiko}") ?? null) : (E.mineStamps("offers")["${IDS.aiko}"] ?? 0),
            advances: a.getFlag("${MOD}", "advances") ?? 0 };`);
    const offeredAt = await gm.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.aiko}"), "standard");
        return S.offerStore?.newest("${IDS.aiko}") ?? null;`);
    await settle(800);
    const litH1 = await litOn(p1), onGm2H1 = await litOn(gm2);
    check("H1: a Standard Level Up offered on the primary reaches Aiko's player at its stamp, and the second GM holds it",
        offeredAt > 0 && J([litH1.offer, litH1.stamp]) === J(["standard", offeredAt]) && J([onGm2H1.offer, onGm2H1.stamp]) === J(["standard", offeredAt]),
        J({ offeredAt, litH1, onGm2H1 }));
    /* H1b (E05 C11, 27.09.2026; D4): a Reinforced Level Up a wrong verdict left waiting for the
       class is a row of the GMs' `deferredOffers` store, written on the primary and held by the
       second GM, which may be the one that runs the next verdict. Written to the store directly:
       the verdict itself, and its veiled card, are 72-canary's. K4 has the kill drop it. */
    const deferredOn = client => client.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const row = S.deferredOfferStore?.get("${IDS.daichi}"); return row ? { kind: row.kind, count: row.count } : null;`);
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        await S.deferredOfferStore?.patch("${IDS.daichi}", { kind: "reinforced", chapter: 1, at: Date.now(), count: 1 }, { whole: true });
        return true;`);
    await settle(800);
    const waitingH1b = { gm: await deferredOn(gm), gm2: await deferredOn(gm2) };
    check("H1b: a Reinforced Level Up waiting for the class, written on the primary, is held by the second GM",
        [waitingH1b.gm, waitingH1b.gm2].every(r => r?.kind === "reinforced" && r?.count === 1), J(waitingH1b));

    /* ------------------- K. the upgrade day's claim of an old cast, one of them stale ------------------- */

    /* K (the round-2 review's R2-B1, 26.09.2026): a 1.2.62 cast entry is written whole, and its
       nulls are decisions - "no third" at its `updated`. Two GMs' browsers first open 1.2.63 while
       an incident runs: gmb's old key holds the running one (Chie kills Daichi, no third), gmc's
       the previous one, which gmc last saw (Botan and Daichi, Aiko its third on the killer's side,
       older). The claim took only the non-null fields, so gmc's older third filled the running
       incident on every GM, and the primary sent Aiko's player the cast, its killer included
       (measured on d32f8f2 in the review's scenario 94). The primary clears the cast store first,
       so no newer stamp left from F decides it in the fix's place, and both again after. */
    phase("K: two GMs' old casts are claimed on the upgrade day, one of them stale", { flow: "murder-incident" });
    const castK = client => client.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const r = S.castStore.record(); return { killerId: r.killerId ?? null, thirdId: r.thirdId ?? null, thirdSide: r.thirdSide ?? null,
            claimed: S.castStore.census()?.claimed ?? null };`);
    const stateBeforeK = await gm.eval(`return foundry.utils.deepClone(game.settings.get("${MOD}", "murderState") ?? {});`);
    const clearedK = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.clear();
        await game.settings.set("${MOD}", "murderState", { active: true, stage: "incident", turn: 2, turnSide: "killer" });
        return S.castStore.cleared();`);
    await settle(1200);
    const runningK = { killerId: IDS.chie, victimId: IDS.daichi, killerTurnId: IDS.chie, thirdId: null, thirdSide: null, lastCrisis: null, updated: clearedK + 600 };
    const staleK = { killerId: IDS.botan, victimId: IDS.daichi, killerTurnId: IDS.botan, thirdId: IDS.aiko, thirdSide: "killer", updated: clearedK + 300 };
    const castsK = await p1.eval(`return globalThis.__casts.length;`);
    await connect("gmb", { storage: { [`${MOD}.incidentCast`]: J(runningK) } });
    await settle(1500);
    await connect("gmc", { storage: { [`${MOD}.incidentCast`]: J(staleK) } });
    await settle(2000);
    const onGmK = await castK(gm), onGmbK = await castK(gmb), onGmcK = await castK(gmc);
    // What p1 was sent, as it receives it (F records it): a "not in it" answer to its own ask carries nobody.
    const castToP1 = (await p1.eval(`return globalThis.__casts.slice(${castsK});`)).filter(d => Object.keys(d.cast ?? {}).length);
    check("K1: both GM browsers claimed their old cast, and every record keeps the running incident's \"no third\" - the previous incident's third is not in it",
        onGmbK.claimed === 1 && onGmcK.claimed === 1 && [onGmK, onGmbK, onGmcK].every(r => r.killerId === IDS.chie && r.thirdId === null && r.thirdSide === null),
        J({ onGmK, onGmbK, onGmcK }));
    check("K2: Aiko's player, in no part of the running incident, is sent no cast", castToP1.length === 0, J({ castToP1 }));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.clear();
        await game.settings.set("${MOD}", "murderState", ${J(stateBeforeK)}); return true;`);
    await settle(800);
    /* K3 (E05 C10, 26.09.2026; audit S06-11): a death nobody has found reaches the second GM through
       the deaths store, and its publication run there - `publishDeath`, the discovery's first step -
       writes the flag and drops the row on both GMs. Not a whole discovery: it gathers every token
       and asks about Faint Prep traces in the middle of this scenario; 72-canary runs one. */
    const deathK = client => client.eval(`const ch = await import("${repoUrl}/scripts/chapter.mjs"); const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const a = game.actors.get("${IDS.daichi}"); return { held: ch.isDeadForGm(a), flag: ch.isDeceased(a), row: S.deathStore.has(a.id) };`);
    await gm.eval(`const ch = await import("${repoUrl}/scripts/chapter.mjs");
        return Boolean(await ch.killCharacter(game.actors.get("${IDS.daichi}"), { secret: true, keepBullets: true }));`, { timeout: 60000 });
    await settle(1500);
    const heldK3 = await deathK(gmb);
    const publishedK3 = await gmb.eval(`const ch = await import("${repoUrl}/scripts/chapter.mjs");
        return Boolean(await ch.publishDeath(game.actors.get("${IDS.daichi}")));`, { timeout: 60000 });
    await settle(1500);
    const afterK3 = { gm: await deathK(gm), gmb: await deathK(gmb) };
    check("K3: a death nobody has found reaches the second GM, and its publication there writes the flag and drops the row on both GMs",
        heldK3.held && heldK3.row && !heldK3.flag && publishedK3 && afterK3.gm.flag && !afterK3.gm.row && afterK3.gmb.flag && !afterK3.gmb.row,
        J({ heldK3, publishedK3, afterK3 }));
    /* K4 (E05 C11; the design's 2.3 step 5): the kill - a secret one, before any publication -
       dropped the Reinforced Level Up H1b left waiting for Daichi, on every GM. */
    const lapsedK4 = { gm: await deferredOn(gm), gm2: await deferredOn(gm2), gmb: await deferredOn(gmb) };
    check("K4: a secret kill drops the dead's Reinforced Level Up waiting for the class, on every GM",
        waitingH1b.gm !== null && Object.values(lapsedK4).every(r => r === null), J({ waitingH1b, lapsedK4 }));
    await gm.eval(`const ch = await import("${repoUrl}/scripts/chapter.mjs");
        await ch.reviveCharacter(game.actors.get("${IDS.daichi}"), { quiet: true }); return true;`, { timeout: 60000 });
    await settle(800);
    await disconnect("gmb");
    await disconnect("gmc");
    await settle(300);

    /* ------------------- J. the season reset is the primary's, and the clock cuts ------------------- */

    /* J1: a Mastermind is picked on the primary while gm2 is here, so gm2's browser holds a
       pick (E ended with none) - and gm2, not the primary while the seed GM is, is refused the
       reset. A queued "cancel" stands in for the GM at the window, should one open (on 1.2.62
       it did, for any GM), so the run never waits on it. */
    phase("J1: a GM who is not the primary is refused the season reset and told whose it is", { flow: "gm-store" });
    const RESET = `const R = await import("${repoUrl}/scripts/season-setup.mjs");`;
    const cutsOn = client => client.eval(`return (await import("${repoUrl}/scripts/clock.mjs")).getClock().resetCuts ?? {};`);
    await gm.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Library" }); return true;`);
    await settle(800);
    const pickedJ1 = await gm2.eval(`${MM} return S.mastermindStore.record().actorId ?? null;`);
    const gmName = await gm.eval(`return game.user.name;`);
    const cutsBefore = await cutsOn(gm);
    const refusedJ1 = await gm2.eval(`${RESET} const title = game.i18n.localize("DRPG.Season.resetTitle");
        const n = globalThis.__notifications.length, d = globalThis.__dialogLog.length;
        globalThis.__dialogAnswers.push("cancel");
        const result = await R.resetSeason();
        return { result, warned: globalThis.__notifications.slice(n).filter(x => x.level === "warn").map(x => x.msg),
            windows: globalThis.__dialogLog.slice(d).filter(x => x.title === title).length };`, { timeout: 30000 });
    const cutsAfterJ1 = await cutsOn(gm);
    check("J1: the second GM's season reset is refused and names the primary GM; no window opens and the clock is not cut",
        pickedJ1 === IDS.aiko && refusedJ1.result === null && refusedJ1.warned.some(m => m.includes(gmName)) && refusedJ1.windows === 0
        && J(cutsAfterJ1) === J(cutsBefore), J({ pickedJ1, gmName, refusedJ1, cutsBefore, cutsAfterJ1 }));

    /* J1b (the round-2 reviews' R2-M1 and M3, the fix list's 13, 26.09): tier 2 writes its fixtures
       into this world's records with the stores held, and puts them back before it lets go. While
       held, the primary told the players the fixture's pick, and answered a player's request from it
       at a stamp that stayed (their scenario 93: p1 believed they were the Mastermind with no GM
       holding a pick). Now: nothing is sent while held, the request waits, and once the record is
       back and the hold let go it is answered from the real record - no player's copy says
       anything else (the record put back here is written afresh, so Aiko's player is told it again
       at its new stamps). */
    const doorPackets = n => socketTraffic.slice(n).filter(t => t.action === "mastermind.door");
    const fromJ1b = socketTraffic.length;
    await gm.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs"); E.gmStoreHold(true);
        await S.mastermindStore.patch("record", { actorId: "${IDS.botan}", room: "J1b fixture lair" }); return true;`);
    await settle(500);
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "mastermind.doorRequest" }, { recipients: ["${IDS.gm}"] }); return true;`);
    await settle(800);
    const whileHeld = doorPackets(fromJ1b).map(t => t.to);
    const fromRelease = socketTraffic.length;
    await gm.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        await S.mastermindStore.patch("record", { actorId: "${IDS.aiko}", room: "Library" }); E.gmStoreHold(false); return true;`);
    await settle(1200);
    const afterRelease = doorPackets(fromRelease).map(t => t.to);
    const p1J1b = await doorOf(p1), p2J1b = await doorOf(p2);
    check("J1b: while the stores are held a fixture pick is told to no player and a request waits; let go, the request is answered from the real record and no copy moved",
        whileHeld.length === 0 && afterRelease.some(to => Array.isArray(to) && to.includes(IDS.p2))
        && p1J1b.copy?.mastermind === true && p1J1b.copy?.room === "Library" && p2J1b.copy?.mastermind === false,
        J({ whileHeld, afterRelease, p1J1b, p2J1b }));
    await disconnect("gm2");
    await settle(300);

    /* J2: the primary resets through the window, the answer queued as a GM gives it (the
       word and the ticks): the traces and the Mastermind, then the traces alone. */
    phase("J2: the primary resets twice: the traces and the Mastermind, then the traces alone", { flow: "gm-store" });
    /* J2a's Key Remnant plan rows (E05 fix r1-G5, M3): "keyPlan" is never ticked in either
       reset below - unticked is what a GM reads off this checklist most often, since ticking
       it away is the exception the checkbox remembers - and rows carry no season stamp
       (gm-stores.mjs's own comment on `keyPlanStore`). Before this fix every chapter planted
       here rode into the new season whole; planted directly on the store (as P4's own cleanup
       above dropped its rows directly), not through the clock, so nothing else in this run
       moves with it. */
    const chapterJ2 = await gm.eval(`return game.drpg.getClock().chapter;`);
    const otherChaptersJ2 = [chapterJ2 + 1000, chapterJ2 + 1001];
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        for (const chapter of ${J([chapterJ2, ...otherChaptersJ2])}) {
            await S.keyPlanStore.patch(chapter + ":0", { scale: "standard", name: "E05 61 J2 chapter " + chapter });
        }
        return true;`);
    const resetOnce = ticked => gm.eval(`${RESET} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const word = game.i18n.localize("DRPG.Season.resetWord");
        let shown = null;
        globalThis.__dialogAnswers.push(config => {
            shown = typeof config.content === "string" ? config.content : (config.content?.outerHTML ?? "");
            return { word, ticked: ${J(ticked)} };
        });
        const result = await R.resetSeason();
        await E.gmStoresIdle();
        const clock = (await import("${repoUrl}/scripts/clock.mjs")).getClock();
        return { cleared: result?.cleared ?? null, offline: /Second GM/.test(shown ?? ""), cuts: clock.resetCuts ?? {},
            season: clock.seasonStartedAt ?? null,
            watermarks: { remnants: S.remnantStore.cleared(), mastermind: S.mastermindStore.cleared(), offers: S.offerStore.cleared() },
            traces: Object.keys(S.remnantStore.entries()).length,
            tokens: game.scenes.contents.reduce((n, scene) => n + scene.tokens.filter(t => t.getFlag("${MOD}", "isRemnant")).length, 0),
            pick: S.mastermindStore.record().actorId ?? null, offer: S.offerStore.get("${IDS.aiko}")?.kind ?? null,
            keyPlanRows: Object.keys(S.keyPlanStore.entries()) };`, { timeout: 60000 });
    const firstReset = await resetOnce(["remnants", "mastermind"]);
    /* `1:0` is this run's own planted row; P4 above left `1:2`-`1:4` behind too (every Save of
       the planner stamps a slot's scale, and P4 dropped only the two slots it named) - both
       are the kept chapter's, so both survive. The measure is that no OTHER chapter's row does. */
    check("J2m3: kept, the Key Remnant plan's rows are trimmed to the chapter the reset ran on - the other two planted chapters are gone",
        firstReset.keyPlanRows.includes(`${chapterJ2}:0`) && firstReset.keyPlanRows.every(k => k.startsWith(`${chapterJ2}:`)),
        J({ chapterJ2, otherChaptersJ2, keyPlanRows: firstReset.keyPlanRows }));
    await settle(600);
    const secondReset = await resetOnce(["remnants"]);
    await settle(600);
    const cutJ2 = firstReset.cuts;
    check("J2a: the first reset names the GMs away, cuts the traces and the Mastermind at one stamp its steps come after, and keeps the Level Up",
        J(firstReset.cleared) === J(["Remnants", "the Mastermind"]) && firstReset.offline
        && cutJ2.remnants > 0 && cutJ2.mastermind === cutJ2.remnants && !("advancement" in cutJ2) && firstReset.season === null
        && firstReset.watermarks.remnants > cutJ2.remnants && firstReset.watermarks.mastermind >= cutJ2.mastermind
        && firstReset.traces === 0 && firstReset.tokens === 0 && firstReset.pick === null && firstReset.offer === "standard", J(firstReset));
    // With no trace left the primary still clears the store, after the cut (the review's C-m5: it cleared only with a live row to see).
    check("J2b: the second cuts the traces again and clears them with none left, leaves the Mastermind's cut where the first put it, and keeps the Level Up",
        J(secondReset.cleared) === J(["Remnants"]) && secondReset.cuts.remnants > cutJ2.remnants && secondReset.watermarks.remnants > secondReset.cuts.remnants
        && secondReset.cuts.mastermind === cutJ2.mastermind && !("advancement" in secondReset.cuts) && secondReset.offer === "standard", J(secondReset));

    /* J3: the seed GM leaves here for good (a late account can come back, it cannot), and
       gm2 comes back with the browser it left in J1, alone and so the primary: nobody sends
       it the clears, so what it lost it lost by the clock. */
    phase("J3: the second GM comes back alone, and the clock's cuts take what the resets wiped", { flow: "gm-store" });
    const storedSection = (storage, key) => {
        try { return JSON.parse(storage?.[`${MOD}.${key}`] ?? "null")?.worlds?.[worldA] ?? null; } catch { return null; }
    };
    const leftGm2 = await storageOf("gm2");
    const heldGm2 = { traces: Object.keys(storedSection(leftGm2, "gmRemnants")?.e ?? {}).length,
        pick: storedSection(leftGm2, "gmMastermind")?.e?.record?.actorId ?? null };
    /* And two tombstones a month old in its answer keys, written into the browser it brings:
       one of a bullet that is gone, one of an actor that is here - compaction (C10) runs on
       every GM once its stores have the others' copies, alone included. */
    const monthAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const goneBullet = "Actor.J3GONE0000000000.Item.J3GONE0000000000", hereSubject = `Actor.${IDS.aiko}`;
    const bulletsKey = `${MOD}.gmBullets`;
    const bullets = JSON.parse(leftGm2[bulletsKey] ?? "null");
    if (bullets?.worlds?.[worldA]) Object.assign(bullets.worlds[worldA].d ??= {}, { [goneBullet]: monthAgo, [hereSubject]: monthAgo });
    const withTombstones = { ...leftGm2, [bulletsKey]: JSON.stringify(bullets) };
    await disconnect("gm");
    const fromJ3 = socketTraffic.length;
    await connect("gm2", { storage: withTombstones });
    await settle(1500);
    /* J3c (the fix list's 15, the round-2 review's m4): a primary arriving is asked by every
       player for the door, the cast and the fog, on its world's load - the bridge's "a GM is
       listening" signal. They asked on `userConnected`, which on a live reload fires before
       the GM's listeners exist (LIVE-E04-12 is which comes first on v14), and the fog not at all. */
    const ASKS = ["mastermind.doorRequest", "incident.myCastRequest", "fog.request"];
    const asksJ3 = socketTraffic.slice(fromJ3).filter(t => ASKS.includes(t.action) && Array.isArray(t.to) && t.to.includes(GM2));
    check("J3c: a primary GM arriving is asked by every player for the door, the cast and the fog",
        ["p1", "p2", "p3"].every(who => ASKS.every(a => asksJ3.some(t => t.from === who && t.action === a))), J(asksJ3.map(t => [t.from, t.action])));
    const onGm2J3 = await gm2.eval(`${MM} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const U = await import("${repoUrl}/scripts/utils.mjs");
        return { primary: U.isPrimaryGm(), hydration: E.gmStoreHydration().state,
            watermarks: { remnants: S.remnantStore.cleared(), mastermind: S.mastermindStore.cleared() },
            traces: Object.keys(S.remnantStore.entries()).length, pick: S.mastermindStore.record().actorId ?? null,
            offer: S.offerStore.get("${IDS.aiko}")?.kind ?? null, offerAt: S.offerStore.newest("${IDS.aiko}") };`);
    check("J3: alone after both resets, its traces are cut at the second reset's stamp and its pick at the first's, by the clock alone, and its Level Up is kept",
        heldGm2.traces >= 2 && heldGm2.pick === IDS.aiko && onGm2J3.primary && onGm2J3.hydration === "alone"
        && onGm2J3.watermarks.remnants === secondReset.cuts.remnants && onGm2J3.watermarks.mastermind === cutJ2.mastermind
        && onGm2J3.traces === 0 && onGm2J3.pick === null && onGm2J3.offer === "standard" && onGm2J3.offerAt === offeredAt,
        J({ heldGm2, onGm2J3, cuts: secondReset.cuts }));
    const compacted = await gm2.eval(`${MM} return { gone: S.bulletStore.tombstone(${J(goneBullet)}), here: S.bulletStore.tombstone(${J(hereSubject)}),
        rows: Object.keys(S.bulletStore.entries()).length };`);
    check("J3b: and its stores are compacted once it is alone: a month-old tombstone of a gone bullet goes, one whose subject is here stays, and no row goes",
        Boolean(bullets?.worlds?.[worldA]) && compacted.gone === 0 && compacted.here === monthAgo && compacted.rows === 3, J({ monthAgo, compacted }));

    /* ------------------- H2. the primary alone, and its store empty ------------------- */

    /* gm2 is here since J3, alone and so the primary: it holds the offer from H1. */
    phase("H2: a primary alone answers the owner, spends the offer, and with its store emptied takes nothing away", { flow: "class-trial" });
    // The owner asks as its bridge does (E31's advancement.ask, a report nobody waits on).
    const askOffers = () => p1.eval(`const B = await import("${repoUrl}/scripts/bridge-guards.mjs");
        await B.bridgeRequest("advancement.ask", {}, { settle: "none", quiet: true }); return true;`);
    const askedH2 = await offersNow();
    await askOffers();
    await settle(800);
    const answeredOnJoin = await offersSince(askedH2), litH2 = await litOn(p1);
    const apply = () => p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestAdvancement({ actorId: "${IDS.aiko}", picks: [{ option: "hp" }], kind: "standard" });
        return { ok: Boolean(res?.ok), reason: res?.reason ?? null };`, { timeout: 60000 });
    const spent = await apply();
    await settle(800);
    const afterSpend = await litOn(p1), onGm2Spent = await litOn(gm2);
    check("H2a: the primary alone answers the owner's ask with the offer at its stamp, and spends it: the Level Up is written and the button goes out",
        answeredOnJoin.some(d => d.from === GM2 && d.offers?.[IDS.aiko]?.kind === "standard" && d.stamps?.[IDS.aiko] === offeredAt)
        && litH2.offer === "standard" && spent.ok && afterSpend.offer === null && afterSpend.stamp > offeredAt
        && onGm2Spent.advances === litH2.advances + 1, J({ answeredOnJoin, litH2, spent, afterSpend, onGm2Spent }));

    const secondAt = await gm2.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.aiko}"), "standard");
        const at = S.offerStore?.newest("${IDS.aiko}") ?? null;
        await S.offerStore?.forget();
        return at;`);
    await settle(800);
    const askedEmpty = await offersNow();
    await askOffers();
    await settle(800);
    const emptyAnswer = await offersSince(askedEmpty), litEmpty = await litOn(p1);
    const whispersBefore = await gm2.eval(`return game.messages.size;`);
    const refusalsBefore = await p1.eval(`return globalThis.__refusals.length;`);
    await apply();
    await settle(800);
    const refused = await p1.eval(`return globalThis.__refusals.slice(${refusalsBefore});`);
    // A GM's whisper keeps its words off the card (secret.mjs): read them the way the chat log does.
    const told = await gm2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return game.messages.contents.slice(${whispersBefore}).filter(m => /holds no offer/.test(contentOf(m))).length;`);
    check("H2b: the primary's store emptied, its answer carries stamp 0 and the owner's button stays lit; the spend is refused as not offered, and the GM is told",
        secondAt > afterSpend.stamp && emptyAnswer.length >= 1 && emptyAnswer.every(d => J(d.offers) === "{}" && (d.stamps?.[IDS.aiko] ?? 0) === 0)
        && J([litEmpty.offer, litEmpty.stamp]) === J(["standard", secondAt])
        && J(refused) === J([{ from: GM2, what: "advancement.apply", reason: "notOffered" }]) && told === 1,
        J({ secondAt, emptyAnswer, litEmpty, refused, told }));

    /* H3, the round-2 review's M2 (26.09): Aiko, whose offers p1's copy holds, goes to p2, and
       Daichi to p1; an offer to Daichi must light p1's button. Weighed as a part of every answer,
       the character that left p1's set read as 0 in each answer after it, older than the copy,
       and every answer was refused for the rest of the season. Put back after. */
    phase("H3: an owner whose character went to another player still takes the next offer", { flow: "class-trial" });
    await gm2.eval(`await game.actors.get("${IDS.aiko}").update({ ownership: { "${IDS.p1}": 0, "${IDS.p2}": 3 } });
        await game.actors.get("${IDS.daichi}").update({ ownership: { "${IDS.p1}": 3 } }); return true;`);
    await settle(800);
    const offeredH3 = await gm2.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.daichi}"), "standard");
        return S.offerStore?.newest("${IDS.daichi}") ?? null;`);
    await settle(800);
    const litH3 = await p1.eval(`${LV} return { daichi: L.pendingAdvance(game.actors.get("${IDS.daichi}"))?.kind ?? null, stamps: E.mineStamps("offers") };`);
    check("H3: p1, whose Aiko went to p2, takes the offer to Daichi, now theirs: the button lights at the offer's stamp",
        offeredH3 > 0 && litH3.daichi === "standard" && litH3.stamps[IDS.daichi] === offeredH3 && !(IDS.aiko in litH3.stamps), J({ offeredH3, litH3 }));
    await gm2.eval(`${LV} await L.recordOffer("${IDS.daichi}", null);
        await game.actors.get("${IDS.daichi}").update({ ownership: { "${IDS.p1}": 0 } });
        await game.actors.get("${IDS.aiko}").update({ ownership: { "${IDS.p1}": 3, "${IDS.p2}": 0 } }); return true;`);
    await settle(800);

    /* J4 (the owner's Q4; the round-2 reviews' R2-m5 and m3): a reset with "advancement" ticked
       withdraws the Level Ups on offer - by the clock's cut alone, as nothing is sent for it. Measured
       until now on fakes (R176) and on the store's side (tier 2); here on p1's own copy and sheet. */
    phase("J4: a reset with advancement ticked takes a standing offer off its owner's copy and sheet", { flow: "class-trial" });
    const offeredJ4 = await gm2.eval(`${LV} await L.offerAdvancement(game.actors.get("${IDS.aiko}"), "standard");
        return S.offerStore?.newest("${IDS.aiko}") ?? null;`);
    await settle(800);
    const litJ4 = await litOn(p1);
    /* The sheet is counted on `actor.sheet` itself: the harness keeps one sheet per document,
       as Foundry does (lib/shim.mjs, fix round 11). Until then its getter made a new object
       at each read, a counter put on one read's object saw nothing - measured 26.09.2026,
       renders 0 with the redraw running and with it a no-op alike - and this phase put a
       sheet of its own in place. Each draw notes its caller, and the offers packets p1 took
       meanwhile are counted, so a draw is the cut's only when none came. */
    const sameSheetJ4 = await p1.eval(`const a = game.actors.get("${IDS.aiko}"); globalThis.__renders = 0; globalThis.__renderedBy = [];
        const sheet = a.sheet, render = sheet.render;
        globalThis.__j4Render = render;
        sheet.render = function (...args) {
            globalThis.__renders++;
            globalThis.__renderedBy.push((new Error().stack ?? "").split("\\n").slice(2, 4).map(l => l.trim().replace(/\\(.*\\//, "(")).join(" < "));
            return render.apply(this, args);
        };
        return a.sheet === sheet && game.actors.get("${IDS.aiko}").sheet.render === sheet.render;`);
    const packetsBeforeJ4 = await offersNow();
    const resetJ4 = await gm2.eval(`${RESET} const E = await import("${repoUrl}/scripts/gm-store.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const word = game.i18n.localize("DRPG.Season.resetWord");
        globalThis.__dialogAnswers.push(() => ({ word, ticked: ["advancement"] }));
        const result = await R.resetSeason();
        await E.gmStoresIdle();
        const clock = (await import("${repoUrl}/scripts/clock.mjs")).getClock();
        return { cleared: result?.cleared ?? null, cut: clock.resetCuts?.advancement ?? null, offer: S.offerStore.get("${IDS.aiko}")?.kind ?? null };`,
        { timeout: 60000 });
    await settle(800);
    const afterJ4 = await p1.eval(`${LV} const a = game.actors.get("${IDS.aiko}");
        const out = { copy: S.offerCopy.read(), lit: L.pendingAdvance(a)?.kind ?? null, renders: globalThis.__renders, by: globalThis.__renderedBy };
        a.sheet.render = globalThis.__j4Render;
        return out;`);
    afterJ4.packets = (await offersNow()) - packetsBeforeJ4;
    const askedJ4 = await offersNow();
    await askOffers();
    await settle(800);
    const answerJ4 = await offersSince(askedJ4), litAfterAsk = await litOn(p1);
    check("J4: the reset takes the offer off p1's copy, its sheet is drawn again, and the primary's answer after it does not light the button",
        sameSheetJ4 && litJ4.offer === "standard" && resetJ4.cut > offeredJ4 && resetJ4.offer === null && J(afterJ4.copy) === "{}" && afterJ4.lit === null
        && afterJ4.renders >= 1 && afterJ4.packets === 0 && litAfterAsk.offer === null, J({ sameSheetJ4, offeredJ4, litJ4, resetJ4, afterJ4, answerJ4, litAfterAsk }));

    /* ------------------- Z. the browser is lost, and the case comes back ------------------- */

    phase("Z: a GM backs up, every GM leaves, an empty browser comes back alone, and another restores", { flow: "gm-store" });
    // gm2 is here since J3, alone; the seed GM left there. J's resets took every trace and the pick, so two traces
    // are placed again and Aiko is picked: the restore below has a door to tell p1 about.
    await gm2.eval(`${MM} await M.setMastermind(game.actors.get("${IDS.aiko}"), { room: "Z lair" }); return true;`);
    const placedZ = await gm2.eval(`${REM}
        const scene = game.scenes.get("${IDS.scene}");
        const out = [];
        for (const [n, type] of [[1, "incident"], [2, "prep"]]) {
            const token = await R.placeRemnant({ type, visibility: "subtle", x: 100 * n, y: 100, scene, tiedToCrime: n === 1,
                note: "E04 trace " + n, sourceName: "E04" });
            out.push(token.id);
        }
        return out;`);
    const idsZ = placedZ.map(id => `${IDS.scene}.${id}`);
    const expectZ = [["incident", "E04 trace 1", true], ["prep", "E04 trace 2", false]];
    const backup = await gm2.eval(`const file = await game.drpg.backupCase();
        const saved = globalThis.__savedFiles.at(-1) ?? null;
        return { format: file?.format ?? null, rows: Object.keys(file?.stores?.bullets?.e ?? {}).length,
            traces: Object.keys(file?.stores?.remnants?.e ?? {}).sort(), name: saved?.filename ?? null, text: saved?.data ?? null };`);
    check("Z1: the second GM backs the case up to one file, the three answer keys and the two traces' in it",
        backup.format === "drpg-case" && backup.rows === 3 && J(backup.traces) === J([...idsZ].sort())
        && /^drpg-case-drpg-audit-world-/.test(backup.name ?? "") && Boolean(backup.text),
        J({ ...backup, text: backup.text ? `${backup.text.length} characters` : null }));
    await disconnect("gm2");
    await settle(300);
    /* Z6's note (E05 C6): saved by p1 in the one moment of this run with no GM connected. */
    const keptZ6 = await p1.eval(`${NOTE61} const U = await import("${repoUrl}/scripts/utils.mjs");
        return { gms: U.activeGmIds().length, saved: await N.saveNote(game.user.id, "E05 61 Z6 kept note") };`, { timeout: 30000 });
    await connect("gm3");
    await settle(1500);
    const seenOnGm3 = await gm3.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const E = await import("${repoUrl}/scripts/gm-store.mjs");
        return { primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm(), hydration: E.gmStoreHydration().state,
            dialogs: globalThis.__dialogLog.filter(d => d.title === game.i18n.localize("DRPG.Case.healthTitle")),
            warning: Boolean(S.caseWarning()) };`);
    check("Z2: the empty browser, alone and so the primary, opens the health check naming the missing answer keys, and Continue leaves the warning up",
        seenOnGm3.primary && seenOnGm3.hydration === "alone" && seenOnGm3.dialogs.length === 1
        && /3 Truth Bullets \(of 3\) have no answer key/.test(seenOnGm3.dialogs[0]?.content ?? "")
        && /2 traces on the map \(of 2\) have no answer key/.test(seenOnGm3.dialogs[0]?.content ?? "") && seenOnGm3.warning, J(seenOnGm3));
    /* Z6 (E05 C6, 26.09.2026; audit S11-03): a note p1 saved while no GM was connected was kept on
       p1's browser, unsent, and answered "kept"; gm3, the next primary GM, with an empty browser, is
       sent it once its world has loaded (`drpgPrimaryReady`) and holds it, and p1's copy is sent. */
    const noteZ6 = { kept: keptZ6, gm3: await gm3.eval(`${NOTE61} return N.noteFor("${IDS.p1}");`),
        p1: await p1.eval(`${NOTE61} return { unsent: N.noteUnsent?.() ?? null, text: N.noteFor(game.user.id) };`) };
    check("Z6: a note p1 saved while no GM was connected was kept on p1's browser, and reached the primary GM who came next",
        keptZ6.gms === 0 && keptZ6.saved === "kept" && noteZ6.gm3 === "E05 61 Z6 kept note" && noteZ6.p1.unsent === false
        && noteZ6.p1.text === "E05 61 Z6 kept note", J(noteZ6), { flow: "pre-session-note" });
    /* Z3-Z4 (E04's fix round): the file is restored by ANOTHER GM with an empty browser, gma, whose
       id sorts after gm3's, so gm3 stays the primary with its warning up. Its rows arrive by merge:
       its check runs again on the change and the panel's line goes (the review's C-m15, until then
       up until a reload). And the GM who restored sends every player their copies again (S-m3 =
       C-m7): the door, the offers and the fog, read off the packets. */
    await connect("gma");
    await settle(1500);
    const fromZ = socketTraffic.length;
    const restored = await gma.eval(`const result = await game.drpg.restoreCase(${J(backup.text)});
        return { refused: result?.refused ?? null, primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm() };`);
    await settle(1500);
    const afterZ = await gm3.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const report = await game.drpg.gmStoreHealth();
        return { warning: Boolean(S.caseWarning()), missing: report.rows.filter(r => r.level === "missing").map(r => r.id),
            bullets: report.counts.bullets, traces: report.counts.traces };`);
    const keysOnGm3 = await gm3.eval(keyOf(made));
    const tracesOnGm3 = await gm3.eval(traceRows(idsZ));
    // The restore runs the Faint pass again: the third bullet's Faint moves off its item into its row.
    const answerKeys = rows => rows.map(r => r.slice(0, 5));
    check("Z3: a second empty browser restores the file; the primary's answer keys and traces come back by merge, the Faint pass moves the old flag in, and its check - and the panel's warning - clear without a reload",
        !restored.refused && !restored.primary && J(answerKeys(keysOnGm3)) === J(answerKeys(expected)) && keysOnGm3[2][5] === true
        && J(tracesOnGm3) === J(expectZ) && J(afterZ.missing) === J([]) && !afterZ.warning
        && afterZ.bullets.missing === 0 && afterZ.bullets.noAnswer === 0 && afterZ.traces.missing === 0,
        J({ restored, afterZ, keysOnGm3, tracesOnGm3 }));
    const toldZ = socketTraffic.slice(fromZ).filter(t => t.from === "gma" && !String(t.action ?? "").startsWith("gms."));
    const toEach = action => [IDS.p1, IDS.p2, IDS.p3].every(id => toldZ.some(t => t.action === action && Array.isArray(t.to) && t.to.includes(id)));
    const doorP1 = await p1.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); return E.readMine("door");`);
    check("Z4: the GM who restored sends every player their copies again - the door, the offers and the fog - and p1 holds the part",
        toEach("mastermind.door") && toEach("advancement.offers") && toEach("fog.rows") && doorP1?.mastermind === true,
        J({ told: toldZ.map(t => [t.action, t.to]), doorP1 }));

    /* Z5, the round-2 review's R2-m3 (26.09): gm3 leaves, so gma - not the primary when it loaded -
       is now; gmb comes back and moves the lair. The primary tells a merge that changes the record
       (the review's B1): on a GM that became the primary later, the first change it merged was
       only its baseline, and it told nobody. Read off the packets gma sends p1. */
    await disconnect("gm3");
    await settle(300);
    await connect("gmb", { storage: await storageOf("gmb") });
    await settle(1500);
    const fromZ5 = socketTraffic.length;
    await gmb.eval(`${MM} await M.setMastermindLair("Z5 lair"); return true;`);
    await settle(1500);
    const gmaTold = socketTraffic.slice(fromZ5).filter(t => t.from === "gma" && t.action === "mastermind.door" && Array.isArray(t.to) && t.to.includes(IDS.p1)).length;
    const doorZ5 = await p1.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); return E.readMine("door");`);
    check("Z5: a GM that became the primary after it loaded tells the Mastermind's player a lair another GM moved",
        gmaTold >= 1 && doorZ5?.mastermind === true && doorZ5?.room === "Z5 lair", J({ gmaTold, doorZ5 }));

    /* -------------- M. the answer keys held past the bound (fix round 10) -------------- */

    /* gma is the primary since Z5. Its bullets store is held unhydrated by replacing the
       handle's two answers on its client - the stores' own exchange always ends at its
       clock, so only an open that failed or hangs leaves them so, and neither can be made
       from the storage a client is given (the engine's case is R189). Last, so the fixtures
       and the tokens moved here reach no other phase. */
    phase("M: an Analyze and a handover on a GM whose answer keys are not open are refused within the bound, and the price comes back", { flow: "truth-bullets" });
    const BS = `const S = await import("${repoUrl}/scripts/gm-stores.mjs");`;
    const fixturesM = await gma.eval(`const actor = game.actors.get("${IDS.aiko}");
        await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 1500, y: 300 });
        const made = {};
        for (const [k, realType] of [["held", "prep"], ["late", "prep"]]) {
            const item = await game.drpg.createTruthBullet(actor, { name: "M bullet " + k, realType, visibility: "evident",
                playerText: "Seen.", analyzedText: "Read " + k, remnantId: "MTRACE" + k, sceneId: "${IDS.scene}", sourceAction: "prep", tiedToCrime: false });
            made[k] = { id: item.id, uuid: item.uuid };
        }
        const [none] = await actor.createEmbeddedDocuments("Item", [{ name: "M bullet with no key", type: "loot",
            flags: { "${MOD}": { category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "evident", analyzed: false } } }]);
        made.none = { id: none.id, uuid: none.uuid };
        const { TIMING } = await import("${repoUrl}/scripts/config.mjs");
        return { made, bound: TIMING.gmStoreOpenMs ?? null, chapter: game.drpg.getClock().chapter };`, { timeout: 60000 });
    const boundM = fixturesM.bound ?? 16000;
    const actionsTo3 = () => gma.eval(`await game.actors.get("${IDS.aiko}").update({ "system.resources.actions.value": 3 }); return true;`);
    const holdM = release => gma.eval(`${BS} globalThis.__mReal ??= { w: S.bulletStore.whenHydrated, i: S.bulletStore.isHydrated };
        S.bulletStore.isHydrated = () => false;
        S.bulletStore.whenHydrated = () => new Promise(r => { globalThis.__mRelease = r; ${release ? `setTimeout(() => r("answered"), ${release});` : ""} });
        globalThis.__notifications.length = 0; return true;`);
    const unholdM = () => gma.eval(`${BS} if (globalThis.__mReal) { S.bulletStore.whenHydrated = globalThis.__mReal.w; S.bulletStore.isHydrated = globalThis.__mReal.i; }
        globalThis.__mRelease?.("answered"); return true;`);
    const scoredM = key => gma.eval(`const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const item = fromUuidSync(${J(fixturesM.made[key].uuid)});
        return { flags: [item?.getFlag("${MOD}", "shownType") ?? null, item?.getFlag("${MOD}", "analyzed") ?? null, item?.getFlag("${MOD}", "lockedChapter") ?? null],
            chapter: B.secretOf(${J(fixturesM.made[key].uuid)}).analysedChapter ?? null,
            copies: game.actors.get("${IDS.botan}").items.filter(i => i.name === "M bullet ${key}").length };`);
    // p1 throws an Analyze at a bullet (and, with `share`, hands the same bullet to Botan), and waits for what is said.
    const throwM = (key, { share = false, until = 0 } = {}) => p1.eval(`const actor = game.actors.get("${IDS.aiko}");
        const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        globalThis.__notifications.length = 0;
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        const whyOf = code => game.i18n.localize("DRPG.Bridge.why." + code);
        const left0 = game.drpg.actionsLeft(actor), t0 = Date.now(), out = { analyzed: null, shared: null };
        game.drpg.performAction(actor, "analyze", { bulletId: ${J(fixturesM.made[key].id)} }).then(() => { out.analyzed = Date.now() - t0; }, e => { out.analyzed = "threw " + e; });
        if (${share}) B.requestShareBullet({ fromId: "${IDS.aiko}", toId: "${IDS.botan}", itemId: ${J(fixturesM.made[key].id)} });
        const refusal = what => globalThis.__notifications.find(n => n.msg.includes(whyOf("keysNotOpen")) && n.msg.includes(game.i18n.localize("DRPG.Bridge.what." + what)));
        const deadline = t0 + ${until};
        while (Date.now() < deadline && (out.analyzed === null || (${share} && !refusal("handover.bullet")))) await new Promise(r => setTimeout(r, 250));
        if (${share} && refusal("handover.bullet")) out.shared = refusal("handover.bullet").at - t0;
        await new Promise(r => setTimeout(r, 1500));
        return { ...out, left0, left: game.drpg.actionsLeft(actor),
            keysNotOpen: globalThis.__notifications.filter(n => n.msg.includes(whyOf("keysNotOpen"))).length,
            keyMissing: globalThis.__notifications.filter(n => n.msg.includes(whyOf("answerKeyMissing"))).length,
            said: globalThis.__notifications.map(n => n.msg.slice(0, 160)) };`, { timeout: until + 60000 });

    await actionsTo3();
    await holdM(0);
    await settle(400);
    const heldM = await throwM("held", { share: true, until: boundM + 8000 });
    const heldScored = await scoredM("held");
    const toldGma = await gma.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        const notice = game.i18n.format("DRPG.GmStore.notOpen", { seconds: Math.round(${boundM} / 1000) });
        return { notices: globalThis.__notifications.filter(n => n.msg === notice).length,
            refusals: U.sessionFailures().filter(e => /^Refused a "(analyze\\.resolve|handover\\.bullet)" request .*: the answer keys are not open on this GM's browser\\.$/.test(e.message)).length };`);
    await unholdM();
    await settle(1500);
    check("M1: an Analyze on a GM whose answer keys are held past the bound is refused within it, with its reason, the price handed back, and nothing scored",
        Number.isFinite(heldM.analyzed) && heldM.analyzed >= boundM - 1000 && heldM.analyzed <= boundM + 6000 && heldM.keysNotOpen >= 1
        && heldM.left0 === 3 && heldM.left === 3 && J(heldScored.flags) === J(["neutral", false, null]) && heldScored.chapter === null,
        J({ boundM, heldM, heldScored }));
    check("M2: a handover of the same bullet is refused through the bridge in the same bound, with the same reason, and no copy is made",
        Number.isFinite(heldM.shared) && heldM.shared <= boundM + 6000 && heldM.keysNotOpen === 2 && heldScored.copies === 0,
        J({ shared: heldM.shared, keysNotOpen: heldM.keysNotOpen, copies: heldScored.copies }));
    check("M3: the GM is told once that its stores have not opened, for two refusals it logged", toldGma.notices === 1 && toldGma.refusals === 2, J(toldGma));

    /* The ordinary road: a hydration that comes three seconds after the throw, inside the bound, is waited for, and the throw scored. */
    await actionsTo3();
    await holdM(3000);
    await settle(400);
    const lateM = await throwM("late", { until: boundM + 8000 });
    const lateScored = await scoredM("late");
    await unholdM();
    check("M4: an Analyze waits for a hydration that comes late but within the bound, and is scored and paid for",
        Number.isFinite(lateM.analyzed) && lateM.analyzed >= 2500 && lateM.analyzed < boundM && lateM.keysNotOpen === 0
        && lateM.left0 === 3 && lateM.left === 2 && lateScored.chapter === fixturesM.chapter,
        J({ lateM, lateScored, chapter: fixturesM.chapter }));

    /* And the missing key's refusal hands the price back the same way (it did not on 05ac984). */
    await actionsTo3();
    await settle(400);
    const noneM = await throwM("none", { until: 20000 });
    check("M5: an Analyze of a bullet with no answer key hands its price back as well",
        Number.isFinite(noneM.analyzed) && noneM.keyMissing === 1 && noneM.left0 === 3 && noneM.left === 3, J(noneM));
    await gma.eval(`const actor = game.actors.get("${IDS.aiko}");
        for (const k of ["held", "late", "none"]) await actor.items.get(${J(fixturesM.made)}[k].id)?.delete();
        await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 300, y: 300 });
        return true;`, { timeout: 60000 });

    /* ------- N. an owner's ask for their crossings, answered from the other GMs' rows ------- */

    /* E05 fix r1-G3, 27.09.2026; review M1. An owner asks the primary for their characters'
       crossings at load and when a primary's world has loaded (`drpgPrimaryReady`, sent from the
       ready hook that opens the stores without waiting for them); the primary answered once the
       suite let the stores go, from its own browser's rows. gma, the primary, holds its crossings
       store unhydrated as M holds its bullets, in an Eclipse opened by its clock flag; p1 asks,
       and nothing is sent while held. The row another GM counted arrives, the hold ends, and p1's
       copy reads it. Red on ced3cad: the answer went out at once, and the copy read no crossing. */
    phase("N: an owner's ask for their crossings is answered from the rows the other GMs hold", { flow: "eclipse-route-veto" });
    const XS = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const X = await import("${repoUrl}/scripts/eclipse.mjs");`;
    const clockN = await gma.eval(`${XS} const c = game.drpg.getClock();
        await game.drpg.setClock({ timeOfDay: "morning", eclipse: true, eclipseStartedAt: Date.now() });
        globalThis.__nReal = S.eclipseMoveStore.whenHydrated;
        S.eclipseMoveStore.whenHydrated = () => new Promise(r => { globalThis.__nRelease = r; });
        return { was: { timeOfDay: c.timeOfDay, timeOfDayStartedAt: c.timeOfDayStartedAt }, id: X.eclipseId(), primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm() };`);
    await settle(900);
    const fromN = socketTraffic.length;
    const sentN = () => socketTraffic.slice(fromN).filter(t => t.from === "gma" && t.action === "eclipse.moves" && Array.isArray(t.to) && t.to.includes(IDS.p1)).length;
    await p1.eval(`game.socket.emit("module.${MOD}", { action: "eclipse.movesAsk" }, { recipients: ["${GMA}"] }); return true;`);
    await settle(1500);
    const heldN = sentN();
    await gma.eval(`${XS} await S.eclipseMoveStore.patch("${IDS.aiko}", { used: 1, eclipse: ${J(clockN.id)} });
        S.eclipseMoveStore.whenHydrated = globalThis.__nReal; globalThis.__nRelease?.("answered"); return true;`);
    await settle(1500);
    const copyN = await p1.eval(`${XS} return S.eclipseMoveCopy.read()?.["${IDS.aiko}"] ?? null;`);
    check("N1: the primary answers an owner's ask for their crossings only once its store holds the other GMs' rows, and the owner's copy reads them",
        clockN.primary === true && Boolean(clockN.id) && heldN === 0 && sentN() >= 1 && copyN?.used === 1 && copyN?.eclipse === clockN.id,
        J({ clockN, heldN, sent: sentN(), copyN }));
    await gma.eval(`${XS} if (globalThis.__nReal) S.eclipseMoveStore.whenHydrated = globalThis.__nReal; await S.eclipseMoveStore.drop("${IDS.aiko}");
        await game.drpg.setClock({ eclipse: false, ...${J(clockN.was)} }); return true;`);

    /* E05 fix r1-G4, 27.09.2026; review M1, the note half. A player asks the primary for their own
       note at load and at `drpgPrimaryReady`, sent from the ready hook that opens the stores without
       waiting for them; the primary answered once the suite let the stores go, from its own
       browser's rows. gma, the primary, holds its notes store unhydrated as N holds its crossings;
       p1 asks, and nothing is sent while held. gmb writes p1's note into its own store (no copy
       sent: a patch, not a Save), the hold ends, and p1's copy reads gmb's words. Red on 7c846b2:
       the answer went out at once. */
    phase("O: a player's note is answered from the GMs' rows, and a note kept offline reaches a GM heard connecting before it loaded", { flow: "pre-session-note" });
    const NS = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const N = await import("${repoUrl}/scripts/pre-session-note.mjs");`;
    const primaryO = await gma.eval(`${NS} globalThis.__oReal = S.noteStore.whenHydrated;
        S.noteStore.whenHydrated = () => new Promise(r => { globalThis.__oRelease = r; });
        return (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm();`);
    const fromO = socketTraffic.length;
    const sentO = () => socketTraffic.slice(fromO).filter(t => t.from === "gma" && t.action === "note.copy" && Array.isArray(t.to) && t.to.includes(IDS.p1)).length;
    await p1.eval(`game.socket.emit("module.${MOD}", { action: "note.ask" }, { recipients: ["${GMA}"] }); return true;`);
    await settle(1500);
    const heldO = sentO();
    await gmb.eval(`${NS} await S.noteStore.patch("${IDS.p1}", { text: "E05 61 O1 gmb's note", updatedAt: Date.now(), byGm: true }); return true;`);
    await settle(1500);
    await gma.eval(`${NS} S.noteStore.whenHydrated = globalThis.__oReal; globalThis.__oRelease?.("answered"); return true;`);
    await settle(1500);
    const copyO = await p1.eval(`${NS} return { text: N.noteFor(game.user.id), unsent: N.noteUnsent() };`);
    check("O1: the primary answers a player's ask for their note only once its store holds the other GMs' rows, and the copy reads them",
        primaryO === true && heldO === 0 && sentO() >= 1 && copyO.text === "E05 61 O1 gmb's note" && copyO.unsent === false,
        J({ primaryO, heldO, sent: sentO(), copyO }), { flow: "pre-session-note" });

    /* O2 (E05 fix r1-G4; C6's open question): Z6 measured a note kept offline reaching a GM whose world
       said it had loaded (`bridge.gmReady`) before p1 heard it connect - the harness's own order. Here
       the other: every GM leaves, p1 keeps a note, and gma comes back announced first (cluster.mjs
       `connect`'s `announceFirst`), so p1 hears `userConnected` while gma's world is still loading and
       `drpgPrimaryReady` after. p1 records the order it heard them in; the note must reach gma. Which
       order v14 takes is LIVE-E04-12. And p1's Note tab, open all along, says so without a redraw
       (review M5: it said "Kept here until a GM connects." until the next one). */
    await gma.eval(`if (globalThis.__oReal) (await import("${repoUrl}/scripts/gm-stores.mjs")).noteStore.whenHydrated = globalThis.__oReal; return true;`);
    await disconnect("gmb");
    await disconnect("gma");
    await settle(300);
    const keptO2 = await p1.eval(`${NS} const U = await import("${repoUrl}/scripts/utils.mjs");
        globalThis.__o2heard = [];
        Hooks.on("userConnected", (user, on) => { if (on && user?.id === "${GMA}") globalThis.__o2heard.push("connected"); });
        Hooks.on("drpgPrimaryReady", id => { if (id === "${GMA}") globalThis.__o2heard.push("ready"); });
        return { gms: U.activeGmIds().length, saved: await N.saveNote(game.user.id, "E05 61 O2 kept note") };`, { timeout: 30000 });
    const TAB = `const M = await import("${repoUrl}/scripts/messenger-app.mjs");
        const shown = () => globalThis.__o2tab?.element?.querySelector(".drpg-messenger-note-status")?.textContent ?? null;`;
    const tabO2 = await p1.eval(`${TAB} const app = new M.DrpgMessengerApp(game.user.id);
        M.DrpgMessengerApp.instances.set(game.user.id, app); app.tab = "note"; await app.render({ force: true });
        globalThis.__o2tab = app; return { status: shown(), kept: game.i18n.localize("DRPG.Note.keptUntilGm") };`);
    await connect("gma", { storage: await storageOf("gma"), announceFirst: true });
    await settle(2500);
    const noteO2 = { kept: keptO2, tab: tabO2, gma: await gma.eval(`${NS} return N.noteFor("${IDS.p1}");`),
        p1: await p1.eval(`${NS} ${TAB} const out = { heard: globalThis.__o2heard, unsent: N.noteUnsent(), text: N.noteFor(game.user.id),
            status: shown(), statusNow: N.noteStatus(game.user.id) };
            await globalThis.__o2tab?.close(); return out;`) };
    check("O2: a note p1 kept with no GM connected reaches the primary GM p1 heard connect before its world had loaded",
        keptO2.gms === 0 && keptO2.saved === "kept" && J(noteO2.p1.heard) === J(["connected", "ready"])
        && noteO2.gma === "E05 61 O2 kept note" && noteO2.p1.unsent === false && noteO2.p1.text === "E05 61 O2 kept note",
        J(noteO2), { flow: "pre-session-note" });
    check("O3: p1's open Note tab said the note was kept here, and once it reached the GM says what the note's status is, with no redraw",
        noteO2.tab.status === noteO2.tab.kept && !noteO2.tab.kept.startsWith("DRPG.")
        && noteO2.p1.status === noteO2.p1.statusNow && noteO2.p1.status !== noteO2.tab.kept, J(noteO2), { flow: "pre-session-note" });

    /* E05 fix r2-G2, 27.09.2026; review F5. The owed Despair is a GM store - each GM's browser
       holds its own rows - and the pools it is paid from are world data. Q1: gma converts from its
       own pool and leaves; gmb, alone and so the primary, converts from the same pool without
       having heard of it; gma comes back and both GMs hold both debts. Q2: gmb leaves holding both
       rows; gma moves the time of day and the pool pays once; gma leaves, and gmb, back alone with
       the rows its browser still holds, pays nothing again. Red on 1072bbb: Q1 read 2 owed on both
       GMs (one row per pool, the newer write kept), Q2 paid on gmb's return a second time. */
    phase("Q: two GMs' conversions from one pool are both owed, and a GM back alone does not pay them again", { flow: "gm-store" });
    const DS = `const D = await import("${repoUrl}/scripts/despair.mjs");
        const noHope = () => import("${repoUrl}/scripts/resource-guard.mjs").then(m => m.automatedUpdate(game.actors.get("${IDS.botan}"), { "system.resources.hope.value": 0 }));
        const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    const readQ = `return { pool: D.getDespair("${GMA}"), owed: D.owedOf("${GMA}"), primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm() };`;
    const q1a = await gma.eval(`${DS} await D.setDespair("${GMA}", 10); await noHope();
        return { granted: await D.convertDespairToHope("${GMA}", game.actors.get("${IDS.botan}"), 1), owed: D.owedOf("${GMA}") };`);
    await disconnect("gma");
    await connect("gmb", { storage: await storageOf("gmb") });
    await settle(1500);
    const q1b = await gmb.eval(`${DS} await noHope();
        return { heard: D.owedOf("${GMA}"), granted: await D.convertDespairToHope("${GMA}", game.actors.get("${IDS.botan}"), 2), owed: D.owedOf("${GMA}") };`);
    await connect("gma", { storage: await storageOf("gma") });
    await settle(2500);
    const q1 = { q1a, q1b, gma: await gma.eval(`${DS} await until(() => D.owedOf("${GMA}") === 3); ${readQ}`),
        gmb: await gmb.eval(`${DS} await until(() => D.owedOf("${GMA}") === 3); ${readQ}`) };
    check("Q1: two GMs converting from one pool, neither having heard the other, both hold both debts",
        q1a.granted === 1 && q1b.heard === 0 && q1b.granted === 2 && q1.gma.owed === 3 && q1.gmb.owed === 3 && q1.gma.pool === 10,
        J(q1), { flow: "gm-store" });

    await disconnect("gmb");
    await settle(500);
    const q2a = await gma.eval(`${DS} const { TIMES_OF_DAY } = await import("${repoUrl}/scripts/config.mjs"); const c = game.drpg.getClock();
        await game.drpg.setClock({ timeOfDay: TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(c.timeOfDay) + 1) % TIMES_OF_DAY.length] });
        await until(() => D.owedOf("${GMA}") === 0); ${readQ}`);
    await disconnect("gma");
    await connect("gmb", { storage: await storageOf("gmb") });
    await settle(2500);
    const q2b = await gmb.eval(`${DS} await until(() => D.owedOf("${GMA}") === 0); ${readQ}`);
    check("Q2: the time of day's change pays the pool once, and a GM back alone with the rows its browser held pays nothing again",
        q2a.primary === true && q2a.pool === 7 && q2a.owed === 0 && q2b.primary === true && q2b.pool === 7 && q2b.owed === 0,
        J({ q2a, q2b }), { flow: "gm-store" });

    /* E05 fix r2-G3, 27.09.2026; review S2-m5. A kept death reaches a player's copy when it is
       made, and its tombstone only whoever is connected when it is dropped; the ask at load was
       answered with the deaths the user may know, and nothing when there were none - so a death
       revived while its owner's browser was closed stayed in that browser. p4 is given Daichi,
       Daichi is killed and kept, p4 leaves, gmb (alone, the primary) revives him, and p4 comes
       back with its browser. Red on 8c6dfd6: p4 read Daichi dead after its return. */
    phase("R: a death taken back while its owner's browser was closed leaves that browser's copy", { flow: "gm-store" });
    const P4 = "USERP4000000000A";
    const CH = `const C = await import("${repoUrl}/scripts/chapter.mjs"); const d = game.actors.get("${IDS.daichi}");`;
    const untilP = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    await connect("p4");
    await settle(800);
    const r1 = await gmb.eval(`${CH} await d.update({ "ownership.${P4}": 3 });
        return { primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm(), kept: Boolean(await C.killCharacter(d, { secret: true, keepBullets: true })) };`);
    const r1p = await p4.eval(`${untilP} const d = game.actors.get("${IDS.daichi}"); await until(() => game.drpg.isDeadForGm(d));
        return { dead: game.drpg.isDeadForGm(d), flag: game.drpg.isDeceased(d) };`);
    await disconnect("p4");
    await settle(300);
    await gmb.eval(`${CH} await C.reviveCharacter(d, { quiet: true }); return true;`);
    // Heard connecting before its world has loaded, as a browser's socket is: an ask from a user
    // the GM does not yet see active is not answered (murder.mjs `onDeathsSocket`).
    await connect("p4", { storage: await storageOf("p4"), announceFirst: true });
    await settle(1500);
    const r2p = await p4.eval(`${untilP} const d = game.actors.get("${IDS.daichi}"); await until(() => !game.drpg.isDeadForGm(d));
        return { dead: game.drpg.isDeadForGm(d), copy: Object.keys((await import("${repoUrl}/scripts/gm-store.mjs")).readMine("deaths") ?? {}) };`);
    await gmb.eval(`${CH} await d.update({ "ownership.${P4}": 0 }); return true;`);
    check("R1: a kept death revived while its owner's browser was closed is let go by that browser when it comes back",
        r1.primary === true && r1.kept && r1p.dead === true && r1p.flag === false && r2p.dead === false && r2p.copy.length === 0,
        J({ r1, r1p, r2p }), { flow: "gm-store" });

    /* E05 fix r2-G3, 27.09.2026; F0b's note. A loot of a body nobody has found owes its taker a Truth
       Bullet, kept in the death's row until the publication, and the row's `loot` was one list: each
       loot rewrote it whole, and the store keeps the newer write of a field. gma kills Daichi and keeps
       it, with two things on the body; gmb leaves and gma serves Aiko's loot; gma leaves and gmb, back
       alone, serves Chie's without having heard of it; gma comes back. Both GMs must owe both loots, and
       gmb's publication give each taker the bullet of what they took. Red on 8c6dfd6: both GMs held
       one loot, and one taker got nothing. */
    phase("S: two GMs' loots of one body nobody has found are both owed and both given", { flow: "give-take-stash" });
    const LOOT = `${CH} const H = await import("${repoUrl}/scripts/handover.mjs"); const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const owed = () => { const l = S.deathStore.get(d.id)?.loot; return (Array.isArray(l) ? l : Object.values(l ?? {})).map(x => x.item).sort(); };`;
    const ITEMS = ["E05 61 S a lamp", "E05 61 S a cord"];
    await connect("gma", { storage: await storageOf("gma") });
    await settle(2500);
    const s0 = await gma.eval(`${LOOT} const { grantItem } = await import("${repoUrl}/scripts/inventory.mjs");
        const kept = Boolean(await C.killCharacter(d, { secret: true, keepBullets: true }));
        for (const name of ${J(ITEMS)}) await grantItem(d, { name, category: "tool", tier: 1, override: true, quiet: true });
        return { kept, items: d.items.filter(i => i.name.startsWith("E05 61 S")).map(i => i.name).sort() };`);
    await settle(1500);
    await disconnect("gmb");
    await settle(500);
    const s1 = await gma.eval(`${LOOT} const item = d.items.find(i => i.name === "${ITEMS[0]}");
        return { took: Boolean(await H.lootBody({ takerId: "${IDS.aiko}", bodyId: d.id, itemId: item?.id })), owed: owed() };`);
    await disconnect("gma");
    await connect("gmb", { storage: await storageOf("gmb") });
    await settle(1500);
    const s2 = await gmb.eval(`${LOOT} const heard = owed(); const item = d.items.find(i => i.name === "${ITEMS[1]}");
        return { heard, took: Boolean(await H.lootBody({ takerId: "${IDS.chie}", bodyId: d.id, itemId: item?.id })), owed: owed() };`);
    await connect("gma", { storage: await storageOf("gma") });
    await settle(2500);
    const lootBullets = `const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const minted = id => game.actors.get(id).items.filter(i => B.isTruthBullet(i) && ${J(ITEMS)}.some(n => i.name.includes(n))).map(i => i.name);`;
    const s3 = { gma: await gma.eval(`${LOOT} ${untilP} await until(() => owed().length === 2); return owed();`),
        gmb: await gmb.eval(`${LOOT} ${untilP} await until(() => owed().length === 2); return owed();`) };
    const s4 = await gmb.eval(`${LOOT} ${lootBullets} const record = await C.publishDeath(d); await new Promise(r => setTimeout(r, 800));
        const out = { published: Boolean(record) && C.isDeceased(d), aiko: minted("${IDS.aiko}"), chie: minted("${IDS.chie}") };
        for (const id of ["${IDS.aiko}", "${IDS.chie}"]) for (const i of game.actors.get(id).items.filter(i => ${J(ITEMS)}.some(n => i.name.includes(n)))) await i.delete();
        const row = S.lootTraceStore.get(d.id);
        const trace = row?.tokenId ? game.scenes.get(row.sceneId)?.tokens?.get(row.tokenId) ?? null : null;
        if (trace) { try { await (await import("${repoUrl}/scripts/remnants.mjs")).dropRemnantSecret(trace); } catch {} await trace.delete(); }
        if (S.lootTraceStore.has(d.id)) await S.lootTraceStore.drop(d.id);
        await C.reviveCharacter(d, { quiet: true });
        return out;`, { timeout: 30000 });
    check("S1: two GMs each serving a loot of one body nobody has found, neither having heard the other, both owe both",
        s0.kept && s0.items.length === 2 && s1.took && s2.took && s2.heard.length === 0
        && J(s3.gma) === J([...ITEMS].sort()) && J(s3.gmb) === J([...ITEMS].sort()), J({ s0, s1, s2, s3 }), { flow: "give-take-stash" });
    check("S2: the publication gives each taker the Truth Bullet of what they took",
        s4.published && s4.aiko.length === 1 && s4.aiko[0].includes(ITEMS[0]) && s4.chie.length === 1 && s4.chie[0].includes(ITEMS[1]),
        J(s4), { flow: "give-take-stash" });

    /* T (E32+E07 C12, 02.10.2026; audit S05-38, the owner's D13): the Cleaning Tools a clean-up used
       are a GM store, `usedTools`, a row per killer synced between GMs, since whichever GM runs the
       discovery breaks them. gma, the primary, writes a row for gloves Chie carries put away, as a
       scored clean-up writes it (cleanup.mjs `noteCleaningTool`); gmb must hold it, and a discovery
       there (`destroyCleaningTools`) break the gloves and take the row off both GMs. The gloves are
       taken away after. */
    phase("T: the gloves a clean-up used reach the second GM, and a discovery there breaks them and takes their row off both", { flow: "gm-store" });
    const TOOLS = `const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const CL = await import("${repoUrl}/scripts/cleanup.mjs");
        const { isBroken } = await import("${repoUrl}/scripts/inventory.mjs"); const chie = game.actors.get("${IDS.chie}");`;
    const t1 = await gma.eval(`${TOOLS} const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const { seasonEpoch } = await import("${repoUrl}/scripts/settings.mjs");
        const [item] = await chie.createEmbeddedDocuments("Item", [{ name: "E32 C12 61 T gloves", type: "loot",
            flags: { "${MOD}": { category: "cleaningTool", equipped: false, tier: 1 } } }]);
        await S.usedToolStore?.patch(chie.id, { chapter: getClock().chapter ?? null, epoch: seasonEpoch(), cleaning: [item.id] });
        return { id: item.id, primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm() };`, { timeout: 30000 });
    const t2 = await gmb.eval(`${TOOLS} ${untilP} await until(() => (S.usedToolStore?.get(chie.id)?.cleaning ?? []).includes("${t1.id}"));
        const held = (S.usedToolStore?.get(chie.id)?.cleaning ?? []).includes("${t1.id}");
        const broke = await CL.destroyCleaningTools();
        return { held, broke, row: Boolean(S.usedToolStore?.has(chie.id)) };`, { timeout: 30000 });
    const t3 = await gma.eval(`${TOOLS} ${untilP} await until(() => !S.usedToolStore?.has(chie.id));
        const item = chie.items.get("${t1.id}");
        const out = { row: Boolean(S.usedToolStore?.has(chie.id)), broken: Boolean(item) && isBroken(item) };
        await item?.delete();
        return out;`, { timeout: 30000 });
    check("T1: gloves the primary wrote down as used reach the second GM, its discovery breaks them, and the row leaves both GMs",
        t1.primary === true && t2.held === true && t2.broke.includes("E32 C12 61 T gloves") && t2.row === false && t3.row === false && t3.broken === true,
        J({ t1, t2, t3 }), { flow: "gm-store" });

    return { phases: ["A", "C", "C2", "B", "D", "E", "F", "F9", "G", "I", "H1", "K", "J1", "J2", "J3", "H2", "H3", "J4", "Z", "M", "N", "O", "Q", "R", "S", "T"], gm: IDS.gm };
}
