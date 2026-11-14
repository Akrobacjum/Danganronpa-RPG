/**
 * 34-case-seal: the case's sealed copy in the world (E111, 14.11.2026; the owner: "Planer zagadki powinien przechowywac
 * dane w przegladarce gmow i byc wspolny dla kazdego gma", then "I chcemy zaszyfrowana kopie chcemy dodac do planera
 * koniecznie"). A 3x number (security): the 6x decade of the GM stores is full (60-69 taken), and what this asks most is
 * what a player's browser can and cannot do with the copy.
 *
 * The seed's GM and three players, and `gm2`, a second Gamemaster declared late whose id sorts after the seed GM's, so
 * the seed GM stays the primary while both are connected. gm2 stands for the owner's second computer: a browser with
 * its own localStorage, empty at first.
 *
 * Phases, in the order they run:
 *   A  the passphrase set on the primary: a short one refused, a good one writes the copy at once; the copy is
 *      ciphertext and the fields that open it, a player's browser holds it and nothing of the fixture's planner in any
 *      world setting, its localStorage or a packet sent to it; a player's write of the setting is refused by the world;
 *      a player's guess at the passphrase opens nothing; and a change of the planner reaches the copy only after the
 *      debounce, not before it.
 *   B  the second computer: the seed GM leaves, gm2 opens the world alone with an empty browser - the copy stays as it
 *      was (gm2 holds no key, writes nothing) and gm2 is told its planner is empty; a wrong passphrase changes nothing;
 *      the right one brings the planner, and gm2's change reaches the copy.
 *   C  an empty browser does not overwrite a full copy: gm2 comes back alone with its key and its planner's stores
 *      emptied, and its load reads the copy - its planner is the copy's and the copy keeps it whole; with its stores held
 *      unhydrated a write is refused and the copy stands; hydrated again, the write holds the planner and the new row.
 *   D  two GMs: the seed GM comes back and both are here; each writes the same row, gm2 later, and the copy the primary
 *      writes holds gm2's value - the later stamp per field, as the stores' merge has it; a GM who forgets the
 *      passphrase on its browser keeps the case and holds no key; the health check names the copy; and a changed
 *      passphrase encrypts the copy again, which the old one no longer opens.
 *
 * What this cannot see: a real v14 server's limit on a world setting's size and its delivery times (LIVE-E111-01), the
 * time PBKDF2 takes in a real browser (LIVE-E111-02; here Node's WebCrypto), and the owner's second computer
 * (LIVE-E111-03).
 */
export const layers = ["ci"];

