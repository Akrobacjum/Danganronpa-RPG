/**
 * 34-case-seal: the case's copy on the server (E111, 14.11.2026; the owner: "Planer zagadki powinien przechowywac
 * dane w przegladarce gmow i byc wspolny dla kazdego gma", then "Bez hasel prosze - niech to bedzie dostepne dla
 * kont gmow po prostu"). The file keeps the name it had while the copy was sealed with a passphrase (e1afdd84, taken
 * out by e4814cbd): a scenario's number and file are how it is found later. A 3x number (security): the 6x decade
 * of the GM stores is full (60-69 taken), and what this asks most is what a player can and cannot reach.
 *
 * The seed's GM and three players, and `gm2`, a second Gamemaster declared late whose id sorts after the seed GM's,
 * so the seed GM stays the primary while both are connected. gm2 stands for the owner's second computer: a browser
 * with its own localStorage, empty at first. The server's files are the cluster's stand-in (cluster.mjs case
 * "files"; audit/harness/README.md says what it models): browse asks FILES_BROWSE, mkdir and upload FILES_UPLOAD, a
 * file is read by its path by anybody.
 *
 * Phases, in the order they run:
 *   A  the copy written: a GM's press writes one file under the world's folder with a 128-bit name, holding the
 *      planner; a player can neither list the folder nor upload into it; no world setting, localStorage key, chat
 *      message or packet a player's browser holds names the file or any of the planner; a change reaches the file
 *      after the debounce, not before.
 *   B  the refusal: with the module's switch off, and with a player's account given FILES_BROWSE, nothing is written,
 *      the GM is told once, and the health check names the refusal; with both put back the write goes again.
 *   C  the second computer: the seed GM leaves, gm2 opens the world alone with an empty browser and holds the planner
 *      from the file at load; its change reaches the file.
 *   D  an empty browser does not overwrite a full copy: gm2 back alone with its planner's stores emptied reads the
 *      file at load and the file stays whole; with its stores held unhydrated a write is refused and the file stands.
 *   E  two writers: the seed GM back, both write one row, gm2 later, and the file holds gm2's value; a second file in
 *      the folder (two first writes that raced) is read and merged with the first, the health check counts both, and
 *      the next write goes to the newer one alone.
 *
 * What this cannot see: a real v14 server's file routes - its permission checks, its answer for a folder that does
 * not exist, a source other than "data" (The Forge's assets), the static route serving a file to a request that is
 * not logged in (LIVE-E111-01, LIVE-E111-02) - and the owner's second computer (LIVE-E111-03).
 */
export const layers = ["ci"];

