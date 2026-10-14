/**
 * Scenario 74 - the room tile: each browser draws its own viewer's room, from the GM's Room Setup, once a route
 * has settled (E77 C3, 13.10.2026; the E77 plan's 2.2, the A8 design's R379 and R381, ledger V2, V4, V19, D5).
 *
 * The tile (room-tile.mjs) puts on every player's screen two things the GM wrote - a room's description and its
 * picture - and chooses which room to put there. Three browsers and a late fourth: p1 (Aiko), p2 (Botan), the GM
 * (its Monokuma) and p4, an account with no character. What only a cluster can say:
 *
 *   A (the GM's words reach the tile, and only the viewer's): the GM gives Dorm A words and a picture through Room
 *     Setup's own form; p1's tile, standing in Dorm A, is painted once and shows both, the words literal and the
 *     picture as the art layer's; p2's page holds nothing of Dorm A, the GM's tile its Monokuma's Hall, p4's the
 *     line for no character; no clock still carries the old room rows; then Botan in a room of words alone, of a
 *     picture alone, of neither, and out of every room, each on p2's tile as its state; and p2's toggle opens the
 *     words and a change of room closes them.
 *   B (a route settles before the tile moves): p1 takes Aiko into a Porch, a paid crossing - one paint, after the
 *     route is settled, and the card names the Porch without its words; then a route whose second crossing is
 *     refused for its price - read on p1's tile 400 and 1200 ms after the last step, nothing of the refused Shed
 *     at any moment, and the tile ends in Dorm A, where the put-back stands the token. Scenario 66 W reads the same
 *     routes on room-tile.mjs's data; this reads what is drawn.
 *   D (Foundry's rails leave the screen, E77 C5): p1's scene controls computed `display: none` in both themes and its
 *     layer back to Tokens after a new canvas and a render of the controls; the GM's two windows closed, Foundry tools
 *     holding the sidebar collapsed, and a scene rail drawn in the left column moved into Map tools.
 *   E (the corner's upper row, E77 C6): on the GM's page the red GM button and Foundry tools are children of the body
 *     in the cluster (`data-drpg-cluster`) with no `drpg-` class on them or above them, and a click on Foundry tools
 *     opens both windows (`aria-pressed` "true") and a second closes both; p1 and p2 have neither button.
 *   F (the windows' places and Escape, E77 C7): opening both windows fires no `drpgGlassCut` (beside a taller clock's
 *     control); Foundry tools dragged by its title stands where it was dropped and the place is in the GM's client
 *     storage, in no player's; with a framed DialogV2 open Escape is Foundry's, and only the next one closes both.
 *   G (the narrow row, E77 C8): the harness's page is a stacked screen, so p1's tile stands in `#drpg-tile-row`, a row
 *     of `#drpg-column`, in its narrow form: a thumbnail whose `src` is the checked path the art layer shows, and a
 *     'Description' button that opens a window of the module's titled 'Description' holding Dorm A's words as text -
 *     no element of the GM's markup in it, nothing run - and a second open is the same window, as are two presses
 *     before it has rendered (E77 fix r2-H1). Then the open window follows Aiko (fix r2-H1): its words stay through a
 *     refused crossing, become the Porch's when p1 takes her there, and the window closes in the Gym, a room of no
 *     words. The row's 44 px, the thumbnail's 78x44 and the cut need layout: R508's narrow clause and
 *     audit/glass-sweep.mjs read them.
 *   C (a route another browser settles, E77 fix r1-G2): p2's tile follows p2's own crossings of Botan when p2
 *     settles them, when every player owns every student and when p1 owns Botan beside p2 - p1 settles both - and a
 *     refused route p1 judges paints nothing of its room on p2's tile, nor does a drag begun before the last route
 *     was quiet; then a put-back of p1's that never lands, and the GM's next move of Aiko, which p1's tile follows -
 *     and once more, ended by p1's own next move (E77 fix r2-H1).
 *   H (the states that are no gate, E77 fix r1-G3): in an Eclipse p1's tile keeps Aiko's room and follows her
 *     Eclipse crossing; dead it keeps the room her body lies in, and as a Monocub follows her walk; in a Class Trial
 *     every tile is the trial's while each viewer still stands in a school room; and p4's character, on a scene of
 *     two floors, is shown in the room of its token's floor, not of the floor p4's canvas shows, and of its token's
 *     scene, not of the scene p4 looks at.
 *   I (a stored picture that cannot be read, E77 fix r2-H1): a path of this origin whose re-read the URL parser
 *     rejects, written on the Cafeteria past setVaultRoom - after a control, roomImage answers no picture on the GM
 *     and on p1, Room Setup opens and draws the Cafeteria with none, p1's tile follows Aiko in, and setVaultRoom
 *     handed the same path warns and writes nothing.
 *   K (The Forge's Assets Library, E78 fix h76-HF1): with a stand-in `ForgeVTT` on the GM's and p1's pages, Room
 *     Setup's Apply and setVaultRoom each keep a Library picture on the Cafeteria and p1's tile draws it, another host
 *     and `http:` to the Library are refused with the warning; with the stand-in taken off, roomImage reads none and
 *     setVaultRoom refuses the Library again.
 *   J (the world switch, E77 fix r2-H2): with the switch of the GM's Foundry windows off, a second GM's page loads
 *     with no windows, no launcher and no wrapped sidebar, Foundry's rails left in #interface, while the GM's running
 *     page keeps its windows until it reloads; the switch goes back on.
 *   The phases run in this order, not the letters': G reads p1 as B left it (Aiko in Dorm A) and stands her there
 *     again, and C and H - the side fix line's, merged after E77 C9 on 13.10.2026 - move Aiko and Botan, so they run
 *     after it; I, K and J run last.
 *
 * A paint is counted as one `childList` record on the tile itself: `paintRoomTile` replaces the tile's children
 * in one call and writes nothing when its view is unchanged. What the tile looks like (the picture over the whole
 * tile, the gradient, its height) needs layout and is not read here; a GM without a Monokuma is painted on a box by
 * R504.
 *
 * THE CUT IS NOT READ HERE (E77 fix r1-G3, 13.10.2026; review round 1 goal 6). The E77 plan's 2.2 gave E77 C4 a
 * phase of this scenario reading that a new description, its expansion and a change of room fire no `drpgGlassCut`.
 * Read on p1 by a probe run once after phase H and not kept (13.10.2026, on the side fix line's tree, whose runtime was
 * E77 C4's), and read again on p1 and the GM by a probe of E77 fix r1-M1, run alone and not kept, once C8 had put the
 * tile in the stacked screen's row (13.10.2026, e77-wip after ceb70a4 with r1-M1's glass.mjs): the harness's 1024x768
 * page is a stacked screen (the body's `drpg-stacked`, under Stained Glass), the tile stands in `#drpg-tile-row` with
 * no place stamped, its curtain is never painted (no `drpg-curtain-on`, glass.mjs `LAST.panes` empty, `LAST.room`
 * unset), `roomPlacement` answers 'notes' with F null because no element has a size in jsdom, and `refreshGlass`
 * fired no `drpgGlassCut` - nor did it after the clock was made 40 px taller, the control that must cut. A count here
 * would read 0 whatever the tile did, so the cut is measured in Chromium instead: audit/glass-sweep.mjs at its sizes
 * and both themes (`drpgRoomCheck`, audit/glass-harness.html), and R508's clause of the same reading with the same
 * control, which is skipped headless (`env.layout`). The plan's letter C went to fix r1-G2's phase.
 */
export const layers = ["ci"];
/* Measured alone on 13.10.2026 (E77 C3's phases A and B, once, under the harness lock): 19.8 s from the cluster's start
   to its end by the results file, the checks 15.8 s of it. 60 s is three times that, as 73 keeps; E77's later phases here
   (the curtain's cut) raise it with a reading of their own. E77 fix r1-G2's phase C (each crossing waits out the quiet
   of 1.5 s on a browser that does not settle it) took the scenario to 10 checks in 41.5 s, one run of the side fix
   line's fast set on 13.10.2026; three times that is 125 s. E77 fix r1-G3's phase H took it to 14 checks in 52.0 s, one
   run alone under the lane-A lock beside two other lanes' scenarios on 13.10.2026; three times that is 156 s. E77 fix
   r2-H1's G3, G4, C6 and phase I took it to 32 checks in 61.5 s, one run alone under the lane-A lock with no other lane
   busy on 13.10.2026; three times that is 185 s. */
