/**
 * Danganronpa RPG - the incident's invariant grid (E32 C1, 28.09.2026; audit S17-10).
 * ---------------------------------------------------------------------------
 * Tier 2, spread into tests-tier2.mjs's SCENARIOS: one entry per case, each a list
 * of steps driven through the module's own GM calls - the ones the bridge hands a
 * player's packet to once it has judged it - and after every step sixteen
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
 * packets a player's browser receives. No layout: every roll is a total handed to the GM's
 * half, as the existing incident scenarios do - unless the step draws it (below).
 *
 * DRAWN ON THE GMS' RECORD (E33 C7, 07.10.2026; the stage plan's 2.6; audit S17-13's two cases,
 * DM17 and TP14, were on the grid's own facts). `act` with `drawn` throws the crisis roll as the
 * GM throws a player's: the packet cut from a roll of the actor's on the statistic the GM's list
 * picks (tests-tier2.mjs `drawnForPlayer`, the suite's one road to a draw), the GM's faces
 * scripted to the band (`DRAWN_FACES`), the roll's bookmark kept as the roller's browser keeps
 * it, and the crisis packet judged as the bridge judges that player's, naming the roll's
 * message - so the GM scores it on its record, not on the packet's numbers (`drawnAct`).
 * `reroll` with `fromRecord` makes the Reroll as `reroll.ask` does (reroll.mjs `rerollOnGm`;
 * the suite is the primary GM): the roll thrown again from the record's `scored` (E29 C11), the
 * dice scripted through `CONFIG.Dice.randomUniform` as the harness scripts a draw, the replay
 * from the GMs' row (`rerollFromRecord`). I15 then reads the record after every step
 * (`assertDrawn`). The drawn bands are a Strike's (threshold 15): 12 and 11 clear it with the
 * list's numbers at 0, 1 and 2 do not; another action drawn takes its own reading first.
 *
 * A WRITE THAT THROWS (E33 C8, 07.10.2026; the stage plan's 2.6, lead L5 of its 1.3). Every write
 * of the incident on a GM's browser goes through murder.mjs's one queue, which releases a write
 * that threw (`incidentWrites = run.catch(...)`) so that the next one runs - read since E32 C4,
 * measured by no test until XI08, and nor was what a throw between the cast's write and the world
 * half's leaves behind. `act` and `close` with `fault` refuse one write - the cast store's `patch`
 * or `game.settings.set` of the world half - once, as a store flush that fails would, and read both
 * halves against what the step would have written (`faulted`): both moved or neither (I16), and
 * the step after it is the queue's to run (I10). `putBack` (fix r2-G3, 07.10.2026; review round 2's
 * cor D4) refuses the world half's write and then the cast's put-back after it, which leaves the cast
 * ahead and must leave the caller the world half's error and the GM's console the put-back's (I17).
 */

import { MODULE_ID, KEY_REMNANTS, CRISIS_ACTIONS, TRAITS, HOPE_CALLS } from "./config.mjs";
import { SETTINGS, incidentCast } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { ownerOf } from "./utils.mjs";
import { ok, must, needs, world, wait, until, settle, stableJson } from "./tests-kit.mjs";

/* ==========================================================================
 * THE TABLES (the plan's 2.1), written from the handbooks, not imported
 * ========================================================================== */

