/**
 * Rooms, scenes and floors, as they are today (E12 C0, 11.10.2026; plan-E12 sections 2.1 and 2.2).
 *
 * A room is a region's name read off whichever scene the reader's camera shows (`canvas.scene`),
 * the first region of a name answering for all of them, and a floor is nothing at all: no
 * scenario drove the readers with the camera somewhere else, with one room drawn in two pieces
 * or with a scene of two floors. This drives each on the seeded GM and players and reads the
 * world's state through public functions and documents, so the E12 commits that rewrite the
 * readers (C1-C12) leave the drive as it is and rewrite only the check that names them.
 *
 * Every reading is asserted at its value at 180df61 (1.2.73 and the E11 fixes), measured on this
 * harness, and its check names the E12 commit that changes it; that commit rewrites the check
 * with the code.
 *   S  the shim's own levels (plan G4): a region with no levels is on every floor, one with a
 *      level only on it; `Scene#view` puts the scene on the canvas, fires `canvasReady` and names
 *      the floor (it threw before C0: nothing defined `game._viewScene`).
 *   A  a project in the Gym, its manager saved while the GM looks at the Annex (V1, C5).
 *   B  Room Setup opened on Floor 1 and answered after the GM's camera moved to an Annex holding
 *      its own Gym: which Gym the lock lands on (V2, C4 / R119).
 *   C  a region named "Closet" carrying a Teleport behaviour and the room mark: whether it is a room (V3, C1 and C2a),
 *      and what the fog's map check and the scenes' report say of it (C2b).
 *   D  a "Kitchen" drawn in two pieces and locked from Room Setup: which piece holds the lock, the room
 *      mark Apply writes (C1), and a player's walk into the other piece (V4, C2a).
 *   E  a project in a room Aiko has found: whether p1 knows it with its camera on Floor 1, the
 *      Annex and nothing; the gather ordered with the GM's camera on the Annex and on nothing
 *      (V5, C5 / R118); a Public Announcement for a room of the Annex, bought by the Monokuma on Floor 1 (C5).
 *   F  Aiko's second token on the Annex: where `locateActor` puts her with the GM's camera on
 *      either scene; a direct murder parked in Dorm A before two others, judged at the end of the
 *      Eclipse with the GM looking at the Annex (C3).
 *   G  a two-floor scene built here (Lab under Attic, Corridor under a locked Vault): the room of
 *      a token on the lower floor; a player's level-only move into the locked Vault and the actions
 *      it costs (V7, V8, C9).
 *   H  the room-marking clause of the migration asked for by name over a scene made here, and again after an untick
 *      and a late region (C1).
 *   I  Daichi killed and kept in a locked Storage, Botan placed beside him by the GM, then Aiko
 *      jumped by her player from the Hall, the room veto skipped as a revert skips it: who
 *      the discovery counts (Q5a, C12).
 *   J  p1 draws a region carrying the room mark and unticks the Gym: what the primary records and puts back (C1).
 *   K  the rooms p1 knows on Aiko's scene, and the names Listen's labels give that scene's rooms, with p1's camera on
 *      Floor 1, the Annex and nothing, and for a character with no scene (E12 fix r1-G4, review round 1 EARLY-C6-2 and
 *      SEC-2). Every room of the scene stands in for her doors: the harness measures no neighbour of the Hall on p1.
 * Not readable headless (the plan's M10): what the fog draws on either floor (C10's `fogRegionsFor`
 * is the first reader the harness can call; until then G records no fog), Foundry's own level
 * control and door controls - LIVE-E12-02/03/05; and the outline a player is shown on walking into a
 * room: the harness's token placeable (client-entry.mjs `_wrap`) has no `isOwner`, so fog.mjs `isMine`
 * reads none of a player's tokens as theirs and their client outlines nothing (read on p1 on 11.10.2026,
 * E12 C2b). What G measures is the shim's model of levels
 * (lib/shim.mjs `LevelList`), not v14's.
 *
 * Its bound (plan M4): its 15 checks took 12.6-13.8 s in six runs alone under the harness lock on 11.10.2026 (five
 * drafts, each through every phase, and this file: 12.8 s, 17.3 s with the boot); 12.6-13.5 s in fourteen runs under
 * C0's mutants of the module and the shim (two of them drafts that stayed green), and 20.9 s under the one that stops
 * the discovery (I waits up to 8 s for it) - against 61's 480 s and run-all's shared five minutes, so it states no
 * `timeoutMs` of its own. E12 C1 (C2, D3, H rewritten as H1-H2, J1-J2): 20 checks in 15.9 s, one run alone under the
 * lock on 11.10.2026. E12 C2a (C1, D1, D2 rewritten; G's tower regions marked rooms): 20 checks in 15.6 s, one run alone
 * under the lock on 11.10.2026. E12 C2b (C3 added): 21 checks in 16.2 s, one run alone under the lock on 11.10.2026.
 * E12 C3 (F1, F2 rewritten): 21 checks in 15.9 s, one run alone under the lock on 11.10.2026. E12 C4 (B1 rewritten): 21
 * checks in 16.1 s, one run alone under the lock on 11.10.2026. E12 C5 (A1, E1, E2 rewritten; E3 added): 22 checks in 16.1 s, one run alone under the lock on 11.10.2026.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
/* The two floors of G's scene, by id; the ids are this file's, any 16 characters would do. */
const L1 = "LEVELGROUND00000", L2 = "LEVELUPPER000000";

