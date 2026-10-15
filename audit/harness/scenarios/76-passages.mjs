/**
 * The secret passages (E79, 1.2.78; the E79 plan's 2.2): who may know a passage, on four clients.
 *
 * A secret passage lives in the GMs' store and in the copies addressed to whoever may use it, and
 * nowhere else - not on a Wall, a Region or the Scene, not in a setting, not on the wire to anybody
 * else. A silence is only worth something if the reader would have heard it, so this scenario reads
 * every browser whole (`dump`, client-entry.mjs dumpForCanary, with the cluster's record of its
 * console) for the passage's own numeric marker: every passage the phases make starts its segment at
 * the x coordinate 1234.5, a number the harness world holds nowhere, searchable as a number in JSON,
 * in markup and in a log line. The marker is this scenario's until E43 takes the canary to numbers
 * (the plan's REL5). It is written in phases, one per commit of E79 that has something here to read:
 * 0 (C0): the probe measured on its own, before any module code reads a passage. On p1 the marker is
 *   planted by hand on every surface the later phases read - a wall and a region in the scene's
 *   source, the scene's flags, p1's own User, a world setting in p1's memory, a key in localStorage
 *   (which is also where the harness keeps client settings, so it reads as both) and in
 *   sessionStorage, a node in the page, a notification, a console line, and a packet the GM addresses
 *   to p1 alone - each changed on p1's client only, never written to the world. The probe finds it on
 *   each of them; the same dump with the marker turned into another number reads nothing anywhere
 *   (the control: a green here was the marker, not something else that matched); p2 and p3, where
 *   nothing was planted, read nothing on every surface, and the surfaces they read are not empty (but their
 *   notifications and sessionStorage, which hold nothing yet: those two are measured on p1 alone).
 *   The plants are taken back and p1 reads nothing outside phase 0's wire and console, which cannot
 *   be taken back and which the later phases leave out by phase. Then p3's world as found - the
 *   world-secrets rule's scan (`worldScan`, lib/canary.mjs) with no hit, and the walls, the regions,
 *   the scenes' flags and the module's world settings p3 holds - is kept for phases A, E and G.
 * A (C1): the GM creates a passage on a wall it has just drawn, then grants Aiko (p1's). p1's copy holds
 *   exactly that row; p2 and p3 read neither the marker nor the passage's id on any surface outside phase 0's
 *   wire and console; p3's world is the world as found but for the GM's new wall, after the create and after
 *   the grant; every copy the GM sends names one player; a copy p2 forges for p3 is refused; and an ask with
 *   junk fields from p2 is answered to p2 alone, with p2's own copy, which holds nothing.
 * B (C2): the client's cut, on the harness's minimal move backend (lib/shim.mjs buildPolygonBackends). Every client's
 *   move backend is the module's, and none was told the passages cannot open; on p1 Aiko's token passes her
 *   passage and is stopped beside it, while sight and a move with no token are stopped in it; every other token -
 *   another character's on p1, p2 and the GM's, Aiko's own on p2, Chie's on p3 - is stopped in it, and on the GM's
 *   browser Aiko's passes as on p1.
 * C (C3): the gap and the veto. The GM draws a Kitchen under the Cafeteria whose own list names the Gym alone (so the
 *   two are not neighbours by the map), a wall the whole length of their border and a passage in it, granted to Aiko,
 *   and puts Aiko's token in the Cafeteria. The Cafeteria's outline (fog-doorways.mjs `doorwayEdges`, with the
 *   harness's polygons given a real inside test for the one call: they contain no point otherwise) opens the passage
 *   for Aiko on p1 and nowhere else, and is the outline with no character for Botan on p2, Chie on p3 and Aiko on the
 *   GM's browser. p1 moves Aiko through: it lands, and the primary GM's judge finds it lawful and tells nobody; p2
 *   moves Botan the same way and is refused with the sentence the map gives (`crossingRefused`). Then, on p1, the
 *   veto with the passage named (`via`) is asked into the Kitchen under a GM's lock (the gap closes as well), a seal,
 *   the chain and another's bedroom: refused, refused, refused, let through - and the bedroom without `via` refused.
 * D (C4): the GM's audit (movement-audit.mjs), with the world switch on `sendBack`. Inside the Cafeteria, so that no room
 *   is crossed and the room rules have nothing to say, the GM draws an ordinary wall and a wall with a passage granted
 *   to Aiko. p2, with its own veto taken off, moves Botan through each: both are put back where the GM last saw him,
 *   p2 alone is sent `move.sentBack` and reads the veto's sentence for the room he stands in, the GMs alone are
 *   whispered, and the Debug log rows differ in their `passage` field only. A REVERT the GM never wrote, Foundry's
 *   teleport and a displace are put back the same way, and so is a move while the GM looks at the Annex. A GM's own
 *   move through the wall stands, a REVERT p2 writes back to where Botan stood a moment ago stands, and Aiko through
 *   her own passage stands. In `log` mode the move stands and the GM's Debug log has the row. The fuzz substitute:
 *   `move.sentBack` forged by p2 for p3, and one from the primary with a code nobody knows, are refused on the
 *   player's browser with a reason in its log; a `passage.request` of junk types is answered to p2 alone; none of it
 *   writes a document or throws. E (C5): Close, Open and revoke. F (C6): the GM's overlay. G (C7): a show.
 *   The `refused` sound the mover plays is not read: the harness maps no sound file, so `playSfx` plays nothing.
 *   A stair link is R559's alone: the harness world has no floors on this scene.
 *
 * What the harness cannot settle - a real canvas's move backend, the ruler and the keyboard, a GM on
 * another scene at a real table - is the stage's LIVE rows, which AUDIT 9.2 gets with C8 (the check that
 * reads their ids waits for them).
 */
import { worldScan } from "../lib/canary.mjs";

export const layers = ["ci"];
/* Measured alone on 14.10.2026 (C0's phase 0, two green runs under the harness lock): 5 checks in 0.85-0.87 s by
   the cluster's own line, 5.6-5.9 s of wall time with the boot. 60 s is 73's and 75's bound for a scenario of four clients
   and a few evals; a phase that adds minutes raises it with a reading of its own. With phase D (C4, 14.10.2026, one run
   under the harness lock): 33 checks in 32.5 s by the cluster's line, each of D's moves waited 1-1.5 s - so 120 s,
   for the boot and for a2.sh's three lanes, which this reading did not run in. */
export const timeoutMs = 120000;

const J = value => JSON.stringify(value);

