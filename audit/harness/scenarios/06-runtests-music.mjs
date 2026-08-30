export async function run({ gm, p1, check }) {
    await gm.eval(`await game.settings.set("danganronpa-rpg", "musicEnabled", true); return true;`);
    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: 2 });
        return { passed: r?.passed, failed: r?.failed, text: (r?.text ?? "").slice(0, 30000) };
    `, { timeout: 240000 });
    console.log(res.text.split("\n").filter(l => /FAIL|passed/.test(l)).join("\n"));
    check("suite with music enabled", typeof res.passed === "number", `${res.passed} passed, ${res.failed} failed`);
}
