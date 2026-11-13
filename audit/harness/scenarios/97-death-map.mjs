/**
 * 97-death-map: what a death lays on the map, road by road (the owner's report of 13.11.2026 at a table on 1.2.112:
 * "Killing a character makes 3 tokens appear: the body, the Spectator and... a third, inactive token").
 *
 * Measured at 1.2.112 (ceb9e9c8) with this scenario's own listing: every road below adds one Spectator token (its actor
 * flagged `spectator` and `watcherOf`) and one body tile (flagged `bodyOf`, the token's picture, drawn at Foundry's
 * default alpha) beside the student's own token, which stays the corpse - three things where the corpse stood, the
 * third the tile (body-tile.mjs `leaveBody`, E63, and its caption and dead sign, E95 C3). No road made two Spectators
 * or two tiles, two GMs at once included. The coordinator's default for the owner (13.11.2026): a death shows the body
 * and the Spectator and nothing else; the tile stays the data the body's readers ask, laid at alpha 0, and the caption
 * "{name}'s body" moves onto the corpse's token.
 *
 * The GM, p1 and p3 (Chie's player), and a second GM for the last part. Chie dies by each road, and after each the
 * map is read on the GM: her own token there and shown, one Spectator token and no other new token, her body tile
 * laid and not drawn (alpha 0 or hidden), the body's room the corpse's room on the GM and on p1 (body-tile.mjs
 * `bodyRoomOf`, read through the tile), and the caption on her token as p1's browser draws it (`drawCorpseCaption` on a
 * stand-in placeable holding the token's document: the harness has no canvas and no draw hooks). Then she is revived
 * and the map is what it was. The roads:
 *   kill       the Students window's Kill, a death public at once (chapter.mjs `killCharacter`, `secret: false`);
 *   kept       a death the GMs keep (`secret: true`): the corpse and the Spectator, no tile; then `publishDeath`;
 *   execution  the sentence's road (trial-progress.mjs `carryOutSentence` -> `killCharacter`, phase "classTrial", cause
 *              "executed");
 *   dead       the Players window's "dead" (gm-students.mjs `applyAliveStates`);
 *   gm2        with a second GM: the kill with gm2 present, a kept death both GMs publish at once, both GMs marking her
 *              dead in the Players window at once, and both GMs making her Spectator at once
 *              (spectator-dead.mjs `ensureDeadSpectator`): one Spectator each time.
 *
 * What this cannot see: the canvas. Whether Foundry v14 draws a Tile at alpha 0 to no one, and the caption's place
 * over a real token, are the table's to see (LIVE-E95-01).
 */
export const layers = ["ci"];
export const timeoutMs = 300000;
export const accounts = [{ who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }];

