/**
 * The secret passages (E79, 1.2.79; the E79 plan's 2.2): who may know a passage, on four clients, and in phase G
 * six (a second GM and a fifth player, declared late, since fix r2-G3).
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
 * A (C1): the GM creates a passage on a wall it has just drawn, then grants Aiko (p1's). Since fix r2-G3 the console's
 *   create on that wall as the map stands, the Cafeteria on both sides, is refused and writes nothing, and the passage
 *   is made with the map redrawn around the create (`acrossPantry`; D's the same way). p1's copy holds
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
 *   whispered, and the Debug log rows differ in their `passage` field only; the GM's browser announces the route
 *   through the ordinary wall once, as refused, when its put-back lands (E79 C14). A REVERT the GM never wrote, Foundry's
 *   teleport and a displace are put back the same way, and so is a move while the GM looks at the Annex. A GM's own
 *   move through the wall stands, a REVERT p2 writes back to where Botan stood a moment ago stands, and Aiko through
 *   her own passage stands. In `log` mode the move stands and the GM's Debug log has the row. Since fix r2-G1 (review
 *   r2): p2's send-back through the bridge to the Cafeteria's centre across the wall is judged as p2's own move (put
 *   back, or a row in `log` mode), asked after the put-back or in the same breath as the move; a move written before
 *   the put-back lands is judged from where Botan is sent; and an exempt landing on the wall's line (a REVERT, the
 *   bridge's send-back) keeps its side, so the step off it to the far side is a crossing. The fuzz substitute:
 *   `move.sentBack` forged by p2 for p3, and one from the primary with a code nobody knows, are refused on the
 *   player's browser with a reason in its log; a `passage.request` of junk types is answered to p2 alone; none of it
 *   writes a document or throws.
 * E (C5): the Passages tab, pressed as a GM presses it, in Room Setup drawn as a window (`__dialogWindows`) on phase A's
 *   passage. Close empties p1's copy and keeps Aiko in Who knows; Open gives the row back; Aiko's cross takes her off
 *   at once (she stands in Dorm A, and the map puts the Cafeteria on both sides of the passage) and p3's world is as
 *   the phase found it; stood in the Cafeteria and given it back, her cross asks, and 'Revoke when they leave the room'
 *   holds while p1 moves her inside the room and takes the passage once p1 moves her out of it (fix r1-G3: cor F1, SEC
 *   S5); '+' and her name grant her again in two clicks, and the tab names nobody not yet sent it; the wall moved off the
 *   stretch marks the passage broken on the primary GM - the tab says so with Close held, p1's copy is empty - and the
 *   wall put back leaves it broken; Delete asks, then removes the row. The window closes and phase A's wall goes with
 *   it; p3's world is read against itself at the phase's start, which parts from phase 0's by three settings phases C
 *   and D put back as values (the phase's comment).
 * F (C6): the pick and the GMs' overlay. The GM draws phase C's Kitchen and its wall again, opens Room Setup on the
 *   Passages tab and presses 'New passage'; the board is the stage's own listeners, which the pick adds and the
 *   scenario calls with a point of the scene. A click 60 px off the wall is refused in the pick's window; two on the
 *   wall make the passage on the stretch between them (snapped onto the wall, the rooms named), the window and the
 *   listeners go, and the GMs' overlay - one container on the GM's `canvas.interface` - draws it; Close draws it again
 *   as closed, a delete takes it off. No player's browser has the overlay, asked to draw or not. Put back, p3's world
 *   is as the phase found it, and no player reads the marker in more places than before.
 * G (C7): a show. The GM draws phase C's Kitchen, its wall and a passage granted to Aiko, and stands her in the
 *   Cafeteria beside Botan. Aiko's sheet on p1, drawn as Daggerheart hands it to the module, lists the passage under the
 *   Experience by its rooms as p1 may name them, open, with 'Show the passage', and nothing of its id, wall or stretch;
 *   Chie's on p3 lists nothing. p2's show for Aiko is refused as not p2's, p1's with junk for the passage as one Aiko
 *   does not know. Then p1 shows Botan: the GMs write 'shown' and one log row, Botan's copy on p2 gains the row,
 *   Aiko's actions are untouched, Botan's card (with the sound) names the Cafeteria and the Kitchen as unexplored and
 *   stays in p2's notice history, Aiko's names Botan and no room, and p3 sees and keeps neither. p3's world after the
 *   show, a Close and Botan's revoke is the world once the Kitchen was drawn. Since fix r2-G3, two GMs and a reload: a
 *   second GM connected with an empty browser makes a passage on the Kitchen's wall and gives it to Botan before its
 *   stores settle - the primary pushes it to p2 alone and both GMs' records hold it beside phase G's; p4, given Botan,
 *   holds it, passes it and lists it, and reloaded with its browser and with an empty one is sent its copy by the
 *   primary and reads the same. Put back, as the phase found it.
 *   The `refused` sound the mover plays is not read: the harness maps no sound file, so `playSfx` plays nothing.
 *   A stair link is R559's alone: the harness world has no floors on this scene.
 *
 * What the harness cannot settle - a real canvas's move backend, the ruler and the keyboard, a GM on
 * another scene at a real table - is LIVE-E79-01 to LIVE-E79-08 (AUDIT 9.2, since C8).
 */
import { worldScan } from "../lib/canary.mjs";

export const layers = ["ci"];
/* Measured alone on 14.10.2026 (C0's phase 0, two green runs under the harness lock): 5 checks in 0.85-0.87 s by
   the cluster's own line, 5.6-5.9 s of wall time with the boot. 60 s is 73's and 75's bound for a scenario of four clients
   and a few evals; a phase that adds minutes raises it with a reading of its own. With phase D (C4, 14.10.2026, one run
   under the harness lock): 33 checks in 32.5 s by the cluster's line, each of D's moves waited 1-1.5 s - so 120 s,
   for the boot and for a2.sh's three lanes, which this reading did not run in. Fix r2-G1 (16.10.2026) adds eleven
   moves and send-backs to D: 60 checks in 92.6 s by the cluster's line, one run alone under the harness lock (98 s of
   wall time) - so 150 s, the same margin for the lanes. Fix r2-G3 (16.10.2026) adds a second GM and a fifth player to
   G, connected three times between them: 63 checks in 110.0 s by the cluster's line, one run alone under the harness
   lock (115 s of wall time), 17.4 s over r2-G2's run of 60 - so 180 s. */
export const timeoutMs = 180000;

/* A second GM and a fifth player, seeded inactive and connected in phase G alone (E79 fix r2-G3), declared as 61 and 62
   declare theirs. */
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true },
    { who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#66aa66", late: true }
];

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
/* Where two prints part, for a check's details: each scene's walls, regions and flags, and each setting, that differ. */
const printDiff = (a, b) => {
    const [x, y] = [JSON.parse(a), JSON.parse(b)];
    const scenes = [...new Set([...x.scenes, ...y.scenes].map(s => s.id))].flatMap(id => ["walls", "regions", "flags"]
        .filter(k => J(x.scenes.find(s => s.id === id)?.[k]) !== J(y.scenes.find(s => s.id === id)?.[k])).map(k => `${id}.${k}`));
    const settings = [...new Set([...Object.keys(x.settings), ...Object.keys(y.settings)])].filter(k => J(x.settings[k]) !== J(y.settings[k]))
        .map(k => `${k}: ${J(x.settings[k])} -> ${J(y.settings[k])}`.slice(0, 300));
    return [...scenes, ...settings];
};
const worldPrint = (dump, { without = null } = {}) => J({
    scenes: (dump?.world?.Scene ?? []).map(s => ({ id: s?._id, walls: (s?.walls ?? []).filter(w => w?._id !== without), regions: s?.regions ?? [], flags: s?.flags ?? {} })),
    settings: Object.fromEntries(Object.entries(dump?.settings?.world ?? {}).filter(([key]) => key.startsWith("danganronpa-rpg.")))
});

export async function run({ gm, gm2, p1, p2, p3, p4, check, phase, settle, dump, socketTraffic, opLog, connect, disconnect, storageOf, IDS, repoUrl }) {
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
    await phaseE({ gm, p1, check, phase, settle, dump, socketTraffic, IDS, repoUrl, baseline });
    await phaseF({ gm, p1, p2, p3, check, phase, settle, dump, IDS, repoUrl });
    await phaseG({ gm, gm2, p1, p2, p3, p4, check, phase, settle, dump, socketTraffic, connect, disconnect, storageOf, IDS, repoUrl });
}

const PHASE_A = "A: the GM creates a passage and grants Aiko - p1's copy holds that row alone, p2 and p3 nothing of it, p3's world as found";

/*
 * THE MAP REDRAWN AROUND A CREATE (E79 fix r2-G3, 16.10.2026; review round 2, O4). Since that fix the console's create
 * asks the pick's rule: a stretch between two rooms of one floor (passages-gm.mjs `stretchOnMap`). Phases A and D measure
 * a passage inside the Cafeteria on purpose - A a wall the map gives no second room, D the audit's wall rule with no room
 * crossed - and a GM may redraw the map after a passage is made: nothing reads a passage's rooms off the map again but
 * the cross (`passageRoomsOnMap`), which reads the map as it stands. So, in the GM's one eval that makes the passage, the
 * Cafeteria is drawn short of the wall at `y` and a Pantry beyond it, the passage is made, and the Cafeteria is drawn
 * back and the Pantry taken away before the eval answers: the passage stands inside the Cafeteria as it did before the
 * fix, and each phase reads what it read then. `create` is the console's call, an expression on `scene`; the code reads
 * `id` after it.
 */
