/**
 * Danganronpa RPG - tier 2 of the suite: the scenarios, which write (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * The scenarios open incidents, kill people and reset seasons, so this file
 * also holds the fixtures built and put back around them: snapshot() records
 * what a scenario may displace, restore() puts it back, and the runner in
 * tests.mjs calls both. Never run it in a world somebody is playing in.
 */

import { MODULE_ID, EQUIPPABLE, SFX_EVENTS, FLAGS, PRICE_CHAINS } from "./config.mjs";
import { SETTINGS, getSetting, BREAKPOINTS, narrowScreen, shortScreen, seasonEpoch } from "./settings.mjs";
import { applyNarrowLayout, narrowLayout } from "./narrow.mjs";
import { getClock, setClock } from "./clock.mjs";
import { voiceTargets } from "./voice.mjs";
import { forcedDeletion } from "./utils.mjs";
import { gmStoresIdle } from "./gm-store.mjs";
import {
    ok, must, needs, env, world, equal, wait, settle, until, moduleSources, otherSources, stripComments, bodyOf, fnSource,
    STANDING, stableJson, moduleSettingValues, cast
} from "./tests-kit.mjs";
import { GRID } from "./tests-grid.mjs";

/* ==========================================================================
 * TIER 2 - SCENARIOS
 * ========================================================================== */

/**
 * Everything a scenario is allowed to disturb, recorded so it can be put back.
 *
 * The clock and the incident are world settings; resources are actor data. A
 * scenario that throws half way through still gets restored, because the restore
 * runs from `finally` in the runner rather than at the end of the test.
 */
async function snapshot(cast) {
    /*
     * DESPAIR AND THE OVERFLOW, for the same reason Hope is here.
     *
     * Measured on 10.09: pools 12 / 0 and overflow 75 before a clean 124/0 run,
     * overflow 76 after. Every scenario that opens a murder generates Despair,
     * the pools cap, and the excess spills into a counter that drives the
     * Eclipse - so a suite nobody was watching walked the world one step
     * towards an event the GM never called. It looks like nothing for a day and
     * then it is the reason a season went dark early.
     */
    const { monokumas, getDespair } = await import("./despair.mjs");
    return {
        /*
         * EVERY SETTING THIS MODULE REGISTERED, not a list of the ones somebody
         * remembered (E01, 24.09.2026; audit S14-10). The list below this line
         * grew one field per bug - Despair on 10.09, Hope, the action budget,
         * the motive - and the audit found five it had still not reached:
         * the sealed rooms and the Eclipse crossings that "ending an Eclipse the
         * way the game does" clears, the search tokens `advanceTimeOfDay` zeroes,
         * the murders `judgePendingMurders` rules on, the overflow rules. Each
         * left the QA world different after a clean run, which is the thing this
         * snapshot exists to prevent. A setting added next month is in here the
         * day it is registered. The named fields are kept: `restore` still writes
         * the clock through `setClock` and Despair through `setDespair`, and the
         * comments on them are the record of why each one matters.
         */
        settings: moduleSettingValues(),
        clock: foundry.utils.deepClone(getClock()),
        despair: monokumas().map(user => ({ id: user.id, value: getDespair(user.id) })),
        overflow: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {}),
        murder: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}),
        // The other half of the incident (LIVE-001) and the Blackened register are
        // GM stores since E04: client settings like the rest, in `settings` above,
        // and put back raw with them - no named field of their own any more.
        // E14. Both are world settings a scenario below writes, and both are
        // visible to the whole table - a suite that leaves a motive standing
        // has announced one at somebody's game.
        motive: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.motive) ?? {}),
        gather: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.pendingGather) ?? {}),
        // HOPE AS WELL AS THE TWO REVERSE RESOURCES.
        //
        // It was missing, and the suite therefore paid its fixture actor one
        // Hope per run and never took it back. Measured: three students set to
        // 3, one clean 22/22 pass, and the roller came out at 4 while the other
        // two were untouched - so three runs in an afternoon leave a character
        // three Hope richer than the GM last saw them. Hope buys Calls; that is
        // a real resource quietly appearing out of a test.
        //
        // Same class of defect as the re-entrancy one: the contract this file
        // opens with is "fixtures built and put back", and a resource nobody
        // recorded cannot be put back.
        resources: cast.map(a => ({
            id: a.id,
            hp: a.system?.resources?.hitPoints?.value ?? 0,
            stress: a.system?.resources?.stress?.value ?? 0,
            hope: a.system?.resources?.hope?.value ?? 0,
            // THE ACTION BUDGET AND WHAT HOPE HAS BOUGHT (E13).
            //
            // Same defect class as the Hope that used to leak: a scenario that
            // spends an action or banks a Burst and does not put it back leaves
            // the fixture richer or poorer than the GM last saw it, and the
            // next run measures against a world the suite itself moved.
            actions: a.system?.resources?.actions?.value ?? 0,
            /* THE CEILING AS WELL AS THE COUNT, AND EVERY FLAG OF THIS MODULE AS IT
               WAS (E30, 24.09.2026). The whole-world dump found both on its first runs:
               a phase change sets `actions.max` (resetActionsFor), so after the Eclipse
               scenario every student's ceiling read 2 where the world had 3; and the
               flags were put back one named field at a time - the grants recorded as
               `?? 0` - so a student who had none came back with flags the world never
               had ("flags.danganronpa-rpg (none) -> {"freeActionGrants":0,...}", and
               after two more scenarios {"deceased":false,"monocub":false,...}). The
               whole namespace is recorded now, absent keys as absent. */
            actionsMax: a.system?.resources?.actions?.max ?? null,
            flags: foundry.utils.deepClone(a.flags?.[MODULE_ID] ?? {}),
            deceased: a.getFlag(MODULE_ID, "deceased") ?? null
        })),
        // WHICH TOKENS AND MESSAGES EXISTED, not how many.
        //
        // An incident drops Remnants of its own - the opening roll leaves one,
        // every crisis action can leave another - and they are world objects
        // that outlive the test and change what the NEXT measurement sees. The
        // first version of this suite passed all six scenarios and left three
        // Remnants behind, which is the failure this file's own header warns
        // about. Recorded as ids rather than a count so the restore removes
        // exactly what appeared and never touches anything that was already
        // there.
        // `game.scenes` is a Foundry Collection, which has `map` and `filter`
        // but NOT `flatMap` - the first version used it, threw inside the
        // snapshot, and the runner reported one failure and skipped every
        // scenario. A suite that silently runs nothing reads almost the same as
        // a suite that passes, which is why the runner names the step.
        remnants: new Set(game.scenes.reduce((ids, scene) => {
            for (const token of scene.tokens) {
                if (token.getFlag(MODULE_ID, "isRemnant")) ids.push(`${scene.id}.${token.id}`);
            }
            return ids;
        }, [])),
        messages: new Set(game.messages.map(m => m.id)),
        /* EVERY OTHER WORLD DOCUMENT THAT EXISTED, by collection (E30, 24.09.2026). The
           dump's first run found two actors the module makes when it first needs them
           - "Remnant", under the traces, and "DRPG Project", under project tokens -
           standing in a world that had neither, from the first scenario that dropped
           one to the end of the run. Users and settings are never created or removed
           here, and chat has its own line above. */
        documents: new Map([...(game.collections ?? [])]
            .filter(([name]) => !["User", "Setting", "ChatMessage"].includes(name))
            .map(([name, collection]) => [name, new Set(collection.map(d => d.id))]))
    };
}

/* A value that a write puts in place whole: v14's ForcedReplacement for an object,
   which a plain update would merge into what is there; anything else as it is. */
function replaced(value) {
    const Operator = foundry.data?.operators?.ForcedReplacement;
    if (!Operator || !value || typeof value !== "object") return value;
    return Operator.create ? Operator.create(value) : new Operator(value);
}

/* Every user's pre-session note flag as it stands, one written whole, and all put back as
   they were - unset where there was none (E05 C6: the notes' lift pair writes the flags of
   the world's own users, and the lift replaces every flag that holds a text). */
function noteFlagsNow() {
    return new Map(game.users.map(u => [u.id, foundry.utils.deepClone(u.flags?.[MODULE_ID]?.preSessionNote ?? null)]));
}
function setNoteFlag(user, value) {
    return user.update({ [`flags.${MODULE_ID}.preSessionNote`]: replaced(value) });
}
async function putNoteFlagsBack(before) {
    for (const [id, flag] of before) {
        const user = game.users.get(id);
        if (!user || stableJson(user.flags?.[MODULE_ID]?.preSessionNote ?? null) === stableJson(flag)) continue;
        if (flag === null) await user.unsetFlag(MODULE_ID, "preSessionNote");
        else await setNoteFlag(user, flag);
    }
}

/* What a call threw, as its message, or null when it returned (E05 fix r1-G1: a lift that
   leaves its secret in world data throws, so the world is not stamped - its kept halves read
   the message, which carries the count). */
async function thrown(fn) {
    try {
        await fn();
        return null;
    } catch (err) {
        return String(err?.message ?? err);
    }
}

async function restore(snap) {
    const { reviveCharacter } = await import("./chapter.mjs");
    const { setDespair, getDespair } = await import("./despair.mjs");

    /*
     * THE CLOCK FIRST (E01, 24.09.2026; audit S14-10). It used to go back last, and
     * `setClock` is not a plain write: a change of phase resets every student's
     * actions and can charge Despair for unfound Keys (`reconcilePhase`). Last, it
     * undid the resources and pools this function had just put back. It did not
     * bite only because every scenario that changes the phase changes it back
     * itself. First, whatever the phase change does is then overwritten by the
     * recorded values below - which is what "put back" means.
     */
    if (stableJson(getClock()) !== stableJson(snap.clock)) await setClock(snap.clock);
    /* The settlement a change of the time of day asks for writes the pools' world value, the
       mark with it (E05 fix r2-G2). Asked by the hook some milliseconds after the clock's write,
       it landed on the pools put back below - measured on the harness 27.09: "restore left
       despairPools.settled" after the conversion's test. Asked here and waited for, it runs now,
       and one asked later finds the mark where it is and writes nothing. */
    await (await import("./despair.mjs")).settleOwed();

    /*
     * THE TRACES THAT APPEARED, REMOVED BEFORE THE SETTINGS GO BACK (E04, 1.2.63).
     * A trace's token deleted tombstones its row in the GM store (remnants.mjs, the
     * deleteToken hook), which is a write of the store's key. Removed after the
     * settings, as they were until E04, each tombstone landed on the key just put
     * back: measured on the harness 26.09, six scenarios left
     * "gmRemnants.worlds.<world>.d.<key> (none) -> ..." behind them. Removed first,
     * and the store let settle, the settings below are written over the tombstones.
     */
    for (const scene of game.scenes) {
        const strays = scene.tokens
            .filter(t => t.getFlag(MODULE_ID, "isRemnant") && !snap.remnants.has(`${scene.id}.${t.id}`))
            .map(t => t.id);
        if (strays.length) await scene.deleteEmbeddedDocuments("Token", strays);
    }
    await gmStoresIdle();

    // Every other setting that moved, written back as it was recorded. Compared
    // first so a setting nothing touched is not written - several have `onChange`
    // handlers that redraw the table. One key that will not go back must not stop
    // the rest (the resources, the stray tokens and the chat below): each is tried
    // on its own, and what is still different afterwards is thrown, so the runner
    // counts it (the review of E01).
    const stuck = [];
    for (const [key, value] of snap.settings ?? []) {
        if (key === SETTINGS.clock) continue;
        let now;
        try { now = game.settings.get(MODULE_ID, key); } catch { continue; }
        if (stableJson(now) === stableJson(value)) continue;
        try { await game.settings.set(MODULE_ID, key, value); }
        catch (err) { stuck.push(`${key} (${err?.message ?? err})`); }
    }

    // Written as values, not deltas: the delta is the thing that went wrong.
    for (const row of snap.despair ?? []) {
        if (getDespair(row.id) !== row.value) await setDespair(row.id, row.value);
    }
    await game.settings.set(MODULE_ID, SETTINGS.overflow, snap.overflow);
    await game.settings.set(MODULE_ID, SETTINGS.murderState, snap.murder);
    await game.settings.set(MODULE_ID, SETTINGS.motive, snap.motive);
    await game.settings.set(MODULE_ID, SETTINGS.pendingGather, snap.gather);

    for (const row of snap.resources) {
        const actor = game.actors.get(row.id);
        if (!actor) continue;
        if (!row.deceased && actor.getFlag(MODULE_ID, "deceased")) await reviveCharacter(actor);
        const update = {
            "system.resources.hitPoints.value": row.hp,
            "system.resources.stress.value": row.stress,
            "system.resources.hope.value": row.hope,
            "system.resources.actions.value": row.actions,
            ...(row.actionsMax === null ? {} : { "system.resources.actions.max": row.actionsMax })
        };
        /* Each flag of this module back as it was: one the world did not have is
           deleted with v14's forced deletion (`-=key` removes nothing in this
           Foundry, and a restore that only overwrites leaves a flag the world never
           had), one that changed is written back whole - an object with v14's forced
           replacement, which a plain write would merge into - and one that matches
           is not written at all. */
        const now = actor.flags?.[MODULE_ID] ?? {};
        for (const key of new Set([...Object.keys(now), ...Object.keys(row.flags)])) {
            if (!(key in row.flags)) update[`flags.${MODULE_ID}.${key}`] = forcedDeletion();
            else if (stableJson(now[key]) !== stableJson(row.flags[key])) update[`flags.${MODULE_ID}.${key}`] = replaced(row.flags[key]);
        }
        await actor.update(update);
    }
    // The documents that appeared - the helper actors the module makes on first need
    // among them - removed, after the tokens that may stand on them.
    for (const [name, before] of snap.documents ?? []) {
        const collection = game.collections.get(name);
        const strays = (collection?.contents ?? []).filter(d => !before.has(d.id));
        if (strays.length) await strays[0].constructor.deleteDocuments(strays.map(d => d.id));
    }

    // The chat the scenarios produced. Kept out of the log on purpose: a suite
    // that leaves forty whispers behind makes the log useless for the session
    // that follows it, and none of them are a record of anything that happened.
    const strayMessages = game.messages.filter(m => !snap.messages.has(m.id)).map(m => m.id);
    if (strayMessages.length) await ChatMessage.deleteDocuments(strayMessages);

    await settle();
    /* Read back, not assumed - by the runner now (E30): after every restore it reads
       the whole world (worldDump) and names whatever is not as tier 2 found it. The
       read-back that was here compared the module's settings alone. What is left here
       is the writes that threw. */
    if (stuck.length) throw new Error(`these settings would not be written back: ${[...new Set(stuck)].join(", ")}`);
}

/**
 * Two students stood alone together in a room nobody else is in, for the lights of an
 * Eclipse to judge (E05 C3): both tokens teleported to its centre and read back - a
 * fixture that did not take would measure a refusal instead. `back()` puts them where
 * they were. A teleport, not a walk: see the handover test's note on walls. `asked`: the
 * test has asked the world for a second pair already (E06 C4) - a probe asked after the
 * first pair was stood is a write before the ask.
 */
async function aloneTogether(killer, victim, { asked = false } = {}) {
    const { allRooms, othersInNamedRoom, othersInRoom, positionIn } = await import("./movement.mjs");
    if (!asked) {
        needs(world.atLeast("studentTokensOnScreen", 2), "the two are stood in one room by their tokens");
        needs(world.atLeast("namedRooms", 2), "one room is left to the two of them");
    }
    const scene = canvas?.scene;
    const tokens = [killer, victim].map(a => scene?.tokens?.find(t => t.actorId === a.id));
    ok(tokens.every(Boolean), "one of the two students has no token on the scene on screen");
    const room = allRooms().find(r => othersInNamedRoom(r).length === 0);
    ok(room, "every named room on the scene on screen has somebody in it");
    const was = tokens.map(t => ({ x: t.x, y: t.y }));
    const PLACE = { teleport: true, movementAction: "displace", animate: false };
    for (const t of tokens) await t.update(positionIn(room, t), PLACE);
    await settle();
    equal(stableJson(othersInRoom(killer).map(a => a.id)), stableJson([victim.id]), `the fixture could not stand the two alone in ${room}`);
    return {
        room,
        back: async () => {
            for (const [i, t] of tokens.entries()) if (scene.tokens.has(t.id)) await t.update(was[i], PLACE);
            await settle();
        }
    };
}

/**
 * A DIRECT MURDER WITH AN ACCOMPLICE, TO ITS BODY (E32 C5a): `killer` opens on `victim`, the
 * opening succeeds, `third` walks in and throws in with the killer (Partners in crime), and
 * the killer's Finishing blow leaves the victim dead at Stage 6 - which arms the betrayal
 * offer for the third. By a body rather than the GM's Stage 6, as the grid's TP01 is: the
 * offer is a body's (the owner's Q2, section 2.2's I6). The caller revives the victim.
 */
async function accompliceAtStageSix(M, killer, victim, third) {
    await M.openMurder({ killerId: killer.id, victimId: victim.id });
    // The killer's player is asked the roll too; whichever lands first, a success starts the incident.
    if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
    await settle();
    await M.thirdPartyEnters(third);
    await M.resolveCrisisAction({ actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true });
    for (let i = 0; i < 4 && M.crisisRefusal(killer, "finishingBlow")?.why === "not their turn"; i++) await M.passTurn();
    must(!M.crisisRefusal(killer, "finishingBlow"), `the killer's Finishing blow is refused: ${M.crisisRefusal(killer, "finishingBlow")?.why}`);
    await M.resolveCrisisAction({ actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
    await settle();
    must(M.murderState()?.stage === "resolution" && M.betrayalTarget(third)?.id === killer.id,
        `the fixture's Stage 6 with an offer to the accomplice did not come: ${stableJson({ state: M.murderState(), offer: M.betrayalTarget(third)?.id ?? null })}`);
}

/**
 * A BODY THE GM MADE, WITH STAGE 6 TAKEN (E32 C6): the running incident's victim killed as
 * the GM's "A character dies" kills them (chapter.mjs `killCharacter`, kept by the GMs),
 * and its "the victim died - Stage 6?" (`offerStageSix`) answered yes, which is
 * `beginResolution("victimKilled")` over a death. For a trap, whose builder deals no blow.
 * Any other window is answered no and its title returned. The caller revives the victim.
 */
async function killedIntoStageSix(victim) {
    const { killCharacter } = await import("./chapter.mjs");
    const D = foundry.applications.api.DialogV2;
    const own = Object.getOwnPropertyDescriptor(D, "confirm");
    const title = game.i18n.localize("DRPG.Chapter.stageSixTitle");
    const unanswered = [];
    D.confirm = async cfg => {
        if (cfg?.window?.title === title) return true;
        unanswered.push(cfg?.window?.title ?? "");
        return false;
    };
    try {
        must(await killCharacter(victim, { secret: true, keepBullets: true }), `${victim.name}'s death was not kept by the GMs`);
    } finally {
        if (own) Object.defineProperty(D, "confirm", own); else delete D.confirm;
    }
    await settle();
    return unanswered;
}

/**
 * THE THIRD'S TWO WINDOWS FOR A BETRAYAL IN AN ECLIPSE (E32 C5b), answered as their player
 * would: the confirmation (yes) and the note (`note`). Any other window is closed unanswered
 * and its title kept in `unanswered`. Put back in `finally`.
 */
async function withBetrayalWindows(note, run) {
    const D = foundry.applications.api.DialogV2;
    const own = { wait: Object.getOwnPropertyDescriptor(D, "wait"), confirm: Object.getOwnPropertyDescriptor(D, "confirm") };
    const title = game.i18n.localize("DRPG.Murder.betrayalTitle");
    const unanswered = [];
    D.confirm = async cfg => {
        if (cfg?.window?.title === title) return true;
        unanswered.push(cfg?.window?.title ?? "");
        return false;
    };
    D.wait = async cfg => {
        if (cfg?.window?.title === title) return note;
        unanswered.push(cfg?.window?.title ?? "");
        return null;
    };
    try {
        await run();
    } finally {
        for (const [name, desc] of Object.entries(own)) {
            if (desc) Object.defineProperty(D, name, desc); else delete D[name];
        }
    }
    return unanswered;
}

/**
 * The words of every private card this client sent while `run` ran (E06 C4): each
 * `secret.card` packet (secret.mjs `postSecret`) as { id, to, html } - the card's id, the
 * users it was addressed to and its words - and every packet let through. A card's
 * document names nobody when it is veiled, so who was told is read here, off the packets.
 * The GM's own copy travels no socket and is not among them.
 */
async function wordsSent(run) {
    const socket = game.socket;
    const own = Object.getOwnPropertyDescriptor(socket, "emit");
    const send = socket.emit;
    const sent = [];
    socket.emit = function (event, packet, options, ...rest) {
        if (packet?.action === "secret.card") {
            sent.push({ id: packet.id ?? null, to: options?.recipients ?? [], html: String(packet.html ?? ""), meta: packet.meta ?? null });
        }
        return send.call(this, event, packet, options, ...rest);
    };
    try {
        await run();
    } finally {
        if (own) Object.defineProperty(socket, "emit", own); else delete socket.emit;
    }
    return sent;
}

/**
 * The incident's dice this client relayed while `run` ran (E06 C6): each `dice.show`
 * packet (private-rolls.mjs `relayIncidentDice`) as { id, to } - the message's id and
 * the users it was addressed to. Shaped as `wordsSent`, above.
 */
async function relayedDice(run) {
    const socket = game.socket;
    const own = Object.getOwnPropertyDescriptor(socket, "emit");
    const send = socket.emit;
    const sent = [];
    socket.emit = function (event, packet, options, ...rest) {
        if (packet?.action === "dice.show") sent.push({ id: packet.id ?? null, to: options?.recipients ?? [] });
        return send.call(this, event, packet, options, ...rest);
    };
    try {
        await run();
    } finally {
        if (own) Object.defineProperty(socket, "emit", own); else delete socket.emit;
    }
    return sent;
}

/**
 * A roll the module throws, whose document names nobody (E06 C5a; since C5b the module's own
 * doing, private-rolls.mjs `neutralRollSource` - C5a's tests emptied it here with a hook of
 * their own). Thrown through `rollTrait` as the suite throws every roll. `faces` sets the dice
 * where the harness reads them (`__forceRoll`); a real table throws its own, so a Fear there
 * moves Daggerheart's Fear, which restore() does not put back and this does. `title` is the
 * action's, as `rollTrait` is given one; `experiences` the ids the roll dialog would have
 * picked (`__forceExperiences`, E06 fix r1-G1). The caller deletes the message.
 */
async function neutralRoll(who, { remember = false, faces = null, title = null, experiences = null } = {}) {
    const rolls = await import("./action-rolls.mjs");
    const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
    const hadPicks = Object.hasOwn(globalThis, "__forceExperiences"), picks = globalThis.__forceExperiences;
    const { gameSettings } = CONFIG.DH.SETTINGS;
    const fear = game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear);
    try {
        if (faces) globalThis.__forceRoll = faces;
        if (experiences) globalThis.__forceExperiences = experiences;
        const outcome = await rolls.rollTrait(who, "eye", { remember, ...(title ? { title } : {}) });
        return { outcome, message: outcome?.raw?.message ?? null };
    } finally {
        if (hadForce) globalThis.__forceRoll = force;
        else delete globalThis.__forceRoll;
        if (hadPicks) globalThis.__forceExperiences = picks;
        else delete globalThis.__forceExperiences;
        await settle();
        if (game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear) !== fear) await game.settings.set(CONFIG.DH.id, gameSettings.Resources.Fear, fear);
    }
}

/**
 * A swing to measure (E32+E07 C8): a direct murder between two students with players, its
 * opening ruled a success and the killer's turn come, the victim with no marks, and the killer
 * holding a Tier 1 knife readied - one point of durability, so the first Despair breaks it.
 * `identity` is the knife's `drpgItemId`, as a Search hands one over. `putBack` deletes the
 * knife and whatever the killer was handed since, and puts Daggerheart's Fear back as found: a
 * Despair the suite throws moves it, and restore() does not (`neutralRoll`, above). Ask the
 * world's rows before calling it - it writes.
 */
async function swingFixture(identity = null) {
    const M = await import("./murder.mjs");
    const { livingStudents } = await import("./chapter.mjs");
    const { equippedFor } = await import("./use-items.mjs");
    const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
    const [killer, victim] = livingStudents().filter(player);
    const { gameSettings } = CONFIG.DH.SETTINGS;
    const fear = game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear);
    await M.openMurder({ killerId: killer.id, victimId: victim.id });
    if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
    await settle();
    if (M.murderState()?.stage === "incident" && !M.isTheirTurn(killer)) await M.passTurn();
    await victim.update({ "system.resources.hitPoints.value": 0, "system.resources.stress.value": 0 });
    const [knife] = await killer.createEmbeddedDocuments("Item", [{ name: "SUITE knife swung in the fight", type: "loot",
        flags: { [MODULE_ID]: { category: "crimeTool", equipped: true, tier: 1, ...(identity ? { drpgItemId: identity } : {}) } } }]);
    const had = new Set(killer.items.map(i => i.id));
    const putBack = async () => {
        for (const item of killer.items.filter(i => !had.has(i.id) || i.id === knife?.id)) await item.delete();
        if (game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear) !== fear) await game.settings.set(CONFIG.DH.id, gameSettings.Resources.Fear, fear);
    };
    const ready = M.murderState()?.stage === "incident" && M.isTheirTurn(killer) && Boolean(knife) && equippedFor(killer, "crimeTool")?.id === knife.id;
    if (!ready) await putBack();
    must(ready, `the fixture's fight is not at the killer's turn with the knife in hand: ${stableJson(M.murderState())}`);
    return { M, killer, victim, knife, putBack,
        health: () => victim.system.resources.hitPoints.value,
        handed: () => killer.items.filter(i => !had.has(i.id)).length };
}

/**
 * A verdict run with its windows answered (E05 C11): every `DialogV2.wait` for the length
 * of `run` is recorded - its classes, title and how many picks a Level Up window offers -
 * and a Level Up window is answered by `answer(entry)`, any other closed. The GM's Level Up
 * windows are real windows on this client (01-runtests draws them), so a verdict awaited
 * unanswered would wait for somebody to press a button. Foundry's own `wait` is put back.
 */
async function withAdvanceWindows(answer, run) {
    const D = foundry.applications.api.DialogV2;
    const own = Object.getOwnPropertyDescriptor(D, "wait");
    const asked = [];
    D.wait = async cfg => {
        const classes = [...(cfg?.classes ?? [])];
        const entry = { classes, title: cfg?.window?.title ?? "",
            picks: (String(cfg?.content ?? "").match(/name="pick\.\d+\.option"/g) ?? []).length };
        asked.push(entry);
        return classes.includes("drpg-advance") ? answer(entry) : null;
    };
    try {
        await run();
    } finally {
        if (own) Object.defineProperty(D, "wait", own);
        else delete D.wait;
    }
    return asked;
}

/** The trial's record with the verdict not yet given, for `run`, and as it was afterwards. */
async function withVerdictOpen(run) {
    const { trialProgress } = await import("./vote.mjs");
    const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {});
    try {
        await game.settings.set(MODULE_ID, SETTINGS.trialProgress, { ...trialProgress(), chapter: getClock().chapter, verdictApplied: false });
        return await run();
    } finally {
        await game.settings.set(MODULE_ID, SETTINGS.trialProgress, stored);
    }
}

/**
 * A safeword press measured on this GM's browser, and put back (E06 C9). `act(fresh)` presses;
 * `fresh()` is the safeword cards posted since; `read(cards)` turns them into plain readings
 * before they are deleted. The pause, the popups the press raised and `player`'s entry in the
 * repeat window (cleared first, so an earlier press does not swallow this one) are put back.
 */
async function safewordRun(S, player, act, read) {
    const before = new Set(game.messages.map(m => m.id));
    const fresh = () => game.messages.filter(m => !before.has(m.id) && m.getFlag(MODULE_ID, S.SAFEWORD_FLAG));
    const popups = () => [...document.querySelectorAll(".drpg-popup")];
    const up = new Set(popups());
    const wasPaused = game.paused;
    const held = S.safewordPosts.get(player.id);
    S.safewordPosts.delete(player.id);
    try {
        await act(fresh);
        await until(() => fresh().length > 0);
        await settle();
        return { ...(await read(fresh())), paused: game.paused, popups: popups().filter(p => !up.has(p)).map(p => p.textContent) };
    } finally {
        for (const m of fresh()) { try { await m.delete(); } catch { /* already gone */ } }
        for (const p of popups()) if (!up.has(p)) p.remove();
        if (held === undefined) S.safewordPosts.delete(player.id);
        else S.safewordPosts.set(player.id, held);
        if (game.paused !== wasPaused) await game.togglePause(wasPaused);
    }
}

const SCENARIOS = [
    ["a direct murder opens on the killer and tells the victim", async () => {
        const [killer, victim] = cast(2);
        // Asked of the world before the incident writes to it (E30: it was asked after).
        needs(world.ownedByPlayer(victim), "there is nobody to tell");
        const drpg = game.drpg;
        const before = game.messages.size;

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        equal(drpg.murderState()?.stage, "openingRoll", "stage after opening");

        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();

        const state = drpg.murderState();
        equal(state.stage, "incident", "stage after the opening roll");
        equal(state.turnSide, "victim", "the victim opens the incident");

        /*
         * THE VICTIM'S PLAYER, NOT THE FIRST OWNER (E01, 24.09.2026; audit S14-06). This
         * used to ask `game.users.find(u => victim.testUserPermission(u, "OWNER"))`, and
         * a GM owns every actor - so it found a GM, and every card whispered to the GMs
         * at the opening (they are copied on all of them) counted as telling the victim.
         * The other half read `m.content`, which on a private card is the stub
         * secret.mjs leaves in the document, so it could never match. It passed with the
         * victim told nothing. Now: the player who owns the victim, a whisper to them,
         * and the words that whisper carries, read the way the card is read.
         */
        const { contentOf } = await import("./secret.mjs");
        const owner = game.users.find(u => !u.isGM && victim.testUserPermission(u, "OWNER"));
        const toVictim = [...game.messages].slice(before).filter(m => m.whisper.includes(owner.id));
        ok(toVictim.length, `${owner.name}, who plays the victim, was sent nothing when the incident began`);
        ok(toVictim.some(m => /moving on you/i.test(contentOf(m))),
            `${owner.name} was whispered to, but not told the incident began: `
            + toVictim.map(m => contentOf(m).replace(/<[^>]+>/g, "").slice(0, 60)).join(" | "));
    }],

    ["a direct murder's victim holds nothing until the opening succeeds", async () => {
        /*
         * E06 C2, 27.09.2026; audit S04-01, the owner's D6. A direct murder asks its victim
         * nothing at the opening, and a killer's roll that fails ends it as if it never
         * happened - but the victim's player was sent the cast as it opened, and with it the
         * curtain, the music and the killer's name. The audience the GM sends to
         * (`incidentAudienceIds`) and the seat this browser reads (`incidentWitness`, this GM
         * sitting in the victim's chair) are read at once after the open and after the roll's
         * success: the victim is in neither at the opening and in both once the fight starts;
         * the killer's player is told from the start. Both students have a connected player:
         * an opening roll with nobody to ask is thrown on this client and races the one below
         * (E05, "the trial asks only for the killers of deaths the table knows..."). What
         * reaches the victim's browser is 13-murder-signals' "opening" phase: tier 2 holds the
         * stores, so no cast is sent here.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer whose player is asked the opening roll, and a victim with a player to tell");
        const M = await import("./murder.mjs");
        const { incidentWitness } = await import("./settings.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const read = state => {
            const told = M.incidentAudienceIds(state);
            return { stage: state?.stage ?? null, killer: told.includes(player(killer).id), victim: told.includes(player(victim).id),
                seat: incidentWitness().seat };
        };
        const assignedBefore = game.user.character ?? null;
        try {
            await game.user.update({ character: victim.id });
            const atOpening = read(await M.openMurder({ killerId: killer.id, victimId: victim.id }));
            await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            const atIncident = read(M.murderState());
            equal(stableJson([atOpening, atIncident]), stableJson([
                { stage: "openingRoll", killer: true, victim: false, seat: null },
                { stage: "incident", killer: true, victim: true, seat: victim.id }
            ]), "a direct murder's victim is told at the opening, or not once it succeeds, or the killer is not told from the start");
        } finally {
            await game.user.update({ character: assignedBefore?.id ?? null });
        }
    }],

    ["a failed opening tells the victim nothing", async () => {
        /*
         * E06 C2, 27.09.2026; the owner's D6. A direct murder whose killer's roll fails never
         * happened as far as its victim is concerned (`resolveVictimOpening`'s note): nothing
         * addressed to their player from the open to the close - no packet this client sends
         * (every `game.socket.emit` caught for the test's length, and let through) and no chat
         * card whispered to them. The net is shown to catch: the opening roll is asked of the
         * killer's connected player (gm-bridge.mjs `askOpeningRoll`), addressed, and it sees
         * that. Tier 2 holds the stores, so a cast would not be sent here even to a
         * participant; 13-murder-signals reads the victim's browser for it. Red on the first
         * C2 tree (27.09): the invitation's withdrawal, `murder.openingCancel`, was addressed
         * to the victim's player as well (murder.mjs `revokeOpeningInvitation`).
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer whose player is asked the opening roll, and a victim with a player to tell");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const before = game.messages.size;
        const sent = [];
        const socket = game.socket;
        const ownEmit = Object.getOwnPropertyDescriptor(socket, "emit");
        const send = socket.emit;
        socket.emit = function (event, packet, options, ...rest) {
            sent.push({ action: packet?.action ?? null, to: options?.recipients ?? [] });
            return send.call(this, event, packet, options, ...rest);
        };
        let opened = null, failed = null, after = null;
        try {
            opened = await M.openMurder({ killerId: killer.id, victimId: victim.id });
            failed = await M.resolveKillerOpening({ total: 1, isCritical: false, withHope: false });
            await settle();
            after = M.murderState();
        } finally {
            if (ownEmit) Object.defineProperty(socket, "emit", ownEmit); else delete socket.emit;
        }
        const to = user => sent.filter(p => p.to.includes(user.id)).map(p => p.action);
        /* A veiled card is whispered to every player alike and its words travel by an addressed
           packet (secret.mjs `VEILED_FLAG`), which the net above reads: measured 27.09, one such
           card - from the GM, no speaker - named the victim's player in its whisper as it names
           everybody's. The cards that count are the ones addressed. */
        const { VEILED_FLAG } = await import("./secret.mjs");
        const whisperedTo = [...game.messages].slice(before)
            .filter(m => m.whisper.includes(player(victim).id) && !m.getFlag(MODULE_ID, VEILED_FLAG));
        const whispered = whisperedTo.length;
        equal(stableJson([opened?.stage ?? null, failed?.success ?? null, after, to(player(killer)).includes("murder.openingAsk")]),
            stableJson(["openingRoll", false, null, true]),
            `the opening did not fail and close, or the net did not see the roll asked of the killer's player: ${stableJson(sent)}`);
        equal(stableJson([to(player(victim)), whispered]), stableJson([[], 0]),
            "the victim's player was sent a packet or a chat card by an opening that failed: "
            + stableJson(whisperedTo.map(m => ({ author: m.author?.id ?? null, speaker: m.speaker?.actor ?? null, rolls: m.rolls?.length ?? 0,
                flags: Object.keys(m.flags?.[MODULE_ID] ?? {}), text: String(m.content ?? "").replace(/<[^>]+>/g, "").slice(0, 80) }))));
    }],

    ["an indirect victim's copy does not name the builder, and no copy holds the Reroll receipt", async () => {
        /*
         * E06 C3, 27.09.2026; audit S04-01 (L09, L10). Every holder of the cast was sent the
         * record whole but for the swing memo: a trap's victim read its builder in their copy
         * (and on their Event card), and every participant held the Reroll receipt. What each
         * holder is sent is `castFor` in murder.mjs, read here for three students with players:
         * a trap is opened, its victim's roll misses (the incident starts), a third walks in on
         * the victim's side and the victim takes a crisis action, which writes the receipt;
         * then Stage 6, where the builder is let back in and the third - on the victim's side,
         * who never met the builder - is offered no betrayal (fix r1-G4, 28.09.2026; the round-1
         * review's M3: until then this test asserted the offer, and the builder's name with it,
         * in the third's copy - red at d9d6ee2 once it expects none; since E32 C6 the GM's Stage 6
         * with the victim alive arms no offer for anybody, and the trap's rule after a body is
         * "after a body a direct murder's silent third is offered the betrayal, ..."). Read, not sent: tier 2 holds the stores and `sendCast` sends nothing while it does
         * (the packet a browser receives is 13-murder-signals' "trap" phase). Red on 699b29d:
         * `castFor` did not exist.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a builder, a victim and a third, each with a player to be sent a copy");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim, third] = livingStudents().filter(player);
        const copies = (...whom) => whom.map(a => {
            const c = M.castFor(player(a).id, incidentCast());
            return { killer: c.killerId ?? null, turn: c.killerTurnId ?? null, receipt: c.lastCrisis ?? null, offer: c.betrayal?.killerId ?? null };
        });
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        // The victim's player is asked the roll too; whichever lands first, a miss starts the incident.
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        await M.thirdPartyEnters(third);
        await game.drpg.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: false });
        await settle();
        const record = incidentCast();
        const atIncident = copies(victim, third);
        await M.beginResolution("test");
        await settle();
        const atStage6 = copies(victim, third, builder);
        const turn = incidentCast().killerTurnId ?? null;
        const none = { killer: null, turn: null, receipt: null, offer: null };
        equal(stableJson([record.killerId, record.thirdId, Boolean(record.lastCrisis), turn]), stableJson([builder.id, third.id, true, builder.id]),
            `the fixture is not a trap with a third and a receipt, its killers' turn is not the builder's: ${stableJson(record)}`);
        equal(stableJson(atIncident), stableJson([none, none]),
            "during the trap the victim's or the third's copy names the builder, or a copy holds the Reroll receipt");
        equal(stableJson([atStage6, M.betrayalTarget(third)?.id ?? null]), stableJson([[none, none, { ...none, killer: builder.id, turn: builder.id }], null]),
            "at Stage 6 the victim's or the third's copy names the builder, the third on the victim's side is offered the betrayal, the builder's own copy lost its name, or a copy holds the receipt");
    }],

    ["in a trap only an accomplice is offered the betrayal, and only their copy holds it", async () => {
        /*
         * E06 fix r1-G4, 28.09.2026; the round-1 review's M3. `betrayalCandidate` offers a trap's
         * betrayal only to a third on the killer's side (the test above: a third on the victim's
         * side is offered none), and `castFor` keeps the offer out of every copy but its third's.
         * The same fixture as above, but the third throws in with the builder (Partners in crime).
         * Green at d9d6ee2 but for the builder's copy, which held the offer too. Stage 6 by a
         * body since E32 C6 - the victim killed by the GM, Stage 6 taken (`killedIntoStageSix`):
         * the offer is a body's, and the GM's Stage 6 with the victim alive arms none.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a builder, a victim and a third, each with a player to be sent a copy");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim, third] = livingStudents().filter(player);
        const copies = (...whom) => whom.map(a => {
            const c = M.castFor(player(a).id, incidentCast());
            return { killer: c.killerId ?? null, offer: c.betrayal?.killerId ?? null };
        });
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        await M.thirdPartyEnters(third);
        await game.drpg.resolveCrisisAction({ actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true });
        await settle();
        const { isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        try {
            const unanswered = await killedIntoStageSix(victim);
            must(M.murderState()?.stage === "resolution" && !unanswered.length,
                `the fixture's body did not take the trap to Stage 6: ${stableJson({ stage: M.murderState()?.stage ?? null, unanswered })}`);
            equal(stableJson([M.murderState()?.thirdSide ?? null, M.betrayalTarget(third)?.id ?? null, copies(third, builder, victim)]),
                stableJson(["killer", builder.id, [{ killer: builder.id, offer: builder.id }, { killer: builder.id, offer: null }, { killer: null, offer: null }]]),
                "the accomplice of a trap is not offered the betrayal, their copy does not hold it, or another copy holds it");
        } finally {
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["after a body a direct murder's silent third is offered the betrayal, a trap's victim-side third is not", async () => {
        /*
         * E32 C6, 28.09.2026; audit S04-11, S04-12, the owner's Q2 (b). It replaces E06 fix
         * r1-G4's "a direct murder's third on the victim's side is still offered the betrayal",
         * which pinned the answer by the GM's Stage 6 with the victim alive and left the rule
         * to the owner. The offer is a body's now (`leftABody`), and the owner ruled: a direct
         * murder's third who stayed and chose nothing keeps it; one who tried Escape together
         * does not; a trap's third on the victim's side never met the builder and is offered
         * none (E06 fix G4). Three incidents, one victim revived between them: a direct murder
         * to the killer's Finishing blow with its third silent; the same with its third's
         * Escape together failed first; a trap sprung on the victim with the third on their
         * side, the victim killed by the GM and Stage 6 taken (`killedIntoStageSix`). Read each
         * time: the stage, the body, the offer on record and the tile's answer. Red at 35bba6b:
         * <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and a third, each with a player");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const read = () => [M.murderState()?.stage ?? null, isDeadForGm(victim), incidentCast().betrayal?.thirdId ?? null, M.betrayalTarget(third)?.id ?? null];
        const direct = async (escape) => {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            await M.thirdPartyEnters(third);
            if (escape) await M.resolveCrisisAction({ actorId: third.id, key: "sharedEscape", total: 0, isCritical: false, withHope: true });
            for (let i = 0; i < 4 && M.crisisRefusal(killer, "finishingBlow")?.why === "not their turn"; i++) await M.passTurn();
            must(!M.crisisRefusal(killer, "finishingBlow"), `the killer's Finishing blow is refused: ${M.crisisRefusal(killer, "finishingBlow")?.why}`);
            await M.resolveCrisisAction({ actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
            await settle();
            const seen = read();
            await M.endMurder({ reason: "test", followUp: false });
            await M.clearBetrayalOffer();
            await reviveCharacter(victim, { quiet: true });
            await settle();
            return seen;
        };
        try {
            const silent = await direct(false);
            const escaped = await direct(true);
            await M.openMurder({ killerId: killer.id, victimId: victim.id, indirect: true });
            if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
            await settle();
            await M.thirdPartyEnters(third);
            const unanswered = await killedIntoStageSix(victim);
            const trap = [...read(), unanswered];
            equal(stableJson([silent, escaped, trap]),
                stableJson([["resolution", true, third.id, killer.id], ["resolution", true, null, null], ["resolution", true, null, null, []]]),
                "after the blow a direct murder's silent third is not offered the betrayal, or one who tried to escape is, "
                + "or after a body a trap's third on the victim's side is (stage, body, offer on record, the tile's answer)");
        } finally {
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["closing without a body records nobody and offers nothing", async () => {
        /*
         * E32 C6, 28.09.2026; audit S04-11. The Blackened were recorded on any close from Stage
         * 6 but an escape's, the betrayal was offered on any move to it, and the GM's checklist
         * was the body's for every close but an escape's - so a Stage 6 whose victim lived made
         * its killer a Blackened, offered their third the betrayal and told the GM where the
         * body was. `leftABody` decides all three now. Two direct murders with a third who
         * chose nothing: the GM takes the first to Stage 6 with the victim alive and closes it;
         * the second is closed in the fight. Read: the offer at Stage 6, each close's checklist
         * (its title, its buttons, and its one sentence - the victim survived, or the incident
         * was interrupted) and the Blackened grown. Red at 35bba6b: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and a third, each with a player");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const esc = foundry.utils.escapeHTML;
        const before = M.blackenedIds();
        const D = foundry.applications.api.DialogV2;
        const own = Object.getOwnPropertyDescriptor(D, "wait");
        const shown = [];
        D.wait = async cfg => {
            const html = typeof cfg?.content === "string" ? cfg.content : cfg?.content?.outerHTML ?? "";
            shown.push({ title: cfg?.window?.title ?? "", buttons: (cfg?.buttons ?? []).map(b => b.action), html });
            return "close";
        };
        const fight = async () => {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            await M.thirdPartyEnters(third);
            await settle();
        };
        try {
            await fight();
            must(await M.beginResolution("test"), "the GM could not take the fixture to Stage 6");
            await settle();
            const stageSix = [M.murderState()?.stage ?? null, incidentCast().betrayal ?? null, M.betrayalTarget(third)?.id ?? null];
            await M.endMurder({ reason: "test" });
            await fight();
            await M.endMurder({ reason: "test" });
            await settle();
            const says = [
                game.i18n.format("DRPG.Murder.afterSurvived", { victim: esc(victim.name), killer: esc(killer.name) }),
                game.i18n.localize("DRPG.Murder.afterInterrupted")
            ];
            const read = shown.map((s, i) => [s.title, s.buttons, s.html.includes(says[i])]);
            const title = game.i18n.localize("DRPG.Murder.afterTitle");
            equal(stableJson([stageSix, read, M.blackenedIds().filter(id => !before.includes(id))]),
                stableJson([["resolution", null, null], [[title, ["remnants", "close"], true], [title, ["close"], true]], []]),
                "a Stage 6 with the victim alive armed the betrayal, a close without a body showed the body's checklist, or recorded a Blackened");
        } finally {
            if (own) Object.defineProperty(D, "wait", own); else delete D.wait;
        }
    }],

    ["each participant is told the incident is over, a bystander nothing, a direct victim before the opening nothing", async () => {
        /*
         * E32 C6, 28.09.2026; audit S13-03. The close told the GMs and nobody else. Each seat's
         * player at the stage it closed on is told now (`tellIncidentClosed`), in one veiled
         * card whose words name nobody: "The incident is over.", and to a victim still alive
         * "... You can act again." - the victim's words as the same card's, to them alone. A
         * direct murder closed by the GM three times, a bystander with a player beside it: at
         * the opening roll, where its victim holds no seat (D6); in the fight; and after the
         * killer's Finishing blow, whose victim is dead. Read off the `secret.card` packets the
         * GM sent (`wordsSent`): who was sent which words, and how many cards, each veiled.
         * Red at 35bba6b: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and a bystander, each with a player");
        const M = await import("./murder.mjs");
        const { isVeiled } = await import("./secret.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, bystander] = livingStudents().filter(player);
        const who = { [player(killer).id]: "killer", [player(victim).id]: "victim", [player(bystander).id]: "bystander" };
        const words = { [`<p>${game.i18n.localize("DRPG.Murder.closedYou")}</p>`]: "over",
            [`<p>${game.i18n.localize("DRPG.Murder.closedVictimYou")}</p>`]: "free" };
        const told = sent => {
            const notices = sent.filter(p => words[p.html]);
            const ids = [...new Set(notices.map(p => p.id))];
            return [notices.flatMap(p => p.to.map(id => `${who[id] ?? id}:${words[p.html]}`)).sort(), ids.length,
                ids.every(id => isVeiled(game.messages.get(id)))];
        };
        const open = async () => {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
        };
        const close = async () => told(await wordsSent(() => M.endMurder({ reason: "test", followUp: false })));
        try {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            must(M.murderState()?.stage === "openingRoll", "the opening had been answered before the GM closed it");
            const atOpening = await close();
            await open();
            const inFight = await close();
            await open();
            for (let i = 0; i < 4 && M.crisisRefusal(killer, "finishingBlow")?.why === "not their turn"; i++) await M.passTurn();
            await M.resolveCrisisAction({ actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
            await settle();
            must(isDeadForGm(victim), "the fixture's Finishing blow left the victim alive");
            const afterBody = await close();
            equal(stableJson([atOpening, inFight, afterBody]),
                stableJson([[["killer:over"], 1, true], [["killer:over", "victim:free"], 1, true], [["killer:over", "victim:over"], 1, true]]),
                "a close told a participant nothing or the wrong words, told the bystander or a direct victim at the opening, "
                + "or posted more than one card or an unveiled one (who:words, cards, veiled)");
        } finally {
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a standing betrayal offer sends its third nothing of the next incident, and the next incident nothing of it", async () => {
        /*
         * E06 fix r1-G4, 28.09.2026; the round-1 review's m4. The offer outlives its incident
         * until the day turns (D18), and `castOwners` seats its third so it reaches their
         * browser. An incident opened the same day then sent them its cast whole - a direct
         * one's killer and victim from its opening roll on - and sent each of its own seats the
         * offer, the earlier killer named. What each is sent is `castFor`, read here for a cast
         * written as `openMurder` and `endMurder` leave it (the offer kept across the close):
         * the new incident's killer and victim, and the earlier offer's third, who is neither.
         * Red at d9d6ee2.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an earlier offer's third, each with a player");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const clock = getClock() ?? {};
        const offer = { thirdId: third.id, killerId: victim.id, chapter: clock.chapter, day: clock.day };
        const next = { killerId: killer.id, victimId: victim.id, killerTurnId: killer.id, thirdId: null, thirdSide: null, lastCrisis: null, betrayal: offer };
        const read = (a, cast, state) => {
            const c = M.castFor(player(a).id, cast, state);
            return { keys: Object.keys(c).sort().join(","), offer: c.betrayal?.killerId ?? null };
        };
        const at = state => [killer, victim, third].map(a => read(a, next, state));
        const seat = { keys: "betrayal,killerId,killerTurnId,lastCrisis,thirdId,thirdSide,victimId", offer: null };
        const theirs = { keys: "betrayal", offer: victim.id };
        equal(stableJson(at({ active: true, stage: "openingRoll" })), stableJson([seat, { keys: "", offer: null }, theirs]),
            "at the next incident's opening the offer's third is sent more than the offer, or a seat of it is sent the offer");
        equal(stableJson(at({ active: true, stage: "incident" })), stableJson([seat, seat, theirs]),
            "during the next incident the offer's third is sent more than the offer, or a seat of it is sent the offer");
        equal(stableJson([killer, third].map(a => read(a, { betrayal: offer }, {}))), stableJson([{ keys: "", offer: null }, theirs]),
            "after the close the offer's third is not sent it, or somebody else is");
    }],

    ["a running incident's world half holds its stage alone", async () => {
        /*
         * E32 C2, 28.09.2026; E05's Q8, the owner's Q1 (a) of 28.09. The world half of
         * `murderState` is on every browser, and after E05 it still held the fight: the round,
         * whose side acts, the hindrances, what is spent, the third's one action. Every reader
         * of those runs where the cast is held, so they are the cast's now (gm-stores.mjs
         * `INCIDENT_FIGHT`). A trap is opened on two students with players, its victim's roll
         * misses and the victim takes a crisis action, which passes the turn: the world half
         * holds `active` and `stage` alone, and the GMs' record holds the fight - a round and
         * a side to act - which `murderState()` merges.
         * Red at c3aea03: the world half held the turn and the side.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a trap's builder and its victim, each with a player");
        const M = await import("./murder.mjs");
        const S = await import("./gm-stores.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim] = livingStudents().filter(player);
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        // The victim's player is asked the roll too; whichever lands first, a miss starts the incident.
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        await game.drpg.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: false });
        await settle();
        const worldHalf = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        const record = S.castStore.record();
        const merged = M.murderState();
        equal(stableJson([Object.keys(worldHalf).sort(), worldHalf.stage ?? null, typeof record.turn, typeof record.turnSide,
            merged?.turn === record.turn && merged?.turnSide === record.turnSide]),
            stableJson([["active", "stage"], "incident", "number", "string", true]),
            `the world half of a running incident holds more than its stage, or the GMs' record does not hold the fight: ${stableJson({ worldHalf, fight: S.INCIDENT_FIGHT.map(f => [f, record[f] ?? null]) })}`);
    }],

    ["a participant's copy carries the fight, a bystander's browser holds none of it", async () => {
        /*
         * E32 C2, 28.09.2026. The fight left the world half (the test above), and each holder
         * of the cast is sent it in their copy (murder.mjs `castFor`): the victim's panel asks
         * whose turn it is of their own browser. A direct murder is opened between two students
         * with players and a third with a player stands elsewhere; the victim takes a crisis
         * action, which passes the turn. Each copy is read as `castFor` makes it - tier 2
         * holds the stores and nothing is sent while it does; the packets a player's browser
         * receives are 13-murder-signals' "dice" and 61's F8. The killer's and the victim's
         * copies hold every field of the fight as the GMs read it but the Key Remnants' count,
         * which the GMs hold and no copy does (fix r1-G1, 29.09.2026; the review's m1); the
         * bystander is sent nothing and their world half holds the stage alone. Red at
         * c3aea03: no copy held the turn; the count, red at 2c9b284: both copies held 5.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and a bystander, each with a player");
        const M = await import("./murder.mjs");
        const S = await import("./gm-stores.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, bystander] = livingStudents().filter(player);
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        if (M.murderState()?.stage === "openingRoll") await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        // A pass writes the cast alone, and the GM's tracker and the chime hear it by this hook (settings.mjs; the review's C-m3).
        let castHooks = 0;
        const castHook = Hooks.on("drpgCastChanged", () => castHooks++);
        try { await game.drpg.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: false }); await settle(); }
        finally { Hooks.off("drpgCastChanged", castHook); }
        const state = M.murderState();
        must(state?.stage === "incident" && Number.isFinite(state.turn), `the fixture's fight is not running: ${stableJson(state)}`);
        ok(castHooks > 0, "the victim's action passed the turn and `drpgCastChanged` was not called");
        const fight = stableJson(S.INCIDENT_FIGHT.map(f => [f, f === "keyRemnants" ? null : state[f] ?? null]));
        must(Number.isFinite(state.keyRemnants), `the GMs hold no Key Remnants' count: ${stableJson(state)}`);
        const read = a => {
            const copy = M.castFor(player(a).id, incidentCast());
            return { keys: Object.keys(copy).length, fight: stableJson(S.INCIDENT_FIGHT.map(f => [f, copy[f] ?? null])) === fight };
        };
        const worldHalf = Object.keys(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}).sort();
        equal(stableJson([read(killer).fight, read(victim).fight, read(bystander).keys, worldHalf]), stableJson([true, true, 0, ["active", "stage"]]),
            `a participant's copy does not carry the fight as the GMs read it, the bystander is sent something, or their world half holds more than the stage: ${
                stableJson({ killer: read(killer), victim: read(victim), bystander: read(bystander), worldHalf, fight })}`);
    }],

    ["a victim who runs out on the last blow is closed once", async () => {
        /*
         * E32 C4, 28.09.2026; audit S04-26. The victim running out was asked twice: by the
         * primary GM's `updateActor` hook on the blow's damage and by the crisis action after
         * it, and both read stage "incident" before either wrote Stage 6. A direct murder is
         * opened between two students with players; the victim is left one Health short of
         * running out with Sanity full, and the killer's Strike runs them out; the GM closes.
         * Read: the stage after the blow, the ran-out cards, the victim dead, a second killing
         * that reached chapter.mjs's "already dead" warning, and the closes - one of each and
         * none of the last but one. Red at f177726: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const M = await import("./murder.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const title = game.i18n.localize("DRPG.Murder.ranOutTitle");
        const already = game.i18n.format("DRPG.Chapter.alreadyDead", { name: victim.name });
        const { wordsOf } = await import("./secret.mjs");
        const messages = [];
        let closes = 0, again = 0;
        // A GM's card keeps its words apart from the document (secret.mjs), so they are read as the grid reads them.
        const created = Hooks.on("createChatMessage", message => { messages.push(message); });
        const closed = Hooks.on("drpgIncidentClosed", () => { closes++; });
        const warn = ui.notifications.warn;
        ui.notifications.warn = function (message, ...rest) {
            if (message === already) again++;
            return warn.call(this, message, ...rest);
        };
        try {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            must(M.murderState()?.stage === "incident", `the fixture's fight is not running: ${stableJson(M.murderState())}`);
            const r = victim.system.resources;
            await victim.update({ "system.resources.hitPoints.value": r.hitPoints.max - 1, "system.resources.stress.value": r.stress.max });
            for (let i = 0; i < 4 && M.crisisRefusal(killer, "strike")?.why === "not their turn"; i++) await M.passTurn();
            must(!M.crisisRefusal(killer, "strike"), `the killer's Strike is refused: ${M.crisisRefusal(killer, "strike")?.why}`);
            await M.resolveCrisisAction({ actorId: killer.id, key: "strike", total: 99, isCritical: false, withHope: true });
            await settle();
            const stage = M.murderState()?.stage ?? null;
            await M.endMurder({ reason: "closed", followUp: false });
            await settle();
            let cards = 0;
            for (const message of messages) if (String(await wordsOf(message, 300)).includes(title)) cards++;
            equal(stableJson([stage, cards, isDeadForGm(victim), again, closes]), stableJson(["resolution", 1, true, 0, 1]),
                "the blow that ran the victim out did not end the fight, or it was told, killed or closed other than once (stage, ran-out cards, dead, second killing, closes)");
        } finally {
            Hooks.off("createChatMessage", created);
            Hooks.off("drpgIncidentClosed", closed);
            ui.notifications.warn = warn;
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a hit on a full Sanity lands on Health and the note says what landed", async () => {
        /*
         * E32+E07 C7, 28.09.2026; audit S04-05. A hit clamped each resource on its own, so a
         * Sanity hit on a full Sanity marked nothing, and its note read "Aiko takes 2 STRESS".
         * A direct murder is opened between two students with players; at the victim's turn
         * (so the pass after the blow drains nobody) the victim has all of their Health and
         * no Sanity left, and the killer's critical Strike takes both marks off Sanity. Read:
         * the victim's Health and Sanity marks after it; the card's words as the GM keeps them
         * and as each player is sent them (`wordsSent`) - the victim's player "You lose 2
         * Health." and nothing else of the note, the killer's player the victim's name and
         * no "You lose", nobody a resource key or a line marker.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const M = await import("./murder.mjs");
        const { plural } = await import("./utils.mjs");
        const { contentOf } = await import("./secret.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const { livingStudents } = await import("./chapter.mjs");
        const [killer, victim] = livingStudents().filter(player);
        const esc = foundry.utils.escapeHTML;
        const you = game.i18n.format("DRPG.Murder.youLose", { what: plural("DRPG.Reserve.health", { n: 2 }) });
        const them = game.i18n.format("DRPG.Murder.theyLose", { name: esc(victim.name), what: plural("DRPG.Reserve.health", { n: 2 }) });
        const { CRISIS_ACTIONS } = await import("./config.mjs");
        const card = `${esc(CRISIS_ACTIONS.strike.label)} - ${esc(killer.name)}`;
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident" && M.murderState()?.turnSide === "victim",
            `the fixture's fight is not at the victim's turn: ${stableJson(M.murderState())}`);
        const r = victim.system.resources;
        await victim.update({ "system.resources.hitPoints.value": 0, "system.resources.stress.value": r.stress.max });
        let message = null;
        const sent = await wordsSent(async () => {
            const had = new Set(game.messages.contents.map(m => m.id));
            await M.resolveCrisisAction({ actorId: killer.id, key: "strike", total: 99, isCritical: true, withHope: true, choice: "stress" });
            await settle();
            message = game.messages.contents.find(m => !had.has(m.id) && String(contentOf(m) ?? "").includes(card)) ?? null;
        });
        await M.endMurder({ reason: "closed", followUp: false });
        must(message, `the Strike's card was not found among the new cards (${card})`);
        const kept = String(contentOf(message) ?? "");
        const to = user => sent.filter(p => p.id === message.id && p.to.includes(user.id)).map(p => p.html);
        const read = words => [words.some(w => w.includes(you)), words.some(w => w.includes(them)), words.some(w => /STRESS|hitPoints|data-drpg-/.test(w))];
        equal(stableJson([victim.system.resources.hitPoints.value, victim.system.resources.stress.value === r.stress.max,
            read([kept]), read(to(player(victim))), read(to(player(killer)))]),
        stableJson([2, true, [false, true, false], [true, false, false], [false, true, false]]),
            `the hit did not land on Health, or a reader holds the wrong line, both, a key or a marker (Health marks, Sanity full, GM / victim / killer: you, them, key): ${kept}`);
    }],

    ["a killer's failed Use an item with Despair costs the killer", async () => {
        /*
         * E32+E07 C7, 28.09.2026; audit S04-19. Use an item is both sides' action, and its
         * extra point on a Despair failure was the incident's drain - the victim's - whoever
         * failed: a killer's miss cost their victim. A direct murder is opened between two
         * students with players; at the victim's turn (so the pass after it drains nobody)
         * the killer, with all of their Sanity, fails Use an item with Despair. Read: the
         * killer's Sanity marks, the victim's Health and Sanity marks, and the card's note as
         * the GM keeps it - the killer's name and one Sanity.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const M = await import("./murder.mjs");
        const { plural } = await import("./utils.mjs");
        const { contentOf } = await import("./secret.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const { livingStudents } = await import("./chapter.mjs");
        const [killer, victim] = livingStudents().filter(player);
        const note = game.i18n.format("DRPG.Murder.theyLose", { name: foundry.utils.escapeHTML(killer.name), what: plural("DRPG.Reserve.sanity", { n: 1 }) });
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident" && M.murderState()?.turnSide === "victim",
            `the fixture's fight is not at the victim's turn: ${stableJson(M.murderState())}`);
        await killer.update({ "system.resources.stress.value": 0 });
        const marks = a => [a.system.resources.hitPoints.value, a.system.resources.stress.value];
        const victimBefore = marks(victim);
        const had = new Set(game.messages.contents.map(m => m.id));
        await M.resolveCrisisAction({ actorId: killer.id, key: "useItem", total: 1, isCritical: false, withHope: false });
        await settle();
        const told = game.messages.contents.filter(m => !had.has(m.id)).some(m => String(contentOf(m) ?? "").includes(note));
        await M.endMurder({ reason: "closed", followUp: false });
        equal(stableJson([killer.system.resources.stress.value, marks(victim), told]), stableJson([1, victimBefore, true]),
            "the killer's failed Use an item with Despair did not cost the killer one Sanity, cost the victim, or its card does not say so (killer's Sanity marks, victim's marks, told)");
    }],

    ["a Tier 1 knife that breaks on Despair deals tier 1 and grants nothing improvised", async () => {
        /*
         * E32+E07 C8, 28.09.2026; audit S04-04. The player's browser wore the swung weapon
         * before it told the GM, so a Tier 1 knife that broke on a Despair hit was out of the
         * hand the damage was read from: the hit counted as unarmed - 1 Health, not 2 - and
         * handed the killer an improvised weapon. The GM wears it now, after the damage
         * (murder.mjs `wearSwing`), and reads the damage off the knife the roll swung. At the
         * killer's turn (`swingFixture`) the killer attacks with a weapon from this browser,
         * as the suite throws every roll, and hits with a Despair. Read: the victim's Health
         * marks (the pass after it drains Sanity, which the victim has all of), the knife
         * broken, and what the killer was handed.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const { isBroken } = await import("./inventory.mjs");
        const { M, killer, knife, putBack, health, handed } = await swingFixture();
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        try {
            globalThis.__forceRoll = { hope: 8, fear: 11 };
            const taken = await M.takeCrisisAction(killer, "weaponAttack");
            await settle();
            must(taken?.roll?.total >= 15 && !taken.roll.withHope && !taken.roll.isCritical,
                `the fixture's swing was not a hit with Despair: ${stableJson(taken?.roll ?? null)}`);
            equal(stableJson([health(), isBroken(killer.items.get(knife.id)), handed()]), stableJson([2, true, 0]),
                "the knife's hit was not scored as a Tier 1 weapon, the knife did not break, or the killer was handed a weapon (Health marks, broken, items handed)");
        } finally {
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            await putBack();
        }
    }],

    ["a cancelled weapon roll ties no trace", async () => {
        /*
         * E32+E07 C8, 28.09.2026; audit S04-34. The trace of the Search that handed the
         * killer their weapon is tied to the murder when the weapon is swung, and it was tied
         * before the dice: a killer who closed the roll window had made the knife evidence of
         * a swing that never happened. At the killer's turn (`swingFixture`), with a Search's
         * trace holding the knife placed beside a token in a room, the killer attacks with a
         * weapon and the roll is cancelled (the character's `rollTrait` answers nothing, as a
         * closed window does); then attacks again and the dice are thrown. Read: what the
         * cancelled attack answered, the trace after it, and the trace after the thrown one -
         * the tie still happens, once there is a roll.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        needs(world.atLeast("sceneOnScreen"), "the trace stands on the scene on screen");
        needs(world.atLeast("occupiedRooms"), "the trace is placed beside a token standing in a room");
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const identity = `suite-swing-${Date.now().toString(36)}`;
        const { M, killer, putBack } = await swingFixture(identity);
        const scene = canvas.scene;
        const anchor = Array.from(scene.tokens).find(t => roomOfToken(t));
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        let trace = null;
        try {
            trace = await remnants.placeRemnant({ type: "prep", visibility: "evident", scene, x: anchor.x, y: anchor.y,
                note: "test fixture - the Search that handed over the knife", action: "search", itemIdentity: identity });
            const tied = () => Boolean(remnants.remnantData(trace)?.tiedToCrime);
            must(trace && !tied(), "could not place the knife's untied trace");
            killer.rollTrait = async () => null;
            const cancelled = await M.takeCrisisAction(killer, "weaponAttack");
            await settle();
            const afterCancel = tied();
            delete killer.rollTrait;
            globalThis.__forceRoll = { hope: 12, fear: 3 };
            await M.takeCrisisAction(killer, "weaponAttack");
            await until(tied);
            equal(stableJson([cancelled, afterCancel, tied()]), stableJson([null, false, true]),
                "a cancelled swing tied the knife's trace, or a thrown one did not (cancelled answer, tied after it, tied after the thrown one)");
        } finally {
            delete killer.rollTrait;
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            if (trace) {
                await remnants.dropRemnantSecret(trace);
                if (scene.tokens.has(trace.id)) await scene.deleteEmbeddedDocuments("Token", [trace.id]);
            }
            await putBack();
        }
    }],

    ["a Reroll gives the wear back", async () => {
        /*
         * E32+E07 C8, 28.09.2026; audit S04-04. The wear a swing takes is the GM's now, and
         * the action's receipt records it with the weapon swung, so a Reroll that takes the
         * action back gives the wear back, and the replay - whose packet names no weapon
         * (reroll.mjs `settleCrisis`) - swings the knife the receipt recorded. At the killer's
         * turn (`swingFixture`) a Tier 1 knife breaks on a Despair hit thrown from this
         * browser; the Reroll's replay then arrives as the bridge hands it on, a hit with Hope.
         * Read: the knife broken, its wear, whether it is back in the hand, the victim's Health
         * marks, and what the killer was handed.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const { isBroken, wearOf } = await import("./inventory.mjs");
        const { isEquipped } = await import("./use-items.mjs");
        const { M, killer, knife, putBack, health, handed } = await swingFixture();
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        try {
            globalThis.__forceRoll = { hope: 8, fear: 11 };
            const taken = await M.takeCrisisAction(killer, "weaponAttack");
            await settle();
            must(taken?.roll?.total >= 15 && !taken.roll.withHope && isBroken(killer.items.get(knife.id)),
                `the fixture's swing did not break the knife on a hit with Despair: ${stableJson(taken?.roll ?? null)}`);
            await M.resolveCrisisAction({ actorId: killer.id, key: "weaponAttack", total: 99, isCritical: false, withHope: true, undo: true });
            await settle();
            const now = killer.items.get(knife.id);
            equal(stableJson([isBroken(now), wearOf(now), isEquipped(now), health(), handed()]), stableJson([false, 0, true, 2, 0]),
                "the Reroll did not give the knife's wear back, or its replay did not swing the knife (broken, wear, in hand, Health marks, items handed)");
        } finally {
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            await putBack();
        }
    }],

    ["a Reroll of a wear that broke nothing leaves the knife in hand", async () => {
        /*
         * E32+E07 C8, 28.09.2026 (A2). The give-back above puts the knife in the hand only
         * when the hand is empty, and the first reading of that counted the knife itself: a
         * wear that broke nothing had left it readied, so the Reroll took it out of the hand.
         * The same swing as above with a Tier 2 knife (two points, `ITEM_DURABILITY`), which a
         * Despair hit wears and does not break. Read: broken, its wear after the Despair, then
         * after the Reroll its wear, whether it is in the hand, and what the killer was handed.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const { isBroken, wearOf } = await import("./inventory.mjs");
        const { isEquipped } = await import("./use-items.mjs");
        const { M, killer, knife, putBack, handed } = await swingFixture();
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        try {
            await knife.update({ [`flags.${MODULE_ID}.tier`]: 2 });
            globalThis.__forceRoll = { hope: 8, fear: 11 };
            const taken = await M.takeCrisisAction(killer, "weaponAttack");
            await settle();
            must(taken?.roll?.total >= 15 && !taken.roll.withHope, `the fixture's swing was not a hit with Despair: ${stableJson(taken?.roll ?? null)}`);
            const worn = [isBroken(killer.items.get(knife.id)), wearOf(killer.items.get(knife.id))];
            await M.resolveCrisisAction({ actorId: killer.id, key: "weaponAttack", total: 99, isCritical: false, withHope: true, undo: true });
            await settle();
            const now = killer.items.get(knife.id);
            equal(stableJson([...worn, wearOf(now), isEquipped(now), handed()]), stableJson([false, 1, 0, true, 0]),
                "a Reroll of a Despair that wore the knife without breaking it did not leave it in the hand (broken, wear after the Despair, wear after the Reroll, in hand, items handed)");
        } finally {
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            await putBack();
        }
    }],

    ["a Reroll of a crisis action that killed is refused before the Hope is paid", async () => {
        /*
         * E32+E07 C8b, 28.09.2026; AUDIT-1.2.42 section 9, the owner's answer (A). A Reroll
         * that took back the Finishing blow that killed replayed the blow and left the victim
         * dead, the blow gone. The death stands, and the Reroll Call is refused before anything
         * is paid: the GM's answer marks the roll's bookmark `lethal`, and `spendHopeCall` asks
         * it before the price (reroll.mjs `lethalReroll`). The GM throws the killer's blow from
         * this browser (`swingFixture`, one Health left, so the threshold is 5); the killer's
         * Reroll is then asked for. Read: what the Call answered, the Hope writes on the killer
         * after the blow, the Hope, the reason shown, the bookmark's mark, the roll's total, the
         * receipt, and whether the victim is still dead for the GMs.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const { isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const { spendHopeCall } = await import("./calls.mjs");
        const { lastRollOf } = await import("./reroll.mjs");
        const { M, killer, victim, putBack } = await swingFixture();
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        const warn = ui.notifications.warn, warned = [];
        let writes = 0;
        const hook = Hooks.on("updateActor", (a, change) => {
            if (a.id === killer.id && foundry.utils.hasProperty(change, "system.resources.hope")) writes++;
        });
        try {
            await victim.update({ "system.resources.hitPoints.value": victim.system.resources.hitPoints.max - 1 });
            await killer.update({ "system.resources.hope.value": 4 });
            globalThis.__forceRoll = { hope: 10, fear: 3 };
            const taken = await M.takeCrisisAction(killer, "finishingBlow");
            await settle();
            const { bookmark, message } = lastRollOf(killer);
            must(taken?.roll?.withHope && isDeadForGm(victim) && bookmark?.crisis === "finishingBlow" && message,
                `the fixture's blow did not kill, or left no bookmark to reroll: ${stableJson([taken?.roll ?? null, bookmark])}`);
            const hope = killer.system.resources.hope.value, total = message.rolls[0].total;
            const receipt = stableJson(M.murderState()?.lastCrisis ?? null);
            writes = 0;
            ui.notifications.warn = (text, ...rest) => { warned.push(String(text)); return warn.call(ui.notifications, text, ...rest); };
            const spent = await spendHopeCall(killer, "reroll");
            await settle();
            equal(stableJson([spent, writes, killer.system.resources.hope.value - hope, warned.includes(game.i18n.localize("DRPG.Reroll.deathStands")),
                lastRollOf(killer).bookmark?.lethal ?? null, game.messages.get(message.id)?.rolls?.[0]?.total === total,
                stableJson(M.murderState()?.lastCrisis ?? null) === receipt, isDeadForGm(victim)]),
            stableJson([null, 0, 0, true, true, true, true, true]),
            "the Reroll of the blow that killed was paid for, not refused with its reason, or took something back (answer, Hope writes, Hope moved, reason shown, bookmark lethal, total kept, receipt kept, victim dead)");
        } finally {
            ui.notifications.warn = warn;
            Hooks.off("updateActor", hook);
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            await putBack();
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["the GM refuses the undo of a crisis action that killed, whatever the packet says", async () => {
        /*
         * E32+E07 C8b, 28.09.2026. The gate is the GM's: the action's receipt names whom its own
         * resolution killed (`killed`, written by `finishIncident` and `checkVictimSpent`), and
         * an undo of it is refused by the bridge's guard (`crisisUndoRefusal`) and by
         * `undoLastCrisis` itself, whatever the packet claims. The killer's player throws the
         * blow through the bridge (`judge`, as the GM's listener hands it on; one Health left),
         * then sends an undo of it with a total of 0; the GM then asks its own undo. Read: the
         * packets the blow and the undo sent back (the blow's answer says `lethal`), the GM's
         * log of the refusal, the GM's own undo, whether the victim is dead, the stage, and
         * whether the receipt moved.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const { isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const G = await import("./bridge-guards.mjs");
        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const U = await import("./utils.mjs");
        const { M, killer, victim, putBack } = await swingFixture();
        const player = game.users.find(u => !u.isGM && u.active && killer.testUserPermission(u, "OWNER"));
        const sent = [];
        const ask = (requestId, fields) => G.judge(BRIDGE_ACTIONS, { action: "murder.crisis", requestId, actorId: killer.id, key: "finishingBlow", ...fields },
            player.id, { send: (to, packet) => sent.push([packet?.action ?? null, packet?.reason ?? null, packet?.value ?? null]) });
        const logged = () => U.sessionFailures().filter(e => String(e.message).includes('Refused a "murder.crisis"')
            && String(e.message).includes("the death stands")).length;
        try {
            await victim.update({ "system.resources.hitPoints.value": victim.system.resources.hitPoints.max - 1 });
            await ask("suite-c8b-blow", { total: 99, isCritical: false, withHope: true });
            await settle();
            const blow = sent.splice(0);
            must(isDeadForGm(victim) && M.murderState()?.stage === "resolution", `the player's blow did not kill: ${stableJson([blow, M.murderState()?.stage])}`);
            const receipt = stableJson(M.murderState()?.lastCrisis ?? null);
            const before = logged();
            await ask("suite-c8b-undo", { total: 0, isCritical: false, withHope: true, undo: true });
            await settle();
            const forged = sent.splice(0);
            const own = await M.resolveCrisisAction({ actorId: killer.id, key: "finishingBlow", total: 0, isCritical: false, withHope: true, undo: true });
            await settle();
            equal(stableJson([blow, forged, logged() - before, own, isDeadForGm(victim), M.murderState()?.stage ?? null,
                stableJson(M.murderState()?.lastCrisis ?? null) === receipt]),
            stableJson([[["bridge.ack", null, null], ["bridge.done", null, { lethal: true }]], [["bridge.refused", "deathStands", null]], 1, null, true, "resolution", true]),
            "the undo of the blow that killed was let through, refused for another reason, or moved something (the blow's packets, the undo's, the GM's log, the GM's own undo, victim dead, stage, receipt kept)");
        } finally {
            await putBack();
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["two closes of one incident close it once", async () => {
        /*
         * E32 C4, 28.09.2026; audit S04-26. `endMurder` awaits at every step between reading
         * the incident and wiping it, and two calls not awaited in between each read the same
         * running incident: each recorded it, destroyed its tools and fired
         * `drpgIncidentClosed`. It is single-flight now, by the incident's `openedAt`. A direct
         * murder is opened between two students with players and its fight begins; the GM
         * closes it twice at once. Read: the closes the hook counts; a second close that ran
         * its steps as far as the wipe and was refused there (`restoreState`'s `expect`, the
         * layer under this one - its warning, "... in the place of the one it closed"); and
         * that nothing runs afterwards. Red at f177726: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        let closes = 0, refused = 0;
        const closed = Hooks.on("drpgIncidentClosed", () => { closes++; });
        const consoleWarn = console.warn;
        console.warn = function (...args) {
            if (args.some(a => String(a).includes("in the place of the one it closed"))) refused++;
            return consoleWarn.apply(this, args);
        };
        try {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            must(M.murderState()?.stage === "incident", `the fixture's fight is not running: ${stableJson(M.murderState())}`);
            await Promise.all([M.endMurder({ reason: "closed", followUp: false }), M.endMurder({ reason: "closed", followUp: false })]);
            await settle();
            equal(stableJson([closes, refused, M.murderState()]), stableJson([1, 0, null]),
                "two closes of one incident did not close it exactly once, or left it running (closes, a second close refused at the wipe, the state after)");
        } finally {
            Hooks.off("drpgIncidentClosed", closed);
            console.warn = consoleWarn;
        }
    }],

    ["a betrayal from the tile in Stage 6 records both killers and the new victim has Self-defence", async () => {
        /*
         * E32 C5a, 28.09.2026; audit S04-03. The accomplice's betrayal comes during Stage 6,
         * with the first incident still open, and until 1.2.66 `openMurder` let its incident be
         * written over that one: the first was never closed, so its two killers were never
         * recorded Blackened and nothing counted a close (the grid's TP01). `openBetrayal` closes
         * it first now. Three students with players: the killer, with the third as accomplice,
         * kills the victim; the third turns on the killer from the tile (`betrayAsPlayer`, what
         * the tile's request runs on the GM); the new incident's opening succeeds. Read: the
         * closes, the Blackened grown by the first incident's killers, the new incident's two
         * names, and Self-defence among the new victim's actions, open. Red at 048332a:
         * <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const before = M.blackenedIds();
        let closes = 0;
        const closed = Hooks.on("drpgIncidentClosed", () => { closes++; });
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            const opened = await M.betrayAsPlayer(third.id);
            await settle();
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            const state = M.murderState();
            const now = M.blackenedIds();
            const grew = now.filter(id => !before.includes(id)).sort();
            const both = [killer.id, third.id];
            const selfDefence = M.availableCrisisActions(killer).find(a => a.key === "selfDefence");
            equal(stableJson([Boolean(opened), closes, both.every(id => now.includes(id)), grew, state?.killerId ?? null, state?.victimId ?? null,
                state?.stage ?? null, Boolean(selfDefence && !selfDefence.blocked && !selfDefence.hidden)]),
                stableJson([true, 1, true, both.filter(id => !before.includes(id)).sort(), third.id, killer.id, "incident", true]),
                "the betrayal did not close the first incident once with both its killers recorded, or its own incident is not the third's on the killer with Self-defence open "
                + "(opened, closes, both Blackened, the Blackened grown, killer, victim, stage, Self-defence)");
        } finally {
            Hooks.off("drpgIncidentClosed", closed);
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a refused betrayal keeps its offer and tells the player", async () => {
        /*
         * E32 C5a, 28.09.2026; audit S04-13. The tile spent the offer before the betrayal was
         * tried, and a betrayal that then could not open lost it with nobody told. It is taken
         * in `openBetrayal` now, put back when the betrayal does not open, and the player who
         * asked is told why. The refusal is made the way the table can meet it: while the
         * betrayal closes the first incident, another is opened in its place - here from the
         * close's own hook, the killer's on the third - and the betrayal finds a fight running.
         * Read: the betrayal's answer, the incident that runs, the offer back on the record,
         * the third's player sent the refusal's words, and one close. Red at 048332a:
         * <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const line = game.i18n.format("DRPG.Murder.betrayalRefused", { why: game.i18n.localize("DRPG.Murder.betrayalWhy.fight") });
        let closes = 0, other = null;
        const closed = Hooks.on("drpgIncidentClosed", () => {
            closes++;
            if (!other) other = M.openMurder({ killerId: killer.id, victimId: third.id });
        });
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            let answer;
            const sent = await wordsSent(async () => {
                answer = await M.betrayAsPlayer(third.id);
                await other;
                await settle();
            });
            const state = M.murderState();
            const offer = incidentCast().betrayal ?? null;
            const told = sent.filter(w => w.to.includes(player(third).id) && w.html.includes(line)).length;
            equal(stableJson([answer ?? null, state?.killerId ?? null, state?.victimId ?? null, offer ? `${offer.thirdId}>${offer.killerId}` : null, told, closes]),
                stableJson([null, killer.id, third.id, `${third.id}>${killer.id}`, 1, 1]),
                "a betrayal that found another incident opened did not answer no, keep the other running, put the offer back and tell its player once "
                + "(answer, killer, victim, offer, cards to the third's player, closes)");
        } finally {
            Hooks.off("drpgIncidentClosed", closed);
            await other;
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a second murder cannot overwrite a Stage 6", async () => {
        /*
         * E32 C5a, 28.09.2026; audit S04-03. `openMurder` refused a second murder while one
         * was being fought but let it through at Stage 6, for the betrayal - and wrote it over
         * the incident still open there: a ruling card's "open the murder" or a console's
         * `game.drpg.openMurder` replaced a Stage 6 with no betrayal in it (the lights' parked
         * murders and the GM's dialog ask `murderState()` first). The betrayal closes its
         * Stage 6 itself now, and `openMurder` refuses while any incident runs. A direct
         * murder is taken to Stage 6 by the GM; a second is opened. Read: its answer, and the
         * incident afterwards - opened when, whose, at which stage. Red at 048332a:
         * <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "two killers and a victim, each with a player");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, second] = livingStudents().filter(player);
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await M.beginResolution("test");
        await settle();
        const first = M.murderState();
        must(first?.stage === "resolution", `the fixture's Stage 6 did not come: ${stableJson(first)}`);
        const opened = await M.openMurder({ killerId: second.id, victimId: killer.id });
        await settle();
        const now = M.murderState();
        equal(stableJson([opened, now?.openedAt ?? null, now?.killerId ?? null, now?.victimId ?? null, now?.stage ?? null]),
            stableJson([null, first.openedAt, killer.id, victim.id, "resolution"]),
            "a second murder opened over a Stage 6, or the Stage 6 did not stand (answer, opened at, killer, victim, stage)");
    }],

    ["the tile is dark in a Class Trial and the offer stands after it", async () => {
        /*
         * E32 C5a, 28.09.2026; audit S02-24, the owner's Q3 (a). The betrayal is open until the
         * day ends, the investigation included, and closed in a Class Trial - where the tile lit
         * until 1.2.66 (`betrayalTarget`, the tile's one question; the grid's XI03). Three
         * students with players: the accomplice's offer is armed by the killer's blow and the
         * GM closes the incident; the clock moves to the Class Trial and back. Read: the tile's
         * answer and the offer on the record in the trial, then the tile's answer after it.
         * Red at 048332a: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const phase = getClock()?.phase ?? "dailyLife";
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            await M.endMurder({ reason: "closed", followUp: false });
            await settle();
            await setClock({ phase: "classTrial" });
            const inTrial = [M.betrayalTarget(third)?.id ?? null, incidentCast().betrayal?.killerId ?? null];
            await setClock({ phase: "investigation" });
            const after = M.betrayalTarget(third)?.id ?? null;
            equal(stableJson([...inTrial, after]), stableJson([null, killer.id, killer.id]),
                "the betrayal tile lit in a Class Trial, or the offer did not stand through it (tile in the trial, offer on record, tile after)");
        } finally {
            await setClock({ phase });
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a betrayal declared in an Eclipse costs an action, is parked, and opens at the lights with the first incident closed", async () => {
        /*
         * E32 C5b, 28.09.2026; audit S02-24, S04-13, the owner's Q3. In an Eclipse the betrayal
         * is declared, not opened: it costs an action and starts when the Eclipse ends, like any
         * action declared there. At 1.2.65 the click spent the offer and `openMurder` refused in
         * the Eclipse (S04-13: the offer lost); at C5a's tree `openBetrayal` refused it before
         * taking the offer, so the click spent nothing and declared nothing. Three students with players: the killer, with the third as accomplice,
         * kills the victim; with the first incident still at Stage 6 an Eclipse starts and the
         * third presses the Direct Murder tile (`performAction`, the GM's own client, the two
         * windows answered as their player would). Read in the Eclipse: the actions the third has
         * left, the GMs' row and the offer on the record, the incident's stage; at the lights: the
         * closes, both first killers Blackened, the new incident's two names, the row gone.
         * Red at 821ec9e: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const rolls = await import("./action-rolls.mjs");
        const { actionsLeft } = await import("./actions.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const NOTE = "SUITE E32 C5b betrayal declared in the dark";
        let closes = 0;
        const closed = Hooks.on("drpgIncidentClosed", () => { closes++; });
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            const before = M.blackenedIds();
            await E.startEclipse();
            await settle();
            must(E.isEclipse(), "the Eclipse did not start");
            const left = actionsLeft(third);
            let answer = null;
            const unanswered = await withBetrayalWindows(NOTE, async () => { answer = await rolls.performAction(third, "directMurder"); });
            await settle();
            const row = S.pendingMurderStore.get(third.id) ?? null;
            const standing = incidentCast().betrayal;
            const dark = [Boolean(answer?.parked), left - actionsLeft(third), row?.betrayal?.killerId ?? null, row?.note ?? null,
                standing ? `${standing.thirdId}>${standing.killerId}` : null, M.murderState()?.stage ?? null, unanswered];
            await E.endEclipse({ advance: false });
            await settle();
            if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            const state = M.murderState();
            const now = M.blackenedIds();
            const lights = [closes, [killer.id, third.id].every(id => now.includes(id)), now.length - before.length,
                state?.killerId ?? null, state?.victimId ?? null, state?.stage ?? null, S.pendingMurderStore.has(third.id)];
            equal(stableJson([dark, lights]),
                stableJson([[true, 1, killer.id, NOTE, `${third.id}>${killer.id}`, "resolution", []],
                    [1, true, [killer.id, third.id].filter(id => !before.includes(id)).length, third.id, killer.id, "incident", false]]),
                "the betrayal in the Eclipse did not cost one action and park with its offer standing until the lights and the first incident left at Stage 6, "
                + "or the lights did not close the first once with both its killers recorded and open the third's on the killer "
                + "(in the dark: parked, actions spent, row's killer, row's note, offer, stage, windows unanswered; "
                + "at the lights: closes, both Blackened, the Blackened grown, killer, victim, stage, row left)");
        } finally {
            Hooks.off("drpgIncidentClosed", closed);
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            if (S.pendingMurderStore.has(third.id)) await S.pendingMurderStore.drop(third.id);
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["refused at the lights, the offer comes back and the betrayer is told", async () => {
        /*
         * E32 C5b, 28.09.2026; audit S04-13. A betrayal declared in an Eclipse has its offer taken
         * - at the declaration until fix r1-G2, by the lights since - so one the lights cannot open
         * would lose it - the click S04-13 names, moved to the lights. It goes back now while its
         * chapter and day hold, and the betrayer
         * is told what a refused murder is told (`murderRefused`, veiled). The refusal is made as
         * "a refused betrayal keeps its offer" makes it: as the lights' betrayal closes the first
         * incident, another is opened in its place from the close's own hook - the killer's on the
         * third - and the betrayal finds a fight running. Read: the incident that runs, the offer
         * back on the record, the third's player sent the refusal's words, one close, the row gone.
         * Red at 821ec9e: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const rolls = await import("./action-rolls.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const refused = game.i18n.localize("DRPG.Action.murderRefused");
        let closes = 0, other = null, lights = false;
        const closed = Hooks.on("drpgIncidentClosed", () => {
            closes++;
            if (lights && !other) other = M.openMurder({ killerId: killer.id, victimId: third.id });
        });
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            await E.startEclipse();
            await settle();
            must(E.isEclipse(), "the Eclipse did not start");
            await withBetrayalWindows("SUITE E32 C5b refused at the lights", () => rolls.performAction(third, "directMurder"));
            await settle();
            const parked = Boolean(S.pendingMurderStore.get(third.id)?.betrayal) && incidentCast().betrayal?.killerId === killer.id;
            lights = true;
            const sent = await wordsSent(async () => {
                await E.endEclipse({ advance: false });
                await other;
                await settle();
            });
            const state = M.murderState();
            const offer = incidentCast().betrayal ?? null;
            const told = sent.filter(w => w.to.includes(player(third).id) && w.html.includes(refused)).length;
            equal(stableJson([parked, state?.killerId ?? null, state?.victimId ?? null, offer ? `${offer.thirdId}>${offer.killerId}` : null, told, closes,
                S.pendingMurderStore.has(third.id)]),
                stableJson([true, killer.id, third.id, `${third.id}>${killer.id}`, 1, 1, false]),
                "a betrayal declared in the dark was not parked with its offer standing, or the lights that could not open it did not leave the "
                + "other incident running, put the offer back, tell its player once and leave no row "
                + "(parked, killer, victim, offer, refusals sent to the third's player, closes, row left)");
        } finally {
            Hooks.off("drpgIncidentClosed", closed);
            await other;
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            if (S.pendingMurderStore.has(third.id)) await S.pendingMurderStore.drop(third.id);
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a second declaration in the same Eclipse and a betrayal: the first by time opens, the other is refused", async () => {
        /*
         * E32 C5b, 28.09.2026; audit S02-24, the owner's Q3. The lights judge the Eclipse's rows
         * in the order they were declared, a betrayal's among them, and only one incident opens -
         * as "a second killer in the same Eclipse is told only that the attempt is refused" reads
         * it for two murders. The accomplice's offer stands after the GM closes the first incident;
         * in the Eclipse its killer declares a direct murder on a fourth student, the two stood
         * alone in a room before it all (the row written as the GMs hold an allowed one, declared first), and
         * then the accomplice declares the betrayal from the tile. Read: the incident that opened,
         * the betrayer's player sent the refusal's words, and the offer back on the record.
         * Red at 821ec9e: <measured by A2>.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        needs(world.atLeast("livingStudents", 4), "a fourth student, the direct murder's victim");
        needs(world.atLeast("studentTokensOnScreen", 4), "the killer and the fourth are stood in a room by their tokens");
        needs(world.atLeast("namedRooms", 2), "a room is left to the two of them");
        const M = await import("./murder.mjs");
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const rolls = await import("./action-rolls.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const fourth = livingStudents().find(a => ![killer, victim, third].includes(a));
        const refused = game.i18n.localize("DRPG.Action.murderRefused");
        let stood = null;
        try {
            // Stood first: the Cafeteria the victim lies in reads as empty afterwards, and a token
            // placed there beside the body landed outside every room (measured 28.09).
            stood = await aloneTogether(killer, fourth, { asked: true });
            await accompliceAtStageSix(M, killer, victim, third);
            await M.endMurder({ reason: "closed", followUp: false });
            await settle();
            must(M.betrayalTarget(third)?.id === killer.id, "the offer did not stand after the close");
            await E.startEclipse();
            await settle();
            const id = E.eclipseId();
            must(E.isEclipse() && id, "the Eclipse did not start");
            await S.pendingMurderStore.patch(killer.id, { room: stood.room, note: "SUITE E32 C5b declared first", at: 1, approved: true, eclipse: id, betrayal: null });
            await withBetrayalWindows("SUITE E32 C5b declared second", () => rolls.performAction(third, "directMurder"));
            await settle();
            const parked = Boolean(S.pendingMurderStore.get(third.id)?.betrayal);
            const sent = await wordsSent(async () => {
                await E.endEclipse({ advance: false });
                await settle();
            });
            const state = M.murderState();
            const offer = incidentCast().betrayal ?? null;
            const told = sent.filter(w => w.to.includes(player(third).id) && w.html.includes(refused)).length;
            equal(stableJson([parked, state?.killerId ?? null, state?.victimId ?? null, told, offer ? `${offer.thirdId}>${offer.killerId}` : null]),
                stableJson([true, killer.id, fourth.id, 1, `${third.id}>${killer.id}`]),
                "the betrayal was not parked, or the murder declared first did not open, or the betrayal declared after it was not refused, "
                + "told once, with its offer back (parked, killer, victim, refusals sent to the betrayer's player, offer)");
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            await S.pendingMurderStore.dropMany([killer.id, third.id].filter(k => S.pendingMurderStore.has(k)));
            if (stood) await stood.back();
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a betrayal declared in the Eclipse after Night opens on the next morning", async () => {
        /*
         * E32+E07 fix r1-G2, 01.10.2026; the round-1 correctness review's M1, the owner's Q3
         * (declared in an Eclipse it costs an action and starts after the Eclipse). An Eclipse
         * after Night ends into the next day (clock.mjs `advanceTimeOfDay`), and every test
         * before this one ended its Eclipse with `advance: false`, which moves no clock. The
         * clock at Night; the accomplice's offer stands after the GM closes the first incident;
         * in the Eclipse the accomplice declares the betrayal from the tile, and the Eclipse
         * ends as the GM panel ends it (`endEclipse()`). Read: the declaration parked, the day
         * moved by one into the morning, the incident that opened, the offer and the row gone.
         * Red at abf3cff (e32run/g2red, 01.10.2026): parked, the day moved into the morning, and no
         * incident opened - killer and victim null.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const rolls = await import("./action-rolls.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const { chapter, day, session, timeOfDay, phase } = getClock() ?? {};
        try {
            await setClock({ timeOfDay: "night" });
            await accompliceAtStageSix(M, killer, victim, third);
            await M.endMurder({ reason: "closed", followUp: false });
            await settle();
            await E.startEclipse();
            await settle();
            must(E.isEclipse(), "the Eclipse did not start");
            const dark = getClock()?.day;
            let answer = null;
            await withBetrayalWindows("SUITE fix r1-G2 declared at Night", async () => { answer = await rolls.performAction(third, "directMurder"); });
            await settle();
            await E.endEclipse();
            await settle();
            const state = M.murderState();
            equal(stableJson([Boolean(answer?.parked), (getClock()?.day ?? 0) - dark, getClock()?.timeOfDay ?? null, state?.killerId ?? null,
                state?.victimId ?? null, incidentCast().betrayal ?? null, S.pendingMurderStore.has(third.id)]),
            stableJson([true, 1, "morning", third.id, killer.id, null, false]),
            "a betrayal declared in the Eclipse after Night did not open on the next morning, or left its offer or row "
                + "(parked, days moved, time of day, killer, victim, offer, row left)");
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            if (S.pendingMurderStore.has(third.id)) await S.pendingMurderStore.drop(third.id);
            await M.clearBetrayalOffer();
            await setClock({ chapter, day, session, timeOfDay, phase });
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a betrayal declared in the dark moves no stamp of the cast before the lights, and a second declaration is refused", async () => {
        /*
         * E32+E07 fix r1-G2, 01.10.2026; the round-1 security review's m4. C5b took the offer at
         * the declaration, which moved the cast's `betrayal` stamp - and every player's browser
         * that asks for its cast is sent the seats' stamps, a seat or none (gm-stores.mjs
         * `CAST_SEATS`): the target could read that the betrayal against them was declared, and
         * when, before the lights. The offer stands until the lights now, the declaration is in
         * the GMs' row alone, and the tile - still lit - is refused a second one. The offer
         * stands after the GM closes the first incident; in the Eclipse the accomplice presses
         * the tile twice. Read: the record's `betrayal` stamp before, after the first and after
         * the second; the answers, the action the second cost, the row's note and the tile;
         * at the lights (`endEclipse()`): the stamp moved, the incident, the offer taken.
         * Red at abf3cff (e32run/g2red, 01.10.2026): the stamp moved at the declaration, and the tile was
         * dark after it (the offer taken).
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const rolls = await import("./action-rolls.mjs");
        const { actionsLeft } = await import("./actions.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const { chapter, day, session, timeOfDay, phase } = getClock() ?? {};
        const stamp = () => S.castStore.stampOf("record", "betrayal");
        const NOTE = "SUITE fix r1-G2 declared once";
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            await M.endMurder({ reason: "closed", followUp: false });
            await settle();
            await E.startEclipse();
            await settle();
            must(E.isEclipse(), "the Eclipse did not start");
            const before = stamp();
            const answers = [];
            await withBetrayalWindows(NOTE, async () => { answers.push(await rolls.performAction(third, "directMurder")); });
            await settle();
            const once = [stamp() === before, actionsLeft(third)];
            await withBetrayalWindows("SUITE fix r1-G2 declared twice", async () => { answers.push(await rolls.performAction(third, "directMurder")); });
            await settle();
            const twice = [stamp() === before, once[1] - actionsLeft(third), S.pendingMurderStore.get(third.id)?.note ?? null, M.betrayalTarget(third)?.id ?? null];
            await E.endEclipse();
            await settle();
            const lights = [stamp() > before, M.murderState()?.killerId ?? null, incidentCast().betrayal ?? null];
            equal(stableJson([Boolean(answers[0]?.parked), once[0], answers[1] ?? null, ...twice, ...lights]),
                stableJson([true, true, null, true, 0, NOTE, killer.id, true, third.id, null]),
                "a declaration in the dark moved the cast's betrayal stamp before the lights, or a second one was not refused, cost an action "
                + "or replaced the first, or the lights did not take the offer and open it (parked, stamp kept, second answer, stamp kept, "
                + "second's cost, row's note, tile, stamp moved at the lights, killer, offer)");
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            if (S.pendingMurderStore.has(third.id)) await S.pendingMurderStore.drop(third.id);
            await M.clearBetrayalOffer();
            await setClock({ chapter, day, session, timeOfDay, phase });
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["the checklist offers no betrayal in a Class Trial, and one pressed as a trial starts is refused with its offer kept", async () => {
        /*
         * E32+E07 fix r1-G2, 01.10.2026; the round-1 correctness review's m5, the owner's Q3
         * (closed in a Class Trial). The tile is dark in a trial (`betrayalTarget`), but the GM's
         * checklist after a close asked nothing of the phase: it offered the button and its
         * `openBetrayal` opened the betrayal. Twice, the accomplice's offer armed by the killer's
         * blow: the GM closes in a Class Trial, and the checklist is read; then, out of the
         * trial, the GM closes again and the trial starts while the checklist is open, and the
         * button is pressed. Read: whether each checklist offered the button, the tile and the
         * offer after the first, the incident and the offer after the press.
         * Red at abf3cff (e32run/g2red, 01.10.2026): both checklists offered the button, and the press
         * opened the betrayal - the third the killer, the offer gone.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and an accomplice, each with a player");
        const M = await import("./murder.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const { livingStudents, isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        const phase = getClock()?.phase ?? "dailyLife";
        const D = foundry.applications.api.DialogV2;
        const own = Object.getOwnPropertyDescriptor(D, "wait");
        const title = game.i18n.localize("DRPG.Murder.afterTitle");
        const offered = [];
        let press = false;
        D.wait = async cfg => {
            if (cfg?.window?.title !== title) return null;
            offered.push((cfg.buttons ?? []).some(b => b.action === "betrayal"));
            if (!press) return "close";
            await setClock({ phase: "classTrial" });
            return "betrayal";
        };
        try {
            await accompliceAtStageSix(M, killer, victim, third);
            await setClock({ phase: "classTrial" });
            await M.endMurder({ reason: "closed", followUp: true });
            await settle();
            const inTrial = [M.betrayalTarget(third)?.id ?? null, incidentCast().betrayal?.killerId ?? null];
            await reviveCharacter(victim, { quiet: true });
            await setClock({ phase: "investigation" });
            await accompliceAtStageSix(M, killer, victim, third);
            press = true;
            await M.endMurder({ reason: "closed", followUp: true });
            await settle();
            equal(stableJson([offered, inTrial, M.murderState()?.killerId ?? null, incidentCast().betrayal?.killerId ?? null]),
                stableJson([[false, true], [null, killer.id], null, killer.id]),
                "the checklist offered the betrayal in a Class Trial, or one pressed as the trial started opened or lost its offer "
                + "(button offered at each close, tile and offer in the trial, the incident's killer, the offer after the press)");
        } finally {
            if (own) Object.defineProperty(D, "wait", own); else delete D.wait;
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            await M.clearBetrayalOffer();
            await setClock({ phase });
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
            if (isDeadForGm(killer)) await reviveCharacter(killer, { quiet: true });
        }
    }],

    ["the incident's cards reach its audience and no one else", async () => {
        /*
         * E06 C4, 27.09.2026; audit S04-01 (L11). A crisis card was whispered to the owners of
         * the killer, the victim and the third read off the state, so a trap's builder - in no
         * room, holding no copy of the cast until Stage 6 - was sent the words of every card of
         * the fight. The card's audience is `incidentAudienceIds` now and the actor who acted
         * (murder.mjs `announceCrisis`). A trap is opened, its victim's roll misses and the
         * victim takes a crisis action (C3's fixture); every card's words this GM sends for it
         * are read off the packets (`wordsSent`): the victim's player is sent the card, the
         * builder's player nothing.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a trap's builder and its victim, each with a player to be sent a card's words");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim] = livingStudents().filter(player);
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        // The victim's player is asked the roll too; whichever lands first, a miss starts the incident.
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        const stage = M.murderState()?.stage ?? null;
        const words = await wordsSent(async () => {
            await game.drpg.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: false });
            await settle();
        });
        const to = user => words.filter(w => w.to.includes(user.id));
        const card = to(player(victim)).some(w => w.html.includes(`- ${foundry.utils.escapeHTML(victim.name)}</h3>`));
        equal(stableJson([stage, card, to(player(builder)).length]), stableJson(["incident", true, 0]),
            `the trap's incident did not start, its victim's player was not sent the crisis card, or its builder's player was sent a card's words: ${
                stableJson(words.map(w => ({ to: w.to, text: w.html.replace(/<[^>]+>/g, " ").trim().slice(0, 80) })))}`);
    }],

    ["a trap's last crisis card does not reach its builder", async () => {
        /*
         * E06 fix r1-G3, 28.09.2026; review m1 = F3. A crisis card's audience was read at the
         * stage the card is written at, and an action that ends a trap moves it to `resolution`
         * first, where the table seats the builder again - so they were sent the victim's last
         * action, its total and its band. `announceCrisis` takes the stage the action was taken
         * at now. A trap is opened, its victim's roll misses, and the victim Survives (which
         * ends the incident); the card's words this GM sends are read off the packets
         * (`wordsSent`): the victim's player is sent it, the builder's player not.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a trap's builder and its victim, each with a player to be sent a card's words");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim] = livingStudents().filter(player);
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        const stage = M.murderState()?.stage ?? null;
        const words = await wordsSent(async () => {
            await game.drpg.resolveCrisisAction({ actorId: victim.id, key: "survive", total: 30, isCritical: false, withHope: true });
            await settle();
        });
        const card = user => words.some(w => w.to.includes(user.id) && w.html.includes(`- ${foundry.utils.escapeHTML(victim.name)}</h3>`));
        equal(stableJson([stage, M.murderState()?.stage ?? null, card(player(victim)), card(player(builder))]),
            stableJson(["incident", "resolution", true, false]),
            `the trap's incident did not start and end on Survive, its victim's player was not sent the card, or its builder's player was: ${
                stableJson(words.map(w => ({ to: w.to, text: w.html.replace(/<[^>]+>/g, " ").trim().slice(0, 80) })))}`);
    }],

    ["the third party who leaves is told", async () => {
        /*
         * E06 C4, 27.09.2026; audit S04-36 (L11). A third party who walks in and chooses Averted
         * eyes leaves the incident before the card of that choice is written - `thirdId` is
         * nulled on the way (murder.mjs `applyThirdPartyChoice`) - and the card's list was read
         * off the state afterwards, so the one person the card is about was the one not sent it.
         * `announceCrisis` adds the actor who acted (`also`). A direct murder, its opening ruled
         * a success here (C2's fixture), a third walks in and averts their eyes; the packets
         * this GM sends for the choice are read (`wordsSent`).
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and a third, each with a player to be sent the card");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, third] = livingStudents().filter(player);
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await M.thirdPartyEnters(third);
        await settle();
        const joined = M.murderState()?.thirdId ?? null;
        const words = await wordsSent(async () => {
            await game.drpg.resolveCrisisAction({ actorId: third.id, key: "avertedEyes", total: 0, isCritical: false, withHope: true });
            await settle();
        });
        const cardTo = user => words.some(w => w.to.includes(user.id) && w.html.includes(`- ${foundry.utils.escapeHTML(third.name)}</h3>`));
        equal(stableJson([joined, M.murderState()?.thirdId ?? null, cardTo(player(third)), cardTo(player(killer)), cardTo(player(victim))]),
            stableJson([third.id, null, true, true, true]),
            `the third did not walk in and leave, or the card of their choice did not reach them, the killer or the victim: ${
                stableJson(words.map(w => ({ to: w.to, text: w.html.replace(/<[^>]+>/g, " ").trim().slice(0, 80) })))}`);
    }],

    ["the time of day in an incident is veiled and names nobody", async () => {
        /*
         * E06 C4, 27.09.2026; audit S10-04 (L12). While an incident runs the time of day is told
         * to the people in it alone (clock.mjs `announceTimeOfDay`, since 26.08), and it was a
         * plain whisper: its list - the GMs and every participant's owner, a trap's builder
         * among them - is a field every console reads. It is veiled now and its words go to
         * the GMs and `incidentAudienceIds`. A trap is opened and its incident started; the GM
         * moves the time of day; the card is read off the log (veiled, everybody on its list,
         * no actor speaking) and its words off the packets (`wordsSent`): the victim's player
         * is sent them, the builder's is not. The clock is put back.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a trap's builder and its victim, each with a player to be sent the words");
        const M = await import("./murder.mjs");
        const C = await import("./clock.mjs");
        const { TIMES_OF_DAY } = await import("./config.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim] = livingStudents().filter(player);
        const clock = getClock();
        const next = TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(clock.timeOfDay) + 1) % TIMES_OF_DAY.length];
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        const from = game.messages.size;
        let words = [];
        try {
            words = await wordsSent(async () => {
                await C.setTimeOfDay(next, { resetSearchTokens: false });
                await settle();
            });
        } finally {
            await setClock(clock);
            await settle();
        }
        const label = C.timeOfDayLabel(next);
        const card = game.messages.contents.slice(from).find(m => words.some(w => w.id === m.id && w.html.includes(label)))
            ?? game.messages.contents.slice(from).find(m => String(m.content ?? "").includes(label)) ?? null;
        const sent = words.find(w => w.id === card?.id) ?? { to: [] };
        const everybody = game.users.map(u => u.id).sort();
        equal(stableJson([M.murderState()?.stage ?? null, Boolean(card), Boolean(card?.getFlag(MODULE_ID, "veiled")),
            stableJson([...(card?.whisper ?? [])].sort()) === stableJson(everybody), card?.speaker?.actor ?? null,
            sent.to.includes(player(victim).id), sent.to.includes(player(builder).id)]),
            stableJson(["incident", true, true, true, null, true, false]),
            `the time of day in the trap was not one veiled card naming everybody, or its words missed the victim or reached the builder: ${
                stableJson({ whisper: card?.whisper ?? null, speaker: card?.speaker ?? null, flags: Object.keys(card?.flags?.[MODULE_ID] ?? {}), to: sent.to })}`);
    }],

    ["a direct murder's victim is told who is moving on them, a trap's victim is not", async () => {
        /*
         * E06 C4, 27.09.2026; audit S04-31, the owner's D6. The victim of a direct murder was
         * told "Someone is moving on you" while the Event card and their copy of the cast named
         * the killer - face to face; the whisper names the killer now (`victimUnderAttackBy`,
         * murder.mjs `tellVictimTheIncidentBegan`). A trap's victim is told the trap closed,
         * and nothing of its builder. Each murder is opened and its incident started with the
         * same two students; the words sent to the victim's player are read off the packets.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player to be told");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const name = foundry.utils.escapeHTML(killer.name);
        const toVictim = words => words.filter(w => w.to.includes(player(victim).id)).map(w => w.html);
        const direct = toVictim(await wordsSent(async () => {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
        }));
        await M.endMurder({ reason: "test", followUp: false });
        await settle();
        const trap = toVictim(await wordsSent(async () => {
            await M.openMurder({ killerId: killer.id, victimId: victim.id, indirect: true });
            if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
            await settle();
        }));
        const attacked = game.i18n.format("DRPG.Murder.victimUnderAttackBy", { killer: name });
        const sprung = game.i18n.localize("DRPG.Murder.victimTrapSprung");
        equal(stableJson([direct.some(h => h.includes(attacked)), trap.some(h => h.includes(sprung)), trap.some(h => h.includes(name))]),
            stableJson([true, true, false]),
            `the direct victim was not told the killer's name, or the trap's victim was not told it closed, or was told its builder's name: ${
                stableJson({ direct: direct.map(h => h.replace(/<[^>]+>/g, " ").trim().slice(0, 80)), trap: trap.map(h => h.replace(/<[^>]+>/g, " ").trim().slice(0, 80)) })}`);
    }],

    ["a second killer in the same Eclipse is told only that the attempt is refused", async () => {
        /*
         * E06 C4, 27.09.2026; audit S10-38, the owner's D6. Two direct murders declared in one
         * Eclipse and both standing at the lights: the first opens the incident, the second is
         * refused (eclipse.mjs `judgePendingMurders`). Its killer was told "an incident was
         * already running" - that somebody was being killed somewhere at that moment. They are
         * told the ordinary refusal now (`murderRefused`), and the GMs keep the reason
         * (`murderSecondDeclaration`). Two pairs stood alone in two rooms, both declarations
         * allowed and named for this Eclipse, the second declared after the first; the Eclipse
         * ends and the words sent to the second killer's player are read off the packets, the
         * GMs' card off this GM's own copy.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "two killers whose players are sent the lights' answers");
        needs(world.atLeast("livingStudents", 4), "two killers and two victims");
        needs(world.atLeast("studentTokensOnScreen", 4), "each pair is stood in a room by their tokens");
        needs(world.atLeast("namedRooms", 3), "a room is left to each pair");
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const { contentOf } = await import("./secret.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [first, second] = livingStudents().filter(player);
        const [firstVictim, secondVictim] = livingStudents().filter(a => a !== first && a !== second);
        equal(M.murderState(), null, "an incident was already running when this scenario started");
        const stood = [await aloneTogether(first, firstVictim, { asked: true })];
        let words = [];
        const from = game.messages.size;
        try {
            stood.push(await aloneTogether(second, secondVictim, { asked: true }));
            await E.startEclipse();
            await settle();
            const id = E.eclipseId();
            ok(E.isEclipse() && id, `the Eclipse did not open, or has no name (${id})`);
            for (const [at, killer, room] of [[1, first, stood[0].room], [2, second, stood[1].room]]) {
                await S.pendingMurderStore.patch(killer.id, { room, note: "SUITE E06 C4 declared in the dark", at, approved: true, eclipse: id });
            }
            words = await wordsSent(async () => {
                await E.endEclipse({ advance: false });
                await settle();
            });
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            await S.pendingMurderStore.dropMany([first.id, second.id].filter(id => S.pendingMurderStore.has(id)));
            for (const s of stood.reverse()) await s.back();
        }
        const refused = game.i18n.localize("DRPG.Action.murderRefused");
        const toSecond = words.filter(w => w.to.includes(player(second).id)).map(w => w.html);
        const reason = game.i18n.format("DRPG.Action.murderSecondDeclaration", { killer: foundry.utils.escapeHTML(second.name) });
        const gmKept = game.messages.contents.slice(from).some(m => contentOf(m).includes(reason));
        equal(stableJson([toSecond.length, toSecond.some(h => h.includes(refused)), gmKept]), stableJson([1, true, true]),
            `the second killer was not sent one card, the ordinary refusal, or the GMs lost the reason: ${
                stableJson(toSecond.map(h => h.replace(/<[^>]+>/g, " ").trim().slice(0, 100)))}`);
    }],

    ["the GM finds a neutral roll's subject", async () => {
        /*
         * E06 C5a, 27.09.2026; audit S02-02, S04-02 (the plan's 2.3). A roll's document is to
         * name nobody, so the character it is about reaches the primary GM by a report,
         * `roll.subject`, and `rollSubject` answers from what was reported. A roll thrown here,
         * its document emptied as it was created (`neutralRoll`): its subject is found - on the
         * GM who threw it, kept without a packet. Then four reports, judged as the listener
         * judges them: a connected player's of a roll the GM wrote, and of a character they do
         * not play; a GM's of a message that is not a roll the module threw - each refused,
         * logged and told to nobody (quiet); and a GM's of its own roll, which is taken and read
         * back. The report crossing the socket from a player is 33-bridge-paths' A10.
         */
        needs(world.atLeast("connectedPlayersWithCharacter", 1), "a refused report is sent by a player, and Foundry names only a connected one");
        const [who] = cast(1);
        const P = await import("./private-rolls.mjs");
        const G = await import("./bridge-guards.mjs");
        const U = await import("./utils.mjs");
        const plays = (u, a) => a.type === "character" && a.testUserPermission(u, "OWNER");
        const player = game.users.find(u => !u.isGM && u.active && game.actors.some(a => plays(u, a)));
        const theirs = game.actors.find(a => plays(player, a));
        const other = game.actors.find(a => a.type === "character" && !plays(player, a));
        must(other, `${player.name} plays every character - a report of somebody else's cannot be made here`);
        const made = [];
        const refusals = () => U.sessionFailures().filter(e => String(e.message).includes('Refused a "roll.subject"')).length;
        try {
            const { message } = await neutralRoll(who, { faces: { hope: 9, fear: 5 } });
            made.push(message?.id);
            must(message && !message.speaker?.actor && !message.system?.source?.actor,
                "the roll's document still names its character, or there is none - this measured nothing");
            const found = P.rollSubjectNow(message)?.id ?? null;
            const plain = await ChatMessage.create({ content: "E06 C5a: not a roll the module threw" });
            made.push(plain?.id);
            const sent = [];
            const ask = (from, messageId, actorId) => G.judge(P.ROLL_ACTIONS,
                { action: "roll.subject", messageId, actorId }, from, { send: (to, packet) => sent.push(packet?.action ?? null) });
            const before = refusals();
            const verdicts = [
                await ask(player.id, message.id, theirs.id),
                await ask(player.id, message.id, other.id),
                await ask(game.user.id, plain.id, who.id),
                await ask(game.user.id, message.id, other.id)
            ];
            equal(stableJson([found, verdicts, refusals() - before, sent, P.rollSubjectNow(message)?.id ?? null]),
                stableJson([who.id, [null, null, null, true], 3, [], other.id]),
                "the subject was not found, a report that is not the sender's to make was taken or told, or a GM's own was not kept");
        } finally {
            for (const id of made) await game.messages.get(id ?? "")?.delete();
        }
    }],

    ["a Fear on a neutral roll feeds the right Monokuma", async () => {
        /*
         * E06 C5a, 27.09.2026; the plan's section 0, fact 6. The Despair award found the roller's
         * character on the message - its speaker, then `system.source.actor`, then the author's
         * assigned character - and a roll whose document names nobody left it with the GM's, which
         * is nobody's: the Fear fed no pool. It asks `rollSubject` now, which waits for the
         * report. The student's Monokuma is set to 0 and a Fear thrown for the student; that pool
         * gains one and no other moves. The harness sets the dice; at a real table they fall as
         * they fall, and a Hope there measures only that nothing was fed.
         */
        const [who] = cast(1);
        const D = await import("./despair.mjs");
        const { monokumaFor } = await import("./assignments.mjs");
        const { readDuality } = await import("./despair-award.mjs");
        const mono = monokumaFor(who);
        must(mono, `${who.name} feeds no Monokuma's pool - this would measure nothing`);
        const pools = () => D.monokumas().map(u => [u.id, D.getDespair(u.id)]);
        let message = null;
        try {
            await game.settings.set(MODULE_ID, SETTINGS.despairFromRolls, true);
            await D.setDespair(mono.id, 0);
            const before = pools();
            ({ message } = await neutralRoll(who, { faces: { hope: 3, fear: 9 } }));
            must(message && !message.speaker?.actor && !message.system?.source?.actor,
                "the roll's document still names its character, or there is none - this measured nothing");
            const feared = Boolean(readDuality(message)?.withFear);
            const expected = before.map(([id, n]) => [id, id === mono.id && feared ? n + 1 : n]);
            await until(() => stableJson(pools()) === stableJson(expected), 6000);
            await settle();
            equal(stableJson(pools()), stableJson(expected),
                `${feared ? "a Fear" : "a Hope"} on a roll that names nobody fed the wrong pools, or none`);
        } finally {
            await message?.delete();
        }
    }],

    ["a Reroll of a neutral roll finds it, and its receipt and its settlement name its character", async () => {
        /*
         * E06 C5a, 27.09.2026; the plan's section 0, fact 6. Three readers of a Reroll found the
         * character on the message: the roller's scan of recent chat (`belongsTo`), the GM's
         * receipt (`actorIdsOf`) and the settlement of Hope and Sanity (`rollTarget`, from the
         * roll's `source.actor`). A roll whose document names nobody, with its bookmark: the
         * bookmark finds it, and so does the scan once the bookmark is gone - from what this
         * browser kept when it threw it; the receipt's reader names the character; and the
         * settlement lands on the character the Reroll was asked for, where the roll alone names
         * nobody. The Reroll itself is not thrown: `Roll#reroll` is not in the harness, and a
         * receipt is a player's, made on the GM's client from that player's rewrite -
         * 33-bridge-paths' A10 makes one. The bookmark store and the message are put back.
         * E06 fix r1-G1, 28.09.2026: the roll is thrown with the student's experience picked, and
         * the bookmark keeps it - the roll's message no longer does, and the Reroll rebuilds the
         * formula from the bookmark's (reroll.mjs `rollAsThrown`, R204).
         */
        const [who] = cast(1);
        const picked = Object.keys(who.system?.experiences ?? {}).slice(0, 1);
        must(picked.length, `${who.name} has no experience to pick - this would measure nothing`);
        const R = await import("./reroll.mjs");
        const { actorIdsOf } = await import("./reroll-receipts.mjs");
        const kept = getSetting(SETTINGS.rollBookmarks);
        let message = null;
        try {
            ({ message } = await neutralRoll(who, { remember: true, faces: { hope: 9, fear: 5 }, experiences: picked }));
            must(message && !message.speaker?.actor && !message.system?.source?.actor && message.rolls?.[0],
                "the roll's document still names its character, or holds no roll - this measured nothing");
            const byMark = R.lastRollOf(who).message?.id ?? null;
            const marked = R.lastRollOf(who).bookmark?.experiences ?? null;
            const stored = typeof message.toObject().rolls[0] === "string" ? JSON.parse(message.toObject().rolls[0]) : message.toObject().rolls[0];
            await game.settings.set(MODULE_ID, SETTINGS.rollBookmarks, {});
            const byScan = R.lastRollOf(who).message?.id ?? null;
            const original = message.rolls[0];
            const [target, alone] = [await R.rollTarget(original, who), await R.rollTarget(original)];
            equal(stableJson([byMark, byScan, actorIdsOf(message), target?.id ?? null, alone?.id ?? null, marked, stored?.options?.experiences ?? null]),
                stableJson([message.id, message.id, [who.id], (who.system?.partner ?? who).id, null, picked, null]),
                "a Reroll would not find the roll, its receipt or its settlement would not name the character, or its bookmark lost the experiences the roll no longer holds");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.rollBookmarks, kept ?? {});
            await message?.delete();
        }
    }],

    ["a module roll's document names nobody", async () => {
        /*
         * E06 C5b, 27.09.2026; audit S02-02, S04-02 (the plan's 2.3). Every browser holds a roll's
         * document whoever it is whispered to, and a roll the module threw named its character in
         * its speaker, in Daggerheart's `system.source.actor` and in each roll's options (the
         * actor's uuid, its id and name in `data`), its action in `system.title` and the options'
         * title and headerTitle, and its player in the whisper list. A student's roll with an
         * action's title is thrown twice by this GM, with rolls forced private and without: each
         * document holds none of it - the whole source is searched for the character's id and
         * name and for the title - and reads clean against the world-secrets rule, the first is
         * whispered to the GMs alone (not to the student's player, whom a GM's roll for them
         * used to add), the second to nobody, as the table chose; and the GM still knows whose
         * roll each was (`rollSubjectNow`, from what it kept as it threw).
         * WHAT ITS OPTIONS KEPT OF THE SHEET (E06 fix r1-G1, 28.09.2026; review M1 = F1). C5b took
         * the id and the name out of a roll's `data`, measured on a harness that wrote nothing
         * else there; Daggerheart writes the character's whole system (client-entry.mjs
         * `diceRoll`, now in that shape). The roll's data is read empty, its effects, the
         * experiences picked and its statistic absent, and the source is searched for the
         * student's experience names and companion's uuid as well as for the id and the name -
         * the seed's biography names its student. With C5b's cut alone, the name was found.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 1), "the student's player is who the old whisper list named");
        const P = await import("./private-rolls.mjs");
        const { findWorldSecrets } = await import("./world-secrets.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const { gmIds } = await import("./utils.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const who = livingStudents().find(player);
        const TITLE = "E06 C5b - a secret action";
        const sheet = [...Object.values(who.system?.experiences ?? {}).map(e => e?.name), who.system?.companion].filter(Boolean);
        must(sheet.length >= 2, "the student's sheet holds no named experience or companion - this would measure nothing");
        const forced = getSetting(SETTINGS.forcePrivateRolls);
        const made = [];
        const read = async () => {
            const { message } = await neutralRoll(who, { faces: { hope: 9, fear: 5 }, title: TITLE });
            made.push(message?.id);
            must(message && P.isClaimedRoll(message) && message.rolls?.length, "no roll the module threw was made - this would measure nothing");
            const source = message.toObject();
            const roll = typeof source.rolls[0] === "string" ? JSON.parse(source.rolls[0]) : source.rolls[0];
            const text = JSON.stringify(source);
            return {
                fields: [source.speaker?.actor ?? null, source.speaker?.token ?? null, source.system?.title ?? null, source.system?.source?.actor ?? null,
                    roll?.options?.title ?? null, roll?.options?.headerTitle ?? null, roll?.options?.source?.actor ?? null,
                    roll?.options?.data ?? null, roll?.options?.effects ?? null, roll?.options?.experiences ?? null,
                    roll?.options?.roll?.trait ?? null],
                named: [who.id, who.name, TITLE, ...sheet].filter(x => text.includes(x)),
                rule: findWorldSecrets({ messages: [{ id: source._id, flags: source.flags, speaker: source.speaker, system: source.system,
                    rolls: source.rolls, whisper: source.whisper, author: source.author }] }, { ids: [who.id] }).map(h => h.path),
                whisper: [...(source.whisper ?? [])].sort(),
                subject: P.rollSubjectNow(message)?.id ?? null
            };
        };
        try {
            await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, true);
            const privately = await read();
            await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, false);
            const openly = await read();
            const empty = [null, null, "", "", "", "", "", {}, null, null, null];
            equal(stableJson([privately, openly]), stableJson([
                { fields: empty, named: [], rule: [], whisper: [...gmIds()].sort(), subject: who.id },
                { fields: empty, named: [], rule: [], whisper: [], subject: who.id }]),
                `a roll the module threw still names its character, its action or its player, or the GM lost whose it was (${player(who).name} plays ${who.name})`);
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, forced);
            for (const id of made) await game.messages.get(id ?? "")?.delete();
        }
    }],

    ["a roll's character is kept before its dice have landed", async () => {
        /*
         * E06 fix r1-G2, 28.09.2026; review F4. Daggerheart creates a roll's message and then waits
         * for Dice So Nice's animation before the roll returns (dhRoll.mjs:162-165, read in 2.6.5),
         * and until this fix the roller said whose roll it was only then - so the Despair award,
         * which waits four seconds for it, lost a GM's roll for a student, or a player's who plays
         * two, whenever the dice fell for longer. This GM, the primary, which keeps its own roll's
         * character without a packet, throws a student's roll with the animation's wait wrapped
         * by a probe that reads, as the wait begins, which character it keeps for the message.
         * Without Dice So Nice nothing is waited for and there is nothing to measure.
         */
        needs(world.moduleActive("dice-so-nice"), "Dice So Nice, whose animation Daggerheart waits for once it has created the roll");
        must(typeof game.dice3d?.waitFor3DAnimationByMessageID === "function", "Dice So Nice is on, and its animation cannot be waited for");
        const P = await import("./private-rolls.mjs");
        const { isPrimaryGm } = await import("./utils.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        must(isPrimaryGm(), "the primary GM keeps its own roll's character, and this GM is not it");
        const who = livingStudents()[0];
        must(who, "no living student to throw a roll for");
        const dice3d = game.dice3d;
        const own = Object.getOwnPropertyDescriptor(dice3d, "waitFor3DAnimationByMessageID");
        const wait = dice3d.waitFor3DAnimationByMessageID;
        const seen = [];
        dice3d.waitFor3DAnimationByMessageID = function (id, ...rest) {
            seen.push({ id, kept: P.keptRollSubject(game.messages.get(id)) });
            return wait.call(this, id, ...rest);
        };
        let message = null;
        try {
            message = (await neutralRoll(who)).message;
        } finally {
            if (own) Object.defineProperty(dice3d, "waitFor3DAnimationByMessageID", own);
            else delete dice3d.waitFor3DAnimationByMessageID;
            await message?.delete();
        }
        must(message && P.isClaimedRoll(message), "no roll the module threw was made - this would measure nothing");
        equal(stableJson(seen.find(s => s.id === message.id) ?? null), stableJson({ id: message.id, kept: who.id }),
            "the roll's character was not kept as its dice began to fall - its report waited for the animation");
    }],

    ["after a crisis action no message names a participant", async () => {
        /*
         * E06 C5b, 27.09.2026; the stage's doneWhen. A direct murder is opened between two students
         * who each have a player, its opening is ruled, and the victim takes a crisis action - Leave
         * a clue, thrown by this GM as the suite throws every roll, with Hope. Every message that
         * appeared meanwhile - the roll, the crisis card, whatever the clue left - is read as every
         * console holds it: no participant's actor id or name in its speaker, `system` or rolls, no
         * whisper list naming a participant's player without naming everybody, and the action's
         * title nowhere but in its words (the content, which a veiled card does not carry). The roll
         * must be among them, or this would measure the cards alone. Until C5b the roll named the
         * victim in all three places, and its whisper list named both players.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player a whisper list could name");
        const M = await import("./murder.mjs");
        const P = await import("./private-rolls.mjs");
        const { CRISIS_ACTIONS } = await import("./config.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const label = CRISIS_ACTIONS.leaveClue.label;
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        if (M.murderState()?.stage === "openingRoll") await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident" && M.isTheirTurn(victim), `the incident did not reach the victim's turn: ${stableJson(M.murderState())}`);
        const had = new Set(game.messages.contents.map(m => m.id));
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        try {
            globalThis.__forceRoll = { hope: 9, fear: 5 };
            await M.takeCrisisAction(victim, "leaveClue");
            await settle();
        } finally {
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
        }
        const made = game.messages.contents.filter(m => !had.has(m.id));
        const names = [killer, victim].flatMap(a => [a.id, a.name]);
        const players = [killer, victim].map(a => player(a).id);
        const everybody = game.users.map(u => u.id);
        const wrong = made.map(m => {
            const source = m.toObject();
            const whisper = source.whisper ?? [];
            const said = JSON.stringify([source.speaker, source.system, source.rolls]);
            return {
                id: m.id, roll: P.isClaimedRoll(m),
                named: names.filter(x => said.includes(x)),
                whisper: whisper.some(u => players.includes(u)) && !everybody.every(u => whisper.includes(u)),
                titled: JSON.stringify({ ...source, content: "" }).includes(label)
            };
        }).filter(r => r.named.length || r.whisper || r.titled);
        equal(stableJson([made.some(m => P.isClaimedRoll(m)), wrong]), stableJson([true, []]),
            `the victim's roll was not among the action's messages, or a message names a participant or the action (${made.length} read)`);
    }],

    ["Dice So Nice animates a forced-private roll only where it can be read", async () => {
        /*
         * E06 C6, 27.09.2026; audit S02-40. Dice So Nice decides on every client whether a new
         * roll animates there, and with its "Hide 3D dice on secret rolls" off it animated a
         * whisper with its real faces on every screen. It asks `diceSoNiceMessagePreProcess`
         * first (main.js :458-516, read in 6.3.1), and private-rolls.mjs answers: with rolls
         * forced private, a client that cannot read the message does not animate it. Asked here
         * as Dice So Nice asks it, on this GM, of one roll three times: whispered to the GMs
         * (readable), then turned into a blind whisper to a player (unreadable here), then the
         * same with rolls no longer forced private (Dice So Nice's own choice stands).
         */
        needs(world.atLeast("playerAccounts", 1), "a player a roll can be whispered to past the GM");
        const [who] = cast(1);
        const player = game.users.find(u => !u.isGM);
        await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, true);
        const { message } = await neutralRoll(who);
        must(message, "the roll made no message");
        const decide = () => {
            const interception = { willTrigger3DRoll: true };
            Hooks.callAll("diceSoNiceMessagePreProcess", message.id, interception);
            return interception.willTrigger3DRoll;
        };
        try {
            const readable = [message.isContentVisible, decide()];
            await message.update({ whisper: [player.id], blind: true });
            const unreadable = [message.isContentVisible, decide()];
            await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, false);
            const unforced = decide();
            equal(stableJson([readable, unreadable, unforced]), stableJson([[true, true], [false, false], true]),
                "a roll this client cannot read still animates here, a readable one does not, or an unforced table lost Dice So Nice's own choice");
        } finally {
            await message.delete();
        }
    }],

    ["a Reroll's dice are thrown to the roll's readers alone", async () => {
        /*
         * E06 C6, 27.09.2026; audit S02-13. A Reroll threw its new dice with
         * `showForRoll(rerolled, game.user, true)` - to every screen. It names the readers now
         * (reroll.mjs `showRerolledDice`): the message's whisper list and its author, or
         * everybody (no list) when the roll was not whispered, with the message's id. Dice So
         * Nice is swapped for a recorder for the two calls, so a table's real one draws nothing.
         */
        needs(world.moduleActive("dice-so-nice"), "a Reroll shows its dice through Dice So Nice");
        const [who] = cast(1);
        const R = await import("./reroll.mjs");
        const { gmIds } = await import("./utils.mjs");
        await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, true);
        const { message } = await neutralRoll(who);
        must(message?.rolls?.length, "the roll made no message");
        const real = game.dice3d;
        const calls = [];
        game.dice3d = { showForRoll: async (...args) => { calls.push(args); return true; } };
        try {
            await R.showRerolledDice(message.rolls[0], message);
            await message.update({ whisper: [] });
            await R.showRerolledDice(message.rolls[0], message);
        } finally {
            game.dice3d = real;
            await message.delete();
        }
        const read = args => ({ sync: args[2] === true, users: args[3] ? [...args[3]].map(u => u?.id ?? u).sort() : null, id: args[5] ?? null });
        equal(stableJson(calls.map(read)), stableJson([
            { sync: true, users: [...new Set([...gmIds(), game.user.id])].sort(), id: message.id },
            { sync: true, users: null, id: message.id }
        ]), "a Reroll's dice go to somebody who does not read the roll, or a whispered roll's to everybody");
    }],

    ["an incident roll's dice reach the incident's audience at the roll's stage, and nobody else", async () => {
        /*
         * E06 C6, 27.09.2026; audit S04-01, L05. Since C5b a roll the module throws is whispered to
         * the GMs alone, so the incident's participants no longer read each other's dice off the
         * list. `diceAudienceIds` says who sees them - the GMs, the author and, while the fight
         * runs, the incident's audience when the roll's character holds a seat - and the primary
         * GM sends the rest `dice.show { id }` (private-rolls.mjs `relayIncidentDice`): as it
         * keeps the roll's subject, and again when a Reroll rewrites the roll's dice. A direct
         * murder between two students with players; this GM throws the killer's roll, so both
         * players are sent it. The audience at the opening is read off the same state, its stage
         * set back: the GMs, the author and the killer's side - the killer's player, never the
         * victim's (D6); until E06 fix r1-G3 (review M4) the opening's was the GMs and the author
         * alone. At Stage 6, the clean-up, it is still those two. Only this roll's packets are
         * compared: the killer's player may throw the opening roll too (the race the test above names).
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player to be sent the dice");
        const M = await import("./murder.mjs");
        const P = await import("./private-rolls.mjs");
        const { gmIds, isPrimaryGm } = await import("./utils.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        must(isPrimaryGm(), "the relay is the primary GM's, and this GM is not it");
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        if (M.murderState()?.stage === "openingRoll") await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident", `the incident did not start: ${stableJson(M.murderState())}`);
        let message = null;
        const sent = await relayedDice(async () => {
            message = (await neutralRoll(killer)).message;
            must(message?.rolls?.length, "the killer's roll made no message");
            const roll = message.toObject().rolls[0];
            const changed = typeof roll === "string" ? JSON.parse(roll) : foundry.utils.deepClone(roll);
            changed.total = Number(changed.total ?? 0) + 1;
            await message.update({ rolls: [typeof roll === "string" ? JSON.stringify(changed) : changed] });
            await settle();
        });
        try {
            const state = M.murderState();
            const sorted = ids => [...new Set(ids)].sort();
            const players = sorted([player(killer).id, player(victim).id]);
            equal(stableJson([
                sorted(P.diceAudienceIds(message, { ...state, stage: "openingRoll" })),
                sorted(P.diceAudienceIds(message, state)),
                sorted(P.diceAudienceIds(message, { ...state, stage: "resolution" })),
                sent.filter(p => p.id === message.id).map(p => ({ id: p.id, to: sorted(p.to) }))
            ]), stableJson([
                sorted([...gmIds(), player(killer).id]),
                sorted([...gmIds(), ...players]),
                sorted(gmIds()),
                [{ id: message.id, to: players }, { id: message.id, to: players }]
            ]), "the dice's audience at the opening, in the fight or at Stage 6, or what the relay sent as the roll was kept and rerolled, is not the rule's");
        } finally {
            await message?.delete();
        }
    }],

    ["the cards an incident's roll brings name no participant", async () => {
        /*
         * E06 fix r1-G3, 28.09.2026; review M2. Three cards other files post on a roll's behalf -
         * a Loaded Die's notice (action-rolls.mjs `throwDice`), a tool worn or broken on a Despair
         * (use-items.mjs `breakOnDespair`, which a crisis action calls) and a Hope Call's receipt
         * (calls.mjs `spendHopeCall`) - were whispered from the character to the GMs and its
         * player, so in a fight each named a participant to every console beside the roll that
         * names nobody. They are veiled while an incident runs, whoever posts them (secret.mjs
         * `incidentVeils`, fix r2-G2; until then `incidentVeil`, while the cast named the actor).
         * A direct murder between two students with players, its opening ruled
         * a success; the victim rolls with a Loaded Die armed, a tier-2 tool of the killer's takes
         * two Despairs - driven through `breakOnDespair` with a Despair result, as the durability
         * test drives `wearItem`, so the dice do not decide whether this measures anything - and
         * the victim buys a Sprint. Every message that appeared is read as the C5b test above
         * reads an action's: no participant's id or name in its speaker, `system` or rolls, no
         * whisper list naming a participant's player without naming everybody. Each of the four
         * cards must be among them, veiled, its words sent to the actor's player. Nor may any of
         * them carry the Loaded Die's nonce (fix r2-G2, 28.09.2026; review round 2's mn1 = m1): it
         * is in the victim's `pendingCall` flag, which every browser holds, and the roll's options
         * kept it - hidden here until the same fix, because the harness wrote a roll's options as
         * a list of keys rather than the config Daggerheart writes.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer and a victim, each with a player a whisper list could name");
        const M = await import("./murder.mjs");
        const INV = await import("./inventory.mjs");
        const { breakOnDespair } = await import("./use-items.mjs");
        const { appendArmedCall } = await import("./call-effects.mjs");
        const { spendHopeCall } = await import("./calls.mjs");
        const { automatedUpdate } = await import("./resource-guard.mjs");
        const { HOPE_CALLS } = await import("./config.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        if (M.murderState()?.stage === "openingRoll") await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident", `the incident did not start: ${stableJson(M.murderState())}`);
        const hope = victim.system?.resources?.hope?.value ?? 0;
        const had = new Set(game.messages.contents.map(m => m.id));
        const tool = await INV.grantItem(killer, { name: "Suite tool worn in a fight", category: "tool", tier: 2 });
        must(tool, "could not hand the killer a tool");
        const LOADED = "SUITELOADEDDIE01";
        let words = [];
        try {
            words = await wordsSent(async () => {
                await appendArmedCall(victim, { key: "freeCrit", kind: "hope", grants: "critical", nonce: LOADED });
                await neutralRoll(victim, { remember: true, faces: { hope: 5, fear: 3 } });
                await breakOnDespair(killer, tool, { withFear: true, isCritical: false });
                await breakOnDespair(killer, tool, { withFear: true, isCritical: false });
                await automatedUpdate(victim, { "system.resources.hope.value": Math.max(hope, HOPE_CALLS.sprint.cost) });
                await spendHopeCall(victim, "sprint");
                await settle();
            });
        } finally {
            await killer.items.get(tool.id)?.delete();
            await automatedUpdate(victim, { "system.resources.hope.value": hope });
        }
        const made = game.messages.contents.filter(m => !had.has(m.id));
        const names = [...[killer, victim].flatMap(a => [a.id, a.name]), LOADED];
        const players = [killer, victim].map(a => player(a).id);
        const everybody = game.users.map(u => u.id);
        const wrong = made.map(m => {
            const source = m.toObject();
            const whisper = source.whisper ?? [];
            const said = JSON.stringify([source.speaker, source.system, source.rolls]);
            return { id: m.id, named: names.filter(x => said.includes(x)),
                whisper: whisper.some(u => players.includes(u)) && !everybody.every(u => whisper.includes(u)) };
        }).filter(r => r.named.length || r.whisper);
        const esc = foundry.utils.escapeHTML;
        const cards = {
            loaded: [victim, game.i18n.format("DRPG.Calls.freeCritUsed", { name: esc(victim.name) })],
            wore: [killer, game.i18n.format("DRPG.Items.woreOnDespair", { item: esc(tool.name), left: 1, total: 2 })],
            broke: [killer, game.i18n.format("DRPG.Items.brokeOnDespair", { item: esc(tool.name) })],
            receipt: [victim, `<h3>${esc(HOPE_CALLS.sprint.label)}</h3>`]
        };
        const found = Object.fromEntries(Object.entries(cards).map(([key, [actor, text]]) => {
            const sent = words.find(w => w.html.includes(text));
            const card = made.find(m => m.id === sent?.id);
            return [key, Boolean(card?.getFlag(MODULE_ID, "veiled")) && sent.to.includes(player(actor).id)];
        }));
        equal(stableJson([found, wrong]), stableJson([{ loaded: true, wore: true, broke: true, receipt: true }, []]),
            `a card the fight's roll brought was not posted veiled with its words to its player, or a message names a participant (${made.length} read): ${
                stableJson(words.map(w => ({ id: w.id, to: w.to, text: w.html.replace(/<[^>]+>/g, " ").trim().slice(0, 60) })))}`);
    }],

    ["a use in a fight is carded veiled whoever makes it, and names nobody", async () => {
        /*
         * E06 fix r2-G2, 28.09.2026; review round 2's MJ2 and m6. The crisis action "Use an item"
         * whispered its "used" card from the character to the GMs and its player - the review
         * measured a bystander's browser holding it so - and, read in the code, so did the rest
         * of what a use in a fight posts: a tier 0 object's ruling card and its receipt, the GM's
         * ruling on it, a Call armed on a participant. Fix r1-G3 veiled three such cards only
         * while the cast named their character, so the same card of a bystander's went plain and
         * a veiled one marked a participant. secret.mjs `incidentVeils` veils, while an incident
         * runs, every private card that would name a character or a player, whoever it is about.
         * A direct murder between two students with players, its opening ruled a success, a third
         * student with a player standing by and one with none: the victim takes "Use an item"
         * with a tier 1 kit, the killer with a tier 0 object (its window answered) and the GM
         * rules it had no effect; the GM arms a Support on the victim and an Obstacle on the
         * killer; the bystander drinks a kit, and a tool breaks on a Despair in the bystander's
         * hands and in the hands of the student nobody plays, whose card goes to the GMs alone
         * and speaks as him. Every message that appeared is read as the test above reads them,
         * the two bystanders named too, and each card must be veiled, its words sent to its
         * player - but a note to the GMs alone, which names nobody else, stays as it was, so a
         * ruling card can still be rewritten for every GM. Once the incident has ended the
         * bystander's next kit is carded as before, plain.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "a killer, a victim and a bystander, each with a player a whisper list could name");
        const M = await import("./murder.mjs");
        const INV = await import("./inventory.mjs");
        const S = await import("./secret.mjs");
        const { useItem, breakOnDespair, grantItemEffect } = await import("./use-items.mjs");
        const { armCall } = await import("./call-effects.mjs");
        const { whisperToGms } = await import("./utils.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim, bystander] = livingStudents().filter(player);
        const nobody = livingStudents().find(a => !game.users.some(u => !u.isGM && a.testUserPermission(u, "OWNER")));
        needs(world.atLeast("studentsWithoutPlayer", 1), "a student no player owns, whose cards go to the GMs alone");
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        if (M.murderState()?.stage === "openingRoll") await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident" && M.isTheirTurn(victim), `the incident did not reach the victim's turn: ${stableJson(M.murderState())}`);
        const kit = (actor, name) => INV.grantItem(actor, { name, category: "usable", tier: 1, goal: "healing", quiet: true });
        const tool = (actor, name) => INV.grantItem(actor, { name, category: "tool", tier: 1, quiet: true });
        const items = {
            kit: await kit(victim, "Suite kit used in the fight"),
            odd: await INV.grantItem(killer, { name: "Suite odd thing used in the fight", category: "usable", tier: 0, quiet: true }),
            drink: await kit(bystander, "Suite kit a bystander drinks"),
            snap: await tool(bystander, "Suite tool a bystander breaks"),
            npc: await tool(nobody, "Suite tool nobody's student breaks"),
            later: await kit(bystander, "Suite kit drunk after the fight")
        };
        must(Object.values(items).every(Boolean), `could not hand out ${stableJson(Object.keys(items).filter(k => !items[k]))}`);
        const owners = { kit: victim, odd: killer, drink: bystander, snap: bystander, npc: nobody, later: bystander };
        const had = new Set(game.messages.contents.map(m => m.id));
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        let words = [], after = [], fight = [];
        try {
            words = await wordsSent(async () => {
                globalThis.__forceRoll = { hope: 11, fear: 5 };
                await M.takeCrisisAction(victim, "useItem", { itemId: items.kit.id });
                await settle();
                if (!M.isTheirTurn(killer)) await M.passTurn();
                globalThis.__dialogAnswers.push(true, "Suite: I wave it about");
                try { await M.takeCrisisAction(killer, "useItem", { itemId: items.odd.id }); }
                finally { globalThis.__dialogAnswers.length = 0; }
                await settle();
                await grantItemEffect(killer, items.odd, {}, { consumeItem: true });
                await armCall(victim, { key: "support", kind: "hope", grants: "advantage", from: bystander.id });
                await armCall(killer, { key: "obstacle", kind: "despair", grants: "disadvantage", from: "monokuma" });
                await useItem(bystander, items.drink);
                await breakOnDespair(bystander, items.snap, { withFear: true, isCritical: false });
                await breakOnDespair(nobody, items.npc, { withFear: true, isCritical: false });
                await whisperToGms("<p>Suite: a note to the GMs in the fight.</p>");
                await settle();
            });
            fight = game.messages.contents.filter(m => !had.has(m.id));
            await M.endMurder({ reason: "test", followUp: false });
            await settle();
            after = await wordsSent(async () => {
                await useItem(bystander, items.later);
                await settle();
            });
        } finally {
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
            for (const a of [victim, killer]) await a.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            for (const [key, item] of Object.entries(items)) await owners[key].items.get(item?.id)?.delete();
        }
        const names = [killer, victim, bystander, nobody].flatMap(a => [a.id, a.name]);
        const players = [killer, victim, bystander].map(a => player(a).id);
        const everybody = game.users.map(u => u.id);
        const wrong = fight.map(m => {
            const source = m.toObject();
            const whisper = source.whisper ?? [];
            const said = JSON.stringify([source.speaker, source.system, source.rolls, source.flags]);
            return { id: m.id, named: names.filter(x => said.includes(x)),
                whisper: whisper.some(u => players.includes(u)) && !everybody.every(u => whisper.includes(u)) };
        }).filter(r => r.named.length || r.whisper);
        const esc = foundry.utils.escapeHTML;
        const used = item => game.i18n.format("DRPG.Items.used", { item: esc(item.name) });
        const broke = item => game.i18n.format("DRPG.Items.brokeOnDespair", { item: esc(item.name) });
        const grant = key => game.i18n.localize(`DRPG.Calls.grants.${key}`);
        const cards = {
            kit: [victim, used(items.kit)],
            asked: [killer, `<h3>${esc(game.i18n.format("DRPG.Items.useTitle", { item: items.odd.name }))}</h3>`],
            sent: [killer, game.i18n.localize("DRPG.Items.creativeSent")],
            ruled: [killer, used(items.odd)],
            support: [victim, game.i18n.format("DRPG.Calls.armedForYou", { what: grant("advantage") })],
            obstacle: [killer, game.i18n.format("DRPG.Calls.armedByMonokuma", { what: grant("disadvantage") })],
            drink: [bystander, used(items.drink)],
            snap: [bystander, broke(items.snap)],
            npc: [nobody, broke(items.npc)]
        };
        const found = Object.fromEntries(Object.entries(cards).map(([key, [actor, text]]) => {
            const card = fight.find(m => String(S.contentOf(m)).includes(text));
            const reader = player(actor);
            const told = !reader || words.some(w => w.id === card?.id && w.to.includes(reader.id));
            return [key, Boolean(card?.getFlag(MODULE_ID, "veiled")) && told];
        }));
        const later = game.messages.contents.find(m => after.some(w => w.id === m.id && w.html.includes(used(items.later))));
        const note = fight.find(m => String(S.contentOf(m)).includes("Suite: a note to the GMs in the fight."));
        const plain = Boolean(later) && !later.getFlag(MODULE_ID, "veiled") && (later.whisper ?? []).includes(player(bystander).id)
            && Boolean(note) && !note.getFlag(MODULE_ID, "veiled");
        equal(stableJson([found, wrong, plain]), stableJson([Object.fromEntries(Object.keys(cards).map(k => [k, true])), [], true]),
            `a card a use in the fight brought was not posted veiled with its words to its player, a message names somebody, or the GMs' note or the card after the fight was veiled (${fight.length} read): ${
                stableJson(words.map(w => ({ id: w.id, to: w.to, text: w.html.replace(/<[^>]+>/g, " ").trim().slice(0, 60) })))}`);
    }],

    ["a veiled card lights the Chat tab only where its words are", async () => {
        /*
         * E06 C6, 27.09.2026; audit S11-30 (not seen at a table). A veiled card is addressed to
         * everybody, so the chat log's notifier was told of it on every client and lit the Chat
         * tab's pip at the moment something secret happened. secret.mjs wraps it: a veiled card
         * this client holds no words for notifies once they arrive and never when none come
         * (four seconds, `wordsOf`'s ceiling). Two veiled cards, one to this GM (words held at
         * once) and one to a player alone (none here); Foundry's notifier is swapped for a
         * recorder behind the wrapper. Which method lights the pip in Foundry v14 is LIVE-E06-04:
         * where the chat log's class has no `notify`, nothing is installed, and the patch table
         * says so - which is all this measures there.
         */
        needs(world.atLeast("playerAccounts", 1), "a player a veiled card can be meant for, past the GM");
        const S = await import("./secret.mjs");
        const { PATCHES } = await import("./patches.mjs");
        const probe = PATCHES.find(row => row.file === "secret.mjs")?.probe?.() ?? null;
        must(probe, "the patch table has no row for the chat log's notifier");
        const notify = S.chatLogClass()?.prototype?.notify;
        if (!probe.present) {
            equal(stableJson([probe.ours, typeof notify]), stableJson([false, "undefined"]), "a notifier that is not there was wrapped anyway");
            return;
        }
        const player = game.users.find(u => !u.isGM);
        const theirs = await S.postSecret({ content: "<p>a veiled card for a player</p>", whisper: [player.id], veiled: true });
        const ours = await S.postSecret({ content: "<p>a veiled card for this GM</p>", whisper: [game.user.id], veiled: true });
        must(theirs && ours, "a veiled card was not posted");
        // The chat log's own call as each card was created (the harness's since E06 fix r1-G2) is
        // over before the recorder goes in, so only the two calls below reach it.
        await settle();
        const told = [];
        const original = notify.wrapped;
        notify.wrapped = function (message) { told.push(message?.id ?? null); };
        let atOnce, lights;
        try {
            lights = [S.lightsChatPip(theirs), S.lightsChatPip(ours)];
            ui.chat.notify(theirs);
            ui.chat.notify(ours);
            atOnce = [...told];
            await wait(4300);
        } finally {
            notify.wrapped = original;
            await theirs.delete();
            await ours.delete();
        }
        equal(stableJson([probe.ours, ...lights, atOnce, told]),
            stableJson([true, false, true, [ours.id], [ours.id]]),
            "the notifier is not wrapped, or a veiled card with no words here reached Foundry's notifier, or one with words did not");
    }],

    ["two killers act back to back, not alternating with the victim", async () => {
        const [killer, victim, third] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.thirdPartyEnters(third);
        await settle();
        await drpg.resolveCrisisAction({
            actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true
        });
        await settle();

        equal(murder.killerIds().length, 2, "the accomplice joined the killers");
        equal(murder.murderState().turnSide, "victim", "the accomplice joining does not steal the victim's turn");
        const startTurn = murder.murderState().turn;

        // The victim's turn always passes to the FIRST killer - not to
        // whichever of them the rotation happened to leave off on last round.
        await drpg.passTurn();
        await settle();
        let state = murder.murderState();
        equal(state.turnSide, "killer", "the victim's turn passes to a killer");
        equal(state.killerTurnId, killer.id, "the round opens on the first killer");
        let who = [killer, third].filter(a => murder.isTheirTurn(a));
        equal(who.length, 1, "exactly one killer may act on this turn");
        equal(who[0].id, killer.id, "the first killer's turn belongs to the first killer");

        // The bug this guards: the old rule alternated `turnSide` on every
        // pass, so a second killer's turn was really victim, killer(A),
        // victim, killer(B) - the victim got a breather neither killer earned,
        // and the round advanced twice for one lap of the killers. The second
        // killer's turn must follow the first DIRECTLY, with the round number
        // unmoved.
        await drpg.passTurn();
        await settle();
        state = murder.murderState();
        equal(state.turnSide, "killer", "the second killer's turn follows the first directly, not the victim's");
        equal(state.killerTurnId, third.id, "turn hands to the second killer");
        equal(state.turn, startTurn, "the round has not advanced - the killers' side is not done yet");
        who = [killer, third].filter(a => murder.isTheirTurn(a));
        equal(who.length, 1, "exactly one killer may act on this turn");
        equal(who[0].id, third.id, "the second killer's turn belongs to the second killer");

        // Only once every killer has gone does the turn return to the victim,
        // and only then does the round advance.
        await drpg.passTurn();
        await settle();
        state = murder.murderState();
        equal(state.turnSide, "victim", "the victim's turn returns only after every killer has gone");
        equal(state.turn, startTurn + 1, "the round advances exactly once, after the last killer");

        // And the next round opens the same way: first killer first, not a
        // continuation of the rotation.
        await drpg.passTurn();
        await settle();
        equal(murder.murderState().killerTurnId, killer.id, "the next round opens on the first killer again");
    }],

    ["Pin hinders two victim turns, and a critical Pin blocks two", async () => {
        /* E32+E07 C9, 28.09.2026; audit S04-16. Pin them down promises "two turns of
           disadvantage" on Leave a clue and Survive; its counter dropped at the top of each round,
           so the victim's second turn was free - [true, false, false] at C8's tree, a critical's
           `blocked` the same. Each read is the victim's own turn; the victim's reserves are
           cleared before each lap so the drain cannot run them out between reads. The killer
           and the victim are connected players', as the grid picks them (E05 handoff: an
           unowned killer's opening raced the GM's answer). */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer whose player is asked the opening roll, and a victim");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const calm = () => victim.update({ "system.resources.stress.value": 0, "system.resources.hitPoints.value": 0 });
        const clue = () => M.availableCrisisActions(victim).find(a => a.key === "leaveClue") ?? {};
        const lap = async () => { await calm(); await M.passTurn(); await M.passTurn(); await settle(); };
        await calm();
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident", "the fight did not start");
        const read = [];
        for (const isCritical of [false, true]) {
            if (!M.isTheirTurn(killer)) await M.passTurn();
            await M.resolveCrisisAction({ actorId: killer.id, key: "pin", total: 20, isCritical, withHope: true });
            await settle();
            must(M.isTheirTurn(victim), "the Pin did not hand the turn to the victim");
            const store = isCritical ? "blocked" : "hindered";
            for (let turn = 0; turn < 3; turn++) {
                if (turn) await lap();
                read.push(Boolean(clue()[store]));
            }
        }
        equal(JSON.stringify(read), JSON.stringify([true, true, false, true, true, false]),
            "Pin did not hinder the victim's next two turns and no third, or a critical Pin did not block them so");
    }],

    ["advantage on the next attempt goes to the same action only", async () => {
        /* E32+E07 C9, 28.09.2026; audit S04-32. A Leave a clue missed with Hope earned
           "advantage on the next attempt", written as a flag per side and spent by the side's next
           action, whatever it was. It names the action now: another action is not helped and does
           not spend it, and the next Leave a clue is and does. Read through `crisisSituational`,
           the dice the roll arms, against the same action's before the miss. */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a killer whose player is asked the opening roll, and a victim");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [killer, victim] = livingStudents().filter(player);
        const toVictim = async () => { for (let i = 0; i < 3 && !M.isTheirTurn(victim); i++) await M.passTurn(); };
        await M.openMurder({ killerId: killer.id, victimId: victim.id });
        if (M.murderState()?.stage === "openingRoll") await M.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        must(M.murderState()?.stage === "incident", "the fight did not start");
        const base = { clue: M.crisisSituational(victim, "leaveClue"), trace: M.crisisSituational(victim, "secureTrace") };
        await M.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: true });
        await settle();
        await toVictim();
        const earned = M.murderState()?.advantageNext?.victim ?? null;
        const helps = { clue: M.crisisSituational(victim, "leaveClue") - base.clue, trace: M.crisisSituational(victim, "secureTrace") - base.trace };
        await M.resolveCrisisAction({ actorId: victim.id, key: "secureTrace", total: 2, isCritical: false, withHope: false });
        await settle();
        const kept = M.murderState()?.advantageNext?.victim ?? null;
        await toVictim();
        await M.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 20, isCritical: false, withHope: true });
        await settle();
        equal(JSON.stringify([earned, helps, kept, M.murderState()?.advantageNext?.victim ?? null]),
            JSON.stringify(["leaveClue", { clue: 1, trace: 0 }, "leaveClue", null]),
            "the second try is not Leave a clue's, helps another action, is spent by it, or outlives the clue's next attempt");
    }],

    ["a trap's victim acts again without a Pass", async () => {
        /* E32+E07 C9, 28.09.2026; audit S04-14. A trap's builder is not in the room and holds no
           seat, so the killers' side can never act; every victim's action handed the turn to it
           and the fight stood until a GM pressed Pass, the drain with it. The victim's action now
           passes the turn to the victim: the round turns, the trap's drain (2) lands, and the
           victim may act. At C8's tree: ["killer", 0, false, "not their turn", 0]. */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a builder, and a victim whose player is asked the opening roll");
        const M = await import("./murder.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const { INCIDENT } = await import("./config.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [builder, victim] = livingStudents().filter(player);
        await victim.update({ "system.resources.stress.value": 0, "system.resources.hitPoints.value": 0 });
        await M.openMurder({ killerId: builder.id, victimId: victim.id, indirect: true });
        // The victim's player is asked the roll too; whichever lands first, a miss starts the incident.
        if (M.murderState()?.stage === "openingRoll") await M.resolveVictimOpening({ total: 1, isCritical: false, withHope: false });
        await settle();
        must(M.murderState()?.stage === "incident" && M.isTheirTurn(victim), "the trap did not spring on the victim's turn");
        const turn = M.murderState().turn;
        const stress = victim.system.resources.stress.value;
        await M.resolveCrisisAction({ actorId: victim.id, key: "leaveClue", total: 20, isCritical: false, withHope: true });
        await settle();
        const now = M.murderState();
        equal(JSON.stringify([now?.turnSide, now?.turn - turn, M.isTheirTurn(victim), M.crisisRefusal(victim, "secureTrace")?.why ?? null,
            victim.system.resources.stress.value - stress]),
        JSON.stringify(["victim", 1, true, null, INCIDENT.drain.indirect]),
        "after the victim's action a trap's turn is not the victim's again, the round did not turn, or the drain did not land");
    }],

    ["a Finishing Blow leaves the victim unflagged, dead to the GMs, until the discovery publishes it", async () => {
        /* E05 C10, 26.09.2026; audit S06-11. The blow used to write the flag, the "dead" status
           and the Truth Bullets' deletion at once, which every console reads; the victim is a
           row of the GMs' store until the body is found (runDiscovery, measured end to end by
           72-canary) or a GM makes it known - both through `publishDeath`, driven here. */
        const [killer, victim] = cast(2);
        const drpg = game.drpg;
        const { isDeceased, isDeadForGm, deathRecordFor, publishDeath } = await import("./chapter.mjs");
        const { deathStore } = await import("./gm-stores.mjs");
        const { createTruthBullet, bulletsOf } = await import("./truth-bullets.mjs");

        await createTruthBullet(victim, { name: "SUITE C10 a hunch", playerText: "SUITE C10" });
        const bullets = bulletsOf(victim).length;
        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await drpg.passTurn();
        await settle();

        ok(!isDeadForGm(victim), "the victim started the test dead");
        await drpg.resolveCrisisAction({
            actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true
        });
        await wait(1600);

        equal(drpg.murderState()?.stage, "resolution", "stage after the blow");
        equal(JSON.stringify([isDeceased(victim), victim.statuses?.has?.("dead") ?? false, bulletsOf(victim).length >= bullets]),
            JSON.stringify([false, false, true]), "the blow wrote the flag, the marker or the bullets' deletion, which every console reads");
        ok(isDeadForGm(victim) && deathStore.has(victim.id), "the victim is not dead to the GMs");
        const when = deathRecordFor(victim);

        const record = await publishDeath(victim);
        equal(JSON.stringify([isDeceased(victim), victim.statuses?.has?.("dead") ?? false, bulletsOf(victim).length, deathStore.has(victim.id)]),
            JSON.stringify([true, true, 0, false]), "the publication did not write the flag and the marker, take the bullets and drop the row");
        equal(JSON.stringify(record), JSON.stringify(when), "the published record is not the kill's own chapter, day and time of day");
        equal(JSON.stringify(await publishDeath(victim)), JSON.stringify(record), "a second publication is not a no-op");
    }],

    ["a death nobody found stays the GMs' when the trial starts, and the GM's hand makes it known", async () => {
        /* E05 C10; the owner's Q3, 26.09.2026: besides the discovery only a GM publishes a death,
           and until then it counts nowhere. The trial's start tells the GM how many there are
           (`tellUnfoundDeaths`, which clock.mjs runs on the phase's entry) and publishes none;
           the Players window's "dead" (gm-panel.mjs `applyAliveStates`) is the GM's hand. */
        const [victim] = cast(1);
        const { isDeceased, isDeadForGm, killCharacter, tellUnfoundDeaths, livingStudents } = await import("./chapter.mjs");
        const { applyAliveStates } = await import("./gm-panel.mjs");
        ok(await killCharacter(victim, { secret: true }), "the secret death was not recorded");
        equal(tellUnfoundDeaths(), 1, "the trial's start did not count the one death nobody found");
        equal(JSON.stringify([isDeceased(victim), isDeadForGm(victim), livingStudents().some(a => a.id === victim.id)]),
            JSON.stringify([false, true, true]), "the trial's start published the death, or it counts among the dead of the table");
        equal(await applyAliveStates({ [victim.id]: { state: "dead" } }), 1, "the Players window's \"dead\" changed nothing");
        equal(JSON.stringify([isDeceased(victim), tellUnfoundDeaths()]), JSON.stringify([true, 0]),
            "the GM's hand did not make the death known");
    }],

    ["the trial asks only for the killers of deaths the table knows, and a victim nobody has found votes and levels up with the class", async () => {
        /*
         * E05 fix r2-G1, 27.09.2026; review F1 (major) and S2-m6, the owner's Q3 and the plan's rule A.
         * The register takes a killer when the incident closes, found body or not, and the trial read
         * it whole: with one death published and one nobody had found, every ballot asked for two
         * names - which told each player of a second body - a correct verdict executed the hidden
         * killer and a wrong one kept them a Reinforced; and the correct verdict's Level Up took the
         * GMs' list of the living, so the victim nobody had found was the one student every console
         * saw not advance. Driven end to end: this chapter's register emptied, two incidents closed as
         * the engine closes them, the first body published and the second not; the ballots as
         * `openVote` sends them, caught here and never sent; the verdict's own window answered by its
         * buttons, wrong and then right; last, a right verdict that names the hidden victim for
         * execution. Every Level Up window is closed unanswered, which writes nothing.
         * Both killers are players' who are connected: an opening roll with nobody to ask is
         * thrown on the GM's client (murder.mjs `rollOpening`), and with the unowned student as a
         * killer that real roll raced `resolveKillerOpening` - measured 27.09 on the harness, four
         * runs: two incidents closed as "openingFailed" and one roll gave the GM a Fear. So the
         * three are picked from every living student, not from the first four (`cast`), and a
         * world without three such students is a skip.
         */
        needs(world.atLeast("livingStudents", 4), "two incidents, each with a killer and a victim");
        needs(world.atLeast("studentsWithConnectedPlayer", 3), "the two killers and the victim nobody found, each with a connected player");
        const { isDeceased, isDeadForGm, publishDeath, livingStudents } = await import("./chapter.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const living = livingStudents();
        const [knownKiller, hiddenKiller, hiddenVictim] = living.filter(player);
        const knownVictim = living.find(a => ![knownKiller, hiddenKiller, hiddenVictim].includes(a));
        const people = [knownKiller, hiddenKiller, hiddenVictim, knownVictim];
        const drpg = game.drpg;
        const M = await import("./murder.mjs");
        const V = await import("./vote.mjs");
        const { blackenedStore, deathStore, deferredOfferStore } = await import("./gm-stores.mjs");
        const title = a => game.i18n.format("DRPG.Advance.title", { actor: a.name });
        const D = foundry.applications.api.DialogV2;
        const socket = game.socket;
        const ownWait = Object.getOwnPropertyDescriptor(D, "wait");
        const ownEmit = Object.getOwnPropertyDescriptor(socket, "emit");
        const putBack = () => {
            if (ownWait) Object.defineProperty(D, "wait", ownWait); else delete D.wait;
            if (ownEmit) Object.defineProperty(socket, "emit", ownEmit); else delete socket.emit;
        };
        /* The verdict's window answered by the button `action`, over a form whose dropdowns name
           nobody (a wrong verdict then executes nobody); every other window closed. */
        const FORM = { executed: { value: "" }, blackened: { value: "" } };
        const verdict = async action => {
            const seen = { read: null, levelUps: [] };
            D.wait = async cfg => {
                const button = (cfg?.buttons ?? []).find(b => b.action === action);
                if (cfg?.window?.title === game.i18n.localize("DRPG.Vote.verdictTitle") && button) {
                    seen.read = button.callback(new Event("click"), button, { element: { querySelector: () => FORM } });
                    return seen.read;
                }
                if ((cfg?.classes ?? []).includes("drpg-advance")) seen.levelUps.push(cfg?.window?.title ?? "");
                return null;
            };
            try {
                await withVerdictOpen(() => V.openVerdictDialog());
            } finally {
                putBack();
            }
            await settle();
            return seen;
        };
        const kill = async (killer, victim) => {
            await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
            await settle();
            await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            await settle();
            await drpg.passTurn();
            await settle();
            await drpg.resolveCrisisAction({ actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
            await wait(1600);
            equal(drpg.murderState()?.stage, "resolution", `${killer.name}'s incident on ${victim.name} did not reach the resolution`);
            await drpg.endMurder({ followUp: false });
            await settle();
            ok(deathStore.has(victim.id) && !isDeceased(victim), `${victim.name}'s death was not kept by the GMs until found`);
        };

        try {
            await blackenedStore.dropMany(M.blackenedIds());
            await deferredOfferStore.dropMany(people.map(a => a.id).filter(id => deferredOfferStore.has(id)));
            await kill(knownKiller, knownVictim);
            ok(await publishDeath(knownVictim), "the first body's death was not made the table's");
            await kill(hiddenKiller, hiddenVictim);
            equal(stableJson(M.blackenedIds()), stableJson([knownKiller.id, hiddenKiller.id]),
                "the register does not hold both killers in the order they killed - the rule of two witnesses reads it whole");

            const ballots = [];
            const send = socket.emit;
            socket.emit = function (event, packet, options, ...rest) {
                if (packet?.action === "vote.open") {
                    ballots.push({ picks: packet.picks, candidates: packet.candidates ?? [], to: options?.recipients ?? [] });
                    return true;
                }
                return send.call(this, event, packet, options, ...rest);
            };
            try {
                await V.openVote();
            } finally {
                putBack();
                await V.closeVote();
            }
            ok(ballots.length > 0, "the vote sent no ballot");
            const marked = id => ballots.flatMap(b => b.candidates).find(c => c.id === id)?.dead ?? null;
            equal(stableJson([[...new Set(ballots.map(b => b.picks))], marked(knownVictim.id), marked(hiddenVictim.id),
                ballots.some(b => b.to.includes(player(hiddenVictim).id))]), stableJson([[1], true, false, true]),
                "the ballots do not ask for the one Blackened of a death the table knows (picks), or do not mark the found body dead and "
                + "leave the one nobody found unmarked, or the victim nobody found holds no ballot");

            const wrong = await verdict("wrong");
            equal(stableJson([wrong.read?.blackenedIds ?? null, deferredOfferStore.has(knownKiller.id), deferredOfferStore.has(hiddenKiller.id)]),
                stableJson([[knownKiller.id], true, false]),
                "a wrong verdict does not name only the Blackened of the death the table knows, or keeps a Reinforced for the other killer, or none for them");
            await deferredOfferStore.dropMany([knownKiller.id, hiddenKiller.id].filter(id => deferredOfferStore.has(id)));

            const right = await verdict("correct");
            equal(stableJson([right.read?.executedIds ?? null, isDeceased(knownKiller), isDeadForGm(hiddenKiller), deathStore.has(hiddenVictim.id), isDeceased(hiddenVictim)]),
                stableJson([[knownKiller.id], true, false, true, false]),
                "a correct verdict does not execute only the Blackened of the death the table knows, or killed the other killer, or made the hidden death known");
            equal(stableJson([title(hiddenVictim), title(hiddenKiller), title(knownKiller)].map(t => right.levelUps.includes(t))),
                stableJson([true, true, false]),
                "the correct verdict's Level Up passes over the victim nobody has found or their killer, or offers one to the executed");

            const named = await withVerdictOpen(() => withAdvanceWindows(() => null,
                () => V.applyVerdict({ correct: true, executedIds: [hiddenVictim.id], blackenedIds: [hiddenVictim.id] })));
            equal(stableJson([named.some(e => e.title === title(hiddenVictim)), named.some(e => e.title === title(hiddenKiller)), deathStore.has(hiddenVictim.id)]),
                stableJson([false, true, true]),
                "a verdict that names a victim nobody has found for execution offers them a Level Up, or offers the class none, or publishes the death");
        } finally {
            putBack();
            await deferredOfferStore.dropMany(people.map(a => a.id).filter(id => deferredOfferStore.has(id)));
        }
    }],

    ["a killer of the chapter's other incident who walks alone onto a body nobody has found is its lone finder", async () => {
        /*
         * E05 fix r2-G1, 27.09.2026; review F10, the owner's Q1. The lone finder is a student in no
         * part of that death; the watcher closed the branch to every Blackened of the chapter
         * (`blackenedIds`, all of its incidents), so a killer of the first incident who walked alone
         * onto the second's body was told nothing. Who knows is the row's to say (`knowsOfDeath` in
         * `tellLoneFinder`); the chapter's killers stay "involved" for the rule of two witnesses.
         * The two are stood alone in a room while both live, the death is kept by the GMs after,
         * and the watcher (chapter.mjs `maybeBodyFound`) is asked about the finder's token.
         */
        const [finder, victim] = cast(2);
        needs(world.ownedByPlayer(finder), "a lone finder is told through their player");
        const S = await import("./gm-stores.mjs");
        const C = await import("./chapter.mjs");
        const M = await import("./murder.mjs");
        const { bodyDiscovery } = await import("./settings.mjs");
        const user = game.users.find(u => !u.isGM && u.active && finder.testUserPermission(u, "OWNER"))
            ?? game.users.find(u => !u.isGM && finder.testUserPermission(u, "OWNER"));
        const stood = await aloneTogether(finder, victim);
        try {
            await S.blackenedStore.patch(finder.id, { chapter: getClock()?.chapter ?? null, epoch: seasonEpoch(), at: 1 });
            ok(M.blackenedIds().includes(finder.id), "the fixture could not make the finder a Blackened of this chapter");
            ok(await C.killCharacter(victim, { secret: true, keepBullets: true }), "the death was not kept by the GMs");
            const known = () => S.deathStore.get(victim.id)?.known ?? [];
            ok(!known().includes(user.id), "the finder's player knew of the death before walking in");
            await C.maybeBodyFound(canvas.scene.tokens.find(t => t.actorId === finder.id));
            await settle();
            equal(stableJson([known().includes(user.id), bodyDiscovery()?.room ?? null, C.isDeceased(victim)]), stableJson([true, null, false]),
                `a Blackened of the chapter alone with a body nobody found was not told of it as its lone finder, or it was announced (phase ${getClock()?.phase})`);
        } finally {
            await C.reviveCharacter(victim, { quiet: true });
            await stood.back();
        }
    }],

    ["a killer whose only victim was revived is not asked for at the trial", async () => {
        /*
         * E05 fix r2-G3, 27.09.2026; fix r2-G1's note. A register row names its victims, and the
         * trial left out a killer only while each of them was a row of the deaths store - so a
         * victim revived (the GM's undo of a death, which drops the row: the plan's section 2)
         * left their killer counted at the trial, asked for on every ballot. The trial counts a
         * killer for a death the table knows now (murder.mjs `untoldDeath`). A row naming one
         * victim, published and then revived; the register keeps the row for the rule of two
         * witnesses. Red on 8c6dfd6's runtime: the killer was still counted after the revival.
         */
        const M = await import("./murder.mjs");
        const C = await import("./chapter.mjs");
        const { blackenedStore } = await import("./gm-stores.mjs");
        const [killer, victim] = cast(4).filter(a => !blackenedStore.has(a.id));
        ok(killer && victim, "no two living students without a register row");
        try {
            await blackenedStore.patch(killer.id, { chapter: getClock()?.chapter ?? null, epoch: seasonEpoch(), at: 1, victims: [victim.id] });
            const living = M.trialBlackenedIds().includes(killer.id);
            ok(await C.killCharacter(victim, { secret: false, keepBullets: true }), "the fixture death was not recorded");
            const published = M.trialBlackenedIds().includes(killer.id);
            await C.reviveCharacter(victim, { quiet: true });
            const revived = M.trialBlackenedIds().includes(killer.id);
            equal(stableJson([living, published, revived, M.blackenedIds().includes(killer.id)]), stableJson([false, true, false, true]),
                "the trial counted a killer for a living or revived victim, missed one for a published death, or the register lost the row");
        } finally {
            if (C.isDeadForGm(victim)) await C.reviveCharacter(victim, { quiet: true });
            if (blackenedStore.has(killer.id)) await blackenedStore.drop(killer.id);
        }
    }],

    ["a kept death whose row could not be saved is the table's at once", async () => {
        /*
         * E05 fix r2-G3, 27.09.2026; review S2-m8. `recordSecretDeath` asked the store's memory
         * whether the row took, and the engine keeps a write it could not save in memory - so a
         * full origin kept the death in one tab, and a reload without a backup lost it: no row,
         * no flag, the victim alive. The row is read back from storage now (`persisted`), and a
         * death it does not hold is published, as the kill's note promised. The store's save is
         * swallowed here for the one key, as a write that never reached storage; nothing else
         * is written to it meanwhile. Red on 8c6dfd6's runtime: the death stayed a row in memory.
         */
        const [victim] = cast(1);
        const C = await import("./chapter.mjs");
        const { deathStore } = await import("./gm-stores.mjs");
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        let record = null;
        try {
            settings.set = async function (namespace, key, value) {
                if (namespace === MODULE_ID && key === deathStore.spec.key) return value;
                return realSet.call(this, namespace, key, value);
            };
            try {
                record = await C.killCharacter(victim, { secret: true, keepBullets: true });
            } finally {
                if (ownSet) settings.set = realSet;
                else delete settings.set;
            }
            equal(stableJson([Boolean(record), C.isDeceased(victim), deathStore.has(victim.id), deathStore.persisted(victim.id)]),
                stableJson([true, true, false, null]),
                "a kept death whose row never reached storage stayed in memory alone, or was not made the table's");
        } finally {
            if (C.isDeadForGm(victim)) await C.reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a vote counts the Blackened once the stores hold the other GMs' rows", async () => {
        /*
         * E05 fix r2-G2, 27.09.2026; fix r2-G1's note. `openVote` counted the register and the
         * deaths the moment it was asked, whether or not the GM stores held the other GMs' rows yet:
         * a vote opened moments after a load counted from this browser's rows alone. Both stores'
         * hydration is held here; the vote is opened and no ballot goes out while held; a killer
         * another GM recorded arrives (written into this client's register), the hold ends, and
         * every ballot asks for one name more than it would have. The ballots are caught and never
         * sent; the two rows are dropped after. Red on 1072bbb's runtime: the ballots went out at
         * once, asking for one name where the register came to hold two.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 1), "a player with a ballot");
        needs(world.atLeast("livingStudents", 4), "two killers to record beside the two a chapter may hold");
        const M = await import("./murder.mjs");
        const V = await import("./vote.mjs");
        const { blackenedStore, deathStore } = await import("./gm-stores.mjs");
        const [first, second] = cast(4).filter(a => !blackenedStore.has(a.id));
        ok(Boolean(second), "fewer than two of four living students are out of the register - this measures nothing");
        const row = at => ({ chapter: getClock()?.chapter ?? null, epoch: seasonEpoch(), at: Date.now() + at, victims: [] });
        const before = M.trialBlackenedIds().length;
        const socket = game.socket;
        const ownEmit = Object.getOwnPropertyDescriptor(socket, "emit");
        const real = [[blackenedStore, blackenedStore.whenHydrated], [deathStore, deathStore.whenHydrated]];
        const gates = [];
        const picks = [];
        try {
            await blackenedStore.patch(first.id, row(0));
            const send = socket.emit;
            socket.emit = function (event, packet, options, ...rest) {
                if (packet?.action === "vote.open") {
                    picks.push(packet.picks);
                    return true;
                }
                return send.call(this, event, packet, options, ...rest);
            };
            for (const [store] of real) {
                const gate = {};
                gate.promise = new Promise(resolve => { gate.open = () => resolve("answered"); });
                store.whenHydrated = () => gate.promise;
                gates.push(gate);
            }
            let opened = "waiting";
            const opening = V.openVote().then(n => { opened = n; });
            await settle();
            const early = [opened, picks.length];
            await blackenedStore.patch(second.id, row(1));
            for (const gate of gates) gate.open();
            await opening;
            equal(stableJson(early), stableJson(["waiting", 0]), "the vote went out before the stores held the other GMs' rows");
            ok(picks.length > 0, "the vote sent no ballot");
            equal(stableJson([...new Set(picks)]), stableJson([Math.max(1, before + 2)]),
                "the ballots do not count the killer another GM recorded while the vote waited for its rows");
        } finally {
            for (const [store, whenHydrated] of real) store.whenHydrated = whenHydrated;
            if (ownEmit) Object.defineProperty(socket, "emit", ownEmit); else delete socket.emit;
            await V.closeVote();
            await blackenedStore.dropMany([first?.id, second?.id].filter(Boolean));
            await settle();
        }
    }],

    ["revive drops a pending death, and writes nothing on the living student", async () => {
        /* E05 C10. A death kept by the GMs is a row and nothing on the actor, so taking it back
           is a stamped drop - an unset flag on a student nobody saw die would tell every console
           that something about a death moved. */
        const [victim] = cast(1);
        const { isDeadForGm, killCharacter, reviveCharacter } = await import("./chapter.mjs");
        const { deathStore } = await import("./gm-stores.mjs");
        ok(await killCharacter(victim, { secret: true, keepBullets: true }), "the secret death was not recorded");
        let writes = 0;
        const hook = Hooks.on("updateActor", a => { if (a.id === victim.id) writes++; });
        try {
            ok(await reviveCharacter(victim, { quiet: true }), "the revival failed");
            await settle();
        } finally {
            Hooks.off("updateActor", hook);
        }
        equal(JSON.stringify([isDeadForGm(victim), deathStore.has(victim.id), deathStore.tombstone(victim.id) > 0, writes]),
            JSON.stringify([false, false, true, 0]), "the revival left the row, dropped it unstamped, or wrote on the actor");
    }],

    ["a Call armed on a body nobody has found is refused as cannot now, naming nobody", async () => {
        /* E05 C10, 26.09.2026; rule D. A player's browser offers the living it knows of, and a body
           nobody has found is one of those; the GM's arm refuses it in words that name nobody
           (bridge-guards.mjs `guardArmLiving`), passes the living, and leaves a GM's own road alone. */
        const [victim] = cast(1);
        const { killCharacter, reviveCharacter } = await import("./chapter.mjs");
        const { guardArmLiving, reasonOf } = await import("./bridge-guards.mjs");
        const player = { isGM: false, id: "SUITEE05PLAYER01" };
        equal(await guardArmLiving(player, { actorId: victim.id }), null, "a Call on a living student was refused");
        ok(await killCharacter(victim, { secret: true, keepBullets: true }), "the secret death was not recorded");
        try {
            const why = await guardArmLiving(player, { actorId: victim.id });
            equal(JSON.stringify([why, reasonOf(why ?? ""), await guardArmLiving({ isGM: true }, { actorId: victim.id })]),
                JSON.stringify(["that cannot be done now", "cannotNow", null]),
                "a Call on a body nobody has found was not refused as cannot now, or a GM's own road was");
        } finally {
            await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["a wrong verdict writes nothing on a surviving Blackened, and keeps their Level Up for the class", async () => {
        /* E05 C11, 27.09.2026; D4; audit S03-01, S06-01. The wrong verdict applied the surviving
           Blackened's Reinforced Level Up at once: new maxima and `advances` on the actor and a
           card spoken by it with the Level Up's sound, which every console receives. It writes a
           row of the GMs' `deferredOffers` store now, tells the owner on a veiled card, and opens
           no Level Up window. 72-canary measures the same on a bystander's browser. */
        const [killer] = cast(1);
        const { applyVerdict } = await import("./vote.mjs");
        const { deferredOfferStore } = await import("./gm-stores.mjs");
        // A private card's sound is in its words' meta since E06 C7a; the GM, a reader, holds it.
        const { cardFlag } = await import("./secret.mjs");
        const hpMax = killer.system?.resources?.hitPoints?.max ?? null;
        const advances = killer.getFlag(MODULE_ID, FLAGS.advances) ?? 0;
        const from = new Set(game.messages.map(m => m.id));
        let writes = 0;
        const hook = Hooks.on("updateActor", a => { if (a.id === killer.id) writes++; });
        let asked;
        try {
            asked = await withVerdictOpen(() => withAdvanceWindows(() => null,
                () => applyVerdict({ correct: false, executedIds: [], blackenedIds: [killer.id] })));
            await settle();
            const cards = game.messages.filter(m => !from.has(m.id));
            equal(stableJson([writes, killer.system?.resources?.hitPoints?.max ?? null, killer.getFlag(MODULE_ID, FLAGS.advances) ?? 0]),
                stableJson([0, hpMax, advances]), "the wrong verdict wrote on the surviving Blackened (writes, maximum Health, advances)");
            equal(stableJson(cards.filter(m => m.speaker?.actor === killer.id || cardFlag(m, "sfx") === "levelUp").length), "0",
                "a card of the wrong verdict is spoken by the Blackened or carries the Level Up's sound");
            ok(cards.some(m => m.getFlag(MODULE_ID, "veiled") === true), "the Blackened's owner was not told on a veiled card");
            ok(!asked.some(e => e.classes.includes("drpg-advance")), "a Level Up window opened at a wrong verdict");
            const row = deferredOfferStore.get(killer.id);
            equal(stableJson([row?.kind ?? null, row?.count ?? null, row?.chapter ?? null]), stableJson(["reinforced", 1, getClock().chapter]),
                "the Blackened's Reinforced Level Up is not waiting in the GMs' store, once, with the verdict's chapter");
        } finally {
            Hooks.off("updateActor", hook);
            await deferredOfferStore.drop(killer.id);
        }
    }],

    ["the next correct verdict applies a waiting Reinforced with its owner's Standard in one write, and a kill drops one", async () => {
        /* E05 C11, 27.09.2026; D4, the owner's Q7. The batch opens one window per survivor, in
           turn: the holder of a waiting Reinforced picks 1 + 3 in it and is written once, one
           step of `advances`; another survivor picks 1. A kill drops the dead's row (the
           design's 2.3 step 5). The windows are answered for these two only - every other
           living student's is closed, which writes nothing - and all four picks are "+1 max
           Health", so the rise is the count. Put back by hand: the snapshot records no maximum. */
        const [holder, other, dead] = cast(3);
        const { applyVerdict } = await import("./vote.mjs");
        const { deferredOfferStore } = await import("./gm-stores.mjs");
        // A private card's sound is in its words' meta since E06 C7a; the GM, a reader, holds it.
        const { cardFlag } = await import("./secret.mjs");
        const { killCharacter, reviveCharacter } = await import("./chapter.mjs");
        const { deferAdvancement } = await import("./level-up.mjs");
        const { automatedUpdate } = await import("./resource-guard.mjs");
        const pair = [holder, other];
        const before = new Map(pair.map(a => [a.id, { max: a.system?.resources?.hitPoints?.max ?? 0, advances: a.getFlag(MODULE_ID, FLAGS.advances) ?? 0 }]));
        const titles = new Map(pair.map(a => [game.i18n.format("DRPG.Advance.title", { actor: a.name }), a.id]));
        const writes = new Map();
        const hook = Hooks.on("updateActor", a => { if (before.has(a.id)) writes.set(a.id, (writes.get(a.id) ?? 0) + 1); });
        try {
            ok(await deferAdvancement(holder, "reinforced", getClock().chapter), "the holder's Reinforced was not kept for the class");
            ok(await deferAdvancement(dead, "reinforced", getClock().chapter), "the second Reinforced was not kept for the class");
            ok(await killCharacter(dead, { secret: false, keepBullets: true }), "the death was not recorded");
            equal(stableJson([deferredOfferStore.has(dead.id), deferredOfferStore.has(holder.id)]), stableJson([false, true]),
                "the kill did not drop the dead's waiting Level Up, or dropped another's");
            writes.clear();
            const from = new Set(game.messages.map(m => m.id));

            const asked = await withVerdictOpen(() => withAdvanceWindows(
                entry => (titles.has(entry.title) ? Array.from({ length: entry.picks }, () => ({ option: "hp" })) : null),
                () => applyVerdict({ correct: true, executedIds: [], blackenedIds: [] })));
            await settle();
            const picked = id => asked.filter(e => titles.get(e.title) === id).map(e => e.picks);
            equal(stableJson([picked(holder.id), picked(other.id)]), stableJson([[4], [1]]),
                "the holder did not pick the Standard and the waiting Reinforced in one window of 1 + 3, or another survivor did not pick 1");
            const now = a => [(a.system?.resources?.hitPoints?.max ?? 0) - before.get(a.id).max,
                (a.getFlag(MODULE_ID, FLAGS.advances) ?? 0) - before.get(a.id).advances, writes.get(a.id) ?? 0];
            equal(stableJson([now(holder), now(other)]), stableJson([[4, 1, 1], [1, 1, 1]]),
                "a survivor's Level Up is not its picks in one write and one step of advances (rise, advances, writes)");
            ok(!deferredOfferStore.has(holder.id), "the Reinforced that was applied still waits");
            const cards = game.messages.filter(m => !from.has(m.id));
            equal(stableJson(cards.filter(m => before.has(m.speaker?.actor) || cardFlag(m, "sfx") === "levelUp").length), "0",
                "a Level Up's card is spoken by its owner or carries its sound, which every console receives");
            ok(cards.filter(m => m.getFlag(MODULE_ID, "veiled") === true).length >= 2, "the two Level Ups were not told on veiled cards");
        } finally {
            Hooks.off("updateActor", hook);
            for (const a of pair) {
                await automatedUpdate(a, { "system.resources.hitPoints.max": before.get(a.id).max,
                    [`flags.${MODULE_ID}.${FLAGS.advances}`]: before.get(a.id).advances });
            }
            await deferredOfferStore.dropMany([holder.id, dead.id].filter(id => deferredOfferStore.has(id)));
            await reviveCharacter(dead, { quiet: true });
        }
    }],

    ["openMurder refuses during an Eclipse, but not once one has actually ended", async () => {
        // `judgePendingMurders` (eclipse.mjs) is the one legitimate call to
        // `openMurder` that happens WHILE an Eclipse is closing - a Direct
        // Murder declared in the dark is parked, not opened, and only judged
        // from inside `endEclipse`, after the clock has already cleared the
        // Eclipse flag. This pins both halves of that: the new guard actually
        // refuses while the flag is set, and the flag really is gone by the
        // time `endEclipse` would call `openMurder` for a parked declaration -
        // so the guard added for this bug fix cannot silently swallow the one
        // call it is supposed to let through.
        const [killer, victim] = cast(2);
        const murder = await import("./murder.mjs");
        const eclipse = await import("./eclipse.mjs");

        await eclipse.startEclipse();
        await settle();
        ok(eclipse.isEclipse(), "the Eclipse did not start");

        const blocked = await murder.openMurder({ killerId: killer.id, victimId: victim.id });
        equal(blocked, null, "openMurder opened an incident while the Eclipse was still running");
        equal(murder.murderState(), null, "an incident exists despite the Eclipse lock");

        await eclipse.endEclipse({ advance: false });
        await settle();
        ok(!eclipse.isEclipse(), "ending the Eclipse did not clear the flag");

        const opened = await murder.openMurder({ killerId: killer.id, victimId: victim.id });
        ok(opened, "openMurder still refuses once the Eclipse has actually ended");
        equal(murder.murderState()?.killerId, killer.id, "the incident that opened has the wrong killer");
    }],

    ["a declaration made in the dark lives only on the GMs and is judged at the lights", async () => {
        /*
         * E05 C3, 26.09.2026; audit S10-01, S01-02, S11-02. A Direct Murder declared during an
         * Eclipse was the world setting pendingMurders, which every browser holds, for the whole
         * Eclipse: the killer, the room and the plan. The GM's ask was a card in the killer's
         * messenger thread, whose document names the thread, and the ruling spoke as the killer to
         * the killer's player. Driven through the game's own calls: the Eclipse opens; the
         * declaration is parked; the world's old key holds nothing, and the GMs' store holds it,
         * named for this Eclipse; the ask is one card in the GMs' log, no thread's; the GM allows
         * it, and the killer's card of the ruling is veiled; the killer and the victim stand alone
         * in a room, and the lights open the incident between them and leave no row behind.
         */
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const murder = await import("./murder.mjs");
        const { contentOf, cardFlag } = await import("./secret.mjs");
        const [killer, victim] = cast(2);
        equal(murder.murderState(), null, "an incident was already running when this scenario started");
        const stood = await aloneTogether(killer, victim);
        const NOTE = "SUITE E05 declared in the dark";
        const from = game.messages.size;
        const saying = text => game.messages.contents.slice(from).filter(m => contentOf(m).includes(text));
        try {
            await E.startEclipse();
            await settle();
            const id = E.eclipseId();
            ok(E.isEclipse() && id, `the Eclipse did not open, or has no name (${id})`);
            await E.parkDirectMurder({ killerId: killer.id, room: stood.room, note: NOTE });
            await settle();
            equal(stableJson(getSetting(SETTINGS.legacyPendingMurders) ?? {}), "{}", "the declaration reached the world's old key, which every browser holds");
            const row = S.pendingMurderStore.get(killer.id);
            equal(stableJson([row?.room, row?.note, row?.approved, row?.eclipse]), stableJson([stood.room, NOTE, null, id]),
                "the GMs' store does not hold the declaration, named for this Eclipse");
            const asked = saying(NOTE);
            // `callCard` is the words' meta since E06 C7a: the GM, a reader, holds it.
            ok(asked.length === 1 && cardFlag(asked[0], "callCard") === true && !asked[0].getFlag(MODULE_ID, "thread")
                && asked[0].whisper.every(u => game.users.get(u)?.isGM),
                `the ask is not one card in the GMs' log: ${stableJson(asked.map(m => [m.whisper, m.flags?.[MODULE_ID]?.thread ?? null]))}`);

            equal(await E.ruleOnParkedMurder(killer.id, true), true, "the GM could not allow the declaration");
            const ruled = saying(game.i18n.localize("DRPG.Action.murderApproved"));
            ok(ruled.length === 1 && ruled[0].getFlag(MODULE_ID, "veiled") === true && ruled[0].speaker?.actor !== killer.id,
                "the killer's card of the ruling is not veiled: its document names the killer, or it was not posted");
            equal(S.pendingMurderStore.get(killer.id)?.approved, true, "the ruling did not reach the GMs' store");

            await E.endEclipse({ advance: false });
            await settle();
            const state = murder.murderState();
            equal(stableJson([state?.killerId ?? null, state?.victimId ?? null]), stableJson([killer.id, victim.id]),
                "the lights did not open the allowed declaration between the two who stood alone");
            ok(!S.pendingMurderStore.has(killer.id), "the judged declaration is still in the GMs' store");
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (murder.murderState()) await murder.endMurder({ reason: "test", followUp: false });
            await stood.back();
        }
    }],

    ["a declaration from another Eclipse is dropped, not judged", async () => {
        /*
         * E05 C3, 26.09.2026. Each declaration is named for the Eclipse it was made in, and the
         * lights judge their own Eclipse's: a row of another - that Eclipse ended by a season
         * reset, or handed back by a GM who was away when it ended - is not an attempt at this
         * placement. The same stage as the test above, where the lights open an allowed
         * declaration: the killer and the victim alone in a room, the row allowed - but named for
         * another Eclipse. The lights open nothing, and the row is gone.
         */
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const murder = await import("./murder.mjs");
        const [killer, victim] = cast(2);
        equal(murder.murderState(), null, "an incident was already running when this scenario started");
        const stood = await aloneTogether(killer, victim);
        try {
            await S.pendingMurderStore.patch(killer.id, { room: stood.room, note: "SUITE E05 another Eclipse", at: 1, approved: true, eclipse: "SUITE another Eclipse" });
            await E.startEclipse();
            await settle();
            ok(E.isEclipse() && S.pendingMurderStore.has(killer.id), "the Eclipse did not open, or the other Eclipse's row did not stand in the store");
            await E.endEclipse({ advance: false });
            await settle();
            equal(murder.murderState(), null, "the lights judged a declaration made in another Eclipse, and opened an incident");
            ok(!S.pendingMurderStore.has(killer.id), "the other Eclipse's declaration was left in the GMs' store");
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (murder.murderState()) await murder.endMurder({ reason: "test", followUp: false });
            await S.pendingMurderStore.drop(killer.id);
            await stood.back();
        }
    }],

    ["a crossing beyond the allowance is refused on the GM", async () => {
        /*
         * E05 C4, 26.09.2026; audit S10-39, S07-46. The Eclipse's crossings were a world
         * setting every browser held, only the mover's client judged the allowance, and the
         * crossing's card was posted by the mover, speaking as the character. Driven on the GM
         * through the count the bridge runs (`applyRecordedMove`), in an Eclipse leading into
         * noon, which is placed by crossings, not freely: a character crosses as often as the
         * allowance gives, each counted in the GMs' store and named for this Eclipse, the
         * world's old key holding nothing, and each told to its owner by a veiled card this GM
         * posted; one more is refused with the sentence `nothingLeft` stands for, counts
         * nothing and posts nothing.
         */
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const G = await import("./bridge-guards.mjs");
        const [student] = cast(1);
        const clock = getClock();
        try {
            await setClock({ timeOfDay: "morning" });
            await E.startEclipse();
            await settle();
            const id = E.eclipseId(), allowance = E.eclipseAllowance();
            ok(id && Number.isInteger(allowance) && allowance >= 1, `the Eclipse has no name, or no allowance to count against (${id}, ${allowance})`);
            const from = game.messages.size;
            for (let n = 1; n <= allowance; n++) {
                const out = await E.applyRecordedMove(student.id);
                const row = S.eclipseMoveStore.get(student.id);
                equal(stableJson([out?.used, row?.used, row?.eclipse]), stableJson([n, n, id]), `crossing ${n} was not counted in the GMs' store, named for this Eclipse`);
            }
            equal(stableJson(getSetting(SETTINGS.legacyEclipseMoves) ?? {}), "{}", "a crossing reached the world's old key, which every browser holds");
            const cards = game.messages.contents.slice(from);
            ok(cards.length === allowance && cards.every(m => m.getFlag(MODULE_ID, "veiled") === true && m.author?.id === game.user.id && m.speaker?.actor !== student.id),
                `the crossings' cards are not ${allowance} veiled cards this GM posted: ${stableJson(cards.map(m => [m.author?.id ?? null, m.speaker?.actor ?? null, Boolean(m.getFlag(MODULE_ID, "veiled"))]))}`);
            const beyond = await E.applyRecordedMove(student.id);
            equal(G.reasonOf(beyond?.refused), "nothingLeft", `the crossing beyond the allowance was not refused as nothingLeft: ${stableJson(beyond)}`);
            equal(stableJson([S.eclipseMoveStore.get(student.id)?.used, game.messages.size - from]), stableJson([allowance, allowance]),
                "the refused crossing was counted, or posted a card");
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            await S.eclipseMoveStore.drop(student.id);
            await setClock(clock);
            await settle();
        }
    }],

    ["a crossing and a ruling wait for the rows the other GMs hold", async () => {
        /*
         * E05 fix r1-G3, 27.09.2026; review M1. E04 made every primary's answer wait for the
         * store to hold the other GMs' copies; the Eclipse's count and ruling did not: a primary
         * that came back after another GM counted a character's crossings judged the allowance
         * on its own browser's rows and wrote a lower count over the peer's at a newer stamp,
         * and a declaration another GM held read as not waiting. Each store's hydration is held
         * here by replacing its handle's answer (as 61 M holds the bullets'); nothing is counted
         * or ruled while held; the rows another GM holds arrive, the hold ends, and the crossing
         * is refused against the peer's count, the declaration allowed. Red on ced3cad: the
         * crossing was counted at once (1 over the peer's spent allowance), the ruling answered
         * that nothing was waiting.
         */
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        const G = await import("./bridge-guards.mjs");
        const murder = await import("./murder.mjs");
        const [killer, student] = cast(2);
        const clock = getClock();
        const real = [[S.eclipseMoveStore, S.eclipseMoveStore.whenHydrated], [S.pendingMurderStore, S.pendingMurderStore.whenHydrated]];
        const hold = store => {
            const gate = {};
            gate.promise = new Promise(resolve => { gate.open = () => resolve("answered"); });
            store.whenHydrated = () => gate.promise;
            return gate;
        };
        try {
            await setClock({ timeOfDay: "morning" });
            await E.startEclipse();
            await settle();
            const id = E.eclipseId(), allowance = E.eclipseAllowance();
            ok(id && Number.isInteger(allowance) && allowance >= 1, `the Eclipse has no name, or no allowance to count against (${id}, ${allowance})`);
            const from = game.messages.size;

            const moves = hold(S.eclipseMoveStore);
            let counted = "waiting";
            const crossing = E.applyRecordedMove(student.id).then(out => { counted = out; });
            await settle();
            equal(stableJson([counted, S.eclipseMoveStore.get(student.id) ?? null]), stableJson(["waiting", null]),
                "the crossing was counted before the store held the other GMs' rows");
            await S.eclipseMoveStore.patch(student.id, { used: allowance, eclipse: id });
            moves.open();
            await crossing;
            equal(G.reasonOf(counted?.refused), "nothingLeft", `the crossing was not judged against the other GM's count: ${stableJson(counted)}`);
            equal(stableJson([S.eclipseMoveStore.get(student.id)?.used, game.messages.size - from]), stableJson([allowance, 0]),
                "the crossing wrote over the other GM's count, or posted a card");

            const murders = hold(S.pendingMurderStore);
            let ruled = "waiting";
            const ruling = E.ruleOnParkedMurder(killer.id, true).then(out => { ruled = out; });
            await settle();
            equal(ruled, "waiting", "the ruling was made before the store held the other GMs' rows");
            await S.pendingMurderStore.patch(killer.id, { room: null, note: "SUITE r1-G3 declared on another GM", at: Date.now(), approved: null, eclipse: id });
            murders.open();
            await ruling;
            equal(stableJson([ruled, S.pendingMurderStore.get(killer.id)?.approved ?? null]), stableJson([true, true]),
                "a declaration another GM held was not found waiting, or the ruling did not reach the store");
        } finally {
            for (const [store, whenHydrated] of real) store.whenHydrated = whenHydrated;
            await S.pendingMurderStore.drop(killer.id);
            await S.eclipseMoveStore.drop(student.id);
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            if (murder.murderState()) await murder.endMurder({ reason: "test", followUp: false });
            await setClock(clock);
            await settle();
        }
    }],

    ["the owner's copy counts the crossing, and an empty answer takes nothing away", async () => {
        /*
         * E05 C4, 26.09.2026. A player's sheet, status panel and veto read the crossings from a
         * copy of their own characters' rows the primary sends (`sendMovesTo`, with
         * `movesFor`), weighed by the offers' rule (`offersCombine`). On the GM, which runs the
         * owner's receiving half on its own browser's copy: a crossing is counted, and the
         * owner's answer names the character's row with a stamp; taken into the copy it reads
         * the count for this Eclipse; an answer from a GM whose browser holds no row - the same
         * character at stamp 0 - is refused and takes nothing away. And the next Eclipse counts
         * the last one's crossings as nothing, which is why nothing clears them.
         */
        const E = await import("./eclipse.mjs");
        const S = await import("./gm-stores.mjs");
        needs(world.atLeast("playersWithCharacter"), "the copy is the owner's");
        const owner = game.users.find(u => !u.isGM && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER")));
        const student = game.actors.find(a => a.type === "character" && a.testUserPermission(owner, "OWNER"));
        const clock = getClock();
        try {
            await setClock({ timeOfDay: "morning" });
            await E.startEclipse();
            await settle();
            const id = E.eclipseId();
            equal((await E.applyRecordedMove(student.id))?.used, 1, "the crossing was not counted");
            const answer = E.movesFor(owner.id);
            ok(answer.stamps[student.id] > 0 && stableJson(answer.moves[student.id]) === stableJson({ used: 1, eclipse: id }),
                `the owner's answer does not name the counted crossing with a stamp: ${stableJson(answer)}`);
            equal(await E.receiveMoves(answer.moves, answer.stamps), true, "the owner's copy did not take the answer");
            equal(stableJson(S.eclipseMoveCopy.read()?.[student.id]), stableJson({ used: 1, eclipse: id }), "the owner's copy does not read the count");
            equal(await E.receiveMoves({}, { [student.id]: 0 }), false, "an answer from a GM that holds no row was taken");
            equal(S.eclipseMoveCopy.read()?.[student.id]?.used, 1, "an empty answer took the count away");

            await E.endEclipse({ advance: false });
            await E.startEclipse();
            await settle();
            ok(E.eclipseId() !== id && E.movesUsed(student) === 0, `the next Eclipse counts the last one's crossing (${E.movesUsed(student)})`);
        } finally {
            if (E.isEclipse()) await E.endEclipse({ advance: false }).catch(() => {});
            await S.eclipseMoveStore.drop(student.id);
            await setClock(clock);
            await settle();
        }
    }],

    ["the Key Remnant plan lives on the GMs, a chapter at a time", async () => {
        /*
         * E05 C5, 26.09.2026; audit S01-01, S05-02. The plan was the world setting
         * keyRemnantPlan, which every browser holds: each clue's name and text before anybody
         * found it, its analysis before anybody paid for one, the GM's note, and the token that
         * is the Key Remnant. It is the GM store `keyPlan` now, a row per chapter and slot. In a
         * world the stores have never opened (`withGmStoreWorld`), on chapters 1 and 2: each
         * chapter's plan is written through `setKeyPlan` and read through `keyPlan()` on its own
         * chapter only - chapter 2 is blank until written, and chapter 1 is as it was when the
         * clock comes back; every row reads back from storage under `chapter:slot`; the world's
         * old key holds nothing. A save that changes one slot stamps that slot's field and no
         * other slot's, which is how a GM writing another slot keeps theirs; a save from a
         * window drawn before another GM's edit arrived, with what it showed as its `base`,
         * does not take that edit back; a Save that changed nothing still leaves each slot of
         * its chapter a row, by its scale alone (a chapter with rows is a planned one, which
         * the unfound-Key charge asks); a blank where the row holds nothing writes nothing.
         * The clock is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const I = await import("./investigation.mjs");
        const clock = getClock();
        const SLOTS = [0, 1, 2, 3, 4];
        // The clock's chapter's plan, each slot's four words filled in.
        const filled = words => {
            const plan = I.keyPlan();
            plan.entries.forEach((entry, slot) => Object.assign(entry, { name: `${words} name ${slot}`, text: `${words} text ${slot}`,
                analysis: `${words} analysis ${slot}`, note: `${words} note ${slot}` }));
            return plan;
        };
        const words = field => I.keyPlan().entries.map(e => e[field]);
        try {
            await E.withGmStoreWorld(`suite-keyplan-${foundry.utils.randomID(8)}`, async () => {
                await setClock({ chapter: 1 });
                await I.setKeyPlan(filled("SUITE one"));
                await setClock({ chapter: 2 });
                ok(I.keyPlan().chapter === 2 && I.keyPlan().entries.length === 5 && I.keyPlan().entries.every(e => !e.name && !e.text && !e.analysis && !e.note && !e.tokenId),
                    `chapter 2's plan is not five blank slots before anybody wrote it: ${stableJson(I.keyPlan())}`);
                await I.setKeyPlan(filled("SUITE two"));
                equal(stableJson(words("analysis")), stableJson(SLOTS.map(n => `SUITE two analysis ${n}`)), "chapter 2 does not read its own plan");
                await setClock({ chapter: 1 });
                equal(stableJson(words("note")), stableJson(SLOTS.map(n => `SUITE one note ${n}`)), "chapter 1's plan was not kept apart from chapter 2's");
                equal(stableJson([1, 2].flatMap(ch => SLOTS.map(n => S.keyPlanStore.persisted(`${ch}:${n}`)?.text ?? null))),
                    stableJson([...SLOTS.map(n => `SUITE one text ${n}`), ...SLOTS.map(n => `SUITE two text ${n}`)]),
                    "a slot did not read back from the store's storage under its chapter and slot");
                equal(stableJson(getSetting(SETTINGS.legacyKeyRemnantPlan) ?? {}), "{}", "the plan reached the world's old key, which every browser holds");

                const stamps = () => SLOTS.map(n => S.keyPlanStore.stampOf(`1:${n}`, "note"));
                const was = stamps();
                const edited = I.keyPlan();
                edited.entries[3].note = "SUITE one note 3, rewritten";
                await I.setKeyPlan(edited);
                const now = stamps();
                ok(now[3] > was[3] && [0, 1, 2, 4].every(n => now[n] === was[n]) && words("note")[3] === "SUITE one note 3, rewritten",
                    `a save that changed slot 3's note did not stamp that note alone: ${stableJson({ was, now, notes: words("note") })}`);
                const shown = I.keyPlan();
                await S.keyPlanStore.patch("1:1", { note: "SUITE another GM's note" });
                const stale = foundry.utils.deepClone(shown);
                stale.entries[0].name = "SUITE one name 0, renamed";
                await I.setKeyPlan(stale, { base: shown });
                equal(stableJson([words("name")[0], words("note")[1]]), stableJson(["SUITE one name 0, renamed", "SUITE another GM's note"]),
                    "a save from a window drawn before another GM's edit arrived took that edit back, or lost its own");
                await setClock({ chapter: 3 });
                const untouched = I.keyPlan();
                await I.setKeyPlan(untouched, { base: untouched });
                equal(stableJson(SLOTS.map(n => S.keyPlanStore.get(`3:${n}`))), stableJson(untouched.entries.map(e => ({ scale: e.scale }))),
                    "a Save that changed nothing did not leave each slot of its chapter a row holding its scale and nothing else");
                await I.setKeyPlan({ chapter: 4, entries: [{ scale: null, name: "", text: "", analysis: "", note: "", tokenId: null, sceneId: null }] });
                ok(!S.keyPlanStore.has("4:0"), "a blank slot over nothing was written as a row");
            });
        } finally {
            await setClock(clock);
        }
    }],

    ["a season reset that keeps the Key Remnant plan keeps one chapter's rows and not every chapter's", async () => {
        /*
         * E05 fix r1-G5, M3. Rows carry no season stamp - `keyPlanStore`'s own comment in
         * gm-stores.mjs says so - so a reset that kept the plan used to keep every chapter's
         * rows whole: a fresh season's chapter N read as planned (`plannedChapters()`)
         * before anybody opened the planner this season, and `chargeForUnfoundKeys` billed
         * its unfound slots against a plan nobody made here. `keepOnlyKeyPlanChapter` is
         * what `wipeSeason` (season-setup.mjs) calls instead of `clearKeyPlan` when the
         * "keyPlan" group is unticked: the one chapter the clock was on when the reset ran
         * survives, as 1.2.63's single stored plan did, and no other chapter's rows do.
         * Measured directly against the store, not through the reset dialog (S1's DialogV2
         * wait and the typed confirmation word are `season-setup.mjs`'s own, not this
         * function's), the same way the Key Remnant plan test above measures `setKeyPlan`.
         */
        const S = await import("./gm-stores.mjs");
        const I = await import("./investigation.mjs");
        const E = await import("./gm-store.mjs");
        const clock = getClock();
        try {
            await E.withGmStoreWorld(`suite-keyplan-keep-${foundry.utils.randomID(8)}`, async () => {
                for (const chapter of [1, 2, 3]) {
                    await setClock({ chapter });
                    const plan = I.keyPlan();
                    plan.entries[0].name = `SUITE chapter ${chapter} name`;
                    await I.setKeyPlan(plan);
                }
                const before = Object.keys(S.keyPlanStore.entries());
                ok(["1:0", "2:0", "3:0"].every(k => before.includes(k)), `the three chapters' rows were not all written: ${stableJson(before)}`);
                const kept = before.filter(k => k.startsWith("2:")).length;

                const dropped = await I.keepOnlyKeyPlanChapter(2);
                equal(dropped, before.length - kept, `keepOnlyKeyPlanChapter(2) did not drop exactly the other chapters' rows: dropped ${dropped} of ${before.length}, chapter 2 had ${kept}`);
                const after = Object.keys(S.keyPlanStore.entries());
                ok(!after.some(k => !k.startsWith("2:")), `a row of a chapter other than the one kept survived: ${stableJson(after)}`);
                await setClock({ chapter: 2 });
                equal(I.keyPlan().entries[0].name, "SUITE chapter 2 name", "the kept chapter's own row did not survive being the one kept");
            });
        } finally {
            await setClock(clock);
        }
    }],

    ["the Traces tab saves against the trace it was drawn from and not the trace now", async () => {
        /*
         * E05 fix r1-G5, S1-m7 (pre-existing, found by the C5 session). `applyDashboardSave`
         * used to measure a row's changes against `allTraces()` read fresh at Save - the
         * world now, not the world the Traces tab drew - so a rename, an image, a reading
         * or a verdict another GM wrote while this window stood open (a GM store merge
         * redraws no open dashboard) differed from the stale form and was written back over
         * it; and the three verdicts travelled together, so ticking one box sent the other
         * two as the stale form still showed them. Fixed the same way `setKeyPlan`'s `base`
         * fixed the plan: `shown`, the traces the tab was drawn from. `applyDashboardSave` is
         * exported so this can be measured directly - every input it reads is an argument -
         * with `shown` a snapshot taken before another GM's edit and `traces` the fresh read
         * after it, exactly what the dashboard's own Save handler now passes.
         */
        const remnants = await import("./remnants.mjs");
        const I = await import("./investigation.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture trace stands on the scene on screen");
        const scene = canvas.scene;
        let token = null;
        try {
            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", x: 0, y: 0, scene,
                note: "test fixture - S1-m7 stale window"
            });
            ok(token, "could not place the fixture trace");
            await settle();

            const key = `${scene.id}__${token.id}`;
            const shownData = remnants.remnantData(token);
            const shown = [{ token, data: shownData, scene }];

            // Another GM's edit, while this GM's window is still open on the old data.
            await remnants.setRemnantPublic(token, { name: "SUITE another GM's rename" });
            await remnants.setRemnantFlags(token, { tiedToCrime: true });
            await settle();

            const traces = [{ token, data: remnants.remnantData(token), scene }];
            // The stale form: what `shown` showed, with Faint the only box this GM ticked -
            // Tied-to-crime and Reinforced ride along at whatever `shown` had, which is not
            // what the store holds any more.
            const result = {
                keyRows: [],
                traces: [{
                    key, name: shownData.public?.name ?? "", img: shownData.public?.img ?? "",
                    text: shownData.public?.playerText ?? "", analysis: shownData.public?.analyzedText ?? "",
                    type: shownData.type, faint: true, tiedToCrime: shownData.tiedToCrime, reinforced: shownData.reinforced
                }]
            };
            await I.applyDashboardSave(result, { traces, plan: I.keyPlan(), shown });
            await settle();

            const after = remnants.remnantData(token);
            equal(after.public?.name, "SUITE another GM's rename",
                "a stale Traces Save took back another GM's rename it never showed as changed");
            ok(after.tiedToCrime === true,
                "a stale Traces Save took back another GM's tied-to-crime verdict when only Faint was ticked on the form");
            ok(after.faint === true, "a stale Traces Save's own ticked box (Faint) was not written");
        } finally {
            if (token) await token.delete().catch(() => {});
        }
    }],

    ["both killers may clean up, nobody else may", async () => {
        const [killer, victim, third] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");
        const cleanup = await import("./cleanup.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.thirdPartyEnters(third);
        await settle();
        await drpg.resolveCrisisAction({
            actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true
        });
        await settle();
        await murder.beginResolution("test");
        await settle();

        ok(cleanup.isCleaner(killer), "the killer cannot clean up");
        ok(cleanup.isCleaner(third), "the accomplice cannot clean up");
        ok(!cleanup.isCleaner(victim), "the victim was offered the clean-up");
    }],

    ["a killer's own client can see what there is to clean up, and nothing more", async () => {
        // `cleanableRemnants` already answered this correctly for a GM, which is
        // exactly why the bug - `remnantData()` returning null for anybody else
        // - never showed up running this suite as the world's GM. What this
        // scenario actually pins down is the shape `cleanableTracesForPlayer`
        // hands back over the bridge: it is what a player's client receives
        // instead, and it must never carry the answer key.
        const [killer, victim] = cast(2);
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");
        // The bridge is where the player-facing entry point lives; cleanup.mjs
        // only holds the GM-side builder it delegates to. Importing it from
        // cleanup.mjs made this whole scenario throw before its assertions ran.
        const bridge = await import("./gm-bridge.mjs");
        const remnants = await import("./remnants.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.beginResolution("test");
        await settle();

        const dropped = await remnants.dropRemnant(killer, {
            type: "prep", visibility: "evident", note: "test fixture - cleanup bridge"
        });
        ok(dropped, "could not place a trace to clean up");
        await settle();

        const traces = await bridge.requestCleanableTraces(killer.id);
        ok(Array.isArray(traces) && traces.length > 0, "the killer's client sees nothing to clean up");
        ok(traces.some(t => t.id === dropped.id), "the trace just dropped is not in the killer's own list");

        for (const t of traces) {
            ok(typeof t.label === "string" && t.label.length > 0, "a trace reached the killer with no label");
            ok(!("dc" in t), `a trace leaked its DC to the killer's client: ${JSON.stringify(t)}`);
            ok(!("tiedToCrime" in t), `a trace leaked tiedToCrime to the killer's client: ${JSON.stringify(t)}`);
        }
    }],

    ["the roll window opens, locked, and a bare statistic is a reaction", async () => {
        /*
         * THE ONE PLACE THE WINDOW ITSELF IS TESTED.
         *
         * Every other scenario skips it (see `suiteRolling`), so this is what
         * stops "the window opens" from quietly stopping being true - which is
         * exactly how it stopped being true the first time: `maybeRollItself`
         * pressed the button and nothing anywhere noticed for four updates.
         *
         * Rolled OUTSIDE the suite's skip so the real path runs, and closed
         * rather than submitted: this asks what the window IS, not what the
         * dice say.
         */
        const [who] = cast(1);
        // The environment first (E01, audit S14-05): the window is Daggerheart's own,
        // so where Daggerheart's applications are not registered it cannot open, and
        // where they are, a window that does not open is this module's failure.
        needs(env.systemSheets(), "its roll window cannot open");
        game.drpg.suiteRolling = false;
        let app = null;
        try {
            who.rollTrait("instinct", {
                event: { shiftKey: false, altKey: false, ctrlKey: false },
                dialog: { configure: true }
            });
            await wait(1500);

            app = [...foundry.applications.instances.values()]
                .find(w => w.element?.classList?.contains("roll-selection"));
            ok(app, "the roll window did not open for a bare statistic click");

            const root = app.element;
            const chip = root.querySelector('[data-action="toggleReaction"]');
            ok(chip, "the reaction control is gone from the roll window");
            ok(chip.classList.contains("selected"),
                "a bare statistic roll is not marked as a reaction");
            equal(app.config.actionType, "reaction",
                "the roll is not configured as a reaction");

            // And the player cannot take it off.
            chip.click();
            await wait(300);
            equal(app.config.actionType, "reaction",
                "the reaction lock came off when the chip was clicked");

            // The controls the lock owns are still shut.
            const trait = root.querySelector("select[name=trait]");
            ok(!trait || trait.disabled, "the trait picker is unlocked in a student's roll window");
        } finally {
            try { await app?.close(); } catch { /* already gone */ }
            game.drpg.suiteRolling = true;
        }
    }],

    ["a Burst pays for a whole action, exactly once, and comes back if refunded", async () => {
        const [who] = cast(1);
        const actions = await import("./actions.mjs");
        const { grantFreeActions, freeActionsLeft, spendAction, refundAction } = actions;

        // Start from a known place: no actions at all, one Burst banked. That
        // is the state trap 96 is about - a player who cannot pay for anything
        // and has just spent four Hope so that they can.
        await who.update({ "system.resources.actions.value": 0 });
        await who.setFlag(MODULE_ID, "freeActionGrants", 0);
        await grantFreeActions(who, 1);
        await settle();

        equal(freeActionsLeft(who), 1, "the Burst was not banked");
        ok(actions.canPayFor(who, 1), "a banked Burst does not count as being able to pay");
        ok(actions.canPayFor(who, 2), "a Burst has to cover a two-action Long Rest");

        // The whole call, whatever it charged for.
        const paid = await spendAction(who, 2);
        await settle();
        ok(paid, "a Long Rest could not be paid for with a Burst");
        equal(who.system.resources.actions.value, 0, "the Burst let the action budget be touched");
        equal(freeActionsLeft(who), 0, "the Burst was not consumed");

        // And exactly one call: the second spend in the same turn pays normally,
        // which with no actions left means it cannot happen at all (trap 97).
        const again = await spendAction(who, 1);
        await settle();
        ok(!again, "one Burst paid for two separate spends");

        // A refund gives back what was taken, not an action out of thin air
        // (trap 98). The receipt is per spend, so this rebuilds the state.
        await grantFreeActions(who, 1);
        const burst = await spendAction(who, 1);
        await settle();
        await refundAction(who, 1, burst);
        await settle();
        equal(freeActionsLeft(who), 1, "the refund did not give the Burst back");
        equal(who.system.resources.actions.value, 0,
            "the refund turned a Burst into an action out of nowhere");

        // TWO SPENDS OPEN AT ONCE, REFUNDED IN THE OTHER ORDER (review of ACT-07).
        // Paying before the roll leaves a roll window open between a spend and its
        // refund, and the old one-slot bookkeeping gave the first refund whatever
        // the last spend had been.
        await who.update({ "system.resources.actions.value": 1 });
        await settle();
        const first = await spendAction(who, 1);      // the banked Burst pays
        const second = await spendAction(who, 1);     // an action pays
        await settle();
        ok(first?.grant && second && !second.grant, "the two spends were not a Burst and then an action");
        await refundAction(who, 1, first);
        await refundAction(who, 1, second);
        await settle();
        equal(freeActionsLeft(who), 1, "refunding in the other order lost the Burst");
        equal(who.system.resources.actions.value, 1, "refunding in the other order lost the action");

        // And the time of day takes both counters with it.
        await actions.grantFreeMoves(who, 2);
        await actions.resetActionsFor(who);
        await settle();
        equal(freeActionsLeft(who), 0, "a Burst survived the reset");
        equal(actions.freeMovesLeft(who), 0, "a Sprint survived the reset");

        /*
         * UNLESS THE REFILL SAYS OTHERWISE (T-1). One caller refills a budget
         * without ending the time of day, and a Burst bought with four Hope must
         * not expire because the actions came back.
         */
        await actions.grantFreeActions(who, 1);
        await actions.grantFreeMoves(who, 1);
        await actions.resetActionsFor(who, { keepGrants: true });
        await settle();
        equal(freeActionsLeft(who), 1, "keepGrants still took the Burst");
        equal(actions.freeMovesLeft(who), 1, "keepGrants still took the Sprint");
        await actions.resetActionsFor(who);
        await settle();
    }],

    ["a price walks action, then Hope, then Sanity, and then stops", async () => {
        /*
         * T-1's whole rule, in one actor. The chain is walked from the top every
         * time it is asked, so what a player can pay decides what they pay - and
         * when they can pay nothing, the refusal says WHICH kind of nothing it is,
         * because C5 offers a free Present for one of them and not for the other.
         */
        const [who] = cast(1);
        const P = await import("./price.mjs");
        const { grantFreeActions } = await import("./actions.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };
        const sanityMax = who.system.resources.stress.max;

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.hope.value": 2,
                "system.resources.stress.value": 0
            });
            await settle();
            equal(P.quotePrice(who, "objection").pay, "action",
                "an Objection with an action left did not cost the action");

            // No actions, one Burst: still the action step, and the quote says a
            // Burst is what would pay it.
            await who.update({ "system.resources.actions.value": 0 });
            await grantFreeActions(who, 1);
            await settle();
            const burst = P.quotePrice(who, "objection");
            equal(burst.pay, "action", "a banked Burst did not cover the action step");
            ok(burst.grant, "the quote did not say the Burst is what pays");

            // No actions, no Burst, two Hope: the second step.
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await settle();
            const hope = P.quotePrice(who, "objection");
            equal(hope.pay, "hope", "an Objection with no actions did not fall through to Hope");
            equal(hope.held, 2, "the quote did not say how much Hope is held");

            // No actions, no Hope, one point of Sanity left: the last step, and it
            // is the last mark.
            await who.update({
                "system.resources.hope.value": 0,
                "system.resources.stress.value": sanityMax - 1
            });
            await settle();
            const sanity = P.quotePrice(who, "objection");
            equal(sanity.pay, "stress", "an Objection with no actions and no Hope did not reach Sanity");
            ok(sanity.lastSanity, "the quote did not warn that this is the last mark");
            ok(P.priceLine(who, sanity).includes(
                game.i18n.localize("DRPG.Price.will.breakdown")),
                "the sentence does not say that paying it breaks them down");

            // Nothing at all left.
            await who.update({ "system.resources.stress.value": sanityMax });
            await settle();
            const stuck = P.quotePrice(who, "objection");
            equal(stuck.pay, null, "a full Sanity track still quoted a price");
            equal(stuck.blockedKind, "nothingLeft", "an empty pocket was not reported as one");
            ok(stuck.blocked && !stuck.blocked.includes("DRPG."),
                `the refusal is a key rather than a sentence: ${stuck.blocked}`);

            // Tamper has no Hope step, deliberately (Dawid, 17.09).
            await who.update({
                "system.resources.hope.value": 5,
                "system.resources.stress.value": 0
            });
            await settle();
            equal(P.quotePrice(who, "tamper").pay, "stress",
                "Tamper took Hope, which is the one currency it must not take");

            // The killer in their own Stage 6 skips the action step and still pays.
            await who.update({ "system.resources.actions.value": 2 });
            await settle();
            equal(P.quotePrice(who, "tamper", { skip: ["action"] }).pay, "stress",
                "skipping the action step did not start the chain at its Sanity step");

            // Analyze's later steps exist only inside a Class Trial.
            await who.update({ "system.resources.actions.value": 0 });
            await settle();
            const daytime = P.quotePrice(who, "analyze");
            equal(daytime.pay, null, "Analyze outside a trial fell through to Hope");
            equal(daytime.blockedKind, "nothingLeft", "the daytime refusal was the wrong kind");
            await setClock({ ...clock, phase: "classTrial" });
            /* EMPTIED AGAIN ONCE INSIDE. Entering a trial hands out the time of day's
               budget - `reconcilePhase`, on every road in - so the pocket emptied
               before the phase moved is full again by the time it is asked. The
               question here is what a trial charges an EMPTY pocket, not what it hands
               out on the way in; that is its own scenario. */
            await who.update({ "system.resources.actions.value": 0 });
            await settle();
            equal(P.quotePrice(who, "analyze").pay, "hope",
                "Analyze inside a trial did not fall through to Hope");
        } finally {
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
        }
    }],

    ["payPrice writes one field, refundPrice puts it back", async () => {
        const [who] = cast(1);
        const P = await import("./price.mjs");
        const actions = await import("./actions.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);

            // The action step: one field moves, and only one.
            await who.update({
                "system.resources.actions.value": 2,
                "system.resources.hope.value": 3,
                "system.resources.stress.value": 1
            });
            await settle();
            const paidAction = await P.payPrice(who, "objection");
            await settle();
            equal(paidAction?.pay, "action", "the action step did not pay");
            equal(who.system.resources.actions.value, 1, "the action was not spent");
            equal(who.system.resources.hope.value, 3, "paying an action moved the Hope");
            equal(who.system.resources.stress.value, 1, "paying an action marked Sanity");
            ok(await P.refundPrice(who, paidAction), "the action refund refused");
            await settle();
            equal(who.system.resources.actions.value, 2, "the action did not come back");

            // The Hope step.
            await who.update({ "system.resources.actions.value": 0 });
            await settle();
            const paidHope = await P.payPrice(who, "objection");
            await settle();
            equal(paidHope?.pay, "hope", "the Hope step did not pay");
            equal(who.system.resources.hope.value, 2, "the Hope was not spent");
            equal(who.system.resources.stress.value, 1, "paying Hope marked Sanity");
            ok(await P.refundPrice(who, paidHope), "the Hope refund refused");
            await settle();
            equal(who.system.resources.hope.value, 3, "the Hope did not come back");

            // The Sanity step. Paying ADDS a mark; the refund lifts that same mark.
            await who.update({ "system.resources.hope.value": 0 });
            await settle();
            const paidSanity = await P.payPrice(who, "objection");
            await settle();
            equal(paidSanity?.pay, "stress", "the Sanity step did not pay");
            equal(who.system.resources.stress.value, 2, "the Sanity mark was not made");
            ok(await P.refundPrice(who, paidSanity), "the Sanity refund refused");
            await settle();
            equal(who.system.resources.stress.value, 1, "the Sanity mark was not lifted");

            /*
             * A BURST COMES BACK AS A BURST (trap 98), which is the whole reason the
             * receipt exists: a critical Tamper paid for with four Hope of Burst must
             * not turn into an action nobody had.
             */
            await actions.grantFreeActions(who, 1);
            await who.update({ "system.resources.hope.value": 3 });
            await settle();
            const paidBurst = await P.payPrice(who, "objection");
            await settle();
            equal(paidBurst?.pay, "action", "the Burst did not pay the action step");
            ok(paidBurst?.grant, "the receipt did not record that a Burst paid");
            equal(actions.freeActionsLeft(who), 0, "the Burst was not consumed");
            ok(await P.refundPrice(who, paidBurst), "the Burst refund refused");
            await settle();
            equal(actions.freeActionsLeft(who), 1, "the refund did not give the Burst back");
            equal(who.system.resources.actions.value, 0,
                "the refund turned a Burst into an action out of nowhere");
            ok(P.paidLine(paidBurst).includes(game.i18n.localize("DRPG.Price.paid.burst")),
                "the card would not say a Burst paid for it");
        } finally {
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
        }
    }],

    ["the dead, a Monocub and a Monokuma are quoted no price at all", async () => {
        /*
         * A refusal that offers a fallback and one that must not (T-1). C5 answers
         * "nothingLeft" with a free Present; answering "noPrice" with one would hand
         * a corpse the floor of a Class Trial.
         *
         * Every flag is restored to a real `false` rather than deleted: `-=key` does
         * nothing in this Foundry without a forced replacement, so a fixture that
         * "cleaned up" that way would leave the world dirty for every test after it.
         */
        const [who] = cast(1);
        const P = await import("./price.mjs");
        const before = {
            deceased: Boolean(who.getFlag(MODULE_ID, FLAGS.deceased)),
            monocub: Boolean(who.getFlag(MODULE_ID, FLAGS.monocub)),
            monokuma: Boolean(who.getFlag(MODULE_ID, FLAGS.monokuma))
        };

        try {
            for (const flag of [FLAGS.deceased, FLAGS.monocub, FLAGS.monokuma]) {
                await who.setFlag(MODULE_ID, FLAGS.deceased, false);
                await who.setFlag(MODULE_ID, FLAGS.monocub, false);
                await who.setFlag(MODULE_ID, FLAGS.monokuma, false);
                await who.setFlag(MODULE_ID, flag, true);
                await settle();
                for (const key of Object.keys(PRICE_CHAINS)) {
                    const quote = P.quotePrice(who, key);
                    equal(quote.blockedKind, "noPrice",
                        `${flag} was quoted a ${key} price of the wrong kind`);
                    equal(quote.pay, null, `${flag} was quoted a ${key} price`);
                }
            }

            // And a key with no chain at all is the same kind of refusal.
            await who.setFlag(MODULE_ID, FLAGS.monokuma, false);
            await settle();
            equal(P.quotePrice(who, "longRest").blockedKind, "noPrice",
                "an action with no chain was reported as an empty pocket");
        } finally {
            await who.setFlag(MODULE_ID, FLAGS.deceased, before.deceased);
            await who.setFlag(MODULE_ID, FLAGS.monocub, before.monocub);
            await who.setFlag(MODULE_ID, FLAGS.monokuma, before.monokuma);
        }
    }],

    ["the accomplice is offered the betrayal, and only them", async () => {
        const [killer, victim, third] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.thirdPartyEnters(third);
        await settle();
        await drpg.resolveCrisisAction({
            actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true
        });
        await settle();

        ok(!murder.betrayalTarget(third), "the betrayal was offered during the incident");

        // To a body (E32 C6): the offer is a body's, and the GM's Stage 6 with the victim
        // alive, which this test used to take, arms none.
        const { isDeadForGm, reviveCharacter } = await import("./chapter.mjs");
        try {
            for (let i = 0; i < 4 && murder.crisisRefusal(killer, "finishingBlow")?.why === "not their turn"; i++) await murder.passTurn();
            await drpg.resolveCrisisAction({ actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true });
            await settle();

            equal(murder.betrayalTarget(third)?.id, killer.id, "the accomplice turns on the killer");
            ok(!murder.betrayalTarget(killer), "the killer was offered a betrayal");
            ok(!murder.betrayalTarget(victim), "the victim was offered a betrayal");
        } finally {
            if (isDeadForGm(victim)) await reviveCharacter(victim, { quiet: true });
        }
    }],

    ["Observe ranks crime-tied traces first, then by difficulty", async () => {
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const scene = game.scenes.active;

        // Build the shelf instead of demanding the world already owns one. The
        // old form of this test asked the active scene for a room holding three
        // Remnants and failed on any world that had none - a clean world most
        // of all.
        //
        // Four traces at one point share a room by construction: the same hit
        // test answers for all of them, holes and all. The anchor is any token
        // already standing in a room, which spares this test owning any region
        // geometry of its own.
        needs(world.atLeast("occupiedRooms"), "the shelf is built beside a token standing in a room");
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "Foundry has a token standing in a room, and roomOfToken places none of the active scene's");

        const spread = [
            { type: "key", visibility: "obvious", tiedToCrime: true },   // DC 6, tied
            { type: "prep", visibility: "hidden", tiedToCrime: true },   // DC 18, tied
            { type: "prep", visibility: "obvious", tiedToCrime: false }, // DC 9
            { type: "prep", visibility: "subtle", tiedToCrime: false }   // DC 15
        ];

        const placed = [];
        try {
            for (const data of spread) {
                const token = await remnants.placeRemnant({
                    ...data, x: anchor.x, y: anchor.y, scene,
                    note: "test fixture - Observe ranking"
                });
                ok(token, "could not place a fixture Remnant");
                placed.push(token);
            }
            await settle();

            const room = roomOfToken(placed[0]);
            ok(room, "the fixture Remnants landed outside every room");

            const ranked = remnants.rankForObserve(room, scene);

            // The room may already hold other traces, so the fixture asserts
            // RELATIVE order, which extras cannot disturb.
            const at = token => ranked.findIndex(r => r.token.id === token.id);
            const [tiedLow, tiedHigh, untiedLow, untiedHigh] = placed.map(at);
            for (const [i, idx] of [tiedLow, tiedHigh, untiedLow, untiedHigh].entries()) {
                ok(idx >= 0, `fixture Remnant ${i} is missing from the ranking`);
            }
            ok(tiedLow < tiedHigh, "inside the crime-tied group, the harder trace outranked the easier");
            ok(tiedHigh < untiedLow, "an untied Remnant is ranked above a crime-tied one");
            ok(untiedLow < untiedHigh, "inside the untied group, the harder trace outranked the easier");

            // And the whole shelf still obeys the two rules, extras included.
            for (let i = 1; i < ranked.length; i++) {
                const before = ranked[i - 1], after = ranked[i];
                if (before.data.tiedToCrime === after.data.tiedToCrime) {
                    ok(before.dc <= after.dc, `${room}: DC ${before.dc} listed before DC ${after.dc}`);
                } else {
                    ok(before.data.tiedToCrime, `${room}: an untied Remnant is ranked above a tied one`);
                }
            }
        } finally {
            // Tombstone the ledger entries the way the module itself does,
            // then take the tokens off the map.
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(t => t.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }],

    ["the case dashboard reads its traces three ways, and keeps the reading", async () => {
        /*
         * Dawid, 28.08: chronologically, newest first; by player; by room.
         *
         * THE READING IS HELD OUTSIDE THE DOM, and that is the whole of why it
         * works in a window that rebuilds itself. `keepLive` redraws the region
         * from `buildCase`, and a build that read the filter off the select
         * would render the list BEFORE `restore` put the select back - one
         * frame of the wrong list every time anything in the world moved. So
         * this asserts both halves: the list narrows, AND the choice is still
         * standing after the redraw that the choice itself triggered.
         */
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        needs(world.atLeast("sceneOnScreen"), "the traces stand on the scene on screen");
        needs(world.atLeast("occupiedRooms", 2), "the traces are left in two rooms with a token in each");
        const scene = canvas?.scene;

        const anchors = Array.from(scene.tokens).filter(t => roomOfToken(t));
        const rooms = [...new Set(anchors.map(t => roomOfToken(t)))];
        ok(rooms.length >= 2, `Foundry has tokens in two rooms or more on the scene on screen, and roomOfToken finds ${rooms.length}`);
        // Two living students to tell "left by" apart (cast; it was the first two characters, a corpse or a Monokuma included).
        const pair = cast(2);

        /*
         * A CHAPTER OF ITS OWN, ABOVE ANYTHING THE WORLD HOLDS.
         *
         * The fixture used to stamp `chapter: 1` and days 1–3 and then assert
         * that "newest first" put its own D3 on top - which is only true on a
         * world with no traces later than day 3. The suite's own murder
         * scenarios leave incident traces stamped from the live clock, so on a
         * world sitting on day 11 the sort was correct and the assertion was
         * wrong. Measured: "QA Witness · Main Hall · Ch 1 · D 11" at the top,
         * which is genuinely the newest thing there.
         *
         * `when()` in investigation.mjs orders by chapter first, so one chapter
         * above the clock puts all three fixtures ahead of every trace the world
         * already had, and the D3 assertion below means what it says again.
         */
        const future = (getClock()?.chapter ?? 1) + 1;
        const spread = [
            { room: rooms[0], who: pair[0], day: 1, timeOfDay: "morning" },
            { room: rooms[1], who: pair[1], day: 3, timeOfDay: "night" },
            { room: rooms[0], who: pair[1], day: 2, timeOfDay: "noon" }
        ];

        const placed = [];
        let dialog = null;
        try {
            for (const one of spread) {
                const anchor = anchors.find(t => roomOfToken(t) === one.room);
                const token = await remnants.placeRemnant({
                    type: "prep", visibility: "evident", scene, x: anchor.x, y: anchor.y,
                    sourceActor: one.who.id, sourceName: one.who.name, room: one.room,
                    chapter: future, day: one.day, timeOfDay: one.timeOfDay,
                    note: "test fixture - dashboard filters"
                });
                ok(token, "could not place a fixture trace");
                placed.push(token);
            }
            await settle();

            const investigation = await import("./investigation.mjs");
            needs(env.dialogs(), "the dashboard has no element to read");
            const before = new Set(foundry.applications.instances.keys());
            // Not awaited: it settles when the GM closes it. See R12.
            Promise.resolve(investigation.openInvestigationDashboard()).catch(() => {});
            await wait(900);
            for (const [id, app] of foundry.applications.instances.entries()) {
                if (!before.has(id)) dialog = app;
            }
            ok(dialog?.element, "the dashboard did not open");

            const bar = () => dialog.element.querySelector(".drpg-trace-filters");
            ok(bar(), "the dashboard has no filter bar");
            const rows = () => dialog.element
                .querySelectorAll('[data-drpg-panel="traces"] tbody tr').length;
            const control = which => bar().querySelector(`[data-drpg-filter="${which}"]`);
            const choose = async (which, value) => {
                const element = control(which);
                element.value = value;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                await wait(400);
            };

            /* THE FIRST READ IS THE CHAPTER NOW RUNNING (E9), and the fixture's traces are
               a chapter above it. On a world that holds a trace of the running chapter the
               window opens on that chapter and lists none of the three - which the harness
               world does since E04 (1.2.63) seeded its trace with a ledger row, as most
               worlds at a table do. Measured 26.09: "the dashboard lists 1 trace(s); the
               fixture placed three". So the test reads the fixture's own chapter first, as a
               GM looking for these three would. */
            await choose("chapter", String(future));
            const all = rows();
            ok(all >= 3, `the dashboard lists ${all} trace(s); the fixture placed three`);

            // The options come off the traces themselves, not off the cast.
            const people = [...control("player").options].map(o => o.value).filter(Boolean);
            ok(people.includes(pair[1].id), "the player filter does not offer a trace's own author");

            await choose("player", pair[1].id);
            const mine = rows();
            ok(mine < all, `filtering by player showed ${mine} of ${all} - nothing was filtered`);
            equal(control("player").value, pair[1].id,
                "the chosen player did not survive the redraw it triggered");

            await choose("player", "");
            await choose("room", rooms[0]);
            const here = rows();
            ok(here < all, `filtering by room showed ${here} of ${all} - nothing was filtered`);
            equal(control("room").value, rooms[0],
                "the chosen room did not survive the redraw it triggered");

            await choose("room", "");
            await choose("order", "newest");
            equal(rows(), all, "ordering dropped rows; it is an order, not a filter");
            const first = dialog.element
                .querySelector('[data-drpg-panel="traces"] tbody tr')?.textContent ?? "";
            ok(/D\s*3/.test(first),
                `newest first put "${first.replace(/\s+/g, " ").trim().slice(0, 60)}" at the top`);
        } finally {
            if (dialog) await dialog.close();
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(t => t.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }],

    ["a trap does not tell the person who set it", async () => {
        /*
         * FOUR THINGS NOW TURN ON "IS THIS BROWSER IN THE KILLING", and before
         * `incidentWitness` existed they each answered it themselves. Two had
         * already drifted apart: `incidentCard` in events.mjs had been repaired
         * after LIVE-001 moved the names out of the world setting, and
         * `buildIncident` in hud.mjs had not - so under Monokuma Legacy, where
         * that row is the only place an incident shows, it rendered for nobody
         * at all. Measured on four clients before and after: gm/p1/p3 all
         * false, then gm and the killer true and the bystander still false.
         *
         * THE HALF THIS TEST IS REALLY FOR is the indirect murder. A trap's
         * killer built it and walked away; the module telling them the moment
         * it worked is the one fact the whole murder engine exists to keep from
         * travelling, and it was travelling - the cast, the Event card and a
         * whisper all arrived on their screen (measured 15.09, four clients).
         *
         * READ FROM THE PREDICATE rather than from the screen, because what is
         * being checked is the RULE and not one of the four places that read
         * it. The screen is exercised by the harness scenarios, which have a
         * murder and real clients; this is the invariant underneath them, and
         * it is the thing that would silently stop being true if somebody
         * added a fifth reader.
         */
        const { incidentWitness } = await import("./settings.mjs");
        const { MODULE_ID: MOD } = await import("./config.mjs");
        const { castStore } = await import("./gm-stores.mjs");

        const [killer, victim] = cast(3);   // and a bystander

        const worldBefore = game.settings.get(MOD, "murderState") ?? {};
        const assignedBefore = game.user.character ?? null;
        try {
            // A GM owns every actor, so "the seat I am playing" is the only
            // thing that can make a GM a participant - which is what the edge
            // colour keys off. Set deliberately, and put back in `finally`.
            await game.user.update({ character: killer.id });

            // The GMs' record, through the store (E04); tier 2's restore puts the store back.
            // Whether it is a trap is the cast's too since E05 C8 (audit S04-08); the world half holds no `indirect`.
            await castStore.patch("record", { killerId: killer.id, victimId: victim.id, thirdId: null, indirect: false });

            // ---- a DIRECT murder: the killer is in the room ------------------
            await game.settings.set(MOD, "murderState",
                { active: true, stage: "incident", turn: 1, turnSide: "victim" });
            const direct = incidentWitness();
            ok(direct.running, "a running incident does not read as running");
            ok(direct.witness, "the killer of a direct murder is not a witness to it");
            equal(direct.seat, killer.id, "the killer's own seat was not recognised");

            // ---- the SAME murder, sprung by a trap ---------------------------
            await castStore.patch("record", { indirect: true });
            const trap = incidentWitness();
            ok(trap.running, "an indirect incident does not read as running");
            ok(trap.indirect, "the incident does not know it is a trap");
            equal(trap.seat, null,
                "the killer of a TRAP holds a seat in it - they would get the card, "
                + "the red edges and the murder music the moment it went off");

            // ---- and the victim of that trap is still told -------------------
            await game.user.update({ character: victim.id });
            const theirs = incidentWitness();
            ok(theirs.witness, "the victim of a trap is not a witness to their own incident");
            equal(theirs.seat, victim.id, "the victim's seat was not recognised");

            // ---- nothing running, nobody is in anything ---------------------
            await game.settings.set(MOD, "murderState", {});
            const quiet = incidentWitness();
            ok(!quiet.running && !quiet.witness && quiet.seat === null,
                `a world with no incident reads as one: ${JSON.stringify(quiet)}`);
        } finally {
            await game.user.update({ character: assignedBefore?.id ?? null });
            await game.settings.set(MOD, "murderState", worldBefore);
        }
    }],

    ["a trace and its bullets are one record, edited from either end", async () => {
        /*
         * Dawid, 28.08: "the synchronisation is to be full, continuous,
         * regardless of when and where the edit happens."
         *
         * The downward half is old - the trace's record has always been pushed
         * onto every bullet copied from it. The upward half is v1.1.55, and it
         * is the one with a moving part: `updateItem` fires on EVERY client, so
         * the handler is fenced to one GM, and a fence in the wrong place turns
         * the whole feature off without a word. Nothing failed when it was
         * written; nothing would fail if it stopped working either.
         *
         * TWO HOLDERS ON PURPOSE. One bullet cannot tell "the edit reached the
         * trace" apart from "the edit stayed where it was typed". The second
         * copy is the only witness that the words travelled.
         */
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { roomOfToken } = await import("./movement.mjs");

        needs(world.atLeast("sceneOnScreen"), "the fixture stands on the scene on screen");
        needs(world.atLeast("occupiedRooms"), "the fixture is built beside a token standing in a room");
        const scene = canvas?.scene;
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "Foundry has a token standing in a room on the scene on screen, and roomOfToken places none of them");

        const [one, two] = cast(2);

        let token = null;
        const made = [];
        try {
            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", x: anchor.x, y: anchor.y, scene,
                note: "test fixture - trace/bullet sync"
            });
            ok(token, "could not place the fixture trace");

            for (const actor of [one, two]) {
                const item = await bullets.createTruthBullet(actor, {
                    name: "Suite fixture bullet",
                    realType: "neutral",
                    visibility: "obvious",
                    remnantId: token.id,
                    sceneId: scene.id
                });
                ok(item, `no bullet was created for ${actor.name}`);
                made.push(item);
            }
            await settle();

            // ---- DOWN: the trace speaks, both copies listen -----------------
            const said = `Fixture trace ${Date.now() % 100000}`;
            await remnants.setRemnantPublic(token, { name: said, playerText: "A chipped rim." });
            await settle();
            await until(() => made.every(i => i.actor.items.get(i.id)?.name === said));
            for (const item of made) {
                const live = item.actor.items.get(item.id);
                equal(live?.name, said,
                    `${item.actor.name}'s copy did not take the trace's name`);
            }

            // ---- UP: one copy is corrected, and the record moves ------------
            const corrected = `Corrected ${Date.now() % 100000}`;
            await made[0].actor.items.get(made[0].id).update({ name: corrected });
            await settle();

            await until(() => remnants.remnantPublic(token)?.name === corrected);
            equal(remnants.remnantPublic(token)?.name, corrected,
                "an edit on a bullet never reached the trace it came from");

            // ---- AND BACK DOWN, to the copy nobody touched ------------------
            /* THE SECOND HOP IS THE ONE THAT WAS FLAKY. The trace has the words by the
               line above; this is the push back down to the holder nobody edited. */
            await until(() => two.items.get(made[1].id)?.name === corrected);
            equal(two.items.get(made[1].id)?.name, corrected,
                "the trace took the correction and the other holder never saw it");

            // ---- The words, not only the title -----------------------------
            await made[0].actor.items.get(made[0].id)
                .update({ "system.description": "<p>Rust in the hinge.</p>" });
            await settle();
            await until(() => remnants.remnantPublic(token)?.playerText === "Rust in the hinge.");
            equal(remnants.remnantPublic(token)?.playerText, "Rust in the hinge.",
                "a description typed on the item sheet did not reach the trace");
        } finally {
            for (const item of made) {
                const live = item.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
            if (token) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) {
                    await scene.deleteEmbeddedDocuments("Token", [token.id]);
                }
            }
        }
    }],

    ["the analysis half of a trace is not on the item until it is bought", async () => {
        /*
         * THE SECOND TIER, AND THE ONLY QUESTION THAT MATTERS ABOUT IT IS WHERE
         * IT IS SITTING BEFORE IT IS EARNED.
         *
         * A trace now carries two descriptions: what Observe buys and what
         * Analyze buys. The second follows exactly the rule `sourceAction` and
         * `tiedToCrime` already follow - it lives in the bullet's secret from
         * creation and reaches the ITEM only once the holder has identified it -
         * and the rule exists because a player's browser holds every one of
         * their own items in full. A sentence written onto the item at creation
         * is a sentence readable from the console by anyone who can be bothered
         * to open one, which in a social-deduction game is the whole point of
         * the roll gone.
         *
         * Nothing about the module's behaviour would say so. The sheet shows
         * one paragraph before analysis and two after either way; the flag is
         * the only witness, so the flag is what this reads.
         *
         * FOUR PROPERTIES, and the third and fourth are the ones that were not
         * obvious when this was built:
         *   1. un-analysed: item empty, secret holds it
         *   2. analysed: item holds it, description carries both halves
         *   3. a GM rewriting it afterwards reaches an analysed copy's ITEM and
         *      an un-analysed copy's SECRET ONLY - one edit, two roads
         *   4. the description scrape that carries a sheet edit back to the
         *      trace does not fold the analysis paragraph into `playerText`,
         *      which would publish it to every holder at once
         */
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const { MODULE_ID } = await import("./config.mjs");
        const F = bullets.TRUTH_BULLET_FLAGS;

        needs(world.atLeast("sceneOnScreen"), "the fixture stands on the scene on screen");
        needs(world.atLeast("occupiedRooms"), "the fixture is built beside a token standing in a room");
        const scene = canvas?.scene;
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "Foundry has a token standing in a room on the scene on screen, and roomOfToken places none of them");

        const [reader, holder] = cast(2);

        /* NO APOSTROPHE, NO ANGLE BRACKET, and that is not fussiness - the
           first draft of this fixture read "not the victim's blood" and the
           description assertion below failed on it. The flag holds the raw
           sentence and the description holds it through `escapeHTML`, so the
           two are only comparable for text that escaping leaves alone. The
           escaping itself is asserted separately further down, where it is the
           subject rather than an accident of the fixture. */
        const READING = `Type O and not the victim blood ${Date.now() % 100000}`;
        let token = null;
        const made = [];
        try {
            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", x: anchor.x, y: anchor.y, scene,
                note: "test fixture - two-tier description"
            });
            ok(token, "could not place the fixture trace");

            await remnants.setRemnantPublic(token, {
                name: "Suite fixture smear", playerText: "A dark smear.", analyzedText: READING
            });
            await settle();
            equal(remnants.remnantPublic(token)?.analyzedText, READING,
                "the trace did not keep the analysis text it was given");

            for (const actor of [reader, holder]) {
                const item = await bullets.createTruthBullet(actor, {
                    name: "Suite fixture smear",
                    realType: "resolution",          // analysable: not self-evident
                    visibility: "obvious",
                    playerText: "A dark smear.",
                    analyzedText: READING,
                    remnantId: token.id,
                    sceneId: scene.id
                });
                ok(item, `no bullet was created for ${actor.name}`);
                made.push(item);
            }
            await settle();

            // ---- 1. Before the roll: nothing on the item, everything in the secret
            for (const item of made) {
                const live = item.actor.items.get(item.id);
                equal(live.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                    `${item.actor.name}'s un-analysed copy carries the analysis on the item`);
                ok(!String(live.system?.description ?? "").includes(READING),
                    `${item.actor.name}'s un-analysed description quotes the analysis`);
                equal(bullets.secretOf(live.uuid).analyzedText, READING,
                    `the analysis was not filed in ${item.actor.name}'s bullet secret`);
            }

            // ---- 2. One of them buys it -------------------------------------
            const { resolveAnalyze } = await import("./analyze.mjs");
            const verdict = await resolveAnalyze({
                actorId: reader.id, itemId: made[0].id, total: 40, isCritical: false
            });
            await settle();
            ok(verdict?.success, "the fixture Analyze did not succeed on a 40");

            const analysed = reader.items.get(made[0].id);
            equal(analysed.getFlag(MODULE_ID, F.analyzedText), READING,
                "a successful Analyze did not publish the reading onto the item");
            ok(String(analysed.system?.description ?? "").includes(READING),
                "the description did not gain the analysis paragraph");
            ok(String(analysed.system?.description ?? "").includes("A dark smear."),
                "the analysis paragraph replaced the Observe half instead of joining it");

            // ---- 3. The GM rewrites it. Two roads, and only two -------------
            const REWRITTEN = `Type AB after all ${Date.now() % 100000}`;   // escape-safe, as above
            await remnants.setRemnantPublic(token, { analyzedText: REWRITTEN });
            await settle();
            await until(() => reader.items.get(made[0].id)
                ?.getFlag(MODULE_ID, F.analyzedText) === REWRITTEN);

            equal(reader.items.get(made[0].id).getFlag(MODULE_ID, F.analyzedText), REWRITTEN,
                "the correction never reached the holder who had analysed it");
            equal(holder.items.get(made[1].id).getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                "the correction was published onto a copy nobody has analysed");
            equal(bullets.secretOf(holder.items.get(made[1].id).uuid).analyzedText, REWRITTEN,
                "the un-analysed copy's secret was left holding the old reading");

            // ---- 4. A sheet edit must not carry the analysis into playerText -
            /* The description is two paragraphs now, and `watchBulletEdits`
               reads it back as plain text to keep the trace in step with a GM
               typing on the item sheet. Without the cut, that read-back folds
               the lab reading - and its heading - into `playerText`, which then
               goes down onto every copy including the un-analysed one. One GM
               opening a sheet would publish the answer to the table. */
            const live = reader.items.get(made[0].id);
            await live.update({
                "system.description":
                    `<p>Rust in the hinge.</p><p class="drpg-bullet-analysis"><strong>Analysis:</strong> ${REWRITTEN}</p>`
            });
            await settle();
            await until(() => remnants.remnantPublic(token)?.playerText === "Rust in the hinge.");
            equal(remnants.remnantPublic(token)?.playerText, "Rust in the hinge.",
                "the sheet scrape folded the analysis paragraph into the Observe half");
            equal(remnants.remnantPublic(token)?.analyzedText, REWRITTEN,
                "the sheet scrape overwrote the trace's analysis text");

            // ---- 5. And the reading is escaped on its way into the markup ----
            /* The fixtures above are deliberately escape-safe so that a plain
               `includes` can compare them; this is where that shortcut is paid
               for. A GM writes this sentence by hand into a textarea, it lands
               in `system.description` as HTML, and the sheet renders it - so a
               trace described with a `<script>` in it is a trace that runs on
               every holder's browser. Asserted on the composer directly, which
               is the one place all three call sites go through. */
            const nasty = bullets.bulletDescription("plain", `<img src=x onerror=alert(1)>`);
            ok(!nasty.includes("<img"), "the analysis half reaches the sheet as live markup");
            ok(nasty.includes("&lt;img"), "the analysis half was not escaped at all");
        } finally {
            for (const item of made) {
                const live = item.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
            if (token) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) {
                    await scene.deleteEmbeddedDocuments("Token", [token.id]);
                }
            }
        }
    }],

    ["a Key and a Final keep their reading for an Analyze, like any trace", async () => {
        /*
         * Dawid, 21.09: every trace works like an ordinary one - a description,
         * and a description after Analyze. A Key or a Final used to be born
         * identified with both halves at once, so a reading written for one
         * reached its finder on pickup. The kind still shows at once (the guide's
         * "bez wymogu analizy"); the reading waits, and the Analyze that buys it is
         * rolled like any other (the same day: every bullet rolls).
         *
         *   1. picked up: the kind shows, the description is there, the reading is
         *      not - on the item or in its markup - and the bullet can be analysed
         *   2. a GM rewriting the reading reaches the unread copy's secret only
         *   3. a 1 misses: the kind stays, the reading does not come, the lock does
         *   4. a Reroll winds it back and a 40 reads it; then it is finished
         *   5. a Reroll that loses puts it back as it was picked up - its kind and
         *      its crime tie showing - not as a Neutral bullet
         *   6. a copy born read (a critical, a GM's "the real type") has it at once
         */
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { resolveAnalyze } = await import("./analyze.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const { MODULE_ID } = await import("./config.mjs");
        const F = bullets.TRUTH_BULLET_FLAGS;

        needs(world.atLeast("sceneOnScreen"), "the fixture stands on the scene on screen");
        needs(world.atLeast("occupiedRooms"), "the fixture is built beside a token standing in a room");
        const scene = canvas?.scene;
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "Foundry has a token standing in a room on the scene on screen, and roomOfToken places none of them");
        const [reader] = cast(1);
        ok(reader, "no living student to hand the fixture to");

        // Escape-safe on purpose, for the reason the two-tier scenario above gives.
        const READING = `Filed under the wrong year ${Date.now() % 100000}`;
        const REWRITTEN = `${READING} and signed twice`;
        const placed = [];
        const made = [];
        try {
            for (const kind of ["key", "final"]) {
                const token = await remnants.placeRemnant({
                    type: kind, visibility: "evident", tiedToCrime: true,
                    x: anchor.x, y: anchor.y, scene, note: "test fixture - a reading kept for Analyze"
                });
                ok(token, `could not place the ${kind} fixture`);
                placed.push(token);
                await remnants.setRemnantPublic(token, {
                    name: `Suite ${kind} ledger`, playerText: "A ledger.", analyzedText: READING
                });
                await settle();

                const item = await bullets.createTruthBullet(reader, {
                    name: `Suite ${kind} ledger`, realType: kind, visibility: "evident",
                    playerText: "A ledger.", analyzedText: READING, tiedToCrime: true,
                    remnantId: token.id, sceneId: scene.id
                });
                ok(item, `no ${kind} bullet was created`);
                made.push(item);
                await settle();

                // ---- 1. picked up ------------------------------------------
                let live = reader.items.get(item.id);
                equal(live.getFlag(MODULE_ID, F.shownType), kind, `a ${kind} bullet does not show its kind on pickup`);
                ok(bullets.isIdentified(live), `a ${kind} bullet is no longer identified on pickup`);
                equal(live.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                    `a ${kind} bullet carries its reading before anybody analysed it`);
                const before = String(live.system?.description ?? "");
                ok(!before.includes(READING), `a ${kind} bullet's description quotes its reading before any Analyze`);
                ok(before.includes("A ledger."), `a ${kind} bullet lost its ordinary description`);
                ok(!bullets.hasReading(live), `a ${kind} bullet counts as read before any Analyze`);
                ok(bullets.isAnalysable(live), `a ${kind} bullet cannot be analysed, so its reading can never be bought`);
                equal(bullets.secretOf(live.uuid).analyzedText, READING, `the ${kind} reading was not filed in the secret`);

                // ---- 2. the GM rewrites it ---------------------------------
                await remnants.setRemnantPublic(token, { analyzedText: REWRITTEN });
                await settle();
                live = reader.items.get(item.id);
                equal(live.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                    `rewriting a ${kind} trace's reading published it onto an unread copy`);
                equal(bullets.secretOf(live.uuid).analyzedText, REWRITTEN,
                    `the unread ${kind} copy's secret kept the old reading`);

                const tie = live.getFlag(MODULE_ID, F.tiedToCrime);
                equal(tie, true, `a ${kind} bullet does not show its crime tie on pickup`);

                // ---- 3. a 1 misses ------------------------------------------
                const ids = { actorId: reader.id, itemId: item.id, isCritical: false };
                let verdict = await resolveAnalyze({ ...ids, total: 1 });
                await settle();
                ok(verdict && !verdict.success, `Analyze on a ${kind} bullet passed on a 1 - it is a free pass again`);
                live = reader.items.get(item.id);
                equal(live.getFlag(MODULE_ID, F.shownType), kind, `a missed Analyze took the ${kind} bullet's kind away`);
                equal(live.getFlag(MODULE_ID, F.analyzedText) ?? "", "", `a missed Analyze published the ${kind} reading`);
                ok(!bullets.isAnalysable(live), `a missed Analyze on a ${kind} bullet did not lock it for the chapter`);

                // ---- 4. a Reroll, and a 40 ----------------------------------
                verdict = await resolveAnalyze({ ...ids, total: 40, undo: true });
                await settle();
                ok(verdict?.success, `a Reroll of 40 did not read the ${kind} bullet`);
                live = reader.items.get(item.id);
                equal(live.getFlag(MODULE_ID, F.analyzedText), REWRITTEN, `Analyze did not buy the ${kind} reading`);
                ok(String(live.system?.description ?? "").includes(REWRITTEN),
                    `the ${kind} description did not gain the reading`);
                equal(live.getFlag(MODULE_ID, F.shownType), kind, `analysing a ${kind} bullet changed its kind`);
                ok(bullets.hasReading(live), `a read ${kind} bullet does not count as read`);
                ok(!bullets.isAnalysable(live), `a read ${kind} bullet can be analysed again`);

                // ---- 5. a Reroll that loses ---------------------------------
                verdict = await resolveAnalyze({ ...ids, total: 1, undo: true });
                await settle();
                ok(verdict && !verdict.success, `a Reroll of 1 read the ${kind} bullet`);
                live = reader.items.get(item.id);
                equal(live.getFlag(MODULE_ID, F.shownType), kind,
                    `a lost Reroll left the ${kind} bullet showing less than it did on pickup`);
                equal(live.getFlag(MODULE_ID, F.tiedToCrime), tie,
                    `a lost Reroll hid the crime tie the ${kind} bullet showed on pickup`);
                equal(live.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                    `a lost Reroll left the ${kind} reading on the item`);
                ok(!String(live.system?.description ?? "").includes(REWRITTEN),
                    `a lost Reroll left the ${kind} reading in the description`);
            }

            // ---- 6. born read ----------------------------------------------
            const crit = await bullets.createTruthBullet(reader, {
                name: "Suite key ledger, read", realType: "key", shownType: "key", analyzed: true,
                visibility: "evident", playerText: "A ledger.", analyzedText: READING
            });
            ok(crit, "no read Key bullet was created");
            made.push(crit);
            await settle();
            equal(reader.items.get(crit.id)?.getFlag(MODULE_ID, F.analyzedText), READING,
                "a Key handed over read (a critical, or \"the real type\") came without its reading");
        } finally {
            for (const item of made) {
                const live = item.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
            for (const token of placed) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) await scene.deleteEmbeddedDocuments("Token", [token.id]);
            }
            await settle();
        }
    }],

    ["a project's token is known to the people who know the project, and to nobody else", async () => {
        /*
         * A project token's document reaches EVERY browser on the scene - Foundry
         * uses ownership for control, not for sight, and its `hidden` flag means
         * "GM only", which cannot say "these three players". So the whole secrecy
         * of the feature is one predicate applied on each client, and this is it.
         *
         * Two roads in, and both are tested, because they are the two halves of
         * the design and the second one is the one that would rot: a secret
         * project is known to the people in on it, and a public one is known once
         * its room has been stood in. No new state - `canSee` is the countdown's
         * own ownership and `discoveredFor` is fog.mjs's record of where somebody
         * has been.
         */
        const projects = await import("./projects.mjs");
        const fog = await import("./fog.mjs");
        needs(world.atLeast("scenes"), "a project stands in a scene");
        needs(world.atLeast("playerAccounts", 2), "an insider and an outsider");
        const scene = game.scenes?.current ?? game.scenes?.contents?.[0];

        const players = game.users.filter(u => !u.isGM);
        const [insider, outsider] = players;

        const room = scene.regions?.contents?.[0]?.name ?? null;
        const made = [];
        try {
            /* ---- the secret road ------------------------------------------- */
            const secret = await projects.createProject({
                name: "Suite secret rig", target: 4, room,
                secret: true, viewers: [insider.id]
            });
            ok(secret?.id, "the secret fixture project was not created");
            made.push(secret.id);

            ok(projects.knowsProject(secret.id, insider) === true,
                "somebody in on a secret project cannot see its token");
            ok(projects.knowsProject(secret.id, outsider) === false,
                "a secret project's token is visible to somebody not in on it");

            /* ---- the public road ------------------------------------------- */
            const open = await projects.createProject({
                name: "Suite open rig", target: 4, room
            });
            ok(open?.id, "the public fixture project was not created");
            made.push(open.id);

            if (!room) {
                /* A project with nowhere to walk into is known as soon as it is
                   visible - there is nothing to discover. Asserted rather than
                   skipped: it is a fact about the rule, not about the world. */
                ok(projects.knowsProject(open.id, outsider) === true,
                    "a project with no room should need no discovering");
            } else {
                const mine = game.actors.filter(a => a.type === "character"
                    && a.testUserPermission(outsider, "OWNER")).map(a => a.id);
                ok(mine.length, "the outsider holds no character to discover rooms with");

                /* The whole scene's matrix, rebuilt from the exported reader.
                   `saveDiscoveryMatrix` overwrites a scene's rows wholesale, so
                   putting back only the rows this test touched would silently
                   delete everybody else's - and `allDiscovered` is not exported,
                   which is right: one reader, per character, is enough to
                   reconstruct it exactly. */
                const before = Object.fromEntries(game.actors
                    .filter(a => a.type === "character")
                    .map(a => [a.id, fog.discoveredFor(scene.id, a.id)]));
                try {
                    await fog.saveDiscoveryMatrix(scene,
                        { ...before, ...Object.fromEntries(mine.map(id => [id, []])) });
                    ok(projects.knowsProject(open.id, outsider) === false,
                        "a public project was known to somebody who has never been in its room");

                    await fog.saveDiscoveryMatrix(scene,
                        { ...before, ...Object.fromEntries(mine.map(id => [id, [room]])) });
                    ok(projects.knowsProject(open.id, outsider) === true,
                        "a public project stayed hidden from somebody who has stood in its room");
                } finally {
                    await fog.saveDiscoveryMatrix(scene, before);
                }
            }
        } finally {
            for (const id of made) await projects.deleteProject(id);
        }
    }],

    ["the Projects tray shows a project only once its reader has found it", async () => {
        /*
         * STAGE 2: the tray and the map token answer the same question.
         *
         * The tray is Daggerheart's, and the system fills it from the
         * countdown's own ownership - which is secrecy and nothing else, so a
         * PUBLIC project was listed for everybody from the moment a GM made it.
         * `hideUndiscovered` takes those rows out per client.
         *
         * Two things are measured here and the second is the one worth having:
         *
         *   1. the row for an undiscovered project is removed;
         *   2. a row this pass cannot resolve to a project is LEFT ALONE. That
         *      is the fail-open half, and it is what stops the tray eating a
         *      plain Daggerheart countdown somebody built in the system's own
         *      window. A gate that removes rows is one `projectForRow` miss away
         *      from emptying a tray, so the miss is tested rather than assumed.
         *
         * The markup is built here rather than rendered, because the tray is the
         * system's template and the suite has no Daggerheart tray to render.
         * That is the honest limit of this test: it proves the pass does the
         * right thing to rows of the shape `projectForRow` reads, not that the
         * system still emits that shape. A scenario at a real table is what
         * settles the second question.
         */
        const projects = await import("./projects.mjs");
        const tray = await import("./projects-ui.mjs");
        const fog = await import("./fog.mjs");

        needs(world.atLeast("scenes"), "a project stands in a scene");
        needs(world.atLeast("namedRooms"), "the tray gate only bites on a project with a room");
        needs(world.atLeast("playersWithCharacter"), "discovery is recorded per character");
        const scene = game.scenes?.current ?? game.scenes?.contents?.[0];
        const room = scene.regions?.contents?.find(r => r.name?.trim())?.name ?? null;

        /* The first player who actually HOLDS somebody: discovery is recorded
           per character, so an account with no character can never discover
           anything and would make every assertion below trivially true. */
        const outsider = game.users.filter(u => !u.isGM).find(u => game.actors
            .some(a => a.type === "character" && a.testUserPermission(u, "OWNER")));

        const mine = game.actors.filter(a => a.type === "character"
            && a.testUserPermission(outsider, "OWNER")).map(a => a.id);

        const buildRow = (id, name) => {
            const row = document.createElement("div");
            row.className = "countdown-container";
            if (id) row.dataset.countdown = id;
            const content = document.createElement("div");
            content.className = "countdown-content";
            const header = document.createElement("header");
            header.textContent = name;
            content.append(header);
            row.append(content);
            return row;
        };

        /* Rebuilt from `discoveredFor` per character, never from a whole-matrix
           reader: `saveDiscoveryMatrix` overwrites a scene's rows wholesale, so
           a restore that named only this test's rows would delete everybody
           else's. Same reason as the token test above. */
        const before = Object.fromEntries(game.actors
            .filter(a => a.type === "character")
            .map(a => [a.id, fog.discoveredFor(scene.id, a.id)]));

        let made = null;
        try {
            const open = await projects.createProject({ name: "Suite tray rig", target: 4, room });
            ok(open?.id, "the fixture project was not created");
            made = open.id;

            await fog.saveDiscoveryMatrix(scene,
                { ...before, ...Object.fromEntries(mine.map(id => [id, []])) });

            ok(projects.visibleProjects(outsider).some(p => p.id === made),
                "a public project should still be VISIBLE to somebody who has not found it");
            ok(!projects.knownProjects(outsider).some(p => p.id === made),
                "an undiscovered public project was in `knownProjects`");

            const root = document.createElement("div");
            root.append(buildRow(made, "Suite tray rig"));
            root.append(buildRow("suiteNotAProject", "A countdown the module never made"));

            const removed = tray.hideUndiscovered(root, outsider);
            ok(removed === 1, `the tray gate removed ${removed} rows, expected exactly 1`);
            ok(!root.querySelector(`[data-countdown="${made}"]`),
                "an undiscovered project kept its row in the tray");
            ok(root.querySelector('[data-countdown="suiteNotAProject"]'),
                "the tray gate ate a row it could not resolve to a project");

            /* And the other way round: walking in puts it back. */
            await fog.saveDiscoveryMatrix(scene,
                { ...before, ...Object.fromEntries(mine.map(id => [id, [room]])) });

            const after = document.createElement("div");
            after.append(buildRow(made, "Suite tray rig"));
            ok(tray.hideUndiscovered(after, outsider) === 0,
                "a project whose room has been stood in was still taken out of the tray");
            ok(projects.knownProjects(outsider).some(p => p.id === made),
                "a discovered project was missing from `knownProjects`");
        } finally {
            await fog.saveDiscoveryMatrix(scene, before);
            if (made) await projects.deleteProject(made);
        }
    }],

    ["a secret project is found by looking for what does not belong, and by nothing else", async () => {
        /*
         * STAGE 3: the one way into a project nobody has told you about.
         *
         * The rule has two halves and this drives both, because half of it is a
         * negative and a negative is what rots quietly: the non-obvious
         * declaration carries the room's secret project, and no other one does.
         * See PROJECT_OBSERVE in config.mjs for why that declaration and no
         * other - it is the choice with a price, and a check on every Observe
         * would turn a DC 18 into a matter of time.
         *
         * The verdict is measured by BEHAVIOUR rather than by reading the DC:
         * one point under the bar leaves the project hidden and the bar itself
         * finds it. Reading the number out of the pending entry would be the
         * test quoting the implementation back at itself, and `pendingShape`
         * deliberately does not hand the number over anyway.
         *
         * Everything this drags in behind it is put back in `finally`: the
         * Sanity a missed Observe takes, any Truth Bullet the room's own traces
         * produced on the successful throw, and the fixture project.
         */
        const projects = await import("./projects.mjs");
        const observe = await import("./observe.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { PROJECT_OBSERVE } = await import("./config.mjs");
        const { locateActor } = await import("./movement.mjs");
        const { ownerOf } = await import("./utils.mjs");

        /* Somebody with an account, standing somewhere. Both halves matter:
           `secretsUnknownIn` is asked about a USER, and a character between
           rooms has no room for a project to be hiding in. */
        const actor = game.actors.filter(a => a.type === "character")
            .find(a => ownerOf(a) && locateActor(a)?.room);
        ok(actor, "no character with a player account is standing in a room");
        const user = ownerOf(actor);
        const room = locateActor(actor).room;

        const stressPath = "system.resources.stress.value";
        const stressBefore = foundry.utils.getProperty(actor, stressPath) ?? 0;
        const itemsBefore = new Set(actor.items.map(i => i.id));
        let id = null;
        try {
            const made = await projects.createProject({
                name: "Suite hidden rig", target: 4, room, secret: true, viewers: []
            });
            ok(made?.id, "the fixture project was not created");
            id = made.id;

            ok(projects.canSee(id, user) === false,
                "the fixture project was not secret from the observer to begin with");
            ok(projects.secretsUnknownIn(room, user).some(p => p.id === id),
                "a secret project in the observer's own room was not a candidate");
            ok(projects.secretsUnknownIn(room, game.users.find(u => u.isGM)).length === 0,
                "a GM was offered secret projects to discover, which they are already in on");

            /* ---- the wrong declaration never carries it -------------------- */
            const sweep = await observe.chooseObserveTarget({
                actorId: actor.id, declaration: "general"
            });
            // Either it found a trace and is not carrying the project, or it
            // found nothing at all. Both are the same assertion.
            const sweepShape = sweep?.ok ? observe.pendingShape(sweep.key) : null;
            ok(!sweepShape?.hasProject,
                "an ordinary sweep of the room was carrying its secret project");

            /* ---- and the right one does ----------------------------------- */
            const looking = await observe.chooseObserveTarget({
                actorId: actor.id, declaration: "nonObvious"
            });
            ok(looking?.ok,
                "looking for what does not belong found nothing to aim at in a room holding a secret project");
            ok(observe.pendingShape(looking.key)?.hasProject === true,
                "the non-obvious declaration was not carrying the room's secret project");

            /* ---- one under the bar ---------------------------------------- */
            await observe.resolveObserve({ key: looking.key, total: PROJECT_OBSERVE.dc - 1 });
            ok(projects.canSee(id, user) === false,
                "a roll one under the bar still found the secret project");

            /* ---- and the bar itself --------------------------------------- */
            const again = await observe.chooseObserveTarget({
                actorId: actor.id, declaration: "nonObvious"
            });
            ok(again?.ok, "the second look found nothing to aim at");
            await observe.resolveObserve({ key: again.key, total: PROJECT_OBSERVE.dc });
            ok(projects.canSee(id, user) === true,
                "a roll that met the bar did not find the secret project");
        } finally {
            for (const item of [...actor.items]) {
                if (itemsBefore.has(item.id)) continue;
                const uuid = item.uuid;
                await item.delete();
                await bullets.dropSecret?.(uuid);
            }
            /* A missed Observe costs Sanity, and this test deliberately misses
               one. Put back rather than left: the suite shares one world with
               every test after it, and a character quietly a mark closer to a
               breakdown is the kind of drift that surfaces three tests later
               as something else's failure. */
            if ((foundry.utils.getProperty(actor, stressPath) ?? 0) !== stressBefore) {
                await actor.update({ [stressPath]: stressBefore });
            }
            if (id) await projects.deleteProject(id);
        }
    }],

    ["a GM correcting what a trace is reaches the copies without telling anybody", async () => {
        /*
         * The column that used to hold free-text tags is a type picker now, and
         * a type is the answer key. So it has two halves and they pull opposite
         * ways: the correction MUST reach every copy's secret, or the next
         * analysis pays out the old category - and it must NOT reach the item of
         * a copy nobody has analysed, or the correction hands the answer to
         * everybody holding one.
         *
         * `propagateRealType` is called through `setRemnantFlags`, which is how
         * the dashboard reaches it; this exercises the function directly because
         * placing a token and opening the dashboard is a scenario's job, not a
         * unit test's.
         */
        const bullets = await import("./truth-bullets.mjs");
        const actor = game.actors.find(a => a.type === "character");
        ok(actor, "no character to hold a Truth Bullet");

        const fakeRemnantId = "suiteTraceForType";
        const made = [];
        try {
            const unread = await bullets.createTruthBullet(actor, {
                name: "Suite uncorrected copy", realType: "prep",
                remnantId: fakeRemnantId, sceneId: "suiteScene", playerText: "-"
            });
            const read = await bullets.createTruthBullet(actor, {
                name: "Suite analysed copy", realType: "prep", analyzed: true,
                remnantId: fakeRemnantId, sceneId: "suiteScene", playerText: "-"
            });
            ok(unread && read, "the fixture copies were not created");
            made.push(unread, read);

            ok(bullets.truthBulletData(unread).identified === false,
                "the unanalysed fixture copy was born identified");
            ok(bullets.truthBulletData(read).identified === true,
                "the analysed fixture copy was not born identified");

            const moved = await bullets.propagateRealType(fakeRemnantId, "resolution");
            ok(moved === 2, `the correction reached ${moved} copies instead of both`);

            /* Both answer keys moved... */
            ok(bullets.secretOf(unread.uuid).realType === "resolution"
                && bullets.secretOf(read.uuid).realType === "resolution",
                "the correction did not reach both answer keys");

            /* ...and only the analysed copy says so to its holder. */
            const un = bullets.truthBulletData(unread);
            const rd = bullets.truthBulletData(read);
            ok(un.shownType === "neutral",
                `the correction was published onto an unanalysed copy as "${un.shownType}"`);
            ok(rd.shownType === "resolution",
                `an analysed copy still shows "${rd.shownType}" after the correction`);
        } finally {
            for (const item of made) {
                const live = item?.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
        }
    }],

    ["throwing a broken thing away leaves a Prep trace before a murder and a Tamper one after", async () => {
        /*
         * It was always Prep, and the note that chose it argued for the other
         * one - "somebody tidying up around a crime", which is the Tamper type's
         * own definition. The table put it plainly: you throw things away AFTER.
         *
         * Only the decision is exercised, not a whole discard: `discardBroken`
         * wants a broken item, a trait roll and a token on a scene, and none of
         * those three is what this is about. What is worth pinning is that the
         * line is drawn on the world's state and in the right direction.
         */
        const { discardRemnantType } = await import("./use-items.mjs");
        const { BROKEN_ITEMS, REMNANT_TYPES } = await import("./config.mjs");

        ok(REMNANT_TYPES[BROKEN_ITEMS.remnantTypeBefore] && REMNANT_TYPES[BROKEN_ITEMS.remnantTypeAfter],
            "one of the two discard types is not a Remnant type at all");
        ok(BROKEN_ITEMS.remnantTypeAfter === "resolution",
            `after a murder a discard should leave the Tamper type, not "${BROKEN_ITEMS.remnantTypeAfter}"`);

        const settings = await import("./settings.mjs");
        const hadBody = settings.bodyDiscovery();
        const murder = await import("./murder.mjs");
        const running = Boolean(murder.murderState()?.active);

        const now = await discardRemnantType();
        /* The world the suite runs in decides which answer is correct, so the
           test asks the same two questions the function does rather than
           assuming a quiet world - a suite run during an incident must not fail
           for being right. */
        const expected = (running || hadBody)
            ? BROKEN_ITEMS.remnantTypeAfter : BROKEN_ITEMS.remnantTypeBefore;
        ok(now === expected,
            `a discard right now should leave "${expected}" and leaves "${now}"`
            + ` (incident: ${running}, body found: ${Boolean(hadBody)})`);
    }],

    ["Faint stays in the ledger until the bullet has been analysed", async () => {
        /*
         * Faint says two things: the connection is doubtful, and the trace is
         * exempt when a GM clears the table's evidence. Both are facts about the
         * OBJECT, which is what Analyze buys - and until 1.2.47 the flag was
         * written onto the player's item at creation, one line above
         * `tiedToCrime`, which is gated on `identified` for exactly this reason.
         * So the row's badge said "Faint" on a bullet nobody had analysed.
         *
         * Two halves, and the second is the one that would rot quietly: the flag
         * must be ABSENT before, and PRESENT after, because a fix that only did
         * the first would silently stop the chapter's clear from carrying
         * doubtful evidence across - which is the only thing Faint is for.
         */
        const bullets = await import("./truth-bullets.mjs");
        const actor = game.actors.find(a => a.type === "character");
        ok(actor, "no character to hold a Truth Bullet");
        const made = [];
        try {
            const item = await bullets.createTruthBullet(actor, {
                name: "Suite faint trace",
                realType: "prep",
                faint: true,
                playerText: "A smear on the handle."
            });
            ok(item, "the fixture bullet was not created");
            made.push(item);

            ok(!item.getFlag(MODULE_ID, bullets.TRUTH_BULLET_FLAGS.faint),
                "an unanalysed bullet carries Faint on the player's own item");
            ok(bullets.faintOf(item) === true,
                "the ledger did not keep Faint, so the chapter's clear would take it");

            const data = bullets.truthBulletData(item);
            ok(data.identified === false, "the fixture bullet was born identified");

            /* The badge is what the player reads, so it is asked directly rather
               than inferred from the flag: `bulletBadges` gates on `identified`
               as well, which is what makes an old world correct on its first
               load rather than on its second. */
            const sheet = await import("./sheet.mjs");
            ok(!sheet.bulletBadges(data).includes(">Faint<"),
                "the row's badges announced Faint before anybody analysed it");

            /* And the other half. `identify` is not exported - it is reached
               through a successful Analyze - so this writes what it writes, and
               the test that the two agree is `analyze.mjs` being the only writer
               of these three flags, which R1b's sweep over the source covers. */
            await item.update({
                [`flags.${MODULE_ID}.${bullets.TRUTH_BULLET_FLAGS.shownType}`]: "prep",
                [`flags.${MODULE_ID}.${bullets.TRUTH_BULLET_FLAGS.analyzed}`]: true,
                [`flags.${MODULE_ID}.${bullets.TRUTH_BULLET_FLAGS.faint}`]: bullets.faintOf(item)
            });
            const after = bullets.truthBulletData(item);
            ok(after.identified === true && after.faint === true,
                "an analysed bullet did not end up wearing Faint");
            ok(sheet.bulletBadges(after).includes(">Faint<"),
                "an analysed bullet's row does not say it is Faint");
        } finally {
            for (const item of made) {
                const live = item.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
        }
    }],

    ["the pack opens on where you are and folds the rest, whichever way it is grouped", async () => {
        /*
         * The two modes are one design: the group that is about NOW is open, the
         * rest are folds, and inside every group the newest evidence is first.
         * What is worth a test is that both modes really do have that shape -
         * "both tabs work identically" was the request, and two code paths that
         * are supposed to agree are exactly the pair that drift.
         *
         * NEWEST BY THE GAME'S CLOCK. The stamps are written by hand here rather
         * than by moving the world's clock between creations: this is a test of
         * the ORDERING, and making it depend on the clock's write path would be
         * testing two things and reporting one.
         */
        const bullets = await import("./truth-bullets.mjs");
        const sheet = await import("./sheet.mjs");
        const { getClock } = await import("./clock.mjs");
        const actor = game.actors.find(a => a.type === "character");
        ok(actor, "no character to hold a pack");

        const chapterNow = getClock().chapter;
        const made = [];
        try {
            /* Three finds: two in this chapter from two rooms, one older. The
               older one is deliberately created LAST, so a list that came out in
               creation order would fail rather than pass by accident. */
            const seed = [
                { name: "Suite newer here", room: "Kitchen",
                  stamp: { chapter: chapterNow, day: 3, timeOfDay: "night" } },
                { name: "Suite older here", room: "Kitchen",
                  stamp: { chapter: chapterNow, day: 3, timeOfDay: "morning" } },
                { name: "Suite elsewhere", room: "Library",
                  stamp: { chapter: chapterNow, day: 2, timeOfDay: "noon" } },
                { name: "Suite last chapter", room: "Kitchen",
                  stamp: { chapter: Math.max(0, chapterNow - 1), day: 1, timeOfDay: "noon" } }
            ];
            for (const row of seed) {
                const item = await bullets.createTruthBullet(actor, {
                    name: row.name, realType: "neutral", room: row.room, stamp: row.stamp,
                    playerText: "-"
                });
                ok(item, `the fixture bullet ${row.name} was not created`);
                made.push(item);
            }

            const pack = made.slice();
            const shapeOf = result => {
                const open = result.groups.filter(g => g.here);
                return {
                    mode: result.mode,
                    groups: result.groups.length,
                    open: open.length,
                    openFirst: result.groups[0]?.here === true,
                    counted: result.groups.reduce((n, g) => n + g.items.length, 0)
                };
            };

            await game.settings.set(MODULE_ID, "bulletSort", "chapter");
            const byChapter = sheet.bulletGroups(pack, actor);
            await game.settings.set(MODULE_ID, "bulletSort", "room");
            const byRoom = sheet.bulletGroups(pack, actor);
            await game.settings.set(MODULE_ID, "bulletSort", "chapter");

            for (const [name, result] of [["chapter", byChapter], ["room", byRoom]]) {
                const shape = shapeOf(result);
                ok(shape.counted === pack.length,
                    `grouping by ${name} lost or duplicated evidence: ${shape.counted} of ${pack.length}`);
                ok(shape.open === 1,
                    `grouping by ${name} opened ${shape.open} groups instead of exactly one`);
                ok(shape.openFirst,
                    `grouping by ${name} did not draw the open group first`);
            }

            /* Newest first INSIDE a group, and the two Kitchen finds are the pair
               that says so: same chapter, same day, different time of day. */
            const kitchen = byRoom.groups.find(g => g.key === "Kitchen");
            ok(kitchen, "the room grouping lost the Kitchen");
            const names = kitchen.items.map(i => i.name);
            ok(names.indexOf("Suite newer here") < names.indexOf("Suite older here"),
                `the night find did not come before the morning one: ${names.join(", ")}`);

            const thisChapter = byChapter.groups.find(g => g.key === String(chapterNow));
            ok(thisChapter && thisChapter.here,
                "grouping by chapter did not open the chapter the table is in");
        } finally {
            for (const item of made) {
                const live = item.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
        }
    }],

    ["clicking a number field's label focuses the field and does not press minus", async () => {
        /*
         * The stepper (chrome.mjs, 06.09) put a minus button in front of every number
         * input, inside its <label>. A label labels its first labelable descendant,
         * and a button is one - so "Day" in Edit campaign labelled the minus button,
         * the field had no name, and clicking the word "Day" moved the campaign from
         * day 11 to day 10. Found by the a11y sweep on 21.09, measured by clicking.
         */
        const { openClockDialog } = await import("./gm-panel.mjs");
        needs(env.dialogs(), "Edit campaign has no field to click");
        const before = new Set(foundry.applications.instances.keys());
        openClockDialog();
        let input = null;
        for (let i = 0; i < 40 && !input; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            input = document.querySelector('input[name="day"][data-drpg-chrome="step"]');
        }
        try {
            ok(input, "the Edit campaign window did not draw its day stepper");
            const label = input.closest("label");
            ok(label, "the day field is no longer inside its label");
            equal(label.control, input, "the day's label names something other than the day field");
            const was = input.value;
            label.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            await settle();
            equal(input.value, was, "clicking the word \"Day\" changed the day");
        } finally {
            for (const app of [...foundry.applications.instances.values()]) {
                if (before.has(app.id)) continue;
                try { await app.close({ animate: false }); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["an incident's trace keeps the public word on its token until somebody finds it", async () => {
        /*
         * D11 creates an incident's traces un-hidden so a participant's client can
         * draw them, and every client reads a token's name. Writing a trace's public
         * name onto that token the moment it was set published it before anybody had
         * looked - reached from the case panel's "New trace" (N-4), review of stage D.
         * And once somebody has found it the token still says the word (E05 C13,
         * 27.09.2026; audit S05-39 (1)): until then it took the name at the first
         * copy, where every console read it. The next test holds an ordinary trace.
         */
        const [one] = cast(1);
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const said = `Kettle, still warm ${Date.now() % 100000}`;
        const word = game.i18n.localize("DRPG.Remnant.tokenName");
        let token = null, copy = null;
        try {
            token = await remnants.placeRemnant({
                type: "incident", visibility: "evident", tiedToCrime: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene, note: "test fixture - incident name"
            });
            ok(token, "could not place the fixture trace");
            /* Placed with no incident running it is created hidden since E05 C14 (S05-42); an
               incident's own trace is not, and that is the token this test holds. */
            if (token.hidden) await token.update({ hidden: false });
            equal(scene.tokens.get(token.id)?.hidden, false, "the fixture trace could not be revealed - this test measures nothing");
            await remnants.setRemnantPublic(token, { name: said });
            await settle();
            equal(scene.tokens.get(token.id)?.name, word,
                "an incident trace nobody has found carries its public name on the token every client reads");
            equal(remnants.remnantPublic(token)?.name, said, "the ledger did not keep the name");

            copy = await bullets.createTruthBullet(one, {
                name: said, realType: "incident", visibility: "evident",
                remnantId: token.id, sceneId: scene.id
            });
            await remnants.setRemnantPublic(token, { name: said });
            await settle();
            equal(scene.tokens.get(token.id)?.name, word, "a found incident trace carries its public name on the token every client reads");
            equal(one.items.get(copy?.id)?.name, said, "the finder's copy did not keep the trace's name - the name went nowhere");
        } finally {
            try { await copy?.delete(); } catch { /* already gone */ }
            if (token) {
                try { await remnants.dropRemnantSecret(token); } catch { /* nothing filed */ }
                try { await token.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["a found trace's token keeps the neutral name", async () => {
        /*
         * E05 C13, 27.09.2026; audit S05-39 (1). A found trace's token took its public name and
         * image, and every browser holds every token: a player who had found nothing read what
         * somebody else had found, and where it lay, from the console. The token keeps the
         * neutral word and the question mark now, and each screen that may know draws the rest
         * itself (remnant-icons.mjs `shownOnTrace`) - a GM's from the row, as asked here, a
         * finder's from their own copy, which 72-canary asks on a player's browser. An ordinary
         * trace, hidden, named with an image of its own, then copied onto a student's sheet -
         * which reveals it - and renamed: the token is revealed, and says the word and wears the
         * question mark throughout; the copy carries the name; this GM's screen names the trace
         * from its row. The drawing itself - the nameplate - is PIXI's, and read last: the
         * harness has no canvas, so there the test stands down at that line (LIVE-E05-05).
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen, where a canvas draws it");
        const [one] = cast(1);
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const icons = await import("./remnant-icons.mjs");
        const scene = canvas.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const word = game.i18n.localize("DRPG.Remnant.tokenName");
        const said = `SUITE a cracked mug ${foundry.utils.randomID(6)}`;
        const renamed = `${said}, chipped`;
        const IMG = "icons/svg/item-bag.svg";
        let token = null, copy = null;
        const face = () => {
            const t = scene.tokens.get(token?.id);
            return [t?.hidden ?? null, t?.name ?? null, t?.texture?.src ?? null];
        };
        try {
            token = await remnants.placeRemnant({ type: "prep", visibility: "evident", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - a found trace's name" });
            ok(token, "could not place the fixture trace");
            equal(token.hidden, true, "an ordinary trace is not created hidden - the find below reveals nothing");
            await remnants.setRemnantPublic(token, { name: said, img: IMG });
            copy = await bullets.createTruthBullet(one, { name: said, img: IMG, realType: "prep", visibility: "evident",
                remnantId: token.id, sceneId: scene.id });
            ok(copy, "no copy was made");
            await settle();
            equal(stableJson(face()), stableJson([false, word, remnants.ICON]),
                "a found trace's token is not revealed, or carries its public name or image, which every browser reads");
            await remnants.setRemnantPublic(token, { name: renamed });
            await settle();
            equal(stableJson([...face(), one.items.get(copy.id)?.name ?? null]), stableJson([false, word, remnants.ICON, renamed]),
                "a rename reached the found trace's token, or did not reach the finder's copy");
            equal(stableJson(icons.shownOnTrace(scene.tokens.get(token.id))), stableJson({ name: renamed, img: IMG }),
                "this GM's screen does not name the trace, or dress it, from its row");

            needs(env.canvas(), "the nameplate is PIXI's (LIVE-E05-05)");
            icons.repaintRemnants();
            await settle();
            const drawn = canvas.tokens?.get(token.id);
            ok(drawn?.nameplate, "the trace's token has no nameplate on this canvas - its name is drawn somewhere this test does not read");
            equal(drawn.nameplate.text, renamed, "this GM's canvas does not draw the trace's name from its row");
        } finally {
            if (copy) {
                await bullets.dropSecret(copy.uuid);
                try { await copy.delete(); } catch { /* already gone */ }
            }
            if (token) {
                try { await remnants.dropRemnantSecret(token); } catch { /* nothing filed */ }
                try { await token.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["a bullet carries no remnantRef, and its owner's copy maps it", async () => {
        /*
         * E05 C13, 27.09.2026; audit S05-39 (2). A bullet copied from a trace named the trace
         * in its public `remnantRef` flag, and every browser holds every item: a console listed
         * which traces had been found, and by whom. The key is the bullet's row's now (`sceneId`,
         * `remnantId`), and each player holds a copy of their own bullets' keys (gm-stores.mjs
         * `bulletRefCopy`). A copy made on a player's character: the item carries no
         * `remnantRef` at all; this GM reads the key off the row; the answer a GM sends the
         * owner names the bullet, with the key and a stamp, and the answer to another player
         * names nothing of it; that answer, received here as the owner's browser receives it,
         * maps the bullet to its trace, and an older one is refused. Nothing is sent while tier
         * 2 holds the stores (`gmStoresQuiet`), so 72-canary reads the copy on the owner's
         * browser and on another player's; this browser's own copy is emptied after.
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        needs(world.atLeast("playersWithCharacter", 1), "the copy is made on a character a player owns");
        needs(world.atLeast("playerAccounts", 2), "the owner's answer and another player's are compared");
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const S = await import("./gm-stores.mjs");
        const scene = canvas.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const owns = (user, actor) => actor.type === "character" && actor.testUserPermission(user, "OWNER");
        const owner = game.users.find(u => !u.isGM && game.actors.some(a => owns(u, a)));
        const holder = game.actors.find(a => owns(owner, a));
        const other = game.users.find(u => !u.isGM && !owns(u, holder));
        ok(other, `every player account owns ${holder.name} - there is nobody the answer must leave out`);
        let token = null, copy = null;
        try {
            token = await remnants.placeRemnant({ type: "prep", visibility: "evident", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - a bullet's trace key" });
            ok(token, "could not place the fixture trace");
            copy = await bullets.createTruthBullet(holder, { name: "SUITE a bent key", realType: "prep", visibility: "evident",
                remnantId: token.id, sceneId: scene.id });
            ok(copy, "no copy was made");
            const key = remnants.keyOf(token);
            equal(stableJson([Object.hasOwn(copy.flags?.[MODULE_ID] ?? {}, "remnantRef"), bullets.bulletRefOf(copy), bullets.truthBulletData(copy)?.remnantRef]),
                stableJson([false, key, key]), "the bullet names its trace in its flags, which every browser reads - or this GM does not read the key off its row");
            const toOwner = bullets.bulletRefsFor(owner.id), toOther = bullets.bulletRefsFor(other.id);
            equal(stableJson([toOwner.refs[copy.uuid] ?? null, toOwner.stamps[copy.uuid] > 0, copy.uuid in toOther.stamps, copy.uuid in toOther.refs]),
                stableJson([key, true, false, false]), "the owner's answer does not name the bullet with its key and a stamp, or another player's names it");
            equal(await bullets.receiveBulletRefs(toOwner.refs, toOwner.stamps), true, "the owner's answer was not taken");
            equal(S.bulletRefCopy.read()?.[copy.uuid] ?? null, key, "the copy does not map the bullet to its trace");
            equal(await bullets.receiveBulletRefs({ [copy.uuid]: "SUITESCENE000001.SUITETOKEN000001" }, { [copy.uuid]: toOwner.stamps[copy.uuid] - 1 }),
                false, "an older answer was taken over the copy");
        } finally {
            try { await S.bulletRefCopy.forget(); } catch { /* nothing kept */ }
            if (copy) {
                await bullets.dropSecret(copy.uuid);
                try { await copy.delete(); } catch { /* already gone */ }
            }
            if (token) {
                try { await remnants.dropRemnantSecret(token); } catch { /* nothing filed */ }
                try { await token.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["a looted body's trace and what left it are the GMs' row, and the body carries no flag of it", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-39 (3). A looted body carried a `lootTrace` flag - its
         * trace's token id and every item's name taken off it - which every browser holds: a
         * console read which trace on the map was the body's and what had left it. It is a row of
         * the GMs' `lootTraces` store now. Two items are taken off a dead student one after the
         * other: one trace for both (the row names it, and it stands on the map as a loot's), the
         * row lists both names, and the body carries no such flag. Put back after: the taker's new
         * items, the trace, the row, the body alive.
         */
        needs(world.atLeast("studentTokensOnScreen"), "a body with no token leaves no trace (trap 142), and the row names the trace");
        const [taker, body] = cast(2);
        const { killCharacter, reviveCharacter } = await import("./chapter.mjs");
        const { lootBody } = await import("./handover.mjs");
        const { lootTraceStore } = await import("./gm-stores.mjs");
        const { grantItem } = await import("./inventory.mjs");
        const remnants = await import("./remnants.mjs");
        ok(remnants.tokenFor(body), "the body has no token on any scene: a body with no token leaves no trace (trap 142), and this measures nothing");
        const had = new Set(taker.items.map(i => i.id));
        const traceOf = row => (row?.tokenId ? game.scenes.get(row.sceneId)?.tokens?.get(row.tokenId) ?? null : null);
        try {
            ok(await killCharacter(body, { secret: false, keepBullets: true }), "the death was not recorded");
            const put = name => grantItem(body, { name, category: "tool", tier: 1, override: true, quiet: true });
            const first = await put("SUITE C14 a torch");
            const second = await put("SUITE C14 a rope");
            ok(first && second, "the fixture items were not put on the body");
            ok(await lootBody({ takerId: taker.id, bodyId: body.id, itemId: first.id }), "the first loot took nothing");
            ok(await lootBody({ takerId: taker.id, bodyId: body.id, itemId: second.id }), "the second loot took nothing");
            await settle();
            const row = lootTraceStore.get(body.id);
            const trace = traceOf(row);
            equal(stableJson([row?.taken ?? null, Boolean(trace), trace ? remnants.remnantData(trace)?.action ?? null : null]),
                stableJson([["SUITE C14 a torch", "SUITE C14 a rope"], true, "loot"]),
                "the GMs' row does not list both items taken, or does not name the body's one loot trace");
            equal(stableJson(body.flags?.[MODULE_ID]?.lootTrace ?? null), "null", "the body carries its loot trace in a flag every browser reads");
        } finally {
            for (const item of taker.items.filter(i => !had.has(i.id))) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            const trace = traceOf(lootTraceStore.get(body.id));
            if (trace) {
                try { await remnants.dropRemnantSecret(trace); } catch { /* nothing filed */ }
                try { await trace.delete(); } catch { /* already gone */ }
            }
            if (lootTraceStore.has(body.id)) await lootTraceStore.drop(body.id);
            for (const item of body.items.filter(i => i.name.startsWith("SUITE C14"))) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            await reviveCharacter(body, { quiet: true });
            await settle();
        }
    }],

    ["a body looted before anybody found it gives its taker no word of it until the death is published", async () => {
        /*
         * E05 fix r2-F0b, 27.09.2026; the owner's Q1-Q3 (the plan's section 9), seen by C16. A body
         * nobody has found may be searched by those who know of the death (Q2), and the taker was
         * handed the Truth Bullet of it at once - "“X”, taken from a body", "Taken from {who}'s
         * body." - an item on the taker's sheet, which every console reads, naming a death the
         * table had not been told of. The item moving between the two sheets is all of a loot
         * that world data holds then (Q2's choice); the bullet is owed by the death's row in the
         * GMs' store and minted by the publication, dated when the loot was. A secret death, and
         * two things put on the body and taken by the GM's hand: what reached the taker's sheet is
         * read as it arrived (the creations) and as it rests - on e47a5d5 each bullet's creation
         * named the body, and the second's words stayed at rest (the first's trace, revealed by
         * its mint, put its neutral word over them). The day in the row's owed loot is moved on,
         * as a loot on another day writes it, so each bullet's day says which one the mint read;
         * and both keep the loot's words, the first too since its trace is revealed before it is
         * made (handover.mjs `mintLootBullet`). Put back after: the taker's new items, the trace,
         * the rows, the body alive.
         */
        needs(world.atLeast("studentTokensOnScreen"), "a body with no token leaves no trace and warns the GMs instead (trap 142)");
        const [taker, body] = cast(2);
        const { killCharacter, reviveCharacter, publishDeath, isDeceased } = await import("./chapter.mjs");
        const { lootBody, owedLoot } = await import("./handover.mjs");
        const { lootTraceStore, deathStore } = await import("./gm-stores.mjs");
        const { grantItem } = await import("./inventory.mjs");
        const { isTruthBullet } = await import("./truth-bullets.mjs");
        const remnants = await import("./remnants.mjs");
        const ITEMS = ["SUITE F0b a watch", "SUITE F0b a rope"];
        const had = new Set(taker.items.map(i => i.id));
        const fresh = () => taker.items.filter(i => !had.has(i.id));
        const names = i => `${i.name} ${i.system?.description ?? ""} ${JSON.stringify(i.flags?.[MODULE_ID] ?? {})}`.includes(body.name);
        const read = i => [i.name, isTruthBullet(i), names(i)];
        try {
            ok(await killCharacter(body, { secret: true, keepBullets: true }), "the secret death was not recorded");
            ok(!isDeceased(body) && deathStore.has(body.id), "the death is not the GMs' alone");
            const arrived = [];
            const onCreate = i => { if (i.parent?.id === taker.id) arrived.push(read(i)); };
            Hooks.on("createItem", onCreate);
            try {
                for (const name of ITEMS) {
                    const put = await grantItem(body, { name, category: "tool", tier: 1, override: true, quiet: true });
                    ok(put, "the fixture item was not put on the body");
                    ok(await lootBody({ takerId: taker.id, bodyId: body.id, itemId: put.id }), "a loot before the publication took nothing");
                }
                await settle();
            } finally {
                Hooks.off("createItem", onCreate);
            }
            const items = ITEMS.map(name => [name, false, false]);
            equal(stableJson([arrived, fresh().map(read)]), stableJson([items, items]),
                "before the death was published more than the items reached the taker, or something that did names the body");
            const owed = owedLoot(deathStore.get(body.id));
            equal(stableJson(owed.map(l => [l.takerId, l.item])), stableJson(ITEMS.map(name => [taker.id, name])),
                "the death's row does not owe the taker each loot's bullet");
            const day = (Number(owed[0].day) || 0) + 7;
            const loot = deathStore.get(body.id).loot;
            await deathStore.patch(body.id, { loot: Object.fromEntries(Object.entries(loot).map(([key, l]) => [key, { ...l, day }])) });

            await publishDeath(body);
            await settle();
            const minted = fresh().filter(i => isTruthBullet(i));
            equal(stableJson([minted.map(i => [i.name, i.getFlag(MODULE_ID, "playerText"), i.getFlag(MODULE_ID, "day")]), deathStore.has(body.id)]),
                stableJson([ITEMS.map(item => [game.i18n.format("DRPG.Loot.bulletName", { item }),
                    game.i18n.format("DRPG.Loot.bulletText", { item, who: body.name }), day]), false]),
                "the publication did not give the taker each owed bullet with the loot's words naming the body, dated by the loot, or kept the row");
            await publishDeath(body);
            equal(fresh().filter(i => isTruthBullet(i)).length, ITEMS.length, "a second publication gave the bullets again");
        } finally {
            for (const i of fresh()) {
                try { await i.delete(); } catch { /* already gone */ }
            }
            const row = lootTraceStore.get(body.id);
            const trace = row?.tokenId ? game.scenes.get(row.sceneId)?.tokens?.get(row.tokenId) ?? null : null;
            if (trace) {
                try { await remnants.dropRemnantSecret(trace); } catch { /* nothing filed */ }
                try { await trace.delete(); } catch { /* already gone */ }
            }
            if (lootTraceStore.has(body.id)) await lootTraceStore.drop(body.id);
            for (const i of body.items.filter(i => i.name.startsWith("SUITE F0b"))) {
                try { await i.delete(); } catch { /* already gone */ }
            }
            await reviveCharacter(body, { quiet: true });
            await settle();
        }
    }],

    ["a copy of a looted body's trace found before the death is published says no loot until it is", async () => {
        /*
         * E05 fix r2-G4, 27.09.2026; F0b's note, the plan's rule A. One who knows of a death
         * nobody has found may loot the body (Q2), and its loot trace, placed hidden at the body,
         * may be found by one who knows before the discovery. The copy is an item every console
         * reads, and its `sourceAction` "loot" - which nothing but a body leaves - went onto it at
         * a critical find and at an Analyze: a death the table had not been told of. Two copies of
         * the trace, made as Observe's `createFind` makes them (a critical, and an ordinary find
         * then analysed): neither item names the loot while the death is the GMs' alone, the rows
         * keep it, and the publication puts it on both (red on 40ac88d: both items said "loot"
         * before it). Put back after: the taker's new items, the trace, the rows, the body alive.
         */
        needs(world.atLeast("studentTokensOnScreen"), "a body with no token leaves no trace and warns the GMs instead (trap 142)");
        const [taker, body] = cast(2);
        const { killCharacter, reviveCharacter, publishDeath } = await import("./chapter.mjs");
        const { lootBody } = await import("./handover.mjs");
        const { lootTraceStore } = await import("./gm-stores.mjs");
        const { grantItem } = await import("./inventory.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { resolveAnalyze } = await import("./analyze.mjs");
        const remnants = await import("./remnants.mjs");
        const had = new Set(taker.items.map(i => i.id));
        const fresh = () => taker.items.filter(i => !had.has(i.id));
        const shown = i => taker.items.get(i?.id)?.getFlag(MODULE_ID, "sourceAction") ?? null;
        try {
            ok(await killCharacter(body, { secret: true, keepBullets: true }), "the secret death was not recorded");
            const put = await grantItem(body, { name: "SUITE G4 a lighter", category: "tool", tier: 1, override: true, quiet: true });
            ok(put && await lootBody({ takerId: taker.id, bodyId: body.id, itemId: put.id }), "the loot before the publication took nothing");
            await settle();
            const trace = lootTraceStore.get(body.id);
            ok(trace?.tokenId, "the loot left no trace - this measures nothing");
            const copy = { realType: "neutral", visibility: "subtle", remnantId: trace.tokenId, sceneId: trace.sceneId, sourceAction: "loot", tiedToCrime: true };
            const critical = await bullets.createTruthBullet(taker, { ...copy, name: "SUITE G4 a critical find", shownType: "neutral", analyzed: true });
            const plain = await bullets.createTruthBullet(taker, { ...copy, name: "SUITE G4 an ordinary find" });
            ok(critical && plain && !bullets.isIdentified(plain), "the two copies were not made as a critical and an ordinary find");
            await resolveAnalyze({ actorId: taker.id, itemId: plain.id, total: 40 });
            await settle();
            ok(bullets.isIdentified(taker.items.get(plain.id)), "the Analyze did not identify the ordinary find - this measures nothing");
            equal(stableJson([shown(critical), shown(plain), bullets.secretOf(critical.uuid).sourceAction, bullets.secretOf(plain.uuid).sourceAction]),
                stableJson([null, null, "loot", "loot"]),
                "before the death was published a copy's item named the loot, or its row lost it");

            await publishDeath(body);
            await settle();
            equal(stableJson([shown(critical), shown(plain)]), stableJson(["loot", "loot"]), "the publication did not put the loot on the identified copies");
        } finally {
            for (const i of fresh()) {
                try { await bullets.dropSecret?.(i.uuid); } catch { /* nothing filed */ }
                try { await i.delete(); } catch { /* already gone */ }
            }
            const row = lootTraceStore.get(body.id);
            const token = row?.tokenId ? game.scenes.get(row.sceneId)?.tokens?.get(row.tokenId) ?? null : null;
            if (token) {
                try { await remnants.dropRemnantSecret(token); } catch { /* nothing filed */ }
                try { await token.delete(); } catch { /* already gone */ }
            }
            if (lootTraceStore.has(body.id)) await lootTraceStore.drop(body.id);
            for (const i of body.items.filter(i => i.name.startsWith("SUITE G4"))) {
                try { await i.delete(); } catch { /* already gone */ }
            }
            await reviveCharacter(body, { quiet: true });
            await settle();
        }
    }],

    ["a closed incident's traces nobody copied are hidden, none stays marked, and one placed with none running is hidden", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-42. D11 creates an incident's traces un-hidden and marked
         * `fromIncident`, so its participants' clients draw them - and that client asks only whether
         * AN incident is running and whether its viewer is in it. The cast of every later incident
         * was drawn every earlier one's trace nobody had copied. Two incident traces are placed while
         * one runs, and a bullet is copied from one of them; the incident is closed: the other is
         * hidden, the copied one stays revealed for its finder, and neither is marked any more. A
         * trace of the incident type placed with no incident running is created hidden and unmarked.
         * Drawing is not measured here - no canvas - only what every browser's copy of the token says.
         */
        needs(world.atLeast("sceneOnScreen"), "the incident's traces are placed on the scene on screen");
        const [killer, victim, finder] = cast(3);
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const at = { x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene };
        const now = t => {
            const d = scene.tokens.get(t?.id);
            return [d?.hidden ?? null, d?.getFlag(MODULE_ID, "fromIncident") ?? null];
        };
        equal(murder.murderState(), null, "an incident was already running when this test started");
        const placed = [], made = [];
        try {
            await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
            await settle();
            ok(murder.murderState(), "no incident opened");
            const lost = await remnants.placeRemnant({ type: "incident", visibility: "evident", ...at, note: "SUITE C14 an incident's trace nobody finds" });
            const found = await remnants.placeRemnant({ type: "incident", visibility: "evident", ...at, note: "SUITE C14 an incident's trace somebody copies" });
            placed.push(lost, found);
            equal(stableJson([now(lost), now(found)]), stableJson([[false, true], [false, true]]),
                "an incident's traces are not created un-hidden and marked while it runs - this test measures nothing");
            made.push(await bullets.createTruthBullet(finder, { name: "SUITE C14 a copy", realType: "incident", visibility: "evident",
                remnantId: found.id, sceneId: scene.id }));
            ok(made[0], "no bullet was copied from the found trace");

            await murder.endMurder({ reason: "test", followUp: false });
            await settle();
            equal(stableJson([now(lost), now(found)]), stableJson([[true, null], [false, null]]),
                "the closed incident's trace nobody copied is not hidden, the copied one was hidden from its finder, or one is still marked as an incident's");
            equal(await remnants.retireIncidentTraces(), null, "a second pass found a trace still marked as an incident's");

            const after = await remnants.placeRemnant({ type: "incident", visibility: "evident", ...at, note: "SUITE C14 an incident's trace with none running" });
            placed.push(after);
            equal(stableJson(now(after)), stableJson([true, null]), "an incident's trace placed with no incident running is not created hidden and unmarked");
        } finally {
            if (murder.murderState()) await murder.endMurder({ reason: "test", followUp: false });
            for (const item of made) {
                try { await item?.delete(); } catch { /* already gone */ }
            }
            for (const t of placed.filter(Boolean)) {
                try { await remnants.dropRemnantSecret(t); } catch { /* nothing filed */ }
                try { await t.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the clause takes an older incident's marks off its traces at the update, and a running incident keeps its own", async () => {
        /*
         * E05 fix r2-G4, 27.09.2026; review S2-m4. Since C14 an incident's close retires its
         * traces' `fromIncident` marks; every incident closed before 1.2.64 left them, and the
         * first incident run after the update drew those traces for its cast (visibility.mjs
         * `myIncidentTrace` asks only whether an incident runs). The clause `retireOldIncidentMarks`
         * retires them at the first load. Fixtures, handed to it (the clause reads the world; the
         * suite touches none of a table's traces): two marked, un-hidden incident traces from
         * before - one with a row from before the upgrade, one with no row. With no incident
         * running both are hidden and unmarked (red on 40ac88d: the routine did not exist). Then an
         * incident opens and places its own trace, and a third old one is marked: the clause
         * retires the old one and the running incident's keeps its mark and stays in view. Drawing
         * is not measured - no canvas - only what every browser's copy of the token says.
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture traces stand on the scene on screen");
        const [killer, victim] = cast(2);
        const murder = await import("./murder.mjs");
        const R = await import("./remnants.mjs");
        const { remnantStore } = await import("./gm-stores.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const now = t => {
            const d = scene.tokens.get(t?.id);
            return [d?.hidden ?? null, d?.getFlag(MODULE_ID, "fromIncident") ?? null];
        };
        const placed = [];
        const oldTrace = async (row = true) => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{ name: game.i18n.localize("DRPG.Remnant.tokenName"),
                actorId: R.findRemnantActor()?.id ?? null, actorLink: false, x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: false,
                flags: { [MODULE_ID]: { isRemnant: true, fromIncident: true } } }]);
            ok(t, "could not place a fixture trace");
            placed.push(t);
            if (row) await remnantStore.patch(R.keyOf(t), { type: "incident", visibility: "evident", note: "SUITE G4 an old incident's trace" }, { weak: true });
            return t;
        };
        equal(murder.murderState(), null, "an incident was already running when this test started");
        try {
            const [filed, unfiled] = [await oldTrace(), await oldTrace(false)];
            const done = await R.retireOldIncidentMarks({ tokens: [filed, unfiled] });
            equal(stableJson([now(filed), now(unfiled), done?.retired ?? null]), stableJson([[true, null], [true, null], 2]),
                "with no incident running, an older incident's trace nobody copied is still in view or still marked");

            await game.drpg.openMurder({ killerId: killer.id, victimId: victim.id });
            await settle();
            ok(murder.murderState(), "no incident opened");
            const own = await R.placeRemnant({ type: "incident", visibility: "evident", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "SUITE G4 the running incident's trace" });
            if (own) placed.push(own);
            const older = await oldTrace();
            equal(stableJson(now(own)), stableJson([false, true]), "the running incident's trace is not un-hidden and marked - this measures nothing");
            await R.retireOldIncidentMarks({ tokens: [own, older] });
            equal(stableJson([now(own), now(older)]), stableJson([[false, true], [true, null]]),
                "with an incident running, its own trace lost its mark or an older one kept its own");
        } finally {
            if (murder.murderState()) await murder.endMurder({ reason: "test", followUp: false });
            for (const t of placed.filter(Boolean)) {
                try { await R.dropRemnantSecret(t); } catch { /* nothing filed */ }
                try { await t.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the Remnant and project actors are found by their flag, and by name only while they hold nothing", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-41. Both base actors were looked up by their names,
         * "Remnant" and "DRPG Project", though each is created carrying its flag: a GM's own
         * adversary called "Remnant" was raised to OBSERVER for every player at each load, and
         * every trace became a token of it. Pure first, on fakes: the flag wins over the name, a
         * named actor holding an item is never taken, and an older world's empty one still is.
         * Then in this world: the module's Remnant actor renamed (so that a lookup by name meets
         * the GM's first) and a GM's "Remnant" holding an item beside it - the reconcile at load
         * leaves the GM's at its level, and a trace is placed as a token of the module's. Put back.
         */
        const R = await import("./remnants.mjs");
        const P = await import("./projects-map.mjs");
        const fake = (name, { flag = null, items = 0 } = {}) => ({ name, items: { size: items }, effects: { size: 0 },
            getFlag: (scope, key) => (scope === MODULE_ID && key === flag ? true : undefined) });
        const ours = fake("SUITE renamed", { flag: "isRemnant" }), theirs = fake("Remnant", { items: 2 }), older = fake("Remnant");
        equal(stableJson([R.findRemnantActor([theirs, ours]) === ours, R.findRemnantActor([theirs]), R.findRemnantActor([theirs, older]) === older]),
            stableJson([true, null, true]), "the Remnant actor is not the flagged one, a named actor holding items was taken, or an older world's empty one was not");
        const board = fake("SUITE renamed", { flag: "projectId" }), gmOwn = fake("DRPG Project", { items: 1 }), oldBoard = fake("DRPG Project");
        equal(stableJson([P.findProjectActor([gmOwn, board]) === board, P.findProjectActor([gmOwn]), P.findProjectActor([gmOwn, oldBoard]) === oldBoard]),
            stableJson([true, null, true]), "the project actor is not the flagged one, a named actor holding items was taken, or an older world's empty one was not");

        needs(world.atLeast("sceneOnScreen"), "the trace is placed on the scene on screen");
        const module = R.findRemnantActor();
        ok(module?.getFlag(MODULE_ID, "isRemnant"), "this world has no flagged Remnant actor to find");
        const name = module.name;
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        let gms = null, trace = null;
        try {
            await module.update({ name: "SUITE C14 the module's Remnant" });
            [gms] = await Actor.createDocuments([{ name: "Remnant", type: "npc", ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE } }]);
            ok(gms, "could not make the GM's own actor");
            await gms.createEmbeddedDocuments("Item", [{ name: "SUITE C14 a claw", type: "loot" }]);
            ok(game.actors.getName("Remnant")?.id === gms.id, "a lookup by name does not meet the GM's actor - this measures nothing");
            await R.reconcileRemnantActor();
            trace = await R.placeRemnant({ type: "prep", visibility: "subtle", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene, note: "SUITE C14 whose token" });
            equal(stableJson([game.actors.get(gms.id)?.ownership?.default ?? null, trace?.actorId ?? null]),
                stableJson([CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, module.id]),
                "the GM's own \"Remnant\" was raised for the players, or a trace was placed as a token of it");
        } finally {
            if (trace) {
                try { await R.dropRemnantSecret(trace); } catch { /* nothing filed */ }
                try { await trace.delete(); } catch { /* already gone */ }
            }
            if (gms) {
                try { await gms.delete(); } catch { /* already gone */ }
            }
            if (module.name !== name) await module.update({ name });
            await settle();
        }
    }],

    ["Tamper names a trace of one's own by one's own copy, and the reshape card keeps its ruling for the GMs", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-14. Tamper's list labelled every trace with its band and
         * its real category off the ledger, and opening the menu costs nothing: an investigator
         * holding an unanalysed copy read the category an Analyze exists to price. Off Stage 6 a
         * trace of one's own is labelled by one's own copy's name now. A trace placed where a
         * student stands, and copied onto their sheet: its row in their list is "<copy> (your
         * copy)", with neither the band nor the category. And the reshape card's "was/now" line
         * and the killer's tie line are the GMs' part of the card (`gmBody`), not the player's.
         */
        needs(world.atLeast("studentTokensOnScreen"), "a student with a token has to stand in the trace's room");
        const { cleanableTracesForPlayer, isCleaner, reshapeCardParts } = await import("./cleanup.mjs");
        const { locateActor } = await import("./movement.mjs");
        const { studentActors } = await import("./monokuma.mjs");
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const scene = canvas.scene;
        const student = studentActors().find(a => scene?.tokens?.some(t => t.actorId === a.id) && !isCleaner(a) && locateActor(a)?.room);
        ok(student, "no student with a token on the scene on screen stands in a room outside Stage 6");
        const stand = scene.tokens.find(t => t.actorId === student.id);
        let trace = null, copy = null;
        try {
            trace = await remnants.placeRemnant({ type: "prep", visibility: "evident", x: stand.x, y: stand.y, scene,
                room: locateActor(student).room, note: "SUITE C14 a trace of one's own" });
            ok(trace, "could not place the fixture trace");
            copy = await bullets.createTruthBullet(student, { name: "SUITE C14 my copy", realType: "prep", visibility: "evident",
                remnantId: trace.id, sceneId: scene.id });
            ok(copy, "could not copy the trace onto the student's sheet");
            const data = remnants.remnantData(trace);
            const row = cleanableTracesForPlayer(student.id, { mine: true }).find(t => t.id === trace.id);
            /* The copy's name as it stands, not the one it was created with: the copy takes its
               trace's public name (truth-bullets.mjs `propagateRemnantPublic`), the neutral word
               while nobody has described it - measured 27.09.2026, the first run read "Trace". */
            const mine = student.items.get(copy.id)?.name ?? copy.name;
            equal(row?.label ?? null, game.i18n.format("DRPG.Tamper.yourCopy", { name: mine }),
                "a trace of one's own is not labelled by one's own copy in the Tamper list");
            ok(!row.label.includes(data.typeLabel) && !row.label.includes(data.visibilityLabel),
                `the Tamper list names the trace's category or band: ${row.label}`);

            const parts = reshapeCardParts(data, { name: "SUITE C14 a kettle", text: "SUITE C14 it was always there", tie: true });
            const ties = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Cleanup.reshapeRulingTies"));
            equal(stableJson([parts.body.includes("SUITE C14 a kettle"), parts.body.includes(data.typeLabel), parts.body.includes(ties),
                parts.gmBody.includes(data.typeLabel), parts.gmBody.includes(ties)]), stableJson([true, false, false, true, true]),
                "the reshape card's player part holds the trace's category or the tie line, or its GMs' part lacks them");
        } finally {
            try { await copy?.delete(); } catch { /* already gone */ }
            if (trace) {
                try { await remnants.dropRemnantSecret(trace); } catch { /* nothing filed */ }
                try { await trace.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the Faint Prep promotion offers no trace already tied to the crime, and writes what it ticks into the ledger alone", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-06, S06-02. `promoteFaintPrep` (chapter.mjs), at a body's
         * discovery, lists the Faint Prep traces and the GM ticks the murder's. It offered one already
         * tied to the crime - a hand-ticked box, a trace that delivered the weapon - as though it were
         * still a question; and until E04 it wrote the ticks onto the token, where every console read
         * them and nothing else did. Nothing drove it until now. Two Faint Prep traces, one of them
         * tied; the window, answered here, must list the other alone; ticked, its row reads faint no
         * more and tied to the crime, and its token carries nothing but `isRemnant`. Put back.
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture traces are placed on the scene on screen");
        const { promoteFaintPrep } = await import("./chapter.mjs");
        const remnants = await import("./remnants.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const at = { x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene };
        const D = foundry.applications.api.DialogV2;
        const own = Object.getOwnPropertyDescriptor(D, "wait");
        const placed = [];
        let listed = null;
        try {
            const open = await remnants.placeRemnant({ type: "prep", visibility: "subtle", faint: true, tiedToCrime: false, ...at, subject: "SUITE C14 still a question" });
            const tied = await remnants.placeRemnant({ type: "prep", visibility: "subtle", faint: true, tiedToCrime: true, ...at, subject: "SUITE C14 already tied" });
            placed.push(open, tied);
            ok(open && tied, "could not place the fixture traces");
            D.wait = async cfg => {
                const el = document.createElement("div");
                if (typeof cfg?.content === "string") el.innerHTML = cfg.content;
                else if (cfg?.content) el.append(cfg.content.cloneNode(true));
                const rows = [...el.querySelectorAll("label")].map(l => [l.textContent ?? "", l.querySelector('input[name="promote"]')?.value]);
                listed = rows.map(([text]) => text);
                return rows.filter(([text]) => text.includes("SUITE C14 still a question")).map(([, value]) => Number(value));
            };
            const promoted = await promoteFaintPrep();
            ok(Array.isArray(listed), "the promotion asked nothing - this measured nothing");
            equal(stableJson([listed.some(t => t.includes("SUITE C14 still a question")), listed.some(t => t.includes("SUITE C14 already tied"))]),
                stableJson([true, false]), "the promotion did not offer the open trace, or offered one already tied to the crime");
            const data = remnants.remnantData(open);
            equal(stableJson([promoted, data?.faint ?? null, data?.tiedToCrime ?? null]), stableJson([1, false, true]),
                "the ticked trace's row does not read faint no more and tied to the crime");
            equal(stableJson(Object.keys(scene.tokens.get(open.id)?._source?.flags?.[MODULE_ID] ?? {})), stableJson(["isRemnant"]),
                "the promotion wrote on the token, which every browser reads");
        } finally {
            if (own) Object.defineProperty(D, "wait", own);
            else delete D.wait;
            for (const t of placed.filter(Boolean)) {
                try { await remnants.dropRemnantSecret(t); } catch { /* nothing filed */ }
                try { await t.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["every standing GM window names every control it draws", async () => {
        /*
         * 1.2.47's a11y test sweeps whatever happens to be on screen when it runs, so
         * after the merge every full run failed on a DIFFERENT window - whichever one an
         * earlier scenario had left open - five kinds at a time. Swept on 21.09 with all
         * of them open at once: the Room setup, Item tables, Projects, Despair Flow,
         * Investigation's Key Remnant planner, Monocubs and Sound windows had table rows
         * named only by their column headers, 150 controls in all.
         *
         * So this opens every standing window itself, in its own time, and asks the
         * module's own sweep about all of them together. Hidden tabs count: their
         * controls are in the DOM and a reader reaches them when the tab is shown.
         */
        const { nameControls, CONTROLS } = await import("./a11y.mjs");
        /*
         * WHAT OPENED, NOT WHAT WAS CALLED (E01, 24.09.2026; audit S14-07). This used to
         * count `opened++` after each opener was merely called - not awaited, so a
         * render that rejected never reached the catch - and then read `a11yReport`,
         * which answers "every control has a name" when it has met no controls at all.
         * With no window drawn it passed, and in the headless harness no window is
         * drawn. So: the environment is asked first whether a window can be drawn at
         * all; the windows are counted as the new instances Foundry registered; the
         * controls are counted inside those windows; and the nameless ones are read off
         * those windows only, not off a report that has been collecting since `ready`.
         */
        needs(env.dialogs(), "the standing windows have no controls to read");
        /* A trace on the map, so the case panel draws its Traces rows. The first
           version of this ran on a scene with none, passed, and the next full run
           failed on exactly those rows. */
        const remnants = await import("./remnants.mjs");
        const scene = canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const fixture = scene ? await remnants.placeRemnant({
            type: "prep", visibility: "evident", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
            note: "test fixture - accessibility sweep"
        }) : null;
        const before = new Set(foundry.applications.instances.keys());
        for (const [file, text] of await otherSources()) {
            for (const m of text.matchAll(/^export (?:async )?function (open[A-Z]\w*|manage[A-Z]\w*)\s*\(/gm)) {
                if (!STANDING.includes(m[1])) continue;
                try {
                    const mod = await import(`./${file}`);
                    // Not awaited - half of these settle when the window is closed (see R12).
                    Promise.resolve(mod[m[1]]?.()).catch(() => {});
                } catch { /* a window that needs a world state this one lacks */ }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2500));
        try {
            const fresh = [...foundry.applications.instances.values()]
                .filter(app => !before.has(app.id) && app.element?.isConnected);
            ok(fresh.length >= 10, `only ${fresh.length} standing windows opened - this measured too little`);
            let controls = 0;
            const nameless = [];
            for (const app of fresh) {
                nameControls(app.element);
                for (const el of app.element.querySelectorAll(CONTROLS)) {
                    controls++;
                    if (el.dataset.drpgNamed === "none") {
                        nameless.push(`${app.title ?? app.id}: ${el.outerHTML.slice(0, 100)}`);
                    }
                }
            }
            ok(controls > 0, `${fresh.length} windows opened with no controls in them - nothing was read`);
            ok(!nameless.length, `${nameless.length} controls carry no name a screen reader can read: ${nameless.slice(0, 6).join(" | ")}`);
        } finally {
            for (const app of [...foundry.applications.instances.values()]) {
                if (before.has(app.id)) continue;
                try { await app.close({ animate: false }); } catch { /* already gone */ }
            }
            if (fixture) {
                try { await remnants.dropRemnantSecret(fixture); } catch { /* nothing filed */ }
                try { await fixture.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["handing over evidence hands over only what the giver had analysed", async () => {
        /*
         * The copy is born with the giver's state - `handoverBullet` passes
         * `analyzed` through - so an analysed bullet arrives analysed and its
         * reading arrives with it, which is what sharing findings means. The
         * half worth a test is the other one: hand over something you have NOT
         * analysed and the receiver's item must hold nothing, with the reading
         * waiting in their own secret for their own roll.
         *
         * `createTruthBullet` decides this from `identified`, which is derived
         * rather than passed - so a change to how that is computed silently
         * changes who can read the answer, and nothing else in the module would
         * notice.
         */
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const { MODULE_ID } = await import("./config.mjs");
        const F = bullets.TRUTH_BULLET_FLAGS;

        needs(world.atLeast("sceneOnScreen"), "the fixture stands on the scene on screen");
        needs(world.atLeast("occupiedRooms"), "the fixture is built beside a token standing in a room");
        const scene = canvas?.scene;
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "Foundry has a token standing in a room on the scene on screen, and roomOfToken places none of them");

        /*
         * TWO STUDENTS IN ONE ROOM, ARRANGED RATHER THAN HOPED FOR.
         *
         * `shareBullet` refuses a handover across rooms, and the seeded world
         * puts every student in a room of their own - so the first draft of
         * this test took the first two characters on the list, got `null` back
         * from a refusal it never noticed, and reported clean without reaching
         * one assertion.
         *
         * Skipping instead would have been worse than useless. A skip in this
         * suite is a promise that the ENVIRONMENT cannot answer the question
         * (see `needs`), and "the fixture did not stand the pieces where it
         * needed them" is not that. It would also have grown the skipped count,
         * which is the one number nobody looks at.
         *
         * So the token is moved, and put back in `finally`. That is fixture
         * setup, not cheating: what this test asserts is what the COPY carries,
         * and the cross-room refusal is another test's subject entirely.
         */
        needs(world.atLeast("studentsInRooms", 2), "a giver and a receiver, each standing in a room");
        const { roomOfActor } = await import("./movement.mjs");
        const chars = game.actors.filter(a => a.type === "character" && roomOfActor(a));
        ok(chars.length >= 2, `Foundry has two students or more in named rooms, and roomOfActor places ${chars.length} characters`);
        const [giver, receiver] = chars;

        const giverToken = scene.tokens.find(t => t.actorId === giver.id);
        const hostToken = scene.tokens.find(t => t.actorId === receiver.id);
        ok(giverToken && hostToken, "one of the two students has no token on this scene");
        const wasAt = { x: giverToken.x, y: giverToken.y };
        /* A TELEPORT, NOT A WALK. In v14 a bare `update({ x, y })` is a move, and a
           move is constrained by walls: measured 21.09 on the QA world, the giver set
           off for the receiver's room, walked 250 px and stopped at the Round Table's
           wall, so every assertion below measured a cross-room refusal. The module's
           own assemblies move tokens exactly like this, for exactly this reason. */
        const PLACE = { teleport: true, movementAction: "displace", animate: false };

        const READING = `Ash and not soot ${Date.now() % 100000}`;   // escape-safe
        let token = null;
        const made = [];
        try {
            // Into the receiver's room, and verified rather than assumed: if
            // the move did not take, every assertion below would be measuring a
            // refusal instead of a copy.
            await giverToken.update({ x: hostToken.x, y: hostToken.y }, PLACE);
            await settle();
            equal(roomOfActor(giver), roomOfActor(receiver),
                "the fixture could not stand the two students in one room");

            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", x: anchor.x, y: anchor.y, scene,
                note: "test fixture - handover of an unanalysed reading"
            });
            ok(token, "could not place the fixture trace");

            /* THE TRACE IS WRITTEN FIRST, and the first draft of this did not
               do it: it handed `analyzedText` straight to `createTruthBullet`
               and asserted on the secret afterwards, which read empty. Not a
               bug - `revealSourceOf` reconciles a bullet to its trace, and the
               trace had nothing to say. Every real caller writes the record
               first (observe.mjs types it into the trace, then copies it back
               out), so a fixture that skips that step is testing a state the
               module never produces. See `createTruthBullet`'s note. */
            await remnants.setRemnantPublic(token, {
                name: "Suite fixture residue",
                playerText: "Grey dust on the sill.",
                analyzedText: READING
            });
            await settle();

            const source = await bullets.createTruthBullet(giver, {
                name: "Suite fixture residue",
                realType: "resolution",
                visibility: "obvious",
                playerText: "Grey dust on the sill.",
                analyzedText: READING,
                remnantId: token.id,
                sceneId: scene.id
            });
            ok(source, "no bullet was created for the giver");
            made.push(source);
            await settle();

            // The giver's own state, asserted before the handover rather than
            // assumed by it: if the reading never reached this secret, every
            // claim below about the copy would be measuring the wrong thing.
            equal(bullets.secretOf(source.uuid).analyzedText, READING,
                "the giver's own bullet never carried the reading");
            equal(source.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                "the giver has not analysed it, so their item must hold nothing");

            const { shareBullet } = await import("./handover.mjs");
            const copy = await shareBullet({
                fromId: giver.id, toId: receiver.id, itemId: source.id
            });
            await settle();
            ok(copy, "the fixture handover produced no copy");
            made.push(copy);

            const live = receiver.items.get(copy.id);
            equal(live.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                "an un-analysed bullet handed over its analysis to the receiver's item");
            ok(!String(live.system?.description ?? "").includes(READING),
                "the copy's description quotes a reading nobody has bought");
            equal(bullets.secretOf(live.uuid).analyzedText, READING,
                "the receiver's own copy cannot pay out - the reading was not filed with it");
            ok(String(live.system?.description ?? "").includes("Grey dust on the sill."),
                "the Observe half did not travel with the copy");

            /* And a bullet whose answer key this browser lacks is not handed over (E04's fix
               round, the review's C-m17): its copy was minted an explicit Neutral, a reading
               nobody made. Made the way a lost browser leaves one: an item, and no row. */
            const [keyless] = await giver.createEmbeddedDocuments("Item", [{ name: "Suite fixture: a bullet with no answer key", type: "loot",
                flags: { [MODULE_ID]: { category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "evident", analyzed: false } } }]);
            made.push(keyless);
            const heldBefore = receiver.items.size;
            const refused = await shareBullet({ fromId: giver.id, toId: receiver.id, itemId: keyless.id });
            await settle();
            equal(stableJson([refused ?? null, receiver.items.size - heldBefore]), stableJson([null, 0]),
                "a bullet with no answer key was handed over, its copy minted with a reading nobody made");
        } finally {
            // The student goes back where the world put them, first: a fixture
            // that leaves somebody standing in the wrong room changes what
            // every later test in this run is looking at.
            try { await giverToken.update(wasAt, PLACE); } catch { /* scene already gone */ }
            for (const item of made) {
                const live = item?.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
            if (token) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) {
                    await scene.deleteEmbeddedDocuments("Token", [token.id]);
                }
            }
        }
    }],

    ["no piece of a room's outline is shorter than the line it is drawn with", async () => {
        /*
         * THE CUT WHITE WEDGE, STANDING ON ITS OWN IN THE MIDDLE OF A DOORWAY.
         *
         * An OPENING shorter than a third of a square is discarded \- `shortest`
         * in `doorwayEdges`. A walled stretch had no such rule, and the two are
         * not symmetric in what they cost. One stray sample reading "wall" in
         * the middle of a long opening leaves a visible stretch a few pixels
         * long, and this outline is stroked with SQUARE caps: each end runs half
         * a line-width past the stretch, so anything shorter than one width
         * comes out as a solid wedge rather than a line \- alone in the middle
         * of an opening, ink keyline and all, far from any other outline.
         *
         * Reproduced on a fixture: a plain room whose whole top border is a
         * doorway, with ONE eight-pixel wall in the middle of it. The wall
         * splits the border into two openings, and the sliver of "wall" between
         * them is a two-point chain \- which the tracer stroked
         * unconditionally.
         *
         * What is asserted here is the property rather than the fixture: every
         * chain this room actually draws is at least as long as the ink line
         * drawing it. It reads the geometry PIXI was handed, so it is the drawn
         * thing being measured and not the intention.
         */
        const fog = await import("./fog.mjs");
        needs(env.canvas(), "the room outlines are PIXI");
        const before = fog.diagnoseFog({ toChat: false });
        ok(before.currentRooms?.length,
            "nobody is standing in a named room, so no outline is being drawn to measure");

        const find = (node, name) => {
            if (node.name === name) return node;
            for (const child of node.children ?? []) {
                const found = find(child, name);
                if (found) return found;
            }
            return null;
        };
        const group = find(canvas.stage, "drpgRoomOutline");
        ok(group, "the room outline group is not on the canvas");

        /* NOT the glow: it strokes the same path several times wider, so measuring it
           would ask whether the LIGHT is shorter than itself, which is not the question. */
        const graphics = group.children.find(c => !c.texture && c.geometry && c.name !== "drpgRoomOutlineGlow");
        ok(graphics, "the outline has no geometry to read");

        const grid = canvas.grid.size;
        const inkWidth = Math.max(7, Math.round(grid * 0.11)) + Math.max(4, Math.round(grid * 0.05));

        const stubs = [];
        let chains = 0;
        for (const piece of graphics.geometry?.graphicsData ?? []) {
            const points = piece.shape?.points;
            if (!points || points.length < 4) continue;
            chains++;
            // Along the chain, not end to end: a staircase doubles back, and its
            // span would read shorter than the line it draws.
            let run = 0;
            for (let i = 2; i < points.length; i += 2) {
                run += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
            }
            const width = piece.lineStyle?.width ?? inkWidth;
            if (run < width) stubs.push(`${Math.round(run)}px of outline drawn with a ${width}px line`);
        }

        ok(chains > 0, "the outline drew nothing at all");
        ok(!stubs.length, `${before.currentRooms[0]}: ${stubs.join("; ")}`);
    }],

    ["a diagonal wall closes the staircase drawn along it", async () => {
        /*
         * THE ISOMETRIC CASE, WHICH IS THE ONLY CASE THIS MODULE HAS.
         *
         * The art draws a wall as a diagonal. A region is drawn on the square
         * grid, so the border describing that wall comes out as a staircase of
         * axis-aligned steps. `wallAlongEdge` asked whether the wall ran within
         * twenty degrees of the border, compared the wall against ONE STEP, and
         * 45 degrees is not within twenty of nothing \- so the wall lying
         * exactly along the border closed nothing at all.
         *
         * Measured before the repair, on this fixture: fully open at every step
         * size from half a square to three. The distance never mattered; only
         * the angle did. What a table sees is a cut strip of doorway glow
         * sitting in the middle of a wall, far from any way through (Dawid,
         * 28.08, with screenshots).
         *
         * THREE SIZES, because the first diagnosis was that the staircase had
         * to be deep enough to push the border out of range \- and it was
         * wrong. A fixture that only tried one size would have agreed with it.
         */
        needs(world.atLeast("sceneOnScreen"), "the staircase is drawn on the scene on screen");
        const scene = canvas?.scene;
        const g = scene.grid.size;
        const x0 = 200, y0 = 200, n = 8;

        for (const T of [1, 2, 3]) {
            const s = T * g, L = n * s;
            const points = [x0, y0];
            let x = x0, y = y0;
            for (let i = 0; i < n; i++) { x += s; points.push(x, y); y += s; points.push(x, y); }
            points.push(x0, y0 + L);

            let region = null, walls = [];
            try {
                region = (await scene.createEmbeddedDocuments("Region", [{
                    name: "Suite staircase fixture",
                    shapes: [{ type: "polygon", points }]
                }]))[0];
                ok(region, `could not place the ${T}-square fixture`);
                walls = (await scene.createEmbeddedDocuments("Wall", [
                    { c: [x0, y0, x0 + L, y0 + L] },        // the diagonal itself
                    { c: [x0 + L, y0 + L, x0, y0 + L] },
                    { c: [x0, y0 + L, x0, y0] }
                ])).map(w => w.id);

                const { checkRegions } = await import("./fog.mjs");
                const adrift = checkRegions().find(r =>
                    r.room === "Suite staircase fixture" && /walls/.test(r.problem));
                ok(!adrift, `a ${T}-square staircase does not see the wall drawn along it`
                    + `${adrift ? ` \- ${String(adrift.detail).match(/^[\d.]+/)?.[0]} squares read as open` : ""}`);
            } finally {
                if (walls.length) await scene.deleteEmbeddedDocuments("Wall", walls);
                if (region) await scene.deleteEmbeddedDocuments("Region", [region.id]);
            }
        }

        /*
         * AND THE TEST STILL HAS TEETH. A border with no wall on it has to keep
         * reading as open, or the repair above is just a way of never finding a
         * doorway again \- which would take every glow off every map and
         * pass this test twice as fast.
         */
        let bare = null;
        try {
            const L = n * g;
            bare = (await scene.createEmbeddedDocuments("Region", [{
                name: "Suite open fixture",
                shapes: [{ type: "polygon", points: [x0, y0, x0 + L, y0, x0 + L, y0 + L, x0, y0 + L] }]
            }]))[0];
            const { checkRegions } = await import("./fog.mjs");
            const adrift = checkRegions().find(r =>
                r.room === "Suite open fixture" && /walls/.test(r.problem));
            ok(adrift, "a room with no walls at all reads as walled");
        } finally {
            if (bare) await scene.deleteEmbeddedDocuments("Region", [bare.id]);
        }
    }],

    ["a motive counts down a time of day at a time, and a rewind gives it back", async () => {
        const { setMotive, motive, tickMotive, untickMotive } = await import("./rules.mjs");

        const record = await setMotive({
            text: "Suite fixture. Nobody has to do anything.",
            consequence: "Nothing.",
            timesOfDay: 3
        });
        ok(record, "the motive was not written");
        equal(motive()?.remaining, 3, "a fresh motive does not start at its full deadline");
        ok(!motive()?.due, "a fresh three-time-of-day motive reads as already due");

        await tickMotive();
        equal(motive()?.remaining, 2, "one time of day did not come off the deadline");

        // The rewind's half, checked directly rather than through the clock:
        // this is the arithmetic trap 104 is about, and it is worth failing
        // here rather than inside a clock move that does five other things.
        await untickMotive();
        equal(motive()?.remaining, 3, "a rewind did not give the time of day back");
        await untickMotive();
        equal(motive()?.remaining, 3, "a second rewind inflated the motive past what was bought");

        // Down to zero, and STAYING there - the countdown must not delete the
        // motive at the one moment it means something.
        await tickMotive();
        await tickMotive();
        await tickMotive();
        equal(motive()?.remaining, 0, "the deadline did not reach zero");
        ok(motive(), "the motive vanished at zero instead of coming due");
        ok(motive()?.due, "a motive at zero does not read as due");

        await tickMotive();
        equal(motive()?.remaining, 0, "the deadline went negative");

        await setMotive(null);
        ok(!motive(), "the motive could not be withdrawn");
    }],

    ["an assembly waits for the next time of day, and cancelling it is free", async () => {
        const { scheduleGather, pendingGather, cancelGather, runPendingGather } =
            await import("./call-effects.mjs");

        const room = canvas?.scene?.regions?.find(r => r.name)?.name;
        ok(room, "this scene has no named region to call an assembly in");

        const order = await scheduleGather(room, "Suite");
        ok(order, "the assembly was not written");
        equal(pendingGather()?.room, room, "the standing order names the wrong room");

        // NOT YET. The order was called in this time of day, and the whole
        // point of the change is that nobody moves until the clock does.
        const held = await runPendingGather();
        ok(!held, "the assembly was held in the time of day it was called in");
        ok(pendingGather(), "an unripe assembly was cleared anyway");

        await cancelGather();
        ok(!pendingGather(), "the assembly could not be called off");

        // Cancelling twice is a no-op rather than an error: the tile is drawn
        // from the same state, so a stale sheet can send the second one.
        ok(!await cancelGather(), "cancelling nothing reported that it cancelled something");
    }],

    ["a missed clue earns a second try only on Hope", async () => {
        /*
         * G-22. The advantage used to land on ANY failure, so a victim who
         * rolled badly and with Despair was paid for it exactly as well as one
         * who was merely unlucky - which is the one distinction the duality
         * die exists to make.
         */
        const [killer, victim] = cast(2);
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();

        // A Despair miss: nothing earned.
        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: false
        });
        await settle();
        ok(!murder.murderState()?.advantageNext?.victim,
            "a Despair failure still earns the advantage G-22 takes away");

        // Back to the victim, and a Hope miss: earned.
        await drpg.passTurn();
        await settle();
        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: true
        });
        await settle();
        ok(murder.murderState()?.advantageNext?.victim,
            "a Hope failure no longer earns the second try");
    }],

    ["a critical Self-defence hands over one action, already open", async () => {
        /*
         * G-18, end to end: the grant appears, the turn is still the victim's
         * so it can be spent, spending it needs no dice, and it is gone
         * afterwards. The last one is the point - a grant that survived its
         * turn would be a permanent free Survive.
         */
        const [killer, victim] = cast(2);
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();

        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "selfDefence", total: 30, isCritical: true, withHope: true
        });
        await settle();

        let state = murder.murderState();
        ok(state?.unlocked?.includes("survive"), "the critical did not open Survive");
        ok(murder.freeResolutionFor("victim"), "the critical handed over no free action");
        equal(state.turnSide, "victim", "the turn passed, so the free action expired unused");

        // Taken, not rolled: total zero, no critical, and it still ends the
        // incident - which is what "without rolling" has to mean.
        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "survive", total: 0, isCritical: false, withHope: true, free: true
        });
        await settle();

        state = murder.murderState();
        ok(!state || state.stage !== "incident", "a free Survive did not end the incident");
        ok(!murder.freeResolutionFor("victim", state), "the free action survived being spent");
    }],

    ["ending an Eclipse the way the game does carries its sound", async () => {
        /*
         * Dawid, at the table, 28.08: the Eclipse's ending sound never plays.
         * It was attached to `endEclipse({ advance: false })` - a branch nothing
         * in the game takes, because an Eclipse ends BY advancing the clock.
         *
         * So this drives the DEFAULT path and reads the card that came out.
         * `playSfx` is local and this suite has no audio files, so what is
         * checked is the flag that carries the sound to the people the message
         * reached - which is the module's whole mechanism for a sound with an
         * audience, and the thing that was missing.
         */
        const eclipse = await import("./eclipse.mjs");
        const before = new Set(game.messages.map(m => m.id));

        await eclipse.startEclipse();
        await settle();
        await eclipse.endEclipse();
        await settle();

        const fresh = game.messages.filter(m => !before.has(m.id));
        const carried = fresh.map(m => {
            const flag = m.getFlag(MODULE_ID, "sfx");
            return typeof flag === "string" ? flag : flag?.key ?? null;
        }).filter(Boolean);

        ok(carried.includes("eclipseEnd"),
            `no card carried the Eclipse's ending sound - got [${carried.join(", ")}]`);
    }],

    ["a trap watches, fires once, and never at its own builder", async () => {
        /*
         * The whole of E21 in one pass, driven through the events the game
         * actually raises rather than through the watcher's internals.
         *
         * Four things, and each of them is a trap from the plan:
         *   - a trap that is not finished yet does not watch
         *   - its own builder does not set it off (the modifier, default on)
         *   - somebody else does
         *   - and then it goes QUIET (trap 153), because a Main Hall watching
         *     for "somebody enters" would otherwise fire twenty cards a session
         *     and the GM would learn to skim exactly the one that mattered.
         */
        const P = await import("./projects.mjs");
        const T = await import("./traps.mjs");
        const { allRooms, othersInNamedRoom } = await import("./movement.mjs");

        const [killer, other] = cast(2);
        needs(world.atLeast("namedRooms"), "the trap is built in a room");

        // A room with nobody in it, so "alone" is a fact rather than a guess.
        const room = allRooms().find(r => othersInNamedRoom(r).length === 0) ?? allRooms()[0];
        ok(room, "Foundry has a named room on the scene on screen, and allRooms() finds none");

        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        let made = null;
        try {
            made = await P.createProject({
                name: "SUITE trap", target: 1, room,
                indirectMurder: true, killerId: killer.id, condition: "suite",
                trigger: { kind: "alone", afterDark: false, notBuilder: true }
            });
            ok(made?.id, "could not create the trap project");
            await settle();

            // 1. unfinished, so nothing is watching
            equal(T.diagnoseTraps().armed, 0, "a trap started watching before it was built");

            await P.addProgress(made.id, 1, { by: killer.id });
            await settle();
            equal(T.diagnoseTraps().armed, 1, "a finished trap did not start watching");

            // 2. its own builder
            let count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: killer, from: null, to: room });
            await settle();
            equal(game.messages.size, count, "the trap fired on the person who built it");

            // 3. somebody else, alone
            count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: other, from: null, to: room });
            /* WAIT FOR THE CARD, NOT FOR 400 MS. The hook is synchronous, what it starts is
               not: the trap reads the room, decides, and posts a ChatMessage, which is a world
               write. This is the assertion that failed twice on 08-09.09 and passed on the
               re-run both times. The disarm below rides on the same chain, so it is waited for
               too - and both fall through to the assertion at the deadline. */
            await until(() => game.messages.size > count);
            await until(() => T.diagnoseTraps().armed === 0);
            ok(game.messages.size > count, "the trap did not fire on somebody else walking in alone");
            equal(T.diagnoseTraps().armed, 0, "the trap did not disarm itself after speaking");

            // 4. and it stays quiet
            count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: other, from: null, to: room });
            await settle();
            equal(game.messages.size, count, "the trap spoke twice for one event");
        } finally {
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
            T.forgetArmedTraps();
            await settle();
        }
    }],

    ["a secret indirect murder keeps its killer, builder, condition and trigger on the GMs", async () => {
        /*
         * E05 C1, 26.09.2026; audit S09-05, D3. projectMeta is a world setting every browser
         * holds, and it carried an indirect murder's killer, its builder, its condition and its
         * trigger: any console named the killer before the crime. The four are the GM store
         * `projectSecrets` now. Driven through the game's own events, as the test above: made,
         * the world's row holds none of the four and `secretsOf` holds all of them; filled, the
         * trap arms from the store; set off, `stampFired` writes `firedAt` there and the trap
         * leaves the armed map; Rearm brings it back; deleted, its row goes. Nothing of it
         * reaches projectMeta at any step.
         */
        const P = await import("./projects.mjs");
        const T = await import("./traps.mjs");
        const S = await import("./gm-stores.mjs");
        const { allRooms, othersInNamedRoom } = await import("./movement.mjs");
        const [killer, other] = cast(2);
        needs(world.atLeast("namedRooms"), "the trap is built in a room");
        const room = allRooms().find(r => othersInNamedRoom(r).length === 0) ?? allRooms()[0];
        ok(room, "Foundry has a named room on the scene on screen, and allRooms() finds none");
        const inWorld = id => P.PROJECT_SECRET_FIELDS.filter(f => Object.hasOwn(P.metaFor(id), f));
        const armedHere = id => T.armedIn(room).some(t => t.id === id);
        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        let made = null;
        try {
            made = await P.createProject({
                name: "SUITE E05 secret trap", target: 1, room, indirectMurder: true, secret: true,
                killerId: killer.id, by: killer.id, condition: "SUITE E05 condition",
                trigger: { kind: "alone", afterDark: false, notBuilder: true }
            });
            ok(made?.id, "could not create the trap project");
            await settle();
            equal(stableJson(inWorld(made.id)), "[]", "projectMeta holds a field of the four on a new trap");
            const held = P.secretsOf(made.id);
            equal(stableJson([held.killerId, held.by, held.condition, held.trigger?.kind, held.trigger?.armed]),
                stableJson([killer.id, killer.id, "SUITE E05 condition", "alone", false]), "the GMs' store does not hold the new trap's four fields");

            await P.addProgress(made.id, 1, { by: killer.id });
            await settle();
            equal(stableJson([T.diagnoseTraps().armed, P.secretsOf(made.id).trigger?.armed ?? null, armedHere(made.id)]), stableJson([1, true, true]),
                "the finished trap did not arm from the GMs' store");

            const count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: other, from: null, to: room });
            // The card and the disarm ride on one chain after the synchronous hook (see the test above).
            await until(() => game.messages.size > count);
            await until(() => !armedHere(made.id));
            const fired = P.secretsOf(made.id).trigger?.firedAt ?? null;
            ok(game.messages.size > count && Number.isFinite(fired) && !armedHere(made.id),
                `the trap went off and the GMs' store has no firedAt (${fired}), or it is still in the armed map`);

            await T.rearmTrap(made.id);
            ok(armedHere(made.id) && P.secretsOf(made.id).trigger?.firedAt === null, "Rearm did not put the trap back in the armed map from the GMs' store");
            equal(stableJson(inWorld(made.id)), "[]", "a field of the four reached projectMeta while the trap armed, went off or was re-armed");

            await P.deleteProject(made.id);
            ok(!S.projectSecretStore.has(made.id), "deleting the project left its killer and trigger in the GMs' store");
            made = null;
        } finally {
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
            T.forgetArmedTraps();
            await settle();
        }
    }],

    ["a planted item is handed over once, and keeps the name the GM gave it", async () => {
        /*
         * Traps 165 and the identity problem, which are the two halves of the
         * fifth trigger.
         *
         * 165: the plant is returned INSTEAD of a draw and comes out of the room
         * as it is handed over. Dropped into the room's table it would be likely
         * rather than certain, and the killer would have paid a project's full
         * price for a lottery ticket.
         *
         * THE IDENTITY: an item moved between characters is deleted and created
         * again with a new document id, which is precisely the journey this trap
         * is about. So the ledger is keyed on a flag that travels - and the item
         * the search hands over has to keep the one the GM minted, or the trap
         * will never recognise its own poison.
         */
        const T = await import("./traps.mjs");
        const INV = await import("./inventory.mjs");
        const { allRooms } = await import("./movement.mjs");

        needs(world.atLeast("namedRooms"), "the thing is planted in a room");
        const room = allRooms()[0];
        const [actor] = cast(1);
        ok(room, "Foundry has a named room on the scene on screen, and allRooms() finds none");

        // The plants and the trap ledger are GM stores since E04: tier 2's restore puts them back.
        let granted = null;

        try {
            // Name only. A plant carries no category and no tier of its own -
            // it arrives as whatever the finder searched for (A23).
            const identity = await T.plantItem("SUITE-project", room, {
                name: "SUITE planted kit"
            });
            ok(identity, "nothing was planted");

            const first = await T.takePlant(room);
            equal(first?.drpgItemId, identity, "the first search did not get the planted item");

            const second = await T.takePlant(room);
            equal(second, null, "the room handed the same planted item out twice");

            // Into a bag, the way the Search path does it.
            granted = await INV.grantItem(actor, {
                name: first.name, category: first.category, tier: first.tier,
                extraFlags: { [INV.ITEM_FLAGS.identity]: first.drpgItemId }
            });
            equal(granted?.getFlag(MODULE_ID, INV.ITEM_FLAGS.identity), identity,
                "the planted item was renamed on its way into somebody's bag");
            equal(T.trapForItemId(identity), "SUITE-project",
                "the GM's ledger cannot find the trap this item belongs to");

            // And every OTHER item gets one too, which is what makes the flag a
            // name rather than a mark.
            const plain = await INV.grantItem(actor, { name: "SUITE plain thing", category: "healing", tier: 1 });
            ok(plain?.getFlag(MODULE_ID, INV.ITEM_FLAGS.identity),
                "an ordinary item has no identity, so the trap's one stands out");
            equal(T.trapForItemId(plain.getFlag(MODULE_ID, INV.ITEM_FLAGS.identity)), null,
                "an ordinary item is in the trap ledger");
            await plain.delete().catch(() => {});
        } finally {
            if (granted) await granted.delete().catch(() => {});
            await settle();
        }
    }],

    ["the plant reply carries no project", async () => {
        /*
         * E06 C10, 28.09.2026; audit S07-18 (L22). The GM hands a player who searched a room the
         * plant waiting there, and the reply carried the store's row whole - the trap's project id
         * beside the item - to the finder's console. The spend and the plant check are run as the
         * bridge runs them (`SEARCH_ACTIONS`), with the token spend stubbed so no room's count
         * moves: the reply's plant is the item and nothing of the trap, and the plant given back
         * under the same request is the row whole again - a second take reads its project.
         */
        const T = await import("./traps.mjs");
        const { SearchTokens, SEARCH_ACTIONS } = await import("./search-tokens.mjs");
        const { allRooms } = await import("./movement.mjs");
        needs(world.atLeast("namedRooms"), "the thing is planted in a room");
        const room = allRooms()[0];
        must(room, "Foundry has a named room on the scene on screen, and allRooms() finds none");
        // The plants are a GM store since E04: tier 2's restore puts them back.
        const spend = SearchTokens.spend;
        SearchTokens.spend = async () => true;
        let reply = null, again = null, identity = null;
        try {
            identity = await T.plantItem("SUITE-C10-project", room, { name: "SUITE C10 kit", description: "SUITE C10 a kit" });
            must(identity, "nothing was planted");
            const ctx = { requestId: "suite-c10-plant" };
            await SEARCH_ACTIONS["searchTokens.spend"].run({ roomName: room }, game.user, {});
            reply = (await SEARCH_ACTIONS["searchTokens.takePlant"].run({ roomName: room }, game.user, ctx))?.reply ?? null;
            await SEARCH_ACTIONS["searchTokens.returnPlant"].run({ plantRequestId: ctx.requestId }, game.user, {});
            again = await T.takePlant(room);
        } finally {
            SearchTokens.spend = spend;
        }
        const plant = reply?.plant ?? {};
        equal(stableJson([reply?.ok ?? null, plant.name ?? null, plant.drpgItemId === identity, Object.hasOwn(plant, "projectId"),
            JSON.stringify(plant).includes("SUITE-C10-project"), again?.projectId ?? null]),
            stableJson([true, "SUITE C10 kit", true, false, false, "SUITE-C10-project"]),
            `the plant reply named the trap's project, or missed the item, or the plant given back lost its row: ${stableJson({ reply, again })}`);
    }],

    ["everything that can be held ready can also be broken", async () => {
        /*
         * FROM E17'S CLOSING LIST: "every EQUIPPABLE category has a breaking
         * path on Despair". The guide's rule is that a tool used on a Despair
         * roll breaks, and the module's answer is that nothing is ever deleted -
         * the same object stays in the bag marked Broken, so the player can see
         * what it cost them.
         *
         * A category that can be equipped and cannot be broken is a category
         * that never pays: a free permanent advantage nobody would notice was
         * free, because the only sign is a thing that never happens.
         *
         * Driven per category rather than read, because "can be broken" is three
         * facts at once - the flag lands, the item survives, and the equipment
         * machinery stops offering it.
         */
        const INV = await import("./inventory.mjs");
        const [actor] = cast(1);

        const made = [];
        try {
            for (const category of EQUIPPABLE) {
                /* `override`, because the cap is not what this test is about and by the
                   time it runs the bag is full of what the tests before it granted.
                   Without it `grantItem` refuses - correctly - and the failure reads
                   "could not make an item of category tool", which is how this sat in
                   the accepted-failures bucket as though it needed a canvas. A GM
                   handing something over outranks the cap by design; a fixture is a
                   GM handing something over. */
                const item = await INV.grantItem(actor, {
                    name: `SUITE ${category}`, category, tier: 1, override: true
                });
                ok(item, `could not make an item of category ${category}`);
                made.push(item);

                equal(INV.isBroken(item), false, `a fresh ${category} is already broken`);
                const broke = await INV.breakItem(item);
                ok(broke, `${category} refused to break`);
                ok(item.isOwner ? actor.items.get(item.id) : true,
                    `breaking a ${category} deleted it instead of marking it`);
                equal(INV.isBroken(item), true, `a broken ${category} does not say so`);
            }
        } finally {
            for (const item of made) await item.delete().catch(() => {});
            await settle();
        }
    }],

    ["a private card's words are not in the world at all", async () => {
        /*
         * Dawid, 28.08: make the architectural change.
         *
         * WHAT WAS MEASURED FIRST. A player's browser, freshly reloaded, held
         * 717 chat messages - exactly the GM's count - including every card it
         * was not a recipient of, content and all: "You lift SUITE loot out of
         * Player A's pocket. Nobody saw you do it." A whisper is a courtesy.
         * Foundry sends the message to everyone and hides it in the interface.
         *
         * So this asks the only question that matters, of the document that
         * every client is given: is the sentence in there? It must not be, and
         * the recipient must still be able to read it.
         */
        const SECRET = "SUITE the poison was in the second cup";
        const { whisperToOwner } = await import("./utils.mjs");
        const { secretHtml, diagnoseSecrets } = await import("./secret.mjs");
        const [actor] = cast(1);

        let card = null;
        try {
            card = await whisperToOwner(actor, `<p>${SECRET}</p>`);
            ok(card, "no card was posted");
            await settle();

            // What every client is handed.
            ok(!card.content.includes(SECRET),
                "the sentence is in the chat document, which every client receives");

            // What this client - a recipient, since GMs always are - can read.
            const mine = secretHtml(card);
            ok(mine?.includes(SECRET),
                "the recipient cannot read their own private card");

            // And the reader every render goes through agrees.
            const { contentOf } = await import("./secret.mjs");
            ok(contentOf(card).includes(SECRET), "contentOf does not return the words");

            // Nothing anywhere else in the log is leaking either.
            equal(diagnoseSecrets().leaking.length, 0,
                "a private card is carrying its own words in the document");
        } finally {
            if (card) await card.delete().catch(() => {});
            await settle();
        }
    }],

    ["a stash with something in it cannot be taken away", async () => {
        /*
         * E11's own criterion, and it only held in the dialog.
         *
         * Measured in E17 by calling the exported function the way a macro
         * would: the stash was removed, `stashItemsIn` still returned 1, and
         * nothing was said. The item stays flagged as stashed, so it is hidden
         * from its owner's sheet, in a room with no stash to take it out of.
         * A lost item, silently, and the only sign is a player asking where
         * their screwdriver went three sessions later.
         */
        const V = await import("./vault.mjs");
        const INV = await import("./inventory.mjs");
        const { roomOfActor } = await import("./movement.mjs");

        const [actor] = cast(1);
        const room = roomOfActor(actor);
        ok(room, `${actor?.name} is not standing in a room`);

        const had = Boolean(V.stashIn(room, actor.id));
        /* The room's list AS IT WAS (E30, 24.09.2026). The finally put the stash back
           with setStash, which writes a list, so a room that had no list was left
           with an empty one: "regions.REGDORMA00000000.flags.danganronpa-rpg (none) ->
           {"drpgStashes":[]}" on the dump's first run. It is not the same room - an
           absent list is read as the bedroom owner's own stash (stashesIn), an empty
           one as no stash at all - so in a world with an owned bedroom this took the
           owner's stash away. */
        const region = V.regionsByName().get(room);
        const listBefore = foundry.utils.deepClone(region?.getFlag(MODULE_ID, V.VAULT_FLAGS.stashes));
        let item = null;
        try {
            if (!had) await V.setStash(room, actor.id, { present: true });
            await settle();

            item = await INV.grantItem(actor, { name: "SUITE stowed", category: "usable", tier: 1 });
            ok(await V.stow(actor, item), "could not put the thing in the stash");
            await settle();
            equal(V.stashItemsIn(actor, room).length, 1, "the thing did not go in");

            const refused = await V.setStash(room, actor.id, { present: false });
            await settle();
            equal(refused, null, "a stash holding something was removed");
            ok(V.stashIn(room, actor.id), "the stash is gone and the thing is still in it");

            // And an EMPTY one still goes, because that is the whole point of
            // the control.
            await V.retrieve(actor, item);
            await settle();
            equal(V.stashItemsIn(actor, room).length, 0, "could not take the thing back out");
            ok(await V.setStash(room, actor.id, { present: false }) !== null,
                "an empty stash refused to be removed");
        } finally {
            if (item) await item.delete().catch(() => {});
            if (listBefore === undefined) await region?.update({ [`flags.${MODULE_ID}.${V.VAULT_FLAGS.stashes}`]: forcedDeletion() });
            else await region?.update({ [`flags.${MODULE_ID}.${V.VAULT_FLAGS.stashes}`]: listBefore });
            await settle();
        }
    }],

    ["topping up Hope lights the Calls it just paid for", async () => {
        /*
         * Dawid, 28.08: "I noticed it by filling in a player's Hope on the
         * sheet - the newly available Calls are still greyed out."
         *
         * WHY IT COULD NOT FIX ITSELF. A resource-only update deliberately SKIPS
         * the sheet render, because Daggerheart puts `transition: all` on the
         * sidebar and every redraw animated the whole left column. In its place
         * `repaintInPlace` draws by hand what the render would have drawn - and
         * the comment over `REPAINTABLE` says adding a resource there is a
         * promise that it does. `hope` was in the set and the function drew the
         * bar and the pips and stopped, so the one thing Hope actually decides
         * was the one thing left stale. Nothing was ever going to correct it.
         *
         * Driven through the real sheet, because that is the only place the two
         * halves meet: the value is in the actor, the greying is in the DOM, and
         * the bug lived precisely in the gap.
         */
        const [actor] = cast(1);
        const before = foundry.utils.getProperty(actor, "system.resources.hope.value") ?? 0;
        const max = foundry.utils.getProperty(actor, "system.resources.hope.max") ?? 6;

        needs(env.systemSheets(), "there is no Hope drawer to draw into");
        try {
            await actor.update({ "system.resources.hope.value": 0 });
            await actor.sheet.render(true);
            await wait(900);

            const greyed = () => [...(actor.sheet.element
                ?.querySelectorAll(".drpg-hope-panel .drpg-action-grid > *") ?? [])]
                .filter(button => button.classList.contains("unaffordable")).length;
            const total = () => (actor.sheet.element
                ?.querySelectorAll(".drpg-hope-panel .drpg-action-grid > *") ?? []).length;

            ok(total() > 0, "the Hope drawer drew no Calls at all");
            const broke = greyed();
            ok(broke > 0, "nothing was greyed out at zero Hope, so this proves nothing");

            // The GM tops them up. NOBODY TOUCHES THE SHEET.
            await actor.update({ "system.resources.hope.value": max });
            await wait(900);

            ok(greyed() < broke,
                `Hope went 0 -> ${max} and ${greyed()} of ${total()} Calls are still greyed out`);
        } finally {
            await actor.update({ "system.resources.hope.value": before });
            try { await actor.sheet.close(); } catch { /* it may not have opened */ }
            await settle();
        }
    }],

    ["a sound that plays is never reported as unplayable", async () => {
        /*
         * Dawid, 28.08, from a live session: five warnings saying the file
         * "could not be played and will not be reported again this session" -
         * and four of those five sounds had just been heard at the table.
         *
         * The cause was a call to a function that does not exist. `bend(sound,
         * rate)` went with the rework that moved variation onto its own `Sound`
         * (a rate can only be set on a buffer node) and the call site stayed, in
         * the branch taken by every event that does NOT vary. The throw lands
         * inside a `.then`, after `AudioHelper.play` has already started the
         * sound, so the `.catch` reported the file while the table heard it. It
         * had been doing that since E14.
         *
         * A test that only asks "did it play" would have passed the whole time.
         * The question that catches it is the second one: did anything complain.
         */
        const { playSfx, diagnoseSfx } = await import("./sfx.mjs");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.sfxMap) ?? {});

        // A file this install certainly has, and an event that does NOT vary -
        // which is the branch that was broken.
        const FILE = "modules/dice-so-nice/sounds/dicehit.mp3";
        equal(SFX_EVENTS.verdict?.vary ?? false, false,
            "this scenario needs an event that does not vary");

        try {
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, { ...before, verdict: FILE });
            await settle();

            const complainedBefore = (diagnoseSfx().unplayable ?? []).includes(FILE);
            ok(!complainedBefore, "this file was already written off before the test started");

            playSfx("verdict");
            await wait(900);

            ok(!(diagnoseSfx().unplayable ?? []).includes(FILE),
                "the module reported a file as unplayable and played it anyway");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, before);
            await settle();
        }
    }],

    ["a Monokuma leaves no track in the fog, and a student still does", async () => {
        /*
         * Dawid, 28.08: Monokuma tokens were uncovering rooms. They are the GM
         * wearing a token and they go everywhere, and the GM's own veil is the
         * UNION of every row in the discovery ledger - so a GM moving their own
         * token was uncovering the building for themselves, one corridor at a
         * time, and the fog stopped meaning "where the cast has been".
         *
         * DRIVEN THROUGH THE SEED rather than by dragging a token, and that is
         * deliberate: `seedDiscovery` records "the room you are standing in",
         * which is the same question `recordDiscovery` asks after a step and
         * carries the same skip. Moving a token in a test means fighting the
         * movement rules for the privilege of asking a question the seed
         * answers directly.
         *
         * BOTH HALVES. A fix that stops the ledger recording anything at all
         * would pass the first assertion and take the fog with it.
         *
         * In a world the GM store has never opened (E04): the ledger is a store now,
         * and its rows start empty there, so the seed has something to record - where
         * the old test emptied the two rows by writing the whole ledger back.
         */
        const fog = await import("./fog.mjs");
        const E = await import("./gm-store.mjs");
        const { roomOfActor } = await import("./movement.mjs");
        const { isMonokuma } = await import("./monokuma.mjs");

        needs(world.atLeast("sceneOnScreen"), "the fog is read on the scene on screen");
        const scene = canvas?.scene;

        const standing = game.actors.filter(a =>
            a.type === "character" && roomOfActor(a));
        const monokuma = standing.find(a => isMonokuma(a));
        const student = standing.find(a => !isMonokuma(a));
        ok(monokuma && student,
            "need a Monokuma and a student standing in rooms on this scene");

        await E.withGmStoreWorld(`suite-seed-${foundry.utils.randomID(8)}`, async () => {
            await fog.seedDiscovery(scene);
            await settle();
            equal(fog.discoveredFor(scene.id, monokuma.id).length, 0,
                `${monokuma.name} is a Monokuma and put ${JSON.stringify(fog.discoveredFor(scene.id, monokuma.id))} in the ledger`);
            ok(fog.discoveredFor(scene.id, student.id).includes(roomOfActor(student)),
                `${student.name} is standing in ${roomOfActor(student)} and the ledger did not record it`);
        });
    }],

    ["a trace is tied to the murder by what happened, not by what it is", async () => {
        /*
         * Dawid, 28.08: a trace is part of the murder when it DELIVERED the
         * object used in it, when it is the effect of a project tied to it,
         * when it was left during the incident, or when it was left cleaning up
         * afterwards.
         *
         * What it used to be was the CATEGORY of the thing found: a Search that
         * turned up anything filed as crime or cleaning gear tied itself on the
         * spot. A penknife nobody picked up again therefore sat at the top of
         * the dashboard's murder-first sort, beside the knife out of the body.
         *
         * Two of the four are checked here. The other two are already held: the
         * clean-up says so itself at three call sites, and the project rule is
         * one line beside the trace it places.
         */
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture stands on the scene on screen");
        needs(world.atLeast("occupiedRooms"), "the fixture is placed beside a token standing in a room");
        const scene = canvas?.scene;
        const anchor = Array.from(scene.tokens).find(t => roomOfToken(t));
        ok(anchor, "Foundry has a token standing in a room on the scene on screen, and roomOfToken places none of them");

        const placed = [];
        const place = async data => {
            const token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", scene,
                x: anchor.x, y: anchor.y, note: "test fixture - what ties a trace",
                ...data
            });
            ok(token, "could not place a fixture trace");
            placed.push(token);
            return token;
        };

        try {
            /* ---- 1. THE OBJECT, once it turns out to be the weapon --------- */
            const identity = `suite-${Date.now().toString(36)}`;
            const handedOver = await place({ action: "search", itemIdentity: identity });
            ok(!remnants.remnantData(handedOver)?.tiedToCrime,
                "a Search tied itself to the murder before anything was used");

            const tied = await remnants.tieTraceForItem(identity);
            equal(tied, 1, "the weapon did not find the trace that handed it over");
            ok(remnants.remnantData(handedOver)?.tiedToCrime,
                "the trace that handed over the weapon is still not evidence");

            // And it does not tie anything else: another trace, another object.
            const unrelated = await place({ action: "search", itemIdentity: `${identity}-other` });
            equal(await remnants.tieTraceForItem(identity), 0,
                "tying the same object twice tied something a second time");
            ok(!remnants.remnantData(unrelated)?.tiedToCrime,
                "a trace holding a different object was tied to the murder");

            /* ---- 2. AND ANYTHING LEFT DURING AN INCIDENT ------------------- */
            const murder = await import("./murder.mjs");
            const running = Boolean(murder.murderState());
            const duringIncident = await place({ action: "dynamic" });
            equal(Boolean(remnants.remnantData(duringIncident)?.tiedToCrime), running,
                running
                    ? "an incident is running and the trace left during it is not tied"
                    : "no incident is running and the trace tied itself anyway");

            // The GM's explicit "no" still wins over the incident rule.
            const redHerring = await place({ action: "manual", tiedToCrime: false });
            ok(!remnants.remnantData(redHerring)?.tiedToCrime,
                "a trace the GM said is unrelated was tied anyway");
        } finally {
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(t => t.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }],

    ["a tool takes its tier in bad rolls before it breaks", async () => {
        /*
         * Dawid, 28.08: a Despair no longer ends the tool outright. It spends
         * one point of durability, and only the point that fills it breaks the
         * thing. Tier 0 and 1 have one point, tier 2 two, tier 3 three.
         *
         * AND THE BREAK IS ON THAT ROLL, not on a later sweep: `breakItem`
         * empties the hand, so a tool that goes on its last point is out of
         * play from that moment. The old rule got round to it "after the
         * incident", which is a different moment and the wrong one.
         *
         * Driven through `wearItem` rather than through a real roll, because
         * what is being asked is the arithmetic and the hand - the roll's own
         * despair path has its own scenario, and one that needed a Despair to
         * come up would be a scenario that passes when the dice feel like it.
         */
        const INV = await import("./inventory.mjs");
        const { readiedItems } = await import("./use-items.mjs");
        const actor = game.actors.filter(a => a.type === "character")[0];
        ok(actor, "no character to hand a tool to");

        const made = [];
        try {
            for (const [tier, expected] of [[0, 1], [1, 1], [2, 2], [3, 3]]) {
                const item = await INV.grantItem(actor, {
                    name: `Suite durability tier ${tier}`,
                    category: "tool",
                    tier
                });
                ok(item, `could not make a tier ${tier} tool`);
                made.push(item);

                equal(INV.durabilityOf(item), expected,
                    `a tier ${tier} tool should take ${expected} bad roll(s)`);
                equal(INV.durabilityLeft(item), expected, "a fresh tool is already worn");

                await item.setFlag(MODULE_ID, "equipped", true);
                ok(readiedItems(actor).some(i => i.id === item.id),
                    "the fixture tool is not in hand to begin with");

                // Every point but the last: worn, still whole, still in hand.
                for (let i = 1; i < expected; i++) {
                    const step = await INV.wearItem(item);
                    ok(step && !step.broke,
                        `a tier ${tier} tool broke on bad roll ${i} of ${expected}`);
                    equal(INV.durabilityLeft(item), expected - i, "the wear did not add up");
                    ok(!INV.isBroken(item), "worn is not broken");
                    ok(readiedItems(actor).some(i2 => i2.id === item.id),
                        "a worn tool was taken out of the hand early");
                }

                // The last one.
                const last = await INV.wearItem(item);
                ok(last?.broke, `a tier ${tier} tool survived its ${expected}th bad roll`);
                ok(INV.isBroken(item), "the filling point did not break it");
                equal(INV.durabilityLeft(item), 0, "a broken tool still has durability left");

                // AND THE HAND IS EMPTY NOW, not after the incident.
                ok(!readiedItems(actor).some(i2 => i2.id === item.id),
                    "a broken tool is still being held ready");
                ok(!item.getFlag(MODULE_ID, "equipped"),
                    "a broken tool is still flagged as equipped");

                // Breaking what is broken changes nothing and says so.
                equal(await INV.wearItem(item), null, "a broken tool took more wear");

                // OUT OF THE BAG BEFORE THE NEXT ONE. Tools share a carry
                // limit, and four of them at once is a test of that limit
                // rather than of durability - the fourth was refused, which
                // read as "could not make a tier 3 tool".
                await actor.items.get(item.id)?.delete();
                made.pop();
            }
        } finally {
            for (const item of made) {
                const live = actor.items.get(item.id);
                if (live) await live.delete();
            }
        }
    }],

    ["a private card's notice carries its words, not the placeholder", async () => {
        /*
         * Dawid, 28.08: "Hope Call notices come up empty."
         *
         * THE STUB LANDS FIRST AND ALWAYS WILL. A private card keeps its words
         * off the world database (E17): the document carries a placeholder and
         * the text is addressed by socket. `postSecret` has to create the
         * message before it can send, because the id it keys the words with
         * does not exist until then - so on any client the document arrives,
         * `createChatMessage` fires, and the words are still in flight.
         *
         * The chat log survived that because it redraws the card in place when
         * they land. THE NOTICE IS DRAWN ONCE, so it drew the placeholder: an
         * empty card, on every private notice in the game, since v1.1.47.
         *
         * MEASURED THROUGH THE REAL PATH - `whisperToOwner`, a real card, the
         * notice's own DOM - because the two halves only meet on screen: the
         * words are in a client-side store, the emptiness was in the popup, and
         * every layer in between was working.
         */
        const { whisperToOwner } = await import("./utils.mjs");
        const secret = await import("./secret.mjs");
        const actor = game.actors.filter(a => a.type === "character")[0];
        ok(actor, "no character to whisper to");

        /* THE STACK IS CAPPED, so "one more than there was" is not the question this
           test is asking. `showPopup` keeps at most four notices on screen and only TWO
           under the stained-glass theme - so once the cap is reached a new notice
           replaced an old one and the count did not move (since 22.09 it parks it
           instead, still in the DOM, and R109 holds that). Measured on 11.09: posting
           three notices in a row on a themed client gave 0 -> 1 -> 2 -> 2, and this test
           failed with "no notice appeared at all" while its notice was on the screen.

           So the stack is cleared first and the assertion below asks for the WORDS, which
           is what the test is named after and the only thing that distinguishes this
           notice from every other one a suite run posts. */
        document.querySelectorAll(".drpg-popup").forEach(node => node.remove());
        const words = `Suite notice ${Date.now() % 100000}`;
        let message = null;
        try {
            message = await whisperToOwner(actor, `<h3>Suite probe</h3><p>${words}</p>`, {
                flags: { [MODULE_ID]: { popupTone: "hope", popupForce: true } }
            });
            ok(message, "the card was not posted");
            await wait(900);

            const cards = [...document.querySelectorAll(".drpg-popup")];
            ok(cards.length, "no notice appeared at all");
            /* `textContent`, not `innerText`. The two answer the same question for a
               notice card - are these words in it - and only one of them exists
               outside a browser that lays out: jsdom has no `innerText`, so this
               threw a TypeError and the test sat in the accepted-failures bucket
               under "needs a real canvas", which was never what was missing. */
            const text = cards.map(c => (c.textContent ?? "").replace(/\s+/g, " ")).join(" | ");
            ok(text.includes(words),
                `the notice does not carry the card's words - it reads "${text.trim()}"`);

            // And the other half of the same rule: the DOCUMENT still says
            // nothing, or the privacy this is built on is gone.
            ok(String(message.content).includes("data-drpg-secret"),
                "a private card's words were written into the world after all");
            equal(secret.contentOf(message), `<h3>Suite probe</h3><p>${words}</p>`,
                "the words did not reach the client-side store");
        } finally {
            // All of them: the stack was emptied on the way in, so anything standing
            // here arrived during this test.
            for (const card of [...document.querySelectorAll(".drpg-popup")]) {
                card.dispatchEvent(new CustomEvent("drpg-dismiss"));
            }
            if (message) await message.delete();
        }
    }],
    ["a private card's document says nothing of itself", async () => {
        /*
         * E06 C7a, 27.09.2026; audit L16, S02-02. `report()` (action-rolls.mjs) posted an
         * action's result card with its title and its roll's way as module flags, and
         * `usedStamp` (use-items.mjs) the item a card used - on the document, which every
         * browser holds: 40-flow read "Search" off p2's copy of p1's card. `postSecret` sends
         * them with the words now. Posted here as those two post, through `whisperToOwner`:
         * the document's module flags are `secret` and `drpgMessage` alone and none of the
         * facts is anywhere in it, and the GM - one of the card's readers - reads each of them
         * through `cardFlag`, from the words' meta.
         */
        const [actor] = cast(1);
        const { whisperToOwner } = await import("./utils.mjs");
        const { cardFlag } = await import("./secret.mjs");
        const TITLE = `Suite Search ${Date.now() % 100000}`;
        const used = { id: "SUITEC7AITEM0001", name: "Suite C7a kit", actorId: actor.id };
        let message = null;
        try {
            message = await whisperToOwner(actor, "<p>Suite: an action's result</p>", {
                flags: { [MODULE_ID]: { popupTitle: TITLE, popupTone: "hope", usedItem: used } }
            });
            must(message, "the card was not posted - this would measure nothing");
            const source = JSON.stringify(message.toObject());
            equal(stableJson([Object.keys(message.toObject().flags?.[MODULE_ID] ?? {}).sort(),
                [TITLE, used.name, used.id].filter(fact => source.includes(fact))]),
            stableJson([["drpgMessage", "secret"], []]), "the card's document says what it is about (its module flags, then the facts found in it)");
            equal(stableJson([cardFlag(message, "popupTitle"), cardFlag(message, "popupTone"), cardFlag(message, "usedItem")]),
                stableJson([TITLE, "hope", used]), "the GM, a reader of the card, does not read its title, tone and item from the words");
        } finally {
            if (message) await message.delete();
        }
    }],

    ["the popup's title and the card's sound reach its readers from the words", async () => {
        /*
         * E06 C7a, 27.09.2026. The other half of the test above: what left the document
         * still reaches the card's readers. A notice is drawn once, as the document arrives
         * and before the words and their meta do, so popup.mjs and sfx.mjs wait for the words
         * of every private card now, where they waited only for a veiled one's. The notice is
         * read in its DOM - the title bar and the tone's class; the sound where it leaves the
         * module, `AudioHelper.play`, with a file mapped to it for the test (the one the
         * unplayable-file test above plays; a GM whose sound slider is at zero hears
         * nothing, and that reads as a failure here), and as the decision sfx.mjs plays from
         * (`soundFromMessage`). The card is forced onto the GM's screen (`popupForce`, a
         * GM's), which is itself read from the meta: without it the GM, copied on a player's
         * card, is shown no notice.
         */
        const [actor] = cast(1);
        const { whisperToOwner } = await import("./utils.mjs");
        const { soundFromMessage } = await import("./sfx.mjs");
        document.querySelectorAll(".drpg-popup").forEach(node => node.remove());
        const TITLE = `Suite notice title ${Date.now() % 100000}`;
        const FILE = "modules/dice-so-nice/sounds/dicehit.mp3";
        const map = foundry.utils.deepClone(getSetting(SETTINGS.sfxMap) ?? {});
        const helper = foundry.audio.AudioHelper;
        const play = helper.play;
        const heard = [];
        let message = null;
        try {
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, { ...map, gmAsk: FILE });
            helper.play = function (data, ...rest) {
                heard.push(data?.src ?? null);
                return play.call(this, data, ...rest);
            };
            message = await whisperToOwner(actor, "<p>Suite: a notice with a title</p>", {
                flags: { [MODULE_ID]: { popupTitle: TITLE, popupTone: "hope", popupForce: true, sfx: { key: "gmAsk", gm: true } } }
            });
            must(message, "the card was not posted - this would measure nothing");
            const card = () => [...document.querySelectorAll(".drpg-popup")]
                .find(c => c.querySelector(".drpg-popup-title")?.textContent?.includes(TITLE)) ?? null;
            await until(() => card() && heard.includes(FILE), 4000);
            const notice = card();
            equal(stableJson([Boolean(notice), notice?.classList.contains("drpg-popup-tone-hope") ?? false, heard.includes(FILE),
                soundFromMessage(message), message.toObject().flags?.[MODULE_ID]?.sfx ?? null]),
            stableJson([true, true, true, { key: "gmAsk", forGm: true }, null]),
                "the notice has no title or tone from the card, its sound did not play, or the sound is not read from its words (or is on its document)");
        } finally {
            helper.play = play;
            for (const node of [...document.querySelectorAll(".drpg-popup")]) node.dispatchEvent(new CustomEvent("drpg-dismiss"));
            if (message) await message.delete();
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, map);
        }
    }],

    ["a player's card rings the safeword's siren only with the marker on its document", async () => {
        /*
         * E06 fix r1-G5, 28.09.2026; the round-1 review's m3. The safeword's siren is the
         * one sound above the volume slider, and a player's card may ring it only as the
         * real safeword card, which carries the marker on its document - the flag the
         * pause reads. Since C7a a private card's flags go with its words, and
         * `soundFromMessage` read the marker there too. A player's meta no longer carries
         * it (secret.mjs `GM_META`; 30-security drives a player's own packet), so a GM's
         * card puts it there, and `soundFromMessage` is asked about that card as a
         * player's: the same document and words, an author who is not a GM.
         */
        const { postSecret } = await import("./secret.mjs");
        const { soundFromMessage } = await import("./sfx.mjs");
        let message = null;
        try {
            message = await postSecret({ content: "<p>Suite: a siren in the words</p>", whisper: [game.user.id],
                flags: { [MODULE_ID]: { sfx: { key: "safeword", gm: true }, safeword: true } } });
            must(message, "the card was not posted - this would measure nothing");
            const asPlayer = { id: message.id, flags: message.flags, author: { isGM: false },
                getFlag: (scope, key) => message.getFlag(scope, key) };
            equal(stableJson([soundFromMessage(message)?.key ?? null, soundFromMessage(asPlayer),
                message.getFlag(MODULE_ID, "safeword") ?? null]),
            stableJson(["safeword", null, null]),
                "the GM's card lost its siren, a player's card rings it from its words, or the marker is on the document");
        } finally {
            if (message) await message.delete();
        }
    }],

    ["a thread card still lists in its thread", async () => {
        /*
         * E06 C7a, 27.09.2026. A thread card's placement - its thread, kind and whether it
         * asks the GM - stays on an ordinary thread card's document, whose whisper list names
         * the thread's player anyway, and a GM whose browser missed the words still places it.
         * A veiled one (callGm's, from E06 C8) says nothing of whose thread it is, so its
         * placement goes with the words: `threadMessages` reads it through `cardFlag` and
         * lists the card for its readers. Both kinds are posted into one player's thread.
         */
        needs(world.atLeast("playerAccounts", 1), "a thread is a player's");
        const player = game.users.find(u => !u.isGM);
        const { postSecret } = await import("./secret.mjs");
        const { postToThread, threadMessages, MESSENGER_FLAGS } = await import("./messenger.mjs");
        const { gmIds } = await import("./utils.mjs");
        const made = [];
        try {
            const plain = await postToThread(player.id, "<p>Suite: an ordinary thread card</p>");
            made.push(plain);
            const veiled = await postSecret({ content: "<p>Suite: a veiled thread card</p>", whisper: [player.id, ...gmIds()], veiled: true,
                flags: { [MODULE_ID]: { [MESSENGER_FLAGS.thread]: player.id, [MESSENGER_FLAGS.kind]: "action" } } });
            made.push(veiled);
            must(plain && veiled, "a thread card was not posted - this would measure nothing");
            const listed = threadMessages(player.id).map(m => m.id);
            const own = m => Object.keys(m.toObject().flags?.[MODULE_ID] ?? {}).sort();
            equal(stableJson([own(plain), own(veiled), listed.includes(plain.id), listed.includes(veiled.id)]),
                stableJson([["kind", "secret", "thread"], ["secret", "veiled"], true, true]),
                "a thread card's document lost its placement, a veiled one's names its thread, or either is not listed in the thread");
        } finally {
            for (const message of made) if (message) await message.delete();
        }
    }],

    ["a settled ruling card is settled for its readers", async () => {
        /*
         * E06 C7a, 27.09.2026. `settleCall` (gm-bridge.mjs) wrote `settled` onto the card's
         * document - and so told every browser that a ruling had been made, and when. It
         * goes with the new words now, into the meta the card's readers keep, and the
         * messenger's settled check (`wireCallActions`) reads it there: a GM shown the card
         * again finds no ruling buttons on it. The same check on a card not yet settled keeps
         * them, so the removal is the settlement's and not the check's.
         */
        needs(world.atLeast("playerAccounts", 1), "a ruling card lives in a player's thread");
        const player = game.users.find(u => !u.isGM);
        const { postToThread } = await import("./messenger.mjs");
        const { wireCallActions } = await import("./messenger-app.mjs");
        const { settleCall } = await import("./gm-bridge.mjs");
        const { cardFlag, contentOf } = await import("./secret.mjs");
        const html = `<p>Suite: a ruling card</p><div class="drpg-call-actions"><button type="button" class="drpg-call-action" data-drpg-call="suite">Suite</button></div>`;
        const buttonsAfterWiring = message => {
            const body = document.createElement("div");
            body.innerHTML = html;
            wireCallActions(body, message);
            return body.querySelectorAll("[data-drpg-call]").length;
        };
        let message = null;
        try {
            message = await postToThread(player.id, html);
            must(message, "the ruling card was not posted - this would measure nothing");
            const before = buttonsAfterWiring(message);
            await settleCall(message, "Suite: settled");
            await settle();
            equal(stableJson([before, buttonsAfterWiring(message), cardFlag(message, "settled") ?? null,
                message.toObject().flags?.[MODULE_ID]?.settled ?? null, contentOf(message).includes("Suite: settled")]),
            stableJson([1, 0, true, null, true]),
                "the settled card keeps its buttons for the GM, its words are not the receipt, or `settled` is on its document");
        } finally {
            if (message) await message.delete();
        }
    }],

    ["a player's copy of a ruling card holds no GM-only prose", async () => {
        /*
         * E06 C7b, 27.09.2026; audit L17, S11-05. A ruling card lives in the player's thread
         * and carries the GMs' half of it - `callGm`'s reference prose (`.drpg-gm-only`) and
         * the ruling's buttons (`.drpg-call-actions`) - and its words went to the player
         * whole, into their browser's store and their Chat tab. Read off the packets the GM
         * sends (`wordsSent`), as the card is posted and as `settleCall` rewrites it: each
         * packet to the player holds the card's words without either block, and the GM's own
         * copy keeps the prose, and the buttons until the settlement takes them off.
         */
        needs(world.atLeast("playerAccounts", 1), "a ruling card lives in a player's thread");
        const player = game.users.find(u => !u.isGM);
        const { postToThread } = await import("./messenger.mjs");
        const { settleCall } = await import("./gm-bridge.mjs");
        const { contentOf } = await import("./secret.mjs");
        const PROSE = `Suite GM-only prose ${Date.now() % 100000}`;
        const html = `<p>Suite: a ruling card</p><div class="drpg-gm-only"><p>${PROSE}</p></div>`
            + `<div class="drpg-call-actions"><button type="button" class="drpg-call-action" data-drpg-call="suite">Suite</button></div>`;
        let message = null;
        let posted = "";
        try {
            const sent = await wordsSent(async () => {
                message = await postToThread(player.id, html);
                must(message, "the ruling card was not posted - this would measure nothing");
                posted = contentOf(message);
                await settleCall(message, "Suite: settled");
            });
            const toPlayer = sent.filter(packet => packet.id === message.id && packet.to.includes(player.id));
            const leaks = words => ["drpg-gm-only", "drpg-call-actions", PROSE].filter(part => words.includes(part));
            equal(stableJson([toPlayer.length, toPlayer.map(packet => leaks(packet.html)), toPlayer.map(packet => packet.html.includes("Suite: a ruling card")),
                toPlayer.flatMap(packet => packet.to).filter(id => game.users.get(id)?.isGM), leaks(posted), leaks(contentOf(message))]),
            stableJson([2, [[], []], [true, true], [], ["drpg-gm-only", "drpg-call-actions", PROSE], ["drpg-gm-only", PROSE]]),
                "a packet to the player holds GM-only prose or a ruling button (or lost the card's words, or went to a GM too), or the GM's copy lost them");
        } finally {
            if (message) await message.delete();
        }
    }],

    ["a veiled thread card names no thread", async () => {
        /*
         * E06 C8, 28.09.2026; audit L18, S05-15. A Tamper's reshape card - Stage 6's, when the
         * killer covers their tracks - goes to the GMs through its player's thread, and an
         * ordinary thread card's document names that player to every browser: `thread` in its
         * flags and in its whisper list. Posted veiled now (`callGm`'s `veiled`): the document
         * keeps `secret` and `veiled` alone and is addressed to the whole table, the GM still
         * lists it in the player's thread from the meta its words brought, and the words go to
         * the player and the GMs alone - as it is posted and as `settleCall` rewrites it, whose
         * readers are not the whisper list of a veiled card (secret.mjs `readersOf`).
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 1), "a reshape card lives in its player's thread");
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        const cleanup = await import("./cleanup.mjs");
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const { threadMessages } = await import("./messenger.mjs");
        const { settleCall } = await import("./gm-bridge.mjs");
        const { contentOf, cardFlag } = await import("./secret.mjs");
        const { ownerOf, gmIds } = await import("./utils.mjs");
        const who = livingStudents().find(a => ownerOf(a)?.active);
        must(who, "no living student has a connected player - this would measure nothing");
        const owner = ownerOf(who);
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        let trace = null, copy = null, card = null;
        try {
            trace = await remnants.placeRemnant({ type: "prep", visibility: "evident", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "SUITE C8 a reshape's trace" });
            must(trace, "could not place the fixture trace");
            // A copy puts the trace on its Tamper register (see the N-3 reshape test).
            copy = await bullets.createTruthBullet(who, { name: "SUITE C8 a copy", realType: "neutral", visibility: "obvious",
                remnantId: trace.id, sceneId: scene.id });
            must(copy, "could not copy the fixture trace onto a bullet");
            await settle();
            const before = new Set(game.messages.map(m => m.id));
            const sent = await wordsSent(async () => {
                await cleanup.resolveCleanup({ actorId: who.id, tokenId: trace.id, total: 30, isCritical: false, withHope: true,
                    viaAction: true, mode: "transform", price: "stress", change: { name: "SUITE C8 a kettle", text: "SUITE C8 it was always there" } });
                await settle();
                card = game.messages.find(m => !before.has(m.id) && contentOf(m).includes('data-drpg-call="approveReshape"')) ?? null;
                must(card, "no reshape card was raised - this would measure nothing");
                await settleCall(card, "Suite: settled");
            });
            const readers = [owner.id, ...gmIds()];
            const toCard = sent.filter(packet => packet.id === card.id);
            equal(stableJson([Object.keys(card.toObject().flags?.[MODULE_ID] ?? {}).sort(), game.users.filter(u => !card.whisper.includes(u.id)).map(u => u.id),
                cardFlag(card, "thread") ?? null, threadMessages(owner.id).some(m => m.id === card.id),
                toCard.filter(packet => packet.to.includes(owner.id)).length, toCard.flatMap(packet => packet.to).filter(id => !readers.includes(id)),
                cardFlag(card, "settled") ?? null]),
            stableJson([["secret", "veiled"], [], owner.id, true, 2, [], true]),
                "the reshape card's document names its thread or its player, the GM does not list it in the thread, or its words (posted or settled) went beyond the player and the GMs");
        } finally {
            try { await copy?.delete(); } catch { /* already gone */ }
            if (trace) {
                try { await remnants.dropRemnantSecret(trace); } catch { /* nothing filed */ }
                try { await trace.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the killer's thread lists the receipt, with its Plant button working", async () => {
        /*
         * E06 C8, 28.09.2026; audit L18, S05-15. An item trap that arms posts its killer a
         * receipt with the GMs' Plant button on it (projects.mjs `announceTrapReady`), into the
         * killer's thread - veiled now, so the button's card is placed from its meta. Built and
         * filled here: the receipt's document keeps `secret` and `veiled` alone, the GM lists it
         * in the killer's player's thread, and its Plant button, wired as the messenger wires a
         * bubble, opens the plant window (answered here) and plants the trap's object - the trap
         * waits for its plant before the click and not after - and the card is settled.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 1), "the receipt lives in the killer's player's thread");
        needs(world.atLeast("namedRooms"), "the trap is built in a room");
        const P = await import("./projects.mjs");
        const T = await import("./traps.mjs");
        const { allRooms } = await import("./movement.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const { threadMessages } = await import("./messenger.mjs");
        const { wireCallActions } = await import("./messenger-app.mjs");
        const { contentOf, cardFlag } = await import("./secret.mjs");
        const { ownerOf } = await import("./utils.mjs");
        const killer = livingStudents().find(a => ownerOf(a)?.active);
        must(killer, "no living student has a connected player - this would measure nothing");
        const owner = ownerOf(killer);
        const room = allRooms()[0];
        ok(room, "Foundry has a named room on the scene on screen, and allRooms() finds none");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        const D = foundry.applications.api.DialogV2;
        const own = Object.getOwnPropertyDescriptor(D, "wait");
        let made = null, asked = null;
        try {
            made = await P.createProject({ name: "SUITE C8 item trap", target: 1, room, indirectMurder: true, killerId: killer.id,
                condition: "SUITE C8", trigger: { kind: "item", afterDark: false, notBuilder: true } });
            must(made?.id, "could not create the trap project");
            await settle();
            const seen = new Set(game.messages.map(m => m.id));
            const isReceipt = m => !seen.has(m.id) && contentOf(m).includes('data-drpg-call="plantTrapItem"');
            await P.addProgress(made.id, 1, { by: killer.id });
            await until(() => game.messages.some(isReceipt));
            const receipt = game.messages.find(isReceipt) ?? null;
            must(receipt, "the trap's receipt was not posted - this would measure nothing");
            const waiting = T.itemTrapsWithoutPlant().some(t => t.id === made.id);
            D.wait = async cfg => {
                asked = cfg?.window?.title ?? null;
                return { name: "SUITE C8 a teapot", room };
            };
            const body = document.createElement("div");
            body.innerHTML = contentOf(receipt);
            wireCallActions(body, receipt);
            body.querySelector('[data-drpg-call="plantTrapItem"]')?.click();
            await until(() => cardFlag(receipt, "settled") === true);
            equal(stableJson([Object.keys(receipt.toObject().flags?.[MODULE_ID] ?? {}).sort(), threadMessages(owner.id).some(m => m.id === receipt.id),
                waiting, asked, T.itemTrapsWithoutPlant().some(t => t.id === made.id), cardFlag(receipt, "settled") ?? null]),
            stableJson([["secret", "veiled"], true, true, game.i18n.localize("DRPG.Trap.plantTitle"), false, true]),
                "the receipt's document names its thread, the killer's thread does not list it, or its Plant button did not plant the trap's object and settle the card");
        } finally {
            if (own) Object.defineProperty(D, "wait", own); else delete D.wait;
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
            T.forgetArmedTraps();
            await settle();
        }
    }],

    ["the GM's popup for a veiled ask", async () => {
        /*
         * E06 C8, 28.09.2026. A thread card that asks the GMs (`gmAsk`) raises a notice and
         * plays the ask's sound on a GM's screen (messenger.mjs, messenger-app.mjs) - read off
         * the document, where a veiled card has neither its thread nor its `gmAsk`. They are
         * read from the words' meta now, once the words are here: a veiled `callGm` ask
         * posted on this GM raises the notice headed as a GM's ask, holding the card's
         * title, and the sound plays.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 1), "an ask lives in its player's thread");
        const { callGm } = await import("./gm-bridge.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const { ownerOf } = await import("./utils.mjs");
        const actor = livingStudents().find(a => ownerOf(a)?.active);
        must(actor, "no living student has a connected player - this would measure nothing");
        document.querySelectorAll(".drpg-popup").forEach(node => node.remove());
        const TITLE = `Suite veiled ask ${Date.now() % 100000}`;
        const HEAD = game.i18n.localize("DRPG.Messenger.gmActionTitle");
        const FILE = "modules/dice-so-nice/sounds/dicehit.mp3";
        const map = foundry.utils.deepClone(getSetting(SETTINGS.sfxMap) ?? {});
        const helper = foundry.audio.AudioHelper;
        const play = helper.play;
        const heard = [];
        const seen = new Set(game.messages.map(m => m.id));
        let message = null;
        try {
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, { ...map, gmAsk: FILE });
            helper.play = function (data, ...rest) {
                heard.push(data?.src ?? null);
                return play.call(this, data, ...rest);
            };
            must(await callGm(actor, { title: TITLE, veiled: true }), "the veiled ask was not posted - this would measure nothing");
            const notice = () => [...document.querySelectorAll(".drpg-popup")]
                .find(c => c.querySelector(".drpg-popup-title")?.textContent?.includes(HEAD) && c.textContent.includes(TITLE)) ?? null;
            await until(() => notice() && heard.includes(FILE), 5000);
            message = game.messages.find(m => !seen.has(m.id)) ?? null;
            equal(stableJson([Boolean(notice()), heard.includes(FILE), Object.keys(message?.toObject().flags?.[MODULE_ID] ?? {}).sort()]),
                stableJson([true, true, ["secret", "veiled"]]),
                "the veiled ask raised no GM's notice with its title, its sound did not play, or its document names its thread");
        } finally {
            helper.play = play;
            for (const node of [...document.querySelectorAll(".drpg-popup")]) node.dispatchEvent(new CustomEvent("drpg-dismiss"));
            if (message) await message.delete();
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, map);
        }
    }],


    ["every objection takes a different track from the objection playlist", async () => {
        /*
         * Dawid, 28.08, and he called it a must-have: an Objection must not only
         * put the objection playlist on, it must land on a DIFFERENT track.
         *
         * `playRandomTrack` was written for exactly this and says so in its own
         * note - "what makes a second Objection sound like a second Objection".
         * One line above the call stopped it happening: `crossfade` returned
         * early when the playlist it was asked for was already playing. An
         * Objection cutting into a rebuttal, and a second Objection in the same
         * exchange, both land on the state that is ALREADY playing - so the two
         * cases the feature exists for were the two it could never reach.
         *
         * MEASURED ON THE DOCUMENTS, not on the audio: the sandbox's audio
         * context is locked, so "what is playing" is read off the playlist's own
         * `playing` flags, which is what Foundry itself reads.
         */
        const music = await import("./music.mjs");
        const floor = await import("./trial-floor.mjs");

        /*
         * ITS OWN PLAYLIST, because the question is about the module and not
         * about whichever tracks this world happens to own. A world with one
         * track in its objection playlist cannot answer "did it take a
         * different one", and a scenario that quietly passes on such a world is
         * worse than no scenario.
         */
        const { SETTINGS, getSetting, setSetting } = await import("./settings.mjs");
        const mapBefore = foundry.utils.deepClone(getSetting(SETTINGS.musicMap) ?? {});
        /*
         * AND THE MUSIC ON, because a world's own switch is not the environment
         * (E01, 24.09.2026; audit S14-05). "Follow the game with music" defaults to
         * off, and this test used to find no track playing in any world that had
         * never turned it on - and call that "playlists need audio". It reads the
         * playlist's `playing` flags, which need no audio at all (see above); it
         * needed the switch. The snapshot puts the switch back.
         *
         * The cast is taken before the first write (E30: a world.* probe asked after
         * the test has written FAILs, and this one was asked after the switch).
         */
        const [a, b, c] = cast(3);
        const musicWasOn = getSetting(SETTINGS.musicEnabled);
        await setSetting(SETTINGS.musicEnabled, true);

        const playlist = await Playlist.create({
            name: "Suite objection fixture",
            sounds: [
                { name: "Sting one", path: "sounds/lock.wav" },
                { name: "Sting two", path: "sounds/notify.wav" }
            ]
        });
        ok(playlist, "could not create the fixture playlist");
        ok(Array.from(playlist.sounds ?? []).length >= 2,
            "the fixture playlist did not take both tracks");
        await setSetting(SETTINGS.musicMap, { ...mapBefore, "trial.objection": playlist.id });

        const before = foundry.utils.deepClone(getClock());
        const wasPaused = game.paused;

        const nowPlaying = () => Array.from(playlist.sounds ?? [])
            .filter(s => s.playing).map(s => s.id).sort().join(",");

        try {
            if (wasPaused) await game.togglePause(false);
            await setClock({ phase: "classTrial" });
            await floor.startFloor();
            await settle();

            await floor.openObjection(a.id, b.id);
            await settle();
            const first = nowPlaying();
            ok(first, "an objection started no track at all");

            /*
             * THROUGH THE REBUTTAL, because a second objection DURING an
             * objection is refused on purpose - an objection is one minute
             * alone, and the scenario below this one is what holds that rule.
             * Cutting into a rebuttal is the legal second objection, it is the
             * case Dawid reported, and it is the one that never left the
             * `trial.objection` state: exactly what the early return swallowed.
             */
            await floor.openRebuttal();
            await settle();
            equal(nowPlaying(), first,
                "a rebuttal changed the track; it is the same exchange and must not");

            const cut = await floor.openObjection(c.id, a.id);
            await settle();
            ok(cut, "a third party was refused an objection during a rebuttal");
            const second = nowPlaying();
            ok(second, "a second objection left the playlist silent");
            ok(second !== first,
                `both objections played the same track (${first}) - a second `
                + "objection has to sound like a second objection");
        } finally {
            await floor.endFloor();
            await setClock({ phase: before.phase });
            try { await playlist?.stopAll(); } catch { /* nothing was playing */ }
            await setSetting(SETTINGS.musicMap, mapBefore);
            await setSetting(SETTINGS.musicEnabled, musicWasOn);
            if (playlist) await playlist.delete();
            await settle();
            if (wasPaused) await game.togglePause(true);
        }
    }],

    ["the phase owns the trial's state, whichever route writes it", async () => {
        /*
         * THERE ARE FOUR ROUTES TO A PHASE AND ONLY ONE OF THEM WAS A DOOR.
         *
         * `startClassTrial` and `closeTrial` did the setting up and the taking
         * down. The phase is also a select in "Edit campaign", it is `setPhase`
         * behind the GM panel's Investigation tile and behind `game.drpg`, and
         * it is one field of the season reset - and none of those three ran any
         * of it. Dawid, 14.09: a trial ended from the clock editor was not
         * ended, and the debate floor was still standing.
         *
         * So this drives the route that is NOT a door: a bare `setClock`, the
         * same write those three make, with no console anywhere near it.
         */
        const floor = await import("./trial-floor.mjs");
        const { trialProgress, setTrialProgress } = await import("./vote.mjs");

        const clockBefore = foundry.utils.deepClone(getClock());
        const progressBefore = foundry.utils.deepClone(trialProgress());

        try {
            await setClock({ phase: "classTrial" });
            await floor.startFloor();
            await settle();
            ok(floor.trialFloor(), "the fixture floor did not open");

            await setClock({ phase: "dailyLife" });
            await settle();
            ok(!floor.trialFloor(),
                "the phase left the Class Trial and the debate floor stayed open - "
                + "which is a speaker still holding the floor in Daily Life");

            // ...and the other direction: a trial opened by a bare write starts clean.
            await setTrialProgress({ voteClosed: true, verdictApplied: true });
            await setClock({ phase: "classTrial" });
            await settle();
            const now = trialProgress();
            ok(!now.voteClosed && !now.verdictApplied,
                "a trial opened by moving the phase inherited the last one's vote, so "
                + "its console offered a verdict before anybody had voted");
        } finally {
            await floor.endFloor();
            await setClock({ phase: clockBefore.phase });
            await setTrialProgress(progressBefore);
            await settle();
        }
    }],

    ["the Event panel's incident card reads the cast, not the world", async () => {
        /*
         * THE PANEL VANISHED THE MOMENT THE OPENING ROLL LANDED (Dawid, 14.09).
         *
         * Every id this card needs - the victim, the killer, whose turn it is -
         * moved into the client-scoped cast with LIVE-001, and the card went on
         * reading them off the world setting alone. They were never there, so
         * `victim` came back undefined and the card returned null for the whole
         * incident, on the GM's screen as well as everybody else's. The opening
         * card next to it was written against the cast and kept working, which
         * is why the panel appeared to die exactly at the handover.
         *
         * Read from source rather than driven: what regresses is one read, and
         * the failure is silent - a card that returns null looks exactly like a
         * card with nothing to say.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/events.mjs`).then(r => r.text()));

        const body = fnSource(src, "incidentCard");

        ok(/incidentCast\(\)/.test(body),
            "the incident card no longer merges the cast, so every id it reads is "
            + "undefined and the panel goes blank for the whole incident");

        for (const field of ["victimId", "killerId", "killerTurnId"]) {
            ok(body.includes(`state.${field}`),
                `the incident card stopped reading ${field}`);
        }
    }],

    ["the panel says the scene is stopped, and says the vote is open", async () => {
        /*
         * TWO CARDS THAT KEEP NO STATE OF THEIR OWN, which is the whole reason
         * they are worth a test: each is a reading of two facts that were
         * already being kept somewhere else, and a reading is exactly what rots
         * silently when one of the two moves.
         *
         *   safeword   the game is paused (`game.paused`), the clock stamped
         *              when (`pausedAt`), and the announcement in the log
         *              carries the flag. An ordinary pause gets no card.
         *   vote       the flagged `openVote` announcement for THIS chapter,
         *              and `voteClosed` in `trialProgress` saying it is still
         *              running.
         *
         * Both builders take a clock, so the world's own clock is not moved to
         * run this: the only real state touched is the pause, and it is put
         * back. The negatives are measured as carefully as the positives -
         * a card that appears when it should not is worse than one that does
         * not appear, because nobody goes looking for it.
         */
        const events = await import("./events.mjs");
        const { SAFEWORD_FLAG } = await import("./safeword.mjs");
        const { VOTE_OPEN_FLAG } = await import("./vote.mjs");

        const chapter = getClock().chapter;
        const wasPaused = game.paused;
        const made = [];
        try {
            /* ---- the safeword ---------------------------------------------- */
            const now = Date.now();
            ok(!events.safewordCard({ pausedAt: now }) || game.paused,
                "a card appeared for a game that is not paused");

            if (!game.paused) await game.togglePause(true);
            ok(!events.safewordCard({ pausedAt: now }),
                "an ordinary pause, with nothing in the log, produced a safeword card");

            const call = await ChatMessage.create({
                content: "<p>suite safeword</p>",
                flags: { [MODULE_ID]: { [SAFEWORD_FLAG]: true } }
            });
            made.push(call);
            const card = events.safewordCard({ pausedAt: now });
            ok(card, "the scene is stopped and the panel says nothing about it");
            equal(card.kind, "safeword", "the safeword card came out as the wrong kind");
            ok(!JSON.stringify(card).includes(game.user.name),
                "the safeword card names somebody, and the one promise it makes is that it will not");

            /* A pause that started long after the call is a different pause. */
            ok(!events.safewordCard({ pausedAt: call.timestamp + 600000 }),
                "an old safeword is still showing over a pause it has nothing to do with");

            /* ---- the vote --------------------------------------------------- */
            const trial = { phase: "classTrial", chapter };
            const before = events.trialCard(trial);
            ok(!before || before.title !== game.i18n.localize("DRPG.Events.voteTitle"),
                "the trial card was already showing a vote before one was opened");

            const opened = await ChatMessage.create({
                content: "<p>suite ballots</p>",
                flags: { [MODULE_ID]: { [VOTE_OPEN_FLAG]: true, voteChapter: chapter } }
            });
            made.push(opened);
            const voting = events.trialCard(trial);
            ok(voting, "no trial card during an open vote");
            equal(voting.kind, "trial",
                "the vote built a card of its own instead of a mode of the trial's");
            equal(voting.title, game.i18n.localize("DRPG.Events.voteTitle"),
                "the trial card did not switch to the vote");
            ok(voting.due === true, "an open vote is waiting on people and does not say so");

            /* A ballot from another chapter is another trial's. */
            ok(!events.trialCard({ phase: "classTrial", chapter: chapter + 1 })
                || events.trialCard({ phase: "classTrial", chapter: chapter + 1 }).title
                   !== game.i18n.localize("DRPG.Events.voteTitle"),
                "last chapter's vote is open on this chapter's trial");

            /* And outside a trial there is no card at all, vote or no vote. */
            ok(!events.trialCard({ phase: "dailyLife", chapter }),
                "the trial card is showing in Daily Life");
        } finally {
            for (const m of made) { try { await m.delete(); } catch { /* already gone */ } }
            if (game.paused !== wasPaused) await game.togglePause(wasPaused);
        }
    }],

    ["the safeword's card names nobody", async () => {
        /*
         * E06 C9, 28.09.2026; audit S03-02 (L19). A player's press posted the public card from
         * that player's browser, so its author - on every console, and in Daggerheart's header -
         * was the caller the card calls "somebody". A player's press is a packet to the GMs now,
         * and the primary GM posts the card. The packet is handed to this GM's handler with a
         * connected player's id, as Foundry hands it, and a `who` naming somebody else: the card
         * is this GM's under the banner, names neither the player nor the packet's name, stops
         * the game, and the GMs' detail card names the sender and not the packet's claim. At
         * 1.2.64 there is no handler to hand it to; 40-flow reads the card a real press posts.
         */
        needs(world.atLeast("connectedPlayersWithCharacter", 1), "a safeword packet comes from a player, and Foundry names only a connected one");
        const S = await import("./safeword.mjs");
        const { isPrimaryGm } = await import("./utils.mjs");
        must(isPrimaryGm(), "this browser is not the primary GM, whose card this is to post");
        const player = game.users.find(u => !u.isGM && u.active);
        const run = await safewordRun(S, player,
            () => S.hearSafeword({ action: S.SAFEWORD_ACTION, who: "Somebody Else", room: null }, player.id),
            ([card]) => ({ author: card?.author?.id ?? null, alias: card?.speaker?.alias ?? null,
                actor: card?.speaker?.actor ?? null, doc: JSON.stringify(card?._source ?? null) }));
        const detail = run.popups.join(" | ");
        equal(stableJson([run.author, run.alias, run.actor, run.doc.includes(player.id), run.doc.includes(player.name),
            run.doc.includes("Somebody Else"), run.paused, detail.includes(player.name), detail.includes("Somebody Else")]),
        stableJson([game.user.id, game.i18n.localize("DRPG.Safeword.banner"), null, false, false, false, true, true, false]),
        "the card is not the GM's under the banner, names the caller, did not stop the game, or the detail took the packet's name");
    }],

    ["with no GM online the caller's card carries the alias and the class that hides its header", async () => {
        /*
         * E06 C9, 28.09.2026. With no GM connected a player's press has nobody to ask, and the
         * caller posts the card: the one road where the author is the caller. This browser is a
         * GM, so it cannot be that player; it asks who posts for each kind of press, posts the
         * card a player would (a GM may write another user's author), and presses itself - a GM
         * posts its own. Each card is drawn through the log's render hooks onto a bare card
         * element: the player's is marked for the stylesheet, the GM's is not, and the
         * stylesheet hides the marked card's header. Whether a real log then hides it is the
         * cascade's, which needs a browser; the rule's presence is read from the file.
         */
        needs(world.atLeast("connectedPlayersWithCharacter", 1), "the caller's card is a player's, and the suite borrows a connected one");
        const S = await import("./safeword.mjs");
        const { announce } = await import("./utils.mjs");
        const player = game.users.find(u => !u.isGM && u.active);
        const routes = [S.safewordPoster(player, []), S.safewordPoster(player, [game.user.id]), S.safewordPoster(game.user, [game.user.id])];
        const marked = message => {
            if (!message) return null;
            const li = document.createElement("li");
            li.className = "chat-message message";
            li.innerHTML = `<header class="message-header"></header><div class="message-content"></div>`;
            Hooks.callAll("renderChatMessageHTML", message, li);
            return li.classList.contains("drpg-safeword-unsigned");
        };
        const run = await safewordRun(S, player, async () => {
            await announce({ ...S.safewordCard(), author: player.id });
            await S.callSafeword({});
        }, cards => {
            const by = id => cards.find(m => m.author?.id === id);
            return { n: cards.length, alias: [by(player.id), by(game.user.id)].map(m => m?.speaker?.alias ?? null),
                marked: [marked(by(player.id)), marked(by(game.user.id))] };
        });
        const css = (await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text())).replace(/\/\*[\s\S]*?\*\//g, "");
        const hides = /\.drpg-safeword-unsigned\s+\.message-header\s*\{[^}]*display:\s*none/.test(css);
        const banner = game.i18n.localize("DRPG.Safeword.banner");
        equal(stableJson([routes, run.n, run.alias, run.marked, hides]),
            stableJson([["caller", "gm", "caller"], 2, [banner, banner], [true, false], true]),
            "the wrong browser posts, a card lacks the banner, the caller's card is not marked (or the GM's is), or no rule hides the mark's header");
    }],

    ["a second press inside the window posts nothing", async () => {
        /*
         * E06 C9, 28.09.2026. A player's packet makes the primary GM post in public, so a
         * player's presses are posted once per `TIMING.safewordRepeatMs`: two packets from the
         * same player post one card, a GM's own packet posts none (that GM posted it), and once
         * the window has gone by - the player's entry aged past it - the next press posts again.
         */
        needs(world.atLeast("connectedPlayersWithCharacter", 1), "a safeword packet comes from a player, and Foundry names only a connected one");
        const S = await import("./safeword.mjs");
        const { TIMING } = await import("./config.mjs");
        const { isPrimaryGm } = await import("./utils.mjs");
        must(isPrimaryGm(), "this browser is not the primary GM, whose card this is to post");
        const player = game.users.find(u => !u.isGM && u.active);
        const packet = { action: S.SAFEWORD_ACTION, room: null };
        const counts = [];
        await safewordRun(S, player, async fresh => {
            await S.hearSafeword(packet, player.id);
            await S.hearSafeword(packet, player.id);
            await S.hearSafeword(packet, game.user.id);
            await until(() => fresh().length > 0);
            await settle();
            counts.push(fresh().length);
            S.safewordPosts.set(player.id, Date.now() - TIMING.safewordRepeatMs - 1);
            await S.hearSafeword(packet, player.id);
            await until(() => fresh().length > 1);
            counts.push(fresh().length);
        }, () => ({}));
        equal(stableJson(counts), stableJson([1, 2]),
            "a repeat inside the window was posted, a GM's own packet was, or a press after the window was not");
    }],

    ["the curtain is recut when the tab comes back", async () => {
        /*
         * A BLOCK THAT LEAVES WHILE NOBODY IS LOOKING TOOK ITS PANE WITH IT, and
         * the pane stayed (Dawid, 14.09): the Event panel up, the tab switched
         * away, the incident ends, the panel is removed - and on returning there
         * is a pane of glass and its blur standing over nothing.
         *
         * The DOM observer does fire while hidden, but a hidden tab has a canvas
         * of zero width, so the geometry stands down and paints nothing; and the
         * baseline the drift watch compares against is resampled by the frame
         * that runs the instant the tab comes back, so by the time anything
         * looks, the new layout IS the baseline and no drift is ever seen.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/glass.mjs`).then(r => r.text()));
        ok(/addEventListener\("visibilitychange"/.test(src),
            "nothing recuts the curtain when the document becomes visible, so a block "
            + "that left while the tab was hidden keeps its pane");
    }],

    ["every control in the module's own chrome has a name to be read out", async () => {
        /*
         * A control whose whole content is a glyph says nothing at all to a screen
         * reader: Foundry's `data-tooltip` is drawn, not announced. The sweep in
         * a11y.mjs copies whatever a control already carries into `aria-label`,
         * and writes down the ones it cannot name - this asserts that the list is
         * empty for whatever is on screen when the suite runs.
         *
         * Both halves, because either alone is worthless: a run that found no
         * controls would report a clean list and mean nothing by it.
         */
        const { nameControls, a11yReport } = await import("./a11y.mjs");
        nameControls();

        const SURFACES = ["#drpg-hud", "#drpg-despair", "#drpg-player-status", "#countdowns",
            "#drpg-events", "#drpg-popups", "#drpg-evidence", "#drpg-gm-launcher",
            "#drpg-messenger-launcher", "#drpg-sound-launcher", "#drpg-book-launcher", ".drpg-panel", ".drpg-messenger"];
        let seen = 0;
        for (const sel of SURFACES) {
            for (const host of document.querySelectorAll(sel)) {
                seen += host.querySelectorAll("button, a[href], [role=\"button\"], input, select, textarea").length;
            }
        }
        // The module draws these itself, headless included - so none on screen is the
        // module's failure, not the environment's (E01, audit S14-05).
        ok(seen > 0, "no module control is on screen - the module's interface did not draw");
        const report = a11yReport();
        ok(!/carry no name/.test(report), report);

        /* And the notices are announced when they land. A card that appears in
           silence is a card a blind player never learns about - polite, so it waits
           for the reader to finish rather than cutting across it. */
        const notices = document.getElementById("drpg-popups");
        if (notices) {
            equal(notices.getAttribute("aria-live"), "polite",
                "the notice stack is not a live region, so a notice arrives in silence");
        }
    }],

    ["evidence takes the middle of the screen and a receipt stays in the corner", async () => {
        /*
         * WHY THERE ARE TWO STACKS NOW.
         *
         * The corner tile is 430 x 220 and cannot grow: it shares that corner
         * with Foundry's tool rail, and every larger size was measured taking
         * the rail's glass away (the sweep is at the top of stained-glass.css).
         * A Class Trial objection carrying a Truth Bullet with its analysis and
         * a comment needs 459 px, so in the corner it was a name, four badges
         * and nothing else. Evidence stands in the middle of the map instead.
         *
         * The routing is the whole of the rule and it has three parts, all
         * measured here because two of them are negatives:
         *   - sticky evidence goes to the stage,
         *   - an ordinary notice does not,
         *   - and neither does a NON-sticky evidence card, which is a caller
         *     that wanted the colour for a passing message. A passing message
         *     in the middle of the screen is the interruption the corner exists
         *     to avoid.
         *
         * No layout is needed for any of it, which is why it is here rather
         * than in the glass harness: this is which parent a node has.
         */
        const { showPopup } = await import("./popup.mjs");
        document.getElementById("drpg-evidence")?.remove();
        const before = document.getElementById("drpg-popups")?.querySelectorAll(".drpg-popup").length ?? 0;

        const close = [];
        try {
            close.push(showPopup("<p>the hinge</p>", { kind: "evidence", sticky: true, title: "Evidence" }));
            const stage = document.getElementById("drpg-evidence");
            ok(stage, "a sticky piece of evidence built no stage to stand on");
            equal(stage.querySelectorAll(".drpg-popup").length, 1,
                "the evidence card is not on the stage");
            equal(stage.getAttribute("aria-live"), "polite",
                "the evidence stage is not a live region, so a card lands in silence");

            close.push(showPopup("<p>you found nothing</p>", { kind: "info" }));
            equal(stage.querySelectorAll(".drpg-popup").length, 1,
                "an ordinary notice climbed onto the evidence stage");
            equal(document.getElementById("drpg-popups").querySelectorAll(".drpg-popup").length,
                before + 1, "an ordinary notice left the corner");

            close.push(showPopup("<p>a passing remark</p>", { kind: "evidence" }));
            equal(stage.querySelectorAll(".drpg-popup").length, 1,
                "a non-sticky evidence card took the middle of the screen");

            /* Two is the cap, and the second is the point: an objection answers
               a presentation and reading the two together is the move. Since 22.09
               the third is PARKED under the other two rather than dismissed, so the
               stage shows two and still holds three. */
            close.push(showPopup("<p>objection</p>", { kind: "objection", sticky: true, title: "Objection" }));
            close.push(showPopup("<p>and another</p>", { kind: "evidence", sticky: true, title: "Evidence" }));
            const kept = [...stage.querySelectorAll(".drpg-popup")].filter(c => !c.classList.contains("leaving"));
            const shown = kept.filter(c => !c.classList.contains("drpg-popup-parked"));
            equal(shown.length, 2, "the evidence stage is showing more than the two it is capped at");
            equal(kept.length, 3, "a piece of evidence was thrown away to make room instead of waiting");
        } finally {
            for (const dismiss of close) { try { dismiss?.(); } catch { /* already gone */ } }
        }

        /* And an emptied stage takes itself down rather than leaving an invisible
           live region over the map. The wait is the card's own removal backstop
           in popup.mjs, not a guess: there is no transition in this environment,
           so the timeout is what fires. */
        await wait(1400);
        ok(!document.getElementById("drpg-evidence"),
            "the evidence stage stayed on screen with nothing on it");
    }],

    ["the Key Remnant planner says what is on the map, not what the default was", async () => {
        /*
         * REPORTED AT THE TABLE, 16.09: "the dashboard shows different types of
         * Key Remnant than we really have". It did.
         *
         * The planner's room and visibility pickers were one string built once
         * and stamped into every row, with `selected` hardcoded on "evident"
         * and no room chosen. On an empty row that is correct - they are an
         * input, "create this one here, this visible". On a row whose clue is
         * already ON THE MAP it was a lie twice over: a trace placed as Subtle
         * read "Evident" in its own row, one placed in the Kitchen read "Pick a
         * room", and the control did nothing either way, because the save
         * deliberately leaves rows that already point at a token alone.
         *
         * Driven with a synthetic plan and a synthetic trace rather than by
         * placing one: every input this builder reads is an argument, so the
         * world is not touched and the test measures the builder rather than
         * the placement.
         */
        const { caseKeyRows } = await import("./investigation.mjs");
        const { REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");

        const roomOptionsFor = chosen => ["Kitchen", "Gym"].map(r =>
            `<option value="${r}"${r === chosen ? " selected" : ""}>${r}</option>`).join("");
        const visOptionsFor = chosen => REMNANT_VISIBILITY.map(v =>
            `<option value="${v}"${v === (chosen || "evident") ? " selected" : ""}>${
                REMNANT_VISIBILITY_LABELS[v]}</option>`).join("");

        const placed = [{
            token: { id: "TOKKEY0000000001" },
            scene: { id: "SCN0000000000001", name: "School" },
            data: { visibility: "subtle", visibilityLabel: "Subtle", room: "Kitchen", note: "" }
        }];
        const plan = { chapter: 1, entries: [
            { scale: "trivial", name: "", text: "", note: "", tokenId: "TOKKEY0000000001", sceneId: "SCN0000000000001" },
            { scale: "standard", name: "", text: "", note: "", tokenId: null, sceneId: null }
        ] };
        const status = { entries: [
            { placed: true, found: false, finders: [] },
            { placed: false, found: false, finders: [] }
        ] };

        const html = caseKeyRows({ plan, status, placed, limit: null, roomOptionsFor, visOptionsFor });
        const rows = html.split("<tr").slice(1);
        equal(rows.length, 2, "the planner did not draw one row per planned clue");

        /* ---- the placed row tells the truth and offers no control ---------- */
        const on = rows[0];
        ok(/<select name="vis:0"[^>]*disabled/.test(on),
            "the visibility picker on a placed Key Remnant is still a control, and pressing it does nothing");
        ok(/<option value="subtle" selected>/.test(on),
            "a Key Remnant placed as Subtle is shown as something else in its own row");
        ok(!/<option value="evident" selected>/.test(on),
            "the placed row is still defaulting to Evident over the trace's own visibility");
        ok(/<option value="Kitchen" selected>/.test(on),
            "a Key Remnant placed in the Kitchen does not say so in its own row");
        ok(!on.includes(game.i18n.localize("DRPG.Investigation.pickRoom")),
            "a placed row still offers to pick a room for a clue that is already on the map");

        /* ---- and the empty row is still the input it was ------------------- */
        const off = rows[1];
        ok(!/<select name="vis:1"[^>]*disabled/.test(off),
            "an unplaced row lost the picker it needs to be placed with");
        ok(/<option value="evident" selected>/.test(off),
            "an unplaced row stopped defaulting to Evident");
        ok(off.includes(game.i18n.localize("DRPG.Investigation.pickRoom")),
            "an unplaced row cannot be given a room");
    }],

    ["a project's token wears a frame, and it is the project's own colour", async () => {
        /*
         * REPORTED AT THE TABLE, 16.09: "the project token does not have the same
         * frame as the remnants". It did not - `paint` in remnant-ring.mjs read
         * one flag, and a token without it was a token with its ring destroyed.
         *
         * Two things are asked here and they fail separately.
         *
         * THE COLOUR, driven. A project has no type, so the frame cannot come
         * from the type table: it comes from the tint the token is already
         * wearing, which projects-map.mjs wrote from the project's own state.
         * That is what keeps the frame and the icon from disagreeing - one
         * number, read off the document this client is holding, with no second
         * lookup into a countdown that may not be this client's to read.
         *
         * THE WIRING, read from source. Driving `paint` itself needs a canvas,
         * a placeable and PIXI, none of which exist headless; what would regress
         * silently is the ONE line that lets a project token past the Remnant
         * gate at all, so that line is what this asks about.
         */
        const { frameFor } = await import("./remnant-ring.mjs");
        const { PROJECT_TOKEN } = await import("./config.mjs");

        const hex = raw => foundry.utils.Color.from(raw).valueOf();
        for (const [state, tint] of [["being built", PROJECT_TOKEN.workingTint], ["finished", PROJECT_TOKEN.doneTint]]) {
            const frame = frameFor({ texture: { tint } }, false);
            equal(frame.colour, hex(tint),
                `a project ${state} is framed in something other than its own tint`);
            ok(!frame.reinforced,
                "a project took the reinforced weight, which means something else on a trace");
        }

        /* A token with no tint at all still gets a frame rather than nothing:
           a project that cannot be coloured is still a project standing there. */
        ok(frameFor({ texture: {} }, false).colour != null,
            "a project token with no tint was left with no frame at all");

        const src = stripComments((await moduleSources()).get("remnant-ring.mjs") ?? "");
        const paint = bodyOf(src, "function paint(");
        ok(/projectIdOf\(\s*token\.document\s*\)/.test(paint),
            "paint() stopped asking whether a token is a project, so project tokens lose their frame");
        ok(/!isRemnant\s*&&\s*!project/.test(paint),
            "paint() destroys the ring on a token that is not a Remnant, project or not");
    }],

    ["the portrait picker is a control a keyboard can reach and a reader can name", async () => {
        /*
         * AUDIT 15.09, AND THE TEST ABOVE COULD NOT HAVE CAUGHT IT.
         *
         * The picture beside a Project, a trace or a table entry is the only way
         * to change that image, and it was an `<img alt="">` with a click
         * listener on it: no role, no tabindex, no name. Unreachable by
         * keyboard, invisible to a screen reader. Four call sites, all the same.
         *
         * `a11yReport()` said the chrome was clean the whole time, because its
         * sweep looks for `button, a[href], [role=button], input, select,
         * textarea` and an image with a listener is none of those. The tool
         * built to find nameless controls was structurally unable to see this
         * one - a check passing because it measured nothing, which is the
         * failure this repository opens its own notes with.
         *
         * DRIVEN THROUGH THE REAL WIRING, on markup built the way the call sites
         * build it, and detached from the page so it needs no interface drawn -
         * unlike the sweep test above, which is one of the nine skips headless.
         * What is asserted is what a keyboard and a screen reader would find:
         * something focusable, something with a role, and something with a name
         * that is not the empty string.
         */
        const { wirePortraitPickers } = await import("./utils.mjs");

        const root = document.createElement("div");
        root.innerHTML = `
            <img src="icons/svg/mystery-man.svg" alt="" class="drpg-project-portrait"
                 data-drpg-portrait="p1" data-tooltip="Change the image" />
            <input type="hidden" name="img.p1" value="icons/svg/mystery-man.svg" />
            <img src="icons/svg/mystery-man.svg" alt="" class="drpg-project-portrait"
                 data-drpg-portrait="p2" />
            <input type="hidden" name="img.p2" value="" />`;

        wirePortraitPickers(root);

        const shots = [...root.querySelectorAll("[data-drpg-portrait]")];
        equal(shots.length, 2, "the fixture markup did not survive being parsed");

        for (const shot of shots) {
            equal(shot.getAttribute("role"), "button",
                "a clickable portrait does not announce itself as a control");
            equal(shot.getAttribute("tabindex"), "0",
                "a clickable portrait cannot be reached by keyboard");
            const name = shot.getAttribute("aria-label") ?? "";
            ok(name.trim().length > 0,
                "a clickable portrait carries no name a screen reader could read");
            ok(!/^DRPG\./.test(name),
                `the portrait's name is a raw translation key: ${name}`);
        }

        // The one that had a tooltip keeps ITS words rather than the generic
        // fallback - the sweep's whole rule is "read what it already carries".
        equal(shots[0].getAttribute("aria-label"), "Change the image",
            "the portrait's own tooltip was thrown away in favour of a generic name");

        /* AND THE SWEEP CAN SEE IT NOW. The attributes above are written by
           `wirePortraitPickers`, which runs from a dialog's `render`; a sweep
           that reaches the window first would still have to recognise the
           element. Asserted against a11y.mjs's own selector rather than a copy
           of it, so the two cannot drift. */
        const { CONTROLS } = await import("./a11y.mjs");
        ok(shots.every(s => s.matches(CONTROLS)),
            "a11y.mjs's control selector still cannot see a portrait picker");
    }],

    ["a phone is told apart from a desk, and the curtain stands down on it", async () => {
        /*
         * The three shapes a screen can have, at the sizes they were measured at
         * (audit/glass-harness.html, 13.09). The numbers themselves are in
         * settings.mjs with the measurements that chose them; what this checks is
         * that they are read the same way everywhere and that a window nobody has
         * laid out yet - a measurement of zero - never reads as tiny.
         */
        ok(!narrowScreen(1920) && !narrowScreen(1366) && !narrowScreen(1280),
            "a desk is being restacked as if it were a phone");
        ok(narrowScreen(1024) && narrowScreen(820) && narrowScreen(393),
            "a screen whose blocks were measured colliding is not being restacked");
        ok(!shortScreen(993) && shortScreen(386),
            "a phone held sideways is not being told apart from a desk");
        ok(!shortScreen(993) && !shortScreen(813) && !shortScreen(653),
            "the curtain is standing down on a screen it was measured cutting cleanly "
            + "(no gaps and every block on its own pane from 280 x 653 up)");
        ok(shortScreen(386) && shortScreen(360) && shortScreen(568),
            "the curtain is still being cut where the stack has to scroll and the "
            + "launchers come up into it - measured at 980 x 386 and 640 x 360");
        ok(!narrowScreen(0) && !shortScreen(0),
            "a window that has not been laid out yet reads as a phone, so a client "
            + "mid-boot restacks itself and unmounts its curtain on a measurement of zero");
        ok(BREAKPOINTS.narrow === 1224 && BREAKPOINTS.short === 620,
            "the breakpoints moved without the measurements that chose them moving");

        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/glass.mjs`).then(r => r.text()));
        ok(/drpg-glass-flat/.test(src) && /function glassRoom\(\)/.test(src),
            "the curtain has no gate of its own, so a phone gets a partition cut for a desk");
        ok(/if \(narrowLayout\(\)\) return stackShapes\(/.test(src),
            "a stacked layout is cut by the desk's partition, which splits the blocks at "
            + "half the height and puts every one of a stack's in the top half - measured "
            + "with it forced on at 820 x 1180: 16 blocks off their pane and 206 edge gaps");
        ok(/export function dressWindow\(app\) \{\s*if \(!glassRoom\(\)\)/.test(src),
            "windows are still dressed with glass where no curtain is mounted, so the "
            + "pulse keeps repainting canvases on a phone");
    }],

    ["the blocks stack instead of piling up, and go back on a desk", async () => {
        /*
         * The narrow stack, driven rather than read: the column is made, the three
         * blocks that move are in it, and a screen back on the desk puts every one
         * of them where it came from. What cannot be driven here is the breakpoint
         * itself - `innerWidth` is the harness's window - so the layout is asked
         * for directly and the shape is checked, which is the part that has gone
         * wrong before: a block moved and never moved back.
         */
        const hud = document.getElementById("drpg-hud");
        const rail = document.getElementById("drpg-despair");
        const right = document.getElementById("ui-right-column-1");
        const homes = [hud, rail, right].map(el => el?.parentElement ?? null);
        try {
            applyNarrowLayout();
            const column = document.getElementById("drpg-column");
            if (!narrowLayout()) {
                // a desk: nothing should have been built at all
                ok(!column, "a column was stacked on a screen wide enough for Foundry's own");
            } else {
                ok(!!column, "no column was made on a screen the blocks cannot share");
                for (const el of [hud, rail, right]) {
                    if (el) ok(el.parentElement === column, `${el.id} did not move into the stack`);
                }
            }
        } finally {
            // whatever the screen, the blocks end this test where they started it
            for (const [i, el] of [hud, rail, right].entries()) {
                if (el && homes[i] && el.parentElement !== homes[i]) homes[i].append(el);
            }
        }

        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/narrow.mjs`).then(r => r.text()));
        ok(/#ui-right-column-1/.test(src),
            "the right column is not moved whole, so the Projects tray - which "
            + "Daggerheart appends into it on every project it advances - is left behind");
        ok(/marginTop/.test(src),
            "nothing pushes Foundry's left column below the stack, so the scene "
            + "controls and the GM launcher stand under it");
        /*
         * AND SIDEWAYS, which shipped broken in 1.2.45. The stack ran to eight
         * pixels off the right wall and the sidebar's tab rail stands in the last
         * fifty: 48 px of every row was behind it at every stacked size, which on
         * the Despair rail is where the counts are. Both insets are measured, so
         * both are checked - a stack that reserves the height and not the width is
         * exactly the bug that got out.
         */
        ok(/function railInset\(/.test(src) && /style\.right = /.test(src),
            "the stack does not reserve the width of Foundry's tab rail, so the "
            + "right-hand edge of every row it holds is painted over by the sidebar");
        ok(/#scene-controls/.test(src),
            "the notices do not measure the tool rail the stack pushed down onto "
            + "them, so a notice card stands on the scene controls");

        for (const file of ["hud.mjs", "despair.mjs", "events.mjs"]) {
            const text = stripComments(
                await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(r => r.text()));
            ok(/narrowColumn\(\)/.test(text),
                `${file} renders its block into a column of Foundry's without asking where `
                + "the stack is, so a redraw takes it out of the stack and back into the pile");
        }
    }],

    ["a rebuttal keeps the objection playing and can be cut into", async () => {
        /*
         * Two rulings from Dawid, 28.08, and they are one rule read from both
         * ends: an objection and the rebuttal it buys are ONE exchange.
         *
         *   - the music does not change at the sixty-second mark
         *   - somebody who is not in it may still object
         *
         * The second used to be refused in THREE places: the floor itself, the
         * courtesy check that tells a player why, and the target picker, which
         * narrowed to "your opponent" for everybody. Lifting one without the
         * others is the failure that would have looked like it worked - an
         * objection that lands and is aimed at the wrong half of the pair.
         */
        const floor = await import("./trial-floor.mjs");
        const { currentState } = await import("./music.mjs");

        const [a, b, c] = cast(3);
        const before = foundry.utils.deepClone(getClock());
        /*
         * AND THE WORLD HAS TO BE RUNNING. `currentState()` answers "paused"
         * over everything else while the game is paused - correctly: a table
         * on hold should not have trial music under it. A Foundry world boots
         * paused, so on a fresh server this scenario measured the pause and
         * reported that an objection never reached its own state.
         *
         * The same shape as R12 measuring the browser pane: a test whose answer
         * depends on the state it was handed rather than on the code.
         */
        const wasPaused = game.paused;

        try {
            if (wasPaused) await game.togglePause(false);
            await setClock({ phase: "classTrial" });
            // `startFloor` is what CREATES a floor; `returnToDebate` only
            // moves an existing one back. Without it every call below refuses
            // on `if (!floor) return null` and the trial never leaves
            // `trial.discussion`, which is the state for a trial with no floor
            // open at all - measured, and it is why this test failed first time.
            await floor.startFloor();
            await settle();

            await floor.openObjection(a.id, b.id);
            await settle();
            equal(currentState(), "trial.objection",
                "an objection did not reach its own music state");

            await floor.openRebuttal();
            await settle();
            equal(floor.trialFloor()?.mode, "rebuttal", "the floor did not move to a rebuttal");

            // 1. THE MUSIC. The objection's playlist simply keeps going.
            equal(currentState(), "trial.objection",
                "a rebuttal changed the playlist instead of letting the objection play on");

            // 2. THE THIRD PARTY, who is in neither half of this exchange.
            ok(!floor.maySpeak(c.id), "the third party should not be holding the floor");
            /*
             * AND WHO THEY MAY AIM AT (Dawid, 28.08, correcting the reading of
             * his own ruling). Cutting in is open to anybody; the TARGET is the
             * pair and nobody else, because an objection re-points the floor -
             * aiming a bystander at another bystander would take a rebuttal two
             * people earned and hand it to two who have not spoken.
             */
            const outsider = game.actors.filter(x => x.type === "character"
                && ![a.id, b.id, c.id].includes(x.id))[0];
            if (outsider) {
                const wrongAim = await floor.openObjection(c.id, outsider.id);
                ok(!wrongAim, "a bystander was allowed to aim a rebuttal objection "
                    + "at somebody who is not in it");
                equal(floor.trialFloor()?.mode, "rebuttal",
                    "the refused objection moved the floor anyway");
            }

            const cut = await floor.openObjection(c.id, a.id);
            await settle();
            ok(cut, "a third party was refused an objection during a rebuttal");
            equal(floor.trialFloor()?.holderId, c.id,
                "the floor did not re-point at whoever cut in");
            equal(floor.trialFloor()?.targetId, a.id,
                "the interrupter's objection landed on somebody they did not aim at");

            // 3. AND AN OBJECTION IS STILL ONE MINUTE ALONE.
            const second = await floor.openObjection(b.id, c.id);
            ok(!second, "an objection was allowed to interrupt another objection");
        } finally {
            await floor.endFloor();
            await setClock({ phase: before.phase });
            await settle();
            if (wasPaused) await game.togglePause(true);
        }
    }],

    ["an Eclipse takes every voice off the rooms", async () => {
        // The Eclipse is the placement window. A voice channel that still
        // followed the rooms while the lights were out would be the one thing
        // in the building that could see in the dark - you would hear who came
        // in with you, and hear the room empty when somebody left.
        needs(world.atLeast("occupiedRooms"), "a voice to take off a room");
        const before = await voiceTargets();
        ok(!before.eclipse, "an Eclipse was already running before the test began");
        const placed = [...before.byUser.values()].filter(r => r.room);
        ok(placed.length, "Foundry has a token standing in a room, and voiceTargets() places no account in one");

        await setClock({ ...getClock(), eclipse: true });
        await settle();

        const during = await voiceTargets();
        ok(during.eclipse, "the clock says no Eclipse is running");

        const rooms = new Set();
        for (const [userId, row] of during.byUser) {
            equal(row.room, null, `${game.users.get(userId)?.name} is still placed in a room`);
            ok(row.target, `${game.users.get(userId)?.name} was left on an open channel`);
            // A scene id in the name would leak which map, and a slug would leak
            // which region - the two things the darkness is hiding.
            ok(!row.scene, `${game.users.get(userId)?.name}'s assignment still names a scene`);
            rooms.add(row.target);
        }

        // Every connected account, including any that owns no character at all.
        const connected = game.users.filter(u => u.active).length;
        equal(during.byUser.size, connected, "somebody connected was not given an Eclipse channel");

        // One room each, so each holds one person. GMs deliberately share theirs.
        const players = [...during.byUser].filter(([id]) => !game.users.get(id)?.isGM);
        equal(new Set(players.map(([, r]) => r.target)).size, players.length,
            "two players were put in the same Eclipse channel");

        await setClock({ ...getClock(), eclipse: false });
        await settle();

        const after = await voiceTargets();
        ok(!after.eclipse, "the Eclipse did not end");
        equal([...after.byUser.values()].filter(r => r.room).length, placed.length,
            "the rooms did not come back when the lights did");
    }],

    ["a trial whose verdict is in does not open another", async () => {
        /*
         * F2, reproduced on 16.09: with the verdict applied the console kept The verdict live,
         * and a second one executed whoever the dropdown held. Raced against a timeout, so a
         * regression shows up as a failure and not as a suite waiting on a window forever.
         */
        const { trialProgress, openVerdictDialog } = await import("./vote.mjs");
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {});
        try {
            await game.settings.set(MODULE_ID, SETTINGS.trialProgress, {
                ...trialProgress(), chapter: getClock().chapter, voteClosed: true, verdictApplied: true });
            await settle();
            const answer = await Promise.race([openVerdictDialog(), wait(2500).then(() => "still open")]);
            if (answer === "still open") {
                for (const app of [...foundry.applications.instances.values()]) {
                    if (app.title === game.i18n.localize("DRPG.Vote.verdictTitle")) await app.close({ animate: false });
                }
            }
            equal(answer, null, "the verdict window opened for a trial whose verdict is already in");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.trialProgress, stored);
        }
    }],
    ["deleting either half of a sabotage leaves nothing frozen", async () => {
        /*
         * F5 (17.09): deleting "Repair: X" in the Project Manager left X frozen by a
         * project that no longer existed, out of every list and past any GM control.
         */
        const P = await import("./projects.mjs");
        const meta = foundry.utils.deepClone(P.projectMeta());
        const made = [];
        try {
            const target = await P.createProject({ name: "SUITE F5 target" });
            ok(target?.id, "could not create a project to sabotage");
            made.push(target.id);
            const first = await P.sabotageProject(target.id, 3);
            if (first?.repair?.id) made.push(first.repair.id);
            ok(P.isFrozen(target.id), "the sabotage did not freeze its target, so this proves nothing");

            await P.deleteProject(first.repair.id);
            ok(!P.isFrozen(target.id), "deleting the repair left its target frozen");

            const second = await P.sabotageProject(target.id, 3);
            if (second?.repair?.id) made.push(second.repair.id);
            ok(second?.repair?.id, "could not sabotage the thawed project again");
            await P.deleteProject(target.id);
            ok(!P.allProjects().some(p => p.id === second.repair.id),
                "deleting the broken project left its repair on the board");
            ok(!(second.repair.id in P.projectMeta()), "the orphaned repair left a metadata row behind");
        } finally {
            for (const id of made) await P.deleteProject(id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
    }],

    ["a secret project's repair keeps the secret", async () => {
        /*
         * E06 C10, 28.09.2026; audit S09-01 (L20). Sabotaging a secret project made a public repair
         * named "Repair: <the project>", and finishing it announced both names to the table. A
         * secret project one player can see is sabotaged: its repair is secret, seen by that player
         * and not by another, and named "Repair" alone. Finished, its card is veiled - everybody on
         * its list, no actor speaking - and its words, which name the project, go to the viewer and
         * not to the other player (`wordsSent`; a GM's own copy travels no socket).
         */
        needs(world.atLeast("playerAccounts", 2), "a player who can see the project and one who cannot");
        const P = await import("./projects.mjs");
        const [viewer, outsider] = game.users.filter(u => !u.isGM);
        const NAME = "SUITE C10 hidden work";
        const meta = foundry.utils.deepClone(P.projectMeta());
        const made = [];
        let sealed = null, card = null, sent = [];
        try {
            const target = await P.createProject({ name: NAME, target: 6, secret: true, viewers: [viewer.id] });
            must(target?.id, "could not create a secret project to sabotage");
            made.push(target.id);
            const repairId = (await P.sabotageProject(target.id, 3))?.repair?.id ?? null;
            if (repairId) made.push(repairId);
            const repair = P.allProjects().find(p => p.id === repairId) ?? null;
            sealed = [Boolean(repair), P.isSecret(repairId), repair?.name ?? null, P.canSee(repairId, viewer), P.canSee(repairId, outsider)];
            const from = game.messages.size;
            const words = await wordsSent(async () => {
                if (repairId) await P.addProgress(repairId, 3);
                await settle();
            });
            card = game.messages.contents.slice(from).find(m => words.some(w => w.id === m.id && w.html.includes(NAME))) ?? null;
            sent = words.filter(w => w.id === card?.id).flatMap(w => w.to);
            ok(!game.messages.contents.slice(from).some(m => String(m.content ?? "").includes(NAME)),
                "the repair's end was posted with the project's name in the document");
        } finally {
            for (const id of made) await P.deleteProject(id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
        const everybody = game.users.map(u => u.id).sort();
        equal(stableJson([...sealed, Boolean(card), Boolean(card?.getFlag(MODULE_ID, "veiled")),
            stableJson([...(card?.whisper ?? [])].sort()) === stableJson(everybody), card?.speaker?.actor ?? null,
            sent.includes(viewer.id), sent.includes(outsider.id)]),
            stableJson([true, true, game.i18n.localize("DRPG.Project.repairNameSecret"), true, false, true, true, true, null, true, false]),
            `the secret project's repair was public or named it, or its end was not one veiled card told to its viewer alone: ${
                stableJson({ sealed, whisper: card?.whisper ?? null, speaker: card?.speaker ?? null, sent })}`);
    }],

    ["a watched sabotage of a secret project names no project", async () => {
        /*
         * E06 C10, 28.09.2026; audit S02-12 (L21). A sabotage the room saw was told to everybody
         * standing there with the project's name, secret or not. The line is read as the watched
         * branch posts it (action-rolls.mjs `sabotageWatchedLine`) for three projects: a public
         * one is named; a secret one is not; nor is an indirect murder revealed to the table,
         * which is not secret any more and is still somebody's trap.
         */
        const P = await import("./projects.mjs");
        const { sabotageWatchedLine } = await import("./action-rolls.mjs");
        const [who] = cast(1);
        const meta = foundry.utils.deepClone(P.projectMeta());
        const made = [];
        const line = id => sabotageWatchedLine(who, "SUITE room", P.allProjects().find(p => p.id === id));
        let lines = [];
        try {
            for (const [name, opts] of [["SUITE C10 open plan", {}], ["SUITE C10 secret plan", { secret: true }],
                ["SUITE C10 revealed trap", { indirectMurder: true }]]) {
                const made1 = await P.createProject({ name, target: 6, ...opts });
                must(made1?.id, `could not create "${name}"`);
                made.push(made1.id);
            }
            await P.revealProject(made[2]);
            must(!P.isSecret(made[2]) && P.isIndirectMurder(made[2]), "the revealed trap is still secret, or not a trap");
            lines = made.map(line);
        } finally {
            for (const id of made) await P.deleteProject(id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
        const anon = game.i18n.format("DRPG.Action.sabotageWatchedAnon", { actor: foundry.utils.escapeHTML(who.name), room: "SUITE room" });
        equal(stableJson([lines[0]?.includes("SUITE C10 open plan"), lines[1] === anon, lines[2] === anon]), stableJson([true, true, true]),
            `a watched sabotage named a secret project or a trap, or no longer names a public one: ${stableJson(lines)}`);
    }],

    ["Confusion is seen by the room, and names nobody past it", async () => {
        /*
         * E06 C10, 28.09.2026; audit S09-10 (L23), the owner's answer Q3 (b) of 27.09: a Monocub's
         * Confusion is rolled for the room to see, like every Monocub roll, and its window says so
         * (`meddleIntro`). What the room does not see is whom it was aimed at, and three things
         * told every console: the armed Call stored `from`, the Monocub's actor id, on the
         * target's flag, and the Monocub's receipt, the target's notice and the Call's own notice
         * were whispers whose lists named the two players. A Monocub and its target, each with a
         * player, stand alone in a room; the GM resolves a Hinder of 13 (the +1/-1 tier): the
         * target holds an armed Call with no `from`, and every card whose words went to either
         * player is veiled - everybody on its list, no actor speaking - and the target's player
         * is sent nothing that names the Monocub.
         *
         * AND THE CALL IS NOT ON THE TARGET (E06 fix r2-G4, 28.09.2026; review round 2's mn2).
         * C10 left the entry on the target's `pendingCall` flag, decided against D2 on the ground
         * that the room sees the roll; the roll does not say whom it was aimed at, and the flag,
         * which every browser holds, did - at the moment of the roll. The Call is read here from
         * the GMs' store (gm-stores.mjs `confusionStore`), and the target's flag holds no
         * Confusion. What the target's own player is sent of it is 40-flow's to measure.
         */
        needs(world.atLeast("studentsWithConnectedPlayer", 2), "a Monocub and its target, each with a player to be sent the words");
        const { resolveMeddle } = await import("./monocub.mjs");
        const { pendingCalls } = await import("./call-effects.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const { confusionStore } = await import("./gm-stores.mjs");
        const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
        const [cub, target] = livingStudents().filter(player);
        const { back } = await aloneTogether(cub, target);
        const from = game.messages.size;
        const rowBefore = foundry.utils.deepClone(confusionStore?.get(target.id) ?? null);
        let words = [], armed = null, onFlag = null, inStore = null;
        try {
            await cub.setFlag(MODULE_ID, FLAGS.monocub, true);
            await settle();
            words = await wordsSent(async () => {
                ok((await resolveMeddle({ actorId: cub.id, targetId: target.id, help: false, total: 13, isCritical: false }))?.success,
                    "the Meddle did not land");
                await settle();
            });
            armed = pendingCalls(target).find(entry => entry.key === "meddle") ?? null;
            const flag = target.getFlag(MODULE_ID, FLAGS.pendingCall);
            onFlag = (Array.isArray(flag) ? flag : flag ? [flag] : []).filter(entry => entry?.key === "meddle").length;
            inStore = Boolean(armed) && (confusionStore?.get(target.id)?.calls ?? []).some(entry => entry?.nonce === armed.nonce);
        } finally {
            // The Confusion made here is taken back out of wherever it was armed.
            if (confusionStore) {
                if (rowBefore) await confusionStore.patch(target.id, { calls: rowBefore.calls ?? [] });
                else if (confusionStore.has(target.id)) await confusionStore.drop(target.id);
            }
            if (onFlag) {
                const flag = target.getFlag(MODULE_ID, FLAGS.pendingCall);
                const rest = (Array.isArray(flag) ? flag : flag ? [flag] : []).filter(entry => entry?.key !== "meddle");
                if (rest.length) await target.setFlag(MODULE_ID, FLAGS.pendingCall, rest);
                else await target.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            }
            await back();
        }
        const everybody = stableJson(game.users.map(u => u.id).sort());
        const cards = game.messages.contents.slice(from);
        const told = words.filter(w => w.to.includes(player(cub).id) || w.to.includes(player(target).id));
        const plain = told.map(w => cards.find(m => m.id === w.id))
            .filter(m => !m?.getFlag(MODULE_ID, "veiled") || stableJson([...(m?.whisper ?? [])].sort()) !== everybody || m?.speaker?.actor);
        equal(stableJson([Boolean(armed), armed ? Object.hasOwn(armed, "from") : null, told.length >= 3, plain.length,
            words.some(w => w.to.includes(player(target).id) && w.html.includes(cub.name)), onFlag, inStore]),
            stableJson([true, false, true, 0, false, 0, true]),
            `Confusion stored its Monocub on the target, or a card to either player named them, or named the Monocub to the target, or its Call sits on the target's flag and not in the GMs' store: ${
                stableJson({ armed, onFlag, inStore, told: told.map(w => ({ id: w.id, to: w.to })), plain: plain.map(m => m?.id ?? null) })}`);
    }],

    ["a Confusion 1.2.64 armed on its target's flag moves into the GMs' store, and the flag keeps the other Calls", async () => {
        /*
         * E06 fix r2-G4, 28.09.2026; review round 2's mn2: the clause `liftArmedConfusions`.
         * A character's flag as 1.2.64 left it - a Support and a Confusion, the Confusion still
         * naming its Monocub - is handed to the clause: the Confusion reads back from the GMs'
         * store without `from`, the flag keeps the Support alone, `pendingCalls` still reads
         * both, and a second run finds nothing to do. Put back whatever happens.
         */
        const E = await import("./call-effects.mjs");
        const { confusionStore } = await import("./gm-stores.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const [target] = livingStudents();
        must(target, "no living student to hold the Confusion");
        must(typeof E.liftArmedConfusions === "function" && confusionStore, "there is no clause that moves a Confusion off its target's flag");
        const flagBefore = foundry.utils.deepClone(target.getFlag(MODULE_ID, FLAGS.pendingCall) ?? null);
        const rowBefore = foundry.utils.deepClone(confusionStore.get(target.id) ?? null);
        const ours = entry => /^SUITElift/.test(entry?.nonce ?? "");
        try {
            await target.setFlag(MODULE_ID, FLAGS.pendingCall, [
                { key: "support", kind: "hope", grants: "advantage", amount: null, nonce: "SUITEliftSupport" },
                { key: "meddle", grants: "bonus", amount: -1, from: "SUITEcub", nonce: "SUITEliftConfusion" }]);
            const report = await E.liftArmedConfusions();
            const flag = target.getFlag(MODULE_ID, FLAGS.pendingCall);
            const row = (confusionStore.get(target.id)?.calls ?? []).filter(ours);
            equal(stableJson([(report?.lifted ?? 0) >= 1, (Array.isArray(flag) ? flag : flag ? [flag] : []).map(e => e.nonce),
                row.map(e => [e.key, e.amount, Object.hasOwn(e, "from")]), E.pendingCalls(target).filter(ours).map(e => e.nonce).sort(),
                await E.liftArmedConfusions()]),
                stableJson([true, ["SUITEliftSupport"], [["meddle", -1, false]], ["SUITEliftConfusion", "SUITEliftSupport"], null]),
                "the Confusion stayed on the flag, took the Support with it, kept its Monocub, or the clause ran twice");
        } finally {
            if (flagBefore === null) await target.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            else await target.setFlag(MODULE_ID, FLAGS.pendingCall, flagBefore);
            if (rowBefore) await confusionStore.patch(target.id, { calls: rowBefore.calls ?? [] });
            else if (confusionStore.has(target.id)) await confusionStore.drop(target.id);
        }
    }],

    ["a sealed project keeps its builder in and the rest of the table out", async () => {
        /*
         * F3: an approved trap with nobody under "Also visible to" was sealed away from
         * the student who built it. F4: re-sealing a revealed project kept everybody in.
         */
        const P = await import("./projects.mjs");
        needs(world.atLeast("playersWithCharacter"), "the project is built by a character a player owns");
        needs(world.atLeast("playerAccounts", 2), "a second player has to be kept out");
        const owner = game.users.find(u => !u.isGM
            && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER")));
        const builder = owner && game.actors.find(a => a.type === "character" && a.testUserPermission(owner, "OWNER"));
        const others = game.users.filter(u => !u.isGM && !builder.testUserPermission(u, "OWNER"));
        ok(others.length, "every player account owns the builder, so nobody is left to keep out");
        const meta = foundry.utils.deepClone(P.projectMeta());
        let made = null;
        try {
            made = await P.createProject({ name: "SUITE F3 trap", indirectMurder: true, by: builder.id });
            ok(P.canSee(made.id, owner), "an approved trap is sealed away from the student who built it");
            // The GMs' store's since E05 (C1): projectMeta no longer carries it.
            equal(P.secretsOf(made.id).killerId, builder.id, "the builder is not recorded as the trap's killer");
            ok(!others.some(u => P.canSee(made.id, u)), "a new trap is visible to a player who did not build it");

            await P.revealProject(made.id);
            ok(others.every(u => P.canSee(made.id, u)), "revealing the project did not reveal it");
            await P.makeSecret(made.id, P.sealAudience(made.id));
            ok(P.isSecret(made.id), "the re-seal did not mark the project secret");
            ok(!others.some(u => P.canSee(made.id, u)), "re-sealing a revealed project kept the rest of the table in");
            ok(P.canSee(made.id, owner), "re-sealing shut the builder out of their own project");
        } finally {
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
    }],

    ["Revoke never takes a builder off their own secret project", async () => {
        /*
         * E05 C1, 26.09.2026; audit S09-09. The manager and the project window add the builder
         * whatever is ticked (F3, the test above), and Revoke in the Share window
         * (`unshareWith`) took the student who built a trap off it: they could no longer see it
         * or work on it. Refused now, and the GM told; a guest is still taken off.
         */
        const P = await import("./projects.mjs");
        needs(world.atLeast("playersWithCharacter"), "the project is built by a character a player owns");
        needs(world.atLeast("playerAccounts", 2), "a second player is let in and taken off again");
        const owner = game.users.find(u => !u.isGM
            && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER")));
        const builder = owner && game.actors.find(a => a.type === "character" && a.testUserPermission(owner, "OWNER"));
        const guest = game.users.find(u => !u.isGM && !builder.testUserPermission(u, "OWNER"));
        ok(guest, "every player account owns the builder, so nobody is left to let in");
        const meta = foundry.utils.deepClone(P.projectMeta());
        let made = null;
        try {
            made = await P.createProject({ name: "SUITE S09-09 trap", indirectMurder: true, by: builder.id });
            await P.shareWith(made.id, guest.id);
            ok(P.canSee(made.id, guest), "the guest was not let in - the Revoke below would measure nothing");
            equal(await P.unshareWith(made.id, owner.id), null, "Revoke took the builder's player off their own trap");
            ok(P.canSee(made.id, owner), "the builder's player can no longer see their own trap");
            equal(await P.unshareWith(made.id, guest.id), true, "Revoke no longer takes a guest off");
            ok(!P.canSee(made.id, guest), "the guest still sees the trap after Revoke");
        } finally {
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
    }],

    ["Room Setup's fog edit keeps the rooms found while the window was open", async () => {
        /*
         * ROOM-01 (17.09), at the layer Apply now ends in: a GM ticking one box lays that
         * box onto the ledger as it stands, not the ledger as the window first read it.
         */
        const { applyDiscoveryChanges, discoveredFor } = await import("./fog.mjs");
        const E = await import("./gm-store.mjs");
        const { discoveryStore } = await import("./gm-stores.mjs");
        needs(world.atLeast("namedRooms", 3), "the ledger is written for three rooms");
        const scene = canvas.scene;
        const [student] = cast(1);
        const rooms = Array.from(new Set([...(scene?.regions ?? [])].map(r => r.name).filter(Boolean)));
        ok(rooms.length >= 3, `three named rooms, and ${rooms.length} distinct names among them`);
        // A GM store since E04, in a world it has never opened: the rows are written as cells.
        const found = room => discoveryStore.patch(`${scene.id}/${student.id}`, { [room]: true });
        await E.withGmStoreWorld(`suite-roomsetup-${foundry.utils.randomID(8)}`, async () => {
            await found(rooms[0]);                   // what the window drew
            await found(rooms[1]);                   // found while it was open
            const wrote = await applyDiscoveryChanges(scene, [{ actorId: student.id, room: rooms[2], value: true }]);
            ok(wrote, "the box the GM ticked was not written");
            const now = discoveredFor(scene.id, student.id);
            ok(now.includes(rooms[1]), "a room found while Room Setup was open fogged over on Apply");
            ok(now.includes(rooms[2]), "the box the GM ticked was not saved");
            equal(await applyDiscoveryChanges(scene, [{ actorId: student.id, room: rooms[2], value: true }]),
                false, "an Apply that changes nothing still writes the ledger, and resyncs everyone's fog");
        });
    }],

    ["a Despair Call that would change nothing hands its price back", async () => {
        /*
         * CALL-15 (17.09). Sealing a room that was already sealed charged a second time
         * for nothing. The refund itself is `failed: true`, which is what the caller pays
         * back on.
         */
        const { applyCall, sealedRooms } = await import("./call-effects.mjs");
        needs(world.atLeast("namedRooms"), "a room to seal");
        const room = [...(canvas.scene?.regions ?? [])].map(r => r.name).find(Boolean);
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.sealedRooms) ?? []);
        try {
            await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, []);
            const first = await applyCall(null, "behindClosedDoors", "despair", { room });
            ok(!first.failed && sealedRooms().includes(room), "the first seal did not land, so this proves nothing");
            const second = await applyCall(null, "behindClosedDoors", "despair", { room });
            ok(second.failed, "sealing a room that was already sealed kept its price");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, stored);
            await settle();
        }
    }],

    ["a darkening running now outlasts the counter filling again", async () => {
        /*
         * CALL-06 (17.09). The overflow holds one stamp, and a spill that reached X in a
         * darkened time of day armed the next one over it, ending this one on the spot.
         * Only Fog is left in the hat while this runs, so a regression announces a Fog
         * and changes nobody's sheet. The count is the GMs' record since E05 C12 (the
         * world keeps the stamp): it starts at 0 there and is put back there.
         */
        const o = await import("./overflow.mjs");
        const { overflowStore } = await import("./gm-stores.mjs");
        const clock = getClock();
        if (clock.eclipse) return;               // the Eclipse half reads another stamp
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
        const count = o.overflowCount();
        const rules = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflowRules) ?? {});
        try {
            const effects = Object.fromEntries(Object.keys(o.overflowRules().effects)
                .map(key => [key, { on: key === "fog" }]));
            await game.settings.set(MODULE_ID, SETTINGS.overflowRules, { ...rules, effects });
            await overflowStore.patch("record", { count: 0 });
            await game.settings.set(MODULE_ID, SETTINGS.overflow, {
                active: { session: clock.session, day: clock.day ?? 1, timeOfDay: clock.timeOfDay, effect: "fog" }
            });
            equal(o.overflowEffect(), "fog", "could not set up a darkening for this time of day");
            await o.addOverflow(o.overflowThreshold() + 1, { reason: "suite" });
            await settle();
            equal(o.overflowEffect(), "fog", "the counter filling again ended the darkening running now");
            ok(o.overflowCount() >= o.overflowThreshold(), "the counter paid for a darkening it did not fire");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.overflowRules, rules);
            await game.settings.set(MODULE_ID, SETTINGS.overflow, stored);
            await overflowStore.patch("record", { count });
            await settle();
        }
    }],

    ["two Calls armed on one student both apply, and the same one twice does not", async () => {
        /*
         * CALL-02 live: one slot used to mean a Monokuma's Obstacle silently ate the
         * Support a player had just paid a Hope for. Written straight through
         * `appendArmedCall`, which is the one writer both roads end in.
         */
        const { pendingCalls, appendArmedCall, alreadyArmed, consumeCalls } =
            await import("./call-effects.mjs");
        const [who] = cast(1);
        const before = foundry.utils.deepClone(who.getFlag(MODULE_ID, FLAGS.pendingCall) ?? null);
        try {
            await who.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            await appendArmedCall(who, { key: "support", kind: "hope", grants: "advantage" });
            await appendArmedCall(who, { key: "obstacle", kind: "despair", grants: "disadvantage" });
            await settle();
            equal(pendingCalls(who).length, 2, "the second armed Call replaced the first");
            await appendArmedCall(who, { key: "freeCrit", kind: "hope", grants: "critical" });
            await settle();
            ok(alreadyArmed(who, { key: "freeCrit", grants: "critical" }),
                "a second Loaded Die is not recognised as one already armed");
            ok(!alreadyArmed(who, { key: "support", grants: "advantage" }),
                "a second advantage Call is refused, and those are meant to stack");
            equal((await consumeCalls(who)).length, 3, "spending the armed Calls left some behind");
            equal(pendingCalls(who).length, 0, "the armed list survived being spent");
        } finally {
            if (before) await who.setFlag(MODULE_ID, FLAGS.pendingCall, before);
            else await who.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            await settle();
        }
    }],

    ["a darkening ends with its time of day, not with the Eclipse after it", async () => {
        /*
         * Found in review, 17.09: the clock does not move until an Eclipse ends, so the
         * stamp of the time of day just finished went on matching through the Eclipse
         * after it - a Panic drawn for Noon cut the Afternoon refill. Written straight
         * to the settings, so no Eclipse card or refill runs.
         */
        const o = await import("./overflow.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
        const stamp = { session: clock.session, day: clock.day ?? 1, timeOfDay: clock.timeOfDay };
        try {
            await game.settings.set(MODULE_ID, SETTINGS.clock, { ...clock, eclipse: false });
            await game.settings.set(MODULE_ID, SETTINGS.overflow, { active: { ...stamp, effect: "panic" } });
            await settle();
            equal(o.overflowEffect(), "panic", "could not set up a darkening for this time of day");
            await game.settings.set(MODULE_ID, SETTINGS.clock, { ...clock, eclipse: true });
            await settle();
            equal(o.overflowEffect(), null, "the Eclipse after a darkened time of day is still darkened by it");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.clock, clock);
            await game.settings.set(MODULE_ID, SETTINGS.overflow, stored);
            await settle();
        }
    }],

    ["a conversion leaves the pool until the time of day moves", async () => {
        /*
         * E05 C12, 27.09.2026; audit S09-28. A conversion of a Monokuma's Despair to somebody's
         * Hope took the pool down as the Hope went up, and its card was spoken by the recipient:
         * the pools are on every bar (D3), so every console could pair the two. The Hope comes now,
         * the pool's drop is owed in the GMs' `despairOwed` store and paid at the next time of day
         * (`settleOwed`, on the primary), and the card is veiled. Until then what the pool can spend
         * is the pool less the owed - a second conversion or a Call beyond it is refused - and income
         * into a full pool pays the owed before anything spills. A wrong verdict's fill and the
         * season's zero leave nothing owed. The time of day moves by a write of the clock, the road
         * every change of it takes to `drpgTimeOfDayChanged`. The rows are dropped here; the clock,
         * the pools and the Hope are put back by tier 2's restore.
         */
        const D = await import("./despair.mjs");
        const o = await import("./overflow.mjs");
        const { despairOwedStore } = await import("./gm-stores.mjs");
        const { TIMES_OF_DAY } = await import("./config.mjs");
        const { automatedUpdate } = await import("./resource-guard.mjs");
        const { resourceValue } = await import("./character.mjs");
        const donor = D.monokumas().find(u => u.id === game.user.id) ?? D.monokumas()[0];
        ok(Boolean(donor), "no Monokuma's pool to convert from - this measures nothing");
        const [who] = cast(1);
        const clock = foundry.utils.deepClone(getClock());
        const state = () => [D.getDespair(donor.id), D.owedOf(donor.id), D.spendableDespair(donor.id)];
        const noHope = () => automatedUpdate(who, { "system.resources.hope.value": 0 });
        try {
            await despairOwedStore.drop(donor.id);
            await D.setDespair(donor.id, 5);
            await noHope();
            const from = new Set(game.messages.map(m => m.id));
            const granted = await D.convertDespairToHope(donor.id, who, 2);
            await settle();
            equal(stableJson([granted, ...state(), resourceValue(who, "hope")]), stableJson([2, 5, 2, 3, 2]),
                "the conversion took the pool down at once, owes nothing, or gave no Hope (granted, pool, owed, spendable, Hope)");
            const cards = game.messages.filter(m => !from.has(m.id));
            ok(cards.filter(m => m.getFlag(MODULE_ID, "veiled") === true).length === 1 && !cards.some(m => m.speaker?.actor === who.id),
                `the conversion's card is not one veiled card, or a card is spoken by the recipient: ${stableJson(cards.map(m => [m.speaker?.actor ?? null, Boolean(m.getFlag(MODULE_ID, "veiled"))]))}`);

            // A write of the clock that leaves the time of day where it is - an Eclipse's opening is one - pays nothing.
            await setClock({ timeOfDayStartedAt: (Number(clock.timeOfDayStartedAt) || 0) + 1 });
            await settle();
            await settle();
            equal(stableJson(state()), stableJson([5, 2, 3]), "a write of the clock that left the time of day where it was paid what the pool owes (pool, owed, spendable)");

            equal(stableJson([await D.convertDespairToHope(donor.id, who, 4), await D.spendDespairCall(donor.id, "silence", { announce: false }), ...state()]),
                stableJson([0, false, 5, 2, 3]), "a conversion or a Call beyond what the pool can spend went through: the owed Despair was spent twice");

            const spilled = o.overflowCount();
            await D.setDespair(donor.id, D.despairMax());
            await D.adjustDespair(donor.id, 1);
            await settle();
            equal(stableJson([...state(), o.overflowCount()]), stableJson([D.despairMax(), 1, D.despairMax() - 1, spilled]),
                "income into a full pool spilled before it paid what the pool owes (pool, owed, spendable, the overflow's count)");

            const next = TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(clock.timeOfDay) + 1) % TIMES_OF_DAY.length];
            await setClock({ timeOfDay: next });
            await until(() => D.owedOf(donor.id) === 0, 4000);
            await settle();
            equal(stableJson(state()), stableJson([D.despairMax() - 1, 0, D.despairMax() - 1]),
                "the time of day moved on and the pool did not pay what it owed, or paid it twice (pool, owed, spendable)");

            for (const [what, run, pool] of [["a fill", () => D.fillAllDespair(), D.despairMax()], ["a zero", () => D.zeroAllDespair(), 0]]) {
                await D.setDespair(donor.id, 5);
                await noHope();
                await D.convertDespairToHope(donor.id, who, 1);
                ok(D.owedOf(donor.id) === 1, `the conversion before ${what} owes nothing - this measures nothing`);
                await run();
                equal(stableJson(state()), stableJson([pool, 0, pool]), `${what} left the pool owing a conversion it covers (pool, owed, spendable)`);
            }
        } finally {
            await despairOwedStore.drop(donor.id);
            await settle();
        }
    }],

    ["the Despair counters wait for the rows the other GMs hold", async () => {
        /*
         * E05 fix r2-G2, 27.09.2026; review F5, S2-m7. The owed Despair and the overflow's count
         * are GM stores, and their writers read them and wrote at a new stamp without waiting for
         * the other GMs' copies - the shape fix r1-G3 closed for the Eclipse's count. Each store's
         * hydration is held here by replacing its handle's answer, as the crossing's test does;
         * nothing is decided while held; what another GM holds arrives (written into this client's
         * store: a debt keyed as a pool's own row, which the reading before the fix and the one
         * after both sum), the hold ends, and the decision reads it. A conversion and a Call are
         * refused what the pool owes there; income into a full pool pays that debt rather than
         * spilling it; the overflow adds to the other GM's count, and its zero and its check wait.
         * The rows and the count are put back here; the pools and the Hope by tier 2's restore.
         * Red on 1072bbb's runtime, every check made soft for the run: the conversion granted 2
         * from a pool that owed 2 elsewhere, the Call was bought, the income spilled 1 and left
         * the debt at 2, the overflow read 2 where 3 were counted, and the check and the zero
         * answered at once.
         */
        const D = await import("./despair.mjs");
        const o = await import("./overflow.mjs");
        const S = await import("./gm-stores.mjs");
        const { DESPAIR_CALLS } = await import("./config.mjs");
        const { automatedUpdate } = await import("./resource-guard.mjs");
        const { resourceValue } = await import("./character.mjs");
        const donor = D.monokumas().find(u => u.id === game.user.id) ?? D.monokumas()[0];
        ok(Boolean(donor), "no Monokuma's pool - this measures nothing");
        const [who] = cast(1);
        const c = getClock();
        const since = `${c.session ?? 0}.${c.day ?? 1}.${c.timeOfDay ?? ""}`;
        const cost = DESPAIR_CALLS.silence.cost;
        const real = [[S.despairOwedStore, S.despairOwedStore.whenHydrated], [S.overflowStore, S.overflowStore.whenHydrated]];
        const hold = store => {
            const gate = {};
            gate.promise = new Promise(resolve => { gate.open = () => resolve("answered"); });
            store.whenHydrated = () => gate.promise;
            return gate;
        };
        /* `fn` asked while `store` is held; `peer` writes the other GM's row; answers what `fn` had
           answered before the hold ended ("waiting" while it waited) and after. */
        const heldAcross = async (store, fn, peer) => {
            const gate = hold(store);
            let answer = "waiting";
            const run = fn().then(value => { answer = value; });
            await settle();
            const early = answer;
            await peer();
            gate.open();
            await run;
            for (const [s, whenHydrated] of real) s.whenHydrated = whenHydrated;
            return [early, answer];
        };
        const count0 = S.overflowStore.record().count;
        // Counted to three under a threshold of twenty, so nothing here sets off a darkening; the table's rules are put back.
        const rules0 = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflowRules) ?? {});
        const active0 = game.settings.get(MODULE_ID, SETTINGS.overflow)?.active ?? null;
        try {
            await game.settings.set(MODULE_ID, SETTINGS.overflowRules, { ...rules0, threshold: 20 });
            await S.despairOwedStore.drop(donor.id);
            await D.setDespair(donor.id, 3);
            await automatedUpdate(who, { "system.resources.hope.value": 0 });
            const converted = await heldAcross(S.despairOwedStore, () => D.convertDespairToHope(donor.id, who, 2),
                () => S.despairOwedStore.patch(donor.id, { owed: 2, since }));
            equal(stableJson([...converted, resourceValue(who, "hope")]), stableJson(["waiting", 0, 0]),
                "a conversion was decided before the store held the other GMs' rows, or spent what the pool owes there (before, granted, Hope)");

            await S.despairOwedStore.drop(donor.id);
            await D.setDespair(donor.id, cost);
            const called = await heldAcross(S.despairOwedStore, () => D.spendDespairCall(donor.id, "silence", { announce: false }),
                () => S.despairOwedStore.patch(donor.id, { owed: 1, since }));
            equal(stableJson([...called, D.getDespair(donor.id)]), stableJson(["waiting", false, cost]),
                "a Call was bought before the store held the other GMs' rows, or with what the pool owes there (before, bought, pool)");

            await S.despairOwedStore.drop(donor.id);
            await D.setDespair(donor.id, D.despairMax());
            const spilled = o.overflowCount();
            const income = await heldAcross(S.despairOwedStore, () => D.spillFrom(donor.id, D.despairMax(), 1, "SUITE r2-G2").then(next => next?.spill ?? null),
                () => S.despairOwedStore.patch(donor.id, { owed: 2, since }));
            equal(stableJson([...income, D.owedOf(donor.id), o.overflowCount() - spilled]), stableJson(["waiting", 0, 1, 0]),
                "income into a full pool spilled before the store held the other GMs' rows, or spilled what pays their debt (before, spill, owed, overflow)");

            await S.overflowStore.patch("record", { count: 0 });
            const added = await heldAcross(S.overflowStore, () => o.addOverflow(1, { reason: "SUITE r2-G2" }).then(() => o.overflowCount()),
                () => S.overflowStore.patch("record", { count: 2 }));
            equal(stableJson([...added, o.overflowCount()]), stableJson(["waiting", 3, 3]),
                "the overflow added to its own count before the store held the other GMs', or wrote over theirs (before, after, count)");

            const checked = await heldAcross(S.overflowStore, () => o.checkOverflow(), async () => {});
            equal(stableJson(checked), stableJson(["waiting", null]), "the overflow was judged before the store held the other GMs' count");

            const reset = await heldAcross(S.overflowStore, () => o.resetOverflow({ reason: "SUITE r2-G2" }), async () => {});
            equal(stableJson([...reset, o.overflowCount()]), stableJson(["waiting", true, 0]),
                "the overflow was zeroed before the store held the other GMs' count, or not zeroed");
        } finally {
            for (const [s, whenHydrated] of real) s.whenHydrated = whenHydrated;
            await S.despairOwedStore.drop(donor.id);
            if (count0 === undefined) await S.overflowStore.drop("record");
            else await S.overflowStore.patch("record", { count: count0 });
            if ((game.settings.get(MODULE_ID, SETTINGS.overflow)?.active ?? null) !== active0) {
                await game.settings.set(MODULE_ID, SETTINGS.overflow, { active: active0 });
            }
            await game.settings.set(MODULE_ID, SETTINGS.overflowRules, rules0);
            await settle();
        }
    }],

    ["the trial shuts everything but Analyze and the Objection", async () => {
        /*
         * T-1, Dawid 17.09. One tile, the Objection, the Hope Calls and the items.
         * Asserted through the real entry points rather than off the sheet, because
         * the grey on a tile is a courtesy and these are the boundaries - and by the
         * SENTENCE each refusal gives, because "it returned null" is also what an
         * action with nothing to do returns.
         */
        const [who, other] = cast(2);
        const rolls = await import("./action-rolls.mjs");
        const calls = await import("./calls.mjs");
        const monocub = await import("./monocub.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const actionsBefore = who.system.resources.actions.value;
        const wasCub = Boolean(other.getFlag(MODULE_ID, FLAGS.monocub));

        const locked = game.i18n.localize("DRPG.Trial.actionsLocked");
        const callsLocked = game.i18n.localize("DRPG.Trial.callsLocked");
        const seen = [];
        const warn = ui.notifications.warn.bind(ui.notifications);
        ui.notifications.warn = text => { seen.push(String(text)); return null; };

        try {
            await who.update({ "system.resources.actions.value": 2 });
            await setClock({ ...clock, phase: "classTrial" });
            await settle();

            for (const key of ["search", "tamper", "palm", "observe", "rest",
                "listen", "project", "move", "dynamic", "sabotage"]) {
                seen.length = 0;
                const out = await rolls.performAction(who, key);
                equal(out, null, `${key} was allowed during a Class Trial`);
                ok(seen.includes(locked), `${key} was refused for some reason other than the trial`);
            }
            equal(who.system.resources.actions.value, 2,
                "a tile the trial refused still charged for itself");

            // A Despair Call waits for the trial. The refusal comes before the pool
            // is even looked up, so any actor proves the gate.
            seen.length = 0;
            equal(await calls.spendDespairCallFor(who, "obstacle", { choice: { target: other } }), null,
                "a Despair Call went through during a Class Trial");
            ok(seen.includes(callsLocked), "the Despair Call was refused for some other reason");

            // Confusion is the Monocub's Meddle, and it is named in the decision.
            seen.length = 0;
            await other.setFlag(MODULE_ID, FLAGS.monocub, true);
            await settle();
            equal(await monocub.meddleDialog(other), null,
                "Confusion opened its picker during a Class Trial");
            ok(seen.includes(callsLocked), "Confusion was refused for some other reason");

            /*
             * ANALYZE IS THE ONE TILE THE TRIAL KEEPS OPEN, and it is asserted in
             * R42 rather than here: `performAnalyze` opens a picker for which bullet
             * to read, and a scenario that presses it waits for an answer nobody is
             * there to give.
             */
        } finally {
            ui.notifications.warn = warn;
            await other.setFlag(MODULE_ID, FLAGS.monocub, wasCub);
            await setClock(clock);
            await who.update({ "system.resources.actions.value": actionsBefore });
        }
    }],

    ["opening a trial hands out the time of day's actions and keeps what Hope bought", async () => {
        /*
         * T-1, Dawid 17.09 (answer 3). Driven through `startFloor` rather than
         * `startClassTrial`, because that one opens a DialogV2 the suite cannot
         * press - and because `startFloor` is the road that matters here: it sets
         * the phase itself, so a refill written only into the window would leave
         * this one locked against whatever actions people were holding.
         */
        const [who, hurt] = cast(2);
        const actions = await import("./actions.mjs");
        const { startFloor, endFloor } = await import("./trial-floor.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const before = {
            actions: who.system.resources.actions.value,
            max: who.system.resources.actions.max,
            hurtActions: hurt.system.resources.actions.value,
            hurtMax: hurt.system.resources.actions.max,
            health: hurt.system.resources.hitPoints.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0,
            moves: who.getFlag(MODULE_ID, FLAGS.freeMoveGrants) ?? 0
        };

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.update({ "system.resources.actions.value": 0 });
            await hurt.update({
                "system.resources.actions.value": 0,
                "system.resources.hitPoints.value": hurt.system.resources.hitPoints.max
            });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 1);
            await who.setFlag(MODULE_ID, FLAGS.freeMoveGrants, 1);
            await settle();
            ok(actions.actionBudget(hurt).wounded, "the second fixture is not Wounded");

            await startFloor({});
            await settle();

            equal(getClock().phase, "classTrial", "the floor opened without moving the phase");
            equal(who.system.resources.actions.value, actions.actionBudget(who).total,
                "the trial did not hand out the time of day's actions");
            equal(hurt.system.resources.actions.value, actions.actionBudget(hurt).total,
                "a Wounded student got somebody else's allowance for the trial");
            equal(actions.freeActionsLeft(who), 1, "the trial expired a Burst bought with Hope");
            equal(actions.freeMovesLeft(who), 1, "the trial expired a Sprint bought with Hope");

            /*
             * AND THE SECOND DEBATE REFILLS NOTHING. A trial holds several, and a
             * budget handed out per debate would be an Objection for every one the
             * GM opens.
             */
            await who.update({ "system.resources.actions.value": 0 });
            await endFloor();
            await settle();
            await startFloor({});
            await settle();
            equal(who.system.resources.actions.value, 0,
                "the trial's second debate handed out a fresh budget");
        } finally {
            await endFloor();
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.setFlag(MODULE_ID, FLAGS.freeMoveGrants, before.moves);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.actions.max": before.max
            });
            await hurt.update({
                "system.resources.actions.value": before.hurtActions,
                // The MAXIMUM too: `resetActionsFor` rewrites it, so a Wounded
                // fixture left behind a max of 1 and every later scenario's attempt
                // to set two actions was silently clamped to one.
                "system.resources.actions.max": before.hurtMax,
                "system.resources.hitPoints.value": before.health
            });
            await settle();
        }
    }],

    ["a rebuttal cut-in is not greyed, and a card with nothing behind it is refused", async () => {
        /*
         * THE REGRESSION THIS SPLIT EXISTS FOR (T-1, correcting the first draft).
         * A third party cutting into a rebuttal is legal (Dawid, 28.08). Asked as
         * one combined refusal with no target yet, the rule answers "you named
         * nobody" - and the window would grey the button for a move the floor would
         * have allowed.
         */
        const [who, other, third] = cast();
        const floorMod = await import("./trial-floor.mjs");
        const trial = await import("./trial.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        /*
         * CARDS ON THE TABLE, NOT MESSAGES (E01, 24.09.2026). This compared
         * `game.messages.size` before and after, and passed in a full run only because
         * an earlier scenario had left the floor in a state where nothing else was
         * posted. Run alone - and after the snapshot learnt to put every setting back -
         * it failed on a private whisper to the GM that the fixture's own steps send,
         * which is not a card anybody at the table sees. What the rule forbids is an
         * objection card: a message carrying the `present` flag.
         */
        const presented = () => game.messages.filter(m => m.getFlag(MODULE_ID, trial.TRIAL_FLAGS.present)).length;
        const presentedBefore = presented();

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({});
            await settle();
            ok(await floorMod.openObjection(who.id, other.id), "the fixture objection took no floor");
            await floorMod.openRebuttal();
            await settle();

            equal(floorMod.floorRefusal(), null,
                "a rebuttal greys the Objection button for everybody, which is the bug this split fixes");
            ok(floorMod.targetRefusal(third.id, ""),
                "a submitted objection with no target was accepted");
            ok(floorMod.targetRefusal(third.id, third.id),
                "an objection aimed at oneself was accepted");
            ok(floorMod.targetRefusal(third.id, who.id) === null,
                "a cut-in aimed at somebody already on the floor was refused");

            /*
             * AND THE CARD IS REFUSED WHEN THE FLOOR CANNOT TAKE IT. The window can
             * stand open while the trial moves; this is the last stop before a card
             * raises a sticky OBJECTION! on every screen in the game.
             */
            const bullets = await import("./truth-bullets.mjs");
            const item = await bullets.createTruthBullet(third, {
                name: "Suite fixture - objection price",
                realType: "neutral", visibility: "obvious"
            });
            ok(item, "could not make a fixture Truth Bullet");
            try {
                // No target at all.
                equal(await trial.presentBullet(third, item, { objection: true, targetId: "" }),
                    false, "an objection with no target posted a card");
                // Somebody's minute is running: a second objection is refused.
                await floorMod.openObjection(third.id, who.id);
                await settle();
                equal(await trial.presentBullet(other, item, { objection: true, targetId: who.id }),
                    false, "an objection during somebody else's minute posted a card");
                equal(presented(), presentedBefore,
                    "a refused objection still put a card on the table");
            } finally {
                await item.delete();
            }
        } finally {
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await settle();
        }
    }],

    ["a student with nothing left gets a free Present, and it is logged as a Present", async () => {
        /*
         * The other half of T-1's two refusals: an empty pocket is answered rather
         * than simply refused. The free Present costs nothing, takes no floor, and
         * the log counts it as a Present - which is the whole of the fallback, and
         * is asserted here through `presentBullet` because that is what the window's
         * first button calls.
         */
        const [who, other] = cast(2);
        const floorMod = await import("./trial-floor.mjs");
        const trial = await import("./trial.mjs");
        const price = await import("./price.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };
        let item = null;

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({});
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await who.update({
                "system.resources.actions.value": 0,
                "system.resources.hope.value": 0,
                "system.resources.stress.value": who.system.resources.stress.max
            });
            await settle();

            equal(price.quotePrice(who, "objection").blockedKind, "nothingLeft",
                "the fixture is not actually broke");

            const bullets = await import("./truth-bullets.mjs");
            item = await bullets.createTruthBullet(who, {
                name: `Suite fixture - free present ${Date.now() % 100000}`,
                realType: "neutral", visibility: "obvious"
            });
            ok(item, "could not make a fixture Truth Bullet");

            const was = game.messages.size;
            ok(await trial.presentBullet(who, item, { objection: false, comment: "free" }),
                "the free Present was refused");
            await settle();
            equal(game.messages.size, was + 1, "the free Present posted no card");

            const logged = trial.presentedThisChapter()
                .find(e => e.presenter === who.name && !e.objection);
            ok(logged, "the free Present is not in the log as a Present");

            equal(who.system.resources.actions.value, 0, "the free Present found an action to spend");
            equal(who.system.resources.hope.value, 0, "the free Present spent Hope");
            equal(who.system.resources.stress.value, who.system.resources.stress.max,
                "the free Present marked Sanity");
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "the free Present took the floor, which is the one thing it must not do");
        } finally {
            if (item) await item.delete();
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
            await settle();
        }
    }],

    ["an Objection is paid when it takes the floor, refunded when it does not", async () => {
        /*
         * THE WHOLE OF C6 (T-1), driven the way a player drives it: post the card,
         * and let the primary GM's hook decide. `openObjection` is deliberately not
         * called here - that road is free and is asserted separately below.
         */
        const [who, other, third] = cast();
        const trial = await import("./trial.mjs");
        const floorMod = await import("./trial-floor.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { TRIAL_FLAGS } = trial;
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0,
            max: who.system.resources.actions.max,
            otherActions: other.system.resources.actions.value,
            otherMax: other.system.resources.actions.max
        };
        const made = [];
        const cards = [];

        /** The card a player's window posts, with whatever is being tested left out. */
        const card = async (actor, targetId, { itemId, author = null } = {}) => {
            const data = {
                content: `<p>suite objection ${Date.now() % 100000}</p>`,
                speaker: ChatMessage.getSpeaker({ actor }),
                flags: { [MODULE_ID]: {
                    [TRIAL_FLAGS.present]: true,
                    [TRIAL_FLAGS.objection]: true,
                    [TRIAL_FLAGS.presenter]: actor.name,
                    [TRIAL_FLAGS.item]: itemId ?? null,
                    [TRIAL_FLAGS.target]: targetId,
                    [TRIAL_FLAGS.targetName]: game.actors.get(targetId)?.name ?? null,
                    [TRIAL_FLAGS.chapter]: getClock().chapter,
                    popupKind: "none"
                } }
            };
            if (author) data.author = author;
            const message = await ChatMessage.create(data);
            cards.push(message);
            return message;
        };

        try {
            for (const actor of [who, other, third]) {
                const item = await bullets.createTruthBullet(actor, {
                    name: `Suite fixture - objection ${actor.name}`,
                    realType: "neutral", visibility: "obvious"
                });
                ok(item, `no fixture bullet for ${actor.name}`);
                made.push(item);
            }
            const [whoItem, otherItem, thirdItem] = made;

            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({});
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            // Both fields, because a value is clamped to the maximum on the way in
            // and these two fixtures have been through a Wound in another scenario.
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.actions.max": 2
            });
            await other.update({
                "system.resources.actions.value": 2,
                "system.resources.actions.max": 2
            });
            await settle();

            // ---- it takes the floor, and it is paid for ---------------------
            await card(who, other.id, { itemId: whoItem.id });
            await until(() => floorMod.trialFloor()?.holderId === who.id);
            await settle();
            equal(floorMod.trialFloor()?.holderId, who.id, "the objection card took no floor");
            equal(who.system.resources.actions.value, 0, "the objection was free");

            // ---- a second card inside that minute pays nothing --------------
            const second = await card(other, who.id, { itemId: otherItem.id });
            await until(() => second.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId, who.id,
                "a second objection took the minute out from under the first");
            equal(other.system.resources.actions.value, 2,
                "a refused objection still charged its objector");
            ok(cards[1].getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "the refused card is not marked as refused");

            // ---- and the log says so ---------------------------------------
            const logged = trial.presentedThisChapter({ objectionsOnly: true });
            ok(logged.some(e => e.presenter === other.name && e.refused),
                "the log does not record the refused objection as refused");
            ok(logged.some(e => e.presenter === who.name && !e.refused),
                "the log lost the objection that did take the floor");

            // ---- a card naming no evidence buys nothing ---------------------
            await floorMod.returnToDebate({});
            await settle();
            const noItem = await card(third, who.id, {});
            await until(() => noItem.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "a card naming no evidence took the floor");
            ok(noItem.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "a card naming no evidence was not marked refused");

            // ---- nor one naming evidence the objector does not hold ---------
            const notHis = await card(third, who.id, { itemId: whoItem.id });
            await until(() => notHis.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "a card naming somebody else's evidence took the floor");
            ok(notHis.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "a card naming somebody else's evidence was not marked refused");

            /*
             * ---- nor one whose author does not own the speaker ---------------
             *
             * Only if this world lets a card carry an author other than the user
             * creating it. Where it does not, Foundry has already closed the hole
             * this check exists for and there is nothing to assert.
             */
            const stranger = game.users.find(u => !u.isGM && !who.testUserPermission(u, "OWNER"));
            if (stranger) {
                const forged = await card(who, other.id, { itemId: whoItem.id, author: stranger.id });
                await until(() => forged.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
                await settle();
                if (forged.author?.id === stranger.id) {
                    equal(floorMod.trialFloor()?.holderId ?? null, null,
                        "a card posted in somebody else's name took the floor");
                    ok(forged.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                        "a card posted in somebody else's name was not marked refused");
                    /* AND IT WAS NEVER ON THE TABLE (E02, 24.09.2026; audit S06-34). The
                       refusal came after the sticky OBJECTION! had already gone up on
                       every screen; a card its author could not have posted raises no
                       notice at all now. Read off the notice layer by the card's words. */
                    const words = String(forged.content ?? "").replace(/<[^>]+>/g, "").trim();
                    const shown = [...document.querySelectorAll("#drpg-popups *, #drpg-evidence *")]
                        .some(el => el.textContent?.includes(words));
                    ok(words && !shown, `a card posted in somebody else's name was shown to the table: "${words}"`);
                }
            }

            // ---- an objector with nothing left keeps their nothing -----------
            await who.update({
                "system.resources.actions.value": 0,
                "system.resources.hope.value": 0,
                "system.resources.stress.value": who.system.resources.stress.max
            });
            await settle();
            const broke = await card(who, other.id, { itemId: whoItem.id });
            await until(() => broke.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "an objector with nothing to pay with took the floor anyway");
            ok(broke.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "the card of an objector with nothing left was not marked refused");
            equal(who.system.resources.stress.value, who.system.resources.stress.max,
                "a refused objection moved the Sanity track");

            /*
             * ---- AND CALLING openObjection DIRECTLY CHARGES NOBODY -----------
             * The road api.mjs, the suite and the harness all take.
             */
            await who.update({ "system.resources.actions.value": 2,
                "system.resources.hope.value": 3,
                "system.resources.stress.value": before.stress });
            await settle();
            const snapshot = {
                actions: who.system.resources.actions.value,
                hope: who.system.resources.hope.value,
                stress: who.system.resources.stress.value
            };
            await floorMod.returnToDebate({});
            await floorMod.openObjection(who.id, other.id);
            await settle();
            equal(who.system.resources.actions.value, snapshot.actions,
                "openObjection charged an action by itself");
            equal(who.system.resources.hope.value, snapshot.hope, "openObjection charged Hope by itself");
            equal(who.system.resources.stress.value, snapshot.stress,
                "openObjection marked Sanity by itself");
        } finally {
            for (const message of cards) {
                try { await message.delete(); } catch { /* already gone */ }
            }
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.max": before.max,
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
            await other.update({
                "system.resources.actions.max": before.otherMax,
                "system.resources.actions.value": before.otherActions
            });
            await settle();
        }
    }],

    ["Analyze outside a Class Trial still costs exactly one action", async () => {
        /*
         * The other half of T-1's Analyze rule, and the one a table meets most: in
         * Daily Life the chain is one step long, so a student with no actions and a
         * pocket full of Hope cannot analyse. Driven through `performAction`, which
         * refuses at the quote before it opens anything.
         */
        const [who] = cast(1);
        const rolls = await import("./action-rolls.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const before = {
            actions: who.system.resources.actions.value,
            max: who.system.resources.actions.max,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await who.update({
                "system.resources.actions.max": 2,
                "system.resources.actions.value": 0,
                "system.resources.hope.value": 5,
                "system.resources.stress.value": 0
            });
            await settle();

            equal(await rolls.performAction(who, "analyze"), null,
                "Analyze in Daily Life with no actions left was allowed");
            await settle();
            equal(who.system.resources.hope.value, 5,
                "Analyze outside a trial took Hope, which is a trial-only step");
            equal(who.system.resources.stress.value, 0,
                "Analyze outside a trial marked Sanity, which is a trial-only step");
        } finally {
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.max": before.max,
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
            await settle();
        }
    }],

    ["a critical Tamper hands back the step that paid, and a forged packet still pays", async () => {
        /*
         * T-1's refund, driven through the resolver the way the socket drives it -
         * which is also the only way to test the bound on a claim that crossed it.
         *
         * THREE CLAIMS. "action": the action comes back and the Sanity track does
         * not move, which is the bug this commit exists for - a critical used to
         * clear a mark the attempt had never made. "stress": one mark cleared.
         * "health": a step the table does not know, so the packet is treated as
         * having paid nothing on the client and the GM charges the Sanity itself,
         * exactly as every packet used to.
         */
        const [who] = cast(1);
        const cleanup = await import("./cleanup.mjs");
        const remnants = await import("./remnants.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const before = {
            actions: who.system.resources.actions.value,
            max: who.system.resources.actions.max,
            stress: who.system.resources.stress.value
        };
        const placed = [];
        const made = [];

        /*
         * A trace this character has FOUND, which is what the resolver requires of
         * the Tamper road: `copiedRemnants` is the register, and a Truth Bullet
         * copied off the trace is what puts it there.
         */
        const bullets = await import("./truth-bullets.mjs");
        const fixture = async () => {
            const token = await remnants.placeRemnant({
                type: "prep", visibility: "evident",
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - T-1 tamper price"
            });
            ok(token, "could not place a fixture trace");
            placed.push(token);
            const item = await bullets.createTruthBullet(who, {
                name: `Suite fixture - tamper ${placed.length}`,
                realType: "neutral", visibility: "obvious",
                remnantId: token.id, sceneId: scene.id
            });
            ok(item, "could not copy the fixture trace onto a bullet");
            made.push(item);
            await settle();
            return token;
        };

        try {
            await who.update({
                "system.resources.actions.max": 2,
                "system.resources.actions.value": 1,
                "system.resources.stress.value": 2
            });
            await settle();

            // ---- paid with an action --------------------------------------
            let token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, price: "action"
            });
            await settle();
            equal(who.system.resources.stress.value, 2,
                "a critical paid with an action healed a Sanity mark nobody spent");
            equal(who.system.resources.actions.value, 2, "the action was not handed back");

            // ---- paid with a Sanity mark ----------------------------------
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.stress.value": 2
            });
            await settle();
            token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, price: "stress"
            });
            await settle();
            equal(who.system.resources.stress.value, 1, "the Sanity mark was not lifted");
            equal(who.system.resources.actions.value, 1,
                "a critical paid with Sanity handed back an action as well");

            // ---- a claim the table does not know --------------------------
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.stress.value": 2
            });
            await settle();
            token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, price: "health"
            });
            await settle();
            // Charged one mark as the fallback, then handed one back for the
            // critical: the net is where it started, and the point is that the
            // forged claim bought no free attempt and no free action.
            equal(who.system.resources.actions.value, 1,
                "a forged price claim bought an action");
            equal(who.system.resources.stress.value, 2,
                "a forged price claim did not pay the GM-side Sanity");

            // ---- and a packet with no claim at all pays it ----------------
            await who.update({ "system.resources.stress.value": 0 });
            await settle();
            token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: false, withHope: true, viaAction: true
            });
            await settle();
            equal(who.system.resources.stress.value, 1,
                "a packet claiming nothing was not charged the Sanity the client never paid");
        } finally {
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            for (const token of placed) {
                try { await token.delete(); } catch { /* already gone */ }
            }
            await who.update({
                "system.resources.actions.max": before.max,
                "system.resources.actions.value": before.actions,
                "system.resources.stress.value": before.stress
            });
            await settle();
        }
    }],

    ["a reshaped trace does not change until the GM says so", async () => {
        /*
         * N-3, driven through the resolver the way the socket drives it.
         *
         * THE CLAIM IN ONE LINE: a successful Tamper used to be the write. Now it
         * is a request, and the trace reads exactly as it did until a GM presses a
         * button - so this scenario asserts the trace TWICE, once either side of
         * the ruling, and again after a decline.
         *
         * The fixture is `copiedRemnants`: the Tamper road refuses a trace the
         * character has not found, and a Truth Bullet copied off it is what puts
         * it on that register.
         */
        const [who] = cast(1);
        const cleanup = await import("./cleanup.mjs");
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const stamp = Date.now() % 100000;
        const placed = [];
        const made = [];

        const fixture = async () => {
            const token = await remnants.placeRemnant({
                type: "prep", visibility: "evident",
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - N-3 reshape ruling"
            });
            ok(token, "could not place a fixture trace");
            placed.push(token);
            const item = await bullets.createTruthBullet(who, {
                name: `Suite fixture - reshape ${placed.length}`,
                realType: "neutral", visibility: "obvious",
                remnantId: token.id, sceneId: scene.id
            });
            ok(item, "could not copy the fixture trace onto a bullet");
            made.push(item);
            await settle();
            return token;
        };

        const tamper = (token, name, text) => cleanup.resolveCleanup({
            actorId: who.id, tokenId: token.id, total: 30,
            isCritical: false, withHope: true, viaAction: true,
            mode: "transform", price: "stress",
            change: { name, text }
        });

        try {
            // ---- a success proposes, and writes nothing -------------------
            const first = await fixture();
            const before = new Set(game.messages.map(m => m.id));
            await tamper(first, `Spilled paint ${stamp}`, "A tin went over during the afternoon.");
            await settle();

            const still = remnants.remnantData(first);
            equal(still.type, "prep",
                "the trace became something else before anybody had ruled on it");
            ok(!still.public?.name?.includes(String(stamp)),
                "the killer's name for the trace was written without a ruling");

            /* READ THROUGH secret.mjs, as every reader of a card has to since 1.2.44
               ("The messenger's threads are private cards"): a message's own
               `content` is a stub dash and the words live in the secret store. This
               scenario read `content` directly, so after the merge with 1.2.47 it
               reported "no ruling card" beside a card that was there. */
            const { wordsOf } = await import("./secret.mjs");
            const fresh = game.messages.filter(m => !before.has(m.id));
            const said = await Promise.all(fresh.map(m => wordsOf(m, 2000)));
            const at = said.findIndex(html => html.includes('data-drpg-call="approveReshape"'));
            ok(at >= 0, "no ruling card was raised, so the lie is waiting on nobody");
            ok(said[at].includes(`data-trace="${first.id}"`),
                "the card does not name the trace it is about");

            // ---- and the ruling is what writes ---------------------------
            const applied = await cleanup.applyReshapeRuling({
                actorId: who.id, tokenId: first.id,
                name: `Spilled paint ${stamp}`, text: "A tin went over during the afternoon."
            });
            await settle();
            ok(applied, "the approval refused a trace that was still standing");
            const after = remnants.remnantData(first);
            equal(after.type, "resolution", "approving did not turn it into a Tamper Remnant");
            equal(after.public?.name, `Spilled paint ${stamp}`,
                "the name the GM approved never reached the record");
            equal(after.visibility, "evident",
                "a plain success bought the quiet half, which belongs to a critical");

            // ---- a decline leaves the trace exactly as it was ------------
            const second = await fixture();
            await tamper(second, `Nothing here ${stamp}`, "Just a scuff.");
            await settle();
            await cleanup.declineReshapeRuling({ actorId: who.id });
            await settle();
            const kept = remnants.remnantData(second);
            equal(kept.type, "prep", "a declined reshape changed the trace anyway");
            ok(!kept.public?.name?.includes(String(stamp)),
                "a declined name was written onto the trace");

            // ---- and a trace that is gone cannot be relabelled -----------
            const third = await fixture();
            const id = third.id;
            await third.delete();
            await settle();
            const ghost = await cleanup.applyReshapeRuling({
                actorId: who.id, tokenId: id, name: "Ghost", text: "Nothing."
            });
            ok(!ghost, "the approval claimed to relabel a trace that no longer exists");

            // ---- a card from dice a Reroll replaced rules on nothing -------
            // (review of stage D) Card #1 is raised, a Reroll replays the attempt
            // and loses, and Approve on card #1 used to write the lie anyway.
            const attemptOf = async token => {
                for (const m of [...game.messages].reverse().slice(0, 12)) {
                    const html = await wordsOf(m, 1500);
                    const at = html.match(new RegExp(
                        `data-drpg-call="approveReshape"[^>]*data-trace="${token.id}"[^>]*data-attempt="(\\w+)"`));
                    if (at) return at[1];
                }
                return null;
            };
            const fourth = await fixture();
            await tamper(fourth, `Stale ${stamp}`, "A card from dice that are gone.");
            await settle();
            const stale = await attemptOf(fourth);
            ok(stale, "the ruling card does not say which attempt it was raised for");
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: fourth.id, total: 0,
                isCritical: false, withHope: true, viaAction: true,
                mode: "transform", price: "stress", undo: true,
                change: { name: `Stale ${stamp}`, text: "A card from dice that are gone." }
            });
            await settle();
            const voided = await cleanup.applyReshapeRuling({
                actorId: who.id, tokenId: fourth.id, attempt: stale,
                name: `Stale ${stamp}`, text: "A card from dice that are gone."
            });
            equal(voided, false, "a card from an attempt a Reroll took back was not refused");
            ok(!remnants.remnantData(fourth)?.public?.name?.includes(String(stamp)),
                "a Reroll that lost still let the older card write the lie");

            // ---- the erase road: a declined story still erases -----------
            // A critical on the erase road bought an erase; the rewrite was the
            // upgrade on top. Declining the story used to leave the trace standing.
            const fifth = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: fifth.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, mode: "erase",
                price: "stress",
                transform: { name: `Decoy ${stamp}`, text: "A decoy.", visibility: "subtle" }
            });
            await settle();
            ok(remnants.remnantData(fifth), "a proposed rewrite erased the trace before any ruling");
            const decoy = await attemptOf(fifth);
            const erased = await cleanup.declineReshapeRuling({
                actorId: who.id, tokenId: fifth.id, erase: true, attempt: decoy
            });
            await settle();
            ok(erased, "the decline on the erase road was refused");
            ok(!canvas.scene.tokens.get(fifth.id),
                "declining the story left the trace the critical had paid to erase");
        } finally {
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            for (const token of placed) {
                try { await token.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["a reading lost from a bullet's secret is asked of the trace, and a Reroll takes it back", async () => {
        /*
         * T-2, Dawid 17.09, on the model 1.2.47 shipped: the GM's sentence is
         * `analyzedText` on the trace's `public` record, filed in each copy's secret
         * and published onto the item at the moment of analysis. The scenario "the
         * analysis half of a trace is not on the item until it is bought" holds the
         * four places it must not leak; this holds the three things it does not
         * ask. The sentence is never written onto the token document, which every
         * client can read. A rerolled Analyze takes it back off the item. And a copy
         * whose secret holds nothing - minted from a trace that was already
         * revealed, or filed on another GM's browser - gets the words from the
         * trace itself when it is identified.
         */
        const [one] = cast(1);
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const analyze = await import("./analyze.mjs");
        const F = bullets.TRUTH_BULLET_FLAGS;
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const said = `Fixture analysis ${Date.now() % 100000}`;
        let token = null;
        const made = [];

        try {
            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident",
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - T-2"
            });
            ok(token, "could not place the fixture trace");

            await remnants.setRemnantPublic(token, { analyzedText: said });
            await settle();
            equal(remnants.remnantPublic(token)?.analyzedText, said,
                "the trace did not remember what analysing it says");
            ok(!JSON.stringify(token.toObject()).includes(said),
                "the sentence is written on the token document, which every client can read");

            const plain = await bullets.createTruthBullet(one, {
                name: `Suite fixture - unread ${Date.now() % 100000}`,
                realType: "prep", visibility: "evident",
                remnantId: token.id, sceneId: scene.id, analyzedText: said
            });
            ok(plain, "could not copy the trace for the holder");
            made.push(plain);
            await settle();

            // The moment of analysis, and a Reroll that loses it.
            await analyze.resolveAnalyze({ actorId: one.id, itemId: plain.id, total: 30 });
            await settle();
            equal(plain.getFlag(MODULE_ID, F.analyzedText), said,
                "analysing the bullet did not publish the sentence");
            await analyze.resolveAnalyze({ actorId: one.id, itemId: plain.id, total: 2, undo: true });
            await settle();
            equal(plain.getFlag(MODULE_ID, F.analyzedText) ?? "", "",
                "a rerolled Analyze left the sentence published");
            /* THE BUG THIS SCENARIO FOUND ON 21.09, in 1.2.47 as shipped: the undo's
               cleared reading was carried UP by the edit sync and erased the GM's own
               sentence from the trace - and from there, from every copy. */
            equal(remnants.remnantPublic(token)?.analyzedText, said,
                "a rerolled Analyze erased the GM's sentence from the trace itself");
            equal(plain.getFlag(MODULE_ID, F.faint) ?? null, null,
                "a rerolled Analyze left the Faint badge the first throw published");
            ok(!JSON.stringify(plain.toObject()).includes(said),
                "a rerolled Analyze left the sentence somewhere on the item");

            // AND THE FALLBACK: a secret with nothing in it asks the trace.
            // The Reroll above lost, which locks the bullet for this chapter, and
            // since E03 the lock holds on the GM's side too (audit S05-40): a GM
            // lifts it, as a GM would, before the bullet is analysed again.
            await bullets.setSecret(plain.uuid, { analyzedText: "" });
            await plain.update({ [`flags.${MODULE_ID}.${F.lockedChapter}`]: null });
            await settle();
            await analyze.resolveAnalyze({ actorId: one.id, itemId: plain.id, total: 30 });
            await settle();
            equal(plain.getFlag(MODULE_ID, F.analyzedText), said,
                "a bullet whose secret was empty published nothing, instead of asking the trace");
        } finally {
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            if (token) {
                try { await remnants.dropRemnantSecret(token); } catch { /* nothing filed */ }
                try { await token.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the reset's exceptions are remembered, and come back unticked", async () => {
        /*
         * R-1. The memory, not the wipe: no scenario runs a real season reset, for
         * the reason the suite's contract gives - a wipe takes advancement and items
         * off a live cast, and what is put back is a fixture rather than a season.
         * What is driven here is every function the window leans on.
         */
        const ex = await import("./season-exceptions.mjs");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.seasonExceptions) ?? []);

        try {
            // A plan is what is TICKED; the exceptions are the rest, in table order.
            const all = ex.RESET_GROUPS.map(group => group.key);
            const plan = ex.planFrom(all.filter(key => key !== "advancement" && key !== "rules"));
            equal(plan.keep.join(","), "advancement,rules",
                "the plan's exceptions are not the unticked groups in table order");
            ok(!plan.groups.has("advancement"), "an unticked group is still in the plan");

            await ex.rememberExceptions(plan.keep);
            await settle();
            const back = ex.rememberedExceptions();
            equal([...back.keys].sort().join(","), "advancement,rules",
                "the exceptions did not survive being remembered");
            equal(back.dropped, 0, "a remembered exception was dropped that this version still knows");

            /*
             * A KEY THIS VERSION NO LONGER KNOWS IS DROPPED, not carried into a
             * plan - otherwise a group renamed in a later release leaves a world
             * with an exception nothing can untick.
             */
            await game.settings.set(MODULE_ID, SETTINGS.seasonExceptions,
                ["advancement", "somethingWeRenamed"]);
            await settle();
            const bounded = ex.rememberedExceptions();
            equal([...bounded.keys].join(","), "advancement",
                "an unknown remembered key was carried into the plan");
            equal(bounded.dropped, 1, "the window would not be able to say what it dropped");

            // And nothing ticked is not a reset: `planFrom` says so by being empty,
            // which is what `resetSeason` refuses on.
            equal(ex.planFrom([]).groups.size, 0, "an empty plan claims to clear something");
            equal(ex.planFrom([]).keep.length, ex.RESET_GROUPS.length,
                "an empty plan does not treat every group as an exception");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.seasonExceptions, before);
            await settle();
        }
    }],

    ["no module window is wider than the cap, and they open on the centre", async () => {
        /*
         * W-9. Trivially true at this viewport and the whole point at 5120x1440 -
         * which is exactly why it is written here rather than left to a screenshot
         * on one GM's monitor. What it really holds is the SHAPE: a module window
         * that states an explicit `left`, or one whose width beats the cap, fails
         * here on any screen.
         */
        const { openLookDialog } = await import("./look.mjs");
        // A width and a centre need layout; with none, every box is 0 wide and the loop
        // below measured nothing and passed (E01, 24.09.2026).
        needs(env.layout(), "a window's width and centre need a browser");
        const cap = parseFloat(getComputedStyle(document.body)
            .getPropertyValue("--drpg-window-max")) || 1400;
        const ceiling = Math.min(0.96 * window.innerWidth, cap) + 4;

        let app = null;
        /*
         * HELD, NOT AWAITED. `openLookDialog` awaits its own `DialogV2.wait`, which
         * resolves when the window CLOSES - and the only thing that will close it is
         * the end of this test. Awaiting the opener hangs the suite against its own
         * window (measured: fifteen minutes of silence, 19.09).
         */
        const opening = openLookDialog();
        try {
            await until(() => [...foundry.applications.instances.values()]
                .some(a => a.element?.matches?.('.application.dialog[class*="drpg-"]')));
            await settle();
            app = [...foundry.applications.instances.values()]
                .find(a => a.element?.matches?.('.application.dialog[class*="drpg-"]'));
            ok(app, "the Look window did not open, so nothing could be measured");

            for (const instance of foundry.applications.instances.values()) {
                const el = instance.element;
                if (!el?.matches?.('.application.dialog[class*="drpg-"]')) continue;
                const box = el.getBoundingClientRect();
                ok(box.width > 0, `${instance.constructor.name} has no width in a browser that lays out`);
                ok(box.width <= ceiling,
                    `${instance.constructor.name} is ${Math.round(box.width)}px wide, over the ${
                        Math.round(ceiling)}px cap`);
                const centre = box.left + box.width / 2;
                ok(Math.abs(centre - window.innerWidth / 2) <= 2,
                    `${instance.constructor.name} opened off-centre - something states an explicit left`);
            }
        } finally {
            try { await app?.close(); } catch { /* already gone */ }
            // And let the opener settle, so nothing is left pending behind the suite.
            try { await opening; } catch { /* closed rather than answered */ }
            await settle();
        }
    }],

    ["high contrast raises the ink and moves no size", async () => {
        /*
         * W-7, driven rather than read. Two promises: every type size is exactly
         * where it was, and the fine print is actually brighter. The second one is
         * measured as relative luminance, because "brighter" is the whole feature
         * and a token swap that made it darker would pass any test that only checked
         * the value changed.
         */
        needs(env.cascade(), "a colour and a size made of var() need a browser");
        const was = document.body.classList.contains("drpg-high-contrast");
        const probe = document.createElement("div");
        probe.className = "drpg-panel";
        probe.style.position = "fixed";
        probe.style.left = "-9999px";
        probe.innerHTML = `<p class="notes">fine print</p>
            <span class="drpg-tb-badge type neutral">badge</span>
            <button class="drpg-action-button"><span class="drpg-action-name">name</span></button>`;
        document.body.append(probe);

        /** Relative luminance of a computed colour, for "is this brighter". */
        const luminance = value => {
            const parts = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
            if (parts.length < 3) return null;
            const [r, g, b] = parts.map(n => {
                const c = n / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const dimNow = () => {
            const holder = document.createElement("span");
            holder.style.color = "var(--drpg-dim)";
            probe.append(holder);
            const value = getComputedStyle(holder).color;
            holder.remove();
            return luminance(value);
        };
        const sizes = () => [...probe.querySelectorAll("*")]
            .map(el => getComputedStyle(el).fontSize).join("|");

        try {
            document.body.classList.remove("drpg-high-contrast");
            await settle();
            const plainSizes = sizes();
            const plainDim = dimNow();

            document.body.classList.add("drpg-high-contrast");
            await settle();
            equal(sizes(), plainSizes, "high contrast moved a type size");
            const brightDim = dimNow();

            ok(plainDim !== null && brightDim !== null, "the dim ink could not be measured");
            ok(brightDim >= plainDim * 2,
                `the fine print is not twice as bright: ${plainDim?.toFixed(3)} -> ${brightDim?.toFixed(3)}`);

            /*
             * AND IT SURVIVES A THEME CHANGE. It is an accessibility switch, not one
             * of the glass effects, so `applyTheme` must put it back on rather than
             * treat it as the other theme's business.
             */
            const settings = await import("./settings.mjs");
            const wasSetting = getSetting(SETTINGS.highContrast);
            try {
                await game.settings.set(MODULE_ID, SETTINGS.highContrast, true);
                settings.applyTheme();
                await settle();
                ok(document.body.classList.contains("drpg-high-contrast"),
                    "a theme change took the high-contrast switch off");
            } finally {
                await game.settings.set(MODULE_ID, SETTINGS.highContrast, wasSetting ?? false);
                settings.applyTheme();
            }
        } finally {
            probe.remove();
            document.body.classList.toggle("drpg-high-contrast", was);
            await settle();
        }
    }],

    ["the clock's rewind is refused while an Eclipse is running", async () => {
        /*
         * HUD-02 driven, which this one can be: the refused path writes nothing, so
         * it cannot leave the sealed rooms, a pending assembly or the motive dirty.
         * "evening" is chosen so the Eclipse under test is the NIGHT one - the free
         * placement window whose allowance flips, which is the worst version of the
         * bug - and spreading the old clock keeps `timeOfDayStartedAt`, so this does
         * not re-stamp the elapsed readout.
         */
        const was = foundry.utils.deepClone(getClock());
        const refusal = game.i18n.localize("DRPG.Clock.rewindDuringEclipse");
        const seen = [];
        const warned = ui.notifications.warn.bind(ui.notifications);
        ui.notifications.warn = text => { seen.push(String(text)); return null; };

        try {
            const { rewindTimeOfDay } = await import("./clock.mjs");
            await setClock({ ...was, timeOfDay: "evening", eclipse: true });
            await settle();

            equal(await rewindTimeOfDay(), null, "the rewind went through during an Eclipse");
            ok(seen.includes(refusal), "the rewind was refused silently, or for some other reason");

            const now = getClock();
            equal(now.timeOfDay, "evening", "the rewind moved the time of day anyway");
            equal(now.eclipse, true, "the rewind ended the Eclipse instead of refusing");
            equal(now.session, was.session, "the rewind rolled the session back");
            equal(now.day ?? 1, was.day ?? 1, "the rewind rolled the day back");
        } finally {
            ui.notifications.warn = warned;
            await setClock(was);
            await settle();
        }
    }],

    ["the trial console counts a debate down while it stands open", async () => {
        /*
         * F8's first half, driven: a source test can see the tick exists and cannot
         * see it reach the DOM.
         */
        const floorMod = await import("./trial-floor.mjs");
        const ui2 = await import("./trial-floor-ui.mjs");
        const { closeOpen } = await import("./live.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({ seconds: 180 });
            await settle();

            // Not awaited: these openers resolve when the person closes the window.
            ui2.manageClassTrial().catch(() => {});
            const consoleApp = () => [...foundry.applications.instances.values()]
                .find(a => a.rendered && a.options?.classes?.includes("drpg-window-trial"));
            // POLLED, NOT WAITED FOR. A fixed delay here is a race this suite has
            // already lost once: two dynamic imports and a render stand between the
            // call above and an element, and on a loaded machine that is more than
            // 600 ms. `until` returns as soon as the window is there.
            await until(() => consoleApp()?.element, 6000);
            const app = consoleApp();
            ok(app?.element, "the trial console did not open");

            const secondsOf = () => Number(app.element.querySelector(".drpg-trial-console")
                ?.textContent.match(/(\d+)\s*s/)?.[1] ?? NaN);
            const first = secondsOf();
            ok(Number.isFinite(first) && first > 150,
                `the console is not showing the debate's clock (read ${first})`);
            ok(await until(() => secondsOf() < first, 4000),
                "the console's debate clock is the same after four seconds - it is a photograph");
        } finally {
            closeOpen("drpg-window-trial");
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await settle();
        }
    }],

    ["the trial console hears a ballot land", async () => {
        /*
         * F8's second half. With NO floor open the one-second tick returns early, so
         * any rebuild counted here is the hook's - which is what makes the
         * measurement honest. The real ballot cannot be driven headless
         * (`eligibleVoters` wants a second connected player), so this pins the wiring
         * and the live check proves the end to end.
         */
        const ui2 = await import("./trial-floor-ui.mjs");
        const { closeOpen, diagnoseLive } = await import("./live.mjs");
        const clock = foundry.utils.deepClone(getClock());

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await settle();
            /*
             * THE CONSOLE THE SCENARIO BEFORE THIS ONE OPENED HAS TO BE GONE FIRST,
             * and this is what the last three failures actually were.
             *
             * That scenario closes its console in a `finally`, but ApplicationV2's
             * close is asynchronous and waits on a transition; this one started while
             * it was still on screen, `alreadyOpen` refused to open a second copy, and
             * every reading below then measured the OUTGOING window - which never
             * rebuilds again. It reported a missing `watch.hooks` three times on
             * wiring a direct probe showed working: refreshes 0 -> 1 on the hook, one
             * listener registered, focus outside the region (20.09).
             */
            closeOpen("drpg-window-trial");
            await until(() => !document.querySelector(".drpg-window-trial"), 5000);
            ui2.manageClassTrial().catch(() => {});

            /*
             * THE YOUNGEST RECORD, NOT THE FIRST. `diagnoseLive` lists every live
             * region this client holds, and a console from the scenario before this
             * one can still be in that set while it closes - ApplicationV2's close
             * waits on a transition. `.find` then measured a window that is on its way
             * out and never rebuilds again, which reads exactly like a missing hook:
             * this failed twice in a row on an unchanged `watch.hooks`.
             */
            /*
             * AND A DEFERRED REBUILD COUNTS (F8, and the third time this test lied).
             *
             * `keepLive` defers a rebuild while focus is inside the region it is about
             * to replace - that is Rule 1, and it is what stops a window swapping a
             * field out from under somebody typing in it. A DialogV2 autofocuses, so
             * on some runs focus sits inside this console and every hook-driven
             * rebuild is deferred rather than performed: `refreshes` never moves,
             * `deferred` does, and the test reported a missing `watch.hooks` on wiring
             * that was working exactly as designed.
             *
             * What this scenario is about is whether the HOOK REACHES THE REGION, so
             * that is what is measured: a rebuild or a deferral, either one. The
             * scenario above it, which forces its refresh through `live.refresh()`,
             * is the one that proves a rebuild actually lands.
             */
            const wokenOf = () => {
                const row = diagnoseLive()
                    .filter(r => r.region === ".drpg-trial-console")
                    .sort((a, b) => a.openMs - b.openMs)[0];
                return row ? row.refreshes + row.deferred : -1;
            };
            const refreshesOf = wokenOf;
            // Polled for the same reason as the scenario above: the region does not
            // exist until the window has rendered, and 600 ms is not a promise.
            await until(() => refreshesOf() >= 0, 6000);
            const before = refreshesOf();
            ok(before >= 0, "the trial console is not a live region any more");

            /* Nobody is typing in it, which is the state this is about - and on a
               headless client the console's own autofocus is what would otherwise
               put focus inside the region. */
            document.activeElement?.blur?.();
            Hooks.callAll("drpgBallotsChanged");
            // POLLED, NOT WAITED FOR. `keepLive` debounces by 120 ms and the rebuild is
            // a DOM replacement; a fixed 400 ms passed eight runs and failed the ninth
            // on a loaded machine, which is a flake rather than a finding.
            ok(await until(() => refreshesOf() > before, 3000),
                "the trial console does not listen for a ballot - `watch.hooks` is missing or misspelled");

            // And the idle tick really is idle while no floor is open.
            const quiet = refreshesOf();
            await wait(1400);
            equal(refreshesOf(), quiet,
                "the console rebuilds itself every second with no floor open");
        } finally {
            closeOpen("drpg-window-trial");
            await setClock(clock);
            await settle();
        }
    }],

    ["+30 seconds on an overrun debate leaves thirty seconds on the clock", async () => {
        /*
         * F9. The overrun is written by hand rather than waited for: three minutes of
         * real time in a suite is three minutes nobody gets back.
         */
        const floorMod = await import("./trial-floor.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({ seconds: 60 });
            await settle();

            const floor = getSetting(SETTINGS.trialQueue);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue,
                { ...floor, startedAt: Date.now() - 180_000 });
            await settle();
            ok(floorMod.secondsLeft() < -100, "the fixture is not actually overrun");

            await floorMod.extendFloor(30);
            await settle();
            const left = floorMod.secondsLeft();
            ok(left > 25 && left <= 30,
                `+30 s left the debate at ${left} s - an overrun debate is still overrun`);

            // And the case that must not regress: a debate with time on it.
            await floorMod.returnToDebate({ seconds: 120 });
            await settle();
            const was = floorMod.secondsLeft();
            await floorMod.extendFloor(30);
            await settle();
            const now = floorMod.secondsLeft();
            ok(Math.abs((now - was) - 30) <= 3,
                `thirty more seconds on a running debate measured as ${now - was}`);
        } finally {
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await settle();
        }
    }],

    ["the murder window refuses at the door during an Eclipse", async () => {
        /*
         * F11. The measurement is that the promise SETTLES: a window that opened
         * would keep its DialogV2 pending and this would come back "hung".
         */
        const murder = await import("./murder.mjs");
        const eclipse = await import("./eclipse.mjs");
        const { closeOpen } = await import("./live.mjs");

        equal(murder.murderState(), null, "an incident was already running when this scenario started");
        try {
            await eclipse.startEclipse();
            await settle();
            ok(eclipse.isEclipse(), "the Eclipse did not start");

            const answer = await Promise.race([
                murder.openMurderDialog(),
                wait(800).then(() => "hung")
            ]);
            equal(answer, null,
                "the murder window opened during an Eclipse and sat there waiting for the GM");
        } finally {
            closeOpen("drpg-window-murder");
            try { await eclipse.endEclipse({ advance: false }); } catch { /* nothing to end */ }
            await settle();
        }
    }],

    ["the murder window opens with the finished trap of the killer it is showing already ticked", async () => {
        /*
         * F10. Through the PANEL's road - no killerId - because that is the one where
         * `armed.has(killerId)` asked about null and the box stayed unticked for a
         * killer whose trap was finished.
         */
        const murder = await import("./murder.mjs");
        const P = await import("./projects.mjs");
        const { closeOpen } = await import("./live.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const killer = livingStudents()[0];
        ok(killer, "no living student to arm a trap for");

        let made = null;
        try {
            // `createProject` answers with the whole row, and everything else in
            // projects.mjs takes the id.
            made = (await P.createProject({
                name: "SUITE F10 trap", target: 3, indirectMurder: true,
                killerId: killer.id, by: killer.id
            }))?.id ?? null;
            ok(made, "could not create the fixture trap");
            await P.addProgress(made, 3);
            await settle();
            ok(P.isComplete(P.allProjects().find(p => p.id === made)),
                "the fixture trap is not finished");

            murder.openMurderDialog().catch(() => {});
            /* POLLED, NOT A FLAT 700 ms (E01, 24.09.2026). The window gathers the cast
               and the traps before it draws, and on a slow world that took longer than
               the flat wait: the one failure of the audit's live run of this suite was
               this line, on a world whose run took nineteen minutes. */
            const murderApp = () => [...foundry.applications.instances.values()]
                .find(a => a.rendered && a.options?.classes?.includes("drpg-window-murder"));
            await until(() => murderApp()?.element, 6000);
            const app = murderApp();
            ok(app?.element, "the murder window did not open");

            const form = app.element.querySelector("form");
            equal(form.killer.value, killer.id, "the window is not proposing the killer this fixture armed");
            ok(form.indirect.checked,
                "the window opened with a finished trap and the box unticked - the GM has to "
                + "remember the trap themselves");
        } finally {
            closeOpen("drpg-window-murder");
            if (made) { try { await P.deleteProject(made); } catch { /* already gone */ } }
            await settle();
        }
    }],

    ["the slider moves the type under Monokuma Legacy and moves nothing under the glass", async () => {
        /*
         * W-2, measured rather than read - and this is the only test that would catch
         * an invalid `calc()`, which makes a declaration invalid at computed-value
         * time and silently falls back to the inherited size.
         *
         * RATIOS, NEVER ABSOLUTE PIXELS. Foundry's own Font Size setting moves every
         * rem, so "11px" is a fact about one client's settings rather than about this
         * module - except at the floor, which is stated in px on purpose.
         */
        // Every size here is a var() of the theme's; where var() does not resolve, each
        // one reads as NaN and every ratio below as a failure (E01, 24.09.2026).
        needs(env.cascade(), "sizes made of var() need a browser");
        const settings = await import("./settings.mjs");
        const was = { scale: getSetting(SETTINGS.uiScale), theme: getSetting(SETTINGS.theme) };

        const probe = document.createElement("span");
        probe.style.cssText = "position:fixed;left:-9999px;top:0;display:block";
        const box = document.createElement("div");
        box.style.cssText = "position:fixed;left:-9999px;top:0;display:block";
        document.body.append(probe, box);

        const read = async slider => {
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, slider);
            settings.applyTheme();
            await settle();
            const size = token => {
                probe.style.fontSize = `var(${token})`;
                return parseFloat(getComputedStyle(probe).fontSize);
            };
            box.style.width = "var(--drpg-popup)";
            return {
                nine: size("--font-size-9"),
                eleven: size("--font-size-11"),
                xs: size("--drpg-text-xs"),
                lg: size("--drpg-text-lg"),
                popup: parseFloat(getComputedStyle(box).width),
                type: parseFloat(getComputedStyle(document.body)
                    .getPropertyValue("--drpg-type-scale")) || 1
            };
        };

        try {
            for (const theme of ["monokumaLegacy", "stainedGlass"]) {
                await game.settings.set(MODULE_ID, SETTINGS.theme, theme);
                settings.applyTheme();
                await settle();

                const one = await read(1);
                const up = await read(1.4);
                const down = await read(0.8);
                const legacy = theme === "monokumaLegacy";

                for (const [key, factor] of [["lg", 1.4], ["popup", 1.4]]) {
                    const ratio = up[key] / one[key];
                    ok(Math.abs(ratio - (legacy ? factor : 1)) < 0.02,
                        `${theme}: ${key} at 140 % measured ${ratio.toFixed(3)}x`);
                }
                const downLg = down.lg / one.lg;
                ok(Math.abs(downLg - (legacy ? 0.8 : 1)) < 0.02,
                    `${theme}: the large rung at 80 % measured ${downLg.toFixed(3)}x`);

                if (legacy) {
                    // The floor, which is the one absolute number in this test.
                    ok(Math.abs(down.eleven - 10) < 0.1,
                        `the 11px rung fell to ${down.eleven}px at 80 % instead of stopping at 10`);
                    ok(Math.abs(down.xs - 10) < 0.1,
                        `the module's smallest rung fell to ${down.xs}px at 80 %`);
                    ok(Math.abs(down.nine - one.nine) < 0.1,
                        "the 9px rung moved at 80 % - its floor is its own size, so it must not");
                } else {
                    /*
                     * AND THE GLASS'S CHROME STILL COMES OFF THE GLASS'S OWN FACTOR.
                     *
                     * This first asserted that the ladder does not move at all under the
                     * glass, and it failed - correctly. That theme flattens rungs 8 to 17
                     * to `--drpg-sg-floor`, which is `21px * --drpg-sg-scale`, which is
                     * `--drpg-type-scale`: it has followed the slider since 07.09 and is
                     * none of W-2's business. So what is pinned here is WHICH factor it
                     * follows - the screen-term one, not the new one - which is the thing
                     * that would break if somebody "tidied" the three tokens into one.
                     */
                    const moved = up.eleven / one.eleven;
                    const own = up.type / one.type;
                    ok(Math.abs(own - 1) > 0.05,
                        "the glass's own type factor did not move, so this proves nothing");
                    ok(Math.abs(moved - own) < 0.02,
                        `the glass's chrome measured ${moved.toFixed(3)}x while its own factor `
                        + `moved ${own.toFixed(3)}x`);
                    ok(Math.abs(one.xs - down.xs) < 0.1,
                        "the module's own smallest rung moved under the glass, where the factor "
                        + "is pinned at 1");
                }
            }
        } finally {
            probe.remove();
            box.remove();
            await game.settings.set(MODULE_ID, SETTINGS.theme, was.theme);
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, was.scale ?? 1);
            settings.applyTheme();
            await settle();
        }
    }],

    ["a prose window's box follows the slider under Monokuma Legacy", async () => {
        /*
         * W-2b, and the reason this is not left to R63's source read: that read proves
         * the two tokens carry the factor, not that the RULE still bites. The width is
         * stated on `.application.dialog:is(.drpg-panel, ...)` with `!important`, and a
         * window that stops carrying one of those classes - or a `:not()` added to the
         * list - loses the box silently, at whatever width ApplicationV2 felt like.
         *
         * BUILT DIRECTLY, NOT THROUGH `DialogV2.wait`, whose promise settles only when
         * the window closes: awaiting it here is the deadlock W-9's scenario already
         * paid for. And `close()` is awaited because ApplicationV2 waits on a
         * transition that never fires on the frame itself, which is a second per
         * window and the reason this measures two settings rather than five.
         */
        // A width from the stylesheet's rule, which needs the cascade: with none, both
        // readings were NaN and the check below them let NaN through (E01, 24.09.2026).
        needs(env.cascade(), "the width rule is a var() that needs a browser");
        const settings = await import("./settings.mjs");
        const { closeOpen } = await import("./live.mjs");
        const was = { scale: getSetting(SETTINGS.uiScale), theme: getSetting(SETTINGS.theme) };

        const widthAt = async slider => {
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, slider);
            settings.applyTheme();
            await settle();
            const dialog = new foundry.applications.api.DialogV2({
                window: { title: "W-2 width probe" },
                // `drpg-panel` because that is the class the width rule reads, and a
                // second one of its own so the close below cannot sweep somebody else's
                // window: `closeOpen("drpg-panel")` would take the GM panel with it.
                classes: ["drpg-panel", "drpg-window-w2-probe"],
                content: "<p>W-2</p>",
                buttons: [{ action: "ok", label: "OK" }]
            });
            await dialog.render({ force: true });
            await settle();
            /*
             * THE USED WIDTH, NOT THE RECTANGLE ON SCREEN. `getBoundingClientRect`
             * reports the TRANSFORMED box, and this module opens a window from
             * `scale(0.96)`: the first of these two measurements caught the tail of
             * that animation and read 522.4 where the window is 544, which is a
             * 1.458x ratio and a failure about nothing. `getComputedStyle().width` is
             * the used value, which no transform touches.
             */
            const width = dialog.element
                ? parseFloat(getComputedStyle(dialog.element).width) : null;
            await dialog.close();
            return width;
        };

        try {
            await game.settings.set(MODULE_ID, SETTINGS.theme, "monokumaLegacy");
            settings.applyTheme();
            await settle();

            const one = await widthAt(1);
            const up = await widthAt(1.4);
            ok(Number.isFinite(one) && Number.isFinite(up), `the window could not be measured (${one}, ${up})`);
            // 92vw caps it, so this only means anything on a screen with room for it.
            if (one < innerWidth * 0.9) {
                const ratio = up / one;
                ok(Math.abs(ratio - 1.4) < 0.03,
                    `the box measured ${ratio.toFixed(3)}x at 140 % - the width rule no longer `
                    + `reaches this window, or the token lost the factor`);
            }
        } finally {
            closeOpen("drpg-window-w2-probe");
            await game.settings.set(MODULE_ID, SETTINGS.theme, was.theme);
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, was.scale ?? 1);
            settings.applyTheme();
            await settle();
        }
    }],

    ["a window still answers for one tick after it was answered", async () => {
        /*
         * LIVE-REOPEN-01's measurement, kept as a test because the whole finding rests
         * on it and it is a fact about Foundry rather than about this module: if a
         * future version closes before resolving, `reopen` becomes unnecessary and
         * this is where that shows up.
         *
         * Built with `DialogV2.wait` and answered by clicking the footer button, which
         * is the path a person takes - not `dialog.close()`, which resolves through the
         * other branch entirely.
         */
        const { alreadyOpen, reopen, closeOpen } = await import("./live.mjs");
        const DialogV2 = foundry.applications.api.DialogV2;
        const CLASS = "drpg-window-reopen-probe";

        const waiting = DialogV2.wait({
            window: { title: "reopen probe" },
            classes: ["drpg-panel", CLASS],
            content: "<p>probe</p>",
            buttons: [{ action: "ok", label: "OK" }],
            rejectClose: false
        });

        try {
            ok(await until(() => document.querySelector(`.${CLASS}`), 4000),
                "the probe window did not open");
            document.querySelector(`.${CLASS} button[data-action="ok"]`).click();
            const answer = await waiting;
            equal(answer, "ok", "the probe answered something else");

            // THE INSTANT THAT DECIDES IT.
            ok(alreadyOpen(CLASS),
                "the window had already gone by the next statement - `reopen` is no longer "
                + "needed and the notes on it are out of date");

            // And `reopen` gets a window anyway, which is the point of it.
            let opened = null;
            await reopen(CLASS, async () => {
                opened = alreadyOpen(CLASS) ? "refused" : "clear";
                return null;
            });
            equal(opened, "clear", "reopen ran the opener while the old copy was still there");
        } finally {
            closeOpen(CLASS);
            await settle();
        }
    }],

    ["a repair moves somebody to dead without announcing a death", async () => {
        /*
         * F16 and F15 driven. The dropdown half of the Players window is a repair
         * tool, and the two things a repair must not do are the two things it did:
         * post the death card to the table and say "X is no longer a Monocub" about
         * somebody who never was one.
         *
         * `applyAliveStates` is called directly - the window cannot be driven from
         * here, and the function is exported for exactly this.
         */
        const panel = await import("./gm-panel.mjs");
        const { isDeceased } = await import("./chapter.mjs");
        // A LIVING student (review of stage D): `studentActors()[0]` could be a dead one,
        // whom the scenario revived first - and a Monocub, whose revive the restore does not
        // undo. `cast()` is what every other fixture scenario stands on.
        const [victim] = cast(1);

        const said = [];
        const info = ui.notifications.info.bind(ui.notifications);
        ui.notifications.info = text => { said.push(String(text)); return null; };
        const before = game.messages.size;

        try {
            const changed = await panel.applyAliveStates({ [victim.id]: { state: "dead" } });
            await settle();

            equal(changed, 1, "the repair reported no change");
            ok(isDeceased(victim), "the repair did not mark the student dead");
            equal(game.messages.size, before,
                "the repair posted a card - a dropdown is not a death announcement");
            ok(!said.some(t => /Monocub/i.test(t)),
                `the repair talked about Monocubs: ${said.join(" | ")}`);

            // AND THE BULLETS STAY. This is the half the window's own header
            // promises: "moves the two flags and nothing else".
            const { bulletsOf } = await import("./truth-bullets.mjs");
            ok(Array.isArray(bulletsOf(victim)), "the bullets could not be read");
        } finally {
            ui.notifications.info = info;
            const { reviveCharacter } = await import("./chapter.mjs");
            if (isDeceased(victim)) await reviveCharacter(victim);
            await settle();
        }
    }],

    ["the table's held settings keep Isometric Perspective's welcome closed and its box out of sight", async () => {
        /*
         * E27, 24.09.2026; audit S16-03, project N2, D19. `showWelcome` is Isometric
         * Perspective's own CLIENT setting, so a GM who switched it off had switched
         * it off for one browser and every player met the window on every start.
         * enforced.mjs holds it: written at `setup`, the box taken out of Configure
         * Settings, a change by hand put back - and all of it let go when the GM turns
         * the world switch off. Driven here on this client through the same function
         * the `setup` hook and the switch call.
         */
        const { ENFORCED, applyEnforced } = await import("./enforced.mjs");
        const row = ENFORCED.find(r => r.id === "isoWelcome");
        ok(row, "the Isometric Perspective welcome is not in the table of held settings");
        const full = `${row.module}.${row.key}`;
        needs(world.moduleActive(row.module), "the setting it holds belongs to that module");
        needs(world.settingRegistered(full), "there is no setting to hold");
        const entry = game.settings.settings.get(full);

        const switchBefore = game.settings.get(MODULE_ID, SETTINGS.enforceIsoWelcome);
        const valueBefore = game.settings.get(row.module, row.key);
        try {
            await game.settings.set(MODULE_ID, SETTINGS.enforceIsoWelcome, true);
            await applyEnforced();
            await settle();
            equal(game.settings.get(row.module, row.key), row.value, "the welcome is not held closed");
            equal(entry.config, false, "the player's box for the welcome is still in Configure Settings");

            await game.settings.set(row.module, row.key, !row.value);
            ok(await until(() => game.settings.get(row.module, row.key) === row.value),
                "a change made by hand was not put back");

            await game.settings.set(MODULE_ID, SETTINGS.enforceIsoWelcome, false);
            await applyEnforced();
            await settle();
            ok(entry.config !== false, "switching the row off did not give the box back");
            await game.settings.set(row.module, row.key, !row.value);
            await settle();
            equal(game.settings.get(row.module, row.key), !row.value,
                "with the row switched off the value is still held");
            /* A BOX THAT CANNOT BE HIDDEN STILL HOLDS ITS VALUE (the review of E27). A
               registry entry whose `config` cannot be assigned threw, before the value
               was written, and the welcome came back on. Asked of this module's own
               probe setting, registered for the test, with `config` made read-only. */
            const probeKey = "suiteHeldProbe";
            game.settings.register(MODULE_ID, probeKey, { scope: "client", config: true, type: Boolean, default: true });
            const probeEntry = game.settings.settings.get(`${MODULE_ID}.${probeKey}`);
            Object.defineProperty(probeEntry, "config", { get: () => true, configurable: true });
            await game.settings.set(MODULE_ID, SETTINGS.enforceIsoWelcome, true);
            const heldProbe = await applyEnforced([{ id: "suiteProbe", module: MODULE_ID, key: probeKey,
                value: false, toggle: SETTINGS.enforceIsoWelcome }]);
            equal(heldProbe.join(), "suiteProbe", "a row whose box cannot be hidden was not held");
            equal(game.settings.get(MODULE_ID, probeKey), false, "a box that could not be hidden kept its value from being written");
        } finally {
            // The probe goes whatever happened above, so no later test meets it.
            game.settings.settings.delete(`${MODULE_ID}.suiteHeldProbe`);
            try { globalThis.localStorage?.removeItem(`${MODULE_ID}.suiteHeldProbe`); } catch { /* not stored here */ }
            await game.settings.set(row.module, row.key, valueBefore);
            await game.settings.set(MODULE_ID, SETTINGS.enforceIsoWelcome, switchBefore);
            await applyEnforced();
        }
    }],

    /*
     * MOVED FROM TIER 1 (E01, 24.09.2026; audit S14-01). Each of the five below writes
     * the world while it runs - four open and close the Class Trial with `startFloor`,
     * which resets every student's actions, zeroes the trial record, can charge Despair
     * for unfound Keys again and clears the body announcement - and tier 1 promised a
     * GM it could be run during play. Their own `finally` blocks put most of it back,
     * but "most" was the defect: nothing checked, and the trial queue was set to {}
     * even when a real trial was sitting. Here they run under the snapshot, and tier
     * 0/1 is now asserted not to change the world at all (see `worldFingerprint`).
     */
    ["a chapter's Key Remnant plan is filed, not dropped, when the chapter ends", async () => {
        /*
         * `keyPlan()` MANUFACTURES a plan for whatever chapter the clock says,
         * which is right - last murder's clues are not this murder's blanks -
         * and it is exactly why the words a GM wrote had nowhere to go. The
         * first fold only fired when a plan for a different chapter was saved
         * OVER the old one, which is not what ending a chapter does, so the
         * archive measured empty a chapter later. `archiveKeyPlan` was the
         * explicit fold the chapter-end screen called.
         *
         * A ROW PER CHAPTER SINCE E05 C5 (26.09.2026): the plan is a GM store, so a
         * chapter's rows are filed by being that chapter's, and `archiveKeyPlan`
         * answers whether they hold anything. Seeded through `setKeyPlan` in a world
         * the stores have never opened (`withGmStoreWorld`): the clock moves on, the
         * next chapter's plan is blank, and the ending chapter's words are still its
         * own when the clock comes back. The clock is put back.
         */
        const E = await import("./gm-store.mjs");
        const { archiveKeyPlan, setKeyPlan, keyPlan } = await import("./investigation.mjs");
        const clock = getClock();
        try {
            await E.withGmStoreWorld(`suite-keyfiled-${foundry.utils.randomID(8)}`, async () => {
                const chapter = clock.chapter;
                await setKeyPlan({ chapter, entries: [{ scale: "standard", name: "A muddy print",
                    text: "It points at the east stair.", note: "Sakura size 9.", tokenId: null, sceneId: null }] });
                await setClock({ ...clock, chapter: chapter + 1 });
                ok(!keyPlan().entries.some(e => e.name || e.text || e.note), "the next chapter's plan is not blank");
                ok(await archiveKeyPlan(chapter), "the ended chapter's plan does not answer that it holds anything");
                await setClock(clock);
                equal(keyPlan().entries[0]?.name, "A muddy print", "the chapter's row lost its name");
                equal(keyPlan().entries[0]?.text, "It points at the east stair.",
                    "the chapter's row lost the words the players read");

                // A plan with nothing written in it is not worth a shelf.
                await setKeyPlan({ chapter, entries: [{ scale: "standard", name: "", text: "", note: "", tokenId: null }] });
                ok(!await archiveKeyPlan(chapter), "an emptied plan answers that it holds something");
            });
        } finally {
            await setClock(clock);
        }
    }],

    ["the unfound-Key charge refuses once the clock has left the chapter", async () => {
        /*
         * THIS ONE BILLED A REAL WORLD BEFORE IT WORKED, which is why it is in
         * the suite. The first guard compared `keyPlan().chapter` with the
         * clock and could never fire - `keyPlan()` manufactures a plan for the
         * chapter the clock is on, so the two agree by construction. Run
         * against a world that had just closed a case it read "0 of 5 found",
         * concluded the whole bar was missed, and moved 12 Despair.
         *
         * The stored plan is the only thing that remembers which chapter was
         * actually planned, so that is what the guard reads - the GM store's
         * rows since E05 C5, seeded here through `setKeyPlan` in a world the
         * stores have never opened (`withGmStoreWorld`). The pools are
         * measured either side here, because "returned null" and "charged
         * nothing" are two different claims and it was the second one that
         * failed.
         *
         * AND `keysCharged` IS CLEARED FIRST, or this test asks nothing. The
         * function opens with `if (trialProgress().keysCharged) return null`,
         * and on any world where a trial has already billed for its Key
         * Remnants that stamp is standing - so the first version of this test
         * got its `null` from the stamp, passed against the guard that could
         * never fire, and would have let the whole defect back in. The stamp
         * is also what the assertions read afterwards: the guard returns
         * BEFORE `setTrialProgress`, so a charge that got past it leaves the
         * stamp behind even when the pools happen not to move.
         */
        const E = await import("./gm-store.mjs");
        const { chargeForUnfoundKeys, setKeyPlan } = await import("./investigation.mjs");
        const { monokumas, getDespair } = await import("./despair.mjs");
        const { trialProgress, setTrialProgress } = await import("./vote.mjs");
        const charged = trialProgress().keysCharged ?? false;
        const clock = getClock();
        const pools = () => monokumas().map(u => getDespair(u.id));
        const before = pools();
        try {
            await setTrialProgress({ keysCharged: false });
            await E.withGmStoreWorld(`suite-keycharge-${foundry.utils.randomID(8)}`, async () => {
                await setKeyPlan({ chapter: clock.chapter,
                    entries: [{ scale: "standard", name: "A muddy print", text: "",
                        note: "", tokenId: null, sceneId: null }] });
                await setClock({ ...clock, chapter: clock.chapter + 1 });

                equal(await chargeForUnfoundKeys(), null,
                    "the charge went through for a chapter nobody can investigate any more");
                ok(!trialProgress().keysCharged,
                    "the refused charge stamped the trial anyway, so the honest one can never be asked");
                equal(JSON.stringify(pools()), JSON.stringify(before),
                    "the refused charge moved Despair anyway");
            });
        } finally {
            await setClock(clock);
            await setTrialProgress({ keysCharged: charged });
            /* AND THE POOLS GO BACK, because the run where this test EARNS its
               keep is the run where the charge goes through - so the failing
               path is exactly the one that leaves 12 Despair in a real world.
               Proved by doing it: the sharpened version of this test billed the
               QA world on its first honest run. Written as values, since
               `adjustDespair` takes a delta and the delta is what went wrong. */
            const { setDespair } = await import("./despair.mjs");
            const users = monokumas();
            for (let i = 0; i < users.length; i++) {
                if (getDespair(users[i].id) !== before[i]) await setDespair(users[i].id, before[i]);
            }
        }
    }],

    ["closing the trial puts the room back into Daily Life", async () => {
        /*
         * The one route back, exercised rather than read. A trial that ends without
         * this leaves the campaign in `classTrial` - which since T-1 means every
         * action tile but Analyze, every room crossing, every Despair Call and
         * Confusion stay shut; it holds every HUD on "Class Trial"; and it cannot be
         * undone from anywhere except Edit Campaign by hand.
         *
         * The elapsed clock is restarted too, and that is not decoration: the Daily
         * Life that follows a trial is measured from the trial ending, not from the
         * afternoon that led up to the body.
         */
        const { startFloor, trialFloor } = await import("./trial-floor.mjs");
        const { closeTrial } = await import("./trial-floor-ui.mjs");
        const clock = foundry.utils.deepClone(getClock());
        try {
            await startFloor({});
            equal(getClock().phase, "classTrial",
                "opening the floor did not put the campaign into the trial");
            ok(trialFloor(), "the floor did not open");

            const started = getClock().timeOfDayStartedAt;
            ok(await closeTrial(), "closeTrial refused");
            equal(getClock().phase, "dailyLife",
                "the trial closed and left the campaign in the Class Trial");
            equal(trialFloor(), null, "the trial closed with the floor still open");
            ok(getClock().timeOfDayStartedAt !== started,
                "the elapsed clock did not restart, so the Daily Life after the trial is "
                + "measured from before the body was found");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
        }
    }],

    ["the End of chapter screen closes the trial", async () => {
        /*
         * THE WIRING, EXERCISED. `applyChapterEnd` is the screen without the screen -
         * see its own header for why it was split out - so this asks the question a GM
         * asks by pressing the button, rather than asking whether a word appears in a
         * file. The first attempt at this test did the latter and passed against a call
         * deliberately disabled.
         *
         * Only `endTrial` is ticked. The clock deliberately does not move: what is
         * under test is that the room empties, and a chapter that also advanced would
         * make the failure harder to read.
         */
        const { applyChapterEnd } = await import("./chapter.mjs");
        const { startFloor, trialFloor } = await import("./trial-floor.mjs");
        const clock = foundry.utils.deepClone(getClock());
        try {
            await startFloor({});
            equal(getClock().phase, "classTrial", "the fixture did not open a trial");

            await applyChapterEnd({ endTrial: true });

            equal(getClock().phase, "dailyLife",
                "the chapter ended and left the campaign in the Class Trial - every HUD "
                + "reads Class Trial into the next chapter and the panel says so too");
            equal(trialFloor(), null,
                "the chapter ended with the debate floor still open");

            /* AND IT DOES NOTHING WHEN THERE IS NOTHING TO DO. The box is disabled out
               of a trial, but a macro can pass anything, and "close the trial" out of
               Daily Life must not restart the elapsed clock on a time of day that is
               half spent. */
            const started = getClock().timeOfDayStartedAt;
            await applyChapterEnd({ endTrial: true });
            equal(getClock().timeOfDayStartedAt, started,
                "closing a trial that was not sitting restarted the time of day");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
        }
    }],

    ["a trial record remembers the chapter it was stamped with", async () => {
        /*
         * `trialProgress()` answers BLANK for a record from another chapter, and it is
         * right to: a fresh trial must not think its vote is already in. But the blank
         * is also what hid the state the panel could not name - a trial still sitting
         * for a chapter that has been ended - so `trialProgressChapter()` reads the
         * stamp itself. If it ever starts answering from the same blank, the backstop
         * line goes quiet and nothing says so.
         */
        const { trialProgress, trialProgressChapter, setTrialProgress } = await import("./vote.mjs");
        const stored = foundry.utils.deepClone(
            game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {});
        const clock = foundry.utils.deepClone(getClock());
        try {
            await setTrialProgress({ voteClosed: true, verdictApplied: true });
            const was = getClock().chapter;
            equal(trialProgressChapter(), was, "the stamp does not read back");

            await setClock({ chapter: was + 1 });
            equal(trialProgressChapter(), was,
                "the stamp followed the clock instead of staying with its own trial");
            equal(trialProgress().verdictApplied, false,
                "the new chapter inherited the last trial's verdict");
            equal(trialProgress().keysCharged, false,
                "a fresh chapter's record is missing `keysCharged`, so the same record "
                + "has two shapes depending on whether its trial has been charged");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialProgress, stored);
        }
    }],

    ["a legacy trace loses its answer key when migrated, and the migration keeps the GM's corrections and promotions", async () => {
        /*
         * E30, 24.09.2026; audit S17-01 and S05-43. A trace from before the ledger kept
         * its answer key in flags on its token. `migrateRemnants` moved the key into the
         * ledger and stripped the token with `-=` keys, which remove nothing in this
         * Foundry (the module's own notes; LIVE-E30-01 confirms it on v14) - while its
         * summary said "stripped" - and a second run, finding the flags still there,
         * wrote them over the ledger row and the GM's corrections with it. The strip is
         * read back now, and a live row is only filled in, never overwritten. Fixture
         * tokens, through `migrateRemnantToken`: the suite never runs the loop, which
         * would migrate a real table's traces.
         *
         * AND WHAT THE GM TICKED STAYS TICKED (E30 fix, 25.09.2026; audit S06-02).
         * `promoteFaintPrep` (chapter.mjs) wrote the GM's choice at a body discovery
         * onto the token - `faint: false`, `tiedToCrime: true` - where nothing read it,
         * and those are the only answer-key flags a trace placed since the ledger can
         * carry. The first E30 build stripped them and wrote nothing. Now a promoted
         * trace with a live row gets the promotion in its row; one with no row on this
         * browser keeps its flags and is reported; a row that does not read back
         * strips nothing; and whatever else is on a token afterwards - a key but the
         * two it may keep, a name that is not the neutral one - comes back in `left`.
         *
         * THE FIXTURES ARE TRACES FROM BEFORE THE LEDGER (E04, 1.2.63): tokens made with
         * their answer key in flags and no row. A placed trace whose row was then dropped
         * stood in for one until E04; a dropped row is a tombstone now, under which the
         * migration's weak write lands nowhere, so it stands in for nothing. The promoted
         * trace's row is written at the store's weak stamp, as a row claimed with no
         * stamp holds it - a promotion is carried only over a value from before the
         * upgrade (the design's H6); over one written since, it is the next test's.
         */
        const remnants = await import("./remnants.mjs");
        const { remnantStore } = await import("./gm-stores.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture traces are placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const oldName = "SUITE Subtle Prep Remnant";
        const legacy = { remnantType: "prep", visibility: "subtle", note: "SUITE old note", sourceName: "SUITE Someone" };
        // What promoteFaintPrep wrote onto a ticked trace until E04 (chapter.mjs).
        const promotion = { faint: false, tiedToCrime: true };
        const placed = [];
        // A trace from before the ledger: the answer key in its flags, the label as its name, no row.
        if (!game.actors.getName("Remnant")) {
            const first = await remnants.placeRemnant({ type: "prep", visibility: "subtle", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - makes the Remnant actor" });
            if (first) placed.push(first);
        }
        const oldTrace = async (flags, name = oldName) => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{
                name, actorId: game.actors.getName("Remnant")?.id ?? null, actorLink: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: true,
                flags: { [MODULE_ID]: { isRemnant: true, ...flags } }
            }]);
            ok(t, "could not make a fixture trace from before the ledger");
            placed.push(t);
            return t;
        };
        const flagKeys = t => JSON.stringify(Object.keys(t?._source?.flags?.[MODULE_ID] ?? {}).sort());
        const row = t => foundry.utils.deepClone(remnantStore.get(remnants.keyOf(t)));
        const writeFlags = (t, flags) => t.update(Object.fromEntries(
            Object.entries(flags).map(([key, value]) => [`flags.${MODULE_ID}.${key}`, value])));
        const sorted = list => JSON.stringify([...(list ?? [])].sort());
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set");
        const realSet = settings.set;
        const putSetBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            const token = await oldTrace(legacy);
            equal(remnants.remnantData(token), null, "the fixture has a live ledger row, so it is not a trace from before the ledger");

            const first = await remnants.migrateRemnantToken(token);
            equal(flagKeys(token), JSON.stringify(["isRemnant"]), "the migrated token still carries its answer key");
            equal(first?.ledger, "moved", "the first run did not move the trace into the ledger");
            equal(remnants.remnantData(token)?.note, legacy.note, "the token's note did not reach the ledger");
            equal(row(token)?.label, oldName, "the token's old name did not reach the ledger as its label");
            equal(remnantStore.stampOf(remnants.keyOf(token), "note"), remnantStore.weak(), "a moved row was not written weak");

            // A GM corrects the trace. Then a first run whose strip did not land (S05-43):
            // the flags are back on the token, one more among them, and the name stays neutral.
            await remnants.setRemnantSecret(token, { note: "SUITE GM correction" });
            await writeFlags(token, { ...legacy, subject: "SUITE subject" });
            const second = await remnants.migrateRemnantToken(token);
            equal(remnants.remnantData(token)?.note, "SUITE GM correction", "a second run wrote the token's stale note over the GM's correction");
            equal(row(token)?.label, oldName, "a second run wrote the token's neutral name over the label");
            equal(second?.ledger, "filled", "a second run over a live row did more, or less, than fill in what the row lacked");
            equal(remnants.remnantData(token)?.subject, "SUITE subject", "the field the row lacked was not filled in");
            equal(flagKeys(token), JSON.stringify(["isRemnant"]), "the second run left the answer key on the token");

            // What else is on a token is read back and reported, not deleted unread: a key
            // the migration does not know, and a name that is not the neutral one.
            await writeFlags(token, { suiteStray: "SUITE stray" });
            await token.update({ name: "SUITE label again" });
            const third = await remnants.migrateRemnantToken(token);
            equal(third?.ledger, "already", "a token with no answer-key flag was not counted as already done");
            equal(sorted(third?.left), sorted(["name", "suiteStray"]), "what else is on the token did not come back in `left`");
            ok(flagKeys(token).includes("suiteStray"), "the migration deleted a key it does not know instead of reporting it");

            // A Faint Prep promotion, over a row from before the upgrade: carried, then stripped.
            const promoted = await oldTrace(promotion, game.i18n.localize("DRPG.Remnant.tokenName"));
            const weak = remnantStore.weak();
            await remnantStore.patch(remnants.keyOf(promoted), { type: "prep", visibility: "subtle", faint: true, tiedToCrime: false,
                note: "test fixture - a promoted trace" }, { weak: true });
            const carried = await remnants.migrateRemnantToken(promoted);
            equal(JSON.stringify(carried?.carried ?? null), JSON.stringify({ faint: [true, false], tiedToCrime: [false, true] }),
                "the promotion carried into the row is not the one the token held");
            equal(remnants.remnantData(promoted)?.faint, false, "the promotion's faint: false did not reach the row");
            equal(remnants.remnantData(promoted)?.tiedToCrime, true, "the promotion's tiedToCrime: true did not reach the row");
            equal(remnantStore.stampOf(remnants.keyOf(promoted), "faint"), (weak + Math.floor(weak) + 1) / 2,
                "the promotion was not carried halfway from the old value's stamp to the next whole one");
            equal(carried?.ledger, "filled", "the promoted trace's row was not written");
            equal(flagKeys(promoted), JSON.stringify(["isRemnant"]), "the promoted token still carries the flags");

            // The same promotion with no row on this browser: nothing stripped, reported.
            const orphan = await oldTrace(promotion, game.i18n.localize("DRPG.Remnant.tokenName"));
            const alone = await remnants.migrateRemnantToken(orphan);
            equal(flagKeys(orphan), sorted(["faint", "isRemnant", "tiedToCrime"]), "a promotion with no row to carry it into was stripped");
            equal(alone?.ledger, "noRow", "a trace with flags, no type and no row was not reported as such");
            equal(sorted(alone?.left), sorted(["faint", "tiedToCrime"]), "the flags left on the trace were not reported");
            equal(remnants.remnantData(orphan), null, "a row was made up for a trace this browser has no record of");

            // A row write that does not reach storage strips nothing: the store's save is
            // swallowed here, so the row stands in memory and not on disk, as after a
            // failed save - the read-back is of storage.
            const unlucky = await oldTrace(legacy);
            settings.set = async function (namespace, key, value) {
                if (namespace === MODULE_ID && key === remnantStore.spec.key) return value;
                return realSet.call(this, namespace, key, value);
            };
            let refused = null;
            try {
                refused = await remnants.migrateRemnantToken(unlucky);
            } finally {
                putSetBack();
            }
            ok(remnantStore.has(remnants.keyOf(unlucky)), "the swallowed save left no row in memory either - this measured nothing");
            ok(flagKeys(unlucky).includes("remnantType"), "the answer key left the token although its row was never saved");
            equal(refused?.stripped, false, "a token whose row was never saved was counted as stripped");
            ok((refused?.unwritten ?? []).includes("type"), "the row that did not read back was not reported");
        } finally {
            putSetBack();
            for (const t of placed) {
                try { await remnants.dropRemnantSecret(t); } catch { /* nothing filed */ }
                try { await t.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["migrateRemnants cannot beat a correction made on another GM", async () => {
        /*
         * E04, 26.09.2026; the design's H6, the E30 review's m3. A promotion on a token
         * from before the upgrade meets the trace's row. Until E04 the carry was written
         * as the newest row, whole, and won on every GM - a GM who had set the trace
         * back to Faint since, on any browser, lost that. The row's fields are stamped
         * one by one now: a field from before the upgrade takes the promotion halfway to
         * the next whole stamp, and a field another GM wrote since stands - and the
         * promotion it stood against stays on the token, its only record (the review's
         * DS-M2: it was stripped). Here the row is a row from before the upgrade (every
         * field weak); another GM's correction of `faint` arrives as a sync does; then
         * the token's promotion is migrated.
         */
        const remnants = await import("./remnants.mjs");
        const { remnantStore } = await import("./gm-stores.mjs");
        const E = await import("./gm-store.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const placed = [];
        try {
            if (!game.actors.getName("Remnant")) {
                const first = await remnants.placeRemnant({ type: "prep", visibility: "subtle", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                    note: "test fixture - makes the Remnant actor" });
                if (first) placed.push(first);
            }
            const [token] = await scene.createEmbeddedDocuments("Token", [{
                name: game.i18n.localize("DRPG.Remnant.tokenName"), actorId: game.actors.getName("Remnant")?.id ?? null, actorLink: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: true, flags: { [MODULE_ID]: { isRemnant: true } }
            }]);
            ok(token, "could not make the fixture trace");
            placed.push(token);
            const key = remnants.keyOf(token);
            await remnantStore.patch(key, { type: "prep", visibility: "subtle", faint: true, tiedToCrime: false,
                note: "test fixture - a promotion and a later correction" }, { weak: true });
            const weak = remnantStore.weak();
            const theirs = E.emptySection();
            E.writeFields(theirs, key, { faint: true }, E.gmStoreStamp(), remnantStore.spec);
            await remnantStore.mergeIn(theirs, { source: "sync" });
            const corrected = remnantStore.stampOf(key, "faint");
            ok(corrected > weak, "the other GM's correction did not arrive above the old value");
            await token.update({ [`flags.${MODULE_ID}.faint`]: false, [`flags.${MODULE_ID}.tiedToCrime`]: true });

            const done = await remnants.migrateRemnantToken(token);
            equal(remnants.remnantData(token)?.faint, true, "the promotion beat the correction another GM made since the upgrade");
            equal(remnantStore.stampOf(key, "faint"), corrected, "the corrected field was written again");
            equal(JSON.stringify(done?.notCarried ?? null), JSON.stringify({ faint: [true, false] }), "the promotion not carried is not reported");
            equal(JSON.stringify(done?.carried ?? null), JSON.stringify({ tiedToCrime: [false, true] }),
                "the half of the promotion over a value from before the upgrade was not carried");
            equal(remnants.remnantData(token)?.tiedToCrime, true, "the tie was not carried into the row");
            equal(remnantStore.stampOf(key, "tiedToCrime"), (weak + Math.floor(weak) + 1) / 2,
                "the tie was not carried halfway from the old value's stamp to the next whole one");
            // The half not carried stays on the token, its only record; the half carried is taken off (DS-M2).
            equal(JSON.stringify(Object.keys(token._source?.flags?.[MODULE_ID] ?? {}).sort()), JSON.stringify(["faint", "isRemnant"]),
                "the promotion not carried was taken off the token, or the half carried was left on it");
        } finally {
            for (const t of placed) {
                try { await remnants.dropRemnantSecret(t); } catch { /* nothing filed */ }
                try { await t.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["a promotion over a row another GM's browser claimed is carried whichever GM runs the migration", async () => {
        /*
         * E04's fix round, 26.09.2026; the review's DS-M2. "Before the upgrade" was this
         * browser's own claim - the newest stamp its old key held - so on a browser whose
         * old key never held the row (an assistant's, a second computer's) every row read
         * as written since: the promotion was "not carried", stripped from the token all
         * the same, and the GM told a later correction stood. And a token with no row here,
         * whose row another GM holds, was moved in weak, and that GM's older row took the
         * promotion back at the next exchange. One mark for the world now (gm-stores.mjs
         * `upgradeMark`). Here a row claimed on another GM's browser - stamped before the
         * mark, and this browser's claim knowing nothing of it - arrives as a sync does,
         * and the token's promotion is carried into it; and a trace from before the ledger,
         * moved in while no row is here, keeps its promotion when that row arrives after.
         */
        const remnants = await import("./remnants.mjs");
        const S = await import("./gm-stores.mjs");
        const E = await import("./gm-store.mjs");
        const { remnantStore } = S;
        needs(world.atLeast("sceneOnScreen"), "the fixture traces are placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const mark = S.upgradeMark();
        ok(mark !== null, "this world has no upgrade mark: the stores never wrote one");
        const placed = [];
        const trace = async (flags, name = game.i18n.localize("DRPG.Remnant.tokenName")) => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{
                name, actorId: game.actors.getName("Remnant")?.id ?? null, actorLink: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: true, flags: { [MODULE_ID]: { isRemnant: true, ...flags } }
            }]);
            ok(t, "could not make a fixture trace");
            placed.push(t);
            return t;
        };
        const theirs = (key, fields) => {
            const section = E.emptySection();
            E.writeFields(section, key, fields, mark - 1000, remnantStore.spec);
            return remnantStore.mergeIn(section, { source: "sync" });
        };
        try {
            if (!game.actors.getName("Remnant")) {
                const first = await remnants.placeRemnant({ type: "prep", visibility: "subtle", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                    note: "test fixture - makes the Remnant actor" });
                if (first) placed.push(first);
            }
            const promoted = await trace({ faint: false, tiedToCrime: true });
            await theirs(remnants.keyOf(promoted), { type: "prep", visibility: "subtle", faint: true, tiedToCrime: false,
                note: "test fixture - a row claimed on another GM's browser" });
            const done = await remnants.migrateRemnantToken(promoted);
            equal(JSON.stringify([done?.carried ?? null, done?.notCarried ?? null]),
                JSON.stringify([{ faint: [true, false], tiedToCrime: [false, true] }, null]),
                "a promotion over a row from before the upgrade was not carried, on a browser whose old key never held it");
            equal(JSON.stringify([remnants.remnantData(promoted)?.faint, remnants.remnantData(promoted)?.tiedToCrime]), JSON.stringify([false, true]),
                "the promotion did not reach the row");
            equal(JSON.stringify(Object.keys(promoted._source?.flags?.[MODULE_ID] ?? {}).sort()), JSON.stringify(["isRemnant"]),
                "the carried promotion was left on the token");

            const moved = await trace({ remnantType: "prep", visibility: "subtle", note: "SUITE moved note", faint: false, tiedToCrime: true },
                "SUITE Subtle Prep Remnant");
            equal((await remnants.migrateRemnantToken(moved))?.ledger, "moved", "the trace from before the ledger was not moved in");
            await theirs(remnants.keyOf(moved), { type: "prep", visibility: "subtle", faint: true, tiedToCrime: false, note: "SUITE their note" });
            equal(JSON.stringify([remnants.remnantData(moved)?.faint, remnants.remnantData(moved)?.tiedToCrime]), JSON.stringify([false, true]),
                "another GM's row from before the upgrade took back the promotion a trace was moved in with");
            equal(remnants.remnantData(moved)?.note, "SUITE their note", "the moved-in fields beat a value another GM decided (they are weak)");
        } finally {
            for (const t of placed) {
                try { await remnants.dropRemnantSecret(t); } catch { /* nothing filed */ }
                try { await t.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the claim merges the old rows in, and an old stamp ahead of it is taken at its time", async () => {
        /*
         * E04's fix round, 26.09.2026; the review's DS-m1 and DS-m3. The claim wrote the old
         * rows straight into the section: a newer value that had arrived from another GM
         * before it was replaced by the old one (measured: "key" became "prep"). And an old
         * row stamped by a clock that ran ahead kept that stamp, beating every edit made
         * since until real time passed it. Both into a world this browser has never opened,
         * the old key a fixture (`withGmStoreLegacy`): no real old key is written.
         */
        const E = await import("./gm-store.mjs");
        const { bulletStore } = await import("./gm-stores.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const [student] = cast(1);
        const at = id => `Actor.${student.id}.Item.${id}`;
        const old = Date.now() - 60 * 60 * 1000, ahead = Date.now() + 2 * 60 * 60 * 1000;
        const legacy = { [SETTINGS.legacyTruthBulletSecrets]: {
            [at("SUITEE04DSM1")]: { realType: "prep", updated: old },
            [at("SUITEE04DSM3")]: { realType: "final", updated: ahead }
        } };
        const raw = () => game.settings.storage.get("client").getItem(`${MODULE_ID}.${SETTINGS.legacyTruthBulletSecrets}`);
        const before = raw();
        await E.withGmStoreLegacy(legacy, () => E.withGmStoreWorld(`suite-claimmerge-${foundry.utils.randomID(8)}`, async () => {
            const newer = E.emptySection();
            E.writeFields(newer, at("SUITEE04DSM1"), { realType: "key" }, E.gmStoreStamp(), bulletStore.spec);
            await bulletStore.mergeIn(newer, { source: "sync" });
            const census = await bulletStore.claim();
            equal(bullets.secretOf(at("SUITEE04DSM1")).realType, "key", "the claim wrote an old row over a newer value that had arrived first");
            const stamp = bulletStore.stampOf(at("SUITEE04DSM3"), "realType");
            ok(stamp > 0 && stamp <= E.gmStoreNow(), `an old row stamped ahead of the claim kept its stamp: ${stamp} against ${Math.floor(E.gmStoreNow())}`);
            equal(census?.clamped, 1, "the old row stamped ahead of the claim was not counted");
        }));
        equal(raw(), before, "the claim wrote the real old key");
    }],

    ["a replaced flag keeps nothing of the old value, and an unset flag is gone", async () => {
        /*
         * E30, 24.09.2026; audit S14-28. `replaceFlag` (utils.mjs) writes a flag as a
         * replacement - the roll bookmark leans on it, or a stale `gmRuled` diverts
         * every later Reroll - and takes v14's ForcedReplacement where there is one;
         * `unsetFlag` is how ten places in the module delete a flag. The headless
         * harness modelled neither until E30. Both go through the module's own
         * helpers here, on a student, and the actor's source is read afterwards: at a
         * table this reads v14's operators.
         */
        const [actor] = cast(1);
        const { replaceFlag } = await import("./utils.mjs");
        const key = "suiteOperatorProbe";
        const stored = () => foundry.utils.deepClone(actor._source?.flags?.[MODULE_ID] ?? {});
        try {
            await actor.setFlag(MODULE_ID, key, { a: 1, stale: true });
            equal(stableJson(stored()[key]), stableJson({ a: 1, stale: true }), "the fixture flag was not written");
            await replaceFlag(actor, key, { a: 2 });
            equal(stableJson(stored()[key]), stableJson({ a: 2 }), "replaceFlag kept something of the old value");
            await actor.unsetFlag(MODULE_ID, key);
            ok(!(key in stored()), `unsetFlag left the key in the actor's source: ${stableJson(stored()[key])}`);
        } finally {
            if (key in stored()) await actor.unsetFlag(MODULE_ID, key);
        }
    }],

    ["a younger partial Truth Bullet entry never erases an older full one", async () => {
        /*
         * E04, 26.09.2026; audit S05-01, measured the other way round first. A bullet
         * is made the ordinary way, so its row holds the whole answer key; then a row
         * that holds only `faint`, a second newer - what a GM who lacked the row used
         * to send when it joined - arrives through the old export's import, which
         * merges exactly as the GM-to-GM exchange does. Every field of the answer key
         * must survive, and the one field the newer row names must take. On 1.2.62's
         * whole-entry merge realType, remnantId and the reading were gone.
         */
        const bullets = await import("./truth-bullets.mjs");
        const [holder] = cast(1);
        const READING = `The cut matches the blade ${Date.now() % 100000}`;
        let item = null;
        try {
            item = await bullets.createTruthBullet(holder, {
                name: "Suite fixture: a full answer key", realType: "key", visibility: "evident",
                playerText: "A thin cut.", analyzedText: READING, remnantId: "SUITEE04FULLROW", sceneId: canvas?.scene?.id ?? null
            });
            ok(item, "no bullet was made to hold the full row");
            const uuid = item.uuid;
            const full = bullets.secretOf(uuid);
            equal(stableJson([full.realType, full.remnantId, full.analyzedText]), stableJson(["key", "SUITEE04FULLROW", READING]),
                "the fixture bullet's row does not hold the answer key it was made with");
            // The old export's import is `restoreCase` since C3; asked not to re-run the health check, which is not what this measures.
            const imported = await bullets.importLedger({ [uuid]: { faint: true, updated: Date.now() + 1000 } }, { recheck: false });
            ok(imported && !imported.refused, `the import refused a well-formed row: ${stableJson(imported)}`);
            const after = bullets.secretOf(uuid);
            equal(stableJson({ realType: after.realType, remnantId: after.remnantId, analyzedText: after.analyzedText, faint: after.faint }),
                stableJson({ realType: "key", remnantId: "SUITEE04FULLROW", analyzedText: READING, faint: true }),
                "a younger row naming only faint erased the answer key, or its own field did not take");
        } finally {
            if (item) {
                await bullets.dropSecret(item.uuid);
                await item.actor?.items?.get(item.id)?.delete();
            }
        }
    }],

    ["the old stores are claimed per world, and nothing is lost", async () => {
        /*
         * E04, 26.09.2026; the design's H5. Each GM store claims, once per world on a
         * browser, the rows of its old key that belong to that world, and never writes
         * the old key. Stood in a world this browser has never opened (the stores'
         * suite override, gm-store.mjs `withWorld`), with each store's old key read from
         * a fixture (`withLegacy`) of this world's rows, another world's, a tombstone and
         * a row with no stamp: the census must count every old row as claimed or left,
         * what was claimed must read back through the store's own reader, and the real
         * old key must be byte for byte what it was. A store with an old key and no
         * fixture here fails: a store added without one would be claimed by nothing that
         * was ever checked. No real old key is written (E04's fix round, the review's
         * DS-m5: they were seeded here and put back by tier 2's restore, and a tab closed
         * in between lost another world's unclaimed rows).
         */
        const E = await import("./gm-store.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const remnants = await import("./remnants.mjs");
        const [student] = cast(1);
        const here = `Actor.${student.id}.Item`;
        const T = Date.now() - 60 * 60 * 1000;
        needs(world.atLeast("sceneOnScreen"), "the traces' old rows are claimed by a scene of this world");
        const sceneId = (game.scenes.active ?? canvas?.scene)?.id;
        // A trace's token as remnantData reads one: its flag, its scene, its id.
        const trace = id => ({ id, parent: { id: sceneId }, hidden: true, getFlag: (scope, flag) => (flag === "isRemnant" ? true : undefined) });
        const mastermind = await import("./mastermind.mjs");
        const { incidentCast } = await import("./settings.mjs");
        const [, other, third] = cast(3);
        const clock = getClock() ?? {};
        const offer = { thirdId: third.id, killerId: student.id, chapter: clock.chapter, day: clock.day };
        const traps = await import("./traps.mjs");
        const { TIMING } = await import("./config.mjs");
        /* A project this world has, so the traps' rows can be claimed (C7): named to the claim
           (`withLivingProjects`), never written into the world's project metadata (E04's fix
           round, the round-2 reviews' R2-m6: world data, put back only by tier 2's restore). */
        const liveProject = run => S.withLivingProjects(["SUITEE04PROJECT1"], run);
        const recent = Date.now() - 60 * 1000;
        const levelUp = await import("./level-up.mjs");
        const fog = await import("./fog.mjs");
        const { isMonokuma } = await import("./monokuma.mjs");
        const S = await import("./gm-stores.mjs");
        // A Monokuma's row is left behind (S01-31) - counted only where the world has one.
        const mono = game.actors.find(a => isMonokuma(a)) ?? null;
        const FIXTURES = {
            discovery: {
                legacy: SETTINGS.legacyDiscoveryLedger,
                seed: {
                    [sceneId]: { [student.id]: ["SUITE room A", "SUITE room B"], ...(mono ? { [mono.id]: ["SUITE room A"] } : {}) },
                    SUITEE04NOSCENE: { [student.id]: ["SUITE room C"] }
                },
                census: { legacy: mono ? 3 : 2, claimed: 1, left: mono ? 2 : 1, tombstones: 0, reasons: { ...(mono ? { monokuma: 1 } : {}), otherWorld: 1 } },
                readBack: store => {
                    equal(stableJson(fog.discoveredFor(sceneId, student.id)), stableJson(["SUITE room A", "SUITE room B"]),
                        "the claimed rows do not read back through discoveredFor");
                    equal(store.stampOf(`${sceneId}/${student.id}`), store.weak(), "the rows were not claimed weak");
                    ok(!mono || !fog.discoveredFor(sceneId, mono.id).length, "a Monokuma's walks were claimed");
                }
            },
            // Claimed on the primary's browser only (the design's row 17): the suite runs on the primary.
            offers: {
                legacy: SETTINGS.legacyAdvanceOffers,
                seed: {
                    [student.id]: { kind: "standard", at: T },
                    [other.id]: { kind: "standard" },
                    [third.id]: { kind: "SUITEE04NOKIND", at: T },
                    SUITEE04NOACTOR0: { kind: "standard", at: T }
                },
                census: { legacy: 4, claimed: 1, left: 3, tombstones: 0, reasons: { notAnOffer: 1, otherWorld: 1, ownerCache: 1 } },
                readBack: store => {
                    equal(levelUp.pendingAdvance(student)?.kind, "standard", "the claimed offer does not read back through pendingAdvance");
                    equal(store.stampOf(student.id), T, "the offer was not claimed at its own time");
                    ok(!store.has(other.id), "an owner's cached copy (no time) was claimed as an offer");
                }
            },
            trapLedger: {
                legacy: SETTINGS.legacyTrapLedger,
                around: liveProject,
                seed: { SUITEE04ITEM0001: "SUITEE04PROJECT1", SUITEE04ITEM0002: "SUITEE04DEADPRJ0", SUITEE04ITEM0003: 7 },
                census: { legacy: 3, claimed: 1, left: 2, tombstones: 0, reasons: { deadProject: 1, notARow: 1 } },
                readBack: store => {
                    equal(traps.trapForItemId("SUITEE04ITEM0001"), "SUITEE04PROJECT1", "the claimed trap row does not read back through trapForItemId");
                    equal(store.stampOf("SUITEE04ITEM0001"), store.weak(), "the trap row was not claimed weak");
                    ok(!store.has("SUITEE04ITEM0002") && !store.has("SUITEE04ITEM0003"), "a dead project's row, or a row that is none, was claimed");
                }
            },
            trapPlants: {
                legacy: SETTINGS.legacyTrapPlants,
                around: liveProject,
                seed: {
                    [`${sceneId}::SUITE room`]: { projectId: "SUITEE04PROJECT1", drpgItemId: "SUITEE04ITEM0001", name: "SUITE planted kit" },
                    ["-::SUITE hall"]: { projectId: "SUITEE04PROJECT1", drpgItemId: "SUITEE04ITEM0004", name: "SUITE kit with no scene" },
                    ["SUITEE04NOSCENE::SUITE room"]: { projectId: "SUITEE04PROJECT1", drpgItemId: "SUITEE04ITEM0005" },
                    [`${sceneId}::SUITE cellar`]: { projectId: "SUITEE04DEADPRJ0", drpgItemId: "SUITEE04ITEM0006" }
                },
                census: { legacy: 4, claimed: 2, left: 2, tombstones: 0, reasons: { deadProject: 1, otherWorld: 1 } },
                readBack: store => {
                    equal(stableJson([store.get(`${sceneId}::SUITE room`)?.drpgItemId, store.get("-::SUITE hall")?.name]),
                        stableJson(["SUITEE04ITEM0001", "SUITE kit with no scene"]), "a claimed plant does not read back");
                    equal(store.stampOf(`${sceneId}::SUITE room`), store.weak(), "the plant was not claimed weak");
                    ok(!store.has("SUITEE04NOSCENE::SUITE room") && !store.has(`${sceneId}::SUITE cellar`), "another world's plant, or a dead project's, was claimed");
                }
            },
            observe: {
                legacy: SETTINGS.legacyObservePending,
                seed: {
                    SUITEE04OBSERVE1: { at: recent, actorId: student.id, sceneId, room: "SUITE room", declaration: "general" },
                    SUITEE04OBSERVE2: { at: recent - TIMING.pendingObserveTtlMs - 1000, actorId: student.id, sceneId, room: "SUITE room" },
                    SUITEE04OBSERVE3: { at: recent, actorId: "SUITEE04NOACTOR0", sceneId: "SUITEE04NOSCENE", room: "SUITE room" },
                    SUITEE04OBSERVE4: "not a declaration"
                },
                census: { legacy: 4, claimed: 1, left: 3, tombstones: 0, reasons: { expired: 1, notARow: 1, otherWorld: 1 } },
                readBack: store => {
                    // The store and not observe.mjs's cache: the cache is this world's, and this is a stand-in world.
                    equal(stableJson([store.get("SUITEE04OBSERVE1")?.room, store.get("SUITEE04OBSERVE1")?.at]), stableJson(["SUITE room", recent]),
                        "the claimed declaration does not read back");
                    equal(store.stampOf("SUITEE04OBSERVE1"), store.weak(), "the declaration was not claimed weak");
                }
            },
            cast: {
                legacy: SETTINGS.legacyIncidentCast,
                // Claimed only while this world's incident runs (the design's H4): tier 2 puts the state back.
                before: () => game.settings.set(MODULE_ID, SETTINGS.murderState, { active: true, stage: "incident", turn: 1, turnSide: "victim" }),
                seed: { killerId: student.id, victimId: other.id, thirdId: null, lastCrisis: null, betrayal: offer, updated: T },
                census: { legacy: 1, claimed: 1, left: 0, tombstones: 0, reasons: {} },
                readBack: store => {
                    const held = incidentCast();
                    equal(stableJson([held.killerId, held.victimId, held.betrayal]), stableJson([student.id, other.id, offer]),
                        "the claimed cast does not read back through incidentCast");
                    equal(store.stampOf("record", "killerId"), T, "the cast was not claimed at its own stamp");
                }
            },
            blackened: {
                legacy: SETTINGS.legacyBlackenedLedger,
                // Claimed only with a verdict of this chapter still to come (H4): a death in the clock's chapter.
                before: () => other.setFlag(MODULE_ID, FLAGS.deceased, { chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay }),
                seed: [student.id, "SUITEE04NOACTOR0"],
                census: { legacy: 2, claimed: 1, left: 1, tombstones: 0, reasons: { otherWorld: 1 } },
                readBack: store => {
                    equal(stableJson(store.get(student.id)), stableJson({ at: 0, chapter: clock.chapter, epoch: 0 }),
                        "the claimed Blackened is not this chapter's, of the season a world begins with, first in order");
                    equal(store.stampOf(student.id), store.weak(), "the claimed Blackened was not claimed weak");
                }
            },
            mastermind: {
                legacy: SETTINGS.legacyMastermind,
                seed: { actorId: student.id, room: "SUITE lair", updated: T },
                census: { legacy: 1, claimed: 1, left: 0, tombstones: 0, reasons: {} },
                readBack: store => {
                    equal(stableJson([mastermind.mastermindActor()?.id, mastermind.mastermindLair()]), stableJson([student.id, "SUITE lair"]),
                        "the claimed pick does not read back through mastermindActor and mastermindLair");
                    equal(store.stampOf("record", "actorId"), T, "the pick was not claimed at its own stamp");
                }
            },
            remnants: {
                legacy: SETTINGS.legacyRemnantSecrets,
                seed: {
                    [`${sceneId}.SUITEE04TRACE1`]: { type: "prep", visibility: "evident", note: "claimed", updated: T },
                    [`${sceneId}.SUITEE04TRACE2`]: { type: "key", note: "no stamp" },
                    [`${sceneId}.SUITEE04TRACE3`]: { deleted: true, updated: T },
                    ["SUITEE04NOSCENE.SUITEE04TRACE4"]: { type: "prep", updated: T }
                },
                census: { legacy: 4, claimed: 3, left: 1, tombstones: 1, reasons: { otherWorld: 1 } },
                readBack: store => {
                    const one = remnants.remnantData(trace("SUITEE04TRACE1"));
                    equal(stableJson([one?.type, one?.note, one?.updated]), stableJson(["prep", "claimed", T]),
                        "a claimed row does not read back through remnantData, at its own stamp");
                    equal(remnants.remnantData(trace("SUITEE04TRACE2"))?.type, "key", "a row with no stamp was not claimed (weak)");
                    ok(store.tombstone(`${sceneId}.SUITEE04TRACE3`) === T, "an old tombstone was not claimed at its own stamp");
                    ok(!store.has("SUITEE04NOSCENE.SUITEE04TRACE4"), "another world's row was claimed");
                }
            },
            bullets: {
                legacy: SETTINGS.legacyTruthBulletSecrets,
                seed: {
                    [`${here}.SUITEE04CENSUS1`]: { realType: "key", remnantId: "SUITEE04TRACE", gmNote: "claimed", updated: T },
                    [`${here}.SUITEE04CENSUS2`]: { realType: "final", gmNote: "no stamp" },
                    [`${here}.SUITEE04CENSUS3`]: { deleted: true, updated: T },
                    ["Actor.SUITEE04NOACTOR.Item.SUITEE04CENSUS4"]: { realType: "prep", updated: T }
                },
                census: { legacy: 4, claimed: 3, left: 1, tombstones: 1, reasons: { otherWorld: 1 } },
                readBack: store => {
                    equal(stableJson([bullets.secretOf(`${here}.SUITEE04CENSUS1`).realType, bullets.secretOf(`${here}.SUITEE04CENSUS1`).remnantId]),
                        stableJson(["key", "SUITEE04TRACE"]), "a claimed row does not read back through secretOf");
                    equal(bullets.secretOf(`${here}.SUITEE04CENSUS2`).realType, "final", "a row with no stamp was not claimed (weak)");
                    ok(store.tombstone(`${here}.SUITEE04CENSUS3`) === T, "an old tombstone was not claimed at its own stamp");
                    equal(stableJson(bullets.secretOf("Actor.SUITEE04NOACTOR.Item.SUITEE04CENSUS4")), "{}", "another world's row was claimed");
                }
            }
        };
        const stores = E.gmStoreHandles().filter(h => h.spec.legacyKey);
        ok(stores.length >= 1, "no GM store has an old key - the table did not load");
        const unfixtured = stores.filter(h => !FIXTURES[h.name]).map(h => h.name);
        ok(!unfixtured.length, `these stores claim an old key this test has no fixture for: ${unfixtured.join(", ")}`);
        const unclaimed = Object.keys(FIXTURES).filter(name => !stores.some(h => h.name === name));
        ok(!unclaimed.length, `this test has a fixture for a store that claims no old key: ${unclaimed.join(", ")}`);
        const raw = key => game.settings.storage.get("client").getItem(`${MODULE_ID}.${key}`);
        /* Each old key a fixture, read in place of this browser's (`withGmStoreLegacy`, the
           review's DS-m5): the real old keys - another world's unclaimed rows live only there -
           are never written, and read back unchanged after every claim. */
        for (const store of stores.filter(h => FIXTURES[h.name])) {
            const fx = FIXTURES[store.name];
            if (fx.before) await fx.before();
            const before = raw(fx.legacy);
            const claimed = () => E.withGmStoreLegacy({ [fx.legacy]: fx.seed }, () => E.withGmStoreWorld(`suite-census-${foundry.utils.randomID(8)}`, async () => {
                const census = await store.claim();
                equal(stableJson(census), stableJson(fx.census), `${store.name}: the census of its old key`);
                equal(census.claimed + census.left, census.legacy, `${store.name}: an old row was neither claimed nor left`);
                fx.readBack(store);
            }));
            await (fx.around ? fx.around(claimed) : claimed());
            equal(raw(fx.legacy), before, `${store.name}: the claim changed its real old key`);
        }

        // The fog copy's claim (C9), the one player copy with an old key it takes: this browser's
        // characters' rows of this world's scenes, weak, merged into the copy; the old key untouched.
        const mineBefore = raw(SETTINGS.legacyDiscoveryMine);
        const mine = { [SETTINGS.legacyDiscoveryMine]: { [sceneId]: { [student.id]: ["SUITE mine"] }, SUITEE04NOSCENE: { [student.id]: ["SUITE elsewhere"] } } };
        await E.withGmStoreLegacy(mine, () => E.withGmStoreWorld(`suite-census-${foundry.utils.randomID(8)}`, async () => {
            equal(await S.fogCopy.claim(), true, "the fog copy took nothing from its old key");
            const held = S.fogCopy.read();
            equal(stableJson(E.liveFields(held)), stableJson({ [`${sceneId}/${student.id}`]: { "SUITE mine": true } }),
                "the fog copy took another world's rows, or not this one's");
            equal(held?.t?.[`${sceneId}/${student.id}`], 1, "the fog copy's old rows were not taken weak");
        }));
        equal(raw(SETTINGS.legacyDiscoveryMine), mineBefore, "the fog copy's claim changed its real old key");
    }],

    ["two GMs' old casts claimed on the upgrade day keep the running incident's nulls, and a cast from before it opened is left", async () => {
        /*
         * E04's fix round, 26.09.2026; the round-2 review's R2-B1. A 1.2.62 cast entry was
         * written whole, and its nulls are decisions: "no third", "no receipt". The claim
         * took only the fields with a value, so a GM whose old key held the running incident
         * held no stamp for its third, and another GM's older entry - the previous incident,
         * which that GM last saw - put its third into the running one on every GM. Two
         * browsers' old keys, each claimed in a world of its own (`withGmStoreWorld`,
         * `withGmStoreLegacy`: no real old key is written, nothing is sent), their sections
         * merged as the GMs' exchange merges them: the third is the running entry's null.
         * And an entry written before the running incident opened (`openedAt`, less the
         * clocks' bound) is left, counted as the previous incident's.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const { TIMING } = await import("./config.mjs");
        const [killer, victim, third, oldKiller] = cast(4);
        const T2 = Date.now() - 60 * 60 * 1000, T1 = T2 - 10 * 60 * 1000;
        const running = { killerId: killer.id, victimId: victim.id, killerTurnId: killer.id, thirdId: null, thirdSide: null, lastCrisis: null, updated: T2 };
        const stale = { killerId: oldKiller.id, victimId: victim.id, killerTurnId: oldKiller.id, thirdId: third.id, thirdSide: "killer", updated: T1 };
        const claimed = seed => E.withGmStoreLegacy({ [SETTINGS.legacyIncidentCast]: seed },
            () => E.withGmStoreWorld(`suite-castpair-${foundry.utils.randomID(8)}`, async () => ({ census: await S.castStore.claim(), section: S.castStore.section() })));
        // Put back by tier 2's restore, as every murder test's state is.
        await game.settings.set(MODULE_ID, SETTINGS.murderState, { active: true, stage: "incident", turn: 2, turnSide: "killer" });
        const mine = await claimed(running), theirs = await claimed(stale);
        equal(stableJson([mine.census?.claimed, theirs.census?.claimed]), stableJson([1, 1]), "the two old casts were not both claimed");
        const record = E.mergeSections(mine.section, theirs.section, S.castStore.spec).e.record ?? {};
        equal(stableJson([record.killerId, record.thirdId, record.thirdSide, record.lastCrisis]), stableJson([killer.id, null, null, null]),
            `the previous incident's third filled the running incident's "no third": ${stableJson(record)}`);

        await game.settings.set(MODULE_ID, SETTINGS.murderState,
            { active: true, stage: "incident", turn: 2, turnSide: "killer", openedAt: T2 + TIMING.gmStoreSkewMs + 60 * 1000 });
        const earlier = await claimed(running);
        equal(stableJson([earlier.census?.claimed, earlier.census?.reasons]), stableJson([0, { previousIncident: 1 }]),
            `a cast written before the running incident opened was claimed: ${stableJson(earlier.census)}`);
    }],

    ["a lift of old world data leaves the world data when its store's rows do not read back", async () => {
        /*
         * E04's fix round, 26.09.2026; the round-2 review's m7. Three migration clauses take
         * data out of the world into a GM store - the fog's ledger (`liftDiscoveryLedger`),
         * the incident's names (`liftIncidentSecrets`), a bullet's Faint
         * (`migrateFaintIntoSecrets`) - and each removes the world's copy only once the
         * store's rows read back from storage. Nothing ran one over old data: R178 holds that
         * each is a clause and nothing else calls it, and a lift that emptied the world data
         * unread would have passed the suite. Each is run here over a fixture of its old world
         * data, in a world the stores have never opened, with that store's save swallowed -
         * the rows stand in memory and not on disk, as after a failed save: the world data
         * stays, and since E05's fix round (r1-G1) the fog's and the names' lifts throw with
         * the count, so the migration does not stamp the world and the next load tries again.
         * The Faint's pass did not until E05's second fix round (r2-F0b): a Faint whose row did
         * not read back stayed on its item and the world was stamped; it throws too now, for a
         * bullet with a row here - one with no row on this GM it keeps by design and does not
         * count - and a next pass lifts what it kept. The fourth clause, `truthBulletShape`,
         * removes nothing it does not rewrite in the same update. The world settings are put
         * back by tier 2's restore; the items are deleted here.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const fog = await import("./fog.mjs");
        const murder = await import("./murder.mjs");
        const bullets = await import("./truth-bullets.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fog's old ledger is kept for a scene of this world");
        const sceneId = (game.scenes.active ?? canvas?.scene)?.id;
        const [student, other] = cast(2);
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const swallow = key => {
            settings.set = async function (namespace, k, value) {
                if (namespace === MODULE_ID && k === key) return value;
                return realSet.call(this, namespace, k, value);
            };
        };
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        const made = [];
        try {
            await E.withGmStoreWorld(`suite-lifts-${foundry.utils.randomID(8)}`, async () => {
                const oldFog = { [sceneId]: { [student.id]: ["SUITE lifted room"] } };
                await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, oldFog);
                swallow(S.discoveryStore.spec.key);
                const fogThrew = await thrown(() => fog.liftDiscoveryLedger());
                putBack();
                equal(stableJson([/: 1 row\(s\) did not read back/.test(fogThrew ?? ""), game.settings.get(MODULE_ID, SETTINGS.discoveredRooms)]), stableJson([true, oldFog]),
                    `the fog's old ledger was emptied from the world with its rows not on disk, or the lift did not throw with the count: ${fogThrew}`);

                await game.settings.set(MODULE_ID, SETTINGS.murderState,
                    { active: true, stage: "incident", turn: 1, turnSide: "victim", killerId: student.id, victimId: other.id });
                swallow(S.castStore.spec.key);
                const castThrew = await thrown(() => murder.liftIncidentSecrets());
                putBack();
                const state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
                equal(stableJson([/^2 of the incident's names/.test(castThrew ?? ""), state.killerId ?? null, state.victimId ?? null]), stableJson([true, student.id, other.id]),
                    `the incident's names were taken out of the world with their row not on disk, or the lift did not throw with the count: ${castThrew}`);

                /* The Faint's pass (E05 fix r2-F0b): three unanalysed bullets carry Faint on the item. The
                   first has a row here, and its save is swallowed; the second has no row on this GM, which
                   the pass keeps by design - no pass can read back a row nobody has, and counting it would
                   stop the migration at every load; the third's row already holds its Faint on disk, as a
                   pass whose item write did not go through left it. Its flag comes off, and the pass throws
                   with the count: one. Then the next load - the store's memory dropped, as a raw write of
                   its key drops it (the runner test's note), and the save let through: the first reads
                   back and its flag comes off, and nothing is thrown. */
                const faint = async name => (await student.createEmbeddedDocuments("Item", [{ name, type: "loot",
                    flags: { [MODULE_ID]: { category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "evident", analyzed: false, faint: true } } }]))[0];
                for (const name of ["Suite fixture: a Faint on its item", "Suite fixture: a Faint with no row here", "Suite fixture: a Faint its row holds"]) {
                    made.push(await faint(name));
                }
                const [unsaved, , held] = made;
                await S.bulletStore.patch(unsaved.uuid, { realType: "prep" });
                await S.bulletStore.patch(held.uuid, { realType: "prep", faint: true });
                const onItems = () => made.map(i => student.items.get(i.id)?.getFlag(MODULE_ID, "faint") ?? null);
                swallow(S.bulletStore.spec.key);
                const faintThrew = await thrown(() => bullets.migrateFaintIntoSecrets());
                putBack();
                equal(stableJson([/^1 Truth Bullet\(s\) still carry their Faint/.test(faintThrew ?? ""), onItems()]), stableJson([true, [true, true, false]]),
                    `a Faint left its item with its row not on disk, one whose row holds it kept its flag, the one with no row was counted, or the pass did not throw with the count: ${faintThrew}`);
                await game.settings.set(MODULE_ID, S.bulletStore.spec.key, game.settings.get(MODULE_ID, S.bulletStore.spec.key));
                const again = await thrown(() => bullets.migrateFaintIntoSecrets());
                equal(stableJson([again, onItems(), S.bulletStore.persisted(unsaved.uuid)?.faint ?? null]), stableJson([null, [false, true, false], true]),
                    `the next pass did not lift the Faint it kept into its row and off its item, or threw over the bullet with no row: ${again}`);
            });
        } finally {
            putBack();
            for (const i of made) if (student.items.get(i.id)) await student.items.get(i.id).delete();
        }
    }],

    ["the project secrets' lift moves a trap's four fields into the GM store, and out of projectMeta once they read back", async () => {
        /*
         * E05 C1, 26.09.2026; audit S09-05. A world from before 1.2.64 carries each
         * project's killer, builder, condition and trigger in projectMeta; the clause
         * `liftProjectSecrets` moves them into the GMs' store, weak and fill-only, and takes a
         * field out of the world only once the store reads it back from storage. On a fixture
         * row of old world data, in a world the stores have never opened (`withGmStoreWorld`),
         * with one part of its trigger - `firedAt` - already stamped by a GM since the update:
         * the four read back from disk, that part the GM's; the row keeps its room and flags;
         * the world reads back holding none of the four; a second run has nothing to do.
         * Since E05's fix round (r1-G1, S1-m1) a repair's `saboteur`, a user id, is the fifth:
         * a repair row's goes to the store and its `repairs` stays. projectMeta is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const P = await import("./projects.mjs");
        const [killer] = cast(1);
        const ID = "SUITEE05LIFTPRJ1", REPAIR = "SUITEE05LIFTPRJ3";
        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        const open = { room: "SUITE lifted room", indirectMurder: true, secret: true, countsUp: true };
        const old = { ...open, killerId: killer.id, by: killer.id, condition: "SUITE lifted condition",
            trigger: { kind: "enters", armed: true, firedAt: null } };
        try {
            await E.withGmStoreWorld(`suite-projectlift-${foundry.utils.randomID(8)}`, async () => {
                await S.projectSecretStore.patch(ID, { trigger: { firedAt: 12345 } });
                await game.settings.set(MODULE_ID, SETTINGS.projectMeta,
                    { ...before, [ID]: old, [REPAIR]: { repairs: ID, saboteur: "SUITESABOTEUR001" } });
                const report = await P.liftProjectSecrets();
                const row = S.projectSecretStore.persisted(ID) ?? {};
                equal(stableJson([row.killerId, row.by, row.condition, row.trigger]),
                    stableJson([killer.id, killer.id, "SUITE lifted condition", { kind: "enters", armed: true, firedAt: 12345 }]),
                    "the four did not read back from the store's storage, or the world's trigger overwrote the part a GM stamped");
                equal(stableJson(P.metaFor(ID)), stableJson(open), "projectMeta's row lost a field that is not a secret, or kept one of the four");
                equal(stableJson([S.projectSecretStore.persisted(REPAIR)?.saboteur ?? null, P.metaFor(REPAIR)]), stableJson(["SUITESABOTEUR001", { repairs: ID }]),
                    "a repair's saboteur did not read back from the store's storage, or stayed in projectMeta, or took the repair's pair with it");
                equal(stableJson([report?.lifted, report?.kept, report?.emptied]), stableJson([5, 0, true]), `the lift's report: ${stableJson(report)}`);
                equal(await P.liftProjectSecrets(), null, "a second run of the lift found something to do");
            });
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
        }
    }],

    ["the project secrets' lift leaves projectMeta as it was when the store's rows do not read back", async () => {
        /*
         * E05 C1, 26.09.2026: the other half of the pair above, as the E04 lifts' test below
         * does it. The store's save is swallowed - the rows stand in memory and not on disk,
         * as after a failed save - and the world keeps every field: nothing is taken out of
         * projectMeta that the store cannot read back.
         * Since E05's fix round (r1-G1; the reviews' S1-M1, M2) the lift throws with the count,
         * so the migration does not stamp the world and the next load tries again: it answered a
         * report of what it kept, the runner stamped the world, and no load ever tried again.
         * In a world the stores have never opened; projectMeta is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const P = await import("./projects.mjs");
        const [killer] = cast(1);
        const ID = "SUITEE05LIFTPRJ2";
        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        const old = { room: "SUITE kept room", indirectMurder: true, secret: true, killerId: killer.id, by: null,
            condition: "SUITE kept condition", trigger: { kind: "alone", armed: false, firedAt: null } };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-projectkept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.projectMeta, { ...before, [ID]: old });
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.projectSecretStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => P.liftProjectSecrets());
                putBack();
                ok(S.projectSecretStore.has(ID), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^4 project secret field\(s\) are still in projectMeta \(4 /.test(threw ?? ""), P.metaFor(ID)]), stableJson([true, old]),
                    `projectMeta lost a field whose row is not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
        }
    }],

    ["the declarations' lift moves the world's pendingMurders into the GM store, and empties the key once they read back", async () => {
        /*
         * E05 C3, 26.09.2026; audit S10-01. A world from before 1.2.64 carries each Direct
         * Murder declared in the dark in the world setting pendingMurders, under the killer's
         * id; the clause `liftPendingMurders` moves each into the GMs' store, weak and
         * fill-only, named for the Eclipse running (none here), and takes one out of the world
         * only once its row reads back from storage. On fixture world data, in a world the
         * stores have never opened (`withGmStoreWorld`), with the ruling already stamped by a GM
         * since the update: the row reads back from disk with the world's room, note and time
         * and the GM's ruling; the key reads back empty; a second run has nothing to do. The
         * key is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const X = await import("./eclipse.mjs");
        const [killer] = cast(1);
        const before = foundry.utils.deepClone(getSetting(SETTINGS.legacyPendingMurders) ?? {});
        try {
            await E.withGmStoreWorld(`suite-parklift-${foundry.utils.randomID(8)}`, async () => {
                await S.pendingMurderStore.patch(killer.id, { approved: true });
                await game.settings.set(MODULE_ID, SETTINGS.legacyPendingMurders,
                    { [killer.id]: { room: "SUITE lifted room", note: "SUITE lifted note", at: 1234, approved: null } });
                const report = await X.liftPendingMurders();
                const row = S.pendingMurderStore.persisted(killer.id) ?? {};
                equal(stableJson([row.room, row.note, row.at, row.approved, row.eclipse]), stableJson(["SUITE lifted room", "SUITE lifted note", 1234, true, null]),
                    "the declaration did not read back from the store's storage, or the world's overwrote the ruling a GM stamped");
                equal(stableJson(getSetting(SETTINGS.legacyPendingMurders) ?? {}), "{}", "the world's key still holds a declaration that read back");
                equal(stableJson([report?.lifted, report?.kept, report?.emptied]), stableJson([1, 0, true]), `the lift's report: ${stableJson(report)}`);
                equal(await X.liftPendingMurders(), null, "a second run of the lift found something to do");
            });
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.legacyPendingMurders, before);
        }
    }],

    ["the declarations' lift leaves the world's pendingMurders as it was when the store's rows do not read back", async () => {
        /*
         * E05 C3, 26.09.2026: the other half of the pair above, as the project secrets' pair
         * does it. The store's save is swallowed - the row stands in memory and not on disk -
         * and the world keeps the declaration: nothing leaves world data that the store cannot
         * read back.
         * Since E05's fix round (r1-G1; the reviews' S1-M1, M2) the lift throws with the count,
         * so the migration does not stamp the world and the next load tries again: it answered a
         * report of what it kept, the runner stamped the world, and no load ever tried again.
         * In a world the stores have never opened; the key is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const X = await import("./eclipse.mjs");
        const [killer] = cast(1);
        const before = foundry.utils.deepClone(getSetting(SETTINGS.legacyPendingMurders) ?? {});
        const old = { [killer.id]: { room: "SUITE kept room", note: "SUITE kept note", at: 5678, approved: true } };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-parkkept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.legacyPendingMurders, old);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.pendingMurderStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => X.liftPendingMurders());
                putBack();
                ok(S.pendingMurderStore.has(killer.id), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^1 declaration\(s\) made in the dark are still in world data \(1 /.test(threw ?? ""), getSetting(SETTINGS.legacyPendingMurders)]), stableJson([true, old]),
                    `the world lost a declaration whose row is not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            await game.settings.set(MODULE_ID, SETTINGS.legacyPendingMurders, before);
        }
    }],

    ["the crossings' lift moves the world's eclipseMoves into the GM store while an Eclipse runs, and empties the key once they read back", async () => {
        /*
         * E05 C4, 26.09.2026; audit S10-39. A world from before 1.2.64 counts the crossings of
         * the running Eclipse in the world setting eclipseMoves; the clause `liftEclipseMoves`
         * moves each count into the GMs' store, weak and fill-only, named for the running
         * Eclipse, and takes it out of the world only once it reads back from storage. On
         * fixture world data, in a world the stores have never opened (`withGmStoreWorld`),
         * with the clock's Eclipse flag and name written by hand and one character's count
         * already stamped by a GM since the update: the other's reads back from disk, the GM's
         * stands; the key reads back empty; a second run has nothing to do. Outside an Eclipse
         * a count is the last Eclipse's, and goes with no row. The key and the clock are put
         * back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const X = await import("./eclipse.mjs");
        const [one, two] = cast(2);
        const before = foundry.utils.deepClone(getSetting(SETTINGS.legacyEclipseMoves) ?? {});
        const clock = getClock();
        try {
            await setClock({ eclipse: true, eclipseStartedAt: 424242 });
            const id = X.eclipseId();
            await E.withGmStoreWorld(`suite-moveslift-${foundry.utils.randomID(8)}`, async () => {
                await S.eclipseMoveStore.patch(two.id, { used: 1, eclipse: id });
                await game.settings.set(MODULE_ID, SETTINGS.legacyEclipseMoves, { [one.id]: 2, [two.id]: 2 });
                const report = await X.liftEclipseMoves();
                const rows = [one.id, two.id].map(k => S.eclipseMoveStore.persisted(k) ?? {});
                equal(stableJson(rows.map(r => [r.used, r.eclipse])), stableJson([[2, id], [1, id]]),
                    "a count did not read back from the store's storage, named for this Eclipse, or the world's overwrote the one a GM counted");
                equal(stableJson(getSetting(SETTINGS.legacyEclipseMoves) ?? {}), "{}", "the world's key still holds a count that read back");
                equal(stableJson([report?.lifted, report?.kept, report?.emptied]), stableJson([2, 0, true]), `the lift's report: ${stableJson(report)}`);
                equal(await X.liftEclipseMoves(), null, "a second run of the lift found something to do");

                await setClock({ eclipse: false });
                await game.settings.set(MODULE_ID, SETTINGS.legacyEclipseMoves, { [one.id]: 1 });
                const outside = await X.liftEclipseMoves();
                equal(stableJson([outside?.lifted, outside?.kept, getSetting(SETTINGS.legacyEclipseMoves) ?? null]), stableJson([0, 0, {}]),
                    "outside an Eclipse the last Eclipse's count was lifted, or left in the world");
            });
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.legacyEclipseMoves, before);
            await setClock(clock);
        }
    }],

    ["the crossings' lift leaves the world's eclipseMoves as it was when the store's rows do not read back", async () => {
        /*
         * E05 C4, 26.09.2026: the other half of the pair above. The store's save is swallowed -
         * the row stands in memory and not on disk - and the world keeps the count: nothing
         * leaves world data that the store cannot read back.
         * Since E05's fix round (r1-G1; the reviews' S1-M1, M2) the lift throws with the count,
         * so the migration does not stamp the world and the next load tries again: it answered a
         * report of what it kept, the runner stamped the world, and no load ever tried again.
         * In a world the stores have never opened, in an Eclipse named by hand; the key and
         * the clock are put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const X = await import("./eclipse.mjs");
        const [one] = cast(1);
        const before = foundry.utils.deepClone(getSetting(SETTINGS.legacyEclipseMoves) ?? {});
        const clock = getClock();
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await setClock({ eclipse: true, eclipseStartedAt: 434343 });
            await E.withGmStoreWorld(`suite-moveskept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.legacyEclipseMoves, { [one.id]: 1 });
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.eclipseMoveStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => X.liftEclipseMoves());
                putBack();
                ok(S.eclipseMoveStore.has(one.id), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^1 Eclipse crossing count\(s\) are still in world data \(1 /.test(threw ?? ""), getSetting(SETTINGS.legacyEclipseMoves)]), stableJson([true, { [one.id]: 1 }]),
                    `the world lost a count whose row is not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            await game.settings.set(MODULE_ID, SETTINGS.legacyEclipseMoves, before);
            await setClock(clock);
        }
    }],

    ["the Key Remnant plan's lift moves the world's keyRemnantPlan into the GM store, a row per chapter and slot, and empties the key once they read back", async () => {
        /*
         * E05 C5, 26.09.2026; audit S01-01, S05-02. A world from before 1.2.64 carries the plan
         * in the world setting keyRemnantPlan: the chapter's entries, and the chapters before
         * under `archive`. The clause `liftKeyPlan` makes a row of each chapter's slot, weak and
         * fill-only, and empties the key only once every field reads back from storage. On
         * fixture world data, in a world the stores have never opened (`withGmStoreWorld`),
         * with a note a GM wrote on chapter 3's first slot since the update: that note stands
         * and the world's fills the rest of the slot; chapter 3's current entries replace its
         * filed copy, so a slot emptied since it was filed stays empty (its scale is its row);
         * chapter 2 comes out of the archive; the key reads back empty and the report counts
         * every field; a second run has nothing to do. The key is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const I = await import("./investigation.mjs");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.legacyKeyRemnantPlan) ?? {});
        const empty = { analysis: "", note: "", tokenId: null, sceneId: null };
        try {
            await E.withGmStoreWorld(`suite-keylift-${foundry.utils.randomID(8)}`, async () => {
                await S.keyPlanStore.patch("3:0", { note: "SUITE note a GM wrote since" });
                await game.settings.set(MODULE_ID, SETTINGS.legacyKeyRemnantPlan, {
                    chapter: 3,
                    entries: [
                        { scale: "trivial", name: "SUITE lifted name", text: "SUITE lifted text", analysis: "SUITE lifted analysis",
                            note: "SUITE the world's note", tokenId: "SUITETOKEN000001", sceneId: "SUITESCENE000001" },
                        { scale: "standard", name: "", text: "", ...empty }
                    ],
                    archive: {
                        2: [{ scale: "trivial", name: "SUITE filed in chapter 2", text: "", ...empty }],
                        3: [{ scale: "trivial", name: "SUITE chapter 3 as filed", text: "", ...empty },
                            { scale: "standard", name: "SUITE a slot emptied since", text: "", ...empty }]
                    }
                });
                const report = await I.liftKeyPlan();
                const disk = key => S.keyPlanStore.persisted(key) ?? null;
                equal(stableJson([disk("3:0"), disk("3:1"), disk("2:0")]), stableJson([
                    { note: "SUITE note a GM wrote since", scale: "trivial", name: "SUITE lifted name", text: "SUITE lifted text",
                        analysis: "SUITE lifted analysis", tokenId: "SUITETOKEN000001", sceneId: "SUITESCENE000001" },
                    { scale: "standard" },
                    { scale: "trivial", name: "SUITE filed in chapter 2" }]),
                "the rows did not read back from the store's storage as the world's plan, or the world's overwrote a note a GM wrote since");
                equal(stableJson(getSetting(SETTINGS.legacyKeyRemnantPlan) ?? {}), "{}", "the world's key still holds the plan, whose rows read back");
                equal(stableJson([report?.lifted, report?.kept, report?.emptied]), stableJson([10, 0, true]), `the lift's report: ${stableJson(report)}`);
                equal(await I.liftKeyPlan(), null, "a second run of the lift found something to do");
            });
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.legacyKeyRemnantPlan, before);
        }
    }],

    ["the Key Remnant plan's lift leaves the world's keyRemnantPlan as it was when the store's rows do not read back", async () => {
        /*
         * E05 C5, 26.09.2026: the other half of the pair above, as the declarations' pair does
         * it. The store's save is swallowed - the rows stand in memory and not on disk - and the
         * world keeps the whole plan: nothing leaves world data that the store cannot read back.
         * Since E05's fix round (r1-G1; the reviews' S1-M1, M2) the lift throws with the count,
         * so the migration does not stamp the world and the next load tries again: it answered a
         * report of what it kept, the runner stamped the world, and no load ever tried again.
         * In a world the stores have never opened; the key is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const I = await import("./investigation.mjs");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.legacyKeyRemnantPlan) ?? {});
        const old = { chapter: 1, entries: [{ scale: "trivial", name: "SUITE kept name", text: "SUITE kept text", analysis: "", note: "SUITE kept note", tokenId: null, sceneId: null }] };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-keykept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.legacyKeyRemnantPlan, old);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.keyPlanStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => I.liftKeyPlan());
                putBack();
                ok(S.keyPlanStore.has("1:0"), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^4 field\(s\) of the Key Remnant plan did not read back/.test(threw ?? ""), getSetting(SETTINGS.legacyKeyRemnantPlan)]), stableJson([true, old]),
                    `the world lost a plan whose rows are not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            await game.settings.set(MODULE_ID, SETTINGS.legacyKeyRemnantPlan, before);
        }
    }],

    ["the notes' lift moves each pre-session note's text out of its user's flag into the GM store, and replaces the flag once it reads back", async () => {
        /*
         * E05 C6, 26.09.2026; audit S11-03, S01-08. A world from before 1.2.64 keeps each
         * pre-session note's text in a flag on its user, which every browser holds; the clause
         * `liftNotes` moves each text into the GMs' store, weak and fill-only, and replaces the
         * flag by `{ updatedAt, written }` only once the row reads back from storage. On fixture
         * flags of two players, in a world the stores have never opened (`withGmStoreWorld`),
         * with a note a GM wrote for the second since the update: the first's text reads back
         * from disk and the GM's stands for the second; both flags read back without their
         * text, saying when and that a note is written; a second run has nothing to do. Every
         * user's flag is put back.
         */
        needs(world.atLeast("playerAccounts", 2), "the lift is shown two players' notes");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const N = await import("./pre-session-note.mjs");
        const [one, two] = game.users.filter(u => !u.isGM);
        const before = noteFlagsNow();
        try {
            await E.withGmStoreWorld(`suite-notelift-${foundry.utils.randomID(8)}`, async () => {
                await S.noteStore.patch(two.id, { text: "SUITE a note a GM wrote since", updatedAt: 20, byGm: true });
                await setNoteFlag(one, { text: "SUITE lifted note", updatedAt: 10, byGm: false });
                await setNoteFlag(two, { text: "SUITE the world's older note", updatedAt: 5, byGm: false });
                const report = await N.liftNotes();
                const disk = id => S.noteStore.persisted(id) ?? null;
                equal(stableJson([disk(one.id), disk(two.id)]), stableJson([
                    { text: "SUITE lifted note", updatedAt: 10, byGm: false },
                    { text: "SUITE a note a GM wrote since", updatedAt: 20, byGm: true }]),
                "a note did not read back from the store's storage, or the world's overwrote the one a GM wrote since");
                equal(stableJson([one, two].map(u => u.getFlag(MODULE_ID, N.NOTE_FLAG))),
                    stableJson([{ updatedAt: 10, written: true }, { updatedAt: 20, written: true }]),
                    "a flag still holds its text, or does not say when and that the note is written");
                equal(stableJson([report?.lifted, report?.kept, report?.emptied]), stableJson([2, 0, true]), `the lift's report: ${stableJson(report)}`);
                equal(await N.liftNotes(), null, "a second run of the lift found something to do");
            });
        } finally {
            await putNoteFlagsBack(before);
        }
    }],

    ["the notes' lift leaves a pre-session note's text in its flag when the store's row does not read back", async () => {
        /*
         * E05 C6, 26.09.2026: the other half of the pair above, as the crossings' and the plan's
         * pairs do it. The store's save is swallowed - the row stands in memory and not on disk -
         * and the flag keeps its text: nothing leaves world data that the store cannot read back.
         * Since E05's fix round (r1-G1; the reviews' S1-M1, M2) the lift throws with the count,
         * so the migration does not stamp the world and the next load tries again: it answered a
         * report of what it kept, the runner stamped the world, and no load ever tried again.
         * In a world the stores have never opened; every user's flag is put back.
         */
        needs(world.atLeast("playerAccounts", 1), "the lift is shown a player's note");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const N = await import("./pre-session-note.mjs");
        const [one] = game.users.filter(u => !u.isGM);
        const before = noteFlagsNow();
        const old = { text: "SUITE kept note", updatedAt: 7, byGm: false };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-notekept-${foundry.utils.randomID(8)}`, async () => {
                await setNoteFlag(one, old);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.noteStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => N.liftNotes());
                putBack();
                ok(S.noteStore.has(one.id), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^1 pre-session note\(s\) are still in their users' flags \(1 /.test(threw ?? ""), one.getFlag(MODULE_ID, N.NOTE_FLAG)]), stableJson([true, old]),
                    `the world lost a note whose row is not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            await putNoteFlagsBack(before);
        }
    }],

    ["a GM's Note tab waits for the GMs' notes, follows its note without losing what is typed, and does not save over a newer one unasked", async () => {
        /*
         * E05 fix r1-G4, 27.09.2026; reviews M1 (the note half) and M5. A GM's Note tab was drawn
         * from this browser's rows with no wait for the other GMs' - and never followed its note
         * after: the settings had no `onChange`, so a tab drawn with older words kept them, and its
         * Save wrote them back whole over the newer note. In a world the stores have never opened,
         * with the notes store's hydration held (as the crossings' test holds its store): the tab
         * is not drawn while held; drawn with the row another GM wrote; it follows a newer note,
         * status line and all; it keeps what is typed when the note changes again; the Save of the
         * typed text is refused and says why, and a second Save puts it in place. Red on 7c846b2:
         * drawn at once, empty, and the typed text saved over the newest note.
         */
        needs(world.atLeast("playerAccounts", 1), "the tab shows a player's note");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./messenger-app.mjs");
        const [one] = game.users.filter(u => !u.isGM);
        const before = noteFlagsNow();
        const kept = [SETTINGS.messengerLastRead, SETTINGS.messengerWindowPositions]
            .map(key => [key, foundry.utils.deepClone(game.settings.get(MODULE_ID, key))]);
        const real = S.noteStore.whenHydrated;
        const earlier = M.DrpgMessengerApp.instances.get(one.id) ?? null;
        let app = null;
        try {
            if (earlier) await earlier.close();
            await E.withGmStoreWorld(`suite-notetab-${foundry.utils.randomID(8)}`, async () => {
                const gate = {};
                gate.promise = new Promise(resolve => { gate.open = () => resolve("answered"); });
                S.noteStore.whenHydrated = () => gate.promise;
                app = new M.DrpgMessengerApp(one.id);
                M.DrpgMessengerApp.instances.set(one.id, app);
                app.tab = "note";
                const drawing = app.render({ force: true });
                const area = () => app.element?.querySelector(".drpg-messenger-note-text") ?? null;
                const status = () => app.element?.querySelector(".drpg-messenger-note-status")?.textContent ?? null;
                const save = async () => { app.element.querySelector(".drpg-messenger-note-save").click(); await settle(); };
                await settle();
                equal(area(), null, "the Note tab was drawn before the store held the other GMs' notes");
                await S.noteStore.patch(one.id, { text: "SUITE r1-G4 another GM's note", updatedAt: 1, byGm: true });
                gate.open();
                await drawing;
                equal(area()?.value, "SUITE r1-G4 another GM's note", "the Note tab was not drawn with the note the other GMs held");
                await S.noteStore.patch(one.id, { text: "SUITE r1-G4 a newer note", updatedAt: Date.now(), byGm: true });
                await settle();
                equal(stableJson([area()?.value, status()]), stableJson(["SUITE r1-G4 a newer note", game.i18n.localize("DRPG.Note.statusToday")]),
                    "the open Note tab did not follow its note's change, or its status line did not");
                area().value = "SUITE r1-G4 typed here";
                await S.noteStore.patch(one.id, { text: "SUITE r1-G4 the newest note", updatedAt: Date.now(), byGm: true });
                await settle();
                equal(area()?.value, "SUITE r1-G4 typed here", "the note's change was written over what was being typed");
                await save();
                equal(stableJson([S.noteStore.get(one.id)?.text, status()]),
                    stableJson(["SUITE r1-G4 the newest note", game.i18n.localize("DRPG.Note.changedElsewhere")]),
                    "a Save of a text typed over an older note wrote over the newer one, or did not say why it did not");
                await save();
                equal(S.noteStore.get(one.id)?.text, "SUITE r1-G4 typed here", "a second Save, once told, did not put the typed text in place");
            });
        } finally {
            S.noteStore.whenHydrated = real;
            if (app) await app.close();
            for (const [key, value] of kept) await game.settings.set(MODULE_ID, key, value);
            await putNoteFlagsBack(before);
        }
    }],

    ["the case health check names an indirect murder and a note this browser does not hold, and a restore's flags keep a newer note's date", async () => {
        /*
         * E05 fix r1-G4, 27.09.2026; reviews M4 = S1-m5, M6 = S1-m6. A GM browser that lost its
         * storage with no other GM to hand the rows back lost every indirect murder's killer,
         * condition and trigger (projectMeta still says `indirectMurder`; the trap never arms)
         * and every note a flag still calls written - and the health check said nothing. In a
         * world the stores have never opened: two indirect murders in projectMeta, one with its
         * row; two players' flags saying a note is written, one with no row and one with an
         * older row - each counted, and the older one no longer once its row is newer. Then
         * `settleNoteFlags`, a restore's step: a flag a reset left (`{ written: false }`) takes
         * the row's date, a flag newer than its row keeps its own. projectMeta and every flag are
         * put back. Red on 7c846b2: no row for either, and no counts.
         */
        needs(world.atLeast("playerAccounts", 2), "two players' notes");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const N = await import("./pre-session-note.mjs");
        const [one, two] = game.users.filter(u => !u.isGM);
        const before = noteFlagsNow();
        const meta = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        const counts = report => stableJson([report.counts.projectSecrets, report.counts.notes]);
        const rowOf = (report, id) => report.rows.find(r => r.id === id) ?? null;
        try {
            await E.withGmStoreWorld(`suite-health-${foundry.utils.randomID(8)}`, async () => {
                await setNoteFlag(one, { written: false });
                await setNoteFlag(two, { written: false });
                const base = await S.gmStoreHealth();
                const was = { murders: base.counts.projectSecrets?.of ?? 0, lost: base.counts.projectSecrets?.missing ?? 0, notes: base.counts.notes?.missing ?? 0 };
                await game.settings.set(MODULE_ID, SETTINGS.projectMeta, { ...meta,
                    SUITEG4LOSTPJ00: { room: null, indirectMurder: true }, SUITEG4KEPTPJ00: { room: null, indirectMurder: true } });
                await S.projectSecretStore.patch("SUITEG4KEPTPJ00", { condition: "SUITE r1-G4 kept condition" });
                await setNoteFlag(one, { updatedAt: 50, written: true });
                await setNoteFlag(two, { updatedAt: 50, written: true });
                await S.noteStore.patch(two.id, { text: "SUITE r1-G4 an older note", updatedAt: 40, byGm: false });
                const report = await S.gmStoreHealth();
                equal(counts(report), stableJson([{ of: was.murders + 2, missing: was.lost + 1 }, { missing: was.notes + 2 }]),
                    "the indirect murder with no row, or the two notes this browser lacks or holds older, were not counted");
                const lines = ["projectSecrets", "notes"].map(id => rowOf(report, id));
                ok(lines.every(r => r?.level === "missing" && !S.healthLine(r).startsWith("DRPG.")),
                    `the report has no missing row with a text for them: ${stableJson(lines)}`);
                await S.noteStore.patch(two.id, { text: "SUITE r1-G4 a newer note", updatedAt: 60, byGm: false });
                equal((await S.gmStoreHealth()).counts.notes?.missing, was.notes + 1, "a note whose row is newer than its flag is still counted missing");

                await S.noteStore.patch(one.id, { text: "SUITE r1-G4 restored note", updatedAt: 30, byGm: false });
                await setNoteFlag(one, { written: false });
                await setNoteFlag(two, { updatedAt: 70, written: true });
                await N.settleNoteFlags();
                equal(stableJson([one.getFlag(MODULE_ID, N.NOTE_FLAG), two.getFlag(MODULE_ID, N.NOTE_FLAG)]),
                    stableJson([{ updatedAt: 30, written: true }, { updatedAt: 70, written: true }]),
                    "a restore's step did not write a reset flag from its row, or wrote an older date over a newer note's flag");
            });
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await putNoteFlagsBack(before);
        }
    }],

    ["a Reroll finds its bookmark in the roller's browser, and the actor carries none", async () => {
        /*
         * E05 C7, 26.09.2026; audit S02-01. The bookmark was the actor flag `lastAction`,
         * in every browser; it is this browser's client setting `rollBookmarks` now, per
         * world and character. Two rolls of one character: the action's own, with its
         * context, and a supporting roll after it (`remember: false`), newer and not the
         * one to take back. The bookmark names the first, from this browser's store under
         * this world, the actor carries none, and a Reroll takes the first back - not the
         * newest, which is what the recent-chat scan alone would pick. Then the only
         * bookmark is another world's: it is not read here, and the scan picks the newest.
         * The store, the dice and the two messages are put back.
         */
        const [who] = cast(1);
        const rolls = await import("./action-rolls.mjs");
        const R = await import("./reroll.mjs");
        const kept = getSetting(SETTINGS.rollBookmarks);
        const hadForce = Object.hasOwn(globalThis, "__forceRoll"), force = globalThis.__forceRoll;
        const made = [];
        try {
            globalThis.__forceRoll = { hope: 9, fear: 5 };
            const first = await rolls.rollTrait(who, "eye", { actionKey: "suite-probe", context: { room: "SUITE room" } });
            made.push(first?.raw?.message?.id ?? null);
            const second = await rolls.rollTrait(who, "eye", { remember: false });
            made.push(second?.raw?.message?.id ?? null);
            const [firstId, secondId] = made;
            ok(firstId && secondId && firstId !== secondId, "the two rolls did not each leave a message - this measured nothing");
            const mark = rolls.rollBookmark(who);
            equal(stableJson([mark?.messageId, mark?.actionKey, mark?.room]), stableJson([firstId, "suite-probe", "SUITE room"]),
                "the bookmark is not the action's roll with its context");
            equal(getSetting(SETTINGS.rollBookmarks)?.worlds?.[game.world.id]?.[who.id]?.messageId, firstId,
                "the bookmark is not in this browser's store under this world and character");
            ok(!Object.hasOwn(who.flags?.[MODULE_ID] ?? {}, FLAGS.lastAction), "the actor carries a Reroll bookmark in world data");
            equal(R.lastRollOf(who).message?.id, firstId, "a Reroll would take back the newest roll, not the bookmarked one");

            await game.settings.set(MODULE_ID, SETTINGS.rollBookmarks, { v: 1, worlds: { "suite-other-world": { [who.id]: { messageId: firstId } } } });
            equal(rolls.rollBookmark(who), null, "another world's bookmark was read as this world's");
            equal(R.lastRollOf(who).message?.id, secondId, "with no bookmark here, a Reroll does not fall back to the newest roll");
        } finally {
            if (hadForce) globalThis.__forceRoll = force;
            else delete globalThis.__forceRoll;
            await game.settings.set(MODULE_ID, SETTINGS.rollBookmarks, kept ?? {});
            for (const id of made) await game.messages.get(id ?? "")?.delete();
        }
    }],

    ["the day summary reads the words' store, and the card's document carries no facts", async () => {
        /*
         * E05 C7, 26.09.2026; audit S10-05, S02-11. An action's result card carried its
         * facts - what was found, where, whether a trace was left - as `flags.summary`, on
         * a document every browser holds. They go with the words now (utils.mjs `privately`
         * to secret.mjs `postSecret`), and the day summary reads them from this browser's
         * store. A card posted as `report()` posts one: its document holds no facts
         * anywhere, the summary's line is the facts as sent, and a time of day that began
         * after it does not list it. Then what the store keeps of facts whoever sent them:
         * the plain fields, bounded, and nothing else. The card is deleted.
         */
        const [who] = cast(1);
        const U = await import("./utils.mjs");
        const S = await import("./secret.mjs");
        const D = await import("./day-summary.mjs");
        const since = Date.now();
        const facts = { actorId: who.id, action: "Search", room: "SUITE room", total: 17, critical: false,
            item: "SUITE find", tier: 2, leftTrace: true, at: since + 1 };
        let card = null;
        try {
            card = await U.whisperToOwner(who, "<p>SUITE facts card</p>", { summary: facts });
            ok(card?.id, "the card was not posted - this measured nothing");
            ok(!Object.hasOwn(card.flags?.[MODULE_ID] ?? {}, "summary"), "the card's document carries a summary flag");
            ok(!JSON.stringify(card.toObject?.() ?? card).includes("SUITE find"), "the card's document names what was found");
            equal(stableJson(D.entriesSince(since).find(e => e.item === "SUITE find") ?? null), stableJson(facts),
                "the day summary does not read the card's facts from the words' store");
            ok(!D.entriesSince(since + 2).some(e => e.item === "SUITE find"), "a card from before the time of day began is in its summary");
            equal(stableJson(S.plainSummary({ actorId: "<b>x</b>", action: "A".repeat(500), total: "7", item: { html: "<img>" },
                critical: "yes", tier: Infinity, extra: "SUITE extra", at: NaN })),
            stableJson({ actorId: null, action: "A".repeat(200), room: null, total: null, critical: false, item: null, tier: null, leftTrace: false, at: null }),
            "the store keeps more of a card's facts than their plain fields");
        } finally {
            await card?.delete();
        }
    }],

    ["the bookmarks' drop takes an actor's Reroll bookmark out of world data", async () => {
        /*
         * E05 C7, 26.09.2026: the `dropRollBookmarks` clause (action-rolls.mjs). An old
         * bookmark planted on a character, with a crisis key in it, as 1.2.63 wrote them:
         * the drop deletes it, reads it back and says how many, and a second run has
         * nothing to do. Nothing is lifted, so nothing is put back but the flag, if the
         * drop left it.
         *
         * AND ON AN UNLINKED TOKEN'S OWN ACTOR DATA (E05's fix round, S1-m4, 27.09.2026): a
         * token of the same character, unlinked, whose delta holds a Stage 6 bookmark as a
         * sheet opened from it wrote one - the drop takes it off the delta as well, and
         * counts both. Red first (27.09): on the fix's parent the delta kept its bookmark.
         * The token is deleted.
         */
        const [who] = cast(1);
        const A = await import("./action-rolls.mjs");
        const scene = canvas.scene ?? game.scenes.contents[0];
        let token = null;
        const deltaHolds = () => Object.hasOwn(scene.tokens.get(token?.id ?? "")?.toObject()?.delta?.flags?.[MODULE_ID] ?? {}, FLAGS.lastAction);
        try {
            await who.setFlag(MODULE_ID, FLAGS.lastAction, { messageId: "SUITEMESSAGE0001", actionKey: "crisis", crisis: "SUITE key" });
            ok(Object.hasOwn(who.flags?.[MODULE_ID] ?? {}, FLAGS.lastAction), "the old bookmark was not planted - this measured nothing");
            [token] = await scene.createEmbeddedDocuments("Token", [{ name: "SUITE unlinked", actorId: who.id, actorLink: false,
                x: 100, y: 100, width: 1, height: 1, hidden: true,
                delta: { flags: { [MODULE_ID]: { [FLAGS.lastAction]: { messageId: "SUITEMESSAGE0002", actionKey: "stage6", tokenIds: ["SUITETOKEN000001"] } } } } }]);
            ok(deltaHolds(), "the unlinked token's bookmark was not planted - this measured nothing");
            const report = await A.dropRollBookmarks();
            ok(!Object.hasOwn(game.actors.get(who.id)?.flags?.[MODULE_ID] ?? {}, FLAGS.lastAction), "the actor still carries its bookmark after the drop");
            ok(!deltaHolds(), "the unlinked token's own actor data still carries its bookmark after the drop");
            ok(report?.dropped >= 2, `the drop's report does not count both bookmarks: ${stableJson(report)}`);
            equal(await A.dropRollBookmarks(), null, "a second run of the drop found something to do");
        } finally {
            if (Object.hasOwn(who.flags?.[MODULE_ID] ?? {}, FLAGS.lastAction)) await who.unsetFlag(MODULE_ID, FLAGS.lastAction);
            if (token) await scene.tokens.get(token.id)?.delete();
        }
    }],

    ["the facts' drop takes a card's summary flag out of world data", async () => {
        /*
         * E05 C7, 26.09.2026: the `dropCardSummaries` clause (secret.mjs). A card as 1.2.63
         * posted a Search's, its facts in `flags.summary`: the drop deletes them, reads them
         * back and says how many, and a second run has nothing to do. The card is deleted.
         */
        const S = await import("./secret.mjs");
        let card = null;
        try {
            card = await ChatMessage.create({ content: "<p>SUITE old card</p>", whisper: [game.user.id], rolls: [],
                flags: { [MODULE_ID]: { summary: { action: "Search", item: "SUITE old find", at: Date.now() } } } });
            ok(Object.hasOwn(card?.flags?.[MODULE_ID] ?? {}, "summary"), "the old facts were not planted - this measured nothing");
            const report = await S.dropCardSummaries();
            ok(!Object.hasOwn(game.messages.get(card.id)?.flags?.[MODULE_ID] ?? {}, "summary"), "the card still carries its facts after the drop");
            ok(report?.dropped >= 1, `the drop's report does not count the card: ${stableJson(report)}`);
            equal(await S.dropCardSummaries(), null, "a second run of the drop found something to do");
        } finally {
            await card?.delete();
        }
    }],

    ["a trap's victim reads indirect from the cast; the world half does not hold it", async () => {
        /*
         * E05 C8, 26.09.2026; audit S04-08. The world half of `murderState` held whether an
         * incident was a trap, and every browser holds it - the trap's builder among them, the
         * one person `castOwners` withholds the cast from while it runs. Opened through the
         * game's own call, an indirect murder, with this GM sitting in the victim's chair: the
         * world half holds only the public list; the cast holds the method, decided afresh
         * (a trap, not by the victim's own hand, no reversal, no end, when it opened);
         * `murderState()` merges it; and the victim's seat reads a trap. Read at once after
         * the open: the victim's opening roll runs on their player's browser and may close
         * it. The killer's side is "a trap does not tell the person who set it".
         */
        const M = await import("./murder.mjs");
        const S = await import("./gm-stores.mjs");
        const { incidentWitness } = await import("./settings.mjs");
        const [killer, victim] = cast(2);
        const assignedBefore = game.user.character ?? null;
        try {
            await game.user.update({ character: victim.id });
            const opened = await M.openMurder({ killerId: killer.id, victimId: victim.id, indirect: true });
            const world = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {});
            const record = S.castStore.record();
            const merged = M.murderState();
            const seat = incidentWitness();
            ok(opened && world.active, "the indirect murder did not open - this measured nothing");
            const extra = Object.keys(world).filter(key => !Object.hasOwn(M.PUBLIC_INCIDENT, key));
            ok(!extra.length, `the world half of an incident holds what the public list does not: ${extra.join(", ")}`);
            equal(stableJson([record.indirect, record.selfInflicted, record.keyRemnantsStale ?? null, record.endedBy ?? null, Number.isFinite(record.openedAt)]),
                stableJson([true, false, null, null, true]), `the cast does not hold the incident's method as it opened: ${stableJson(record)}`);
            equal(merged?.indirect, true, "murderState() does not read the trap from the cast");
            ok(seat.running && seat.indirect && seat.seat === victim.id, `the victim's seat does not read a trap from the cast: ${stableJson(seat)}`);
        } finally {
            await game.user.update({ character: assignedBefore?.id ?? null });
        }
    }],

    ["the method's lift moves a running incident's five fields into the cast, and out of the world half once they read back", async () => {
        /*
         * E05 C8, 26.09.2026; audit S04-08. A world from before 1.2.64 keeps an incident's
         * method in the world half of `murderState`; the clause `liftIncidentMethod` moves the
         * fields with a value into the cast, weak and fill-only, and takes each out of the
         * world half once the cast reads it back from storage; a null leaves with them. In a
         * world the stores have never opened (`withGmStoreWorld`), with a reversal a GM wrote
         * since the update: it stands. The report counts four lifted and the null dropped, and
         * a second run has nothing to do. Then with no incident running the fields leave
         * outright and the cast is not touched. The world setting is put back by tier 2's
         * restore.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const mechanics = { active: true, stage: "incident", turn: 2, turnSide: "killer", keyRemnants: 4 };
        await E.withGmStoreWorld(`suite-methodlift-${foundry.utils.randomID(8)}`, async () => {
            await S.castStore.patch("record", { keyRemnantsStale: false });
            await game.settings.set(MODULE_ID, SETTINGS.murderState,
                { ...mechanics, indirect: true, selfInflicted: false, keyRemnantsStale: true, openedAt: 1700000000000, endedBy: null });
            const report = await M.liftIncidentMethod();
            const held = S.castStore.persisted("record") ?? {};
            equal(stableJson([held.indirect, held.selfInflicted, held.keyRemnantsStale, held.openedAt, held.endedBy ?? null]),
                stableJson([true, false, false, 1700000000000, null]),
                "the method did not read back from the cast's storage as the world's, or the world's overwrote a reversal a GM wrote since");
            equal(stableJson(game.settings.get(MODULE_ID, SETTINGS.murderState)), stableJson(mechanics), "the world half still holds the method, whose fields read back");
            equal(stableJson(report), stableJson({ lifted: 4, dropped: 1, kept: 0 }), `the lift's report: ${stableJson(report)}`);
            equal(await M.liftIncidentMethod(), null, "a second run of the lift found something to do");

            await game.settings.set(MODULE_ID, SETTINGS.murderState, { indirect: true, openedAt: 1700000000001 });
            const closed = await M.liftIncidentMethod();
            equal(stableJson([closed, game.settings.get(MODULE_ID, SETTINGS.murderState), S.castStore.persisted("record")?.openedAt]),
                stableJson([{ lifted: 0, dropped: 2, kept: 0 }, {}, 1700000000000]), "with no incident running the method did not simply leave the world, or reached the cast");
        });
    }],

    ["the method's lift leaves the world half as it was when the cast's rows do not read back", async () => {
        /*
         * E05 C8, 26.09.2026: the other half of the pair above. The cast's save is swallowed -
         * the fields stand in memory and not on disk - and the world half keeps the whole
         * method: nothing leaves world data the cast cannot read back.
         * Since E05's fix round (r1-G1; the reviews' S1-M1, M2) the lift throws with the count,
         * so the migration does not stamp the world and the next load tries again: it answered a
         * report of what it kept, the runner stamped the world, and no load ever tried again.
         * In a world the stores have never opened; the world setting is put back by tier 2's
         * restore.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const old = { active: true, stage: "resolution", turn: 3, turnSide: "victim", indirect: false, selfInflicted: true, openedAt: 1700000000000, endedBy: "selfInflicted" };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-methodkept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.murderState, old);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.castStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => M.liftIncidentMethod());
                putBack();
                equal(S.castStore.record()?.selfInflicted, true, "the swallowed save left no field in memory either - this measured nothing");
                equal(stableJson([/^4 field\(s\) of the incident's method are still in the world half/.test(threw ?? ""), game.settings.get(MODULE_ID, SETTINGS.murderState)]), stableJson([true, old]),
                    `the world half lost a method whose fields are not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
        }
    }],

    ["the fight's lift moves a running incident's fight into the cast, and out of the world half once it reads back", async () => {
        /*
         * E32 C3, 28.09.2026; the owner's Q1 (a). An incident a 1.2.65 table left running keeps
         * its fight in the world half of `murderState`; the clause `liftIncidentFight` moves the
         * fields with a value into the cast, weak and fill-only, and takes each out of the world
         * half once the cast reads it back from storage; a null leaves with them. In a world the
         * stores have never opened (`withGmStoreWorld`), with a turn a GM passed since the update
         * already in the cast: it stands over the world's. The report counts the ten lifted and
         * the two nulls dropped, and a second run has nothing to do. Then with no incident
         * running the fields leave outright and the cast is not touched. The world setting is
         * put back by tier 2's restore.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const fight = { turn: 2, turnSide: "killer", keyRemnants: 3, deniedToVictim: ["survive"],
            hindered: { victim: { strike: 1 }, killer: {} }, blocked: { victim: {}, killer: { selfDefence: 2 } }, unlocked: ["survive"],
            drainStopped: false, advantageNext: { victim: false, killer: true }, spent: ["finishingBlow"], freeResolution: null, thirdActed: null };
        await E.withGmStoreWorld(`suite-fightlift-${foundry.utils.randomID(8)}`, async () => {
            await S.castStore.patch("record", { turn: 3, turnSide: "victim" });
            await game.settings.set(MODULE_ID, SETTINGS.murderState, { active: true, stage: "incident", ...fight });
            const report = await M.liftIncidentFight();
            const held = S.castStore.persisted("record") ?? {};
            equal(stableJson(S.INCIDENT_FIGHT.map(f => [f, held[f] ?? null])),
                stableJson(S.INCIDENT_FIGHT.map(f => [f, { ...fight, turn: 3, turnSide: "victim" }[f]])),
                "the fight did not read back from the cast's storage as the world's, or the world's overwrote a turn a GM passed since");
            equal(stableJson(game.settings.get(MODULE_ID, SETTINGS.murderState)), stableJson({ active: true, stage: "incident" }),
                "the world half still holds the fight, whose fields read back");
            equal(stableJson(report), stableJson({ lifted: 10, dropped: 2, kept: 0 }), `the lift's report: ${stableJson(report)}`);
            equal(await M.liftIncidentFight(), null, "a second run of the lift found something to do");

            await game.settings.set(MODULE_ID, SETTINGS.murderState, { turn: 5, spent: ["strike"] });
            const closed = await M.liftIncidentFight();
            equal(stableJson([closed, game.settings.get(MODULE_ID, SETTINGS.murderState), S.castStore.persisted("record")?.turn, S.castStore.persisted("record")?.spent]),
                stableJson([{ lifted: 0, dropped: 2, kept: 0 }, {}, 3, ["finishingBlow"]]), "with no incident running the fight did not simply leave the world, or reached the cast");
        });
    }],

    ["the fight's lift leaves the world half as it was when the cast's rows do not read back", async () => {
        /*
         * E32 C3, 28.09.2026: the other half of the pair above, as the method's. The cast's
         * save is swallowed - the fields stand in memory and not on disk - and the world half
         * keeps the whole fight, and the lift throws with the count, so the migration does not
         * stamp the world and the next load tries again. In a world the stores have never
         * opened; the world setting is put back by tier 2's restore.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const old = { active: true, stage: "incident", turn: 2, turnSide: "killer", keyRemnants: 4, spent: [] };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-fightkept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.murderState, old);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.castStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => M.liftIncidentFight());
                putBack();
                equal(S.castStore.record()?.turnSide, "killer", "the swallowed save left no field in memory either - this measured nothing");
                equal(stableJson([/^4 field\(s\) of the incident's fight are still in the world half/.test(threw ?? ""), game.settings.get(MODULE_ID, SETTINGS.murderState)]), stableJson([true, old]),
                    `the world half lost a fight whose fields are not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
        }
    }],

    ["the overflow's lift moves the world's count into the GMs' record, and the world keeps { active } once it reads back", async () => {
        /*
         * E05 C12, 27.09.2026; audit S01-60. A world from before 1.2.64 keeps the overflow's count
         * in the world setting `overflow`, beside the darkening's stamp; the clause
         * `liftOverflowCount` moves a count above zero into the GMs' record, weak and fill-only,
         * and rewrites the world value to `{ active }` once the record reads back from storage
         * holding a count. In a world the stores have never opened (`withGmStoreWorld`): a spill
         * before the lift is counted on top of the world's count (overflow.mjs `state`) into the
         * record, the lift keeps it, the stamp stands, and the report counts the count lifted; a
         * second run has nothing to do. Then a count the record holds stands over the world's
         * (fill-only), and a count of 0 simply leaves. The world setting is put back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const o = await import("./overflow.mjs");
        const before = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
        const armed = { session: 99, day: 9, timeOfDay: "night", effect: "fog" };
        const world = () => game.settings.get(MODULE_ID, SETTINGS.overflow);
        try {
            await E.withGmStoreWorld(`suite-overflowlift-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 7, active: armed });
                await o.addOverflow(1, { reason: "suite" });
                equal(stableJson([o.overflowCount(), S.overflowStore.record().count ?? null]), stableJson([8, 8]),
                    "a spill before the lift was not counted on top of the world's count, into the record");
                const report = await o.liftOverflowCount();
                equal(stableJson([S.overflowStore.persisted("record")?.count ?? null, world(), o.overflowCount()]), stableJson([8, { active: armed }, 8]),
                    "the count did not read back from the record's storage, the world still holds it or lost its stamp, or a GM does not read it");
                equal(stableJson(report), stableJson({ lifted: 1, dropped: 0, kept: 0 }), `the lift's report: ${stableJson(report)}`);
                equal(await o.liftOverflowCount(), null, "a second run of the lift found something to do");

                await S.overflowStore.patch("record", { count: 11 });
                await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 3, active: null });
                await o.liftOverflowCount();
                equal(stableJson([S.overflowStore.persisted("record")?.count ?? null, world()]), stableJson([11, { active: null }]),
                    "the world's count overwrote a count a GM wrote since the update, or stayed in the world");

                await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 0, active: null });
                equal(stableJson([await o.liftOverflowCount(), world()]), stableJson([{ lifted: 0, dropped: 1, kept: 0 }, { active: null }]),
                    "a count of 0 did not simply leave the world");
            });
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.overflow, before);
        }
    }],

    ["the overflow's lift leaves the world's count as it was when the record does not read it back", async () => {
        /*
         * E05 C12, 27.09.2026: the other half of the pair above, as the method's pair does it. The
         * store's save is swallowed - the count stands in memory and not on disk - and the world
         * keeps its value whole: nothing leaves world data that the store cannot read back. The
         * lift throws (E05's fix round r1-G1), so the migration does not stamp the world and the
         * next load tries again. In a world the stores have never opened; the world setting is put
         * back.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const o = await import("./overflow.mjs");
        const before = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
        const old = { count: 7, active: null };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-overflowkept-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.overflow, old);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.overflowStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => o.liftOverflowCount());
                putBack();
                equal(S.overflowStore.record()?.count, 7, "the swallowed save left no count in memory either - this measured nothing");
                equal(stableJson([/^the overflow's count did not read back/.test(threw ?? ""), game.settings.get(MODULE_ID, SETTINGS.overflow)]), stableJson([true, old]),
                    `the world lost a count that is not on disk, or the lift did not throw: ${threw}`);
            });
        } finally {
            putBack();
            await game.settings.set(MODULE_ID, SETTINGS.overflow, before);
        }
    }],

    ["the bullets' lift moves each bullet's trace key out of its flag into its row, and takes the flag off once it reads back", async () => {
        /*
         * E05 C13, 27.09.2026; audit S05-39 (2). A world from before 1.2.64 names each bullet's
         * trace in the bullet's own `remnantRef` flag, which every browser reads; the clause
         * `liftBulletRefs` moves the key into the bullet's row, weak and fill-only, and takes the
         * flag off the item only once the row reads back from storage. Three fixture bullets on
         * one sheet, in a world the stores have never opened (`withGmStoreWorld`): one whose row
         * this browser lost whole, one whose row a GM wrote since with a trace of its own, and one
         * whose flag names no trace (`null`, as every bullet no trace made carried). The first's
         * row reads back from disk holding the flag's key, weak; the second's keeps the GM's; the
         * third is given no row; no item carries the flag after; the report counts two lifted and
         * one dropped; a second run has nothing to do. The items are deleted after.
         */
        needs(world.atLeast("livingStudents", 1), "the fixture bullets are on a student's sheet");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const B = await import("./truth-bullets.mjs");
        const [holder] = cast(1);
        const made = [];
        const bullet = async (name, ref) => {
            const [item] = await holder.createEmbeddedDocuments("Item", [{ name, type: "loot", flags: { [MODULE_ID]: {
                category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "subtle", analyzed: false, remnantRef: ref } } }]);
            ok(item, `could not make the fixture bullet "${name}"`);
            made.push(item);
            return item;
        };
        const flagged = () => made.map(item => Object.hasOwn(holder.items.get(item.id)?.flags?.[MODULE_ID] ?? {}, "remnantRef"));
        try {
            await E.withGmStoreWorld(`suite-refslift-${foundry.utils.randomID(8)}`, async () => {
                const lost = await bullet("SUITE its row lost", "SUITESCENE000001.SUITETOKEN000001");
                const decided = await bullet("SUITE a GM's own trace", "SUITESCENE000001.SUITETOKEN000002");
                const none = await bullet("SUITE made by no trace", null);
                await S.bulletStore.patch(decided.uuid, { realType: "key", sceneId: "SUITESCENE000001", remnantId: "SUITETOKEN000003" });
                equal(stableJson(flagged()), stableJson([true, true, true]), "a fixture bullet does not carry its flag - this measured nothing");
                const report = await B.liftBulletRefs();
                const disk = uuid => {
                    const row = S.bulletStore.persisted(uuid);
                    return row ? [row.sceneId ?? null, row.remnantId ?? null] : null;
                };
                equal(stableJson([disk(lost.uuid), disk(decided.uuid), disk(none.uuid)]),
                    stableJson([["SUITESCENE000001", "SUITETOKEN000001"], ["SUITESCENE000001", "SUITETOKEN000003"], null]),
                    "a key did not read back from the store's storage, the world's overwrote the one a GM wrote since, or a bullet no trace made was given a row");
                equal(S.bulletStore.stampOf(lost.uuid, "remnantId"), S.bulletStore.weak(), "the lifted key was not written weak");
                equal(stableJson(flagged()), stableJson([false, false, false]), "a bullet still names its trace, or a null, in its flags");
                equal(stableJson([report?.lifted, report?.dropped, report?.kept]), stableJson([2, 1, 0]), `the lift's report: ${stableJson(report)}`);
                equal(await B.liftBulletRefs(), null, "a second run of the lift found something to do");
            });
        } finally {
            for (const item of made) {
                try { await holder.items.get(item.id)?.delete(); } catch { /* already gone */ }
            }
        }
    }],

    ["the bullets' lift leaves a bullet's trace key in its flag when the row does not read back", async () => {
        /*
         * E05 C13, 27.09.2026: the other half of the pair above, as the notes' and the overflow's
         * pairs do it. The store's save is swallowed - the row stands in memory and not on disk -
         * and the flag keeps its key: nothing leaves world data that the store cannot read back,
         * and the lift throws with the count (E05 fix r1-G1), so the migration does not stamp the
         * world and the next load tries again. In a world the stores have never opened; the item
         * is deleted after.
         */
        needs(world.atLeast("livingStudents", 1), "the fixture bullet is on a student's sheet");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const B = await import("./truth-bullets.mjs");
        const [holder] = cast(1);
        const ref = "SUITESCENE000001.SUITETOKEN000009";
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        let item = null;
        try {
            await E.withGmStoreWorld(`suite-refskept-${foundry.utils.randomID(8)}`, async () => {
                [item] = await holder.createEmbeddedDocuments("Item", [{ name: "SUITE a kept key", type: "loot", flags: { [MODULE_ID]: {
                    category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "subtle", analyzed: false, remnantRef: ref } } }]);
                ok(item, "could not make the fixture bullet");
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.bulletStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => B.liftBulletRefs());
                putBack();
                ok(S.bulletStore.has(item.uuid), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^1 Truth Bullet\(s\) still name their trace in a flag \(1 /.test(threw ?? ""), holder.items.get(item.id)?.getFlag(MODULE_ID, "remnantRef") ?? null]),
                    stableJson([true, ref]), `the world lost a key whose row is not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            try { await holder.items.get(item?.id)?.delete(); } catch { /* already gone */ }
        }
    }],

    ["the traces' clause gives a found trace's token back the neutral word and the question mark", async () => {
        /*
         * E05 C13, 27.09.2026; audit S05-39 (1). A world from before 1.2.64 holds found traces
         * whose tokens carry their public name and image, which every browser reads; the clause
         * `neutralTraceNames` gives every trace token the neutral word and the question mark back,
         * and a second run has nothing to do. A token that still carries its answer key is the
         * migration's - `migrateRemnantToken` reads its old name as the label - and is left as it
         * is. And when the write does not take, the clause throws with the count, so the world is
         * not stamped. Three fixture tokens, deleted after: a found one, named and dressed; one
         * still carrying its answer key under its old label; and one already neutral. And a fourth,
         * named and dressed as a table's own trace, not handed to the routine: the suite neutralises
         * its fixtures and nothing of the table's (E05 fix r2-G4; reviews S2-m12 = F7 - it was
         * renamed, as every such token of a real table was).
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture tokens stand on the scene on screen");
        const R = await import("./remnants.mjs");
        const scene = canvas.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const word = game.i18n.localize("DRPG.Remnant.tokenName");
        const label = "SUITE Obvious Prep Remnant - Player B";
        const made = [];
        const trace = async (name, src, flags = {}) => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{ name, actorId: game.actors.getName("Remnant")?.id ?? null, actorLink: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: false, texture: { src }, flags: { [MODULE_ID]: { isRemnant: true, ...flags } } }]);
            ok(t, `could not place the fixture token "${name}"`);
            made.push(t);
            return t;
        };
        const face = t => { const d = scene.tokens.get(t.id); return [d?.name ?? null, d?.texture?.src ?? null]; };
        const ownUpdate = Object.hasOwn(scene, "updateEmbeddedDocuments"), realUpdate = scene.updateEmbeddedDocuments;
        const putBack = () => {
            if (scene.updateEmbeddedDocuments === realUpdate && Object.hasOwn(scene, "updateEmbeddedDocuments") === ownUpdate) return;
            if (ownUpdate) scene.updateEmbeddedDocuments = realUpdate;
            else delete scene.updateEmbeddedDocuments;
        };
        try {
            const found = await trace("SUITE a kettle, still warm", "icons/svg/item-bag.svg");
            const labelled = await trace(label, R.ICON, { [R.REMNANT_FLAGS.type]: "prep" });
            ok(R.answerKeyOnToken(labelled), "the fixture is not a token still carrying its answer key");
            const quiet = await trace(word, R.ICON);
            const tables = await trace("SUITE the table's own kettle", "icons/svg/item-bag.svg");
            const tokens = [found, labelled, quiet];
            const report = await R.neutralTraceNames({ tokens });
            equal(stableJson([face(found), face(labelled), face(quiet)]), stableJson([[word, R.ICON], [label, R.ICON], [word, R.ICON]]),
                "a found trace's token still says its name or wears its image, or a token carrying its answer key lost its label before the migration read it");
            equal(stableJson(face(tables)), stableJson(["SUITE the table's own kettle", "icons/svg/item-bag.svg"]),
                "the suite's run of the clause gave a trace it was not handed - a table's - the neutral word");
            equal(report?.neutralised, 1, `the clause's report: ${stableJson(report)}`);
            equal(await R.neutralTraceNames({ tokens }), null, "a second run of the clause found something to do");

            await scene.updateEmbeddedDocuments("Token", [{ _id: found.id, name: "SUITE a kettle again" }]);
            scene.updateEmbeddedDocuments = async () => [];
            const threw = await thrown(() => R.neutralTraceNames({ tokens }));
            putBack();
            equal(stableJson([/^1 trace token\(s\) still show /.test(threw ?? ""), face(found)[0]]), stableJson([true, "SUITE a kettle again"]),
                `the clause did not throw with the count when its write did not take: ${threw}`);
        } finally {
            putBack();
            const left = made.map(t => t.id).filter(id => scene.tokens.has(id));
            if (left.length) await scene.deleteEmbeddedDocuments("Token", left);
            await settle();
        }
    }],

    ["the loot's lift moves each body's lootTrace flag into the GMs' store, and takes the flag off once it reads back", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-39 (3). A world from before 1.2.64 records each looted
         * body's trace in the body's own `lootTrace` flag, which every browser reads; the clause
         * `liftLootTraces` moves the record into the body's row, weak and fill-only, and takes the
         * flag off only once the row reads back from storage. Three students carry a fixture flag,
         * in a world the stores have never opened (`withGmStoreWorld`): one whose row this browser
         * never had, one whose row a loot wrote since (its trace and a longer list), and one whose
         * record names no trace. The first's row reads back from disk holding the flag's record,
         * weak; the second's keeps its own; the third is given no row; no student carries the flag
         * after; the report counts two lifted and one dropped; a second run has nothing to do.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const H = await import("./handover.mjs");
        const fixtures = cast(3);
        const [lost, decided, none] = fixtures;
        const flagged = () => fixtures.map(a => Object.hasOwn(game.actors.get(a.id)?.flags?.[MODULE_ID] ?? {}, "lootTrace"));
        try {
            await E.withGmStoreWorld(`suite-lootlift-${foundry.utils.randomID(8)}`, async () => {
                await lost.setFlag(MODULE_ID, "lootTrace", { sceneId: "SUITESCENE000001", tokenId: "SUITETOKEN000011", taken: ["SUITE a knife"] });
                await decided.setFlag(MODULE_ID, "lootTrace", { sceneId: "SUITESCENE000001", tokenId: "SUITETOKEN000012", taken: ["SUITE a rope"] });
                await none.setFlag(MODULE_ID, "lootTrace", { taken: [] });
                await S.lootTraceStore.patch(decided.id, { sceneId: "SUITESCENE000001", tokenId: "SUITETOKEN000013", taken: ["SUITE a rope", "SUITE a lamp"] });
                equal(stableJson(flagged()), stableJson([true, true, true]), "a fixture body does not carry its flag - this measured nothing");
                const report = await H.liftLootTraces();
                const disk = id => {
                    const row = S.lootTraceStore.persisted(id);
                    return row ? [row.tokenId ?? null, row.taken ?? null] : null;
                };
                equal(stableJson([disk(lost.id), disk(decided.id), disk(none.id)]),
                    stableJson([["SUITETOKEN000011", ["SUITE a knife"]], ["SUITETOKEN000013", ["SUITE a rope", "SUITE a lamp"]], null]),
                    "a record did not read back from the store's storage, the world's overwrote the row a loot wrote since, or a record naming no trace was given a row");
                equal(S.lootTraceStore.stampOf(lost.id, "tokenId"), S.lootTraceStore.weak(), "the lifted record was not written weak");
                equal(stableJson(flagged()), stableJson([false, false, false]), "a body still carries its loot trace in a flag");
                equal(stableJson([report?.lifted, report?.dropped, report?.kept]), stableJson([2, 1, 0]), `the lift's report: ${stableJson(report)}`);
                equal(await H.liftLootTraces(), null, "a second run of the lift found something to do");
            });
        } finally {
            for (const a of fixtures) {
                if (Object.hasOwn(game.actors.get(a.id)?.flags?.[MODULE_ID] ?? {}, "lootTrace")) await a.unsetFlag(MODULE_ID, "lootTrace");
            }
        }
    }],

    ["the loot's lift leaves a body's flag when the row does not read back", async () => {
        /*
         * E05 C14, 27.09.2026: the other half of the pair above, as the bullets' pair does it. The
         * store's save is swallowed - the row stands in memory and not on disk - and the body keeps
         * its flag: nothing leaves world data that the store cannot read back, and the lift throws
         * with the count (E05 fix r1-G1), so the migration does not stamp the world and the next load
         * tries again. In a world the stores have never opened; the flag is taken off after.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const H = await import("./handover.mjs");
        const [body] = cast(1);
        const record = { sceneId: "SUITESCENE000001", tokenId: "SUITETOKEN000019", taken: ["SUITE a kept knife"] };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            await E.withGmStoreWorld(`suite-lootkept-${foundry.utils.randomID(8)}`, async () => {
                await body.setFlag(MODULE_ID, "lootTrace", record);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.lootTraceStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                const threw = await thrown(() => H.liftLootTraces());
                putBack();
                ok(S.lootTraceStore.has(body.id), "the swallowed save left no row in memory either - this measured nothing");
                equal(stableJson([/^1 bod\(ies\) still name their loot trace in a flag \(1 /.test(threw ?? ""), body.getFlag(MODULE_ID, "lootTrace")?.tokenId ?? null]),
                    stableJson([true, record.tokenId]), `the world lost a record whose row is not on disk, or the lift did not throw with the count: ${threw}`);
            });
        } finally {
            putBack();
            if (Object.hasOwn(body.flags?.[MODULE_ID] ?? {}, "lootTrace")) await body.unsetFlag(MODULE_ID, "lootTrace");
        }
    }],

    ["the traces' answer-key clause moves an old trace's flags into the ledger and off its token, and throws while one stays", async () => {
        /*
         * E05 C14, 27.09.2026; audit S05-06, S06-02; the owner's Q5. `migrateRemnants` was a console
         * call, and a world whose GM never typed it kept, on tokens every browser holds, the answer
         * key of each trace from before the ledger and the Faint Prep promotions written until E04.
         * The clause `migrateRemnantsOnce` runs its per-token routine once. Fixture tokens, handed to
         * it (the clause itself takes every trace in the world; the suite does not migrate a table's):
         * a trace from before the ledger - its answer key in its flags, its label as its name, no row;
         * one placed since, carrying a promotion over a row from before the upgrade; and a quiet one.
         * The first gets a row with its type and its label, the second's row reads the promotion, both
         * tokens keep `isRemnant` alone under the neutral word, the quiet one is not touched, and a
         * second run has nothing to do. Then the kept half: the store's save swallowed, a typed token
         * keeps its flags, and the clause throws with the count. The tokens are deleted after. A
         * trace named as a GM names one, not handed, keeps its name: the neutral word the clause
         * gives is its fixtures' alone (E05 fix r2-G4; reviews S2-m12 = F7).
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture traces stand on the scene on screen");
        const R = await import("./remnants.mjs");
        const { remnantStore } = await import("./gm-stores.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const word = game.i18n.localize("DRPG.Remnant.tokenName");
        const label = "SUITE C14 Subtle Prep Remnant - Player B";
        const made = [];
        const trace = async (name, flags) => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{ name, actorId: R.findRemnantActor()?.id ?? null, actorLink: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: true, flags: { [MODULE_ID]: { isRemnant: true, ...flags } } }]);
            ok(t, `could not place the fixture token "${name}"`);
            made.push(t);
            return t;
        };
        const face = t => {
            const d = scene.tokens.get(t.id);
            return [d?.name ?? null, Object.keys(d?._source?.flags?.[MODULE_ID] ?? {}).sort()];
        };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        try {
            const old = await trace(label, { remnantType: "prep", visibility: "subtle", note: "SUITE C14 old note" });
            const promoted = await trace(word, { faint: false, tiedToCrime: true });
            await remnantStore.patch(R.keyOf(promoted), { type: "prep", visibility: "subtle", faint: true, tiedToCrime: false,
                note: "test fixture - a promoted trace" }, { weak: true });
            const quiet = await trace(word, {});
            const tables = await trace("SUITE C14 the table's own trace", {});
            ok(R.answerKeyOnToken(old) && R.remnantData(old) === null, "the first fixture is not a trace from before the ledger - this measures nothing");
            const report = await R.migrateRemnantsOnce({ tokens: [old, promoted, quiet] });
            equal(face(tables)[0], "SUITE C14 the table's own trace", "the suite's run of the clause gave a trace it was not handed - a table's - the neutral word");
            const oldRow = remnantStore.get(R.keyOf(old)), promotedRow = R.remnantData(promoted);
            equal(stableJson([oldRow?.type ?? null, oldRow?.label ?? null, oldRow?.note ?? null, promotedRow?.faint ?? null, promotedRow?.tiedToCrime ?? null]),
                stableJson(["prep", label, "SUITE C14 old note", false, true]),
                "the old trace's answer key and label, or the promotion, did not reach the ledger");
            equal(stableJson([face(old), face(promoted), face(quiet)]), stableJson([[word, ["isRemnant"]], [word, ["isRemnant"]], [word, ["isRemnant"]]]),
                "a token still carries its answer key or its old label, or the quiet one was touched");
            equal(stableJson([report?.moved, report?.filled, report?.carried]), stableJson([1, 1, 1]), `the clause's report: ${stableJson(report)}`);
            equal(await R.migrateRemnantsOnce({ tokens: [old, promoted, quiet] }), null, "a second run of the clause found something to do");

            const kept = await trace("SUITE C14 Evident Key Remnant", { remnantType: "key", visibility: "evident" });
            settings.set = async function (namespace, key, value) {
                if (namespace === MODULE_ID && key === remnantStore.spec.key) return value;
                return realSet.call(this, namespace, key, value);
            };
            const threw = await thrown(() => R.migrateRemnantsOnce({ tokens: [kept] }));
            putBack();
            equal(stableJson([/^1 trace token\(s\) still carry their answer key /.test(threw ?? ""), R.answerKeyOnToken(scene.tokens.get(kept.id))]),
                stableJson([true, true]), `a token lost its answer key with no row on disk, or the clause did not throw with the count: ${threw}`);
        } finally {
            putBack();
            for (const t of made) {
                try { await R.dropRemnantSecret(t); } catch { /* nothing filed */ }
            }
            const left = made.map(t => t.id).filter(id => scene.tokens.has(id));
            if (left.length) await scene.deleteEmbeddedDocuments("Token", left);
            await settle();
        }
    }],

    ["the answer-key clause's two keeps stay on their tokens, and the GM is told - a notification that stays and a row of the health check", async () => {
        /*
         * E05 fix r2-G4, 27.09.2026; review S2-m3. `migrateRemnantsOnce` keeps two things on
         * their tokens on purpose - a Faint Prep promotion a later correction stood against, and
         * flags with no type and no row to carry them into - and stamps the world over them. Both
         * say which trace a GM judged the murder's, on tokens every browser holds; they were named
         * in the console alone, and the health check, which read only `remnantType`, counted
         * neither. One fixture of each, handed to the clause: it does not throw, and the GM gets a
         * notification that stays and a health row with both (red on 40ac88d: no notification, no
         * row). The promotion is made as the E04 test makes it: a row from before the upgrade, and
         * another GM's correction of `faint` arriving as a sync does. Deleted after.
         */
        needs(world.atLeast("sceneOnScreen"), "the fixture traces stand on the scene on screen");
        const R = await import("./remnants.mjs");
        const S = await import("./gm-stores.mjs");
        const E = await import("./gm-store.mjs");
        const { plural } = await import("./utils.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const made = [];
        const trace = async flags => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{ name: game.i18n.localize("DRPG.Remnant.tokenName"),
                actorId: R.findRemnantActor()?.id ?? null, actorLink: false, x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: true,
                flags: { [MODULE_ID]: { isRemnant: true, ...flags } } }]);
            ok(t, "could not place a fixture trace");
            made.push(t);
            return t;
        };
        const notes = ui.notifications;
        const ownWarn = Object.hasOwn(notes, "warn"), realWarn = notes.warn;
        const putBack = () => {
            if (ownWarn) notes.warn = realWarn;
            else delete notes.warn;
        };
        const seen = [];
        try {
            const before = (await S.gmStoreHealth()).counts.traces;
            const promoted = await trace({});
            const key = R.keyOf(promoted);
            await S.remnantStore.patch(key, { type: "prep", visibility: "subtle", faint: true, tiedToCrime: false,
                note: "test fixture - a promotion and a later correction" }, { weak: true });
            const theirs = E.emptySection();
            E.writeFields(theirs, key, { faint: true }, E.gmStoreStamp(), S.remnantStore.spec);
            await S.remnantStore.mergeIn(theirs, { source: "sync" });
            await promoted.update({ [`flags.${MODULE_ID}.faint`]: false, [`flags.${MODULE_ID}.tiedToCrime`]: true });
            const bare = await trace({ faint: false });
            ok(!R.answerKeyOnToken(bare) && R.remnantData(bare) === null, "the second fixture is not flags with no type and no row - this measures nothing");

            notes.warn = (text, options) => { seen.push([String(text), options?.permanent === true]); return null; };
            const report = await R.migrateRemnantsOnce({ tokens: [promoted, bare] });
            putBack();
            equal(stableJson([report?.notCarried, report?.noRow]), stableJson([1, 1]), `the clause's report: ${stableJson(report)}`);
            const onToken = t => Object.keys(scene.tokens.get(t.id)?._source?.flags?.[MODULE_ID] ?? {}).sort();
            equal(stableJson([onToken(promoted), onToken(bare)]), stableJson([["faint", "isRemnant"], ["faint", "isRemnant"]]),
                "a keep did not stay on its token as the promotion's or the flags' only record - this measures nothing");
            equal(stableJson(seen), stableJson([[plural("DRPG.Remnant.keptOnTokens", { n: 2 }), true]]),
                "the GM was not told of the two keeps by a notification that stays, with their count");
            const health = await S.gmStoreHealth();
            equal((health.counts.traces.kept ?? 0) - (before.kept ?? 0), 2, `the health check does not count both keeps: ${stableJson({ before, after: health.counts.traces })}`);
            ok(health.rows.some(r => r.id === "tracesKept" && r.level === "conflict"), "no row of the health check says a trace keeps flags of its answer key");
        } finally {
            putBack();
            for (const t of made) {
                try { await R.dropRemnantSecret(t); } catch { /* nothing filed */ }
            }
            const left = made.map(t => t.id).filter(id => scene.tokens.has(id));
            if (left.length) await scene.deleteEmbeddedDocuments("Token", left);
            await settle();
        }
    }],

    ["a lift that leaves its secret in world data stops the migration short on the GM's screen, and the next pass lifts it - on a world stamped 1.2.63 too", async () => {
        /*
         * E05 fix r1-G1, 27.09.2026; the reviews' S1-M1 and M2, and the orchestrator's note on
         * E04's lifts. A lift whose rows did not read back answered a report of what it kept,
         * and the runner stamped the world: no load ran it again (the security review's scratch
         * scenario measured it on liftKeyPlan, 26.09). The lift throws now: the runner writes no
         * stamp and says so on the GM's screen in a notice that stays, naming the clause, and
         * the next pass lifts. E04's fog lift is the one run here, because it is also the second
         * chance: its `since` is 1.2.64, so a world 1.2.63 stamped over a ledger its lift kept
         * runs it again - as it does the names' lift and, since E05's second fix round (r2-F0b),
         * the Faint's pass, which a world stamped 1.2.63 is read below to owe.
         *
         * THE STAMP IS 1.2.63.5, AND WHY. The runner does nothing when the stamp is the
         * installed version, and this tree is 1.2.63 until the release commit, so a stamp of
         * 1.2.63 would measure nothing here. Every clause reads 1.2.63.5 as it reads 1.2.63 -
         * checked first, through `migrationStatus`, which asks each `since` the runner's
         * question - so the pass is the one a world stamped 1.2.63 gets under 1.2.64.
         *
         * Only this clause runs (`only`): the runner over a fixture's ledger, in a world the
         * stores have never opened - not every clause over the world the suite is run in. The
         * stamp and the ledger are put back.
         */
        const G = await import("./migrate.mjs");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const { moduleVersion } = await import("./config.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fog's old ledger is kept for a scene of this world");
        const sceneId = (game.scenes.active ?? canvas?.scene)?.id;
        const [student] = cast(1);
        const stampBefore = getSetting(SETTINGS.migratedVersion);
        const fogBefore = foundry.utils.deepClone(getSetting(SETTINGS.discoveredRooms) ?? {});
        const owed = async stamp => {
            await game.settings.set(MODULE_ID, SETTINGS.migratedVersion, stamp);
            return G.migrationStatus().clauses.filter(c => c.pending).map(c => c.key);
        };
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        const notices = ui.notifications, realError = notices.error;
        const said = [];
        try {
            const at63 = await owed("1.2.63");
            equal(stableJson(await owed("1.2.63.5")), stableJson(at63),
                "a stamp of 1.2.63.5 does not owe what a stamp of 1.2.63 owes - the pass below does not stand for a world 1.2.63 stamped");
            // E04's three: the names and the fog since r1-G1, the Faint's pass since r2-F0b.
            ok(["liftDiscoveryLedger", "liftIncidentSecrets", "faintIntoSecrets"].every(key => at63.includes(key)),
                `a world stamped 1.2.63 is not given E04's three lifts again: it owes ${at63.join(", ")}`);
            const oldFog = { [sceneId]: { [student.id]: ["SUITE retried room"] } };
            await E.withGmStoreWorld(`suite-liftretry-${foundry.utils.randomID(8)}`, async () => {
                await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, oldFog);
                settings.set = async function (namespace, key, value) {
                    if (namespace === MODULE_ID && key === S.discoveryStore.spec.key) return value;
                    return realSet.call(this, namespace, key, value);
                };
                notices.error = (text, options) => {
                    said.push({ text: String(text), permanent: options?.permanent === true });
                    return null;
                };
                const first = await G.migrate1_2_0({ quiet: true, only: ["liftDiscoveryLedger"] });
                putBack();
                notices.error = realError;
                equal(stableJson([first?.failed ?? null, getSetting(SETTINGS.migratedVersion), getSetting(SETTINGS.discoveredRooms)]),
                    stableJson([["liftDiscoveryLedger"], "1.2.63.5", oldFog]),
                    `the pass whose lift kept its row stamped the world, did not name the clause, or emptied the ledger: ${stableJson(first)}`);
                ok(said.some(n => n.text.includes("liftDiscoveryLedger") && n.permanent),
                    `the GM was not told on screen, naming the clause, in a notice that stays: ${stableJson(said)}`);

                // The next load: a new page reads the store from its storage, which holds no row. The
                // engine drops what it holds in memory as a raw write of its key makes it (the suite's
                // restore does the same); without this the row the swallowed save kept in memory
                // stands, the fill-only lift writes nothing, and nothing is saved (measured, 27.09).
                await game.settings.set(MODULE_ID, S.discoveryStore.spec.key, game.settings.get(MODULE_ID, S.discoveryStore.spec.key));
                const second = await G.migrate1_2_0({ quiet: true, only: ["liftDiscoveryLedger"] });
                // fog.mjs `cellKey`: the scene and the character.
                const row = S.discoveryStore.persisted(`${sceneId}/${student.id}`) ?? {};
                equal(stableJson([second?.failed ?? null, second?.clauses?.liftDiscoveryLedger?.lifted ?? null, getSetting(SETTINGS.migratedVersion),
                    getSetting(SETTINGS.discoveredRooms), Object.hasOwn(row, "SUITE retried room")]),
                stableJson([[], 1, moduleVersion(), {}, true]),
                `the next pass did not lift the ledger into the store and stamp the world: ${stableJson(second)}`);
            });
        } finally {
            putBack();
            notices.error = realError;
            await game.settings.set(MODULE_ID, SETTINGS.migratedVersion, stampBefore);
            await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, fogBefore);
        }
    }],

    ["a lift writes a world setting back as another GM left it during the store's save, not as it read it before", async () => {
        /*
         * E05 fix r1-G1, 27.09.2026; the correctness review's M9. Three lifts read a world
         * setting, awaited their store's save and wrote the setting back from the copy read
         * before it - liftProjectSecrets (projectMeta), liftIncidentMethod and E04's
         * liftIncidentSecrets (murderState, the same shape): a write another GM made during
         * that await, a project's room or a turn passed, was put back on every browser. Each
         * runs here over a fixture in a world the stores have never opened, with the other GM's
         * write made at the moment the store saves (its save goes through after it): the lift's
         * own write comes after the other GM's, which stands, and the secret fields are gone.
         * The old key nothing but its lift writes (`legacyPendingMurders`, `legacyEclipseMoves`)
         * has no such race. projectMeta is put back here, murderState and overflow by tier 2's
         * restore. E05 C12's liftOverflowCount follows the rule from its first line: a darkening
         * another GM armed during the record's save stands, and the count is gone. E32 C3's
         * liftIncidentFight shares the method's body (`liftIntoCast`): a stage another GM moved
         * and a turn it passed during the cast's save stand, and the fight is gone.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const P = await import("./projects.mjs");
        const M = await import("./murder.mjs");
        const [one, two] = cast(2);
        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        const settings = game.settings;
        const ownSet = Object.hasOwn(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (settings.set === realSet && Object.hasOwn(settings, "set") === ownSet) return;
            if (ownSet) settings.set = realSet;
            else delete settings.set;
        };
        // At the store's first save, the other GM writes the world setting; the lift's own writes of it are counted.
        let order = [];
        const race = (storeKey, worldKey, otherGm) => {
            order = [];
            settings.set = async function (namespace, key, value) {
                if (namespace === MODULE_ID && key === storeKey && !order.includes("other GM")) {
                    order.push("other GM");
                    await otherGm();
                } else if (namespace === MODULE_ID && key === worldKey) order.push("lift");
                return realSet.call(this, namespace, key, value);
            };
        };
        const murderNow = () => foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {});
        try {
            await E.withGmStoreWorld(`suite-liftrace-${foundry.utils.randomID(8)}`, async () => {
                const ID = "SUITEE05LIFTRACE";
                await game.settings.set(MODULE_ID, SETTINGS.projectMeta, { ...before, [ID]: { room: "SUITE room before", indirectMurder: true, secret: true,
                    killerId: one.id, by: one.id, condition: "SUITE race condition", trigger: { kind: "enters", armed: true, firedAt: null } } });
                race(S.projectSecretStore.spec.key, SETTINGS.projectMeta, () => {
                    const now = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
                    now[ID] = { ...now[ID], room: "SUITE room another GM chose" };
                    return realSet.call(settings, MODULE_ID, SETTINGS.projectMeta, now);
                });
                await P.liftProjectSecrets();
                putBack();
                equal(stableJson([order, P.metaFor(ID)]), stableJson([["other GM", "lift"], { room: "SUITE room another GM chose", indirectMurder: true, secret: true }]),
                    "liftProjectSecrets put back a projectMeta another GM wrote during the store's save, or kept a secret field");

                await game.settings.set(MODULE_ID, SETTINGS.murderState,
                    { active: true, stage: "incident", turn: 2, turnSide: "killer", indirect: true, openedAt: 1700000000000 });
                race(S.castStore.spec.key, SETTINGS.murderState,
                    () => realSet.call(settings, MODULE_ID, SETTINGS.murderState, { ...murderNow(), turn: 3, turnSide: "victim" }));
                await M.liftIncidentMethod();
                putBack();
                equal(stableJson([order, murderNow()]), stableJson([["other GM", "lift"], { active: true, stage: "incident", turn: 3, turnSide: "victim" }]),
                    "liftIncidentMethod put back a turn another GM passed during the cast's save, or kept the method");

                await game.settings.set(MODULE_ID, SETTINGS.murderState,
                    { active: true, stage: "incident", turn: 1, turnSide: "victim", killerId: one.id, victimId: two.id });
                race(S.castStore.spec.key, SETTINGS.murderState,
                    () => realSet.call(settings, MODULE_ID, SETTINGS.murderState, { ...murderNow(), turn: 2, turnSide: "killer" }));
                await M.liftIncidentSecrets();
                putBack();
                equal(stableJson([order, murderNow()]), stableJson([["other GM", "lift"], { active: true, stage: "incident", turn: 2, turnSide: "killer" }]),
                    "liftIncidentSecrets put back a turn another GM passed during the cast's save, or kept a name");

                const O = await import("./overflow.mjs");
                const overflowNow = () => foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
                const armed = { session: 99, day: 9, timeOfDay: "night", effect: "fog" };
                await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 5, active: null });
                race(S.overflowStore.spec.key, SETTINGS.overflow,
                    () => realSet.call(settings, MODULE_ID, SETTINGS.overflow, { ...overflowNow(), active: armed }));
                await O.liftOverflowCount();
                putBack();
                equal(stableJson([order, overflowNow()]), stableJson([["other GM", "lift"], { active: armed }]),
                    "liftOverflowCount put back an overflow another GM armed during the record's save, or kept the count");

                /* E32 C3: at the cast's save the other GM passes the turn - into the cast, at a stamp of its
                   own, as every write of the fight goes since 1.2.66 - and moves the stage, writing the world
                   half as it read it, the fight a 1.2.65 table left there included. */
                await game.settings.set(MODULE_ID, SETTINGS.murderState, { active: true, stage: "incident", turn: 2, turnSide: "killer", keyRemnants: 4 });
                race(S.castStore.spec.key, SETTINGS.murderState, () => {
                    void S.castStore.patch("record", { turn: 3, turnSide: "victim" });
                    return realSet.call(settings, MODULE_ID, SETTINGS.murderState, { ...murderNow(), stage: "resolution" });
                });
                await M.liftIncidentFight();
                putBack();
                await S.castStore.idle();
                const castFight = S.castStore.persisted("record") ?? {};
                equal(stableJson([order, murderNow(), [castFight.turn, castFight.turnSide, castFight.keyRemnants]]),
                    stableJson([["other GM", "lift"], { active: true, stage: "resolution" }, [3, "victim", 4]]),
                    "liftIncidentFight put back a stage another GM moved during the cast's save, lost the turn it passed, or kept the fight");
            });
        } finally {
            putBack();
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
        }
    }],

    ["a trap a world half still holds is a trap to every reader until the lift reaches it", async () => {
        /*
         * E05 fix r1-G1, 27.09.2026; the correctness review's M2. An incident opened under
         * 1.2.63 holds `indirect` in the world half of murderState and none in its cast until
         * `liftIncidentMethod` lifts it - the first load of 1.2.64, or later when the lift keeps
         * failing and retries. `castOwners` read the world half there; `incidentWitness` and the
         * opening Event card read the cast alone and took the trap for a direct murder. One
         * rule now (settings.mjs `incidentIndirect`, R194): the cast's, and the world half's
         * where the cast has none. With this GM in the trap's killer's chair, over a cast with
         * no `indirect` in a world the stores have never opened: the incident reads as a trap
         * and the killer holds no seat; a cast that says "direct" is believed over the world
         * half; the rule on its four cases. The chair is put back; murderState by tier 2's
         * restore.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const { incidentWitness, incidentIndirect } = await import("./settings.mjs");
        const [killer, victim] = cast(2);
        const assignedBefore = game.user.character ?? null;
        try {
            await game.user.update({ character: killer.id });
            await E.withGmStoreWorld(`suite-trapwindow-${foundry.utils.randomID(8)}`, async () => {
                await S.castStore.patch("record", { killerId: killer.id, victimId: victim.id, thirdId: null });
                await game.settings.set(MODULE_ID, SETTINGS.murderState, { active: true, stage: "incident", turn: 1, turnSide: "victim", indirect: true });
                ok(!Object.hasOwn(S.castStore.record() ?? {}, "indirect"), "the cast holds indirect - this measured nothing");
                const lifting = incidentWitness();
                equal(stableJson([lifting.running, lifting.indirect, lifting.seat]), stableJson([true, true, null]),
                    `a trap still in the world half reads as a direct murder, or its killer holds a seat: ${stableJson(lifting)}`);
                await S.castStore.patch("record", { indirect: false });
                const told = incidentWitness();
                equal(stableJson([told.indirect, told.seat]), stableJson([false, killer.id]), `the world half's trap beat the cast's "direct": ${stableJson(told)}`);
            });
            equal(stableJson([
                incidentIndirect({ indirect: true }, {}), incidentIndirect({ indirect: false }, { indirect: true }),
                incidentIndirect({}, { indirect: true }), incidentIndirect({}, {})
            ]), stableJson([true, false, true, false]), "the rule is not the cast's, and the world half's where the cast has none");
        } finally {
            await game.user.update({ character: assignedBefore?.id ?? null });
        }
    }],

    ["a changed old store is reported, and taking it never overwrites what changed since the upgrade", async () => {
        /*
         * E04, 26.09.2026; the design's H1. After the upgrade the old keys are frozen,
         * but a GM who goes back to a 1.2.x build writes them again - whole rows, with a
         * fresh `updated`. Nothing takes that back on its own: the store says the old key
         * changed, and a GM asks for what changed. What is taken: a row the store never
         * had, a field the store has not touched since the upgrade, an old tombstone; what
         * is not: a field a GM wrote since the upgrade (listed as a conflict and kept),
         * and a row the downgrade dropped (listed, kept). "Since the upgrade" is the
         * world's mark, not this browser's claim (the review's DS-m6): another GM's
         * correction written before this browser claimed stands too. Stood in a world
         * this browser has never opened, the old key a fixture (`withGmStoreLegacy`,
         * changed mid-test as a downgrade writes it): no real old key is written.
         */
        const E = await import("./gm-store.mjs");
        const { bulletStore, upgradeMark } = await import("./gm-stores.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const [student] = cast(1);
        const at = id => `Actor.${student.id}.Item.${id}`;
        const T = Date.now() - 60 * 60 * 1000;
        const raw = () => game.settings.storage.get("client").getItem(`${MODULE_ID}.${SETTINGS.legacyTruthBulletSecrets}`);
        const real = raw();
        ok(upgradeMark() !== null, "this world has no upgrade mark: the stores never wrote one");
        const legacy = { [SETTINGS.legacyTruthBulletSecrets]: {
            [at("SUITEE04H1A")]: { realType: "prep", gmNote: "as upgraded", updated: T },
            [at("SUITEE04H1B")]: { realType: "evident", updated: T },
            [at("SUITEE04H1D")]: { realType: "key", updated: T },
            [at("SUITEE04H1E")]: { realType: "prep", updated: T }
        } };
        await E.withGmStoreLegacy(legacy, () => E.withGmStoreWorld(`suite-reclaim-${foundry.utils.randomID(8)}`, async () => {
            // Another GM's correction, written since the upgrade and before this browser claimed, as a sync brings it.
            const theirs = E.emptySection();
            E.writeFields(theirs, at("SUITEE04H1E"), { realType: "key" }, E.gmStoreStamp(), bulletStore.spec);
            await bulletStore.mergeIn(theirs, { source: "sync" });
            await bulletStore.claim();
            ok(!bulletStore.legacyChanged(), "the old key reads as changed right after the claim");
            await bullets.setSecret(at("SUITEE04H1A"), { gmNote: "written since the upgrade" });
            const later = Date.now() + 1000;
            legacy[SETTINGS.legacyTruthBulletSecrets] = {
                [at("SUITEE04H1A")]: { realType: "tamper", gmNote: "written by 1.2.62", updated: later },
                [at("SUITEE04H1B")]: { deleted: true, updated: later },
                [at("SUITEE04H1C")]: { realType: "final", updated: later },
                [at("SUITEE04H1E")]: { realType: "stale", updated: later }
            };
            ok(bulletStore.legacyChanged(), "a downgrade's write of the old key was not seen");
            const report = await bulletStore.reclaim();
            equal(stableJson({ added: report.added, taken: report.taken, conflicts: report.conflicts, missing: report.missing, tombstones: report.tombstones }),
                stableJson({ added: [at("SUITEE04H1C")], taken: [at("SUITEE04H1A")],
                    conflicts: [{ key: at("SUITEE04H1A"), field: "gmNote" }, { key: at("SUITEE04H1E"), field: "realType" }],
                    missing: [at("SUITEE04H1D")], tombstones: 1 }), "what was taken, kept and listed");
            const a = bullets.secretOf(at("SUITEE04H1A"));
            equal(stableJson([a.realType, a.gmNote]), stableJson(["tamper", "written since the upgrade"]),
                "an untouched field was not taken, or a field written since the upgrade was overwritten");
            equal(bullets.secretOf(at("SUITEE04H1E")).realType, "key",
                "another GM's correction, made before this browser claimed, was overwritten by the downgrade's stale field");
            equal(stableJson([bullets.secretOf(at("SUITEE04H1B")).realType ?? null, bullets.secretOf(at("SUITEE04H1C")).realType,
                bullets.secretOf(at("SUITEE04H1D")).realType]), stableJson([null, "final", "key"]),
                "the old tombstone, the new row or the row the downgrade dropped came out wrong");
            ok(!bulletStore.legacyChanged(), "after taking what changed, the old key still reads as changed");
        }));
        equal(raw(), real, "taking what changed wrote the real old key");
    }],

    ["a clear in another world leaves this world's traces", async () => {
        /*
         * E04, 26.09.2026; audit S05-10. The trace ledger was one object for every world
         * a GM browser had opened, and the season reset's clear tombstoned every key in
         * it: another world on the same server lost its traces on that browser, and on
         * every GM of that world at their next exchange. Each world is a section of the
         * store now, and a clear cuts its own. Stood in a world this browser has never
         * opened (the stores' suite override), a row is written there and the ledger
         * cleared: this world's section, and every row of it as stored, must be what
         * they were; the other world holds nothing but its cut.
         */
        const E = await import("./gm-store.mjs");
        const { remnantStore } = await import("./gm-stores.mjs");
        const remnants = await import("./remnants.mjs");
        await E.gmStoresIdle();
        const section = () => stableJson(remnantStore.section());
        const stored = () => stableJson(Object.keys(remnantStore.entries()).sort().map(k => [k, remnantStore.persisted(k)]));
        const before = { section: section(), stored: stored() };
        const key = "SUITEOTHERSCENE.SUITEOTHERTOKEN";
        let cleared = null, there = null, thereStored = "unread";
        await E.withGmStoreWorld(`suite-other-${foundry.utils.randomID(8)}`, async () => {
            await remnantStore.patch(key, { type: "key", note: "test fixture - another world's trace" });
            ok(remnantStore.has(key), "the other world's row was not written");
            cleared = await remnants.clearRemnantLedger();
            await E.gmStoresIdle();
            there = remnantStore.section();
            thereStored = remnantStore.persisted(key);
        });
        equal(cleared, 1, "the clear did not count the other world's one row");
        equal(section(), before.section, "a clear in another world changed this world's section");
        equal(stored(), before.stored, "a clear in another world changed this world's rows as stored");
        equal(stableJson({ e: there?.e, t: there?.t, d: there?.d }), stableJson({ e: {}, t: {}, d: {} }),
            "the other world kept a row, a stamp or a tombstone after its clear");
        ok(there?.cleared > 0, "the other world's section holds no cut");
        equal(thereStored, null, "the other world's row is still stored");
    }],

    ["tieChapterTraces over 20 traces is one write", async () => {
        /*
         * E04, 26.09.2026. A victim's death ties every trace of the chapter, and each
         * tie wrote the whole ledger - and from E04 would have flushed the store and sent
         * every other GM a packet - once per trace: dozens by the third chapter. It is
         * one batched write now (`setRemnantFlagsMany`). Twenty traces placed in a
         * chapter well above the clock, so no trace the world holds is among them; the
         * ledger's writes are counted by `clientSettingChanged` while the chapter is tied.
         */
        const remnants = await import("./remnants.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture traces are placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const chapter = (getClock()?.chapter ?? 1) + 7;
        const placed = [];
        let writes = 0;
        const count = key => { if (key === `${MODULE_ID}.${SETTINGS.remnantSecrets}`) writes++; };
        try {
            for (let i = 0; i < 20; i++) {
                const token = await remnants.placeRemnant({ type: "prep", visibility: "evident", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                    chapter, day: 1, timeOfDay: "morning", tiedToCrime: false, note: `test fixture - tied with the chapter ${i}` });
                ok(token, "could not place a fixture trace");
                placed.push(token);
            }
            await settle();
            Hooks.on("clientSettingChanged", count);
            const tied = await remnants.tieChapterTraces(chapter);
            await settle();
            Hooks.off("clientSettingChanged", count);
            equal(tied, 20, "the chapter's twenty traces were not all tied");
            ok(placed.every(token => remnants.remnantData(token)?.tiedToCrime === true), "a trace of the chapter is not tied in its row");
            ok(writes >= 1 && writes <= 2, `tying twenty traces wrote the ledger ${writes} time(s)`);
        } finally {
            Hooks.off("clientSettingChanged", count);
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(token => token.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }],

    ["Fill from their traces gives a bullet its trace's type, and nothing a GM wrote", async () => {
        /*
         * E04, 26.09.2026; the design's 6.3. A browser that lost a bullet's answer key
         * (or holds one S05-01 reduced to its Faint) can take the real type back from
         * the trace the bullet was copied from: the bullet's row names the trace, and
         * the trace's row says what it is. Weak and fill-only: a type a GM holds for a
         * bullet stays, and nothing but `realType` is made up. Until E05 C13 the trace
         * was named by the bullet's public `remnantRef` flag, which every browser read;
         * the clause `liftBulletRefs` puts an older world's key into the row - a row
         * lost whole comes back as the key alone - and the fixtures stand as it leaves
         * them. Four bullets on one trace: one whose row is the key alone, one with the
         * key and a Faint and no type, one whose GM wrote a type of its own, and one with
         * no row at all, which names no trace here any more and is not filled.
         */
        const S = await import("./gm-stores.mjs");
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture trace is placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const [holder] = cast(1);
        const made = [];
        let token = null;
        try {
            token = await remnants.placeRemnant({ type: "incident", visibility: "subtle", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                tiedToCrime: false, note: "test fixture - a trace to fill from" });
            ok(token, "could not place the fixture trace");
            const trace = { sceneId: scene.id, remnantId: token.id };
            const bullet = async name => {
                const [item] = await holder.createEmbeddedDocuments("Item", [{ name, type: "loot", flags: { [MODULE_ID]: {
                    category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "subtle", analyzed: false } } }]);
                ok(item, `could not make the fixture bullet "${name}"`);
                made.push(item);
                return item;
            };
            const lost = await bullet("Suite fixture: its answer key lost");
            const faintOnly = await bullet("Suite fixture: its answer key reduced to a Faint");
            const decided = await bullet("Suite fixture: its GM's own type");
            const gone = await bullet("Suite fixture: its row lost whole, since 1.2.64");
            // The key alone, as the lift leaves a row it had to start: weak and fill-only.
            await bullets.setSecret(lost.uuid, trace, { weak: true, fillOnly: true });
            await bullets.setSecret(faintOnly.uuid, { faint: true });
            await bullets.setSecret(faintOnly.uuid, trace, { weak: true, fillOnly: true });
            await bullets.setSecret(decided.uuid, { realType: "key", gmNote: "the GM's own", ...trace });
            const report = await S.gmStoreHealth();
            ok(report.counts.bullets.fillable >= 2, `the health report counts ${report.counts.bullets.fillable} bullet(s) to fill, of the two made`);
            const filled = await S.fillBulletsFromTraces();
            ok(filled >= 2, `${filled} bullet(s) filled, of the two made`);
            equal(stableJson([bullets.secretOf(lost.uuid).realType, bullets.secretOf(lost.uuid).remnantId]), stableJson(["incident", token.id]),
                "a bullet whose row is its trace's key alone did not take its trace's type, or lost the key");
            equal(stableJson([bullets.secretOf(faintOnly.uuid).realType, bullets.secretOf(faintOnly.uuid).faint]), stableJson(["incident", true]),
                "a bullet with a row and no type did not take its trace's type, or lost what its row held");
            equal(stableJson([bullets.secretOf(decided.uuid).realType, bullets.secretOf(decided.uuid).gmNote]), stableJson(["key", "the GM's own"]),
                "a type a GM wrote was filled over");
            equal(bullets.secretOf(gone.uuid).realType ?? null, null, "a bullet with no row was given a type - from what, with no key to its trace");
            equal(S.bulletStore.stampOf(lost.uuid, "realType"), S.bulletStore.weak(), "the filled type was not written weak");
        } finally {
            for (const item of made) {
                await bullets.dropSecret(item.uuid);
                await item.actor?.items?.get(item.id)?.delete();
            }
            if (token) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) await token.delete();
            }
        }
    }],

    ["a cleared Mastermind in the old store is put to the primary GM, never applied", async () => {
        /*
         * E04, 26.09.2026; the design's H4. The old Mastermind entry named no world, and a
         * cleared one - `{ actorId: null, updated }` - says only that a GM cleared the pick
         * somewhere, some time. Applied, it would end this world's season on the upgrade
         * day if the clear was another world's. So it is carried as a note: the record's
         * `legacyClearedAt`, at the old entry's own stamp, which travels to every GM (the
         * review's M1: kept aside on one browser, it was put to nobody when that browser
         * was not the primary's) and is read by nothing as a pick. Once the store holds a
         * pick made before it, the health report says so, as a decision for the primary
         * GM, and no player is told the part; a Keep (the pick stamped again) takes the
         * row away. Stood in a world this browser has never opened, the old key a fixture
         * (`withGmStoreLegacy`): no real old key is written.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const mastermind = await import("./mastermind.mjs");
        const [student] = cast(1);
        const T = Date.now() - 60 * 60 * 1000;
        const legacy = { [SETTINGS.legacyMastermind]: { actorId: null, room: null, updated: T } };
        await E.withGmStoreLegacy(legacy, () => E.withGmStoreWorld(`suite-cleared-${foundry.utils.randomID(8)}`, async () => {
            const census = await S.mastermindStore.claim();
            equal(stableJson(census), stableJson({ legacy: 1, claimed: 1, left: 0, tombstones: 0, reasons: {} }),
                "the cleared entry was not carried as one claimed row");
            equal(stableJson([S.mastermindStore.record().legacyClearedAt, S.mastermindStore.stampOf("record", "legacyClearedAt")]),
                stableJson([T, T]), "the clear's time was not carried in the record at its own stamp");
            ok(Object.hasOwn(S.mastermindStore.section().e.record ?? {}, "legacyClearedAt"), "the clear's note is not in what travels to the other GMs");
            equal(mastermind.mastermindActor(), null, "a pick came out of a cleared entry");
            equal(S.mastermindUndecided(), null, "a clear with no pick is put to a GM");
            // A pick another GM made before that clear, as a sync brings it.
            const theirs = E.emptySection();
            E.writeFields(theirs, "record", { actorId: student.id, room: null }, T - 60 * 1000, S.mastermindStore.spec, { whole: true });
            await S.mastermindStore.mergeIn(theirs, { source: "sync" });
            equal(S.mastermindUndecided()?.pick, student.id, "a pick older than the clear is not undecided");
            const row = (await S.gmStoreHealth()).rows.find(r => r.id === "mastermindCleared");
            equal(row?.level, "conflict", "a pick older than the old store's clear is not reported for a GM to decide");
            ok(row && game.i18n.format(row.key, row.data).includes(student.name), "the decision does not name the pick it is about");
            await S.mastermindStore.patch("record", { actorId: student.id });
            ok(!(await S.gmStoreHealth()).rows.some(r => r.id === "mastermindCleared"), "after the pick was kept (stamped again) the row is still there");
            equal(S.mastermindUndecided(), null, "after the pick was kept it is still undecided");
        }));
    }],

    ["a GM that never saw the incident closes it clean", async () => {
        /*
         * E04, 26.09.2026; audit S04-24. The cast was one entry and the newest whole
         * entry won: a GM that never saw an incident could close it, and a GM that
         * missed the close sent the old incident back at the next exchange - its
         * receipt, its swing memo, its killer. The cast is a record now: the close
         * stamps every field but the betrayal offer (D18), and the next incident
         * stamps every name it decides whether or not this GM held the old one. Here
         * another GM's copy of an incident this browser never saw arrives as a sync
         * does, stamped before the close this browser then makes (a fresh stamp: one an
         * hour old lost to the closes earlier tests made, measured on the first C6 run);
         * the old copy arriving again changes nothing; and a copy written after the
         * close by a GM that then went away, arriving only after the next incident
         * opened, does not reach it. In a world the stores have never opened (E04's fix
         * round, the round-2 reviews' R2-m6 and m6: it rewrote this world's record, a
         * standing betrayal offer included, and only tier 2's restore put it back), and
         * the new incident's opening resolved at once, as the older murder tests do (m2:
         * left to the killer's player's dice, it passed on timing alone).
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const [killer, victim, third] = cast(3);
        const clock = getClock() ?? {};
        const offer = { thirdId: third.id, killerId: killer.id, chapter: clock.chapter, day: clock.day };
        await E.withGmStoreWorld(`suite-close-${foundry.utils.randomID(8)}`, async () => {
            const theirsAt = E.gmStoreStamp();
            const stale = { killerId: killer.id, victimId: victim.id, lastCrisis: { key: "SUITE", actorId: killer.id },
                swung: { [killer.id]: "SUITEE04ITEM0000" }, betrayal: offer };
            const theirs = E.emptySection();
            E.writeFields(theirs, "record", stale, theirsAt, S.castStore.spec, { whole: true });
            await S.castStore.mergeIn(theirs, { source: "sync" });
            await game.settings.set(MODULE_ID, SETTINGS.murderState, { active: true, stage: "incident", turn: 2, turnSide: "killer" });
            equal(M.murderState()?.killerId, killer.id, "the other GM's copy did not arrive");

            await M.endMurder({ reason: "test", followUp: false });
            const closed = S.castStore.record();
            ok(!closed.killerId && !closed.victimId && !closed.lastCrisis && !Object.keys(closed.swung ?? {}).length,
                `the close left a field of the incident: ${stableJson(closed)}`);
            equal(stableJson(closed.betrayal), stableJson(offer), "the betrayal offer did not outlive the close");
            await S.castStore.mergeIn(theirs, { source: "sync" });
            equal(S.castStore.record().killerId ?? null, null, "the old copy, arriving again after the close, brought its killer back");

            const closedAt = S.castStore.stampOf("record", "killerId");
            await M.openMurder({ killerId: victim.id, victimId: killer.id });
            await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            const late = E.emptySection();
            E.writeFields(late, "record", { thirdId: third.id, thirdSide: "killer", lastCrisis: { key: "SUITELATE" }, swung: { [third.id]: "SUITEE04ITEM0001" } },
                closedAt + 1, S.castStore.spec, { whole: true });
            await S.castStore.mergeIn(late, { source: "sync" });
            const opened = M.murderState();
            ok(opened && !opened.thirdId && !opened.thirdSide && !opened.lastCrisis && !Object.keys(opened.swung ?? {}).length,
                `the new incident holds a field of one it never had: ${stableJson(opened)}`);
            equal(stableJson([opened?.killerId, opened?.victimId, opened?.betrayal]), stableJson([victim.id, killer.id, offer]),
                "the new incident's cast, or the betrayal offer, is not what was opened");
        });
    }],

    ["the cast comes back by hand when this browser lost it", async () => {
        /*
         * E04, 26.09.2026; the design's 6.3. An incident runs in the world, and this
         * browser - lost, emptied - holds nobody in it: the health report says so, and
         * its window takes the killer and the victim from the GM. Driven through the
         * window a GM would use, then the incident is played on: the turn passes to
         * the killer entered. In a world the stores have never opened (E04's fix round,
         * R2-m6 and m6: `forget` emptied this world's record), the opening resolved at
         * once (m2). Since E32 C2 the fight is the cast's and goes with it: the round starts
         * again at the victim's side (`enterCast`), which the pass reads - the world half
         * is written the stage alone, as the module writes it. Red with that fill taken
         * out: no side to act, and the pass counted the round from nothing.
         */
        needs(env.dialogs(), "the cast is entered in a window, and this client draws none");
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const [killer, victim] = cast(2);
        await E.withGmStoreWorld(`suite-byhand-${foundry.utils.randomID(8)}`, async () => {
            await M.openMurder({ killerId: killer.id, victimId: victim.id });
            await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
            equal(M.murderState()?.killerId, killer.id, "the fixture incident did not open");
            const world = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
            await game.settings.set(MODULE_ID, SETTINGS.murderState, { ...world, stage: "incident" });
            await S.castStore.forget();
            equal(M.murderState()?.killerId ?? null, null, "the store forgot, and the cast is still here");
            ok((await S.gmStoreHealth()).rows.some(r => r.id === "incident"), "the health report does not say the running incident has no cast here");

            const waiting = S.enterCastByHand();
            ok(await until(() => document.querySelector(".drpg-window-enter-cast"), 4000), "the cast window did not open");
            const win = document.querySelector(".drpg-window-enter-cast");
            win.querySelector("[name=killerId]").value = killer.id;
            win.querySelector("[name=victimId]").value = victim.id;
            win.querySelector('button[data-action="enter"]').click();
            await waiting;
            equal(stableJson([M.murderState()?.killerId, M.murderState()?.victimId]), stableJson([killer.id, victim.id]),
                "the cast entered by hand is not the incident's");
            await M.passTurn();
            equal(stableJson([M.murderState()?.turnSide, M.murderState()?.killerTurnId, M.murderState()?.turn]), stableJson(["killer", killer.id, 1]),
                "the incident does not run on the cast entered by hand, or its round does not start again at 1");
            ok(!(await S.gmStoreHealth()).rows.some(r => r.id === "incident"), "the health report still says the incident has no cast here");
        });
    }],

    ["a Blackened of another chapter or season does not count, and a stale copy cannot bring one back", async () => {
        /*
         * E04, 26.09.2026; audit S04-25. The register was a list emptied at a chapter's
         * end, and synced with no freshness at all: a GM that missed the emptying sent
         * last chapter's killers back into this chapter's verdict. A row keeps its
         * chapter and season now, and `blackenedIds` reads the clock's. Held: this
         * chapter's killer counts; last chapter's and another season's do not; last
         * chapter's killer in a stale copy from another GM does not come back; and the
         * season reset's clear takes this chapter's out, a stale copy of it included. In a
         * world the stores have never opened (E04's fix round, R2-m6 and m6: the clear is
         * the primary's `clear()`, which raised this world's watermark and wrote it to
         * this browser's storage, where a run that died before tier 2's restore left it).
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./murder.mjs");
        const [now, before, elsewhere] = cast(3);
        const chapter = getClock()?.chapter ?? 1;
        const epoch = seasonEpoch();
        await E.withGmStoreWorld(`suite-blackened-${foundry.utils.randomID(8)}`, async () => {
            await S.blackenedStore.patchMany({
                [now.id]: { chapter, epoch, at: 1 },
                [before.id]: { chapter: chapter - 1, epoch, at: 2 },
                [elsewhere.id]: { chapter, epoch: epoch + 12345, at: 3 }
            });
            equal(stableJson(M.blackenedIds()), stableJson([now.id]), "a Blackened of another chapter or season counts in this one");
            const theirs = E.emptySection();
            E.writeFields(theirs, before.id, { chapter: chapter - 1, epoch, at: 0 }, E.gmStoreStamp() - 60 * 60 * 1000, S.blackenedStore.spec);
            await S.blackenedStore.mergeIn(theirs, { source: "sync" });
            equal(stableJson(M.blackenedIds()), stableJson([now.id]), "a stale copy brought last chapter's Blackened into this one");
            const kept = E.emptySection();
            E.writeFields(kept, now.id, { chapter, epoch, at: 1 }, E.gmStoreStamp() - 1000, S.blackenedStore.spec);
            await M.clearBlackened();
            await S.blackenedStore.mergeIn(kept, { source: "sync" });
            equal(stableJson(M.blackenedIds()), stableJson([]), "after the clear, a stale copy of this chapter's killer came back");
        });
    }],

    ["an unticked room stays unticked after a stale copy merges", async () => {
        /*
         * E04, 26.09.2026; audit S07-01. The fog ledger was a union written whole, and a
         * union only grows: a GM's copy that had not heard of an untick - or a player's
         * rows answering the primary's rebuild - put the room back at the next write, and
         * the GM's hide undid itself. A cell per room now, stamped, and an untick is a
         * `false` at its own stamp. Here a room is found through Room Setup's write, the
         * store's copy of that moment kept, the room unticked the same way, and the old
         * copy merged in as a sync does: the room stays hidden. (A player's rows in a
         * rebuild are 60-ledger's, through the handler itself.) Stood in a world the store
         * has never opened, so nothing reaches another GM.
         */
        const E = await import("./gm-store.mjs");
        const { discoveryStore } = await import("./gm-stores.mjs");
        const fog = await import("./fog.mjs");
        needs(world.atLeast("namedRooms", 1), "a room to find and hide");
        const scene = canvas.scene;
        const [student] = cast(1);
        const room = [...(scene?.regions ?? [])].map(r => r.name).find(Boolean);
        await E.withGmStoreWorld(`suite-untick-${foundry.utils.randomID(8)}`, async () => {
            await fog.applyDiscoveryChanges(scene, [{ actorId: student.id, room, value: true }]);
            ok(fog.discoveredFor(scene.id, student.id).includes(room), "the room was not found");
            const before = discoveryStore.section();
            await fog.applyDiscoveryChanges(scene, [{ actorId: student.id, room, value: false }]);
            ok(!fog.discoveredFor(scene.id, student.id).includes(room), "the untick did not hide the room");
            await discoveryStore.mergeIn(before, { source: "sync" });
            ok(!fog.discoveredFor(scene.id, student.id).includes(room), "a copy from before the untick brought the room back");
        });
    }],

    ["a player's rows merge, never replace, and rows under the cut are refused", async () => {
        /*
         * E04, 26.09.2026; audit S07-01. A player's rows were the set a GM sent last,
         * written whole: a GM whose browser held fewer rows emptied the rest of the
         * player's fog. The player's copy is a section of the GMs' cells now
         * (gm-stores.mjs `fogCopy`), merged cell by cell. Driven through the copy on this
         * browser the way a player's takes rows: one room, then another from a GM that
         * holds only that one - both stand; then a section with a reset's watermark above
         * both - they are gone, and of two rooms in that section the one stamped under
         * the watermark is not taken; and a section that is not one changes nothing. Stood
         * in a world the store has never opened.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const key = "SUITESCENE000000/SUITEACTOR000000";
        const rows = () => stableJson(E.liveFields(S.fogCopy.read())[key] ?? {});
        await E.withGmStoreWorld(`suite-fogcopy-${foundry.utils.randomID(8)}`, async () => {
            const t1 = E.gmStoreStamp(), t2 = E.gmStoreStamp();
            const one = (room, t) => ({ e: { [key]: { [room]: true } }, t: { [key]: t }, d: {}, cleared: 0 });
            equal(await S.fogCopy.receive(one("SUITE room A", t1), { "": t1 }), true, "a first row was not taken");
            equal(await S.fogCopy.receive(one("SUITE room B", t2), { "": t2 }), true, "a second GM's row was not taken");
            equal(rows(), stableJson({ "SUITE room A": true, "SUITE room B": true }), "a GM holding one row replaced the other");
            const cut = E.gmStoreStamp(), after = E.gmStoreStamp();
            const reset = { e: { [key]: { "SUITE room C": true, "SUITE room D": true } }, t: { [key]: { "": after, "SUITE room D": cut - 1 } },
                d: {}, cleared: cut };
            equal(await S.fogCopy.receive(reset, { "": after }), true, "a section after a reset was not taken");
            equal(rows(), stableJson({ "SUITE room C": true }), "a row under the reset's watermark stands, or one stamped under it was taken");
            equal(await S.fogCopy.receive({ e: "not rows", t: {}, d: {}, cleared: 0 }, { "": E.gmStoreStamp() }), false,
                "a section that is not one was taken");
        });
    }],

    ["an empty answer never takes an owner's offer away", async () => {
        /*
         * E04, 26.09.2026; audit S03-11. An owner's browser held whatever set of offers
         * the last answer carried, and a primary whose browser held none answered an empty
         * set, which the owner took: the lit button went out, and the Level Up with it,
         * until a GM offered it again. The owner's copy is stamped per character now
         * (gm-stores.mjs `offerCopy`). Driven through the copy on this browser the way an
         * owner's takes the primary's answers - an offer; an empty answer stamped 0, from a
         * primary holding none; a withdrawal - and then the primary's side: `offersFor`
         * stamps every character the owner owns, 0 where this browser holds nothing, the
         * row's stamp where it holds an offer, and the withdrawal's where it was taken back.
         * Stood in a world this browser has never opened, so nothing reaches another GM or
         * an owner.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const L = await import("./level-up.mjs");
        needs(world.atLeast("playersWithCharacter"), "the primary's answer is about the characters a player owns");
        const owns = (a, u) => a.type === "character" && a.testUserPermission(u, "OWNER");
        const owner = game.users.find(u => !u.isGM && game.actors.some(a => owns(a, u)));
        const student = game.actors.find(a => owns(a, owner));
        await E.withGmStoreWorld(`suite-offers-${foundry.utils.randomID(8)}`, async () => {
            const at = E.gmStoreStamp();
            const offer = { [student.id]: { kind: "standard" } };
            equal(await S.offerCopy.receive(offer, { [student.id]: at }), true, "an offer at its stamp was not taken");
            equal(await S.offerCopy.receive({}, { [student.id]: 0 }), false, "an empty answer from a primary holding no offer was taken");
            equal(stableJson(S.offerCopy.read()), stableJson(offer), "the offer did not survive the empty answer");
            equal(await S.offerCopy.receive({}, { [student.id]: at + 1 }), true, "a withdrawal, at a newer stamp, did not take the offer away");
            equal(stableJson(S.offerCopy.read()), "{}", "the withdrawn offer still reads");

            const none = L.offersFor(owner.id);
            equal(stableJson([none.offers, none.stamps[student.id]]), stableJson([{}, 0]),
                "the primary holding no offer does not answer nothing at stamp 0");
            await S.offerStore.patch(student.id, { kind: "standard", at: Date.now() });
            const one = L.offersFor(owner.id);
            equal(stableJson([one.offers[student.id], one.stamps[student.id]]), stableJson([{ kind: "standard" }, S.offerStore.stampOf(student.id)]),
                "the primary's answer does not carry the offer at its row's stamp");
            await S.offerStore.drop(student.id);
            const gone = L.offersFor(owner.id);
            ok(gone.stamps[student.id] > one.stamps[student.id] && !gone.offers[student.id],
                `the primary's answer after a withdrawal is not newer than the offer, so the owner would keep it lit: ${stableJson(gone)}`);
        });
    }],

    ["a taken plant stays taken when a stale copy merges", async () => {
        /*
         * E04, 26.09.2026; audit S08-19. A trap's planted objects were one object per GM
         * browser, written whole, and the primary - who hands a player's Search its find
         * - never saw a plant another GM left. They are a synced store now, so a copy
         * from a GM that has not heard of a take can arrive after it. Taking one is a
         * stamped drop, and a new plant in the room drops the old one first. Here a
         * plant is left and taken; this store's copy from before the take merges in as a
         * sync does: the plant stays taken. Then a plant with a picture is left, and a
         * second one without replaces it before anybody searches; the copy from before
         * the second merges in: the room holds the second, and nothing of the first. Stood
         * in a world this browser has never opened, so no other GM is sent the fixture's
         * rows.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const T = await import("./traps.mjs");
        const room = "SUITE E04 plant room", sceneId = "SUITEE04PLANTSCN";
        await E.withGmStoreWorld(`suite-plants-${foundry.utils.randomID(8)}`, async () => {
            const first = await T.plantItem("SUITEE04PLANTPRJ", room, { sceneId, name: "SUITE planted kit", img: "SUITE-first.webp" });
            ok(first, "the fixture plant was not left");
            const before = S.trapPlantStore.section();
            const taken = await T.takePlant(room, sceneId);
            equal(taken?.drpgItemId, first, "the plant was not taken");
            await S.trapPlantStore.mergeIn(before, { source: "sync" });
            equal(await T.takePlant(room, sceneId), null, "a copy from before the take brought the plant back for a second finder");
            await T.plantItem("SUITEE04PLANTPRJ", room, { sceneId, name: "SUITE pictured kit", img: "SUITE-pictured.webp" });
            const beforeSecond = S.trapPlantStore.section();
            const second = await T.plantItem("SUITEE04PLANTPRJ", room, { sceneId, name: "SUITE second kit" });
            await S.trapPlantStore.mergeIn(beforeSecond, { source: "sync" });
            const held = S.trapPlantStore.get(`${sceneId}::${room}`) ?? {};
            equal(stableJson([held.drpgItemId, held.name, held.img ?? null]), stableJson([second, "SUITE second kit", null]),
                "the room does not hold the second plant alone");
        });
    }],

    ["a reset cuts every store it wipes and none it keeps", async () => {
        /*
         * E04 C10, 26.09.2026; audit S06-20, D12. A season reset wiped what the GM who ran
         * it held, and every other GM's browser kept last season's rows and handed them
         * back at the next exchange. The reset writes a cut per wiped group in the clock
         * now, before its steps (season-exceptions.mjs `resetCutPatch`), and every client
         * cuts each store of a wiped group at it (gm-store.mjs `applyCuts`). Here a row goes
         * into each store, the patch of a reset that wipes some groups and keeps the rest is
         * applied as the clock's update applies it, and: each store of a wiped group reads
         * empty with its watermark at the cut; each of a kept group holds its row with its
         * watermark where it was; and the same cut again writes nothing (14-quiet).
         *
         * Not the real clock: a cut cannot be taken back, so it is handed to the engine the
         * way the clock hands it, in a world the stores have never opened. And not the
         * Mastermind's or the cast's record, which are left untouched: the primary tells
         * the players what a write to either changes (their re-tell watches, the review's
         * B1), and a stand-in world's would reach real players (the review's S-m2).
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const ex = await import("./season-exceptions.mjs");
        const told = new Set([S.mastermindStore.name, S.castStore.name]);
        const plan = ex.planFrom(["remnants", "projects", "advancement", "discovered"]);
        await E.withGmStoreWorld(`suite-reset-${foundry.utils.randomID(8)}`, async () => {
            const handles = E.gmStoreHandles().filter(h => !told.has(h.name));
            const key = "SUITE-last-season";
            for (const h of handles) await h.patch(key, { suite: "last season" });
            await E.gmStoresIdle();
            const before = Object.fromEntries(handles.map(h => [h.name, h.cleared()]));
            const at = E.gmStoreStamp();
            const patch = ex.resetCutPatch(plan, { resetCuts: {} }, at);
            await E.applyGmStoreCuts(patch);
            await E.gmStoresIdle();
            const wiped = handles.filter(h => plan.groups.has(h.spec.resetGroup)), kept = handles.filter(h => !plan.groups.has(h.spec.resetGroup));
            ok(wiped.length >= 2 && kept.length >= 2, `the fixture wipes ${wiped.length} stores and keeps ${kept.length}: it measures too little`);
            const wrong = [
                ...wiped.filter(h => h.cleared() !== at || h.has(key)).map(h => `${h.name} (wiped) at ${h.cleared()}, row ${h.has(key)}`),
                ...kept.filter(h => h.cleared() !== before[h.name] || !h.has(key)).map(h => `${h.name} (kept) at ${h.cleared()}, row ${h.has(key)}`)
            ];
            ok(!wrong.length, `the cut ${at} missed a wiped store or reached a kept one: ${wrong.join("; ")}`);

            const keys = new Set(handles.map(h => `${MODULE_ID}.${h.spec.key}`));
            let writes = 0;
            const hook = Hooks.on("clientSettingChanged", written => { if (keys.has(written)) writes++; });
            try {
                await E.applyGmStoreCuts(patch);
                await E.gmStoresIdle();
            } finally {
                Hooks.off("clientSettingChanged", hook);
            }
            equal(writes, 0, "the same cut again wrote a store");
        });
    }],

    ["compaction drops what the cut covers and keeps a tombstone whose subject exists", async () => {
        /*
         * E04 C10, 26.09.2026; the design's 2.11. A tombstone keeps an older copy of a
         * dropped row from coming back, so none can go while a GM might still hold that
         * copy - and one whose subject is gone guards a row nothing can reach. Two halves:
         * a reset's cut takes every row and tombstone at or under it with the merge that
         * raises the watermark; and after the stores have the other GMs' copies
         * (gm-stores.mjs `compactGmStores`), a tombstone older than
         * `TIMING.gmStoreTombstoneDays` whose subject is gone goes, and nothing else - a
         * tombstone of a subject still here, a young one and a live row of a gone subject
         * stay; and on the primary, a Blackened row of a season before this one is
         * dropped, stamped, and one of an earlier chapter of this season stands (moving
         * the clock back a chapter reads it again). The answer keys' store and the
         * register, in a world the stores have never opened, every stamp built for the
         * fixture.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const { TIMING } = await import("./config.mjs");
        const [student] = cast(1);
        const day = 24 * 60 * 60 * 1000, now = E.gmStoreNow();
        const old = now - (TIMING.gmStoreTombstoneDays + 1) * day, young = now - day;
        const gone = n => `Actor.SUITEGONE${n}00000000.Item.SUITEGONE${n}00000000`;
        const here = student.uuid, under = gone("U"), buried = gone("B");
        await E.withGmStoreWorld(`suite-compact-${foundry.utils.randomID(8)}`, async () => {
            await S.bulletStore.mergeIn({
                e: { [gone("L")]: { realType: "neutral" }, [under]: { realType: "key" } },
                t: { [gone("L")]: old, [under]: old - 2000 },
                d: { [here]: old, [gone("O")]: old, [gone("Y")]: young, [buried]: old - 2000 },
                cleared: 0
            }, { source: "sync" });
            await E.applyGmStoreCuts({ resetCuts: { bullets: old - 1000 } });
            ok(!S.bulletStore.has(under) && !S.bulletStore.tombstone(buried),
                "a row or a tombstone under the reset's cut stood after the cut rose");

            const chapter = getClock()?.chapter ?? 1;
            await S.blackenedStore.patchMany({ SUITEPASTSEASON: { chapter, epoch: 5, at: 1 }, SUITEPASTCHAPTER: { chapter: chapter - 1, epoch: 10, at: 2 },
                [student.id]: { chapter, epoch: 10, at: 3 } });
            // As the primary runs it, whichever GM runs the suite.
            const report = await S.compactGmStores({ now, epoch: 10, primary: true });
            await E.gmStoresIdle();
            const held = {
                subjectHere: S.bulletStore.tombstone(here), gone: S.bulletStore.tombstone(gone("O")), young: S.bulletStore.tombstone(gone("Y")),
                liveOfGone: S.bulletStore.has(gone("L"))
            };
            equal(stableJson(held), stableJson({ subjectHere: old, gone: 0, young, liveOfGone: true }),
                "compaction took a tombstone whose subject exists, a young one or a live row, or left an old one of a gone subject");
            ok(!S.blackenedStore.has("SUITEPASTSEASON") && S.blackenedStore.tombstone("SUITEPASTSEASON") > 0
                && S.blackenedStore.has("SUITEPASTCHAPTER") && S.blackenedStore.has(student.id),
                "a Blackened row of a past season stands, was dropped unstamped, or a row of this season went with it");
            equal(stableJson(report), stableJson({ bullets: 1, blackenedPastSeasons: 1 }), "compaction does not report what it took");
        });
    }],

    ["an unstamped world in play keeps its safeword", async () => {
        /*
         * E04 C11, 26.09.2026; audit S01-14. A world with no migration stamp is new, or
         * one from v1.1.0, the build before the stamp - and a v1.1.0 world was given
         * "Safe Word" in place of the word its table used. Driven through the clause's
         * own function with the context the automatic pass gives it: an unstamped world
         * that was not in play keeps the default; one that was gets the language file's
         * old word, read back. The setting is put back afterwards.
         */
        const M = await import("./migrate.mjs");
        const { DEFAULT_SAFEWORD } = await import("./settings.mjs");
        const legacy = game.i18n.localize("DRPG.Legacy.safeword");
        ok(legacy && legacy !== DEFAULT_SAFEWORD, `the language file's old word is "${legacy}": this measures nothing`);
        const before = getSetting(SETTINGS.safeword);
        try {
            await game.settings.set(MODULE_ID, SETTINGS.safeword, DEFAULT_SAFEWORD);
            equal(await M.keepOldSafeword({ from: "", wasInPlay: false }), null, "a new world was given the old word");
            equal(getSetting(SETTINGS.safeword), DEFAULT_SAFEWORD, "a new world's safeword moved");
            equal(stableJson(await M.keepOldSafeword({ from: "", wasInPlay: true })), stableJson({ safeword: legacy }),
                "an unstamped world in play did not keep its word");
            equal(getSetting(SETTINGS.safeword), legacy, "the kept word does not read back");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.safeword, before);
            await settle();
        }
    }],

    ["Back up the case, then Restore, brings every store back", async () => {
        /*
         * E04, 26.09.2026; audit S05-09, the brief's verify. Each store is given a row
         * through its own writer; the case is backed up (the file is taken from
         * saveDataToFile instead of downloaded); every store's section on this browser
         * is emptied, as a browser that lost its storage has it; the health report must
         * name what is gone; the file is restored; and every row must read back through
         * the same writer's reader. A store with `backup: true` and no fixture here
         * fails. Put back by tier 2's restore; the emptied sections are this browser's
         * memory only - sent nowhere and written nowhere until the restore writes them
         * back (`forget`; E04's fix round, the review's DS-m5).
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const remnants = await import("./remnants.mjs");
        needs(world.atLeast("sceneOnScreen"), "the backed-up trace is placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const [holder] = cast(1);
        const made = [], traces = [];
        const mastermind = await import("./mastermind.mjs");
        const murder = await import("./murder.mjs");
        const traps = await import("./traps.mjs");
        const levelUp = await import("./level-up.mjs");
        const fog = await import("./fog.mjs");
        const projects = await import("./projects.mjs");
        const [, victim] = cast(2);
        const FIXTURES = {
            // An indirect murder's four fields, through their store (E05 C1): no project exists for it, so no trap arms.
            projectSecrets: {
                seed: async () => {
                    await S.projectSecretStore.patch("SUITEE05BACKUPPJ", { killerId: holder.id, condition: "SUITE backed-up condition" });
                    return "SUITEE05BACKUPPJ";
                },
                gone: (report, id) => !projects.secretsOf(id).condition,
                back: id => stableJson([projects.secretsOf(id).killerId, projects.secretsOf(id).condition]) === stableJson([holder.id, "SUITE backed-up condition"])
            },
            // A declaration made in the dark, through its store (E05 C3): named for no Eclipse, so no lights judge it.
            pendingMurders: {
                seed: async () => {
                    await S.pendingMurderStore.patch(holder.id, { room: "SUITE backed-up room", note: "SUITE backed-up declaration", at: 1, approved: null, eclipse: null });
                    return holder.id;
                },
                gone: (report, id) => !S.pendingMurderStore.has(id),
                back: id => S.pendingMurderStore.get(id)?.note === "SUITE backed-up declaration"
            },
            // A chapter's Key Remnant plan, through its writer (E05 C5): chapter 99, which no clock here is on.
            keyPlan: {
                seed: async () => {
                    const { setKeyPlan } = await import("./investigation.mjs");
                    await setKeyPlan({ chapter: 99, entries: [{ scale: "trivial", name: "SUITE backed-up clue", note: "SUITE backed-up note" }] });
                    return "99:0";
                },
                gone: (report, key) => !S.keyPlanStore.has(key),
                back: key => stableJson([S.keyPlanStore.get(key)?.name, S.keyPlanStore.get(key)?.note]) === stableJson(["SUITE backed-up clue", "SUITE backed-up note"])
            },
            // An Eclipse's crossing, through its store (E05 C4): named for an Eclipse that is not running, so it counts nothing.
            eclipseMoves: {
                seed: async () => {
                    await S.eclipseMoveStore.patch(holder.id, { used: 1, eclipse: "SUITE backed-up Eclipse" });
                    return holder.id;
                },
                gone: (report, id) => !S.eclipseMoveStore.has(id),
                back: id => S.eclipseMoveStore.get(id)?.used === 1 && S.eclipseMoveStore.get(id)?.eclipse === "SUITE backed-up Eclipse"
            },
            // A Confusion armed and not rolled, through its store (E06 fix r2-G4): no player is sent it while the stores are held.
            confusions: {
                seed: async () => {
                    await S.confusionStore.patch(holder.id, { calls: [{ key: "meddle", grants: "bonus", amount: -1, nonce: "SUITEbackedUpCall" }] });
                    return holder.id;
                },
                gone: (report, id) => !S.confusionStore.has(id),
                back: id => S.confusionStore.get(id)?.calls?.[0]?.nonce === "SUITEbackedUpCall"
            },
            // A death nobody has found, through its store (E05 C10): no player is sent it while the stores are held (R184).
            deaths: {
                seed: async () => {
                    await S.deathStore.patch(holder.id, { chapter: 99, day: 1, timeOfDay: "night", at: 1, keepBullets: true, known: [] });
                    return holder.id;
                },
                gone: (report, id) => !S.deathStore.has(id),
                back: id => S.deathStore.get(id)?.chapter === 99
            },
            // A Reinforced Level Up waiting for the class, through its store (E05 C11): chapter 99, which no verdict here reaches.
            deferredOffers: {
                seed: async () => {
                    await S.deferredOfferStore.patch(holder.id, { kind: "reinforced", chapter: 99, at: 1, count: 1 }, { whole: true });
                    return holder.id;
                },
                gone: (report, id) => !S.deferredOfferStore.has(id),
                back: id => S.deferredOfferStore.get(id)?.chapter === 99 && S.deferredOfferStore.get(id)?.kind === "reinforced"
            },
            // The overflow's count, through its record (E05 C12): below any X, so nothing is armed by it.
            overflow: {
                seed: async () => {
                    await S.overflowStore.patch("record", { count: 3 });
                    return "record";
                },
                gone: () => S.overflowStore.record().count === undefined,
                back: () => S.overflowStore.record().count === 3
            },
            // Despair a pool owes, through its store (E05 C12): dated this time of day, so no clock write here settles it.
            despairOwed: {
                seed: async () => {
                    const c = getClock();
                    await S.despairOwedStore.patch(game.user.id, { owed: 2, since: `${c.session ?? 0}.${c.day ?? 1}.${c.timeOfDay ?? ""}` });
                    return game.user.id;
                },
                gone: (report, id) => !S.despairOwedStore.has(id),
                back: id => S.despairOwedStore.get(id)?.owed === 2
            },
            // What was taken off a body, through its store (E05 C14): a trace no scene has, which no loot reaches.
            lootTraces: {
                seed: async () => {
                    await S.lootTraceStore.patch(holder.id, { sceneId: "SUITEE05BACKUPSC", tokenId: "SUITEE05BACKUPTK", taken: ["SUITE backed-up torch"] });
                    return holder.id;
                },
                gone: (report, id) => !S.lootTraceStore.has(id),
                back: id => stableJson(S.lootTraceStore.get(id)?.taken ?? null) === stableJson(["SUITE backed-up torch"])
            },
            // A pre-session note, through its store (E05 C6): the GM's own row, which no player is sent. Its
            // flag as a reset leaves it, and after the restore as the row says (E05 fix r1-G4, M6 = S1-m6).
            notes: {
                seed: async () => {
                    await S.noteStore.patch(game.user.id, { text: "SUITE backed-up note", updatedAt: 1, byGm: true });
                    await setNoteFlag(game.user, { written: false });
                    return game.user.id;
                },
                gone: (report, id) => !S.noteStore.has(id),
                back: id => S.noteStore.get(id)?.text === "SUITE backed-up note"
                    && stableJson(game.users.get(id)?.getFlag(MODULE_ID, "preSessionNote")) === stableJson({ updatedAt: 1, written: true })
            },
            // Through the store, in this world: while tier 2 holds the stores no player is sent anything of it (R184).
            discovery: {
                seed: async () => {
                    await S.discoveryStore.patch(`${scene.id}/${holder.id}`, { "SUITE backed-up room": true });
                    return holder.id;
                },
                gone: (report, id) => !fog.discoveredFor(scene.id, id).includes("SUITE backed-up room"),
                back: id => fog.discoveredFor(scene.id, id).includes("SUITE backed-up room")
            },
            // Through the store, in this world: no owner is sent the offer while the stores are held (R184).
            offers: {
                seed: async () => {
                    await S.offerStore.patch(holder.id, { kind: "standard", at: Date.now() });
                    return holder.id;
                },
                gone: (report, id) => levelUp.pendingAdvance(game.actors.get(id)) === null,
                back: id => levelUp.pendingAdvance(game.actors.get(id))?.kind === "standard"
            },
            // The traps' two, through their stores: no project is armed by them (C7).
            trapLedger: {
                seed: async () => {
                    await S.trapLedgerStore.patch("SUITEE04BACKUPIT", { projectId: "SUITEE04BACKUPPJ" });
                    return "SUITEE04BACKUPIT";
                },
                gone: (report, id) => traps.trapForItemId(id) === null,
                back: id => traps.trapForItemId(id) === "SUITEE04BACKUPPJ"
            },
            trapPlants: {
                seed: async () => {
                    const key = `${scene.id}::SUITE backed-up room`;
                    await S.trapPlantStore.patch(key, { projectId: "SUITEE04BACKUPPJ", drpgItemId: "SUITEE04BACKUPIT", name: "SUITE backed-up kit" });
                    return key;
                },
                gone: (report, key) => !S.trapPlantStore.has(key),
                back: key => S.trapPlantStore.get(key)?.name === "SUITE backed-up kit"
            },
            // Both through their stores, in this world: no participant is sent the cast while the stores are held (R184).
            cast: {
                seed: async () => {
                    await S.castStore.patch("record", { killerId: holder.id, victimId: victim.id });
                    return holder.id;
                },
                gone: () => !S.castStore.record().killerId,
                back: id => stableJson([S.castStore.record().killerId, S.castStore.record().victimId]) === stableJson([id, victim.id])
            },
            blackened: {
                seed: async () => {
                    await S.blackenedStore.patch(holder.id, { chapter: getClock()?.chapter ?? null, epoch: seasonEpoch(), at: 1 });
                    return holder.id;
                },
                gone: (report, id) => !murder.blackenedIds().includes(id),
                back: id => murder.blackenedIds().includes(id)
            },
            mastermind: {
                // Through the store and not setMastermind; the primary's watch tells no player while the stores are held (R184).
                seed: async () => {
                    await S.mastermindStore.patch("record", { actorId: holder.id, room: "SUITE backed-up lair" });
                    return holder.id;
                },
                gone: (report, id) => mastermind.mastermindActor() === null,
                back: id => stableJson([mastermind.mastermindActor()?.id, mastermind.mastermindLair()]) === stableJson([id, "SUITE backed-up lair"])
            },
            remnants: {
                seed: async () => {
                    const token = await remnants.placeRemnant({ type: "key", visibility: "hidden", x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                        tiedToCrime: false, note: "test fixture - a backed-up trace" });
                    ok(token, "no trace was placed to back up");
                    traces.push(token);
                    return token;
                },
                gone: (report, token) => report.counts.traces.missing >= 1 && remnants.remnantData(token) === null,
                back: token => stableJson([remnants.remnantData(token)?.type, remnants.remnantData(token)?.note])
                    === stableJson(["key", "test fixture - a backed-up trace"])
            },
            bullets: {
                seed: async () => {
                    const item = await bullets.createTruthBullet(holder, { name: "Suite fixture: a backed-up answer", realType: "final",
                        visibility: "hidden", playerText: "A folded note.", analyzedText: "It names the mastermind", remnantId: "SUITEE04BACKUP" });
                    ok(item, "no bullet was made to back up");
                    made.push(item);
                    return item.uuid;
                },
                gone: (report, uuid) => report.counts.bullets.missing >= 1 && !bullets.secretOf(uuid).realType,
                back: uuid => stableJson([bullets.secretOf(uuid).realType, bullets.secretOf(uuid).analyzedText]) === stableJson(["final", "It names the mastermind"])
            }
        };
        const stores = E.gmStoreHandles().filter(h => h.spec.backup);
        const unfixtured = stores.filter(h => !FIXTURES[h.name]).map(h => h.name);
        ok(!unfixtured.length, `these stores are backed up and this test has no fixture for them: ${unfixtured.join(", ")}`);
        const unsaved = Object.keys(FIXTURES).filter(name => !stores.some(h => h.name === name));
        ok(!unsaved.length, `this test has a fixture for a store the backup leaves out: ${unsaved.join(", ")}`);
        const saveDataToFile = foundry.utils.saveDataToFile;
        const noteFlags = noteFlagsNow();
        let saved = null;
        try {
            foundry.utils.saveDataToFile = data => { saved = data; };
            const keys = {};
            for (const store of stores) keys[store.name] = await FIXTURES[store.name].seed();
            const file = await S.backupCase();
            ok(saved && file?.format === S.CASE_FORMAT, "the backup wrote no case file");
            const stored = () => stores.map(h => game.settings.storage.get("client").getItem(`${MODULE_ID}.${h.spec.key}`));
            const onDisk = stored();
            for (const store of stores) await store.forget();
            equal(stableJson(stored()), stableJson(onDisk), "forgetting wrote the emptied sections to this browser's storage, where a tab closed now would leave them");
            const report = await S.gmStoreHealth();
            for (const store of stores) ok(FIXTURES[store.name].gone(report, keys[store.name]), `${store.name}: after the store was emptied the report does not say so, or its row still reads`);
            const result = await S.restoreCase(saved, { recheck: false });
            ok(result && !result.refused, `the restore refused its own backup: ${stableJson(result)}`);
            for (const store of stores) ok(FIXTURES[store.name].back(keys[store.name]), `${store.name}: its row did not come back from the file`);
        } finally {
            foundry.utils.saveDataToFile = saveDataToFile;
            await putNoteFlagsBack(noteFlags);
            for (const item of made) {
                await bullets.dropSecret(item.uuid);
                await item.actor?.items?.get(item.id)?.delete();
            }
            for (const token of traces) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) await token.delete();
            }
        }
    }],

    ["a restore of another world's file keeps this world's rows and its pick, unless the pick is ticked", async () => {
        /*
         * E04's fix round, 26.09.2026; the reviews' DS-M1 = C-m6. A file of another world
         * (a duplicated world, a moved server) was merged as it was: its watermark removed
         * every row of this world stamped under it, on every GM, and its record replaced
         * this world's pick. In a world the stores have never opened (`withGmStoreWorld`,
         * so no other GM and no player is sent anything): two answer keys and a pick here;
         * in the file, a third row, a removal of one of the two, a watermark after both and
         * a newer pick. Not ticked, the file is refused. Ticked: both answer keys read back,
         * the file's row is added, the pick is this world's, and the preview said so -
         * nothing removed here, the pick "taken only if ticked". Ticked for the Mastermind
         * as well, the file's pick is taken.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const [mine, theirs] = cast(2);
        const KEPT = ["Actor.SUITEOTHERW000.Item.KEPT1", "Actor.SUITEOTHERW000.Item.KEPT2"], THEIRS = "Actor.SUITEOTHERW000.Item.THEIRS";
        await E.withGmStoreWorld(`suite-otherworld-${foundry.utils.randomID(8)}`, async () => {
            await S.bulletStore.patch(KEPT[0], { realType: "key" });
            await S.bulletStore.patch(KEPT[1], { realType: "final" });
            await S.mastermindStore.patch("record", { actorId: mine.id, room: "SUITE this world's lair" });
            const now = E.gmStoreNow();
            const file = stableJson({
                format: S.CASE_FORMAT, version: S.CASE_VERSION, world: { id: "suite-another-world", title: "Another world" },
                stores: {
                    bullets: { e: { [THEIRS]: { realType: "prep" } }, t: { [THEIRS]: now - 1000 }, d: { [KEPT[1]]: now + 1000 }, cleared: now + 2000 },
                    mastermind: { e: { record: { actorId: theirs.id, room: "SUITE another world's lair" } }, t: { record: now + 3000 }, d: {}, cleared: 0 }
                }
            });
            const refused = await S.restoreCase(file, { recheck: false });
            equal(refused?.refused, "otherWorld", "another world's file was restored with nothing ticked");
            const preview = S.previewRestore(file);
            equal(stableJson([preview.otherWorld, preview.stores.bullets?.add, preview.stores.bullets?.remove, preview.stores.mastermind?.record]),
                stableJson([true, 1, 0, true]), `the preview does not say one row added, none removed and the pick taken only if ticked: ${stableJson(preview)}`);
            const first = await S.restoreCase(file, { otherWorld: true, recheck: false });
            ok(first?.counts?.mastermind?.skipped, `another world's pick was not left out: ${stableJson(first)}`);
            equal(stableJson([...KEPT, THEIRS].map(k => S.bulletStore.get(k)?.realType ?? null)), stableJson(["key", "final", "prep"]),
                "another world's watermark or removal took this world's answer keys, or its row was not added");
            equal(S.mastermindStore.record().actorId, mine.id, "another world's pick replaced this world's with nothing ticked for it");
            await S.restoreCase(file, { otherWorld: true, records: ["mastermind"], recheck: false });
            equal(stableJson([S.mastermindStore.record().actorId, S.mastermindStore.record().room]), stableJson([theirs.id, "SUITE another world's lair"]),
                "the file's pick was not taken with the Mastermind ticked");
        });
    }],

    ["the health check counts a trace whose answer key is still on its token apart, to be moved and not restored", async () => {
        /*
         * E04's fix round, 26.09.2026; the review's C-m14. A trace from before the ledger
         * that `migrateRemnants` has not reached has no row, and the check counted it as a
         * missing answer key and offered a Restore that could not help: no backup holds a
         * key that is still on its token. Made the way such a trace is - its answer key in
         * its flags, no row - it is counted as one to move and not as missing, and a trace
         * with no row and nothing on its token still is. Both fixtures are deleted after.
         */
        const S = await import("./gm-stores.mjs");
        const remnants = await import("./remnants.mjs");
        needs(world.atLeast("sceneOnScreen"), "the fixture traces are placed on the scene on screen");
        const scene = game.scenes.active ?? canvas?.scene;
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const placed = [];
        const make = async flags => {
            const [t] = await scene.createEmbeddedDocuments("Token", [{ name: game.i18n.localize("DRPG.Remnant.tokenName"), actorLink: false,
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, hidden: true, flags: { [MODULE_ID]: { isRemnant: true, ...flags } } }]);
            ok(t, "could not make a fixture trace");
            placed.push(t);
            return t;
        };
        try {
            const before = (await S.gmStoreHealth()).counts.traces;
            const onToken = await make({ remnantType: "prep", visibility: "subtle", note: "SUITE a key still on its token" });
            await make({});
            ok(remnants.answerKeyOnToken(onToken) && remnants.remnantData(onToken) === null, "the fixture is not a trace whose key is still on its token");
            const report = await S.gmStoreHealth();
            const after = report.counts.traces;
            equal(stableJson([after.onToken - before.onToken, after.missing - before.missing]), stableJson([1, 1]),
                `the two traces with no row were not counted one to move and one missing: ${stableJson({ before, after })}`);
            ok(report.rows.some(r => r.id === "tracesOnToken" && r.level === "missing"), "no row of the report says a trace's key is still on its token");
        } finally {
            for (const t of placed) if (scene.tokens.has(t.id)) await t.delete();
        }
    }],

    ["the Mastermind set to feed no pool is the GMs' warning, in the season checklist and the case health report", async () => {
        /*
         * E05 C15, 27.09.2026; audit S03-03, S10-12. Despair Flow's division is the world
         * setting `gmAssignments`, and the module used to advise setting the Mastermind to
         * "- nobody -": the one student a console could see left out of every pool. The advice
         * is gone (R197 holds the texts), and a GM who follows it anyway is told, by a row of
         * the season checklist and of the case health report (mastermind.mjs
         * `mastermindUnpooled`). In a world the stores have never opened (`withGmStoreWorld`)
         * a student is the pick; assigned to this GM, neither row is there; set to nobody, both
         * are, and the checklist's row names nobody. The checklist is answered by a stub that
         * reads its rows. The division is put back as it was.
         */
        const E = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const M = await import("./mastermind.mjs");
        const A = await import("./assignments.mjs");
        const { openSeasonSetup } = await import("./season-setup.mjs");
        const [student] = cast(1);
        const before = foundry.utils.deepClone(A.assignments());
        const title = game.i18n.localize("DRPG.Season.step.nobodyPublic");
        const D = foundry.applications.api.DialogV2;
        const own = Object.getOwnPropertyDescriptor(D, "wait");
        const read = async () => {
            let rows = null;
            D.wait = async cfg => {
                const el = document.createElement("div");
                if (typeof cfg?.content === "string") el.innerHTML = cfg.content;
                else if (cfg?.content) el.append(cfg.content.cloneNode(true));
                rows = [...el.querySelectorAll(".drpg-setup-step")].map(li => ({
                    title: li.querySelector("strong")?.textContent ?? "",
                    detail: li.querySelector(".drpg-setup-missing")?.textContent ?? ""
                }));
                return null;
            };
            await openSeasonSetup();
            const health = (await S.gmStoreHealth())?.rows ?? [];
            return { unpooled: M.mastermindUnpooled(), rows, health: health.filter(r => r.id === "nobodyPublic").map(r => r.level) };
        };
        try {
            await E.withGmStoreWorld(`suite-unpooled-${foundry.utils.randomID(8)}`, async () => {
                await S.mastermindStore.patch("record", { actorId: student.id });
                await A.setAssignments({ ...before, [student.id]: game.user.id });
                const pooled = await read();
                ok(Array.isArray(pooled.rows) && pooled.rows.length > 3, "the season checklist drew no rows - this measured nothing");
                equal(stableJson([pooled.unpooled, pooled.rows.some(r => r.title === title), pooled.health]), stableJson([false, false, []]),
                    "a Mastermind in a pool is warned about");
                await A.setAssignments({ ...before, [student.id]: A.NO_MONOKUMA });
                const out = await read();
                const row = out.rows?.find(r => r.title === title);
                equal(stableJson([out.unpooled, Boolean(row), row?.detail ?? null, out.health]), stableJson([true, true, "", ["conflict"]]),
                    `a Mastermind set to nobody is not warned about in both places, or the checklist's row names them: ${stableJson(out)}`);
            });
        } finally {
            if (own) Object.defineProperty(D, "wait", own);
            else delete D.wait;
            await A.setAssignments(before);
        }
    }],

    ["Analyze refuses rather than announcing Neutral when the answer key is missing", async () => {
        /*
         * E04, 26.09.2026; audit S05-01, S05-09. A bullet whose answer key this GM's
         * browser lacks used to be read as Neutral by the Analyze - a reading nobody
         * made, announced to its holder. Made here the way a lost browser leaves one: a
         * bullet on a student with no row in the store. Its Analyze is refused with the
         * closed list's code (answerKeyMissing), the bullet shows and holds what it did,
         * and the GMs are told once for the bullet, not once per throw.
         */
        const { resolveAnalyze } = await import("./analyze.mjs");
        const { reasonOf } = await import("./bridge-guards.mjs");
        const { bulletStore } = await import("./gm-stores.mjs");
        const [actor] = cast(1);
        const messages = () => game.messages.size;
        let item = null;
        try {
            [item] = await actor.createEmbeddedDocuments("Item", [{ name: "Suite fixture: a bullet with no answer key", type: "loot",
                flags: { [MODULE_ID]: { category: "truthBullet", isTruthBullet: true, shownType: "neutral", visibility: "evident", analyzed: false } } }]);
            ok(item && !bulletStore.has(item.uuid), "the fixture bullet was made with a row, or not at all");
            await bulletStore.whenHydrated();
            const before = messages();
            const first = await resolveAnalyze({ actorId: actor.id, itemId: item.id, total: 40, isCritical: false });
            equal(reasonOf(first?.refused ?? ""), "answerKeyMissing", `the Analyze was not refused for its missing key: ${stableJson(first)}`);
            const live = actor.items.get(item.id);
            equal(stableJson([live.getFlag(MODULE_ID, "shownType"), live.getFlag(MODULE_ID, "analyzed")]), stableJson(["neutral", false]),
                "the refused Analyze announced something on the bullet");
            await settle();
            const told = messages() - before;
            ok(told === 1, `the GMs were told ${told} time(s) about the missing key, not once`);
            await resolveAnalyze({ actorId: actor.id, itemId: item.id, total: 40, isCritical: false });
            await settle();
            equal(messages() - before, 1, "a second throw at the same bullet told the GMs again");
        } finally {
            if (item) await actor.items.get(item.id)?.delete();
        }
    }],

    ["a refused crossing names no unknown room", async () => {
        /*
         * E06 C11, 28.09.2026; audit S07-19. The list of where you can go was filtered by
         * the rooms this viewer has found (MAP-03) and the sentence's own `{to}` was not,
         * so a token dragged onto a black patch came back with the name of the room under
         * it. `known` is what `roomsKnownToMe` answers on a player's browser; the suite runs
         * on a GM's, where it answers null and every name may be said. The Eclipse's
         * refusal asks the same question and must use the same sentence.
         */
        const M = await import("./movement.mjs");
        const eclipse = stripComments((await moduleSources()).get("eclipse.mjs") ?? "");
        const [here, there, next] = M.allRooms();
        must(here && there && next, "the scene has fewer than three rooms - there is no crossing to refuse");
        const text = known => typeof M.notConnectedText === "function" ? M.notConnectedText(here, there, [next], known) : null;
        const listed = game.i18n.format("DRPG.Move.notConnected", { from: here, to: there, rooms: next });
        equal(stableJson([text(new Set([here, next])), text(new Set([here, there, next])), text(null)]),
            stableJson([game.i18n.format("DRPG.Move.cannotReach", { from: here }), listed, listed]),
            "a refusal named a destination the viewer has not found, or no longer names one they have");
        ok(/notConnectedText\(from, to, connected\)/.test(eclipse) && !/DRPG\.Move\.notConnectedShort/.test(eclipse),
            "the Eclipse's refusal does not go through notConnectedText, so it can still name an unknown room");
    }],

    ["the Rest window names no rest room the viewer has not found", async () => {
        /*
         * E06 C11, 28.09.2026; audit S07-19. The Rest window's hints and the refusal listed
         * every rest room on the map. Two rooms are marked for a Short Rest here and the list
         * is read for a viewer who has found one of them, none of them, and a GM's null.
         */
        const R = await import("./rest.mjs");
        const V = await import("./vault.mjs");
        const M = await import("./movement.mjs");
        const rooms = M.allRooms().slice(0, 2);
        must(rooms.length === 2, "the scene has fewer than two rooms - there is no list to filter");
        const regions = rooms.map(room => V.regionsByName().get(room));
        must(regions.every(Boolean), "a room has no region to mark");
        const key = `flags.${MODULE_ID}.${R.REST_FLAGS.short}`;
        const before = regions.map(region => region.getFlag(MODULE_ID, R.REST_FLAGS.short));
        try {
            for (const region of regions) await region.update({ [key]: true });
            await settle();
            const say = known => typeof R.restRoomsSentence === "function"
                ? R.restRoomsSentence("short", "DRPG.Rest.allowedIn", {}, known) : null;
            const all = R.restRooms("short");
            must(rooms.every(room => all.includes(room)), "the two rooms were not marked");
            equal(stableJson([say(new Set([rooms[0]])), say(new Set()), say(null)]), stableJson([
                game.i18n.format("DRPG.Rest.allowedIn", { rooms: rooms[0] }),
                game.i18n.localize("DRPG.Rest.noKnownRooms"),
                game.i18n.format("DRPG.Rest.allowedIn", { rooms: all.join(", ") })
            ]), "the Rest list named a room the viewer has not found, or hid one from a GM");
        } finally {
            for (const [i, region] of regions.entries()) {
                await region.update({ [key]: before[i] === undefined ? forcedDeletion() : before[i] });
            }
            await settle();
        }
    }],

    ["the Search window's modifier holds no stash", async () => {
        /*
         * E06 C11, 28.09.2026; audit S02-40. A hidden stash with something in it was the
         * third term of the count the roll window shows, and the window can be closed for
         * the action back - so opening a Search said whether somebody had hidden something
         * in the room, for nothing. Built here: the searcher's room a poor place for
         * usable things, and somebody else's hidden stash in it with one thing inside. The
         * window's part is the room's -1 alone; the stash's -1 comes after the roll. At
         * 1.2.64 the armed count was -2 and there was no second part.
         */
        const rolls = await import("./action-rolls.mjs");
        const V = await import("./vault.mjs");
        const INV = await import("./inventory.mjs");
        const { roomOfActor } = await import("./movement.mjs");
        const [who, owner] = cast(2);
        const room = roomOfActor(who);
        must(room, `${who.name} is not standing in a room`);
        const region = V.regionsByName().get(room);
        must(region, `${room} has no region`);
        const keys = [V.VAULT_FLAGS.stashes, V.VAULT_FLAGS.hinders, V.VAULT_FLAGS.favours];
        const before = keys.map(k => foundry.utils.deepClone(region.getFlag(MODULE_ID, k)));
        const path = k => `flags.${MODULE_ID}.${k}`;
        let item = null;
        try {
            await region.update({ [path(V.VAULT_FLAGS.stashes)]: [{ actorId: owner.id, concealed: true }],
                [path(V.VAULT_FLAGS.hinders)]: ["usable"], [path(V.VAULT_FLAGS.favours)]: [] });
            item = await INV.grantItem(owner, { name: "SUITE C11 hidden", category: "usable", tier: 1, override: true, quiet: true });
            must(item, "the stash's thing was not made");
            await item.update({ [path(INV.ITEM_FLAGS.location)]: INV.LOCATIONS.vault, [path(INV.ITEM_FLAGS.stashRoom)]: room });
            await settle();
            must(V.stashItemsIn(owner, room).length === 1, "the thing is not in the hidden stash");
            const odds = typeof rolls.searchOdds === "function" ? rolls.searchOdds(who, room, "usable", V) : null;
            equal(stableJson(odds && [odds.situational, odds.penalty, odds.stashOwner?.id, odds.stashLoot.map(i => i.id)]),
                stableJson([-1, -1, owner.id, [item.id]]), "the window's count holds the stash, or the stash lost its -1");
            const search = fnSource(stripComments((await moduleSources()).get("action-rolls.mjs") ?? ""), "performSearch");
            ok(/\{ situational, penalty\b[^}]*\} = searchOdds\(/.test(search)
                && [...search.matchAll(/armSituational\(([^)]*)\)/g)].map(m => m[1]).join() === "situational",
                "performSearch arms something other than searchOdds' situational part");
        } finally {
            if (item) await owner.items.get(item.id)?.delete();
            await region.update(Object.fromEntries(keys.map((k, i) => [path(k), before[i] === undefined ? forcedDeletion() : before[i]])));
            await settle();
        }
    }],

    ["a hidden stash's -1 lands on the total after the roll, and the card says so", async () => {
        /*
         * E06 C11, 28.09.2026; audit S02-40. The stash's -1 is taken off the total the tiers
         * read (`searchTier`), so at each band's lowest total it drops the Search a band;
         * the card carries a line saying so (`situationLine`), which every Search outcome
         * hands to `report`; and a Reroll scores the new dice with the same -1, which the
         * bookmark carries. The dice's own total, and the roll message, are left alone.
         */
        const rolls = await import("./action-rolls.mjs");
        const { ACTIONS } = await import("./config.mjs");
        const bands = [...ACTIONS.search.thresholds].sort((a, b) => a.min - b.min);
        must(bands.length >= 2, "Search has fewer than two bands");
        const tier = (total, penalty) => {
            const out = typeof rolls.searchTier === "function" ? rolls.searchTier({ total, isCritical: false }, penalty) : null;
            return out?.hit ? out.tier : null;
        };
        equal(stableJson(bands.map(b => [tier(b.min, 0), tier(b.min, -1)])),
            stableJson(bands.map((b, i) => [b.tier, i ? bands[i - 1].tier : null])),
            "the -1 did not move a Search down a band at the band's edge");
        const line = typeof rolls.situationLine === "function" ? [rolls.situationLine(-1, 11), rolls.situationLine(0, 12)] : null;
        equal(stableJson(line), stableJson([`<p><em>${game.i18n.format("DRPG.Action.situationAfterRoll", { n: "-1", total: 11 })}</em></p>`, ""]),
            "the card's line does not say the -1 and the total that counts, or says something with no penalty");
        const src = await moduleSources();
        const actions = stripComments(src.get("action-rolls.mjs") ?? "");
        const search = fnSource(actions, "performSearch");
        // And the GM's card for "something specific", which shows the tier beside the dice (E06 fix r2-G4; m5).
        const reports = ["searchNothing", "searchStash", "searchSpecific"].map(name =>
            /report\(actor, def, roll, \{[^}]*\bextra\b/.test(fnSource(actions, name)))
            .concat(/gmBody: `[\s\S]*?<\/p>\$\{extra\}`/.test(fnSource(actions, "searchSpecific")));
        const reroll = fnSource(stripComments(src.get("reroll.mjs") ?? ""), "settleSearch");
        equal(stableJson([/context: \{[^}]*\bpenalty\b/.test(search), /situationLine\(penalty, score\)/.test(search),
            /\bextra,/.test(search), reports, /searchTier\(after, penalty\b/.test(reroll)]),
            stableJson([true, true, true, [true, true, true, true], true]),
            "the bookmark, a Search card or the Reroll does not carry the -1");
    }],

    ["a GM report's document holds no words", async () => {
        /*
         * E06 C11, 28.09.2026; audit S17-32. `diagnoseMusic` and the season checklist
         * whispered their text with ChatMessage.create, and a whispered message is a
         * document every connected browser receives. Through `gmReport` the document is a
         * stub whispered to this GM and the words are in this GM's store - read back, so
         * the check is shown able to find them.
         */
        const { diagnoseMusic } = await import("./music.mjs");
        const { diagnoseCharacters } = await import("./diagnostics.mjs");
        const { wordsOf } = await import("./secret.mjs");
        const probe = async (make, title, phrase) => {
            const had = new Set(game.messages.contents.map(m => m.id));
            make();
            await until(() => game.messages.contents.some(m => !had.has(m.id)));
            await settle();
            const made = game.messages.contents.filter(m => !had.has(m.id));
            const doc = JSON.stringify(made.map(m => m.toObject()));
            const words = made.length === 1 ? String(await wordsOf(made[0], 2000) ?? "") : "";
            return [made.length, doc.includes(title), doc.includes(phrase), made[0]?.whisper ?? null, words.includes(title), words.includes(phrase)];
        };
        const music = await probe(() => diagnoseMusic(), game.i18n.localize("DRPG.Diagnostics.title.music"), "music follows the game state");
        const season = await probe(() => diagnoseCharacters({ toChat: true }), game.i18n.localize("DRPG.Diagnostics.title.season"), "Monokumas excluded");
        const want = [1, false, false, [game.user.id], true, true];
        equal(stableJson([music, season]), stableJson([want, want]),
            "a report's words are in its document, or not in this GM's store");
    }],

    ["the old cards' rewrite empties a roll the module threw, a private card's facts and a report, and reads them back", async () => {
        /*
         * E06 C12, 28.09.2026; the plan's section 3, the owner's Q1 (a). Messages as 1.2.64 left
         * them: a roll the module threw, aged back to naming its character - the speaker, the
         * flavour, the roll's title and its data's id and name, Daggerheart's title where the
         * message has one - and whispered to a player as well; a private card whose module flags
         * say its action, its tone, its sound and that it asked for a ruling, beside its thread;
         * a music report with its words as the content. `neutraliseOldCards` is handed them, not
         * the world's log. Read back from game.messages: the roll names nobody and is whispered to
         * the GMs alone; the card keeps what places it and `settled`, the report is the stub and a
         * private card; the report counts each, and a second run has nothing to do.
         *
         * WITH ROLLS NOT FORCED PRIVATE, AND A RULING STILL OPEN (E06 fix r2-G1, 28.09.2026; review
         * round 2's mn4 = m2 and mn3 = m3). The rewrite runs with `forcePrivateRolls` off, as a
         * table that turned it off after an incident upgrades: the roll whose list names a player
         * goes to the GMs alone all the same, and a second old roll the table saw (an empty list)
         * stays public. A GM-only ruling card nobody has settled - a trap's alert as `callGm` posts
         * one with no thread - keeps `callCard`, which a GM's log wires its buttons by, and loses
         * the rest. The setting is put back and the messages deleted.
         */
        const { neutraliseOldCards } = await import("./migrate.mjs");
        const { gmIds } = await import("./utils.mjs");
        const { STUB, cardFlag } = await import("./secret.mjs");
        needs(world.atLeast("playerAccounts", 1), "the old roll's whisper names a player");
        const [student] = cast(1);
        const player = game.users.find(u => !u.isGM);
        const TITLE = "SUITE C12 Strike";
        const forcedBefore = game.settings.get(MODULE_ID, SETTINGS.forcePrivateRolls);
        const made = [];
        // A roll the module threw, aged back to what 1.2.64 left: whether its message has Daggerheart's title.
        const age = async (roll, whisper) => {
            const src = roll.toObject();
            const entry = src.rolls[0];
            const aged = typeof entry === "string" ? JSON.parse(entry) : foundry.utils.deepClone(entry);
            aged.options = { ...(aged.options ?? {}), title: TITLE, headerTitle: TITLE,
                data: { ...(aged.options?.data ?? {}), id: student.id, name: student.name } };
            const hasSystem = Boolean(src.system && typeof src.system === "object");
            await roll.update({ speaker: { alias: student.name, actor: student.id, token: null, scene: null }, flavor: TITLE,
                whisper, rolls: [typeof entry === "string" ? JSON.stringify(aged) : aged], ...(hasSystem ? { "system.title": TITLE } : {}) });
            return hasSystem;
        };
        try {
            const roll = (await neutralRoll(student)).message;
            must(roll?.rolls?.length, "the student's roll made no message");
            made.push(roll);
            const hasSystem = await age(roll, [...gmIds(), player.id]);
            const shown = (await neutralRoll(student)).message;
            must(shown?.rolls?.length, "the student's second roll made no message");
            made.push(shown);
            await age(shown, []);
            const card = await ChatMessage.create({ content: STUB, whisper: [game.user.id], flags: { [MODULE_ID]: {
                secret: true, drpgMessage: true, thread: "SUITE-C12-thread", kind: "call", gmAsk: true, settled: true,
                popupTitle: "SUITE C12 Search", popupTone: "hope", sfx: "search", callCard: true } } });
            made.push(card);
            const ruling = await ChatMessage.create({ content: STUB, whisper: gmIds(), flags: { [MODULE_ID]: {
                secret: true, drpgMessage: true, callCard: true, gmPopup: true, popupTitle: "SUITE r2-G1 A ruling to make",
                sfx: { key: "gmAsk", gm: true } } } });
            made.push(ruling);
            const report = await ChatMessage.create({ whisper: [game.user.id],
                content: '<h3>Music diagnostics</h3><pre style="white-space:pre-wrap;font-size:0.85em">SUITE C12 the music report</pre>' });
            made.push(report);
            must(game.messages.get(roll.id)?.speaker?.actor === student.id && game.messages.get(shown.id)?.speaker?.actor === student.id
                && !game.messages.get(shown.id)?.whisper?.length && game.messages.get(card.id)?.flags?.[MODULE_ID]?.popupTitle
                && game.messages.get(ruling.id)?.flags?.[MODULE_ID]?.callCard
                && String(game.messages.get(report.id)?.content ?? "").includes("SUITE C12"), "the old cards were not planted as 1.2.64 left them");

            await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, false);
            const done = await neutraliseOldCards({ messages: made.map(m => game.messages.get(m.id)) });
            const r = game.messages.get(roll.id), s = game.messages.get(shown.id), c = game.messages.get(card.id);
            const g = game.messages.get(ruling.id), p = game.messages.get(report.id);
            const rolled = r.rolls[0]?.options ?? {};
            const whisper = Array.from(r.whisper ?? []);
            equal(stableJson([done, r.speaker?.actor ?? null, r.speaker?.alias, r.flavor ?? "", hasSystem ? r.system?.title ?? "" : "none",
                rolled.title, rolled.headerTitle, "id" in (rolled.data ?? {}), "name" in (rolled.data ?? {}),
                whisper.length > 0 && whisper.every(id => game.users.get(id)?.isGM), Array.from(s.whisper ?? []).length, s.speaker?.actor ?? null,
                Object.keys(c.flags?.[MODULE_ID] ?? {}).sort(), Object.keys(g.flags?.[MODULE_ID] ?? {}).sort(), Boolean(cardFlag(g, "callCard")),
                String(p.content).includes("SUITE C12"), String(p.content).includes("data-drpg-secret"), p.flags?.[MODULE_ID]?.secret === true]),
            stableJson([{ rolls: 2, cards: 2, reports: 1 }, null, game.i18n.localize("DRPG.Secret.speaker"), "", hasSystem ? "" : "none",
                "", "", false, false, true, 0, null, ["drpgMessage", "gmAsk", "kind", "secret", "settled", "thread"],
                ["callCard", "drpgMessage", "secret"], true, false, true, true]),
            "an old card still says what it said, lost what places it or wires it, or was not counted");
            equal(await neutraliseOldCards({ messages: made.map(m => game.messages.get(m.id)) }), null, "a second run of the rewrite found something to do");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.forcePrivateRolls, forcedBefore);
            for (const message of made) await game.messages.get(message.id)?.delete();
        }
    }],

    ["the old cards' rewrite that did not read back throws with the count, and the world is not stamped", async () => {
        /*
         * E06 C12, 28.09.2026; E05's lift pattern (fix r1-G1). With `ChatMessage.updateDocuments`
         * swallowed - a write that says it went through and did not - the rewrite reads its two
         * cards back unchanged and throws with the count; the runner, from a stamp of 1.2.63.5
         * (the stamp the pass over `liftDiscoveryLedger` above explains), fails the clause, names
         * it in a notice that stays, and leaves the stamp; the cards still say what they said.
         * With the writes back, the next run rewrites both. The runner's pass reads the whole
         * log but writes nothing, the writes being swallowed; the retry is handed the two cards.
         * The stamp is put back and the cards deleted.
         */
        const G = await import("./migrate.mjs");
        const { STUB } = await import("./secret.mjs");
        const stampBefore = getSetting(SETTINGS.migratedVersion);
        const ownUpdate = Object.hasOwn(ChatMessage, "updateDocuments"), realUpdate = ChatMessage.updateDocuments;
        const putBack = () => {
            if (ownUpdate) ChatMessage.updateDocuments = realUpdate;
            else delete ChatMessage.updateDocuments;
        };
        const notices = ui.notifications, realError = notices.error;
        const said = [];
        const made = [];
        const held = () => {
            const [card, report] = made.map(m => game.messages.get(m.id));
            return [Object.hasOwn(card?.flags?.[MODULE_ID] ?? {}, "popupTitle"), String(report?.content ?? "").includes("SUITE C12")];
        };
        try {
            made.push(await ChatMessage.create({ content: STUB, whisper: [game.user.id],
                flags: { [MODULE_ID]: { secret: true, drpgMessage: true, popupTitle: "SUITE C12 Search", popupTone: "fear" } } }));
            made.push(await ChatMessage.create({ whisper: [game.user.id],
                content: '<h3>Season setup</h3><pre style="white-space:pre-wrap;font-size:0.85em">SUITE C12 the season checklist</pre>' }));
            must(made.every(Boolean) && held().every(Boolean), "the old cards were not planted as 1.2.64 left them");
            ChatMessage.updateDocuments = async () => [];
            const threw = await thrown(() => G.neutraliseOldCards({ messages: made }));
            await game.settings.set(MODULE_ID, SETTINGS.migratedVersion, "1.2.63.5");
            notices.error = (text, options) => {
                said.push({ text: String(text), permanent: options?.permanent === true });
                return null;
            };
            const pass = await G.migrate1_2_0({ quiet: true, only: ["neutraliseOldCards"] });
            putBack();
            notices.error = realError;
            equal(stableJson([/^2 of 2 old chat card/.test(threw ?? ""), pass?.failed ?? null, getSetting(SETTINGS.migratedVersion), held(),
                said.some(n => n.text.includes("neutraliseOldCards") && n.permanent)]),
            stableJson([true, ["neutraliseOldCards"], "1.2.63.5", [true, true], true]),
            `the rewrite that did not read back did not throw with its count, stamped the world, or was not named on screen: ${stableJson({ threw, pass, said })}`);

            const retried = await G.neutraliseOldCards({ messages: made.map(m => game.messages.get(m.id)) });
            equal(stableJson([retried, held()]), stableJson([{ rolls: 0, cards: 1, reports: 1 }, [false, false]]),
                "the next run did not rewrite the two cards");
        } finally {
            putBack();
            notices.error = realError;
            await game.settings.set(MODULE_ID, SETTINGS.migratedVersion, stampBefore);
            for (const message of made) await game.messages.get(message?.id ?? "")?.delete();
        }
    }],

    ["the old cards' rewrite veils the cards posted veiled today and keeps a receipt's thread with its words", async () => {
        /*
         * E06 fix r2-G1, 28.09.2026; review round 2's MJ1. Messages as 1.2.64 left them, handed to
         * `neutraliseOldCards`. Veiled today, and so to be veiled: a trap's receipt in a player's
         * thread as `callGm` posted it then - an ordinary private card, its thread and the player
         * on its document - with its Plant button in the words this GM holds; a watching trap's
         * receipt, which has no button and is known by its heading; a reshape card under a heading
         * in another language, known by its buttons; Confusion's card, known by its sound on the
         * document; a Loaded Die notice, known by its sentence; and the time of day told to an
         * incident's players. Not veiled today, and left: an Observe card in the same thread, and
         * the time of day's heading on a card to the GMs alone. And two rolls the module did not
         * throw, whose lists name another player beside the character's: a statistic the GM asked
         * a participant for in a fight, whose list loses that player, and a Monocub's, whose room
         * then is not known now, which keeps its list. Read back: the six are veiled - the whole
         * table on the list, nobody speaking, none of their flags on the document - and the plant
         * receipt's thread is still this GM's to read, from the meta its pinned words were given,
         * and was sent with them to its player, whose copy has no button. A second run has
         * nothing to do. The flag is put back and the messages deleted.
         */
        needs(world.atLeast("playerAccounts", 2), "a thread's player and another participant");
        const { neutraliseOldCards } = await import("./migrate.mjs");
        const { gmIds, cardHead, ownerOf } = await import("./utils.mjs");
        const { timeOfDayLabel } = await import("./clock.mjs");
        const S = await import("./secret.mjs");
        const { threadMessages } = await import("./messenger.mjs");
        const [student, cub] = cast(2);
        const owner = ownerOf(student);
        must(owner, "the cast's first student has no player of its own - this measures nothing");
        const other = game.users.find(u => !u.isGM && u.id !== owner.id);
        const gms = gmIds();
        const speaker = ChatMessage.getSpeaker({ actor: student });
        const wasCub = Boolean(cub.getFlag(MODULE_ID, FLAGS.monocub));
        const made = [];
        const button = action => `<button type="button" class="drpg-call-action" data-drpg-call="${action}" data-project="SUITEPROJECT0001">${action}</button>`;
        const roll = async (actor, whisper) => ChatMessage.create({ content: "7", speaker: ChatMessage.getSpeaker({ actor }), whisper,
            rolls: [JSON.stringify({ formula: "1d12", total: 7, options: {} })] });
        try {
            const thread = { thread: owner.id, kind: "action", gmAsk: true };
            const inThread = content => S.postSecret({ whisper: [owner.id, ...gms], flags: { [MODULE_ID]: thread }, content });
            const armed = `<h3>${game.i18n.localize("DRPG.Trap.armedTitle")}</h3><p><strong>${student.name}</strong></p>`;
            made.push(await inThread(`${armed}<div class="drpg-call-actions">${button("plantTrapItem")}</div>`));
            made.push(await inThread(armed));
            made.push(await inThread(`<h3>SUITE a heading in another language</h3><p>SUITE a trace</p><div class="drpg-call-actions">${
                button("approveReshape")}${button("declineReshape")}</div>`));
            made.push(await ChatMessage.create({ content: S.STUB, speaker, whisper: [owner.id, ...gms],
                flags: { [MODULE_ID]: { secret: true, drpgMessage: true, sfx: "meddle" } } }));
            made.push(await S.postSecret({ whisper: [...gms, owner.id], speaker,
                content: `${cardHead({ action: game.i18n.localize("DRPG.Calls.freeCritTitle") })}<p>${
                    game.i18n.format("DRPG.Calls.freeCritUsed", { name: student.name })}</p>` }));
            const hour = `<h3>${timeOfDayLabel("morning")}</h3><p>SUITE the clock</p>`;
            made.push(await S.postSecret({ whisper: [...gms, owner.id, other.id], content: hour }));
            made.push(await inThread("<h3>SUITE r2-G1 Observe</h3><p>SUITE what they asked</p>"));
            made.push(await S.postSecret({ whisper: gms, content: hour }));
            made.push(await roll(student, [...gms, owner.id, other.id]));
            await cub.setFlag(MODULE_ID, FLAGS.monocub, true);
            made.push(await roll(cub, [...gms, owner.id, other.id]));
            const [receipt, watching, reshape, meddle, loaded, clock, observe, clockGm, asked, cubRoll] = made;
            must(made.every(m => m?.id) && S.secretHtml(receipt)?.includes("plantTrapItem") && S.secretHtml(loaded) && S.secretHtml(clock)
                && receipt.getFlag(MODULE_ID, "thread") === owner.id && game.messages.get(asked.id)?.whisper?.includes(other.id)
                && game.messages.get(cubRoll.id)?.whisper?.includes(other.id), "the old cards were not planted as 1.2.64 left them - this measured nothing");
            let done = null;
            const sent = await wordsSent(async () => {
                done = await neutraliseOldCards({ messages: made.map(m => game.messages.get(m.id)) });
                await settle();
            });
            const everybody = stableJson(game.users.map(u => u.id).sort());
            const shape = message => {
                const m = game.messages.get(message.id);
                const own = m?.flags?.[MODULE_ID] ?? {};
                return [own.veiled === true, stableJson([...(m?.whisper ?? [])].sort()) === everybody, m?.speaker?.actor ?? null,
                    ["thread", "kind", "gmAsk", "sfx"].filter(key => Object.hasOwn(own, key))];
            };
            const listOf = message => [...(game.messages.get(message.id)?.whisper ?? [])].sort();
            const r = game.messages.get(receipt.id);
            const toPlayer = sent.find(w => w.id === receipt.id && w.to.includes(owner.id));
            equal(stableJson([done, [receipt, watching, reshape, meddle, loaded, clock].map(shape), shape(observe)[0], shape(observe)[3],
                shape(clockGm)[0], S.cardFlag(r, "thread"), threadMessages(owner.id).some(m => m.id === receipt.id),
                Boolean(S.secretHtml(r)?.includes("plantTrapItem")), Boolean(getSetting(SETTINGS.secretCards)?.[receipt.id]?.pin),
                toPlayer?.meta?.thread ?? null, Boolean(toPlayer?.html.includes("plantTrapItem")), listOf(asked), listOf(cubRoll)]),
            stableJson([{ rolls: 1, cards: 6, reports: 0 }, Array(6).fill([true, true, null, []]), false, ["thread", "kind", "gmAsk"],
                false, owner.id, true, true, true, owner.id, false, [...gms, owner.id].sort(), [...gms, owner.id, other.id].sort()]),
            `an old card today's code veils still names its people, one it does not was veiled, the receipt left its thread, or a roll's list is wrong: ${
                stableJson({ done, sent: sent.map(w => ({ id: w.id, to: w.to, meta: w.meta })) })}`);
            equal(await neutraliseOldCards({ messages: made.map(m => game.messages.get(m.id)) }), null, "a second run of the rewrite found something to do");
        } finally {
            if (Boolean(cub.getFlag(MODULE_ID, FLAGS.monocub)) !== wasCub) await cub.setFlag(MODULE_ID, FLAGS.monocub, wasCub);
            for (const message of made) await game.messages.get(message?.id ?? "")?.delete();
        }
    }],

    ["the armed Calls 1.2.64 wrote lose their buyer at the upgrade", async () => {
        /*
         * E06 fix r2-G1, 28.09.2026; review round 2's mn5 = m4: the `unsignArmedCalls` clause
         * (call-effects.mjs). A character's list of armed Calls as 1.2.64 wrote it - a Support
         * with its buyer in `from` - and an unlinked token of the same character whose delta
         * holds a Confusion as a bare object from before CALL-02, its Monocub in `from`: the
         * clause writes both back as lists without `from`, keeps everything else, says how many,
         * and a second run has nothing to do. Planted again with the actor's write swallowed, the
         * Call reads back still signed and the clause throws with the count. The flag is put
         * back as it was and the token deleted.
         */
        needs(world.atLeast("playerAccounts", 2), "a buyer who is not the character's player");
        const C = await import("./call-effects.mjs");
        const [who] = cast(1);
        const buyer = game.users.find(u => !u.isGM && !who.testUserPermission(u, "OWNER"));
        const scene = canvas.scene ?? game.scenes.contents[0];
        const before = foundry.utils.deepClone(who.getFlag(MODULE_ID, FLAGS.pendingCall) ?? null);
        const support = { key: "support", kind: "hope", grants: "advantage", amount: 1, nonce: "SUITENONCE000001" };
        const confusion = { key: "meddle", grants: "disadvantage", amount: -1 };
        const actor = game.actors.get(who.id);
        const ownUpdate = Object.getOwnPropertyDescriptor(actor, "update");
        let token = null;
        const listsNow = () => ({ actor: game.actors.get(who.id)?.flags?.[MODULE_ID]?.[FLAGS.pendingCall] ?? null,
            token: scene.tokens.get(token?.id ?? "")?.toObject()?.delta?.flags?.[MODULE_ID]?.[FLAGS.pendingCall] ?? null });
        try {
            await who.setFlag(MODULE_ID, FLAGS.pendingCall, [{ ...support, from: buyer.id }]);
            [token] = await scene.createEmbeddedDocuments("Token", [{ name: "SUITE unlinked", actorId: who.id, actorLink: false,
                x: 100, y: 100, width: 1, height: 1, hidden: true,
                delta: { flags: { [MODULE_ID]: { [FLAGS.pendingCall]: { ...confusion, from: "SUITEMONOCUB0001" } } } } }]);
            const planted = listsNow();
            must(planted.actor?.[0]?.from === buyer.id && planted.token?.from === "SUITEMONOCUB0001", "the signed Calls were not planted - this measured nothing");
            const report = await C.unsignArmedCalls();
            const after = listsNow();
            equal(stableJson([report?.unsigned >= 2, after.actor, after.token]), stableJson([true, [support], [confusion]]),
                `a Call written by 1.2.64 still names who bought it, or lost something else: ${stableJson({ report, after })}`);
            equal(await C.unsignArmedCalls(), null, "a second run of the clause found something to do");

            await who.setFlag(MODULE_ID, FLAGS.pendingCall, [{ ...support, from: buyer.id }]);
            actor.update = async () => actor;
            const threw = await thrown(() => C.unsignArmedCalls());
            ok(/^1 of 1 actor/.test(threw ?? ""), `the clause whose write did not read back did not throw with its count: ${threw}`);
        } finally {
            if (ownUpdate) Object.defineProperty(actor, "update", ownUpdate);
            else delete actor.update;
            if (before) await who.setFlag(MODULE_ID, FLAGS.pendingCall, before);
            else if (who.getFlag(MODULE_ID, FLAGS.pendingCall) !== undefined) await who.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            if (token) await scene.tokens.get(token.id)?.delete();
        }
    }],

    ["a repair 1.2.64 made of a secret project is sealed and renamed at the upgrade", async () => {
        /*
         * E06 fix r2-G1, 28.09.2026; review round 2's mn5 = m4: the `sealOldRepairs` clause
         * (projects.mjs). A secret project one player can see, sabotaged as 1.2.64 did it: a
         * public repair named "Repair: <the project>", tied to it both ways. With the countdowns'
         * and projectMeta's writes swallowed the clause reads its repair back unsealed and throws
         * with the count; with them back the repair is secret, seen by that player and not by
         * another, and named "Repair" alone, the report counts it, and a second run has nothing
         * to do. Both projects are deleted and projectMeta put back.
         */
        needs(world.atLeast("playerAccounts", 2), "a player who can see the project and one who cannot");
        const P = await import("./projects.mjs");
        const [viewer, outsider] = game.users.filter(u => !u.isGM);
        const NAME = "SUITE r2-G1 hidden work";
        const meta = foundry.utils.deepClone(P.projectMeta());
        const settings = game.settings;
        const ownSet = Object.getOwnPropertyDescriptor(settings, "set"), realSet = settings.set;
        const putBack = () => {
            if (ownSet) Object.defineProperty(settings, "set", ownSet);
            else delete settings.set;
        };
        const made = [];
        let threw = null, report = null, again = null, sealed = null;
        try {
            const target = await P.createProject({ name: NAME, target: 6, secret: true, viewers: [viewer.id] });
            must(target?.id, "could not create a secret project");
            made.push(target.id);
            const repair = await P.createProject({ name: game.i18n.format("DRPG.Project.repairName", { name: NAME }), target: 3, glyph: "tamper" });
            must(repair?.id, "could not create the old repair");
            made.push(repair.id);
            await P.setProjectMeta(repair.id, { repairs: target.id });
            await P.setProjectMeta(target.id, { frozenBy: repair.id });
            must(P.isSecret(target.id) && !P.isSecret(repair.id) && P.canSee(repair.id, outsider), "the old repair was not planted public - this measured nothing");
            settings.set = async function (namespace, key, value, ...rest) {
                return namespace === MODULE_ID && key !== SETTINGS.projectMeta ? realSet.call(this, namespace, key, value, ...rest) : value;
            };
            try {
                threw = await thrown(() => P.sealOldRepairs());
            } finally {
                putBack();
            }
            report = await P.sealOldRepairs();
            sealed = [P.isSecret(repair.id), P.allProjects().find(p => p.id === repair.id)?.name ?? null, P.canSee(repair.id, viewer), P.canSee(repair.id, outsider)];
            again = await P.sealOldRepairs();
        } finally {
            putBack();
            for (const id of made) await P.deleteProject(id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
        equal(stableJson([/^1 of 1 repair/.test(threw ?? ""), report?.sealed ?? null, sealed, again]),
            stableJson([true, 1, [true, game.i18n.localize("DRPG.Project.repairNameSecret"), true, false], null]),
            `a repair 1.2.64 made of a secret project is still public or named, or the clause that did not read back did not throw: ${
                stableJson({ threw, report, sealed, again })}`);
    }],

    /* The incident's invariant grid (E32 C1, 28.09.2026; audit S17-10): one entry per
       case, in its own file - tests-grid.mjs says what it asks and why. */
    ...GRID
];

export { SCENARIOS, snapshot, restore };
