/**
 * Danganronpa RPG — the regression suite.
 * ---------------------------------------------------------------------------
 *     game.drpg.runTests()            everything
 *     game.drpg.runTests({ tier: 1 }) invariants only, world untouched
 *
 * WHAT IS IN HERE AND WHY. Not "coverage" — the things that have actually been
 * broken. Every tier-2 scenario below is a bug somebody hit at the table or a
 * measurement that caught the module lying: the killers' side acting twice per
 * round, a Finishing Blow that announced a death and left the victim standing,
 * a body nobody could discover, Observe reaching past the murder for a trace
 * from three days earlier. A suite written from the feature list would have
 * passed on every one of those, because each was a function doing exactly what
 * it said while the rules underneath it were wrong.
 *
 * TWO TIERS, and the split is about consequences, not speed.
 *
 *   Tier 1 reads. It cannot change the world, so it is safe to run at any point
 *          in a session, including during play.
 *   Tier 2 writes. It opens incidents, kills people and resets seasons — so it
 *          builds its own fixtures, records what it displaced, and puts
 *          everything back. Never run it in a world somebody is playing in.
 *
 * NO DICE. Every scenario drives the resolver directly with a total, because a
 * roll dialog needs a browser tab that is compositing frames and a suite that
 * only passes in a foreground window is a suite that fails in CI and in a
 * backgrounded tab for reasons that have nothing to do with the module.
 */

import { MODULE_ID, STARTING, CRISIS_ACTIONS, ACTIONS, TRAITS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { detectPageTinting } from "./diagnostics.mjs";
import { voiceTargets, liveKitRoomFor } from "./voice.mjs";
import { log, warn } from "./utils.mjs";

/* ==========================================================================
 * HARNESS
 * ========================================================================== */

class Failure extends Error {}

function ok(condition, message) {
    if (!condition) throw new Failure(message);
}

function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Failure(`${message} — expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`);
    }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/** Let a world write land on this client before reading it back. */
const settle = () => wait(400);

/* ==========================================================================
 * TIER 1 — INVARIANTS
 * ========================================================================== */

