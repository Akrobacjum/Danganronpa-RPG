/**
 * Danganronpa RPG - the incident's invariant grid (E32 C1, 28.09.2026; audit S17-10).
 * ---------------------------------------------------------------------------
 * Tier 2, spread into tests-tier2.mjs's SCENARIOS: one entry per case, each a list
 * of steps driven through the module's own GM calls - the ones the bridge hands a
 * player's packet to once it has judged it - and after every step fourteen
 * invariants of the incident are asked of what the step left behind.
 *
 * WHY A GRID. Until 1.2.65 about 25 of tier 2's 211 scenarios touched the incident,
 * each one path and each asking what its own author thought to ask. The audit
 * (S17-10) found the bugs between them: a betrayal that opened its incident over the
 * last one without closing it, a Survive that made its victim's attacker a Blackened,
 * a trap whose builder held the turn. The grid runs every path it has through the same
 * questions, so a question added once is asked of all of them.
 *
 * THE ORACLE IS THE CASE'S OWN MODEL, NEVER THE MODULE. Each case keeps what the rules
 * say should now be true - the kind, the killers, the victim, the third and what they
 * chose, the stage, the body, the incidents opened and closed, the offer - and the steps
 * update it from the handbooks and the owner's decisions (the plan's 2.1). Four tables
 * are written here and not imported: `PUBLIC_FIELDS` (the world half), `FIGHT_FIELDS` (the
 * fight a seat's copy carries, E32 C2), `FRESH` (a new incident) and `seatsOf` (who holds
 * the cast, D6). A module answer read into the model
 * would make the grid agree with whatever the module does.
 *
 * WHAT A RED CASE SAYS. A case records every violation and fails once at the end, with
 * each as "I<n> at step <k> (<step>): <what>", sorted by invariant, under a head that
 * lists the invariants it broke, sorted, in brackets: "[I2, I6, I13] - ...". Its marker
 * in `GRID_RED` names that whole list (`failing`). The kit's judge reads `failing` as a
 * piece of the message, and the brackets make the piece the whole list: "[I13]" is a
 * piece of neither "[I2, I6, I13]" nor "[I1, I13]", and no `what` here writes an
 * invariant's name in brackets. Until fix r1-G5 (02.10.2026; review C-m4) the head was
 * the bare list and each marker named one invariant of it, so a red case that started
 * breaking another stayed red: TP08 was red on I2, I6 and I13 under a marker that named
 * I13 alone (suite of 73b1e89, e32run/g4f3). A marker whose `failing` is not such a list
 * throws, so its case FAILs (`runCase`). A case whose stage leaves the model's (I10)
 * stops there: the steps after it were written for the stage the model holds, and
 * driving them on another would measure the fixture.
 *
 * WHAT IT CANNOT SEE. While tier 2 runs the GM stores send nothing (`gmStoresQuiet`), so
 * no `incident.myCast` packet leaves the GM: I2 reads `castFor` - what each holder would
 * be sent - and checks any packet that does go against the seats as well. Whom
 * `castOwners` seats is not exported and is not read here; 13-murder-signals reads the
 * packets a player's browser receives. No layout, no dice: every roll is a total handed to the
 * GM's half, as the existing incident scenarios do.
 */

import { MODULE_ID, KEY_REMNANTS } from "./config.mjs";
import { SETTINGS, incidentCast } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { ownerOf } from "./utils.mjs";
import { ok, must, needs, world, wait, until, expectedRed } from "./tests-kit.mjs";

/* ==========================================================================
 * THE TABLES (the plan's 2.1), written from the handbooks, not imported
 * ========================================================================== */

/** What the world half of an incident may hold (murder.mjs `PUBLIC_INCIDENT`, E05 C8; the stage alone since E32 C2), as the grid's own list. */
const PUBLIC_FIELDS = Object.freeze(["active", "stage"]);

/**
 * The fight, which the copy of every seat that fought it carries (E32 C2; gm-stores.mjs
 * `INCIDENT_FIGHT`), as the grid's own list: the round and the side to act are what both
 * sides' panels read. The Key Remnants' count is in it and in no player's copy - what the
 * opening bought is the GMs' (fix r1-G1).
 */
const FIGHT_FIELDS = Object.freeze([
    "turn", "turnSide", "keyRemnants", "deniedToVictim", "hindered", "blocked",
    "unlocked", "spent", "drainStopped", "advantageNext", "freeResolution", "thirdActed"
]);

/** The parts that say who is in it (gm-stores.mjs `CAST_SEATS`), as the grid's own list: all a packet with no seat in it is stamped with. */
const SEAT_PARTS = Object.freeze(["killerId", "victimId", "thirdId", "betrayal"]);

const none = v => v === undefined || v === null;
const emptyList = v => none(v) || (Array.isArray(v) && !v.length);
const emptySides = v => none(v) || Object.values(v).every(side => !side || !Object.keys(side).length);

/**
 * WHAT A NEW INCIDENT HOLDS. A field absent reads as the default every reader applies
 * (`?? []`, `?? null`, `?? false`), so absent passes where the default does. A field of
 * the merged state that is in neither this table nor `KEPT` fails as unknown: the next
 * field an incident gains is declared here in the commit that adds it (C9, C10, C11c,
 * C13 and C17 do, with `freshIncidentState`).
 */
const FRESH = Object.freeze({
    active: v => v === true,
    stage: v => v === "openingRoll",
    turn: v => v === 0,
    turnSide: v => v === "victim",
    killerId: (v, m) => v === m.killerId,
    victimId: (v, m) => v === m.victimId,
    killerTurnId: (v, m) => v === m.killerId,
    thirdId: none,
    thirdSide: none,
    thirdActed: v => !v,
    keyRemnants: v => v === KEY_REMNANTS.prepared,
    deniedToVictim: emptyList,
    hindered: emptySides,
    blocked: emptySides,
    unlocked: emptyList,
    spent: emptyList,
    drainStopped: v => !v,
    // Per side, the action a Hope miss earned a second try at (E32+E07 C9): none yet.
    advantageNext: v => none(v) || (none(v.victim) && none(v.killer)),
    freeResolution: none,
    lastCrisis: none,
    swung: v => none(v) || !Object.keys(v).length,
    endedBy: none,
    keyRemnantsStale: none,
    indirect: (v, m) => Boolean(v) === (m.kind === "trap"),
    selfInflicted: (v, m) => Boolean(v) === (m.kind === "self"),
    openedAt: (v, m, run) => typeof v === "number" && v >= run.stepStarted
});

/** Kept across an open on purpose: the betrayal offer outlives its incident until the day turns (D18). */
const KEPT = Object.freeze(["betrayal"]);

/** The killers of an incident as the rules count them: the killer, and a third who threw in with them. */
const killersOf = m => [m.killerId, ...(m.thirdId && m.thirdSide === "killer" ? [m.thirdId] : [])];

/**
 * WHO HOLDS THE CAST, BY STAGE (D6, gm-handbook 13.1). A direct murder's opening: its
 * killers. A trap's opening: its victim, who is rolling. The fight: a direct murder's
 * killer, victim and third; a trap's victim and a third not on the builder's side - the
 * builder is not in the room. Stage 6: everyone named. Actor ids.
 */
function seatsOf(m) {
    if (!m) return [];
    const third = m.thirdId, kills = m.thirdSide === "killer";
    let seats;
    if (m.stage === "openingRoll") seats = m.kind === "trap" ? [m.victimId] : [m.killerId, kills ? third : null];
    else if (m.stage === "incident") seats = m.kind === "trap" ? [m.victimId, kills ? null : third] : [m.killerId, m.victimId, third];
    else seats = [m.killerId, m.victimId, third];
    return [...new Set(seats.filter(Boolean))];
}

/** The fourteen questions, as a failure names them. */
const INVARIANTS = Object.freeze({
    I1: "the world half holds only the public fields",
    I2: "the cast reaches only its seats",
    I3: "a new incident starts fresh",
    I4: "each incident closes once",
    I5: "the Blackened grow by the killers of a body",
    I6: "the betrayal offer stands exactly when the rules give it",
    I7: "no card names a participant as its speaker",
    I8: "a body is dead for the GMs and not the table's until found",
    I9: "the side to act can act",
    I10: "the stage is the model's",
    I11: "Role reversal is off in a trap and with an accomplice",
    I12: "a close breaks the swung weapons, a discovery the cleaning tools",
    I13: "a third who left stays out",
    I14: "a victim runs out once: one ran-out card, one death"
});

/* ==========================================================================
 * THE CASES (the plan's 2.3). Steps are [verb, ...args]; the letters are the
 * case's people: K the killer, V the victim, T a third, F a fourth.
 * ========================================================================== */