export const timeoutMs = 185000;
/* gm2 (E77 fix r2-H2): a second GM for phase J, its id after the seeded GM's so the seeded one stays the primary GM. */
export const accounts = [{ who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#2a7f62", late: true },
    { who: "gm2", id: "USERGZ7400000000", name: "Second GM", role: 4, character: null, color: "#7a2a2a", late: true }];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, gm2, p1, p2, p4, check, phase, settle, connect, disconnect, IDS, repoUrl }) {
    const ACADEMY = `const academy = game.scenes.get("${IDS.scene}");`;
    const rect = (x, y, width, height) => J([{ type: "rectangle", x, y, width, height }]);
    const MOVE = `{ teleport: true, movementAction: "displace", animate: false }`;
    /* One tile, read whole: its state, its heading, the words behind its toggle, the art's picture, the toggle's
       state, and every paint since `watch` (the heading each one drew); a page without the tile watches nothing and
       reads null, so the checks say so rather than the scenario throwing. */
    const TILE = `const tile = () => document.getElementById("drpg-room-tile");
        const read = () => { const t = tile();
            return t ? { state: t.dataset.state ?? null, name: t.querySelector(".drpg-room-tile-name")?.textContent ?? null,
                prose: t.querySelector(".drpg-room-tile-prose")?.textContent ?? null, art: t.querySelector(".drpg-room-tile-art")?.style.backgroundImage ?? null,
                open: t.classList.contains("is-open"), expanded: t.querySelector(".drpg-room-tile-more")?.getAttribute("aria-expanded") ?? null,
                hidden: t.getAttribute("aria-hidden"), after: t.previousElementSibling?.id ?? null, parent: t.parentElement?.id ?? null,
                stacked: document.body.classList.contains("drpg-stacked"), text: t.textContent } : null; };
        const watch = () => { const painted = globalThis.__s74painted = [];
            globalThis.__s74observer?.disconnect();
            if (!tile()) return false;
            globalThis.__s74observer = new MutationObserver(records => { for (const r of records) if (r.type === "childList" && r.target === tile())
                painted.push(tile().querySelector(".drpg-room-tile-name")?.textContent ?? null); });
            globalThis.__s74observer.observe(tile(), { childList: true }); return true; };
        const take = () => (globalThis.__s74painted ?? []).splice(0);`;
    const UNTIL = `const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };`;
    const WORDS = { "Dorm A": "S74 Dorm A words: <img src=x onerror=\"globalThis.__s74ran = 1\"> <b>a bunk</b>\n\nA second paragraph.",
        Hall: "S74 Hall words", "Dorm B": "S74 Dorm B words", Porch: "S74 Porch words", Shed: "S74 Shed words" };
    const IMAGES = { "Dorm A": "worlds/s74/s74-dorm-a.webp", Cafeteria: "worlds/s74/s74-cafeteria.webp", Porch: "worlds/s74/s74-porch.webp",
        Shed: "worlds/s74/s74-shed.webp" };

    /* ------------------------------ A. the GM's words reach the viewer's tile ------------------------------ */
    phase("A: the GM's Room Setup on p1's tile and on no other's; every state of p2's");
    await connect("p4");
    const setA = await gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), V = await import("${repoUrl}/scripts/vault.mjs");
        const was = globalThis.__s74 = { at: {}, rooms: {} };
        for (const room of ["Dorm A", "Cafeteria", "Hall", "Gym", "Dorm B"]) was.rooms[room] = { description: V.roomDescription(room, academy), image: V.roomImage(room, academy) };
        await V.setVaultRoom("Dorm A", { description: "", image: null, scene: academy });
        await V.setVaultRoom("Cafeteria", { description: "", image: "${IMAGES.Cafeteria}", scene: academy });
        await V.setVaultRoom("Hall", { description: "${WORDS.Hall}", image: null, scene: academy });
        await V.setVaultRoom("Gym", { description: "", image: null, scene: academy });
        await V.setVaultRoom("Dorm B", { description: "${WORDS["Dorm B"]}", image: null, scene: academy });
        for (const [id, room] of Object.entries({ TOKAIKO000000000: "Dorm A", TOKBOTAN00000000: "Cafeteria", TOKMONOKUMA00000: "Hall" })) {
            const t = academy.tokens.get(id);
            was.at[id] = { x: t.x, y: t.y };
            await t.update(M.positionIn(room, t), ${MOVE});
        }
        await new Promise(r => setTimeout(r, 1200));
        return Object.fromEntries(["TOKAIKO000000000", "TOKBOTAN00000000", "TOKMONOKUMA00000"].map(id => [id, M.roomOfToken(academy.tokens.get(id))]));`,
    { timeout: 30000 });
    await p1.eval(`${TILE} return watch();`);
    /* Room Setup as a GM answers it: the window's own form, Dorm A's words and picture typed into its two cells, then
       its Apply button's own callback (66's ROOM_SETUP, with the cells for the lock). */
    const applied = await gm.eval(`const V = await import("${repoUrl}/scripts/vault.mjs");
        let seen = null;
        globalThis.__dialogAnswers.push(async config => {
            const ok = (config.buttons ?? []).find(b => b.action === "ok");
            const element = document.createElement("dialog"), form = document.createElement("form");
            if (typeof config.content === "string") form.innerHTML = config.content; else if (config.content) form.append(config.content.cloneNode(true));
            element.append(form);
            const words = form.querySelector('[name="desc:Dorm A"]'), picture = form.querySelector('[name="img:Dorm A"]');
            seen = { words: Boolean(words), picture: Boolean(picture) };
            if (words) words.value = ${J(WORDS["Dorm A"])};
            if (picture) picture.value = "${IMAGES["Dorm A"]}";
            return ok.callback(new globalThis.window.Event("click"), { form }, { element });
        });
        let changed = null;
        try { changed = await V.openRoomSetupDialog(); } finally { globalThis.__dialogAnswers.length = 0; }
        await new Promise(r => setTimeout(r, 1200));
        return { seen, changed: changed ?? null };`, { timeout: 30000 });
    const p1A = await p1.eval(`${TILE} return { tile: read(), painted: take(), ran: globalThis.__s74ran ?? null,
        clockRows: document.querySelectorAll("#drpg-hud .drpg-hud-room, #drpg-hud .drpg-hud-room-tokens").length };`);
    const PAGE = `${TILE} const page = document.documentElement.outerHTML;
        return { tile: read(), clockRows: document.querySelectorAll("#drpg-hud .drpg-hud-room, #drpg-hud .drpg-hud-room-tokens").length,
            dormA: ["S74 Dorm A", "s74-dorm-a"].filter(word => page.includes(word)) };`;
    const [p2A, gmA, p4A] = [await p2.eval(PAGE), await gm.eval(PAGE), await p4.eval(PAGE)];
    const L = await p1.eval(`return { nowhere: game.i18n.localize("DRPG.Hud.roomNowhere"), noActor: game.i18n.localize("DRPG.Explain.room.noActor") };`);
    check("A1: the GM's Room Setup gives Dorm A words and a picture, and p1's tile, Aiko's Dorm A, is painted once with both - the words "
        + "literal, markup and paragraph break as typed, the picture on the art layer - after the clock it stands under, or in the tiles' row on a stacked screen",
    J(setA) === J({ TOKAIKO000000000: "Dorm A", TOKBOTAN00000000: "Cafeteria", TOKMONOKUMA00000: "Hall" })
        && applied.seen?.words === true && applied.seen?.picture === true
        && J(p1A.painted) === J(["Dorm A"]) && p1A.tile?.state === "room" && p1A.tile.name === "Dorm A" && p1A.tile.prose === WORDS["Dorm A"]
        && p1A.tile.art === `url("${IMAGES["Dorm A"]}")` && p1A.ran === null
        // The harness's page is a stacked screen (jsdom's 1024 px is under the breakpoint), and there the tile stands in
        // the tiles' row since E77 C8 rather than under the clock; on a desk it is under the clock, as C3 read it.
        && (p1A.tile.stacked ? p1A.tile.parent === "drpg-tile-row" : ["drpg-hud", "drpg-floors"].includes(p1A.tile.after)),
    J({ setA, applied, p1A }));
    check("A2: nothing of Dorm A reaches p2's page, the GM's tile is its Monokuma's Hall (words, no picture), p4 with no character "
        + "reads the line for none, and no clock carries the old room rows",
    J(p2A.dormA) === "[]" && p2A.tile?.state === "roomPicture" && p2A.tile.name === "Cafeteria" && p2A.tile.art === `url("${IMAGES.Cafeteria}")`
        && J(gmA.dormA) === "[]" && gmA.tile?.state === "roomText" && gmA.tile.name === "Hall" && gmA.tile.prose === WORDS.Hall && gmA.tile.art === ""
        && J(p4A.dormA) === "[]" && p4A.tile?.state === "noActor" && p4A.tile.name === L.noActor
        && [p1A, p2A, gmA, p4A].every(page => page.clockRows === 0),
    J({ p2A, gmA, p4A, clockRows: p1A.clockRows }));

    /* Botan walked by the GM through four places: Dorm B (words alone), the Gym (neither), out of every room, back to
       the Cafeteria. p2's toggle is opened in Dorm B before the next move. */
    const statesA = [];
    for (const [where, open] of [["Dorm B", true], ["Gym", false], [null, false], ["Cafeteria", false]]) {
        await gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKBOTAN00000000");
            await t.update(${where ? `M.positionIn("${where}", t)` : "{ x: 1000, y: 1000 }"}, ${MOVE});
            await new Promise(r => setTimeout(r, 800)); return true;`, { timeout: 30000 });
        statesA.push(await p2.eval(`${TILE} ${UNTIL} await until(() => read()?.name === ${J(where ?? L.nowhere)});
            const before = read();
            if (${open}) tile()?.querySelector(".drpg-room-tile-more")?.click();
            const s = read();
            return { state: s?.state, name: s?.name, art: s?.art ?? null, toggle: Boolean(tile()?.querySelector(".drpg-room-tile-more")),
                openedBefore: before?.open ?? null, open: s?.open ?? null, expanded: s?.expanded ?? null };`));
    }
    check("A3: p2's tile follows Botan through a room of words alone, one of neither and none at all, each its own state, and a change "
        + "of room closes the words opened in the room before",
    J(statesA.map(s => [s.state, s.name, s.art, s.toggle, s.openedBefore, s.open, s.expanded])) === J([
        ["roomText", "Dorm B", "", true, false, true, "true"], ["roomBare", "Gym", "", false, false, false, null],
        ["nowhere", L.nowhere, null, false, false, false, null], ["roomPicture", "Cafeteria", `url("${IMAGES.Cafeteria}")`, false, false, false, null]]),
    J(statesA));

    /* ------------------------------ B. a route settles before the tile moves ------------------------------ */
    phase("B: p1's crossing paints once, after the route settles; a refused crossing paints nothing of its room");
    const setB = await gm.eval(`${ACADEMY} const V = await import("${repoUrl}/scripts/vault.mjs"), aiko = game.actors.get("${IDS.aiko}");
        const was = globalThis.__s74;
        was.actions = game.drpg.actionsLeft(aiko); was.free = aiko.getFlag("${MOD}", "freeMoveUsed") ?? null;
        const made = await academy.createEmbeddedDocuments("Region", [
            { name: "74 Porch", shapes: ${rect(820, 200, 300, 300)}, behaviors: [],
                flags: { "${MOD}": { room: true, [V.VAULT_FLAGS.description]: "${WORDS.Porch}", [V.VAULT_FLAGS.image]: "${IMAGES.Porch}" } } },
            { name: "74 Shed", shapes: ${rect(820, 520, 300, 280)}, behaviors: [],
                flags: { "${MOD}": { room: true, [V.VAULT_FLAGS.description]: "${WORDS.Shed}", [V.VAULT_FLAGS.image]: "${IMAGES.Shed}" } } }]);
        was.regions = made.map(r => r.id);
        if (game.drpg.actionsLeft(aiko) < 1) await game.drpg.setActions(aiko, 1);
        await new Promise(r => setTimeout(r, 1000));
        return made.length;`, { timeout: 30000 });
    /* Three readers on p1: the tile's heading at each update of Aiko as it is written (`updateToken`, registered after the
       tile's own listeners) and at each settled route (`drpgRouteSettled`, likewise), and the paints. */
    await p1.eval(`${TILE} take(); globalThis.__s74at = { written: [], settled: [] };
        globalThis.__s74written = doc => { if (doc.id === "TOKAIKO000000000") globalThis.__s74at.written.push(read()?.name ?? null); };
        globalThis.__s74settled = ({ tokenDoc, accepted }) => { if (tokenDoc?.id === "TOKAIKO000000000") globalThis.__s74at.settled.push([accepted, read()?.name ?? null]); };
        Hooks.on("updateToken", globalThis.__s74written); Hooks.on("drpgRouteSettled", globalThis.__s74settled); return true;`);
    const AT = `const at = () => { const a = globalThis.__s74at; return { written: a.written.splice(0), settled: a.settled.splice(0) }; };`;
    const crossB = await p1.eval(`${ACADEMY} ${TILE} ${AT} const S = await import("${repoUrl}/scripts/secret.mjs");
        const t = academy.tokens.get("TOKAIKO000000000"), before = game.messages.contents.length;
        await t.update({ x: 900, y: 300 });
        await new Promise(r => setTimeout(r, 1500));
        const words = await Promise.all(game.messages.contents.slice(before).map(m => S.wordsOf(m)));
        return { cards: words.map(String).filter(text => text.includes("74 Porch")), tile: read(), painted: take(), ...at() };`, { timeout: 30000 });
    check("B1: p1's crossing into the Porch paints p1's tile once, when the route has settled - Dorm A still on it as the update is "
        + "written - with the Porch's words and picture, and the card names the Porch and its price without the words",
    J(crossB.painted) === J(["74 Porch"]) && J(crossB.written) === J(["Dorm A"]) && J(crossB.settled) === J([[true, "74 Porch"]])
        && crossB.tile?.state === "room" && crossB.tile.prose === WORDS.Porch && crossB.tile.art === `url("${IMAGES.Porch}")`
        && crossB.cards.length === 1 && crossB.cards[0].includes("You enter 74 Porch.") && !crossB.cards[0].includes("S74 Porch"),
    J({ setB, crossB }));

    /* One action, the free move spent: from the Porch through Dorm A (a step with waypoints pending, as 66 W stands it in)
       into the Shed. The first crossing is paid, the second refused, and the token is put back in Dorm A. */
    const brokeB = await gm.eval(`const A = await import("${repoUrl}/scripts/actions.mjs"), aiko = game.actors.get("${IDS.aiko}");
        await game.drpg.setActions(aiko, 1); await aiko.setFlag("${MOD}", "freeMoveUsed", true);
        await new Promise(r => setTimeout(r, 600));
        return { actions: game.drpg.actionsLeft(aiko), free: A.hasFreeMove(aiko), grants: A.freeMovesLeft(aiko) };`, { timeout: 30000 });
    const refusedB = await p1.eval(`${ACADEMY} ${TILE} ${AT} const t = academy.tokens.get("TOKAIKO000000000"), M = await import("${repoUrl}/scripts/movement.mjs");
        Object.defineProperty(t, "movement", { value: { pending: { waypoints: [{ x: 900, y: 600 }] } }, configurable: true });
        try { await t.update({ x: 600, y: 400 }); await new Promise(r => setTimeout(r, 800)); } finally { delete t.movement; }
        const via = { tile: read(), painted: take(), ...at() };
        t.update({ x: 900, y: 600 }).catch(() => null);
        await new Promise(r => setTimeout(r, 400));
        const early = { tile: read(), painted: take() };
        await new Promise(r => setTimeout(r, 800));
        const late = { tile: read(), painted: take(), ...at() };
        await new Promise(r => setTimeout(r, 800));
        return { via, early, late, rest: { painted: take(), ...at() }, token: M.roomOfToken(t) };`, { timeout: 30000 });
    const p2B = await p2.eval(`const page = document.documentElement.outerHTML; return ["74 Porch", "74 Shed", "S74 Porch", "S74 Shed", "s74-porch", "s74-shed"].filter(word => page.includes(word));`);
    const shedFree = value => !/74 Shed|S74 Shed|s74-shed/.test(J(value));
    check("B2: a route whose second crossing is refused paints nothing of the refused Shed on p1's tile - not at its pending step, not "
        + "400 or 1200 ms after its last - and the tile ends in Dorm A, painted once, when the put-back lands; nothing of the Porch or "
        + "the Shed reaches p2's page",
    brokeB.actions === 1 && brokeB.free === false && brokeB.grants === 0
        && J(refusedB.via.painted) === "[]" && refusedB.via.tile?.name === "74 Porch"
        && [refusedB.via, refusedB.early, refusedB.late, refusedB.rest].every(shedFree)
        && J([...refusedB.early.painted, ...refusedB.late.painted, ...refusedB.rest.painted]) === J(["Dorm A"])
        && refusedB.late.tile?.name === "Dorm A" && refusedB.late.tile.prose === WORDS["Dorm A"] && refusedB.token === "Dorm A"
        && J([...refusedB.late.settled, ...refusedB.rest.settled]) === J([[false, "Dorm A"]]) && J(p2B) === "[]",
    J({ brokeB, refusedB, p2B }));

    /* ------------------------------ D. Foundry's rails leave the screen (E77 C5) ------------------------------ */
    phase("D: a player has no scene controls and keeps the Tokens layer; the GM's rails stand in two closed windows");
    /* The harness draws no scene controls of Foundry's, so each page is handed a stand-in `#scene-controls` in its left
       column - the element the stylesheet and the guard name - and it is taken away again. Computed in both themes on p1
       (the theme's class swapped and put back); on the GM the guard moves the stand-in into Map tools before the next
       task, and the same rule leaves its display alone there - the control that the rule is the player's. The Tokens
       layer through the harness's `ui.controls` (v13's `control` and `activate`, LIVE-E77-11 at a table): another layer
       set, then a new canvas, then a render of the controls; and with Tokens already active, nothing asked. */
    const STAND_IN = `const standIn = () => { const el = document.createElement("div"); el.id = "scene-controls";
            el.innerHTML = '<menu><li><button type="button" class="ui-control"></button></li></menu>';
            (document.getElementById("ui-left") ?? document.getElementById("interface")).append(el); return el; };
        const tick = () => new Promise(r => setTimeout(r, 0));`;
    const p1D = await p1.eval(`${STAND_IN} const body = document.body, el = standIn(), out = {};
        const swap = legacy => { body.classList.toggle("drpg-theme-stained-glass", !legacy); body.classList.toggle("drpg-theme-monokuma-legacy", legacy); };
        const was = [body.classList.contains("drpg-theme-stained-glass"), body.classList.contains("drpg-theme-monokuma-legacy")];
        try {
            out.player = body.classList.contains("drpg-player");
            swap(false); out.stained = getComputedStyle(el).display;
            swap(true); out.legacy = getComputedStyle(el).display;
        } finally { body.classList.toggle("drpg-theme-stained-glass", was[0]); body.classList.toggle("drpg-theme-monokuma-legacy", was[1]); el.remove(); }
        out.frames = document.querySelectorAll(".drpg-foundry-window").length;
        const controls = ui.controls, asked = [], activate = controls.activate;
        controls.activate = function (how) { asked.push(how); return activate.call(this, how); };
        try {
            controls.control = { name: "drawings" };
            game._viewScene(canvas.scene);
            await tick();
            out.canvas = [controls.control?.name ?? null, asked.length];
            await new Promise(r => setTimeout(r, 1100));
            controls.control = { name: "walls" };
            Hooks.callAll("renderSceneControls", controls, document.createElement("div"), {});
            out.render = [controls.control?.name ?? null, asked.length];
            await new Promise(r => setTimeout(r, 1100));
            Hooks.callAll("renderSceneControls", controls, document.createElement("div"), {});
            out.still = asked.length;
            out.asked = asked;
        } finally { controls.activate = activate; controls.control = { name: "tokens" }; }
        return out;`, { timeout: 20000 });
    const gmD = await gm.eval(`${STAND_IN} const frame = id => document.getElementById(id), out = {};
        const [ftools, maptools] = [frame("drpg-win-ftools"), frame("drpg-win-maptools")];
        const bodyOf = f => f?.querySelector(":scope > .drpg-foundry-window-body") ?? null;
        out.closed = [ftools, maptools].map(f => f ? [f.parentElement === document.body, f.hidden, f.hasAttribute("inert")] : null);
        const side = document.getElementById("sidebar");
        out.sidebar = [side?.parentElement === bodyOf(ftools), ui.sidebar.element === side, Boolean(side?.querySelector("#chat")), ui.sidebar.expanded];
        const el = standIn();
        await tick();
        out.rail = [el.parentElement === bodyOf(maptools), getComputedStyle(el).display];
        el.remove();
        return out;`, { timeout: 20000 });
    const p2D = await p2.eval(`return [document.querySelectorAll(".drpg-foundry-window").length, document.body.classList.contains("drpg-player")];`);
    check("D1: a player's scene controls are display: none under Stained Glass and under Monokuma Legacy, and a player has no window of Foundry's",
        p1D.player === true && p1D.stained === "none" && p1D.legacy === "none" && p1D.frames === 0 && J(p2D) === J([0, true]), J({ p1D, p2D }));
    check("D2: p1's layer comes back to Tokens with its select tool after a new canvas and after a render of the controls, and nothing is asked with Tokens active",
        J(p1D.canvas) === J(["tokens", 1]) && J(p1D.render) === J(["tokens", 2]) && p1D.still === 2
            && J(p1D.asked) === J([{ control: "tokens", tool: "select" }, { control: "tokens", tool: "select" }]), J(p1D));
    check("D3: the GM's two windows are body children, closed (hidden and inert); Foundry tools holds Foundry's own #sidebar, chat and all, "
        + "collapsed; a scene rail drawn into the left column is in Map tools before the next task, and the player's rule leaves it shown",
        J(gmD.closed) === J([[true, true, true], [true, true, true]]) && J(gmD.sidebar) === J([true, true, true, false])
            && gmD.rail[0] === true && gmD.rail[1] !== "none", J(gmD));

    /* ------------------------------ E. the corner's upper row (E77 C6) ------------------------------ */
    phase("E: the GM's button and Foundry tools stand in the corner on the GM's page alone, and Foundry tools opens and closes both windows");
    /* Each page as module.mjs's ready sequence left it. The click is a real `click()` on the GM's Foundry tools, which
       runs `toggleFoundryTools` through the button's own listener; the windows are put back closed, as D read them. */
    const gmE = await gm.eval(`const out = {}, ids = ["drpg-gm-launcher", "drpg-foundry-tools"];
        const classed = el => { for (let n = el; n && n !== document.body; n = n.parentElement) if (/drpg-/.test(n.getAttribute("class") ?? "")) return true; return false; };
        out.dom = ids.map(id => document.getElementById(id)).map(el => el ? [el.parentElement === document.body, el.hasAttribute("data-drpg-cluster"), classed(el)] : null);
        const tools = document.getElementById("drpg-foundry-tools");
        const state = () => [["drpg-win-ftools", "drpg-win-maptools"].map(id => document.getElementById(id)?.hidden === false), tools?.getAttribute("aria-pressed") ?? null];
        out.clicks = [state()];
        try {
            tools?.click(); out.clicks.push(state());
            tools?.click(); out.clicks.push(state());
        } finally { game.drpg.toggleFoundryTools?.(false); }
        return out;`, { timeout: 20000 });
    const playersE = await Promise.all([p1, p2].map(page => page.eval(`return ["drpg-gm-launcher", "drpg-foundry-tools"].map(id => Boolean(document.getElementById(id)));`)));
    check("E1: the GM's red button and Foundry tools are children of the body in the cluster, with no drpg- class on them or above them",
        J(gmE.dom) === J([[true, true, false], [true, true, false]]), J(gmE));
    check("E2: a click on Foundry tools opens both windows and says so in aria-pressed, and a second closes both",
        J(gmE.clicks) === J([[[false, false], "false"], [[true, true], "true"], [[false, false], "false"]]), J(gmE));
    check("E3: a player's page has neither the GM's button nor Foundry tools", J(playersE) === J([[false, false], [false, false]]), J(playersE));

    /* ------------------------------ F. the windows' places and Escape (E77 C7) ------------------------------ */
    phase("F: the GM's windows open without a recut, Foundry tools dragged to a place this browser keeps, and Escape a Foundry window's first");
    /* On the GM's page as E left it. F1: both windows opened through Foundry tools' own button with a counter on
       `drpgGlassCut` and a pass of the glass - no cut; THE CONTROL, the clock 40 px taller and a pass, is read beside it
       (jsdom lays nothing out: where that control reads 0 the glass cut nothing here at all, and the check says what it
       could see - `drpgFoundryCut` reads the same in Chromium at the sweep's sizes, R514 at a table). F2: Foundry tools
       dragged by its title with pointer events (MouseEvents of those types where jsdom has no PointerEvent) 40 px right
       and 20 px down: the frame there, and the place in this browser's client storage under `foundryWindows`; no
       player's storage has the key. F3: a DialogV2 drawn as a real window (`__dialogWindows`) and an Escape on the
       body - the windows stay open and the key is not taken; the dialog closed, as Foundry's `core.dismiss` would close
       it, the next Escape closes both and is taken. Put back: windows closed, the setting and `__dialogWindows` as found. */
    const gmF = await gm.eval(`const FW = await import("${repoUrl}/scripts/foundry-windows.mjs"), G = await import("${repoUrl}/scripts/glass.mjs");
        const KEY = "${MOD}.foundryWindows", store = game.settings.storage.get("client"), out = {};
        // Read only where it is registered: on a tree without the setting the checks below say so rather than the eval throwing.
        const registered = game.settings.settings.has(KEY), was = registered ? game.settings.get("${MOD}", "foundryWindows") : null, dialogs = globalThis.__dialogWindows;
        const pause = ms => new Promise(r => setTimeout(r, ms));
        let cuts = 0; const count = () => { cuts++; };
        const hook = Hooks.on("drpgGlassCut", count);
        const frame = FW.foundryWindow("ftools"), head = frame?.querySelector(":scope > header"), row = document.createElement("div");
        const Ev = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
        const fire = (type, x, y) => head?.dispatchEvent(new Ev(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
        const open = () => FW.FOUNDRY_WINDOWS.map(r => FW.foundryWindow(r.key)?.hidden === false);
        const press = () => { const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return [e.defaultPrevented, open()]; };
        let app = null, waiting = null;
        try {
            G.refreshGlass(); await pause(300); cuts = 0;
            document.getElementById("drpg-foundry-tools")?.click();
            G.refreshGlass(); await pause(300);
            out.open = [open(), cuts];
            row.style.height = "40px"; document.getElementById("drpg-hud")?.append(row);
            G.refreshGlass(); await pause(300);
            out.control = cuts - out.open[1];
            row.remove();
            const from = FW.placeFoundryWindow?.("ftools") ?? null;
            fire("pointerdown", 200, 50); fire("pointermove", 220, 60); fire("pointerup", 240, 70);
            const end = Date.now() + 3000;
            while (store.getItem(KEY) === null && Date.now() < end) await pause(50);
            let stored = store.getItem(KEY); try { stored = JSON.parse(stored); } catch { /* the raw string, as found */ }
            out.drag = { from, to: [parseFloat(frame?.style.left), parseFloat(frame?.style.top)], stored };
            globalThis.__dialogWindows = true;
            waiting = foundry.applications.api.DialogV2.wait({ window: { title: "S74 F3" }, content: "<p>S74 F3</p>", buttons: [{ action: "ok", label: "OK" }] });
            await pause(100);
            app = [...foundry.applications.instances.values()].find(a => a.title === "S74 F3") ?? null;
            FW.toggleFoundryTools(true);
            out.escape = [[Boolean(app?.rendered), app?.hasFrame ?? null], press()];
            await app?.close(); await waiting; await pause(50);
            out.escape.push(press());
        } finally {
            row.remove(); Hooks.off("drpgGlassCut", hook);
            if (app?.rendered) await app.close();
            globalThis.__dialogWindows = dialogs;
            FW.toggleFoundryTools(false);
            if (registered) await game.settings.set("${MOD}", "foundryWindows", was);
        }
        return out;`, { timeout: 20000 });
    const playersF = await Promise.all([p1, p2].map(page => page.eval(`return game.settings.storage.get("client").getItem("${MOD}.foundryWindows");`)));
    const glassCut = gmF.control > 0;
    check(`F1: opening both windows fires no drpgGlassCut${glassCut ? "" : " (the control's taller clock cut nothing either: jsdom lays nothing out, so this reads the page's count and not the curtain - drpgFoundryCut in Chromium does)"}`,
        J(gmF.open) === J([[true, true], 0]), J(gmF));
    const want = gmF.drag && { x: gmF.drag.from?.x + 40, y: gmF.drag.from?.y + 20 };
    check("F2: Foundry tools dragged by its title stands 40 px right and 20 px down and that place is in this browser's client storage under foundryWindows; no player's storage has the key",
        Boolean(want) && J(gmF.drag.to) === J([want.x, want.y]) && J(gmF.drag.stored?.ftools ?? null) === J(want) && J(playersF) === J([null, null]), J({ gmF, playersF }));
    check("F3: with a framed DialogV2 rendered Escape leaves both windows open and the key to Foundry; with the dialog closed the next Escape closes both and is taken",
        J(gmF.escape) === J([[true, true], [false, [true, true]], [true, [false, false]]]), J(gmF.escape));

    /* ------------------------------ G. the narrow row (E77 C8) ------------------------------ */
    phase("G: stacked: #drpg-tile-row holds the tile's narrow form; the window opens with text only");
    /* On p1 as B left it: Aiko in Dorm A, the room with words and a picture. The window is opened by a click on the
       row's own button (what a player does) and then once more through `openRoomWindow` (what a second click does):
       the second must answer the first window, not a second one. Read: the window's class, its title, every element
       of the GM's words that a parser would make (none), the words as text, and `__s74ran` (the words' `onerror`). Put
       back: the window closed. */
    const p1G = await p1.eval(`const RT = await import("${repoUrl}/scripts/room-tile.mjs");
        const tile = document.getElementById("drpg-room-tile"), row = document.getElementById("drpg-tile-row");
        const thumb = tile?.querySelector(".drpg-room-tile-thumb img"), words = tile?.querySelector(".drpg-room-tile-describe");
        const pause = ms => new Promise(r => setTimeout(r, ms));
        const out = { stacked: document.body.classList.contains("drpg-stacked"), inRow: Boolean(row && tile?.parentElement === row),
            rowInColumn: row?.parentElement?.id ?? null, state: tile?.dataset.state ?? null,
            thumb: thumb?.getAttribute("src") ?? null, words: Boolean(words), label: words?.getAttribute("aria-label") ?? null };
        // Rendered ones only: an application is in \`instances\` from the start of its first render, and a second open
        // asked before the first has finished is a second window (alreadyOpen counts rendered windows, as for every
        // window of the module's) - a reader that waited for the element alone read that race on 13.10.2026, not the row.
        const find = () => [...foundry.applications.instances.values()].filter(a => a.rendered && a.element?.classList.contains("drpg-window-room"));
        let first = null;
        try {
            words?.click();
            const end = Date.now() + 3000;
            while (!find().length && Date.now() < end) await pause(50);
            first = find()[0] ?? null;
            const again = await RT.openRoomWindow();
            const el = first?.element;
            out.window = { count: find().length, same: again === first, title: first?.title ?? null,
                markup: el ? el.querySelectorAll(".drpg-room-window-body img, .drpg-room-window-body script, .drpg-room-window-body iframe, .drpg-room-window-body b").length : null,
                name: el?.querySelector(".drpg-room-window-name")?.textContent ?? null,
                prose: el?.querySelector(".drpg-room-window-prose")?.textContent ?? null };
        } finally { for (const app of find()) await app.close(); }
        await pause(50);
        out.closed = find().length; out.ran = globalThis.__s74ran ?? null;
        out.describe = game.i18n.localize("DRPG.Room.describe");
        return out;`, { timeout: 15000 });
    check("G1: on a stacked screen p1's tile stands in #drpg-tile-row, a row of #drpg-column, with a thumbnail of the checked path the art layer shows and a 'Description' button",
        p1G.stacked === true && p1G.inRow === true && p1G.rowInColumn === "drpg-column" && p1G.state === "room"
            && p1G.thumb === IMAGES["Dorm A"] && p1G.words === true && p1G.label === p1G.describe, J(p1G));
    check("G2: the button opens one window titled 'Description' with Dorm A's words as text - no element of the markup, nothing run - and a second open is the same window",
        J(p1G.window) === J({ count: 1, same: true, title: p1G.describe, markup: 0, name: "Dorm A", prose: WORDS["Dorm A"] })
            && p1G.closed === 0 && p1G.ran === null, J(p1G));

    /* E77 fix r2-H1 (13.10.2026; review round 2's "known and open"). Two presses before the window has rendered - two
       calls of `openRoomWindow` with no wait between them, as a double click on the button asks - read by the window
       elements on the page and whether both presses answered one application. Until this fix they made two windows. */
    const twiceG = await p1.eval(`const RT = await import("${repoUrl}/scripts/room-tile.mjs");
        const apps = await Promise.all([RT.openRoomWindow(), RT.openRoomWindow()]);
        const out = { windows: document.querySelectorAll(".drpg-window-room").length, same: apps[0] === apps[1] };
        for (const app of new Set(apps)) await app?.close();
        await new Promise(r => setTimeout(r, 50));
        out.left = document.querySelectorAll(".drpg-window-room").length;
        return out;`, { timeout: 15000 });
    check("G3: two presses of the Description button before its window has rendered open one window, not two",
        J(twiceG) === J({ windows: 1, same: true, left: 0 }), J(twiceG));

    /* E77 fix r2-H1 (13.10.2026; review round 2's sec F2, cor F4): THE WINDOW FOLLOWS THE VIEWER. room-tile.mjs
       `refreshRoomTile` draws the open window again with the viewer's new room when the tile is painted, and closes it
       when the room has no words; until this phase nothing read it. Opened by the row's button with Aiko in Dorm A (the
       control: Dorm A's words), then p1 tries the Porch with no action and the free move spent - refused, put back -
       and then takes it with an action; then the GM stands Aiko in the Gym, a room of no words, and back in Dorm A. */
    const WINDOW = `const find = () => [...foundry.applications.instances.values()].filter(a => a.rendered && a.element?.classList.contains("drpg-window-room"));
        const words = () => find()[0]?.element?.querySelector(".drpg-room-window-prose")?.textContent ?? null;`;
    const AIKO_G = `${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), aiko = game.actors.get("${IDS.aiko}"),
        t = academy.tokens.get("TOKAIKO000000000");`;
    const followG = { set: await gm.eval(`${AIKO_G} await game.drpg.setActions(aiko, 0); await aiko.setFlag("${MOD}", "freeMoveUsed", true);
        await new Promise(r => setTimeout(r, 600)); return [M.roomOfToken(t), game.drpg.actionsLeft(aiko)];`, { timeout: 30000 }) };
    followG.open = await p1.eval(`${TILE} ${UNTIL} ${WINDOW} tile()?.querySelector(".drpg-room-tile-describe")?.click();
        await until(() => find().length === 1, 3000); return { windows: find().length, words: words() };`, { timeout: 15000 });
    followG.refused = await p1.eval(`${AIKO_G} ${TILE} ${WINDOW} await t.update({ x: 900, y: 300 }).catch(() => null);
        await new Promise(r => setTimeout(r, 1500));
        return { windows: find().length, words: words(), tile: read()?.name ?? null, token: M.roomOfToken(t) };`, { timeout: 30000 });
    await gm.eval(`${AIKO_G} await game.drpg.setActions(aiko, 1); await new Promise(r => setTimeout(r, 600)); return true;`, { timeout: 30000 });
    followG.porch = await p1.eval(`${AIKO_G} ${TILE} ${UNTIL} ${WINDOW} await t.update({ x: 900, y: 300 });
        await until(() => words() === ${J(WORDS.Porch)}, 5000);
        return { windows: find().length, words: words(), tile: read()?.name ?? null, token: M.roomOfToken(t) };`, { timeout: 30000 });
    const GM_TO = room => gm.eval(`${AIKO_G} await t.update(M.positionIn("${room}", t), ${MOVE}); await new Promise(r => setTimeout(r, 800));
        return M.roomOfToken(t);`, { timeout: 30000 });
    followG.gym = { at: await GM_TO("Gym") };
    Object.assign(followG.gym, await p1.eval(`${TILE} ${UNTIL} ${WINDOW} await until(() => find().length === 0, 5000);
        return { windows: find().length, tile: read()?.name ?? null, state: read()?.state ?? null };`, { timeout: 15000 }));
    followG.home = { at: await GM_TO("Dorm A") };
    Object.assign(followG.home, await p1.eval(`${TILE} ${UNTIL} ${WINDOW} await until(() => read()?.name === "Dorm A", 5000);
        for (const app of find()) await app.close();
        return { windows: find().length, tile: read()?.name ?? null };`, { timeout: 15000 }));
    check("G4: p1's open Description window follows Aiko - Dorm A's words, unchanged by a refused crossing into the Porch, the "
        + "Porch's words once p1 takes her there, and closed when the GM stands her in the Gym, a room of no words",
    J(followG.set) === J(["Dorm A", 0]) && J(followG.open) === J({ windows: 1, words: WORDS["Dorm A"] })
        && J(followG.refused) === J({ windows: 1, words: WORDS["Dorm A"], tile: "Dorm A", token: "Dorm A" })
        && J(followG.porch) === J({ windows: 1, words: WORDS.Porch, tile: "74 Porch", token: "74 Porch" })
        && J(followG.gym) === J({ at: "Gym", windows: 0, tile: "Gym", state: "roomBare" })
        && J(followG.home) === J({ at: "Dorm A", windows: 0, tile: "Dorm A" }),
    J(followG));

    /* ------------------------------ C. the move of a student another browser settles ------------------------------ */
    phase("C: p2's tile follows Botan's routes when p1 settles them; a put-back that never lands ends at the GM's move");
    /* E77 fix r1-G2 (13.10.2026; review round 1 cor F1, O1, O3, cor F3, O2). One browser charges a route - the first
       active player who owns the character, else the primary GM (movement.mjs `settleRoute`) - and until this fix only
       that browser announced it, so the tile of every other owner stayed on the room before the route until something
       unrelated redrew it. Botan is p2's; first p2 alone owns him (the control: p2 settles), then every player does
       (the world's default OWNER, which a table can set only with anonymity's enforcement off - anonymity.mjs
       `onPreUpdateActor` keeps OBSERVER the ceiling while it enforces), then p1 beside p2 - in both p1 settles, as PlayerOne stands
       first in `game.users`. p2 walks Botan from Dorm A into the Porch each time and reads its own tile; then a route
       of p2's whose second crossing is refused for its price, read on p2's tile. p2's page records when each update of
       Botan reaches it, so the gap from the refused step to its put-back is a reading, not a guess. */
    const setC = await gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), botan = game.actors.get("${IDS.botan}");
        const t = academy.tokens.get("TOKBOTAN00000000");
        globalThis.__s74.botan = { ownership: { ...botan.ownership }, actions: game.drpg.actionsLeft(botan), free: botan.getFlag("${MOD}", "freeMoveUsed") ?? null,
            enforced: game.settings.get("${MOD}", "enforceAnonymity") };
        await game.settings.set("${MOD}", "enforceAnonymity", false);
        await t.update(M.positionIn("Dorm A", t), ${MOVE});
        await game.drpg.setActions(botan, 3);
        await new Promise(r => setTimeout(r, 1000));
        return { room: M.roomOfToken(t), actions: game.drpg.actionsLeft(botan) };`, { timeout: 30000 });
    await p2.eval(`${TILE} watch(); globalThis.__s74c = [];
        globalThis.__s74cWritten = (doc, changes, options) => { if (doc.id === "TOKBOTAN00000000") globalThis.__s74c.push([Date.now(), Boolean(options?.drpgRevert)]); };
        Hooks.on("updateToken", globalThis.__s74cWritten); return true;`);
    /* p2 takes Botan across into the Porch and waits up to 5 s for its own tile to name it. */
    const CROSS = `${ACADEMY} ${TILE} ${UNTIL} const botan = game.actors.get("${IDS.botan}"), t = academy.tokens.get("TOKBOTAN00000000");
        take(); const start = Date.now();
        await t.update({ x: 900, y: 300 });
        const followed = await until(() => read()?.name === "74 Porch", 5000);
        return { followed, ms: Date.now() - start, tile: read()?.name ?? null, painted: take(),
            settles: game.users.find(u => !u.isGM && u.active && botan.testUserPermission(u, "OWNER"))?.name ?? null };`;
    const OWN = owners => `${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), botan = game.actors.get("${IDS.botan}");
        const t = academy.tokens.get("TOKBOTAN00000000");
        await botan.update({ ownership: { ...globalThis.__s74.botan.ownership, ...${J(owners)} } });
        await t.update(M.positionIn("Dorm A", t), ${MOVE});
        await new Promise(r => setTimeout(r, 1000));
        return { room: M.roomOfToken(t), actions: game.drpg.actionsLeft(botan), ownership: botan.ownership };`;
    const aloneC = await p2.eval(CROSS, { timeout: 30000 });
    const everyC = { set: await gm.eval(OWN({ default: 3 }), { timeout: 30000 }) };
    everyC.cross = await p2.eval(CROSS, { timeout: 30000 });
    const pairC = { set: await gm.eval(OWN({ default: 0, USERP10000000000: 3 }), { timeout: 30000 }) };
    pairC.cross = await p2.eval(CROSS, { timeout: 30000 });
    const p1C = await p1.eval(`${TILE} return read()?.name ?? null;`);
    /* Until this fix p2's tile stayed on Dorm A in both worlds: the review's probe read it there 4.5 s after the crossing,
       with p2's own `viewerRoom` already answering the Porch (e77-review/correctness-r1.md F1). */
    check("C1: p2's tile follows p2's own crossing of Botan into the Porch - painted once, when p2 settles it alone and when p1 "
        + "settles it as a co-owner - and p1's tile stays on its own Aiko",
    setC.room === "Dorm A" && aloneC.followed && aloneC.settles === "PlayerTwo" && J(aloneC.painted) === J(["74 Porch"])
        && pairC.cross.settles === "PlayerOne" && pairC.cross.followed && J(pairC.cross.painted) === J(["74 Porch"])
        && pairC.set.room === "Dorm A" && p1C === "Dorm A",
    J({ setC, aloneC, pairC, p1C }));
    check("C2: in a world where every player owns every student, p2's tile follows p2's own crossing of Botan that the first "
        + "player, p1, settles - painted once",
    everyC.set.room === "Dorm A" && everyC.cross.settles === "PlayerOne" && everyC.cross.followed && J(everyC.cross.painted) === J(["74 Porch"]),
    J(everyC));

    /* A route of p2's that p1 judges (p1 a co-owner): from the Porch through Dorm A (a step with waypoints pending) into
       the Shed, with one action and no free move - its first crossing paid, its second refused and put back in Dorm A,
       as phase B's. Read on p2: every paint until 2.5 s after the last step, and the gap from that step's update to the
       put-back's, both as they reach p2. The pending step is stood in on p1 too: p1 judges the route, and a step it
       saw with no waypoints pending would be a whole route of its own, charged there. */
    const brokeC = await gm.eval(`const botan = game.actors.get("${IDS.botan}");
        await game.drpg.setActions(botan, 1); await botan.setFlag("${MOD}", "freeMoveUsed", true);
        await new Promise(r => setTimeout(r, 600)); return game.drpg.actionsLeft(botan);`, { timeout: 30000 });
    const PENDING = `${ACADEMY} Object.defineProperty(academy.tokens.get("TOKBOTAN00000000"), "movement",
        { value: { pending: { waypoints: [{ x: 900, y: 600 }] } }, configurable: true }); return true;`;
    await p1.eval(PENDING);
    const viaC = await p2.eval(`${PENDING.replace(" return true;", "")} ${TILE} const t = academy.tokens.get("TOKBOTAN00000000");
        try { await t.update({ x: 600, y: 400 }); await new Promise(r => setTimeout(r, 800)); } finally { delete t.movement; }
        return { tile: read()?.name ?? null, painted: take() };`, { timeout: 30000 });
    await p1.eval(`${ACADEMY} delete academy.tokens.get("TOKBOTAN00000000").movement; return true;`);
    const refusedC = await p2.eval(`${ACADEMY} ${TILE} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKBOTAN00000000");
        globalThis.__s74c.length = 0;
        t.update({ x: 900, y: 600 }).catch(() => null);
        await new Promise(r => setTimeout(r, 2500));
        const seen = globalThis.__s74c.splice(0), last = seen.find(([, revert]) => !revert), back = seen.find(([, revert]) => revert);
        return { painted: take(), tile: read()?.name ?? null, token: M.roomOfToken(t), putBackMs: last && back ? back[0] - last[0] : null };`,
    { timeout: 30000 });
    check("C3: a route of p2's that p1 judges and refuses at its second crossing paints nothing of the refused Shed on p2's tile, "
        + "and the tile ends in Dorm A, where the put-back stands Botan",
    brokeC === 1 && viaC.tile === "74 Porch" && J(viaC.painted) === "[]" && shedFree(refusedC)
        && J(refusedC.painted) === J(["Dorm A"]) && refusedC.tile === "Dorm A" && refusedC.token === "Dorm A" && refusedC.putBackMs !== null,
    J({ brokeC, viaC, refusedC }));

    /* Every update of the token starts p2's wait again (movement.mjs `restartQuiet`): p2 takes Botan into the Porch and,
       a second later - before that route is quiet - drags him on into the Shed, a step with waypoints pending (stood in
       on p1 and p2) and, a second after it, the drag's last. Were the wait not started again, the first route would be
       announced 1.5 s after its update, with Botan standing on the drag's pending step, and the tile would draw a room
       the drag was still passing. */
    const draggedC = await gm.eval(`const botan = game.actors.get("${IDS.botan}");
        await game.drpg.setActions(botan, 3); await new Promise(r => setTimeout(r, 600)); return game.drpg.actionsLeft(botan);`, { timeout: 30000 });
    const intoC = await p2.eval(`${ACADEMY} ${TILE} const t = academy.tokens.get("TOKBOTAN00000000"); take();
        await t.update({ x: 900, y: 300 }); await new Promise(r => setTimeout(r, 1000));
        return { tile: read()?.name ?? null, painted: take() };`, { timeout: 30000 });
    await p1.eval(PENDING);
    const midC = await p2.eval(`${PENDING.replace(" return true;", "")} ${TILE} const t = academy.tokens.get("TOKBOTAN00000000");
        try { await t.update({ x: 900, y: 600 }); await new Promise(r => setTimeout(r, 1000)); } finally { delete t.movement; }
        return { tile: read()?.name ?? null, painted: take() };`, { timeout: 30000 });
    await p1.eval(`${ACADEMY} delete academy.tokens.get("TOKBOTAN00000000").movement; return true;`);
    const lastC = await p2.eval(`${ACADEMY} ${TILE} ${UNTIL} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKBOTAN00000000");
        await t.update({ x: 920, y: 640 });
        const followed = await until(() => read()?.name === "74 Shed", 5000);
        return { followed, tile: read()?.name ?? null, painted: take(), token: M.roomOfToken(t) };`, { timeout: 30000 });
    check("C4: a drag p2 starts before its last route is quiet keeps p2's tile on Dorm A through the drag's pending step, and "
        + "the tile is painted once, in the Shed, when the drag is",
    draggedC === 3 && intoC.tile === "Dorm A" && J(intoC.painted) === "[]" && midC.tile === "Dorm A" && J(midC.painted) === "[]"
        && lastC.followed && J(lastC.painted) === J(["74 Shed"]) && lastC.token === "74 Shed",
    J({ draggedC, intoC, midC, lastC }));

    /* A put-back that never lands, on p1, for Aiko: p1's own write of it is dropped (a put-back the GM's bridge refuses
       leaves the same state - the bridge itself is not driven here), so p1's tile keeps the room before the route, the
       Porch. Then the GM stands Aiko in the Hall, a GM's move. Until this fix the GM's move was announced and p1's
       tile kept the Porch, a room Aiko was not in, until p1's next judged move (cor F3, O2). */
    const stuckC = await gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), aiko = game.actors.get("${IDS.aiko}");
        const t = academy.tokens.get("TOKAIKO000000000");
        await t.update(M.positionIn("74 Porch", t), ${MOVE});
        await game.drpg.setActions(aiko, 1); await aiko.setFlag("${MOD}", "freeMoveUsed", true);
        await new Promise(r => setTimeout(r, 800)); return M.roomOfToken(t);`, { timeout: 30000 });
    const LOSE = `${ACADEMY} ${TILE} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKAIKO000000000");
        t.update = function (data, options) { return options?.[M.REVERT] ? Promise.resolve(this) : Object.getPrototypeOf(this).update.call(this, data, options); };
        try {
            Object.defineProperty(t, "movement", { value: { pending: { waypoints: [{ x: 900, y: 600 }] } }, configurable: true });
            try { await t.update({ x: 600, y: 400 }); await new Promise(r => setTimeout(r, 800)); } finally { delete t.movement; }
            t.update({ x: 900, y: 600 }).catch(() => null);
            await new Promise(r => setTimeout(r, 1500));
        } finally { delete t.update; }
        return { tile: read()?.name ?? null, token: M.roomOfToken(t), own: !Object.hasOwn(t, "update") };`;
    const lostC = await p1.eval(LOSE, { timeout: 30000 });
    await gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKAIKO000000000");
        await t.update(M.positionIn("Hall", t), ${MOVE}); await new Promise(r => setTimeout(r, 1000)); return true;`, { timeout: 30000 });
    const movedC = await p1.eval(`${ACADEMY} ${TILE} const M = await import("${repoUrl}/scripts/movement.mjs"), T = await import("${repoUrl}/scripts/room-tile.mjs");
        return { tile: read()?.name ?? null, viewer: T.viewerRoom().room, token: M.roomOfToken(academy.tokens.get("TOKAIKO000000000")) };`);
    check("C5: a put-back that never lands leaves p1's tile on the room before the route, and the GM's next move of Aiko, into the "
        + "Hall, moves p1's tile there",
    stuckC === "74 Porch" && lostC.own && lostC.token === "74 Shed" && lostC.tile === "74 Porch"
        && movedC.token === "Hall" && movedC.viewer === "Hall" && movedC.tile === "Hall",
    J({ stuckC, lostC, movedC }));

    /* E77 fix r2-H1 (13.10.2026; fix r1-G2's own note): the same put-back that never lands, ended this time by p1's own
       next move, with an action the GM gives - which clears the mark the lost put-back left (movement.mjs `judgeMove`,
       where a route is marked). Until this check no scenario drove that road: fix r1-G2 read only the GM's move (C5).
       The move stays inside the Shed Aiko stands in: this browser's record has her where the lost put-back would have
       stood her, Dorm A, so the move is judged - and paid - as a crossing from there, and a move into Dorm A itself
       would be no crossing and read the same with the mark kept or cleared (a mutant that keeps it read C6 green on
       13.10.2026 when C6 moved her into Dorm A). */
    const stuck2C = await gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), aiko = game.actors.get("${IDS.aiko}");
        const t = academy.tokens.get("TOKAIKO000000000");
        await t.update(M.positionIn("74 Porch", t), ${MOVE});
        await game.drpg.setActions(aiko, 1); await aiko.setFlag("${MOD}", "freeMoveUsed", true);
        await new Promise(r => setTimeout(r, 800)); return M.roomOfToken(t);`, { timeout: 30000 });
    const lost2C = await p1.eval(LOSE, { timeout: 30000 });
    await gm.eval(`const aiko = game.actors.get("${IDS.aiko}"); await game.drpg.setActions(aiko, 1); await new Promise(r => setTimeout(r, 600)); return true;`,
        { timeout: 30000 });
    const ownC = await p1.eval(`${ACADEMY} ${TILE} ${UNTIL} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKAIKO000000000");
        await t.update({ x: 920, y: 640 });
        await until(() => read()?.name === "74 Shed", 5000);
        return { tile: read()?.name ?? null, token: M.roomOfToken(t) };`, { timeout: 30000 });
    check("C6: a put-back that never lands, then p1's own next move of Aiko, inside the Shed she stands in, moves p1's tile from the Porch to the Shed",
        stuck2C === "74 Porch" && lost2C.own && lost2C.token === "74 Shed" && lost2C.tile === "74 Porch"
            && ownC.token === "74 Shed" && ownC.tile === "74 Shed",
    J({ stuck2C, lost2C, ownC }));

    /* ------------------------------ H. the states that are no gate ------------------------------ */
    phase("H: an Eclipse, a death, a Monocub, a Class Trial and a room on another floor, each on the viewer's own tile");
    /* E77 fix r1-G3 (13.10.2026; review round 1 cor F5, sec F3, O5, goal 5). room-tile.mjs `viewerRoom` gates a Class
       Trial, no viewer and no room, and nothing else, by design (the A8 design's step 2, P2-0): in an Eclipse the
       character still stands where they stand, a body lies in its room, a Monocub walks with its token, and the room is
       the one on the token's own floor and scene, never the camera's. Until this phase nothing read any of them on a
       screen - R504 paints the tile's own states on loose boxes and reads viewerRoom only as the suite's world stands - and R504's
       comment said this scenario did. Each reading below is p1's tile (or p4's) beside its own `viewerRoom()`, after a
       positive control on the same tile, and a paint is counted as in A. Aiko is put back in Dorm A by the GM first. */
    const VIEW = `${TILE} ${UNTIL} const T = await import("${repoUrl}/scripts/room-tile.mjs");
        const seen = async (test, ms = 5000) => { await until(test, ms); const s = read(), v = T.viewerRoom();
            return { state: s?.state ?? null, name: s?.name ?? null, view: [v.state, v.room], painted: take() }; };`;
    const AIKO = `${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), aiko = game.actors.get("${IDS.aiko}"),
        t = academy.tokens.get("TOKAIKO000000000");`;
    const SLEEP = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
    const setH = await gm.eval(`${AIKO} globalThis.__s74.clock = foundry.utils.deepClone(game.drpg.getClock());
        await t.update(M.positionIn("Dorm A", t), ${MOVE}); ${SLEEP(1000)} return M.roomOfToken(t);`, { timeout: 30000 });
    await p1.eval(`${TILE} return watch();`);
    /* The Eclipse, started and ended by the GM's own call (eclipse.mjs `startEclipse`, `endEclipse`); inside it p1 takes
       Aiko from Dorm A into the Porch, the crossing B paid for, now judged as an Eclipse crossing through the GM. */
    const eclipseH = { set: setH, home: await p1.eval(`${VIEW} return seen(() => read()?.name === "Dorm A");`) };
    eclipseH.start = await gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        const started = Boolean(await E.startEclipse()); ${SLEEP(1200)} return [started, E.isEclipse()];`, { timeout: 30000 });
    eclipseH.during = await p1.eval(`${VIEW} return seen(() => false, 0);`);
    eclipseH.cross = await p1.eval(`${AIKO} ${VIEW} await t.update({ x: 900, y: 300 });
        return { ...await seen(() => read()?.name === "74 Porch"), token: M.roomOfToken(t) };`, { timeout: 30000 });
    eclipseH.end = await gm.eval(`const E = await import("${repoUrl}/scripts/eclipse.mjs");
        await E.endEclipse({ advance: false }); ${SLEEP(1000)} return E.isEclipse();`, { timeout: 30000 });
    check("H1: in an Eclipse p1's tile keeps Aiko's own Dorm A, unpainted, and follows her Eclipse crossing into the Porch, painted once",
        eclipseH.set === "Dorm A" && J(eclipseH.home.view) === J(["room", "Dorm A"]) && eclipseH.home.name === "Dorm A"
        && J(eclipseH.start) === J([true, true]) && eclipseH.during.state === "room" && eclipseH.during.name === "Dorm A"
        && J(eclipseH.during.view) === J(["room", "Dorm A"]) && J(eclipseH.during.painted) === "[]"
        && eclipseH.cross.token === "74 Porch" && eclipseH.cross.name === "74 Porch" && J(eclipseH.cross.view) === J(["room", "74 Porch"])
        && J(eclipseH.cross.painted) === J(["74 Porch"]) && eclipseH.end === false,
    J(eclipseH));

    /* Aiko marked dead where she stands (chapter.mjs `markDeceased`), then made a Monocub (monocub.mjs `setMonocub`, which
       asks for the dead) with actions to walk on, and p1 takes her back into Dorm A; then alive again. */
    const deadH = { set: await gm.eval(`${AIKO} const C = await import("${repoUrl}/scripts/chapter.mjs");
        await C.markDeceased(aiko); ${SLEEP(1200)} return [game.drpg.isDeadForGm(aiko), M.roomOfToken(t)];`, { timeout: 30000 }) };
    deadH.body = await p1.eval(`${VIEW} return seen(() => false, 0);`);
    deadH.cub = await gm.eval(`${AIKO} const Mc = await import("${repoUrl}/scripts/monocub.mjs");
        const made = Boolean(await Mc.setMonocub(aiko, true)); await game.drpg.setActions(aiko, 3); ${SLEEP(1200)} return [made, Mc.isMonocub(aiko)];`,
    { timeout: 30000 });
    deadH.cubTile = await p1.eval(`${VIEW} return seen(() => false, 0);`);
    deadH.cross = await p1.eval(`${AIKO} ${VIEW} await t.update(M.positionIn("Dorm A", t));
        return { ...await seen(() => read()?.name === "Dorm A"), token: M.roomOfToken(t) };`, { timeout: 30000 });
    deadH.back = await gm.eval(`${AIKO} const C = await import("${repoUrl}/scripts/chapter.mjs"), Mc = await import("${repoUrl}/scripts/monocub.mjs");
        await Mc.setMonocub(aiko, false); await C.reviveCharacter(aiko, { quiet: true }); ${SLEEP(800)}
        return [game.drpg.isDeadForGm(aiko), Mc.isMonocub(aiko)];`, { timeout: 30000 });
    check("H2: dead, p1's tile keeps the Porch her body lies in, unpainted; a Monocub, the same, and it follows her walk into Dorm A, "
        + "painted once",
    J(deadH.set) === J([true, "74 Porch"]) && deadH.body.state === "room" && deadH.body.name === "74 Porch"
        && J(deadH.body.view) === J(["room", "74 Porch"]) && J(deadH.body.painted) === "[]"
        && J(deadH.cub) === J([true, true]) && deadH.cubTile.name === "74 Porch" && J(deadH.cubTile.view) === J(["room", "74 Porch"])
        && J(deadH.cubTile.painted) === "[]" && deadH.cross.token === "Dorm A" && deadH.cross.name === "Dorm A"
        && J(deadH.cross.view) === J(["room", "Dorm A"]) && J(deadH.cross.painted) === J(["Dorm A"]) && J(deadH.back) === J([false, false]),
    J(deadH));

    /* A Class Trial opened as 01-runtests and 10 open one (`setClock({ phase: "classTrial" })`; no hall is linked in this
       world, so nobody's token moves), read on all three tiles beside the room `locateActor` still finds for each viewer;
       then the clock as it was before this phase. */
    const trialH = { set: await gm.eval(`await game.drpg.setClock({ phase: "classTrial" }); ${SLEEP(1200)} return game.drpg.getClock().phase;`,
        { timeout: 30000 }) };
    const TRIAL = `${VIEW} const H = await import("${repoUrl}/scripts/hud.mjs"), M = await import("${repoUrl}/scripts/movement.mjs");
        return { ...await seen(() => read()?.state === "trial"), located: M.locateActor(H.viewerActor())?.room ?? null };`;
    for (const [who, c] of [["p1", p1], ["p2", p2], ["gm", gm]]) trialH[who] = await c.eval(TRIAL);
    trialH.end = await gm.eval(`await game.drpg.setClock(globalThis.__s74.clock); ${SLEEP(1200)} return game.drpg.getClock().phase;`, { timeout: 30000 });
    trialH.after = await p1.eval(`${VIEW} return seen(() => read()?.name === "Dorm A");`);
    check("H3: in a Class Trial every tile - p1's, p2's and the GM's - is the trial's, painted once, though each viewer still stands in a "
        + "school room; after it p1's tile is Dorm A again",
    trialH.set === "classTrial" && ["p1", "p2", "gm"].every(who => trialH[who].state === "trial" && J(trialH[who].view) === J(["trial", null]))
        && J(["p1", "p2", "gm"].map(who => trialH[who].located)) === J(["Dorm A", "74 Shed", "Hall"])
        && J(trialH.p1.painted) === J([null]) && trialH.end !== "classTrial"
        && trialH.after.name === "Dorm A" && J(trialH.after.view) === J(["room", "Dorm A"]) && J(trialH.after.painted) === J(["Dorm A"]),
    J(trialH));

    /* p4 gets a character of its own, S74 Daku, whose only token stands on a scene of two floors built here: a Lab on the
       ground floor and an Attic above it, drawn over the same ground. p4 looks at that scene, then the GM lifts Daku to the
       upper floor (a GM's move, which p4 as the owner follows - fix r1-G2), and p4 looks back at the Academy. */
    const L1 = "LEVELS74GROUND00", L2 = "LEVELS74UPPER000";
    const levelsH = { set: await gm.eval(`const V = await import("${repoUrl}/scripts/vault.mjs"), M = await import("${repoUrl}/scripts/movement.mjs");
        const tower = await Scene.create({ name: "74 Tower", width: 2000, height: 1500, grid: { size: 100 }, active: false,
            levels: [{ id: "${L1}", name: "Ground", elevation: 0 }, { id: "${L2}", name: "Upper", elevation: 10 }] });
        globalThis.__s74.tower = tower.id;
        const room = (name, level) => ({ name, shapes: ${rect(200, 200, 600, 600)}, levels: [level], behaviors: [],
            flags: { "${MOD}": { room: true, [V.VAULT_FLAGS.description]: "S" + name + " words" } } });
        await tower.createEmbeddedDocuments("Region", [room("74 Lab", "${L1}"), room("74 Attic", "${L2}")]);
        const daku = await Actor.create({ name: "S74 Daku", type: "character", ownership: { default: 0, USERP4000000000A: 3 } });
        globalThis.__s74.daku = daku.id;
        const [t] = await tower.createEmbeddedDocuments("Token", [{ name: "Daku", actorId: daku.id, actorLink: true, x: 400, y: 400, width: 1, height: 1,
            hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1, level: "${L1}" }]);
        globalThis.__s74.dakuToken = t.id; ${SLEEP(1000)}
        return [M.roomOfToken(t), t.level];`, { timeout: 30000 }) };
    const TOWER = `const tower = game.scenes.find(s => s.name === "74 Tower");`;
    levelsH.ground = await p4.eval(`${VIEW} ${TOWER} const before = read()?.state ?? null; watch(); await tower.view();
        return { before, ...await seen(() => read()?.name === "74 Lab"), canvas: [canvas.scene?.id === tower.id, canvas.level?.id ?? null] };`,
    { timeout: 30000 });
    levelsH.lift = await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs"), t = game.scenes.get(globalThis.__s74.tower).tokens.get(globalThis.__s74.dakuToken);
        await t.update({ level: "${L2}" }, ${MOVE}); ${SLEEP(1000)} return [M.roomOfToken(t), t.level];`, { timeout: 30000 });
    levelsH.upper = await p4.eval(`${VIEW} ${TOWER} return { ...await seen(() => read()?.name === "74 Attic"),
        canvas: [canvas.scene?.id === tower.id, canvas.level?.id ?? null] };`, { timeout: 30000 });
    levelsH.away = await p4.eval(`${VIEW} ${TOWER} await game.scenes.get("${IDS.scene}").view(); ${SLEEP(800)}
        return { ...await seen(() => false, 0), canvas: canvas.scene?.id === tower.id };`, { timeout: 30000 });
    check("H4: p4's tile names the room on its character's own floor - the Lab, then the Attic above it once the GM lifts Daku, while "
        + "p4's canvas stays on the ground floor - and keeps the Attic when p4 looks at another scene",
    J(levelsH.set) === J(["74 Lab", L1]) && levelsH.ground.before === "noActor" && J(levelsH.ground.canvas) === J([true, L1])
        && levelsH.ground.name === "74 Lab" && J(levelsH.ground.view) === J(["room", "74 Lab"]) && J(levelsH.ground.painted) === J(["74 Lab"])
        && J(levelsH.lift) === J(["74 Attic", L2]) && J(levelsH.upper.canvas) === J([true, L1]) && levelsH.upper.name === "74 Attic"
        && J(levelsH.upper.view) === J(["room", "74 Attic"]) && J(levelsH.upper.painted) === J(["74 Attic"])
        && levelsH.away.canvas === false && levelsH.away.name === "74 Attic" && J(levelsH.away.view) === J(["room", "74 Attic"])
        && J(levelsH.away.painted) === "[]",
    J(levelsH));

    /* ------------------------------ I. a stored picture that cannot be read ------------------------------ */
    phase("I: a picture path that cannot be read again is no picture - Room Setup opens, the tile follows, setVaultRoom warns");
    /* E77 fix r2-H1 (13.10.2026; review round 2's sec F1, the reviewer's probe 97 kept as a phase). safeRoomImage read its
       answer again with `new URL` outside its try, and a path of this origin whose empty first segment is followed by
       no host - here a port out of range - threw there: the tile stayed on the room before, Room Setup did not open on
       the scene, setVaultRoom threw instead of warning. The value is written on the Cafeteria's regions with
       `region.update`, past setVaultRoom, as an import, another module or a console would. THE CONTROL first: p1's tile
       follows the GM's moves of Aiko into the Cafeteria and back while its picture is the module's own. */
    const GO = room => gm.eval(`${ACADEMY} const M = await import("${repoUrl}/scripts/movement.mjs"), t = academy.tokens.get("TOKAIKO000000000");
        await t.update(M.positionIn("${room}", t), ${MOVE}); return M.roomOfToken(t);`, { timeout: 30000 });
    const FOLLOW = room => p1.eval(`${TILE} ${UNTIL} await until(() => read()?.name === "${room}", 6000);
        const s = read(); return { name: s?.name ?? null, state: s?.state ?? null, art: s?.art ?? null };`, { timeout: 30000 });
    const controlI = { into: await GO("Cafeteria") };
    controlI.tile = await FOLLOW("Cafeteria");
    controlI.back = await GO("Dorm A");
    controlI.home = await FOLLOW("Dorm A");
    check("I1: the control - p1's tile follows the GM's moves of Aiko into the Cafeteria, its picture on the art layer, and back into Dorm A",
        controlI.into === "Cafeteria" && J(controlI.tile) === J({ name: "Cafeteria", state: "roomPicture", art: `url("${IMAGES.Cafeteria}")` })
            && controlI.back === "Dorm A" && controlI.home.name === "Dorm A",
    J(controlI));
    const READ = `const V = await import("${repoUrl}/scripts/vault.mjs"), academy = game.scenes.get("${IDS.scene}");
        let image; try { image = V.roomImage("Cafeteria", academy); } catch (err) { image = "throws " + err?.name; }`;
    const storedI = await gm.eval(`${ACADEMY} const V = await import("${repoUrl}/scripts/vault.mjs");
        const BAD = new URL(document.baseURI).origin + "//a:99999/x.png", key = "flags.${MOD}." + V.VAULT_FLAGS.image;
        const pieces = [...academy.regions.values()].filter(r => r.name === "Cafeteria");
        for (const r of pieces) await r.update({ [key]: BAD });
        await new Promise(r => setTimeout(r, 800));
        const out = { pieces: pieces.length, stored: pieces.map(r => r.getFlag("${MOD}", V.VAULT_FLAGS.image) === BAD) };
        let seen = null;
        globalThis.__dialogAnswers.push(async config => {
            const form = document.createElement("form");
            if (typeof config.content === "string") form.innerHTML = config.content; else if (config.content) form.append(config.content.cloneNode(true));
            const img = form.querySelector('img.drpg-room-picture[data-drpg-portrait="Cafeteria"]');
            seen = { img: Boolean(img), src: img?.getAttribute("src") ?? null, field: form.querySelector('[name="img:Cafeteria"]')?.value ?? null };
            return null;
        });
        try { await V.openRoomSetupDialog(); out.setup = "opened"; } catch (err) { out.setup = "throws " + err?.name; }
        finally { globalThis.__dialogAnswers.length = 0; }
        out.seen = seen;
        const warned = [], own = Object.getOwnPropertyDescriptor(ui.notifications, "warn");
        ui.notifications.warn = message => { warned.push(String(message)); };
        try { const wrote = await V.setVaultRoom("Gym", { image: BAD, scene: academy }); out.gym = wrote === null ? null : "wrote"; }
        catch (err) { out.gym = "throws " + err?.name; }
        finally { if (own) Object.defineProperty(ui.notifications, "warn", own); else delete ui.notifications.warn; }
        out.warned = warned; out.refused = game.i18n.format("DRPG.Vault.imageRefused", { room: "Gym" });
        return out;`, { timeout: 30000 });
    const imageI = { gm: await gm.eval(`${READ} return image;`), p1: await p1.eval(`${READ} return image;`) };
    const intoI = { at: await GO("Cafeteria") };
    intoI.tile = await FOLLOW("Cafeteria");
    check("I2: with a path of that class stored on the Cafeteria, roomImage answers no picture on the GM and on p1, and Room Setup "
        + "opens on the scene and draws the Cafeteria with no picture",
    storedI.pieces > 0 && storedI.stored.every(Boolean) && imageI.gm === null && imageI.p1 === null
        && storedI.setup === "opened" && J(storedI.seen) === J({ img: true, src: null, field: "" }),
    J({ storedI, imageI }));
    check("I3: p1's tile follows Aiko into that Cafeteria, drawn as a room of no picture",
        intoI.at === "Cafeteria" && J(intoI.tile) === J({ name: "Cafeteria", state: "roomBare", art: "" }), J(intoI));
    check("I4: setVaultRoom handed the same path writes nothing and warns that the picture was not saved",
        storedI.gym === null && J(storedI.warned) === J([storedI.refused]), J(storedI));

    /* ------------------------------ K. The Forge's Assets Library ------------------------------ */
    phase("K: on The Forge a picture of its Assets Library is kept by Room Setup and setVaultRoom and drawn on p1's tile; off it, refused");
    /* E78 fix h76-HF1 (14.10.2026; the owner's report on 1.2.76 at a table on The Forge: every picture Room Setup was given
       was refused, whatever its format). `ForgeVTT` is a stand-in `{ usingTheForge: true, ASSETS_LIBRARY_URL_PREFIX }` put on
       the GM's and p1's pages and taken off again (no Forge page here: what The Forge's own object holds is a LIVE-E78 row).
       With it: Room Setup's Apply, answered as in A, gives the Cafeteria - where phase I left Aiko, over its unreadable path - a
       Library picture: stored on every piece, no warning, p1's tile draws it. setVaultRoom gives it a second, stored and
       drawn, and refuses another host and `http:` to the Library with the warning, the second kept. With the stand-in taken
       off: roomImage reads no picture on the GM and on p1, and setVaultRoom refuses the first again with the warning, the
       second still stored. jsdom fetches no picture, so what The Forge's server answers is the table's. */
    const LIBK = "https://assets.forge-vtt.com/s74user/rooms/";
    const FORGEK = { first: `${LIBK}cafeteria.png`, second: `${LIBK}Cafeteria%202.webp` };
    const STUBK = on => (on ? `globalThis.ForgeVTT = { usingTheForge: true, ASSETS_LIBRARY_URL_PREFIX: "https://assets.forge-vtt.com/" }; return true;`
        : "delete globalThis.ForgeVTT; return true;");
    const VAULTK = `${ACADEMY} const V = await import("${repoUrl}/scripts/vault.mjs");
        const stored = () => [...academy.regions.values()].filter(r => r.name === "Cafeteria").map(r => r.getFlag("${MOD}", V.VAULT_FLAGS.image));
        const warned = [], own = Object.getOwnPropertyDescriptor(ui.notifications, "warn");
        ui.notifications.warn = message => { warned.push(String(message)); };
        const back = () => { if (own) Object.defineProperty(ui.notifications, "warn", own); else delete ui.notifications.warn; };
        const refused = game.i18n.format("DRPG.Vault.imageRefused", { room: "Cafeteria" });`;
    const ARTK = path => p1.eval(`${TILE} ${UNTIL} await until(() => read()?.art === ${J(`url("${path}")`)}, 6000);
        const s = read(); return { name: s?.name ?? null, state: s?.state ?? null, art: s?.art ?? null };`, { timeout: 30000 });
    const stubK = [await gm.eval(STUBK(true)), await p1.eval(STUBK(true))];
    const applyK = await gm.eval(`${VAULTK}
        globalThis.__dialogAnswers.push(async config => {
            const ok = (config.buttons ?? []).find(b => b.action === "ok");
            const element = document.createElement("dialog"), form = document.createElement("form");
            if (typeof config.content === "string") form.innerHTML = config.content; else if (config.content) form.append(config.content.cloneNode(true));
            element.append(form);
            const picture = form.querySelector('[name="img:Cafeteria"]');
            if (picture) picture.value = "${FORGEK.first}";
            return ok.callback(new globalThis.window.Event("click"), { form }, { element });
        });
        let changed = null;
        try { changed = await V.openRoomSetupDialog(); } finally { globalThis.__dialogAnswers.length = 0; back(); }
        await new Promise(r => setTimeout(r, 1200));
        return { changed: changed ?? null, stored: stored(), warned };`, { timeout: 30000 });
    const tileK1 = await ARTK(FORGEK.first);
    check("K1: on The Forge, Room Setup's Apply gives the Cafeteria a picture of the Assets Library - stored on every piece, no warning - and p1's "
        + "tile draws it", J(stubK) === J([true, true]) && applyK.stored.length > 0 && applyK.stored.every(path => path === FORGEK.first)
        && J(applyK.warned) === "[]" && J(tileK1) === J({ name: "Cafeteria", state: "roomPicture", art: `url("${FORGEK.first}")` }),
    J({ stubK, applyK, tileK1 }));
    const apiK = await gm.eval(`${VAULTK} const out = {};
        try {
            out.second = (await V.setVaultRoom("Cafeteria", { image: "${FORGEK.second}", scene: academy })) ? "wrote" : null;
            out.afterSecond = stored();
            out.host = (await V.setVaultRoom("Cafeteria", { image: "https://evil.example/s74user/rooms/x.png", scene: academy })) ? "wrote" : null;
            out.http = (await V.setVaultRoom("Cafeteria", { image: "http://assets.forge-vtt.com/s74user/rooms/x.png", scene: academy })) ? "wrote" : null;
            out.stored = stored();
        } finally { back(); }
        return { ...out, warned: warned.map(m => m === refused) };`, { timeout: 30000 });
    const tileK2 = await ARTK(FORGEK.second);
    const offStubK = [await gm.eval(STUBK(false)), await p1.eval(STUBK(false))];
    const offK = { gm: await gm.eval(`${READ} return image;`), p1: await p1.eval(`${READ} return image;`) };
    offK.api = await gm.eval(`${VAULTK} let wrote = null;
        try { wrote = (await V.setVaultRoom("Cafeteria", { image: "${FORGEK.first}", scene: academy })) ? "wrote" : null; } finally { back(); }
        return { wrote, stored: stored(), warned: warned.map(m => m === refused) };`, { timeout: 30000 });
    const secondK = path => path === FORGEK.second;
    check("K2: setVaultRoom keeps a second Library picture and p1's tile follows it; another host and http: to the Library are refused with the "
        + "warning and the second kept; with the stand-in off, roomImage reads none on the GM and on p1 and setVaultRoom refuses the Library again",
    apiK.second === "wrote" && apiK.afterSecond.length > 0 && apiK.afterSecond.every(secondK) && apiK.host === null && apiK.http === null
        && apiK.stored.every(secondK) && J(apiK.warned) === J([true, true])
        && J(tileK2) === J({ name: "Cafeteria", state: "roomPicture", art: `url("${FORGEK.second}")` })
        && J(offStubK) === J([true, true]) && offK.gm === null && offK.p1 === null
        && offK.api.wrote === null && offK.api.stored.every(secondK) && J(offK.api.warned) === J([true]),
    J({ apiK, tileK2, offK }));

    /* ------------------------------ J. the world switch off ------------------------------ */
    phase("J: the world switch off - a GM's page that loads then keeps Foundry's rails where Foundry puts them, with no Foundry tools");
    /* E77 fix r2-H2 (13.10.2026; review round 2's goal AM2a, the owner's amend of 11.10: one switch as the emergency way
       back at the table). Read on a page: the body class, the two frames, the launcher, the red GM button, where
       `#sidebar` stands, where a stand-in `#scene-controls` put in the left column stands a task later (the guard would
       have moved it), and whether `ui.sidebar` was wrapped. The harness's page draws `#sidebar` as a child of the body,
       outside `#interface` (client-entry.mjs; Foundry draws it in `#ui-right`), so that is where it stays. The control first: the GM's page as it booted. Then the
       switch is written off on that running page and gm2 connects - its page loads with the switch off. The setting
       asks for a reload, so the GM's running page keeps its windows (the module reads the switch once, at ready). gm2
       leaves and the switch goes back on. Whether the curtain is cut around the rails then is the glass harness's
       `?windows=off`, in Chromium (no layout here). */
    const RAILS = `${STAND_IN} const el = standIn(); await tick(); const side = document.getElementById("sidebar");
        const where = node => !node ? null : node.closest(".drpg-foundry-window") ? "window" : node.closest("#interface") ? "interface"
            : node.parentElement === document.body ? "body" : "elsewhere";
        const out = { cls: document.body.classList.contains("drpg-foundry-windows"),
            frames: ["drpg-win-ftools", "drpg-win-maptools"].filter(id => document.getElementById(id)).length,
            launcher: Boolean(document.getElementById("drpg-foundry-tools")), gmButton: Boolean(document.getElementById("drpg-gm-launcher")),
            sidebar: where(side), controls: where(el), wrapped: Boolean(ui.sidebar?.drpgWindowed) };
        el.remove(); return out;`;
    const onJ = await gm.eval(RAILS);
    check("J1: the control - with the switch on, the GM's page holds both windows with #sidebar and the scene controls in them, the launcher and a wrapped sidebar",
        J(onJ) === J({ cls: true, frames: 2, launcher: true, gmButton: true, sidebar: "window", controls: "window", wrapped: true }), J(onJ));
    const SWITCH = value => `try { await game.settings.set("${MOD}", "foundryToolWindows", ${value}); return game.settings.get("${MOD}", "foundryToolWindows"); }
        catch (err) { return "no switch: " + err.message; }`;
    const offJ = await gm.eval(SWITCH(false));
    await connect("gm2");
    await settle(800);
    const gm2J = await gm2.eval(RAILS);
    const keptJ = await gm.eval(RAILS);
    await disconnect("gm2");
    const backJ = await gm.eval(SWITCH(true));
    check("J2: with the switch off, a GM's page that loads has no windows, no launcher and no wrapped sidebar, #sidebar stays where the page drew it "
        + "and the scene controls in #interface, and the red GM button stays", offJ === false
        && J(gm2J) === J({ cls: false, frames: 0, launcher: false, gmButton: true, sidebar: "body", controls: "interface", wrapped: false }), J({ offJ, gm2J }));
    check("J3: the GM's page that was running keeps its windows until it reloads", J(keptJ) === J(onJ), J(keptJ));
    check("J4: the switch is back on", backJ === true, J(backJ));

    /* ------------------------------ restore ------------------------------ */
    await p1.eval(`Hooks.off("updateToken", globalThis.__s74written); Hooks.off("drpgRouteSettled", globalThis.__s74settled);
        globalThis.__s74observer?.disconnect();
        for (const key of ["__s74written", "__s74settled", "__s74at", "__s74observer", "__s74painted"]) delete globalThis[key]; return true;`);
    await p2.eval(`Hooks.off("updateToken", globalThis.__s74cWritten); globalThis.__s74observer?.disconnect();
        for (const key of ["__s74cWritten", "__s74c", "__s74observer", "__s74painted"]) delete globalThis[key]; return true;`);
    await gm.eval(`${ACADEMY} const V = await import("${repoUrl}/scripts/vault.mjs"), aiko = game.actors.get("${IDS.aiko}"), was = globalThis.__s74;
        if (was.regions) await academy.deleteEmbeddedDocuments("Region", was.regions);
        if (was.tower) await game.scenes.get(was.tower)?.delete();
        if (was.daku) await game.actors.get(was.daku)?.delete();
        for (const [room, { description, image }] of Object.entries(was.rooms)) await V.setVaultRoom(room, { description, image, scene: academy });
        for (const [id, { x, y }] of Object.entries(was.at)) await academy.tokens.get(id).update({ x, y }, ${MOVE});
        if (was.actions !== undefined) await game.drpg.setActions(aiko, was.actions);
        if (was.free === null) await aiko.unsetFlag("${MOD}", "freeMoveUsed"); else if (was.free !== undefined) await aiko.setFlag("${MOD}", "freeMoveUsed", was.free);
        const botan = game.actors.get("${IDS.botan}");
        if (was.botan) {
            await botan.update({ ownership: { ...was.botan.ownership, USERP10000000000: 0 } });
            await game.settings.set("${MOD}", "enforceAnonymity", was.botan.enforced);
            await game.drpg.setActions(botan, was.botan.actions);
            if (was.botan.free === null) await botan.unsetFlag("${MOD}", "freeMoveUsed"); else await botan.setFlag("${MOD}", "freeMoveUsed", was.botan.free);
        }
        delete globalThis.__s74; return true;`, { timeout: 30000 });
    await settle(800);
}
