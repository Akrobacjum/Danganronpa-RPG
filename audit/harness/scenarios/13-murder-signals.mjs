/**
 * L2: what a killing does to the four screens watching it.
 *
 * Three signals now follow one predicate - `incidentWitness` in settings.mjs -
 * and all three are invisible from inside a single client, which is why they
 * are a scenario rather than a suite test:
 *
 *   · the Event card / the HUD's turn row
 *   · the red edges (`drpg-incident-here` on the body)
 *   · the murder playlist, which plays on a browser rather than in the world
 *
 * The question each one answers is "am I in this", and the expensive half of
 * that question is WHO IS NOT. A bystander must see, hear and be told nothing.
 * The killer of a TRAP is in the same position as a bystander and was not: the
 * cast, the card and a whisper all reached them at the moment it went off
 * (measured 15.09, before the fix).
 *
 * Cast: Chie (p3) kills Aiko (p1); Botan (p2) is nowhere near it.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl }) {
    for (const c of [p1, p2, p3].filter(Boolean)) {
        await c.eval(`globalThis.__dialogAuto = false; return true;`);
    }

    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id,
        aiko: game.actors.getName("Aiko Hoshino").id,
        botan: game.actors.getName("Botan Kage").id
    };`);

    /* A playlist for the murder, and a room volume on every browser to duck. */
    await gm.eval(`
        const pl = await Playlist.create({ name: "Suite murder playlist" });
        await pl.createEmbeddedDocuments("PlaylistSound", [{ name: "t1", path: "sounds/suite-murder.ogg" }]);
        await game.settings.set("${MOD}", "musicMap",
            { ...(game.settings.get("${MOD}", "musicMap") ?? {}), murder: pl.id });
        return true;
    `, { timeout: 60000 });
    for (const c of [gm, p1, p2, p3].filter(Boolean)) {
        await c.eval(`await game.settings.set("core", "globalPlaylistVolume", 0.8); return true;`);
    }

    /** Everything one browser can tell about the killing, in one read. */
    const readAll = async () => {
        const out = {};
        for (const [who, c] of [["gm", gm], ["victim", p1], ["bystander", p2], ["killer", p3]]) {
            // `bystander` is Botan, who is a bystander until step 1b walks them
            // into the room and a participant afterwards. The checks name which
            // they are at each point rather than assuming.

            if (!c) continue;
            out[who] = await c.eval(`
                const S = await import("${repoUrl}/scripts/settings.mjs");
                const M = await import("${repoUrl}/scripts/music.mjs");
                const hud = await import("${repoUrl}/scripts/hud.mjs");
                hud.renderHud();
                await new Promise(r => setTimeout(r, 120));
                await M.applyMurderMusic();
                // The leaf (E04): the GMs' record on a GM, a participant's own copy elsewhere.
                const cast = S.incidentCast();
                return {
                    witness: S.incidentWitness().witness,
                    seat: Boolean(S.incidentWitness().seat),
                    redEdges: document.body.classList.contains("drpg-incident-here"),
                    knowsCast: Boolean(cast.killerId || cast.victimId),
                    roomVolume: game.settings.get("core", "globalPlaylistVolume"),
                    parked: game.settings.get("${MOD}", "musicDuckedFrom")
                };
            `);
        }
        return out;
    };

    /* ---- 1. a DIRECT murder: the killer is in the room ---------------------- */
    phase("direct", { flow: "murder-incident" });
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return true;
    `, { timeout: 60000 });
    await settle(900);

    const direct = await readAll();
    check("direct: the killer is in it", direct.killer?.witness === true && direct.killer?.seat === true,
        JSON.stringify(direct.killer));
    check("direct: the victim is in it", direct.victim?.witness === true && direct.victim?.seat === true,
        JSON.stringify(direct.victim));
    check("direct: the bystander is not", direct.bystander?.witness === false && direct.bystander?.knowsCast === false,
        JSON.stringify(direct.bystander));

    check("direct: the participants' edges go red",
        direct.killer?.redEdges === true && direct.victim?.redEdges === true,
        JSON.stringify({ killer: direct.killer?.redEdges, victim: direct.victim?.redEdges }));
    /* The GM's too. The first cut of this keyed off the seat, which a GM does
       not hold, so their screen stayed the colour of the hour through every
       killing - and the GM is the person holding two sides of the scene at
       once, so they are who it is most useful to (Dawid, 15.09). */
    check("direct: the GM's edges go red as well",
        direct.gm?.redEdges === true, String(direct.gm?.redEdges));
    check("direct: the bystander's edges do not",
        direct.bystander?.redEdges === false, String(direct.bystander?.redEdges));

    check("direct: the murder music takes the participants and the GM",
        direct.killer?.roomVolume === 0 && direct.victim?.roomVolume === 0 && direct.gm?.roomVolume === 0,
        JSON.stringify({ killer: direct.killer?.roomVolume, victim: direct.victim?.roomVolume, gm: direct.gm?.roomVolume }));
    check("direct: the bystander keeps the room's own playlist",
        direct.bystander?.roomVolume === 0.8 && direct.bystander?.parked === -1,
        JSON.stringify(direct.bystander));

    /* ---- 1b. somebody walks in on it ---------------------------------------
       The guide gives the scene one third party, and from the moment they are
       in it they are in it: `thirdPartyEnters` writes `thirdId`, which is a
       cast field, so the cast reaches their browser and all three signals
       follow. Asserted BEFORE as well as after, because "they get it" is only
       half the rule - the other half is that a student standing elsewhere on
       the map gets nothing, and the same person plays both parts here. */
    phase("walk-in", { flow: "murder-incident" });
    const walkedIn = await gm.eval(`
        await game.drpg.thirdPartyEnters(game.actors.get("${ids.botan}"));
        return Boolean(game.drpg.murderState()?.thirdId);
    `, { timeout: 60000 });
    check("walk-in: the third party joined the cast", walkedIn === true, String(walkedIn));
    await settle(900);

    const third = await readAll();
    check("walk-in: they are a witness now", third.bystander?.witness === true && third.bystander?.seat === true,
        JSON.stringify(third.bystander));
    check("walk-in: the card, the edges and the music all follow",
        third.bystander?.knowsCast === true && third.bystander?.redEdges === true
        && third.bystander?.roomVolume === 0,
        JSON.stringify(third.bystander));

    /* ---- 2. the same murder, sprung by a trap ------------------------------- */
    phase("trap", { flow: "trap-fire" });
    /* THROUGH `endMurder`, NOT BY WRITING THE SETTINGS.
       The first draft cleared the two settings directly and the trap half then
       failed: the third party's browser still held the old cast, so they read
       as a witness to a murder that was over. Not a defect - `writeCast({})` is
       what tells a participant's client to let go, and setting the world key by
       hand goes round it. The module's own closing path is also the one worth
       exercising here. */
    await gm.eval(`
        await game.drpg.endMurder({ reason: "suite", followUp: false });
        return true;
    `, { timeout: 60000 });
    await settle(700);

    /* The victim's opening roll is thrown on p1 as the trap opens, and a miss starts the incident
       at once - which took the opening stage, and its Event card, away before the read below in
       one run of two (27.09). Forced to a critical, which the victim survives noticing, so the
       opening stays open until the GM rules it; deleted once the card is read. */
    await p1.eval(`globalThis.__forceRoll = { hope: 10, fear: 10 }; return true;`);
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}", indirect: true });
        return true;
    `, { timeout: 60000 });
    await settle(900);

    const trap = await readAll();
    check("trap: the victim is still told", trap.victim?.witness === true && trap.victim?.knowsCast === true,
        JSON.stringify(trap.victim));
    check("trap: the GM is still told", trap.gm?.witness === true, JSON.stringify(trap.gm));

    // THE POINT OF THE WHOLE FILE.
    check("trap: the killer holds no cast", trap.killer?.knowsCast === false, JSON.stringify(trap.killer));
    check("trap: the killer is not a witness", trap.killer?.witness === false, JSON.stringify(trap.killer));
    check("trap: the killer's edges stay as they were", trap.killer?.redEdges === false, String(trap.killer?.redEdges));
    check("trap: the killer hears the room, not the murder",
        trap.killer?.roomVolume === 0.8 && trap.killer?.parked === -1, JSON.stringify(trap.killer));
    check("trap: the killer is indistinguishable from a bystander",
        JSON.stringify(trap.killer) === JSON.stringify(trap.bystander),
        `killer ${JSON.stringify(trap.killer)} vs bystander ${JSON.stringify(trap.bystander)}`);

    /* THE OPENING EVENT CARD (E05's fix round, M7, 27.09.2026). While the trap's opening runs,
       the Event panel's "A murder is under way" card is the victim's and the GM's, and not the
       killer's - events.mjs `openingCard`, which asks `incidentIndirect(cast, state)` whether it
       is a trap. Nothing read it on a browser until now: with the card asking the world half
       alone (which holds no method since C8), the victim lost it and every check stayed green
       (the C8 session's finding). Read from the panel each browser draws. */
    const OPENING = `const E = await import("${repoUrl}/scripts/events.mjs");
        E.renderEvents();
        const sig = JSON.parse(document.getElementById("drpg-events")?.dataset.signature ?? "[]");
        return { stage: game.settings.get("${MOD}", "murderState")?.stage ?? null,
            card: sig.some(c => c[0] === "incident" && c[1] === game.i18n.localize("DRPG.Events.openingTitle")) };`;
    const opening = { gm: await gm.eval(OPENING), victim: await p1.eval(OPENING), bystander: await p2.eval(OPENING), killer: await p3.eval(OPENING) };
    await p1.eval(`delete globalThis.__forceRoll; return true;`);
    check("trap: the opening Event card is the victim's and the GM's, not the killer's or a bystander's",
        Object.values(opening).every(o => o.stage === "openingRoll")
        && opening.gm.card && opening.victim.card && !opening.bystander.card && !opening.killer.card, JSON.stringify(opening));

    /* HOW IT HAPPENED IS NOT IN THE WORLD (E05 C8; audit S04-08). The world half of
       `murderState` said `indirect: true` on every browser - the killer's too, who is told
       nothing else. Each player's world half holds only the public list (world-secrets.mjs,
       `murderState`'s `only`), and the victim reads the trap from their own copy of the cast.
       Red on the C7 tree: p1, p2 and p3 each read indirect, selfInflicted and openedAt there. */
    const METHOD = `const W = await import("${repoUrl}/scripts/world-secrets.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const world = game.settings.get("${MOD}", "murderState") ?? {};
        return { unlisted: Object.keys(world).filter(k => !W.WORLD_SECRET_RULES.settings.murderState?.only?.includes(k)),
            active: Boolean(world.active), copy: incidentCast().indirect ?? null };`;
    const method = { victim: await p1.eval(METHOD), bystander: await p2.eval(METHOD), killer: await p3.eval(METHOD) };
    check("trap: no player's world half says how it happened",
        Object.values(method).every(m => m.active && !m.unlisted.length), JSON.stringify(method));
    check("trap: the victim reads the trap from their copy of the cast, and nobody else holds it",
        method.victim.copy === true && method.bystander.copy === null && method.killer.copy === null, JSON.stringify(method));

    /* AND THE KILLER IS LET BACK IN AT STAGE 6 (`castOwners`, murder.mjs), the trap in their
       copy. The GM rules the victim's roll a failure - the trap closes - and moves the incident
       on. Red on the C7 tree: the killer was sent the cast, without `indirect`, which was the
       world half's. The gate compares both halves since E05 C8; a mutant comparing the world
       halves alone still passes here (26.09), because every road into Stage 6 writes `endedBy`,
       a cast field now, and a write of the cast is pushed anyway - this guards the outcome,
       not that line.
       THAT MUTANT IS EQUIVALENT TODAY, AND WHY (E05's fix round, 27.09.2026). The gate
       (`trapMoved` in murder.mjs `writeState`) only decides anything on a write that names no
       cast field, and read on 27.09 no such write moves `trapRunning`: the incident opens with
       the cast (`openMurder`), openingRoll -> incident keeps it running, every road into
       Stage 6 writes `endedBy`, and an incident ends through `restoreState`, not `writeState`.
       `writeState` is not exported, so no test can make the write that would tell the two
       apart; the gate is kept for the next road that moves the stage alone. Re-measured with
       the opening card above: the mutant still passes every check in this file. */
    await gm.eval(`
        await game.drpg.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await game.drpg.beginResolution("victimKilled");
        return true;
    `, { timeout: 60000 });
    await settle(900);
    const stage6 = await p3.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { stage: game.settings.get("${MOD}", "murderState")?.stage ?? null, killer: c.killerId ?? null, indirect: c.indirect ?? null };`);
    check("trap: at Stage 6 the killer is sent the cast, the trap with it",
        stage6.stage === "resolution" && stage6.killer === ids.chie && stage6.indirect === true, JSON.stringify(stage6));

    /* ---- 3. and it all goes back ------------------------------------------- */
    phase("after", { flow: "murder-incident" });
    /* Through `endMurder` again, for the reason given at the top of part 2. */
    await gm.eval(`
        await game.drpg.endMurder({ reason: "suite", followUp: false });
        return true;
    `, { timeout: 60000 });
    await settle(900);

    const after = await readAll();
    const volumes = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v.roomVolume]));
    check("after: every browser has its own music back",
        Object.values(after).every(v => v.roomVolume === 0.8 && v.parked === -1), JSON.stringify(volumes));
    check("after: nobody's edges are still red",
        Object.values(after).every(v => v.redEdges === false),
        JSON.stringify(Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v.redEdges]))));
}