const CASES = {
    // Direct, no third.
    DM01: { title: "a direct murder whose opening fails", steps: [["open"], ["opening", "fail"]] },
    DM02: { title: "a Finishing blow, the killer's gloves, the close and then the discovery",
        steps: [["gear", "K", "gloves"], ["open"], ["opening", "hope"], ["act", "K", "finishingBlow"], ["close"], ["discover"]] },
    DM03: { title: "a Despair opening, Self-defence with Fear, then the blow",
        steps: [["open"], ["opening", "despair"], ["act", "V", "selfDefence", "hitFear"], ["act", "K", "finishingBlow"], ["close"]] },
    DM04: { title: "Self-defence, then Survive", steps: [["open"], ["opening", "hope"], ["act", "V", "selfDefence"], ["act", "V", "survive"], ["close"]] },
    DM05: { title: "the victim runs out", steps: [["open"], ["opening", "hope"], ["runOut"], ["close"]] },
    DM06: { title: "the GM closes it at the opening roll", steps: [["open"], ["close"]] },
    DM07: { title: "the GM closes it in the fight", steps: [["open"], ["opening", "hope"], ["act", "V", "leaveClue"], ["close"]] },
    DM08: { title: "Role reversal with Hope, then the former victim's blow",
        steps: [["open"], ["opening", "hope"], ["act", "V", "selfDefence"], ["act", "V", "roleReversal"], ["act", "V", "finishingBlow"], ["close"]] },
    DM09: { title: "a critical Self-defence, then the free Survive",
        steps: [["open"], ["opening", "hope"], ["act", "V", "selfDefence", "crit"], ["act", "V", "survive", "hit", { free: true }], ["close"]] },
    DM10: { title: "a blow that killed: its Reroll refused, the death stands",
        steps: [["open"], ["opening", "hope"], ["act", "K", "finishingBlow"], ["reroll", "K", "finishingBlow", "hit"], ["close"]] },
    // E32+E07 C9 (S04-42): the victim acts on after the killer's death, and the turn skips the dead.
    DM11: { title: "the killer dies in the fight",
        steps: [["open"], ["opening", "hope"], ["act", "V", "leaveClue"], ["listDeath", "K"], ["act", "V", "leaveClue"], ["close"]] },
    DM12: { title: "the victim dies from the Students list in the fight", steps: [["open"], ["opening", "hope"], ["listDeath", "V"], ["close"]] },
    DM13: { title: "a Tier 1 knife in hand and a failed opening", steps: [["gear", "K", "knife"], ["open"], ["opening", "fail"]] },
    DM14: { title: "the victim runs out while the hook's check races the action's",
        steps: [["open"], ["opening", "hope"], ["brink"], ["act", "K", "strike"], ["close"]] },
    // E32+E07 C8b: the undo path of an action that killed nobody stays open.
    DM15: { title: "a strike that leaves the victim standing, undone by a Reroll and taken again",
        steps: [["open"], ["opening", "hope"], ["act", "K", "strike"], ["reroll", "K", "strike", "hit"], ["close"]] },
    // E32+E07 fix r1-G5: DM11 by the death a GM's Kill keeps until found - no flag, so only `drpgDeathsChanged` tells the fight.
    DM16: { title: "the killer dies in the fight by a death the GMs keep",
        steps: [["open"], ["opening", "hope"], ["act", "V", "leaveClue"], ["keptDeath", "K"], ["act", "V", "leaveClue"], ["close"]] },

    // Direct, with a third.
    TP01: { title: "Partners, the blow, a betrayal from the tile in Stage 6, and the second incident's blow", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"], ["act", "K", "finishingBlow"],
            ["betray"], ["opening", "hope"], ["act", "T", "finishingBlow"], ["close"]] },
    TP02: { title: "Partners, the blow, the close, and a betrayal from the checklist whose opening fails", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"], ["act", "K", "finishingBlow"],
            ["close", "betrayal"], ["opening", "fail"]] },
    TP03: { title: "Partners, and two killers run the victim out", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"], ["runOut"], ["close"]] },
    TP04: { title: "Partners, Self-defence, then Survive", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"], ["act", "V", "selfDefence"], ["act", "V", "survive"], ["close"]] },
    TP05: { title: "the accomplice swings their own weapon, and the close", third: true,
        steps: [["gear", "T", "knife"], ["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"],
            ["act", "T", "weaponAttack", "hit", { swing: "knife" }], ["act", "K", "finishingBlow"], ["close"]] },
    TP06: { title: "Double role reversal, then the new killer's blow", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "doubleRoleReversal"], ["act", "V", "finishingBlow"], ["close"]] },
    TP07: { title: "Double role reversal, the blow, and a betrayal from the tile", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "doubleRoleReversal"], ["act", "V", "finishingBlow"],
            ["betray"], ["opening", "hope"], ["act", "T", "finishingBlow"], ["close"]] },
    TP08: { title: "Averted eyes, the third's token walks back into the room, and the blow", third: true, rooms: true,
        steps: [["stand"], ["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "avertedEyes"], ["move", "T"], ["act", "K", "finishingBlow"], ["close"]] },
    TP09: { title: "Escape together", third: true, steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "sharedEscape"], ["close"]] },
    TP10: { title: "a failed escape, then a fourth walks in", third: true, four: true, rooms: true,
        steps: [["stand"], ["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "sharedEscape", "miss"], ["move", "F"],
            ["act", "K", "finishingBlow"], ["close"]] },
    TP11: { title: "a third who chooses nothing, and the blow", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["close"]] },
    TP12: { title: "a fourth walks in on a third", third: true, four: true, rooms: true,
        steps: [["stand"], ["open"], ["opening", "hope"], ["enter", "T"], ["move", "F"]] },
    TP13: { title: "the third asks to use an item, then chooses Partners in crime", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "useItem", "hit", { refused: true }], ["act", "T", "crimePartners"],
            ["act", "K", "finishingBlow"], ["close"]] },
    // E32+E07 C9 (S04-42): after the accomplice's death the round runs on, and the killers' side skips them.
    TP14: { title: "the accomplice dies in the fight", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"], ["act", "V", "leaveClue"], ["act", "K", "strike"],
            ["listDeath", "T"], ["act", "V", "leaveClue"], ["act", "K", "strike"], ["close"]] },

    // A trap: the victim rolls the opening, the builder is not in the room.
    TR01: { title: "a trap whose victim notices it, and the GM's close", kind: "trap", steps: [["open"], ["opening", "notice"], ["close"]] },
    TR02: { title: "a trap that springs, and the victim's Leave a clue", kind: "trap", steps: [["open"], ["opening", "fail"], ["act", "V", "leaveClue"], ["close"]] },
    TR03: { title: "a trap that springs, Self-defence, then Survive", kind: "trap",
        steps: [["open"], ["opening", "fail"], ["act", "V", "selfDefence"], ["act", "V", "survive"], ["close"]] },
    TR04: { title: "a trap the GM moves to Stage 6 as the victim killed", kind: "trap",
        steps: [["open"], ["opening", "fail"], ["resolve", "victimKilled"], ["close"]] },
    TR05: { title: "a trap's third sides with the builder, and the victim runs out", kind: "trap", third: true,
        steps: [["open"], ["opening", "fail"], ["enter", "T"], ["act", "T", "crimePartners"], ["runOut"], ["close"]] },
    TR06: { title: "a trap's third averts their eyes", kind: "trap", third: true,
        steps: [["open"], ["opening", "fail"], ["enter", "T"], ["act", "T", "avertedEyes"], ["act", "V", "leaveClue"], ["close"]] },
    TR07: { title: "a trap's third escapes with the victim", kind: "trap", third: true,
        steps: [["open"], ["opening", "fail"], ["enter", "T"], ["act", "T", "sharedEscape"], ["close"]] },
    TR08: { title: "a trap the GM closes in the fight", kind: "trap", steps: [["open"], ["opening", "fail"], ["act", "V", "leaveClue"], ["close"]] },
    TR09: { title: "a trap's victim dies from the Students list", kind: "trap", steps: [["open"], ["opening", "fail"], ["listDeath", "V"], ["close"]] },

    // By their own hand.
    SI01: { title: "a self-inflicted death whose opening fails", kind: "self", steps: [["open"], ["opening", "fail"]] },
    SI02: { title: "a self-inflicted death that goes through, the close and the discovery", kind: "self",
        steps: [["open"], ["opening", "hope"], ["close"], ["discover"]] },
    SI03: { title: "a self-inflicted death that goes through, closed at once from the checklist", kind: "self",
        steps: [["open"], ["opening", "hope"], ["close", "close"]] },

    // Across incidents.
    XI01: { title: "a standing offer while an unrelated trap runs the same day", third: true, four: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["close"],
            ["open", "trap", "F", "K"], ["opening", "notice"], ["close"]] },
    XI02: { title: "a betrayal declared in an Eclipse", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["close"], ["eclipse", true], ["betray"],
            ["eclipse", false], ["close"]] },
    XI03: { title: "the betrayal tile in a Class Trial, and the offer after it", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["close"], ["phase", "classTrial"],
            ["phase", "investigation"]] },
    XI04: { title: "the day ends on a standing offer", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["close"], ["dayEnds"]] },
    XI05: { title: "the blow that killed cannot be rerolled; the armed offer stands", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["reroll", "K", "finishingBlow", "miss"], ["close"]] },
    XI06: { title: "the season reset's close in the fight",
        steps: [["open"], ["opening", "hope"], ["act", "V", "leaveClue"], ["seasonReset"]] },
    XI07: { title: "a betrayal declared in the Eclipse after Night opens the next morning", third: true,
        steps: [["night"], ["open"], ["opening", "hope"], ["enter", "T"], ["act", "K", "finishingBlow"], ["close"], ["eclipse", true],
            ["betray"], ["eclipse", false], ["close"]] }
};