const acrossPantry = (y, create) => `
        const cafe = scene.regions.find(r => r.name === "Cafeteria"), shapes = foundry.utils.deepClone(cafe._source.shapes), [box] = shapes;
        await cafe.update({ shapes: [{ ...box, height: ${y} - box.y }] });
        const [pantry] = await scene.createEmbeddedDocuments("Region", [{ name: "Pantry", behaviors: [],
            shapes: [{ ...box, y: ${y}, height: box.y + box.height - ${y} }], flags: { "danganronpa-rpg": { room: true } } }]);
        let id = null;
        try {
            id = await ${create};
        } finally {
            await scene.deleteEmbeddedDocuments("Region", [pantry.id]);
            await cafe.update({ shapes });
        }`;

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
    /* E79 fix r2-G3 (review round 2, O4): on the map as it stands the wall has the Cafeteria on both sides, and the
       console's create refuses it as the pick does, writing nothing. Red at the parent (d71759a): the create wrote. */
    const bare = await gm.eval(`const G = await import("${repoUrl}/scripts/passages-gm.mjs"), before = G.listPassages().length;
        const id = await game.drpg.passages.create({ sceneId: ${J(IDS.scene)}, wallId: ${J(made)}, seg: { x1: ${MARK}, y1: 400, x2: 1300.5, y2: 400 } });
        return { id, written: G.listPassages().length - before };`);
    check("A: the console's create on a wall with the Cafeteria on both sides is refused, as the pick refuses it, and writes nothing",
        bare.id === null && bare.written === 0, J(bare));
    const id = await gm.eval(`const scene = game.scenes.get(${J(IDS.scene)});${acrossPantry(400,
        `game.drpg.passages.create({ sceneId: scene.id, wallId: ${J(made)}, seg: { x1: ${MARK}, y1: 400, x2: 1300.5, y2: 400 } })`)}
        return id;`, { timeout: 30000 });
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
   for a token's move (`source.object`, the placeable; the design's reading of 14.365; at a table: LIVE-E79-01). True is "a
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
        ${acrossPantry(600, "game.drpg.passages.create({ sceneId: scene.id, wallId: held.id, seg: { x1: 1234.5, y1: 600, x2: 1400.5, y2: 600 } })")}
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
            rows: U.sessionFailures().filter(e => e.message.startsWith("A player's move took a token through a wall")).map(e => [e.message, e.count]),
            book: (game.drpg.passages.audit?.()?.rows ?? []).filter(r => r.token === ${J(BOTAN)})
                .reduce((n, r) => ({ times: n.times + r.times, quiet: n.quiet + r.quiet }), { times: 0, quiet: 0 }),
            verdicts: (game.drpg.passages.audit?.()?.rows ?? []).filter(r => r.token === ${J(BOTAN)}).map(r => r.verdict) };`);
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
            whispers: g1.cards.slice(g0.cards.length), rows: grown(g0.rows, g1.rows),
            counted: g1.book.times - g0.book.times, quiet: g1.book.quiet - g0.book.quiet };
    };
    const cannotReach = await p2.eval(`return game.i18n.format("DRPG.Move.cannotReach", { from: "Cafeteria" });`);
    /* The GMs are whispered once per token and mover in 30 s (review r1, cor F3): a put-back after the first is
       counted on the audit's row (`quiet`) instead - either is the one result here, and the burst is checked apart. */
    /* The GMs alone: every GM account of the world, the second GM phase G connects (declared late, so a user from the
       start) among them - a whisper to the GMs names every GM account, connected or not (E79 fix r2-G3). */
    const heard = r => (J(r.whispers.map(w => [...w].sort())) === J([[IDS.gm, "USERGM2000000000"]]) && !(r.quiet > 0)) || (r.whispers.length === 0 && r.quiet === 1);
    const sentBack = (r, home = HOME) => r.vetoOff && J(r.at) === J(home) && J(r.packets) === J([{ from: "gm", to: [IDS.p2] }]) && J(r.codes) === J(["wall"])
        && J(r.told) === J([cannotReach]) && r.p2cards === 0 && heard(r) && r.rows.length === 1 && r.rows[0].mode === "sendBack"
        && r.rows[0].user === IDS.p2 && r.rows[0].token === BOTAN;
    const stood = (r, at) => J(r.at) === J(at) && r.packets.length === 0 && r.codes.length === 0 && r.told.length === 0 && r.whispers.length === 0 && r.rows.length === 0;
    const putBack = () => gm.eval(`await game.scenes.get(${J(IDS.scene)}).tokens.get(${J(BOTAN)}).update({ x: ${HOME[0]}, y: ${HOME[1]} }, ${J(PLACE)}); return true;`);
    /* The owner's send-back through the bridge (`token.sendBack`), read as `attempt` reads a move. `forged`: moves p2's
       console writes, its veto off, in the same breath - none waited for before the next, or before the ask. With no
       `to`, the forged moves alone. */
    const viaBridge = async (to, { forged = [] } = {}) => {
        const mark = socketTraffic.length, g0 = await onGm(), q0 = await onP2();
        const asked = await p2.eval(`
            const list = Hooks._hooks.get("preUpdateToken") ?? [], at = list.findIndex(e => e.fn.name === "onPreUpdateToken");
            const [veto] = ${forged.length ? "at >= 0 ? list.splice(at, 1) : []" : "[]"};
            const B = await import("${repoUrl}/scripts/gm-bridge.mjs"), t = canvas.scene.tokens.get(${J(BOTAN)});
            try {
                const moving = ${J(forged)}.map(([x, y]) => t.update({ x, y }));
                const r = ${J(to)} ? await B.requestSendBack(${J(IDS.scene)}, ${J(BOTAN)}, { x: ${J(to?.[0])}, y: ${J(to?.[1])} }) : null;
                await Promise.all(moving);
                return r && { ok: r.ok, refused: r.refused ?? null, reason: r.reason ?? null };
            } finally { if (veto) list.splice(at, 0, veto); }`, { timeout: 30000 });
        await settle(1500);
        const g1 = await onGm(), q1 = await onP2();
        return { asked, at: g1.at, packets: socketTraffic.slice(mark).filter(t => t.action === "move.sentBack").map(t => ({ from: t.from, to: t.to })),
            codes: q1.wire.slice(q0.wire.length), whispers: g1.cards.slice(g0.cards.length), rows: grown(g0.rows, g1.rows),
            counted: g1.book.times - g0.book.times, verdicts: g1.verdicts };
    };
    const centre = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const t = game.scenes.get(${J(IDS.scene)}).tokens.get(${J(BOTAN)}), c = M.positionIn(M.roomOfToken(t), t, null);
        return [c.x, c.y];`);
    /* A crossing of the ordinary wall by p2, in "sendBack" mode: Botan where he started, every row the plain wall's and p2's. */
    const p2Rows = (r, mode) => r.rows.length >= 1 && r.rows.every(x => x.wall === set.plain && x.user === IDS.p2 && x.mode === mode);

    /* E79 C14 (1.2.79): what the GM's browser announces of Botan's route while the audit sends it back - every announcement
       with the room it names and the moment the put-back reached the GM. Botan's route stays inside the Cafeteria, so the
       GM, which owns him, judges it free at once; the audit's put-back is marked as the update arrives (`noteGmPosition`),
       and nothing may be announced before it lands. */
    await gm.eval(`const R = globalThis.__s76dN13 = { heard: [], back: null }, M = await import("${repoUrl}/scripts/movement.mjs");
        R.on = ({ tokenDoc, accepted, room }) => { if (tokenDoc?.id === ${J(BOTAN)}) R.heard.push([accepted, room ?? null, R.back !== null]); };
        R.up = (doc, changes, options) => { if (doc.id === ${J(BOTAN)} && options?.[M.REVERT] && R.back === null) R.back = Date.now(); };
        Hooks.on("drpgRouteSettled", R.on); Hooks.on("updateToken", R.up); return true;`);
    const plain = await attempt(ACROSS);
    const plainHeard = await gm.eval(`const R = globalThis.__s76dN13; Hooks.off("drpgRouteSettled", R.on); Hooks.off("updateToken", R.up);
        delete globalThis.__s76dN13; return { heard: R.heard, back: R.back !== null };`);
    /* Until E79 C14 the GM announced the route as accepted before the put-back, then as refused: read on 16.10.2026 with
       movement.mjs and passages-gm.mjs at the parent, [[true, null, false], [false, null, true]] (the old gate held back
       only a refusal whose put-back was on its way, and the payload named no room). */
    check("D N13: while the audit sends Botan back, the GM's browser announces his route once, as refused, in the Cafeteria where the put-back "
        + "stands him, after the put-back reached it, and nothing before it (E79 C14)",
    plainHeard.back && J(plainHeard.heard) === J([[false, "Cafeteria", true]]), J(plainHeard));
    const held = await attempt([1250, 600]);
    const blind = r => J({ ...r, whispers: null, quiet: null, rows: r.rows.map(x => ({ ...x, wall: null, passage: null })) });
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
        [revert, teleport, displace].every(r => sentBack(r)), J({ revert, teleport, displace }));

    const elsewhere = await (async () => {
        await gm.eval(`globalThis.__s76dView = canvas.scene; canvas.scene = game.scenes.get(${J(IDS.annex)}); return true;`);
        try { return { r: await attempt(ACROSS), on: await gm.eval(`return canvas.scene?.id;`) }; }
        finally { await gm.eval(`canvas.scene = globalThis.__s76dView; delete globalThis.__s76dView; return true;`); }
    })();
    check("D: with the GM looking at the Annex the same move is put back the same way",
        elsewhere.on === IDS.annex && sentBack(elsewhere.r) && blind(elsewhere.r) === blind(plain), J(elsewhere));

    /* Review r1, SEC S1: the spot a put-back leaves is in no GM's record of the token, so the owner's send-back
       through the bridge (`token.sendBack`, judged by `guardSendbackPlace` on that record) cannot take Botan there. */
    const ops0 = opLog.length;
    const asked = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const r = await B.requestSendBack(${J(IDS.scene)}, ${J(BOTAN)}, { x: ${ACROSS[0]}, y: ${ACROSS[1]} });
        return { ok: r.ok, refused: r.refused ?? null, reason: r.reason ?? null };`, { timeout: 30000 });
    await settle(1500);
    const askedAt = (await onGm()).at, askedWrites = opLog.slice(ops0).filter(o => o.coll === "Token" || o.embeddedName === "Token").map(o => `${o.who} ${o.action}`);
    if (J(askedAt) !== J(HOME)) { await putBack(); await settle(800); }
    check("D: p2 asks the GM through the bridge to send Botan back to the spot the audit has just put him back from: refused as a spot he did not stand on a moment ago, Botan where the GM saw him and no token written",
        asked.ok === false && asked.refused === true && asked.reason === "notWhereItStood" && J(askedAt) === J(HOME) && askedWrites.length === 0,
        J({ asked, askedAt, askedWrites }));

    /* Review r2, SEC M1 (= cor F2 = goal H1 a; the reviewers' SECR2-P1 and probe76): the guard also takes the centre of a
       room Botan stood in within the minute - the Cafeteria's, across the ordinary wall from HOME - and the GM's write of
       it was exempt as a GM's move: at 33ea568 Botan stood there, 0 rows, 0 whispers. The write names p2 now and is
       judged as p2's own move. Asked after the put-back, and in the same breath as a move across the wall; and a move
       written before the put-back lands (goal H1 b) - across, then back over the wall - which was judged from across
       and put back there after the first put-back. Each time Botan ends on the near side, p2's rows the plain wall's. */
    const toCentre = await viaBridge(centre);
    if (J(toCentre.at) !== J(HOME)) { await putBack(); await settle(800); }
    const withMove = await viaBridge(centre, { forged: [ACROSS] });
    if (J(withMove.at) !== J(HOME)) { await putBack(); await settle(800); }
    const NEAR = [1200, 450];
    const twoMoves = await viaBridge(null, { forged: [ACROSS, NEAR] });
    if (J(twoMoves.at) !== J(HOME) && J(twoMoves.at) !== J(NEAR)) { await putBack(); await settle(800); }
    check("D: p2's send-back through the bridge to the Cafeteria's centre, across the ordinary wall, is p2's own crossing - Botan put back where the GM saw him and told to p2, asked after the put-back or with a move across in the same breath; and a move back over the wall written before the put-back lands leaves him on the near side",
        J(centre) === J([1550, 450]) && toCentre.asked?.ok === true && J(toCentre.at) === J(HOME) && toCentre.rows.length === 1 && p2Rows(toCentre, "sendBack")
            && J(toCentre.packets) === J([{ from: "gm", to: [IDS.p2] }]) && J(toCentre.codes) === J(["wall"])
            && withMove.asked?.ok === true && J(withMove.at) === J(HOME) && p2Rows(withMove, "sendBack")
            && [HOME, NEAR].some(spot => J(spot) === J(twoMoves.at)) && twoMoves.rows.length <= 2 && p2Rows(twoMoves, "sendBack"),
        J({ centre, toCentre, withMove, twoMoves }));

    /* Review r1, goal F1: a route that stops on a wall's line and goes on across it in a second move crosses the wall.
       Botan at 1450,400 has his centre on the ordinary wall's line (x 1500, y 400-800); from there to 1550,400 he is on
       its far side. Each move alone ends on the line or leaves it, and only the two together go through. */
    const ONLINE = [1450, 400];
    const onStand = await attempt(ONLINE);
    const onBack = await attempt(ACROSS);
    await putBack();
    await settle(800);
    check("D: Botan stops on the ordinary wall's line, which stands, and goes on to its far side in a second move: put back onto the line, as through the wall",
        stood(onStand, ONLINE) && sentBack(onBack, ONLINE) && onBack.rows[0].wall === set.plain, J({ onStand, onBack }));

    /* Review r2, SEC M2 (the reviewers' SECR2-P2): onto the line, back home, onto the line again by a REVERT the audit
       exempts (a spot of the GMs' record), then off it to the far side. The exempt landing kept no side at 33ea568:
       Botan at 1550,400, 0 rows. The control first: the exempt landing, then back to the side it came from. */
    const exemptLine = async () => {
        const steps = {};
        for (const [name, to, options] of [["s1", ONLINE], ["s2", HOME], ["s3", ONLINE, { drpgRevert: true }], ["back", HOME],
            ["s3b", ONLINE, { drpgRevert: true }], ["s4", ACROSS]]) steps[name] = await attempt(to, options ?? {});
        return steps;
    };
    const line = await exemptLine();
    await putBack();
    await settle(800);
    check("D: Botan stands on the wall's line by a REVERT the audit lets stand, and goes back to his side: nothing; on it again and off to the far side: put back onto the line, as through the wall",
        stood(line.s1, ONLINE) && stood(line.s2, HOME) && stood(line.s3, ONLINE) && stood(line.back, HOME) && stood(line.s3b, ONLINE)
            && sentBack(line.s4, ONLINE) && line.s4.rows[0].wall === set.plain,
        J(line));

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

    /* SEC M1 in 'log' mode: p2's send-back to the centre across the wall stands, and is p2's row. SEC M2 in 'log' mode, by
       the other exempt road - the bridge's send-back onto the wall's line, a spot of the record - then off it to the far
       side: a row. The control: p2's send-back to a spot of the record off any line, where the GM saw Botan a moment ago. */
    const logCentre = await viaBridge(centre);
    await putBack();
    await settle(800);
    const logOn = await attempt(ONLINE), logHome = await attempt(HOME);
    const logBridge = await viaBridge(ONLINE), logAcross = await attempt(ACROSS);
    const logBackHome = await viaBridge(HOME);
    check("D: in 'log' mode p2's send-back to the centre across the wall stands with p2's row; the bridge's send-back onto the wall's line stands with none, the step on to the far side has its row, and a send-back to where the GM saw Botan a moment ago has none",
        logCentre.asked?.ok === true && J(logCentre.at) === J(centre) && logCentre.rows.length === 1 && p2Rows(logCentre, "log") && logCentre.packets.length === 0
            && stood(logOn, ONLINE) && stood(logHome, HOME) && logBridge.asked?.ok === true && J(logBridge.at) === J(ONLINE) && logBridge.rows.length === 0
            && J(logAcross.at) === J(ACROSS) && logAcross.rows.length === 1 && logAcross.rows[0].mode === "log" && logAcross.rows[0].wall === set.plain
            && logBackHome.asked?.ok === true && J(logBackHome.at) === J(HOME) && logBackHome.rows.length === 0 && logBackHome.counted === 0,
        J({ logCentre, logOn, logHome, logBridge, logAcross, logBackHome }));
    await putBack();
    await settle(800);

    const onStandLog = await attempt(ONLINE);
    const onLogged = await attempt(ACROSS);
    await putBack();
    await settle(800);
    check("D: in 'log' mode the same two moves stand, and the second has its row in the Debug log, with nothing sent or whispered",
        stood(onStandLog, ONLINE) && J(onLogged.at) === J(ACROSS) && onLogged.packets.length === 0 && onLogged.whispers.length === 0
            && onLogged.rows.length === 1 && onLogged.rows[0].mode === "log" && onLogged.rows[0].wall === set.plain,
        J({ onStandLog, onLogged }));

    /* Review r1, goal F6 and cor F3: the audit keeps a row of every crossing it judged (`game.drpg.passages.audit()`),
       and the GMs are whispered once per token and mover in 30 s - held followed plain within seconds. */
    const crossed = { plain, held, revert, teleport, displace, elsewhere: elsewhere.r, onBack, logged, onLogged };
    const audit = await gm.eval(`const a = game.drpg.passages.audit?.() ?? null;
        return a && { dropped: a.dropped, rows: a.rows.filter(r => r.token === ${J(BOTAN)}).map(r => [r.verdict, r.mode, r.times, r.quiet]) };`);
    check("D: the audit counts each crossing once on its rows, and the GMs are whispered of the first put-back, not of the next one seconds later",
        Object.values(crossed).every(r => r.counted === 1) && [onStand, onStandLog, lawful].every(r => r.counted === 0)
            && plain.whispers.length === 1 && held.whispers.length === 0 && held.quiet === 1
            && typeof audit?.dropped === "number" && audit.rows.some(([verdict]) => verdict === "sent back") && audit.rows.some(([verdict]) => verdict === "noted"),
        J({ counted: Object.fromEntries(Object.entries(crossed).map(([k, r]) => [k, [r.counted, r.whispers.length, r.quiet]])), audit }));

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

    /* SEC S3 (E79 fix r1-G2): p1 loses its only student, Aiko, who knows phase A's passage. Until the fix the copy the
       primary sent p1 had no stamp at all, which a player's browser refuses, so p1 went on holding Aiko's passage; now
       the copy is empty, stamped above the reset's cut, and sent to p1 alone. Aiko's ownership is put back as it was found,
       and p1's copy holds the passage again. */
    const lost = await (async () => {
        const before = Object.keys(await known(p1, repoUrl) ?? {});
        const found = await gm.eval(`return foundry.utils.deepClone(game.actors.get(${J(IDS.aiko)}).ownership);`);
        const mark = socketTraffic.length;
        await gm.eval(`await game.actors.get(${J(IDS.aiko)}).update({ ownership: { ${J(IDS.p1)}: 0 } }); return true;`);
        await settle(1500);
        const after = await known(p1, repoUrl);
        const sent = socketTraffic.slice(mark).filter(t => t.action === "passage.rows").map(t => t.to);
        await gm.eval(`await game.actors.get(${J(IDS.aiko)}).update({ ownership: ${J(found)} }); return true;`);
        await settle(1500);
        const ownership = await gm.eval(`return game.actors.get(${J(IDS.aiko)}).ownership;`);
        return { before, after, sent, back: Object.keys(await known(p1, repoUrl) ?? {}), same: J(ownership) === J(found) };
    })();
    check("D: a player who no longer owns any student holds no passage - p1's copy empties, sent to p1 alone, and comes back with Aiko's ownership as found",
        lost.before.length === 1 && lost.after !== null && typeof lost.after === "object" && Object.keys(lost.after).length === 0
            && lost.sent.length >= 1 && lost.sent.every(to => J(to) === J([IDS.p1])) && J(lost.back) === J(lost.before) && lost.same, J(lost));
}

const PHASE_E = "E: the Passages tab - Close, Open, a revoke, a grant, the wall moved and Delete, each from the GM's Room Setup, and what p1, p2 and p3 are sent";

/* Phase E's own gm.eval prelude: the open Room Setup's element, a row of the passage, and a wait. */
const TAB = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };
    const s = globalThis.__s76e, row = () => s.el?.querySelector('[data-drpg-passage="' + s.id + '"]') ?? null;
    const press = selector => { const b = row()?.querySelector(selector); if (b) b.click(); return Boolean(b); };
    const chips = col => [...(row()?.querySelectorAll('td:nth-child(' + col + ') [data-drpg-actor].drpg-passage-chip') ?? [])].map(c => c.dataset.drpgActor);
    const state = () => row()?.querySelector('.drpg-passage-state')?.dataset.state ?? null;`;

