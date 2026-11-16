/**
 * WHETHER A ROAD IS OPEN IN THE PHASE THE TABLE IS IN (E40 item 3, 15.11.2026; plan-130's E40.md: "a phase x action matrix
 * on one shared 'allowed now' predicate", with the A10 and A11 amendments: `passage.*` and the Frisk's roads).
 *
 * Before this file each road asked the phase in a chain of its own: the sheet's tile (sheet-actions.mjs `actionButton`,
 * `locked` and `lockReason`), the press (action-rolls.mjs `performAction`, its gates), the person roads (frisk.mjs
 * `personActionRefusal`: a Frisk, a steal, a Plant, a give, a tail, a loot), the other transfers (inventory.mjs) and the
 * passages (passages-gm.mjs `liveShareWorld`, `liveFindWorld`). Tier 2 E40-T3 held the tile and the press to each other
 * cell by cell; they now ask this one table, and E40-T3 holds each of them to it.
 *
 * WHAT IT DECIDES AND WHAT IT DOES NOT. Only the phase: an Eclipse, the Class Trial, a fight the actor is a side of, a
 * running incident the actor takes part in, and Direct Murder's two open roads (the fight's own menu and a betrayal).
 * Not the price, the room, the dead, a Monocub or a Monokuma: each road keeps those gates where they stand, because they
 * sit between the phase's checks in some roads (the press asks the fight's menu, then a Monocub and the dead, then the
 * Eclipse) and their order is what each road answers.
 *
 * EACH ROAD'S ORDER IS ITS OWN, AS IT WAS. The action keys take the press's order, since the press is the gate that
 * refuses: the Eclipse, then the fight, then the trial. The tile asked the fight first and the trial only outside an
 * Eclipse; the two orders differ only where an Eclipse stands with a fight or with the trial, and neither state is
 * reached: an Eclipse does not start in a fight or a trial (eclipse.mjs `startRefusalOf`: `incidentFirst`,
 * `trialFirst`), no fight opens in an Eclipse (murder-rules.mjs `openMurder`; E40-T3 measures both), and no trial starts
 * in an Eclipse (trial-floor-ui.mjs `startClassTrial`, `eclipseFirst`). So the tile's sentence changes there alone, in a
 * state only a console writes. The person roads keep theirs - the Eclipse, the trial, then the incident - because a fight
 * can be opened during a trial (`openMurder` asks no trial) and there they said the trial.
 *
 * The answer is `{ ok, why, road }`: `why` one of WHY when the road is shut, else null; `road` "crisis" or "betrayal" for
 * Direct Murder's two open roads, else null. Each caller says `why` in its own words (an i18n key on the sheet and the
 * press, the bridge's English reason on the GM's roads), so no sentence changed with the move.
 *
 * `ctx.facts` hands in what is read, each a function (the tile's, read once a render; the passages' suite worlds); a fact
 * not handed in is read live here, when its rule asks it.
 */
import { isEclipse, getClock, incidentParticipants } from "./settings.mjs";
import { murderState, sideOf, betrayalTarget } from "./murder.mjs";

/** Why a road is shut. */
export const WHY = Object.freeze({
    eclipse: "eclipse", trial: "trial", incident: "incident", murderOnlyInEclipse: "murderOnlyInEclipse"
});

const open = (road = null) => ({ ok: true, why: null, road });
const shut = why => ({ ok: false, why, road: null });

/**
 * The rules, a road a row: `(key, f) => answer`, `f` the facts (each a function, read only when the rule asks it).
 * `action` takes a key of ACTIONS; the others ignore the key.
 */