/* ==========================================================================
 * THE REDS LEFT AT 73b1e89 (E32+E07 fix r1-G4), MEASURED 02.10.2026 on the harness
 * (e32run/g4f3) - 13 of the 28 red at 0642f1a (1.2.65), 28.09.2026; each a literal
 * marker, read by tools/stages.mjs. `failing` is the whole bracketed list the case
 * breaks (the head comment, WHAT A RED CASE SAYS): a commit that fixes one invariant
 * of several re-points it to the list still red, and the one that fixes the last
 * takes the marker off. The reason names the commit due to fix the last.
 * ========================================================================== */

const GRID_RED = {
    DM02: expectedRed("E07", "S04-20: the gloves in the killer's hand are not broken by a discovery after the close (C12)", { failing: "[I12]" }),
    DM12: expectedRed("E07", "S10-77: the victim's death from the Students list in the fight offers no Stage 6 (C13)", { failing: "[I10]" }),
    DM13: expectedRed("E07", "S04-17: a failed opening breaks the weapon in the killer's hand (C12)", { failing: "[I12]" }),
    TP04: expectedRed("E07", "S04-06: Role reversal is offered against an accomplice (C11a)", { failing: "[I11]" }),
    TP05: expectedRed("E07", "S05-23: the close breaks the first killer's tools only, not the accomplice's swung weapon (C12)", { failing: "[I12]" }),
    TP08: expectedRed("E07", "S04-21: a third who averted their eyes walks back in by their token (C10)", { failing: "[I2, I6, I13]" }),
    TP10: expectedRed("E07", "S04-21: a failed escape's third still counts, and a fourth walking in crowds the incident out (C10)", { failing: "[I10, I13]" }),
    TP13: expectedRed("E07", "S04-33: a third is let take Use an item, an action of the two sides (C10)", { failing: "[I10]" }),
    TR03: expectedRed("E07", "S04-06: Role reversal is offered in a trap (C11a)", { failing: "[I11]" }),
    TR05: expectedRed("E07", "S04-06: Double role reversal is offered to a trap's third (C11a)", { failing: "[I11]" }),
    TR06: expectedRed("E07", "S04-06: Double role reversal is offered to a trap's third (C11a)", { failing: "[I11]" }),
    TR07: expectedRed("E07", "S04-06: Double role reversal is offered to a trap's third (C11a)", { failing: "[I11]" }),
    TR09: expectedRed("E07", "S10-77: a trap's victim's death from the Students list offers no Stage 6 (C13)", { failing: "[I10]" }),
};

/* ==========================================================================
 * THE MODEL
 * ========================================================================== */

/** A new incident as the rules open it. */
function incident(kind, killer, victim) {
    return {
        kind, killerId: killer.id, victimId: victim.id, thirdId: null, thirdSide: null, thirdChose: false,
        escaped: false, departed: [], stage: "openingRoll", body: false, stageSix: false
    };
}

/**
 * THE OFFER THE RULES GIVE when an incident leaves a body: a third still there on the
 * killer's side, or - a direct murder only - one who stayed and chose nothing (the
 * owner's Q2 (b)); never after an escape was tried (S04-21), never a trap's victim-side
 * third (E06 fix G4, the builder's secret), never a dead third.
 */
function offerFor(run, m) {
    if (!m.body || !m.thirdId || m.escaped || run.dead.has(m.thirdId)) return null;
    if (m.thirdSide === "killer" || (m.kind === "direct" && !m.thirdChose)) return { thirdId: m.thirdId, killerId: m.killerId };
    return null;
}

/** Stage 6, with or without a body; a body arms the offer the rules give (armed over an older one, as D18 keeps it). */
function stageSix(run, { body }) {
    const m = run.model;
    m.stage = "resolution";
    m.stageSix = true;
    if (!body) return;
    m.body = true;
    run.bodies.set(m.victimId, { killers: killersOf(m), discovered: false });
    run.offer = offerFor(run, m) ?? run.offer;
}

/**
 * THE CLOSE, AS THE RULES COUNT IT: a self-inflicted death that went through is its body
 * now; a body makes its killers Blackened; after Stage 6 each killer's swung weapon is
 * broken. The incident is gone.
 */
function closeIncident(run) {
    const m = run.model;
    if (!m) return;
    if (m.kind === "self" && m.stage === "resolution") {
        m.body = true;
        run.bodies.set(m.victimId, { killers: [m.killerId], discovered: false });
    }
    if (m.stage === "resolution" && m.body) for (const id of killersOf(m)) run.blackened.add(id);
    if (m.stageSix) for (const id of killersOf(m)) if (run.swung.has(id)) run.broken.add(run.swung.get(id));
    run.closed++;
    run.model = null;
}

/** A new incident: counted, and asked fresh by I3 after this step. */
function opens(run, kind, killer, victim) {
    run.model = incident(kind, killer, victim);
    run.opened++;
    run.fresh = true;
    run.turnFloor = 0;
    for (const a of [killer, victim]) run.everIn.add(a.id);
}

/** Whether the betrayal tile is dark: another incident is being fought, or a Class Trial is on (Q3). */
/* The clock's fields a case may move and `runCase` puts back. */
const clockOf = () => {
    const { chapter, day, session, timeOfDay, phase } = getClock() ?? {};
    return { chapter, day, session, timeOfDay, phase };
};

const offerDark = run => Boolean(run.model && run.model.stage !== "resolution") || run.phase === "classTrial";

/* ==========================================================================
 * THE STEPS
 * ========================================================================== */

const RESULTS = Object.freeze({
    hit: { total: 99, isCritical: false, withHope: true },
    hitFear: { total: 99, isCritical: false, withHope: false },
    crit: { total: 99, isCritical: true, withHope: true },
    miss: { total: 0, isCritical: false, withHope: true }
});

const PLACE = { teleport: true, movementAction: "displace", animate: false };
const tokenOf = actor => canvas?.scene?.tokens?.find(t => t.actorId === actor.id) ?? null;

