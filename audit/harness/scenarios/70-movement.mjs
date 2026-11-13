/**
 * 70-movement: the movement rules end to end, on the players' own pages (E39 C1, 13.11.2026; plan docs/dev/plans/E39.md on
 * the planner's branch, section 3 item 1, and the audit's goal it quotes).
 *
 * The GM and three players. The GM draws a row of four rooms on the school's scene, below the seeded ones (E39 A to
 * E39 D, each 500 px wide, 20 px apart - the gap 66 W's Porch stands at beside Dorm A, a neighbour by the map), stands
 * Aiko (p1's), Botan (p2's) and Chie (p3's) in E39 A with the movement cost on, the free Move spent and no grants, and each
 * player drags their own token (a plain `update` of its x and y, as Foundry writes a drop):
 *   unknown   p1 asks for E39 C from E39 A, a room two away that Aiko has never entered: refused on p1, the token where it
 *             was, no action taken, and the sentence names no room Aiko does not know (movement.mjs `notConnectedText`,
 *             `roomsKnownToMe`) - E39 C and E39 D are nowhere in it;
 *   leg       two actions, three crossings in a row (A to B, B to C, C to D): the first two stand and take one action each,
 *             the last is refused on p1's own browser ("No Free Move and no actions left.") and the token stays in E39 C,
 *             the room it paid for; the GMs' record of the crossing names C (`crossingStore`);
 *   parallel  ten crossings at once over three pages - Aiko four, Botan three, Chie three, each player's in a row and the
 *             three players together - with five actions each: each student pays exactly their own crossings, ten in all,
 *             and stands in the room of their last;
 *   refund    one action, A to B, and the GM's Refund last crossing (`refundLastCrossing`, the primary's): the action back
 *             exactly, the token back in A, the record marked; a second Refund refused, nothing given twice;
 *   eclipse   an Eclipse in the Afternoon (an ordinary one, not a free placement: eclipse.mjs `eclipseAllowance`): Aiko
 *             crosses as often as the allowance says, each standing at no action, and the one past it is refused - on
 *             p1's page or put back by the GMs' count - in the Eclipse's words, at no action either; the GM's count reads
 *             the allowance; then the same crossing from p1's console with its own veto stepped past, put back by the GMs.
 * The expected numbers are config.mjs's and eclipse.mjs's (`ECLIPSE_MOVES` through `eclipseAllowance`), read on the GM.
 *
 * What this cannot see: Foundry's own drag (a ruler, waypoints, a wall's collision), which the harness writes as one
 * update (66 W stands in for pending waypoints); a real server's timing between three players; LIVE-E39-01 is the move on
 * a v14 table the shim's movement and levels are to be calibrated against.
 */
export const layers = ["ci"];
export const timeoutMs = 600000;

