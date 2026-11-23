/**
 * 22-hide: Hide, an Infiltrate row, across the table (S0-HIDE, E129, 23.11.2026; the owner's request of that day through
 * the coordinator; scripts/hide.mjs).
 *
 * The GM and three players. p1's Aiko is hidden by the primary's own run of `hide.start` (bridge-runs-acts.mjs
 * `handleHideStart`, a GM's packet: its total stands, as the runner leaves a GM's numbers), then read on the browsers each
 * part is about:
 *   refuse   p1 asks `hide.start` for Botan, whom it does not own: refused, nothing hidden;
 *   hide     the GMs' row, the flag on Aiko's token, the module's hold on p1's microphone on the GM (`moduleHoldsMic`);
 *   own      p1's browser: its own token "show" and faded (`hidingAlpha` 0.4), its microphone held ("hiding", `micHold`),
 *            its own hide read off its token (`myHiding`), Hide's row shut ("already"), and the voice tile's Reveal
 *            yourself when a tile stands (`paintUnhide`);
 *   others   p2's browser: Aiko's token "hide", Aiko's player hidden from its voice tile (`voiceVeiledHere`), Aiko out of
 *            its room's people (`seenHere`), Listen's heard list without her (`heardIn`), and the GMs' store not on it;
 *   console  the known leak: a console on p2 lists the token carrying the flag and resolves it to Aiko
 *            (foundry-hiding-token-actor);
 *   cover    while hidden, a Shadow cover stands passed on p1 (`coverWhileHidden`) and not on p2 for Botan;
 *   reveal   p1's Reveal yourself (`requestUnhide`, `mask.reveal` with `of: "hide"`, the real road from p1's page): the row,
 *            the flag and the hold gone, p2 drawing Aiko by the room rule again.
 * Everything is put back: the row, the flag, the microphone's block.
 *
 * What this cannot see: a canvas (the fade and the frame on a real map, LIVE-129-STG-01), a real LiveKit (LIVE-129-STG-03, -04),
 * the hider's own vision on v14 (LIVE-129-STG-02).
 */
export const layers = ["ci"];