const STEPS = {
    async open(run, kind = run.spec.kind ?? "direct", killer = "K", victim = "V") {
        const K = run.who[killer], V = kind === "self" ? K : run.who[victim];
        const opened = await run.M.openMurder({ killerId: K.id, victimId: V.id, indirect: kind === "trap" });
        must(opened, `the ${kind} incident did not open`);
        opens(run, kind, K, V);
    },

    /* The opening's result, as the GM's half takes it. A player's own roll could land
       first (the roller is a connected player's, so the GM does not throw it): the stage
       is read before, and a roll that raced the grid is the fixture's failure. */
    async opening(run, band) {
        const m = run.model;
        must(run.M.murderState()?.stage === "openingRoll", "the opening had been answered before the grid answered it");
        if (m.kind === "trap") {
            const notice = band === "notice";
            await run.M.resolveVictimOpening({ total: notice ? 30 : 1, isCritical: false, withHope: notice });
            if (!notice) m.stage = "incident";
            return;
        }
        const fail = band === "fail";
        await run.M.resolveKillerOpening({ total: fail ? 1 : 24, isCritical: band === "critical", withHope: band === "hope" || band === "critical" });
        if (fail) closeIncident(run);
        else if (m.kind === "self") stageSix(run, { body: false });
        else m.stage = "incident";
    },

    /*
     * A CRISIS ACTION, AS THE BRIDGE LETS ONE THROUGH: judged by `crisisRefusal` (what
     * bridge-guards.mjs asks of a player's packet), then the GM's `resolveCrisisAction`
     * with the roll's total. On "not their turn" the GM passes the turn first, as a GM at
     * the table does for a side with nobody to act - bounded, so a turn that never comes
     * back is a refusal, not a loop. A refusal the case did not expect stops it (I10).
     */
    async act(run, who, key, result = "hit", { free = false, swing = null, refused = false } = {}) {
        const actor = run.who[who];
        for (let i = 0; i < 4 && run.M.crisisRefusal(actor, key)?.why === "not their turn" && run.M.sideOf(actor) !== "third"; i++) {
            await run.M.passTurn();
        }
        const refusal = run.M.crisisRefusal(actor, key);
        if (refusal || refused) {
            if (!(refusal && refused)) run.stop("I10", refusal ? `${actor.name}'s ${key} was refused: ${refusal.why}` : `${actor.name}'s ${key} was let through`);
            return;
        }
        const m = run.model;
        const item = swing ? run.items.get(`${who}:${swing}`) : null;
        const roll = RESULTS[result];
        run.beforeAct = structuredClone({ model: m, offer: run.offer, bodies: [...run.bodies], blackened: [...run.blackened], swung: [...run.swung] });
        if (item) run.swung.set(actor.id, item.id);
        await run.M.resolveCrisisAction({ actorId: actor.id, key, ...roll, free, swungId: item?.id ?? null });
        applyAct(run, actor, key, roll.total > 0 || roll.isCritical || free);
    },

    /*
     * A REROLL OF THE LAST CRISIS ACTION: the receipt's undo and the new result, one call as
     * the bridge makes it. An action that left a body the model did not hold before it is
     * not taken back (E32+E07 C8b, the owner's answer (A) of 28.09): the death stands, the
     * call is refused and the model does not move - a Reroll let through is I8's, the death
     * of a blow that no longer landed. Any other is taken back; refused, the case stops (I10).
     */
    async reroll(run, who, key, result) {
        const actor = run.who[who];
        const roll = RESULTS[result];
        const back = run.beforeAct;
        must(back, "there is no crisis action to take back");
        const killed = [...run.bodies.keys()].some(id => !back.bodies.some(([was]) => was === id));
        const out = await run.M.resolveCrisisAction({ actorId: actor.id, key, ...roll, undo: true });
        if (killed) {
            if (out) run.violate("I8", `the Reroll of ${actor.name}'s ${key}, which killed, was let through`);
            return;
        }
        if (!out) {
            run.stop("I10", `the Reroll of ${actor.name}'s ${key}, which killed nobody, was refused`);
            return;
        }
        run.model = back.model;
        run.offer = back.offer;
        run.bodies = new Map(back.bodies);
        run.blackened = new Set(back.blackened);
        run.swung = new Map(back.swung);
        run.undone = true;
        applyAct(run, actor, key, roll.total > 0 || roll.isCritical);
    },

    async pass(run) {
        await run.M.passTurn();
    },

    async enter(run, who) {
        must(await run.M.thirdPartyEnters(run.who[who]), `${run.who[who].name} could not walk into the incident`);
        Object.assign(run.model, { thirdId: run.who[who].id, thirdSide: null, thirdChose: false });
        run.everIn.add(run.who[who].id);
    },

    /* The killer and the victim stood alone in a room nobody is in (tests-tier2.mjs `aloneTogether`, by teleport). */
    async stand(run) {
        const { allRooms, othersInNamedRoom, positionIn } = await import("./movement.mjs");
        const room = allRooms().find(r => othersInNamedRoom(r).length === 0);
        must(room, "every named room on the scene on screen has somebody in it");
        for (const a of [run.who.K, run.who.V]) await placeIn(run, a, room, positionIn);
        run.room = room;
    },

    /*
     * A TOKEN WALKS INTO THE INCIDENT'S ROOM, and the primary GM's `updateToken` hook
     * decides what that is. The rules: a third who left (Averted eyes) does not walk back
     * in (I13); a failed escape's third no longer counts, so a newcomer becomes the third;
     * a newcomer on a third who is still there crowds the incident out (it closes).
     */
    async move(run, who) {
        const { positionIn } = await import("./movement.mjs");
        const actor = run.who[who], m = run.model;
        const before = run.M.murderState();
        await placeIn(run, actor, run.room, positionIn);
        await until(() => {
            const now = run.M.murderState();
            return !now || now.thirdId !== before?.thirdId;
        }, 1500);
        if (m.departed.includes(actor.id)) {
            if (run.M.murderState()?.thirdId === actor.id) run.violate("I13", `${actor.name} left the incident and walked back into it`);
            return;
        }
        if (m.thirdId && !m.escaped) {
            closeIncident(run);
            return;
        }
        if (m.escaped) m.departed.push(m.thirdId);
        Object.assign(m, { thirdId: actor.id, thirdSide: null, thirdChose: false, escaped: false });
        run.everIn.add(actor.id);
        const now = run.M.murderState();
        if (now?.thirdId !== actor.id) {
            run.violate("I13", `a failed escape's third still counted: ${actor.name} walking in ${now ? "did not become the third" : "crowded the incident out"}`);
        }
    },

    async resolve(run, reason) {
        must(await run.M.beginResolution(reason), "the GM could not move the incident to Stage 6");
        stageSix(run, { body: false });
    },

    /* The GM's close: the tracker's "Close the murder", or its checklist (`followUp`), answered with `checklist`. */
    async close(run, checklist = null) {
        const m = run.model;
        run.checklist = checklist;
        const offer = run.offer;
        await run.M.endMurder({ reason: "closed", followUp: Boolean(checklist) });
        const betrays = checklist === "betrayal" && offer && m?.body;
        closeIncident(run);
        if (betrays) {
            run.offer = null;
            opens(run, "direct", game.actors.get(offer.thirdId), game.actors.get(offer.killerId));
        }
    },

    /*
     * THE BETRAYAL FROM THE TILE: the GM's half of `murder.betrayal` (`betrayAsPlayer`).
     * The rules: the offer is spent; the incident still at Stage 6 closes first; the new
     * one opens, its killer the third - or, in an Eclipse, is parked until the lights, at
     * the cost of an action (Q3), the offer standing until the lights take it (fix r1-G2:
     * a declaration in the dark moves nothing a player's browser is sent). In an Eclipse the
     * tile itself is pressed (action-rolls.mjs `performBetrayal`, E32 C5b): the action is paid
     * there, on the asking client, and its confirmation and note are answered by `answerDialogs`.
     */
    async betray(run) {
        const offer = run.offer;
        must(offer, "the case holds no offer to turn on");
        const third = game.actors.get(offer.thirdId), killer = game.actors.get(offer.killerId);
        const actionsBefore = run.actionsLeft(third);
        if (run.eclipse) await (await import("./action-rolls.mjs")).performAction(third, "directMurder");
        else await run.M.betrayAsPlayer(third.id);
        if (run.eclipse) {
            run.parked = { third, killer };
            if (run.actionsLeft(third) !== actionsBefore - 1) {
                run.violate("I6", `a betrayal declared in an Eclipse cost ${actionsBefore - run.actionsLeft(third)} action(s), not 1`);
            }
            return;
        }
        run.offer = null;
        if (run.model) closeIncident(run);
        opens(run, "direct", third, killer);
    },

    /* The discovery's two parts the invariants read (chapter.mjs `runDiscovery`): the
       bodies published, and the cleaning tools broken. The gather that moves every token
       is not run - the runner could not put the scene back. */
    async discover(run) {
        const { publishDeath } = await import("./chapter.mjs");
        const { destroyCleaningTools } = await import("./cleanup.mjs");
        for (const [id, body] of run.bodies) {
            if (body.discovered) continue;
            must(await publishDeath(game.actors.get(id)), `${game.actors.get(id)?.name}'s death could not be published`);
            body.discovered = true;
            for (const killer of body.killers) {
                for (const [key, item] of run.items) if (key.endsWith(":gloves") && item.parent?.id === killer) run.broken.add(item.id);
            }
        }
        await destroyCleaningTools();
    },

    /*
     * A DEATH FROM THE STUDENTS LIST: the GM panel's "dead" (gm-panel.mjs `applyAliveStates`),
     * which makes the death the table's at once - so a victim's body is found as it falls.
     * The rules (D13): the victim's death in the fight offers Stage 6, which the GM takes; a
     * killer's leaves the fight standing, and moves the turn on past them (S04-42, E32+E07
     * C9) - which the primary GM's hook does after the flag lands, so it is waited for, as
     * `runOut` waits for the death. With no killer left alive the GMs are offered the close
     * (`answerDialogs` declines it; the case's own close follows): not offered is I9's.
     */
    async listDeath(run, who) {
        const { applyAliveStates } = await import("./gm-panel.mjs");
        const actor = run.who[who], m = run.model;
        const offers = run.closeOffers;
        must(await applyAliveStates({ [actor.id]: { state: "dead" } }), `${actor.name}'s death from the list was not recorded`);
        run.dead.add(actor.id);
        if (m?.stage === "incident" && m.victimId === actor.id) {
            stageSix(run, { body: true });
            run.bodies.get(actor.id).discovered = true;
        }
        await afterKillerDeath(run, actor, offers);
    },

    /*
     * A KILLER'S DEATH THE GMS KEEP (E32+E07 fix r1-G5, 02.10.2026; C9's surviving mutant
     * c9-no-hook): the Kill button's dialog with "kept until found" ticked (chapter.mjs,
     * `killCharacter` with `secret`). It writes a row of the GMs' `deaths` store and nothing
     * on the actor, so the fight learns of it by `drpgDeathsChanged` alone - the half of
     * C9's hook no case reached: `listDeath` publishes the flag, which the actor's half
     * reads too. A killer's only: a victim's death kept is a body, and that is `runOut`'s.
     */
    async keptDeath(run, who) {
        const { killCharacter } = await import("./chapter.mjs");
        const actor = run.who[who];
        must(run.model && killersOf(run.model).includes(actor.id), `keptDeath kills a killer, and ${actor.name} is none`);
        const offers = run.closeOffers;
        must(await killCharacter(actor, { secret: true }), `${actor.name}'s death was not kept by the GMs`);
        run.dead.add(actor.id);
        await afterKillerDeath(run, actor, offers);
    },

    /*
     * The victim's Health and Sanity both full: the primary GM's `updateActor` hook runs them out.
     * Waited out to the death, not only the stage: `checkVictimSpent` writes the stage first and
     * calls `killCharacter` after it, so a step that returned at the stage raced the death - TR05
     * read I8 "dead false" at this step in 2 of 4 runs of C8's tree and 2 of 3 of C8b's (C8b's A2,
     * 28.09.2026). A death that never comes still reads I8, 3 s later.
     */
    async runOut(run) {
        const victim = game.actors.get(run.model.victimId);
        const { isDeadForGm } = await import("./chapter.mjs");
        await victim.update(brimming(victim, 0));
        await until(() => run.M.murderState()?.stage === "resolution" && isDeadForGm(victim), 3000);
        run.ranOuts.push(victim.id);
        stageSix(run, { body: true });
    },

    /* One Health short of running out, so the next hit runs them out - the hook's check racing the action's own. */
    async brink(run) {
        const victim = game.actors.get(run.model.victimId);
        await victim.update(brimming(victim, 1));
        run.brink = true;
    },

    /* A fixture item in hand: a Tier 1 knife (a weapon) or gloves (a cleaning tool). Deleted by the case. */
    async gear(run, who, what) {
        const actor = run.who[who];
        const category = what === "knife" ? "crimeTool" : "cleaningTool";
        const [item] = await actor.createEmbeddedDocuments("Item", [{ name: `SUITE grid ${what}`, type: "loot",
            flags: { [MODULE_ID]: { category, equipped: true, tier: 1 } } }]);
        must(item, `${actor.name} could not be handed the ${what}`);
        run.items.set(`${who}:${what}`, item);
    },

    async phase(run, key) {
        await setClock({ phase: key });
        run.phase = key;
    },

    /*
     * The Eclipse, ended as the game ends it: by advancing the clock (`endEclipse()`, what the
     * GM panel calls). Until fix r1-G2 (01.10.2026; the round-1 correctness review's M1) it was
     * ended with `advance: false`, which nothing in the game takes and which moves no clock - so
     * XI02 was green on a path the table does not use, and a betrayal declared in the Eclipse
     * after Night, which ends into the next day, was refused at the lights. The clock is put back
     * when the case ends (`runCase`). A declaration's offer is taken at the lights.
     */
    async eclipse(run, on) {
        const E = await import("./eclipse.mjs");
        if (on) {
            run.clockBefore ??= clockOf();
            await E.startEclipse();
            must(E.isEclipse(), "the Eclipse did not start");
            run.eclipse = true;
            return;
        }
        await E.endEclipse();
        run.eclipse = false;
        await wait(200);
        const parked = run.parked;
        run.parked = null;
        if (parked) {
            run.offer = null;
            if (run.model) closeIncident(run);
            opens(run, "direct", parked.third, parked.killer);
        }
    },

    /* The last time of day, whose Eclipse ends into the next day. The clock is put back when the case ends. */
    async night(run) {
        run.clockBefore ??= clockOf();
        await setClock({ timeOfDay: "night" });
    },

    /* The day turns: the primary GM sweeps the offers of the day it left (`drpgTimeOfDayChanged`). */
    async dayEnds(run) {
        await setClock({ day: (getClock()?.day ?? 1) + 1 });
        await until(() => !incidentCast().betrayal, 2000);
        run.offer = null;
    },

    /* The season reset's incident step (season-setup.mjs `resetSeason`, "the incident"): its
       close and the offer's. The rest of the reset - the Blackened among it - is not run,
       for the world the runner has to put back. */
    async seasonReset(run) {
        await run.M.endMurder({ reason: "seasonReset", followUp: false });
        await run.M.clearBetrayalOffer();
        closeIncident(run);
        run.offer = null;
    }
};