/** What the world half of an incident may hold (incident-store.mjs `PUBLIC_INCIDENT`, E05 C8; the stage alone since E32 C2), as the grid's own list. */
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
    // Who walked in and out again (E32+E07 C10): nobody yet.
    departed: emptyList,
    thirdActed: v => !v,
    keyRemnants: v => v === KEY_REMNANTS.prepared,
    deniedToVictim: emptyList,
    hindered: emptySides,
    blocked: emptySides,
    unlocked: emptyList,
    spent: emptyList,
    drainStopped: v => !v,
    // The opening's statistic (E32+E07 C11c): the one the open picked, or none - the GM is asked after.
    openingTrait: (v, m) => (v ?? null) === m.openingTrait,
    // Per side, the action a Hope miss earned a second try at (E32+E07 C9): none yet.
    advantageNext: v => none(v) || (none(v.victim) && none(v.killer)),
    freeResolution: none,
    // Who struck a critical Finishing blow, whose first clean-up costs no Sanity (E32+E07 C13): nobody yet.
    freeCleanup: none,
    // The fight's last turns, for the GM's tracker (E32+E07 C17): none yet.
    recent: emptyList,
    lastCrisis: none,
    swung: v => none(v) || !Object.keys(v).length,
    endedBy: none,
    keyRemnantsStale: none,
    indirect: (v, m) => Boolean(v) === (m.kind === "trap"),
    selfInflicted: (v, m) => Boolean(v) === (m.kind === "self"),
    openedAt: (v, m, run) => typeof v === "number" && v >= run.stepStarted,
    // The chapter it opened in (E09 fix r1-G3): the clock's, which the grid does not move.
    chapter: v => v === (getClock()?.chapter ?? null)
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
    I14: "a victim runs out once: one ran-out card, one death",
    I15: "a drawn incident roll is settled once, on its record's last version",
    I16: "a write that throws leaves the incident before or after, never half",
    I17: "a write refused is the error its caller hears, and a put-back refused after it is on the GM's console"
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
    // E08+E28 C6b (S04-18): the Reroll's replay on the GMs' row - the striker's pick kept, the item used again or given back.
    DM17: { title: "a critical Strike on the killer's pick, its Reroll a critical that keeps it",
        steps: [["open"], ["opening", "hope"], ["act", "K", "strike", "crit", { choice: "stress" }], ["reroll", "K", "strike", "crit", { again: true }], ["close"]] },
    DM18: { title: "Use an item that heals, its Reroll a hit that uses it again",
        steps: [["gear", "K", "pack"], ["open"], ["opening", "hope"], ["act", "K", "useItem", "hit", { use: "pack" }], ["reroll", "K", "useItem", "hit", { again: true }], ["close"]] },
    DM19: { title: "Use an item that heals, its Reroll a miss that gives the heal and the pack back",
        steps: [["gear", "K", "pack"], ["open"], ["opening", "hope"], ["act", "K", "useItem", "hit", { use: "pack" }], ["reroll", "K", "useItem", "miss", { again: true }], ["close"]] },
    // E33 C7 (the plan's 1.3 L4): DM15 and DM17 through the GMs' record - the roll drawn by the GM, its Reroll made as `reroll.ask` is.
    DM20: { title: "a Strike drawn by the GM, its Reroll a miss that takes the hit back",
        steps: [["open"], ["opening", "hope"], ["act", "K", "strike", "hit", { drawn: true }], ["reroll", "K", "strike", "miss", { fromRecord: true }], ["close"]] },
    DM21: { title: "a critical Strike drawn by the GM on the killer's pick, its Reroll a critical that keeps it",
        steps: [["open"], ["opening", "hope"], ["act", "K", "strike", "crit", { choice: "stress", drawn: true }], ["reroll", "K", "strike", "crit", { fromRecord: true }], ["close"]] },
    // Fix r2-G3 (review round 2's cor D3): the other pick, and a sheet that moved after the GM counted the roll - the
    // one difference a Reroll rebuilt from the claim and the sheet, not the record's `scored`, adds up (I15).
    DM22: { title: "a critical Strike drawn by the GM on the killer's pick of Health, the statistic raised before its Reroll, a critical that keeps it",
        steps: [["open"], ["opening", "hope"], ["act", "K", "strike", "crit", { choice: "hp", drawn: true }], ["reroll", "K", "strike", "crit", { fromRecord: true, raise: 2 }], ["close"]] },

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
    // E33 C7 (the plan's 1.3 L6): TP14 by the death a GM's Kill keeps until found, as DM16 does the killer's.
    TP15: { title: "the accomplice dies in the fight by a death the GMs keep", third: true,
        steps: [["open"], ["opening", "hope"], ["enter", "T"], ["act", "T", "crimePartners"], ["act", "V", "leaveClue"], ["act", "K", "strike"],
            ["keptDeath", "T"], ["act", "V", "leaveClue"], ["act", "K", "strike"], ["close"]] },

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
            ["betray"], ["eclipse", false], ["close"]] },
    // E33 C8 (L5): one write refused at each writer - the fight's pass (the cast), a Survive's stage
    // write (both halves) and the close (both halves) - and the incident goes on after each. The
    // Self-defence first unlocks the Survive (DM04) and is not refused.
    XI08: { title: "a write of the incident refused once: the cast's at a Leave a clue, the world half's at a Survive and at the close",
        steps: [["open"], ["opening", "hope"], ["act", "V", "selfDefence"], ["act", "V", "leaveClue", "hit", { fault: "cast" }],
            ["act", "V", "survive", "hit", { fault: "world" }], ["close", null, { fault: "world" }], ["close"]] },
    // Fix r2-G3 (review round 2's cor D4, D5): a pass refused twice - the world half's write and the put-back of the
    // cast after it (I17) - and a Strike's pass refused after its hit landed, whose Reroll needs the receipt (I10).
    XI09: { title: "a pass refused: a Leave a clue's at its world half and at the put-back, and a Strike's whose Reroll then takes the hit back",
        steps: [["open"], ["opening", "hope"], ["act", "V", "leaveClue", "hit", { fault: "putBack" }],
            ["act", "K", "strike", "hit", { fault: "cast" }], ["reroll", "K", "strike", "miss"], ["close"]] }
};

/* ==========================================================================
 * THE REDS LEFT AT 73b1e89 (E32+E07 fix r1-G4), MEASURED 02.10.2026 on the harness
 * (e32run/g4f3) - 13 of the 28 red at 0642f1a (1.2.65), 28.09.2026; each a literal
 * marker, read by tools/stages.mjs. `failing` is the whole bracketed list the case
 * breaks (the head comment, WHAT A RED CASE SAYS): a commit that fixes one invariant
 * of several re-points it to the list still red, and the one that fixes the last
 * takes the marker off. The reason names the commit due to fix the last. E32+E07 C10
 * took off TP08's, TP10's and TP13's (S04-21, S04-33); C11a TP04's, TR03's, TR05's, TR06's
 * and TR07's (S04-06: no Role reversal in a trap or against an accomplice); C12 DM02's,
 * DM13's and TP05's (S04-17, S04-20, S05-23: the tools the incident used, and only those);
 * C13 the last two, DM12's and TR09's (S10-77: a victim's death from the Students list in
 * the fight offers Stage 6). Empty from C13 on, and kept: a case a later change turns red
 * is marked here, literally, or fails. The 1.2.66 release dropped `expectedRed` from the
 * import above, with nothing left to mark; a new marker imports it again from tests-kit.mjs.
 * ========================================================================== */

const GRID_RED = {
};

/* ==========================================================================
 * THE MODEL
 * ========================================================================== */

/** A new incident as the rules open it. */
function incident(kind, killer, victim) {
    return {
        kind, killerId: killer.id, victimId: victim.id, thirdId: null, thirdSide: null, thirdChose: false,
        escaped: false, departed: [], stage: "openingRoll", body: false, stageSix: false, openingTrait: null
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

/*
 * The GM's faces for a drawn crisis roll, by band (the plan's 2.6): the Hope die, the Fear die and the one
 * advantage or disadvantage die the GM's list may add (none for an unarmed Strike; a face left undrawn is
 * not thrown). A hit at 12 and 11 is 23 and a miss at 1 and 2 is 3 before the list's numbers, which
 * the suite's students hold at 0 on the statistic a Strike is drawn on (`drawnAct`).
 */
const DRAWN_FACES = Object.freeze({
    crit: { hope: 12, fear: 12, advantage: 1 }, hit: { hope: 12, fear: 11, advantage: 1 },
    hitFear: { hope: 11, fear: 12, advantage: 1 }, miss: { hope: 1, fear: 2, advantage: 1 }
});

/** The connected player who owns `actor`, or undefined: the grid's rollers are each one's (`peopleFor`). */
const playerOf = actor => game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));

const PLACE = { teleport: true, movementAction: "displace", animate: false };
const tokenOf = actor => canvas?.scene?.tokens?.find(t => t.actorId === actor.id) ?? null;