export const ROADS = Object.freeze({
    /* The press's order (action-rolls.mjs `performAction`). Direct Murder is the inverse of every other key: open in an
       Eclipse, in a fight (its own menu) and to a betrayal, shut otherwise. Move passes an Eclipse (its crossing is judged
       by movement.mjs `judgeEclipseCrossing`); Analyze is the one key the Class Trial leaves open (T-1). */
    action: (key, f) => {
        if (key === "directMurder") {
            if (f.fighting()) return open("crisis");
            if (f.betrayal()) return open("betrayal");
            if (!f.eclipse()) return shut(WHY.murderOnlyInEclipse);
            if (f.trial()) return shut(WHY.trial);
            return open();
        }
        if (key !== "move" && f.eclipse()) return shut(WHY.eclipse);
        if (f.fighting()) return shut(WHY.incident);
        if (key !== "analyze" && f.trial()) return shut(WHY.trial);
        return open();
    },
    /* frisk.mjs `personActionRefusal`'s order: a Frisk, a steal, a Plant, a give, a tail, a loot (A11; E64). */
    person: (key, f) => {
        if (f.eclipse()) return shut(WHY.eclipse);
        if (f.trial()) return shut(WHY.trial);
        if (f.participant()) return shut(WHY.incident);
        return open();
    },
    /* inventory.mjs's other transfers: a stow, a retrieve and the rest that no person gate asks. */
    transfer: (key, f) => {
        if (f.eclipse()) return shut(WHY.eclipse);
        if (f.trial()) return shut(WHY.trial);
        return open();
    },
    /* passages-gm.mjs `shareRefusal`'s phase (A10, the wire's "passage.share"): a passage is shown to nobody in an Eclipse
       or a trial. The roads are named in camelCase, not as the wire's actions, so no census of the wire reads them as one. */
    passageShare: (key, f) => {
        if (f.eclipse()) return shut(WHY.eclipse);
        if (f.trial()) return shut(WHY.trial);
        return open();
    },
    /* passages-gm.mjs `resolvePassageSearch`'s phase (A10, the wire's "passage.find"): the trial alone. */
    passageFind: (key, f) => (f.trial() ? shut(WHY.trial) : open()),
    /* THE GATES THE FIRST COMMIT LEFT (E40, 16.11.2026, the line claude/e40-117; the coordinator's brief of that day), each
       in its own order, each said in its caller's words. Tier 2 E40-T6. */
    /* A Hope Call: the Eclipse alone (calls.mjs `callBarred`, `hopeCallRefusal`; the sheet's `callLockNote`): the trial
       leaves a student's Calls open (T-1), and Overflow's Silence, the dead and the Call Silence are asked after it by
       each caller, as before. */
    callHope: (key, f) => (f.eclipse() ? shut(WHY.eclipse) : open()),
    /* A Despair Call: the Eclipse, then the trial (calls.mjs `callBarred` with `despair`, `spendDespairCallFor`; a
       Monokuma's drawer in `callLockNote`). */
    callDespair: (key, f) => {
        if (f.eclipse()) return shut(WHY.eclipse);
        if (f.trial()) return shut(WHY.trial);
        return open();
    },
    /* A Monocub's ability, one lock of its row at a time (monocub.mjs `CUB_LOCKS`, its rows' `locks` in config.mjs): the
       key is the lock, "eclipse" or "classTrial"; the row keeps its order and the Ghost Bet's window lock beside them. */
    cubLock: (key, f) => {
        if (key === "eclipse") return f.eclipse() ? shut(WHY.eclipse) : open();
        if (key === "classTrial") return f.trial() ? shut(WHY.trial) : open();
        return open();
    },
    /* A handover's window (handover.mjs `askWhoIsHere`): the Eclipse alone. */
    handover: (key, f) => (f.eclipse() ? shut(WHY.eclipse) : open()),
    /* A player's statistic proposal for a project, a generic roll or a Search (bridge-guards.mjs `guardTraitRuling`): the
       Eclipse or the trial, one sentence for both, as `performAction` refuses a Project in both. */
    proposal: (key, f) => {
        if (f.eclipse()) return shut(WHY.eclipse);
        if (f.trial()) return shut(WHY.trial);
        return open();
    }
});

/** The facts, read live: each as the road that asked it before this file read it. */
function liveFacts(actor) {
    return {
        eclipse: () => isEclipse(),
        trial: () => getClock()?.phase === "classTrial",
        fighting: () => Boolean(actor && murderState()?.stage === "incident" && sideOf(actor)),
        participant: () => Boolean(actor && incidentParticipants().includes(actor.id)),
        betrayal: () => Boolean(actor && betrayalTarget(actor))
    };
}

/**
 * Whether `road` is open to `actor` now for `key` (a key of ACTIONS on the `action` road): `{ ok, why, road }`.
 * `ctx.road` names the road (default "action"); `ctx.facts` hands in any of the facts, the rest read live.
 */
export function allowedNow(actor, key, { road = "action", facts = {} } = {}) {
    const rule = ROADS[road];
    if (!rule) throw new Error(`allowedNow: no road "${road}"`);
    return rule(key, { ...liveFacts(actor), ...facts });
}
