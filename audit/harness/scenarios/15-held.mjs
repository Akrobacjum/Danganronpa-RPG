/**
 * Other modules' client settings the table plays with, held on every client (E27).
 *
 * Isometric Perspective's welcome window is a CLIENT setting: switching it off in
 * the GM's browser did nothing for the players, who met it on every start. The
 * module holds it off on every client at `setup` and takes its box out of each
 * player's Configure Settings (enforced.mjs). This asks a PLAYER's client, after a
 * boot like any other, what it holds - the suite runs on the GM alone and cannot.
 */
export async function run({ p1, p2, check, settle }) {
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
}