/**
 * A killer dead in a direct murder's fight (S04-42, E32+E07 C9): waited out until the turn
 * is off them - the primary GM's hook moves it after the death lands - and with no killer
 * left alive the GMs are offered the close; not offered is I9's. `offers` is the count
 * before the death.
 */
async function afterKillerDeath(run, actor, offers) {
    const m = run.model;
    if (m?.stage !== "incident" || m.kind === "trap" || !killersOf(m).includes(actor.id)) return;
    const { isDeadForGm } = await import("./chapter.mjs");
    await until(() => {
        const state = run.M.murderState();
        return state?.turnSide !== "killer" || !isDeadForGm(game.actors.get(state.killerTurnId ?? state.killerId ?? ""));
    }, 3000);
    if (killersOf(m).every(id => run.dead.has(id)) && !await until(() => run.closeOffers > offers, 3000)) {
        run.violate("I9", "no killer is left alive and the GMs were not offered the close");
    }
}

/** What a crisis action does to the model, as the rules have it. */
function applyAct(run, actor, key, hit) {
    const m = run.model;
    if (key === "crimePartners") Object.assign(m, { thirdSide: "killer", thirdChose: true });
    if (key === "avertedEyes") {
        m.departed.push(m.thirdId);
        Object.assign(m, { thirdId: null, thirdSide: null, thirdChose: true });
    }
    if (key === "doubleRoleReversal") {
        Object.assign(m, { killerId: m.victimId, victimId: m.killerId, thirdSide: "killer", thirdChose: true });
    }
    if (key === "sharedEscape") {
        m.escaped = true;
        m.thirdChose = true;
        if (hit) stageSix(run, { body: false });
    }
    if (!hit) return;
    if (run.brink && (key === "strike" || key === "weaponAttack")) {
        run.brink = false;
        run.ranOuts.push(m.victimId);
        stageSix(run, { body: true });
        return;
    }
    if (key === "roleReversal") Object.assign(m, { killerId: m.victimId, victimId: m.killerId });
    if (key === "finishingBlow") stageSix(run, { body: true });
    if (key === "survive") stageSix(run, { body: false });
}

/** The update that leaves `short` Health marks before running out, and Sanity full. */
function brimming(actor, short) {
    const r = actor.system?.resources ?? {};
    return {
        "system.resources.hitPoints.value": (r.hitPoints?.max ?? 0) - short,
        "system.resources.stress.value": r.stress?.max ?? 0
    };
}

/** A token teleported into a room, its place before remembered for the case to put back. */
async function placeIn(run, actor, room, positionIn) {
    const token = tokenOf(actor);
    must(token, `${actor.name} has no token on the scene on screen`);
    if (!run.places.has(token.id)) run.places.set(token.id, { token, x: token.x, y: token.y });
    await token.update(positionIn(room, token), PLACE);
}

/* ==========================================================================
 * THE INVARIANTS - asked after every step
 * ========================================================================== */

