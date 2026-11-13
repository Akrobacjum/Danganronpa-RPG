/**
 * 94-dead-spectator: a dead student watches as a Spectator, from the death to the revive (E62 C3b, 13.11.2026;
 * docs/dev/e62/STORYBOARD-C3.md on the e62-c3 line, e64968c6, the owner's answers to Q-C3b-1..6).
 *
 * The GM and three players; p3's Chie is killed as the GMs keep a death (chapter.mjs `killCharacter`, `secret: true`), in
 * play (not silent), and read on the browsers that each part is about:
 *   secret   p1's world data before and after the kill: what is new is one actor (the watcher: E92's flag, no link) and
 *            one token, and nothing of Chie's own or of any module world setting changed (the owner's accepted
 *            trade-off, Q-C3b-1: the watcher itself is world data); p1's world read against world-secrets.mjs and for Chie's id;
 *   moment   p3's browser was handed the curtain's hook (`drpgDeadSpectator`, phase "fade", not silent) and played the
 *            Death fade once (`sfx.played`, the row mapped for the run), p1's neither;
 *   seen     p1's browser hides the watcher's token, p3's shows it (visibility.mjs `tokenShownTo`);
 *   view     p3 drags the watcher into Aiko's room (its own write): Aiko's token stays hidden on p3's browser - the dead
 *            see what a dead student saw, not what the Spectator's token walks into (B);
 *   voice    the primary sends p3 to the Spectators' room (voice.mjs `voiceTargets`, Q-C3b-5);
 *   monocub  the death made the table's and Chie a Monocub (the coordinator's 7): her Spectator token is her Monocub's and
 *            where she stands; p3 cannot drag the corpse; Aiko in the corpse's room stays hidden on p3's browser;
 *            then a Monocub no more, a Spectator back on that token;
 *   curtain  p3's curtain (death-fade.mjs): bare after the fade and p1's not, lit after the Monocub's return, bare again at
 *            once a Monocub no more, lit after the revive;
 *   notoken  (after the revive) p2's Botan, his token taken off the map, killed at once and revived: p2's curtain bare and
 *            lit again by the death's flag alone, no token's moment (the e93 line's G1);
 *   revive   the GM revives Chie: p3's browser handed the hook's "return", the watcher and its token gone from every
 *            browser.
 * Everything is put back: Chie alive, the watcher gone, the tokens where they were, the Sound map.
 *
 * What this cannot see: the curtain's drawing (another line's; nothing listens to the hook here), a real LiveKit (the
 * harness's shim), the canvas's 0.3 token, and the sound heard (the harness has no audio: a play is counted).
 */
export const layers = ["ci"];

