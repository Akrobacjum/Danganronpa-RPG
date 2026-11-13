/**
 * The old keys `-=` and `==` in one reading (E76 C4, 12.11.2026; the owner's DY7), the body that
 * scenarios 91-old-keys-ignored and 92-old-keys-honoured run, each in its own reading
 * (lib/operators.mjs: "ignored", the module's own measured notes; "honoured", Foundry issue 14806
 * as read for 14.369+). Which one v14 has is LIVE-E76-03.
 *
 *     A  the host: a GM's `-=gone` and `==bookmark` on a world flag - nothing changes ("ignored") or
 *        `gone` is removed and `bookmark` replaced whole ("honoured"), the same on every client, and
 *        each key reported once with the run's reading.
 *     B  what the module promises in both: `_del`, foundry.data.operators' ForcedDeletion and
 *        `unsetFlag` remove (the root rules file, "Delete a key with forcedDeletion() or unsetFlag"; R152).
 *     C  a player's console: p1 writes `{"flags.danganronpa-rpg.-=silencedChapter": null}` on Aiko, the
 *        student p1 owns, after a GM set that GM-only flag (sheet-audit.mjs `GM_FLAGS`). "ignored": the
 *        flag stands as the GM set it on every client. "honoured": the write deletes it, the primary GM
 *        puts it back (sheet-audit.mjs judges a `-=` part as the whole key, `reachOf`) and keeps a row
 *        naming p1. Either way the flag ends as the GM set it.
 */
const MOD = "danganronpa-rpg";