export async function run({ gm, gm2, p1, check, phase, settle, connect, disconnect, storageOf, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const CORPSE = "TOKCHIE000000000";
    const MOD = "danganronpa-rpg";
    /* Every token and tile on every scene, named: its actor and flags, hidden, alpha. */
    const LIST = `const out = [];
        for (const s of game.scenes) {
            for (const t of s.tokens) { const a = game.actors.get(t.actorId);
                out.push({ kind: "token", id: t.id, actor: a?.name ?? t.actorId, actorFlags: Object.keys(a?.flags?.["${MOD}"] ?? {}).sort().join("+"),
                    watcherOf: a?.flags?.["${MOD}"]?.watcherOf ?? null, flags: Object.keys(t.flags?.["${MOD}"] ?? {}).sort().join("+"),
                    hidden: Boolean(t.hidden), alpha: t.alpha ?? null }); }
            for (const t of s.tiles) out.push({ kind: "tile", id: t.id, actor: game.actors.get(t.flags?.["${MOD}"]?.bodyOf?.actorId)?.name ?? null,
                bodyOf: t.flags?.["${MOD}"]?.bodyOf?.actorId ?? null, flags: Object.keys(t.flags?.["${MOD}"] ?? {}).sort().join("+"),
                hidden: Boolean(t.hidden), alpha: t.alpha ?? null });
        }
        return out;`;
    /* The reading after a death: what the map shows of Chie, and where her body is read. A tile is drawn unless it is
       hidden or at alpha 0 (Foundry's default alpha is 1, so a tile with none is drawn). */
    const READ = `const B = ${imp("body-tile.mjs")}, M = ${imp("movement.mjs")};
        const chie = game.actors.get("${IDS.chie}"); const out = [];
        for (const s of game.scenes) for (const t of s.tokens) if (t.actorId === chie.id || game.actors.get(t.actorId)?.getFlag("${MOD}", "watcherOf") === chie.id
            || (game.actors.get(t.actorId)?.getFlag("${MOD}", "spectator") && game.actors.get(t.actorId)?.name === chie.name)) out.push(t);
        const corpse = out.filter(t => t.id === "${CORPSE}");
        const spectators = out.filter(t => t.id !== "${CORPSE}");
        const tiles = B.bodyTilesOf(chie.id).map(({ doc }) => doc);
        const place = B.bodyPlaceOf(chie);
        return { corpse: corpse.map(t => ({ hidden: Boolean(t.hidden), alpha: t.alpha ?? 1 })), corpseRoom: corpse[0] ? M.roomOfToken(corpse[0]) : null,
            spectators: spectators.map(t => ({ id: t.id, actorFlags: Object.keys(game.actors.get(t.actorId)?.flags?.["${MOD}"] ?? {}).sort().join("+"), hidden: Boolean(t.hidden) })),
            watchers: game.actors.filter(a => a.getFlag("${MOD}", "spectator") && (a.getFlag("${MOD}", "watcherOf") === chie.id || a.name === chie.name)).length,
            tiles: tiles.map(t => ({ hidden: Boolean(t.hidden), alpha: t.alpha ?? null, drawn: !t.hidden && (t.alpha ?? 1) !== 0 })),
            via: place?.via ?? null, room: place?.room ?? null };`;
    const ROOM_P1 = `const B = ${imp("body-tile.mjs")}; const p = B.bodyPlaceOf(game.actors.get("${IDS.chie}")); return { via: p?.via ?? null, room: p?.room ?? null };`;
    /* The caption as p1's browser draws it over the corpse's token: a stand-in placeable holding the token's document. */
    const CAPTION = `const B = ${imp("body-tile.mjs")};
        if (typeof B.drawCorpseCaption !== "function") return "body-tile.mjs has no drawCorpseCaption";
        const stand = new PIXI.Container(); stand.document = canvas.scene.tokens.get("${CORPSE}");
        const mark = B.drawCorpseCaption(stand);
        const words = (mark?.children ?? []).filter(c => c instanceof PIXI.Text).map(c => c.text);
        stand.destroy({ children: true });
        return { words, want: game.i18n.format("DRPG.Body.tile", { name: game.actors.get("${IDS.chie}").name }) };`;
    const RESET = `const C = ${imp("chapter.mjs")};
        const chie = game.actors.get("${IDS.chie}");
        if (C.isDeadForGm(chie)) await C.reviveCharacter(chie, { quiet: true, silent: true });
        for (const a of game.actors.filter(a => a.getFlag("${MOD}", "watcherOf") === chie.id || (a.getFlag("${MOD}", "spectator") && a.name === chie.name))) {
            for (const s of game.scenes) for (const t of [...s.tokens].filter(t => t.actorId === a.id)) await t.delete();
            await a.delete(); }
        for (const s of game.scenes) { const ids = [...s.tiles].filter(t => t.flags?.["${MOD}"]?.bodyOf?.actorId === chie.id).map(t => t.id);
            if (ids.length) await s.deleteEmbeddedDocuments("Tile", ids); }
        return true;`;
    const listed = rows => rows.map(r => `${r.kind} ${r.actor}${r.actorFlags ? ` [${r.actorFlags}]` : ""}${r.flags ? ` {${r.flags}}` : ""} hidden=${r.hidden} alpha=${r.alpha}`);
    const added = (before, after) => { const was = new Set(before.map(r => r.id)); return after.filter(r => !was.has(r.id)); };

    /* One death read: two things on the map and the body's readers. `tiles` is how many body tiles the road lays (1, or 0
       for a death the GMs keep). */
    const judge = async (road, before, { tiles = 1, two = false } = {}) => {
        const after = await gm.eval(LIST);
        const read = await gm.eval(READ);
        const p1Room = await p1.eval(ROOM_P1);
        const caption = await p1.eval(CAPTION);
        const fresh = added(before, after);
        console.log(`[97] ${road}: new on the map\n    ${listed(fresh).join("\n    ") || "(nothing)"}`);
        const shown = (read?.corpse?.length === 1 && !read.corpse[0].hidden ? 1 : 0) + (read?.spectators?.length ?? 0)
            + (read?.tiles ?? []).filter(t => t.drawn).length;
        check(`${road}: the map shows two things of Chie's death - her own token, the corpse, shown, and one Spectator token - and no other new token`,
            read?.corpse?.length === 1 && read.corpse[0].hidden === false && read.spectators?.length === 1
            && read.spectators[0].actorFlags === (tiles ? "spectator+watcherOf" : "spectator") && read.watchers === 1
            && fresh.filter(r => r.kind === "token").length === 1, JSON.stringify({ read, fresh: listed(fresh) }));
        /* Two GMs laying one death at once can lay two tiles (body-tile.mjs `leaveBody`, the E95 stage's risk 4: the readers
           take the earliest, every removal takes both); not drawn, they show nothing, so `two` allows a second there. */
        const laid = read?.tiles?.length ?? -1;
        check(`${road}: ${tiles ? `her body tile is laid${two ? " (one, or two by two GMs at once)" : ""} and not drawn (alpha 0 or hidden)` : "no body tile while the GMs keep the death"}; ${shown} thing(s) of hers drawn`,
            (laid === tiles || (two && tiles && laid === 2)) && read.tiles.every(t => !t.drawn) && shown === 2, JSON.stringify({ tiles: read?.tiles, shown }));
        if (tiles) {
            check(`${road}: the body's readers answer the corpse's room through the tile, on the GM and on p1 (body-tile.mjs \`bodyPlaceOf\`)`,
                Boolean(read?.corpseRoom) && read.via === "tile" && read.room === read.corpseRoom && p1Room?.via === "tile" && p1Room.room === read.corpseRoom,
                JSON.stringify({ gm: { via: read?.via, room: read?.room }, corpseRoom: read?.corpseRoom, p1: p1Room }));
            check(`${road}: p1's browser captions the corpse's token "{name}'s body" (the label of the owner's DC6, moved off the tile)`,
                Array.isArray(caption?.words) && caption.words.length === 1 && caption.words[0] === caption.want, JSON.stringify(caption));
        }
        return read;
    };

    phase("setup");
    const start = await gm.eval(LIST);
    const room = await gm.eval(`const M = ${imp("movement.mjs")}; return M.roomOfToken(canvas.scene.tokens.get("${CORPSE}"));`);
    check("setup: Chie's token stands in a room, and nothing on the map is hers but it", Boolean(room)
        && start.filter(r => r.actor === "Chie Mori").length === 1, JSON.stringify({ room, mine: start.filter(r => r.actor === "Chie Mori") }));
    let gm2On = false;
    try {
        const roads = [
            ["kill", `const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}"), { secret: false, keepBullets: true }));`],
            ["execution", `const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}"), { secret: false, phase: "classTrial", cause: "executed", keepBullets: true }));`],
            ["dead", `const S = ${imp("gm-students.mjs")}; return (await S.applyAliveStates({ "${IDS.chie}": { state: "dead" } })) === 1;`]
        ];
        for (const [road, code] of roads) {
            phase(road);
            const before = await gm.eval(LIST);
            const ran = await gm.eval(code, { timeout: 60000 });
            await settle(1500);
            check(`${road}: Chie dies by this road`, ran === true, JSON.stringify(ran));
            await judge(road, before);
            await gm.eval(RESET, { timeout: 60000 });
            await settle(1200);
        }

        phase("kept");
        let before = await gm.eval(LIST);
        await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}"), { secret: true, keepBullets: true }));`, { timeout: 60000 });
        await settle(1500);
        await judge("kept (before it is made known)", before, { tiles: 0 });
        const published = await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.publishDeath(game.actors.get("${IDS.chie}")));`, { timeout: 60000 });
        await settle(1500);
        check("kept: the death is made known", published === true, JSON.stringify(published));
        await judge("kept, then made known", before);
        await gm.eval(RESET, { timeout: 60000 });
        await settle(1200);

        phase("gm2");
        await connect("gm2", { storage: await storageOf("gm") });
        gm2On = true;
        await settle(2000);
        before = await gm.eval(LIST);
        await gm.eval(roads[0][1], { timeout: 60000 });
        await settle(2000);
        await judge("gm2 present, the GM kills", before);
        await gm.eval(RESET, { timeout: 60000 });
        await settle(2000);

        before = await gm.eval(LIST);
        await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}"), { secret: true, keepBullets: true }));`, { timeout: 60000 });
        await settle(2500);
        const pub = `const C = ${imp("chapter.mjs")}; return Boolean(await C.publishDeath(game.actors.get("${IDS.chie}")));`;
        await Promise.all([gm.eval(pub, { timeout: 60000 }), gm2.eval(pub, { timeout: 60000 })]);
        await settle(2500);
        await judge("gm2: both GMs make a kept death known at once", before, { two: true });
        await gm.eval(RESET, { timeout: 60000 });
        await settle(2000);

        before = await gm.eval(LIST);
        await Promise.all([gm.eval(roads[2][1], { timeout: 60000 }), gm2.eval(roads[2][1], { timeout: 60000 })]);
        await settle(2500);
        await judge("gm2: both GMs mark her dead in the Players window at once", before, { two: true });

        /* The narrowest road two GMs share: each makes her Spectator at the same moment, before either actor exists - her
           watcher taken away first, the death left standing. */
        await gm.eval(`const D = ${imp("spectator-dead.mjs")}; const chie = game.actors.get("${IDS.chie}");
            const w = D.watcherActorOf(chie); if (w) { for (const s of game.scenes) for (const t of [...s.tokens].filter(t => t.actorId === w.id)) await t.delete(); await w.delete(); }
            return true;`, { timeout: 60000 });
        await settle(2000);
        before = await gm.eval(LIST);
        const make = `const D = ${imp("spectator-dead.mjs")}; return (await D.ensureDeadSpectator(game.actors.get("${IDS.chie}"), { silent: true }))?.id ?? null;`;
        const made = await Promise.all([gm.eval(make, { timeout: 60000 }), gm2.eval(make, { timeout: 60000 })]);
        await settle(3000);
        const race = await gm.eval(READ);
        const raceNew = added(before, await gm.eval(LIST));
        console.log(`[97] gm2: both GMs make her Spectator at once (${JSON.stringify(made)}): new on the map\n    ${listed(raceNew).join("\n    ") || "(nothing)"}`);
        check("gm2: both GMs making her Spectator at once leave one watcher and one Spectator token",
            race?.watchers === 1 && race.spectators?.length === 1 && raceNew.length === 1, JSON.stringify({ made, race, raceNew: listed(raceNew) }));
    } finally {
        await gm.eval(RESET, { timeout: 60000 });
        await settle(1500);
        if (gm2On) await disconnect("gm2");
    }
    const end = await gm.eval(LIST);
    const key = rows => JSON.stringify(rows.map(r => [r.kind, r.id, r.actor, r.flags, r.hidden]).sort());
    check("restore: the map is as it was", key(end) === key(start), JSON.stringify({ added: listed(added(start, end)), gone: listed(added(end, start)) }));
}
