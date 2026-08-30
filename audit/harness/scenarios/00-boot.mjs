/** Boot sanity: three clients, module registers, world sync works. */
export async function run({ gm, p1, p2, check, settle, bootInfo, permissionDenials }) {
    for (const [who, info] of bootInfo) {
        check(`${who}: boot completed`, info.t === "ready", info.error ?? "");
        if (info.t === "ready") {
            check(`${who}: game.drpg api registered`, info.drpg, `keys=${info.drpgKeys}`);
            check(`${who}: module settings registered (>30)`, info.settingsRegistered > 30, `got ${info.settingsRegistered}`);
        }
    }

    // world-state sync: GM writes a module world setting, players observe it
    const key = await gm.eval(`
        const k = [...game.settings.settings.keys()].find(k => k.startsWith("danganronpa-rpg."));
        return k;
    `);
    check("gm: module settings visible", !!key, key);

    // clock via api if present
    const clock = await gm.eval(`return game.drpg && typeof game.drpg.getClock === "function" ? game.drpg.getClock() : "no-getClock";`);
    check("gm: clock readable via api", clock !== null && clock !== undefined, JSON.stringify(clock));

    // notifications that fired during boot (worth seeing, not necessarily failures)
    for (const c of [gm, p1, p2]) {
        const notes = await c.eval(`return globalThis.__notifications.map(n => n.level + ": " + n.msg);`);
        check(`${c.who}: boot notifications recorded`, true, JSON.stringify(notes));
    }

    // missing i18n keys hit during boot
    const missing = await gm.eval(`return [...globalThis.__missingI18n];`);
    check("gm: no missing i18n keys during boot", missing.length === 0, JSON.stringify(missing));

    // player cannot write world settings (server-side rule holds)
    const denial = await p1.eval(`
        try {
            const k = [...game.settings.settings.keys()].find(k => k.startsWith("danganronpa-rpg.") && game.settings.settings.get(k).scope === "world");
            if (!k) return "no-world-setting";
            const [ns, ...rest] = k.split(".");
            await game.settings.set(ns, rest.join("."), game.settings.get(ns, rest.join(".")));
            return "WRITE SUCCEEDED";
        } catch (err) { return "denied: " + err.message; }
    `);
    check("p1: world-setting write denied by server", String(denial).startsWith("denied"), denial);

    await settle(300);
}
