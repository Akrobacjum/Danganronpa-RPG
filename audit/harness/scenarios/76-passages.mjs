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
 * B (C2): the client's cut on the harness's minimal move backend. C (C3): the gap and the veto.
 * D (C4): the GM's audit. E (C5): Close, Open and revoke. F (C6): the GM's overlay. G (C7): a show.
 *
 * What the harness cannot settle - a real canvas's move backend, the ruler and the keyboard, a GM on
 * another scene at a real table - is the stage's LIVE rows, which AUDIT 9.2 gets with C8 (the check that
 * reads their ids waits for them).
 */
import { worldScan } from "../lib/canary.mjs";

export const layers = ["ci"];
/* Measured alone on 14.10.2026 (C0's phase 0, two green runs under the harness lock): 5 checks in 0.85-0.87 s by
   the cluster's own line, 5.6-5.9 s of wall time with the boot. 60 s is 73's and 75's bound for a scenario of four clients
   and a few evals; a phase that adds minutes raises it with a reading of its own. */
export const timeoutMs = 60000;

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

export async function run({ gm, p1, p2, p3, check, phase, settle, dump, socketTraffic, IDS, repoUrl }) {
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