export async function runOldKeys({ gm, p1, check, phase, settle, legacyKeys, IDS, repoUrl }, reading) {
    const read = (c, id, scope) => c.eval(`return foundry.utils.deepClone(game.actors.get("${id}")._source.flags?.["${scope}"] ?? null);`);
    const onBoth = async (id, scope) => ({ gm: await read(gm, id, scope), p1: await read(p1, id, scope) });
    const same = views => JSON.stringify(views.gm) === JSON.stringify(views.p1);
    const write = (c, id, changes) => c.eval(`await game.actors.get("${id}").update(${changes}); return true;`);
    const honoured = reading === "honoured";

    phase(`A: the host's old keys, ${reading}`);
    await write(gm, IDS.daichi, `{ "flags.world.e76probe": { keep: 1, gone: 2, bookmark: { actionKey: "search", itemId: "abc" } } }`);
    const before = legacyKeys.length;
    await write(gm, IDS.daichi, `{ "flags.world.e76probe.-=gone": null, "flags.world.e76probe.==bookmark": { actionKey: "listen" } }`);
    await settle(300);
    const host = await onBoth(IDS.daichi, "world");
    const reported = legacyKeys.slice(before);
    const expected = honoured ? { keep: 1, bookmark: { actionKey: "listen" } } : { keep: 1, gone: 2, bookmark: { actionKey: "search", itemId: "abc" } };
    check(`A (${reading}): a GM's '-=' and '==' on a world flag ${honoured ? "delete and replace" : "change nothing"}, the same on every client`,
        same(host) && JSON.stringify(host.gm?.e76probe) === JSON.stringify(expected), JSON.stringify({ host, expected }));
    check(`A (${reading}): each old key is reported once, with the run's reading and its writer`,
        reported.length === 2 && reported.every(r => r.reading === reading && r.who === "gm")
        && JSON.stringify(reported.map(r => r.path).sort()) === JSON.stringify(["flags.world.e76probe.-=gone", "flags.world.e76probe.==bookmark"]),
        JSON.stringify(reported));
    check(`A (${reading}): no old key is stored as a key of its own`,
        !Object.keys(host.gm?.e76probe ?? {}).some(k => /^(?:-=|==)/.test(k)), JSON.stringify(host));

    phase(`B: the deletes the module spells, ${reading}`);
    await write(gm, IDS.daichi, `{ "flags.world.e76probe": { keep: 1, gone: 2 } }`);
    await write(gm, IDS.daichi, `{ "flags.world.e76probe.gone": _del }`);
    const del = await onBoth(IDS.daichi, "world");
    await write(gm, IDS.daichi, `{ "flags.world.e76probe.keep": foundry.data.operators.ForcedDeletion.create() }`);
    const forced = await onBoth(IDS.daichi, "world");
    await gm.eval(`await game.actors.get("${IDS.daichi}").unsetFlag("world", "e76probe"); return true;`);
    const unset = await onBoth(IDS.daichi, "world");
    check(`B (${reading}): _del, a ForcedDeletion and unsetFlag remove their key on every client`,
        same(del) && !("gone" in (del.gm?.e76probe ?? { gone: 1 })) && del.gm?.e76probe?.keep === 1
        && same(forced) && !("keep" in (forced.gm?.e76probe ?? { keep: 1 }))
        && same(unset) && unset.gm !== null && !("e76probe" in unset.gm), JSON.stringify({ del, forced, unset }));

    phase(`C: a player's '-=' on a GM-only module flag, ${reading}`);
    const SA = `${repoUrl}/scripts/sheet-audit.mjs`;
    /* THE LOAD'S OWN WRITES FIRST (13.11.2026; release run 43397715368, 92 red on 44f9d690 where CI run 43394616656 on
       the same tree was green, C reading {"gm":{},"p1":{}} and []). The cluster starts run() once every client is ready;
       the GM's stores open after its ready and the migration's pass waits for them (module.mjs: neither is awaited), so
       either can still be under way here. Two roads to CI's readings, each made red 3 of 3 on 44f9d690 by a probe not
       committed: (1) a player's write on a student with no mark before the primary's stores hydrate is not judged
       (sheet-audit.mjs `unmarkedWrite`, verdict "mark") - the harness's world holds no mark until the hydration's fill
       (`fillMarks`) - read with the GM's open held 3 s, p1's deletion judged 340 ms before the hydration; (2) since
       1.2.110 the migration's `liftCubWitness` moves an actor's `silencedChapter` into the GMs' cubStore and unsets
       it (monocub.mjs), so a pass that reaches that clause after the GM's 97 takes it off before p1 writes - read with
       the clause held until a flag stood, p1's deletion judged "stands" on a flag already gone. Runs with nothing held
       here had the stores hydrate 1 s before run() on one and after it on another, and the migration's report in A.
       So C waits for what the suite's first reading waits for (tests.mjs `loadSettled`: the stores loaded, the
       migration's pass), then for Aiko's mark, bounded, and says so when they are not there. In the "ignored" reading
       the wait is what makes "no row" a reading of a judged write: without it, road (1) left 91's flag {} as well. */
    const ready = await gm.eval(`const L = await import("${repoUrl}/scripts/gm-stores.mjs"), G = await import("${repoUrl}/scripts/gm-store.mjs");
        const M = await import("${repoUrl}/scripts/migrate.mjs"), end = Date.now() + 30000;
        let timer = null;
        const loaded = await Promise.race([Promise.all([L.whenGmStoresLoaded(), M.migrationOnLoad()]).then(() => true),
            new Promise(r => { timer = setTimeout(() => r(false), 30000); })]);
        clearTimeout(timer);
        while (!(G.gmStoresHydrated() && L.sheetMarkStore.has("${IDS.aiko}")) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await (await import("${SA}")).sheetAuditIdle();
        return { loaded, hydrated: G.gmStoresHydrated(), marked: L.sheetMarkStore.has("${IDS.aiko}") };`);
    check(`C (${reading}): the GM's load has settled - its stores hydrated, Aiko's mark held, the migration's pass done - before the GM's flag and p1's write`,
        ready.loaded === true && ready.hydrated === true && ready.marked === true, JSON.stringify(ready));
    await gm.eval(`await game.actors.get("${IDS.aiko}").setFlag("${MOD}", "silencedChapter", 97); return true;`);
    await settle(400);
    const rowsBefore = await gm.eval(`const A = await import("${SA}"); await A.sheetAuditIdle();
        return A.sheetWrites({ quiet: true }).map(r => r.id + ":" + (r.times ?? 1));`);
    const playerBefore = legacyKeys.length;
    await write(p1, IDS.aiko, `{ "flags.${MOD}.-=silencedChapter": null }`);
    await settle(1500);
    const rows = await gm.eval(`const A = await import("${SA}"); await A.sheetAuditIdle();
        const was = new Set(${JSON.stringify(rowsBefore)});
        return A.sheetWrites({ quiet: true }).filter(r => !was.has(r.id + ":" + (r.times ?? 1)))
            .map(r => ({ verdict: r.verdict, player: r.player, change: r.change, what: r.what ?? null }));`);
    const after = await onBoth(IDS.aiko, MOD);
    const playerReported = legacyKeys.slice(playerBefore).filter(r => r.who === "p1");
    check(`C (${reading}): the GM-only flag ends as the GM set it, on every client`,
        same(after) && after.gm?.silencedChapter === 97, JSON.stringify(after));
    check(`C (${reading}): p1's old key is reported once, with the run's reading`,
        playerReported.length === 1 && playerReported[0].reading === reading
        && playerReported[0].path === `flags.${MOD}.-=silencedChapter`, JSON.stringify(playerReported));
    if (honoured) {
        check("C (honoured): the primary GM keeps a row of the deletion it put back, naming p1",
            rows.length === 1 && rows[0].verdict === "putBack" && rows[0].player === "PlayerOne"
            && rows[0].change === `flags.${MOD}.silencedChapter: 97 -> -`, JSON.stringify(rows));
    } else {
        check("C (ignored): a write that changed nothing leaves the GMs no row",
            rows.length === 0, JSON.stringify(rows));
    }
    await gm.eval(`await game.actors.get("${IDS.aiko}").unsetFlag("${MOD}", "silencedChapter"); return true;`);
    await settle(400);
    const cleared = await onBoth(IDS.aiko, MOD);
    check(`C (${reading}): the GM's unsetFlag takes the flag off again`,
        same(cleared) && cleared.gm !== null && !("silencedChapter" in cleared.gm), JSON.stringify(cleared));
}
