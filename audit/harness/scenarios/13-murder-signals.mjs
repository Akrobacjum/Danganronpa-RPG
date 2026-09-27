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
 * (measured 15.09, before the fix). Neither is a DIRECT murder's victim while
 * the killer's roll is still to come (E06 C2, the owner's D6): nobody has asked
 * them anything, and a roll that fails ends it as if it never happened.
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

    /* The Event panel's "A murder is under way" card, read from the panel each browser draws
       (events.mjs `openingCard`); the trap's opening below says why it is read at all. */
    const OPENING = `const E = await import("${repoUrl}/scripts/events.mjs");
        E.renderEvents();
        const sig = JSON.parse(document.getElementById("drpg-events")?.dataset.signature ?? "[]");
        return { stage: game.settings.get("${MOD}", "murderState")?.stage ?? null,
            card: sig.some(c => c[0] === "incident" && c[1] === game.i18n.localize("DRPG.Events.openingTitle")) };`;

    /* ---- 0. a DIRECT murder's opening: its victim is not in it yet --------------
       E06 C2, 27.09.2026; the owner's D6. Until 1.2.65 the victim's player was sent the cast
       as the murder opened (murder.mjs `castOwners`), and with it the red edges, the murder
       music and the killer's name, before the killer's roll had decided whether there was an
       incident at all. Now their browser reads as a bystander's until the roll succeeds, and
       a roll that fails sends them nothing - not even the empty cast a participant who leaves
       is sent. Counted on p1 as it arrives: every `incident.myCast` packet (the cast's one
       socket action, murder.mjs `CAST_MINE`).
       p3's opening roll is held while the checks read: the killer's own client throws it
       as the murder opens (murder.mjs `rollOpening`), and a result ends the opening - so p3's
       `rollTrait` answers a promise that is let go, with no roll, once the GM has ruled; the
       engine then drops the roll it no longer wants (`throwOpeningRoll`). The GM rules instead:
       a failure for the first murder, a success for the second, which part 1 plays. */
    phase("opening", { flow: "murder-incident" });
    const CAST_NET = `if (!globalThis.__castNet) {
            globalThis.__castNet = { n: 0 };
            game.socket.on("module.${MOD}", p => { if (p?.action === "incident.myCast") globalThis.__castNet.n++; });
        }
        return globalThis.__castNet.n;`;
    const HOLD = `const a = game.actors.get("${ids.chie}"); globalThis.__heldOpenings = [];
        a.rollTrait = function () { return new Promise(r => globalThis.__heldOpenings.push(r)); }; return true;`;
    const RELEASE = `const a = game.actors.get("${ids.chie}"); delete a.rollTrait;
        const held = globalThis.__heldOpenings ?? []; delete globalThis.__heldOpenings; for (const r of held) r(null); return held.length;`;
    const OPEN = `return (await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}" }))?.stage ?? null;`;

    /* Each player asks the primary for its cast as it boots, and the primary answers once its
       store holds the other GMs' copies: measured 27.09, the answers - an empty cast to p1 and p2
       alike - reached them after this phase had opened the murder, so the count waits for them. */
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.whenHydrated(); return true;`, { timeout: 60000 });
    await settle(900);
    const castsAtStart = await p1.eval(CAST_NET);
    await p3.eval(HOLD);
    const firstOpened = await gm.eval(OPEN, { timeout: 60000 });
    await settle(900);
    const atOpening = await readAll();
    const openingCard = { gm: await gm.eval(OPENING), victim: await p1.eval(OPENING), killer: await p3.eval(OPENING) };
    const castsAtOpening = await p1.eval(CAST_NET);
    check("opening: the killer is in it - the cast, the edges, the music and the opening card",
        firstOpened === "openingRoll" && atOpening.killer?.witness === true && atOpening.killer?.knowsCast === true
        && atOpening.killer?.redEdges === true && atOpening.killer?.roomVolume === 0 && openingCard.killer.card && openingCard.gm.card,
        JSON.stringify({ firstOpened, killer: atOpening.killer, card: openingCard }));
    check("opening: a direct murder's victim holds no cast, no seat, no red edges, no murder music and no opening card (D6)",
        atOpening.victim?.witness === false && atOpening.victim?.seat === false && atOpening.victim?.knowsCast === false
        && atOpening.victim?.redEdges === false && atOpening.victim?.roomVolume === 0.8 && atOpening.victim?.parked === -1
        && openingCard.victim.stage === "openingRoll" && !openingCard.victim.card && castsAtOpening === castsAtStart,
        JSON.stringify({ victim: atOpening.victim, card: openingCard.victim, casts: castsAtOpening - castsAtStart }));
    check("opening: the victim is indistinguishable from a bystander",
        JSON.stringify(atOpening.victim) === JSON.stringify(atOpening.bystander),
        `victim ${JSON.stringify(atOpening.victim)} vs bystander ${JSON.stringify(atOpening.bystander)}`);

    /* The first murder's roll fails: the incident closes, and the victim is sent nothing. */
    const failed = await gm.eval(`
        const r = await game.drpg.resolveKillerOpening({ total: 1, isCritical: false, withHope: false });
        return { success: r?.success ?? null, running: Boolean(game.drpg.murderState()) };
    `, { timeout: 60000 });
    await settle(900);
    const heldFirst = await p3.eval(RELEASE);
    const afterFail = await readAll();
    const castsAfterFail = await p1.eval(CAST_NET);
    check("opening: a failed opening leaves the victim holding nothing, and sends them no cast, not even an empty one",
        heldFirst === 1 && failed.success === false && failed.running === false
        && afterFail.victim?.witness === false && afterFail.victim?.knowsCast === false && afterFail.victim?.redEdges === false
        && afterFail.victim?.roomVolume === 0.8 && castsAfterFail === castsAtStart,
        JSON.stringify({ heldFirst, failed, victim: afterFail.victim, casts: castsAfterFail - castsAtStart }));

    /* The second murder, whose opening part 1 lets succeed. */
    await p3.eval(HOLD);
    const secondOpened = await gm.eval(OPEN, { timeout: 60000 });
    await settle(300);
    const castsAtSecond = await p1.eval(CAST_NET);

    /* ---- 1. a DIRECT murder: the killer is in the room ---------------------- */
    phase("direct", { flow: "murder-incident" });
    await gm.eval(`
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return true;
    `, { timeout: 60000 });
    await settle(900);
    const heldSecond = await p3.eval(RELEASE);
    const castsAtIncident = await p1.eval(CAST_NET);
    /* The success moves the stage alone - no cast field is written - so the victim is sent the
       cast because the set of its holders changed across that write (`writeState`). Once. */
    check("direct: the opening's success sends the victim the cast, once",
        secondOpened === "openingRoll" && heldSecond === 1 && castsAtSecond === castsAtStart && castsAtIncident - castsAtSecond === 1,
        JSON.stringify({ secondOpened, heldSecond, casts: [castsAtStart, castsAtSecond, castsAtIncident] }));

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

    /* ---- 1a. the clock moves in private (E05 C15, S01-11) --------------------
       The GM moves the time of day while the incident runs. The bystander's HUD keeps
       the hour the incident began at (hud.mjs `clockForDisplay`); the explainer a click
       on the HUD opens ("Where things stand") read the clock itself and marked the new
       hour. Its window is caught by a queued answer, which reads what it would show.
       The clock is put back afterwards, stamp and all. */
    const moved = await gm.eval(`
        const C = await import("${repoUrl}/scripts/clock.mjs");
        const { TIMES_OF_DAY } = await import("${repoUrl}/scripts/config.mjs");
        const before = C.getClock();
        const next = TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(before.timeOfDay) + 1) % TIMES_OF_DAY.length];
        await C.setClock({ timeOfDay: next });
        return { before: before.timeOfDay, startedAt: before.timeOfDayStartedAt ?? null, next };
    `, { timeout: 60000 });
    await settle(900);
    const shown = await p2.eval(`
        const hud = await import("${repoUrl}/scripts/hud.mjs");
        const E = await import("${repoUrl}/scripts/explain.mjs");
        const C = await import("${repoUrl}/scripts/clock.mjs");
        const { TIMES_OF_DAY, TIME_OF_DAY_LABELS } = await import("${repoUrl}/scripts/config.mjs");
        hud.renderHud();
        await new Promise(r => setTimeout(r, 120));
        const onHud = document.querySelector(".drpg-hud-time[data-drpg-time]:not(.drpg-hud-time-ghost)")?.dataset.drpgTime ?? null;
        let content = null;
        globalThis.__dialogAnswers.push(config => {
            content = typeof config.content === "string" ? config.content : (config.content?.outerHTML ?? "");
            return null;
        });
        await E.openStateExplainer();
        const marked = /class="drpg-explain-now">([^<]*)</.exec(content ?? "")?.[1] ?? null;
        return { onHud, explainer: TIMES_OF_DAY.find(k => (TIME_OF_DAY_LABELS[k] ?? k) === marked) ?? marked,
                 truth: C.getClock().timeOfDay };
    `, { timeout: 60000 });
    await gm.eval(`
        const C = await import("${repoUrl}/scripts/clock.mjs");
        await C.setClock({ timeOfDay: "${moved.before}", timeOfDayStartedAt: ${JSON.stringify(moved.startedAt)} });
        return true;
    `, { timeout: 60000 });
    await settle(900);
    check("direct: the bystander's explainer shows the time their HUD does, not the one the incident moved to (S01-11)",
        moved.next !== moved.before && shown?.truth === moved.next
            && shown?.onHud === moved.before && shown?.explainer === moved.before,
        JSON.stringify({ moved, shown }));

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
       (the C8 session's finding). Read from the panel each browser draws (`OPENING`, above). */
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
       THAT MUTANT WAS EQUIVALENT UNTIL E06 (E05's fix round, 27.09.2026). The gate
       (`trapMoved` in murder.mjs `writeState`) only decided anything on a write that names no
       cast field, and read on 27.09 no such write moved `trapRunning`: the incident opens with
       the cast (`openMurder`), openingRoll -> incident kept it running, every road into
       Stage 6 writes `endedBy`, and an incident ends through `restoreState`, not `writeState`.
       E06 C2 made it the holders compared across the write (`castOwners`), and a direct
       murder's opening success is such a write: it names no cast field and seats the victim.
       So the gate is read now by "direct: the opening's success sends the victim the cast,
       once" above; this part still guards only the trap's outcome. */
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
