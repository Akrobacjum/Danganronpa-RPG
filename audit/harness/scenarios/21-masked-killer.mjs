/**
 * A KILLER BEHIND A "?", AS THE VICTIM'S BROWSER HOLDS IT (owner-115 item 1, 14.11.2026).
 * ---------------------------------------------------------------------------
 * The owner, at a real table on 1.2.114: "Morderstwo bezposrednie przy rzucie na tajna tozsamosc - ikona tokenu
 * mordercy u ofiary powinna byc zamieniona na "?". Aktualnie tak nie jest co zdradza tosamosc mordercy." The roll is
 * the killer's opening roll (murder-rules.mjs `resolveKillerOpening`): on Hope or a critical it hides the killer
 * behind a "?" (mask-gm.mjs `opensMask`, `maskKiller`; E69 C8). The mask covered the map token, the voice, the cast
 * copy, the sheet and the first whisper; this scenario reads everything else the victim's browser is sent or draws
 * while the fight runs, and the bystander's beside it.
 *
 * Cast: Chie (p3) kills Aiko (p1); Botan (p2) stands by. Chie's portrait and token picture are given names of their own
 * first (`suite/CHIE...`), since the harness world draws every student with Foundry's mystery man, the mask's own
 * picture, so a leaked picture could not be told from the mask's.
 *
 *   masked   the opening on Hope masks Chie; Aiko's turn (the GM rules a Leave a Clue); Chie's Strike thrown from
 *            p3's tile, drawn on the GM and relayed (`dice.show`); Aiko's turn; Chie's Finishing Blow ruled a miss,
 *            which costs Chie a Sanity the card says. Read on p1 and p2: every card's words they were sent, every
 *            chat document's speaker, author, flags, content, system and rolls, each message drawn as the log draws
 *            it, the notices on the screen and in the history, the Event card, every `dice.show` and the dice
 *            Dice So Nice was asked to play and as whose, and Chie's token on their map. None may carry Chie's id,
 *            her name, either picture, her token's id or p3's user id. p3 and the GM still read her name.
 *            Then the bystander three ways (the owner's widening of 14.11: "to samo powinno byc przy osobach
 *            trzecich"): far away (the read above, Botan in the Cafeteria); next door, the names Listen gives for
 *            Dorm A, where Chie stands (action-listen.mjs `listenName`); and in the room, Botan walking in as the
 *            third, a turn each, the third's own crisis menu opened and read, and the same scan on p2.
 *   reveal   the control (the owner's D6: a direct victim is told who, unless masked): the GM ends the mask as
 *            `mask.reveal` does, Aiko and Chie take a turn each, and p1 now reads Chie's name on the card and holds
 *            her in its cast, the third reads it too and Listen names her - so the reads above can see what they
 *            found absent.
 *
 * Not read (Foundry's limits, mask-gm.mjs's header): the token document keeps its `actorId`, and every browser holds
 * every actor, so a console still reaches the name; the canvas is not drawn here, nor are Daggerheart's own chat header and
 * Dice So Nice's real dice (LIVE-OWN115-01, audit/AUDIT-1.2.42.md 9.2).
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl }) {
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; return true;`);
    const ids = await gm.eval(`return { chie: game.actors.getName("Chie Mori").id, aiko: game.actors.getName("Aiko Hoshino").id,
        botan: game.actors.getName("Botan Kage").id };`);
    const botanAt = await gm.eval(`const t = canvas.scene.tokens.find(t => t.actorId === "${ids.botan}"); return t ? { x: t.x, y: t.y } : null;`);

    phase("setup");
    const before = await gm.eval(`const a = game.actors.get("${ids.chie}");
        const tokens = [];
        for (const s of game.scenes) for (const t of s.tokens) if (t.actorId === a.id) tokens.push({ scene: s.id, id: t.id, src: t.texture.src, x: t.x, y: t.y });
        const was = { img: a.img, proto: a.prototypeToken?.texture?.src ?? null, tokens,
            res: { chie: foundry.utils.deepClone(a.system.resources), aiko: foundry.utils.deepClone(game.actors.get("${ids.aiko}").system.resources) } };
        await a.update({ img: "suite/CHIEPORTRAIT.webp", "prototypeToken.texture.src": "suite/CHIETOKEN.webp" });
        for (const r of tokens) await game.scenes.get(r.scene).tokens.get(r.id).update({ "texture.src": "suite/CHIETOKEN.webp" });
        // Into Aiko's room (Dorm A), so the one who listens at its door has Chie behind it.
        const here = canvas.scene.tokens.find(t => t.actorId === a.id);
        if (here) await here.update({ x: 400, y: 300 }, { teleport: true, movementAction: "displace", animate: false });
        const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.whenHydrated(); await S.maskStore.whenHydrated();
        return was;`, { timeout: 60000 });
    await settle(900);
    const tokenIds = before.tokens.map(t => t.id);

    /* What each player's browser is sent, netted as it arrives: the card words (`secret.card`), the relayed dice
       (`dice.show`) and the cast (`incident.myCast`); and the dice Dice So Nice is asked to play, and as whose. */
    const NET = `globalThis.__maskNet = { words: [], dice: [], casts: [] }; globalThis.__maskDsn = [];
        if (!globalThis.__maskNetOn) {
            globalThis.__maskNetOn = true;
            game.socket.on("module.${MOD}", p => {
                if (p?.action === "secret.card") globalThis.__maskNet.words.push(String(p.html ?? ""));
                if (p?.action === "dice.show") globalThis.__maskNet.dice.push(JSON.stringify(p));
                if (p?.action === "incident.myCast") globalThis.__maskNet.casts.push(JSON.stringify(p));
            });
            if (game.dice3d) {
                const show = game.dice3d.showForRoll;
                game.dice3d.showForRoll = function (roll, user, ...rest) { globalThis.__maskDsn.push(String(user?.id ?? user ?? "")); return show.call(this, roll, user, ...rest); };
            }
        }
        return true;`;
    for (const c of [p1, p2, p3]) await c.eval(NET);

    /* Everything of Chie's this browser holds outside the actor and its token's `actorId` (Foundry's limit, above). */
    const SECRETS = JSON.stringify([ids.chie, "Chie", "CHIEPORTRAIT", "CHIETOKEN", ...tokenIds, p3.userId]);
    const LEAKS = `const secrets = ${SECRETS};
        const found = (where, text) => { for (const s of secrets) if (String(text ?? "").includes(s)) hits.push([where, s]); };
        const hits = [];
        const net = globalThis.__maskNet;
        net.words.forEach((w, i) => found("words#" + i, w));
        net.dice.forEach((d, i) => found("dice.show#" + i, d));
        globalThis.__maskDsn.forEach((u, i) => found("dsn#" + i, u));
        for (const m of game.messages.contents) {
            const d = m.toObject();
            found("doc:" + m.id, JSON.stringify([d.speaker, d.author, d.flags, d.content, d.system, d.rolls, d.title ?? null, d.flavor ?? null]));
            const li = await m.renderHTML();
            found("drawn:" + m.id, li?.outerHTML);
        }
        document.querySelectorAll(".drpg-popup").forEach((n, i) => found("notice#" + i, n.outerHTML));
        const NH = await import("${repoUrl}/scripts/notice-history.mjs");
        found("history", JSON.stringify(NH.noticeEntries()));
        const E = await import("${repoUrl}/scripts/events.mjs"); E.renderEvents();
        found("events", document.getElementById("drpg-events")?.outerHTML);
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const cast = incidentCast();
        found("cast", JSON.stringify([cast.killerId ?? null, cast.killerTurnId ?? null]));
        const tokens = [];
        for (const s of game.scenes) for (const t of s.tokens) if (t.actorId === "${ids.chie}") {
            tokens.push([t.name, t.texture?.src ?? null, Boolean(t.flags?.["${MOD}"]?.masked)]);
            found("token:" + t.id, JSON.stringify([t.name, t.texture?.src, t.flags, t.ring, t.displayName]));
        }
        return { hits: hits.slice(0, 40), n: hits.length, words: net.words.length, dice: net.dice.length, dsn: globalThis.__maskDsn.length, tokens };`;

    /* p3's opening roll is held (scenario 13's way): the GM rules the opening, and the roll p3's browser would throw is
       let go unthrown once it has. */
    const HOLD = `const a = game.actors.get("${ids.chie}"); globalThis.__held = [];
        a.rollTrait = function () { return new Promise(r => globalThis.__held.push(r)); };
        return true;`;
    const RELEASE = `const a = game.actors.get("${ids.chie}"); delete a.rollTrait;
        const held = globalThis.__held ?? []; delete globalThis.__held; for (const r of held) r(null); return held.length;`;

    /* A crisis action from the tile, on the player's browser, as scenario 13 throws one: the crisis menu answered on its
       row, the dice forced. The GM draws it and relays its dice to the incident's audience. */
    const ACT = (actorId, key, faces) => `const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const actor = game.actors.get("${actorId}");
        const menu = game.i18n.localize("DRPG.Murder.yourTurn");
        globalThis.__dialogAnswers.push(cfg => {
            const row = cfg?.window?.title === menu ? cfg.content?.querySelector?.('input[name="variant"][value="${key}"]') : null;
            if (!row) return null;
            row.checked = true;
            return (cfg.buttons ?? []).find(b => b.default)?.callback?.(null, null, { element: cfg.content }) ?? null;
        });
        globalThis.__forceRoll = ${JSON.stringify(faces)};
        try { await A.performAction(actor, "directMurder"); }
        finally { delete globalThis.__forceRoll; globalThis.__dialogAnswers.length = 0; }
        return game.drpg.murderState()?.turnSide ?? null;`;
    /* A crisis action the GM rules, as the tracker's resolver does. */
    const RULE = (actorId, key, total) => `const M = await import("${repoUrl}/scripts/murder.mjs");
        await M.resolveCrisisAction({ actorId: "${actorId}", key: "${key}", total: ${total}, isCritical: false, withHope: true });
        return M.murderState()?.turnSide ?? null;`;
    const FIGHT = async () => {
        const sides = [];
        sides.push(await gm.eval(RULE(ids.aiko, "leaveClue", 1), { timeout: 60000 }));
        await settle(600);
        sides.push(await p3.eval(ACT(ids.chie, "strike", { hope: 9, fear: 5 }), { timeout: 60000 }));
        await settle(900);
        sides.push(await gm.eval(RULE(ids.aiko, "leaveClue", 1), { timeout: 60000 }));
        await settle(600);
        sides.push(await gm.eval(RULE(ids.chie, "finishingBlow", 1), { timeout: 60000 }));
        await settle(900);
        return sides;
    };
    /* The two cards of Chie's of each round as a browser reads them: the Strike's heading with her name, and the Finishing
       Blow's Sanity line - by her name (`sanity`), or to her own player as "You lose" (`you`). */
    const NAMED = `const words = (globalThis.__maskNet?.words ?? []).join("\\n");
        const name = foundry.utils.escapeHTML(game.actors.get("${ids.chie}").name);
        const you = game.i18n.format("DRPG.Murder.youLose", { what: "\u00a7" }).split("\u00a7")[0];
        return { strike: words.includes("Strike - " + name) || words.includes("Strike - <span>" + name), sanity: words.includes(name + " loses"), you: words.includes(you),
            mask: [words.includes("Strike - <span>?</span>"), words.includes("<span>?</span> loses")],
            dsnAsGm: (globalThis.__maskDsn ?? []).length > 0 && (globalThis.__maskDsn ?? []).every(id => game.users.get(id)?.isGM === true) };`;

    phase("masked", { flow: "murder-incident" });
    await p3.eval(HOLD);
    const opened = await gm.eval(`return (await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}", openingTrait: "body" }))?.stage ?? null;`, { timeout: 60000 });
    await settle(600);
    await gm.eval(`await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true }); return true;`, { timeout: 60000 });
    await settle(900);
    const released = await p3.eval(RELEASE);
    const masked = await gm.eval(`return (await import("${repoUrl}/scripts/mask-gm.mjs")).maskStands("${ids.chie}");`);
    check("masked: the opening on Hope hides Chie behind a \"?\" - the GMs hold her mask, and the fight is on with the victim to act",
        opened === "openingRoll" && released === 1 && masked === true
        && await gm.eval(`return game.drpg.murderState()?.stage === "incident" && game.drpg.murderState()?.turnSide === "victim";`),
        JSON.stringify({ opened, released, masked }), { flow: "murder-incident" });
    const sides = await FIGHT();
    const victim = await p1.eval(LEAKS, { timeout: 60000 });
    const bystander = await p2.eval(LEAKS, { timeout: 60000 });
    const insiders = { killer: await p3.eval(NAMED) };
    const victimSaw = await p1.eval(NAMED);
    check("masked: the victim reads \"?\" where the cards named Chie - \"Strike - ?\" and \"? loses ...\" - and her dice play as a GM's",
        JSON.stringify(victimSaw.mask) === JSON.stringify([true, true]) && victimSaw.dsnAsGm && !victimSaw.strike && !victimSaw.sanity,
        JSON.stringify(victimSaw), { flow: "murder-incident" });
    check("masked: the fight went round twice - Aiko, Chie's Strike from p3's tile, Aiko, Chie's Finishing Blow - and the victim was sent its cards and Chie's dice",
        JSON.stringify(sides) === JSON.stringify(["killer", "victim", "killer", "victim"]) && victim.words >= 4 && victim.dice >= 1,
        JSON.stringify({ sides, words: victim.words, dice: victim.dice, dsn: victim.dsn }), { flow: "murder-incident" });
    check("masked: Chie's token on the victim's and the bystander's map is the \"?\" with Foundry's mystery man",
        [victim, bystander].every(r => r.tokens.length === tokenIds.length && r.tokens.every(t => JSON.stringify(t) === JSON.stringify(["?", "icons/svg/mystery-man.svg", true]))),
        JSON.stringify({ victim: victim.tokens, bystander: bystander.tokens }), { flow: "murder-incident" });
    check("masked: nothing the victim's browser was sent or draws names Chie, shows her portrait or token picture, or carries her id, her token's id or p3's - the cards' words, the chat documents, the drawn messages, the notices and their history, the Event card, the relayed dice and whose dice they play as, the cast",
        victim.n === 0, JSON.stringify(victim.hits), { flow: "murder-incident" });
    check("masked: nor the bystander's", bystander.n === 0, JSON.stringify(bystander.hits), { flow: "murder-incident" });
    check("masked: the killer's own browser still reads her name on her Strike's card, and her Sanity's line as her own",
        insiders.killer.strike && insiders.killer.you && !insiders.killer.sanity, JSON.stringify(insiders), { flow: "murder-incident" });

    /* NEXT DOOR (the owner's widening of 14.11: "to samo powinno byc przy osobach trzecich"): who Listen would name in
       Dorm A, read on p2's browser as Listen reads it (action-listen.mjs `occupantsOf` and its names) - Chie stands there. */
    const LISTEN = `const { occupantsOf } = await import("${repoUrl}/scripts/movement.mjs");
        const L = await import("${repoUrl}/scripts/action-listen.mjs");
        const name = typeof L.listenName === "function" ? L.listenName : a => a.name;
        return occupantsOf("Dorm A", game.actors.get("${ids.botan}"), canvas.scene).map(name).sort();`;
    const listened = await p2.eval(LISTEN);
    check("masked: next door, Listen names Aiko and a \"?\" in Dorm A to the bystander, not Chie",
        JSON.stringify(listened) === JSON.stringify(["?", "Aiko Hoshino"]), JSON.stringify(listened), { flow: "murder-incident" });

    /* IN THE ROOM: Botan walks in on the fight (scenario 13's walk-in) and is seated as the third; Aiko and Chie take a
       turn each, and the third's own crisis menu is opened and read, then closed. */
    for (const c of [p1, p2, p3]) await c.eval(NET);
    const walked = await gm.eval(`await game.drpg.thirdPartyEnters(game.actors.get("${ids.botan}")); return game.drpg.murderState()?.thirdId ?? null;`, { timeout: 60000 });
    await settle(900);
    const inRoom = [];
    inRoom.push(await gm.eval(RULE(ids.aiko, "leaveClue", 1), { timeout: 60000 }));
    await settle(600);
    inRoom.push(await gm.eval(RULE(ids.chie, "finishingBlow", 1), { timeout: 60000 }));
    await settle(900);
    const menu = await p2.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        let html = null;
        globalThis.__dialogAnswers.push(cfg => { html = cfg?.content?.outerHTML ?? String(cfg?.content ?? ""); return null; });
        try { await A.performAction(game.actors.get("${ids.botan}"), "directMurder"); } finally { globalThis.__dialogAnswers.length = 0; }
        return html;`, { timeout: 60000 });
    const third = await p2.eval(LEAKS, { timeout: 60000 });
    const thirdSaw = await p2.eval(NAMED);
    const menuHits = JSON.parse(SECRETS).filter(x => String(menu ?? "").includes(x));
    check("masked: in the room, the third who walked in reads \"?\" on the cards, and nothing they were sent or draw - their crisis menu among it - names Chie or carries her pictures or ids",
        walked === ids.botan && JSON.stringify(inRoom) === JSON.stringify(["killer", "victim"]) && Boolean(menu)
        && third.n === 0 && menuHits.length === 0 && thirdSaw.mask[1] === true && !thirdSaw.sanity,
        JSON.stringify({ walked, inRoom, menu: Boolean(menu), menuHits, hits: third.hits, thirdSaw }), { flow: "murder-incident" });

    phase("reveal", { flow: "murder-incident" });
    for (const c of [p1, p2, p3]) await c.eval(NET);
    const revealed = await gm.eval(`const K = await import("${repoUrl}/scripts/mask-gm.mjs"); return (await K.revealMask("${ids.chie}"))?.revealed === true;`, { timeout: 60000 });
    await settle(900);
    const after = [];
    after.push(await gm.eval(RULE(ids.aiko, "leaveClue", 1), { timeout: 60000 }));
    await settle(600);
    after.push(await gm.eval(RULE(ids.chie, "finishingBlow", 1), { timeout: 60000 }));
    await settle(900);
    const shown = await p1.eval(LEAKS, { timeout: 60000 });
    const shownNamed = await p1.eval(NAMED);
    const thirdNamed = await p2.eval(NAMED);
    const listenedAfter = await p2.eval(LISTEN);
    check("reveal: and the third reads her name on the card, and Listen names her in Dorm A",
        thirdNamed.sanity && JSON.stringify(listenedAfter) === JSON.stringify(["Aiko Hoshino", "Chie Mori"]),
        JSON.stringify({ thirdNamed, listenedAfter }), { flow: "murder-incident" });
    check("reveal: once the mask ends the victim is told who again (D6) - her token shows Chie, her cast names her, the Finishing Blow's card names her - so the read above sees what it found absent",
        revealed && JSON.stringify(after) === JSON.stringify(["killer", "victim"]) && shown.n > 0 && shownNamed.sanity
        && shown.tokens.every(t => t[0] !== "?" && t[1] === "suite/CHIETOKEN.webp" && t[2] === false)
        && shown.hits.some(h => h[0] === "cast" && h[1] === ids.chie),
        JSON.stringify({ revealed, after, shownNamed, tokens: shown.tokens, hits: shown.hits.slice(0, 12) }), { flow: "murder-incident" });

    await gm.eval(`const K = await import("${repoUrl}/scripts/mask-gm.mjs");
        if (game.drpg.murderState()?.active) await game.drpg.endMurder({ reason: "suite", followUp: false });
        if (K.maskStands("${ids.chie}")) await K.endMask("${ids.chie}", "suite");
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        const was = ${JSON.stringify(before)};
        for (const id of ["${ids.chie}", "${ids.aiko}"]) if (C.isDeadForGm(game.actors.get(id))) await C.reviveCharacter(game.actors.get(id), { quiet: true });
        const a = game.actors.get("${ids.chie}");
        await a.update({ img: was.img, "prototypeToken.texture.src": was.proto, "system.resources": was.res.chie });
        await game.actors.get("${ids.aiko}").update({ "system.resources": was.res.aiko });
        for (const r of was.tokens) await game.scenes.get(r.scene).tokens.get(r.id)?.update({ "texture.src": r.src, x: r.x, y: r.y }, { teleport: true, movementAction: "displace", animate: false });
        const botan = canvas.scene.tokens.find(t => t.actorId === "${ids.botan}");
        if (botan && Number.isFinite(${JSON.stringify(botanAt?.x ?? null)})) await botan.update({ x: ${botanAt?.x ?? 0}, y: ${botanAt?.y ?? 0} }, { teleport: true, movementAction: "displace", animate: false });
        return true;`, { timeout: 60000 });
    await settle(700);
}
