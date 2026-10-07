/**
 * Other modules' client settings the table plays with, held on every client (E27).
 *
 * Isometric Perspective's welcome window is a CLIENT setting: switching it off in
 * the GM's browser did nothing for the players, who met it on every start. The
 * module holds it off on every client at `setup` and takes its box out of each
 * player's Configure Settings (enforced.mjs). This asks a PLAYER's client, after a
 * boot like any other, what it holds - the suite runs on the GM alone and cannot.
 *
 * AND A GM AWAY (E08+E28 C18, 04.10.2026; the plan's 3.7), last because the GM it drops does
 * not come back - the seeded four cannot connect again (cluster.mjs `connect`) - so the GM who
 * returns is a late account, `gm0`. The suite runs on a GM and cannot drop itself either. With
 * no GM connected: p1's Search is refused before its price (A1); a statistic from p1's sheet is
 * thrown, stamped and moves nothing (A2); and back, the GM gets one card for it and Grant all
 * moves its Hope once (A3).
 * Since fix r2-H6 (05.10.2026; review m2) also: an action's roll that reaches Daggerheart's build
 * with no GM is not thrown (A4); A3's Grant all is a click on the card's button; and a stamped
 * message created while the GM is back pays its Despair at the Grant, once, not at its creation (A5).
 * Since E29 C7 (05.10.2026; the plan's 2.9, 2.10) also: a student's token HUD bars are display-only for
 * its player (H1); and with no GM connected p1's console raises Aiko's Agility and heals one of her
 * Health marks - back, the primary puts Agility back at once and asks about the Health mark on one card,
 * whose own Undo heals it back (S1, S2). The GM who returns comes back with the browser the GM who left
 * held (`storageOf`), as a GM's reload keeps it: the GMs' marks live in their browsers.
 * Since E33 C6 (07.10.2026; that plan's 2.5, whose A4-A6 are G1-G3 here) also: a GM who is here and
 * never answers a draw - p1's Search ends at the draw's 30 s as a closed window (G2); the GM leaving while
 * p1's Search window is open - the draw refused at the build and the price given back (G1, the drop); a
 * statistic clicked with no GM is a reaction, stamped, and Grant all moves nothing for it (G3); and a
 * message with the draw's flags written with no GM is read as nothing by the GM who returns (G4).
 */
export const layers = ["ci"];

export const accounts = [{ who: "gm0", id: "USERGA0000000000", name: "Returning GM", role: 4, character: null, color: "#aa0000", late: true }];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, gm0, p1, p2, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS, repoUrl }) {
    for (const [who, client] of [["p1", p1], ["p2", p2]]) {
        const held = await client.eval(`
            const entry = game.settings.settings.get("isometric-perspective.showWelcome");
            return { value: game.settings.get("isometric-perspective", "showWelcome"),
                     atReady: globalThis.__isoWelcomeAtReady,
                     config: entry?.config, registered: Boolean(entry) };
        `);
        // A precondition of the harness, not a finding: it registers the setting itself.
        check(`${who}: (harness) the welcome setting is registered, as Isometric Perspective does`, held.registered, JSON.stringify(held));
        /* WHAT ISOMETRIC PERSPECTIVE SAW IN ITS OWN `ready` (the review of E27). A value
           held only after that moment still reads false afterwards - and is the window
           opening on the first start after the update. The harness stands in for that
           module's `ready` and records what it read. */
        check(`${who}: the welcome was already held when Isometric Perspective read it at ready`, held.atReady === false, JSON.stringify(held));
        check(`${who}: the welcome window is held closed after boot`, held.value === false, JSON.stringify(held));
        check(`${who}: the player's box for it is out of Configure Settings`, held.config === false, JSON.stringify(held));
    }

    // A change by hand on a player's client is put back.
    await p1.eval(`await game.settings.set("isometric-perspective", "showWelcome", true); return true;`);
    await settle(300);
    const after = await p1.eval(`return game.settings.get("isometric-perspective", "showWelcome");`);
    check("p1: switching the welcome back on by hand does not stick", after === false, String(after));

    await tokenBars({ gm, p1, check, phase, IDS });
    const away = await awayAndBack({ gm, gm0, p1, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS, repoUrl });
    await sheetAtReady({ gm0, p1, check, phase, IDS, repoUrl, away });
}

/**
 * THE TOKEN HUD'S BARS (E29 C7; the owner's Q4 (a)): on a player's browser a student's two bar inputs are
 * display-only while `lockPlayerResources` is on, and on the GM's they are not. The harness has no canvas
 * and draws no token HUD, so the check hands the hook (hud.mjs `stillTokenBars`) a HUD's shape: the app's
 * actor and an element with Daggerheart 2.10.5's two inputs. The Party sheet's pips are CSS, which no
 * client here computes - not checked.
 */