export const accounts = [
    { who: "gm2", id: "USERGM2E11100000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const MOD = "danganronpa-rpg";
const PASS = "E111 lantern orchard violet anchor";
const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` until `done(value)` or `ms` pass; the last reading either way. */
async function until(read, done, ms = 8000, step = 200) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

/* The planner's markers: every string below is a field or a value of the fixture, and none may appear on a player. */
const MARKERS = ["E111-Library-marker", "E111-weapon-marker", "E111slot", "E111node", "E111-the-knife-moved", "E111-gm2-row", "E111-late-value"];

export async function run(api) {
    const { gm, gm2, p1, check, note, phase, connect, disconnect, storageOf, socketTraffic, repoUrl: REPO, IDS } = api;
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const PRE = `const C = ${imp("case-seal.mjs")}; const S = ${imp("gm-stores.mjs")}; const E = ${imp("gm-store.mjs")};`;
    const hydrated = who => who.eval(`${PRE} const end = Date.now() + 15000;
        while (!E.gmStoresHydrated() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        if (E.gmStoresHydrated()) await S.whenGmStoresLoaded();
        await E.gmStoresIdle(); return E.gmStoresHydrated();`, { timeout: 30000 });
    const planner = who => who.eval(`${PRE} return { plan: S.keyPlanStore.entries(), schema: S.caseSchemaStore.entries() };`);
    const sealed = who => who.eval(`const v = game.settings.get("${MOD}", "caseSealed"); return v?.format ? v : null;`);
    /* What the copy holds, opened with the passphrase on `who` (a GM's eval; the key derived there, nothing kept). */
    const opened = (who, pass = PASS) => who.eval(`${PRE} const v = C.worldSealed(); if (!v) return null;
        const key = await C.deriveSealKey(${J(pass)}, v.kdf.salt, v.kdf.iterations);
        const r = await C.openSealed(v, key); return r.file ? { plan: r.file.stores.keyPlan?.e ?? {}, schema: r.file.stores.caseSchema?.e ?? {} } : r;`, { timeout: 30000 });

    /* ------------------------------------------------------------------ A */
    phase("A the passphrase, the copy, and a player's browser");
    await hydrated(gm);
    await gm.eval(`${PRE} await S.keyPlanStore.patch("E111slot", { room: "E111-Library-marker", realType: "E111-weapon-marker" });
        await S.caseSchemaStore.patch("1:E111node", { kind: "deduction", label: "E111-the-knife-moved" });
        await E.gmStoresIdle(); return true;`);
    const set = await gm.eval(`${PRE} const short = await C.setCasePassphrase("too short");
        const t = Date.now(); const good = await C.setCasePassphrase(${J(PASS)});
        return { short, good, ms: Date.now() - t, state: C.sealState() };`, { timeout: 30000 });
    const onGm = await sealed(gm);
    const openedA = await opened(gm);
    /* The sizes, for the brief's question (how large a case is, compressed and not): the seed world's case as this
       browser holds it, its JSON, the same gzipped (CompressionStream, for the measure alone: the copy is not compressed),
       and the sealed value's JSON. Recorded, not held to a number. */
    const sizes = await gm.eval(`${PRE} const json = JSON.stringify(await S.caseFileNow());
        const gz = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()).length;
        return { caseJson: json.length, caseGzip: gz, sealedJson: JSON.stringify(C.worldSealed()).length };`);
    note("gm: the seed world's case, its gzip and the sealed copy, in bytes of JSON", J(sizes));
    check("A1: a short passphrase is refused; a good one writes the copy at once, which opens to the planner the GM holds",
        set.short?.refused === "short" && set.good?.ok === true && set.state.wrote === 1 && onGm?.format === "drpg-case-sealed"
        && openedA?.plan?.E111slot?.room === "E111-Library-marker" && openedA?.schema?.["1:E111node"]?.label === "E111-the-knife-moved",
        J({ set, keys: onGm ? Object.keys(onGm) : null, openedA }));
    check("A2: the copy is the eight fields of the sealed format, and nothing else",
        J(Object.keys(onGm ?? {}).sort()) === J(["ciphertext", "format", "iv", "kdf", "version", "worldId", "writtenAt", "writtenBy"])
        && onGm.kdf.iterations === 600000 && onGm.worldId === "drpg-audit-world", J(onGm && { ...onGm, ciphertext: onGm.ciphertext.length }));

    const onP1 = await until(() => sealed(p1), v => v?.iv === onGm?.iv);
    const p1Holds = await p1.eval(`const out = [];
        for (const [id, s] of game.settings.settings) {
            if (s.scope !== "world") continue;
            const dot = id.indexOf(".");
            try { out.push(JSON.stringify(game.settings.get(id.slice(0, dot), id.slice(dot + 1)) ?? null)); } catch { /* not readable here */ }
        }
        for (let i = 0; i < localStorage.length; i++) out.push(localStorage.getItem(localStorage.key(i)) ?? "");
        return out.join("\\n");`);
    const toP1 = J(socketTraffic.filter(t => t.to === "all" || (Array.isArray(t.to) && t.to.includes(IDS.p1))));
    const found = MARKERS.filter(m => p1Holds.includes(m));
    check("A3: a player's browser holds the copy, the same ciphertext, and no field or value of the planner in any world setting, its localStorage or a packet sent to it",
        onP1?.ciphertext === onGm?.ciphertext && p1Holds.includes(onGm.ciphertext) && !found.length && !MARKERS.some(m => toP1.includes(m)),
        J({ found, holds: p1Holds.length, read: p1Holds.includes(onGm?.ciphertext ?? "-"), sameCipher: onP1?.ciphertext === onGm?.ciphertext }));

    const forged = await p1.eval(`let error = null;
        try { await game.settings.set("${MOD}", "caseSealed", { format: "drpg-case-sealed", version: 1, ciphertext: "E111 forged" }); }
        catch (err) { error = String(err?.message ?? err); }
        const C = ${imp("case-seal.mjs")}; const v = C.worldSealed();
        const guess = await C.openSealed(v, await C.deriveSealKey("E111 a player's guess", v.kdf.salt, v.kdf.iterations));
        const mine = await C.setCasePassphrase("E111 a player's own passphrase");
        return { error, guess: guess.refused ?? "opened", mine: mine.refused ?? "set" };`, { timeout: 30000 });
    const afterForge = await sealed(gm);
    check("A4: a player's write of the setting is refused by the world and the copy stands; a player's guess at the passphrase opens nothing; the module's own setter refuses a player",
        /permission/i.test(forged.error ?? "") && afterForge?.iv === onGm?.iv && forged.guess === "wrong" && forged.mine === "notGm",
        J({ forged, iv: [afterForge?.iv, onGm?.iv] }));

    const debounce = await gm.eval(`${PRE} await S.keyPlanStore.patch("E111slot", { dc: 14 });
        await E.gmStoresIdle(); await new Promise(r => setTimeout(r, 1500));
        const early = C.worldSealed()?.iv; return { early, pending: C.sealState().pending, quiet: C.SEAL_QUIET_MS };`);
    const late = await until(() => sealed(gm), v => v?.iv !== debounce.early, debounce.quiet + 8000, 500);
    const openedLate = await opened(gm);
    check("A5: a change of the planner asks for a write: 1.5 s after it the copy is the one before and a write is pending; after the debounce the copy holds the change",
        debounce.early === onGm?.iv && debounce.pending === true && late?.iv !== onGm?.iv && openedLate?.plan?.E111slot?.dc === 14,
        J({ debounce, lateIv: late?.iv, dc: openedLate?.plan?.E111slot?.dc ?? null }));

    /* ------------------------------------------------------------------ B */
    phase("B the second computer, alone");
    const copyB = await sealed(gm);
    await disconnect("gm");
    const gmKept = await storageOf("gm");
    await connect("gm2");
    await hydrated(gm2);
    await wait(1500);
    const alone = await gm2.eval(`${PRE} return { primary: (${imp("utils.mjs")}).isPrimaryGm(), empty: C.plannerEmpty(), status: C.sealStatus(),
        told: (globalThis.__notifications ?? []).filter(n => /planner/i.test(n.msg)).map(n => [n.level, n.opts?.permanent === true]) };`);
    const copyAlone = await sealed(gm2);
    check("B1: an empty browser alone, holding no key: the primary, its planner empty, the copy unchanged, and the GM told the planner is empty here and how to get it",
        alone.primary === true && alone.empty === true && alone.status?.why === "noKey" && copyAlone?.iv === copyB?.iv && J(alone.told) === J([["warn", true]]),
        J({ alone, iv: [copyAlone?.iv, copyB?.iv] }));

    const wrong = await gm2.eval(`${PRE} const r = await C.unlockCaseCopy("E111 not the passphrase at all");
        return { r, key: Boolean(C.keptKey()), empty: C.plannerEmpty(), stored: Boolean(game.settings.get("${MOD}", "caseSealKey")?.[game.world.id]) };`, { timeout: 30000 });
    check("B2: a wrong passphrase is refused and changes nothing: no key kept, the planner still empty", wrong.r?.refused === "wrong" && !wrong.key && wrong.empty && !wrong.stored,
        J(wrong));

    const right = await gm2.eval(`${PRE} const r = await C.unlockCaseCopy(${J(PASS)}); await E.gmStoresIdle();
        return { r, key: Boolean(C.keptKey()), status: C.sealStatus() };`, { timeout: 30000 });
    const onGm2 = await planner(gm2);
    check("B3: the right passphrase brings the planner to the second computer: the Key Remnant plan and the case schema, as the first GM left them",
        right.r?.ok === true && right.key && right.status?.readable === true && onGm2.plan?.E111slot?.room === "E111-Library-marker"
        && onGm2.plan?.E111slot?.dc === 14 && onGm2.schema?.["1:E111node"]?.label === "E111-the-knife-moved", J({ right, onGm2 }));

    await gm2.eval(`${PRE} await S.keyPlanStore.patch("E111gm2", { room: "E111-gm2-row" }); await E.gmStoresIdle(); return C.flushSeal();`, { timeout: 30000 });
    const openedB = await opened(gm2);
    check("B4: the second computer's change reaches the copy", openedB?.plan?.E111gm2?.room === "E111-gm2-row" && openedB?.plan?.E111slot?.room === "E111-Library-marker",
        J(openedB));

    /* ------------------------------------------------------------------ C */
    phase("C an empty browser does not overwrite a full copy");
    const before = await sealed(gm2);
    const kept = await storageOf("gm2");
    await disconnect("gm2");
    const emptied = { ...kept };
    delete emptied[`${MOD}.gmKeyPlan`];
    delete emptied[`${MOD}.gmCaseSchema`];
    /* The browser comes back alone with its key and its planner's stores gone - as a GM's would after site data was
       cleared but for the key, or the owner's second computer with the planner wiped: its load reads the copy before
       anything may be written, so the copy is never replaced by an empty one. */
    await connect("gm2", { storage: emptied });
    await hydrated(gm2);
    const back = await until(() => planner(gm2), v => Boolean(v.schema?.["1:E111node"]));
    const openedC1 = await opened(gm2);
    check("C1: a GM back alone with its key and an empty planner reads the copy at load: its planner is the copy's, and the copy still holds the whole planner",
        !emptied[`${MOD}.gmKeyPlan`] && Boolean(emptied[`${MOD}.caseSealKey`]) && back.schema?.["1:E111node"]?.label === "E111-the-knife-moved"
        && back.plan?.E111gm2?.room === "E111-gm2-row" && openedC1?.plan?.E111slot?.room === "E111-Library-marker" && openedC1?.plan?.E111gm2?.room === "E111-gm2-row"
        && openedC1?.schema?.["1:E111node"]?.label === "E111-the-knife-moved", J({ before: before?.iv, back, openedC1 }));

    const held = await gm2.eval(`${PRE} C.SEAL_DEPS.hydrated = () => false;
        const before = C.worldSealed()?.iv;
        await S.keyPlanStore.patch("E111held", { room: "E111-held" }); await E.gmStoresIdle();
        const now = await C.sealCaseNow();
        return { before, after: C.worldSealed()?.iv, now, key: Boolean(C.keptKey()) };`, { timeout: 30000 });
    check("C2: with its stores held unhydrated, a write is refused as not hydrated and the copy stands",
        held.key && held.now === "notHydrated" && held.after === held.before, J(held));

    const released = await gm2.eval(`${PRE} C.SEAL_DEPS.hydrated = () => E.gmStoresHydrated();
        const wrote = await C.sealCaseNow(); await E.gmStoresIdle(); return { wrote };`, { timeout: 30000 });
    const openedC = await opened(gm2);
    check("C3: hydrated again, the write goes: the copy holds the whole planner and the new row together",
        released.wrote === "written" && openedC?.schema?.["1:E111node"]?.label === "E111-the-knife-moved"
        && openedC?.plan?.E111slot?.room === "E111-Library-marker" && openedC?.plan?.E111held?.room === "E111-held", J({ released, openedC }));

    /* ------------------------------------------------------------------ D */
    phase("D two GMs, the later stamp, and forgetting");
    await connect("gm", { storage: gmKept });
    await hydrated(gm);
    await hydrated(gm2);
    const gmRead = await gm.eval(`${PRE} return { read: await C.readSealedCopy(), primary: (${imp("utils.mjs")}).isPrimaryGm() };`, { timeout: 30000 });
    await gm.eval(`${PRE} await S.keyPlanStore.patch("E111both", { room: "E111-early-value" }); await E.gmStoresIdle(); return true;`);
    await wait(50);
    await gm2.eval(`${PRE} await S.keyPlanStore.patch("E111both", { room: "E111-late-value" }); await E.gmStoresIdle(); return true;`);
    const merged = await until(() => planner(gm), v => v.plan?.E111both?.room === "E111-late-value");
    const flushed = await gm.eval(`${PRE} await E.gmStoresIdle(); const f = await C.flushSeal(); return f ?? await C.sealCaseNow();`, { timeout: 30000 });
    const openedD = await opened(gm);
    check("D1: the seed GM back (the primary) holds the key it kept and reads the copy gm2 wrote; both write one row, gm2 later, and the copy the primary writes holds gm2's value",
        gmRead.primary === true && ["read", "same"].includes(gmRead.read) && merged.plan?.E111both?.room === "E111-late-value"
        && ["written", "same"].includes(flushed) && openedD?.plan?.E111both?.room === "E111-late-value" && openedD?.plan?.E111held?.room === "E111-held",
        J({ gmRead, flushed, both: openedD?.plan?.E111both ?? null }));

    const forgot = await gm2.eval(`${PRE} const r = await C.forgetCasePassphrase();
        return { r, key: Boolean(C.keptKey()), status: C.sealStatus(), plan: Boolean(S.keyPlanStore.entries().E111slot) };`);
    check("D2: Forget on this browser takes the key off gm2 alone: its case stays, the copy says it cannot read it, the primary still can",
        forgot.r?.ok === true && !forgot.key && forgot.status?.why === "noKey" && forgot.plan && (await gm.eval(`${PRE} return C.sealStatus().readable;`)) === true,
        J(forgot));

    const health = await gm.eval(`${PRE} const h = await S.gmStoreHealth(); return h.rows.find(r => r.id === "sealed") ?? null;`, { timeout: 30000 });
    check("D3: the case's health check names the copy: present, written when and by whom, and readable on this browser",
        health?.key === "DRPG.Case.row.sealedReadable" && health.level === "info" && Boolean(health.data?.who) && health.data.when !== "?", J(health));

    const PASS2 = "E111 harbour copper meadow ninety";
    const changed = await gm.eval(`${PRE} const before = C.worldSealed(); const r = await C.setCasePassphrase(${J(PASS2)});
        const after = C.worldSealed(); return { r, saltChanged: before.kdf.salt !== after.kdf.salt, ivChanged: before.iv !== after.iv, status: C.sealStatus() };`, { timeout: 30000 });
    const oldPass = await opened(gm), newPass = await opened(gm, PASS2);
    check("D4: Change the passphrase encrypts the copy again: a new salt and IV, the old passphrase opens nothing, the new one opens the whole planner, and this browser reads it",
        changed.r?.ok === true && changed.saltChanged && changed.ivChanged && oldPass?.refused === "wrong" && changed.status?.readable === true
        && newPass?.plan?.E111slot?.room === "E111-Library-marker" && newPass?.plan?.E111both?.room === "E111-late-value", J({ changed, oldPass, newPass: Boolean(newPass?.plan) }));

    return { set, debounce, alone, wrong: wrong.r, right: right.r, held, released, flushed };
}