const INVARIANTS = [
    ["every action definition has a label and a cost", () => {
        for (const [key, def] of Object.entries(ACTIONS)) {
            ok(def.label, `${key} has no label`);
            ok(typeof def.cost === "number", `${key} has no numeric cost`);
        }
    }],

    ["every crisis action names a side the engine knows", () => {
        const sides = new Set(["killer", "victim", "third"]);
        for (const [key, def] of Object.entries(CRISIS_ACTIONS)) {
            ok(sides.has(def.side), `${key} has side "${def.side}"`);
            ok(def.label, `${key} has no label`);
            // A rolled action needs something to roll and something to beat.
            if (!def.noRoll && key !== "finishingBlow") {
                ok(def.traits?.length, `${key} rolls but names no trait`);
                ok(typeof def.threshold === "number", `${key} rolls but has no threshold`);
            }
        }
    }],

    ["every trait a definition names actually exists", () => {
        const known = new Set(Object.keys(TRAITS));
        const check = (source, label) => {
            for (const [key, def] of Object.entries(source)) {
                for (const trait of def.traits ?? []) {
                    ok(known.has(trait), `${label} ${key} names unknown trait "${trait}"`);
                }
            }
        };
        check(ACTIONS, "action");
        check(CRISIS_ACTIONS, "crisis action");
    }],

    ["the crisis briefing can be built for every action", () => {
        // The briefing reads `hint`, `failure` and the threshold. A definition
        // missing all three renders an empty window, which is how the crisis
        // actions went to the dice with nothing said about them for months.
        for (const [key, def] of Object.entries(CRISIS_ACTIONS)) {
            ok(def.hint || def.failure, `${key} has neither a hint nor a failure line`);
        }
    }],

    ["a critical Strike knows how much it takes", () => {
        const strike = CRISIS_ACTIONS.strike;
        ok(strike.damage?.critical?.choice, "Strike's critical no longer offers a choice");
        ok(typeof strike.damage.criticalAmount === "number",
            "Strike offers a choice but does not say how many marks it moves");
    }],

    ["every string the code asks for exists in the language file", () => {
        // Only the keys spelled out as literals — a key built from a variable
        // cannot be checked from here, and pretending otherwise would make this
        // test lie in the reassuring direction.
        const missing = [];
        for (const key of LITERAL_KEYS) {
            if (!game.i18n.has(key)) missing.push(key);
        }
        ok(!missing.length, `missing: ${missing.slice(0, 8).join(", ")}`);
    }],

    ["the theme tokens resolve", () => {
        const root = getComputedStyle(document.documentElement);
        for (const token of ["--drpg-ink", "--drpg-bone", "--drpg-eye", "--drpg-blood",
                             "--drpg-gold", "--drpg-pix-skull", "--drpg-pix-query"]) {
            ok(root.getPropertyValue(token).trim(), `${token} is empty`);
        }
    }],

    ["nothing is repainting the page", () => {
        // Not a module bug when it fails — but every colour measurement in this
        // suite and every visual judgement at the table is worthless while it is
        // true, so it is worth saying out loud. See `detectPageTinting`.
        const tint = detectPageTinting();
        ok(!tint, `${tint?.name} is restyling the page — ${tint?.evidence}`);
    }],

    ["no Remnant token carries the answer key", () => {
        // The leak this suite exists to keep shut. A Remnant token travels to
        // every client, hidden or not, so anything on it beyond the marker is
        // readable from a player's console — measured before the fix: forty
        // traces with who left each one, whether it belonged to the murder, and
        // the GM's own sentence about it.
        const leaks = [];
        for (const scene of game.scenes) {
            for (const token of scene.tokens) {
                if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
                const keys = Object.keys(token.flags?.[MODULE_ID] ?? {})
                    .filter(k => k !== "isRemnant");
                if (keys.length) leaks.push(`${token.name}: ${keys.join(", ")}`);
            }
        }
        ok(!leaks.length, `${leaks.length} token(s) still carry it — ${leaks[0]}`);
    }],

    ["a Remnant token's name gives nothing away", () => {
        // The name used to BE the answer: "Obvious Faint Prep Remnant · Player B
        // · Search: Cleaning agent". Names travel with the token — and so does
        // the DELTA, which is where the legacy placement path kept the same
        // label as the unlinked actor's name (`token.delta.name`), readable
        // from a player's console while `token.name` said a perfectly safe
        // "Trace" over it. Both halves are scanned, or the second one leaks
        // for exactly as long as nobody thinks to look at it.
        const expected = game.i18n.localize("DRPG.Remnant.tokenName");
        const talkative = [];
        for (const scene of game.scenes) {
            for (const token of scene.tokens) {
                if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
                if (token.name !== expected) talkative.push(token.name);
                const deltaName = token.delta?.name;
                if (typeof deltaName === "string" && deltaName && deltaName !== expected) {
                    talkative.push(`delta: ${deltaName}`);
                }
            }
        }
        ok(!talkative.length, `${talkative.length} named for what they are — "${talkative[0]}"`);
    }],

    ["one account is only ever sent to one voice room", async () => {
        // A voice client is in a single breakout at a time. The loop used to
        // walk the ACTOR list and assign per actor, so an account owning two
        // characters in two rooms was sent to both on every pass — a full
        // disconnect and reconnect twice a minute, forever, which at the table
        // is a dropout every sixty seconds for one unlucky player.
        const { rows, byUser } = await voiceTargets();

        for (const [userId, chosen] of byUser) {
            const theirs = rows.filter(r => r.user?.id === userId);
            ok(theirs.includes(chosen),
                `${game.users.get(userId)?.name}'s room comes from no character of theirs`);
        }

        // And the same answer every time, or the "conflict" is really a coin
        // flip that reads as an assignment randomly not sticking.
        const again = await voiceTargets();
        for (const [userId, chosen] of byUser) {
            equal(again.byUser.get(userId)?.target ?? null, chosen.target ?? null,
                `${game.users.get(userId)?.name} is assigned a different room on a second pass`);
        }
    }],

    ["two rooms never share one voice channel", () => {
        // Room names are slugged, and a slug throws away everything that is not
        // a letter or a digit — so "Kitchen" and "Kitchen " were two rooms
        // everywhere else in this module and ONE room to LiveKit. Everybody in
        // them heard each other, silently, in the subsystem whose whole purpose
        // is that they should not.
        const scene = game.scenes.contents[0]?.id ?? "scene";
        const names = ["Kitchen", "Kitchen ", "Kitchen!", "kitchen", "Dorm A", "Dorm-A", "第一教室", "教室"];
        const seen = new Map();
        for (const name of names) {
            const room = liveKitRoomFor(scene, name);
            ok(!seen.has(room), `"${name}" and "${seen.get(room)}" both map to ${room}`);
            seen.set(room, name);
        }

        // Every real room on every scene, held to the same rule.
        for (const s of game.scenes) {
            const used = new Map();
            for (const region of s.regions ?? []) {
                if (!region.name) continue;
                const room = liveKitRoomFor(s.id, region.name);
                const clash = used.get(room);
                // Two regions with the SAME name are one room on purpose — a
                // corridor drawn in two pieces. Two different names are not.
                ok(clash === undefined || clash === region.name,
                    `"${s.name}": "${region.name}" and "${clash}" share a voice room`);
                used.set(room, region.name);
            }
        }
    }],

    ["the clock has one definition of its defaults", () => {
        const clock = getClock();
        for (const field of ["chapter", "day", "session", "timeOfDay", "phase"]) {
            ok(clock[field] !== undefined, `getClock() returns no ${field}`);
        }
    }]
];