export async function run({ gm, p1, p2, check, note, phase, settle, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const MOD = "danganronpa-rpg";
    const p1User = await p1.eval(`return game.user.id;`);

    phase("setup");
    const before = await gm.eval(`const S = ${imp("gm-stores.mjs")};
        const t = canvas.scene.tokens.get("TOKAIKO000000000");
        return { row: Boolean(S.hideStore.get("${IDS.aiko}")), flag: Boolean(t?.flags?.["${MOD}"]?.hiding), token: Boolean(t) };`);
    check("setup: Aiko's token stands and nothing hides her", before?.token === true && before.row === false && before.flag === false, JSON.stringify(before));
    /* p2's verdict on Aiko with the room rule off (`enforcing` false): what the hide alone decides, whichever rooms the two
       stand in - null before and after, "hide" while she hides. The room rule's own verdict is read beside it. */
    const VERDICT = `const V = ${imp("visibility.mjs")}; const doc = canvas.scene.tokens.get("TOKAIKO000000000");
        const here = V.viewerHere(); const off = { gm: here.gm, eclipse: here.eclipse, enforcing: false, rooms: new Set(), lair: null, spectator: false, killersSide: new Set(), owns: here.owns };
        return { off: V.tokenShownTo(doc, off), room: V.tokenShownTo(doc, here) };`;
    const p2Before = await p2.eval(VERDICT);
    check("setup: with the room rule off p2 leaves Aiko's token to Foundry", p2Before?.off === null, JSON.stringify(p2Before));

    try {
        phase("refuse");
        const refused = await p1.eval(`const B = ${imp("bridge-asks.mjs")};
            const res = await B.requestHideStart({ actorId: "${IDS.botan}", total: 20, isCritical: false, rollId: null });
            return { ok: res.ok, refused: Boolean(res.refused), reason: res.reason ?? null };`, { timeout: 30000 });
        await settle(600);
        const botanRow = await gm.eval(`const S = ${imp("gm-stores.mjs")}; return Boolean(S.hideStore.get("${IDS.botan}"));`);
        check("refuse: p1's hide.start for Botan, whom it does not own, is refused and hides nobody",
            refused?.ok === false && refused.refused === true && botanRow === false, JSON.stringify({ refused, botanRow }), { flow: "hide" });

        phase("hide");
        const hid = await gm.eval(`const R = ${imp("bridge-runs-acts.mjs")}, S = ${imp("gm-stores.mjs")}, V = ${imp("voice.mjs")};
            const out = await R.handleHideStart({ actorId: "${IDS.aiko}", total: 18, isCritical: false, rollId: null }, game.user);
            await new Promise(r => setTimeout(r, 600));
            const t = canvas.scene.tokens.get("TOKAIKO000000000");
            return { out, row: Boolean(S.hideStore.get("${IDS.aiko}")), owners: S.hideStore.get("${IDS.aiko}")?.userIds ?? [],
                flag: t?.flags?.["${MOD}"]?.hiding === true, hidden: t?.hidden === true, mic: V.moduleHoldsMic(game.users.get("${p1User}"), { trial: false })?.reason ?? null };`, { timeout: 60000 });
        await settle(1200);
        check("hide: the primary hides Aiko on 18 - the GMs' row naming p1, the flag on her token and no Foundry hidden, p1's microphone held",
            hid?.out?.reply?.hidden === true && hid.row === true && hid.owners.includes(p1User) && hid.flag === true && hid.hidden === false && hid.mic === "hiding",
            JSON.stringify(hid), { flow: "hide" });

        phase("own");
        const own = await p1.eval(`const V = ${imp("visibility.mjs")}, H = ${imp("hide.mjs")}, VO = ${imp("voice.mjs")}, T = ${imp("voice-tile.mjs")};
            const doc = canvas.scene.tokens.get("TOKAIKO000000000"), aiko = game.actors.get("${IDS.aiko}");
            const tile = document.getElementById("drpg-voice-tile");
            if (tile) T.paintControls();
            return { shown: V.tokenShownTo(doc, V.viewerHere()), alpha: H.hidingAlpha(doc, { owns: doc.isOwner }), mic: VO.micHold()?.reason ?? null,
                mine: H.myHiding()?.id ?? null, shut: H.hideShutWhy(aiko) === game.i18n.localize("DRPG.Hide.already"),
                tile: Boolean(tile), button: tile ? Boolean(tile.querySelector(".drpg-voice-unhide")) : null };`);
        check("own: p1 draws its own Aiko, faded to 0.4, its microphone held as hiding, its own hide read off the token, and Hide's row shut as already hidden",
            own?.shown === "show" && own.alpha === 0.4 && own.mic === "hiding" && own.mine === IDS.aiko && own.shut === true, JSON.stringify(own), { flow: "hide" });
        if (own?.tile) check("own: p1's voice tile carries Reveal yourself while Aiko hides", own.button === true, JSON.stringify(own));
        else note("own: no voice tile stands on p1 in this run, so its Reveal yourself is read by R8905 alone", JSON.stringify(own));

        phase("others");
        const others = await p2.eval(`const V = ${imp("visibility.mjs")}, K = ${imp("mask-gm.mjs")}, S = ${imp("gm-stores.mjs")}, L = ${imp("action-listen.mjs")}, M = ${imp("movement.mjs")};
            const doc = canvas.scene.tokens.get("TOKAIKO000000000"), aiko = game.actors.get("${IDS.aiko}"), botan = game.actors.get("${IDS.botan}");
            const room = M.roomOfToken(doc);
            const heard = room ? L.heardIn(room, botan, canvas.scene, () => [aiko, botan]).map(a => a.id) : null;
            const here = V.viewerHere(); const off = { gm: here.gm, eclipse: here.eclipse, enforcing: false, rooms: new Set(), lair: null, spectator: false, killersSide: new Set(), owns: here.owns };
            return { shown: V.tokenShownTo(doc, off), voice: V.voiceVeiledHere(game.users.get("${p1User}")),
                seen: K.seenHere([aiko, botan]).map(a => a.id), heard, store: Object.keys(S.hideStore.entries() ?? {}).length };`);
        check("others: with the room rule off, p2 does not draw Aiko, its voice tile hides her player, its room's people and Listen leave her out, and the GMs' store is not on p2",
            others?.shown === "hide" && others.voice === true && !others.seen.includes(IDS.aiko) && others.seen.includes(IDS.botan)
                && (others.heard === null || !others.heard.includes(IDS.aiko)) && others.store === 0, JSON.stringify(others), { flow: "hide" });

        phase("console");
        const consoleRead = await p2.eval(`const tokens = game.scenes.contents.flatMap(s => [...s.tokens]);
            return tokens.filter(t => t.flags?.["${MOD}"]?.hiding).map(t => game.actors.get(t.actorId)?.name ?? null);`);
        const aikoName = await gm.eval(`return game.actors.get("${IDS.aiko}").name;`);
        check("a hiding token's actor is read from a player's console - on p2 the token carrying Hide's flag resolves to the hidden character",
            !(consoleRead ?? []).includes(aikoName), JSON.stringify({ consoleRead }),
            { knownLeak: "foundry-hiding-token-actor", measured: hid?.flag === true && Array.isArray(consoleRead) });

        phase("cover");
        const cover = await p1.eval(`const H = ${imp("hide.mjs")}; const c = H.coverWhileHidden(game.actors.get("${IDS.aiko}"));
            return c && { total: c.total, hidden: c.hidden, isCritical: c.isCritical };`);
        const notCover = await p2.eval(`const H = ${imp("hide.mjs")}; return H.coverWhileHidden(game.actors.get("${IDS.botan}"));`);
        const coverTotal = await gm.eval(`const C = ${imp("config.mjs")}; return C.INFILTRATE.hide.coverTotal;`);
        check("cover: while Aiko hides her Shadow cover stands passed on p1, and Botan, who does not hide, throws his on p2",
            cover?.hidden === true && cover.total === coverTotal && cover.isCritical === false && notCover === null, JSON.stringify({ cover, notCover }), { flow: "hide" });

        phase("reveal");
        const pressed = await p1.eval(`const H = ${imp("hide.mjs")}; return await H.requestUnhide();`, { timeout: 30000 });
        await settle(1500);
        const after = await gm.eval(`const S = ${imp("gm-stores.mjs")}, V = ${imp("voice.mjs")};
            const t = canvas.scene.tokens.get("TOKAIKO000000000");
            return { row: Boolean(S.hideStore.get("${IDS.aiko}")), flag: Boolean(t?.flags?.["${MOD}"]?.hiding), mic: V.moduleHoldsMic(game.users.get("${p1User}"), { trial: false })?.reason ?? null };`);
        const seenAgain = await p2.eval(VERDICT);
        const micAgain = await p1.eval(`const VO = ${imp("voice.mjs")}; return VO.micHold()?.reason ?? null;`);
        check("reveal: p1's Reveal yourself ends the hide on the primary - no row, no flag, no hold - and p2 draws Aiko as it did before the hide",
            pressed === true && after?.row === false && after.flag === false && after.mic !== "hiding" && seenAgain?.off === null && seenAgain.room === p2Before.room && micAgain !== "hiding",
            JSON.stringify({ pressed, after, seenAgain, micAgain }), { flow: "hide" });

        phase("gm");
        /* A GM's reveal is told in the hider's corner (the owner's 23.11.2026: "notice o ujawnieniu niech bedzie w lewym
           dolnym rogu jak reszta powiadomien"): no chat message; p1's notice stack holds the words, p2's does not. */
        const NOTICES = `return [...document.querySelectorAll(".drpg-popup")].map(el => el.textContent.replace(/\\s+/g, " ").trim());`;
        await gm.eval(`const R = ${imp("bridge-runs-acts.mjs")};
            await R.handleHideStart({ actorId: "${IDS.aiko}", total: 18, isCritical: false, rollId: null }, game.user); return true;`, { timeout: 60000 });
        await settle(1000);
        const messagesBefore = await gm.eval(`return game.messages.size;`);
        const gmEnd = await gm.eval(`const H = ${imp("hide.mjs")}; return await H.gmUnhide("${IDS.aiko}");`, { timeout: 60000 });
        await settle(1500);
        const words = await gm.eval(`return game.i18n.localize("DRPG.Hide.ended.gm");`);
        const told = { p1: await p1.eval(NOTICES), p2: await p2.eval(NOTICES), messages: (await gm.eval(`return game.messages.size;`)) - messagesBefore };
        check("gm: a GM's reveal ends the hide and is told in p1's corner of notices alone, with no chat message",
            gmEnd === true && told.p1.some(text => text.includes(words)) && !told.p2.some(text => text.includes(words)) && told.messages === 0,
            JSON.stringify({ gmEnd, told }), { flow: "hide" });
    } finally {
        await gm.eval(`const H = ${imp("hide.mjs")}, S = ${imp("gm-stores.mjs")}, V = ${imp("voice.mjs")}, U = ${imp("utils.mjs")};
            for (const id of ["${IDS.aiko}", "${IDS.botan}"]) if (S.hideStore.get(id)) await H.endHide(id, "reveal");
            for (const t of canvas.scene.tokens) if (t.flags?.["${MOD}"]?.hiding) await t.update(H.unhidePatch(U.forcedDeletion()));
            for (const t of canvas.scene.tokens) if (t.flags?.["${MOD}"]?.hideEnd !== undefined) await t.update({ ["flags.${MOD}.hideEnd"]: U.forcedDeletion() });
            await V.settleTrialVoices();
            return true;`, { timeout: 60000 });
        await settle(800);
    }
}