async function phaseE({ gm, p1, check, phase, settle, dump, socketTraffic, IDS, repoUrl, baseline }) {
    phase(PHASE_E, { flow: "secret-passages" });
    const from = socketTraffic.length;
    /* Phase A's passage (its stretch starts at the marker) and Aiko's grant are still there: phase D took back only its own. */
    const opened = await gm.eval(`
        const until = async (test, ms = 8000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };
        const G = await import("${repoUrl}/scripts/passages-gm.mjs"), V = await import("${repoUrl}/scripts/vault.mjs");
        const passage = G.listPassages().find(p => p.sceneId === ${J(IDS.scene)} && p.passageSeg?.x1 === ${MARK});
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const pending = V.openRoomSetupDialog({ tab: "passages" });
        const app = await until(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.("[data-drpg-passages]")));
        globalThis.__s76e = { id: passage?.id ?? null, wall: passage?.passageWallId ?? null, el: app?.element ?? null, app, pending, was };
        const el = app?.element;
        return { id: passage?.id ?? null, wall: passage?.passageWallId ?? null, aiko: Boolean(passage?.access?.[${J(IDS.aiko)}]),
            title: app?.options?.window?.title ?? null, tab: el?.querySelector('[data-drpg-tab="passages"]') ? true : false,
            row: Boolean(el?.querySelector('[data-drpg-passage="' + passage?.id + '"]')) };`, { timeout: 30000 });
    const scene = await gm.eval(`return game.i18n.format("DRPG.Vault.manageTitleOn", { scene: game.scenes.get(${J(IDS.scene)}).name });`);
    /* p3's world as phase D left it, the measure of this phase: not phase 0's baseline, from which phases C and D part by
       three world settings their put-backs write as values that were unset (sealedRooms [], restrictions {}, moveAudit
       "log"; read 15.10.2026 on this phase's first run, with `printDiff`). Phase A's wall is still in it. */
    const start = await dump("p3");
    const found = worldPrint(start), foundBare = worldPrint(start, { without: opened.wall });
    check("E: the GM's Room Setup opens on the Passages tab, with a row for phase A's passage, which Aiko knows",
        typeof opened.id === "string" && opened.aiko && opened.title === scene && opened.tab && opened.row, J({ opened, scene }));

    /* Close: p1's copy is empty, the GMs keep Aiko's grant; Open: p1's copy holds the row again. */
    const closed = await gm.eval(`${TAB} press('[data-drpg-passage-act="close"]'); await until(() => state() === "closed");
        const G = await import("${repoUrl}/scripts/passages-gm.mjs");
        return { state: state(), knows: chips(2), kept: Boolean(G.listPassages().find(p => p.id === s.id)?.access?.[${J(IDS.aiko)}]) };`, { timeout: 15000 });
    await settle(600);
    const copyClosed = await known(p1, repoUrl);
    const reopened = await gm.eval(`${TAB} press('[data-drpg-passage-act="open"]'); await until(() => state() === "secret"); return { state: state(), knows: chips(2) };`, { timeout: 15000 });
    await settle(600);
    const copyOpen = await known(p1, repoUrl);
    check("E: Close in the tab empties p1's copy and keeps Aiko in Who knows; Open gives p1 the row back",
        closed.state === "closed" && J(closed.knows) === J([IDS.aiko]) && closed.kept && J(copyClosed) === "{}"
            && reopened.state === "secret" && J(reopened.knows) === J([IDS.aiko]) && Object.keys(copyOpen).includes(opened.id),
        J({ closed, copyClosed, reopened, copyOpen }));

    /* The revoke: Aiko's cross. Phase D put her back in Dorm A, and the rooms the cross asks about are the map's either
       side of the passage's stretch - the Cafeteria on both (passages-gm.mjs `passageRoomsOnMap`, E79 fix r1-G3) - so the
       cross revokes at once, unasked; "now" is queued all the same, and an answer left over is that road. */
    const revoked = await gm.eval(`${TAB} let asked = null;
        globalThis.__dialogAnswers.push(config => { asked = config.window?.title ?? "?"; return "now"; });
        press('[data-drpg-passage-act="revoke"][data-drpg-actor="${IDS.aiko}"]');
        await until(() => chips(2).length === 0);
        const left = globalThis.__dialogAnswers.length; globalThis.__dialogAnswers.length = 0;
        return { asked, left, knows: chips(2) };`, { timeout: 15000 });
    await settle(600);
    const copyRevoked = await known(p1, repoUrl);
    const d3 = await dump("p3");
    check("E: Aiko's cross, unasked while she stands outside the passage's rooms, takes her off Who knows and empties p1's copy; after Close, Open and the revoke p3's world is as this phase found it, and the world-secrets scan finds nothing",
        revoked.asked === null && J(revoked.knows) === "[]" && J(copyRevoked) === "{}" && worldPrint(d3) === found && worldScan(d3).length === 0,
        J({ revoked, copyRevoked, diff: printDiff(found, worldPrint(d3)), hits: worldScan(d3) }));

    /* Review r1, cor F1 and SEC S5 (E79 fix r1-G3, 15.10.2026). Beside the passage the cross asks, and 'Revoke when they
       leave the room' holds until a route of hers settles outside the room. The GM stands Aiko in the Cafeteria and gives
       her the passage back from the console: phase A's console made it naming no room, and until the fix the tab asked
       only about the names a row holds, so her cross revoked it at once, unasked. "leave" is answered; p1 moves her by a
       legal route inside the Cafeteria (the cell stays, p1's copy holds the row), then out of it into no room (the cell
       is gone on the GM, p1's copy is empty: the primary's `revokeLeavers` on her settled route). Her place, actions and
       free Move are put back as the step found them. */
    const leaving = await gm.eval(`${TAB}
        const t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000"), a = t.actor;
        s.aiko = { at: { x: t.x, y: t.y }, actions: game.drpg.actionsLeft(a), free: a.getFlag("danganronpa-rpg", "freeMoveUsed") ?? null };
        await t.update({ x: 1600, y: 300 }, { teleport: true, movementAction: "displace", animate: false });
        const G = await import("${repoUrl}/scripts/passages-gm.mjs"), M = await import("${repoUrl}/scripts/movement.mjs");
        const cellOf = () => G.listPassages().find(p => p.id === s.id)?.access?.[${J(IDS.aiko)}] ?? null;
        const granted = await game.drpg.passages.grant(s.id, ${J(IDS.aiko)});
        await until(() => chips(2).length === 1);
        let asked = null;
        globalThis.__dialogAnswers.push(config => { asked = config.window?.title ?? "?"; return "leave"; });
        press('[data-drpg-passage-act="revoke"][data-drpg-actor="${IDS.aiko}"]');
        await until(() => typeof cellOf()?.leave === "string" || !cellOf());
        await until(() => row()?.querySelector('[data-drpg-passage-leave]'), 2000);
        const left = globalThis.__dialogAnswers.length; globalThis.__dialogAnswers.length = 0;
        return { granted, asked, left, leave: cellOf()?.leave ?? null, room: M.roomOfToken(t) ?? null,
            chip: Boolean(row()?.querySelector('[data-drpg-passage-leave]')) };`, { timeout: 30000 });
    await settle(600);
    const copyLeaving = Object.keys(await known(p1, repoUrl) ?? {});
    const stepTo = (x, y) => p1.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: ${x}, y: ${y} }); return true;`, { timeout: 30000 });
    const aikoNow = async () => ({ ...(await gm.eval(`const G = await import("${repoUrl}/scripts/passages-gm.mjs"), M = await import("${repoUrl}/scripts/movement.mjs");
        const t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000");
        return { at: [t.x, t.y], room: M.roomOfToken(t) ?? null, cell: G.listPassages().find(p => p.id === ${J(opened.id)})?.access?.[${J(IDS.aiko)}] ?? null };`)),
        copy: await known(p1, repoUrl) });
    await stepTo(1700, 300);
    await settle(1500);
    const inside = await aikoNow();
    /* Review round 3, cor D (E79 fix r3-G3, 17.10.2026). The same step out, refused: Aiko has no action and no free Move
       left, and p1's veto is taken off for the one update, so p1's charge refuses the route and puts her back. The GM,
       the route's co-owner, announces a route of one update at once (E79 C14), and until this fix its primary revoked
       her 'leave' cell on that announcement, before the put-back landed: the passage gone, on the GM and in p1's copy,
       for a step that never stood. The GM's announcements of her token are read as [accepted, room, whether it came
       provisional, what that answered]; her budget is put back before the legal step out below. */
    await gm.eval(`const a = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000").actor;
        await game.drpg.setActions(a, 0); await a.setFlag("danganronpa-rpg", "freeMoveUsed", true);
        const R = globalThis.__s76eD = { heard: [] };
        R.on = ({ tokenDoc, accepted, room, provisional }) => {
            if (tokenDoc?.id !== "TOKAIKO000000000") return;
            const row = [accepted, room ?? null, Boolean(provisional), null];
            R.heard.push(row);
            if (provisional) provisional.then(v => { row[3] = v; });
        };
        Hooks.on("drpgRouteSettled", R.on); return true;`, { timeout: 30000 });
    await settle(600);
    const refusedVeto = await p1.eval(`const list = Hooks._hooks.get("preUpdateToken") ?? [], at = list.findIndex(e => e.fn.name === "onPreUpdateToken");
        const [veto] = at >= 0 ? list.splice(at, 1) : [];
        try { await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 2100, y: 300 }); }
        finally { if (veto) list.splice(at, 0, veto); }
        return Boolean(veto);`, { timeout: 30000 });
    await settle(2500);
    const refusedOut = await aikoNow();
    const refusedHeard = await gm.eval(`const R = globalThis.__s76eD, s = globalThis.__s76e, a = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000").actor;
        Hooks.off("drpgRouteSettled", R.on); delete globalThis.__s76eD;
        await game.drpg.setActions(a, s.aiko.actions);
        if (s.aiko.free === null) await a.unsetFlag("danganronpa-rpg", "freeMoveUsed"); else await a.setFlag("danganronpa-rpg", "freeMoveUsed", s.aiko.free);
        return R.heard;`, { timeout: 30000 });
    await settle(600);
    check("E: a step out of the Cafeteria that p1's charge refuses and puts back keeps 'Revoke when they leave the room' - the cell on the GM and the row in p1's copy - and the GM announced it provisional, answered false when the put-back landed (E79 fix r3-G3)",
        refusedVeto && J(refusedOut.at) === J([1700, 300]) && refusedOut.room === "Cafeteria" && refusedOut.cell?.leave === "Cafeteria"
            && Object.keys(refusedOut.copy ?? {}).includes(opened.id) && J(refusedHeard) === J([[true, null, true, false], [false, "Cafeteria", false, null]]),
        J({ refusedVeto, refusedOut, refusedHeard }));
    await stepTo(2100, 300);
    await settle(1500);
    /* The GM's cell is gone within the 1500 ms; p1's copy follows it, the packet to p1 alone. How long after is not
       fixed: one reading of 15.10.2026 put it 4.5 s after the step, a run of 76 alone the same day 500 ms past the
       1500 (`waited`, in the check's details). So it is waited for, up to 8 s, rather than with a longer fixed wait. */
    let outside = await aikoNow(), waited = 0;
    for (; waited < 8000 && !(outside.cell === null && J(outside.copy) === "{}"); waited += 500) {
        await settle(500);
        outside = await aikoNow();
    }
    await gm.eval(`const s = globalThis.__s76e, t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKAIKO000000000"), a = t.actor;
        await t.update(s.aiko.at, { teleport: true, movementAction: "displace", animate: false });
        await game.drpg.setActions(a, s.aiko.actions);
        if (s.aiko.free === null) await a.unsetFlag("danganronpa-rpg", "freeMoveUsed"); else await a.setFlag("danganronpa-rpg", "freeMoveUsed", s.aiko.free);
        return true;`, { timeout: 30000 });
    await settle(600);
    check("E: stood in the Cafeteria, which the map puts on both sides of the passage, Aiko's cross asks; 'Revoke when they leave the room' keeps it while p1 moves her inside the room, and takes it - on the GM and in p1's copy - once p1 moves her out",
        leaving.granted === true && typeof leaving.asked === "string" && leaving.left === 0 && leaving.leave === "Cafeteria" && leaving.room === "Cafeteria"
            && leaving.chip && copyLeaving.includes(opened.id)
            && J(inside.at) === J([1700, 300]) && inside.room === "Cafeteria" && inside.cell?.leave === "Cafeteria" && Object.keys(inside.copy ?? {}).includes(opened.id)
            && J(outside.at) === J([2100, 300]) && outside.room === null && outside.cell === null && J(outside.copy) === "{}",
        J({ leaving, copyLeaving, inside, outside, waited }));

    /* The grant: '+' and then Aiko's name, two clicks. */
    const granted = await gm.eval(`${TAB} const add = press('[data-drpg-passage-act="menu"][data-drpg-menu="grant"]');
        const shown = row()?.querySelector('[data-drpg-menu-of="grant"]')?.hidden === false;
        press('[data-drpg-menu-of="grant"] [data-drpg-passage-act="grant"][data-drpg-actor="${IDS.aiko}"]');
        await until(() => chips(2).length === 1);
        /* The primary's own grant sends p1 the copy before the tab draws (passages-gm.mjs \`tellAfter\`): no "not yet
           delivered" line, then or a redraw later (cor F2's stale line came from a push later than the redraw). */
        await new Promise(r => setTimeout(r, 600));
        return { add, shown, knows: chips(2), pending: row()?.querySelector('[data-state="pending"]')?.textContent ?? null };`, { timeout: 15000 });
    await settle(600);
    const copyGranted = await known(p1, repoUrl);
    check("E: '+' and Aiko's name grant her the passage again - two clicks - p1's copy holds the row, and the tab names nobody not yet sent it",
        granted.add && granted.shown && J(granted.knows) === J([IDS.aiko]) && Object.keys(copyGranted).includes(opened.id) && granted.pending === null,
        J({ granted, copyGranted }));

    /* The wall moved off the stretch: the primary GM marks the passage broken, p1's copy drops it, the tab says so and offers
       no Open; the wall put back where it was leaves it broken (a GM picks the stretch again, C6). */
    const broken = await gm.eval(`${TAB} const wall = game.scenes.get(${J(IDS.scene)}).walls.get(s.wall);
        await wall.update({ c: [1100, 500, 1400, 500] });
        await until(() => state() === "broken");
        const text = row()?.querySelector('.drpg-passage-state')?.textContent ?? null;
        const toggle = row()?.querySelector('[data-drpg-passage-act="open"], [data-drpg-passage-act="close"]');
        await wall.update({ c: [1100, 400, 1400, 400] });
        await new Promise(r => setTimeout(r, 400));
        return { state: state(), text, toggle: toggle ? [toggle.dataset.drpgPassageAct, toggle.disabled] : null,
            c: wall.c ?? wall.toObject().c };`, { timeout: 15000 });
    await settle(600);
    const copyBroken = await known(p1, repoUrl);
    const brokenWord = await gm.eval(`return game.i18n.localize("DRPG.Passage.tab.stateBroken");`);
    check("E: the passage's wall moved off its stretch - the tab reads it broken with its Close held, p1's copy is empty, and the wall put back leaves it broken",
        broken.state === "broken" && broken.text === brokenWord && J(broken.toggle) === J(["close", true]) && J(broken.c) === J([1100, 400, 1400, 400])
            && J(copyBroken) === "{}", J({ broken, brokenWord, copyBroken }));

    /* Delete, after the tab's question (yes queued), then the window closed and phase A's wall taken back. */
    const deleted = await gm.eval(`${TAB} globalThis.__dialogAnswers.push(true);
        press('[data-drpg-passage-act="delete"]');
        await until(() => !row());
        const G = await import("${repoUrl}/scripts/passages-gm.mjs");
        const gone = !G.listPassages().some(p => p.id === s.id), empty = Boolean(s.el?.querySelector("[data-drpg-passage-empty]"));
        await s.app?.close?.();
        const closed = await Promise.race([s.pending.then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]);
        globalThis.__dialogWindows = s.was;
        const scene = game.scenes.get(${J(IDS.scene)});
        if (scene.walls.get(s.wall)) await scene.deleteEmbeddedDocuments("Wall", [s.wall]);
        delete globalThis.__s76e;
        return { gone, empty, closed, wall: Boolean(scene.walls.get(s.wall ?? "")) };`, { timeout: 30000 });
    await settle(600);
    const after = await dump("p3");
    const rows = socketTraffic.slice(from).filter(t => t.action === "passage.rows");
    const stray = rows.filter(t => !Array.isArray(t.to) || t.to.length !== 1 || t.from !== "gm");
    check("E: Delete asks, then removes the row and leaves the tab's empty line; the window closes; p3's world is as this phase found it but for phase A's wall, gone, and phase 0's but for phases C and D's three settings",
        deleted.gone && deleted.empty && deleted.closed && !deleted.wall && worldPrint(after) === foundBare && worldScan(after).length === 0
            && J(printDiff(baseline, worldPrint(after)).map(d => d.split(":")[0])) === J(["danganronpa-rpg.sealedRooms", "danganronpa-rpg.restrictions", "danganronpa-rpg.moveAudit"]),
        J({ deleted, diff: printDiff(foundBare, worldPrint(after)), fromBaseline: printDiff(baseline, worldPrint(after)), hits: worldScan(after) }));
    check("E: every copy the GM sent in this phase names one player, and Aiko's player was sent hers",
        rows.length > 0 && stray.length === 0 && rows.some(t => J(t.to) === J([IDS.p1])), J(rows.map(t => ({ to: t.to, from: t.from }))));
}

const PHASE_F = "F: the pick and the GMs' overlay - a passage made with two clicks from the GM's Room Setup, drawn on the GM's board alone";

/* Phase F's own gm.eval prelude: a wait, the pick's window, a click or a pointer on the board through the stage's
   listeners the pick added (`__s76f.hands`), and the overlay's layers on the GM's canvas. */
const PICK = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };
    const f = globalThis.__s76f;
    const prompt = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.("[data-drpg-pick-step]")) ?? null;
    const line = sel => { const n = prompt()?.element?.querySelector(sel); return n && !n.hidden ? n.textContent : null; };
    const at = (x, y) => ({ button: 0, getLocalPosition: () => ({ x, y }) });
    const overlays = () => canvas.interface.children.filter(c => c.name === "drpgGmOverlay");
    const layer = name => overlays()[0]?.children.find(c => c.name === name) ?? null;
    const drawn = () => (layer("passages")?.children ?? []).map(g => [g.name, g.drpgState]);`;

