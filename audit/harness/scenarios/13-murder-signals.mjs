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
 * The incident's rolls follow the same line (E06 C6): each one's dice, its
 * result and its action reach the participants, and nothing of it a bystander
 * or a trap's builder (1c, and the trap's last part). What a hit leaves is said to its
 * victim's player as "you" and to the others by name, each sent only their own line
 * (E32+E07 C7, 1d). A weapon a swing wears is worn by the GM after the blow, and its
 * notice reaches the killer's player alone (E32+E07 C8, 1e). In a trap the victim's action
 * hands the turn back to the victim, with no Pass (E32+E07 C9, part 2). A third who averts
 * their eyes and walks back in is seated by nobody, and the next student in is (E32+E07 C10, 1b).
 * A crisis action that lists several statistics waits for the GM's pick on a veiled card in its
 * player's thread, and rolls the pick (E32+E07 C11b, 1c); taken from the tile, it is one window on
 * the player's browser, the menu (E32+E07 C15, 1c). A trap's card opens the GM's murder
 * window on the student the trap read, and opens nothing until the GM confirms (E32+E07 C14, part 2).
 *
 * Cast: Chie (p3) kills Aiko (p1); Botan (p2) is nowhere near it. In part 4
 * (E32 C5a) Botan is her accomplice, and turns on her at Stage 6.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl, canary }) {
    for (const c of [p1, p2, p3].filter(Boolean)) {
        await c.eval(`globalThis.__dialogAuto = false; return true;`);
    }

    const ids = await gm.eval(`return {
        chie: game.actors.getName("Chie Mori").id,
        aiko: game.actors.getName("Aiko Hoshino").id,
        botan: game.actors.getName("Botan Kage").id,
        daichi: game.actors.getName("Daichi Sato").id
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
       a failure for the first murder, a success for the second, which part 1 plays.
       The first murder opens with no statistic picked, so the GM picks it as the roll goes out
       (E32+E07 C11c; the owner's Q4 as corrected): the GM's window is answered Hand - not the
       first listed - and the held roll notes the statistic it was thrown on and whether the
       window shows it as the GM's. The second opens with Body picked already. */
    phase("opening", { flow: "murder-incident" });
    const CAST_NET = `if (!globalThis.__castNet) {
            globalThis.__castNet = { n: 0 };
            game.socket.on("module.${MOD}", p => { if (p?.action === "incident.myCast") globalThis.__castNet.n++; });
        }
        return globalThis.__castNet.n;`;
    const HOLD = `const a = game.actors.get("${ids.chie}"); globalThis.__heldOpenings = []; globalThis.__heldTraits = [];
        const { TRAIT_BY_GM } = await import("${repoUrl}/scripts/action-rolls.mjs");
        a.rollTrait = function (dh, config) {
            globalThis.__heldTraits.push([dh, config?.[TRAIT_BY_GM] === true]);
            return new Promise(r => globalThis.__heldOpenings.push(r));
        };
        return true;`;
    const RELEASE = `const a = game.actors.get("${ids.chie}"); delete a.rollTrait;
        const held = globalThis.__heldOpenings ?? []; delete globalThis.__heldOpenings; for (const r of held) r(null); return held.length;`;
    const OPEN = trait => `return (await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}"${trait ? `, openingTrait: "${trait}"` : ""} }))?.stage ?? null;`;

    /* Each player asks the primary for its cast as it boots, and the primary answers once its
       store holds the other GMs' copies: measured 27.09, the answers - an empty cast to p1 and p2
       alike - reached them after this phase had opened the murder, so the count waits for them. */
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); await S.castStore.whenHydrated(); return true;`, { timeout: 60000 });
    await settle(900);
    const castsAtStart = await p1.eval(CAST_NET);
    /* WHAT THE OPENING CAME TO (E06 fix r1-G3, 28.09.2026; review M4, the owner's requirement
       of 27.09: each incident roll's result reaches the incident's audience at the roll's
       stage). Every card's words each player is sent from here are netted (`secret.card`);
       the first opening is ruled on a table without Dice So Nice (`game.dice3d` gone on every
       player, put back after), the second with it. The killer must be sent the opening's card
       - its name, the killer's and the total - both times; the victim and the bystander
       nothing of it. Until 1.2.65 the opening's result went to the GMs alone. */
    const OPEN_NET = `globalThis.__openWords = [];
        if (!globalThis.__openNetOn) {
            globalThis.__openNetOn = true;
            game.socket.on("module.${MOD}", p => { if (p?.action === "secret.card") globalThis.__openWords.push(String(p.html ?? "")); });
        }
        return true;`;
    const OPEN_READ = total => `const { MURDER_OPENING } = await import("${repoUrl}/scripts/config.mjs");
        const head = foundry.utils.escapeHTML(MURDER_OPENING.killer.label) + " - " + foundry.utils.escapeHTML(game.actors.get("${ids.chie}").name) + "</h3>";
        const w = globalThis.__openWords;
        return { card: w.some(h => h.includes(head) && h.includes("<p>${total} ")), cards: w.filter(h => h.includes(head)).length,
            all: w.length, dice3d: Boolean(game.dice3d) };`;
    for (const c of [p1, p2, p3]) await c.eval(OPEN_NET);
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dice3dOff = game.dice3d; delete game.dice3d; return true;`);
    await p3.eval(HOLD);
    const pickedAt = await gm.eval(`const T = game.i18n.localize("DRPG.TraitRuling.title");
        globalThis.__dialogAnswers.push(cfg => (cfg?.window?.title === T ? "hand" : ((cfg?.buttons ?? []).find(b => b.default) ?? cfg?.buttons?.[0])?.action ?? null));
        return globalThis.__dialogLog.length;`);
    const firstOpened = await gm.eval(OPEN(null), { timeout: 60000 });
    await settle(900);
    const atOpening = await readAll();
    const openingCard = { gm: await gm.eval(OPENING), victim: await p1.eval(OPENING), killer: await p3.eval(OPENING) };
    const LINE_READ = `const line = game.i18n.localize("DRPG.TraitRuling.openingKiller");
        return { line: (globalThis.__openWords ?? []).filter(h => h.includes(line)).length, held: globalThis.__heldTraits ?? null };`;
    const picking = {
        gm: await gm.eval(`const T = game.i18n.localize("DRPG.TraitRuling.title");
            return globalThis.__dialogLog.slice(${pickedAt}).filter(d => d.title === T).map(d => d.buttons);`),
        killer: await p3.eval(LINE_READ), victim: await p1.eval(LINE_READ), bystander: await p2.eval(LINE_READ)
    };
    check("opening: with no statistic picked the GM picks it as the roll goes out; the killer is told to say how in their thread, the invitation's window throws the pick (Hand, not the first listed) as the GM's, and the victim and the bystander are told nothing of it",
        firstOpened === "openingRoll" && JSON.stringify(picking.gm) === JSON.stringify([["body", "hand", "cancel"]])
        && picking.killer.line === 1 && JSON.stringify(picking.killer.held) === JSON.stringify([["finesse", true]])
        && picking.victim.line === 0 && picking.bystander.line === 0,
        JSON.stringify(picking), { flow: "trait-ruling" });
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
    const failWords = { killer: await p3.eval(OPEN_READ(1)), victim: await p1.eval(OPEN_READ(1)), bystander: await p2.eval(OPEN_READ(1)) };
    for (const c of [p1, p2, p3]) await c.eval(`game.dice3d = globalThis.__dice3dOff; delete globalThis.__dice3dOff; return true;`);
    check("opening: without Dice So Nice the killer is sent what their failed opening came to, the victim and the bystander no card at all",
        failWords.killer.card && failWords.killer.cards === 1 && failWords.killer.dice3d === false
        && failWords.victim.all === 0 && failWords.bystander.all === 0,
        JSON.stringify(failWords));

    /* The second murder, whose opening part 1 lets succeed. */
    for (const c of [p1, p2, p3]) await c.eval(OPEN_NET);
    await p3.eval(HOLD);
    const secondOpened = await gm.eval(OPEN("body"), { timeout: 60000 });
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
    const openWords = { killer: await p3.eval(OPEN_READ(24)), victim: await p1.eval(OPEN_READ(24)), bystander: await p2.eval(OPEN_READ(24)) };
    check("direct: with Dice So Nice the killer is sent what their opening came to, the victim and the bystander not (D6)",
        openWords.killer.card && openWords.killer.cards === 1 && openWords.killer.dice3d === true
        && openWords.victim.cards === 0 && openWords.bystander.all === 0,
        JSON.stringify(openWords));

    const direct = await readAll();
    check("direct: the killer is in it", direct.killer?.witness === true && direct.killer?.seat === true,
        JSON.stringify(direct.killer));
    check("direct: the victim is in it", direct.victim?.witness === true && direct.victim?.seat === true,
        JSON.stringify(direct.victim));
    /* A direct murder is fought face to face, so the victim's copy names the killer (the owner's D6);
       only a trap's copy holds the builder null (E06 C3, murder.mjs `castFor`, and part 2 below). */
    const directCopy = await p1.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { killer: c.killerId ?? null, turn: c.killerTurnId ?? null };`);
    check("direct: the victim's copy names the killer, face to face",
        directCopy.killer === ids.chie && directCopy.turn === ids.chie, JSON.stringify(directCopy));
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

    /* ---- 1c. the incident's rolls reach its participants, and only them -----
       E06 C6, 27.09.2026; audit S02-40, S04-01; the owner's requirement on incident rolls.
       Each participant throws a crisis action on their own browser, the way a player does
       (from the tile, its menu answered - see `ACT`): the victim a Leave a clue with Dice So
       Nice's model on and its secret-roll hiding off, then the killer a Strike on a table
       without the module (`game.dice3d` gone everywhere, put back after). Every browser nets
       the `dice.show` packets (the primary's relay, private-rolls.mjs) and the words of every
       card it is sent; the model keeps what it would animate and every `showForRoll`. The
       other participant must be sent the roll's dice (and play them) and the crisis card
       with the action and the total; the bystander nothing of either, and animate nothing.
       Until C5b every participant read the dice off the roll's whisper list, which named them
       to every console; from C5b to C6 nobody did.
       E06 fix r1-G2 (28.09.2026; review F4, m2, F2): the victim's Dice So Nice holds its throw
       for 1.5 s (`__dsnAnimation`), and the killer must be sent the dice before it ends - the
       victim's browser says whose roll it is as the message is created, not once the dice have
       landed; every browser's chat log calls its notifier as a message is created, and the
       roll must light the pip and ring only where it is read; and with rolls not forced private
       the killer's own Dice So Nice animates the victim's roll and the relay plays no copy. */
    phase("dice", { flow: "murder-incident" });
    const DICE_NET = `globalThis.__diceNet = { show: [], words: [], showAt: {} }; globalThis.__dsnShown = []; globalThis.__dsnAnimated = [];
        globalThis.__dsnHideSecret = false; globalThis.__chatNotified = []; globalThis.__chatRung = []; globalThis.__dsnFell = {};
        if (!globalThis.__diceNetOn) {
            globalThis.__diceNetOn = true;
            game.socket.on("module.${MOD}", p => {
                if (p?.action === "dice.show") { globalThis.__diceNet.show.push(p.id ?? null); globalThis.__diceNet.showAt[p.id] ??= Date.now(); }
                if (p?.action === "secret.card") globalThis.__diceNet.words.push(String(p.html ?? ""));
            });
        }
        return true;`;
    /* Each action is taken from the tile, as a player takes it (E32+E07 C15, 03.10.2026): Direct
       Murder in a fight opens the crisis menu (action-rolls.mjs `openCrisisMenu`), whose row is
       checked and whose default button is pressed by the queued answer; nothing else is queued,
       so a second window - the confirmation the menu was followed by until C15 - is closed, as a
       player who sits still closes it. `windows` is every window the press opened, in order. */
    const ACT = (actorId, key, faces) => `const M = await import("${repoUrl}/scripts/murder.mjs");
        const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const { CRISIS_ACTIONS } = await import("${repoUrl}/scripts/config.mjs");
        const had = new Set(game.messages.contents.map(m => m.id));
        const actor = game.actors.get("${actorId}");
        const own = actor.rollTrait;
        actor.rollTrait = function (dh, config, ...rest) { globalThis.__lastThrow = [dh, config?.[A.TRAIT_BY_GM] === true]; return own.call(this, dh, config, ...rest); };
        globalThis.__lastThrow = null;
        const menu = game.i18n.localize("DRPG.Murder.yourTurn");
        globalThis.__dialogAnswers.push(cfg => {
            const row = cfg?.window?.title === menu ? cfg.content?.querySelector?.('input[name="variant"][value="${key}"]') : null;
            if (!row) return null;
            row.checked = true;
            return (cfg.buttons ?? []).find(b => b.default)?.callback?.(null, null, { element: cfg.content }) ?? null;
        });
        const logAt = globalThis.__dialogLog.length;
        globalThis.__forceRoll = ${JSON.stringify(faces)};
        try { await A.performAction(actor, "directMurder"); }
        finally { delete globalThis.__forceRoll; globalThis.__dialogAnswers.length = 0; delete actor.rollTrait; }
        const roll = game.messages.contents.find(m => !had.has(m.id) && m.getFlag("${MOD}", "supersededRoll"));
        return { id: roll?.id ?? null, total: roll?.rolls?.[0]?.total ?? null, thrown: globalThis.__lastThrow,
            windows: globalThis.__dialogLog.slice(logAt).map(d => d.kind === "confirm" ? "confirm: " + d.title : d.title), menu,
            label: foundry.utils.escapeHTML(CRISIS_ACTIONS["${key}"].label), stage: game.drpg.murderState()?.stage ?? null };`;
    const DICE_READ = act => `const n = globalThis.__diceNet;
        const card = n.words.find(h => h.includes(${JSON.stringify(act.label)} + " - ")) ?? null;
        return { relayed: n.show.includes("${act.id}"), played: globalThis.__dsnShown.filter(c => !c.synchronize && c.messageID === null).map(c => c.total),
            animated: globalThis.__dsnAnimated.includes("${act.id}"), card: Boolean(card), total: Boolean(card?.includes("<p>${act.total} ")),
            dice3d: Boolean(game.dice3d), notified: globalThis.__chatNotified.includes("${act.id}"), rung: globalThis.__chatRung.includes("${act.id}"),
            shownAt: n.showAt["${act.id}"] ?? null, fell: globalThis.__dsnFell["${act.id}"] ?? null };`;
    for (const c of [p1, p2, p3]) await c.eval(DICE_NET);
    await p1.eval(`globalThis.__dsnAnimation = async id => { await new Promise(r => setTimeout(r, 1500)); globalThis.__dsnFell[id] ??= Date.now(); }; return true;`);
    /* Leave a clue lists Hand, Leg and Shadow: the GM picks Shadow - the last, so a roll of
       the first listed, as before E32+E07 C11b, cannot pass for the pick (client-entry.mjs
       `__traitRulingAuto`). */
    await gm.eval(`globalThis.__traitRulings.length = 0; globalThis.__traitRulingAuto = "shadow"; return true;`);
    const clue = await p1.eval(ACT(ids.aiko, "leaveClue", { hope: 9, fear: 5 }), { timeout: 60000 });
    const ruled = await gm.eval(`globalThis.__traitRulingAuto = true; return globalThis.__traitRulings.slice();`);
    await p1.eval(`delete globalThis.__dsnAnimation; return true;`);
    await settle(900);
    /* THE GM'S PICK OF A STATISTIC (E32+E07 C11b, 02.10.2026; audit S04-23). The card asking
       it is veiled in Aiko's thread: its words reach the victim's browser and no other
       player's, and its document names nobody on the bystander's. Each browser reads the
       words it was sent (`__diceNet`) for the card's title, and the bystander the document. */
    const RULING_READ = `const title = game.i18n.localize("DRPG.TraitRuling.title");
        const d = game.messages.get(${JSON.stringify(ruled[0]?.message ?? "")})?.toObject() ?? null;
        return { words: globalThis.__diceNet.words.filter(h => h.includes(title)).length, veiled: d?.flags?.["${MOD}"]?.veiled === true,
            named: d ? JSON.stringify([d.speaker, d.system, d.flags, d.content]).match(/${ids.aiko}|Aiko Hoshino|${p1.userId}|Leave a clue/) !== null : null };`;
    const rulingSeen = { victim: await p1.eval(RULING_READ), bystander: await p2.eval(RULING_READ), killer: await p3.eval(RULING_READ) };
    check("dice: the victim's Leave a clue waits for the GM's pick on a veiled card in her thread, and rolls the pick - Shadow, not the first listed",
        ruled.length === 1 && JSON.stringify(ruled[0].offered) === JSON.stringify(["hand", "leg", "shadow"]) && ruled[0].picked === "shadow"
        && JSON.stringify(clue.thrown) === JSON.stringify(["presence", true]) && Boolean(clue.id)
        && rulingSeen.victim.words >= 1 && rulingSeen.bystander.words === 0 && rulingSeen.killer.words === 0
        && rulingSeen.bystander.veiled && rulingSeen.bystander.named === false,
        JSON.stringify({ ruled, thrown: clue.thrown, rulingSeen }), { flow: "trait-ruling" });
    /* ONE MENU, ONE ROLL (E32+E07 C15, 03.10.2026; audit S02-32, S04-27). From the tile the
       victim's player saw the crisis menu, then a confirmation repeating the row with Cancel
       its default, then the roll: Leave a clue's windows on p1 are the menu alone now - the
       GM's pick is asked on a card in her thread, not in a window of hers. */
    check("dice: the victim's Leave a clue from the tile opens one window on her browser, the menu, and then the roll",
        JSON.stringify(clue.windows) === JSON.stringify([clue.menu]) && Boolean(clue.id) && ruled.length === 1,
        JSON.stringify({ windows: clue.windows, id: clue.id, ruled: ruled.length }));
    const withDsn = { victim: await p1.eval(DICE_READ(clue)), bystander: await p2.eval(DICE_READ(clue)), killer: await p3.eval(DICE_READ(clue)) };
    check("dice: the victim's crisis roll is played on the killer's screen by the GM's relay, and its card tells the killer the action and the total",
        Boolean(clue.id) && clue.stage === "incident" && withDsn.killer.relayed && withDsn.killer.played.includes(clue.total)
        && withDsn.killer.card && withDsn.killer.total && withDsn.victim.animated && !withDsn.victim.relayed,
        JSON.stringify({ clue, withDsn }), { flow: "private-rolls" });
    check("dice: the bystander is sent neither the roll's dice nor its card, and animates nothing though Dice So Nice's secret-roll hiding is off",
        Boolean(clue.id) && !withDsn.bystander.relayed && !withDsn.bystander.played.length && !withDsn.bystander.animated && !withDsn.bystander.card,
        JSON.stringify(withDsn.bystander), { flow: "private-rolls" });
    check("dice: the victim's roll reaches the killer while the victim's own dice still fall",
        Boolean(withDsn.killer.shownAt) && Boolean(withDsn.victim.fell) && withDsn.killer.shownAt < withDsn.victim.fell,
        JSON.stringify({ killer: withDsn.killer.shownAt, fell: withDsn.victim.fell }), { flow: "private-rolls" });

    await gm.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        if (!M.isTheirTurn(game.actors.get("${ids.chie}"))) await M.passTurn();
        return true;`, { timeout: 60000 });
    const NO_DSN = `globalThis.__dice3dAway = game.dice3d; delete game.dice3d; return true;`;
    for (const c of [p1, p2, p3]) { await c.eval(DICE_NET); await c.eval(NO_DSN); }
    const strike = await p3.eval(ACT(ids.chie, "strike", { hope: 2, fear: 1 }), { timeout: 60000 });
    await settle(900);
    const noDsn = { victim: await p1.eval(DICE_READ(strike)), bystander: await p2.eval(DICE_READ(strike)), killer: await p3.eval(DICE_READ(strike)) };
    for (const c of [p1, p2, p3]) await c.eval(`game.dice3d = globalThis.__dice3dAway; delete globalThis.__dice3dAway; globalThis.__dsnHideSecret = true; return true;`);
    check("dice: without Dice So Nice the killer's Strike still tells the victim the action and the total, and the bystander nothing",
        Boolean(strike.id) && strike.stage === "incident" && noDsn.victim.dice3d === false && noDsn.victim.card && noDsn.victim.total
        && !noDsn.bystander.card && !noDsn.bystander.relayed,
        JSON.stringify({ strike, noDsn }), { flow: "private-rolls" });
    const pip = r => ({ notified: r.notified, rung: r.rung });
    check("dice: a roll the module threw lights the Chat pip and rings only where it is read - never on the other participant's screen or the bystander's, with Dice So Nice or without",
        withDsn.victim.notified && !withDsn.victim.rung && noDsn.killer.notified && noDsn.killer.rung
        && [withDsn.killer, withDsn.bystander, noDsn.victim, noDsn.bystander].every(r => !r.notified && !r.rung),
        JSON.stringify({ withDsn: [withDsn.victim, withDsn.killer, withDsn.bystander].map(pip), noDsn: [noDsn.killer, noDsn.victim, noDsn.bystander].map(pip) }),
        { flow: "private-rolls" });

    /* A CARD ANOTHER FILE POSTS FOR A ROLL OF THE FIGHT, FROM THE PLAYER'S OWN BROWSER (E06 fix
       r1-G3, 28.09.2026; review M2). A tool Chie holds breaks on a Despair on p3's browser
       (use-items.mjs `breakOnDespair`, driven with a Despair result as tier 2 drives it): the
       card is veiled while the incident runs (secret.mjs `incidentVeils`; until fix r2-G2 by the
       cast p3's copy holds, settings.mjs `incidentVeil`), so the bystander's copy of it names
       neither Chie nor her player past its author (Q2 (a): the author stays until E28), and its
       words go to p3 alone of the players. */
    const toolId = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        return (await INV.grantItem(game.actors.get("${ids.chie}"), { name: "Suite tool snapped in the fight", category: "tool", tier: 0 }))?.id ?? null;`, { timeout: 60000 });
    await settle(600);
    for (const c of [p1, p2, p3]) await c.eval(DICE_NET);
    const broke = await p3.eval(`const U = await import("${repoUrl}/scripts/use-items.mjs");
        const a = game.actors.get("${ids.chie}"); const had = new Set(game.messages.contents.map(m => m.id));
        const name = await U.breakOnDespair(a, a.items.get("${toolId}"), { withFear: true, isCritical: false });
        return { name, ids: game.messages.contents.filter(m => !had.has(m.id)).map(m => m.id) };`, { timeout: 60000 });
    await settle(900);
    /* The words as each browser holds them: sent over the socket to a reader, kept where the card was posted. */
    const BROKE_READ = `const S = await import("${repoUrl}/scripts/secret.mjs");
        const text = game.i18n.format("DRPG.Items.brokeOnDespair", { item: "Suite tool snapped in the fight" });
        const held = ${JSON.stringify(broke.ids)}.map(id => game.messages.get(id)).filter(Boolean).some(m => String(S.contentOf(m) ?? "").includes(text));
        const docs = ${JSON.stringify(broke.ids)}.map(id => game.messages.get(id)?.toObject()).filter(Boolean);
        return { words: globalThis.__diceNet.words.filter(h => h.includes(text)).length, held, docs: docs.length, veiled: docs.every(d => d.flags?.["${MOD}"]?.veiled === true),
            named: docs.some(d => JSON.stringify([d.speaker, d.system, d.rolls, d.flags]).match(/${ids.chie}|Chie Mori|${p3.userId}/) !== null),
            everybody: docs.every(d => (d.whisper ?? []).length === game.users.size) };`;
    const brokeSeen = { killer: await p3.eval(BROKE_READ), victim: await p1.eval(BROKE_READ), bystander: await p2.eval(BROKE_READ) };
    await gm.eval(`await game.actors.get("${ids.chie}").items.get("${toolId}")?.delete(); return true;`, { timeout: 60000 });
    check("dice: a tool broken on a Despair in the fight is carded veiled from the player's browser - its words to that player alone, its document naming nobody on the bystander's",
        Boolean(toolId) && broke.name === "Suite tool snapped in the fight" && broke.ids.length === 1
        && brokeSeen.killer.held && [brokeSeen.victim, brokeSeen.bystander].every(r => r.words === 0 && !r.held)
        && brokeSeen.bystander.docs === 1 && brokeSeen.bystander.veiled && !brokeSeen.bystander.named && brokeSeen.bystander.everybody,
        JSON.stringify({ toolId, broke, brokeSeen }));

    /* A USE IN THE FIGHT, AND A BYSTANDER'S, EACH FROM ITS PLAYER'S OWN BROWSER (E06 fix r2-G2,
       28.09.2026; review round 2's MJ2 and m6). The victim takes "Use an item" with a tier 1 kit
       on p1's browser, as the review measured it; the bystander, on p2's, drinks a kit of their
       own, breaks a tool on a Despair, and buys the killer a Support, which the primary GM's bridge
       tells Chie's player of. While the incident runs every one of those cards is veiled, whoever
       posts it (secret.mjs `incidentVeils`): on every browser its document names no student and no
       player past its author (Q2 (a)) and addresses everybody, and its words reach its reader
       alone. Until this fix the victim's card spoke as Aiko to the GMs and p1 on p2's browser, and
       the bystander's went plain where a participant's tool card went veiled. */
    const texts = await gm.eval(`const esc = foundry.utils.escapeHTML;
        return { used: game.i18n.format("DRPG.Items.used", { item: esc("Suite kit used in the fight") }),
            drunk: game.i18n.format("DRPG.Items.used", { item: esc("Suite kit a bystander drinks") }),
            broke: game.i18n.format("DRPG.Items.brokeOnDespair", { item: esc("Suite tool a bystander breaks") }),
            support: game.i18n.format("DRPG.Calls.armedForYou", { what: game.i18n.localize("DRPG.Calls.grants.advantage") }) };`);
    const handed = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const M = await import("${repoUrl}/scripts/murder.mjs");
        const { automatedUpdate } = await import("${repoUrl}/scripts/resource-guard.mjs");
        if (!M.isTheirTurn(game.actors.get("${ids.aiko}"))) await M.passTurn();
        const aiko = game.actors.get("${ids.aiko}"), botan = game.actors.get("${ids.botan}");
        const kit = (a, name) => INV.grantItem(a, { name, category: "usable", tier: 1, goal: "healing", quiet: true });
        await automatedUpdate(botan, { "system.resources.hope.value": Math.max(1, botan.system?.resources?.hope?.value ?? 0) });
        return { kit: (await kit(aiko, "Suite kit used in the fight"))?.id ?? null, drink: (await kit(botan, "Suite kit a bystander drinks"))?.id ?? null,
            tool: (await INV.grantItem(botan, { name: "Suite tool a bystander breaks", category: "tool", tier: 1, quiet: true }))?.id ?? null,
            turn: M.isTheirTurn(aiko) };`, { timeout: 60000 });
    await settle(600);
    /* THE VICTIM'S PANEL AFTER A TURN, FROM THEIR COPY (E32 C2, 28.09.2026). The turn the GM just
       passed is the cast's since 1.2.66, not the world half's: it reaches the victim's browser in
       their copy of the cast, and their panel offers the actions from it; the bystander's browser
       holds that an incident runs and its stage, and no turn. */
    const FIGHT_READ = waitForTurn => `const M = await import("${repoUrl}/scripts/murder.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const end = Date.now() + (${waitForTurn} ? 6000 : 0);
        while (incidentCast().turnSide !== "victim" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const aiko = game.actors.get("${ids.aiko}");
        return { world: Object.keys(game.settings.get("${MOD}", "murderState") ?? {}).sort(), copy: incidentCast().turnSide ?? null,
            turn: M.murderState()?.turn ?? null, mine: M.isTheirTurn(aiko), tiles: M.availableCrisisActions(aiko).length };`;
    const fightSeen = { victim: await p1.eval(FIGHT_READ(true)), bystander: await p2.eval(FIGHT_READ(false)) };
    check("fight: after a turn the victim's panel reads it from their copy of the cast, and the bystander's browser holds the stage alone",
        Boolean(handed.turn) && fightSeen.victim.copy === "victim" && fightSeen.victim.mine === true && fightSeen.victim.tiles > 0
        && Number.isFinite(fightSeen.victim.turn) && [fightSeen.victim, fightSeen.bystander].every(r => JSON.stringify(r.world) === JSON.stringify(["active", "stage"]))
        && fightSeen.bystander.copy === null && fightSeen.bystander.turn === null,
        JSON.stringify(fightSeen));
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__useMark = new Set(game.messages.contents.map(m => m.id)); return true;`);
    const took = await p1.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        globalThis.__dialogAnswers.push(true);
        globalThis.__forceRoll = { hope: 11, fear: 5 };
        try { const r = await M.takeCrisisAction(game.actors.get("${ids.aiko}"), "useItem", { itemId: "${handed.kit}" }); return { total: r?.roll?.total ?? null }; }
        finally { delete globalThis.__forceRoll; globalThis.__dialogAnswers.length = 0; }`, { timeout: 60000 });
    const bought = await p2.eval(`const U = await import("${repoUrl}/scripts/use-items.mjs");
        const C = await import("${repoUrl}/scripts/call-effects.mjs");
        const botan = game.actors.get("${ids.botan}");
        globalThis.__dialogAnswers.push(true);
        try { await U.useItem(botan, botan.items.get("${handed.drink}")); } finally { globalThis.__dialogAnswers.length = 0; }
        const broke = await U.breakOnDespair(botan, botan.items.get("${handed.tool}"), { withFear: true, isCritical: false });
        const armed = await C.armCall(game.actors.get("${ids.chie}"), { key: "support", kind: "hope", grants: "advantage", from: botan.id });
        return { broke, armed };`, { timeout: 60000 });
    await settle(1500);
    /* Each reader finds its cards by the words it holds; then every browser reads those documents. */
    const FOUND = keys => `const S = await import("${repoUrl}/scripts/secret.mjs");
        const texts = ${JSON.stringify(texts)};
        const fresh = game.messages.contents.filter(m => !globalThis.__useMark.has(m.id));
        return Object.fromEntries(${JSON.stringify(keys)}.map(k => [k, fresh.find(m => String(S.contentOf(m) ?? "").includes(texts[k]))?.id ?? null]));`;
    const cardIds = { ...await p1.eval(FOUND(["used"])), ...await p2.eval(FOUND(["drunk", "broke"])), ...await p3.eval(FOUND(["support"])) };
    const USE_READ = `const S = await import("${repoUrl}/scripts/secret.mjs");
        const texts = ${JSON.stringify(texts)}, ids = ${JSON.stringify(cardIds)};
        const players = ${JSON.stringify([p1.userId, p2.userId, p3.userId])};
        const look = d => ({ veiled: d.flags?.["${MOD}"]?.veiled === true,
            named: JSON.stringify([d.speaker, d.system, d.rolls, d.flags]).match(/${ids.aiko}|${ids.botan}|${ids.chie}|Aiko Hoshino|Botan Kage|Chie Mori|${p1.userId}|${p2.userId}|${p3.userId}/) !== null,
            names: (d.whisper ?? []).some(u => players.includes(u)) && (d.whisper ?? []).length !== game.users.size });
        const docs = Object.fromEntries(Object.entries(ids).map(([k, id]) => { const d = id ? game.messages.get(id)?.toObject() : null; return [k, d ? look(d) : null]; }));
        const held = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, Boolean(id) && String(S.contentOf(game.messages.get(id)) ?? "").includes(texts[k])]));
        const theirs = new Set(Object.values(ids));
        const others = game.messages.contents.filter(m => !globalThis.__useMark.has(m.id) && !theirs.has(m.id)).map(m => look(m.toObject())).filter(r => r.named || r.names).length;
        return { docs, held, others };`;
    const useSeen = { p1: await p1.eval(USE_READ), p2: await p2.eval(USE_READ), p3: await p3.eval(USE_READ) };
    const clean = keys => [useSeen.p1, useSeen.p2, useSeen.p3].every(r => keys.every(k => r.docs[k] && r.docs[k].veiled && !r.docs[k].named && !r.docs[k].names));
    await gm.eval(`for (const [a, i] of [["${ids.aiko}", "${handed.kit}"], ["${ids.botan}", "${handed.drink}"], ["${ids.botan}", "${handed.tool}"]]) await game.actors.get(a).items.get(i)?.delete();
        await game.actors.get("${ids.chie}").unsetFlag("${MOD}", "pendingCall"); return true;`, { timeout: 60000 });
    check("fight: the victim's Use an item and a Support bought for the killer are carded veiled - their words to their player alone, and no browser holds a document of theirs, or of the rest the action brought, naming a student or a player",
        Boolean(handed.turn) && typeof took.total === "number" && bought.armed === true && clean(["used", "support"])
        && useSeen.p1.held.used && !useSeen.p2.held.used && !useSeen.p3.held.used
        && useSeen.p3.held.support && !useSeen.p1.held.support && !useSeen.p2.held.support
        && [useSeen.p1, useSeen.p2, useSeen.p3].every(r => r.others === 0),
        JSON.stringify({ handed, took, bought, cardIds, useSeen }));
    check("fight: a bystander's cards in the fight are veiled as a participant's are - a kit drunk, a tool broken - so the veil says nothing of who is in it",
        bought.broke === "Suite tool a bystander breaks" && clean(["drunk", "broke"])
        && useSeen.p2.held.drunk && useSeen.p2.held.broke && [useSeen.p1, useSeen.p3].every(r => !r.held.drunk && !r.held.broke),
        JSON.stringify({ bought, cardIds, useSeen }));

    const FORCED = on => `const { SETTINGS } = await import("${repoUrl}/scripts/settings.mjs"); await game.settings.set("${MOD}", SETTINGS.forcePrivateRolls, ${on}); return true;`;
    await gm.eval(FORCED(false));
    for (const c of [p1, p3]) await c.eval(DICE_NET);
    const open = await p1.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__forceRoll = { hope: 7, fear: 3 };
        let out;
        try { out = await A.rollTrait(game.actors.get("${ids.aiko}"), "body", {}); }
        finally { delete globalThis.__forceRoll; }
        const m = out?.raw?.message ?? null;
        return { id: m?.id ?? null, total: m?.rolls?.[0]?.total ?? null, label: "", stage: game.drpg.murderState()?.stage ?? null };`, { timeout: 60000 });
    await settle(900);
    const unforced = await p3.eval(DICE_READ(open));
    await gm.eval(FORCED(true));
    for (const c of [p1, p3]) await c.eval(`globalThis.__dsnHideSecret = true; return true;`);
    check("dice: with rolls not forced private the killer's own Dice So Nice animates the victim's roll, and the relay does not play it a second time",
        Boolean(open.id) && open.stage === "incident" && unforced.animated && !unforced.played.length,
        JSON.stringify({ open, unforced }), { flow: "private-rolls" });

    /* ---- 1d. what a hit leaves, each reader told their own line ------------
       E32+E07 C7, 28.09.2026; audit S04-05. With no Sanity left and all of her Health, Aiko
       takes Chie's critical Strike on Sanity, which the GM scores: both marks land on Health
       (until C7 none did, and the note read "Aiko Hoshino takes 2 STRESS"). The card carries
       two lines and each browser is sent one (secret.mjs `wordsFor`): Aiko's player "You lose
       2 Health.", Chie's her name, Botan's - a bystander - no card at all. Counted as each
       browser receives the words, the `secret.card` packets, found by the card's heading.
       Aiko's marks are put back afterwards; the pass the blow makes may drain her, which the
       GMs alone are told. */
    phase("hit", { flow: "murder-incident" });
    const HIT_NET = `globalThis.__hitWords = [];
        if (!globalThis.__hitNetOn) {
            globalThis.__hitNetOn = true;
            game.socket.on("module.${MOD}", p => { if (p?.action === "secret.card") globalThis.__hitWords.push(String(p.html ?? "")); });
        }
        return true;`;
    for (const c of [p1, p2, p3]) await c.eval(HIT_NET);
    const hit = await gm.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        const aiko = game.actors.get("${ids.aiko}"); const r = aiko.system.resources;
        const was = { hp: r.hitPoints.value, stress: r.stress.value };
        await aiko.update({ "system.resources.hitPoints.value": 0, "system.resources.stress.value": r.stress.max });
        await M.resolveCrisisAction({ actorId: "${ids.chie}", key: "strike", total: 99, isCritical: true, withHope: true, choice: "stress" });
        return { was, stage: M.murderState()?.stage ?? null, sanityFull: aiko.system.resources.stress.value === r.stress.max, health: aiko.system.resources.hitPoints.value };`, { timeout: 60000 });
    await settle(900);
    const HIT_READ = `const { plural } = await import("${repoUrl}/scripts/utils.mjs");
        const { CRISIS_ACTIONS } = await import("${repoUrl}/scripts/config.mjs");
        const esc = foundry.utils.escapeHTML;
        const two = plural("DRPG.Reserve.health", { n: 2 });
        const heading = esc(CRISIS_ACTIONS.strike.label) + " - " + esc(game.actors.get("${ids.chie}").name);
        const cards = (globalThis.__hitWords ?? []).filter(h => h.includes(heading));
        return { cards: cards.length,
            you: cards.some(h => h.includes(game.i18n.format("DRPG.Murder.youLose", { what: two }))),
            them: cards.some(h => h.includes(game.i18n.format("DRPG.Murder.theyLose", { name: esc(game.actors.get("${ids.aiko}").name), what: two }))),
            marker: cards.some(h => /data-drpg-|STRESS/.test(h)) };`;
    const hitSeen = { victim: await p1.eval(HIT_READ), bystander: await p2.eval(HIT_READ), killer: await p3.eval(HIT_READ) };
    await gm.eval(`await game.actors.get("${ids.aiko}").update({ "system.resources.hitPoints.value": ${hit.was.hp}, "system.resources.stress.value": ${hit.was.stress} });
        return true;`, { timeout: 60000 });
    check("hit: a Strike on a full Sanity lands on Health, and the victim's player reads \"You lose 2 Health.\", the killer's the victim's name, the bystander nothing",
        hit.stage === "incident" && hit.sanityFull && [2, 3].includes(hit.health)
        && hitSeen.victim.cards === 1 && hitSeen.victim.you && !hitSeen.victim.them && !hitSeen.victim.marker
        && hitSeen.killer.cards === 1 && hitSeen.killer.them && !hitSeen.killer.you && !hitSeen.killer.marker
        && hitSeen.bystander.cards === 0,
        JSON.stringify({ hit, hitSeen }));

    /* ---- 1e. a swing's wear, taken by the GM after the blow ------------------
       E32+E07 C8, 28.09.2026; audit S04-04, and E06 fix r1-G3's routing (the stage's A1). Chie
       swings a Tier 2 knife from p3's browser and misses with a Despair. Until C8 p3's browser
       wore the knife before it told the GM, so a knife that broke on a hit was out of the hand
       the damage was read from; the GM wears it now, after the damage (murder.mjs `wearSwing`),
       and posts the notice itself: veiled while the incident runs (secret.mjs `incidentVeils`),
       its words sent to Chie's player alone. Read: the knife's wear on the GM, who wrote the
       notice, and on each player's browser the words it was sent and its copy of the card.
       Aiko's marks and Daggerheart's Fear are put back afterwards: the pass drains her, and
       the Despair gives the GM a Fear. */
    phase("swing", { flow: "murder-incident" });
    const swing = await gm.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        const U = await import("${repoUrl}/scripts/use-items.mjs");
        const chie = game.actors.get("${ids.chie}"), r = game.actors.get("${ids.aiko}").system.resources;
        if (!M.isTheirTurn(chie)) await M.passTurn();
        const [knife] = await chie.createEmbeddedDocuments("Item", [{ name: "Suite knife worn in the fight", type: "loot",
            flags: { "${MOD}": { category: "crimeTool", equipped: true, tier: 2 } } }]);
        const { gameSettings } = CONFIG.DH.SETTINGS;
        return { knife: knife?.id ?? null, held: U.equippedFor(chie, "crimeTool")?.id === knife?.id, turn: M.isTheirTurn(chie), gm: game.user.id,
            fear: game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear), aiko: { hp: r.hitPoints.value, stress: r.stress.value },
            text: game.i18n.format("DRPG.Items.woreOnDespair", { item: "Suite knife worn in the fight", left: 1, total: 2 }) };`, { timeout: 60000 });
    await settle(600);
    for (const c of [p1, p2, p3]) await c.eval(DICE_NET);
    const swung = await p3.eval(ACT(ids.chie, "weaponAttack", { hope: 2, fear: 6 }), { timeout: 60000 });
    await settle(900);
    const worn = await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
        const I = await import("${repoUrl}/scripts/inventory.mjs");
        const knife = game.actors.get("${ids.chie}").items.get("${swing.knife}");
        const cards = game.messages.contents.filter(m => String(S.contentOf(m) ?? "").includes(${JSON.stringify(swing.text)}));
        return { wear: I.wearOf(knife), broken: I.isBroken(knife), ids: cards.map(m => m.id), authors: cards.map(m => m.toObject().author ?? null) };`);
    const WORN_READ = `const S = await import("${repoUrl}/scripts/secret.mjs");
        const text = ${JSON.stringify(swing.text)};
        const docs = ${JSON.stringify(worn.ids)}.map(id => game.messages.get(id)).filter(Boolean);
        return { words: globalThis.__diceNet.words.filter(h => h.includes(text)).length, docs: docs.length,
            held: docs.some(m => String(S.contentOf(m) ?? "").includes(text)),
            veiled: docs.every(m => m.toObject().flags?.["${MOD}"]?.veiled === true),
            named: docs.some(m => { const d = m.toObject(); return JSON.stringify([d.speaker, d.system, d.rolls, d.flags]).match(/${ids.chie}|Chie Mori|${p3.userId}/) !== null; }) };`;
    const wornSeen = { killer: await p3.eval(WORN_READ), victim: await p1.eval(WORN_READ), bystander: await p2.eval(WORN_READ) };
    await gm.eval(`const { gameSettings } = CONFIG.DH.SETTINGS;
        await game.actors.get("${ids.chie}").items.get("${swing.knife}")?.delete();
        await game.actors.get("${ids.aiko}").update({ "system.resources.hitPoints.value": ${swing.aiko.hp}, "system.resources.stress.value": ${swing.aiko.stress} });
        if (game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear) !== ${swing.fear}) await game.settings.set(CONFIG.DH.id, gameSettings.Resources.Fear, ${swing.fear});
        return true;`, { timeout: 60000 });
    check("swing: a knife a Despair swing wears is worn by the GM after the blow, and the GM's notice is veiled - its words to the killer's player alone, no browser's copy naming her",
        Boolean(swing.knife) && swing.held && swing.turn && Boolean(swung.id) && swung.stage === "incident"
        && worn.wear === 1 && !worn.broken && worn.ids.length === 1 && worn.authors.every(a => a === swing.gm)
        && wornSeen.killer.words > 0 && wornSeen.killer.held && [wornSeen.victim, wornSeen.bystander].every(r => r.words === 0 && !r.held)
        && [wornSeen.killer, wornSeen.victim, wornSeen.bystander].every(r => r.docs === 1 && r.veiled && !r.named),
        JSON.stringify({ swing, swung, worn, wornSeen }));

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

    /* And walks out, and back in (E32+E07 C10, 02.10.2026; audit S04-21). Botan averts their
       eyes: the seat is emptied, they go on `departed`, and their browser lets the cast go. Their
       token is then teleported into the room Aiko stands in, which the primary GM's `updateToken`
       hook reads as a walk-in (murder.mjs `maybeThirdParty`): it seats nobody. Daichi's token
       after it takes the seat - the hook reads that room, and the seat is open - and the
       incident runs on: had the third who left still counted, the second walk-in would have
       crowded it out. At ac5ae66 Botan's move seated them again (the grid's TP08). The two
       tokens go back where the seed stood them; Daichi is the third until the trap's close. */
    const walkedBack = await gm.eval(`
        const M = await import("${repoUrl}/scripts/murder.mjs");
        const Mv = await import("${repoUrl}/scripts/movement.mjs");
        const until = async (test, ms = 4000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };
        const PLACE = { teleport: true, movementAction: "displace", animate: false };
        // A copy of the list: the eval's answer writes a second reference to one array as "[circular]".
        const read = () => { const s = M.murderState(); return { stage: s?.stage ?? null, third: s?.thirdId ?? null, departed: s?.departed ? [...s.departed] : null }; };
        const room = Mv.locateActor(game.actors.get("${ids.aiko}"))?.room ?? null;
        await game.drpg.resolveCrisisAction({ actorId: "${ids.botan}", key: "avertedEyes", total: 0, isCritical: false, withHope: true });
        const left = read();
        const tokens = ["${ids.botan}", "${ids.daichi}"].map(id => canvas.scene.tokens.find(t => t.actorId === id));
        const was = tokens.map(t => ({ x: t.x, y: t.y }));
        await tokens[0].update(Mv.positionIn(room, tokens[0]), PLACE);
        await new Promise(r => setTimeout(r, 1000));
        const back = { ...read(), there: Mv.roomOfToken(tokens[0]) === room };
        await tokens[1].update(Mv.positionIn(room, tokens[1]), PLACE);
        await until(() => M.murderState()?.thirdId === "${ids.daichi}");
        const next = read();
        for (const [i, t] of tokens.entries()) await t.update(was[i], PLACE);
        return { room, left, back, next };
    `, { timeout: 60000 });
    await settle(900);
    const leftSeen = (await readAll()).bystander;
    check("walk-in: a third who averted their eyes is a bystander again, and walking back in seats nobody",
        Boolean(walkedBack.room) && walkedBack.left.third === null && JSON.stringify(walkedBack.left.departed) === JSON.stringify([ids.botan])
        && walkedBack.back.there === true && walkedBack.back.stage === "incident" && walkedBack.back.third === null
        && leftSeen?.witness === false && leftSeen?.knowsCast === false && leftSeen?.redEdges === false,
        JSON.stringify({ walkedBack, leftSeen }));
    check("walk-in: the next student in takes the empty seat, and the incident runs on",
        walkedBack.next.stage === "incident" && walkedBack.next.third === ids.daichi && JSON.stringify(walkedBack.next.departed) === JSON.stringify([ids.botan]),
        JSON.stringify(walkedBack.next));

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

    /* THE TRAP'S CARD OPENS THE MURDER WINDOW ON THE STUDENT IT READ (E32+E07 C14, 03.10.2026;
       audit S11-20). A trap of Chie's is built in an empty room, finished, and set off by Botan
       through the game's own crossing event on the GM (as the suite's "a trap watches, fires
       once..." does); the card's button is pressed on a copy of the card with the GM drawing
       windows for the moment, and the murder window read: Chie the killer, Botan the victim -
       not the first living student who is not Chie, which is what it proposed until C14 and
       which the check asks is somebody else - the box ticked, and a trap's victim's statistics.
       The window is closed, so nothing opens; the project is deleted before anything below runs,
       and the incident below is opened from the console as before. The card is the GMs' alone
       (traps.mjs `alert`, `gmOnly`). */
    const fired = await gm.eval(`
        const P = await import("${repoUrl}/scripts/projects.mjs");
        const Mv = await import("${repoUrl}/scripts/movement.mjs");
        const M = await import("${repoUrl}/scripts/murder.mjs");
        const { livingStudentsForGm } = await import("${repoUrl}/scripts/chapter.mjs");
        const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const { wireCallActions } = await import("${repoUrl}/scripts/messenger-app.mjs");
        const { closeOpen } = await import("${repoUrl}/scripts/live.mjs");
        const until = async (test, ms = 6000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };
        const room = Mv.allRooms().find(r => Mv.othersInNamedRoom(r).length === 0) ?? Mv.allRooms()[0];
        const first = livingStudentsForGm().find(a => a.id !== "${ids.chie}")?.id ?? null;
        const had = new Set(game.messages.contents.map(m => m.id));
        const windows = globalThis.__dialogWindows;
        const made = await P.createProject({ name: "Suite C14 trap", target: 1, room, indirectMurder: true, killerId: "${ids.chie}",
            condition: "suite", trigger: { kind: "alone", afterDark: false, notBuilder: true } });
        let card = null, seen = null;
        try {
            await P.addProgress(made.id, 1, { by: "${ids.chie}" });
            Hooks.callAll("drpgRoomCrossed", { actor: game.actors.get("${ids.botan}"), from: null, to: room });
            const find = () => game.messages.contents.find(m => !had.has(m.id) && String(contentOf(m) ?? "").includes('data-drpg-call="fireTrap"'));
            await until(() => find());
            card = find() ?? null;
            if (card) {
                const body = document.createElement("div");
                body.innerHTML = contentOf(card);
                wireCallActions(body, card);
                globalThis.__dialogWindows = true;
                body.querySelector('[data-drpg-call="fireTrap"]')?.click();
                const drawn = () => [...foundry.applications.instances.values()].find(a => a.rendered && a.options?.classes?.includes("drpg-window-murder"));
                await until(() => drawn()?.element);
                const form = drawn()?.element?.querySelector("form");
                seen = form ? { killer: form.killer.value, victim: form.victim.value, indirect: form.indirect.checked,
                    statistic: [...(form.querySelector('select[name="openingTrait"]')?.options ?? [])].map(o => o.value) } : null;
            }
        } finally {
            globalThis.__dialogWindows = windows;
            closeOpen("drpg-window-murder");
            await P.deleteProject(made.id).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 300));
        return { room, first, card: Boolean(card), seen, active: Boolean(M.murderState()?.active) };
    `, { timeout: 60000 });
    await settle(500);
    check("trap: the trap's card opens the murder window on the student it read - the builder the killer, the box ticked, a trap's victim's statistics - and nothing opens until the GM confirms",
        fired.card === true && fired.first !== ids.botan && fired.seen?.killer === ids.chie && fired.seen?.victim === ids.botan
        && fired.seen?.indirect === true && JSON.stringify(fired.seen?.statistic) === JSON.stringify(["eye", "head"]) && fired.active === false,
        JSON.stringify(fired), { flow: "trap-fire" });

    /* The victim's opening roll is thrown on p1 as the trap opens, and a miss starts the incident
       at once - which took the opening stage, and its Event card, away before the read below in
       one run of two (27.09). Forced to a critical, which the victim survives noticing, so the
       opening stays open until the GM rules it; deleted once the card is read. */
    /* Every card's words the victim's and the builder's browsers are sent from here to Stage 6
       (E06 C4, 27.09.2026; audit S04-01, S10-04): the `secret.card` packets (secret.mjs), read
       below, before the incident moves on. */
    const WORDS_NET = `globalThis.__trapWords = [];
        game.socket.on("module.${MOD}", p => { if (p?.action === "secret.card") globalThis.__trapWords.push(String(p.html ?? "")); });
        return true;`;
    await p1.eval(WORDS_NET);
    await p3.eval(WORDS_NET);
    await p1.eval(`globalThis.__forceRoll = { hope: 10, fear: 10 }; return true;`);
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "${ids.chie}", victimId: "${ids.aiko}", indirect: true, openingTrait: "eye" });
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
       Red on the C7 tree: p1, p2 and p3 each read indirect, selfInflicted and openedAt there.
       AND THAT COPY DOES NOT NAME THE BUILDER (E06 C3, 27.09.2026; audit S04-01): the victim's
       copy holds `killerId` and `killerTurnId` null (murder.mjs `castFor`), so no field of it
       holds Chie's id - read as the copy's whole text. */
    const METHOD = `const W = await import("${repoUrl}/scripts/world-secrets.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const world = game.settings.get("${MOD}", "murderState") ?? {};
        return { unlisted: Object.keys(world).filter(k => !W.WORLD_SECRET_RULES.settings.murderState?.only?.includes(k)),
            active: Boolean(world.active), copy: incidentCast().indirect ?? null, builder: JSON.stringify(incidentCast()).includes("${ids.chie}") };`;
    const method = { victim: await p1.eval(METHOD), bystander: await p2.eval(METHOD), killer: await p3.eval(METHOD) };
    check("trap: no player's world half says how it happened",
        Object.values(method).every(m => m.active && !m.unlisted.length), JSON.stringify(method));
    check("trap: the victim reads the trap from their copy of the cast, and the builder's id is not in it, and nobody else holds it",
        method.victim.copy === true && method.victim.builder === false && method.bystander.copy === null && method.killer.copy === null,
        JSON.stringify(method));

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
        return true;
    `, { timeout: 60000 });
    await settle(600);

    /* WHILE THE TRAP RUNS, THE VICTIM'S BROWSER HOLDS NEITHER THE BUILDER NOR THE REROLL RECEIPT
       (E06 C3, 27.09.2026; audit S04-01, L09 and L10). The victim takes a crisis action - a missed
       clue, which writes the receipt (`lastCrisis`) into the GMs' record - and p1 reads its copy,
       the packets it was sent for the incident (`incident.myCast`, every one since the action) and
       its Event card's line under the title. Until 1.2.65 every copy held the receipt, and the
       victim's copy the builder, whose name the card set against the victim's ("Chie Mori against
       Aiko Hoshino"): the card names the victim alone now. */
    await p1.eval(`globalThis.__trapCasts = [];
        game.socket.on("module.${MOD}", payload => { if (payload?.action === "incident.myCast") globalThis.__trapCasts.push(payload.cast ?? null); });
        return true;`);
    const acted = await gm.eval(`
        await game.drpg.resolveCrisisAction({ actorId: "${ids.aiko}", key: "leaveClue", total: 2, isCritical: false, withHope: false });
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return { stage: game.drpg.murderState()?.stage ?? null, receipt: Boolean(S.castStore.record().lastCrisis) };
    `, { timeout: 60000 });
    await settle(900);
    const during = await p1.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const E = await import("${repoUrl}/scripts/events.mjs");
        E.renderEvents();
        const sig = JSON.parse(document.getElementById("drpg-events")?.dataset.signature ?? "[]");
        const card = sig.find(c => c[0] === "incident" && c[1] === game.i18n.localize("DRPG.Events.incidentTitle"));
        const c = incidentCast();
        return { packets: globalThis.__trapCasts.length, builder: JSON.stringify([c, globalThis.__trapCasts]).includes("${ids.chie}"),
            receipt: c.lastCrisis ?? null, heldReceipt: globalThis.__trapCasts.some(p => p?.lastCrisis), card: card?.[2] ?? null,
            victim: game.actors.get("${ids.aiko}")?.name ?? null };`);
    check("trap: during the incident the victim's copy and its packets hold neither the builder nor the Reroll receipt, and their Event card names the victim alone",
        acted.stage === "incident" && acted.receipt === true && during.packets > 0 && during.builder === false
        && during.receipt === null && during.heldReceipt === false && during.card === during.victim && Boolean(during.victim),
        JSON.stringify({ acted, during }));

    /* AND THE TURN IS THE VICTIM'S AGAIN, WITH NO PASS (E32+E07 C9, 28.09.2026; audit S04-14).
       The builder is not in the room and holds no seat, so until 1.2.66 the victim's action
       handed the turn to nobody - the victim's browser read "killer", round 1, not theirs -
       and the fight waited for a GM to press Pass. Read on p1, from the victim's own copy. */
    const again = await p1.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        const s = M.murderState();
        return { side: s?.turnSide ?? null, turn: s?.turn ?? null, mine: M.isTheirTurn(game.actors.get("${ids.aiko}")) };`);
    check("trap: after the victim's action the turn is theirs again on their own browser, a round on, with no Pass",
        again.side === "victim" && again.turn === 2 && again.mine === true, JSON.stringify(again));

    /* NOTHING OF ANY CARD OF THE TRAP REACHES ITS BUILDER UNTIL STAGE 6 (E06 C4, 27.09.2026;
       audit S04-01, S10-04, L11 and L12). The GM moves the time of day while the trap runs (the
       card `announceTimeOfDay` narrows to the incident, veiled now) and puts the clock back,
       stamp and all, as 1a does; then both nets are read. Until 1.2.65 the builder's browser was
       sent the words of the victim's crisis card and of the time of day - every whisper of the
       incident read its list off the participants, the builder among them. The victim's browser
       is sent both, and the trap's closing, and no card of theirs names the builder. */
    const hour = await gm.eval(`
        const C = await import("${repoUrl}/scripts/clock.mjs");
        const { TIMES_OF_DAY } = await import("${repoUrl}/scripts/config.mjs");
        const before = C.getClock();
        const next = TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(before.timeOfDay) + 1) % TIMES_OF_DAY.length];
        await C.setTimeOfDay(next, { resetSearchTokens: false });
        await new Promise(r => setTimeout(r, 600));
        await C.setClock({ timeOfDay: before.timeOfDay, timeOfDayStartedAt: before.timeOfDayStartedAt ?? null });
        return { label: C.timeOfDayLabel(next), stage: game.drpg.murderState()?.stage ?? null };
    `, { timeout: 60000 });
    await settle(900);
    const WORDS_READ = `const w = globalThis.__trapWords ?? [];
        const { MURDER_OPENING } = await import("${repoUrl}/scripts/config.mjs");
        return { n: w.length, hour: w.some(h => h.includes(${JSON.stringify(hour.label)})),
            crisis: w.some(h => h.includes("- " + foundry.utils.escapeHTML(game.actors.get("${ids.aiko}").name) + "</h3>")),
            sprung: w.some(h => h.includes(game.i18n.localize("DRPG.Murder.victimTrapSprung"))),
            opening: w.some(h => h.includes(foundry.utils.escapeHTML(MURDER_OPENING.victim.label) + " - " + foundry.utils.escapeHTML(game.actors.get("${ids.aiko}").name) + "</h3>")),
            builder: w.some(h => h.includes(foundry.utils.escapeHTML(game.actors.get("${ids.chie}").name))),
            text: w.map(h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)) };`;
    const trapWords = { victim: await p1.eval(WORDS_READ), builder: await p3.eval(WORDS_READ) };
    check("trap: until Stage 6 the builder's browser is sent the words of no card of the incident; the victim's is sent the trap's closing, the crisis card and the time of day, none naming the builder",
        hour.stage === "incident" && trapWords.builder.n === 0 && trapWords.victim.hour && trapWords.victim.crisis
        && trapWords.victim.sprung && trapWords.victim.builder === false,
        JSON.stringify({ hour, trapWords }));
    /* E06 fix r1-G3 (review M4): the trap's opening is the victim's roll, and its card is theirs. */
    check("trap: the victim is sent what their opening roll came to, and the builder nothing of it",
        trapWords.victim.opening && trapWords.builder.opening === false && trapWords.builder.n === 0,
        JSON.stringify(trapWords));

    /* NO DIE OF THE TRAP'S FIGHT REACHES ITS BUILDER (E06 C6, 27.09.2026; audit S04-01). The
       victim throws a roll of the fight on p1, the way a crisis roll is thrown (as 72 throws
       Chie's), with Dice So Nice's secret-roll hiding off everywhere: the builder's browser and
       the bystander's are sent no `dice.show` and animate nothing - the incident's audience is
       the victim alone, who threw it. */
    for (const c of [p1, p2, p3]) await c.eval(DICE_NET);
    const trapRoll = await p1.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__forceRoll = { hope: 8, fear: 3 };
        let out;
        try { out = await A.rollTrait(game.actors.get("${ids.aiko}"), "body", { actionKey: "crisis", context: { crisis: "leaveClue" } }); }
        finally { delete globalThis.__forceRoll; }
        return { id: out?.raw?.message?.id ?? null, stage: game.drpg.murderState()?.stage ?? null };`, { timeout: 60000 });
    await settle(900);
    const trapDice = { victim: await p1.eval(DICE_READ(trapRoll)), bystander: await p2.eval(DICE_READ(trapRoll)), builder: await p3.eval(DICE_READ(trapRoll)) };
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dsnHideSecret = true; return true;`);
    check("trap: the victim's roll of the fight reaches neither the builder's screen nor the bystander's, even with Dice So Nice's secret-roll hiding off",
        Boolean(trapRoll.id) && trapRoll.stage === "incident" && trapDice.victim.animated
        && [trapDice.builder, trapDice.bystander].every(r => !r.relayed && !r.played.length && !r.animated),
        JSON.stringify({ trapRoll, trapDice }), { flow: "private-rolls" });

    await gm.eval(`
        await game.drpg.beginResolution("victimKilled");
        return true;
    `, { timeout: 60000 });
    await settle(900);
    const stage6 = await p3.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { stage: game.settings.get("${MOD}", "murderState")?.stage ?? null, killer: c.killerId ?? null, indirect: c.indirect ?? null };`);
    check("trap: at Stage 6 the killer is sent the cast, the trap with it",
        stage6.stage === "resolution" && stage6.killer === ids.chie && stage6.indirect === true, JSON.stringify(stage6));
    const victim6 = await p1.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { victim: c.victimId ?? null, builder: JSON.stringify(c).includes("${ids.chie}") };`);
    check("trap: at Stage 6 the victim still holds their copy, and it does not name the builder",
        victim6.victim === ids.aiko && victim6.builder === false, JSON.stringify(victim6));

    /* ---- 3. and it all goes back ------------------------------------------- */
    phase("after", { flow: "murder-incident" });
    /* WHO IS TOLD IT IS OVER (E32 C6, 28.09.2026; audit S13-03). The close told the GMs alone;
       each seat's player at the stage it closed on is told now, in one veiled card whose words
       name nobody (murder.mjs `tellIncidentClosed`). The trap closes at Stage 6 with its victim
       alive - `beginResolution` above killed nobody - so Aiko's player is told she can act
       again, Chie's, the builder seated at Stage 6, that it is over, and Botan's, a bystander,
       nothing: counted as each browser receives the words, the `secret.card` packets. What
       p1's chat holds since is read for the builder, p2's for both (`chatScan`). */
    const CLOSE_NET = `globalThis.__closeWords = [];
        if (!globalThis.__closeNetOn) {
            globalThis.__closeNetOn = true;
            game.socket.on("module.${MOD}", p => { if (p?.action === "secret.card") globalThis.__closeWords.push({ id: p.id, html: String(p.html ?? "") }); });
        }
        return true;`;
    for (const c of [p1, p2, p3]) await c.eval(CLOSE_NET);
    await canary.chatMark({ who: ["p1", "p2"] });
    /* Through `endMurder` again, for the reason given at the top of part 2. */
    await gm.eval(`
        await game.drpg.endMurder({ reason: "suite", followUp: false });
        return true;
    `, { timeout: 60000 });
    await settle(900);
    const CLOSE_READ = `const over = "<p>" + game.i18n.localize("DRPG.Murder.closedYou") + "</p>";
        const free = "<p>" + game.i18n.localize("DRPG.Murder.closedVictimYou") + "</p>";
        const w = (globalThis.__closeWords ?? []).filter(x => x.html === over || x.html === free);
        return { words: w.map(x => x.html === over ? "over" : "free"), ids: [...new Set(w.map(x => x.id))] };`;
    const closed = { victim: await p1.eval(CLOSE_READ), bystander: await p2.eval(CLOSE_READ), killer: await p3.eval(CLOSE_READ) };
    check("after: the trap's close tells its living victim they can act again and its builder it is over, in one card, and the bystander nothing",
        JSON.stringify(closed.victim.words) === '["free"]' && JSON.stringify(closed.killer.words) === '["over"]'
        && closed.bystander.words.length === 0 && closed.victim.ids[0] === closed.killer.ids[0],
        JSON.stringify(closed));
    // The builder is the victim's secret; both of them are the bystander's.
    await canary.chatScan({ who: ["p1"], actorIds: [ids.chie], names: ["Chie Mori"], userIds: [p3.userId] });
    await canary.chatScan({ who: ["p2"], actorIds: [ids.chie, ids.aiko], names: ["Chie Mori", "Aiko Hoshino"], userIds: [p1.userId, p3.userId] });

    const after = await readAll();
    const volumes = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v.roomVolume]));
    check("after: every browser has its own music back",
        Object.values(after).every(v => v.roomVolume === 0.8 && v.parked === -1), JSON.stringify(volumes));
    check("after: nobody's edges are still red",
        Object.values(after).every(v => v.redEdges === false),
        JSON.stringify(Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v.redEdges]))));

    /* ---- 4. a betrayal from the tile, at Stage 6 ------------------------------
       E32 C5a, 28.09.2026; audit S04-03. The accomplice's betrayal comes while the first
       incident is still at Stage 6, and until 1.2.66 its incident was written over that one,
       never closed - its killers never recorded Blackened. `openBetrayal` closes it first now,
       and the second incident opens fresh. What each browser holds of it: the old victim's
       player - Aiko's, dead in the first - nothing of the second; its new victim, Chie, a panel
       that offers Self-defence, from her own copy. Chie (p3) kills Aiko (p1) with Botan (p2)
       as her accomplice; Botan's player asks for the betrayal as the tile does (the bridge's
       `murder.betrayal`, after its confirm); the GM rules both openings a success, each
       roller's own roll held on their browser as part 0 holds it. */
    phase("betrayal", { flow: "murder-incident" });
    const holdOn = id => `const a = game.actors.get("${id}"); globalThis.__heldOpenings = [];
        a.rollTrait = function () { return new Promise(r => globalThis.__heldOpenings.push(r)); }; return true;`;
    const releaseOn = id => `const a = game.actors.get("${id}"); delete a.rollTrait;
        const held = globalThis.__heldOpenings ?? []; delete globalThis.__heldOpenings; for (const r of held) r(null); return held.length;`;
    await p3.eval(holdOn(ids.chie));
    const sixth = await gm.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        const [chie, aiko, botan] = ["${ids.chie}", "${ids.aiko}", "${ids.botan}"].map(id => game.actors.get(id));
        for (const a of [chie, aiko, botan]) if (C.isDeadForGm(a)) await C.reviveCharacter(a, { quiet: true });
        globalThis.__betrayalCloses = 0;
        globalThis.__betrayalHook = Hooks.on("drpgIncidentClosed", () => { globalThis.__betrayalCloses++; });
        await M.openMurder({ killerId: chie.id, victimId: aiko.id, openingTrait: "body" });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await M.thirdPartyEnters(botan);
        await M.resolveCrisisAction({ actorId: botan.id, key: "crimePartners", total: 20, isCritical: false, withHope: true });
        for (let i = 0; i < 4 && M.crisisRefusal(chie, "finishingBlow")?.why === "not their turn"; i++) await M.passTurn();
        await M.resolveCrisisAction({ actorId: chie.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        return { stage: M.murderState()?.stage ?? null, offer: M.betrayalTarget(botan)?.id ?? null, aikoDead: C.isDeadForGm(aiko) };`, { timeout: 60000 });
    await settle(900);
    await p3.eval(releaseOn(ids.chie));
    await p2.eval(holdOn(ids.botan));
    const asked = await p2.eval(`const B = await import("${repoUrl}/scripts/gm-bridge.mjs");
        const r = await B.requestBetrayal({ actorId: "${ids.botan}" }); return { ok: Boolean(r?.ok) };`, { timeout: 60000 });
    const second = await gm.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        const end = Date.now() + 8000;
        while (M.murderState()?.killerId !== "${ids.botan}" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const opened = M.murderState()?.killerId === "${ids.botan}";
        if (opened && M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        const s = M.murderState();
        const black = M.blackenedIds();
        return { opened, killer: s?.killerId ?? null, victim: s?.victimId ?? null, stage: s?.stage ?? null, closes: globalThis.__betrayalCloses,
            blackened: ["${ids.chie}", "${ids.botan}"].every(id => black.includes(id)) };`, { timeout: 60000 });
    await settle(900);
    await p2.eval(releaseOn(ids.botan));
    check("betrayal: from the tile at Stage 6 the first incident is closed once, both its killers recorded, and the second opens on the killer",
        sixth.stage === "resolution" && sixth.offer === ids.chie && asked.ok && second.opened && second.killer === ids.botan
        && second.victim === ids.chie && second.stage === "incident" && second.closes === 1 && second.blackened,
        JSON.stringify({ sixth, asked, second }));
    const oldVictim = await p1.eval(`const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs"); const c = incidentCast();
        return { keys: Object.keys(c).filter(k => c[k] !== null && c[k] !== undefined).sort(), names: ["${ids.botan}", "${ids.chie}"].some(id => JSON.stringify(c).includes(id)) };`);
    const newVictim = await p3.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        const { incidentCast } = await import("${repoUrl}/scripts/settings.mjs");
        const end = Date.now() + 6000;
        while (incidentCast().killerId !== "${ids.botan}" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const chie = game.actors.get("${ids.chie}");
        const sd = M.availableCrisisActions(chie).find(a => a.key === "selfDefence");
        return { killer: incidentCast().killerId ?? null, side: M.sideOf(chie), selfDefence: Boolean(sd && !sd.blocked && !sd.hidden) };`);
    check("betrayal: the old victim's player holds no copy of the second incident, and the new victim's panel offers Self-defence",
        oldVictim.keys.length === 0 && oldVictim.names === false
        && newVictim.killer === ids.botan && newVictim.side === "victim" && newVictim.selfDefence === true,
        JSON.stringify({ oldVictim, newVictim }));
    await gm.eval(`const C = await import("${repoUrl}/scripts/chapter.mjs");
        Hooks.off("drpgIncidentClosed", globalThis.__betrayalHook);
        await game.drpg.endMurder({ reason: "suite", followUp: false });
        const aiko = game.actors.get("${ids.aiko}");
        if (C.isDeadForGm(aiko)) await C.reviveCharacter(aiko, { quiet: true });
        return true;`, { timeout: 60000 });
    await settle(700);
}
