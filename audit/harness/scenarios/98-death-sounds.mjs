/**
 * 98-death-sounds: which sounds one death plays, road by road and browser by browser (the auditor's A113-C2-5 and
 * A113-C2-1, the audit-113 line, 107dd82f; the coordinator's default for the owner, 13.11.2026: one sound per moment per
 * browser, the most specific one winning - an execution plays `execution`, the trial's close `trialClose` after it, and a
 * death in play `deathFade` on the victim's browser and `death` on the others', never both on one browser).
 *
 * Each sound of a death is mapped to a file of its own for the run (`death`, `deathFade`, `execution`, `trialClose`), the
 * Sound slider at 0.8 on every browser, and every file handed to Foundry's audio layer is recorded on each browser (the
 * harness has no audio: a hand-off is counted, not a sound heard; `sfx.played` is read beside it, so a play by any other
 * road shows as a difference). Chie (p3's) dies by each road; the GM, p3 (the victim's player), p1 (Aiko's, the incident's killer) and p2 are read.
 * Measured at 9ad2174e before the fix: the incident's kill gave p3 deathFade + death, and the living convict's execution
 * gave the GM death + execution + trialClose and p3 deathFade + execution + trialClose; the kept convict's execution and
 * the Kill outside an incident were one sound a moment already. The roads:
 *   incident   the running incident's victim killed by the engine (chapter.mjs `killCharacter`, kept by the GMs: the death's
 *              sound to the incident's audience by `playSfxForUsers`, the Spectator's fade on p3);
 *   incidentPublic  the GM's Kill with the box unticked inside the incident (`secret: false`: the GMs' card's `death`, whispered
 *              to the incident's audience, the victim's player among them);
 *   kill       the Students window's Kill outside an incident (`killCharacter`, `secret: false`: the GMs' card's `death`);
 *   execution  a sentenced student alive, the trial ended (trial-floor-ui.mjs `closeTrial` -> trial-progress.mjs
 *              `executeAtExit` -> `killCharacter`; the execution's card, then the close's card);
 *   executionKept  the same for a death the GMs kept (`executeAtExit` -> `publishDeath`).
 * The coordinator's rule is held per road and browser below, and everything put back: Chie alive, the incident and the
 * trial's record as they were, the clock, the Sound map and the sliders.
 */