/* What a player's browser holds of the GMs' overlay: containers by its name, and what the overlay's own functions answer there. */
const overlayOn = (client, repoUrl) => client.eval(`const O = await import("${repoUrl}/scripts/gm-overlay.mjs");
    O.redrawGmOverlay();
    return { named: canvas.interface.children.filter(c => c.name === "drpgGmOverlay").length, overlay: O.gmOverlay(), layer: O.overlayLayer("passages") };`);

async function phaseF({ gm, p1, p2, p3, check, phase, settle, dump, IDS, repoUrl }) {
    phase(PHASE_F, { flow: "secret-passages" });
    const MOD = "danganronpa-rpg";
    const start = await dump("p3");
    const found = worldPrint(start);
    const marks = async () => Object.fromEntries(await Promise.all(["p1", "p2", "p3"].map(async c => [c, total(probe(await dump(c)))])));
    const marksBefore = await marks();
    /* Phase C's Kitchen under the Cafeteria and its wall at y 800 again; Room Setup on its Passages tab; the stage's
       listeners recorded, so that a click is the pick's own handler called with a point of the scene. */
    const opened = await gm.eval(`
        const until = async (test, ms = 8000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };
        const scene = game.scenes.get(${J(IDS.scene)});
        const [kitchen] = await scene.createEmbeddedDocuments("Region", [{ name: "Kitchen", behaviors: [],
            shapes: [{ type: "rectangle", x: 1200, y: 800, width: 800, height: 300 }], flags: { "${MOD}": { room: true, drpgNeighbours: "Gym" } } }]);
        const [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [1200, 800, 2000, 800] }]);
        const hands = {}, stage = canvas.stage;
        stage.on = (event, fn) => { hands[event] = fn; return stage; };
        stage.off = (event, fn) => { if (hands[event] === fn) delete hands[event]; return stage; };
        const V = await import("${repoUrl}/scripts/vault.mjs");
        const was = globalThis.__dialogWindows; globalThis.__dialogWindows = true;
        const pending = V.openRoomSetupDialog({ tab: "passages" });
        const app = await until(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.("[data-drpg-passage-new]")));
        globalThis.__s76f = { kitchen: kitchen?.id, wall: wall?.id, hands, app, el: app?.element ?? null, pending, was };
        const button = app?.element?.querySelector("[data-drpg-passage-new]");
        button?.click();
        await until(() => hands.pointerdown && document.querySelector("[data-drpg-pick-step]"));
        return { kitchen: Boolean(kitchen), wall: Boolean(wall), button: button?.textContent ?? null, board: Object.keys(hands).sort() };`, { timeout: 30000 });
    const texts = await gm.eval(`return { step2: game.i18n.format("DRPG.Passage.pick.step", { n: 2 }), noWall: game.i18n.localize("DRPG.Passage.pick.why.noWall"),
        button: game.i18n.localize("DRPG.Passage.pick.new"), made: game.i18n.format("DRPG.Passage.pick.made", { passage: "Cafeteria - Kitchen" }) };`);
    const picked = await gm.eval(`${PICK}
        const noted = globalThis.__notifications.length;
        f.hands.pointerdown?.(at(1234.5, 860));
        const missed = line("[data-drpg-pick-why]");
        f.hands.pointerdown?.(at(1234.5, 803));
        const second = { step: line("[data-drpg-pick-step]"), where: line("[data-drpg-pick-where]"), why: line("[data-drpg-pick-why]"),
            tucked: f.el?.style.visibility ?? null };
        f.hands.pointermove?.(at(1334.5, 797));
        const preview = (layer("pick")?.children ?? []).flatMap(g => g._calls ?? []).filter(([k]) => k === "drawCircle").map(([, a]) => a.slice(0, 3));
        f.hands.pointerdown?.(at(1334.5, 797));
        const G = await import("${repoUrl}/scripts/passages-gm.mjs");
        const made = await until(() => G.listPassages().find(p => p.sceneId === ${J(IDS.scene)} && p.passageWallId === f.wall));
        await until(() => !prompt() && !f.hands.pointerdown);
        await until(() => f.el?.querySelector('[data-drpg-passage="' + made?.id + '"]'));
        f.id = made?.id ?? null;
        return { missed, second, preview, back: f.el?.style.visibility ?? null, id: made?.id ?? null, seg: made?.passageSeg ?? null, rooms: made?.rooms ?? null, state: made?.state ?? null,
            prompt: Boolean(prompt()), board: Object.keys(f.hands), row: Boolean(f.el?.querySelector('[data-drpg-passage="' + made?.id + '"]')),
            told: globalThis.__notifications.slice(noted).map(n => n.msg), overlays: overlays().length, drawn: drawn(), pick: layer("pick")?.children.length ?? null };`, { timeout: 30000 });
    check("F: 'New passage' in the GM's Room Setup, a click off the wall refused in the pick's window, then two clicks on the Kitchen's wall - the passage is made on the stretch between them, Room Setup hidden meanwhile and back after, the window and the board's listeners gone, and the GMs' overlay draws it",
        opened.kitchen && opened.wall && opened.button === texts.button && J(opened.board) === J(["pointerdown", "pointermove"])
            && picked.missed === texts.noWall && J(picked.second) === J({ step: texts.step2, where: "Cafeteria - Kitchen", why: null, tucked: "hidden" }) && picked.back === ""
            && J(picked.preview) === J([[1234.5, 800, 9], [1334.5, 800, 12]])
            && J(picked.seg) === J({ x1: 1234.5, y1: 800, x2: 1334.5, y2: 800 }) && J(picked.rooms) === J(["Cafeteria", "Kitchen"]) && picked.state === "secret"
            && !picked.prompt && J(picked.board) === "[]" && picked.row && picked.told.includes(texts.made)
            && picked.overlays === 1 && J(picked.drawn) === J([[picked.id, "secret"]]) && picked.pick === 0,
        J({ opened, picked, texts }));

    /* Close from the tab: the overlay is drawn again from the GMs' record, the passage grey; Delete takes it off. */
    const redrawn = await gm.eval(`${PICK}
        const J = v => JSON.stringify(v);
        f.el?.querySelector('[data-drpg-passage="' + f.id + '"] [data-drpg-passage-act="close"]')?.click();
        await until(() => J(drawn()) === J([[f.id, "closed"]]));
        const closed = drawn();
        const O = await import("${repoUrl}/scripts/gm-overlay.mjs");
        O.redrawGmOverlay(); O.redrawGmOverlay();
        const once = overlays().length;
        await game.drpg.passages.delete(f.id);
        await until(() => drawn().length === 0);
        return { closed, once, after: drawn() };`, { timeout: 30000 });
    await settle(600);
    check("F: Close in the tab draws the passage again as closed on the GM's overlay, asked twice more the overlay is still one, and a deleted passage leaves it",
        J(redrawn.closed) === J([[picked.id, "closed"]]) && redrawn.once === 1 && J(redrawn.after) === "[]", J(redrawn));

    /* The players: no overlay on any of them, whatever is asked of it. */
    const players = { p1: await overlayOn(p1, repoUrl), p2: await overlayOn(p2, repoUrl), p3: await overlayOn(p3, repoUrl) };
    check("F: no player's browser holds the GMs' overlay - none by its name, and its own functions answer nothing there, even asked to draw",
        Object.values(players).every(p => p.named === 0 && p.overlay === null && p.layer === null), J(players));

    /* Put back: the window, the stage's listeners, the wall and the Kitchen. */
    const back = await gm.eval(`
        const f = globalThis.__s76f, scene = game.scenes.get(${J(IDS.scene)});
        await f.app?.close?.();
        const closed = await Promise.race([f.pending.then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]);
        globalThis.__dialogWindows = f.was;
        delete canvas.stage.on; delete canvas.stage.off;
        if (scene.walls.get(f.wall)) await scene.deleteEmbeddedDocuments("Wall", [f.wall]);
        if (scene.regions.get(f.kitchen)) await scene.deleteEmbeddedDocuments("Region", [f.kitchen]);
        delete globalThis.__s76f;
        return { closed, kitchen: scene.regions.some(r => r.name === "Kitchen"), wall: Boolean(scene.walls.get(f.wall ?? "")) };`, { timeout: 30000 });
    await settle(600);
    const after = await dump("p3");
    const marksAfter = await marks();
    check("F: put back - the window closed, the Kitchen and its wall gone, p3's world as this phase found it, and no player reads the marker in more places than before the pick",
        back.closed && !back.kitchen && !back.wall && worldPrint(after) === found && worldScan(after).length === 0 && J(marksAfter) === J(marksBefore),
        J({ back, diff: printDiff(found, worldPrint(after)), hits: worldScan(after), marksBefore, marksAfter }));
}