export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const p3User = await p3.eval(`return game.user.id;`);
    const PLAYED = `const C = ${imp("perf-counters.mjs")}; return C.snapshot()["sfx.played"] ?? 0;`;
    const WORLD = `const mod = "danganronpa-rpg";
        const settings = {};
        for (const [key, s] of game.settings.settings) if (key.startsWith(mod + ".") && s.scope === "world") {
            try { settings[key] = JSON.stringify(game.settings.get(mod, key.slice(mod.length + 1))); } catch { settings[key] = "(unread)"; } }
        return { actors: game.actors.contents.map(a => [a.id, JSON.stringify(a.flags?.[mod] ?? {})]),
            tokens: [...game.scenes].flatMap(s => [...s.tokens].map(t => [t.id, t.actorId, JSON.stringify(t.flags?.[mod] ?? {})])), settings };`;

    phase("setup");
    const listen = `globalThis.__drpg94 = []; globalThis.__drpg94hook ??= Hooks.on("drpgDeadSpectator", m => globalThis.__drpg94.push(m));
        globalThis.__drpg94opts = []; globalThis.__drpg94optsHook ??= Hooks.on("createToken", (t, o) => { if (o?.drpgDeadSpectator) globalThis.__drpg94opts.push(o.drpgDeadSpectator); });
        return true;`;
    await p1.eval(listen);
    await p3.eval(listen);
    const sfx = await gm.eval(`const SFX = ${imp("sfx.mjs")}, ST = ${imp("settings.mjs")};
        globalThis.__drpg94Sfx = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.sfxMap) ?? {});
        await SFX.setSoundFor("deathFade", "sounds/s94-fade.ogg"); return SFX.soundFor("deathFade");`, { timeout: 60000 });
    const volume = `const SFX = ${imp("sfx.mjs")}, ST = ${imp("settings.mjs")};
        globalThis.__drpg94Vol = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.sfxVolumes) ?? {}); await SFX.setSfxVolume("sound", 0.8); return SFX.sfxVolume("sound");`;
    await p1.eval(volume);
    await p3.eval(volume);
    const start = await gm.eval(`const t = canvas.scene.tokens.get("TOKCHIE000000000"); return { x: t.x, y: t.y, scene: canvas.scene.id };`);
    check("setup: the Death fade mapped for the run, Chie's token read", sfx === "sounds/s94-fade.ogg" && Number.isFinite(start?.x), JSON.stringify({ sfx, start }));
    await settle(800);

    let watcherId = null, watcherToken = null, noToken = null;
    try {
        phase("secret");
        const before = await p1.eval(WORLD);
        const playedBefore = { p1: await p1.eval(PLAYED), p3: await p3.eval(PLAYED) };
        const killed = await gm.eval(`const C = ${imp("chapter.mjs")}, D = ${imp("spectator-dead.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            const record = await C.killCharacter(chie, { secret: true, keepBullets: true });
            return { record: Boolean(record), watcher: D.watcherActorOf(chie)?.id ?? null };`, { timeout: 60000 });
        watcherId = killed?.watcher ?? null;
        watcherToken = await gm.eval(`return [...canvas.scene.tokens].find(t => t.actorId === "${killed?.watcher ?? ""}")?.id ?? null;`);
        await settle(2000);
        const after = await p1.eval(WORLD);
        const was = new Map(before.actors), wasTok = new Set(before.tokens.map(t => t[0]));
        const newActors = after.actors.filter(([id]) => !was.has(id));
        const changedActors = after.actors.filter(([id, f]) => was.has(id) && was.get(id) !== f).map(([id]) => id);
        const newTokens = after.tokens.filter(([id]) => !wasTok.has(id));
        const changedSettings = Object.keys(after.settings).filter(k => after.settings[k] !== before.settings[k]);
        check("secret: a kept death leaves p1's world one new actor (the watcher, E92's flag alone) and its one token, nothing of Chie's changed and no module world setting",
            killed?.record === true && Boolean(watcherId) && newActors.length === 1 && newActors[0][0] === watcherId
            && newActors[0][1] === JSON.stringify({ spectator: true }) && changedActors.length === 0
            && newTokens.length === 1 && newTokens[0][1] === watcherId && changedSettings.length === 0,
            JSON.stringify({ killed, newActors, changedActors, newTokens, changedSettings }));
        await canary.worldScan({ who: ["p1"], ids: [IDS.chie] });

        phase("moment");
        const moments = { p1: await p1.eval(`return globalThis.__drpg94;`), p3: await p3.eval(`return globalThis.__drpg94;`) };
        // What every browser is handed with the token (the e93 review's F2): the phase and the silence, no student's id.
        const handed = await p1.eval(`return globalThis.__drpg94opts;`);
        check("moment: p1's browser is handed the token's option with no student's id in it (the e93 review's F2)",
            handed?.length === 1 && Object.keys(handed[0]).sort().join(",") === "phase,silent", JSON.stringify(handed));
        const played = { p1: (await p1.eval(PLAYED)) - playedBefore.p1, p3: (await p3.eval(PLAYED)) - playedBefore.p3 };
        // The curtain's fade is 3.6 s on p3's browser (death-fade.mjs); 2 s have passed since the kill.
        await settle(2200);
        const BARE = `return document.body.classList.contains("drpg-bare-glass");`;
        const curtain = { p3: await p3.eval(BARE), p1: await p1.eval(BARE) };
        check("curtain: after the fade p3's curtain rests bare (drpg-bare-glass), p1's not (E62 C3)", curtain.p3 === true && curtain.p1 === false, JSON.stringify(curtain));
        check("moment: p3's browser is handed the fade, not silent, and plays the Death fade once; p1's neither",
            moments.p3?.length === 1 && moments.p3[0].phase === "fade" && moments.p3[0].silent === false && moments.p3[0].studentId === IDS.chie
            && moments.p1?.length === 0 && played.p3 === 1 && played.p1 === 0, JSON.stringify({ moments, played }));

        phase("seen");
        const shown = c => c.eval(`const V = ${imp("visibility.mjs")};
            const t = [...canvas.scene.tokens].find(t => t.actorId === "${watcherId}");
            return t ? V.tokenShownTo(t, V.viewerHere()) : "no token";`);
        const seen = { p1: await shown(p1), p3: await shown(p3) };
        check("seen: p1's browser hides the watcher's token, p3's shows it", seen.p1 === "hide" && seen.p3 === "show", JSON.stringify(seen));

        phase("view");
        const drag = await p3.eval(`try { const t = [...canvas.scene.tokens].find(t => t.actorId === "${watcherId}");
            await t.update({ x: 400, y: 400 }); return { ok: true }; } catch (err) { return { ok: false, err: String(err?.message ?? err) }; }`);
        await settle(1500);
        const view = await p3.eval(`const V = ${imp("visibility.mjs")}, M = ${imp("movement.mjs")};
            const t = [...canvas.scene.tokens].find(t => t.actorId === "${watcherId}");
            return { room: t ? M.roomOfToken(t) : null, aiko: V.tokenShownTo(canvas.scene.tokens.get("TOKAIKO000000000"), V.viewerHere()) };`);
        check("view: p3 walks the watcher into Aiko's room, and Aiko's token stays hidden on p3's browser",
            drag?.ok === true && view?.room === "Dorm A" && view.aiko === "hide", JSON.stringify({ drag, view }));

        phase("voice");
        const voice = await gm.eval(`const V = ${imp("voice.mjs")}, VC = ${imp("voice-client.mjs")};
            const plan = await V.voiceTargets(); const row = plan.byUser.get("${p3User}");
            return { target: row?.target ?? null, spectators: VC.SPECTATOR_ROOM, actor: row?.actor?.id ?? null };`, { timeout: 60000 });
        check("voice: the primary sends p3, dead, to the Spectators' room, as Chie and not as the watcher",
            voice?.target === voice?.spectators && voice.actor === IDS.chie, JSON.stringify(voice));

        phase("monocub");
        /* The coordinator's 7 (13.11.2026): after the conversion the Monocub's token is the student's place, and the corpse
           is neither a walker of p3's nor an eye of p3's. The death made the table's and Chie made a Monocub; the GM
           stands Aiko in the corpse's room (Dorm B) while the Monocub's token stands in Dorm A, and p3 tries to drag the
           corpse. Then Chie is a Monocub no more, and the revive below takes the Spectator she is given back. */
        const cubbed = await gm.eval(`const C = ${imp("chapter.mjs")}, MC = ${imp("monocub.mjs")}, M = ${imp("movement.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            await C.publishDeath(chie); await MC.setMonocub(chie, true, { quiet: true });
            const cub = canvas.scene.tokens.get("${watcherToken ?? ""}");
            await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 350, y: 1400 }, { animate: false });
            return { cub: cub?.actorId === chie.id, located: M.locateActor(chie)?.tokenDoc?.id ?? null };`, { timeout: 60000 });
        await settle(1500);
        const corpseDrag = await p3.eval(`const t = canvas.scene.tokens.get("TOKCHIE000000000"); const was = [t.x, t.y];
            try { await t.update({ x: 1400, y: 400 }); } catch { /* refused */ }
            await new Promise(r => setTimeout(r, 600));
            const now = canvas.scene.tokens.get("TOKCHIE000000000"); return { stayed: now.x === was[0] && now.y === was[1] };`);
        await settle(1200);
        const eye = await p3.eval(`const V = ${imp("visibility.mjs")};
            return V.tokenShownTo(canvas.scene.tokens.get("TOKAIKO000000000"), V.viewerHere());`);
        const litAsCub = await p3.eval(BARE);
        check("monocub: Chie's Spectator token becomes her Monocub's and is where she stands; p3 cannot drag the corpse, and Aiko in the corpse's room stays hidden on p3's browser",
            cubbed?.cub === true && cubbed.located === watcherToken && corpseDrag?.stayed === true && eye === "hide", JSON.stringify({ cubbed, corpseDrag, eye }));
        check("curtain: after the Monocub's return p3's curtain is lit again (E62 C3)", litAsCub === false, JSON.stringify({ litAsCub }));
        const unCub = await gm.eval(`const MC = ${imp("monocub.mjs")}, D = ${imp("spectator-dead.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 300, y: 300 }, { animate: false });
            await MC.setMonocub(chie, false, { quiet: true });
            return D.watcherActorOf(chie)?.id ?? null;`, { timeout: 60000 });
        watcherId = unCub ?? watcherId;
        await settle(1200);
        const bareAgain = await p3.eval(BARE);
        check("curtain: a Monocub no more, p3's curtain is bare again at once (SB-C3 #10)", bareAgain === true, JSON.stringify({ bareAgain }));

        phase("revive");
        await p3.eval(`globalThis.__drpg94 = []; return true;`);
        await gm.eval(`const C = ${imp("chapter.mjs")}; await C.reviveCharacter(game.actors.get("${IDS.chie}"), { quiet: true }); return true;`, { timeout: 60000 });
        await settle(3000);
        const litBack = await p3.eval(BARE);
        const back = await p3.eval(`return { moments: globalThis.__drpg94, actor: Boolean(game.actors.get("${watcherId}")),
            tokens: [...game.scenes].flatMap(s => [...s.tokens]).filter(t => t.actorId === "${watcherId}").length };`);
        const gone = await p1.eval(`return { actor: Boolean(game.actors.get("${watcherId}")),
            tokens: [...game.scenes].flatMap(s => [...s.tokens]).filter(t => t.actorId === "${watcherId}").length };`);
        check("revive: p3's browser is handed the return; the watcher and its token are gone on p3's and p1's",
            back?.moments?.length === 1 && back.moments[0].phase === "return" && back.moments[0].silent === false
            && back.actor === false && back.tokens === 0 && gone?.actor === false && gone.tokens === 0, JSON.stringify({ back, gone }));
        check("curtain: after the revive p3's curtain is lit again (E62 C3)", litBack === false, JSON.stringify({ litBack }));

        phase("notoken");
        /* The e93 line's G1 (13.11.2026): a public death of a student whose body has no token makes no Spectator token, so
           no moment reaches its player's curtain - the rest state follows the death's flag itself. p2's Botan, his token
           taken off the map for the part, killed at once and revived; p2's curtain read after each. */
        noToken = await gm.eval(`const t = canvas.scene.tokens.get("TOKBOTAN00000000"); const data = t?.toObject() ?? null;
            if (t) await t.delete(); return data;`, { timeout: 60000 });
        await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.botan}"), { secret: false, keepBullets: true }));`, { timeout: 60000 });
        await settle(2500);
        const bareNoToken = await p2.eval(BARE);
        await gm.eval(`const C = ${imp("chapter.mjs")}; await C.reviveCharacter(game.actors.get("${IDS.botan}"), { quiet: true }); return true;`, { timeout: 60000 });
        await settle(2500);
        const litNoToken = await p2.eval(BARE);
        check("curtain: a public death whose body has no token turns p2's curtain bare, and the revive lights it again (the e93 line's G1)",
            bareNoToken === true && litNoToken === false, JSON.stringify({ bareNoToken, litNoToken }));
    } finally {
        await gm.eval(`const C = ${imp("chapter.mjs")}, ST = ${imp("settings.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            if (C.isDeadForGm(chie)) await C.reviveCharacter(chie, { quiet: true, silent: true });
            const w = game.actors.get("${watcherId ?? ""}");
            if (w) { for (const s of game.scenes) for (const t of [...s.tokens].filter(t => t.actorId === w.id)) await t.delete(); await w.delete(); }
            for (const s of game.scenes) for (const t of [...s.tokens].filter(t => t.actorId === chie.id && t.id !== "TOKCHIE000000000")) await t.delete();
            if (chie.getFlag("danganronpa-rpg", "monocub")) await chie.unsetFlag("danganronpa-rpg", "monocub");
            await game.scenes.get("${start?.scene}")?.tokens.get("TOKAIKO000000000")?.update({ x: 300, y: 300 }, { animate: false });
            await game.scenes.get("${start?.scene}")?.tokens.get("TOKCHIE000000000")?.update({ x: ${start?.x ?? 350}, y: ${start?.y ?? 1300} }, { animate: false });
            await ST.setSetting(ST.SETTINGS.sfxMap, globalThis.__drpg94Sfx ?? {}); delete globalThis.__drpg94Sfx;
            const botan = game.actors.get("${IDS.botan}");
            if (C.isDeadForGm(botan)) await C.reviveCharacter(botan, { quiet: true, silent: true });
            for (const a of game.actors.filter(a => a.getFlag("danganronpa-rpg", "watcherOf") === botan.id)) await a.delete();
            return true;`, { timeout: 60000 });
        if (noToken) await gm.eval(`const data = ${JSON.stringify(noToken)}; if (!canvas.scene.tokens.get(data._id)) await canvas.scene.createEmbeddedDocuments("Token", [data], { keepId: true }); return true;`, { timeout: 60000 });
        const unvolume = `const ST = ${imp("settings.mjs")}; await ST.setSetting(ST.SETTINGS.sfxVolumes, globalThis.__drpg94Vol ?? {}); delete globalThis.__drpg94Vol;
            Hooks.off("drpgDeadSpectator", globalThis.__drpg94hook); delete globalThis.__drpg94hook; delete globalThis.__drpg94;
            Hooks.off("createToken", globalThis.__drpg94optsHook); delete globalThis.__drpg94optsHook; delete globalThis.__drpg94opts; return true;`;
        await p1.eval(unvolume);
        await p3.eval(unvolume);
        await settle(1200);
    }
}