async function tokenBars({ gm, p1, check, phase, IDS }) {
    phase("a student's token HUD bars", { flow: "sheet-audit" });
    const read = `const el = document.createElement("form");
        el.innerHTML = '<div class="attribute bar2"><input type="text" name="bar2" value="2"></div><div class="attribute bar1"><input type="text" name="bar1" value="1"></div>';
        Hooks.callAll("renderTokenHUD", { actor: game.actors.get("${IDS.aiko}") }, el, {}, {});
        return { locked: game.settings.get("${MOD}", "lockPlayerResources"), disabled: [...el.querySelectorAll("input")].map(i => i.disabled) };`;
    const onP1 = await p1.eval(read), onGm = await gm.eval(read);
    check("H1: a student's token HUD bar inputs are display-only for its player with the lock on, and stay editable for the GM",
        onP1.locked === true && J(onP1.disabled) === J([true, true]) && J(onGm.disabled) === J([false, false]), J({ onP1, onGm }), { flow: "sheet-audit" });
}

/** A GM away, and back (E08+E28 C18): the header's A1-A3. */
async function awayAndBack({ gm, gm0, p1, check, phase, settle, connect, disconnect, storageOf, socketTraffic, IDS, repoUrl }) {
    phase("a GM away, and back", { flow: "gm-rolls-total" });
    const AIKO = `const aiko = game.actors.get("${IDS.aiko}");`;
    const UNTIL = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;

    /* G2 (E33 C6, 07.10.2026; its plan's 2.5 calls it A5, a letter fix r2-H6 had already given to a check
       below, so C6's are G1-G4): A GM WHO IS HERE AND NEVER ANSWERS A DRAW. The GM's module socket is put
       aside, as 10-murder puts the players' aside, behind one stand-in: it takes p1's first `roll.draw`,
       says "got it" to it as the GM's judge does once the guards have passed (bridge-guards.mjs `judge`),
       answers nothing, and hands the socket back; every other packet goes on to the GM's own handlers.
       p1's Search pays, opens its roll window and asks for the draw; the answer's clock (roll-draw.mjs
       `DRAW_ANSWER_MS`) ends it as not answered, and the Search closes as a closed window does. That clock
       is a constant of the roller's module, which no console on the GM's page reaches, so this waits its
       real 30 s. A GM that never says "got it" is given up on by the waiter's other clock (`TIMING.ackMs`),
       which R165 drives.
       On 07.10.2026's first run of this check one message nobody named was counted on p1 and on the GM alike
       (made 1, the rest as below); its authors and first words (`news`) are read since. The GM's load-time
       migration is waited for first, as the likeliest source and not a measured one: it is not awaited at
       `ready`, its summary was still printed after this phase began, and one of its clauses whispers to the
       GMs (migrate.mjs `keepOldSafeword`). In the runs read after, it had nothing left to write (waited []). */
    const g2Was = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const early = game.messages.size;
        await (await import("${repoUrl}/scripts/migrate.mjs")).migrationOnLoad();
        await new Promise(r => setTimeout(r, 300));
        const waited = game.messages.contents.slice(early).map(m => String(m.content ?? "").slice(0, 120));
        const list = game.socket._handlers.get("module.${MOD}");
        const g2 = globalThis.__c6g2 = { aside: list.splice(0), seen: [], was: { messages: game.messages.size, records: Object.keys(S.rollStore.entries() ?? {}).length, waited } };
        list.push((packet, senderId) => {
            if (packet?.action === "roll.draw" && g2.seen.length === 0) {
                g2.seen.push(senderId);
                game.socket.emit("module.${MOD}", { action: "bridge.ack", requestId: packet.requestId, userId: senderId }, { recipients: [senderId] });
                list.splice(0, list.length, ...g2.aside);
                return;
            }
            for (const handler of g2.aside) handler(packet, senderId);
        });
        return g2.was;`);
    const g2 = await p1.eval(`${AIKO} const A = await import("${repoUrl}/scripts/actions.mjs");
        const { sayNotDone } = await import("${repoUrl}/scripts/bridge-guards.mjs");
        globalThis.__notifications.length = 0;
        const before = A.actionsLeft(aiko), messages = game.messages.size, seen = [];
        const hook = Hooks.on("updateActor", doc => { if (doc.id === aiko.id) seen.push(A.actionsLeft(aiko)); });
        const t0 = Date.now();
        let answer;
        try {
            answer = await Promise.race([game.drpg.performAction(aiko, "search"), new Promise(r => setTimeout(() => r("still waiting"), 45000))]);
        } finally {
            Hooks.off("updateActor", hook);
        }
        const ms = Date.now() - t0;
        await new Promise(r => setTimeout(r, 500));
        return { answer: answer ?? null, ms, before, after: A.actionsLeft(aiko), seen, made: game.messages.size - messages,
            said: globalThis.__notifications.map(n => n.msg), text: sayNotDone("roll.draw", "noAnswer", { notify: () => null }),
            news: game.messages.contents.slice(messages).map(m => [m.author?.id, String(m.content ?? "").slice(0, 120)]) };`, { timeout: 90000 });
    const g2Gm = await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const g2 = globalThis.__c6g2, list = game.socket._handlers.get("module.${MOD}");
        const back = list.length === g2.aside.length && g2.aside.every((handler, i) => list[i] === handler);
        if (!back) list.splice(0, list.length, ...g2.aside);
        delete globalThis.__c6g2;
        return { seen: g2.seen, back, made: game.messages.size - g2.was.messages, records: Object.keys(S.rollStore.entries() ?? {}).length - g2.was.records };`);
    check("G2: a GM who is here and never answers p1's Search's draw: it ends at the draw's 30 s as not answered, the action paid and given back, no message, p1 told once, nothing on the GM's record",
        g2.answer === null && g2.ms >= 30000 && g2.ms < 40000 && g2.before > 0 && g2.after === g2.before && Math.min(...g2.seen) === g2.before - 1
        && g2.made === 0 && g2.said.filter(s => s === g2.text).length === 1 && J(g2Gm.seen) === J([IDS.p1]) && g2Gm.back
        && g2Gm.made === 0 && g2Gm.records === 0, J({ g2, g2Gm, g2Was }), { flow: "gm-rolls-total" });

    /* Hope below its maximum of 6 and actions to pay with, so "nothing moved" is a reading; and (C7) two Health
       marks, one for p1 to heal - each judged into the GMs' marks before the GM leaves, so they leave in its
       browser. The GM's stores are waited for first: read at this point of a run on 05.10.2026 (e29run/c7a1/probe)
       they had not hydrated yet - no mark held, none in the browser it left with, so the GM who came back filled
       its marks from the sheets as p1 had left them and found nothing. */
    const marked = await gm.eval(`${AIKO} const A = await import("${repoUrl}/scripts/actions.mjs");
        const G = await import("${repoUrl}/scripts/gm-store.mjs"), S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const end = Date.now() + 15000;
        while (!(G.gmStoresHydrated() && S.sheetMarkStore.has(aiko.id)) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await aiko.update({ "system.resources.hope.value": 2, "system.resources.hitPoints.value": Math.min(2, aiko.system.resources.hitPoints.max) });
        await A.setActions(aiko, 3);
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return G.gmStoresHydrated() && S.sheetMarkStore.get(aiko.id)?.resources?.hitPoints?.value === aiko._source.system.resources.hitPoints.value;`);

    /* G1 (E33 C6; its plan's A4): THE GM LEAVES WHILE p1'S SEARCH IS OPEN. p1 starts a Search with the GM
       here, so the action's own gate (A1's) lets it through, and the Search's first window is held open
       until the GM has gone; then it is answered as the harness answers any. The Search pays, throws, and
       the draw is refused at Daggerheart's build (roll-draw.mjs `drawOrThrow`): the price given back as a
       closed window's, no message, so nothing stamped, and p1 told it waits for a GM. H6's A4 below throws
       that build itself, with nothing paid: what it does not read is the price. This is the stage's drop -
       the GM does not come back. */
    const g1Open = await p1.eval(`${AIKO} const A = await import("${repoUrl}/scripts/actions.mjs");
        globalThis.__notifications.length = 0;
        const g1 = globalThis.__c6g1 = { asked: null, before: A.actionsLeft(aiko), messages: game.messages.size, seen: [] };
        const gate = new Promise(resolve => { g1.open = resolve; });
        g1.hook = Hooks.on("updateActor", doc => { if (doc.id === aiko.id) g1.seen.push(A.actionsLeft(aiko)); });
        globalThis.__dialogAnswers.push(async config => {
            g1.asked = config.window?.title ?? "?";
            await gate;
            return foundry.applications.api.DialogV2.wait(config);
        });
        g1.run = game.drpg.performAction(aiko, "search");
        const end = Date.now() + 6000;
        while (g1.asked === null && Date.now() < end) await new Promise(r => setTimeout(r, 50));
        return { asked: g1.asked, before: g1.before, gms: (await import("${repoUrl}/scripts/utils.mjs")).activeGmIds().length };`);
    await disconnect("gm");
    await settle(800);
    const g1 = await p1.eval(`${AIKO} const A = await import("${repoUrl}/scripts/actions.mjs");
        const g1 = globalThis.__c6g1;
        const gms = (await import("${repoUrl}/scripts/utils.mjs")).activeGmIds().length;
        let answer;
        try {
            g1.open?.();
            answer = await Promise.race([g1.run, new Promise(r => setTimeout(() => r("still waiting"), 8000))]);
            await new Promise(r => setTimeout(r, 500));
        } finally {
            Hooks.off("updateActor", g1.hook);
            delete globalThis.__c6g1;
        }
        return { answer: answer ?? null, gms, before: g1.before, after: A.actionsLeft(aiko), seen: g1.seen, made: game.messages.size - g1.messages,
            said: globalThis.__notifications.map(n => n.msg), text: game.i18n.localize("DRPG.Rolls.waitsForGm") };`, { timeout: 30000 });
    check("G1: the GM leaving while p1's Search window is open: the draw is refused at the build, the action paid and given back, nothing made or stamped, and p1 told it waits for a GM",
        g1Open.gms === 1 && typeof g1Open.asked === "string" && g1.gms === 0 && g1.answer === null && g1.before > 0 && g1.after === g1.before
        && Math.min(...g1.seen) === g1.before - 1 && g1.made === 0 && g1.said.filter(s => s === g1.text).length === 1, J({ g1Open, g1 }), { flow: "gm-rolls-total" });

    // A1: the Search, raced against 8 s so a roll waiting on a GM who is not there is a reading too.
    const a1 = await p1.eval(`${AIKO} const A = await import("${repoUrl}/scripts/actions.mjs");
        globalThis.__notifications.length = 0;
        const before = A.actionsLeft(aiko), messages = game.messages.size, writes = [];
        const hook = Hooks.on("updateActor", (doc, change) => { if (doc.id === aiko.id) writes.push(Object.keys(foundry.utils.flattenObject(change)).filter(k => k !== "_id")); });
        let answer;
        try {
            answer = await Promise.race([game.drpg.performAction(aiko, "search"), new Promise(r => setTimeout(() => r("still waiting"), 8000))]);
            await new Promise(r => setTimeout(r, 500));
        } finally {
            Hooks.off("updateActor", hook);
        }
        return { answer: answer ?? null, before, after: A.actionsLeft(aiko), writes, made: game.messages.size - messages,
            said: globalThis.__notifications.map(n => n.msg), text: game.i18n.localize("DRPG.Rolls.waitsForGm") };`, { timeout: 30000 });
    // "Nothing paid" is read as no write to the character at all, not as the count of actions
    // after: Search pays before its roll, and the draw's own refusal (roll-draw.mjs `drawOrThrow`)
    // hands the action back, so without the refusal at the action's start the count came out the
    // same - C18's mutant `c18-action-not-refused` passed this check on that reading (04.10.2026).
    check("A1: with no GM connected, p1's Search is refused before its price: nothing paid, nothing thrown, and p1 is told an action roll waits for a GM",
        a1.answer === null && a1.before > 0 && a1.after === a1.before && a1.writes.length === 0 && a1.made === 0 && a1.said.includes(a1.text), J(a1), { flow: "gm-rolls-total" });

    // A2: a statistic from the sheet, its resources committed afterwards as Daggerheart's
    // character sheet does (character-sheet.mjs:855, 2.10.5) - the harness's `rollTrait` leaves that to its caller.
    // Shift-clicked (character-sheet.mjs:847 hands the click's event on; d20Roll.mjs:70, 2.10.5 - D20Roll's
    // `applyKeybindings`, overriding dhRoll.mjs:219's same rule - sets `dialog.configure` false on a Shift-, Alt- or
    // Ctrl-click, so Daggerheart itself skips the window): since E33 C2b a plain click opens the harness's roll
    // window, where roll-dialog.mjs `forceReaction` makes Aiko's statistic a reaction, and A3's Grant all then moved
    // no Hope (2 -> 2, C2b, 07.10.2026). Before C2b no window opened and the roll was the skipped window's without
    // saying so; A3 reads its Hope moved once.
    const sentFrom = socketTraffic.length;
    const a2 = await p1.eval(`${AIKO} globalThis.__forceRoll = { hope: 9, fear: 4 };
        const hope = aiko.system.resources.hope.value;
        let config = null;
        try { config = await aiko.rollTrait("instinct", { event: { shiftKey: true } }); } finally { delete globalThis.__forceRoll; }
        const owed = config?.resourceUpdates ? [...config.resourceUpdates.keys()] : null;
        await config?.resourceUpdates?.updateResources();
        await new Promise(r => setTimeout(r, 800));
        const message = config?.message ?? null;
        return { id: message?.id ?? null, stamp: message?.flags?.["${MOD}"]?.unwitnessed ?? null, author: message?.author?.id ?? null,
            owed, hope, after: aiko.system.resources.hope.value };`, { timeout: 30000 });
    const sent = socketTraffic.slice(sentFrom).filter(s => s.from === "p1").map(s => s.channel);
    check("A2: with no GM connected, a statistic from p1's sheet is thrown in p1's browser, stamped for the GMs, and moves nothing",
        typeof a2.id === "string" && a2.author === IDS.p1 && a2.stamp?.actorId === IDS.aiko && typeof a2.stamp?.nonce === "string"
        && typeof a2.stamp?.at === "number" && J(a2.owed) === "[]" && a2.after === a2.hope && sent.length === 0, J({ a2, sent }), { flow: "gm-rolls-total" });

    /* G3 (E33 C6; its plan's A6): A STATISTIC CLICKED, NOT SHIFT-CLICKED, WITH NO GM. The click opens the roll
       window (the harness's stand-in since E33 C2b), where roll-dialog.mjs `forceReaction` makes a student's
       statistic from the sheet a reaction; with no GM it is thrown here and stamped (roll-draw.mjs
       `throwUnwitnessed`). Read: the windows drawn, the roll's `options.actionType` as its message keeps it,
       the stamp, and that nothing moved; checked after A3, whose Grant all decides it with A2's and moves
       nothing for it (`grantRolls`: a reaction moves nothing). Its faces are A2's, a 9 and a 4, which as an
       action would have granted a Hope. */
    const g3From = socketTraffic.length;
    const g3 = await p1.eval(`${AIKO} globalThis.__forceRoll = { hope: 9, fear: 4 };
        const hope = aiko.system.resources.hope.value, windows = [];
        const hook = Hooks.on("renderApplicationV2", app => windows.push(app?.constructor?.name ?? "?"));
        let config = null;
        try { config = await aiko.rollTrait("instinct"); } finally { delete globalThis.__forceRoll; Hooks.off("renderApplicationV2", hook); }
        await config?.resourceUpdates?.updateResources();
        await new Promise(r => setTimeout(r, 800));
        const message = config?.message ?? null;
        return { id: message?.id ?? null, stamp: message?.flags?.["${MOD}"]?.unwitnessed ?? null, author: message?.author?.id ?? null,
            kind: message?.rolls?.[0]?.options?.actionType ?? null, windows, hope, after: aiko.system.resources.hope.value };`, { timeout: 30000 });
    const g3Sent = socketTraffic.slice(g3From).filter(s => s.from === "p1").map(s => s.channel);

    /* A4: an action's roll that reaches Daggerheart's build with no GM - a GM who left between the
       action's start and its roll - is not thrown (roll-draw.mjs `drawOrThrow`): no message, and p1 is
       told it waits for a GM. Every action refuses at its start (A1), so nothing reached this refusal
       before fix r2-H6: C18's mutant `c18-draw-not-refused` survived every run. */
    const a4 = await p1.eval(`${AIKO} const { DRPG_ACTION_ROLL } = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__notifications.length = 0;
        const messages = game.messages.size;
        let answer = "unset", threw = null;
        try {
            answer = await game.system.api.dice.DualityRoll.build({ [DRPG_ACTION_ROLL]: true, roll: { trait: "instinct" }, source: { actor: aiko.uuid },
                hooks: ["roll", "Duality"], actionType: "action" });
        } catch (e) { threw = String(e?.message ?? e).slice(0, 200); }
        await new Promise(r => setTimeout(r, 500));
        return { answer: answer ?? null, threw, made: game.messages.size - messages, said: globalThis.__notifications.map(n => n.msg),
            text: game.i18n.localize("DRPG.Rolls.waitsForGm") };`, { timeout: 30000 });
    check("A4: with no GM connected, an action's roll that reaches Daggerheart's build is not thrown: nothing made, and p1 is told it waits for a GM",
        a4.answer === null && a4.threw === null && a4.made === 0 && a4.said.includes(a4.text), J(a4), { flow: "gm-rolls-total" });

    /* G4 (E33 C6; C5a's doubt (d)): A MESSAGE WITH FLAGS ONLY A GM'S BROWSER WRITES, WRITTEN WHILE NO GM IS
       CONNECTED. p1's console writes a duality card of Aiko's with the draw's two flags, Fear over Hope, as
       83's F4 does with a GM there. Nothing judges it as it is created: the primary's `createChatMessage`
       hook (sheet-audit.mjs `onForgedCard`) has no primary to run on. Read on gm0 after A5 below. */
    const g4 = await p1.eval(`${AIKO} const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: 13, evaluated: true, dHope: { total: 4 }, dFear: { total: 9 },
            dice: [{ faces: 12, total: 4, results: [{ result: 4, active: true }] }, { faces: 12, total: 9, results: [{ result: 9, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: aiko }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll }, flags: { "${MOD}": { drawn: true, rollId: "C6NOGMROLL000001" } } });
        return { card: m?.id ?? null, author: m?.author?.id ?? null };`, { timeout: 30000 });

    /* The sheet half (E29 C7): p1's console raises Aiko's Agility by one and heals one Health mark, past its
       own browser's guard, with no GM to judge either. Read back on p1; judged at the GM's return (S1). */
    const sheetAway = await p1.eval(`${AIKO} const src = () => aiko._source.system;
        const was = { agility: src().traits.agility.value, hp: src().resources.hitPoints.value };
        await aiko.update({ "system.traits.agility.value": was.agility + 1, "system.resources.hitPoints.value": was.hp - 1 }, { drpgAutomated: true });
        return { ...was, written: [src().traits.agility.value, src().resources.hitPoints.value] };`, { timeout: 30000 });

    // A3: a GM connects; the primary's card lists the roll, and Grant all - its button clicked, then asked again - moves its Hope once.
    let a3 = null;
    try {
        // With the browser the GM who left closed with (E29 C7): its stores hold the marks the sheet half is judged against.
        await connect("gm0", { storage: await storageOf("gm") });
        await settle(6000);
        a3 = await gm0.eval(`${AIKO} ${UNTIL} const { cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
            const D = await import("${repoUrl}/scripts/roll-draw.mjs");
            const cards = () => game.messages.contents.filter(m => m.author?.id === game.user.id && cardFlag(m, "awayCard"));
            await until(() => cards().length > 0 && Array.isArray(cardFlag(cards()[0], "awayRolls")));
            const listed = cards().map(m => cardFlag(m, "awayRolls"));
            const hope = aiko.system.resources.hope.value;
            // The card as a GM's chat log draws it (roll-draw.mjs \`onRenderUnwitnessed\`), and its Grant all clicked.
            const li = cards()[0] ? await cards()[0].renderHTML() : null;
            const button = li?.querySelector('[data-drpg-away="grant"]') ?? null;
            button?.click();
            await until(() => aiko.system.resources.hope.value !== hope, 4000);
            const again = await D.decideUnwitnessed(listed[0] ?? [], true);
            await new Promise(r => setTimeout(r, 500));
            const message = game.messages.get(${J(a2.id)});
            return { primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm(), listed, hope, after: aiko.system.resources.hope.value,
                button: Boolean(button), buttonsLeft: Boolean(li?.querySelector(".drpg-away-actions")), again: again.length,
                granted: message?.flags?.["${MOD}"]?.unwitnessed?.granted ?? null, author: message?.author?.id ?? null,
                reaction: { granted: game.messages.get(${J(g3.id)})?.flags?.["${MOD}"]?.unwitnessed?.granted ?? null, author: game.messages.get(${J(g3.id)})?.author?.id ?? null } };`, { timeout: 60000 });
    } catch (err) {
        a3 = { error: String(err?.message ?? err) };
    }
    check("A3: back, the GM gets one card listing p1's stamped roll, and Grant all moves its Hope once and makes it the GM's",
        a3?.primary === true && J((a3.listed ?? []).map(ids => [...ids].sort())) === J([[a2.id, g3.id].sort()]) && a3.button && !a3.buttonsLeft && a3.again === 0 && a3.after === a3.hope + 1
        && a3.granted === true && a3.author === "USERGA0000000000", J(a3), { flow: "gm-rolls-total" });
    check("G3: with no GM connected, a statistic clicked on p1's sheet opens its window and is thrown as a reaction, stamped, moving nothing; back, Grant all decides it and moves nothing for it",
        typeof g3.id === "string" && g3.windows.length > 0 && g3.kind === "reaction" && g3.author === IDS.p1 && g3.stamp?.actorId === IDS.aiko
        && typeof g3.stamp?.nonce === "string" && g3.after === g3.hope && g3Sent.length === 0 && (a3?.listed ?? []).flat().includes(g3.id)
        && a3.reaction?.granted === true && a3.reaction.author === "USERGA0000000000" && a3.after === a3.hope + 1, J({ g3, g3Sent, a3 }), { flow: "gm-rolls-total" });

    /* A5: A STAMPED MESSAGE CREATED WHILE A GM IS HERE (fix r2-H6; review m2, C18's `c18-despair-not-aside`).
       A stamp is its roller's word - a roll begun as the GM connected, or one a console wrote - so the
       primary asks about it on a card (roll-draw.mjs `registerUnwitnessedRolls`) and its Despair waits for
       that card (despair-award.mjs): awarded at its creation as well, a Grant paid it twice. p1 writes a
       Fear result of Aiko's, stamped, with "Rolls grant Despair" on and her Monokuma's pool at 0; read on
       gm0: the pool after the creation and after the new card's Grant all is clicked. */
    let a5 = null;
    if (a3?.primary === true) {
        try {
            const set = await gm0.eval(`${AIKO} const { monokumaFor } = await import("${repoUrl}/scripts/assignments.mjs");
                const P = await import("${repoUrl}/scripts/despair.mjs");
                const monokuma = monokumaFor(aiko);
                globalThis.__a5 = { grant: game.settings.get("${MOD}", "despairFromRolls"), monokuma: monokuma?.id ?? null,
                    pool: monokuma ? P.getDespair(monokuma.id) : null, cards: new Set(game.messages.contents.map(m => m.id)) };
                await game.settings.set("${MOD}", "despairFromRolls", true);
                if (monokuma) await P.setDespair(monokuma.id, 0);
                return { monokuma: monokuma?.id ?? null };`, { timeout: 30000 });
            const written = await p1.eval(`${AIKO} const m = await ChatMessage.create({ speaker: { actor: aiko.id }, content: "A5",
                    rolls: [JSON.stringify({ class: "DualityRoll", formula: "1d12 + 1d12", total: 12, dHope: { total: 3 }, dFear: { total: 9 } })],
                    flags: { "${MOD}": { unwitnessed: { nonce: foundry.utils.randomID(), actorId: aiko.id, at: Date.now() } } } });
                return m?.id ?? null;`, { timeout: 30000 });
            a5 = await gm0.eval(`${UNTIL} const { cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
                const P = await import("${repoUrl}/scripts/despair.mjs");
                const { cards: had, monokuma } = globalThis.__a5;
                const pool = () => P.getDespair(monokuma);
                const card = () => game.messages.contents.find(m => !had.has(m.id) && cardFlag(m, "awayCard")
                    && J(cardFlag(m, "awayRolls")) === J([${J(written)}]));
                const J = v => JSON.stringify(v);
                await until(() => card());
                await new Promise(r => setTimeout(r, 500));
                const atCreation = pool();
                const li = card() ? await card().renderHTML() : null;
                li?.querySelector('[data-drpg-away="grant"]')?.click();
                await until(() => pool() !== atCreation, 4000);
                await new Promise(r => setTimeout(r, 500));
                return { card: Boolean(card()), atCreation, afterGrant: pool(), granted: game.messages.get(${J(written)})?.flags?.["${MOD}"]?.unwitnessed?.granted ?? null };`, { timeout: 60000 });
            a5 = { ...set, written, ...a5 };
        } catch (err) {
            a5 = { error: String(err?.message ?? err) };
        } finally {
            await gm0.eval(`const P = await import("${repoUrl}/scripts/despair.mjs");
                const { grant, monokuma, pool, cards } = globalThis.__a5 ?? {};
                delete globalThis.__a5;
                if (monokuma && typeof pool === "number") await P.setDespair(monokuma, pool);
                if (typeof grant === "boolean") await game.settings.set("${MOD}", "despairFromRolls", grant);
                return true;`, { timeout: 30000 }).catch(() => null);
        }
    }
    check("A5: a stamped Fear result written while the GM is here pays no Despair at its creation, and one when its card's Grant all is clicked",
        Boolean(a5?.monokuma) && typeof a5.written === "string" && a5.card === true && a5.atCreation === 0 && a5.afterGrant === 1 && a5.granted === true,
        J(a5), { flow: "gm-rolls-total" });

    /* G4, read on gm0 (doubt (d)): it holds p1's card and reads it as nothing - not drawn, since only a GM's
       message is (private-rolls.mjs `isDrawnRoll`) - and whether a `forged` row or a GMs' card names it is
       in the details: reported, not asserted, as C6 does not change what a returning GM checks. */
    let g4Gm = null;
    try {
        g4Gm = await gm0.eval(`const P = await import("${repoUrl}/scripts/private-rolls.mjs"), S = await import("${repoUrl}/scripts/gm-stores.mjs");
            const { cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
            const id = ${J(g4.card ?? "none")}, m = game.messages.get(id);
            const out = { held: Boolean(m), author: m?.author?.id ?? null, drawn: m ? P.isDrawnRoll(m) : null, forged: m ? P.forgedFlagsOf(m) : null,
                rows: Object.values(S.sheetWriteStore.entries() ?? {}).filter(r => r?.verdict === "forged").length,
                told: game.messages.contents.filter(x => (cardFlag(x, "forgedCard") ?? x.flags?.["${MOD}"]?.forgedCard) === id).length };
            await m?.delete();
            return out;`, { timeout: 30000 });
    } catch (err) {
        g4Gm = { error: String(err?.message ?? err) };
    }
    check("G4: a message with the draw's flags p1 wrote while no GM was connected is held by the GM who returns and read there as nothing - not drawn",
        typeof g4.card === "string" && g4.author === IDS.p1 && g4Gm?.held === true && g4Gm.author === IDS.p1 && g4Gm.drawn === false
        && J(g4Gm.forged) === J([`flags.${MOD}.drawn`, `flags.${MOD}.rollId`]), J({ g4, g4Gm }), { flow: "sheet-audit" });

    for (const [who, client] of [["p1", p1], ["gm0", gm0]]) {
        const errs = await client.eval(`return globalThis.__errors.slice(0, 5);`).catch(err => [String(err?.message ?? err)]);
        check(`${who}: no uncaught errors with a GM away and back`, (errs ?? []).length === 0, J(errs).slice(0, 400), { flow: "gm-rolls-total" });
    }
    return { ...sheetAway, marked };
}

