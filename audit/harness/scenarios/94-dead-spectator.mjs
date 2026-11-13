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
 *   revive   the GM revives Chie: p3's browser handed the hook's "return", the watcher and its token gone from every
 *            browser.
 * Everything is put back: Chie alive, the watcher gone, the tokens where they were, the Sound map.
 *
 * What this cannot see: the curtain's drawing (another line's; nothing listens to the hook here), a real LiveKit (the
 * harness's shim), the canvas's 0.3 token, and the sound heard (the harness has no audio: a play is counted).
 */
export const layers = ["ci"];

export async function run({ gm, p1, p3, check, phase, settle, canary, repoUrl: REPO, IDS }) {
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
    const listen = `globalThis.__drpg94 = []; globalThis.__drpg94hook ??= Hooks.on("drpgDeadSpectator", m => globalThis.__drpg94.push(m)); return true;`;
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

    let watcherId = null;
    try {
        phase("secret");
        const before = await p1.eval(WORLD);
        const playedBefore = { p1: await p1.eval(PLAYED), p3: await p3.eval(PLAYED) };
        const killed = await gm.eval(`const C = ${imp("chapter.mjs")}, D = ${imp("spectator-dead.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            const record = await C.killCharacter(chie, { secret: true, keepBullets: true });
            return { record: Boolean(record), watcher: D.watcherActorOf(chie)?.id ?? null };`, { timeout: 60000 });
        watcherId = killed?.watcher ?? null;
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
        const played = { p1: (await p1.eval(PLAYED)) - playedBefore.p1, p3: (await p3.eval(PLAYED)) - playedBefore.p3 };
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

        phase("revive");
        await p3.eval(`globalThis.__drpg94 = []; return true;`);
        await gm.eval(`const C = ${imp("chapter.mjs")}; await C.reviveCharacter(game.actors.get("${IDS.chie}"), { quiet: true }); return true;`, { timeout: 60000 });
        await settle(2000);
        const back = await p3.eval(`return { moments: globalThis.__drpg94, actor: Boolean(game.actors.get("${watcherId}")),
            tokens: [...game.scenes].flatMap(s => [...s.tokens]).filter(t => t.actorId === "${watcherId}").length };`);
        const gone = await p1.eval(`return { actor: Boolean(game.actors.get("${watcherId}")),
            tokens: [...game.scenes].flatMap(s => [...s.tokens]).filter(t => t.actorId === "${watcherId}").length };`);
        check("revive: p3's browser is handed the return; the watcher and its token are gone on p3's and p1's",
            back?.moments?.length === 1 && back.moments[0].phase === "return" && back.moments[0].silent === false
            && back.actor === false && back.tokens === 0 && gone?.actor === false && gone.tokens === 0, JSON.stringify({ back, gone }));
    } finally {
        await gm.eval(`const C = ${imp("chapter.mjs")}, ST = ${imp("settings.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            if (C.isDeadForGm(chie)) await C.reviveCharacter(chie, { quiet: true, silent: true });
            const w = game.actors.get("${watcherId ?? ""}");
            if (w) { for (const s of game.scenes) for (const t of [...s.tokens].filter(t => t.actorId === w.id)) await t.delete(); await w.delete(); }
            await game.scenes.get("${start?.scene}")?.tokens.get("TOKCHIE000000000")?.update({ x: ${start?.x ?? 350}, y: ${start?.y ?? 1300} }, { animate: false });
            await ST.setSetting(ST.SETTINGS.sfxMap, globalThis.__drpg94Sfx ?? {}); delete globalThis.__drpg94Sfx;
            return true;`, { timeout: 60000 });
        const unvolume = `const ST = ${imp("settings.mjs")}; await ST.setSetting(ST.SETTINGS.sfxVolumes, globalThis.__drpg94Vol ?? {}); delete globalThis.__drpg94Vol;
            Hooks.off("drpgDeadSpectator", globalThis.__drpg94hook); delete globalThis.__drpg94hook; delete globalThis.__drpg94; return true;`;
        await p1.eval(unvolume);
        await p3.eval(unvolume);
        await settle(1200);
    }
}