export const layers = ["ci"];
export const timeoutMs = 300000;

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const MOD = "danganronpa-rpg";
    const KEYS = ["death", "deathFade", "execution", "trialClose"];
    const fileOf = key => `sounds/s98-${key}.ogg`;
    const who = { gm, p1, p2, p3 };
    const RECORD = `globalThis.__s98 = []; const H = foundry.audio.AudioHelper;
        if (!globalThis.__s98Real) { globalThis.__s98Real = H.play; H.play = async (data, ...rest) => { globalThis.__s98?.push(String(data?.src ?? "")); return globalThis.__s98Real.call(H, data, ...rest); }; }
        const C = ${imp("perf-counters.mjs")}; globalThis.__s98Played = C.snapshot()["sfx.played"] ?? 0; return true;`;
    const READ = `const C = ${imp("perf-counters.mjs")};
        return { files: [...(globalThis.__s98 ?? [])], played: (C.snapshot()["sfx.played"] ?? 0) - (globalThis.__s98Played ?? 0) };`;
    const keyOf = src => KEYS.find(k => src === fileOf(k)) ?? src;
    const begin = async () => { for (const c of Object.values(who)) await c.eval(RECORD); };
    const heard = async () => {
        const out = {};
        for (const [name, c] of Object.entries(who)) {
            const r = await c.eval(READ);
            out[name] = { keys: (r?.files ?? []).map(keyOf), played: r?.played ?? null };
        }
        return out;
    };
    const line = (road, h) => `[98] ${road}: ` + Object.entries(h).map(([n, r]) => `${n} ${r.keys.join("+") || "-"}${r.played !== r.keys.length ? ` (sfx.played ${r.played})` : ""}`).join("; ");
    const REVIVE = `const C = ${imp("chapter.mjs")}; const chie = game.actors.get("${IDS.chie}");
        if (C.isDeadForGm(chie)) await C.reviveCharacter(chie, { quiet: true, silent: true });
        for (const a of game.actors.filter(a => a.getFlag("${MOD}", "watcherOf") === chie.id || (a.getFlag("${MOD}", "spectator") && a.name === chie.name))) {
            for (const s of game.scenes) for (const t of [...s.tokens].filter(t => t.actorId === a.id)) await t.delete();
            await a.delete(); }
        return true;`;
    /* One sound per moment and browser (the coordinator's default): `want` maps each browser to its keys in order. */
    const hold = (road, h, want) => {
        const got = Object.fromEntries(Object.entries(h).map(([n, r]) => [n, r.keys]));
        check(`${road}: each browser hears ${Object.entries(want).map(([n, k]) => `${n} ${k.join(" then ") || "nothing"}`).join(", ")}`,
            JSON.stringify(got) === JSON.stringify(want) && Object.values(h).every(r => r.played === r.keys.length), JSON.stringify(h));
    };

    /* The incident read where the kill reads it, once it has reached the stage the kill is made in. The killer's opening
       roll is resolved at a success (as 10-murder does): a failed one ends the incident before the kill. */
    const AUDIENCE = `const M = ${imp("murder.mjs")};
        for (let i = 0; i < 60 && M.murderState()?.stage !== "incident"; i++) await new Promise(r => setTimeout(r, 100));
        const st = M.murderState(); return { stage: st?.stage ?? null, audience: M.incidentAudienceIds(st) };`;
    const p1User = await p1.eval(`return game.user.id;`), p3User = await p3.eval(`return game.user.id;`);

    phase("setup");
    const saved = await gm.eval(`const ST = ${imp("settings.mjs")}, SFX = ${imp("sfx.mjs")};
        globalThis.__s98Map = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.sfxMap) ?? {});
        globalThis.__s98Clock = foundry.utils.deepClone(game.settings.get("${MOD}", "clock"));
        globalThis.__s98Trial = foundry.utils.deepClone(game.settings.get("${MOD}", "trialProgress") ?? {});
        for (const key of ${JSON.stringify(KEYS)}) await SFX.setSoundFor(key, "sounds/s98-" + key + ".ogg");
        return ${JSON.stringify(KEYS)}.map(k => SFX.soundFor(k));`, { timeout: 60000 });
    for (const c of Object.values(who)) await c.eval(`const SFX = ${imp("sfx.mjs")}, ST = ${imp("settings.mjs")};
        globalThis.__s98Vol = foundry.utils.deepClone(ST.getSetting(ST.SETTINGS.sfxVolumes) ?? {}); await SFX.setSfxVolume("sound", 0.8); return true;`);
    check("setup: each sound of a death mapped to its own file for the run", JSON.stringify(saved) === JSON.stringify(KEYS.map(fileOf)), JSON.stringify(saved));
    await settle(1200);
    const table = {};

    try {
        phase("incident");
        const opened = await gm.eval(`const r = await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.chie}", openingTrait: "body" });
            await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            return { r: Boolean(r), stage: game.drpg.murderState()?.stage ?? null };`, { timeout: 60000 });
        await settle(1500);
        await begin();
        const aud = await gm.eval(AUDIENCE, { timeout: 30000 });
        check("incident: the incident stands at its stage \"incident\" with Aiko's and Chie's players in its audience before the kill",
            aud?.stage === "incident" && [p1User, p3User].every(id => aud.audience?.includes(id)), JSON.stringify(aud));
        await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}")));`, { timeout: 60000 });
        await settle(2500);
        table.incident = await heard();
        console.log(line("incident", table.incident));
        check("incident: the murder opened over Chie", opened?.r === true, JSON.stringify(opened));
        hold("incident (a death in play)", table.incident, { gm: ["death"], p1: ["death"], p2: [], p3: ["deathFade"] });
        await gm.eval(`const M = ${imp("murder-rules.mjs")}; await M.endMurder({ reason: "closed", followUp: false, conclude: false }); return game.drpg.murderState()?.active ?? null;`, { timeout: 60000 });
        await gm.eval(REVIVE, { timeout: 60000 });
        await settle(1500);

        phase("incidentPublic");
        /* The GM's Kill with the box unticked inside the incident: the death public at once, its sound on the GMs' card to the
           incident's audience, which the victim's player is in - the card's flag leaves them out (`not`). */
        const reopened = await gm.eval(`const r = await game.drpg.openMurder({ killerId: "${IDS.aiko}", victimId: "${IDS.chie}", openingTrait: "body" });
            await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            const st = game.drpg.murderState(); return { r: Boolean(r), active: st?.active ?? null, stage: st?.stage ?? null, victim: st?.victimId ?? null };`, { timeout: 60000 });
        await settle(1500);
        const aud2 = await gm.eval(AUDIENCE, { timeout: 30000 });
        check("incidentPublic: a murder opened over Chie again, at its stage \"incident\" with Aiko's and Chie's players in its audience",
            reopened?.r === true && aud2?.stage === "incident" && [p1User, p3User].every(id => aud2.audience?.includes(id)), JSON.stringify({ reopened, aud2 }));
        await begin();
        await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}"), { secret: false, keepBullets: true }));`, { timeout: 60000 });
        await settle(2500);
        table.incidentPublic = await heard();
        console.log(line("incidentPublic", table.incidentPublic));
        hold("incidentPublic (a death public at once in the incident)", table.incidentPublic, { gm: ["death"], p1: ["death"], p2: [], p3: ["deathFade"] });
        await gm.eval(`const M = ${imp("murder-rules.mjs")}; await M.endMurder({ reason: "closed", followUp: false, conclude: false }); return true;`, { timeout: 60000 });
        await gm.eval(REVIVE, { timeout: 60000 });
        await settle(1500);

        phase("kill");
        await begin();
        await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(await C.killCharacter(game.actors.get("${IDS.chie}"), { secret: false, keepBullets: true }));`, { timeout: 60000 });
        await settle(2500);
        table.kill = await heard();
        console.log(line("kill", table.kill));
        hold("kill (the Students window, no incident)", table.kill, { gm: ["death"], p1: [], p2: [], p3: ["deathFade"] });
        await gm.eval(REVIVE, { timeout: 60000 });
        await settle(1500);

        for (const kept of [false, true]) {
            const road = kept ? "executionKept" : "execution";
            phase(road);
            const set = await gm.eval(`const C = ${imp("chapter.mjs")}, CL = ${imp("clock.mjs")}, ST = ${imp("settings.mjs")};
                const chie = game.actors.get("${IDS.chie}");
                ${kept ? `await C.killCharacter(chie, { secret: true, keepBullets: true, silent: true });` : ""}
                await CL.setClock({ phase: "classTrial" });
                const chapter = ST.getClock().chapter;
                await game.settings.set("${MOD}", "trialProgress", { chapter, verdictApplied: true, executedAt: null, execution: null,
                    verdict: { stage: "done", correct: false, executedIds: ["${IDS.chie}"], sentenced: ["${IDS.chie}"], by: game.user.id, at: Date.now(), done: ["sentence", "card"], failed: [] } });
                return { phase: ST.getClock().phase, kept: C.isDeadForGm(chie) && !C.isDeceased(chie) };`, { timeout: 60000 });
            await settle(2000);
            await begin();
            const closed = await gm.eval(`const UI = ${imp("trial-floor-ui.mjs")}, C = ${imp("chapter.mjs")};
                const done = await UI.closeTrial(); return { done, dead: C.isDeceased(game.actors.get("${IDS.chie}")) };`, { timeout: 90000 });
            await settle(3000);
            table[road] = await heard();
            console.log(line(road, table[road]));
            check(`${road}: the trial was open${kept ? " over a death the GMs kept" : ""} and its close carried the sentence out`,
                set?.phase === "classTrial" && set.kept === kept && closed?.done === true && closed.dead === true, JSON.stringify({ set, closed }));
            hold(`${road} (the sentence at the trial's close)`, table[road], { gm: ["execution", "trialClose"], p1: ["execution", "trialClose"], p2: ["execution", "trialClose"], p3: ["execution", "trialClose"] });
            await gm.eval(REVIVE, { timeout: 60000 });
            await gm.eval(`await game.settings.set("${MOD}", "clock", globalThis.__s98Clock); await game.settings.set("${MOD}", "trialProgress", globalThis.__s98Trial); return true;`, { timeout: 60000 });
            await settle(2000);
        }
    } finally {
        await gm.eval(`${REVIVE.replace(/return true;\s*$/, "")}
            const ST = ${imp("settings.mjs")};
            if (game.drpg.murderState()?.active) { const M = ${imp("murder-rules.mjs")}; await M.endMurder({ reason: "closed", followUp: false, conclude: false }); }
            await game.settings.set("${MOD}", "clock", globalThis.__s98Clock); await game.settings.set("${MOD}", "trialProgress", globalThis.__s98Trial);
            await ST.setSetting(ST.SETTINGS.sfxMap, globalThis.__s98Map ?? {}); return true;`, { timeout: 90000 });
        for (const c of Object.values(who)) await c.eval(`const ST = ${imp("settings.mjs")}; await ST.setSetting(ST.SETTINGS.sfxVolumes, globalThis.__s98Vol ?? {});
            if (globalThis.__s98Real) { foundry.audio.AudioHelper.play = globalThis.__s98Real; delete globalThis.__s98Real; } delete globalThis.__s98; return true;`);
        await settle(1500);
    }
}