const STEPS = {
    /* With the opening's statistic picked as the murder opens (E32+E07 C11c), as the GM's
       murder window can: without it the GM is asked in a window, which on a GM's browser in
       the suite nobody answers. The model keeps it for FRESH. */
    async open(run, kind = run.spec.kind ?? "direct", killer = "K", victim = "V") {
        const K = run.who[killer], V = kind === "self" ? K : run.who[victim];
        const openingTrait = kind === "trap" ? "head" : "hand";
        const opened = await run.M.openMurder({ killerId: K.id, victimId: V.id, indirect: kind === "trap", openingTrait });
        must(opened, `the ${kind} incident did not open`);
        opens(run, kind, K, V);
        run.model.openingTrait = openingTrait;
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
     * `choice` is a critical Strike's pick; `use` names a pack the player's browser used
     * first (`usedAsPlayer`). What the GMs' row would hold of it is kept for `reroll`.
     * `drawn` (E33 C7): the roll drawn by the GM for the actor's player and the packet judged
     * as that player's, on the GMs' record (`drawnAct`); the band is the faces', not a total.
     * `fault` (E33 C8): the action's first write of the cast ("cast") or of the world half
     * ("world") is refused once, and what landed is read against the model (`faulted`);
     * "putBack" (fix r2-G3) refuses the world half's and then the cast's put-back.
     */
    async act(run, who, key, result = "hit", { free = false, swing = null, refused = false, choice = null, use = null, drawn = false, fault = null } = {}) {
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
        const pack = use ? run.items.get(`${who}:${use}`) : null;
        const before = pack ? await usedAsPlayer(actor, pack) : null;
        run.facts = { crisis: key, choice, usedItemId: pack?.id ?? null, usedFor: pack ? "hitPoints" : null, before };
        if (drawn) {
            if (!await drawnAct(run, actor, key, result, { free, swungId: item?.id ?? null, choice, usedItemId: pack?.id ?? null, before })) return;
            applyAct(run, actor, key, free || result !== "miss");
            return;
        }
        const packet = { actorId: actor.id, key, ...roll, free, swungId: item?.id ?? null, choice, usedItemId: pack?.id ?? null, before };
        const hit = roll.total > 0 || roll.isCritical || free;
        const label = `${actor.name}'s ${key}`;
        if (fault) return faulted(run, label, fault, () => run.M.resolveCrisisAction(packet), () => applyAct(run, actor, key, hit));
        if (!await queued(run, label, () => run.M.resolveCrisisAction(packet))) return;
        applyAct(run, actor, key, hit);
    },

    /*
     * A REROLL OF THE LAST CRISIS ACTION: the receipt's undo and the new result, one call as
     * the bridge makes it. An action that left a body the model did not hold before it is
     * not taken back (E32+E07 C8b, the owner's answer (A) of 28.09): the death stands, the
     * call is refused and the model does not move - a Reroll let through is I8's, the death
     * of a blow that no longer landed. Any other is taken back; refused, the case stops (I10).
     * `again` (E08+E28 C6b): the replay as a GM makes it, on the row the last action left
     * (reroll.mjs `settleCrisis`), not the bridge's packet. `fromRecord` (E33 C7): the whole
     * Reroll as `reroll.ask` makes it on the GM, of the roll the case drew for this actor,
     * thrown again from the GMs' record and replayed from their row (`rerollFromRecord`);
     * `raise` (fix r2-G3) raises the statistic it was drawn on that much first, by a GM's ruling.
     */
    async reroll(run, who, key, result, { again = false, fromRecord = false, raise = 0 } = {}) {
        const actor = run.who[who];
        const roll = RESULTS[result];
        const back = run.beforeAct;
        must(back, "there is no crisis action to take back");
        const killed = [...run.bodies.keys()].some(id => !back.bodies.some(([was]) => was === id));
        const out = fromRecord
            ? await rerollFromRecord(run, actor, key, result, { raise })
            : again
                ? await (await import("./reroll.mjs")).settleCrisis(actor, run.facts, roll, [])
                : await run.M.resolveCrisisAction({ actorId: actor.id, key, ...roll, undo: true });
        if (killed) {
            if (out) run.violate("I8", `the Reroll of ${actor.name}'s ${key}, which killed, was let through`);
            return;
        }
        if (!out) {
            run.stop("I10", `the Reroll of ${actor.name}'s ${key}, which killed nobody, was refused${run.refusal ? `: ${run.refusal}` : ""}`);
            return;
        }
        run.model = back.model;
        run.offer = back.offer;
        run.bodies = new Map(back.bodies);
        run.blackened = new Set(back.blackened);
        run.swung = new Map(back.swung);
        run.undone = true;
        applyAct(run, actor, key, fromRecord ? result !== "miss" : roll.total > 0 || roll.isCritical);
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
     * decides what that is. The rules: a third who left (Averted eyes, a failed escape)
     * does not walk back in (I13); a newcomer on an empty seat becomes the third - after a
     * failed escape too, whose third no longer counts; a newcomer on a third who is still
     * there crowds the incident out (it closes). A failed escape's third leaves at the
     * escape (`applyAct`, E32+E07 C10): until then the model kept them seated to this move.
     */
    async move(run, who) {
        const { positionIn } = await import("./movement.mjs");
        const actor = run.who[who], m = run.model;
        const before = run.M.murderState();
        /* A CROWD WAITS FOR THE CLOSE (05.10.2026, the 1.2.67 release's npm test). TP12 failed
           once in a whole suite, "the stage is incident, the model's null", while the GM's
           console logged the crowd's close all the same ("made a fourth", "Murder closed
           (crowded)", written once the state is wiped), so it landed after the check: the close
           is a card and then the whole of closeIncident, and late in a suite it outran 1500 ms
           (by how much was not logged). TP12 alone settles in 99 ms, TP10's
           newcomer in 55 ms (a probe of every TP case that day), and in the next whole suite
           TP12's crowd settled in 95 ms; it passed in 43 of the 44 results files of the E08+E28
           runs that hold it. The longer wait is only where a close is due:
           a third who walks back in (TP08) changes nothing and waits the whole bound.
           AND FOR THE WHOLE CLOSE, NOT ITS FIRST HALF (E09 fix r1-G3, 08.10.2026; k1's TP12).
           The wait ended on "the third changed", and the close wipes the cast first and the
           world half after it (incident-store.mjs `restoreState`): a probe of TP12, three times
           after 01-runtests's preamble, failed once with the wait ending 108 ms after "made a
           fourth" on the state between the two writes - third null, stage "incident" - and the
           close logged 3 ms later; the passing two closed 4 and 10 ms after the wait began.
           Holding every write of the world half that ends an incident 300 ms on the GM (a probe,
           scratchpad e09run/scratch/r1g3tp12-par and -fix, 08.10.2026) failed TP12 in 3 runs of
           3 on the parent's grid, each with that I10 at step 5, and in none of 3 with this wait:
           a crowd waits for no incident at all. */
        const crowding = Boolean(m.thirdId) && !m.departed.includes(actor.id);
        await placeIn(run, actor, run.room, positionIn);
        await until(() => {
            const now = run.M.murderState();
            return crowding ? !now : (!now || now.thirdId !== before?.thirdId);
        }, crowding ? 4000 : 1500);
        if (m.departed.includes(actor.id)) {
            if (run.M.murderState()?.thirdId === actor.id) run.violate("I13", `${actor.name} left the incident and walked back into it`);
            return;
        }
        if (m.thirdId) {
            closeIncident(run);
            return;
        }
        Object.assign(m, { thirdId: actor.id, thirdSide: null, thirdChose: false, escaped: false });
        run.everIn.add(actor.id);
        const now = run.M.murderState();
        if (now?.thirdId !== actor.id) {
            run.violate("I13", `a third who left still counted: ${actor.name} walking in ${now ? "did not become the third" : "crowded the incident out"}`);
        }
    },

    async resolve(run, reason) {
        must(await run.M.beginResolution(reason), "the GM could not move the incident to Stage 6");
        stageSix(run, { body: false });
    },

    /* The GM's close: the tracker's "Close the murder", or its checklist (`followUp`), answered with `checklist`. */
    async close(run, checklist = null, { fault = null } = {}) {
        const m = run.model;
        run.checklist = checklist;
        const offer = run.offer;
        const end = () => run.M.endMurder({ reason: "closed", followUp: Boolean(checklist) });
        if (fault) return faulted(run, "the close", fault, end, () => closeIncident(run));
        if (!await queued(run, "the close", end)) return;
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
       bodies published, and the cleaning tools of their killers broken - the bodies found
       are handed to it, as `runDiscovery` hands it the bodies in the room (fix r2-G3). The
       gather that moves every token is not run - the runner could not put the scene back. */
    async discover(run) {
        const { publishDeath } = await import("./chapter.mjs");
        const { destroyCleaningTools } = await import("./cleanup.mjs");
        const found = [];
        for (const [id, body] of run.bodies) {
            if (body.discovered) continue;
            must(await publishDeath(game.actors.get(id)), `${game.actors.get(id)?.name}'s death could not be published`);
            body.discovered = true;
            found.push(id);
            for (const killer of body.killers) {
                for (const [key, item] of run.items) if (key.endsWith(":gloves") && item.parent?.id === killer) run.broken.add(item.id);
            }
        }
        await destroyCleaningTools(found);
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

    /* A fixture item in hand: a Tier 1 knife (a weapon) or gloves (a cleaning tool); or a Tier 1
       healing pack of two, carried, with two Health marks for it to heal (E08+E28 C6b). Deleted by the case. */
    async gear(run, who, what) {
        const actor = run.who[who];
        const pack = what === "pack";
        const flags = pack ? { category: "usable", tier: 1, usableKind: "healing" }
            : { category: what === "knife" ? "crimeTool" : "cleaningTool", equipped: true, tier: 1 };
        const [item] = await actor.createEmbeddedDocuments("Item", [{ name: `SUITE grid ${what}`, type: "loot",
            ...(pack ? { system: { quantity: 2 } } : {}), flags: { [MODULE_ID]: flags } }]);
        must(item, `${actor.name} could not be handed the ${what}`);
        if (pack) await actor.update({ "system.resources.hitPoints.value": 2 });
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

/**
 * A CRISIS ACTION DRAWN BY THE GM AND SETTLED ON ITS RECORD (E33 C7, 07.10.2026; the head comment,
 * DRAWN ON THE GMS' RECORD). The packet is cut on the statistic the GM's list picks for the action
 * when no pick card stands - the lowest of the action's on the sheet, the first listed of equals
 * (roll-draw.mjs `lowestOf`) - so the claim and the list agree and the GM flags nothing. The
 * roller's browser bookmarks its roll before the action's packet leaves (action-rolls.mjs
 * `rollTrait`), so `roll.bookmark` is judged first, as that player's, and the crisis packet after
 * it, naming the roll's message as the roller's does; the packet's numbers are the record's, which
 * the bridge reads for itself. What the step drew is kept on `run.drawn` for `reroll` and I15, with
 * the victim's marks after the action for the pick's check. Answers whether the action was carried
 * out; a draw or a packet refused stops the case (I10).
 */
async function drawnAct(run, actor, key, result, { free, swungId, choice, usedItemId, before }) {
    const { drawnForPlayer } = await import("./tests-tier2.mjs");
    const G = await import("./bridge-guards.mjs");
    const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
    const player = playerOf(actor);
    must(player, `${actor.name} has no connected player to draw for`);
    const sheet = actor.system?.traits ?? {};
    const value = t => Number(sheet[TRAITS[t]?.dh]?.value) || 0;
    const listed = CRISIS_ACTIONS[key]?.traits ?? [];
    must(listed.length, `${key} lists no statistic to draw on`);
    const trait = listed.reduce((low, t) => (value(t) < value(low) ? t : low));
    const F = await drawnForPlayer(player, actor, { actionKey: "crisis", trait, faces: DRAWN_FACES[result], edit: p => ({ ...p, context: { crisis: key } }) });
    const d = { ...F, actor, key, player, trait, result, band: result, choice, versions: 0, marks: null };
    run.drawn.push(d);
    const refused = F.sent.find(r => r.action === "bridge.refused")?.reason ?? null;
    if (refused || !F.record || !F.message) {
        run.stop("I10", `${actor.name}'s ${key} was not drawn: ${refused ?? "no record was kept"}`);
        return false;
    }
    const told = [];
    const judge = packet => G.judge(BRIDGE_ACTIONS, { requestId: `GRID${foundry.utils.randomID(8)}`, ...packet }, player.id,
        { send: (to, reply) => { if (reply?.action === "bridge.refused") told.push(reply.reason ?? "refused"); } });
    await judge({ action: "roll.bookmark", actorId: actor.id, messageId: F.message.id, actionKey: "crisis", trait, experiences: [], context: { crisis: key } });
    await judge({ action: "murder.crisis", actorId: actor.id, key, total: F.record.total, isCritical: F.record.isCritical, withHope: F.record.withHope,
        rollId: F.message.id, choice, usedItemId, swungId, free, before });
    if (told.length) {
        run.stop("I10", `${actor.name}'s drawn ${key} was refused: ${told.join("; ")}`);
        return false;
    }
    await settle();
    d.marks = marksOf(game.actors.get(run.model?.victimId ?? ""));
    return true;
}

/** A character's Health and Sanity marks, as the incident's damage lands them. */
const marksOf = actor => (actor ? { hitPoints: actor.system?.resources?.hitPoints?.value ?? null, stress: actor.system?.resources?.stress?.value ?? null } : null);

/**
 * THE REROLL AS `reroll.ask` MAKES IT (E33 C7, 07.10.2026): on this GM, for the roller, of the last
 * roll the case drew for this actor; I15 reads the record it writes. The Hope the Call costs is
 * given the actor as a GM's ruling first, and the Reroll waits until the GMs hold it (sheet-audit.mjs
 * `meansHeld`, what `rerollRefusal` reads) - the suite's cast holds what the world gave them, and
 * restore() puts it back. The dice are scripted through `CONFIG.Dice.randomUniform` for the band -
 * the Hope die, the Fear die and the advantage die, in the order the dice draw, as the harness
 * scripts a draw (client-entry.mjs `harnessEvaluate`); a Reroll with no third die leaves that face
 * undrawn, and the randomiser is put back whatever happened. Answers whether the Reroll stood;
 * the refusal, if one, is kept on `run.refusal` for the step's I10.
 *
 * THE MESSAGE'S ROLL AS A ROLL. A chat message's `rolls` are data in the harness (lib/shim.mjs
 * `ChatMessage`), and the Reroll asks the roll to throw itself again (reroll.mjs `rerollRefusal`
 * refuses "no roll to throw again" otherwise - measured 07.10.2026, the first run of DM20 and
 * DM21). So the drawn message is given its roll as Daggerheart's own class for the Reroll's time
 * and let go after: built from the message's formula and options (the harness's message keeps a
 * roll's dice as totals, not terms - client-entry.mjs `harnessMessage`; `fromData` found none,
 * the second run) and thrown once under a script of the dice the record holds, so it stands on
 * the faces the GMs kept. The rebuild from `scored` and the throw are then the module's and
 * Daggerheart's own, where the tier-2 Reroll tests and scenario 13 use a stand-in of fixed faces.
 *
 * `raise` (fix r2-G3, 07.10.2026; review round 2's cor D3): the statistic the roll was drawn on is
 * raised that much by a GM's ruling just before the Reroll and put back after it, so the sheet is no
 * longer what the GM counted. A Reroll thrown from the record's `scored` adds up as before; one
 * rebuilt from the claim's statistic on the sheet - the road before E29 C11, C7's mutant m1, measured
 * equivalent on DM20 and DM21, whose sheets stand still - totals that much more, and I15 reads it.
 */
async function rerollFromRecord(run, actor, key, result, { raise = 0 } = {}) {
    const d = run.drawn.findLast(r => r.actor.id === actor.id);
    must(d && d.key === key, `no roll of ${actor.name}'s ${key} was drawn for the case to reroll`);
    const { rerollOnGm } = await import("./reroll.mjs");
    const { trustedWrite } = await import("./resource-guard.mjs");
    const { meansHeld } = await import("./sheet-audit.mjs");
    const cost = HOPE_CALLS.reroll.cost;
    if ((actor.system?.resources?.hope?.value ?? 0) < cost) await trustedWrite(actor, { "system.resources.hope.value": cost }, { reason: "gmRuling" });
    must(await until(() => meansHeld(actor).hope >= cost, 3000), `the GMs do not hold ${actor.name}'s ${cost} Hope for the Reroll`);
    const message = game.messages.get(d.message?.id ?? "");
    const json = message?.rolls?.[0] ?? null;
    const record = (await import("./roll-draw.mjs")).rollRecord(d.record?.rollId ?? null);
    must(json?.formula && record?.dice?.length, `the message of ${actor.name}'s drawn ${key} holds no roll, or its record no dice`);
    const uniform = (face, sides) => 1 - (face - 0.5) / sides;
    const dice = CONFIG.Dice, real = dice.randomUniform;
    // The advantage mode, which Daggerheart's roll reads of every roll (d20Roll.mjs:61, 2.10.5) and the harness's
    // message does not write (`harnessMessage`): the record's sign, a number as the module's `drawnOptions` passes it.
    const options = foundry.utils.deepClone(json.options ?? {});
    options.roll = { ...(options.roll ?? {}), advantage: Math.sign(Number(record.scored?.advantage) || 0) };
    const original = new game.system.api.dice.DualityRoll(json.formula, {}, options);
    const kept = record.dice.map(die => uniform(die.results?.[0]?.result ?? 1, die.faces ?? 12));
    dice.randomUniform = () => kept.shift() ?? real();
    try {
        await original.evaluate();
    } finally {
        dice.randomUniform = real;
    }
    Object.defineProperty(message, "rolls", { configurable: true, get: () => [original] });
    const faces = DRAWN_FACES[result];
    const script = [[faces.hope, 12], [faces.fear, 12], [faces.advantage, 6]].map(([face, sides]) => uniform(face, sides));
    const path = `system.traits.${TRAITS[d.trait]?.dh}.value`;
    const stood = foundry.utils.getProperty(actor, path);
    must(!raise || typeof stood === "number", `${actor.name} holds no ${d.trait} to raise`);
    if (raise) await trustedWrite(actor, { [path]: stood + raise }, { reason: "gmRuling" });
    dice.randomUniform = () => script.shift() ?? real();
    let out;
    try {
        out = await rerollOnGm(actor, d.player);
    } finally {
        dice.randomUniform = real;
        delete message.rolls;
        if (raise) await trustedWrite(actor, { [path]: stood }, { reason: "gmRuling" });
    }
    await settle();
    run.refusal = out?.refused ?? null;
    if (!out || out.refused) return false;
    d.versions++;
    d.band = result;
    return true;
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
        // "Only you get out" (config.mjs `sharedEscape.failure`; the plan's 3.6): the third has left.
        else {
            m.departed.push(m.thirdId);
            Object.assign(m, { thirdId: null, thirdSide: null });
        }
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

/*
 * ONE WRITE REFUSED, AND WHAT IT LEFT (E33 C8, 07.10.2026; the stage plan's 2.6 and lead L5). The
 * incident is written in two stores - the cast (gm-stores.mjs `castStore`, the GMs' own) and the
 * world half (`game.settings`, every client's) - and murder.mjs writes the cast first. The fault
 * refuses the first write of the one named, once, with a rejection as a flush that fails gives
 * (the cast store's `patch`, or `settings.set` of the incident's own key alone - Daggerheart's
 * Fear and the module's other settings pass), and is put back whatever the step did. Then both
 * halves are read against what they were and the model moved as the step would have moved it:
 * where that moves the stage the world half must have moved exactly when the cast did (I16) -
 * one half alone is the half-applied transition L5 asked about, and the case stops there, since
 * the model can follow neither half; where the stage stays the world half had nothing to write,
 * and the cast says whether the write landed. A write that landed in neither half puts the model
 * back. The stack of the refused call is kept for the line, so a red case names the writer.
 * A throw out of the module is recorded, not required: a writer that swallowed it would leave the
 * same halves, and the line says it answered as if written.
 *
 * `putBack` (fix r2-G3, 07.10.2026; review round 2's cor D4): the world half's write is refused, and
 * then the next write of the cast - `castPutBack`'s, stamping back what the step wrote. The cast is
 * then ahead of the stage, which is what murder.mjs says of that case, so it is run only at a step
 * that keeps the stage (a pass), where the world half it failed to write held nothing new. What is
 * asked of it is I17's: the caller hears the world half's refusal, and the GM's console (`error`,
 * read for the write's time) holds the put-back's.
 */
async function faulted(run, label, kind, write, apply) {
    const { castStore } = await import("./gm-stores.mjs");
    const worldHalf = () => game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    const before = { world: stableJson(worldHalf()), cast: stableJson(incidentCast()) };
    const fault = { kind, label, fired: 0, where: null, threw: null };
    const order = kind === "putBack" ? ["world", "cast"] : [kind];
    const said = { world: "the incident's world half write", cast: kind === "putBack" ? "the put-back's cast write" : "the incident's cast write" };
    const refusal = half => `the grid refused ${said[half]} once`;
    const ports = { world: [game.settings, "set"], cast: [castStore, "patch"] };
    const restores = [];
    for (const half of new Set(order)) {
        const [target, name] = ports[half];
        const own = Object.getOwnPropertyDescriptor(target, name), was = target[name];
        restores.push(() => { if (own) Object.defineProperty(target, name, own); else delete target[name]; });
        target[name] = function (...args) {
            if (order[fault.fired] !== half || (half === "world" && !(args[0] === MODULE_ID && args[1] === SETTINGS.murderState))) return was.apply(this, args);
            fault.fired++;
            fault.where ??= (new Error().stack ?? "").split("\n").slice(2, 5).map(l => l.trim().replace(/^at /, "")).join(" < ");
            return Promise.reject(new Error(refusal(half)));
        };
    }
    const logged = [], console_ = globalThis.console, ownLog = Object.getOwnPropertyDescriptor(console_, "error"), logError = console_.error;
    console_.error = function (...args) {
        logged.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(" "));
        return logError.apply(this, args);
    };
    const back = structuredClone({ model: run.model, offer: run.offer, bodies: [...run.bodies], blackened: [...run.blackened], swung: [...run.swung], closed: run.closed });
    try {
        await write();
    } catch (err) {
        fault.threw = err.message;
    } finally {
        for (const restore of restores) restore();
        if (ownLog) Object.defineProperty(console_, "error", ownLog); else delete console_.error;
    }
    // A queue that did not release an earlier fault answers this write with that fault's error before
    // this one is met: the step never ran, which is I10's (as `queued` reads it).
    if (!fault.fired && fault.threw && run.faults.length) {
        run.stop("I10", `${label} was never written after the fault: ${fault.threw}`);
        return;
    }
    run.faults.push(fault);
    must(fault.fired === order.length, `${label} met the fault ${fault.fired} time(s), not ${order.length}`);
    if (kind === "putBack") {
        if (fault.threw !== refusal("world")) {
            run.violate("I17", `${label}, refused at its world half and then at the put-back of its cast, told its caller ${fault.threw ? JSON.stringify(fault.threw) : "nothing"}`);
        }
        if (!logged.some(line => line.includes(refusal("cast")))) run.violate("I17", `${label}: the put-back's refusal is not on the GM's console`);
    }
    const moved = { world: stableJson(worldHalf()) !== before.world, cast: stableJson(incidentCast()) !== before.cast };
    const stageBefore = run.model?.stage ?? null;
    apply();
    const stageMoves = (run.model?.stage ?? null) !== stageBefore;
    if (stageMoves && moved.world !== moved.cast) {
        run.stop("I16", `${label}, refused at its ${order.map(h => (h === "world" ? "world half" : "cast")).join(" and ")}, landed in ${moved.cast ? "the cast" : "the world half"} alone`
            + `${fault.threw ? "" : "; the call answered as if written"} (refused: ${fault.where})`);
        return;
    }
    if (!(stageMoves ? moved.world : moved.cast)) putBack(run, back);
}

/** The model as a step found it, for a write that landed in neither half: the close's count with it (I4 counts closes). */
function putBack(run, back) {
    run.model = back.model;
    run.offer = back.offer;
    run.bodies = new Map(back.bodies);
    run.blackened = new Set(back.blackened);
    run.swung = new Map(back.swung);
    run.closed = back.closed;
}

/**
 * A write after a fault. The queue answers the next write with the fault's own error when it
 * did not release (XI08's mutant c8-queue-no-catch: `incidentWrites = run`), and that is I10's -
 * the step the model expects never ran - not a test error; before any fault, a throw is the
 * test's as before.
 */
async function queued(run, label, write) {
    if (!run.faults.length) {
        await write();
        return true;
    }
    try {
        await write();
        return true;
    } catch (err) {
        run.stop("I10", `${label} was never written after the fault: ${err.message}`);
        return false;
    }
}

/**
 * A pack used as the player's browser uses one before it tells the GM (murder-rules.mjs
 * `afterCrisisRoll`): a Tier 1 heal - one Health mark off - and one off the pack. Answers what
 * it started from, as the browser sends it.
 */
async function usedAsPlayer(actor, pack) {
    const r = actor.system?.resources ?? {};
    const before = { hp: r.hitPoints?.value ?? 0, stress: r.stress?.value ?? 0, qty: Number(pack.system?.quantity ?? 1) };
    await actor.update({ "system.resources.hitPoints.value": Math.max(0, before.hp - 1) });
    await pack.update({ "system.quantity": before.qty - 1 });
    return before;
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
        // The opening's statistic is the GMs' pick and in no player's copy (E32+E07 C11c): its roller is sent it with the invitation.
        if (!none(copy.openingTrait)) run.violate("I2", `${user.name}'s copy holds the opening's statistic, ${copy.openingTrait}`);
        // Who struck a critical Finishing blow (E32+E07 C13) only in a killer's copy, whose browser quotes the free
        // attempt by it (fix r2-G3, the round-2 review's C2-m1): the GMs' value there, null in anybody else's.
        const freeDue = killerSide ? state?.freeCleanup ?? null : null;
        if ((copy.freeCleanup ?? null) !== freeDue) run.violate("I2", `${user.name}'s copy names the free clean-up's striker ${nameOf(copy.freeCleanup)}, due ${nameOf(freeDue)}`);
        // Nor the fight's last turns (E32+E07 C17): the GM's tracker is their one reader.
        if (!none(copy.recent)) run.violate("I2", `${user.name}'s copy holds the fight's last turns, ${JSON.stringify(copy.recent)}`);
        /* The fight as the GMs hold it: a seat reads its turn off its own copy (E32 C2) - but the Key
           Remnants' count, the GMs' alone, and for a trap's killers, seated from Stage 6 on, all of it:
           their rolls' results, which E06 keeps from the builder (fix r1-G1; the review's m1, M2). What
           a copy holds null its stamp does not tell either: it reads as the newest of the stamps of what
           the copy shows, so it moves when they do and never alone. Who walked in and out again
           (`departed`, E32+E07 C10) and the Reroll receipt are in no player's copy and stamp as the
           rest withheld, and a trap's killers whose copy seats no third are not timed the third's
           seat and side either (fix r2-G2, the round-2 review's S2-m1 and S2-m3). */
        const copied = [...FIGHT_FIELDS, "departed"];
        const afterFight = m.kind === "trap" && killerSide;
        const withheld = [...(afterFight ? [...FIGHT_FIELDS, ...(none(copy.thirdId) ? ["thirdId", "thirdSide"] : [])] : ["keyRemnants"]),
            "departed", "lastCrisis", "openingTrait", ...(killerSide ? [] : ["freeCleanup"]), "recent"];
        const due = f => (withheld.includes(f) ? null : state?.[f] ?? null);
        const unlike = copied.filter(f => JSON.stringify(copy[f] ?? null) !== JSON.stringify(due(f)));
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

    // I15 - every roll the case drew, on the GMs' record of it.
    if (run.drawn.length) await assertDrawn(run, state);
}

/**
 * I15 (E33 C7, 07.10.2026). For every roll the case drew: its record stands under its message,
 * naming the actor and the crisis action; `resolved` holds the action once - the packet settled
 * it, and a Reroll replays the GMs' row rather than settling the record again; the versions kept
 * under the one that stands are as many as the case's Rerolls; and each version - the one that
 * stands and each one under it - adds up to its Hope and Fear die, its other dice at the list's
 * sign, and the numbers the GM counted (`scored.modifiers`). A version thrown from anything but the
 * record's `scored` (reroll.mjs `rollAsThrown`) reads here as a sum that does not close only where
 * that road reads other numbers: on DM20 and DM21 the claim's statistic is the one the GM counted
 * and the sheet has not moved, and C7's mutant m1 (the Reroll rebuilt from the claim and the sheet)
 * passed them; DM22 raises the statistic before its Reroll (`rerollFromRecord`'s `raise`), and the
 * same mutant is red there (fix r2-G3, 07.10.2026; review round 2's cor D3). The incident's last
 * action, where it is this roll's, is scored on the version that stands - the band of the GM's
 * tracker line (`recent`) and its success at the action's threshold are the record's (a Finishing
 * blow's threshold moves, so its success is not read); where it is not this roll's, nothing of the
 * kind is read. A critical with a pick (a Strike's) lands the pick: the tracker line's `changes`,
 * read off the victim's sheet before the pass (murder-rules.mjs `landedSince`, so the drain at the
 * victim's turn is not in it), are the action's critical amount on the resource picked and none on
 * the other - after the first throw and after a Reroll's replay alike (fix r2-G3: until then only
 * the marks below were compared, which a pick landed the wrong way round on both throws passes
 * by reading - this fix's mutant m4 swaps it, and only the check above is red). And a
 * critical Strike's Reroll that is a critical again leaves the victim's marks as they were after
 * the first throw (`drawnAct`), which the undo put back and the replay marked again from the row's
 * `choice` (reroll.mjs `settleCrisis`, `again`).
 */
async function assertDrawn(run, state) {
    const { rollRecord } = await import("./roll-draw.mjs");
    const sum = die => (die?.results ?? []).filter(r => r.active !== false).reduce((n, r) => n + (Number(r.result) || 0), 0);
    for (const d of run.drawn) {
        const record = rollRecord(d.record?.rollId ?? null);
        const name = `${d.actor.name}'s drawn ${d.key}`;
        if (!record || record.messageId !== d.message?.id || record.actorId !== d.actor.id || record.crisis !== d.key) {
            run.violate("I15", `the record of ${name} is ${record ? "another roll's" : "gone"}`);
            continue;
        }
        const settled = (Array.isArray(record.resolved) ? record.resolved : []).filter(s => s === "crisis").length;
        if (settled !== 1) run.violate("I15", `the record of ${name} is settled ${settled} time(s)`);
        const versions = Array.isArray(record.versions) ? record.versions : [];
        if (versions.length !== d.versions) run.violate("I15", `the record of ${name} keeps ${versions.length} version(s) under the one that stands, the case made ${d.versions} Reroll(s)`);
        const counted = (record.scored?.modifiers ?? []).reduce((n, mod) => n + (Number(mod.value) || 0), 0);
        const sign = Math.sign(Number(record.scored?.advantage) || 0);
        for (const [i, v] of [record, ...versions].entries()) {
            const [hope, fear, ...extra] = Array.isArray(v.dice) ? v.dice : [];
            const due = sum(hope) + sum(fear) + sign * extra.reduce((n, die) => n + sum(die), 0) + counted;
            if (v.total !== due || v.hope !== sum(hope) || v.fear !== sum(fear)) {
                run.violate("I15", `${i ? `version ${i} under` : "the version that stands of"} ${name} totals ${v.total} (Hope ${v.hope}, Fear ${v.fear}); its dice and the list's numbers make ${due}`);
            }
        }
        const last = state?.lastCrisis ?? null, line = state?.recent?.at?.(-1) ?? null;
        if (!last || last.actorId !== d.actor.id || last.key !== d.key || !line || line.key !== d.key) continue;
        const band = record.isCritical ? "critical" : record.withHope ? "hope" : "despair";
        const threshold = CRISIS_ACTIONS[d.key]?.threshold;
        const success = record.isCritical || (typeof threshold === "number" && record.total >= threshold);
        if (line.band !== band || (d.key !== "finishingBlow" && line.success !== success)) {
            run.violate("I15", `${name} was scored ${line.band}, ${line.success ? "a success" : "a failure"}; the version that stands is ${band}, ${success ? "a success" : "a failure"}`);
        }
        const critical = CRISIS_ACTIONS[d.key]?.damage;
        if (record.isCritical && d.choice && critical?.critical?.choice) {
            const landed = resource => (line.changes ?? []).filter(c => c.actorId === state?.victimId && c.key === resource)
                .reduce((n, c) => n + (Number(c.landed) || 0), 0);
            const picked = d.choice === "hp" ? "hitPoints" : "stress", other = picked === "hitPoints" ? "stress" : "hitPoints";
            const amount = critical.criticalAmount ?? 2;
            if (landed(picked) !== amount || landed(other) !== 0) {
                run.violate("I15", `${name}, a critical on ${d.choice}, landed ${landed("hitPoints")} Health and ${landed("stress")} Sanity on the victim; the pick is ${amount} on ${picked}`);
            }
        }
        if (d.versions && d.band === d.result && record.isCritical && d.choice && d.marks) {
            const now = marksOf(game.actors.get(state?.victimId ?? ""));
            if (JSON.stringify(now) !== JSON.stringify(d.marks)) {
                run.violate("I15", `after the Reroll of ${name}, a critical on ${d.choice} again, the victim's marks are ${JSON.stringify(now)}; after the first throw ${JSON.stringify(d.marks)}`);
            }
        }
    }
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
    const living = livingStudents();
    const [K, V, T] = living.filter(playerOf);
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
        closeOffers: 0, drawn: [], refusal: null, faults: [],
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
        // A close the queue answers with an earlier write's error (XI08 under its no-catch mutant) is the
        // incident still standing against a closed model - I10 - and must not throw over the case's own line.
        if (M.murderState()) {
            try {
                await M.endMurder({ reason: "test", followUp: false });
            } catch (err) {
                run.violate("I10", `the close after the case: ${err.message}`);
            }
        }
        if (run.clockBefore) await setClock(run.clockBefore);
        for (const { token, x, y } of run.places.values()) if (token.parent?.tokens?.has(token.id)) await token.update({ x, y }, PLACE);
        for (const item of run.items.values()) if (item.parent?.items?.has(item.id)) await item.delete();
        const { isDeadForGm } = await import("./chapter.mjs");
        for (const actor of Object.values(who)) if (actor && isDeadForGm(actor)) await reviveCharacter(actor, { quiet: true });
        // What a draw made (its messages, the GMs' record, Daggerheart's Fear) and the row the bookmark kept, newest first.
        const { rerollBookmarkStore } = await import("./gm-stores.mjs");
        for (const d of [...run.drawn].reverse()) {
            if (rerollBookmarkStore.get(d.actor.id)?.messageId === d.message?.id) await rerollBookmarkStore.drop(d.actor.id);
            await d.putBack();
        }
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
    ["grid DM17 - a critical Strike on the killer's pick, its Reroll a critical that keeps it", () => runCase("DM17"), GRID_RED.DM17],
    ["grid DM18 - Use an item that heals, its Reroll a hit that uses it again", () => runCase("DM18"), GRID_RED.DM18],
    ["grid DM19 - Use an item that heals, its Reroll a miss that gives the heal and the pack back", () => runCase("DM19"), GRID_RED.DM19],
    ["grid DM20 - a Strike drawn by the GM, its Reroll a miss that takes the hit back", () => runCase("DM20"), GRID_RED.DM20],
    ["grid DM21 - a critical Strike drawn by the GM on the killer's pick, its Reroll a critical that keeps it", () => runCase("DM21"), GRID_RED.DM21],
    ["grid DM22 - a critical Strike drawn by the GM on the killer's pick of Health, the statistic raised before its Reroll, a critical that keeps it", () => runCase("DM22"), GRID_RED.DM22],
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
    ["grid TP15 - the accomplice dies in the fight by a death the GMs keep", () => runCase("TP15"), GRID_RED.TP15],
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
    ["grid XI07 - a betrayal declared in the Eclipse after Night opens the next morning", () => runCase("XI07"), GRID_RED.XI07],
    ["grid XI08 - a write of the incident refused once: the cast's at a Leave a clue, the world half's at a Survive and at the close", () => runCase("XI08"), GRID_RED.XI08],
    ["grid XI09 - a pass refused: a Leave a clue's at its world half and at the put-back, and a Strike's whose Reroll then takes the hit back", () => runCase("XI09"), GRID_RED.XI09]
];

export { GRID, CASES, INVARIANTS };