export const accounts = [
    { who: "gm2", id: "USERGM2E11100000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const MOD = "danganronpa-rpg";
const FOLDER = "worlds/drpg-audit-world/drpg-case";
const NAME = /^worlds\/drpg-audit-world\/drpg-case\/case-[0-9a-f]{32}\.json$/;
const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(read, done, ms = 8000, step = 200) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

/* The planner's markers: every string below is a field or a value of the fixture, and none may reach a player. */
const MARKERS = ["E111-Library-marker", "E111-weapon-marker", "E111slot", "E111node", "E111-the-knife-moved", "E111-gm2-row", "E111-late-value"];

export async function run(api) {
    const { gm, gm2, p1, check, note, phase, connect, disconnect, storageOf, socketTraffic, serverFiles, fileLog, repoUrl: REPO } = api;
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const PRE = `const C = ${imp("case-copy.mjs")}; const S = ${imp("gm-stores.mjs")}; const E = ${imp("gm-store.mjs")};`;
    const hydrated = who => who.eval(`${PRE} const end = Date.now() + 15000;
        while (!E.gmStoresHydrated() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        if (E.gmStoresHydrated()) await S.whenGmStoresLoaded();
        await E.gmStoresIdle(); return E.gmStoresHydrated();`, { timeout: 30000 });
    const planner = who => who.eval(`${PRE} return { plan: S.keyPlanStore.entries(), schema: S.caseSchemaStore.entries() };`);
    const copies = () => [...serverFiles.keys()].filter(p => p.startsWith(`${FOLDER}/`));
    const fileOf = path => { try { return JSON.parse(serverFiles.get(path)?.text ?? "null"); } catch { return null; } };
    const planOf = path => ({ plan: fileOf(path)?.stores?.keyPlan?.e ?? {}, schema: fileOf(path)?.stores?.caseSchema?.e ?? {}, at: fileOf(path)?.exportedAt ?? null });

    /* ------------------------------------------------------------------ A */
    phase("A the copy written, and what a player can reach");
    await hydrated(gm);
    await gm.eval(`${PRE} await S.keyPlanStore.patch("E111slot", { room: "E111-Library-marker", realType: "E111-weapon-marker" });
        await S.caseSchemaStore.patch("1:E111node", { kind: "deduction", label: "E111-the-knife-moved" });
        await E.gmStoresIdle(); return true;`);
    const wrote = await gm.eval(`${PRE} return { r: await C.writeServerCopy({ explicit: true }), state: C.copyState() };`, { timeout: 30000 });
    const [path] = copies();
    const a1 = path ? planOf(path) : null;
    check("A1: a GM's press writes one file in the world's folder under a 128-bit name, and it holds the planner",
        wrote.r === "written" && copies().length === 1 && NAME.test(path ?? "") && a1?.plan?.E111slot?.room === "E111-Library-marker"
        && a1?.schema?.["1:E111node"]?.label === "E111-the-knife-moved" && fileOf(path)?.format === "drpg-case", J({ wrote, copies: copies().length, a1 }));
    const sizes = { caseJson: serverFiles.get(path)?.text.length ?? 0 };
    note("gm: the seed world's case as the server copy, in bytes of JSON", J(sizes));

    const reach = await p1.eval(`const FP = foundry.applications.apps.FilePicker.implementation; const out = {};
        try { await FP.browse("data", "${FOLDER}"); out.browse = "listed"; } catch (err) { out.browse = String(err?.message ?? err); }
        try { await FP.upload("data", "${FOLDER}", new File(["{}"], "case-00000000000000000000000000000000.json"), {}, { notify: false }); out.upload = "uploaded"; }
        catch (err) { out.upload = String(err?.message ?? err); }
        const C = ${imp("case-copy.mjs")}; out.write = await C.writeServerCopy({ explicit: true }); return out;`, { timeout: 30000 });
    check("A2: a player can neither list the case's folder nor upload into it, and the module's writer refuses a player",
        /permission/i.test(reach.browse) && /permission/i.test(reach.upload) && reach.write === "notGm" && copies().length === 1, J(reach));

    const file = path.slice(path.lastIndexOf("/") + 1);
    const p1Holds = await p1.eval(`const out = [];
        for (const [id, s] of game.settings.settings) {
            if (s.scope !== "world") continue;
            const dot = id.indexOf(".");
            try { out.push(JSON.stringify(game.settings.get(id.slice(0, dot), id.slice(dot + 1)) ?? null)); } catch { /* not readable */ }
        }
        for (let i = 0; i < localStorage.length; i++) out.push(localStorage.getItem(localStorage.key(i)) ?? "");
        for (const m of game.messages) out.push(JSON.stringify(m.toObject?.() ?? m));
        for (const d of [...game.users, ...game.actors]) out.push(JSON.stringify(d.flags ?? {}));
        return out.join("\\n");`);
    const toP1 = J(socketTraffic.filter(t => t.to === "all" || (Array.isArray(t.to) && t.to.includes(api.IDS.p1))));
    const leaks = [file, ...MARKERS].filter(m => p1Holds.includes(m) || toP1.includes(m));
    check("A3: nothing a player's browser holds names the file or any of the planner: its world settings, localStorage, chat messages, flags and the packets sent to it",
        p1Holds.length > 500 && !leaks.length, J({ leaks, holds: p1Holds.length }));

    const before = planOf(path).at;
    const pending = await gm.eval(`${PRE} await S.keyPlanStore.patch("E111slot", { dc: 14 }); await E.gmStoresIdle();
        await new Promise(r => setTimeout(r, 1500)); return { pending: C.copyState().pending, quiet: C.SEAL_QUIET_MS };`);
    const early = planOf(path);
    const late = await until(() => planOf(path), v => v.plan?.E111slot?.dc === 14, pending.quiet + 10000, 500);
    check("A4: a change of the planner asks for a write: 1.5 s after it the file is as it was and a write is pending; after the debounce the file holds the change",
        pending.pending === true && early.at === before && early.plan?.E111slot?.dc === undefined && late.plan?.E111slot?.dc === 14 && copies().length === 1,
        J({ pending, before, early: early.at, late: late.at }));

    /* ------------------------------------------------------------------ B */
    phase("B the copy refused while players may reach the files");
    const offAt = Object.values(planOf(path)).length && planOf(path).at;
    const off = await gm.eval(`${PRE} globalThis.__notifications.length = 0;
        await game.settings.set("${MOD}", "enforcePlayerFiles", false);
        await S.keyPlanStore.patch("E111off", { room: "E111-off" }); await E.gmStoresIdle();
        const r = await C.writeServerCopy({ explicit: true }), again = await C.writeServerCopy({ explicit: true });
        const health = (await S.gmStoreHealth()).rows.find(row => row.id === "caseCopy") ?? null;
        const told = globalThis.__notifications.filter(n => /file browser|browse/i.test(n.msg)).map(n => [n.level, n.opts?.permanent === true]);
        await game.settings.set("${MOD}", "enforcePlayerFiles", true);
        return { r, again, health, told };`, { timeout: 30000 });
    check("B1: with the switch off nothing is written, the GM is told once, and the health check names the refusal as a conflict",
        off.r === "switchOff" && off.again === "switchOff" && planOf(path).at === offAt && J(off.told) === J([["warn", true]])
        && off.health?.level === "conflict" && off.health?.key === "DRPG.Case.copy.refused.switchOff", J(off));

    const acct = await gm.eval(`${PRE} const u = game.users.get("${api.IDS.p1}");
        await u.update({ "permissions.FILES_BROWSE": true });
        const r = await C.writeServerCopy({ explicit: true });
        await u.update({ "permissions.FILES_BROWSE": false });
        const back = await C.writeServerCopy({ explicit: true });
        return { r, back };`, { timeout: 30000 });
    check("B2: a player's account given FILES_BROWSE stops the write too; with it taken back the write goes, and the file holds what changed meanwhile",
        acct.r === "account" && acct.back === "written" && planOf(path).plan?.E111off?.room === "E111-off", J({ acct, off: planOf(path).plan?.E111off ?? null }));

    /* ------------------------------------------------------------------ C */
    phase("C the second computer, alone");
    await disconnect("gm");
    const gmKept = await storageOf("gm");
    await connect("gm2");
    await hydrated(gm2);
    const alone = await until(() => planner(gm2), v => Boolean(v.schema?.["1:E111node"]));
    const primary = await gm2.eval(`return (${imp("utils.mjs")}).isPrimaryGm();`);
    check("C1: an empty browser alone (the primary) holds the planner from the file at load: the Key Remnant plan and the case schema as the first GM left them",
        primary === true && alone.plan?.E111slot?.room === "E111-Library-marker" && alone.plan?.E111slot?.dc === 14
        && alone.schema?.["1:E111node"]?.label === "E111-the-knife-moved", J(alone));
    await gm2.eval(`${PRE} await S.keyPlanStore.patch("E111gm2", { room: "E111-gm2-row" }); await E.gmStoresIdle(); return C.flushCopy();`, { timeout: 30000 });
    check("C2: the second computer's change reaches the file, the same file", planOf(path).plan?.E111gm2?.room === "E111-gm2-row" && copies().length === 1,
        J(planOf(path).plan));

    /* ------------------------------------------------------------------ D */
    phase("D an empty browser does not overwrite a full copy");
    const kept = await storageOf("gm2");
    await disconnect("gm2");
    const emptied = { ...kept };
    delete emptied[`${MOD}.gmKeyPlan`];
    delete emptied[`${MOD}.gmCaseSchema`];
    await connect("gm2", { storage: emptied });
    await hydrated(gm2);
    const back = await until(() => planner(gm2), v => Boolean(v.schema?.["1:E111node"]));
    await wait(500);
    check("D1: a GM back alone with its planner's stores emptied reads the file at load: its planner is the file's, and the file still holds the whole planner",
        !emptied[`${MOD}.gmKeyPlan`] && back.schema?.["1:E111node"]?.label === "E111-the-knife-moved" && back.plan?.E111gm2?.room === "E111-gm2-row"
        && planOf(path).plan?.E111slot?.room === "E111-Library-marker" && planOf(path).schema?.["1:E111node"]?.label === "E111-the-knife-moved",
        J({ back, file: planOf(path) }));
    const atHold = planOf(path).at;
    const held = await gm2.eval(`${PRE} C.SEAL_DEPS.hydrated = () => false;
        await S.keyPlanStore.patch("E111held", { room: "E111-held" }); await E.gmStoresIdle();
        const r = await C.writeServerCopy({ explicit: true }); C.SEAL_DEPS.hydrated = () => E.gmStoresHydrated();
        return { r, after: await C.writeServerCopy({ explicit: true }) };`, { timeout: 30000 });
    check("D2: with its stores held unhydrated a write is refused and the file stands; hydrated again, the write holds the planner and the new row",
        held.r === "notHydrated" && held.after === "written" && planOf(path).at !== atHold && planOf(path).plan?.E111held?.room === "E111-held"
        && planOf(path).plan?.E111slot?.room === "E111-Library-marker", J({ held, file: planOf(path).plan }));

    /* ------------------------------------------------------------------ E */
    phase("E two writers, and two files");
    await connect("gm", { storage: gmKept });
    await hydrated(gm);
    await hydrated(gm2);
    await gm.eval(`${PRE} await S.keyPlanStore.patch("E111both", { room: "E111-early-value" }); await E.gmStoresIdle(); return true;`);
    await wait(50);
    await gm2.eval(`${PRE} await S.keyPlanStore.patch("E111both", { room: "E111-late-value" }); await E.gmStoresIdle(); return true;`);
    await until(() => planner(gm), v => v.plan?.E111both?.room === "E111-late-value");
    const flushed = await gm.eval(`${PRE} await E.gmStoresIdle(); return (await C.flushCopy()) ?? (await C.writeServerCopy());`, { timeout: 30000 });
    check("E1: the seed GM back (the primary) and gm2 write one row, gm2 later; the file the primary writes holds gm2's value and every row before",
        ["written", "same"].includes(flushed) && planOf(path).plan?.E111both?.room === "E111-late-value" && planOf(path).plan?.E111held?.room === "E111-held",
        J({ flushed, both: planOf(path).plan?.E111both ?? null }));

    /* Two first writes that raced: gm2 uploads a second copy with a row of its own, by the module's own writer's road. */
    const raced = await gm2.eval(`${PRE} const FP = foundry.applications.apps.FilePicker.implementation;
        const file = await S.caseFileNow(); file.stores.keyPlan.e.E111raced = { room: "E111-raced" }; file.stores.keyPlan.t.E111raced = Date.now();
        file.exportedAt = new Date(Date.now() + 1000).toISOString();
        const name = C.newCopyName();
        await FP.upload("data", "${FOLDER}", new File([JSON.stringify(file)], name), {}, { notify: false });
        return name;`, { timeout: 30000 });
    const merged = await gm.eval(`${PRE} const r = await C.readServerCopies(); await E.gmStoresIdle();
        const w = await C.writeServerCopy({ explicit: true }); const h = (await S.gmStoreHealth()).rows.find(row => row.id === "caseCopy") ?? null;
        return { read: r.read, count: r.count, newest: r.newest?.endsWith(${J(raced)}) ?? false, raced: S.keyPlanStore.get("E111raced")?.room ?? null, w, h };`, { timeout: 30000 });
    const second = `${FOLDER}/${raced}`;
    check("E2: two copies in the folder are both read and merged, the newer one holds the whole case (written to, or already the same), and the health check counts both",
        copies().length === 2 && merged.read === 2 && merged.count === 2 && merged.newest && merged.raced === "E111-raced"
        && ["written", "same"].includes(merged.w) && planOf(second).plan?.E111both?.room === "E111-late-value" && planOf(second).plan?.E111raced?.room === "E111-raced" && merged.h?.key === "DRPG.Case.row.copyFound"
        && merged.h?.level === "info" && merged.h?.data?.n === 2, J({ copies: copies().length, merged }));

    const after = await gm.eval(`${PRE} await S.keyPlanStore.patch("E111after", { room: "E111-after" }); await E.gmStoresIdle();
        return C.writeServerCopy({ explicit: true });`, { timeout: 30000 });
    check("E3: the next write goes to the newer copy alone: it holds the new row and the older one does not, and no third file is made",
        after === "written" && planOf(second).plan?.E111after?.room === "E111-after" && !planOf(path).plan?.E111after && copies().length === 2,
        J({ after, newer: Boolean(planOf(second).plan?.E111after), older: Boolean(planOf(path).plan?.E111after) }));

    const denials = fileLog.filter(f => !f.ok && f.who === "p1").map(f => f.action);
    note("server files: requests by action and outcome", J(fileLog.reduce((m, f) => ({ ...m, [`${f.who} ${f.action} ${f.ok ? "ok" : "refused"}`]: (m[`${f.who} ${f.action} ${f.ok ? "ok" : "refused"}`] ?? 0) + 1 }), {})));
    return { wrote: wrote.r, reach, off: off.r, acct, held, flushed, merged, denials };
}
