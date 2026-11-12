/**
 * 92-spectator: a Spectator at the table, from its assignment in the Students window to its return to the class
 * (E92 C7, 12.11.2026; plan docs/dev/plans/E92.md on claude/plan-130, the owner's E92 goal and its 04.11 amends).
 *
 * The GM and three players; p3's Chie is made a Spectator by the Students window's Role (gm-students.mjs
 * `changeRole`, the GM's road), and read on the browsers that each part is about:
 *   role     the GM's roster leaves her out (`studentActors`, the trial's cast); p3's browser watches
 *            (scripts/spectator.mjs `spectatorViewer`) and hides its chat (`drpg-spectator`); p1's browser hides her
 *            token (visibility.mjs `tokenShownTo` "hide") and p3's leaves every student's to Foundry (null);
 *   voice    the primary blocks p3's BROADCAST_AUDIO by the trial's own write and row (voice.mjs `settleTrialVoices`),
 *            and p3's tile names it held, "spectator" (`micHold`);
 *   map      Aiko has found the Cafeteria and Botan, the Mastermind, the Hall: p3's copy of the ledger is one row
 *            under Chie's own id (gm-stores.mjs `spectatorFogSection`), with the Cafeteria and not the Hall; p3's
 *            world data read against world-secrets.mjs and for the Mastermind's id (`canary.worldScan`);
 *   ghost    p3 moves Chie into Aiko's room and then into the Hall, through any wall (`spectator.move`): no action
 *            spent, no room found for her, and she is nobody in Aiko's room (`othersInRoom`);
 *   back     the GM makes her a student again: p3's microphone as it was found, the class's rooms off her map,
 *            p3's browser no Spectator's.
 * Everything is put back: the role, the token, the cells, the Mastermind, p3's permission.
 *
 * What this cannot see: a real LiveKit (the harness's shim), Foundry's wall collision on a player's drag
 * (LIVE-E92-02), the canvas's grey token (LIVE-E92-04), and the chat's CSS on a real sidebar.
 */
export const layers = ["ci"];


