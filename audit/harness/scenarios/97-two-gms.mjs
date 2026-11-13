/**
 * 97-two-gms: two Gamemasters at one table, a reload and a change of primary (E38, 13.11.2026; plan
 * docs/dev/plans/E38.md on claude/plan-130, its 3.1-3.2; the harness README's planned row 82, numbered 97 here).
 *
 * The seed's GM and three players, and `gm2`, a second Gamemaster declared late whose id sorts after the seed
 * GM's, so the seed GM stays the primary while both are connected (utils.mjs `primaryGmId`: the smallest id of
 * the connected full GMs). Every check reads something the run made happen first, and says so in its own
 * condition: a check that would pass on an empty reading is guarded by the reading's count.
 *
 * Phases, in the order they run:
 *   A  the harness's own preconditions (cluster.mjs `reload`, `makePrimary`, `primaryOn`, E38 C1): gm2 joins and
 *      the primary does not move, on any client (A1); p1 reloads - the others hear it leave and come back, and a
 *      key its localStorage held is there after (A2); the primary reloads while gm2 is here, and is the primary
 *      again once it is back, on every client (A3); `makePrimary("gm2")` takes the seed GM off the table and every
 *      client reads gm2, and the seed GM back makes it the primary again (A4).
 *   B  the GMs' store both ways: a row gm2 writes is held by gm, a row gm writes by gm2, each by the store's own
 *      exchange (gm-store.mjs), and a removal on one is a removal on the other (B1-B3).
 *
 * What this cannot see: a real F5 (a new process with the old localStorage, no cookie, IndexedDB or cache; the
 * order of "inactive", "active" and `ready` on v14 is LIVE-E30-05 and LIVE-E04-12), and a real server's delivery
 * times. A third account on a live v14 is LIVE-E38-01 and -02 (audit/AUDIT-1.2.42.md 9.2).
 */
export const layers = ["ci"];

export const accounts = [
    { who: "gm2", id: "USERGM2E38000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` until `done(value)` or `ms` pass; the last reading either way. */
async function until(read, done, ms = 6000, step = 150) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

export async function run(api) {
    const { gm, gm2, p1, check, phase, settle, connect, reload, makePrimary, primaryOn, repoUrl: REPO, IDS } = api;
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const GM2 = accounts[0].id;
    const allRead = (on, id) => Object.keys(on).length >= 5 && Object.values(on).every(v => v === id);

    /* ------------------------------------------------------------------ A */
    phase("A harness");
    const before = await primaryOn();
    check("A0: before gm2 joins, the four clients take the seed GM for the primary",
        Object.keys(before).length === 4 && Object.values(before).every(v => v === IDS.gm), J(before));
    await gm.eval(`globalThis.__e38Heard = [];
        Hooks.on("userConnected", (user, active) => globalThis.__e38Heard.push([user.id, Boolean(active)]));
        return true;`);

    await connect("gm2");
    const joined = await until(primaryOn, on => Object.keys(on).length === 5);
    check("A1: gm2, whose id sorts after the seed GM's, joins and the primary does not move: all five clients read the seed GM",
        GM2 > IDS.gm && allRead(joined, IDS.gm), J(joined));

    await p1.eval(`localStorage.setItem("e38.reload.mark", "kept"); return true;`);
    const r1 = await reload("p1");
    const p1Back = await p1.eval(`return { mark: localStorage.getItem("e38.reload.mark"), user: game.user.id, ready: game.ready === true,
        drpg: Boolean(game.drpg) };`);
    const heard = await gm.eval(`return globalThis.__e38Heard.filter(([id]) => id === "${IDS.p1}");`);
    check("A2: p1 reloads: gm hears p1 leave then come back, and p1's browser boots again as p1 with the key its localStorage held",
        r1.left === true && r1.back === true && J(heard) === J([[IDS.p1, false], [IDS.p1, true]])
            && p1Back?.mark === "kept" && p1Back.user === IDS.p1 && p1Back.ready && p1Back.drpg,
        J({ r1, p1Back, heard }));

    await gm.eval(`localStorage.setItem("e38.reload.mark", "gm"); return true;`);
    const r2 = await reload("gm");
    const afterGmReload = await until(primaryOn, on => allRead(on, IDS.gm));
    const gmBack = await gm.eval(`globalThis.__e38Heard = []; Hooks.on("userConnected", (u, a) => globalThis.__e38Heard.push([u.id, Boolean(a)]));
        return { mark: localStorage.getItem("e38.reload.mark"), user: game.user.id, gm: game.user.isGM };`);
    check("A3: the primary GM reloads while gm2 is here, and once back it is the primary again on all five clients, its localStorage kept",
        r2.left === true && r2.back === true && allRead(afterGmReload, IDS.gm) && gmBack?.mark === "gm" && gmBack.user === IDS.gm && gmBack.gm,
        J({ r2, afterGmReload, gmBack }));

    const moved = await makePrimary("gm2");
    check("A4a: makePrimary(\"gm2\") takes the seed GM off the table, and the four clients left read gm2",
        J(moved.left) === J(["gm"]) && moved.agreed === true && Object.keys(moved.on).length === 4 && Object.values(moved.on).every(v => v === GM2),
        J(moved));
    await connect("gm");
    const backAgain = await until(primaryOn, on => allRead(on, IDS.gm));
    check("A4b: the seed GM connects again and is the primary on all five clients",
        allRead(backAgain, IDS.gm), J(backAgain));
    await settle(1500);

    /* ------------------------------------------------------------------ B */
    phase("B store both ways");
    const KEY2 = "97:gm2", KEY1 = "97:gm";
    await gm2.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.patch("${KEY2}", { name: "E38 written on gm2" }); return true;`);
    await gm.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.patch("${KEY1}", { name: "E38 written on gm" }); return true;`);
    const readBoth = who => () => who.eval(`const S = ${imp("gm-stores.mjs")};
        return { a: S.keyPlanStore.get("${KEY2}")?.name ?? null, b: S.keyPlanStore.get("${KEY1}")?.name ?? null };`);
    const onGm = await until(readBoth(gm), v => v?.a !== null);
    const onGm2 = await until(readBoth(gm2), v => v?.b !== null);
    check("B1: a row gm2 wrote is held by gm", onGm?.a === "E38 written on gm2" && onGm.b === "E38 written on gm", J(onGm));
    check("B2: a row gm wrote is held by gm2", onGm2?.b === "E38 written on gm" && onGm2.a === "E38 written on gm2", J(onGm2));
    await gm2.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.drop("${KEY1}"); return true;`);
    await gm.eval(`const S = ${imp("gm-stores.mjs")}; await S.keyPlanStore.drop("${KEY2}"); return true;`);
    const goneGm = await until(readBoth(gm), v => v?.a === null && v?.b === null);
    const goneGm2 = await until(readBoth(gm2), v => v?.a === null && v?.b === null);
    check("B3: each GM's removal of the other's row is a removal on both",
        onGm?.a !== null && goneGm?.a === null && goneGm.b === null && goneGm2?.a === null && goneGm2.b === null, J({ goneGm, goneGm2 }));

    return { primary: { before, joined, afterGmReload, moved, backAgain }, reloads: { p1: r1, gm: r2 } };
}