export async function run({ gm, p1, check, phase, settle, IDS, repoUrl }) {
    const SCENES = `const academy = game.scenes.get("${IDS.scene}"), annex = game.scenes.get("${IDS.annex}");`;
    const rect = (x, y, width = 600, height = 600) => J([{ type: "rectangle", x, y, width, height }]);
    /* Room Setup answered as a GM answers it: the window's own form with one lock ticked, then its Apply button's
       own callback. `move` runs between the tick and the press - B moves the GM's camera there. */
    const ROOM_SETUP = `const roomSetup = async (room, move = () => {}) => {
        const V = await import("${repoUrl}/scripts/vault.mjs");
        let seen = null;
        globalThis.__dialogAnswers.push(async config => {
            const ok = (config.buttons ?? []).find(b => b.action === "ok");
            const element = document.createElement("dialog"), form = document.createElement("form");
            if (typeof config.content === "string") form.innerHTML = config.content; else if (config.content) form.append(config.content.cloneNode(true));
            element.append(form);
            const box = form.querySelector('[name="locked:' + room + '"]');
            seen = { box: Boolean(box), was: box?.checked ?? null, title: config.window?.title ?? null };
            if (box) box.checked = true;
            move();
            return ok.callback(new globalThis.window.Event("click"), { form }, { element });
        });
        let changed = null;
        try { changed = await V.openRoomSetupDialog(); } finally { globalThis.__dialogAnswers.length = 0; }
        return { seen, changed };
    };`;
    const LOCKED = `const { ROOM_FLAGS } = await import("${repoUrl}/scripts/movement.mjs"); const locked = r => Boolean(r?.getFlag("${MOD}", ROOM_FLAGS.locked));`;

    /* ------------------------------ S. the shim ------------------------------ */
    phase("S: the shim's floors and Scene#view", { flow: "levels-floor" });
    /* The world's own migration first (as 65 waits for it): the harness's world is unstamped, so every clause runs on
       load, and H asks the migration again by name. */
    const shim = await gm.eval(`await (await import("${repoUrl}/scripts/migrate.mjs")).migrationOnLoad();
        ${SCENES}
        const tower = await Scene.create({ name: "66 Tower", width: 4000, height: 3000, grid: { size: 100 }, active: false,
            levels: [{ id: "${L1}", name: "Ground", elevation: 0 }, { id: "${L2}", name: "Upper", elevation: 10 }] });
        // Marked rooms, as Room Setup draws a region the load's pass never decided (E12 C1): since C2a the rules read
        // rooms only, and G read none of the five unmarked (G1's lab and corridor null, 11.10.2026).
        await tower.createEmbeddedDocuments("Region", [
            { name: "Lab", shapes: ${rect(200, 200)}, levels: ["${L1}"], flags: { "${MOD}": { room: true } }, behaviors: [] },
            { name: "Attic", shapes: ${rect(200, 200)}, levels: ["${L2}"], flags: { "${MOD}": { room: true } }, behaviors: [] },
            { name: "Corridor", shapes: ${rect(1200, 200)}, levels: ["${L1}"], flags: { "${MOD}": { room: true } }, behaviors: [] },
            { name: "Vault", shapes: ${rect(1200, 200)}, levels: ["${L2}"], flags: { "${MOD}": { room: true, drpgLocked: true } }, behaviors: [] },
            { name: "Stairwell", shapes: ${rect(2200, 200)}, levels: [], flags: { "${MOD}": { room: true } }, behaviors: [] }]);
        const named = name => tower.regions.find(r => r.name === name);
        let fired = 0;
        const count = () => { fired += 1; };
        Hooks.on("canvasReady", count);
        let threw = null, onTower = null;
        try { await tower.view({ level: "${L2}" }); onTower = { scene: canvas.scene?.id ?? null, level: canvas.level?.id ?? null }; }
        catch (err) { threw = String(err?.message ?? err); }
        try { await academy.view(); } catch (err) { threw ??= String(err?.message ?? err); }
        Hooks.off("canvasReady", count);
        if (canvas.scene?.id !== academy.id) canvas.scene = academy;
        return { tower: tower.id, levels: tower.levels.map(l => l.id), threw, fired, onTower,
            back: { scene: canvas.scene?.id ?? null, level: canvas.level?.id ?? null },
            stairwell: [named("Stairwell")?.includedInLevel("${L1}"), named("Stairwell")?.includedInLevel("${L2}")],
            lab: [named("Lab")?.includedInLevel("${L1}"), named("Lab")?.includedInLevel("${L2}"), named("Lab")?.includedInLevel(tower.levels.get("${L1}"))],
            fields: foundry.documents.BaseToken?.MOVEMENT_FIELDS ?? null };`, { timeout: 60000 });
    const towerId = shim.tower;
    check("S1: a region with no levels is on every floor, one with a level on that floor alone (asked by id or by the level)",
        J(shim.stairwell) === J([true, true]) && J(shim.lab) === J([true, false, true]) && J(shim.levels) === J([L1, L2]), J(shim));
    check("S2: Scene#view puts the scene on the canvas on the floor it names and fires canvasReady; the seeded scene has no floor",
        shim.threw === null && shim.fired === 2 && J(shim.onTower) === J({ scene: towerId, level: L2 })
            && J(shim.back) === J({ scene: IDS.scene, level: null }) && Array.isArray(shim.fields) && shim.fields.includes("level"), J(shim));

    /* ------------------------------ A. the project manager ------------------------------ */
    phase("A: a project's manager saved while the GM looks at the Annex", { flow: "projects" });
    const setA = await gm.eval(`${SCENES}
        const P = await import("${repoUrl}/scripts/projects.mjs"), UI = await import("${repoUrl}/scripts/projects-ui.mjs");
        const { metaFor } = await import("${repoUrl}/scripts/projects-secrecy.mjs");
        canvas.scene = academy;
        const made = await P.createProject({ name: "E12 C0 66 the Gym's project", target: 6, room: "Gym" });
        const before = metaFor(made?.id).room ?? null;
        canvas.scene = annex;
        try { await UI.openProjectManager(); } finally { canvas.scene = academy; }
        const after = metaFor(made?.id).room ?? null;
        if (made?.id) await P.deleteProject(made.id);
        return { id: made?.id ?? null, before, after };`, { timeout: 60000 });
    /* At 180df61 the manager's room select is filled from the camera's scene (`allRooms()`), which on the Annex
       holds no Gym, and every row's room is written back from it: the project lost its room (A1 read `after: null`).
       E12 C5 (V1): the select lists every place scene's rooms and a room the manager did not change is not written. */
    check("A1: the Gym's project saved from its manager with the GM's camera on the Annex keeps its room (E12 C5)",
        Boolean(setA.id) && setA.before === "Gym" && setA.after === "Gym", J(setA));

    /* ------------------------------ B. Room Setup's scene ------------------------------ */
    phase("B: Room Setup opened on Floor 1, applied with the camera on the Annex");
    const setB = await gm.eval(`${SCENES} ${ROOM_SETUP} ${LOCKED}
        canvas.scene = academy;
        const [annexGym] = await annex.createEmbeddedDocuments("Region", [{ name: "Gym", shapes: ${rect(1200, 1200, 800, 600)}, flags: {}, behaviors: [] }]);
        const floorGym = academy.regions.find(r => r.name === "Gym");
        let answer = null;
        try { answer = await roomSetup("Gym", () => { canvas.scene = annex; }); } finally { canvas.scene = academy; }
        const out = { ...answer, floor: locked(floorGym), annex: locked(annexGym), name: academy.name,
            told: game.i18n.format("DRPG.Vault.manageTitleOn", { scene: academy.name }) };
        if (locked(floorGym)) await floorGym.setFlag("${MOD}", ROOM_FLAGS.locked, false);
        await annexGym.delete();
        return out;`, { timeout: 60000 });
    /* At 180df61 `applyRoomRows` found each row's region with `regionsByName()`, the scene the camera shows when Apply
       is pressed, and until E12 C4 the window handed it `workingScene()`: the Floor 1 window's lock landed on the Annex's
       Gym (B1 read annex true, floor false). E12 C4 (V2, R119): every write goes to the scene the window was opened on,
       its title names that scene, and Apply answers the rooms it changed - one. */
    check("B1: Room Setup opened on Floor 1 and applied with the camera on the Annex locks Floor 1's Gym, not the Annex's, and says it changed one room (E12 C4)",
        setB.seen?.box === true && setB.seen?.was === false && setB.floor === true && setB.annex === false && setB.changed === 1
            && setB.seen?.title === setB.told && setB.told.includes(setB.name), J(setB));

    /* ------------------------------ C. a Teleport region ------------------------------ */
    phase("C: a region with a Teleport behaviour");
    const setC = await gm.eval(`${SCENES} const M = await import("${repoUrl}/scripts/movement.mjs"), R = await import("${repoUrl}/scripts/rooms.mjs");
        const [closet] = await academy.createEmbeddedDocuments("Region", [{ name: "Closet", shapes: ${rect(3000, 1200, 400, 400)},
            flags: { "${MOD}": { room: true } }, behaviors: [{ type: "teleportToken", name: "To the roof", system: { destination: null } }] }]);
        const rooms = M.allRooms(academy), marked = R.roomNames(academy), isRoom = R.isRoom(closet), flag = closet.getFlag("${MOD}", R.ROOM_FLAG);
        const F = await import("${repoUrl}/scripts/fog.mjs"), view = canvas.scene;
        canvas.scene = academy;
        const checked = F.checkRegions().filter(r => r.room === "Closet").map(r => [r.level, r.problem, /teleportToken/.test(r.detail)]);
        canvas.scene = view;
        const line = F.diagnoseScenes().split("\\n").find(l => l.includes(academy.name)) ?? null;
        await closet.delete();
        return { rooms, marked, isRoom, flag, checked, notRoom: game.i18n.localize("DRPG.Fog.notRoom.problem"), line };`, { timeout: 30000 });
    /* The behaviour's type, `teleportToken`, is Foundry's name as recalled (LIVE-E12-02); rooms.mjs reads it since E12 C1.
       At 180df61 every named region is a room. E12 C1 (V3) makes a room what a GM marked and `isRoom` refuses a
       region carrying a Teleport or ChangeLevel behaviour, the mark notwithstanding; C2a moves the readers onto it, and
       `allRooms` lists rooms only (until C2a C1 read the Closet among them). */
    check("C1: a region named Closet carrying a Teleport behaviour is not among Floor 1's rooms by allRooms (E12 C2a)",
        !setC.rooms.includes("Closet") && setC.rooms.includes("Gym"), J(setC));
    check("C2: the Closet, marked a room by hand, is no room by isRoom: its Teleport makes it a passage (E12 C1)",
        setC.flag === true && setC.isRoom === false && !setC.marked.includes("Closet") && setC.marked.includes("Gym"), J(setC));
    /* At E12 C2a the fog's map check took every named region for a room: the Closet was checked as one and nothing
       said it was not, and the scenes' report counted it among Floor 1's rooms. E12 C2b: the check notes it apart, once,
       naming its Teleport, and the report adds a named region that is not a room. */
    check("C3: the fog's map check notes the Closet once as a named region that is no room, naming its Teleport, and the scenes' report counts it apart (E12 C2b)",
        J(setC.checked) === J([["info", setC.notRoom, true]]) && /1 named region is not a room/.test(setC.line ?? ""), J(setC));

    /* ------------------------------ D. a room of two pieces ------------------------------ */
    phase("D: a Kitchen drawn in two pieces, locked from Room Setup");
    const setD = await gm.eval(`${SCENES} ${ROOM_SETUP} ${LOCKED} const M = await import("${repoUrl}/scripts/movement.mjs");
        canvas.scene = academy;
        const pieces = await academy.createEmbeddedDocuments("Region", [
            { name: "Kitchen", shapes: ${rect(850, 200, 300, 300)}, flags: {}, behaviors: [] },
            { name: "Kitchen", shapes: ${rect(3000, 200, 400, 400)}, flags: {}, behaviors: [] }]);
        const answer = await roomSetup("Kitchen");
        const aiko = game.actors.get("${IDS.aiko}"), t = academy.tokens.get("TOKAIKO000000000");
        globalThis.__s66d = { pieces: pieces.map(p => p.id), actions: game.drpg.actionsLeft(aiko), at: { x: t.x, y: t.y } };
        if (game.drpg.actionsLeft(aiko) < 1) await game.drpg.setActions(aiko, 1);
        return { ...answer, locks: pieces.map(locked), marks: pieces.map(p => p.getFlag("${MOD}", "room") ?? null), at: globalThis.__s66d.at,
            room: M.roomOfToken(t) };`, { timeout: 60000 });
    /* Piece 1 stands a grid square's half from Dorm A, so it is Dorm A's neighbour; the walk is p1's own drag. */
    await p1.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 950, y: 300 }); return true;`, { timeout: 30000 });
    await settle(1500);
    const walkD = await gm.eval(`${SCENES} const M = await import("${repoUrl}/scripts/movement.mjs");
        const t = academy.tokens.get("TOKAIKO000000000"), aiko = game.actors.get("${IDS.aiko}"), was = globalThis.__s66d;
        const out = { at: { x: t.x, y: t.y }, room: M.roomOfToken(t) };
        await t.update(was.at, { teleport: true, movementAction: "displace", animate: false });
        await game.drpg.setActions(aiko, was.actions);
        await academy.deleteEmbeddedDocuments("Region", was.pieces);
        delete globalThis.__s66d;
        return out;`, { timeout: 30000 });
    /* At 180df61 Room Setup writes a row through `regionsByName()`, whose map keeps the LAST region of a name, and
       the veto reads the FIRST (`isLocked`, movement.mjs): the lock lands on piece 2 and the walk into piece 1 is
       let through (D1 read [false, true], D2 the token at x 950 in the Kitchen). E12 C2a (V4): two pieces are one room -
       Room Setup writes every piece and the veto reads the room over its pieces - so the walk is refused where it starts. */
    check("D1: a Kitchen of two pieces locked from Room Setup carries the lock on both pieces (E12 C2a)",
        setD.seen?.box === true && J(setD.locks) === J([true, true]), J(setD));
    check("D2: p1's walk from Dorm A into the Kitchen's first piece is refused: the token stays where it stood in Dorm A (E12 C2a)",
        setD.room === "Dorm A" && walkD.room === "Dorm A" && walkD.at.x === setD.at.x && walkD.at.y === setD.at.y, J({ setD, walkD }));
    /* At 180df61 Room Setup has no room column and writes no mark. E12 C1: the Kitchen, drawn after the load's pass and
       so never decided, is drawn ticked "This is a room", and Apply marks both pieces. */
    check("D3: Room Setup's Apply marks both pieces of the never-decided Kitchen a room (E12 C1)",
        J(setD.marks) === J([true, true]), J(setD));

    /* ------------------------------ E. projects and the gather, by the camera ------------------------------ */
    phase("E: what p1 knows of a project, and the gather, with the camera elsewhere", { flow: "projects" });
    const setE = await gm.eval(`${SCENES}
        const P = await import("${repoUrl}/scripts/projects.mjs"), F = await import("${repoUrl}/scripts/fog.mjs");
        canvas.scene = academy;
        await F.applyDiscoveryChanges(academy, [{ actorId: "${IDS.aiko}", room: "Dorm A", value: true }]);
        const made = await P.createProject({ name: "E12 C0 66 Dorm A's project", target: 6, room: "Dorm A" });
        return { id: made?.id ?? null, found: F.discoveredFor(academy.id, "${IDS.aiko}") };`, { timeout: 60000 });
    await settle(800);
    const KNOWS = `${SCENES} const P = await import("${repoUrl}/scripts/projects.mjs");
        const view = canvas.scene, read = scene => { canvas.scene = scene; return P.knowsProject("${setE.id}"); };
        let out;
        try { out = [read(academy), read(annex), read(null)]; } finally { canvas.scene = view; }
        return out;`;
    const knowsP1 = await p1.eval(KNOWS), knowsGm = await gm.eval(KNOWS);
    const gather = await gm.eval(`${SCENES} const W = await import("${repoUrl}/scripts/call-world.mjs");
        const asked = game.i18n.format("DRPG.Calls.noSuchRoom", { room: "Dorm A" }), told = () => globalThis.__notifications.filter(n => n.msg === asked).length;
        const before = told(), out = [];
        try { for (const scene of [annex, null]) { canvas.scene = scene; out.push((await W.scheduleGather("Dorm A"))?.sceneId ?? null); } }
        finally { canvas.scene = academy; await W.cancelGather(); }
        return { orders: out, warned: told() - before, left: W.pendingGather() };`, { timeout: 30000 });
    /* At 180df61 `knowsProject` asks the discovery ledger of the camera's scene: p1 knew the project while looking
       at Floor 1 and not while looking at the Annex or at nothing (E1 read [true, false, false]); a GM knows every
       project. `scheduleGather` looked the room up on the GM's camera and refused with a warning on the Annex and on
       nothing (E2 read [null, null], warned 2). E12 C5 (V5, R118): the project's scene, and for an order the console
       gives no scene, the room's own (`sceneOfRoom`); the order is called off here. */
    check("E1: p1 knows the Dorm A project with its camera on Floor 1, on the Annex and on nothing; so does the GM (E12 C5)",
        Boolean(setE.id) && setE.found.includes("Dorm A") && J(knowsP1) === J([true, true, true]) && J(knowsGm) === J([true, true, true]),
        J({ setE, knowsP1, knowsGm }));
    check("E2: the gather ordered to Dorm A with the GM's camera on the Annex and on nothing is held on Floor 1 both times, unwarned (E12 C5)",
        J(gather.orders) === J([IDS.scene, IDS.scene]) && gather.warned === 0 && gather.left === null, J(gather));
    /* E3 (E12 C5): the Public Announcement as the Monokuma buys it, its token on Floor 1, with the GM's camera on an
       Annex that holds a Boiler and Floor 1 none. The room is the picker's answer and the scene is the caller's
       (`gatherSceneOf`), never the camera's nor a `sceneId` riding the choice: the Boiler is refused before the
       Despair is paid (`spendDespairCallFor`: nothing paid, so nothing refunded) and again by the effect (`applyCall`,
       the road after the payment), told both times; Dorm A is not refused. At C5's base (e925ca2, 11.10.2026) there was no `gatherRefusal`: the
       Boiler was paid for (Despair 6 to 0) and its order held on the Annex, untold. */
    const gatherE3 = await gm.eval(`${SCENES}
        const CE = await import("${repoUrl}/scripts/call-effects.mjs"), W = await import("${repoUrl}/scripts/call-world.mjs");
        const { DESPAIR_CALLS } = await import("${repoUrl}/scripts/config.mjs");
        const call = DESPAIR_CALLS.publicAnnouncement, monokuma = game.actors.get("ACTORMONOKUMA000");
        canvas.scene = academy;
        const [boiler] = await annex.createEmbeddedDocuments("Region", [{ name: "Boiler", shapes: ${rect(200, 200)}, flags: { "${MOD}": { room: true } }, behaviors: [] }]);
        const was = game.drpg.getDespair(game.user.id);
        await game.drpg.setDespair(game.user.id, 6);
        const told = game.i18n.format("DRPG.Calls.gatherNoRoom", { room: "Boiler", scene: academy.name });
        const refunded = game.i18n.format("DRPG.Calls.refunded", { call: call.label, cost: call.cost });
        const count = text => globalThis.__notifications.filter(n => n.msg === text).length, w0 = count(told), r0 = count(refunded);
        const refuse = room => CE.gatherRefusal ? CE.gatherRefusal(call, { room }, monokuma) : "no gatherRefusal";
        let out = null;
        canvas.scene = annex;
        try {
            out = { refusals: [await refuse("Boiler"), await refuse("Dorm A")],
                spent: await game.drpg.spendDespairCallFor(monokuma, "publicAnnouncement", { choice: { room: "Boiler", sceneId: annex.id } }),
                despair: game.drpg.getDespair(game.user.id),
                failed: (await CE.applyCall(monokuma, "publicAnnouncement", "despair", { room: "Boiler", sceneId: annex.id }))?.failed ?? null,
                pending: W.pendingGather()?.sceneId ?? null };
        } finally {
            canvas.scene = academy;
            await W.cancelGather();
            await boiler.delete();
            await game.drpg.setDespair(game.user.id, was);
        }
        return { ...out, warned: count(told) - w0, refunded: count(refunded) - r0, told };`, { timeout: 60000 });
    check("E3: a Public Announcement for the Annex's Boiler, bought by the Monokuma on Floor 1 viewing the Annex, is refused before it is paid and by its effect (E12 C5)",
        J(gatherE3.refusals) === J([gatherE3.told, null]) && gatherE3.spent === null && gatherE3.despair === 6 && gatherE3.failed === true
            && gatherE3.pending === null && gatherE3.warned === 2 && gatherE3.refunded === 0, J(gatherE3));
    await gm.eval(`if ("${setE.id}") await (await import("${repoUrl}/scripts/projects.mjs")).deleteProject("${setE.id}"); return true;`, { timeout: 30000 });

    /* ------------------------------ F. an actor on two scenes ------------------------------ */
    phase("F: Aiko on two scenes, and a murder judged with the camera on the Annex", { flow: "murder-incident" });
    const setF = await gm.eval(`${SCENES} const M = await import("${repoUrl}/scripts/movement.mjs");
        canvas.scene = academy;
        const aiko = game.actors.get("${IDS.aiko}");
        const [twin] = await annex.createEmbeddedDocuments("Token", [{ name: "Aiko", actorId: aiko.id, actorLink: true, x: 300, y: 300, width: 1, height: 1,
            hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 }]);
        const where = scene => { canvas.scene = scene; const at = M.locateActor(aiko); return at ? [at.scene?.id ?? null, at.room ?? null] : null; };
        let out;
        try { out = { onAnnex: where(annex), onFloor: where(academy) }; } finally { canvas.scene = academy; }
        globalThis.__s66f = { twin: twin?.id ?? null,
            at: Object.fromEntries(["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"].map(id => { const t = academy.tokens.find(x => x.actorId === id); return [t.id, { x: t.x, y: t.y }]; })) };
        return out;`, { timeout: 30000 });
    const eclipse = await gm.eval(`${SCENES} const M = await import("${repoUrl}/scripts/movement.mjs"), E = await import("${repoUrl}/scripts/eclipse.mjs");
        const { wordsOf } = await import("${repoUrl}/scripts/secret.mjs");
        canvas.scene = academy;
        await academy.updateEmbeddedDocuments("Token", ["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"].map((id, i) => {
            const t = academy.tokens.find(x => x.actorId === id);
            return { _id: t.id, x: 300 + 100 * i, y: 400 };
        }), { teleport: true, movementAction: "displace", animate: false });
        const rooms = ["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"].map(id => M.roomOfToken(academy.tokens.find(x => x.actorId === id)));
        const nobody = game.i18n.localize("DRPG.Action.murderNobody"), seen = new Set(game.messages.contents.map(m => m.id));
        const witnesses = foundry.utils.escapeHTML((await import("${repoUrl}/scripts/utils.mjs")).plural("DRPG.Action.murderWitness", { n: 1 }));
        const started = Boolean(await E.startEclipse());
        const parked = Boolean(await E.parkDirectMurder({ killerId: "${IDS.aiko}", room: "Dorm A", note: "E12 C0 66 F" }));
        canvas.scene = annex;
        try { await E.endEclipse({ advance: false }); } finally { canvas.scene = academy; }
        await new Promise(r => setTimeout(r, 500));
        /* The GMs' whisper is a secret card (secret.mjs): its words are asked for, not read off the stub. */
        const fresh = game.messages.contents.filter(m => !seen.has(m.id));
        const told = (await Promise.all(fresh.map(m => wordsOf(m, 1500)))).map(w => String(w ?? "")).filter(w => w.includes(foundry.utils.escapeHTML(game.actors.get("${IDS.aiko}").name)));
        return { rooms, started, parked, eclipse: E.isEclipse?.() ?? null, murder: Boolean(game.drpg.murderState()),
            nobody: told.some(c => c.includes(nobody)), witnesses: told.some(c => c.includes(witnesses)),
            told: told.map(c => c.replace(/<[^>]+>/g, " ").trim().slice(0, 200)) };`, { timeout: 90000 });
    await gm.eval(`${SCENES} const was = globalThis.__s66f;
        await academy.updateEmbeddedDocuments("Token", Object.entries(was.at).map(([_id, at]) => ({ _id, ...at })), { teleport: true, movementAction: "displace", animate: false });
        if (was.twin) await annex.deleteEmbeddedDocuments("Token", [was.twin]);
        delete globalThis.__s66f;
        return true;`, { timeout: 30000 });
    /* At 180df61 `locateActor` asked the actor's active tokens first and then the scenes from the camera's on: with
       the GM's camera on the Annex it answered the Annex's twin (in no room), on Floor 1 the Academy's Aiko in Dorm A
       (C0's reading). The harness's `getActiveTokens` lists the tokens of every scene, not the viewed one's alone as
       Foundry's does (lib/shim.mjs; found by C0, not changed), but another scene's entry is the bare document, with
       no `.document`, so that reading was the one Foundry's would give. E12 C3: the candidates are her tokens on the
       place scenes (scenes holding a room - the Annex holds none by F), so the camera chooses nothing. */
    check("F1: locateActor puts Aiko in Dorm A on Floor 1 with the GM's camera on either scene (E12 C3)",
        J(setF.onAnnex) === J([IDS.scene, "Dorm A"]) && J(setF.onFloor) === J([IDS.scene, "Dorm A"]), J(setF));
    /* At 180df61 `judgePendingMurders` counted who is in the killer's room on the GM's canvas (`othersInRoom`): with the
       GM looking at the Annex nobody was, and the murder in a room of three was cancelled as one with nobody to kill.
       E12 C3: judged on the killer's own scene - cancelled for the two witnesses. */
    check("F2: a murder parked in Dorm A with Botan and Chie there, judged with the GM's camera on the Annex, is cancelled for its two witnesses (E12 C3)",
        J(eclipse.rooms) === J(["Dorm A", "Dorm A", "Dorm A"]) && eclipse.started && eclipse.parked && eclipse.murder === false
            && eclipse.witnesses === true && eclipse.nobody === false,
        J(eclipse));

    /* ------------------------------ G. two floors ------------------------------ */
    phase("G: a scene of two floors", { flow: "levels-floor" });
    const setG = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const tower = game.scenes.get("${towerId}"), aiko = game.actors.get("${IDS.aiko}");
        const [t] = await tower.createEmbeddedDocuments("Token", [{ name: "Aiko", actorId: aiko.id, actorLink: true, x: 300, y: 300, width: 1, height: 1,
            hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1, level: "${L1}" }]);
        const lab = M.roomOfToken(t);
        await t.update({ x: 1300, y: 300 }, { teleport: true, movementAction: "displace", animate: false });
        globalThis.__s66g = { token: t.id, actions: game.drpg.actionsLeft(aiko) };
        if (game.drpg.actionsLeft(aiko) < 2) await game.drpg.setActions(aiko, 2);
        return { token: t.id, lab, corridor: M.roomOfToken(t), level: t.level, actions: game.drpg.actionsLeft(aiko), vaultLocked: M.isLocked(tower, "Vault") };`, { timeout: 30000 });
    const climb = await p1.eval(`const tower = game.scenes.get("${towerId}"), academy = game.scenes.get("${IDS.scene}");
        game._viewScene(tower, { level: "${L1}" });
        const t = tower.tokens.get("${setG.token}"), first = globalThis.__notifications.length;
        let threw = null;
        try { await t.update({ level: "${L2}" }); } catch (err) { threw = String(err?.message ?? err); }
        await new Promise(r => setTimeout(r, 1200));
        const out = { level: t.level, threw, told: globalThis.__notifications.slice(first).map(n => n.level + ": " + n.msg) };
        game._viewScene(academy);
        return out;`, { timeout: 30000 });
    await settle(800);
    const afterG = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const tower = game.scenes.get("${towerId}"), aiko = game.actors.get("${IDS.aiko}"), was = globalThis.__s66g, t = tower.tokens.get(was.token);
        const out = { level: t?.level ?? null, room: M.roomOfToken(t), actions: game.drpg.actionsLeft(aiko) };
        await game.drpg.setActions(aiko, was.actions);
        await tower.delete();
        delete globalThis.__s66g;
        return out;`, { timeout: 30000 });
    /* At 180df61 a room is told apart by its footprint alone (`roomAt`; the shim's regions ignore floors as Foundry's
       `testPoint` does without elevation): the token on the lower floor reads the alphabetically first region under it.
       E12 C9: `roomAt` per level, so the lower floor's Lab. */
    check("G1: a token on the ground floor under the Attic reads the Attic as its room, not the Lab it stands in (E12 C9)",
        setG.lab === "Attic" && setG.level === L1, J(setG));
    /* At 180df61 `onPreUpdateToken` judges a change of x or y and returns at once for a change of the level alone: p1's
       move from the Corridor up into the locked Vault is let through and costs no action. E12 C9 (V8): refused with
       the lock's words; (V7) a stair crossing is charged as a door, per Q1. */
    check("G2: p1's level-only move from the Corridor up into the locked Vault lands and costs no action (E12 C9)",
        climb.threw === null && climb.level === L2 && afterG.level === L2 && afterG.actions === setG.actions
            && !climb.told.some(line => line.startsWith("warn")), J({ setG, climb, afterG }));

    /* ------------------------------ H. the migration's room clause ------------------------------ */
    phase("H: the room-marking clause asked for by name");
    /* A scene made here after the load's own pass stamped the seeded two: four named regions, a Teleport "Lift", a region
       with no name and a "Den" recorded as a player's - the clause run by name marks the four on it alone. */
    const migrated = await gm.eval(`${SCENES} const MG = await import("${repoUrl}/scripts/migrate.mjs"), R = await import("${repoUrl}/scripts/rooms.mjs");
        const plain = (name, x) => ({ name, shapes: ${rect(0, 0, 400, 400)}.map(s => ({ ...s, x })), flags: {}, behaviors: [] });
        const wing = await Scene.create({ name: "66 Wing", width: 4400, height: 1000, grid: { size: 100 }, active: false });
        const made = await wing.createEmbeddedDocuments("Region", [plain("Ward A", 0), plain("Ward B", 500), plain("Office", 1000), plain("Lobby", 1500),
            { ...plain("Lift", 2000), behaviors: [{ type: "teleportToken", name: "Up", system: { destination: null } }] }, plain("", 2500), plain("Den", 3000)]);
        /* Asked whether it is registered, so that at 180df61 (no such setting) H reads what is there instead of throwing. */
        const kept = game.settings.settings.has("${MOD}.playerRegions"), players = kept ? [...game.settings.get("${MOD}", "playerRegions")] : [];
        if (kept) await game.settings.set("${MOD}", "playerRegions", [...players, made.at(-1).id]);
        const whispers = () => game.messages.filter(m => (m.whisper ?? []).length).length, before = whispers();
        const stamps = { academy: academy.getFlag("${MOD}", R.ROOMS_MARKED_FLAG) ?? null, annex: annex.getFlag("${MOD}", R.ROOMS_MARKED_FLAG) ?? null };
        const report = await MG.migrate1_2_0({ only: ["markRooms"], force: true });
        await new Promise(r => setTimeout(r, 500));
        globalThis.__s66h = { wing: wing.id, players, kept };
        return { clauses: Object.keys(report?.clauses ?? {}), done: report?.clauses?.markRooms ?? null, stamps, stamp: wing.getFlag("${MOD}", R.ROOMS_MARKED_FLAG) ?? null,
            rooms: R.roomNames(wing), whispers: whispers() - before };`, { timeout: 60000 });
    /* At 180df61 no clause is called markRooms: the migration asked for it ran nothing and stamped no scene. E12 C1: the
       load's pass stamped the seeded scenes; asked again, the clause marks the new scene's four named regions with no
       behaviour, leaves the Lift, the nameless region and the player's Den, stamps the scene and whispers one report. */
    check("H1: the clause asked for by name marks the Wing's four plain regions alone, stamps it and whispers one report (E12 C1)",
        J(migrated.clauses) === J(["markRooms"]) && J(migrated.done) === J({ scenes: 1, marked: 4 }) && typeof migrated.stamps.academy === "string"
            && typeof migrated.stamps.annex === "string" && typeof migrated.stamp === "string" && J(migrated.rooms) === J(["Lobby", "Office", "Ward A", "Ward B"])
            && migrated.whispers === 1, J(migrated));
    const again = await gm.eval(`const MG = await import("${repoUrl}/scripts/migrate.mjs"), R = await import("${repoUrl}/scripts/rooms.mjs");
        const wing = game.scenes.get(globalThis.__s66h.wing);
        await wing.regions.find(r => r.name === "Office").setFlag("${MOD}", R.ROOM_FLAG, false);
        const [late] = await wing.createEmbeddedDocuments("Region", [{ name: "Late", shapes: ${rect(3500, 0, 400, 400)}, flags: {}, behaviors: [] }]);
        const whispers = () => game.messages.filter(m => (m.whisper ?? []).length).length, before = whispers();
        const report = await MG.migrate1_2_0({ only: ["markRooms"], force: true });
        await new Promise(r => setTimeout(r, 500));
        const out = { clauses: Object.keys(report?.clauses ?? {}), rooms: R.roomNames(wing), late: R.roomDecided(late), whispers: whispers() - before };
        if (globalThis.__s66h.kept) await game.settings.set("${MOD}", "playerRegions", globalThis.__s66h.players);
        await wing.delete();
        delete globalThis.__s66h;
        return out;`, { timeout: 60000 });
    check("H2: asked again after the Office was unticked and a Late region drawn, the clause marks nothing and whispers nothing (E12 C1)",
        J(again.clauses) === J([]) && J(again.rooms) === J(["Lobby", "Ward A", "Ward B"]) && again.late === false && again.whispers === 0, J(again));

    /* ------------------------------ I. a jump into a locked room ------------------------------ */
    phase("I: a body in a locked room, and a player's jump in beside it", { flow: "body-discovery" });
    /* Who walked in is in the GMs' console alone (`checkBodyFound`, chapter.mjs), not on the card nor on the stamp, and a
       client's console reaches the harness's stdout, not `logSink` - so the GM's own console is kept from here to the find. */
    const setI = await gm.eval(`${SCENES} ${LOCKED} const M = await import("${repoUrl}/scripts/movement.mjs"), C = await import("${repoUrl}/scripts/chapter.mjs");
        canvas.scene = academy;
        const storage = academy.regions.find(r => r.name === "Storage");
        await storage.setFlag("${MOD}", ROOM_FLAGS.locked, true);
        const place = async (id, room) => { const t = academy.tokens.find(x => x.actorId === id);
            await t.update(M.positionIn(room, t), { teleport: true, movementAction: "displace", animate: false });
            await new Promise(r => setTimeout(r, 1200)); return M.roomOfToken(t); };
        const daichi = await place("${IDS.daichi}", "Storage");
        const kept = Boolean(await C.killCharacter(game.actors.get("${IDS.daichi}"), { secret: true, keepBullets: true }));
        const botan = await place("${IDS.botan}", "Storage"), aiko = await place("${IDS.aiko}", "Hall");
        const cards = () => game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound").length;
        globalThis.__s66i = { cards: cards(), log: console.log, lines: [] };
        console.log = (...args) => { globalThis.__s66i.lines.push(args.map(String).join(" ")); return globalThis.__s66i.log.apply(console, args); };
        return { locked: locked(storage), daichi, kept, botan, aiko, cards: cards(), neighbours: M.neighbouringRooms(academy, "Hall"),
            names: { aiko: game.actors.get("${IDS.aiko}").name, botan: game.actors.get("${IDS.botan}").name } };`, { timeout: 60000 });
    const jump = await p1.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        const t = canvas.scene.tokens.get("TOKAIKO000000000");
        await t.update(M.positionIn("Storage", t), { drpgRevert: true, teleport: true, movementAction: "displace", animate: false });
        return M.roomOfToken(t);`, { timeout: 30000 });
    const foundI = await gm.eval(`const S = await import("${repoUrl}/scripts/settings.mjs");
        const end = Date.now() + 8000; while (!S.bodyDiscovery() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 800));
        const cards = game.messages.filter(m => m.flags?.["${MOD}"]?.sfx?.key === "bodyFound").length - globalThis.__s66i.cards;
        const rows = (S.bodiesFoundIn?.(S.getClock().chapter) ?? []).map(row => ({ by: row.by, room: row.room, victimIds: row.victimIds }));
        console.log = globalThis.__s66i.log;
        const finders = globalThis.__s66i.lines.filter(line => line.includes("Body found in Storage:"));
        delete globalThis.__s66i;
        return { held: Boolean(S.bodyDiscovery()), cards, rows, finders };`, { timeout: 30000 });
    /* At 180df61 the discovery counts every student standing in the room when a token arrives (`witnessesOf`), however
       they got there: p1's jump from the Hall into the locked Storage, the veto skipped as a revert skips it, makes Aiko
       the second witness, and the body is found. E12 C12 (Q5a): a token that reached the room unlawfully is not a
       witness - Botan alone, no card. */
    check("I1: Aiko jumped from the Hall into the locked Storage by her player is counted a witness: the body is found by Aiko and Botan (E12 C12)",
        setI.locked && setI.kept && setI.daichi === "Storage" && setI.botan === "Storage" && setI.aiko === "Hall" && setI.cards === 0
            && !setI.neighbours.includes("Storage") && jump === "Storage" && foundI.held && foundI.cards === 1
            && foundI.rows.some(row => row.room === "Storage" && row.by === "witnesses")
            && foundI.finders.length === 1 && foundI.finders[0].includes(setI.names.aiko) && foundI.finders[0].includes(setI.names.botan),
        J({ setI, jump, foundI }));

    /* ------------------------------ J. a player's region and a player's untick ------------------------------ */
    phase("J: p1 draws a region marked a room and unticks the Gym");
    /* The harness lets a player's Region write through (cluster.mjs `canWrite`; whether v14 does: LIVE-E12-04), so this
       is the road the primary answers from the hook's user id: p1's own create and p1's own flag write. */
    const drawJ = await p1.eval(`const [den] = await canvas.scene.createEmbeddedDocuments("Region", [{ name: "Den", shapes: ${rect(3000, 1800, 400, 400)},
            flags: { "${MOD}": { room: true } }, behaviors: [] }]);
        const gym = canvas.scene.regions.find(r => r.name === "Gym");
        await new Promise(r => setTimeout(r, 800));
        await gym.setFlag("${MOD}", "room", false);
        return { den: den?.id ?? null, scene: canvas.scene.id, user: game.user.name };`, { timeout: 30000 });
    await settle(1500);
    const readJ = await gm.eval(`${SCENES} const R = await import("${repoUrl}/scripts/rooms.mjs"), { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const end = Date.now() + 6000;
        const gym = () => academy.regions.find(r => r.name === "Gym");
        while (gym()?.getFlag("${MOD}", R.ROOM_FLAG) !== true && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const den = academy.regions.get("${drawJ.den}");
        const want = foundry.utils.escapeHTML(game.i18n.format("DRPG.Rooms.flagKept", { user: ${J(drawJ.user)}, region: "Gym", scene: academy.name }));
        const told = game.messages.filter(m => String(contentOf(m) ?? "").includes(want)).length;
        const out = { flag: den?.getFlag("${MOD}", R.ROOM_FLAG) ?? null, isRoom: den ? R.isRoom(den) : null, recorded: R.playerRegionIds().has("${drawJ.den}"),
            rooms: R.roomNames(academy), gym: gym()?.getFlag("${MOD}", R.ROOM_FLAG) ?? null, gymRoom: R.isRoom(gym()), told };
        if (den) await den.delete();
        if (game.settings.settings.has("${MOD}.playerRegions")) {
            await game.settings.set("${MOD}", "playerRegions", game.settings.get("${MOD}", "playerRegions").filter(id => id !== "${drawJ.den}"));
        }
        return out;`, { timeout: 30000 });
    /* At 180df61 nothing records who drew a region and nothing reads the mark: p1's Den is a room by its name and the
       Gym's untick stands. E12 C1: the primary records the Den as p1's, so its mark makes no room; it puts the Gym's
       mark back and tells the GMs. */
    check("J1: p1's Den, drawn with the room mark, is recorded as a player's and is no room (E12 C1)",
        drawJ.scene === IDS.scene && readJ.flag === true && readJ.isRoom === false && readJ.recorded && !readJ.rooms.includes("Den"), J({ drawJ, readJ }));
    check("J2: p1's untick of the Gym is put back by the primary and the GMs are told once (E12 C1)",
        readJ.gym === true && readJ.gymRoom && readJ.rooms.includes("Gym") && readJ.told === 1, J({ drawJ, readJ }));

    /* ------------------------------ K. the rooms a player knows, whatever is on their screen ------------------------------ */
    phase("K: the rooms p1 knows, read on Aiko's scene with p1's camera on Floor 1, the Annex and nothing");
    /* Aiko is stood in the Hall first (she stood in no room after J, read on 11.10.2026) and put back after. */
    const putK = to => gm.eval(`${SCENES} const M = await import("${repoUrl}/scripts/movement.mjs");
        const t = academy.tokens.find(x => x.actorId === "${IDS.aiko}"), was = { x: t.x, y: t.y };
        await t.update(${to ? J(to) : `M.positionIn("Hall", t)`}, { teleport: true, movementAction: "displace", animate: false });
        await new Promise(r => setTimeout(r, 1200)); return { was, room: M.roomOfToken(t) };`, { timeout: 30000 });
    const stoodK = await putK(null);
    const readK = await p1.eval(`${SCENES} const M = await import("${repoUrl}/scripts/movement.mjs"), A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const where = M.locateActor(game.actors.get("${IDS.aiko}")), doors = M.allRooms(where?.scene ?? null);
        const read = scene => { const known = M.roomsKnownToMe(scene); return { known: known ? [...known].sort() : null, doors: [...A.listenLabels(doors, known).values()] }; };
        const was = canvas.scene, out = { scene: where?.scene?.id ?? null, room: where?.room ?? null, names: doors };
        try {
            for (const [name, view] of [["floor1", academy], ["annex", annex], ["nothing", null]]) { canvas.scene = view; out[name] = read(where?.scene ?? null); }
            out.noScene = read(null);
        } finally { canvas.scene = was; }
        return out;`, { timeout: 30000 });
    await putK(stoodK.was);
    /* Until E12 fix r1-G4 `roomsKnownToMe` read p1's camera: the Annex's ledger and tokens with the camera there, and
       null - no filter, every door named - with nothing on screen. It reads the scene its caller names now (Listen and the
       Rest list name the character's), and a player with no scene knows no room. */
    const unexplored = list => list.every(label => !readK.names.includes(label));
    check("K1: the rooms p1 knows on Aiko's scene and the names Listen gives its rooms do not follow p1's camera, and with no scene name no room (E12 fix r1-G4)",
        stoodK.room === "Hall" && readK.scene === IDS.scene && readK.room === "Hall" && Array.isArray(readK.floor1.known) && readK.floor1.known.includes(readK.room)
            && readK.names.length > readK.floor1.known.length && readK.floor1.doors.includes("Hall")
            && J(readK.annex) === J(readK.floor1) && J(readK.nothing) === J(readK.floor1)
            && J(readK.noScene.known) === J([]) && unexplored(readK.noScene.doors),
        J({ stoodK, readK }));

    /* G2's premises, read where G set them up (E12 fix r1-G5; review EARLY-C0-2): until this check nothing asserted that
       Aiko's climb starts in the Corridor or that the Vault above it is locked, so G2 could read a climb from anywhere
       into an open room as the one it names. */
    check("G3: G2's climb starts with Aiko in the Corridor on the ground floor, under a Vault that is locked (E12 fix r1-G5)",
        setG.corridor === "Corridor" && setG.level === L1 && setG.vaultLocked === true, J(setG));
}
