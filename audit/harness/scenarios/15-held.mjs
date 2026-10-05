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
 */
export const layers = ["ci"];

export const accounts = [{ who: "gm0", id: "USERGA0000000000", name: "Returning GM", role: 4, character: null, color: "#aa0000", late: true }];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, gm0, p1, p2, check, phase, settle, connect, disconnect, socketTraffic, IDS, repoUrl }) {
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

    await awayAndBack({ gm, gm0, p1, check, phase, settle, connect, disconnect, socketTraffic, IDS, repoUrl });
}

/** A GM away, and back (E08+E28 C18): the header's A1-A3. */
async function awayAndBack({ gm, gm0, p1, check, phase, settle, connect, disconnect, socketTraffic, IDS, repoUrl }) {
    phase("a GM away, and back", { flow: "gm-rolls-total" });
    const AIKO = `const aiko = game.actors.get("${IDS.aiko}");`;
    const UNTIL = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    // Hope below its maximum of 6 and actions to pay with, so "nothing moved" is a reading.
    await gm.eval(`${AIKO} const A = await import("${repoUrl}/scripts/actions.mjs");
        await aiko.update({ "system.resources.hope.value": 2 }); await A.setActions(aiko, 3); return true;`);
    await disconnect("gm");
    await settle(800);

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
    const sentFrom = socketTraffic.length;
    const a2 = await p1.eval(`${AIKO} globalThis.__forceRoll = { hope: 9, fear: 4 };
        const hope = aiko.system.resources.hope.value;
        let config = null;
        try { config = await aiko.rollTrait("instinct"); } finally { delete globalThis.__forceRoll; }
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

    // A3: a GM connects; the primary's card lists the roll, and Grant all - its button clicked, then asked again - moves its Hope once.
    let a3 = null;
    try {
        await connect("gm0");
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
                granted: message?.flags?.["${MOD}"]?.unwitnessed?.granted ?? null, author: message?.author?.id ?? null };`, { timeout: 60000 });
    } catch (err) {
        a3 = { error: String(err?.message ?? err) };
    }
    check("A3: back, the GM gets one card listing p1's stamped roll, and Grant all moves its Hope once and makes it the GM's",
        a3?.primary === true && J(a3.listed) === J([[a2.id]]) && a3.button && !a3.buttonsLeft && a3.again === 0 && a3.after === a3.hope + 1
        && a3.granted === true && a3.author === "USERGA0000000000", J(a3), { flow: "gm-rolls-total" });

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

    for (const [who, client] of [["p1", p1], ["gm0", gm0]]) {
        const errs = await client.eval(`return globalThis.__errors.slice(0, 5);`).catch(err => [String(err?.message ?? err)]);
        check(`${who}: no uncaught errors with a GM away and back`, (errs ?? []).length === 0, J(errs).slice(0, 400), { flow: "gm-rolls-total" });
    }
}