/**
 * i18n keys worth checking, gathered by hand.
 *
 * Deliberately not scraped from the source at runtime: the scrape would have to
 * run over files this module cannot read from the browser, and a half-scrape
 * that quietly checks forty keys out of six hundred reads as a pass.
 */
const LITERAL_KEYS = [
    "DRPG.Murder.victimUnderAttack", "DRPG.Murder.victimTrapSprung",
    "DRPG.Murder.briefThreshold", "DRPG.Murder.briefRoll", "DRPG.Murder.briefTake",
    "DRPG.Murder.criticalChoiceTitle", "DRPG.Murder.criticalChoiceHp", "DRPG.Murder.criticalChoiceStress",
    "DRPG.Murder.betrayTileLabel", "DRPG.Murder.betrayTileHint",
    "DRPG.Murder.ranOutTwoKillers", "DRPG.Murder.ranOutEndNow", "DRPG.Murder.ranOutKeepGoing",
    "DRPG.Calls.silencedBadge", "DRPG.Calls.chainedBadge",
    "DRPG.Monocub.silencedBadge", "DRPG.Monocub.silencedTooltip",
    "DRPG.Remnant.cardTitle", "DRPG.Remnant.cardWhat", "DRPG.Remnant.cardPlayer",
    "DRPG.Project.proposalTitle", "DRPG.Project.approveButton", "DRPG.Project.declineButton",
    "DRPG.Project.proposeButton", "DRPG.Project.createButton",
    "DRPG.Season.title", "DRPG.Season.resetTitle", "DRPG.Season.resetWord",
    "DRPG.Season.step.resources", "DRPG.Season.hint.resources",
    "DRPG.Diagnostics.pageTinted"
];

/* ==========================================================================
 * TIER 2 — SCENARIOS
 * ========================================================================== */

/**
 * Everything a scenario is allowed to disturb, recorded so it can be put back.
 *
 * The clock and the incident are world settings; resources are actor data. A
 * scenario that throws half way through still gets restored, because the restore
 * runs from `finally` in the runner rather than at the end of the test.
 */