const PHASE_G = "G: a show - Aiko's sheet lists her passage, she shows it to Botan beside her, Botan's copy and notice history gain it, nobody else learns anything, a forged or junk show changes nothing";

/* Phase G's own eval prelude: a wait, and the passages as a browser holds them. */
const SHOW = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return v; };
    const g = globalThis.__s76g ?? {};`;

async function phaseG({ gm, gm2, p1, p2, p3, p4, check, phase, settle, dump, socketTraffic, connect, disconnect, storageOf, IDS, repoUrl }) {
    phase(PHASE_G, { flow: "secret-passages" });
    const MOD = "danganronpa-rpg", SOCKET = `module.${MOD}`, PLACE = { teleport: true, movementAction: "displace", animate: false };
    const from = socketTraffic.length;
    const found = worldPrint(await dump("p3"));
    /* The marker on each player outside this phase's own wire and console: a copy sent and taken back leaves it in the
       wire's record, which nothing can take back; every other surface must read as before. */
    const marks = async () => Object.fromEntries(await Promise.all(["p1", "p2", "p3"].map(async c => [c, total(probe(await dump(c), { skip: PHASE_G }))])));
    const marksBefore = await marks();
    /* Phase C's Kitchen under the Cafeteria, its wall and a passage on it at the marker, granted to Aiko; Aiko's token
       in the Cafeteria beside Botan's (1300, 300, where the harness world stands it). */
    const set = await gm.eval(`
        const scene = game.scenes.get(${J(IDS.scene)});
        const [kitchen] = await scene.createEmbeddedDocuments("Region", [{ name: "Kitchen", behaviors: [],
            shapes: [{ type: "rectangle", x: 1200, y: 800, width: 800, height: 300 }], flags: { "${MOD}": { room: true, drpgNeighbours: "Gym" } } }]);
        const [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [1200, 800, 2000, 800] }]);
        const id = await game.drpg.passages.create({ sceneId: scene.id, wallId: wall.id, seg: { x1: 1234.5, y1: 800, x2: 1334.5, y2: 800 } });
        const granted = await game.drpg.passages.grant(id, ${J(IDS.aiko)});
        const aiko = game.actors.get(${J(IDS.aiko)}), t = scene.tokens.get("TOKAIKO000000000");
        globalThis.__s76g = { kitchen: kitchen.id, wall: wall.id, id, at: { x: t.x, y: t.y } };
        await t.update({ x: 1240, y: 600 }, ${J(PLACE)});
        const M = await import("${repoUrl}/scripts/movement.mjs");
        return { id, wall: wall.id, granted, aiko: M.roomOfToken(t), botan: M.roomOfToken(scene.tokens.get("TOKBOTAN00000000")),
            actions: game.drpg.actionsLeft(aiko), sides: M.passageRooms?.(scene, { x1: 1234.5, y1: 800, x2: 1334.5, y2: 800 }, null) };`, { timeout: 30000 });
    await settle(1000);
    const staged = worldPrint(await dump("p3"));
    check("G: the GM draws the Kitchen, its wall and a passage, grants it to Aiko and stands her in the Cafeteria, where Botan stands",
        typeof set.id === "string" && set.granted === true && set.aiko === "Cafeteria" && set.botan === "Cafeteria"
            && J([...(set.sides ?? [])].sort()) === J(["Cafeteria", "Kitchen"]), J(set));

    /* The list, drawn as Daggerheart hands the module its sheet: under the Experience, one row, the rooms as p1 may name
       them, the way open, and nothing on the page of the passage's id, its wall or its stretch. Chie's on p3: no list. */
    const draw = (actorId, waitFor) => `${SHOW}
        const PS = await import("${repoUrl}/scripts/passages.mjs");
        ${waitFor ? `await until(() => PS.knownPassages()[${J(set.id)}]);` : ""}
        const root = document.createElement("div");
        root.innerHTML = '<div class="character-sidebar-sheet"><div class="shortcut-items-section"><div class="experience-section"></div></div></div>';
        Hooks.callAll("renderCharacterSheet", { document: game.actors.get(${J(actorId)}), isEditable: true }, root, {}, { isFirstRender: true });
        const section = root.querySelector(".drpg-passages-section");
        const known = (await import("${repoUrl}/scripts/movement.mjs")).roomsKnownToMe(canvas.scene);
        return { after: section?.previousElementSibling?.classList.contains("experience-section") ?? false,
            title: section?.querySelector("h3")?.textContent ?? null,
            rows: [...root.querySelectorAll(".drpg-passage-row")].map(li => [li.querySelector(".drpg-passage-where")?.textContent ?? null,
                Boolean(li.querySelector(".drpg-passage-shut")), li.querySelector(".drpg-passage-show")?.textContent ?? null]),
            html: root.innerHTML, kitchen: known === null || known.has("Kitchen"),
            texts: { title: game.i18n.localize("DRPG.Passage.list.title"), show: game.i18n.localize("DRPG.Passage.show.button"),
                unexplored: game.i18n.format("DRPG.Listen.unknownRoom", { n: 1 }) } };`;
    const list = await p1.eval(draw(IDS.aiko, true), { timeout: 30000 });
    const chie = await p3.eval(draw(IDS.chie, false));
    /* The two rooms in the order of the passage's sides (movement.mjs `passageRooms`), each as p1 may name it: Aiko went
       into the Kitchen in phase C, so the ledger may hold it. */
    const label = (set.sides ?? []).map(room => (room === "Kitchen" && !list.kitchen ? list.texts.unexplored : room)).join(" - ");
    const leaks = [set.id, set.wall, "1234", "1334"].filter(word => list.html.includes(word));
    check("G: Aiko's sheet on p1 lists her passage under the Experience - the Cafeteria and the Kitchen as p1 may name it, the way open, 'Show the passage' - with nothing of its id, its wall or its stretch on the page; Chie's on p3 lists nothing",
        list.after && list.title === list.texts.title && J(list.rows) === J([[label, false, list.texts.show]]) && leaks.length === 0
            && chie.rows.length === 0 && chie.title === null,
        J({ list: { ...list, html: undefined }, label, leaks, chie: { rows: chie.rows, title: chie.title } }));

    /* Before the show: p2 asks it for Aiko, whom p2 does not own, and p1 sends one by hand with junk where the passage goes. */
    const forged = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestPassageShare({ actorId: ${J(IDS.aiko)}, targetId: ${J(IDS.botan)}, passageId: ${J(set.id)} });
        return { ok: res.ok, reason: res.reason ?? null };`, { timeout: 30000 });
    const junk = await p1.eval(`
        const got = [];
        const on = payload => { if (payload?.requestId === "S76GJUNK" && payload.userId === game.user.id) got.push([payload.action, payload.reason ?? null]); };
        game.socket.on("${SOCKET}", on);
        game.socket.emit("${SOCKET}", { action: "passage.share", userId: game.user.id, requestId: "S76GJUNK", actorId: ${J(IDS.aiko)}, targetId: ${J(IDS.botan)},
            passageId: { id: ${J(set.id)} }, how: "gm", by: { ${J(IDS.aiko)}: 1 }, passageSeg: { x1: 1 } },
            { recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) });
        await new Promise(r => setTimeout(r, 1500));
        game.socket.off?.("${SOCKET}", on);
        return got;`, { timeout: 30000 });
    await settle(600);
    const untouched = await gm.eval(`const G = await import("${repoUrl}/scripts/passages-gm.mjs");
        return { access: Object.keys(G.listPassages().find(p => p.id === ${J(set.id)})?.access ?? {}),
            shows: G.passageLog().filter(r => r.what === "show" && r.passageId === ${J(set.id)}).length };`);
    const p2before = Object.keys(await known(p2, repoUrl));
    check("G: p2's show for Aiko is refused as not p2's, and p1's with junk for the passage as a passage Aiko does not know - nothing written, Botan's copy empty",
        forged.ok === false && forged.reason === "notYours" && junk.some(([a, r]) => a === "bridge.refused" && r === "notKnown") && !junk.some(([a]) => a === "bridge.done")
            && J(untouched) === J({ access: [IDS.aiko], shows: 0 }) && !p2before.includes(set.id),
        J({ forged, junk, untouched, p2before }));

    /* E79 fix r2-G4 (16.10.2026; the round-2 fixes' G4, owed by r2-G2): a show through the bridge from the owner the door
       names for the Mastermind's student, and from that student's other owner. Botan is made the Mastermind and p3 is given
       Botan beside p2, whom the door names (the first connected owner); Botan, whom nobody gave the passage, shows it to
       Aiko, who knows it: nothing is written, and the one card is the giver's, to the player who asked. The bridge hands
       the show its sender as the one who asks (gm-bridge.mjs `handlePassageShare`): with nobody there p2's show is refused
       as a passage Botan does not know, and with the door's owner there p3's is carried out. Then the Mastermind and p3's
       ownership are put back, and p2's copy is waited for without the passage, as p2 held it above. */
    const MM = `const M = await import("${repoUrl}/scripts/mastermind.mjs"), S = await import("${repoUrl}/scripts/gm-stores.mjs"), U = await import("${repoUrl}/scripts/utils.mjs");`;
    const mmIds = await gm.eval(`return game.messages.contents.map(m => m.id);`);
    const mmSet = await gm.eval(`${MM}
        const was = S.mastermindStore.get("record") ?? {}, botan = game.actors.get(${J(IDS.botan)});
        await botan.update({ ${J(`ownership.${IDS.p3}`)}: 3 });
        await M.setMastermind(botan);
        return { was: { actorId: was.actorId ?? null, room: was.room ?? null }, door: U.ownerOf(botan)?.id ?? null, picked: M.mastermindActor()?.id ?? null };`, { timeout: 30000 });
    await settle(800);
    /* Review round 3, cor A (E79 fix r3-G3, 17.10.2026): what the door's owner's own browser holds. p2's copy and the move
       backend for Botan's token through the passage (x 1284.5 on the Kitchen's wall) and beside it on the same wall (x
       1800), read as `readP4` reads them below; `held` waits up to 6 s for the passage to be there, or not, as `want`
       says. Until the fix the player's browser dropped the copy's part "door" (passages.mjs `onPassageRows`), so the
       copy that gives the door's owner every open passage was weighed on parts that had not moved and refused: p2 held
       nothing and Botan was stopped at the passage. With it, the copy p2's browser stored for its next load (`stored`,
       its passages; p2 is one of the harness's seeded clients, which cannot connect again, so the load itself is R555's),
       and below, after the Mastermind is put back, the same without it. */
    const doorRead = want => p2.eval(`${SHOW} const PS = await import("${repoUrl}/scripts/passages.mjs");
        const held = Boolean(await until(() => Boolean(PS.knownPassages()[${J(set.id)}]) === ${want}));
        const object = canvas.tokens.get("TOKBOTAN00000000") ?? null;
        const hit = x => CONFIG.Canvas.polygonBackends.move.testCollision({ x, y: 750 }, { x, y: 850 }, { type: "move", mode: "any", source: { object } });
        let kept = game.settings.storage.get("client").getItem("${MOD}.minePassages");
        while (typeof kept === "string") kept = JSON.parse(kept);
        const stored = Object.keys(kept?.worlds?.[game.world.id]?.[game.user.id]?.value ?? {}).sort();
        return { held, keys: Object.keys(PS.knownPassages()).sort(), stored, knowers: PS.knownPassages()[${J(set.id)}]?.actorIds ?? null, token: Boolean(object),
            through: hit(1284.5), beside: hit(1800) };`, { timeout: 30000 });
    const openNow = () => gm.eval(`const P = await import("${repoUrl}/scripts/passages.mjs");
        return Object.keys(P.secretRowsFrom({ scenes: game.scenes })).sort();`);
    const doorGiven = await doorRead(true), openGiven = await openNow();
    check("G: p2, whom the door names for the Mastermind's student, holds every open passage, the one nobody gave Botan among them, stored for its next load as well, and passes it on the move backend, stopped beside it (E79 fix r3-G3)",
        openGiven.includes(set.id) && doorGiven.held && J(doorGiven.keys) === J(openGiven) && J(doorGiven.stored) === J(openGiven)
            && J(doorGiven.knowers) === J([IDS.botan]) && doorGiven.token && doorGiven.through === false && doorGiven.beside === true,
        J({ openGiven, doorGiven }));
    /* The row answers "ack" (gm-bridge.mjs BRIDGE_ACTIONS), so the asker's answer is the GM's receipt, and a refusal of
       the run comes after it as its own packet: each asker's bridge packets are read on its socket for 1.5 s. */
    const askAs = client => client.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs"), got = [];
        const on = payload => { if (payload?.userId === game.user.id && String(payload?.action ?? "").startsWith("bridge.")) got.push([payload.action, payload.reason ?? null]); };
        game.socket.on("${SOCKET}", on);
        const res = await B.requestPassageShare({ actorId: ${J(IDS.botan)}, targetId: ${J(IDS.aiko)}, passageId: ${J(set.id)} });
        await new Promise(r => setTimeout(r, 1500));
        game.socket.off?.("${SOCKET}", on);
        return { ok: res.ok, refused: got.filter(([action]) => action === "bridge.refused").map(([, reason]) => reason) };`, { timeout: 30000 });
    const coAsked = await askAs(p3), doorAsked = await askAs(p2);
    await settle(1000);
    const mmSide = await gm.eval(`const G = await import("${repoUrl}/scripts/passages-gm.mjs");
        const cards = game.messages.contents.filter(m => !${J(mmIds)}.includes(m.id));
        return { cards: cards.map(m => ({ id: m.id, whisper: [...(m.whisper ?? [])].sort() })), access: Object.keys(G.listPassages().find(p => p.id === ${J(set.id)})?.access ?? {}),
            shows: G.passageLog().filter(r => r.what === "show" && r.passageId === ${J(set.id)}).length, done: game.i18n.format("DRPG.Passage.card.done", { target: "Aiko Hoshino" }) };`);
    const mmRead = await p2.eval(`${SHOW} const { contentOf } = await import("${repoUrl}/scripts/secret.mjs"), ids = ${J(mmSide.cards.map(c => c.id))};
        const text = id => String(contentOf(game.messages.get(id)) ?? "").replace(/<[^>]+>/g, "").trim();
        await until(() => ids.every(text));
        return ids.map(text);`, { timeout: 30000 });
    /* E79 fix r3-G2 (1.2.79; review r3, SEC S4): the bridge's send-back of the Mastermind's token, judged by the primary's
       judge of arrivals as the player who asked it, as the audit judges it. A second passage on the Kitchen's wall
       (1500-1700, y 800) that nobody is given; the GM stands Botan in the Kitchen off its centre and then in the Cafeteria
       (1550,600), and the owner asks the bridge to send him back to the Kitchen's centre (1550,900: the guard takes the
       centre of a room he stood in this minute), the step from the Cafeteria through the second passage. p2, whom the door
       names, acts as the Mastermind, who passes every open passage: lawful, no row (the control). Then the GMs' records
       of the token are dropped (movement.mjs `forgetToken`, so that the centre is no spot of them), the GM stands him the
       same way again, and p3, his other owner, asks the same: a passage Botan does not know, so an unlawful standing and
       p3's row. Until this fix the judge read the hook's user, the GM who wrote the send-back, and a GM acts as the
       Mastermind: p3's standing lawful. And the same again from p3's console, its veto off: its own write of the move, as
       a revert naming p2 as the one who asked - a player's word, which the judge reads as its writer's: unlawful, p3's
       row. The audit stays in 'log' mode; Botan, the second passage and the records are put back. */
    const mmSendBack = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs"), scene = game.scenes.get(${J(IDS.scene)});
        const t = scene.tokens.get("TOKBOTAN00000000"), at = { x: t.x, y: t.y };
        const id = await game.drpg.passages.create({ sceneId: scene.id, wallId: ${J(set.wall)}, seg: { x1: 1500, y1: 800, x2: 1700, y2: 800 } });
        globalThis.__s76gS4 = { at, id };
        return { id, mode: game.settings.get("${MOD}", "moveAudit"), centre: M.positionIn("Kitchen", t, null) };`, { timeout: 30000 });
    await settle(600);
    const standKitchen = forget => gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs"), t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKBOTAN00000000");
        if (${forget}) M.forgetToken(t.id);
        await t.update({ x: 1550, y: 950 }, ${J(PLACE)}); await new Promise(r => setTimeout(r, 400));
        await t.update({ x: 1550, y: 600 }, ${J(PLACE)}); await new Promise(r => setTimeout(r, 600));
        return [M.roomOfToken(t), M.standingOf(t)?.lawful ?? null];`, { timeout: 30000 });
    const s4Rows = `(game.drpg.passages.audit?.()?.rows ?? []).filter(r => r.token === "TOKBOTAN00000000").map(r => [r.user, r.verdict, r.times])`;
    const s4Ask = async (client, forged = false) => {
        const stood = await standKitchen(client !== p2);
        const rows0 = await gm.eval(`return ${s4Rows};`);
        const asked = await client.eval(forged ? `const list = Hooks._hooks.get("preUpdateToken") ?? [], at = list.findIndex(e => e.fn.name === "onPreUpdateToken");
            const [veto] = at >= 0 ? list.splice(at, 1) : [];
            try { await canvas.scene.tokens.get("TOKBOTAN00000000").update({ x: 1550, y: 900 }, { drpgRevert: true, drpgSentBack: ${J(IDS.p2)} }); }
            finally { if (veto) list.splice(at, 0, veto); }
            return { ok: Boolean(veto), reason: null };` : `const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
            const r = await B.requestSendBack(${J(IDS.scene)}, "TOKBOTAN00000000", { x: 1550, y: 900 });
            return { ok: r.ok, reason: r.reason ?? null };`, { timeout: 30000 });
        await settle(1200);
        const read = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs"), t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKBOTAN00000000");
            return { at: [t.x, t.y], room: M.roomOfToken(t), lawful: M.standingOf(t)?.lawful ?? null, rows: ${s4Rows} };`);
        const times = rows => rows.reduce((n, row) => n + row[2], 0);
        return { stood, asked, ...read, counted: times(read.rows) - times(rows0), last: read.rows.at(-1)?.slice(0, 2) ?? null };
    };
    const s4Door = await s4Ask(p2), s4Co = await s4Ask(p3), s4Forged = await s4Ask(p3, true);
    const s4Back = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs"), t = game.scenes.get(${J(IDS.scene)}).tokens.get("TOKBOTAN00000000");
        const was = globalThis.__s76gS4; delete globalThis.__s76gS4;
        const gone = await game.drpg.passages.delete(was.id);
        await t.update(was.at, ${J(PLACE)}); await new Promise(r => setTimeout(r, 400));
        return { gone, at: [t.x, t.y], back: [was.at.x, was.at.y], lawful: M.standingOf(t)?.lawful ?? null, room: M.roomOfToken(t) };`, { timeout: 30000 });
    await settle(600);
    check("G: the Mastermind's token sent back through the bridge, through a passage nobody was given, is judged as the owner who asked - "
        + "p2, whom the door names, lawful with no row; p3, his other owner, unlawful with p3's row, and so is p3's own write naming p2 - "
        + "and Botan and the second passage are put back (E79 fix r3-G2)",
    typeof mmSendBack.id === "string" && mmSendBack.mode === "log" && J(mmSendBack.centre) === J({ x: 1550, y: 900 })
        && [s4Door, s4Co, s4Forged].every(r => J(r.stood) === J(["Cafeteria", true]) && r.asked.ok === true && J(r.at) === J([1550, 900]) && r.room === "Kitchen")
        && s4Door.lawful === true && s4Door.counted === 0 && [s4Co, s4Forged].every(r => r.lawful === false && r.counted === 1 && J(r.last) === J([IDS.p3, "noted"]))
        && s4Back.gone === true && J(s4Back.at) === J(s4Back.back) && s4Back.lawful === true && s4Back.room === "Cafeteria",
    J({ mmSendBack, s4Door, s4Co, s4Forged, s4Back }));
    const mmBack = await gm.eval(`${MM}
        const was = ${J(mmSet.was)}, botan = game.actors.get(${J(IDS.botan)});
        if (was.actorId) await M.setMastermind(game.actors.get(was.actorId), { room: was.room }); else await M.clearMastermind();
        await botan.update({ ${J(`ownership.${IDS.p3}`)}: 0 });
        return { actorId: M.mastermindActor()?.id ?? null, room: S.mastermindStore.get("record")?.room ?? null };`, { timeout: 30000 });
    const p2back = await p2.eval(`${SHOW} const PS = await import("${repoUrl}/scripts/passages.mjs");
        return Boolean(await until(() => !PS.knownPassages()[${J(set.id)}]));`, { timeout: 30000 });
    /* The copy that takes the passage away from p2, whom the door names no more (cor A's second road): until the fix it
       carried no part "door" and its other part, Botan's own, had not moved, so it was refused at the gate and p2 kept
       every open passage. */
    const doorTaken = await doorRead(false);
    check("G: the Mastermind put back, p2 holds no passage, as nobody gave Botan one, and stores none for its next load, and Botan is stopped at it (E79 fix r3-G3)",
        doorTaken.held && J(doorTaken.keys) === "[]" && J(doorTaken.stored) === "[]" && doorTaken.knowers === null && doorTaken.token
            && doorTaken.through === true && doorTaken.beside === true,
        J({ doorTaken }));
    check("G: Botan made the Mastermind, his show of the passage to Aiko through the bridge - p3, his other owner, refused as a passage he does not know; p2, whom the door names, carried out, nothing written and one card, whispered to p2 alone; the Mastermind, Botan's owners and p2's copy put back",
        mmSet.door === IDS.p2 && mmSet.picked === IDS.botan && J(coAsked) === J({ ok: true, refused: ["notKnown"] }) && J(doorAsked) === J({ ok: true, refused: [] })
            && mmSide.cards.length === 1 && J(mmSide.cards[0].whisper) === J([IDS.p2]) && J(mmRead) === J([mmSide.done])
            && mmSide.shows === 0 && J(mmSide.access) === J([IDS.aiko]) && J(mmBack) === J(mmSet.was) && p2back === true,
        J({ mmSet, coAsked, doorAsked, mmSide, mmRead, mmBack, p2back }));

    /* The show, from p1's own browser, as the list's button asks it once Botan is picked. The cards are the messages the
       show made, read by id: the GM's browser holds no words of a card whispered to p1 alone (secret.mjs), so a match on
       the text would miss Aiko's (E79 fix r2-G2). */
    const before = await gm.eval(`return game.messages.contents.map(m => m.id);`);
    const shown = await p1.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const res = await B.requestPassageShare({ actorId: ${J(IDS.aiko)}, targetId: ${J(IDS.botan)}, passageId: ${J(set.id)} });
        return { ok: res.ok, reason: res.reason ?? null };`, { timeout: 30000 });
    await settle(1500);
    const gmSide = await gm.eval(`const G = await import("${repoUrl}/scripts/passages-gm.mjs"), { contentOf, cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
        const p = G.listPassages().find(p => p.id === ${J(set.id)}), [from, to] = ${J(set.sides ?? [])}.map(room => (room === "Kitchen" ? game.i18n.format("DRPG.Listen.unknownRoom", { n: 1 }) : room));
        const cards = game.messages.contents.filter(m => !${J(before)}.includes(m.id));
        return { how: p?.access?.[${J(IDS.botan)}]?.how ?? null, shows: G.passageLog().filter(r => r.what === "show" && r.passageId === ${J(set.id)}).map(r => r.actorId),
            cards: cards.map(m => ({ id: m.id, whisper: [...(m.whisper ?? [])].sort(), sfx: cardFlag(m, "sfx") ?? null, text: String(contentOf(m) ?? "").replace(/<[^>]+>/g, "").trim() })),
            actions: game.drpg.actionsLeft(game.actors.get(${J(IDS.aiko)})), gms: game.users.filter(u => u.isGM).map(u => u.id).sort(),
            texts: { shown: game.i18n.format("DRPG.Passage.card.shown", { giver: "Aiko Hoshino", from, to }),
                done: game.i18n.format("DRPG.Passage.card.done", { target: "Botan Kage" }),
                gm: game.i18n.format("DRPG.Passage.gm.shown", { giver: "Aiko Hoshino", target: "Botan Kage", from: ${J(set.sides ?? [])}[0], to: ${J(set.sides ?? [])}[1] }) } };`);
    const cardIds = gmSide.cards.map(c => c.id);
    const read = (client, waitFor) => client.eval(`${SHOW} const { contentOf, cardFlag } = await import("${repoUrl}/scripts/secret.mjs"), NH = await import("${repoUrl}/scripts/notice-history.mjs");
        const ids = ${J(cardIds)};
        ${waitFor ? `await until(() => NH.noticeEntries().some(e => ids.includes(e.messageId)));` : "await new Promise(r => setTimeout(r, 500));"}
        return { seen: ids.map(id => game.messages.get(id)).filter(m => m?.visible).map(m => String(contentOf(m) ?? "").replace(/<[^>]+>/g, "").trim()),
            sfx: ids.map(id => game.messages.get(id)).filter(m => m?.visible).map(m => cardFlag(m, "sfx") ?? null),
            kept: NH.noticeEntries().filter(e => ids.includes(e.messageId)).length,
            copy: (await import("${repoUrl}/scripts/passages.mjs")).knownPassages()[${J(set.id)}]?.actorIds ?? null };`, { timeout: 30000 });
    const on1 = await read(p1, true), on2 = await read(p2, true), on3 = await read(p3, false);
    check("G: the show stands - Botan learns the passage as 'shown', one log row names him, his copy on p2 holds it with him alone, and Aiko's actions are what they were",
        shown.ok === true && gmSide.how === "shown" && J(gmSide.shows) === J([IDS.botan]) && J(on2.copy) === J([IDS.botan]) && gmSide.actions === set.actions,
        J({ shown, gmSide: { ...gmSide, texts: undefined }, copy: on2.copy }));
    /* E79 fix r2-G2 (16.10.2026; the round-2 review's H3): the GMs read the show on a card of their own, whispered to the
       GMs alone and naming both students and both rooms - until then a notice on the primary's browser - and Aiko's card
       goes to the player who asked alone. Since fix r2-G4 Botan's card goes to each of his owners alone - p2 here - and
       its sound is read where it is heard, on p2: a card the GMs are not sent, they hold no words or flags of. */
    const gmCard = gmSide.cards.find(c => c.text === gmSide.texts.gm), doneCard = gmSide.cards.find(c => J(c.whisper) === J([IDS.p1]));
    const botanCard = gmSide.cards.find(c => J(c.whisper) === J([IDS.p2]));
    check("G: Botan's card on p2, whispered to p2 alone, with the sound, names the Cafeteria and a room he has not found as unexplored, and stays in his notice history; Aiko's on p1 names Botan and no room, whispered to p1 alone; the GMs' own card names both and both rooms, whispered to the GMs alone; p3 sees none and keeps none",
        gmSide.cards.length === 3 && Boolean(botanCard) && Boolean(doneCard) && J(on2.sfx) === J(["passageFound"]) && J(on1.sfx) === J([null])
            && J(gmCard?.whisper) === J(gmSide.gms)
            && J(on2.seen) === J([gmSide.texts.shown]) && on2.kept === 1 && J(on1.seen) === J([gmSide.texts.done]) && on1.kept === 1
            && on3.seen.length === 0 && on3.kept === 0,
        J({ cards: gmSide.cards, texts: gmSide.texts, gms: gmSide.gms, on1, on2, on3 }));

    /* Close and revoke: p3's world each time as it stood once the GM drew the Kitchen. */
    const closed = await gm.eval(`return await game.drpg.passages.close(${J(set.id)});`);
    await settle(800);
    const afterClose = worldPrint(await dump("p3"));
    const revoked = await gm.eval(`return await game.drpg.passages.revoke(${J(set.id)}, ${J(IDS.botan)});`);
    await settle(800);
    const d3 = await dump("p3"), afterRevoke = worldPrint(d3);
    check("G: p3's world after the show, the Close and Botan's revoke is the world as it stood once the GM drew the Kitchen, and p3 reads neither the marker nor the passage's id outside this phase's wire",
        closed === true && revoked === true && afterClose === staged && afterRevoke === staged && total(probe(d3, { skip: PHASE_G })) === marksBefore.p3
            && !J({ ...d3, wire: undefined, console: undefined }).includes(set.id),
        J({ closed, revoked, close: printDiff(staged, afterClose), revoke: printDiff(staged, afterRevoke) }));

    /*
     * TWO GMS AND A RELOAD (E79 fix r2-G3, 16.10.2026; review round 2, H2: the plan's two steps that stood in for a
     * table). A second GM connects with an empty browser and, in the same breath - before its stores have settled, while
     * the other GM's copies are still on their way to it - makes a passage on the Kitchen's wall and gives it to Botan.
     * Its own browser pushes nothing (it is not the primary): the primary merges the write and sends Botan's player the
     * row, and the second GM's records come to hold phase G's passage beside its own. Then a reload: p4, a fifth player,
     * is given Botan, holds the row, passes it on the move backend and lists it on Botan's sheet; leaves; and comes back
     * with the browser it left with. Its copy comes back from the primary's answer to its ask, and the cut and the list
     * are what they were.
     */
    const P4 = "USERP4000000000A", SEG2 = { x1: 1500.5, y1: 800, x2: 1600.5, y2: 800 };
    const late = socketTraffic.length;
    await connect("gm2");
    const wrote = await gm2.eval(`const PG = await import("${repoUrl}/scripts/passages-gm.mjs"), seen = PG.listPassages().map(p => p.id);
        const id = await game.drpg.passages.create({ sceneId: ${J(IDS.scene)}, wallId: ${J(set.wall)}, seg: ${J(SEG2)} });
        const granted = id ? await game.drpg.passages.grant(id, ${J(IDS.botan)}) : null;
        return { id, granted, seen, primary: (await import("${repoUrl}/scripts/utils.mjs")).isPrimaryGm() };`, { timeout: 30000 });
    const records = client => client.eval(`${SHOW} const PG = await import("${repoUrl}/scripts/passages-gm.mjs");
        const ids = () => PG.listPassages().map(p => p.id).sort();
        await until(() => ${J([set.id, wrote.id].sort())}.every(id => ids().includes(id)));
        const p = PG.listPassages().find(p => p.id === ${J(wrote.id)});
        return { ids: ids(), seg: p?.passageSeg ?? null, rooms: p?.rooms ?? null, knows: Object.keys(p?.access ?? {}) };`, { timeout: 30000 });
    const onGm = await records(gm), onGm2 = await records(gm2);
    const copy2 = await p2.eval(`${SHOW} const PS = await import("${repoUrl}/scripts/passages.mjs");
        await until(() => PS.knownPassages()[${J(wrote.id)}]); return PS.knownPassages()[${J(wrote.id)}]?.actorIds ?? null;`, { timeout: 30000 });
    const sentLate = socketTraffic.slice(late).filter(t => t.action === "passage.rows");
    const want = { seg: SEG2, rooms: ["Cafeteria", "Kitchen"], knows: [IDS.botan] };
    check("G: a second GM, connected with an empty browser, makes a passage on the Kitchen's wall and gives it to Botan before its stores settle; the primary pushes it to Botan's player alone, p2's copy holds it, and both GMs' records hold it and phase G's passage",
        typeof wrote.id === "string" && wrote.granted === true && wrote.primary === false && J(copy2) === J([IDS.botan])
            && sentLate.some(t => t.from === "gm" && J(t.to) === J([IDS.p2])) && !sentLate.some(t => t.from === "gm2")
            && [onGm, onGm2].every(r => r.ids.includes(set.id) && r.ids.includes(wrote.id) && J({ seg: r.seg, rooms: r.rooms, knows: r.knows }) === J(want)),
        J({ wrote, onGm, onGm2, copy2, sent: sentLate.map(t => ({ from: t.from, to: t.to })) }));

    /* p4's reads of Botan: its copy, the move backend for his token through the new passage and beside it on the same
       wall, and his sheet's list (`draw`, as Aiko's above). */
    const readP4 = async () => {
        const held = await p4.eval(`${SHOW} const PS = await import("${repoUrl}/scripts/passages.mjs");
            await until(() => PS.knownPassages()[${J(wrote.id)}]);
            const backends = CONFIG.Canvas.polygonBackends, object = canvas.tokens.get("TOKBOTAN00000000") ?? null;
            const hit = x => backends.move.testCollision({ x, y: 750 }, { x, y: 850 }, { type: "move", mode: "any", source: { object } });
            return { copy: Object.keys(PS.knownPassages()).sort(), knowers: PS.knownPassages()[${J(wrote.id)}]?.actorIds ?? null,
                token: Boolean(object), through: hit(1550.5), beside: hit(1750) };`, { timeout: 30000 });
        const sheet = await p4.eval(draw(IDS.botan, false), { timeout: 30000 });
        return { ...held, rows: sheet.rows };
    };
    await connect("p4");
    await gm.eval(`await game.actors.get(${J(IDS.botan)}).update({ "ownership.${P4}": 3 }); return true;`);
    await settle(1000);
    const first = await readP4();
    /* Reloaded twice: with the browser it left with, then with an empty one (another computer, or its storage cleared).
       The harness's client asks at ready, before the others hear it connect (cluster.mjs `connect`), so the primary
       passes the ask by - p4 is not active there yet - and answers its arrival: measured at d71759a, the reload was
       answered by nobody and its copy was the one its storage kept. */
    const reloadAs = async storage => {
        const at = socketTraffic.length;
        await disconnect("p4");
        await settle(300);
        await connect("p4", { storage });
        await settle(1000);
        const read = await readP4();
        const wire = socketTraffic.slice(at).filter(t => /^passage\./.test(t.action ?? "")).map(t => ({ from: t.from, to: t.to, action: t.action }));
        return { same: J(read) === J(first), read, wire,
            asks: wire.filter(t => t.action === "passage.request" && t.from === "p4").length,
            answers: wire.filter(t => t.action === "passage.rows" && J(t.to) === J([P4])).map(t => t.from) };
    };
    const kept = await reloadAs(await storageOf("p4"));
    const fresh = await reloadAs(null);
    const answered = r => r.same && r.asks >= 1 && r.answers.length >= 1 && r.answers.every(f => f === "gm");
    check("G: p4, given Botan, holds the second GM's passage, passes it on the move backend and is stopped beside it, and lists it on Botan's sheet; reloaded with the browser it left with, and then with an empty one, it asks the primary, is sent its copy by the primary alone, and its copy, its cut and its list are as before",
        J(first.copy) === J([wrote.id]) && J(first.knowers) === J([IDS.botan]) && first.token && first.through === false && first.beside === true
            && first.rows.length === 1 && first.rows[0][1] === false && answered(kept) && answered(fresh),
        J({ first, kept: { ...kept, read: kept.same ? "the same" : kept.read }, fresh: { ...fresh, read: fresh.same ? "the same" : fresh.read } }));
    const lateBack = await gm.eval(`await game.actors.get(${J(IDS.botan)}).update({ "ownership.${P4}": 0 });
        return await game.drpg.passages.delete(${J(wrote.id)});`, { timeout: 30000 });
    await disconnect("p4");
    await disconnect("gm2");
    await settle(600);

    /* Put back: the passage, the wall, the Kitchen and Aiko's token. */
    const back = await gm.eval(`${SHOW}
        const scene = game.scenes.get(${J(IDS.scene)});
        const gone = await game.drpg.passages.delete(g.id);
        await scene.tokens.get("TOKAIKO000000000").update(g.at, ${J(PLACE)});
        await scene.deleteEmbeddedDocuments("Wall", [g.wall]);
        await scene.deleteEmbeddedDocuments("Region", [g.kitchen]);
        delete globalThis.__s76g;
        return { gone, kitchen: scene.regions.some(r => r.name === "Kitchen") };`, { timeout: 30000 });
    await settle(800);
    const after = await dump("p3");
    const marksAfter = await marks();
    const rows = socketTraffic.slice(from).filter(t => t.action === "passage.rows");
    const stray = rows.filter(t => !Array.isArray(t.to) || t.to.length !== 1 || t.from !== "gm");
    check("G: put back - the passage, the Kitchen and its wall gone, p3's world as this phase found it, no player reading the marker in more places outside this phase's wire, and every copy sent naming one player, Botan's among them",
        back.gone !== false && lateBack !== false && back.kitchen === false && worldPrint(after) === found && worldScan(after).length === 0 && J(marksAfter) === J(marksBefore)
            && rows.length > 0 && stray.length === 0 && rows.some(t => J(t.to) === J([IDS.p2])),
        J({ back, lateBack, diff: printDiff(found, worldPrint(after)), marksBefore, marksAfter, rows: rows.map(t => ({ to: t.to, from: t.from })) }));
}