/**
 * A SHEET CHANGED WITH NO GM WATCHING (E29 C7; the plan's 2.9), read after `awayAndBack`: the primary that
 * returned (gm0) compared Aiko with its mark as its stores hydrated. Agility, raised by one, is put back at
 * once on every client, and the Health mark p1 healed stands, the one row of one card of the GMs' (S1); that
 * card's own Undo for the row, clicked as the GM's chat draws it, heals it back, decides the row and says so
 * on the card (S2). At 1.2.67's code nothing was compared: Agility stood and no card came.
 */
async function sheetAtReady({ gm0, p1, check, phase, IDS, repoUrl, away }) {
    phase("a sheet changed with no GM watching", { flow: "sheet-audit" });
    const AIKO = `const aiko = game.actors.get("${IDS.aiko}"); const src = () => aiko._source.system;`;
    const ON_GM = `${AIKO} const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const C = await import("${repoUrl}/scripts/secret.mjs");
        const until = async (test, ms = 8000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };
        const rows = () => Object.entries(S.sheetWriteStore.entries() ?? {}).filter(([, r]) => r?.away && r.actorId === aiko.id);
        const cards = () => game.messages.contents.filter(m => Array.isArray(C.cardFlag(m, "sheetAway")));`;
    let s1 = null, s2 = null;
    try {
        s1 = await gm0.eval(`${ON_GM}
            await until(() => rows().some(([, r]) => r.verdict === "flagged") && cards().length > 0);
            await A.sheetAuditIdle();
            return { primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm(), agility: src().traits.agility.value, hp: src().resources.hitPoints.value,
                rows: rows().map(([id, r]) => ({ id, verdict: r.verdict, change: r.change, card: r.messageId })),
                cards: cards().map(m => ({ id: m.id, asks: C.cardFlag(m, "sheetAway") })) };`, { timeout: 30000 });
        s1.p1 = await p1.eval(`${AIKO} const end = Date.now() + 6000;
            while (src().traits.agility.value !== ${Number(away?.agility)} && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            return src().traits.agility.value;`);
        const flagged = s1.rows.find(r => r.verdict === "flagged");
        s2 = await gm0.eval(`${ON_GM}
            const card = cards()[0];
            const el = document.createElement("li");
            el.innerHTML = '<div class="message-content"><p class="notes" data-drpg-secret>-</p></div>';
            if (card) Hooks.callAll("renderChatMessageHTML", card, el);
            const button = el.querySelector('[data-drpg-audit="undo"][data-drpg-row="${flagged?.id ?? ""}"]');
            button?.click();
            await until(() => src().resources.hitPoints.value === ${Number(away?.hp)} && Boolean(S.sheetWriteStore.get("${flagged?.id ?? ""}")?.decided));
            await A.sheetAuditIdle();
            const words = card ? C.contentOf(card) : "";
            return { button: Boolean(button), all: Boolean(el.querySelector('[data-drpg-audit-all="undo"]')), hp: src().resources.hitPoints.value,
                decided: S.sheetWriteStore.get("${flagged?.id ?? ""}")?.decided ?? null, me: game.user.id,
                undoneLine: words.includes("drpg-audit-undone"), buttonsLeft: words.includes("data-drpg-audit") };`, { timeout: 30000 });
    } catch (err) {
        s1 ??= { error: String(err?.message ?? err) };
        s2 ??= { error: String(err?.message ?? err) };
    }
    const AGI = "system.traits.agility.value", HP = "system.resources.hitPoints.value";
    const put = s1?.rows?.find(r => r.verdict === "putBack"), asked = s1?.rows?.find(r => r.verdict === "flagged");
    check("S1: back, the primary puts back the Agility p1 raised with no GM watching on every client, and asks about the Health mark p1 healed on one card",
        away?.marked === true && away.hp >= 1 && J(away.written) === J([away.agility + 1, away.hp - 1]) && s1?.primary === true && s1.agility === away.agility && s1.p1 === away.agility
            && s1.hp === away.hp - 1 && s1.rows.length === 2 && J(put?.change) === J({ [AGI]: [away.agility, away.agility + 1] })
            && J(asked?.change) === J({ [HP]: [away.hp, away.hp - 1] }) && s1.cards.length === 1 && J(s1.cards[0].asks) === J([asked?.id])
            && put?.card === s1.cards[0].id && asked?.card === s1.cards[0].id,
        J({ away, s1 }), { flow: "sheet-audit" });
    check("S2: the card's own Undo for that row heals the mark back, decides the row by that GM, and the card says so with no buttons left",
        s2?.button === true && s2.all === true && s2.hp === away?.hp && s2.decided?.how === "undo" && s2.decided.by === s2.me
            && J(s2.decided.undone) === J([HP]) && s2.undoneLine === true && s2.buttonsLeft === false,
        J(s2), { flow: "sheet-audit" });
    for (const [who, client] of [["p1", p1], ["gm0", gm0]]) {
        const errs = await client.eval(`return globalThis.__errors.slice(0, 5);`).catch(err => [String(err?.message ?? err)]);
        check(`${who}: no uncaught errors after a sheet changed with no GM watching`, (errs ?? []).length === 0, J(errs).slice(0, 400), { flow: "sheet-audit" });
    }
}