const MOD = "danganronpa-rpg";
const J = value => JSON.stringify(value);
const ROOMS = ["E39 A", "E39 B", "E39 C", "E39 D"];
const X0 = 200, W = 500, GAP = 20, Y0 = 2100, H = 600;
const TOKENS = { aiko: "TOKAIKO000000000", botan: "TOKBOTAN00000000", chie: "TOKCHIE000000000" };
/* A spot inside a room, top-left of a one-square token (the scene's grid is 100). */
const spot = (room, dx = 0) => ({ x: X0 + ROOMS.indexOf(room) * (W + GAP) + 150 + dx, y: Y0 + 200 });

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl, IDS }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    const players = { aiko: p1, botan: p2, chie: p3 };
    const ACTOR = { aiko: IDS.aiko, botan: IDS.botan, chie: IDS.chie };

    /* Every warning a page shows, kept: the veto's refusals are said on the mover's own browser. */
    for (const client of [p1, p2, p3]) await client.eval(`if (!globalThis.__s70warn) { globalThis.__s70warn = [];
        const warn = ui.notifications.warn.bind(ui.notifications);
        ui.notifications.warn = (text, ...rest) => { globalThis.__s70warn.push(String(text)); return warn(text, ...rest); }; }
        return true;`);

    /* Stand each named student in a room (the GM's displace), with `actions` actions and no free Move or grant, and drop
       the GMs' record of their last crossing. */
    const stand = (who, room, actions) => gm.eval(`const S = ${imp("gm-stores.mjs")}, { FLAGS } = ${imp("config.mjs")};
        for (const [key, id] of Object.entries(${J(Object.fromEntries(who.map(w => [w, ACTOR[w]])))})) {
            const a = game.actors.get(id), t = canvas.scene.tokens.get(${J(TOKENS)}[key]);
            await t.update(${J(spot(room))}, { teleport: true, movementAction: "displace", animate: false });
            await a.update({ "system.resources.actions.max": Math.max(${actions}, game.drpg.actionsMax(a)), "system.resources.actions.value": ${actions},
                ["flags.${MOD}." + FLAGS.freeMoveUsed]: true, ["flags.${MOD}." + FLAGS.freeMoveGrants]: 0, ["flags.${MOD}." + FLAGS.freeActionGrants]: 0 });
            if (S.crossingStore.has(id)) await S.crossingStore.drop(id);
        }
        await new Promise(r => setTimeout(r, 600));
        return true;`, { timeout: 60000 });
    /* Where each stands and what each holds, read on the GM. */
    const read = () => gm.eval(`const M = ${imp("movement.mjs")}, S = ${imp("gm-stores.mjs")};
        return Object.fromEntries(Object.entries(${J(ACTOR)}).map(([k, id]) => {
            const a = game.actors.get(id), t = canvas.scene.tokens.get(${J(TOKENS)}[k]);
            return [k, { room: M.roomOfToken(t), actions: game.drpg.actionsLeft(a), record: S.crossingStore.get(id)?.to ?? null }];
        }));`, { timeout: 30000 });
    /* A player's drag of their own token into a room: the update as Foundry writes a drop, then a rest for the judges. */
    const drag = (who, room, rest = 700) => players[who].eval(`const t = canvas.scene.tokens.get("${TOKENS[who]}");
        const n = globalThis.__s70warn.length;
        try { await t.update(${J(spot(room, 0))}); } catch (err) { return { threw: String(err?.message ?? err) }; }
        await new Promise(r => setTimeout(r, ${rest}));
        return { warned: globalThis.__s70warn.slice(n) };`, { timeout: 30000 });

    phase("setup");
    const setup = await gm.eval(`const { SETTINGS } = ${imp("settings.mjs")}, R = ${imp("rooms.mjs")};
        globalThis.__s70was = { charge: game.settings.get("${MOD}", SETTINGS.chargeMovement), at: {}, actors: {}, clock: foundry.utils.deepClone(game.settings.get("${MOD}", SETTINGS.clock)) };
        for (const [k, id] of Object.entries(${J(ACTOR)})) {
            const a = game.actors.get(id), t = canvas.scene.tokens.get(${J(TOKENS)}[k]);
            globalThis.__s70was.at[k] = { x: t.x, y: t.y };
            globalThis.__s70was.actors[id] = { value: a.system.resources.actions.value, max: a.system.resources.actions.max, flags: foundry.utils.deepClone(a.flags["${MOD}"] ?? {}) };
        }
        await game.settings.set("${MOD}", SETTINGS.chargeMovement, true);
        await game.drpg.setClock({ chapter: 1, day: 1, session: 1, timeOfDay: "afternoon", phase: "dailyLife" });
        const made = await canvas.scene.createEmbeddedDocuments("Region", ${J(ROOMS)}.map((name, i) => ({ name,
            shapes: [{ type: "rectangle", x: ${X0} + i * ${W + GAP}, y: ${Y0}, width: ${W}, height: ${H} }], flags: { "${MOD}": { [R.ROOM_FLAG]: true } }, behaviors: [] })));
        globalThis.__s70was.regions = made.map(r => r.id);
        return { regions: made.length };`, { timeout: 60000 });
    await stand(["aiko", "botan", "chie"], "E39 A", 2);
    const at0 = await read();
    check("setup: four rooms in a row, and Aiko, Botan and Chie stand in E39 A with two actions each",
        setup?.regions === 4 && Object.values(at0).every(v => v.room === "E39 A" && v.actions === 2), J({ setup, at0 }));

    try {
        phase("unknown: a refusal names no room the mover does not know");
        const far = await drag("aiko", "E39 C");
        const afterFar = await read();
        const said = (far.warned ?? []).join(" | ");
        check("unknown: p1's drag into E39 C, two rooms away and never entered, is refused on p1 - the token in E39 A, no action taken - and the sentence names neither E39 C nor E39 D",
            afterFar.aiko.room === "E39 A" && afterFar.aiko.actions === 2 && said.length > 0 && !said.includes("E39 C") && !said.includes("E39 D"), J({ far, afterFar }));

        phase("leg: the last leg of a route past the budget is vetoed", { flow: "crossing-fee-refund" });
        const legs = [];
        for (const room of ["E39 B", "E39 C", "E39 D"]) legs.push({ room, ...(await drag("aiko", room, 900)), at: (await read()).aiko });
        const leg = legs.map(l => [l.room, l.at.room, l.at.actions]);
        const budget = await gm.eval(`return game.i18n.localize("DRPG.Move.noBudget");`);
        check("leg: two actions, three crossings in a row - the first two stand at one action each, the third is refused on p1 in the budget's words, Aiko stays in E39 C and the GMs' record names C",
            J(leg) === J([["E39 B", "E39 B", 1], ["E39 C", "E39 C", 0], ["E39 D", "E39 C", 0]]) && (legs[2].warned ?? []).includes(budget) && legs[2].at.record === "E39 C",
            J({ legs, budget }));

        phase("parallel: ten crossings at once over three pages, each paid once", { flow: "crossing-fee-refund" });
        await stand(["aiko", "botan", "chie"], "E39 A", 5);
        const ROUTES = { aiko: ["E39 B", "E39 A", "E39 B", "E39 C"], botan: ["E39 B", "E39 C", "E39 B"], chie: ["E39 B", "E39 A", "E39 B"] };
        await Promise.all(Object.entries(ROUTES).map(async ([who, route]) => { for (const room of route) await drag(who, room, 350); }));
        await settle(1500);
        const par = await read();
        const spent = Object.fromEntries(Object.keys(ROUTES).map(k => [k, 5 - par[k].actions]));
        check("parallel: Aiko four, Botan three and Chie three crossings together - each pays exactly their own, ten in all, and stands in the room of their last",
            spent.aiko === 4 && spent.botan === 3 && spent.chie === 3 && par.aiko.room === "E39 C" && par.botan.room === "E39 B" && par.chie.room === "E39 B",
            J({ spent, par }));

        phase("refund: the GM gives back the last crossing at its exact price", { flow: "crossing-fee-refund" });
        await stand(["aiko"], "E39 A", 1);
        await drag("aiko", "E39 B", 900);
        const paid = (await read()).aiko;
        const refunds = await gm.eval(`const M = ${imp("movement.mjs")}, S = ${imp("gm-stores.mjs")};
            const first = await M.refundLastCrossing("${IDS.aiko}");
            await new Promise(r => setTimeout(r, 800));
            const second = await M.refundLastCrossing("${IDS.aiko}");
            return { first, second, refunded: S.crossingStore.get("${IDS.aiko}")?.refunded ?? null };`, { timeout: 30000 });
        await settle(800);
        const back = (await read()).aiko;
        check("refund: a crossing paid with Aiko's one action is given back - the action exactly, the token in E39 A, the record marked - and a second Refund is refused, nothing given twice",
            paid.room === "E39 B" && paid.actions === 0 && refunds?.first?.reply?.kind === "action" && refunds.first.reply.given === true && refunds.first.reply.back === true
            && typeof refunds.second?.refused === "string" && refunds.refunded === true && back.room === "E39 A" && back.actions === 1, J({ paid, refunds, back }));

        phase("eclipse: the Eclipse's crossings, and the one past them", { flow: "eclipse-route-veto" });
        await stand(["aiko"], "E39 A", 2);
        const ecl = await gm.eval(`const E = ${imp("eclipse.mjs")};
            const started = Boolean(await E.startEclipse());
            await new Promise(r => setTimeout(r, 1000));
            return { started, eclipse: E.isEclipse(), allowance: E.eclipseAllowance(), free: E.isFreePlacement() };`, { timeout: 60000 });
        const route = ["E39 B", "E39 C", "E39 D", "E39 C", "E39 B", "E39 A"];
        const steps = [];
        if (ecl?.started && Number.isFinite(ecl.allowance)) {
            for (const room of route.slice(0, ecl.allowance + 1)) steps.push({ room, ...(await drag("aiko", room, 1200)), at: (await read()).aiko });
        }
        const counted = await gm.eval(`const E = ${imp("eclipse.mjs")}; return E.movesUsed(game.actors.get("${IDS.aiko}"));`);
        const spentWords = await gm.eval(`return game.i18n.localize("DRPG.Eclipse.noMovesLeft");`);
        const lawful = steps.slice(0, -1), past = steps.at(-1);
        check("eclipse: in an Afternoon Eclipse Aiko crosses as often as its allowance, each at no action; the next crossing is refused in the Eclipse's words and she stays in the room she reached, at no action; the GM counts the allowance",
            ecl?.started === true && ecl.free === false && ecl.allowance >= 1 && steps.length === ecl.allowance + 1
            && lawful.every(s => s.at.room === s.room && s.at.actions === 2) && past?.at?.room === lawful.at(-1)?.room && past.at.actions === 2
            && (past.warned ?? []).some(w => w.includes(spentWords) || w === spentWords) && counted === ecl.allowance, J({ ecl, steps, counted, spentWords }));
        /* The same crossing from p1's console with its own veto stepped past (movement.mjs `onPreUpdateToken` taken off the
           harness's hook list for the one write, as 76 D's `forge` does): the move lands - p1 sees the token in E39 D once, by
           its own `updateToken` - and is put back. Measured on 13.11.2026 with mutants: the check above stays green with the GMs'
           comparisons turned (eclipse.mjs's count of an `eclipse.move`, movement.mjs `eclipseSighting`), since the mover's
           veto refuses first; this one fails only with those two and the mover's own charge (eclipse.mjs
           `judgeEclipseCrossing`, `left <= 0`) turned together - each of the three alone puts the crossing back, so it reads
           the layers after the veto as one, not the GM's alone (tier 2 E17-T4 reads the GM's count on its own). */
        const forced = await p1.eval(`const t = canvas.scene.tokens.get("${TOKENS.aiko}"), seen = [];
            const hook = Hooks.on("updateToken", doc => { if (doc.id === t.id) seen.push(doc.x); });
            const list = Hooks._hooks.get("preUpdateToken") ?? [], at = list.findIndex(e => e.fn.name === "onPreUpdateToken");
            const [veto] = at >= 0 ? list.splice(at, 1) : [];
            try { await t.update(${J(spot("E39 D"))}); } catch (err) { return { threw: String(err?.message ?? err) }; }
            finally { if (veto) list.splice(at, 0, veto); }
            await new Promise(r => setTimeout(r, 3000));
            Hooks.off("updateToken", hook);
            return { vetoOff: Boolean(veto), landed: seen.includes(${spot("E39 D").x}), x: t.x };`, { timeout: 30000 });
        const putBack = (await read()).aiko;
        check("eclipse: the crossing past the allowance from p1's console, its own veto stepped past, lands and is put back by the GMs into the room she reached, at no action",
            forced?.vetoOff === true && forced.landed === true && putBack.room === lawful.at(-1)?.room && putBack.actions === 2, J({ forced, putBack }));
        await gm.eval(`const E = ${imp("eclipse.mjs")}; await E.endEclipse({ advance: false }); return true;`, { timeout: 60000 });
    } finally {
        await gm.eval(`const w = globalThis.__s70was ?? {}, { SETTINGS } = ${imp("settings.mjs")}, S = ${imp("gm-stores.mjs")}, E = ${imp("eclipse.mjs")};
            if (E.isEclipse()) await E.endEclipse({ advance: false });
            for (const [k, at] of Object.entries(w.at ?? {})) await canvas.scene.tokens.get(${J(TOKENS)}[k])?.update(at, { teleport: true, movementAction: "displace", animate: false });
            for (const [id, v] of Object.entries(w.actors ?? {})) {
                const a = game.actors.get(id);
                await a.update({ "system.resources.actions.max": v.max, "system.resources.actions.value": v.value });
                for (const key of ["freeMoveUsed", "freeMoveGrants", "freeActionGrants"]) {
                    if (key in v.flags) await a.setFlag("${MOD}", key, v.flags[key]); else if (a.getFlag("${MOD}", key) !== undefined) await a.unsetFlag("${MOD}", key);
                }
                if (S.crossingStore.has(id)) await S.crossingStore.drop(id);
            }
            for (const id of w.regions ?? []) await canvas.scene.regions.get(id)?.delete();
            if (w.charge !== undefined) await game.settings.set("${MOD}", SETTINGS.chargeMovement, w.charge);
            if (w.clock) await game.drpg.setClock(w.clock);
            return true;`, { timeout: 60000 }).catch(() => null);
    }
}
