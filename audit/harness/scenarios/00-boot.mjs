/** Boot sanity: four clients, module registers, world sync works. */
export const layers = ["ci"];
/* A second GM who joins late with LiveKit switched off (E13 fix r1-F3): the module stops on that browser. The id sorts
   after the seeded GM's, so the primary GM stays the seeded one while it is connected. */
export const accounts = [{ who: "gmoff", id: "USERGX0000000000", name: "GM Without LiveKit", role: 4, character: null, color: "#444444", late: true }];

export async function run({ gm, gmoff, p1, p2, p3, check, note, settle, connect, disconnect, bootInfo, permissionDenials, legacyKeys, IDS, environment, repoUrl }) {
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

    /* Operators (lib/operators.mjs): a `-=` key deletes and a `==` key replaces, as Foundry 14.370 did on the owner's
       sandbox (16.11.2026, E58 L1: an actor's and a token's flag, with v14's deprecation warning; LIVE-E30-01,
       LIVE-E76-03), neither is stored under its own name, and each is reported; `_del`, `_replace` and
       foundry.data.operators delete and replace; unsetFlag removes. Until 16.11.2026 this held the "ignored" reading,
       the module's notes of an earlier 14.36x; 91-old-keys-ignored still holds that one by name. */
    await write(gm, IDS.daichi, `{ "flags.world.e30probe": { keep: 1, gone: 2, swap: { a: 1, b: 2 } } }`);
    const reportedBefore = legacyKeys.length;
    await write(gm, IDS.daichi, `{ "flags.world.e30probe.-=gone": null, "flags.world.e30probe.==swap": { c: 3 } }`);
    const legacy = await onBoth(IDS.daichi);
    const reported = legacyKeys.slice(reportedBefore);
    check("the host: a '-=' key deletes and a '==' key replaces on every client, as v14 14.370 did, neither is stored as a key, and each is reported",
        JSON.stringify(legacy.gm?.e30probe) === JSON.stringify({ keep: 1, swap: { c: 3 } }) && same(legacy)
        && reported.length === 2 && reported.every(r => r.who === "gm")
        && JSON.stringify(reported.map(r => r.path).sort()) === JSON.stringify(["flags.world.e30probe.-=gone", "flags.world.e30probe.==swap"]),
        JSON.stringify({ legacy, reported }));
    await write(gm, IDS.daichi, `{ "flags.world": _del }`);

    /* Read on Foundry 14.370 (16.11.2026, E58 L1): `foundry.data.operators.ForcedDeletion.create()` makes a new
       instance each call, and `_del` is one instance of it; `game.collections` is a Collection, which iterates its
       values - each a world collection - while `entries()` gives [name, collection]. A plain Map iterated pairs, and
       two readers in the module's test kit that destructured pairs broke on the real server. */
    /* And a ForcedReplacement holds no `.replacement` and no `.value`: its value's own keys are on the instance and the
       whole value is `instance[operators.OPERATOR_VALUE]` (a Symbol), its JSON `{"__$OPERATOR$__": ..., value}`
       (read on 14.370 the same day). The shim kept it under `.replacement`, which a tier-2 test read and v14 does not have. */
    const host = await gm.eval(`const O = foundry.data.operators, FD = O.ForcedDeletion;
        const first = [...game.collections][0];
        const r = O.ForcedReplacement.create({ a: 1, b: { c: 2 } });
        return { fresh: FD.create() !== FD.create(), delIs: _del instanceof FD,
            values: !Array.isArray(first) && typeof first?.documentName === "string",
            entries: [...game.collections.entries()].every(([name, c]) => typeof name === "string" && c?.documentName === name),
            replacement: [typeof O.OPERATOR_VALUE, O.OPERATOR_IDENTIFIER ?? null, r.replacement === undefined && r.value === undefined, r.a,
                JSON.stringify(r[O.OPERATOR_VALUE] ?? null)] };`);
    /* Startup (read on Foundry 14.370, 16.11.2026, E58 L1): `game.user` is null at `init` and `i18nInit` and the User from
       `setup` on, `game.userId` set throughout. And no registration of the module fails on any browser: on the sandbox four
       did on every one (the pick's passes, the room actions' uses, the eavesdrops, the timed effects - each read
       `game.user.isGM` at init), which the shim never showed while it held the User from the start. */
    const startup = {};
    for (const [who, c] of [["gm", gm], ["p1", p1]]) startup[who] = await c.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return (U.sessionFailures?.() ?? []).filter(f => /^Could not register/.test(f.message)).map(f => f.message.slice(0, 90));`);
    check("startup: no registration of the module failed on the GM's browser or a player's, with game.user null at init as on v14 14.370",
        startup.gm.length === 0 && startup.p1.length === 0, JSON.stringify(startup));

    check("the host: ForcedDeletion.create() is a new instance each call and _del one of them, a ForcedReplacement holds its value under OPERATOR_VALUE with its keys on itself, and game.collections iterates its collections, entries() their names, as on v14 14.370",
        JSON.stringify(host) === JSON.stringify({ fresh: true, delIs: true, values: true, entries: true,
            replacement: ["symbol", "__$OPERATOR$__", true, 1, JSON.stringify({ a: 1, b: { c: 2 } })] }), JSON.stringify(host));

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

    /* D4, MOVEMENT AS FOUNDRY 14.370 MOVED A TOKEN (the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md
       section 3, LIVE-E39-01, read by E58 L1 on the owner's sandbox). p1 moved Aiko from Dorm A through v14's own
       `TokenDocument#move([{x: 1500, y: 400}, {x: 2300, y: 500}])` into the Hall; read on the mover, the GM and p2. Here a
       scratch token of a scratch actor p1 owns stands at Dorm A's 300,300 and takes the same route, so no student's
       action is spent: one update; `preMoveToken` and `preUpdateToken` once on the mover, the request in `options.movement`
       and every movement field in the changes; `updateToken` and `moveToken` once on the GM and p2, the move in
       `options._movement[id]` - every grid step of the route in `passed.waypoints` (20: grid steps intermediate, the asked
       waypoint not, the end a checkpoint), nothing pending, method "api", completed - no `options.movement`, `_regions` in
       the changes (the Hall) and `_priorRegions` in the options, and `TokenDocument#movement` the same move. Then v14's
       own displacement back, `move({x: 300, y: 300, action: "displace"})`: `teleport` true in `updateToken` (LIVE-H81-03).
       The token and the actor deleted. Where a diagonal step falls, the hooks' order and `_priorRegions`' shape are not
       read (lib/shim.mjs `TOKEN MOVEMENT`). */
    const J = JSON.stringify;
    const D4_FIELDS = ["x", "y", "elevation", "width", "height", "depth", "shape", "level"];
    const d4Made = await gm.eval(`const actor = await Actor.create({ name: "00 D4 mover", type: "adversary", ownership: { default: 0, "${IDS.p1}": 3 } });
        const scene = game.scenes.get("${IDS.scene}");
        const [t] = await scene.createEmbeddedDocuments("Token", [{ name: "00 D4 mover", actorId: actor.id, actorLink: true, x: 300, y: 300 }]);
        globalThis.__d4 = { actor: actor.id, token: t?.id ?? null };
        return globalThis.__d4;`);
    await settle(400);
    const d4Watch = c => c.eval(`globalThis.__d4seen = [];
        for (const name of ["preMoveToken", "preUpdateToken", "updateToken", "moveToken"]) {
            const id = Hooks.on(name, (doc, a, b) => {
                if (doc?.id !== "${d4Made.token}") return;
                const options = b;
                const changes = name === "preUpdateToken" || name === "updateToken" ? a : null;
                globalThis.__d4seen.push({ name, changes: changes ? Object.keys(changes).sort() : null, regions: changes?._regions ?? null,
                    request: Boolean(options?.movement?.["${d4Made.token}"]), moved: foundry.utils.deepClone(options?._movement?.["${d4Made.token}"] ?? null),
                    prior: options?._priorRegions === undefined ? "none" : "some", teleport: options?.teleport ?? null });
            });
            (globalThis.__d4ids ??= []).push([name, id]);
        }
        return true;`);
    for (const c of [gm, p1, p2]) await d4Watch(c);
    const d4Move = await p1.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("${d4Made.token}");
        if (typeof t?.move !== "function") return "no move";
        await t.move([{ x: 1500, y: 400 }, { x: 2300, y: 500 }]); return true;`);
    await settle(600);
    const d4Read = c => c.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("${d4Made.token}");
        const seen = globalThis.__d4seen; globalThis.__d4seen = [];
        return { seen, at: [t?.x, t?.y], movement: foundry.utils.deepClone(t?.movement ?? null) };`);
    const d4 = { p1: await d4Read(p1), gm: await d4Read(gm), p2: await d4Read(p2) };
    const steps = m => m?.passed?.waypoints ?? [];
    const routeOk = m => steps(m).length === 20 && steps(m).filter(w => w.intermediate === true).length === 18
        && steps(m).filter(w => w.intermediate === false).map(w => [w.x, w.y]).join(";") === "1500,400;2300,500"
        && steps(m).filter(w => w.checkpoint === true).length === 1 && steps(m).at(-1)?.checkpoint === true
        && steps(m).every(w => w.action === "walk" && w.x % 100 === 0 && w.y % 100 === 0)
        && (m?.pending?.waypoints ?? null)?.length === 0 && m?.method === "api" && m?.state === "completed";
    const names = side => side.seen.map(s => s.name);
    const mover = d4.p1.seen.find(s => s.name === "preUpdateToken");
    const heard = side => side.seen.find(s => s.name === "updateToken");
    check("D4: a token's move is one update as on v14 14.370 - preMoveToken and preUpdateToken once on the mover, the request in options.movement and every movement field in the changes; updateToken and moveToken once on the GM and p2, every grid step of the route in options._movement[id].passed.waypoints, no options.movement, _regions in the changes and _priorRegions in the options, and TokenDocument#movement the same move",
        d4Move === true && J(d4.p1.at) === J([2300, 500])
        && J(names(d4.p1).filter(n => n.startsWith("pre"))) === J(["preMoveToken", "preUpdateToken"])
        && mover?.request === true && D4_FIELDS.every(f => mover.changes.includes(f))
        && [d4.gm, d4.p2].every(side => J(names(side)) === J(["updateToken", "moveToken"]) && routeOk(heard(side)?.moved)
            && heard(side).request === false && J(heard(side).regions) === J(["REGHALL000000000"]) && heard(side).prior === "some"
            && routeOk(side.movement)),
        J(d4));
    await gm.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("${d4Made.token}");
        await t.move({ x: 300, y: 300, action: "displace" }); return true;`);
    await settle(600);
    const d4Back = { gm: await d4Read(gm), p2: await d4Read(p2) };
    check("D4: v14's own displacement, move({x, y, action: \"displace\"}), reaches updateToken with teleport true on every client, as on 14.370 (LIVE-H81-03)",
        [d4Back.gm, d4Back.p2].every(side => J(side.at) === J([300, 300]) && heard(side)?.teleport === true
            && steps(heard(side)?.moved).at(-1)?.action === "displace"),
        J(d4Back));
    /* THE MOVE IN THE CALLER'S OPTIONS (E58 L1, a6b25c51; reconciled with D4 at the merge of 0e70bfe3; lib/shim.mjs
       `TokenDocument#_runPreUpdate`): on Foundry 14.370 `_preUpdate` defines the move on the options object the caller
       passed, not configurable, so a second move of the same token with that object throws "Cannot redefine property:
       <id>" (152 tier-2 failures on the sandbox). Here, as the GM: a move with an options object `o`; the same `o` for a
       second move; then a move back with fresh options. Read: what each answered or threw, and whether `o._movement[id]`
       is the move's own record (its passed waypoints) and not configurable. */
    const d11 = await gm.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("${d4Made.token}"), o = {}, out = {};
        out.first = await t.update({ x: 400 }, o).then(r => r ? "moved" : String(r), e => "threw: " + e.message);
        const held = Object.getOwnPropertyDescriptor(o._movement ?? {}, t.id);
        out.record = held ? { configurable: held.configurable, enumerable: held.enumerable, steps: held.value?.passed?.waypoints?.length ?? null } : null;
        out.second = await t.update({ x: 500 }, o).then(r => r ? "moved" : String(r), e => "threw: " + e.message);
        out.fresh = await t.update({ x: 300 }, {}).then(r => r ? "moved" : String(r), e => "threw: " + e.message);
        out.at = [t.x, t.y];
        return out;`);
    await settle(300);
    check("D11: a token's move defines its record on the caller's own options, not configurable, so a second move with the same object throws \"Cannot redefine property\" and a fresh object moves it, as on v14 14.370",
        d11.first === "moved" && d11.record?.configurable === false && d11.record?.enumerable === true && d11.record?.steps > 0
        && d11.second === `threw: Cannot redefine property: ${d4Made.token}` && d11.fresh === "moved" && J(d11.at) === J([300, 300]), J(d11));
    for (const c of [gm, p1, p2]) await c.eval(`for (const [name, id] of globalThis.__d4ids ?? []) Hooks.off(name, id); delete globalThis.__d4ids; return true;`);
    await gm.eval(`await game.scenes.get("${IDS.scene}").deleteEmbeddedDocuments("Token", ["${d4Made.token}"]);
        await game.actors.get("${d4Made.actor}")?.delete(); return true;`);
    await settle(300);

    /* D5, LEVELS AS FOUNDRY 14.370 HELD THEM (the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md section 3,
       read by E58 L1). `Scene#levels` is an embedded collection of `Level` documents, `{ _id, name, elevation: { bottom, top,
       base }, ... }`, and every scene given none - the seeded ones too - holds `defaultLevel0000`, 0 to 20; a token on such a
       scene stands on it. On a scratch scene with two floors, Ground 0-10 and Upper 10-20, a room on each over the same
       square and one that names no floor beside them (whether L1's stood over the square was not written down, so it
       stands apart here and `_regions` is read as L1 read it, the high room alone): `includedInLevel` by id and by the document (an empty set is every floor); p1's token moved
       up in place (`move({ x, y, level })`) reaches `updateToken` with its level and the high room in `_regions`, and its
       elevation stays 0. Everything made is deleted. */
    const d5Seed = await p1.eval(`const scene = game.scenes.get("${IDS.scene}"), levels = scene.levels, first = levels?.contents?.[0] ?? null;
        return { size: levels?.size ?? null, get: Boolean(levels?.get?.("defaultLevel0000")), doc: first?.documentName ?? null,
            id: first?.id ?? null, elevation: first ? [first.elevation?.bottom ?? null, first.elevation?.top ?? null] : null,
            token: scene.tokens.contents[0]?.level ?? null };`);
    check("D5: every seeded scene holds defaultLevel0000 (0 to 20) in an embedded collection of Level documents, and a seeded token stands on it, as on v14 14.370",
        J(d5Seed) === J({ size: 1, get: true, doc: "Level", id: "defaultLevel0000", elevation: [0, 20], token: "defaultLevel0000" }), J(d5Seed));
    const D5 = { ground: "LEVEL00D5GROUND0", upper: "LEVEL00D5UPPER00", low: "REG00D5LOW000000", high: "REG00D5HIGH00000", none: "REG00D5NONE00000" };
    const d5Made = await gm.eval(`const square = [{ type: "rectangle", x: 200, y: 200, width: 400, height: 400 }];
        const scene = await Scene.create({ name: "00 D5 stair", width: 2000, height: 1000, grid: { size: 100 }, active: false, navigation: false,
            ownership: { default: 2 },
            levels: [{ _id: "${D5.ground}", name: "Ground", elevation: { bottom: 0, top: 10 } }, { _id: "${D5.upper}", name: "Upper", elevation: { bottom: 10, top: 20 } }],
            regions: [{ _id: "${D5.low}", name: "00 D5 low", shapes: square, levels: ["${D5.ground}"], behaviors: [] },
                { _id: "${D5.high}", name: "00 D5 high", shapes: square, levels: ["${D5.upper}"], behaviors: [] },
                { _id: "${D5.none}", name: "00 D5 none", shapes: [{ type: "rectangle", x: 1200, y: 200, width: 400, height: 400 }], levels: [], behaviors: [] }] }, { keepId: true });
        const actor = await Actor.create({ name: "00 D5 climber", type: "adversary", ownership: { default: 0, "${IDS.p1}": 3 } });
        const [t] = await scene.createEmbeddedDocuments("Token", [{ name: "00 D5 climber", actorId: actor.id, actorLink: true, x: 300, y: 300, level: "${D5.ground}" }]);
        return { scene: scene.id, actor: actor.id, token: t?.id ?? null };`);
    await settle(400);
    const d5Floors = await p1.eval(`const scene = game.scenes.get("${d5Made.scene}");
        const up = scene?.levels?.get("${D5.upper}"), ground = scene?.levels?.get("${D5.ground}");
        const on = id => [scene.regions.get(id).includedInLevel("${D5.ground}"), scene.regions.get(id).includedInLevel(up)];
        return { levels: [ground?.elevation?.bottom ?? null, ground?.elevation?.top ?? null, up?.elevation?.bottom ?? null, up?.elevation?.top ?? null],
            low: on("${D5.low}"), high: on("${D5.high}"), none: on("${D5.none}") };`);
    check("D5: a region is on its own floor by id or by the Level document, and one that names none is on every floor, as on v14 14.370",
        J(d5Floors) === J({ levels: [0, 10, 10, 20], low: [true, false], high: [false, true], none: [true, true] }), J(d5Floors));
    await gm.eval(`globalThis.__d5seen = null; globalThis.__d5hook = Hooks.on("updateToken", (doc, changes) => {
        if (doc.id === "${d5Made.token}") globalThis.__d5seen = { level: changes.level ?? null, regions: changes._regions ?? null, elevation: doc.elevation };
    }); return true;`);
    await p1.eval(`const t = game.scenes.get("${d5Made.scene}").tokens.get("${d5Made.token}");
        await t.move({ x: 300, y: 300, level: "${D5.upper}" }); return true;`);
    await settle(500);
    const d5Up = await gm.eval(`Hooks.off("updateToken", globalThis.__d5hook); const seen = globalThis.__d5seen;
        delete globalThis.__d5hook; delete globalThis.__d5seen; return seen;`);
    check("D5: a token moved up in place reaches updateToken with its new level and the high room in _regions, its elevation left at 0, as on v14 14.370",
        J(d5Up) === J({ level: D5.upper, regions: [D5.high], elevation: 0 }), J(d5Up));
    await gm.eval(`await game.scenes.get("${d5Made.scene}")?.delete(); await game.actors.get("${d5Made.actor}")?.delete(); return true;`);
    await settle(300);

    /* D3, THE UPDATE DIFF AS FOUNDRY 14.370 MADE IT (the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md
       section 1, LIVE-E30-03, read by E58 L1). On a scratch actor every browser observes and a scratch token, each written by
       the GM and read on the GM and on p1: a write of a value already there runs `preUpdateActor` and then nothing - no
       `updateActor` anywhere, `update()` answering undefined; an update with one key unchanged and one new hands `updateActor`
       the new key alone with `_stats` and `_id`; with `{ diff: false }` a write that changes nothing is sent and its hook gets
       `{_id}` alone; a token's no-op on its name is not sent, a mixed update's hook gets the changed key alone, and an update
       naming a movement field where the token stands is sent with `{_id}` alone. Both deleted after. */
    const d3Made = await gm.eval(`const actor = await Actor.create({ name: "00 D3 diff", type: "adversary", ownership: { default: 2 }, flags: { world: { d3: { keep: 1 } } } });
        const [t] = await game.scenes.get("${IDS.scene}").createEmbeddedDocuments("Token", [{ name: "00 D3 token", x: 1300, y: 1300 }]);
        return { actor: actor.id, token: t?.id ?? null };`);
    await settle(400);
    const d3Watch = c => c.eval(`globalThis.__d3 = [];
        globalThis.__d3ids = ["preUpdateActor", "updateActor", "updateToken"].map(name => [name, Hooks.on(name, (doc, changes) => {
            if (doc.id === "${d3Made.actor}" || doc.id === "${d3Made.token}") globalThis.__d3.push([name, Object.keys(changes).sort(), JSON.stringify(changes.flags ?? null)]);
        })]); return true;`);
    for (const c of [gm, p1]) await d3Watch(c);
    const d3Take = c => c.eval(`const seen = globalThis.__d3; globalThis.__d3 = []; return seen;`);
    const d3Step = async write => { const answer = await gm.eval(write); await settle(400); return { answer, gm: await d3Take(gm), p1: await d3Take(p1) }; };
    const actorAt = `game.actors.get("${d3Made.actor}")`, tokenAt = `game.scenes.get("${IDS.scene}").tokens.get("${d3Made.token}")`;
    const d3Same = await d3Step(`const r = await ${actorAt}.update({ "flags.world.d3.keep": 1 }); return r === undefined ? "undefined" : typeof r;`);
    const mixed = await d3Step(`const r = await ${actorAt}.update({ "flags.world.d3.keep": 1, "flags.world.d3.fresh": 2 }); return r === undefined ? "undefined" : typeof r;`);
    const whole = await d3Step(`const r = await ${actorAt}.update({ "flags.world.d3.keep": 1 }, { diff: false }); return r === undefined ? "undefined" : typeof r;`);
    const tName = await d3Step(`const r = await ${tokenAt}.update({ name: "00 D3 token" }); return r === undefined ? "undefined" : typeof r;`);
    const tMixed = await d3Step(`const r = await ${tokenAt}.update({ name: "00 D3 token", hidden: true }); return r === undefined ? "undefined" : typeof r;`);
    const tStill = await d3Step(`const r = await ${tokenAt}.update({ x: 1300 }); return r === undefined ? "undefined" : typeof r;`);
    const updates = side => side.filter(([name]) => name !== "preUpdateActor");
    check("D3: a write of a value already there runs preUpdateActor and then nothing - no updateActor on the GM or p1, update() answering undefined - as on v14 14.370",
        d3Same.answer === "undefined" && J(d3Same.gm.map(r => r[0])) === J(["preUpdateActor"]) && J(d3Same.p1) === "[]", J(d3Same));
    check("D3: an update with one key unchanged and one new hands updateActor the new key alone, with _stats and _id, on the GM and p1, as on v14 14.370",
        [mixed.gm, mixed.p1].every(side => J(updates(side)) === J([["updateActor", ["_id", "_stats", "flags"], J({ world: { d3: { fresh: 2 } } })]])), J(mixed));
    check("D3: with { diff: false } a write that changes nothing is sent and updateActor gets {_id} alone, on the GM and p1, as on v14 14.370",
        whole.answer === "object" && [whole.gm, whole.p1].every(side => J(updates(side)) === J([["updateActor", ["_id"], "null"]])), J(whole));
    check("D3: a token's no-op on its name is not sent, a mixed update's hook gets the changed key alone, and an update naming a movement field where it stands is sent with {_id} alone, as on v14 14.370",
        tName.answer === "undefined" && J(tName.gm) === "[]" && J(tName.p1) === "[]"
        && [tMixed.gm, tMixed.p1].every(side => J(side) === J([["updateToken", ["_id", "hidden"], "null"]]))
        && [tStill.gm, tStill.p1].every(side => J(side) === J([["updateToken", ["_id"], "null"]])), J({ tName, tMixed, tStill }));
    for (const c of [gm, p1]) await c.eval(`for (const [name, id] of globalThis.__d3ids ?? []) Hooks.off(name, id); delete globalThis.__d3ids; delete globalThis.__d3; return true;`);
    await gm.eval(`await game.scenes.get("${IDS.scene}").deleteEmbeddedDocuments("Token", ["${d3Made.token}"]); await ${actorAt}?.delete(); return true;`);
    await settle(300);

    /* D6, A ROLE CHANGE LOGS THE USER OUT (the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md section 1,
       LIVE-E30-05, read by E58 L1): on Foundry 14.370 the GM changed PlayerTwo's role from 1 to 2 while PlayerTwo's page was
       open, and the page went from /game to /join within 5 s - logged out. Here: the GM's write of p2's role, then whether
       p2 is still connected and whether the GM heard `userConnected` with p2 and false; the role put back and p2 connected
       again. A write of the role it already holds logs nobody out (D3: it is not sent). */
    await gm.eval(`globalThis.__d6 = []; globalThis.__d6hook = Hooks.on("userConnected", (user, active) => { if (user?.id === "${IDS.p2}") globalThis.__d6.push(Boolean(active)); }); return true;`);
    const d6Same = await gm.eval(`await game.users.get("${IDS.p2}").update({ role: game.users.get("${IDS.p2}").role }); return true;`);
    await settle(800);
    const d6Before = await p2.eval(`return true;`).catch(err => `gone: ${String(err?.message ?? err).slice(0, 60)}`);
    await gm.eval(`await game.users.get("${IDS.p2}").update({ role: 2 }); return true;`);
    let d6After = null;
    for (let i = 0; i < 25 && d6After !== "gone"; i++) {
        await settle(200);
        d6After = await p2.eval(`return "here";`).then(() => "here").catch(() => "gone");
    }
    await gm.eval(`const end = Date.now() + 4000; while (!globalThis.__d6.length && Date.now() < end) await new Promise(r => setTimeout(r, 50)); return true;`);
    const d6Heard = await gm.eval(`Hooks.off("userConnected", globalThis.__d6hook); const heard = globalThis.__d6; delete globalThis.__d6; delete globalThis.__d6hook; return heard;`);
    await gm.eval(`await game.users.get("${IDS.p2}").update({ role: 1 }); return true;`);
    if (d6After === "gone") await connect("p2");
    check("D6: the GM's change of p2's role logs p2 out within 5 s and the GM hears userConnected(p2, false), as on v14 14.370; a write of the role p2 holds logs nobody out",
        d6Same === true && d6Before === true && d6After === "gone" && J(d6Heard) === J([false]), J({ d6Before, d6After, d6Heard }));

    /* D10, A GM IS HEARD BEFORE ITS WORLD HAS LOADED (the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md
       section 3, AUDIT 9.2 item 52, read by E58 L1): on Foundry 14.370 a player's browser got `userConnected(gm, true)` when
       the GM's socket connected, about 5.7 s before that GM's module sent `bridge.gmReady`. Here: the late GM `gmoff`, every
       module on (its id sorts after the seed GM's, so the primary stays), connects; p1 writes down, in order, the
       `userConnected` it hears for gmoff and gmoff's `bridge.gmReady` on the module's socket. Then gmoff leaves. */
    await p1.eval(`globalThis.__d10 = []; globalThis.__d10hook = Hooks.on("userConnected", (user, active) => { if (user?.id === "USERGX0000000000") globalThis.__d10.push(active ? "connected" : "left"); });
        globalThis.__d10socket = (payload, sender) => { if (payload?.action === "bridge.gmReady" && sender === "USERGX0000000000") globalThis.__d10.push("gmReady"); };
        game.socket.on("module.danganronpa-rpg", globalThis.__d10socket); return true;`);
    await connect("gmoff");
    await p1.eval(`const end = Date.now() + 4000; while (globalThis.__d10.length < 2 && Date.now() < end) await new Promise(r => setTimeout(r, 50)); return true;`);
    const d10Heard = await p1.eval(`Hooks.off("userConnected", globalThis.__d10hook); game.socket.off?.("module.danganronpa-rpg", globalThis.__d10socket);
        const heard = globalThis.__d10; delete globalThis.__d10; delete globalThis.__d10hook; delete globalThis.__d10socket; return heard;`);
    await disconnect("gmoff");
    await settle(300);
    check("D10: a player hears userConnected(gm, true) when a GM connects, before that GM's module says bridge.gmReady, as on v14 14.370",
        J(d10Heard) === J(["connected", "gmReady"]), J(d10Heard));

    /* AN OWNER IS NOT REMOVED BY A DELETION (E58 L1, 867653ee; docs/dev/e39/CALIBRATION.md; lib/futil.mjs `keepOwners`):
       on Foundry 14.370, on an actor, `update({"ownership.<user>": ForcedDeletion})`, the same nested and
       `ownership.-=<user>` each left the entry as it was; a ForcedReplacement of the whole `ownership` removed it; a module
       flag deleted by the same ForcedDeletion went. Here, on a scratch actor p1 owns, the GM writes each in turn; p2
       writes down which paths each `updateActor` it hears names. Read after each: p1's entry, and whether any hook's
       changes named `ownership` for a write that left it as it was. */
    const own = await gm.eval(`const a = await Actor.create({ name: "00 owners", type: "adversary", ownership: { default: 0, "${IDS.p1}": 3 }, flags: { world: { gone: 1 } } });
        return a.id;`);
    await settle(300);
    await p2.eval(`globalThis.__own = []; globalThis.__ownhook = Hooks.on("updateActor", (doc, changes) => { if (doc.id === "${own}") globalThis.__own.push(Object.keys(foundry.utils.flattenObject(changes ?? {})).filter(k => k.startsWith("ownership"))); }); return true;`);
    const ownStep = async code => {
        await p2.eval(`globalThis.__own.length = 0; return true;`);
        await gm.eval(`const a = game.actors.get("${own}"), O = foundry.data.operators; ${code} return true;`);
        await settle(400);
        return p2.eval(`const a = game.actors.get("${own}"); return { p1: a.ownership?.["${IDS.p1}"] ?? null, flag: a.getFlag("world", "gone") ?? null, heard: globalThis.__own.flat() };`);
    };
    const ownDot = await ownStep(`await a.update({ "ownership.${IDS.p1}": O.ForcedDeletion.create() });`);
    const ownNest = await ownStep(`await a.update({ ownership: { "${IDS.p1}": O.ForcedDeletion.create() } });`);
    const ownOld = await ownStep(`await a.update({ "ownership.-=${IDS.p1}": null });`);
    const ownFlag = await ownStep(`await a.update({ "flags.world.gone": O.ForcedDeletion.create() });`);
    const ownWhole = await ownStep(`await a.update({ ownership: O.ForcedReplacement.create({ default: 0 }) });`);
    await p2.eval(`Hooks.off("updateActor", globalThis.__ownhook); delete globalThis.__own; delete globalThis.__ownhook; return true;`);
    await gm.eval(`await game.actors.get("${own}")?.delete(); return true;`);
    await settle(300);
    check("an owner is not removed by a deletion, as on v14 14.370: a ForcedDeletion of p1's entry, dotted or nested, and ownership.-=<p1> leave it at 3 and no hook hears ownership; a module flag's ForcedDeletion takes the flag; a ForcedReplacement of the whole ownership takes p1's entry",
        [ownDot, ownNest, ownOld].every(r => r.p1 === 3 && r.heard.length === 0) && ownFlag.flag === null && ownFlag.p1 === 3 && ownWhole.p1 === null,
        J({ ownDot, ownNest, ownOld, ownFlag, ownWhole }));

    /* A USER'S `active` IS ITS OWN DATA PROPERTY (E58 L1's reading on 14.370, 17.11.2026, relayed by the coordinator;
       lib/shim.mjs `UserImpl`): a User's `active` was an own, writable data property, true for a connected user, with
       nothing on the prototype, so `delete user.active` removed it there. Here, on the GM, p1's User: the descriptor,
       whether the prototype holds one, `active` after a delete, and after the descriptor is put back. */
    const activeRead = await gm.eval(`const u = game.users.get("${IDS.p1}"), d = Object.getOwnPropertyDescriptor(u, "active");
        const out = { own: d ? { value: d.value ?? null, writable: d.writable ?? null, accessor: Boolean(d.get) } : null,
            onProto: Object.getOwnPropertyDescriptor(Object.getPrototypeOf(u), "active") !== undefined };
        if (d) { delete u.active; out.deleted = u.active ?? null; Object.defineProperty(u, "active", d); }
        out.back = u.active;
        return out;`);
    check("a User's active is its own data property, as on v14 14.370: own, writable, true for a connected user, nothing on the prototype; a delete removes it and its descriptor puts it back",
        J(activeRead) === J({ own: { value: true, writable: true, accessor: false }, onProto: false, deleted: null, back: true }), J(activeRead));

    /* ONLY A USER GOES INTO game.users (E58 L1's reading on 14.370, 18.11.2026; client-entry.mjs `holdToUsers`): v14 refused a
       plain object set into the users' collection ("You may only push instances of User") and the tests' own ids, and took an
       unsaved User with a valid 16-character id. Here, on the GM: a plain object; a User with the id "!E17T8primaryGM"; an
       unsaved User with a valid id (`foundry.utils.randomID()`), set, read and deleted. */
    const usersSet = await gm.eval(`const User = CONFIG.User.documentClass, out = {};
        const tryIt = (key, value) => { try { game.users.set(key, value); game.users.delete(key); return "taken"; } catch (e) { return "refused: " + e.message; } };
        out.plain = tryIt("abcdefghijklmnop", { id: "abcdefghijklmnop", name: "00 plain", role: 4, isGM: true, active: true });
        out.badId = tryIt("!E17T8primaryGM", new User({ _id: "!E17T8primaryGM", name: "00 bad id", role: 4 }));
        const good = new User({ _id: foundry.utils.randomID(), name: "00 stand-in", role: 3 }); good.active = true;
        out.good = tryIt(good.id, good);
        out.goodRead = [good.isGM, good.active];
        return out;`);
    check("only a User goes into game.users, as on v14 14.370: a plain object refused with \"You may only push instances of User\", a User with a test's own id refused, an unsaved User with a valid id taken, its isGM by its role and its active set",
        usersSet.plain === "refused: You may only push instances of User" && String(usersSet.badId).startsWith("refused:") && usersSet.good === "taken" && J(usersSet.goodRead) === J([true, true]), J(usersSet));

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
       computed all three hidden. Since E20 C5 (S01-41) a module that stops takes its stylesheets off the page
       (requirements.mjs `removeModuleStyles`, R1516), so the GM there computes all three shown, as Foundry draws them,
       and the page holds no import of the module's. */
    const readStopped = `const drawn = [];
        const draw = (id, html) => { if (document.getElementById(id)) return; const t = document.createElement("template");
            t.innerHTML = html; drawn.push(t.content.firstElementChild); document.body.append(t.content.firstElementChild); };
        const shown = sel => getComputedStyle(document.querySelector(sel)).display !== "none";
        const ours = [...document.styleSheets].flatMap(sheet => [sheet.href ?? "", ...[...(sheet.cssRules ?? [])].map(rule => rule.href ?? "")])
            .filter(href => href.includes("modules/danganronpa-rpg/")).length;
        const read = { stopped: !game.drpg && !game.settings.settings.has("danganronpa-rpg.theme"), gm: game.user.isGM, sheets: ours, hotbar: shown("#hotbar") };
        draw("scene-navigation", '<nav id="scene-navigation"></nav>');
        Hooks.callAll("renderSceneNavigation");
        read.nav = shown("#scene-navigation");
        draw("sidebar-tabs", '<nav id="sidebar-tabs"><button type="button" class="ui-control" data-tab="scenes"></button></nav>');
        Hooks.callAll("renderSidebar");
        read.scenes = shown('#sidebar-tabs button[data-tab="scenes"]');
        drawn.forEach(el => el.remove());
        return read;`;
    await connect("gmoff", { modulesOff: ["avclient-livekit"] });
    await settle(300);
    const stopped = await gmoff.eval(readStopped);
    await disconnect("gmoff");
    check("the GM's chrome when the module stops: a GM whose world has LiveKit switched off sees the Scenes tab, the scene navigation and the hotbar as Foundry draws them",
        stopped.stopped === true && stopped.gm === true && stopped.sheets === 0 && stopped.hotbar && stopped.nav && stopped.scenes, JSON.stringify(stopped));

    /* E20-T3 (E20 C5, 29.10.2026; E20-17, D19; S01-41): the same GM joins again with Dice So Nice switched off. The
       harm: the module stopped, but its stylesheets restyled Foundry and settings.mjs's render hooks, registered when
       the file is imported, read a setting nobody registered and threw on every window drawn. Read after its `ready`:
       no import of the module's left on the page; then a window's render fired as Foundry fires it (`renderApplicationV2`,
       `renderApplication`, `renderSettingsConfig`, each with an element of its own, taken off again) and the errors the
       client recorded since it booted - none. That headless Foundry's hooks are the harness's (lib/shim.mjs) is the
       limit: a real v14 client without Dice So Nice is not measured here. */
    await connect("gmoff", { modulesOff: ["dice-so-nice"] });
    await settle(300);
    const noDice = await gmoff.eval(`const read = { stopped: !game.drpg && !game.settings.settings.has("danganronpa-rpg.theme"),
            dice: game.modules.get("dice-so-nice")?.active ?? null, booted: globalThis.__errors.length };
        read.sheets = [...document.styleSheets].flatMap(sheet => [sheet.href ?? "", ...[...(sheet.cssRules ?? [])].map(rule => rule.href ?? "")])
            .filter(href => href.includes("modules/danganronpa-rpg/")).length;
        const before = globalThis.__errors.length;
        for (const hook of ["renderApplicationV2", "renderApplication", "renderSettingsConfig"]) {
            const element = document.createElement("div");
            document.body.append(element);
            const app = { options: { position: { width: 400, height: 300 } }, constructor: { DEFAULT_OPTIONS: {} }, setPosition() {} };
            Hooks.callAll(hook, app, element);
            element.remove();
        }
        read.thrown = globalThis.__errors.slice(before).map(e => e.where + ": " + e.message);
        return read;`);
    await disconnect("gmoff");
    check("E20-T3 - a GM whose world has Dice So Nice switched off: the module stops, leaves none of its stylesheets on the page, and a window drawn throws nothing",
        noDice.stopped === true && noDice.dice === false && noDice.sheets === 0 && noDice.booted === 0 && noDice.thrown.length === 0, JSON.stringify(noDice));

    /* THE SHIM'S AUTO-ANSWER OF A DEFAULT CLOSE (13.11.2026; docs/dev/gaps/SURVEY-close-action.md). A window that is not
       drawn is answered with its default button, and a footer with no primary makes its Close the default
       (ui-kit.mjs `footerButtons`). At a table Enter presses that button and Foundry's own close takes it, so the wait
       answers null - the shim's assumption for v14, still open as LIVE-E21-06 (shim.mjs `DialogV2.wait`). R4673 holds
       the drawn road; this holds the other one, on p1 with its windows auto-answered for the two calls and put back
       after. OK as the default is the control: it answers its action. */
    const auto = await p1.eval(`
        const was = { auto: globalThis.__dialogAuto, windows: globalThis.__dialogWindows };
        globalThis.__dialogAuto = true; globalThis.__dialogWindows = false;
        try {
            const K = await import("${repoUrl}/scripts/ui-kit.mjs");
            const closeOnly = await K.drpgWindow({ title: "00-boot: Close alone", body: "<p>x</p>", footer: { close: "close" } });
            const withOk = await K.drpgWindow({ title: "00-boot: OK and Close", body: "<p>x</p>", footer: { primary: { action: "ok", label: "OK" }, close: "close" } });
            return { closeOnly, withOk };
        } finally { globalThis.__dialogAuto = was.auto; globalThis.__dialogWindows = was.windows; }`);
    check("p1: a window whose default is its Close auto-answers null, as a closed window (the shim's model of v14, LIVE-E21-06); one whose default is OK answers \"ok\"",
        auto?.closeOnly === null && auto?.withOk === "ok", JSON.stringify(auto));

    await settle(300);
}