/* The passages' marker, as a number and as text: not inside a longer number (11234.5, 1234.55 or 0.1234.5). */
const MARK = 1234.5;
const MARK_RE = /(?<![\d.])1234\.5(?!\d)/g;
const PHASE0 = "0: the passages' marker - found on each surface it is planted on, nothing where it is not, and p3's world as found";

/* Each surface of one browser's dump, as the later phases name them. A wall and a region are read in the
   scene's source, apart from the rest of the scene; every other collection is a document. `skip` leaves out
   the wire's and the console's records of one phase (they cannot be taken back). */
function surfaces(dump, { skip = null } = {}) {
    const scenes = dump?.world?.Scene ?? [];
    const rest = Object.entries(dump?.world ?? {}).filter(([name]) => name !== "Scene").flatMap(([, docs]) => docs ?? []);
    return {
        wall: scenes.map(s => s?.walls ?? []),
        region: scenes.map(s => s?.regions ?? []),
        scene: scenes.map(({ walls, regions, ...s }) => s),
        document: rest,
        setting: dump?.settings?.world ?? {},
        clientStore: dump?.settings?.client ?? {},
        localStorage: dump?.storage?.local ?? {},
        sessionStorage: dump?.storage?.session ?? {},
        socket: (dump?.wire ?? []).filter(w => w.phase !== skip),
        dom: dump?.dom ?? "",
        notification: dump?.notifications ?? [],
        console: (dump?.console ?? []).filter(c => c.phase !== skip).map(c => c.text)
    };
}
/* The marker's places in one dump, by surface; `re` is the needle (the control hands it another). */
function probe(dump, { skip = null, re = MARK_RE } = {}) {
    const out = {};
    for (const [surface, value] of Object.entries(surfaces(dump, { skip }))) {
        const text = typeof value === "string" ? value : JSON.stringify(value);
        out[surface] = [...text.matchAll(new RegExp(re.source, "g"))].length;
    }
    return out;
}
const total = counts => Object.values(counts).reduce((a, b) => a + b, 0);
const sizes = dump => Object.fromEntries(Object.entries(surfaces(dump)).map(([s, v]) => [s, (typeof v === "string" ? v : JSON.stringify(v)).length]));

/* What p3 holds of walls, regions, the scenes' flags and the module's world settings: tokens are left out on
   purpose - every phase moves them, and a passage is not a token's. */
const worldPrint = (dump, { without = null } = {}) => J({
    scenes: (dump?.world?.Scene ?? []).map(s => ({ id: s?._id, walls: (s?.walls ?? []).filter(w => w?._id !== without), regions: s?.regions ?? [], flags: s?.flags ?? {} })),
    settings: Object.fromEntries(Object.entries(dump?.settings?.world ?? {}).filter(([key]) => key.startsWith("danganronpa-rpg.")))
});

export async function run({ gm, p1, p2, p3, check, phase, settle, dump, socketTraffic, opLog, IDS, repoUrl }) {
    phase(PHASE0);
    /* The GM's load migration is waited for before anything is read (E79 C1, 14.10.2026). Its writes - the unstamped
       harness world opens the students' sheets - reach p3 as world changes. In a2.sh's first queue (three lanes) one
       run read phase A's "p3's world as found" different on both prints, and its log shows the migration's line after
       phase A had begun; run alone, the scenario read 12/12 twice and the line comes before phase 0's checks. The
       cause is read from that log order, not reproduced under load. Awaited, the baseline is the world once the load
       has finished writing (15-held and 65-season wait for it the same way). */
    await gm.eval(`await (await import("${repoUrl}/scripts/migrate.mjs")).migrationOnLoad(); return true;`);
    await settle(300);
    /* Planted on p1's client alone: the scene's source and p1's User changed in memory (`_source`, no update, so
       nothing reaches the world or the other browsers), a world value in p1's own settings map, the two storages,
       the page, a notification and a console line; then a packet the GM sends to p1 and nobody else. */
    const planted = await p1.eval(`
        const scene = game.scenes.get(${J(IDS.scene)});
        if (!scene) return { scene: false };
        scene._source.walls.push({ _id: "drpgProbe76Wall0", c: [${MARK}, 100, ${MARK}, 300] });
        scene._source.regions.push({ _id: "drpgProbe76Regn0", shapes: [{ type: "polygon", points: [${MARK}, 100, ${MARK}, 300, 1300, 300] }] });
        scene._source.flags = { ...(scene._source.flags ?? {}), "drpg-harness": { probe: ${MARK} } };
        game.user._source.flags = { ...(game.user._source.flags ?? {}), "drpg-harness": { probe: ${MARK} } };
        game.settings.storage.get("world").set("drpg-harness.probe76", { x: ${MARK} });
        localStorage.setItem("drpg-harness.probe76", JSON.stringify({ x: ${MARK} }));
        sessionStorage.setItem("drpg-harness.probe76", JSON.stringify({ x: ${MARK} }));
        const node = document.createElement("div");
        node.id = "drpg-probe76"; node.textContent = "x ${MARK}";
        document.body.append(node);
        ui.notifications.info("probe ${MARK}");
        console.log("drpg-harness probe76 ${MARK}");
        return { scene: true };`);
    await gm.eval(`game.socket.emit("module.drpg-harness-selftest", { probe76: ${MARK} }, { recipients: [${J(IDS.p1)}] }); return true;`);
    await settle(800);
    const d1 = await dump("p1"), d2 = await dump("p2"), d3 = await dump("p3");
    const on1 = probe(d1);
    const missed = Object.entries(on1).filter(([, n]) => n === 0).map(([s]) => s);
    check("0: on p1 the probe finds the marker on every surface it was planted on: a wall, a region, the scene, a document, a world setting, the client store and localStorage, sessionStorage, the wire, the page, a notification and the console",
        planted.scene === true && missed.length === 0, J({ planted, on1, missed }));
    /* The control: the same dump, the marker read as another number - 1234.6, which the plants never wrote. A
       probe that counted something other than the marker would count it here too. */
    const control = probe(d1, { re: /(?<![\d.])1234\.6(?!\d)/g });
    const other = JSON.parse(J(d1).replace(MARK_RE, "1234.6"));
    const unmarked = probe(other), moved = probe(other, { re: /(?<![\d.])1234\.6(?!\d)/g });
    check("0: the control - p1's planted dump with the marker turned into another number reads nothing on any surface, and a needle of that number finds every place the marker was",
        total(control) === 0 && total(unmarked) === 0 && J(moved) === J(on1), J({ control, unmarked, moved }));
    const on2 = probe(d2), on3 = probe(d3);
    const read2 = sizes(d2), read3 = sizes(d3);
    /* Measured on 14.10.2026: neither p2 nor p3 has shown a notification or kept anything in sessionStorage by
       now, so a zero there is a zero of nothing; those two are read on p1 alone, where they were planted. */
    const emptyOf = read => Object.entries(read).filter(([s, n]) => n <= 2 && !["sessionStorage", "notification"].includes(s)).map(([s]) => s);
    check("0: p2 and p3, where nothing was planted, read the marker nowhere - and every surface but sessionStorage and the notifications holds something to read",
        total(on2) === 0 && total(on3) === 0 && emptyOf(read2).length === 0 && emptyOf(read3).length === 0,
        J({ on2, on3, empty2: emptyOf(read2), empty3: emptyOf(read3) }));

    await p1.eval(`
        const scene = game.scenes.get(${J(IDS.scene)});
        scene._source.walls = scene._source.walls.filter(w => w._id !== "drpgProbe76Wall0");
        scene._source.regions = scene._source.regions.filter(r => r._id !== "drpgProbe76Regn0");
        delete scene._source.flags["drpg-harness"];
        delete game.user._source.flags["drpg-harness"];
        game.settings.storage.get("world").delete("drpg-harness.probe76");
        localStorage.removeItem("drpg-harness.probe76");
        sessionStorage.removeItem("drpg-harness.probe76");
        document.getElementById("drpg-probe76")?.remove();
        globalThis.__notifications = globalThis.__notifications.filter(n => !n.msg.includes("${MARK}"));
        return true;`);
    const after1 = probe(await dump("p1"), { skip: PHASE0 });
    check("0: the plants taken back, p1 reads the marker nowhere but in phase 0's own wire and console, which the later phases leave out",
        total(after1) === 0, J(after1));

    /* p3's world as found, for phases A, E and G: the world-secrets rule's scan, and what p3 holds of walls,
       regions, the scenes' flags and the module's world settings. */
    const baseHits = worldScan(d3);
    const baseline = worldPrint(d3);
    check("0: p3's world as found - the world-secrets scan finds nothing, and p3 holds the harness's scenes and the module's world settings to compare later phases with",
        baseHits.length === 0 && (d3.world?.Scene ?? []).length >= 2
            && Object.keys(JSON.parse(baseline).settings).length > 0,
        J({ baseHits, scenes: (d3.world?.Scene ?? []).length, settings: Object.keys(JSON.parse(baseline).settings).length }));

    await phaseA({ gm, p1, p2, p3, check, phase, settle, dump, socketTraffic, IDS, repoUrl, baseline });
    await phaseB({ gm, p1, p2, p3, check, phase, IDS, repoUrl });
    await phaseC({ gm, p1, p2, p3, check, phase, settle, IDS, repoUrl });
    await phaseD({ gm, p1, p2, p3, check, phase, settle, socketTraffic, opLog, IDS, repoUrl });
}