async function snapshot(cast) {
    return {
        clock: foundry.utils.deepClone(getClock()),
        murder: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}),
        // HOPE AS WELL AS THE TWO REVERSE RESOURCES.
        //
        // It was missing, and the suite therefore paid its fixture actor one
        // Hope per run and never took it back. Measured: three students set to
        // 3, one clean 22/22 pass, and the roller came out at 4 while the other
        // two were untouched — so three runs in an afternoon leave a character
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
            deceased: a.getFlag(MODULE_ID, "deceased") ?? null
        })),
        // WHICH TOKENS AND MESSAGES EXISTED, not how many.
        //
        // An incident drops Remnants of its own — the opening roll leaves one,
        // every crisis action can leave another — and they are world objects
        // that outlive the test and change what the NEXT measurement sees. The
        // first version of this suite passed all six scenarios and left three
        // Remnants behind, which is the failure this file's own header warns
        // about. Recorded as ids rather than a count so the restore removes
        // exactly what appeared and never touches anything that was already
        // there.
        // `game.scenes` is a Foundry Collection, which has `map` and `filter`
        // but NOT `flatMap` — the first version used it, threw inside the
        // snapshot, and the runner reported one failure and skipped every
        // scenario. A suite that silently runs nothing reads almost the same as
        // a suite that passes, which is why the runner names the step.
        remnants: new Set(game.scenes.reduce((ids, scene) => {
            for (const token of scene.tokens) {
                if (token.getFlag(MODULE_ID, "isRemnant")) ids.push(`${scene.id}.${token.id}`);
            }
            return ids;
        }, [])),
        messages: new Set(game.messages.map(m => m.id))
    };
}

async function restore(snap) {
    const { reviveCharacter } = await import("./chapter.mjs");
    await game.settings.set(MODULE_ID, SETTINGS.murderState, snap.murder);
    const { clearBlackened } = await import("./murder.mjs");
    await clearBlackened();

    for (const row of snap.resources) {
        const actor = game.actors.get(row.id);
        if (!actor) continue;
        if (!row.deceased && actor.getFlag(MODULE_ID, "deceased")) await reviveCharacter(actor);
        await actor.update({
            "system.resources.hitPoints.value": row.hp,
            "system.resources.stress.value": row.stress,
            "system.resources.hope.value": row.hope
        });
    }
    // Anything that appeared while the scenario ran, removed.
    for (const scene of game.scenes) {
        const strays = scene.tokens
            .filter(t => t.getFlag(MODULE_ID, "isRemnant") && !snap.remnants.has(`${scene.id}.${t.id}`))
            .map(t => t.id);
        if (strays.length) await scene.deleteEmbeddedDocuments("Token", strays);
    }

    // The chat the scenarios produced. Kept out of the log on purpose: a suite
    // that leaves forty whispers behind makes the log useless for the session
    // that follows it, and none of them are a record of anything that happened.
    const strayMessages = game.messages.filter(m => !snap.messages.has(m.id)).map(m => m.id);
    if (strayMessages.length) await ChatMessage.deleteDocuments(strayMessages);

    await setClock(snap.clock);
    await settle();
}

/** Three students to play with, or the scenarios cannot run. */
function cast() {
    const roster = studentActors();
    if (roster.length < 3) throw new Failure(`need three students, found ${roster.length}`);
    return roster.slice(0, 3);
}

