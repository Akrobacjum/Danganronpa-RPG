/** Measure end-to-end Hope delta on a critical (action roll): +2 or +3? */
export const layers = ["ci"];

export async function run({ gm, p1, check, phase, settle, repoUrl, IDS }) {
    phase("a critical and a Hope roll", { flow: "private-rolls" });
    const out = await gm.eval(`
        const actor = game.actors.getName("Chie Mori");
        await game.settings.set("danganronpa-rpg", "despairFromRolls", true);
        // fresh, well below max so nothing clamps
        await actor.update({ "system.resources.hope.value": 0, "system.resources.hope.max": 12 });
        const before = actor.system.resources.hope.value;
        globalThis.__forceRoll = { hope: 7, fear: 7 }; // tie => critical
        const cfg = await actor.rollTrait("agility", {});
        // Committed as the sheet's trait button commits it (character.mjs #rollAttribute):
        // Daggerheart's rollTrait only prepares the map. The harness's roll used to commit it
        // itself, which is why this scenario never had to (E30, lib/daggerheart.mjs).
        await cfg.resourceUpdates.updateResources();
        await new Promise(r => setTimeout(r, 400));
        const after = game.actors.getName("Chie Mori").system.resources.hope.value;
        return { before, after, delta: after - before, isCritical: cfg?.roll?.isCritical };
    `, { timeout: 60000 });
    console.log("CRIT HOPE:", JSON.stringify(out));
    check("critical is a critical (hope==fear)", out.isCritical === true, JSON.stringify(out));
    check("critical pays exactly +2 Hope (guide), not +3", out.delta === 2, `delta=${out.delta} (before=${out.before} after=${out.after})`);

    // control: a plain Hope (non-crit) roll should pay +1 (Daggerheart) - the module doesn't top up non-crits
    const ctrl = await gm.eval(`
        const actor = game.actors.getName("Chie Mori");
        await actor.update({ "system.resources.hope.value": 0, "system.resources.hope.max": 12 });
        const before = actor.system.resources.hope.value;
        globalThis.__forceRoll = { hope: 9, fear: 4 }; // hope>fear, not crit
        const plain = await actor.rollTrait("agility", {});
        await plain.resourceUpdates.updateResources();
        await new Promise(r => setTimeout(r, 400));
        return { delta: game.actors.getName("Chie Mori").system.resources.hope.value - before };
    `, { timeout: 60000 });
    console.log("HOPE ROLL:", JSON.stringify(ctrl));
    check("plain Hope roll pays +1", ctrl.delta === 1, `delta=${ctrl.delta}`);

    /* A REROLLED CRITICAL PAYS WHAT A FRESH ONE DOES (E08+E28 C4b, 03.10.2026; audit S02-22). Chie's
       Hope roll, bookmarked on the GMs, rerolled on the GM into a critical, twice: with the players'
       Hope and Fear automation off (the GMs' on) and with it on. A fresh critical's second Hope is
       paid at Daggerheart's funnel, which pays nothing with the players' flag off; the Reroll paid it
       whatever the flag said. The harness's roll message has no `Roll#reroll`, so on the GM the roll
       reads as one of the scenario's that throws 7/7 (as 40-flow's `REROLL_ARM`). Read: the Hope each
       Reroll moved, the price included - a Hope result to a critical moves none in Daggerheart's own
       arithmetic, so -3 is the price alone and -2 the price and the second Hope. */
    phase("a rerolled critical", { flow: "reroll" });
    const rerolled = await gm.eval(`
        const actor = game.actors.getName("Chie Mori");
        const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const R = await import("${repoUrl}/scripts/reroll.mjs");
        const { gameSettings } = CONFIG.DH.SETTINGS;
        const held = game.settings.get(CONFIG.DH.id, gameSettings.Automation);
        const was = foundry.utils.deepClone(held?.toObject?.() ?? held);
        const fear = game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear);
        class Thrown {
            constructor(formula, data = {}, options = {}) { this._formula = formula; this.options = options; this.faces = { hope: 9, fear: 4 }; }
            get dHope() { return { total: this.faces.hope }; } get dFear() { return { total: this.faces.fear }; }
            get total() { return this.faces.hope + this.faces.fear; }
            get withHope() { return this.faces.hope > this.faces.fear; } get withFear() { return this.faces.hope < this.faces.fear; }
            get isCritical() { return this.faces.hope === this.faces.fear; }
            async reroll() { const r = new Thrown(this._formula, {}, this.options); r.faces = { hope: 7, fear: 7 }; return r; }
            toJSON() { return { class: "DualityRoll", formula: this._formula, total: this.total, evaluated: true }; }
        }
        const out = {};
        try {
            for (const players of [false, true]) {
                await game.settings.set(CONFIG.DH.id, gameSettings.Automation,
                    foundry.utils.mergeObject(foundry.utils.deepClone(was), { hopeFear: { gm: true, players }, countdownAutomation: false }));
                await actor.update({ "system.resources.hope.value": 4, "system.resources.hope.max": 12 });
                globalThis.__forceRoll = { hope: 9, fear: 4 };
                const fresh = await A.rollTrait(actor, "eye", { remember: true });
                delete globalThis.__forceRoll;
                await new Promise(r => setTimeout(r, 400));
                const m = fresh?.raw?.message ?? null;
                if (m) Object.defineProperty(m, "rolls", { configurable: true, get: () => [new Thrown("1d12 + 1d12", {}, {})] });
                const before = actor.system.resources.hope.value;
                const answer = await R.rerollOnGm(actor, game.user);
                await new Promise(r => setTimeout(r, 400));
                if (m) delete m.rolls;
                out[players ? "on" : "off"] = { message: Boolean(m), made: Array.isArray(answer?.lines), moved: actor.system.resources.hope.value - before,
                    answer: answer?.lines ?? answer ?? null };
                await m?.delete();
            }
        } finally {
            delete globalThis.__forceRoll;
            await game.settings.set(CONFIG.DH.id, gameSettings.Automation, was);
            await game.settings.set(CONFIG.DH.id, gameSettings.Resources.Fear, fear);
        }
        return out;
    `, { timeout: 60000 });
    console.log("REROLLED CRIT:", JSON.stringify(rerolled));
    check("gm: a Reroll into a critical pays the second Hope only with the players' Hope and Fear automation on",
        rerolled.off?.message && rerolled.on?.message && rerolled.off.made && rerolled.on.made && rerolled.off.moved === -3 && rerolled.on.moved === -2,
        JSON.stringify(rerolled), { flow: "reroll" });

    /* A PLAYER'S OWN DAGGERHEART ROLL, THROUGH THE RELAY (E29 C4, 05.10.2026; the plan's 2.5, 2.7). A roll the GM
       does not draw - Daggerheart's own build on a player's browser - posts its card and then asks the GM's relay
       for its Hope (actor.mjs `modifyResource`). p1 posts Aiko's duality card with Hope, as Daggerheart writes it,
       and asks for +1; asks for +1 again with no new roll; then posts a critical and asks for its Hope (CRITICAL,
       config.mjs: 2). Read on the GM: Aiko's Hope after each, and the refusals p1 was told (code `relay`). Before
       C4 the second +1 landed as well. */
    phase("a player's own roll's Hope through the relay", { flow: "sheet-audit" });
    const SOCKET = "module.danganronpa-rpg";
    const hopeWas = await gm.eval(`const a = game.actors.get("${IDS.aiko}"); const was = { value: a.system.resources.hope.value, max: a.system.resources.hope.max };
        await a.update({ "system.resources.hope.value": 2, "system.resources.hope.max": 12 }); return was;`);
    const card = (hope, fear) => `const a = game.actors.get("${IDS.aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: ${hope + fear}, evaluated: true, dHope: { total: ${hope} }, dFear: { total: ${fear} },
            dice: [{ faces: 12, total: ${hope}, results: [{ result: ${hope}, active: true }] }, { faces: 12, total: ${fear}, results: [{ result: ${fear}, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll } });
        globalThis.__c4Cards.push(m.id);`;
    const ask = n => `await game.actors.get("${IDS.aiko}").modifyResource([{ key: "hope", value: ${n} }]);`;
    const hopeOnGm = `return game.actors.get("${IDS.aiko}").system.resources.hope.value;`;
    const relayRead = [];
    try {
        await settle(400);
        await p1.eval(`globalThis.__c4Cards = []; globalThis.__c4Told = [];
            game.socket.on("${SOCKET}", payload => { if (payload?.action === "bridge.refused") globalThis.__c4Told.push(payload.reason); });
            ${card(9, 4)} ${ask(1)} return true;`);
        await settle(1500);
        relayRead.push(await gm.eval(hopeOnGm));
        await p1.eval(`${ask(1)} return true;`);
        await settle(1500);
        relayRead.push(await gm.eval(hopeOnGm));
        await p1.eval(`${card(7, 7)} ${ask(2)} return true;`);
        await settle(1500);
        relayRead.push(await gm.eval(hopeOnGm));
        relayRead.push(await p1.eval(`return globalThis.__c4Told.slice();`));
    } finally {
        await p1.eval(`for (const id of globalThis.__c4Cards ?? []) await game.messages.get(id)?.delete(); return true;`);
        await gm.eval(`await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await game.actors.get("${IDS.aiko}").update({ "system.resources.hope.value": ${hopeWas.value}, "system.resources.hope.max": ${hopeWas.max} });
            return true;`);
    }
    check("p1: a Daggerheart roll with Hope covers its one Hope through the relay once, a second ask with no roll is refused and told, and a critical covers its two",
        JSON.stringify(relayRead) === JSON.stringify([3, 3, 5, ["relay"]]), JSON.stringify({ hopeWas, relayRead }), { flow: "sheet-audit" });
}