const PHASE_A = "A: the GM creates a passage and grants Aiko - p1's copy holds that row alone, p2 and p3 nothing of it, p3's world as found";

/* What a browser holds of the passages as the module reads them: the copy on a player's, the GMs' records on a GM's. */
const known = (client, repoUrl) => client.eval(`const { knownPassages } = await import("${repoUrl}/scripts/passages.mjs"); return knownPassages();`);

async function phaseA({ gm, p1, p2, p3, check, phase, settle, dump, socketTraffic, IDS, repoUrl, baseline }) {
    phase(PHASE_A, { flow: "secret-passages" });
    const from = socketTraffic.length;
    /* A wall of the GM's own map, drawn for the passage, and the passage on a stretch of it starting at the marker. */
    const made = await gm.eval(`
        const scene = game.scenes.get(${J(IDS.scene)});
        const [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [1100, 400, 1400, 400] }]);
        return wall?.id ?? null;`);
    await settle(300);
    const id = await gm.eval(`return await game.drpg.passages.create({ sceneId: ${J(IDS.scene)}, wallId: ${J(made)},
        seg: { x1: ${MARK}, y1: 400, x2: 1300.5, y2: 400 } });`);
    await settle(400);
    const created3 = await dump("p3");
    const granted = await gm.eval(`return await game.drpg.passages.grant(${J(id)}, ${J(IDS.aiko)});`);
    await settle(600);
    check("A: the GM's console makes a passage on its new wall and grants it to Aiko",
        typeof made === "string" && typeof id === "string" && id.startsWith(`${IDS.scene}.`) && granted === true, J({ made, id, granted }));

    const copy1 = await known(p1, repoUrl);
    const row = { sceneId: IDS.scene, shape: "wall", level: null, passageWallId: made,
        passageSeg: { x1: MARK, y1: 400, x2: 1300.5, y2: 400 }, actorIds: [IDS.aiko] };
    check("A: p1's copy holds exactly the passage Aiko knows - its scene, shape, floor, wall, stretch and knower, and nothing else",
        J(copy1) === J({ [id]: row }), J(copy1));

    const d2 = await dump("p2"), d3 = await dump("p3");
    const idRe = new RegExp(String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const seen = d => ({ marker: probe(d, { skip: PHASE0 }), id: probe(d, { skip: PHASE0, re: idRe }) });
    const on2 = seen(d2), on3 = seen(d3);
    const copies = [await known(p2, repoUrl), await known(p3, repoUrl)];
    check("A: p2 and p3 read neither the marker nor the passage's id on any surface (walls, regions, scenes, documents, settings, the client store, the storages, the wire, the page, the notifications, the console), and their copies hold nothing",
        total(on2.marker) + total(on2.id) + total(on3.marker) + total(on3.id) === 0 && J(copies) === J([{}, {}]), J({ on2, on3, copies }));
    const hits = [...worldScan(created3), ...worldScan(d3)];
    const prints = [worldPrint(created3, { without: made }), worldPrint(d3, { without: made })];
    check("A: p3's world is the world as found, after the create and after the grant, but for the GM's new wall - and the world-secrets scan finds nothing",
        hits.length === 0 && prints.every(p => p === baseline), J({ hits, same: prints.map(p => p === baseline) }));
    const rows = socketTraffic.slice(from).filter(t => t.action === "passage.rows");
    const unaddressed = rows.filter(t => !Array.isArray(t.to) || t.to.length !== 1 || t.from !== "gm");
    check("A: every copy the GM sent in this phase names one player, and Aiko's player was sent hers",
        rows.length > 0 && unaddressed.length === 0 && rows.some(t => J(t.to) === J([IDS.p1])), J(rows));

    /* A copy p2 forges for p3, at another number (4321.5), stamped far ahead for p3's own Chie: p3 is not to take it. */
    const forged = { [`${IDS.scene}.forged76`]: { sceneId: IDS.scene, shape: "wall", level: null, passageWallId: made,
        passageSeg: { x1: 4321.5, y1: 400, x2: 4400.5, y2: 400 }, actorIds: [IDS.chie] } };
    await p2.eval(`game.socket.emit("module.danganronpa-rpg", { action: "passage.rows", userId: ${J(IDS.p3)}, passages: ${J(forged)},
        stamps: { ${J(IDS.chie)}: 9e15 } }, { recipients: [${J(IDS.p3)}] }); return true;`);
    await settle(400);
    const after3 = await dump("p3");
    const forgedOn3 = probe({ settings: after3.settings, storage: after3.storage }, { re: /(?<![\d.])4321\.5(?!\d)/g });
    const copy3 = await known(p3, repoUrl);
    const reached = (after3.wire ?? []).some(w => J(w).includes("4321.5"));
    check("A: a copy p2 forges for p3 reaches p3 and is refused - p3's copy, client store and storages hold none of it",
        reached && J(copy3) === "{}" && total(forgedOn3) === 0, J({ reached, copy3, forgedOn3 }));

    /* An ask with junk fields - another user, a character, a passage - answered about its sender alone. */
    const asked = socketTraffic.length;
    await p2.eval(`game.socket.emit("module.danganronpa-rpg", { action: "passage.request", userId: ${J(IDS.p3)}, actorId: ${J(IDS.aiko)},
        passageId: ${J(id)}, passages: ${J(forged)} }, { recipients: [${J(IDS.gm)}] }); return true;`);
    await settle(600);
    const answers = socketTraffic.slice(asked).filter(t => t.action === "passage.rows");
    const copy2 = await known(p2, repoUrl);
    check("A: an ask from p2 with junk fields is answered to p2 alone, once, and p2's copy still holds nothing",
        answers.length === 1 && J(answers[0].to) === J([IDS.p2]) && J(copy2) === "{}", J({ answers, copy2 }));
}

const PHASE_B = "B: the client's cut - the move backend lets Aiko's token through her passage on p1, and nobody else's on any browser";

/* Phase A's wall runs 1100-1400 at y 400 and its passage 1234.5-1300.5 (the marker): a step down across the
   passage's middle, one across the wall beside it, the same through the passage for sight, and for a move with no
   token - each asked of `CONFIG.Canvas.polygonBackends` on one client with one seeded token, as Foundry asks it
   for a token's move (`source.object`, the placeable; the design's reading of 14.365, a live row is owed to the stage's AUDIT 9.2). True is "a
   wall is in the way". */
const crossing = (client, tokenId) => client.eval(`
    const backends = CONFIG.Canvas.polygonBackends, object = canvas.tokens.get(${J(tokenId)}) ?? null;
    const hit = (x, type, source) => backends[type].testCollision({ x, y: 350 }, { x, y: 450 },
        { type, mode: "any", ...(source ? { source: { object } } : {}) });
    return { scene: canvas.scene?.id ?? null, token: Boolean(object), through: hit(1267.5, "move", true), beside: hit(1150, "move", true),
        sight: hit(1267.5, "sight", true), bare: hit(1267.5, "move", false) };`);

async function phaseB({ gm, p1, p2, p3, check, phase, IDS, repoUrl }) {
    phase(PHASE_B, { flow: "secret-passages" });
    /* The install, on every client: the PATCHES row's own probe, and no notification that the passages cannot open. */
    const installs = {};
    for (const [name, client] of Object.entries({ gm, p1, p2, p3 })) {
        installs[name] = await client.eval(`
            const { PATCHES } = await import("${repoUrl}/scripts/patches.mjs");
            const told = globalThis.__notifications.filter(n => n.msg === game.i18n.localize("DRPG.Passage.engineOff")).length;
            return { ...(PATCHES.find(p => p.file === "passages.mjs")?.probe?.() ?? {}), told };`);
    }
    check("B: on every client the move backend is the module's (the PATCHES row's probe), and nobody was told the passages cannot open",
        Object.values(installs).every(r => J(r) === J({ present: true, ours: true, told: 0 })), J(installs));

    const aiko = "TOKAIKO000000000", botan = "TOKBOTAN00000000", chie = "TOKCHIE000000000";
    const on1 = await crossing(p1, aiko);
    check("B: on p1 Aiko's token passes her passage and is stopped by the wall beside it; sight, and a move with no token, are stopped in the passage",
        J(on1) === J({ scene: IDS.scene, token: true, through: false, beside: true, sight: true, bare: true }), J(on1));
    /* The other roads: another character's token, Aiko's own on a browser whose copy is empty, and the GM's records,
       which name Aiko alone. A token cut here that its browser's copy does not name is the passage on the wrong side. */
    const whole = { scene: IDS.scene, token: true, through: true, beside: true, sight: true, bare: true };
    const others = { p2Botan: await crossing(p2, botan), p2Aiko: await crossing(p2, aiko), p3Chie: await crossing(p3, chie),
        p1Botan: await crossing(p1, botan), gmBotan: await crossing(gm, botan) };
    check("B: every other token is stopped in the passage - Botan's on p2 and p1, Aiko's on p2, Chie's on p3, Botan's on the GM's - as a move with no token is",
        Object.values(others).every(r => J(r) === J(whole)), J(others));
    const gmAiko = await crossing(gm, aiko);
    check("B: on the GM's browser, which reads the GMs' records, Aiko's token passes her passage and is stopped beside it, as on p1",
        J(gmAiko) === J({ ...whole, through: false }), J(gmAiko));
}

const PHASE_C = "C: the gap and the veto - Aiko's outline opens her passage and her token goes through it; Botan's is refused with today's sentence";

/* The Cafeteria's open stretches on one browser, `[x1, y1, x2, y2]` rounded, for `actorId`'s character or none. The
   harness's `PIXI.Polygon#contains` answers false for every point, so no doorway opens headless (E12 C2b); for this one
   synchronous call it is given an even-odd inside test, and put back after. */
const outline = (client, repoUrl, sceneId, actorId = null) => client.eval(`
    const D = await import("${repoUrl}/scripts/fog-doorways.mjs");
    const region = game.scenes.get(${J(sceneId)}).regions.find(r => r.name === "Cafeteria");
    const actor = ${actorId ? `game.actors.get(${J(actorId)})` : "null"};
    const proto = PIXI.Polygon.prototype, was = proto.contains;
    proto.contains = function (x, y) {
        const p = this.points;
        let inside = false;
        for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
            if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
        }
        return inside;
    };
    try {
        return D.doorwayEdges(region, null, actor ? { actor } : {}).flatMap(e => e.open.map(([a, b]) =>
            [e.ax + e.dx * a, e.ay + e.dy * a, e.ax + e.dx * b, e.ay + e.dy * b].map(Math.round)));
    } finally {
        proto.contains = was;
    }`);

async function phaseC({ gm, p1, p2, p3, check, phase, settle, IDS, repoUrl }) {
    phase(PHASE_C, { flow: "secret-passages" });
    const MOD = "danganronpa-rpg", PLACE = { teleport: true, movementAction: "displace", animate: false };
    /* The Kitchen under the Cafeteria (1200-2000 x 800-1100); its list names the Gym, so the pair is decided by the lists and
       the Cafeteria does not reach it by the map. The wall runs their whole border at y 800; the passage is 1234.5-1334.5. */
    const set = await gm.eval(`
        const scene = game.scenes.get(${J(IDS.scene)});
        const [kitchen] = await scene.createEmbeddedDocuments("Region", [{ name: "Kitchen", behaviors: [],
            shapes: [{ type: "rectangle", x: 1200, y: 800, width: 800, height: 300 }],
            flags: { "${MOD}": { room: true, drpgNeighbours: "Gym" } } }]);
        const [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [1200, 800, 2000, 800] }]);
        const id = await game.drpg.passages.create({ sceneId: scene.id, wallId: wall.id, seg: { x1: 1234.5, y1: 800, x2: 1334.5, y2: 800 } });
        const granted = await game.drpg.passages.grant(id, ${J(IDS.aiko)});
        const aiko = game.actors.get(${J(IDS.aiko)}), t = scene.tokens.get("TOKAIKO000000000");
        globalThis.__s76c = { kitchen: kitchen.id, wall: wall.id, id, at: { x: t.x, y: t.y }, actions: game.drpg.actionsLeft(aiko),
            free: aiko.getFlag("${MOD}", "freeMoveUsed") ?? null, sealed: game.settings.get("${MOD}", "sealedRooms"),
            restrictions: game.settings.get("${MOD}", "restrictions") };
        await t.update({ x: 1240, y: 600 }, ${J(PLACE)});
        if (game.drpg.actionsLeft(aiko) < 2) await game.drpg.setActions(aiko, 2);
        const M = await import("${repoUrl}/scripts/movement.mjs");
        return { kitchen: Boolean(kitchen), wall: Boolean(wall), id, granted, room: M.roomOfToken(t), neighbours: M.neighbouringRooms(scene, "Cafeteria") };`,
    { timeout: 30000 });
    await settle(1000);
    check("C: the GM draws the Kitchen, the wall and the passage, grants it to Aiko and puts her token in the Cafeteria - and the map does not join the Cafeteria to the Kitchen",
        set.kitchen && set.wall && typeof set.id === "string" && set.granted === true && set.room === "Cafeteria" && !set.neighbours.includes("Kitchen"),
        J(set));

    const bare = await outline(p1, repoUrl, IDS.scene);
    const mine = await outline(p1, repoUrl, IDS.scene, IDS.aiko);
    const gap = mine.filter(g => !bare.some(b => J(b) === J(g)));
    const inPassage = gap.length === 1 && gap[0][1] === 800 && gap[0][3] === 800
        && Math.min(gap[0][0], gap[0][2]) >= 1225 && Math.max(gap[0][0], gap[0][2]) <= 1345;
    check("C: on p1 the Cafeteria's outline for Aiko opens one gap, on her passage, and is otherwise the outline with no character",
        inPassage && mine.length === bare.length + 1, J({ bare, mine, gap }));
    const others = { p2Botan: await outline(p2, repoUrl, IDS.scene, IDS.botan), p2None: await outline(p2, repoUrl, IDS.scene),
        p3Chie: await outline(p3, repoUrl, IDS.scene, IDS.chie), p3None: await outline(p3, repoUrl, IDS.scene),
        gmAiko: await outline(gm, repoUrl, IDS.scene, IDS.aiko), gmNone: await outline(gm, repoUrl, IDS.scene) };
    check("C: everywhere else the outline is the one with no character - Botan's on p2, Chie's on p3, Aiko's on the GM's browser - and none of them opens the passage",
        Object.values(others).every(o => J(o) === J(bare)), J({ bare, others }));

    /* The moves themselves, each from the player's own browser: Aiko through her passage, Botan the same way. */
    const moved = await p1.eval(`
        const t = canvas.scene.tokens.get("TOKAIKO000000000"), first = globalThis.__notifications.length;
        await t.update({ x: 1240, y: 850 });
        return { told: globalThis.__notifications.slice(first).map(n => n.msg) };`, { timeout: 30000 });
    await settle(1500);
    const judged = await gm.eval(`
        const M = await import("${repoUrl}/scripts/movement.mjs"), { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000");
        const s = M.standingOf?.(t);
        return { at: [t.x, t.y], room: M.roomOfToken(t), lawful: s?.lawful ?? null,
            told: game.messages.filter(m => String(contentOf(m) ?? "").includes('data-drpg-unlawful="TOKAIKO000000000"')).length };`);
    check("C: p1 moves Aiko through her passage into the Kitchen - nothing refuses it on p1, and the primary GM finds the arrival lawful and tells nobody",
        moved.told.length === 0 && J(judged.at) === J([1240, 850]) && judged.room === "Kitchen" && judged.lawful === true && judged.told === 0,
        J({ moved, judged }));
    const refused = await p2.eval(`
        const M = await import("${repoUrl}/scripts/movement.mjs");
        const t = canvas.scene.tokens.get("TOKBOTAN00000000"), first = globalThis.__notifications.length;
        await t.update({ x: 1240, y: 850 });
        return { told: globalThis.__notifications.slice(first).map(n => n.msg), map: M.crossingRefused(canvas.scene, "Cafeteria", "Kitchen", null) };`,
    { timeout: 30000 });
    await settle(800);
    const botan = await gm.eval(`const t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKBOTAN00000000"); return [t.x, t.y];`);
    check("C: p2 moves Botan the same way and is refused with the sentence the map gives, and his token stays where it was",
        typeof refused.map === "string" && J(refused.told) === J([refused.map]) && J(botan) === J([1300, 300]), J({ refused, botan }));

    /* The veto with the passage named, on p1, against each rule `via` must not skip - and the one it does. */
    const verdict = via => `M.crossingVerdict(game.actors.get(${J(IDS.aiko)}), "Cafeteria", "Kitchen", canvas.scene, null, { pay: false, via: ${J(via)} })`;
    const ask = async (write, undo, extra = "") => {
        await gm.eval(`const scene = game.scenes.get(${J(IDS.scene)}), kitchen = scene.regions.get(globalThis.__s76c.kitchen); ${write} return true;`);
        await settle(600);
        const read = await p1.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
            return { through: ${verdict("passage")}, plain: ${verdict(null)}${extra} };`);
        await gm.eval(`const scene = game.scenes.get(${J(IDS.scene)}), kitchen = scene.regions.get(globalThis.__s76c.kitchen); ${undo} return true;`);
        await settle(600);
        return read;
    };
    const texts = await p1.eval(`return { locked: game.i18n.localize("DRPG.Move.locked"), sealed: game.i18n.format("DRPG.Calls.sealedBlocked", { room: "Kitchen" }),
        chained: game.i18n.localize("DRPG.Calls.chainedBlocked"), key: game.i18n.format("DRPG.Vault.keyMissing", { room: "Kitchen" }) };`);
    const locked = await ask(`await kitchen.setFlag("${MOD}", "drpgLocked", true);`, `await kitchen.unsetFlag("${MOD}", "drpgLocked");`);
    const lockedFrame = await (async () => {
        await gm.eval(`await game.scenes.get(${J(IDS.scene)}).regions.get(globalThis.__s76c.kitchen).setFlag("${MOD}", "drpgLocked", true); return true;`);
        await settle(600);
        const read = await outline(p1, repoUrl, IDS.scene, IDS.aiko);
        await gm.eval(`await game.scenes.get(${J(IDS.scene)}).regions.get(globalThis.__s76c.kitchen).unsetFlag("${MOD}", "drpgLocked"); return true;`);
        await settle(600);
        return read;
    })();
    const sealed = await ask(`await game.settings.set("${MOD}", "sealedRooms", [...(globalThis.__s76c.sealed ?? []), "Kitchen"]);`,
        `await game.settings.set("${MOD}", "sealedRooms", globalThis.__s76c.sealed ?? []);`);
    const chained = await ask(`await game.settings.set("${MOD}", "restrictions", { ...(globalThis.__s76c.restrictions ?? {}), ${J(IDS.aiko)}: { chained: true } });`,
        `await game.settings.set("${MOD}", "restrictions", globalThis.__s76c.restrictions ?? {});`);
    const owned = await ask(`await kitchen.setFlag("${MOD}", "drpgVaultOwner", ${J(IDS.botan)});`, `await kitchen.unsetFlag("${MOD}", "drpgVaultOwner");`);
    check("C: through the passage, on p1, a GM's lock, a seal and the chain still refuse the Kitchen, as they do without it - and under the lock the outline opens nothing",
        locked.through === texts.locked && locked.plain === texts.locked && sealed.through === texts.sealed && sealed.plain === texts.sealed
            && chained.through === texts.chained && chained.plain === texts.chained && J(lockedFrame) === J(bare),
        J({ texts, locked, sealed, chained, lockedFrame }));
    check("C: Botan's bedroom is open to Aiko through her passage and shut without it - the key is the one rule the passage skips",
        owned.through === true && owned.plain === texts.key, J({ owned, key: texts.key }));

    /* Put back: Aiko's token, actions and free Move; the passage, the wall and the Kitchen. */
    const back = await gm.eval(`
        const scene = game.scenes.get(${J(IDS.scene)}), was = globalThis.__s76c, aiko = game.actors.get(${J(IDS.aiko)});
        await scene.tokens.get("TOKAIKO000000000").update(was.at, ${J(PLACE)});
        await game.drpg.setActions(aiko, was.actions);
        if (was.free === null) await aiko.unsetFlag("${MOD}", "freeMoveUsed"); else await aiko.setFlag("${MOD}", "freeMoveUsed", was.free);
        const gone = await game.drpg.passages.delete(was.id);
        await scene.deleteEmbeddedDocuments("Wall", [was.wall]);
        await scene.deleteEmbeddedDocuments("Region", [was.kitchen]);
        delete globalThis.__s76c;
        return { gone, kitchen: scene.regions.some(r => r.name === "Kitchen"), sealed: game.settings.get("${MOD}", "sealedRooms"),
            chained: Boolean(game.settings.get("${MOD}", "restrictions")?.[${J(IDS.aiko)}]?.chained) };`, { timeout: 30000 });
    await settle(600);
    check("C: put back - the passage deleted, the Kitchen and its wall gone, no seal or chain left on the Kitchen or Aiko",
        back.gone !== false && back.kitchen === false && !(back.sealed ?? []).includes("Kitchen") && back.chained === false, J(back));
}

const PHASE_D = "D: the GM's audit - a move through an ordinary wall and through a passage's wall is put back alike, a forged REVERT, teleport and displace as well; a GM's move, a lawful REVERT and the knower stand; 'log' moves nothing";

async function phaseD({ gm, p1, p2, p3, check, phase, settle, socketTraffic, opLog, IDS, repoUrl }) {
    phase(PHASE_D, { flow: "secret-passages" });
    const MOD = "danganronpa-rpg", PLACE = { teleport: true, movementAction: "displace", animate: false };
    const BOTAN = "TOKBOTAN00000000", HOME = [1250, 400], ACROSS = [1550, 400];
    /* Inside the Cafeteria (1200-2000 x 200-800), below phase A's wall (y 400, x 1100-1400), so that no room is crossed:
       an ordinary wall at x 1500, and a wall at y 600 whose passage (1234.5-1400.5) is Aiko's. Botan stands at 1250,400
       (his centre 1300,450): right to 1550,400 crosses the ordinary wall, down to 1250,600 the passage's. */
    const set = await gm.eval(`
        /* Registered only from C4: a tree without the audit lets the phase run and fail on its checks, not on this read. */
        const AUDIT = game.settings.settings.has("${MOD}.moveAudit");
        const scene = game.scenes.get(${J(IDS.scene)});
        const [plain, held] = await scene.createEmbeddedDocuments("Wall", [{ c: [1500, 400, 1500, 800] }, { c: [1200, 600, 1450, 600] }]);
        const id = await game.drpg.passages.create({ sceneId: scene.id, wallId: held.id, seg: { x1: 1234.5, y1: 600, x2: 1400.5, y2: 600 } });
        const granted = await game.drpg.passages.grant(id, ${J(IDS.aiko)});
        const botan = scene.tokens.get(${J(BOTAN)}), aiko = scene.tokens.get("TOKAIKO000000000");
        const keep = a => ({ actions: game.drpg.actionsLeft(a), free: a.getFlag("${MOD}", "freeMoveUsed") ?? null });
        globalThis.__s76d = { plain: plain.id, held: held.id, id, mode: AUDIT ? game.settings.get("${MOD}", "moveAudit") : null,
            botan: { x: botan.x, y: botan.y }, aiko: { x: aiko.x, y: aiko.y },
            kept: { [${J(IDS.botan)}]: keep(botan.actor), [${J(IDS.aiko)}]: keep(aiko.actor) } };
        await botan.update({ x: ${HOME[0]}, y: ${HOME[1]} }, ${J(PLACE)});
        await aiko.update({ x: 1270, y: 650 }, ${J(PLACE)});
        if (AUDIT) await game.settings.set("${MOD}", "moveAudit", "sendBack");
        const M = await import("${repoUrl}/scripts/movement.mjs");
        return { plain: plain.id, held: held.id, id, granted, found: globalThis.__s76d.mode, rooms: [M.roomOfToken(botan), M.roomOfToken(aiko)], mode: AUDIT ? game.settings.get("${MOD}", "moveAudit") : null };`,
    { timeout: 30000 });
    await settle(1000);
    check("D: the GM draws an ordinary wall and a passage's wall inside the Cafeteria, grants the passage to Aiko, stands Botan and Aiko there and turns the audit to 'sendBack'",
        typeof set.id === "string" && set.granted === true && J(set.rooms) === J(["Cafeteria", "Cafeteria"]) && set.mode === "sendBack", J(set));

    /* p2 hears its own packets for this phase; the veto (movement.mjs `onPreUpdateToken`) is taken off p2's hook list for
       each move and put back at its place, as a console's client would not run it. */
    await p2.eval(`globalThis.__s76dWire = []; game.socket.on("module.${MOD}", p => { if (p?.action === "move.sentBack") globalThis.__s76dWire?.push(p); }); return true;`);
    const forge = (to, options = {}, client = p2, token = BOTAN) => client.eval(`
        const list = Hooks._hooks.get("preUpdateToken") ?? [], at = list.findIndex(e => e.fn.name === "onPreUpdateToken");
        const [veto] = at >= 0 ? list.splice(at, 1) : [];
        try { await canvas.scene.tokens.get(${J(token)}).update({ x: ${to[0]}, y: ${to[1]} }, ${J(options)}); }
        finally { if (veto) list.splice(at, 0, veto); }
        return Boolean(veto);`, { timeout: 30000 });
    const onGm = () => gm.eval(`
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs"), U = await import("${repoUrl}/scripts/utils.mjs");
        const t = game.scenes.get(${J(IDS.scene)}).tokens.get(${J(BOTAN)});
        const cards = game.messages.filter(m => String(contentOf(m) ?? "").includes('data-drpg-wall="${BOTAN}"'));
        return { at: [t.x, t.y], cards: cards.map(m => [...(m.whisper ?? [])].sort()),
            rows: U.sessionFailures().filter(e => e.message.startsWith("A player's move took a token through a wall")).map(e => [e.message, e.count]) };`);
    const onP2 = () => p2.eval(`
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return { told: globalThis.__notifications.map(n => n.msg), wire: globalThis.__s76dWire.map(p => p.code),
            cards: game.messages.filter(m => (String(m.content ?? "") + String(contentOf(m) ?? "")).includes("data-drpg-wall")).length };`);
    /* The rows a step added: the Debug log keeps one row per message with a count, so a row is new or counted again. */
    const grown = (was, now) => now.filter(([msg, n]) => n > (was.find(([m]) => m === msg)?.[1] ?? 0))
        .map(([msg]) => ({ mode: msg.includes("(sent back)") ? "sendBack" : "log", ...JSON.parse(msg.slice(msg.indexOf("{"))) }));
    const attempt = async (to, options = {}, { client = p2, token = BOTAN } = {}) => {
        const mark = socketTraffic.length, g0 = await onGm(), q0 = await onP2();
        const vetoOff = await forge(to, options, client, token);
        await settle(1500);
        const g1 = await onGm(), q1 = await onP2();
        return { vetoOff, at: g1.at, packets: socketTraffic.slice(mark).filter(t => t.action === "move.sentBack").map(t => ({ from: t.from, to: t.to })),
            codes: q1.wire.slice(q0.wire.length), told: q1.told.slice(q0.told.length), p2cards: q1.cards - q0.cards,
            whispers: g1.cards.slice(g0.cards.length), rows: grown(g0.rows, g1.rows) };
    };
    const cannotReach = await p2.eval(`return game.i18n.format("DRPG.Move.cannotReach", { from: "Cafeteria" });`);
    const sentBack = r => r.vetoOff && J(r.at) === J(HOME) && J(r.packets) === J([{ from: "gm", to: [IDS.p2] }]) && J(r.codes) === J(["wall"])
        && J(r.told) === J([cannotReach]) && r.p2cards === 0 && J(r.whispers) === J([[IDS.gm]]) && r.rows.length === 1 && r.rows[0].mode === "sendBack"
        && r.rows[0].user === IDS.p2 && r.rows[0].token === BOTAN;
    const stood = (r, at) => J(r.at) === J(at) && r.packets.length === 0 && r.codes.length === 0 && r.told.length === 0 && r.whispers.length === 0 && r.rows.length === 0;
    const putBack = () => gm.eval(`await game.scenes.get(${J(IDS.scene)}).tokens.get(${J(BOTAN)}).update({ x: ${HOME[0]}, y: ${HOME[1]} }, ${J(PLACE)}); return true;`);

    const plain = await attempt(ACROSS);
    const held = await attempt([1250, 600]);
    const blind = r => J({ ...r, rows: r.rows.map(x => ({ ...x, wall: null, passage: null })) });
    check("D: p2, its veto off, moves Botan through the ordinary wall and through the passage's wall: each time he is put back where the GM saw him, p2 alone is sent the code 'wall' and reads the veto's sentence, the GMs alone are whispered",
        sentBack(plain) && sentBack(held), J({ plain, held, cannotReach }));
    check("D: the two are one result - only the Debug log row's wall and `passage` differ, the passage named on its wall's row and nothing on the other",
        blind(plain) === blind(held) && plain.rows[0].wall === set.plain && plain.rows[0].passage === null
            && held.rows[0].wall === set.held && held.rows[0].passage === set.id,
        J({ plain: plain.rows, held: held.rows }));

    const revert = await attempt(ACROSS, { drpgRevert: true });
    const teleport = await attempt(ACROSS, { teleport: true });
    const displace = await attempt(ACROSS, { movementAction: "displace" });
    check("D: a REVERT the GM never wrote, Foundry's teleport and a displace through the ordinary wall are each put back the same way - among them a REVERT to the spot the audit had just put Botan back from",
        [revert, teleport, displace].every(sentBack), J({ revert, teleport, displace }));

    const elsewhere = await (async () => {
        await gm.eval(`globalThis.__s76dView = canvas.scene; canvas.scene = game.scenes.get(${J(IDS.annex)}); return true;`);
        try { return { r: await attempt(ACROSS), on: await gm.eval(`return canvas.scene?.id;`) }; }
        finally { await gm.eval(`canvas.scene = globalThis.__s76dView; delete globalThis.__s76dView; return true;`); }
    })();
    check("D: with the GM looking at the Annex the same move is put back the same way",
        elsewhere.on === IDS.annex && sentBack(elsewhere.r) && blind(elsewhere.r) === blind(plain), J(elsewhere));

    /* What stands: a GM's own move across, a REVERT p2 writes back to where the GM saw Botan a moment ago, Aiko through her passage. */
    await gm.eval(`await game.scenes.get(${J(IDS.scene)}).tokens.get(${J(BOTAN)}).update({ x: ${ACROSS[0]}, y: ${ACROSS[1]} }); return true;`);
    await settle(1000);
    const gmMove = await onGm();
    const lawful = await attempt(HOME, { drpgRevert: true });
    const knower = await attempt([1270, 450], {}, { client: p1, token: "TOKAIKO000000000" });
    const aikoAt = await gm.eval(`const t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000"); return [t.x, t.y];`);
    check("D: a GM's own move through the wall stands, a REVERT p2 writes back to where the GM saw Botan a moment ago stands, and p1 moves Aiko through her own passage - nothing put back, sent, whispered or logged",
        J(gmMove.at) === J(ACROSS) && stood(lawful, HOME) && knower.packets.length === 0 && knower.whispers.length === 0 && knower.rows.length === 0
            && J(aikoAt) === J([1270, 450]),
        J({ gmMove: gmMove.at, lawful, knower, aikoAt }));

    await gm.eval(`if (game.settings.settings.has("${MOD}.moveAudit")) await game.settings.set("${MOD}", "moveAudit", "log"); return true;`);
    await settle(400);
    const logged = await attempt(ACROSS);
    await putBack();
    await settle(800);
    check("D: in 'log' mode the move stands and the GM's Debug log has the row, with nothing sent or whispered",
        J(logged.at) === J(ACROSS) && logged.packets.length === 0 && logged.codes.length === 0 && logged.whispers.length === 0
            && logged.rows.length === 1 && logged.rows[0].mode === "log" && logged.rows[0].wall === set.plain,
        J(logged));

    /* The fuzz substitute (31-fuzz is E43's): a send-back p2 forges for p3, one from the primary with a code nobody knows,
       and an ask of junk types - no document written, nothing thrown, each refusal a reason in the refuser's log. */
    const errs = () => Promise.all([gm, p1, p2, p3].map(c => c.eval(`return (globalThis.__errors ?? []).length;`)));
    const refusals = c => c.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        return U.sessionFailures().filter(e => e.message.startsWith("A token's send-back was not taken")).map(e => [e.message, e.count]);`);
    const added = (was, now) => now.filter(([msg, n]) => n > (was.find(([m]) => m === msg)?.[1] ?? 0)).map(([msg]) => msg);
    const e0 = await errs(), ops = opLog.length, r3 = await refusals(p3), r2 = await refusals(p2), n3 = await p3.eval(`return globalThis.__notifications.length;`);
    const mark = socketTraffic.length;
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "move.sentBack", userId: ${J(IDS.p3)}, sceneId: ${J(IDS.scene)}, tokenId: "TOKCHIE000000000", code: "wall" },
        { recipients: [${J(IDS.p3)}] }); return true;`);
    await gm.eval(`game.socket.emit("module.${MOD}", { action: "move.sentBack", userId: ${J(IDS.p2)}, sceneId: ${J(IDS.scene)}, tokenId: ${J(BOTAN)}, code: "teleport" },
        { recipients: [${J(IDS.p2)}] }); return true;`);
    await p2.eval(`game.socket.emit("module.${MOD}", { action: "passage.request", userId: 7, actorId: { x: 1 }, passageId: [1, 2], passages: "x", sceneId: null },
        { recipients: [${J(IDS.gm)}] }); return true;`);
    await settle(800);
    const fuzz = { errors: [e0, await errs()], writes: opLog.slice(ops).map(o => `${o.who} ${o.action} ${o.coll}`),
        p3: added(r3, await refusals(p3)), p2: added(r2, await refusals(p2)),
        told3: (await p3.eval(`return globalThis.__notifications.length;`)) - n3,
        answers: socketTraffic.slice(mark).filter(t => t.action === "passage.rows").map(t => t.to) };
    check("D: the fuzz - a send-back p2 forges for p3 and one from the primary with an unknown code are refused with their reason, an ask of junk types is answered to p2 alone, and nothing is written or thrown",
        J(fuzz.errors[0]) === J(fuzz.errors[1]) && fuzz.writes.length === 0 && J(fuzz.p3) === J(["A token's send-back was not taken: not sent by a GM"])
            && J(fuzz.p2) === J(["A token's send-back was not taken: an unknown code"]) && fuzz.told3 === 0 && J(fuzz.answers) === J([[IDS.p2]]),
        J(fuzz));

    /* Put back: the switch, the tokens, their actions and free Move, the passage and both walls. */
    const back = await gm.eval(`
        const scene = game.scenes.get(${J(IDS.scene)}), was = globalThis.__s76d;
        if (was.mode !== null) await game.settings.set("${MOD}", "moveAudit", was.mode);
        await scene.tokens.get(${J(BOTAN)}).update(was.botan, ${J(PLACE)});
        await scene.tokens.get("TOKAIKO000000000").update(was.aiko, ${J(PLACE)});
        for (const [actorId, k] of Object.entries(was.kept)) {
            const a = game.actors.get(actorId);
            await game.drpg.setActions(a, k.actions);
            if (k.free === null) await a.unsetFlag("${MOD}", "freeMoveUsed"); else await a.setFlag("${MOD}", "freeMoveUsed", k.free);
        }
        const gone = await game.drpg.passages.delete(was.id);
        await scene.deleteEmbeddedDocuments("Wall", [was.plain, was.held]);
        delete globalThis.__s76d;
        return { gone, mode: was.mode === null ? null : game.settings.get("${MOD}", "moveAudit"), walls: scene.walls.filter(w => [was.plain, was.held].includes(w.id)).length,
            at: [scene.tokens.get(${J(BOTAN)}).x, scene.tokens.get(${J(BOTAN)}).y] };`, { timeout: 30000 });
    await p2.eval(`delete globalThis.__s76dWire; return true;`);
    await settle(600);
    check("D: put back - the switch as found, Botan where phase C left him, the passage and both walls gone",
        back.gone !== false && back.mode === set.found && back.walls === 0 && J(back.at) === J([1300, 300]), J(back));
}
