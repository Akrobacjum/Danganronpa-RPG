/** Measure end-to-end Hope delta on a critical (action roll): +2 or +3? */
export async function run({ gm, check, settle }) {
    const out = await gm.eval(`
        const actor = game.actors.getName("Chie Mori");
        await game.settings.set("danganronpa-rpg", "despairFromRolls", true);
        // fresh, well below max so nothing clamps
        await actor.update({ "system.resources.hope.value": 0, "system.resources.hope.max": 12 });
        const before = actor.system.resources.hope.value;
        globalThis.__forceRoll = { hope: 7, fear: 7 }; // tie => critical
        const cfg = await actor.rollTrait("agility", {});
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
        await actor.rollTrait("agility", {});
        await new Promise(r => setTimeout(r, 400));
        return { delta: game.actors.getName("Chie Mori").system.resources.hope.value - before };
    `, { timeout: 60000 });
    console.log("HOPE ROLL:", JSON.stringify(ctrl));
    check("plain Hope roll pays +1", ctrl.delta === 1, `delta=${ctrl.delta}`);
}
