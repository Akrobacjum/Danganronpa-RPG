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
                hidden: t.getAttribute("aria-hidden"), after: t.previousElementSibling?.id ?? null, text: t.textContent } : null; };
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
        + "literal, markup and paragraph break as typed, the picture on the art layer - after the clock it stands under",
    J(setA) === J({ TOKAIKO000000000: "Dorm A", TOKBOTAN00000000: "Cafeteria", TOKMONOKUMA00000: "Hall" })
        && applied.seen?.words === true && applied.seen?.picture === true
        && J(p1A.painted) === J(["Dorm A"]) && p1A.tile?.state === "room" && p1A.tile.name === "Dorm A" && p1A.tile.prose === WORDS["Dorm A"]
        && p1A.tile.art === `url("${IMAGES["Dorm A"]}")` && ["drpg-hud", "drpg-floors"].includes(p1A.tile.after) && p1A.ran === null,
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
