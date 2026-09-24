/** Boot sanity: four clients, module registers, world sync works. */
export const layers = ["ci"];

export async function run({ gm, p1, p2, p3, check, note, settle, bootInfo, permissionDenials, legacyKeys, IDS }) {
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

    /* The clock through the api. This asked for "not null", which the fallback
       string "no-getClock" passed as well as a clock did. getClock() spreads
       DEFAULT_CLOCK (settings.mjs) under the stored clock, so a clock always
       carries a `phase`; the check asks for that shape. */
    const clock = await gm.eval(`return game.drpg && typeof game.drpg.getClock === "function" ? game.drpg.getClock() : "no-getClock";`);
    check("gm: getClock() through the api returns a clock with a phase",
        clock !== null && typeof clock === "object" && typeof clock.phase === "string", JSON.stringify(clock));

    /* Notifications during boot. Each client's list was a check that passed on
       a constant `true`, which measured nothing; the list is a note now, printed
       as evidence, and what can actually be wrong with it is the check: a
       notification at error level while the module boots. On 24.09.2026 the GM
       showed one, at info level ("Room-based visibility switched on for 1
       scenes."), and the players none. */
    for (const c of [gm, p1, p2, p3]) {
        const shown = await c.eval(`return globalThis.__notifications.map(n => ({ level: n.level, msg: n.msg }));`);
        note(`${c.who}: boot notifications`, JSON.stringify(shown.map(n => `${n.level}: ${n.msg}`)));
        const errors = shown.filter(n => n.level === "error");
        check(`${c.who}: no error-level notification during boot`, errors.length === 0, JSON.stringify(errors));
    }

    /* Missing i18n keys during boot: this module's own, and only those. The
       harness loads this module's lang/en.json and nothing else, and voice.mjs
       localizes three keys that belong to avclient-livekit (LIVEKITAVCLIENT.*)
       to recognise that module's own notifications. Those three made this
       scenario red on 1.2.60 (18/19) for a fact about the harness, so they are
       kept as evidence - in the details and in a note - and only a missing
       DRPG. key fails the check. */
    const missing = await gm.eval(`return [...globalThis.__missingI18n];`);
    const ours = missing.filter(k => k.startsWith("DRPG."));
    const foreign = missing.filter(k => !k.startsWith("DRPG."));
    check("gm: no DRPG. i18n key missing during boot", ours.length === 0, JSON.stringify({ missing: ours, foreign }));
    if (foreign.length) note("gm: other modules' keys the harness has no language file for (not counted)", JSON.stringify(foreign));

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

    /*
     * THE HOST IS THE FOUNDRY IT SAYS IT IS (E30, 24.09.2026). Each E30 commit that
     * brings a piece of the harness closer to v14 adds here the check that it did,
     * so a later change that quietly takes the piece away turns boot red. The
     * writes go on a probe flag in the `world` scope, which no module code reads:
     * on Daichi, whom only the GM may write, and on Aiko, p1's own. Each is read
     * back on the GM and on p1.
     */
    const read = (c, id) => c.eval(`return foundry.utils.deepClone(game.actors.get("${id}")._source.flags?.world ?? null);`);
    const onBoth = async id => ({ gm: await read(gm, id), p1: await read(p1, id) });
    const same = views => JSON.stringify(views.gm) === JSON.stringify(views.p1);
    const write = (c, id, changes) => c.eval(`await game.actors.get("${id}").update(${changes}); return true;`);

    /* Operators (lib/operators.mjs): a `-=` key removes nothing, stores nothing
       under its own name, and is reported; `_del`, `_replace` and
       foundry.data.operators delete and replace; unsetFlag removes. */
    await write(gm, IDS.daichi, `{ "flags.world.e30probe": { keep: 1, gone: 2 } }`);
    const reportedBefore = legacyKeys.length;
    await write(gm, IDS.daichi, `{ "flags.world.e30probe.-=gone": null }`);
    const legacy = await onBoth(IDS.daichi);
    const reported = legacyKeys.slice(reportedBefore);
    check("the host: a '-=' key removes nothing on any client, is not stored as a key, and is reported",
        legacy.gm?.e30probe?.gone === 2 && same(legacy) && !("-=gone" in (legacy.gm?.e30probe ?? {}))
        && reported.length === 1 && reported[0].who === "gm" && reported[0].path === "flags.world.e30probe.-=gone",
        JSON.stringify({ legacy, reported }));

    for (const [writer, id] of [[gm, IDS.daichi], [p1, IDS.aiko]]) {
        await write(writer, id, `{ "flags.world.e30probe": { keep: 1, gone: 2, bookmark: { actionKey: "search", itemId: "abc" } } }`);
        await write(writer, id, `{ "flags.world.e30probe.gone": _del, "flags.world.e30probe.bookmark": _replace({ actionKey: "listen" }) }`);
        const globals = await onBoth(id);
        await write(writer, id, `{ "flags.world.e30probe.keep": foundry.data.operators.ForcedDeletion.create(),
            "flags.world.e30probe.bookmark": foundry.data.operators.ForcedReplacement.create({ actionKey: "observe" }) }`);
        const operators = await onBoth(id);
        check(`the host: _del, _replace and foundry.data.operators, written by ${writer.who}, delete and replace on every client`,
            same(globals) && JSON.stringify(globals.gm?.e30probe) === JSON.stringify({ keep: 1, bookmark: { actionKey: "listen" } })
            && same(operators) && JSON.stringify(operators.gm?.e30probe) === JSON.stringify({ bookmark: { actionKey: "observe" } }),
            JSON.stringify({ globals, operators }));

        await writer.eval(`await game.actors.get("${id}").unsetFlag("world", "e30probe"); return true;`);
        const unset = await onBoth(id);
        check(`the host: unsetFlag, called by ${writer.who}, removes the flag on every client`,
            same(unset) && unset.gm !== null && !("e30probe" in unset.gm), JSON.stringify(unset));
        await write(writer, id, `{ "flags.world": _del }`);
    }

    await settle(300);
}