async function assertIncidentInvariants(run) {
    const M = run.M, m = run.model;
    const { isDeadForGm, isDeceased } = await import("./chapter.mjs");
    const { isBroken } = await import("./inventory.mjs");
    const worldHalf = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    const state = M.murderState();
    const cast = incidentCast();

    // I1 - the world half.
    const extra = Object.keys(worldHalf).filter(k => !PUBLIC_FIELDS.includes(k));
    if (extra.length) run.violate("I1", `the world half holds ${extra.join(", ")}`);
    if (!worldHalf.active && Object.keys(worldHalf).length) run.violate("I1", `the world half holds ${Object.keys(worldHalf).join(", ")} without \`active\``);

    // I10 - the stage, and the turn that only an undo takes back.
    const stage = state?.stage ?? null;
    if (stage !== (m?.stage ?? null)) {
        run.stop("I10", `the stage is ${stage}, the model's ${m?.stage ?? null}`);
        return;
    }
    if (state && m && typeof state.turn === "number") {
        if (state.turn < run.turnFloor && !run.undone) run.violate("I10", `the turn fell from ${run.turnFloor} to ${state.turn}`);
        run.turnFloor = state.turn;
    }
    run.undone = false;

    // I3 - fresh, right after an open.
    if (run.fresh && state && m) {
        for (const [key, value] of Object.entries(state)) {
            if (KEPT.includes(key)) continue;
            if (!Object.hasOwn(FRESH, key)) run.violate("I3", `a new incident holds \`${key}\`, a field the grid does not know`);
            else if (!FRESH[key](value, m, run)) run.violate("I3", `a new incident holds ${key} = ${JSON.stringify(value)}`);
        }
        for (const key of ["active", "stage", "killerId", "victimId", "killerTurnId"]) {
            if (!(key in state)) run.violate("I3", `a new incident holds no \`${key}\``);
        }
    }
    run.fresh = false;

    // I2 - who holds the cast, and what each holder is sent.
    const seated = new Set(seatsOf(m).map(id => ownerOf(game.actors.get(id))?.id).filter(Boolean));
    const offerUser = run.offer ? ownerOf(game.actors.get(run.offer.thirdId))?.id ?? null : null;
    for (const user of game.users.filter(u => !u.isGM)) {
        const copy = M.castFor(user.id, cast);
        const packet = M.castPacket(user.id, cast);
        const held = Object.keys(copy).filter(k => !none(copy[k]));
        const offerHeld = copy.betrayal ? `${copy.betrayal.thirdId}>${copy.betrayal.killerId}` : null;
        const offerDue = user.id === offerUser ? `${run.offer.thirdId}>${run.offer.killerId}` : null;
        if (offerHeld !== offerDue) run.violate("I2", `${user.name} is sent the offer ${label(offerHeld)}, the model's ${label(offerDue)}`);
        if (JSON.stringify(packet.cast) !== JSON.stringify(copy)) run.violate("I2", `${user.name}'s packet holds another copy than castFor's`);
        if (!seated.has(user.id)) {
            // The offer's third too: the offer and the seats' stamps, nothing that times the fight (fix r1-G1, the review's M1).
            const more = held.filter(k => k !== "betrayal");
            if (more.length) run.violate("I2", `${user.name} holds no seat and is sent ${more.join(", ")}`);
            const timed = Object.keys(packet.stamps ?? {}).filter(k => !SEAT_PARTS.includes(k));
            if (timed.length) run.violate("I2", `${user.name} holds no seat and is sent the stamps of ${timed.join(", ")}`);
            continue;
        }
        const killerSide = killersOf(m).some(id => ownerOf(game.actors.get(id))?.id === user.id);
        const killer = m.kind === "trap" && !killerSide ? null : m.killerId;
        if ((copy.killerId ?? null) !== killer) run.violate("I2", `${user.name}'s copy names the killer ${nameOf(copy.killerId)}, the model's ${nameOf(killer)}`);
        if ((copy.victimId ?? null) !== m.victimId) run.violate("I2", `${user.name}'s copy names the victim ${nameOf(copy.victimId)}, the model's ${nameOf(m.victimId)}`);
        if (!none(copy.lastCrisis) || "swung" in copy) run.violate("I2", `${user.name}'s copy holds the Reroll receipt or the swing memo`);
        /* The fight as the GMs hold it: a seat reads its turn off its own copy (E32 C2) - but the Key
           Remnants' count, the GMs' alone, and for a trap's killers, seated from Stage 6 on, all of it:
           their rolls' results, which E06 keeps from the builder (fix r1-G1; the review's m1, M2). What
           a copy holds null its stamp does not tell either: it reads as the newest of the stamps of what
           the copy shows, so it moves when they do and never alone. */
        const withheld = m.kind === "trap" && killerSide ? FIGHT_FIELDS : ["keyRemnants"];
        const due = f => (withheld.includes(f) ? null : state?.[f] ?? null);
        const unlike = FIGHT_FIELDS.filter(f => JSON.stringify(copy[f] ?? null) !== JSON.stringify(due(f)));
        if (unlike.length) run.violate("I2", `${user.name}'s copy holds the fight's ${unlike.join(", ")} unlike the GMs'`);
        const stamps = packet.stamps ?? {};
        const shown = Math.max(0, ...Object.entries(stamps).filter(([f]) => !withheld.includes(f)).map(([, t]) => t ?? 0));
        const telling = withheld.filter(f => (stamps[f] ?? 0) !== shown);
        if (telling.length) run.violate("I2", `${user.name}'s packet stamps ${telling.join(", ")}, which the copy holds null, apart from what it shows`);
    }
    for (const packet of run.packets.splice(0)) {
        const aboutSeats = Object.keys(packet.cast ?? {}).every(k => k === "betrayal") && Object.keys(packet.stamps ?? {}).every(k => SEAT_PARTS.includes(k));
        const stray = Object.keys(packet.cast ?? {}).length ? packet.to.filter(id => !seated.has(id) && !(id === offerUser && aboutSeats)) : [];
        if (stray.length) run.violate("I2", `a cast packet went to ${stray.join(", ")}, who hold no seat`);
    }

    // I4 - closes, counted by the hook.
    if (run.closes !== run.closed) run.violate("I4", `${run.closes} close(s) of ${run.opened} incident(s), the model's ${run.closed}`);

    // I5 - the Blackened.
    const grew = M.blackenedIds().filter(id => !run.blackenedBefore.includes(id));
    const due = [...run.blackened].filter(id => !run.blackenedBefore.includes(id));
    if (JSON.stringify([...grew].sort()) !== JSON.stringify([...due].sort())) {
        run.violate("I5", `the Blackened grew by [${grew.map(nameOf)}], the model's [${due.map(nameOf)}]`);
    }

    // I6 - the offer: the record, and the tile's answer for everyone in the case.
    const record = cast.betrayal ? `${cast.betrayal.thirdId}>${cast.betrayal.killerId}` : null;
    const recordDue = run.offer ? `${run.offer.thirdId}>${run.offer.killerId}` : null;
    const inert = cast.betrayal && [cast.betrayal.thirdId, cast.betrayal.killerId].some(id => run.dead.has(id));
    if (record !== recordDue && !(recordDue === null && inert)) run.violate("I6", `the offer on record is ${label(record)}, the model's ${label(recordDue)}`);
    for (const actor of Object.values(run.who)) {
        const answer = M.betrayalTarget(actor)?.id ?? null;
        const answerDue = run.offer?.thirdId === actor.id && !offerDark(run) ? run.offer.killerId : null;
        if (answer !== answerDue) run.violate("I6", `the tile offers ${actor.name} ${nameOf(answer)}, the model ${nameOf(answerDue)}`);
    }

    // I8 - a body is dead for the GMs, and the table's only once found; the model's living victim is neither.
    for (const [id, body] of run.bodies) {
        const actor = game.actors.get(id);
        if (!isDeadForGm(actor) || isDeceased(actor) !== body.discovered) {
            run.violate("I8", `${actor.name}'s body reads dead ${isDeadForGm(actor)} for the GMs and ${isDeceased(actor)} for the table, found ${body.discovered}`);
        }
    }
    if (m && !run.bodies.has(m.victimId) && !run.dead.has(m.victimId)) {
        const victim = game.actors.get(m.victimId);
        if (isDeadForGm(victim) || isDeceased(victim)) run.violate("I8", `${victim.name} reads dead with no body in the model`);
    }

    // I9 - the side to act can act.
    if (stage === "incident") {
        if (m?.kind === "trap" && state.turnSide === "killer") run.violate("I9", "a trap's builder holds the turn");
        const turn = state.turnSide === "killer" ? game.actors.get(state.killerTurnId ?? state.killerId ?? "") : null;
        if (turn && isDeadForGm(turn)) run.violate("I9", `${turn.name}, dead, holds the killers' turn`);
    }

    // I11 - Role reversal off in a trap and once somebody joined the killer; no Double role reversal in a trap.
    if (stage === "incident" && m) {
        const offered = (actor, key) => Boolean(actor) && (M.availableCrisisActions(actor).some(o => o.key === key && !o.blocked)
            || M.crisisRefusal(actor, key) === null);
        const victim = game.actors.get(m.victimId);
        if ((m.kind === "trap" || m.thirdSide === "killer") && offered(victim, "roleReversal")) {
            run.violate("I11", `Role reversal is offered to ${victim.name} ${m.kind === "trap" ? "in a trap" : "against an accomplice"}`);
        }
        const third = m.thirdId ? game.actors.get(m.thirdId) : null;
        if (m.kind === "trap" && m.thirdSide !== "killer" && offered(third, "doubleRoleReversal")) {
            run.violate("I11", `Double role reversal is offered to ${third.name} in a trap`);
        }
    }

    // I12 - the fixture items: broken exactly when the model broke them.
    for (const [key, item] of run.items) {
        const now = item.parent?.items?.get(item.id) ?? item;
        if (isBroken(now) !== run.broken.has(item.id)) run.violate("I12", `${key} is ${isBroken(now) ? "" : "not "}broken`);
    }

    // I13 - a third who left is not the third again.
    if (m && state?.thirdId && m.departed.includes(state.thirdId)) run.violate("I13", `${nameOf(state.thirdId)} left and is the third again`);
}