const SCENARIOS = [
    ["a direct murder opens on the killer and tells the victim", async () => {
        const [killer, victim] = cast();
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

        const told = [...game.messages].slice(before).some(m =>
            m.whisper.includes(game.users.find(u => victim.testUserPermission(u, "OWNER"))?.id ?? "")
            || /moving on you/i.test(m.content ?? ""));
        ok(told, "the victim was never told the incident began");
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

        // The victim's turn always passes to the FIRST killer — not to
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
        // victim, killer(B) — the victim got a breather neither killer earned,
        // and the round advanced twice for one lap of the killers. The second
        // killer's turn must follow the first DIRECTLY, with the round number
        // unmoved.
        await drpg.passTurn();
        await settle();
        state = murder.murderState();
        equal(state.turnSide, "killer", "the second killer's turn follows the first directly, not the victim's");
        equal(state.killerTurnId, third.id, "turn hands to the second killer");
        equal(state.turn, startTurn, "the round has not advanced — the killers' side is not done yet");
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

    ["a Finishing Blow actually kills", async () => {
        const [killer, victim] = cast();
        const drpg = game.drpg;
        const { isDeceased } = await import("./chapter.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await drpg.passTurn();
        await settle();

        ok(!isDeceased(victim), "the victim started the test dead");
        await drpg.resolveCrisisAction({
            actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true
        });
        await wait(1600);

        equal(drpg.murderState()?.stage, "resolution", "stage after the blow");
        ok(isDeceased(victim), "the victim is not recorded dead");
        ok(victim.effects.some(e => e.statuses?.has?.("dead")), "no dead marker on the token");
    }],

    ["openMurder refuses during an Eclipse, but not once one has actually ended", async () => {
        // `judgePendingMurders` (eclipse.mjs) is the one legitimate call to
        // `openMurder` that happens WHILE an Eclipse is closing — a Direct
        // Murder declared in the dark is parked, not opened, and only judged
        // from inside `endEclipse`, after the clock has already cleared the
        // Eclipse flag. This pins both halves of that: the new guard actually
        // refuses while the flag is set, and the flag really is gone by the
        // time `endEclipse` would call `openMurder` for a parked declaration —
        // so the guard added for this bug fix cannot silently swallow the one
        // call it is supposed to let through.
        const [killer, victim] = cast();
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
        // exactly why the bug — `remnantData()` returning null for anybody else
        // — never showed up running this suite as the world's GM. What this
        // scenario actually pins down is the shape `cleanableTracesForPlayer`
        // hands back over the bridge: it is what a player's client receives
        // instead, and it must never carry the answer key.
        const [killer, victim] = cast();
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
            type: "prep", visibility: "evident", note: "test fixture — cleanup bridge"
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

        await murder.beginResolution("test");
        await settle();

        equal(murder.betrayalTarget(third)?.id, killer.id, "the accomplice turns on the killer");
        ok(!murder.betrayalTarget(killer), "the killer was offered a betrayal");
        ok(!murder.betrayalTarget(victim), "the victim was offered a betrayal");
    }],

    ["Observe ranks crime-tied traces first, then by difficulty", async () => {
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const scene = game.scenes.active;

        // Build the shelf instead of demanding the world already owns one. The
        // old form of this test asked the active scene for a room holding three
        // Remnants and failed on any world that had none — a clean world most
        // of all.
        //
        // Four traces at one point share a room by construction: the same hit
        // test answers for all of them, holes and all. The anchor is any token
        // already standing in a room, which spares this test owning any region
        // geometry of its own.
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "no token on the active scene stands in any room — nowhere to build the fixture");

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
                    note: "test fixture — Observe ranking"
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

    ["an Eclipse takes every voice off the rooms", async () => {
        // The Eclipse is the placement window. A voice channel that still
        // followed the rooms while the lights were out would be the one thing
        // in the building that could see in the dark — you would hear who came
        // in with you, and hear the room empty when somebody left.
        const before = await voiceTargets();
        ok(!before.eclipse, "an Eclipse was already running before the test began");
        const placed = [...before.byUser.values()].filter(r => r.room);
        ok(placed.length, "nobody is standing in a room, so there is nothing to take away");

        await setClock({ ...getClock(), eclipse: true });
        await settle();

        const during = await voiceTargets();
        ok(during.eclipse, "the clock says no Eclipse is running");

        const rooms = new Set();
        for (const [userId, row] of during.byUser) {
            equal(row.room, null, `${game.users.get(userId)?.name} is still placed in a room`);
            ok(row.target, `${game.users.get(userId)?.name} was left on an open channel`);
            // A scene id in the name would leak which map, and a slug would leak
            // which region — the two things the darkness is hiding.
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
    }]
];

/* ==========================================================================
 * RUNNER
 * ========================================================================== */

/**
 * Is a run already in flight on this client?
 *
 * TWO RUNS AT ONCE CORRUPT THE WORLD, and quietly. Measured: a probe that
 * appeared to time out was still running when a second `runTests()` was
 * started, and the pair reported 16/22 with six murder scenarios failing on
 * "stage after opening — expected openingRoll, measured undefined". Not one of
 * those failures was real. The Eclipse scenario sets `clock.eclipse` true for
 * the length of its own check, and `openMurder` refuses outright during an
 * Eclipse — so every murder scenario in the other run was declined by a gate
 * working exactly as designed.
 *
 * The damage outlives the run. `snapshot()` records the clock as the baseline
 * to put back, and the second run took its snapshot while the first was mid-
 * Eclipse: it then faithfully restored the world to a darkness that was a
 * fixture. The world was left with `eclipse: true` set, which is a state a GM
 * cannot easily see and which silently refuses every murder in the session
 * after it.
 *
 * So a second run is refused rather than queued. Queueing would be the wrong
 * answer for a suite whose whole contract is "the world is put back exactly as
 * it was found" — a caller who did not know the first run was in flight does
 * not want the second one to happen later either; they want to be told.
 */
let inFlight = false;

/**
 * @param {object} [options]
 * @param {1|2} [options.tier]  1 reads only; 2 also runs the scenarios.
 */
export async function runTests({ tier = 2 } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (inFlight) {
        const why = game.i18n.localize("DRPG.Tests.alreadyRunning");
        ui.notifications.warn(why);
        warn("Refused a second regression suite: one is already running on this client.");
        return { passed: 0, failed: 0, text: why, refused: true };
    }
    inFlight = true;
    try {
        return await runSuite(tier);
    } finally {
        inFlight = false;
    }
}

async function runSuite(tier) {
    const lines = [];
    let passed = 0, failed = 0;

    const record = (name, err) => {
        if (err) {
            failed++;
            lines.push(`  FAIL  ${name}`);
            lines.push(`        ${err instanceof Failure ? err.message : `threw: ${err?.message ?? err}`}`);
        } else {
            passed++;
            lines.push(`  ok    ${name}`);
        }
    };

    lines.push("TIER 1 — invariants (the world is not touched)");
    for (const [name, fn] of INVARIANTS) {
        try { await fn(); record(name, null); } catch (err) { record(name, err); }
    }

    if (tier >= 2) {
        lines.push("");
        lines.push("TIER 2 — scenarios (fixtures built and put back)");
        let snap = null;
        try {
            snap = await snapshot(studentActors());
        } catch (err) {
            lines.push(`  FAIL  could not record the world before testing: ${err.message}`);
            failed++;
        }

        if (snap) {
            for (const [name, fn] of SCENARIOS) {
                try {
                    await fn();
                    record(name, null);
                } catch (err) {
                    record(name, err);
                } finally {
                    // After EVERY scenario, not once at the end: a scenario that
                    // fails half way leaves an incident open, and the next one
                    // would then be testing the wreckage of the last.
                    try {
                        await game.drpg.endMurder({ reason: "test", followUp: false });
                        await restore(snap);
                    } catch (err) {
                        lines.push(`        (could not restore after "${name}": ${err.message})`);
                    }
                }
            }
        }
    }

    const summary = `${passed} passed, ${failed} failed`;
    const text = [`Danganronpa RPG — regression suite`, summary, "", ...lines].join("\n");
    console.log(text);
    if (failed) ui.notifications.warn(summary);
    else ui.notifications.info(summary);
    log(`Regression suite: ${summary}`);
    return { passed, failed, text };
}
