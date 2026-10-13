/** Boot sanity: four clients, module registers, world sync works. */
export const layers = ["ci"];
/* A second GM who joins late with LiveKit switched off (E13 fix r1-F3): the module stops on that browser. The id sorts
   after the seeded GM's, so the primary GM stays the seeded one while it is connected. */
export const accounts = [{ who: "gmoff", id: "USERGX0000000000", name: "GM Without LiveKit", role: 4, character: null, color: "#444444", late: true }];

export async function run({ gm, gmoff, p1, p2, p3, check, note, settle, connect, disconnect, bootInfo, permissionDenials, legacyKeys, IDS, environment }) {
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

    /* The pre steps (lib/shim.mjs, THE PRE STEPS EDIT THE UPDATE THAT IS SENT): what a
       preUpdate listener takes out of the update is not written, and false cancels it. */
    const pre = await p1.eval(`const a = game.actors.get("${IDS.aiko}");
        Hooks.once("preUpdateActor", (doc, update) => { delete update.flags.world.e30drop; });
        await a.update({ "flags.world.e30keep": 1, "flags.world.e30drop": 1 });
        Hooks.once("preUpdateActor", () => false);
        await a.update({ "flags.world.e30cancel": 1 });
        return true;`);
    const preOnGm = await read(gm, IDS.aiko);
    check("the host: an edit a preUpdate listener makes is what is written, and false cancels the update",
        pre === true && JSON.stringify(preOnGm) === JSON.stringify({ e30keep: 1 }), JSON.stringify(preOnGm));
    await write(p1, IDS.aiko, `{ "flags.world": _del }`);

    /* Roles (lib/shim.mjs, AN ASSISTANT IS A GM): isGM from role 3, and a role
       name the harness does not know is no role at all. */
    const roles = await gm.eval(`const User = CONFIG.User.documentClass;
        return { isGM: [1, 2, 3, 4].map(role => new User({ role }).isGM), unknown: new User({ role: 4 }).hasRole("NOT_A_ROLE") };`);
    check("the host: isGM for roles 1 to 4 is false, false, true, true, and an unknown role name is no role",
        JSON.stringify(roles) === JSON.stringify({ isGM: [false, false, true, true], unknown: false }), JSON.stringify(roles));

    /* Stylesheets (lib/css.mjs): every client attached module.json's sheets in its
       order, each under the `modules` layer, and the cascade answers a custom
       property as the stylesheet states it outside any @media block (1400px; the
       flat map it replaced answered 1700px, from the `(min-aspect-ratio: 2/1)`
       block - which jsdom 30.0.1 applies at no window size: it applies only an
       @media list that is empty, `all` or `screen`, lib/css.mjs). */
    const sheets = await gm.eval(`const manifest = await fetch("/modules/danganronpa-rpg/module.json").then(r => r.json());
        const inline = [...document.styleSheets].flatMap(s => [...s.cssRules]).filter(r => "styleSheet" in r);
        return { styles: manifest.styles,
            hrefs: inline.map(r => r.href.replace("modules/danganronpa-rpg/", "")), layers: inline.map(r => r.layerName),
            filled: inline.filter(r => r.styleSheet?.cssRules?.length > 0).length,
            windowMax: getComputedStyle(document.body).getPropertyValue("--drpg-window-max") };`);
    const attached = [...bootInfo.values()].map(info => info.stylesheets && `${info.stylesheets.files}/${info.stylesheets.of}`);
    check("the host: the module's stylesheets are attached on every client in module.json's order, each in layer modules",
        sheets.styles.length > 0 && JSON.stringify(sheets.hrefs) === JSON.stringify(sheets.styles)
        && sheets.layers.every(l => l === "modules") && sheets.filled === sheets.styles.length
        && attached.every(a => a === `${sheets.styles.length}/${sheets.styles.length}`), JSON.stringify({ sheets, attached }));
    check("the host: body --drpg-window-max reads 1400px through the cascade", sheets.windowMax === "1400px", JSON.stringify(sheets.windowMax));

    /* Versions (lib/versions.mjs): each one the harness claims says where it was
       read, and the GM's client reports the ones the results file records. */
    const booted = await gm.eval(`return { foundry: game.version, release: game.release, data: game.data.version, system: game.system.version,
        modules: Object.fromEntries([...game.modules.values()].map(m => [m.id, m.version])) };`);
    const claimed = [environment.foundry, environment.system, environment.system.relayCode, ...environment.modules];
    check("the host: every version it claims says where it was read, and the GM's client reports those versions",
        claimed.every(v => Boolean(v?.version) && Boolean(v?.from)) && environment.modules.length > 0
        && booted.foundry === environment.foundry.version && booted.data === environment.foundry.version
        && booted.release?.generation === environment.foundry.generation && booted.release?.build === environment.foundry.build
        && booted.system === environment.system.version && environment.modules.every(m => booted.modules[m.id] === m.version),
        JSON.stringify({ environment, booted }));

    /* The GM's chrome (E13 C7, 12.10.2026; S12-18; R438 reads the sheets). The Scenes tab is
       hidden unless the element carries the class a GM's client puts on it (GM_CHROME,
       gm-panel.mjs); the scene navigation and the hotbar are hidden for everybody, the GM
       included (DZ5, the owner, 12.10.2026; E81 fix r1-G6). The harness draws only `#hotbar`
       (client-entry.mjs); the other two are drawn here after the module's `ready`, their render
       hooks fired as Foundry fires them on a render, and taken away again. Read through jsdom's
       cascade in both themes: the one each client booted with, then the other (the theme is
       the client's own setting), and the first put back. */
    const chrome = c => c.eval(`const drawn = [];
        const draw = (id, html) => { if (document.getElementById(id)) return; const t = document.createElement("template");
            t.innerHTML = html; drawn.push(t.content.firstElementChild); document.body.append(t.content.firstElementChild); };
        draw("scene-navigation", '<nav id="scene-navigation"></nav>');
        draw("sidebar-tabs", '<nav id="sidebar-tabs"><button type="button" class="ui-control" data-tab="scenes"></button></nav>');
        Hooks.callAll("renderSceneNavigation"); Hooks.callAll("renderSidebar");
        const shown = sel => getComputedStyle(document.querySelector(sel)).display !== "none";
        const read = () => ({ theme: [...document.body.classList].filter(c => c.startsWith("drpg-theme")).join(" "),
            hotbar: shown("#hotbar"), nav: shown("#scene-navigation"), scenes: shown('#sidebar-tabs button[data-tab="scenes"]') });
        const was = game.settings.get("danganronpa-rpg", "theme");
        const seen = [read()];
        await game.settings.set("danganronpa-rpg", "theme", was === "stainedGlass" ? "monokumaLegacy" : "stainedGlass");
        seen.push(read());
        await game.settings.set("danganronpa-rpg", "theme", was);
        drawn.forEach(el => el.remove());
        return { seen, back: game.settings.get("danganronpa-rpg", "theme") === was };`);
    const gmChrome = await chrome(gm), playerChrome = await chrome(p1);
    const themes = r => r.seen.map(s => s.theme).sort().join(",");
    check("the GM's chrome: in both themes a GM's client shows the Scenes tab and hides the scene navigation and the hotbar, and a player's hides all three",
        [gmChrome, playerChrome].every(r => r.back && themes(r) === "drpg-theme-monokuma-legacy,drpg-theme-stained-glass")
        && gmChrome.seen.every(s => !s.hotbar && !s.nav && s.scenes)
        && playerChrome.seen.every(s => !s.hotbar && !s.nav && !s.scenes),
        JSON.stringify({ gm: gmChrome, p1: playerChrome }));

    /* The GM's chrome when the module stops (E13 fix r1-F3, 12.10.2026; goal S12-18's other half; R470 reads the
       order). A GM joins with LiveKit switched off, so the requirements check stops the module on that browser
       (R442) while the harness links its stylesheets as on every client - whether Foundry v14 does is LIVE-E13-11.
       Read as above, in the one theme a module that never set one leaves (none), after its `ready`, one element at a
       time: the hotbar as `ready` left it, then the navigation drawn and its render fired, then the Scenes tab drawn and
       the sidebar's render fired - `markGmChrome` stamps every element there is, so one hook fired before an element is
       read would answer for the others. Until the fix the chrome was registered after the check, and a GM there
       computed all three hidden; since DZ5 only the Scenes tab is the GM's, the other two stay hidden. */
    await connect("gmoff", { modulesOff: ["avclient-livekit"] });
    await settle(300);
    const stopped = await gmoff.eval(`const drawn = [];
        const draw = (id, html) => { if (document.getElementById(id)) return; const t = document.createElement("template");
            t.innerHTML = html; drawn.push(t.content.firstElementChild); document.body.append(t.content.firstElementChild); };
        const shown = sel => getComputedStyle(document.querySelector(sel)).display !== "none";
        const read = { stopped: !game.drpg && !game.settings.settings.has("danganronpa-rpg.theme"), gm: game.user.isGM, hotbar: shown("#hotbar") };
        draw("scene-navigation", '<nav id="scene-navigation"></nav>');
        Hooks.callAll("renderSceneNavigation");
        read.nav = shown("#scene-navigation");
        draw("sidebar-tabs", '<nav id="sidebar-tabs"><button type="button" class="ui-control" data-tab="scenes"></button></nav>');
        Hooks.callAll("renderSidebar");
        read.scenes = shown('#sidebar-tabs button[data-tab="scenes"]');
        drawn.forEach(el => el.remove());
        return read;`);
    await disconnect("gmoff");
    check("the GM's chrome when the module stops: a GM whose world has LiveKit switched off still shows the Scenes tab, and the scene navigation and the hotbar stay hidden",
        stopped.stopped === true && stopped.gm === true && !stopped.hotbar && !stopped.nav && stopped.scenes, JSON.stringify(stopped));

    await settle(300);
}