/**
 * After the last step: every incident closed once, no card spoke as a participant, and
 * each run-out told once and died once.
 *
 * I14'S DEATH IS COUNTED BY ITS CARD (E32+E07 fix r1-G5, 02.10.2026; review C-m6). The plan's
 * I14 is "one ran-out card, one death", and until this fix the grid counted the cards alone.
 * The death's record cannot be counted: `killCharacter` refuses an actor already dead for the
 * GMs, so a second death leaves no second flag or row. What each death that went through
 * does leave is its whispered card (chapter.mjs, `DRPG.Chapter.deathTitle` and the name), so
 * the cards naming a victim who ran out are their deaths in the case - one for each run-out.
 */
async function assertAtTheEnd(run) {
    const { wordsOf } = await import("./secret.mjs");
    if (!run.stopped && run.closes !== run.opened) run.violate("I4", `${run.closes} close(s) for ${run.opened} incident(s) opened`);
    const names = new Set([...run.everIn].map(nameOf));
    const title = game.i18n.localize("DRPG.Murder.ranOutTitle");
    const deathTitle = game.i18n.localize("DRPG.Chapter.deathTitle");
    const ranOut = new Set(run.ranOuts);
    const deaths = new Map([...ranOut].map(id => [id, 0]));
    let cards = 0;
    for (const { message, at, live } of run.messages) {
        const speaker = message.speaker ?? {};
        if (live && (run.everIn.has(speaker.actor) || names.has(speaker.alias))) {
            run.violate("I7", `a card speaks as ${speaker.alias ?? nameOf(speaker.actor)}`, at);
        }
        const words = String(await wordsOf(message, 300));
        if (words.includes(title)) cards++;
        if (words.includes(deathTitle)) for (const id of ranOut) if (words.includes(nameOf(id))) deaths.set(id, deaths.get(id) + 1);
    }
    if (cards !== run.ranOuts.length) run.violate("I14", `${cards} ran-out card(s), the model's ${run.ranOuts.length}`);
    for (const [id, n] of deaths) {
        const due = run.ranOuts.filter(r => r === id).length;
        if (n !== due) run.violate("I14", `${nameOf(id)} ran out ${due} time(s) and has ${n} death card(s)`);
    }
}

const nameOf = id => game.actors.get(id ?? "")?.name ?? String(id ?? null);
const label = pair => pair ? pair.split(">").map(nameOf).join(" against ") : "none";

/* ==========================================================================
 * THE RUN
 * ========================================================================== */

/**
 * The windows a case opens, answered as a GM would, and put back in `finally` (the
 * plan's `answerDialogs`): two killers' ran-out ("end now"), Stage 6 after the victim's
 * death (yes), the close offered once no killer is alive (no, counted), the checklist (the case's `checklist`, else Close), the escape's (Close), and the
 * third's own two in an Eclipse - the betrayal's confirmation (yes) and its note (E32 C5b). Anything
 * else is closed unanswered and its title kept.
 */
async function answerDialogs(run, fn) {
    const D = foundry.applications.api.DialogV2;
    const own = { wait: Object.getOwnPropertyDescriptor(D, "wait"), confirm: Object.getOwnPropertyDescriptor(D, "confirm") };
    const t = key => game.i18n.localize(key);
    D.confirm = async cfg => {
        const title = cfg?.window?.title ?? "";
        if (title === t("DRPG.Murder.ranOutTitle") || title === t("DRPG.Chapter.stageSixTitle")) return true;
        if (title === t("DRPG.Murder.endMurder")) {
            run.closeOffers++;
            return false;
        }
        if (title === t("DRPG.Murder.betrayalTitle")) return true;
        run.dialogs.push(title);
        return false;
    };
    D.wait = async cfg => {
        const title = cfg?.window?.title ?? "";
        if (title === t("DRPG.Murder.afterTitle")) return run.checklist ?? "close";
        if (title === t("DRPG.Murder.betrayalTitle")) return "SUITE grid betrayal declared in the dark";
        if (title === t("DRPG.Murder.escapeTitle")) return "close";
        run.dialogs.push(title);
        return null;
    };
    try {
        return await fn();
    } finally {
        for (const [name, desc] of Object.entries(own)) {
            if (desc) Object.defineProperty(D, name, desc); else delete D[name];
        }
    }
}

/**
 * WHAT A CASE SEES besides the world (`seen`, the plan's 2.4): every `incident.myCast`
 * packet this GM sends, as `wordsSent` in tier 2 reads its cards; every close, by the
 * `drpgIncidentClosed` hook `endMurder` fires; every chat message created, with the step
 * it was created in and whether an incident was running then - I7 asks the cards of a
 * running incident, not an Eclipse's own cards to each student (XI02 measured three,
 * 28.09). All put back in `finally`.
 */
async function watching(run, fn) {
    const socket = game.socket;
    const ownEmit = Object.getOwnPropertyDescriptor(socket, "emit");
    const send = socket.emit;
    socket.emit = function (event, packet, options, ...rest) {
        if (packet?.action === "incident.myCast") run.packets.push({ to: options?.recipients ?? [], cast: packet.cast ?? {}, stamps: packet.stamps ?? {} });
        return send.call(this, event, packet, options, ...rest);
    };
    const closed = Hooks.on("drpgIncidentClosed", () => { run.closes++; });
    const created = Hooks.on("createChatMessage", message => { run.messages.push({ message, at: run.at, live: Boolean(run.M.murderState()) }); });
    try {
        return await fn();
    } finally {
        Hooks.off("drpgIncidentClosed", closed);
        Hooks.off("createChatMessage", created);
        if (ownEmit) Object.defineProperty(socket, "emit", ownEmit); else delete socket.emit;
    }
}

/**
 * THE CASE'S PEOPLE: the rollers first - a direct killer, a trap's victim, a betrayal's
 * third - each a connected player's, because an opening with nobody to ask is thrown on
 * the GM's own client and raced the grid's answer (E05 handoff, measured 27.09). The
 * fourth may be anybody living.
 */