export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const p3User = await p3.eval(`return game.user.id;`);

    phase("setup");
    const before = await gm.eval(`const F = ${imp("fog.mjs")}, MM = ${imp("mastermind.mjs")};
        const scene = canvas.scene, t = scene.tokens.get("TOKCHIE000000000"), u = game.users.get("${p3User}");
        const own = (u._source ?? u).permissions ?? {};
        const rows = Object.fromEntries(["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"].map(id => [id, F.discoveredFor(scene.id, id).slice()]));
        return { scene: scene.id, x: t.x, y: t.y, rows, mastermind: MM.mastermindActor()?.id ?? null,
            perm: [Object.hasOwn(own, "BROADCAST_AUDIO"), own.BROADCAST_AUDIO ?? null], actions: game.drpg.actionsLeft(game.actors.get("${IDS.chie}")) };`);
    check("setup: the scene, Chie's token and the three students' rows are read", Boolean(before?.scene && Number.isFinite(before.x)), JSON.stringify(before));
    const fixture = await gm.eval(`const F = ${imp("fog.mjs")}, MM = ${imp("mastermind.mjs")};
        const scene = canvas.scene, u = game.users.get("${p3User}");
        await u.update({ "permissions.BROADCAST_AUDIO": true });
        await F.applyDiscoveryChanges(scene, [{ actorId: "${IDS.aiko}", room: "Cafeteria", value: true }, { actorId: "${IDS.botan}", room: "Hall", value: true },
            { actorId: "${IDS.chie}", room: "Hall", value: false }, { actorId: "${IDS.chie}", room: "Cafeteria", value: false }]);
        await MM.setMastermind(game.actors.get("${IDS.botan}"));
        return { aiko: F.discoveredFor(scene.id, "${IDS.aiko}").includes("Cafeteria"), botan: F.discoveredFor(scene.id, "${IDS.botan}").includes("Hall"),
            mastermind: MM.mastermindActor()?.id ?? null };`, { timeout: 60000 });
    check("setup: Aiko holds the Cafeteria found, Botan the Hall, and Botan is the Mastermind",
        fixture?.aiko === true && fixture?.botan === true && fixture?.mastermind === IDS.botan, JSON.stringify(fixture));
    await settle(800);

    try {
        phase("role");
        const role = await gm.eval(`const GS = ${imp("gm-students.mjs")}, M = ${imp("monokuma.mjs")}, TS = ${imp("trial-scene.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            const moved = await GS.changeRole(chie, "spectator");
            return { moved, spectator: M.isSpectator(chie), roster: M.studentActors().some(a => a.id === chie.id), cast: TS.castActors().some(a => a.id === chie.id) };`);
        await settle(1500);
        check("role: the Students window's Role makes Chie a Spectator, out of the GM's roster and the trial's cast",
            role?.moved === true && role.spectator === true && role.roster === false && role.cast === false, JSON.stringify(role));
        const watching = await p3.eval(`const S = ${imp("spectator.mjs")}, V = ${imp("visibility.mjs")};
            const aiko = canvas.scene.tokens.get("TOKAIKO000000000");
            return { viewer: S.spectatorViewer(), chatHidden: document.body.classList.contains("drpg-spectator"), sees: V.tokenShownTo(aiko, V.viewerHere()) };`);
        const hidden = await p1.eval(`const V = ${imp("visibility.mjs")};
            return V.tokenShownTo(canvas.scene.tokens.get("TOKCHIE000000000"), V.viewerHere());`);
        check("role: p3's browser watches, hides its chat and leaves Aiko's token to Foundry; p1's hides Chie's",
            watching?.viewer === true && watching.chatHidden === true && watching.sees === null && hidden === "hide", JSON.stringify({ watching, hidden }));

        phase("voice");
        await settle(1200);
        const voice = await gm.eval(`const u = game.users.get("${p3User}"), own = (u._source ?? u).permissions ?? {};
            const S = ${imp("gm-stores.mjs")}, r = S.trialMuteStore.get(u.id);
            return { perm: own.BROADCAST_AUDIO ?? null, row: r ? { had: r.had, value: r.value, wrote: r.wrote } : null };`);
        const tile = await p3.eval(`const V = ${imp("voice.mjs")};
            return V.micHold({ room: "drpg-somewhere", external: false, connected: true, canBroadcastAudio: true });`);
        check("voice: the primary blocks p3's microphone by the trial's row, and p3's tile names it held",
            voice?.perm === false && voice.row?.wrote === true && voice.row.had === true && voice.row.value === true
            && tile?.reason === "spectator" && tile.held === true, JSON.stringify({ voice, tile }));

        phase("map");
        await settle(800);
        const map = await p3.eval(`const F = ${imp("fog.mjs")}, { readMine } = ${imp("gm-store.mjs")};
            const rooms = [...F.myDiscoveredRooms(canvas.scene)].sort();
            const copy = readMine("fog") ?? {};
            return { rooms, keys: Object.keys(copy?.e ?? {}).sort() };`);
        check("map: p3's map holds the room Aiko found and not the Mastermind's, in one row under Chie's own id",
            map?.rooms?.includes("Cafeteria") && !map.rooms.includes("Hall") && map.keys.length >= 1 && map.keys.every(k => k.endsWith(`/${IDS.chie}`)),
            JSON.stringify(map));
        await canary.worldScan({ who: ["p3"], ids: [IDS.botan] });

        phase("ghost");
        const ask = (x, y) => p3.eval(`const B = ${imp("bridge-asks.mjs")};
            const res = await B.requestSpectatorMove(canvas.scene.id, "TOKCHIE000000000", ${x}, ${y});
            return { ok: res.ok === true, refused: res.refused ?? null };`);
        const intoDorm = await ask(400, 400);
        await settle(1500);
        const company = await gm.eval(`const M = ${imp("movement.mjs")};
            return { room: M.roomOfToken(canvas.scene.tokens.get("TOKCHIE000000000")), others: M.othersInRoom(game.actors.get("${IDS.aiko}")).map(a => a.id) };`);
        const intoHall = await ask(2400, 400);
        await settle(1500);
        const ghost = await gm.eval(`const F = ${imp("fog.mjs")}, M = ${imp("movement.mjs")};
            const t = canvas.scene.tokens.get("TOKCHIE000000000");
            return { x: t.x, y: t.y, room: M.roomOfToken(t), found: F.discoveredFor(canvas.scene.id, "${IDS.chie}").includes("Hall"),
                actions: game.drpg.actionsLeft(game.actors.get("${IDS.chie}")) };`);
        check("ghost: p3 moves Chie into Aiko's room, where she is nobody, then into the Hall: no action spent, no room found",
            intoDorm?.ok === true && company?.room === "Dorm A" && !company.others.includes(IDS.chie)
            && intoHall?.ok === true && ghost?.room === "Hall" && ghost.found === false && ghost.actions === before.actions,
            JSON.stringify({ intoDorm, company, intoHall, ghost }), { flow: "spectator-move" });

        phase("back");
        const back = await gm.eval(`const GS = ${imp("gm-students.mjs")}, M = ${imp("monokuma.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            return { moved: await GS.changeRole(chie, "student"), spectator: M.isSpectator(chie), roster: M.studentActors().some(a => a.id === chie.id) };`);
        await settle(2000);
        const after = await gm.eval(`const u = game.users.get("${p3User}"), own = (u._source ?? u).permissions ?? {};
            const S = ${imp("gm-stores.mjs")};
            return { perm: [Object.hasOwn(own, "BROADCAST_AUDIO"), own.BROADCAST_AUDIO ?? null], row: S.trialMuteStore.has(u.id) };`);
        const p3After = await p3.eval(`const F = ${imp("fog.mjs")}, S = ${imp("spectator.mjs")};
            return { viewer: S.spectatorViewer(), chatHidden: document.body.classList.contains("drpg-spectator"),
                rooms: [...F.myDiscoveredRooms(canvas.scene)].sort() };`);
        check("back: Chie is a student again, p3's microphone as it was found, the class's rooms off her map, p3's browser no Spectator's",
            back?.moved === true && back.spectator === false && back.roster === true && JSON.stringify(after?.perm) === JSON.stringify([true, true])
            && after.row === false && p3After?.viewer === false && p3After.chatHidden === false && !p3After.rooms.includes("Cafeteria"),
            JSON.stringify({ back, after, p3After }));
    } finally {
        await gm.eval(`const GS = ${imp("gm-students.mjs")}, M = ${imp("monokuma.mjs")}, F = ${imp("fog.mjs")}, MM = ${imp("mastermind.mjs")};
            const { forcedDeletion } = ${imp("utils.mjs")};
            const chie = game.actors.get("${IDS.chie}"), scene = canvas.scene, u = game.users.get("${p3User}");
            if (M.isSpectator(chie)) await GS.changeRole(chie, "student");
            await scene.tokens.get("TOKCHIE000000000").update({ x: ${before?.x ?? 350}, y: ${before?.y ?? 1300} }, { animate: false });
            const was = ${JSON.stringify(before?.rows ?? {})};
            const changes = [];
            for (const [id, rooms] of Object.entries(was)) {
                for (const room of ["Cafeteria", "Hall"]) changes.push({ actorId: id, room, value: rooms.includes(room) });
            }
            await F.applyDiscoveryChanges(scene, changes);
            const mm = ${JSON.stringify(before?.mastermind ?? null)};
            if (mm) await MM.setMastermind(game.actors.get(mm)); else await MM.clearMastermind();
            const perm = ${JSON.stringify(before?.perm ?? [false, null])};
            await u.update({ "permissions.BROADCAST_AUDIO": perm[0] ? perm[1] : forcedDeletion() });
            return true;`, { timeout: 60000 });
        await settle(1500);
    }
}
