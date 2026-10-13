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
 *     no element of the GM's markup in it, nothing run - and a second open is the same window. The row's 44 px, the
 *     thumbnail's 78x44 and the cut need layout: R508's narrow clause and audit/glass-sweep.mjs read them.
 *
 * A paint is counted as one `childList` record on the tile itself: `paintRoomTile` replaces the tile's children
 * in one call and writes nothing when its view is unchanged. What the tile looks like (the picture over the whole
 * tile, the gradient, its height) needs layout and is not read here; the trial's empty pane and a GM without a
 * Monokuma are painted on boxes by R504 (a trial is not started here).
 */
export const layers = ["ci"];
/* Measured alone on 13.10.2026 (E77 C3's phases A and B, once, under the harness lock): 19.8 s from the cluster's start
   to its end by the results file, the checks 15.8 s of it. 60 s is three times that, as 73 keeps; E77's later phases here
   (the curtain's cut) raise it with a reading of their own. */
export const timeoutMs = 60000;
export const accounts = [{ who: "p4", id: "USERP4000000000A", name: "Player Four", role: 1, character: null, color: "#2a7f62", late: true }];

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p4, check, phase, settle, connect, IDS, repoUrl }) {
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

    /* ------------------------------ restore ------------------------------ */
    await p1.eval(`Hooks.off("updateToken", globalThis.__s74written); Hooks.off("drpgRouteSettled", globalThis.__s74settled);
        globalThis.__s74observer?.disconnect();
        for (const key of ["__s74written", "__s74settled", "__s74at", "__s74observer", "__s74painted"]) delete globalThis[key]; return true;`);
    await gm.eval(`${ACADEMY} const V = await import("${repoUrl}/scripts/vault.mjs"), aiko = game.actors.get("${IDS.aiko}"), was = globalThis.__s74;
        if (was.regions) await academy.deleteEmbeddedDocuments("Region", was.regions);
        for (const [room, { description, image }] of Object.entries(was.rooms)) await V.setVaultRoom(room, { description, image, scene: academy });
        for (const [id, { x, y }] of Object.entries(was.at)) await academy.tokens.get(id).update({ x, y }, ${MOVE});
        if (was.actions !== undefined) await game.drpg.setActions(aiko, was.actions);
        if (was.free === null) await aiko.unsetFlag("${MOD}", "freeMoveUsed"); else if (was.free !== undefined) await aiko.setFlag("${MOD}", "freeMoveUsed", was.free);
        delete globalThis.__s74; return true;`, { timeout: 30000 });
    await settle(800);
}