async function peopleFor(spec) {
    const { livingStudents } = await import("./chapter.mjs");
    const player = a => game.users.find(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"));
    const living = livingStudents();
    const [K, V, T] = living.filter(player);
    const F = living.find(a => ![K, V, T].includes(a)) ?? null;
    return { K, V, ...(spec.third ? { T } : {}), ...(spec.four ? { F } : {}) };
}

async function runCase(id) {
    const spec = CASES[id];
    // Not a Failure: one would be judged against the marker it is about (WHAT A RED CASE SAYS).
    const failing = GRID_RED[id]?.failing;
    if (GRID_RED[id] && !/^\[I\d+(, I\d+)*\]$/.test(failing ?? "")) {
        throw new Error(`GRID_RED.${id} names ${JSON.stringify(failing)}, not the whole bracketed list of invariants its case breaks`);
    }
    needs(world.atLeast("studentsWithConnectedPlayer", spec.third ? 3 : 2), "the killer, the victim and any third are each a connected player's");
    if (spec.four) needs(world.atLeast("livingStudents", 4), "a fourth student walks in");
    if (spec.rooms) {
        needs(world.atLeast("studentTokensOnScreen", 4), "the case moves the students' tokens");
        needs(world.atLeast("namedRooms", 2), "one room is left to the incident");
    }
    const M = await import("./murder.mjs");
    const { actionsLeft } = await import("./actions.mjs");
    const { reviveCharacter } = await import("./chapter.mjs");
    const who = await peopleFor(spec);
    const found = [];
    const run = {
        spec, who, M, actionsLeft, model: null, opened: 0, closed: 0, closes: 0, offer: null, parked: null, phase: null, eclipse: false, clockBefore: null,
        blackened: new Set(), blackenedBefore: M.blackenedIds(), bodies: new Map(), dead: new Set(), items: new Map(), broken: new Set(),
        swung: new Map(), places: new Map(), everIn: new Set(), packets: [], messages: [], dialogs: [], ranOuts: [],
        turnFloor: 0, fresh: false, undone: false, at: 0, stepStarted: 0, stopped: false, beforeAct: null, room: null, checklist: null, brink: false,
        closeOffers: 0,
        /* One line per distinct violation, at the first step it was seen, and how many steps after it still saw it. */
        violate(inv, what, at = run.at) {
            const seen = found.find(f => f.inv === inv && f.what === what);
            if (seen) seen.again++;
            else found.push({ inv, at, what, again: 0 });
        },
        stop(inv, what) { run.violate(inv, what); run.stopped = true; }
    };
    must(Object.values(who).every(Boolean), `the world has not the ${Object.keys(who).length} students the case needs`);
    try {
        await watching(run, () => answerDialogs(run, async () => {
            for (const [k, step] of spec.steps.entries()) {
                run.at = k + 1;
                run.stepStarted = Date.now();
                await STEPS[step[0]](run, ...step.slice(1));
                if (!run.stopped) await assertIncidentInvariants(run);
                if (run.stopped) break;
            }
            await assertAtTheEnd(run);
        }));
    } finally {
        if (M.murderState()) await M.endMurder({ reason: "test", followUp: false });
        if (run.clockBefore) await setClock(run.clockBefore);
        for (const { token, x, y } of run.places.values()) if (token.parent?.tokens?.has(token.id)) await token.update({ x, y }, PLACE);
        for (const item of run.items.values()) if (item.parent?.items?.has(item.id)) await item.delete();
        const { isDeadForGm } = await import("./chapter.mjs");
        for (const actor of Object.values(who)) if (actor && isDeadForGm(actor)) await reviveCharacter(actor, { quiet: true });
    }
    const order = inv => Number(inv.slice(1));
    found.sort((a, b) => order(a.inv) - order(b.inv) || a.at - b.at);
    const invariants = [...new Set(found.map(f => f.inv))];
    const line = f => `${f.inv} at step ${f.at} (${stepName(spec.steps[f.at - 1])}): ${f.what}${f.again ? ` (and ${f.again} step(s) after)` : ""}`;
    ok(!found.length, `[${invariants.join(", ")}] - ${found.map(line).join("; ")}`
        + `${run.dialogs.length ? ` [windows closed unanswered: ${run.dialogs.join(", ")}]` : ""}`);
}

const stepName = step => (step ?? []).filter(a => typeof a !== "object").join(" ");

/* ==========================================================================
 * THE ENTRIES - one tier-2 test per case, spread into SCENARIOS
 * ========================================================================== */

const GRID = [
    ["grid DM01 - a direct murder whose opening fails", () => runCase("DM01"), GRID_RED.DM01],
    ["grid DM02 - a Finishing blow, the killer's gloves, the close and then the discovery", () => runCase("DM02"), GRID_RED.DM02],
    ["grid DM03 - a Despair opening, Self-defence with Fear, then the blow", () => runCase("DM03"), GRID_RED.DM03],
    ["grid DM04 - Self-defence, then Survive", () => runCase("DM04"), GRID_RED.DM04],
    ["grid DM05 - the victim runs out", () => runCase("DM05"), GRID_RED.DM05],
    ["grid DM06 - the GM closes it at the opening roll", () => runCase("DM06"), GRID_RED.DM06],
    ["grid DM07 - the GM closes it in the fight", () => runCase("DM07"), GRID_RED.DM07],
    ["grid DM08 - Role reversal with Hope, then the former victim's blow", () => runCase("DM08"), GRID_RED.DM08],
    ["grid DM09 - a critical Self-defence, then the free Survive", () => runCase("DM09"), GRID_RED.DM09],
    ["grid DM10 - a blow that killed: its Reroll refused, the death stands", () => runCase("DM10"), GRID_RED.DM10],
    ["grid DM11 - the killer dies in the fight", () => runCase("DM11"), GRID_RED.DM11],
    ["grid DM12 - the victim dies from the Students list in the fight", () => runCase("DM12"), GRID_RED.DM12],
    ["grid DM13 - a Tier 1 knife in hand and a failed opening", () => runCase("DM13"), GRID_RED.DM13],
    ["grid DM14 - the victim runs out while the hook's check races the action's", () => runCase("DM14"), GRID_RED.DM14],
    ["grid DM15 - a strike that leaves the victim standing, undone by a Reroll and taken again", () => runCase("DM15"), GRID_RED.DM15],
    ["grid DM16 - the killer dies in the fight by a death the GMs keep", () => runCase("DM16"), GRID_RED.DM16],
    ["grid TP01 - Partners, the blow, a betrayal from the tile in Stage 6, and the second incident's blow", () => runCase("TP01"), GRID_RED.TP01],
    ["grid TP02 - Partners, the blow, the close, and a betrayal from the checklist whose opening fails", () => runCase("TP02"), GRID_RED.TP02],
    ["grid TP03 - Partners, and two killers run the victim out", () => runCase("TP03"), GRID_RED.TP03],
    ["grid TP04 - Partners, Self-defence, then Survive", () => runCase("TP04"), GRID_RED.TP04],
    ["grid TP05 - the accomplice swings their own weapon, and the close", () => runCase("TP05"), GRID_RED.TP05],
    ["grid TP06 - Double role reversal, then the new killer's blow", () => runCase("TP06"), GRID_RED.TP06],
    ["grid TP07 - Double role reversal, the blow, and a betrayal from the tile", () => runCase("TP07"), GRID_RED.TP07],
    ["grid TP08 - Averted eyes, the third's token walks back into the room, and the blow", () => runCase("TP08"), GRID_RED.TP08],
    ["grid TP09 - Escape together", () => runCase("TP09"), GRID_RED.TP09],
    ["grid TP10 - a failed escape, then a fourth walks in", () => runCase("TP10"), GRID_RED.TP10],
    ["grid TP11 - a third who chooses nothing, and the blow", () => runCase("TP11"), GRID_RED.TP11],
    ["grid TP12 - a fourth walks in on a third", () => runCase("TP12"), GRID_RED.TP12],
    ["grid TP13 - the third asks to use an item, then chooses Partners in crime", () => runCase("TP13"), GRID_RED.TP13],
    ["grid TP14 - the accomplice dies in the fight", () => runCase("TP14"), GRID_RED.TP14],
    ["grid TR01 - a trap whose victim notices it, and the GM's close", () => runCase("TR01"), GRID_RED.TR01],
    ["grid TR02 - a trap that springs, and the victim's Leave a clue", () => runCase("TR02"), GRID_RED.TR02],
    ["grid TR03 - a trap that springs, Self-defence, then Survive", () => runCase("TR03"), GRID_RED.TR03],
    ["grid TR04 - a trap the GM moves to Stage 6 as the victim killed", () => runCase("TR04"), GRID_RED.TR04],
    ["grid TR05 - a trap's third sides with the builder, and the victim runs out", () => runCase("TR05"), GRID_RED.TR05],
    ["grid TR06 - a trap's third averts their eyes", () => runCase("TR06"), GRID_RED.TR06],
    ["grid TR07 - a trap's third escapes with the victim", () => runCase("TR07"), GRID_RED.TR07],
    ["grid TR08 - a trap the GM closes in the fight", () => runCase("TR08"), GRID_RED.TR08],
    ["grid TR09 - a trap's victim dies from the Students list", () => runCase("TR09"), GRID_RED.TR09],
    ["grid SI01 - a self-inflicted death whose opening fails", () => runCase("SI01"), GRID_RED.SI01],
    ["grid SI02 - a self-inflicted death that goes through, the close and the discovery", () => runCase("SI02"), GRID_RED.SI02],
    ["grid SI03 - a self-inflicted death that goes through, closed at once from the checklist", () => runCase("SI03"), GRID_RED.SI03],
    ["grid XI01 - a standing offer while an unrelated trap runs the same day", () => runCase("XI01"), GRID_RED.XI01],
    ["grid XI02 - a betrayal declared in an Eclipse", () => runCase("XI02"), GRID_RED.XI02],
    ["grid XI03 - the betrayal tile in a Class Trial, and the offer after it", () => runCase("XI03"), GRID_RED.XI03],
    ["grid XI04 - the day ends on a standing offer", () => runCase("XI04"), GRID_RED.XI04],
    ["grid XI05 - the blow that killed cannot be rerolled; the armed offer stands", () => runCase("XI05"), GRID_RED.XI05],
    ["grid XI06 - the season reset's close in the fight", () => runCase("XI06"), GRID_RED.XI06],
    ["grid XI07 - a betrayal declared in the Eclipse after Night opens the next morning", () => runCase("XI07"), GRID_RED.XI07]
];

export { GRID, CASES, INVARIANTS };
