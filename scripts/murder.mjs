/**
 * Danganronpa RPG — the murder engine.
 * ---------------------------------------------------------------------------
 * Guide, pp. 17–27. The murder is the one part of this game the rules treat as
 * exceptional, and it is the only place where two players roll against each
 * other turn by turn.
 *
 * The shape of it:
 *
 *   Stage 4  two opening rolls. The killer's decides whether the incident
 *            happens at all and HOW MANY Key Remnants it leaves — the better
 *            the roll, the fewer clues. The victim's decides whether they
 *            sense it coming.
 *   Stage 5  the incident. The victim always moves first, and every turn costs
 *            them Sanity until it runs out and then Health. Both sides pick crisis
 *            actions; a third party who walks in gets a free one.
 *   Stage 6  resolution. The killer cleans up — and now, for the first time,
 *            can see the Remnants they left.
 *
 * WHAT IS AUTOMATED AND WHAT IS NOT. The module owns the numbers: thresholds,
 * the drain, turn order, damage, which Remnants each outcome leaves, who is
 * hindered and for how long. It does not own the prose. "The victim takes
 * something of the killer's and makes evidence of it" is a sentence a person
 * finishes, so each outcome's text goes to the GM and the table rather than
 * being invented here.
 *
 * WHY THE STATE IS WORLD-SCOPED. Unlike the Truth Bullet ledger, this is not
 * secret-by-design. Both participants need to see whose turn it is, what the
 * victim has left and which of their own actions are blocked — live, every
 * turn. See the note on SETTINGS.murderState for the trade that was made.
 */

import {
    MODULE_ID, FLAGS, MURDER_OPENING, INCIDENT, CRISIS_ACTIONS, KEY_REMNANTS,
    RESOLUTION_STRESS_COST, RESOLUTION_HEALTH_COST, TRAITS, callEffect
} from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { carriedFor, ITEM_FLAGS, isBroken } from "./inventory.mjs";
import { equippedFor, breakOnDespair } from "./use-items.mjs";
import { dropRemnant, traceFeedback } from "./remnants.mjs";
import {
    announce, dialogContent, tableDialog, whisperToGms, whisperToOwner, ownerOf, gmIds,
    isPrimaryGm, log, warn, error, plural, debug } from "./utils.mjs";


const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * STATE
 * ========================================================================== */

/** The murder in progress, or `null`. */
export function murderState() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    return stored.active ? stored : null;
}

async function writeState(patch) {
    if (!game.user.isGM) return null;
    const before = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    const next = { ...before, ...patch };
    await game.settings.set(MODULE_ID, SETTINGS.murderState, next);

    /*
     * THE BETRAYAL'S WINDOW OPENS HERE, AND ONLY HERE (D18).
     *
     * Six different branches move an incident to its resolution stage — a
     * finishing blow, running out, a self-inflicted death, an escape, and two
     * more — and every one of them is a moment the accomplice may now turn on
     * the killer. Arming from each would be six copies of one rule, which is
     * the shape this file has already been bitten by twice.
     *
     * `writeState` is the single writer, so it is the single place that can see
     * the transition. Guarded on the CHANGE rather than the state, so the many
     * later writes that happen during a resolution do not re-arm a window the
     * betrayal has already spent.
     */
    if (before.stage !== "resolution" && next.stage === "resolution") {
        try {
            await armBetrayalWindow(next);
        } catch (err) {
            error("Could not open the betrayal window", err);
        }
    }
    return next;
}

/**
 * Give the accomplice the rest of the day to turn on the killer.
 *
 * The candidate test is unchanged — `betrayalCandidate` still decides WHO, and
 * it is asked once, here, at the moment the incident settles. What changed is
 * how long the answer lasts. It used to be read live off the incident, so the
 * offer died with the incident: the accomplice had it while the killer scrubbed
 * the floor and lost it the instant the GM closed Stage 6, which is roughly the
 * moment a player would actually think of it.
 *
 * Stamped with the clock rather than a timestamp. "Until the end of the day" is
 * a fact about this game's calendar, not about wall time, and a table that
 * spends two hours on one evening should get two hours of it.
 */
async function armBetrayalWindow(state) {
    if (!game.user.isGM) return null;
    const killer = game.actors.get(state?.killerId ?? "");
    const third = betrayalCandidate(state, killer);
    if (!killer || !third) return null;

    const clock = getClock();
    await third.setFlag(MODULE_ID, FLAGS.betrayalWindow, {
        killerId: killer.id,
        chapter: clock?.chapter ?? 1,
        day: clock?.day ?? 1
    });
    log(`Betrayal window open for ${third.name} against ${killer.name} `
        + `(chapter ${clock?.chapter}, day ${clock?.day}).`);
    return third;
}

/**
 * Shut every betrayal window the calendar has moved past. GM-side.
 *
 * The read below already refuses a stale window, so this is tidying rather than
 * enforcement — but a flag nobody clears is a flag that comes back. A GM who
 * rewinds a day to fix a mistake would otherwise hand somebody a betrayal from
 * a murder two chapters ago, and the sheet would light the tile for it.
 */
async function sweepBetrayalWindows() {
    if (!game.user.isGM) return;
    const clock = getClock();
    for (const actor of game.actors) {
        const open = actor.getFlag(MODULE_ID, FLAGS.betrayalWindow);
        if (!open) continue;
        if (open.chapter === clock?.chapter && open.day === clock?.day) continue;
        try {
            await actor.unsetFlag(MODULE_ID, FLAGS.betrayalWindow);
        } catch {
            // A window that outlives its day is refused on read anyway.
        }
    }
}

/** Which side is this actor on, if any: "killer" | "victim" | "third" | null. */
export function sideOf(actor) {
    const state = murderState();
    if (!state || !actor) return null;
    if (state.killerId === actor.id) return "killer";
    if (state.victimId === actor.id) return "victim";
    // A newcomer who has thrown in with one side stops being "the third party"
    // and becomes a participant, so they get that side's crisis actions from
    // their next turn on. `thirdSide` is written by Partners in crime and by
    // Double role reversal; without it they would keep being offered the
    // walked-in-on-a-murder choice they have already made.
    if (state.thirdId === actor.id) return state.thirdSide ?? "third";
    return null;
}

/**
 * Everyone acting as a killer in this incident, in turn order.
 *
 * Usually one. It becomes two when the third party throws in with the killer —
 * Partners in crime, or a double role reversal — and from that moment they are
 * a killer in every sense the rules care about: the same action table, the same
 * side of the turn order, and the same clean-up afterwards.
 *
 * The original killer is always first, so the rotation is stable across writes.
 */
export function killerIds(state = murderState()) {
    if (!state) return [];
    const ids = [state.killerId];
    if (state.thirdId && state.thirdSide === "killer") ids.push(state.thirdId);
    return ids.filter(Boolean);
}

/**
 * Everybody the incident already contains: both killers, the victim, and the
 * one third party who walked in.
 *
 * The set the "somebody walked in" watch measures newcomers against, and the
 * list the incident's own announcements are whispered to. `killerIds` rather
 * than `state.killerId`, so an accomplice who threw in with the killers is not
 * read as a stranger walking into a room they have been standing in for the
 * last ten minutes.
 */
export function participantIds(state = murderState()) {
    const ids = new Set(killerIds(state));
    if (state?.victimId) ids.add(state.victimId);
    if (state?.thirdId) ids.add(state.thirdId);
    return ids;
}

/**
 * Is it this actor's turn to act?
 *
 * A third party is deliberately outside the turn order. The guide gives
 * whoever walks in on an incident ONE free action, and "free" here means
 * exactly that: it does not wait for a turn and it does not consume one. Since
 * `turnSide` only ever holds "victim" or "killer", asking whether it equals
 * "third" is always false — which meant the third party was told they had a
 * free action and then refused with "not your turn" every time they tried to
 * use it. They may act while they still have that action, and not after.
 *
 * TWO KILLERS SHARE A SIDE, NOT A TURN. `turnSide === "killer"` was true for
 * both of them at once, so an accomplice doubled the killers' output: on every
 * killer turn each of them could act, and from the victim's chair it read as
 * one of them taking two turns in a row. `killerTurnId` names which of the two
 * this turn belongs to, and `passTurn` alternates it — so a round with an
 * accomplice runs victim, killer, victim, accomplice, and the side still gets
 * one action per turn however many people are standing on it.
 */
export function isTheirTurn(actor) {
    const state = murderState();
    if (!state || state.stage !== "incident") return false;
    const side = sideOf(actor);
    if (side === "third") return !state.thirdActed;
    if (state.turnSide !== side) return false;
    if (side !== "killer") return true;

    const killers = killerIds(state);
    if (killers.length < 2) return true;
    return (state.killerTurnId ?? killers[0]) === actor.id;
}

/** Crisis actions this actor may take right now, with their hindered flags. */
/**
 * Is this side sitting on a critical Self-defence's free action right now?
 *
 * G-18. One question, asked from three places — the panel that draws the tiles,
 * the guard that lets one be pressed, and the resolver that scores it — so it
 * is written once. Splitting it was how "the tile says free and the click asks
 * for dice" would happen.
 *
 * THE ROUND STAMP IS THE EXPIRY. `state.turn` only advances when play comes
 * back to the victim (see `passTurn`), so "the same turn number" is exactly the
 * guide's "this turn" and needs no clean-up pass of its own — the grant lapses
 * by arithmetic, like an expired motive.
 */
export function freeResolutionFor(side, state = murderState()) {
    const grant = state?.freeResolution;
    if (!grant || grant.side !== side) return null;
    return grant.turn === state.turn ? grant : null;
}

/** Whether THIS action is the one that free take can be spent on. */
function isFreeTake(def, side, state) {
    return Boolean(def?.kind === "resolution" && !def.noRoll && freeResolutionFor(side, state));
}

export function availableCrisisActions(actor) {
    const state = murderState();
    const side = sideOf(actor);
    if (!state || state.stage !== "incident" || !side) return [];

    // Their one free choice, once made, is made.
    //
    // `isTheirTurn` already refuses a second one, but this list is what the
    // crisis panel DRAWS, and it kept drawing four live tiles for somebody who
    // had already chosen — every one of which would be refused on click.
    // Measured after a failed Escape together: `thirdActed` true, `isTheirTurn`
    // false, four options still offered.
    if (side === "third" && state.thirdActed) return [];

    const hindered = state.hindered?.[side] ?? {};
    const blocked = state.blocked?.[side] ?? {};
    const unlocked = new Set(state.unlocked ?? []);
    const spent = new Set(state.spent ?? []);

    return Object.entries(CRISIS_ACTIONS)
        // `both` is a real side, and only one action has it: using an item is
        // the same act whoever is doing it. Everything downstream that needs to
        // know WHOSE turn this is asks `sideOf(actor)` instead — see
        // `resolveCrisisAction`.
        .filter(([, def]) => def.side === side || def.side === "both")
        // The guide takes Role Reversal away from a victim whose killer opened
        // on a Despair success.
        .filter(([key]) => !(state.deniedToVictim ?? []).includes(key))
        .map(([key, def]) => {
            const locked = Boolean(def.lockedUntil && !unlocked.has(key));
            return {
                key,
                def,
                // G-18: no dice on this one, and the tile should say so before
                // it is pressed rather than after. Still false while the action
                // is locked — a free take is worth nothing on a door that has
                // not been opened yet.
                free: !locked && isFreeTake(def, side, state),
                // The number to beat, computed here rather than read off `def`
                // by the sheet: a Finishing Blow's threshold is not a constant,
                // it falls as the victim runs out of Health. `null` for the three
                // decisions that have no dice at all.
                threshold: def.noRoll
                    ? null
                    : (key === "finishingBlow" ? finishingBlowThreshold(state) : def.threshold ?? null),
                hindered: (hindered[key] ?? 0) > 0,
                // Self-defence gates the victim's two ways out, and closes
                // itself once it lands. `blocked` already means "you may not
                // press this", so both reasons fold into it — and each carries
                // its own explanation for the tooltip.
                blocked: (blocked[key] ?? 0) > 0 || locked || spent.has(key),
                // In the list, out of the grid (trap 65). Kept in the list on
                // purpose: `takeCrisisAction` reads this same list for its
                // locked/spent guards, so filtering it out here would leave
                // those guards looking at nothing. The panel skips it.
                hidden: Boolean(def.hidden),
                locked,
                spent: spent.has(key),
                lockedBy: def.lockedUntil ? CRISIS_ACTIONS[def.lockedUntil]?.label ?? null : null
            };
        });
}

/* ==========================================================================
 * STAGE 4 — THE OPENING
 * ========================================================================== */

/**
 * Which night/day note the GM gets when a murder opens.
 *
 * Only one side rolls Stage 4, so only one side can be modified — telling the GM
 * about "the killer's advantage and the victim's disadvantage" described a pair
 * of rolls that never both happen.
 */
function nightNoteKey(indirect) {
    if (!atNight()) return "DRPG.Murder.dayNote";
    return indirect ? "DRPG.Murder.nightNoteIndirect" : "DRPG.Murder.nightNoteDirect";
}

/** Is it night? Whichever side rolls Stage 4 is modified by the answer. */
function atNight() {
    const t = getClock().timeOfDay;
    return t === "night" || t === "Night";
}

/**
 * Open a murder. GM-driven: the declaration and the consent happened away from
 * the table, and this is the moment they become mechanical.
 */
export async function openMurder({ killerId, victimId, indirect = false } = {}) {
    if (!game.user.isGM) return null;

    // The Eclipse is a placement window, not a moment in the story — nobody has
    // finished crossing the map yet. This does NOT catch the one legitimate call
    // during an Eclipse: `judgePendingMurders` (eclipse.mjs) opens a *parked*
    // direct murder from `endEclipse`, which clears the Eclipse flag before
    // judging declarations, so `isEclipse()` already reads false by the time it
    // calls here. Everywhere else — the GM panel's "Open a murder" tile, a
    // ruling card's button — is greyed out with a tooltip instead of reaching
    // this at all; this is the backstop for anyone who gets here anyway.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.murderLocked"));
        return null;
    }

    /*
     * ONE FIGHT AT A TIME.
     *
     * There was no check at all: this function wrote `active: true` over
     * whatever state was there, so a second call during a running incident did
     * not open a second incident — it REPLACED the first. Same state object,
     * new ids, the turn counter back to zero, and the original victim silently
     * no longer in a fight they were in the middle of.
     *
     * EVERY STAGE BUT `resolution`, and the first attempt at this said
     * `incident` only — which measured as no guard at all in the ordinary case:
     * a murder opens at stage `openingRoll` and stays there until the first
     * roll lands, so a second one declared in that window replaced the first
     * exactly as before.
     *
     * The BETRAYAL is the one legitimate second murder and it opens during
     * `resolution` — the newcomer turning on the killer they just helped, with
     * the body still on the floor. That is the guide's own exception, it has a
     * button of its own (Dawid, 28.08: the button stays, because it is the UX
     * saying this is allowed), and it is the reason this reads a stage rather
     * than the `active` flag: `active` is true for both, and only one of them
     * is a fight already in progress.
     */
    const running = murderState();
    if (running?.active && running.stage !== "resolution") {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.oneAtATime"));
        warn(`Refused to open a murder: ${game.actors.get(running.killerId)?.name ?? "somebody"} `
            + `is already in an incident with ${game.actors.get(running.victimId)?.name ?? "somebody"}.`);
        return null;
    }

    const killer = game.actors.get(killerId);
    const victim = game.actors.get(victimId);
    if (!killer || !victim) return null;

    /*
     * ONE PERSON ON BOTH SIDES.
     *
     * A student who takes their own life is a Blackened like any other, and the
     * class still has to work out what happened in that room — it is one of the
     * oldest shapes this story has. This used to be refused outright, so the one
     * incident the guide's own trial rules already handle ("można głosować na
     * martwych graczy") was the one incident the engine could not open.
     *
     * What it costs: Stage 5 cannot run. The incident is a turn order between
     * two sides, a drain that falls on one of them, damage the other deals, and
     * four ways out that are all about the person opposite. With one name in
     * both seats every one of those is either nonsense or a no-op — Role
     * reversal swaps two ids that are already equal, Self-defence defends
     * against the person throwing the dice, and `passTurn` hands the turn from
     * somebody to themselves.
     *
     * So it does not run. Stage 4 still does, and it is the half that matters:
     * it decides whether they go through with it and HOW MANY Key Remnants the
     * scene keeps. Then the incident goes straight to Stage 6, which is exactly
     * the fiction — what they arranged before dying. The death itself is
     * recorded when the incident closes, so there is somebody alive to do the
     * arranging; see `endMurder`.
     */
    const selfInflicted = killer.id === victim.id;

    // A trap opens on the VICTIM's roll: their one chance to notice it before it
    // closes. Nobody fails to notice a trap they built for themselves, so an
    // indirect self-inflicted death would open on a roll that cannot mean
    // anything — and a success on it would end the incident with a warning to
    // the others about a project they set up. Direct, always.
    if (selfInflicted && indirect) {
        warn("A self-inflicted death cannot be indirect; opening it as a direct murder.");
        indirect = false;
    }

    await writeState({
        active: true,
        stage: "openingRoll",
        indirect,
        selfInflicted,
        killerId, victimId, thirdId: null,
        turn: 0,
        turnSide: "victim",
        // Whose turn it is on the killers' side. One name until somebody joins
        // them; `passTurn` rotates it from there.
        killerTurnId: killerId,
        keyRemnants: KEY_REMNANTS.prepared,
        deniedToVictim: [],
        hindered: { victim: {}, killer: {} },
        blocked: { victim: {}, killer: {} },
        // Survive and Role reversal start closed; Self-defence opens them.
        unlocked: [],
        // A critical Self-defence stops the drain for the rest of the incident.
        drainStopped: false,
        advantageNext: { victim: false, killer: false },
        openedAt: Date.now()
    });

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Murder.openedTitle")}</h3>
        <p>${selfInflicted
            ? game.i18n.format("DRPG.Murder.openedSelf", {
                name: foundry.utils.escapeHTML(killer.name)
            })
            : game.i18n.format("DRPG.Murder.opened", {
                killer: foundry.utils.escapeHTML(killer.name),
                victim: foundry.utils.escapeHTML(victim.name),
                // Which side owes the roll is the kind of murder, not a choice —
                // and naming them here is the only notice a GM gets that it went
                // out, now that there is no button to press.
                roller: foundry.utils.escapeHTML((indirect ? victim : killer).name)
            })}</p>
        <p>${game.i18n.localize(nightNoteKey(indirect))}</p>
        ${selfInflicted
            ? `<p class="notes">${game.i18n.localize("DRPG.Murder.openedSelfNote")}</p>`
            : ""}`);

    log(selfInflicted
        ? `Murder opened: ${killer.name}, by their own hand.`
        : `Murder opened: ${killer.name} → ${victim.name}${indirect ? " (indirect)" : ""}.`);

    // Stage 4 starts itself.
    //
    // Which roll opens an incident is not a decision — a direct murder opens on
    // the killer's roll, a trap on the victim's, and `rollOpening` has always
    // known which and always sent it to the right person's client. What it
    // waited for was a GM pressing a button on the tracker to say so, in a state
    // where there is exactly one thing that can happen next. So it happens.
    //
    // Not awaited: the roll is a round trip to another client and can take as
    // long as that player takes. Awaiting it here would leave `openMurder`
    // hanging, and with it the dialog that called it.
    //
    // The tracker keeps its button. This is the first invitation, not the only
    // one — a player who dismissed the window, or who was not connected when the
    // incident opened, still needs a way to be asked again.
    rollOpening(indirect ? "victim" : "killer", murderState())
        .catch(err => error("Could not open the Stage 4 roll", err));

    return murderState();
}

/**
 * Tell the victim the incident has started.
 *
 * Everything about Stage 4 was reported to the GMs and to nobody else, so the
 * person the whole thing is happening to found out by noticing that their own
 * character sheet had changed. The turn is theirs from the first round, and a
 * turn nobody announces is a turn that gets missed.
 *
 * Deliberately NOT sent when the murder opens — only when it actually begins. A
 * direct murder that fails its opening roll never happened as far as the victim
 * is concerned: the killer lost their nerve, no one was ever in danger, and
 * telling them "someone tried to kill you" would hand the table a fact the
 * rules never generated. See the note on `MURDER_OPENING`.
 */
async function tellVictimTheIncidentBegan(state) {
    try {
        const victim = game.actors.get(state?.victimId ?? "");
        if (!victim) return;
        const key = state.indirect ? "victimTrapSprung" : "victimUnderAttack";
        await whisperToOwner(victim, `<p>${game.i18n.localize(`DRPG.Murder.${key}`)}</p>`);
    } catch (err) {
        // The incident has already started in world state; a message that fails
        // to send must not roll that back.
        error("Could not tell the victim the incident had begun", err);
    }
}

/**
 * Record the killer's opening roll.
 *
 * The Key Remnant count comes straight off the duality: Hope leaves the most
 * evidence, a critical the least. Floored at the guide's minimum so a case can
 * never become unsolvable by a good roll.
 */
export async function resolveKillerOpening({ total, isCritical, withHope }) {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) return null;

    // The mirror of the guard in `resolveVictimOpening`. An indirect murder's
    // ONLY roll is the victim's, and this is exported on `game.drpg` — and
    // `resolveOpening` cannot catch it either, because the killer of a trap is
    // still genuinely `state.killerId`. Accepting the roll here would score a
    // trap against the direct table, and a failure would END an incident whose
    // victim was never asked anything.
    if (state.indirect) {
        warn("Refused a killer opening roll: this is an indirect murder, which opens on the victim's roll.");
        return null;
    }

    const def = MURDER_OPENING.killer;
    // The numbers are the killer's table either way — threshold, traits, the
    // sliding scale of Key Remnants. Only the prose changes for somebody who is
    // both sides of it; see MURDER_OPENING.killer.selfInflicted.
    const prose = (state.selfInflicted && def.selfInflicted) || def;
    const success = isCritical || total >= def.threshold;

    if (!success) {
        await tellGms(prose.failure);
        // No follow-up: the killer lost their nerve, so there is no body, no
        // room to announce and nothing to investigate. The checklist would be
        // asking the GM to find a corpse that does not exist.
        await endMurder({ reason: "openingFailed", followUp: false });
        return { success: false };
    }

    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    const keys = Math.max(KEY_REMNANTS.minimum, def.keyRemnants[band]);

    /*
     * A SELF-INFLICTED DEATH SKIPS STAGE 5 (see `openMurder`).
     *
     * There is no confrontation to run — nobody is defending, nobody is taking
     * turns, and the drain has one person to fall on who is also the person
     * dealing the damage. What Stage 4 produced is the whole mechanical output:
     * how many Key Remnants the scene keeps. So the incident lands on Stage 6,
     * which for this one shape of death means the arrangements they make before
     * dying — and `endedBy` names it, because `afterIncident` and
     * `recordBlackened` both read that field to tell one ending from another.
     *
     * The Despair penalties below are deliberately NOT applied: emptying the
     * victim's Sanity buys the killer a shorter fight, and denying Role reversal
     * closes a way out. Both are Stage 5 prices for a Stage 5 that never runs,
     * and marking a sheet for a mechanic nobody will reach is noise on a
     * character who is about to be dead. The Despair BAND still counts, which is
     * the part that leaves its mark: four Key Remnants instead of three.
     */
    if (state.selfInflicted) {
        await writeState({
            stage: "resolution", endedBy: "selfInflicted", keyRemnants: keys, turn: 0
        });
        await tellGms(prose[band], { keys });
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNoteSelf")}</p>`);

        // And the player, who is the only person in this incident.
        //
        // Stage 4's result goes to the GM alone everywhere else, and that is
        // right when the roller is a killer who will find out what it bought
        // them by playing Stage 5. There is no Stage 5 here: the next thing
        // that happens is Stage 6 opening on their own sheet, and they would
        // have watched dice land and then been shown a clean-up screen with no
        // sentence in between. This is the beat `tellVictimTheIncidentBegan`
        // covers for an ordinary murder, and it is skipped along with the rest.
        try {
            const actor = game.actors.get(state.victimId);
            if (actor) {
                await whisperToOwner(actor,
                    `<p>${game.i18n.localize("DRPG.Murder.selfWentThrough")}</p>`);
            }
        } catch (err) {
            error("Could not tell the player their Stage 4 roll had landed", err);
        }
        log(`${game.actors.get(state.killerId)?.name ?? "?"} went through with it; `
            + `Stage 5 is skipped and Stage 6 opens with ${keys} Key Remnants.`);
        return { success: true, band, keys, selfInflicted: true };
    }

    const patch = { stage: "incident", keyRemnants: keys, turn: 1, turnSide: "victim" };

    // A Despair success costs the victim their Sanity and their way out.
    if (band === "despair") {
        const victim = game.actors.get(state.victimId);
        if (victim) {
            await automatedUpdate(victim, {
                "system.resources.stress.value": resourceMax(victim, "stress")
            });
        }
        patch.deniedToVictim = ["roleReversal"];
    }

    await writeState(patch);
    await tellGms(prose[band], { keys });
    await tellVictimTheIncidentBegan(murderState());
    return { success: true, band, keys };
}

/**
 * Record the victim's opening roll — the WHOLE of Stage 4 for an indirect murder.
 *
 * There is no confrontation to open: the trap is already set, and the only
 * question is whether the victim notices it in time.
 *
 *   success   they get a free Move and a bad feeling, or (on Despair) work out
 *             what has been set up and can warn the others. No incident.
 *   failure   "Śmierć ofiary" — the trap closes, and the incident begins with
 *             the victim alone, draining 2 a turn (INCIDENT.drain.indirect).
 *
 * A DIRECT murder never gets here. Stage 4 has exactly one roll and a direct
 * murder spends it on the killer, which is also why a failed direct attempt
 * leaves the victim knowing nothing — nobody ever asked them for anything. See
 * the note on MURDER_OPENING.
 */
export async function resolveVictimOpening({ total, isCritical, withHope }) {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) return null;

    // Guarded rather than assumed. The tracker only ever offers this button for
    // an indirect murder, but this is exported on `game.drpg`, and applying the
    // trap's outcome to a direct incident would start Stage 5 twice.
    if (!state.indirect) {
        warn("Refused a victim opening roll: this is a direct murder, which opens on the killer's roll.");
        return null;
    }

    const def = MURDER_OPENING.victim;
    const success = isCritical || total >= def.threshold;

    if (!success) {
        await tellGms(def.failure);

        // Nothing else opens an indirect murder, so this is the moment the
        // incident starts. Without it the state sat on "openingRoll" for ever
        // and an indirect murder could never be played.
        await writeState({ stage: "incident", turn: 1, turnSide: "victim" });
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.indirectBegins")}</p>`);
        await tellVictimTheIncidentBegan(murderState());
        return { success: false, started: true };
    }

    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    await tellGms(def[band]);

    // The struggle to notice leaves its own trace. Stage 4's only Remnant, and
    // it belongs to the victim's roll rather than the killer's — see the note on
    // `MURDER_OPENING.victim.remnant`.
    const visibility = def.remnant?.[band];
    if (visibility) {
        const victim = game.actors.get(state.victimId);
        if (victim) {
            await dropRemnant(victim, {
                type: "incident",
                visibility,
                action: "incident",
                subject: victim.name,
                tiedToCrime: true,
                note: game.i18n.format("DRPG.Murder.openingRemnantNote", {
                    name: victim.name,
                    band: game.i18n.localize(`DRPG.Murder.band.${band}`)
                })
            });
        }
    }

    // The victim sensing it coming does not end the incident by itself — the
    // guide gives them a free Move and lets them use it or not. Ending it is
    // the GM's call, which is why this reports rather than decides.
    return { success: true, band };
}

/* ==========================================================================
 * STAGE 5 — THE INCIDENT
 * ========================================================================== */

/**
 * Take one crisis action, roll it, and apply everything mechanical about it.
 *
 * Called from the actor's own client — it is their roll — but every world write
 * it produces goes through the GM, same as the rest of the module.
 */
/**
 * The briefing every crisis action now opens with.
 *
 * Built from the same fields the handbook prints — what it does, what it costs,
 * which statistic it rolls, the number to beat and what a miss does — so the
 * window is the rules entry rather than a second, drifting description of it.
 * The threshold comes from `availableCrisisActions` because a Finishing Blow's
 * is not a constant: it falls as the victim runs out of Health, and quoting the
 * table value would be a lie exactly when the number matters most.
 *
 * @returns {Promise<boolean>} false if they backed out.
 */
async function confirmCrisisAction(actor, key, def, state, side) {
    const offered = availableCrisisActions(actor).find(o => o.key === key);
    const facts = [];

    if (def.kind === "resolution" && !def.noRoll) {
        facts.push(game.i18n.format("DRPG.Murder.briefCostStress", { n: RESOLUTION_STRESS_COST }));
    }

    const variant = def.indirectVictim && side === "victim" && state.indirect ? def.indirectVictim : null;
    const traits = variant?.traits ?? def.traits;
    if (traits?.length) {
        facts.push(game.i18n.format("DRPG.Action.usesTrait", {
            traits: traits.map(t => TRAITS[t]?.label ?? t).join(" / ")
        }));
    }
    if (offered?.threshold != null) {
        facts.push(game.i18n.format("DRPG.Murder.briefThreshold", { n: offered.threshold }));
    }
    if (offered?.hindered) facts.push(game.i18n.localize("DRPG.Murder.actionHindered"));

    const body = [def.hint, def.failure].filter(Boolean)
        .map(part => `<p>${foundry.utils.escapeHTML(part)}</p>`).join("");

    const go = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: def.label },
        content: dialogContent(`<div class="drpg-briefing-block">
            ${body}
            <ul class="drpg-briefing-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>
        </div>`),
        yes: { label: game.i18n.localize(def.noRoll ? "DRPG.Murder.briefTake" : "DRPG.Murder.briefRoll") },
        no: { label: game.i18n.localize("DRPG.Advance.cancel") },
        rejectClose: false
    });

    return Boolean(go);
}

/**
 * A critical Strike lets the killer pick the resource. Ask them.
 *
 * `damage.critical` is `{ choice: true }` in the table, and the engine read that
 * as "somebody else's problem": it pushed the line "the killer chooses" into the
 * summary and applied NOTHING, leaving a GM to work out what had been decided
 * and mark it by hand. The killer is right here with the dice still on screen.
 *
 * Asked on their client and carried with the result, rather than asked again on
 * the GM's: it is their choice, and a second window on somebody else's screen is
 * how a table ends up waiting on a GM who has looked away.
 */
async function askCriticalTarget(def) {
    if (!def.damage?.critical?.choice) return null;

    const picked = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-narrow"],
        window: { title: game.i18n.localize("DRPG.Murder.criticalChoiceTitle") },
        content: dialogContent(`<p>${game.i18n.localize("DRPG.Murder.criticalChoiceIntro")}</p>`),
        buttons: [
            { action: "hp", label: game.i18n.localize("DRPG.Murder.criticalChoiceHp"), default: true },
            { action: "stress", label: game.i18n.localize("DRPG.Murder.criticalChoiceStress") }
        ],
        rejectClose: false
    });

    // Closing the window is not a way out of a hit that has already landed.
    return picked === "stress" ? "stress" : "hp";
}

export async function takeCrisisAction(actor, key, { itemId = null } = {}) {
    const state = murderState();
    const side = sideOf(actor);
    const def = CRISIS_ACTIONS[key];

    if (!state || state.stage !== "incident" || !def || !side) return null;
    if (def.side !== side && def.side !== "both") return null;

    // An action that spends something has to be told what. Refused rather than
    // rolled: a roll that cannot apply its own result is worse than no roll.
    if (def.usesItem && !actor.items.get(itemId)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.useItemGone"));
        return null;
    }
    if (!isTheirTurn(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.notYourTurn"));
        return null;
    }
    // The sheet greys these out, but the panel is only rebuilt on render — a
    // window left open across somebody else's turn still has live buttons.
    const offered = availableCrisisActions(actor).find(o => o.key === key);
    if (offered?.locked) {
        ui.notifications.warn(game.i18n.format("DRPG.Murder.actionLocked", {
            name: offered.lockedBy ?? "?"
        }));
        return null;
    }
    if (offered?.spent) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.actionSpent"));
        return null;
    }
    if ((state.blocked?.[side]?.[key] ?? 0) > 0) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.actionBlocked"));
        return null;
    }
    /*
     * A resolution action costs Sanity rather than an action — and Health when
     * there is no Sanity left (Z3).
     *
     * The third party's three decisions are exempt: the guide hands them an
     * "automatyczny, darmowy wybór", and charging anything to somebody who has
     * only just walked through the door — and may be choosing to walk straight
     * back out — is not what "darmowy" means.
     *
     * THE REFUSAL IS NOW ABOUT HAVING NOTHING AT ALL, not about the stress
     * track being full. Refusing at full stress closed the only two ways out of
     * an incident precisely when a victim needed them, and with the drain
     * stopped by a critical Self-defence there was then nothing left that could
     * end the fight — see `RESOLUTION_HEALTH_COST`. A victim with both tracks
     * full is a different case and cannot reach here: `checkVictimSpent` ends
     * the incident on that condition. This guard is the belt to that braces.
     */
    if (def.kind === "resolution" && !def.noRoll && isSpent(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.nothingLeftToSpend"));
        return null;
    }

    // Say what this does before it is done.
    //
    // Every ordinary action on the sheet opens with a briefing — what it is,
    // which statistic it uses, what it costs, what happens if it misses — and
    // the crisis actions were the one set that did not. They went straight to
    // the dice, which meant the most consequential decisions in the game were
    // the only ones taken blind: a player picked a tile, a roll dialog appeared
    // naming a statistic they had not been told about, and the outcome table
    // was somewhere in the handbook.
    //
    // After the guards, so the briefing is only ever shown for an action that
    // could actually be taken; before the dice, so cancelling costs nothing.
    if (!await confirmCrisisAction(actor, key, def, state, side)) return null;

    /*
     * G-18: THIS ONE IS TAKEN, NOT ROLLED.
     *
     * A critical Self-defence buys one of the resolution actions it unlocked as
     * an automatic success. Note where this sits — after every guard above, so
     * a free take goes through the same filter as a paid one (trap 113): it
     * still has to be your turn, the action still has to be unlocked and
     * unspent and unblocked, Pin and Keep your distance still apply, and the
     * Sanity a resolution action costs is still checked and still charged.
     * The critical buys certainty about the dice; it does not buy an exemption
     * from the incident.
     */
    if (isFreeTake(def, side, state)) {
        const { requestCrisisResult } = await import("./gm-bridge.mjs");
        return requestCrisisResult({
            actorId: actor.id, key, total: 0, isCritical: false,
            // Trap 114: an action with no roll still has to name a band, because
            // every outcome in this table is written per band. Hope, because
            // this IS the reward for a critical — scoring it as a Despair
            // success would have the prize leave a worse trace than an ordinary
            // attempt.
            withHope: true, free: true, itemId
        });
    }

    // Three of the third party's four options have no threshold, no stat and no
    // outcome table in the guide, because there is nothing to fail at — you pick
    // a side or you leave. They skip the dice entirely and are applied as taken.
    if (def.noRoll) {
        const { requestCrisisResult } = await import("./gm-bridge.mjs");
        return requestCrisisResult({
            actorId: actor.id, key, total: 0, isCritical: false, withHope: true, itemId
        });
    }

    const { rollTrait } = await import("./action-rolls.mjs");
    const calls = await import("./call-effects.mjs");

    // Advantage and disadvantage that belong to the situation rather than to a
    // Call: a hindered action, a weapon in hand, a second try after a miss.
    let situational = 0;
    if ((state.hindered?.[side]?.[key] ?? 0) > 0) situational -= 1;
    if (state.advantageNext?.[side]) situational += 1;
    if (def.weaponAdvantage && hasWeapon(actor)) situational += 1;
    if (def.unarmedDisadvantage && !hasWeapon(actor)) situational -= 1;
    // Guide, p. 20: "Ofiara otrzymuje advantage na kazdy rzut." Dying alone to a
    // trap is the one situation the guide compensates outright, and it applies
    // to every crisis roll they make rather than to a particular action.
    if (side === "victim" && state.indirect) situational += 1;

    // The indirect victim rolls their own table's stat — Body, not Shadow.
    const variant = def.indirectVictim && side === "victim" && state.indirect ? def.indirectVictim : null;
    const trait = (variant?.traits ?? def.traits)?.[0] ?? "body";
    if (situational) calls.armSituational(situational);

    /*
     * WHICH WEAPON THIS SWING IS ABOUT, decided before the dice.
     *
     * Captured here rather than after the roll for the two reasons in
     * `breakOnDespair`: the incident moves items around, and an unarmed attack
     * that succeeds HANDS the killer an improvised weapon — looking it up
     * afterwards would break a tool the same roll had just created.
     *
     * TWO MARKERS, NOT ONE, AND THE MISSING ONE WAS THE ATTACK ITSELF (Dawid,
     * 29.08: "Attack with a weapon does not always work properly").
     *
     * `weaponAdvantage` reads "holding something helps here" — Self-defence and
     * Role reversal — and it was standing in for "this action swings a thing".
     * Attack with a weapon does not carry it, and correctly so: the guide gives
     * that action a DISADVANTAGE for being unarmed rather than a bonus for being
     * armed, so it declares `unarmedDisadvantage` and `weaponDamage` instead.
     *
     * The action whose entire subject is the weapon was therefore the one action
     * that captured no weapon, and three separate rules read `swung`:
     *
     *   - the knife never took its Despair wear, so the murder weapon was the
     *     one tool in the game that could not break in the murder;
     *   - `FLAGS.swungWeapon` stayed empty, so Stage 6's `destroysTools` ruined
     *     whatever happened to be readied at closing time — the gloves — and
     *     the knife walked away, which is the exact bug that flag was added for;
     *   - and the Search trace that handed the killer the weapon was never tied
     *     to the murder, which is half of what "tied to murder" is for.
     *
     * `weaponDamage` is the honest second marker: it is on Attack with a weapon
     * and nothing else, and it means the damage of this roll is read off the
     * object in the hand. If a roll's damage comes from the tool, the tool was
     * swung.
     */
    const swings = Boolean(def.weaponAdvantage || def.weaponDamage);
    const swung = swings ? equippedWeapon(actor) : null;

    /*
     * WRITTEN DOWN, BECAUSE ONE HAND MADE STAGE 6 FORGETFUL (E9).
     *
     * `destroysTools` ruins what is READIED when Stage 6 closes. That was fine
     * while a killer could hold the knife and the gloves at once; with one hand
     * they hold the knife for the murder and the gloves for the clean-up, so at
     * closing time the gloves are in hand and the knife walks away.
     *
     * On the actor rather than on the incident state: the player's own client
     * runs this roll and can write its own actor, where `murderState` is a
     * world setting only a GM may touch. One flag, cleared when the incident
     * ends, holding the id of the thing that was actually used.
     */
    if (swung) {
        try {
            await actor.setFlag(MODULE_ID, FLAGS.swungWeapon, swung.id);
        } catch {
            // A weapon nobody wrote down is destroyed by the old rule instead
            // of not at all. Never let bookkeeping stop a swing.
        }

        /*
         * AND THE TRACE THAT HANDED IT OVER IS EVIDENCE NOW (Dawid, 28.08).
         *
         * The Search that turned this thing up could not know it would be used
         * for this — nobody could — so it recorded which object it gave out and
         * left the question open. This is the moment that answers it.
         *
         * Through the GM, because the ledger holding the answer key is the GM's
         * and a player's client has neither the record nor the right to write
         * it. Fire and forget: a trace that fails to be re-labelled must not
         * stop a murder that is already happening, and the GM can tick the box
         * by hand in the case dashboard.
         */
        const identity = swung.getFlag(MODULE_ID, "drpgItemId");
        if (identity) {
            import("./remnants.mjs")
                .then(m => (game.user.isGM
                    ? m.tieTraceForItem(identity)
                    : import("./gm-bridge.mjs").then(b => b.requestTieTrace?.(identity))))
                .catch(err => debug("Could not tie the weapon's own trace to the murder", err));
        }
    }

    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "crisis", context: { crisis: key },
            title: def?.label ?? game.i18n.localize("DRPG.Roll.crisis")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    // A knife that snaps halfway through a fight changes the next turn — the
    // one place this rule is genuinely interesting. `bestWeaponTier` stops
    // seeing it, so the next swing is an unarmed one.
    await breakOnDespair(actor, swung, roll);

    // Asked here, while the person who threw the dice is still looking at them.
    const choice = roll.isCritical ? await askCriticalTarget(def) : null;

    /*
     * THE ITEM IS SPENT HERE, ON THE PLAYER'S OWN CLIENT.
     *
     * `useItem` is a conversation — which resource a tier 3 restores, a confirm
     * before something is used up — and those questions belong to the person
     * whose character it is. Handing them to the GM's browser would ask a GM to
     * decide, for somebody else, which half of their sheet to heal.
     *
     * So the player applies it and tells the GM WHICH id went, and the GM's
     * side does what only it can: the trace, the turn, the drain, and the
     * receipt that lets a Reroll put the thing back.
     *
     * SUCCESS IS NOT ENOUGH. The guide's row: a critical or a success with Hope
     * and the item goes in; a success with DESPAIR leaves the trace and nothing
     * else — you were seen fumbling with it and it stayed in your pocket.
     */
    let usedItemId = null;
    if (def.usesItem) {
        const hit = roll.isCritical || roll.total >= def.threshold;
        if (hit && (roll.isCritical || roll.withHope)) {
            const item = actor.items.get(itemId);
            const { useItem } = await import("./use-items.mjs");
            // `useItem` can still be backed out of at its own confirm. The roll
            // and the turn are spent either way — a player who changes their
            // mind at the last dialog has still done the thing on the clock.
            if (item && await useItem(actor, item)) usedItemId = item.id;
        }
    }

    const { requestCrisisResult } = await import("./gm-bridge.mjs");
    await requestCrisisResult({
        actorId: actor.id, key,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope),
        choice,
        // What was actually spent, so a Reroll can give it back.
        usedItemId
    });

    return { roll, choice };
}

/**
 * What they are actually holding.
 *
 * The EQUIPPED Crime Tool and nothing else. This used to fall back to "any
 * Crime Tool you are carrying", which meant equipping decided nothing: the
 * advantage, the damage tier and the disadvantage for being unarmed were all the
 * same whether or not the killer had ever said which object was in their hand.
 * Readying a weapon is now the decision the sheet's button has always looked
 * like it was making — and `grantImprovisedWeapon` readies what it hands over,
 * so an unarmed killer who improvises one is armed for the next swing without
 * having to stop and click.
 *
 * Through `equippedFor` rather than a flag name spelled out here: it already
 * means "readied, not in the stash, not broken, and able to do this job", and it
 * owns the spelling of the flag.
 *
 * BY ROLE, NOT BY CATEGORY (E8). A saw filed under Tools is a weapon in
 * anybody's hands, and the character sheet's row is not the place that decides
 * that. Everything downstream reads the weapon through this one function —
 * advantage, the unarmed penalty, the damage tier — so the role reaches the
 * damage and not only the bonus, which is the one half-migrated state worth
 * being afraid of here.
 */
function equippedWeapon(actor) {
    return equippedFor(actor, "crimeTool");
}

function hasWeapon(actor) {
    return Boolean(equippedWeapon(actor));
}

/**
 * Owns one at all, readied or not — a different question from `hasWeapon`.
 *
 * Only one rule needs it, and it needs it badly. The guide's unarmed attack
 * hands the killer an improvised tool on a success, and that clause is about
 * having NOTHING: "jeśli zabójca nie ma broni". Reading it off `hasWeapon` once
 * that meant "readied" turned forgetting to click Ready into a reward — the
 * attack was made at disadvantage, and then produced a second Crime Tool, over
 * the carry limit, for the tool already in the killer's pocket.
 *
 * So the two questions are asked separately. Advantage, disadvantage and damage
 * come from what is in the hand; whether there is anything to improvise from
 * comes from what is on the person.
 *
 * BROKEN DOES NOT COUNT, and it is the same bug the paragraph above describes,
 * in a new shape. A killer whose only Crime Tool was ruined in an earlier
 * incident is carrying a slot, not a weapon: they have "nie ma broni" in every
 * sense the clause means, and reading the ruined one as a weapon would refuse
 * them the improvised tool the rule promises. The grant overrides the carry cap
 * anyway (see `grantImprovisedWeapon`), so the broken one staying in the way is
 * not a reason to withhold it.
 */
function carriesWeapon(actor) {
    return carriedFor(actor, "crimeTool").some(i => !isBroken(i));
}

/**
 * The weapon this attack swings, and the tier it counts as.
 *
 * Two things the old `bestWeaponTier` could not express, both from the guide's
 * own Attack-with-a-weapon row:
 *
 *   "Przedmiot tieru 0 jest negocjowalny jako tier 1 lub 2 w ramach
 *    kreatywności zabójcy."
 *      A Tier 0 item is "a random, seemingly useless object". Whether swinging
 *      a stapler is worth anything is a ruling, so the GM is asked for one
 *      instead of the formula quietly returning 1 damage and nobody noticing
 *      that a whole rule never fired.
 *
 *   There is no "best one you own" any more — the weapon is whichever object the
 *      killer readied, because that is the one they said was in their hand. See
 *      `equippedWeapon`.
 *
 * @returns {Promise<{item: Item|null, tier: number}>}
 */
async function chooseWeapon(actor) {
    const weapon = equippedWeapon(actor);
    if (!weapon) return { item: null, tier: 0 };

    const tier = weapon.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0;

    const rule = CRISIS_ACTIONS.weaponAttack.tierZeroNegotiable;
    if (tier !== 0 || !rule?.prompt) return { item: weapon, tier };

    const rated = await rateTierZero(actor, weapon, rule);
    return { item: weapon, tier: rated };
}

/** The GM prices one Tier 0 object for this particular swing. */
async function rateTierZero(actor, item, rule) {
    const options = [];
    for (let t = rule.min; t <= rule.max; t++) {
        options.push(`<option value="${t}"${t === 0 ? " selected" : ""}>${
            game.i18n.format("DRPG.Murder.asTier", { n: t })
        }</option>`);
    }

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.tierZeroTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Murder.tierZeroIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                item: foundry.utils.escapeHTML(item.name)
            })}</p>
            <label>${game.i18n.localize("DRPG.Murder.tierZeroRate")}
                <select name="tier">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Murder.tierZeroNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=tier]").value
            }
        ],
        rejectClose: false
    }).catch(() => null);

    // Dismissed is not a ruling — fall back to what the item actually is.
    const n = Number(picked);
    return Number.isFinite(n) ? Math.max(rule.min, Math.min(rule.max, n)) : 0;
}

/**
 * An unarmed attack that lands leaves the killer holding something.
 *
 * Guide: "Jeśli zabójca nie ma broni, może wykonać atak z disadvantage. Przy
 * sukcesie zyskuje broń improwizowaną, czyli narzędzie. Hope - Tier 2,
 * Despair - Tier 1." A real Crime Tool on the sheet, not a sentence — the next
 * Attack with a weapon has to be able to find it.
 */
/** @returns {Promise<string|null>} the item's id, so a Reroll can take it back. */
async function grantImprovisedWeapon(actor, def, band, done) {
    const tier = def.unarmedImprovises?.[band];
    if (tier === undefined) return null;

    const { grantItem } = await import("./inventory.mjs");
    const item = await grantItem(actor, {
        name: def.unarmedImprovises.name,
        category: "crimeTool",
        tier,
        // The killer is mid-incident and cannot go and put something down;
        // a GM's ruling outranks the carry cap here.
        override: true,
        description: `<p>${game.i18n.localize("DRPG.Murder.improvisedNote")}</p>`
    });

    if (!item) return null;

    // Readied on the spot. The killer picked this thing up mid-fight and is
    // holding it; making them open their sheet and click "ready" before the next
    // swing counts would be bookkeeping for a decision they have already made
    // with their hands. It also matters mechanically now that only an equipped
    // tool arms you at all — see `equippedWeapon`.
    try {
        const { toggleEquipped } = await import("./use-items.mjs");
        await toggleEquipped(actor, item);
    } catch (err) {
        error("Could not ready the improvised weapon", err);
    }

    done.push(game.i18n.format("DRPG.Murder.improvised", {
        item: item.name, tier
    }));
    return item.id;
}

/**
 * Score a crisis action and apply it. GM-side: it writes to both participants'
 * sheets and to the map.
 *
 * @param {object} options
 * @param {boolean} [options.undo]  A Reroll replacing this actor's own previous
 *   crisis action. Everything the first throw did is taken back first — see
 *   `undoLastCrisis` — and then this runs normally against the new number.
 *   Because the undo rewinds the incident state, including whose turn it is,
 *   replaying passes the turn a second time and the turn ends up spent exactly
 *   once: the reroll costs Hope, not a turn.
 */
export async function resolveCrisisAction({
    actorId, key, total, isCritical, withHope, undo = false, choice = null, usedItemId = null,
    // G-18. Not derived here from the state, because by the time this runs the
    // grant may have been consumed by the undo half of a Reroll — the client
    // that pressed the tile is the one that knew.
    free = false
} = {}) {
    if (!game.user.isGM) return null;

    // Before `murderState()` is read, not after: the undo rewinds that state,
    // and the replay has to be scored against the incident as it stood when the
    // action was first taken — the same turn, the same stage, the same locks.
    //
    // A replay that could not rewind must NOT go on to apply itself. It would
    // land on top of the first result rather than in place of it: damage twice,
    // two Remnants, the turn passed twice — the exact opposite of what a Reroll
    // is for. The player's dice have already been rewritten either way, so this
    // says so out loud rather than failing quietly.
    if (undo && !await undoLastCrisis({ actorId, key })) {
        await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Murder.rerollLost")}</p>`);
        return null;
    }

    const state = murderState();
    const actor = game.actors.get(actorId);
    const def = CRISIS_ACTIONS[key];
    if (!state || !actor || !def) return null;

    // WHOSE SIDE, not the entry's. One action is written `side: "both"` — using
    // an item is the same act whoever does it — and everything below is about
    // the person who took it: the advantage it clears, whether the turn passes.
    const side = def.side === "both" ? sideOf(actor) : def.side;
    const threshold = key === "finishingBlow"
        ? finishingBlowThreshold(state)
        : def.threshold;
    // `noRoll` actions have no threshold to beat — the guide gives them no
    // table at all — so they always take the success branch. Left out, they
    // scored `total >= undefined`, which is false, and every one of the third
    // party's three decisions would have quietly resolved as a failure.
    // A free take is a success by definition (G-18), on the same footing as the
    // third party's `noRoll` decisions: there is no number to beat because the
    // critical already beat it.
    const success = def.noRoll || free || isCritical || total >= threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    const done = [];

    // What it would take to put all of this back. Captured before anything is
    // applied, because half of it is "the value this resource had a moment ago".
    const receipt = openReceipt(actorId, key, state);

    /*
     * SPENT BEFORE IT IS APPLIED, not after.
     *
     * A resolution action can end the incident outright — Survive does, and a
     * critical Role reversal effectively does — and clearing the grant after
     * that would be writing into a state that has moved on. Cleared for the
     * side that held it rather than blanked, so a second grant (there is no
     * such thing today, and this file has been surprised before) is not eaten
     * by somebody else's turn.
     */
    if (free && freeResolutionFor(side, state)) await writeState({ freeResolution: null });

    // The advantage a missed attempt earned is spent whatever happens next.
    await clearAdvantage(side);

    // The newcomer's one free choice is spent HERE, before anything it does can
    // move the incident out from under the write.
    //
    // It used to be recorded at the bottom of this function, behind
    // `stage === "incident"` so it could not write into a state that had just
    // been cleared. But the one third-party action that can END the incident —
    // Escape together — moves the stage to "resolution" on its way past, and
    // the guard then threw away the very record that a choice had been made:
    // measured, `thirdActed` stayed false with `thirdId` still set.
    //
    // Recorded here it survives all four options, including any added later,
    // and a Reroll still takes it back with the rest of the state, because
    // `openReceipt` above snapshots the state first.
    if (side === "third") await writeState({ thirdActed: true });

    // Read before anything is applied: `grantImprovisedWeapon` below puts a
    // Crime Tool on the sheet, and asking afterwards would find the weapon the
    // attack itself just produced.
    //
    // `carriesWeapon`, not `hasWeapon`: improvising is for a killer with nothing
    // at all, not for one who simply never readied what they had. See
    // `carriesWeapon`.
    const wasUnarmed = def.unarmedImprovises ? !carriesWeapon(actor) : false;

    if (success) {
        receipt.remnant = refOf(await applyRemnant(actor, def.remnant?.[band], def, band, done, false, side));
        await applyDamage(actor, state, def, band, done, false, choice);
        if (wasUnarmed) receipt.itemId = await grantImprovisedWeapon(actor, def, band, done);
        // Spent on the player's client; recorded here so a Reroll can undo it.
        if (def.usesItem) {
            receipt.usedItemId = usedItemId;
            done.push(game.i18n.localize(usedItemId
                ? "DRPG.Murder.useItemWorked" : "DRPG.Murder.useItemFumbled"));
        }
        await applyHindrance(state, def, band, done);
        await applyUnlocks(state, def, key, band, done);
        if (def.swapsRoles) await swapRoles(state, band, done);
        await applyThirdPartyChoice(actor, def, done);
        if (def.endsIncident) await finishIncident(state, key, band, done);
    } else {
        /*
         * G-22: ONLY A HOPE FAILURE EARNS THE NEXT TRY.
         *
         * The guide gives the advantage to a miss "z Hope"; this granted it on
         * any failure, so a victim who rolled badly AND with Despair was paid
         * for it exactly as well as one who was simply unlucky. Those are the
         * two halves the duality is for.
         *
         * `band` is safe to test here and only here (trap 112): a critical is
         * always a success, so this branch sees `hope` and `despair` and
         * nothing else. Three entries in config.mjs carry a `critical` key in
         * their FAILURE tables, left as documentation of the guide's own
         * layout; none of them is reachable, and this line is not one of them.
         */
        if (def.failureGrantsAdvantage && band === "hope") {
            await grantAdvantage(side);
            done.push(game.i18n.localize("DRPG.Murder.advantageNext"));
        }
        receipt.remnant = refOf(await applyRemnant(actor, def.failureRemnant?.[band], def, band, done,
            Boolean(def.failureRemnantReinforced?.[band]), side));
        await applyDamage(actor, state, def, band, done, true, choice);
        // A flat number drains on any failure; an object drains only on the
        // bands it names. Survive costs a point however it fails; Self-defence
        // and Role reversal only on Despair, which is what their own text has
        // always said and what nothing was doing.
        const extra = typeof def.failureExtraDrain === "object"
            ? def.failureExtraDrain?.[band]
            : def.failureExtraDrain;
        if (extra) await drain(state, extra, done);
    }

    // The third party's decisions are "automatyczny, darmowy wybór" — free in
    // the guide's own words — so they are exempt from the Sanity a resolution
    // action normally costs, exactly as they are exempt from the check for it
    // in `takeCrisisAction`.
    if (def.kind === "resolution" && !def.noRoll) await spendStress(actor, done);

    // Before the card is written, so "they run out" is on the same card as the
    // blow that did it rather than arriving as a separate note afterwards.
    const ranOut = await checkVictimSpent(done);

    const announcement = await announceCrisis(actor, def, {
        success, band, total, threshold, done
    });
    receipt.messageId = announcement?.id ?? null;

    // A third party's action is free: it is taken out of the victim→killer
    // order and must not advance it, or somebody walking in would silently
    // skip whoever's turn it actually was. It is also the only one they get —
    // and that is written at the top of this function now, not here.
    if (side === "third") {
        await closeReceipt(receipt);
        return { success, band, done, ranOut };
    }

    /*
     * The turn passes unless the incident just ended — which now includes the
     * victim running out, not only an action that says `endsIncident`.
     *
     * A CRITICAL CAN HOLD IT. The guide gives the direct victim a second action
     * on a critical use of an item and the indirect victim the action back; at a
     * table those are the same thing, so this module has one behaviour for them
     * rather than two mechanisms for one effect. Nothing else in the crisis
     * table keeps a turn, which is why it reads as an exception.
     */
    if (murderState()?.stage === "incident"
        && !(isCritical && def.criticalKeepsTurn)) await passTurn();

    await closeReceipt(receipt);
    return { success, band, done, ranOut };
}

/* ==========================================================================
 * TAKING A CRISIS ACTION BACK — the Reroll's other half
 * --------------------------------------------------------------------------
 * Three Hope buys back the dice, and for every other action in this module that
 * already meant the action itself was undone and redone (see reroll.mjs). A
 * crisis action was the exception: it fell through to "the dice are the whole
 * result", so a player paid three Hope, watched the number change, and watched
 * the damage, the Remnant and the turn stay exactly as the first throw had left
 * them.
 *
 * The undo is a receipt rather than a set of inverse operations. Half of what a
 * crisis action does is a merge into the shared incident state — `hindered`,
 * `blocked`, `unlocked`, `spent`, `drainStopped`, `advantageNext`, whose turn it
 * is, which of the two is the killer after a reversal — and inverting eight
 * merges correctly is a great deal harder to keep right than storing what the
 * state was and putting it back. The document-level effects (a Remnant on the
 * map, damage on a sheet, an improvised weapon, a chat card) are listed one by
 * one because those are the ones that cannot be expressed as state.
 *
 * The receipt lives IN the incident state rather than in a module-level Map, so
 * it survives the GM reloading and works when a second GM picks the incident up.
 * ========================================================================== */

/** The incident state, without the receipt — or a receipt would nest forever. */
function snapshotState() {
    const { lastCrisis, ...rest } = murderState() ?? {};
    return foundry.utils.deepClone(rest);
}

function refOf(placed) {
    const doc = placed?.document ?? placed;
    if (!doc?.id) return null;
    return { id: doc.id, sceneId: doc.parent?.id ?? null };
}

function openReceipt(actorId, key, state) {
    const victim = game.actors.get(state.victimId);
    const actor = game.actors.get(actorId);

    return {
        actorId,
        key,
        state: snapshotState(),
        // Resource VALUES, not deltas. `applyDamage`, `drain`, `swapRoles` and
        // `spendStress` all clamp, so the amount asked for and the amount that
        // landed are routinely different numbers — and only the second one can
        // be put back.
        //
        // THE ACTOR'S HEALTH IS HERE BECAUSE OF Z3. A resolution action taken
        // with no Sanity left is paid for in Health, so the actor now has two
        // tracks a Reroll has to be able to put back — and a receipt that
        // remembers one of them would refund the Sanity nobody spent and keep
        // the blood that was.
        actorStress: actor ? resourceValue(actor, "stress") : null,
        actorHp: actor ? resourceValue(actor, "hitPoints") : null,
        victimId: state.victimId ?? null,
        victimHp: victim ? resourceValue(victim, "hitPoints") : null,
        victimStress: victim ? resourceValue(victim, "stress") : null,
        remnant: null,
        itemId: null,
        messageId: null
    };
}

async function closeReceipt(receipt) {
    try {
        await writeState({ lastCrisis: receipt });
    } catch (err) {
        error("Could not record what this crisis action did; a Reroll will not be able to replay it", err);
    }
}

/**
 * Put back everything this actor's last crisis action did.
 *
 * Refuses politely when the receipt is for a different action or a different
 * person — a Reroll must never unwind somebody else's turn.
 */
async function undoLastCrisis({ actorId, key }) {
    const receipt = murderState()?.lastCrisis ?? null;
    if (!receipt) return false;
    if (receipt.actorId !== actorId || receipt.key !== key) {
        warn(`Reroll: the recorded crisis action (${receipt.key} by ${receipt.actorId}) is not the one being replayed.`);
        return false;
    }

    // The Remnant it left. Deleted directly rather than through
    // `removeRemnant`, which refuses reinforced traces — and a critical leaves
    // exactly those. This is not the killer scrubbing a trace away; it is a roll
    // that no longer happened.
    if (receipt.remnant?.id) {
        try {
            const scene = receipt.remnant.sceneId
                ? game.scenes.get(receipt.remnant.sceneId)
                : null;
            await scene?.tokens?.get(receipt.remnant.id)?.delete();
        } catch (err) {
            error("Could not take back the Remnant a rerolled crisis action left", err);
        }
    }

    /*
     * The thing a use spent.
     *
     * Put back rather than remade: it is the same object in the same slot, and
     * using it up only ever wrote a flag. Set to `false` rather than removed,
     * because deleting a flag key needs a forced replacement in this Foundry and
     * a flag that cannot be cleared is worse than one that reads false.
     *
     * What does NOT come back is the readied state. Using a thing puts it down
     * as well, and with one hand (E9) the character may be holding something
     * else by now; a Reroll that quietly swapped what is in somebody's hand
     * would be a worse surprise than an item that needs picking up again.
     */
    if (receipt.usedItemId) {
        try {
            await game.actors.get(actorId)?.items?.get(receipt.usedItemId)
                ?.setFlag(MODULE_ID, ITEM_FLAGS.broken, false);
        } catch (err) {
            error("Could not give back the item a rerolled crisis action used", err);
        }
    }

    // The weapon an unarmed attack improvised.
    if (receipt.itemId) {
        try {
            await game.actors.get(actorId)?.items?.get(receipt.itemId)?.delete();
        } catch (err) {
            error("Could not take back the improvised weapon a rerolled attack granted", err);
        }
    }

    // The chat card describing the old outcome. The replay posts its own, and
    // two contradictory accounts of one action is exactly what Reroll exists to
    // avoid — see the note at the top of reroll.mjs about the dice.
    if (receipt.messageId) {
        try {
            await game.messages.get(receipt.messageId)?.delete();
        } catch {
            // A message somebody already cleared is not a problem.
        }
    }

    const actor = game.actors.get(actorId);
    await restoreResource(actor, "stress", receipt.actorStress);
    await restoreResource(actor, "hitPoints", receipt.actorHp);
    const victim = receipt.victimId ? game.actors.get(receipt.victimId) : null;
    await restoreResource(victim, "hitPoints", receipt.victimHp);
    await restoreResource(victim, "stress", receipt.victimStress);

    // The state wholesale, receipt included: the replay writes a fresh one.
    try {
        await game.settings.set(MODULE_ID, SETTINGS.murderState, receipt.state ?? {});
    } catch (err) {
        error("Could not rewind the incident state for a Reroll", err);
        return false;
    }

    log(`Reroll: took back ${receipt.key} by ${game.actors.get(actorId)?.name ?? actorId}.`);
    return true;
}

async function restoreResource(actor, field, value) {
    if (!actor || typeof value !== "number") return;
    if (resourceValue(actor, field) === value) return;
    try {
        await automatedUpdate(actor, { [`system.resources.${field}.value`]: value });
    } catch (err) {
        error(`Could not restore ${field} while taking a crisis action back`, err);
    }
}

/* ==========================================================================
 * RUNNING OUT
 * --------------------------------------------------------------------------
 * A victim whose Health and Sanity are both full of marks has nothing left to
 * spend, and the incident is over whether or not anybody presses a button.
 *
 * This used to wait for a Finishing Blow. The victim kept taking turns at zero
 * and zero, the drain kept finding nothing to take, and the table sat looking at
 * a fight that had already ended — until a GM noticed and clicked. Every route
 * into that state now ends it: the drain, damage from a crisis action, and a
 * GM editing the sheet by hand.
 *
 * Deliberately NOT scored as a Finishing Blow. Nobody rolled it, so nobody earns
 * what a Finishing Blow grants — the critical's free Stage 6 action least of
 * all. The incident simply stops and Stage 6 opens.
 * ========================================================================== */

/** Both tracks full: Health and Sanity are reverse resources, marks count up. */
function isSpent(actor) {
    if (!actor) return false;
    return resourceValue(actor, "hitPoints") >= resourceMax(actor, "hitPoints")
        && resourceValue(actor, "stress") >= resourceMax(actor, "stress");
}

/**
 * End the incident if the victim has run out.
 *
 * @param {string[]} [done]  Lines for the outcome card, when called from one.
 * @returns {Promise<boolean>} true if this ended the incident.
 */
async function checkVictimSpent(done = null) {
    if (!game.user.isGM) return false;

    const state = murderState();
    if (!state || state.stage !== "incident") return false;

    const victim = game.actors.get(state.victimId);
    if (!isSpent(victim)) return false;

    // One killer: the incident is over and closing it is bookkeeping.
    //
    // TWO killers: it is a ruling, so it is asked. The accomplice may be owed
    // the turn they were part-way through, the pair may want a last trace laid
    // between them, and slamming the incident shut the instant the victim runs
    // out takes that away without anyone choosing it. Asked rather than assumed
    // because the guide does not say, and the wrong silent default here is one
    // nobody can undo.
    if (killerIds(state).length > 1) {
        const names = killerIds(state)
            .map(id => game.actors.get(id)?.name).filter(Boolean)
            .map(n => foundry.utils.escapeHTML(n)).join(" & ");
        const now = await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Murder.ranOutTitle") },
            content: dialogContent(`<div>
                <p>${game.i18n.format("DRPG.Murder.ranOutTwoKillers", {
                    victim: foundry.utils.escapeHTML(victim.name), killers: names
                })}</p>
                <p class="notes">${game.i18n.localize("DRPG.Murder.ranOutTwoKillersNote")}</p>
            </div>`),
            yes: { label: game.i18n.localize("DRPG.Murder.ranOutEndNow") },
            no: { label: game.i18n.localize("DRPG.Murder.ranOutKeepGoing") },
            rejectClose: false
        });
        if (!now) return false;
    }

    await writeState({ stage: "resolution", endedBy: "ranOut" });

    const line = game.i18n.format("DRPG.Murder.ranOut", { name: victim.name });
    if (done) done.push(line);

    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Murder.ranOutTitle")}</h3>
        <p>${foundry.utils.escapeHTML(line)}</p>
        <p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);

    // The death itself is the chapter's business, not the incident's: it clears
    // the inventory, drops the Truth Bullet ledger entries and stamps when it
    // happened. Failing it must not leave the incident half-ended, so the stage
    // has already moved by the time this runs.
    try {
        const { killCharacter, isDeceased } = await import("./chapter.mjs");
        if (!isDeceased(victim)) await killCharacter(victim);
    } catch (err) {
        error(`Could not record ${victim.name}'s death when they ran out`, err);
    }

    log(`${victim.name} ran out of Health and Sanity; the incident ended by itself.`);
    return true;
}

/** Five times the victim's remaining Health; free once they are at zero. */
function finishingBlowThreshold(state) {
    const victim = game.actors.get(state.victimId);
    if (!victim) return 0;
    const left = resourceMax(victim, "hitPoints") - resourceValue(victim, "hitPoints");
    return Math.max(0, left * INCIDENT.finishingBlowPerHp);
}

/** @returns the placed Remnant, so a Reroll can take it back. */
/**
 * The indirect victim's overrides for one crisis action, or nothing.
 *
 * The guide gives whoever dies to a trap their own table (p. 20) rather than a
 * modifier on the killer-facing one. Only the fields that genuinely differ are
 * carried on `def.indirectVictim`, so the two tables cannot drift apart in the
 * parts they share.
 */
function indirectOverride(def, side) {
    if (side !== "victim") return null;
    if (!murderState()?.indirect) return null;
    return def.indirectVictim ?? null;
}

async function applyRemnant(actor, visibility, def, band, done, reinforced = false, side = null) {
    if (!visibility) return null;

    const override = indirectOverride(def, side);
    const forced = reinforced
        || Boolean(def.criticalReinforced && band === "critical")
        || Boolean(override?.reinforced?.[band]);
    // "Ofiara pozostawia 2 Reinforced Incident Remnants" — the one place in the
    // module where a single action leaves more than one trace.
    const count = Math.max(1, override?.count?.[band] ?? 1);

    let last = null;
    for (let i = 0; i < count; i++) {
        last = await dropRemnant(actor, {
            type: def.remnantType ?? "incident",
            visibility,
            tiedToCrime: true,
            reinforced: forced,
            action: "incident",
            note: def.label
        });
    }

    // Never the exact band — see `traceFeedback` in remnants.mjs. Gated on
    // `band` rather than a roll object because that is all this function
    // ever had: Hope or a critical tells the killer/victim what they left,
    // a plain Despair does not.
    if (last && traceFeedback({ isCritical: band === "critical", withHope: band === "hope" }, last)) {
        done.push(count > 1
            ? plural("DRPG.Murder.leftRemnants", { n: count })
            : game.i18n.localize("DRPG.Murder.leftRemnant"));
    }
    return last ?? null;
}

/** Damage the killer deals. Health and Sanity are reverse resources. */
async function applyDamage(actor, state, def, band, done, failed = false, choice = null) {
    const table = failed ? def.failureDamage : def.damage;
    let hit = table?.[band];

    // A weapon attack scales on the tool rather than reading from a table.
    //
    // Unarmed is not tier 0 — the guide treats "no weapon" as its own case:
    // the attack is made at disadvantage and, on a success, produces a weapon
    // rather than using one. So an unarmed hit deals the bare 1, and the tool
    // it improvises is handed over by `grantImprovisedWeapon`.
    if (!failed && def.weaponDamage) {
        const { tier } = await chooseWeapon(actor);
        const amount = band === "critical"
            ? def.weaponDamage.critical(tier)
            : def.weaponDamage.normal(tier);
        hit = { hp: amount };
    }

    // The critical Strike lets the killer choose, and now they have.
    //
    // This used to push "the killer chooses" into the summary and apply nothing
    // at all — a hit that had landed, been announced and cost a turn, but left
    // the victim's sheet untouched until a GM noticed and marked it by hand.
    // `choice` comes from the killer's own client, asked while the dice were
    // still on screen. Without one — an older client, a dismissed window — the
    // old behaviour stands rather than the engine picking for them.
    if (hit?.choice) {
        if (!choice) {
            done.push(game.i18n.localize("DRPG.Murder.killerChooses"));
            return;
        }
        hit = { [choice]: def.damage?.criticalAmount ?? 2 };
    }
    if (!hit) return;

    const victim = game.actors.get(state.victimId);
    if (!victim) return;

    const update = {};
    for (const [resource, amount] of Object.entries(hit)) {
        const field = resource === "hp" ? "hitPoints" : "stress";
        const marks = resourceValue(victim, field);
        update[`system.resources.${field}.value`] =
            Math.min(resourceMax(victim, field), marks + amount);
    }
    await automatedUpdate(victim, update);
    done.push(game.i18n.format("DRPG.Murder.damaged", {
        name: victim.name,
        what: Object.entries(hit).map(([r, n]) => `${n} ${r.toUpperCase()}`).join(", ")
    }));
}

/**
 * Self-defence opening the victim's way out.
 *
 * Guide, the Samoobrona row: Hope unlocks "obie akcje kryzysowe rozwiązania
 * ofiary", Despair only "odwrócenie ról", and a critical unlocks both AND stops
 * the drain — "Ofiara przestaje tracić hp i stress". Either success also
 * "blokuje akcję kryzysową: Samoobrona", so there is exactly one attempt at it.
 *
 * Written as config rather than as a special case here, so a second gated
 * action later is a table entry and not another branch — see `unlocks` and
 * `lockedUntil` in CRISIS_ACTIONS.
 */
async function applyUnlocks(state, def, key, band, done) {
    const opened = def.unlocks?.[band];
    if (!opened?.length && !def.blocksSelf) return;

    const patch = {};

    if (opened?.length) {
        const unlocked = new Set(state.unlocked ?? []);
        for (const id of opened) unlocked.add(id);
        patch.unlocked = Array.from(unlocked);
        done.push(game.i18n.format("DRPG.Murder.unlockedActions", {
            names: opened.map(id => CRISIS_ACTIONS[id]?.label ?? id).join(", ")
        }));
    }

    // One attempt: the action closes itself for the rest of the incident.
    //
    // A separate list rather than a huge number in `blocked`. That store is
    // decremented every round by `passTurn`, and world state is stored as JSON —
    // `Infinity` serialises to `null`, which reads back as "not blocked at all".
    if (def.blocksSelf) {
        const spent = new Set(state.spent ?? []);
        spent.add(key);
        patch.spent = Array.from(spent);
    }

    if (def.criticalStopsDrain && band === "critical") {
        patch.drainStopped = true;
        done.push(game.i18n.localize("DRPG.Murder.drainStopped"));
    }

    /*
     * G-18: the critical also hands over one of the doors it just opened,
     * already open. Stamped with the round rather than counted down, so it
     * expires on its own when play comes back around.
     *
     * Written in the same patch as the unlocks deliberately: the two are one
     * outcome, and a second write would let a client redraw between them and
     * show a free take on an action that is still locked.
     */
    if (def.criticalFreeResolution && band === "critical") {
        patch.freeResolution = { side: def.side, turn: state.turn };
        done.push(game.i18n.localize("DRPG.Murder.freeResolution"));
    }

    await writeState(patch);
}

async function applyHindrance(state, def, band, done) {
    if (!def.hinders) return;

    const target = def.side === "killer" ? "victim" : "killer";
    const store = band === "critical" ? "blocked" : "hindered";
    const next = { ...(state[store] ?? {}) };
    next[target] = { ...(next[target] ?? {}) };
    for (const key of def.hinders.actions) next[target][key] = def.hinders.turns;

    await writeState({ [store]: next });
    done.push(game.i18n.format(
        band === "critical" ? "DRPG.Murder.blockedActions" : "DRPG.Murder.hinderedActions",
        { n: def.hinders.actions.length, turns: def.hinders.turns }
    ));
}

/**
 * The three decisions a newcomer can make instead of rolling.
 *
 * All three change WHO is in the fight rather than what happens in it, so none
 * of them touch damage, Remnants or the turn order — `resolveCrisisAction`'s
 * third-party branch already keeps them out of the victim→killer rotation.
 *
 *   joinsKiller     they side with the attacker and stay in as a killer.
 *   alsoTakesThird  Double role reversal: `swapsRoles` has already turned the
 *                   victim into the killer, and this puts the newcomer beside
 *                   them, which is what makes it *double*.
 *   leavesIncident  Averted eyes. They were never part of it; the incident
 *                   carries on between the original two.
 *
 * Written after `swapRoles` on purpose: the swap rewrites `killerId` and
 * `victimId`, and "join the killers" has to mean whoever holds that seat now.
 *
 * Neither branch marks the choice as spent any more — `resolveCrisisAction`
 * does that for every third-party action before any of this runs. Averted eyes
 * still clears it, and means to: nulling `thirdId` reopens the slot for the
 * next person who walks in.
 */
async function applyThirdPartyChoice(actor, def, done) {
    if (def.joinsKiller || def.alsoTakesThird) {
        // The side keeps the turn it is holding. Joining does not hand the
        // newcomer the current one — `killerTurnId` stays with whoever already
        // had it, and `passTurn` gives the next one to the accomplice.
        const state = murderState();
        await writeState({
            thirdSide: "killer",
            killerTurnId: state?.killerTurnId ?? state?.killerId ?? null
        });
        done.push(game.i18n.format("DRPG.Murder.thirdJoined", {
            name: foundry.utils.escapeHTML(actor.name)
        }));
        return;
    }

    if (def.leavesIncident) {
        // Back to one killer, so the rotation collapses to them — otherwise the
        // side could be left waiting on a turn belonging to somebody who has
        // walked out of the incident.
        const state = murderState();
        await writeState({
            thirdId: null, thirdSide: null, thirdActed: false,
            killerTurnId: state?.killerId ?? null
        });
        done.push(game.i18n.format("DRPG.Murder.thirdLeft", {
            name: foundry.utils.escapeHTML(actor.name)
        }));
    }
}

async function swapRoles(state, band, done) {
    const victim = game.actors.get(state.victimId);
    if (band !== "despair" && victim) {
        await automatedUpdate(victim, {
            "system.resources.stress.value": 0,
            "system.resources.hitPoints.value": 0
        });
    }
    // Everything that described the OLD arrangement of the fight is cleared,
    // not only the two hindrance stores.
    //
    // `unlocked`, `spent` and `drainStopped` are all statements about a
    // particular victim: which ways out they had bought, that they had used
    // their one Self-defence, and that a critical had stopped their bleeding.
    // Carrying them across a reversal handed all three to the person who just
    // became the victim — so the new victim started with Survive and Role
    // reversal already open, could never attempt Self-defence because somebody
    // else had spent it, and did not bleed at all. That last one guts the
    // reversal outright: the guide's whole point is "tym razem to zabójca traci
    // hp/stres".
    await writeState({
        killerId: state.victimId,
        victimId: state.killerId,
        // The chair moved, so the turn moves with it. Left pointing at the old
        // killer, the killers' side would be waiting on a turn belonging to the
        // person who is now the victim, and nobody could act.
        killerTurnId: state.victimId,
        hindered: { victim: {}, killer: {} },
        blocked: { victim: {}, killer: {} },
        unlocked: [],
        spent: [],
        drainStopped: false,
        advantageNext: { victim: false, killer: false },
        // The killer's Despair-success opener took Role reversal away from the
        // person who was the victim THEN. They are the killer now, and the
        // restriction is not a property of the chair they are sitting in.
        deniedToVictim: [],
        /*
         * The case is not the case any more — but HOW BIG it is, is (Z4).
         *
         * Guide, p. 26: "Jeśli mordercą jest inna osoba niż ta, która rozpoczęła
         * incydent, DM przygotowuje nową pulę Key Remnants." The clues were
         * planned around a killer who is now the victim, so every one of them
         * narrows the suspect pool towards the wrong person, and every one has
         * to be written again. That is what `keyRemnantsStale` says and it does
         * not change.
         *
         * WHAT CHANGED IS THAT THE COUNT SURVIVES. This used to write
         * `keyRemnants: null` along with it, and the number is not part of the
         * authored work: it came off the opening roll — five on Hope, four on
         * Despair, three on a critical — and it is a statement about how cleanly
         * the incident began, which a reversal does not undo. Nulling it took
         * the slots off the Investigation Dashboard, took the "still owed" line
         * out of the tracker, and left G-32 counting missing clues against a
         * plan of no size at all. The GM was then asked to write "some" clues.
         *
         * So the key is simply absent from this patch: `writeState` merges, so
         * what it does not name it does not touch. The dashboard is a live
         * region (R19), so the slots redraw against the same number without the
         * GM closing the window.
         */
        keyRemnantsStale: true
    });

    done.push(game.i18n.localize("DRPG.Murder.rolesSwapped"));

    // Said out loud to the GMs, because it is a job rather than a state change:
    // somebody has to sit down and write the clues again before the
    // Investigation. The sentence carries the NUMBER now — it used to say
    // "five" whatever the opening roll had decided, and after Z4 the count is
    // the one thing about the old plan that survives, so it is also the one
    // thing the GM does not have to decide again.
    await whisperToGms(`<p class="drpg-warning">${
        game.i18n.format("DRPG.Murder.keyRemnantsStale", { n: state.keyRemnants })}</p>`);
}

async function finishIncident(state, key, band, done) {
    // WHICH action ended it, not only that something did. An incident that
    // ended in a Finishing Blow and one that ended with two people walking out
    // of the door both landed on stage "resolution" and were indistinguishable
    // afterwards — which is how the post-incident checklist came to promise a
    // body in a room after Escape together. See `afterIncident`.
    await writeState({ stage: "resolution", endedBy: key });
    done.push(game.i18n.localize(
        key === "finishingBlow" ? "DRPG.Murder.victimDead" : "DRPG.Murder.incidentEnded"));

    // The killer can see their own traces from Stage 6 onwards — guide p. 26.
    if (key === "finishingBlow") {
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);

        // And the victim actually dies.
        //
        // This said "the victim is dead" in the log and left them alive in the
        // world: no `FLAGS.deceased`, no dead overlay on the token, still
        // counted as a person in the room by `othersInRoom`, still on the
        // living roster the Class Trial votes from. The one route the engine
        // owns end to end was the one route that did not record the death —
        // running out of Health and Sanity has always called this (see
        // `checkVictimSpent`), and so has the GM's own screen.
        //
        // After the stage write, deliberately: a death that fails must not
        // leave the incident half-ended, and Stage 6 needs the state either way.
        try {
            const { killCharacter, isDeceased } = await import("./chapter.mjs");
            const victim = game.actors.get(state.victimId);
            if (victim && !isDeceased(victim)) await killCharacter(victim);
        } catch (err) {
            error("Could not record the victim's death after the Finishing Blow", err);
        }
    }
}

/**
 * Move a running incident to Stage 6 without a Finishing Blow.
 *
 * A victim can stop being alive by routes this engine does not own: the GM's
 * own "A character dies", a Despair Call, a ruling made out loud. Until now
 * every one of those left the incident sitting at stage "incident" around a
 * corpse — `isCleaner` stayed false, the killer never got the clean-up screen,
 * and the whole of Stage 6 was unreachable by any path except a Finishing Blow.
 *
 * Same two effects `finishIncident` has, and deliberately no more: the incident
 * is not CLOSED here. Closing it is `endMurder`, which wipes the state and puts
 * up the checklist — and the killer needs the state alive to clean under it.
 */
export async function beginResolution(reason = "victimKilled") {
    if (!game.user.isGM) return null;

    const state = murderState();
    if (!state?.active || state.stage !== "incident") return null;

    await writeState({ stage: "resolution", endedBy: reason });
    await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);
    log(`Incident moved to Stage 6 (${reason}).`);
    return murderState();
}

/** One turn's cost to the victim: Sanity first, then Health. */
async function drain(state, amount, done) {
    // A critical Self-defence buys the bleeding stopping — guide: "Ofiara
    // przestaje tracić hp i stress."
    if (state.drainStopped) {
        done.push(game.i18n.localize("DRPG.Murder.drainStopped"));
        return;
    }

    const victim = game.actors.get(state.victimId);
    if (!victim) return;

    let left = amount;
    const update = {};

    const stressMarks = resourceValue(victim, "stress");
    const stressMax = resourceMax(victim, "stress");
    const stressRoom = stressMax - stressMarks;
    const toStress = Math.min(stressRoom, left);
    if (toStress > 0) {
        update["system.resources.stress.value"] = stressMarks + toStress;
        left -= toStress;
    }
    if (left > 0) {
        const hpMarks = resourceValue(victim, "hitPoints");
        update["system.resources.hitPoints.value"] =
            Math.min(resourceMax(victim, "hitPoints"), hpMarks + left);
    }

    if (Object.keys(update).length) {
        await automatedUpdate(victim, update);
        done.push(game.i18n.format("DRPG.Murder.drained", { name: victim.name, n: amount }));
    }
}

async function grantAdvantage(side) {
    const state = murderState();
    await writeState({ advantageNext: { ...(state?.advantageNext ?? {}), [side]: true } });
}

async function clearAdvantage(side) {
    const state = murderState();
    if (!state?.advantageNext?.[side]) return;
    await writeState({ advantageNext: { ...state.advantageNext, [side]: false } });
}

async function spendStress(actor, done) {
    const marks = resourceValue(actor, "stress");
    const max = resourceMax(actor, "stress");

    if (marks < max) {
        await automatedUpdate(actor, {
            "system.resources.stress.value": Math.min(max, marks + RESOLUTION_STRESS_COST)
        });
        done.push(game.i18n.format("DRPG.Murder.spentStress", { n: RESOLUTION_STRESS_COST }));
        return;
    }

    /*
     * NO SANITY LEFT, SO IT IS PAID IN BLOOD (Z3).
     *
     * This branch used to be `return` — the action went through and cost
     * nothing, which was the quiet half of the same deadlock the guard in
     * `takeCrisisAction` describes: a victim on an empty stress track got their
     * way out free, and the incident lost the one currency that was still
     * moving it towards an ending.
     *
     * `automatedUpdate` is what carries it, so the Wounded marker arrives the
     * way it always does — `states.mjs` watches `updateActor` and does not care
     * who wrote the change. And a full Health track does not kill: the incident
     * ends because both tracks are now full, which is `isSpent`, and the caller
     * asks `checkVictimSpent` two lines later.
     */
    const hp = resourceValue(actor, "hitPoints");
    const hpMax = resourceMax(actor, "hitPoints");
    if (hp >= hpMax) return;

    await automatedUpdate(actor, {
        "system.resources.hitPoints.value": Math.min(hpMax, hp + RESOLUTION_HEALTH_COST)
    });
    done.push(game.i18n.format("DRPG.Murder.spentHealth", { n: RESOLUTION_HEALTH_COST }));
}

/**
 * Hand the turn over. The victim always opens the incident, so a full round is
 * victim → killer, and the drain lands at the start of each of the victim's.
 */
export async function passTurn() {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state || state.stage !== "incident") return null;

    /*
     * A ROUND IS: the victim, then EVERY killer in turn, then back to the
     * victim. Not victim/killer strictly alternating — that gave a second
     * killer the victim's own turn as breathing room, which is not what
     * `killerTurnId` rotating between them was ever meant to buy them. With
     * two killers the old rule read `turnSide` as "victim" or "killer" and
     * flipped it every pass, so the sequence ran victim, killer(A), victim,
     * killer(B), victim... — `killerTurnId` rotated correctly underneath, but
     * the side switched back to the victim a turn too early every time.
     *
     * From the victim's turn, the round always restarts at the FIRST killer —
     * not "whoever goes next in the rotation", which is `state.killerTurnId`
     * left over from the round before. From a killer's turn, the round only
     * returns to the victim once the LAST killer in `killerIds` has gone;
     * otherwise it stays on the killers' side and steps to the next one.
     */
    const killers = killerIds(state);
    let next;
    let killerTurnId = state.killerTurnId;

    if (state.turnSide === "victim") {
        next = "killer";
        killerTurnId = killers[0] ?? null;
    } else {
        const current = state.killerTurnId ?? killers[0];
        const at = killers.indexOf(current);
        if (at >= 0 && at + 1 < killers.length) {
            next = "killer";
            killerTurnId = killers[at + 1];
        } else {
            next = "victim";
        }
    }

    // The round completes once per full lap of the killers' side, not once
    // per killer — see the note above. Everything below that used to key off
    // "it is the victim's turn" still does, and now only fires that often.
    const turn = next === "victim" ? state.turn + 1 : state.turn;

    // Tick down the two-turn hindrances at the top of each round.
    const decay = store => {
        const out = {};
        for (const [side, actions] of Object.entries(state[store] ?? {})) {
            out[side] = {};
            for (const [key, turns] of Object.entries(actions)) {
                if (turns > 1) out[side][key] = turns - 1;
            }
        }
        return out;
    };

    const patch = { turnSide: next, turn, killerTurnId };
    if (next === "victim") {
        patch.hindered = decay("hindered");
        patch.blocked = decay("blocked");
    }

    await writeState(patch);

    if (next === "victim") {
        const done = [];
        await drain(murderState(), state.indirect ? INCIDENT.drain.indirect : INCIDENT.drain.direct, done);
        if (done.length) await whisperToGms(`<p>${done.join("<br>")}</p>`);
    }

    return murderState();
}

/* ==========================================================================
 * WALKING IN ON IT
 * --------------------------------------------------------------------------
 * Guide: "W wypadku, gdy w dowolnym momencie do pomieszczenia w trakcie
 * Incydentu wejdzie strona trzecia poprzez akcję ruch, strona trzecia
 * otrzymuje automatyczny, darmowy wybór między akcjami kryzysowymi rozwiązania
 * bezpośredniej strony trzeciej."
 *
 * "Automatyczny" is the operative word, and it was the one thing the module
 * left to the GM noticing: `thirdPartyEnters` existed but only ever fired from
 * a picker in the incident tracker. So somebody could walk their token straight
 * into a murder in progress and nothing would happen unless a human spotted it
 * on the map — which, during an incident, nobody is watching for.
 *
 * DIRECT MURDERS ONLY. An indirect one has no confrontation to walk in on: the
 * victim is alone with a trap, which is what INCIDENT.drain.indirect models and
 * why `sharedEscape` is written for two people in a room. There is nobody there
 * to be interrupted.
 * ========================================================================== */

export function registerMurder() {
    // The betrayal's day-long window (D18). Swept rather than counted down —
    // see `sweepBetrayalWindows`.
    Hooks.on("drpgTimeOfDayChanged", () => {
        sweepBetrayalWindows().catch(err =>
            error("Could not shut the betrayal windows the day moved past", err));
    });

    Hooks.on("updateToken", (tokenDoc, changes) => {
        if (changes.x === undefined && changes.y === undefined) return;
        // One client decides, or several GMs would each write the same
        // participant in — the same rule movement.mjs applies to who pays.
        if (!isPrimaryGm()) return;
        maybeThirdParty(tokenDoc).catch(err =>
            error("Could not check for a third party walking in", err));

        // The other thing walking into a room can mean. Same hook rather than a
        // second `updateToken` listener, so the two checks cannot disagree about
        // which client is allowed to act on a move.
        import("./chapter.mjs")
            .then(m => m.maybeBodyFound(tokenDoc))
            .catch(err => error("Could not check whether a body was just found", err));
    });

    // The victim running out, however it happened.
    //
    // `resolveCrisisAction` already checks after its own damage and drain, which
    // covers the ordinary route. This covers the others: a GM marking damage on
    // the sheet by hand, a Despair Call, an item, anything at all. One client
    // decides, or every GM would race to end the same incident.
    Hooks.on("updateActor", (actor, changes) => {
        if (!isPrimaryGm()) return;
        const r = changes?.system?.resources;
        if (!r?.hitPoints && !r?.stress) return;
        if (murderState()?.victimId !== actor.id) return;

        checkVictimSpent().catch(err =>
            error("Could not check whether the victim has run out", err));
    });
}

/**
 * Did this token just walk into the room the incident is happening in?
 *
 * "The room" is the VICTIM's, not the killer's. They are in the same place for
 * the whole of Stage 5 — but the victim is the one who cannot leave, so their
 * position is the stable answer, and a killer momentarily read as elsewhere
 * (an unlinked token, a half-loaded canvas) must not move the crime scene.
 */
async function maybeThirdParty(tokenDoc) {
    const state = murderState();
    if (!state || state.stage !== "incident") return;
    if (state.indirect) return;          // nothing to interrupt

    const actor = tokenDoc?.actor;
    if (!actor || actor.type !== "character") return;
    // Anybody already in it. Moving around the room they are standing in is not
    // walking into it — and that includes the third party themselves, who used
    // to be covered by an early return on `state.thirdId` that also swallowed
    // everybody who came after them.
    if (participantIds(state).has(actor.id)) return;
    if (isMonokuma(actor)) return;       // the GM on the map is not a witness
    if (actor.getFlag(MODULE_ID, FLAGS.deceased)) return;
    // A token the GM has hidden is not in the scene as far as the fiction is
    // concerned — the same rule `othersInRoom` applies.
    if (tokenDoc.hidden) return;

    const { roomOfToken, locateActor } = await import("./movement.mjs");
    const scene = locateActor(game.actors.get(state.victimId));
    if (!scene?.room) return;
    // Same scene, same room. Two rooms of the same name on two maps are not
    // one room — `sameRoom` makes the same distinction for a handover.
    if (tokenDoc.parent?.id !== scene.scene?.id) return;
    if (roomOfToken(tokenDoc) !== scene.room) return;

    // The guide gives the scene one third party. The second one to walk in is
    // the fourth person in the room, and at four this stops being a murder
    // anybody could carry out — so it ends, rather than continuing around them.
    //
    // Decided HERE and not at the top of the function, because it is a fact
    // about the room: somebody crossing the map with an incident running
    // elsewhere ends nothing.
    if (state.thirdId) {
        await crowdedOut(actor);
        return;
    }

    await thirdPartyEnters(actor);
}

/** Somebody walked in. The guide gives them a free resolution action. */
export async function thirdPartyEnters(actor) {
    if (!game.user.isGM || !actor) return null;
    const state = murderState();
    if (!state || state.stage !== "incident") return null;
    if (state.thirdId) return null;

    // `thirdActed` is written explicitly rather than left undefined: it is what
    // gates their one free action, and a murder opened before this field
    // existed would otherwise carry no value at all.
    await writeState({ thirdId: actor.id, thirdActed: false });
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Murder.thirdTitle")}</h3>
        <p>${game.i18n.localize("DRPG.Murder.thirdIntro")}</p>`);
    log(`${actor.name} walked into the incident.`);
    return murderState();
}

/**
 * A fourth person walks in, and there is no murder to be had.
 *
 * Automatic, and not put to the GM. The condition is countable — four people in
 * one room — and every other reading of it would be the module asking a
 * question it already knows the answer to while the fight carried on in the
 * background.
 *
 * NOBODY DIES. The incident is cancelled where it stands: no body, no Blackened
 * (`recordBlackened` only fires from the resolution stage), no post-incident
 * checklist. What has already happened stays happened — the damage taken, the
 * Sanity spent, the Remnants the fight has already put on the floor.
 *
 * THE NEWCOMER IS NOT TOLD, and that is deliberate. Everyone who was in the
 * incident hears it; the person who walked in gets whatever the GM decides they
 * saw. A whisper naming an interrupted murder would hand a fourth player the
 * killer's identity for the price of walking through a door, and the guide's
 * whole trial rests on that being something people work out.
 */
async function crowdedOut(actor) {
    if (!game.user.isGM || !actor) return null;

    const state = murderState();
    if (!state || state.stage !== "incident") return null;
    if (state.indirect || !state.thirdId) return null;

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const third = game.actors.get(state.thirdId);

    // The GMs and everybody in the room it was happening in — the same audience
    // `announceCrisis` writes to, and for the same reason.
    const recipients = new Set(gmIds());
    for (const id of participantIds(state)) {
        const owner = ownerOf(game.actors.get(id));
        if (owner) recipients.add(owner.id);
    }

    await announce({
        content: `
            <h3>${game.i18n.localize("DRPG.Murder.crowdedTitle")}</h3>
            <p>${game.i18n.format("DRPG.Murder.crowded", {
                name: esc(actor.name), third: esc(third?.name ?? "?")
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Murder.crowdedNote")}</p>`,
        whisper: Array.from(recipients)
    });

    log(`${actor.name} made a fourth in the room; the incident is cancelled.`);
    return endMurder({ reason: "crowded", followUp: false });
}

/**
 * Close the murder out.
 *
 * The tools the incident consumed are destroyed on the way out — the crime tool
 * that was swung and the cleaning tool that was used on the scene. Dynamic
 * import, because cleanup.mjs reads the incident state from this file and a
 * static pair of imports both ways is a cycle for no gain.
 */
/* ==========================================================================
 * WHO KILLED THIS CHAPTER
 * ========================================================================== */

/** The killers of this chapter, in the order they killed. GM-side. */
export function blackenedIds() {
    return game.settings.get(MODULE_ID, SETTINGS.blackened) ?? [];
}

/** Their actors, skipping any that have since been deleted. */
export function blackenedActors() {
    return blackenedIds().map(id => game.actors.get(id)).filter(Boolean);
}

/**
 * Remember who killed.
 *
 * Recorded when the incident CLOSES rather than when it opens, and only when it
 * left a body: Role reversal can hand the killer's seat to the person who was
 * the victim halfway through, and Escape together ends an incident with nobody
 * dead at all. What goes in the register is whoever `killerIds(state)` names
 * when the dust settled, and only if there is a corpse to answer for.
 *
 * `killerIds`, not `state.killerId` alone — an accomplice who really threw in
 * with the killers (`thirdSide === "killer"`) is a killer in every sense the
 * rules care about, including this one. Recording only the original killer
 * left the accomplice off `blackenedIds()`, which is the list `maybeBodyFound`
 * filters witnesses against: the second killer walked past their own corpse
 * and counted as an innocent bystander. `killerIds` already restricts to a
 * third party who actually joined the killers, not one who merely walked into
 * the room, so nothing extra is needed here to keep a bystanding third party out.
 *
 * Appended, never replaced. Two incidents in a chapter — which the betrayal
 * rule makes an ordinary evening — put two (or more) names in here, and the
 * trial asks for all of them.
 */
async function recordBlackened(state) {
    if (!game.user.isGM || !state?.killerId) return;
    // Nobody died: no Blackened. An escape closes an incident and leaves the
    // chapter exactly as it found it.
    if (state.endedBy === "sharedEscape") return;
    if (state.stage !== "resolution") return;

    const current = blackenedIds();
    const additions = killerIds(state).filter(id => !current.includes(id));
    if (!additions.length) return;
    await game.settings.set(MODULE_ID, SETTINGS.blackened, [...current, ...additions]);
    log(`Blackened recorded: ${additions.map(id => game.actors.get(id)?.name ?? id).join(", ")}.`);
}

/** A new chapter starts with nobody's blood on anybody. Called by chapter.mjs. */
export async function clearBlackened() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, SETTINGS.blackened, []);
}

export async function endMurder({ reason = "closed", followUp = true } = {}) {
    if (!game.user.isGM) return null;

    const state = murderState();

    /*
     * A SELF-INFLICTED DEATH IS RECORDED HERE, NOT AT STAGE 4.
     *
     * Every other route to a corpse has a moment the engine owns — a Finishing
     * Blow, the victim running out — and kills them there. This one does not:
     * Stage 6 for a self-inflicted death IS the arrangements made before dying,
     * and `cleanupBlocker` hands the clean-up screen to whoever the state calls
     * the killer. Killing them the instant Stage 4 succeeded would have meant a
     * corpse rolling to scrub its own scene and spending Sanity it no longer
     * has.
     *
     * So the GM closing the incident is what makes it true, which is also the
     * beat they close it on. Before `recordBlackened`, so the register and the
     * death cannot disagree, and guarded on stage the same way it is: a Stage 4
     * that failed closes through here too, and nobody died in that one.
     */
    if (state?.selfInflicted && state.stage === "resolution") {
        try {
            const { killCharacter, isDeceased } = await import("./chapter.mjs");
            const actor = game.actors.get(state.victimId);
            if (actor && !isDeceased(actor)) await killCharacter(actor);
        } catch (err) {
            error("Could not record a self-inflicted death when the incident closed", err);
        }
    }

    // Before the state is wiped — it is the only place the killer's identity
    // exists once this function returns.
    try {
        await recordBlackened(state);
    } catch (err) {
        error("Could not record who the Blackened was", err);
    }
    const killer = state?.killerId ? game.actors.get(state.killerId) : null;
    if (killer) {
        try {
            const { endResolution } = await import("./cleanup.mjs");
            await endResolution(killer);
        } catch (err) {
            error("Could not destroy the tools the incident used", err);
        }
    }

    /*
     * The swing memo goes with the incident it belonged to.
     *
     * AFTER `endResolution`, which is the one thing that reads it, and for
     * everybody rather than the killer alone: a victim who fought back swung
     * something too, and a stale id would have Stage 6 of the NEXT incident
     * destroying a weapon from this one.
     */
    for (const id of participantIds(state ?? {})) {
        try {
            await game.actors.get(id)?.unsetFlag(MODULE_ID, FLAGS.swungWeapon);
        } catch {
            // A memo that outlives its incident costs one wrong confiscation,
            // and only if the same character swings nothing in the next one.
        }
    }

    await game.settings.set(MODULE_ID, SETTINGS.murderState, {});
    log(`Murder closed (${reason}).`);

    // Take back the Stage 4 invitation, if one is still standing.
    //
    // Sent AFTER the state is wiped, so that a client which closes its dialog
    // and falls out of `throwOpeningRoll` reads the cleared state and stops
    // rather than re-offering. Sent unconditionally rather than only from the
    // opening stage: the dialog outlives the stage if a GM moved past it by
    // hand, and a client with nothing in flight ignores this anyway.
    try {
        await revokeOpeningInvitation(state);
    } catch (err) {
        error("Could not take back the opening roll invitation", err);
    }

    // What happens next, while the module still remembers the incident.
    //
    // The moment an incident closes is the moment its details stop being
    // available — the state is wiped one line above — and it is also the moment
    // a GM has four separate errands: the phase has to change, the body has to
    // be found, the autopsy has to be issued, the Key Remnants have to be
    // placed. Each of those lives on a different screen, and the one thing that
    // ties them together is the incident that has just ended.
    //
    // So the checklist is built from the state before it goes, and offered
    // once. `followUp: false` is for the callers that end an incident as part of
    // something else and have their own next screen.
    if (followUp && state?.victimId) {
        try {
            await afterIncident(state);
        } catch (err) {
            error("Could not show the post-incident checklist", err);
        }
    }
    return null;
}

/**
 * The post-murder checklist.
 *
 * Everything on it is derived, nothing is asked: the room comes from the
 * victim's token, the Key Remnant count from the opening roll that produced it,
 * the kind of murder from how the incident was opened. The GM reads a list of
 * what is now owed and presses the one they want to do first — each button is
 * the screen that does it, not a description of where to find it.
 *
 * NOT every incident leaves a body. Escape together ends one with the victim
 * and the newcomer both walking out, and this screen used to answer that with
 * "the body is in the Library, issue the autopsy, move to Investigation" — a
 * checklist for a murder that did not happen. `endedBy` is what tells them
 * apart; everything else that ends an incident does leave somebody dead, so an
 * escape is the only case that branches.
 */
async function afterIncident(state) {
    const victim = game.actors.get(state.victimId);
    const killer = game.actors.get(state.killerId);
    if (!victim) return null;

    if (state.endedBy === "sharedEscape") return afterEscape(state, victim, killer);

    const { roomOfActor } = await import("./movement.mjs");
    const room = roomOfActor(victim);

    const owed = [];
    if (state.keyRemnants > 0) {
        owed.push(plural("DRPG.Murder.afterKeys", { n: state.keyRemnants }));
    }
    owed.push(game.i18n.localize("DRPG.Murder.afterAutopsy"));
    owed.push(game.i18n.localize(state.selfInflicted
        ? "DRPG.Murder.afterSelf"
        : state.indirect
            ? "DRPG.Murder.afterIndirect"
            : "DRPG.Murder.afterDirect"));

    const alreadyInvestigating = getClock().phase === "investigation";

    // Zdrada. The guide's fifth walk-in entry, and the one place two bodies come
    // from: "po zabiciu pierwszego oryginalnego uczestnika" the newcomer may
    // turn on the killer, it "wymaga Rzutu akcji morderstwo bezpośrednie", and
    // it is "jedyny wyjątek od zasady deklaracji zabójstwa" — the only killing
    // in the game that needs no declaration in advance.
    //
    // So it is a SECOND murder, not a second victim inside the first: this
    // incident is over and closed, and a fresh one opens with the newcomer as
    // the killer and the killer as the victim.
    const traitor = betrayalCandidate(state, killer);

    const action = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Murder.afterTitle") },
        content: dialogContent(`<div>
            <p>${state.selfInflicted
                // "X was killed by X" is the sentence this used to produce.
                ? game.i18n.format("DRPG.Murder.afterIntroSelf", {
                    name: foundry.utils.escapeHTML(victim.name)
                })
                : game.i18n.format("DRPG.Murder.afterIntro", {
                    victim: foundry.utils.escapeHTML(victim.name),
                    killer: foundry.utils.escapeHTML(killer?.name ?? "?")
                })}</p>
            <p><strong>${room
                ? game.i18n.format("DRPG.Murder.afterRoom", { room: foundry.utils.escapeHTML(room) })
                : game.i18n.localize("DRPG.Murder.afterNoRoom")}</strong></p>
            <ul class="drpg-briefing-facts">${owed.map(o => `<li>${o}</li>`).join("")}</ul>
            ${traitor ? `<p class="notes">${game.i18n.format("DRPG.Murder.betrayalNote", {
                third: foundry.utils.escapeHTML(traitor.name),
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>` : ""}
        </div>`),
        buttons: [
            ...(alreadyInvestigating ? [] : [{
                action: "investigation", default: true,
                label: game.i18n.localize("DRPG.Murder.afterGoInvestigation")
            }]),
            { action: "body", label: game.i18n.localize("DRPG.Chapter.bodyTitle"),
              default: alreadyInvestigating },
            { action: "autopsy", label: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
            ...(traitor ? [{
                action: "betrayal", class: "drpg-gm-route",
                label: game.i18n.format("DRPG.Murder.betrayalButton",
                    { third: foundry.utils.escapeHTML(traitor.name) })
            }] : []),
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "betrayal") return openBetrayal(traitor, killer);
    if (action === "investigation") {
        const { setPhase } = await import("./clock.mjs");
        await setPhase("investigation");
        // Straight on to the body: moving the phase and announcing the body are
        // the same beat at the table, and splitting them is what made this two
        // trips through the GM panel.
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        return openBodyDiscoveryDialog();
    }
    if (action === "body") {
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        return openBodyDiscoveryDialog();
    }
    if (action === "autopsy") {
        const { issueAutopsyDialog } = await import("./gm-items.mjs");
        return issueAutopsyDialog();
    }
    return null;
}

/**
 * Could THIS actor turn on the person they just killed for?
 *
 * The player's half of the betrayal. Stage 9.5 put it on the GM's post-incident
 * checklist, which made it something the GM had to think of and offer — and the
 * decision is not theirs. The guide gives it to the newcomer: they helped, the
 * body is on the floor, and the person beside them is the only witness.
 *
 * Stage 6 only. Before that they are still in the incident and have crisis
 * actions for it; after `endMurder` there is no incident to continue.
 *
 * @returns {Actor|null} the partner they could turn on
 */
export function betrayalTarget(actor) {
    if (!actor) return null;

    /*
     * READ OFF THE WINDOW, NOT THE INCIDENT (D18, Dawid 29.08).
     *
     * This used to require `murderState().stage === "resolution"`, which tied
     * the offer to an incident that is wiped the moment a GM closes it. The
     * accomplice had the whole of Stage 6 to think of it and nothing after —
     * and Stage 6 is the stretch where they are watching somebody else clean.
     *
     * `armBetrayalWindow` asked every question this used to ask, once, when the
     * incident settled. What is left here is the two facts that can still
     * change afterwards: whether the day has moved on, and whether the person
     * they would be turning on is still alive to turn on.
     *
     * It returns the person they would be turning ON, not the candidate. The
     * GM's question ("who could turn on the killer") is answered by
     * `betrayalCandidate` and returns the newcomer; returning that here once
     * made the tile offer the accomplice a chance to murder themselves.
     */
    const open = actor.getFlag(MODULE_ID, FLAGS.betrayalWindow);
    if (!open?.killerId) return null;

    const clock = getClock();
    if (open.chapter !== clock?.chapter || open.day !== clock?.day) return null;

    const killer = game.actors.get(open.killerId);
    if (!killer || killer.id === actor.id) return null;
    if (killer.getFlag(MODULE_ID, FLAGS.deceased)) return null;
    if (actor.getFlag(MODULE_ID, FLAGS.deceased)) return null;

    /*
     * NOT IN THE MIDDLE OF SOMEBODY ELSE'S FIGHT.
     *
     * Found by the suite the moment the window started outliving its incident:
     * a betrayal armed by the evening's first murder was still on offer while
     * the second one was being fought, so the tile lit for a move `openBetrayal`
     * would then refuse — "an incident is still being fought".
     *
     * A tile that lights for something that cannot be done is worse than one
     * that stays dark, so the two answers are made to agree here rather than at
     * the far end. The offer is not lost, only postponed: the window is a day
     * long and the fight is not.
     *
     * Deliberately NOT a return to reading the incident for the offer itself —
     * that is the flag's job and the whole of D18. This asks a different
     * question: is now a moment when anything can be opened at all.
     */
    const running = murderState();
    if (running?.active && running.stage !== "resolution") return null;

    return killer;
}

/**
 * Open the betrayal on behalf of a player who asked for it. GM-side.
 *
 * Routed through the GM like every other world write in this module, and
 * re-derived here rather than trusted: the packet says who is turning on whom,
 * and the only thing that decides that is the incident state.
 */
export async function betrayAsPlayer(actorId) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId ?? "");
    const target = betrayalTarget(actor);
    if (!actor || !target) {
        warn(`Refused a betrayal: ${actorId} is not in a position to turn on anyone.`);
        return null;
    }

    /*
     * SPENT BEFORE IT IS USED, and that ordering is the whole anti-spam guard
     * now (D18).
     *
     * The old one asked whether the incident was still in its resolution stage,
     * which worked because opening the betrayal's own incident moved it — so
     * the second of two clicks in flight found a changed world. The window
     * outlives the incident, so that no longer holds, and this replaces it with
     * something stronger: the offer is single-use, and unsetting it is the
     * first thing that happens. Two clicks race to a flag only one of them can
     * find.
     *
     * Unset even if the opening below fails. An offer that survives its own
     * failed attempt is an offer that can be attempted again, which is the
     * spam this is here to stop.
     */
    await actor.unsetFlag(MODULE_ID, FLAGS.betrayalWindow);
    return openBetrayal(actor, target);
}

/**
 * Is there somebody who could turn on the killer, and is the killer still alive
 * to be turned on?
 *
 * The newcomer only. `thirdId` survives every branch of the walk-in choice
 * except Averted eyes, which nulls it — and rightly: somebody who walked back
 * out is not standing there with an opportunity. Partners in crime and Double
 * role reversal both leave `thirdSide: "killer"`, and a partner turning on
 * their partner is exactly the betrayal the guide names.
 */
function betrayalCandidate(state, killer) {
    if (!state?.thirdId || !killer) return null;
    const third = game.actors.get(state.thirdId);
    if (!third || third.id === killer.id) return null;
    if (isMonokuma(third)) return null;
    return third;
}

/**
 * The newcomer kills the killer: a second murder, opened without a declaration.
 *
 * This is the guide's one exception to declaring a killing in advance, and it
 * is a whole fresh incident rather than an extension of the one that just
 * ended — the stages start again from the opening roll, and this time the
 * person who did the last killing is the one bleeding.
 *
 * OPENED, NOT ASKED ABOUT.
 *
 * This used to raise a confirmation on the GM's screen, and that was wrong in
 * two ways at once. It is not the GM's decision — the guide gives the betrayal
 * to the newcomer, and a dialog in front of it turns their choice into a
 * request. And it stacked: the player's tile fired one socket message per click,
 * every message raised its own confirm, and a GM working through four of them
 * opened four incidents, each with its own opening roll that cannot be skipped.
 * Measured from the report: "wiele niepomijalnych opening rolls".
 *
 * So the GM is TOLD. The announcement below already whispers them the whole
 * thing, and `endMurder` is one press away if it was a misclick.
 */
async function openBetrayal(third, killer) {
    // The second half of the spam fix, on the side that cannot be raced.
    //
    // The tile guards itself (see `betrayAsPlayer`'s caller in sheet.mjs), but a
    // guard on the sender is a guard on one client: two clicks in flight at once
    // both arrive here before either has written anything. `murderState()` is
    // the only thing both of them see, and the incident this opens is exactly
    // what makes the second call refuse.
    /*
     * NOT ON TOP OF A RUNNING FIGHT.
     *
     * The stage test that used to stand here was really two rules wearing one
     * hat: "do not open twice" (now the window's own single use, spent by the
     * caller) and "do not open a second incident while one is being fought".
     * Only the second belongs here, and it is the one that survives the window
     * outliving the incident — a betrayal on a quiet evening has no incident to
     * be in the resolution stage OF.
     */
    const running = murderState();
    if (running?.active && running.stage !== "resolution") {
        warn(`Refused a betrayal: an incident is still being fought.`);
        return null;
    }

    await announce({
        content: `<p>${game.i18n.format("DRPG.Murder.betrayalAnnounce", {
            killer: foundry.utils.escapeHTML(killer.name)
        })}</p>`,
        whisper: gmIds()
    });

    return openMurder({ killerId: third.id, victimId: killer.id });
}

/**
 * The same screen for the incident nobody died in.
 *
 * Escape together is the one crisis action that ends an incident without a
 * body, and almost everything the ordinary checklist offers is wrong here: no
 * autopsy to issue, no Investigation to move to, no Blackened. What IS owed is
 * the part a GM is most likely to forget, because it is the only thing left —
 * the traces the fight put on the map, and the fact that two people can now
 * describe the attacker.
 *
 * The room comes from the killer, not the victim: the killer is the one who
 * stayed.
 */
async function afterEscape(state, victim, killer) {
    const third = state.thirdId ? game.actors.get(state.thirdId) : null;
    const name = actor => foundry.utils.escapeHTML(actor?.name ?? "?");

    const { roomOfActor } = await import("./movement.mjs");
    const room = roomOfActor(killer) ?? roomOfActor(victim);

    const owed = [
        game.i18n.format("DRPG.Murder.escapeWitness",
            { victim: name(victim), third: name(third) }),
        game.i18n.format("DRPG.Murder.escapeKiller", { killer: name(killer) })
    ];

    const action = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Murder.escapeTitle") },
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Murder.escapeIntro", {
                victim: name(victim), third: name(third), killer: name(killer)
            })}</p>
            <p><strong>${room
                ? game.i18n.format("DRPG.Murder.escapeRoom",
                    { room: foundry.utils.escapeHTML(room) })
                : game.i18n.localize("DRPG.Murder.escapeNoRoom")}</strong></p>
            <ul class="drpg-briefing-facts">${owed.map(o => `<li>${o}</li>`).join("")}</ul>
        </div>`),
        buttons: [
            { action: "remnants", default: true,
              label: game.i18n.localize("DRPG.Murder.escapeRemnants") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "remnants") {
        const { openInvestigationDashboard } = await import("./investigation.mjs");
        return openInvestigationDashboard();
    }
    return null;
}

/* ==========================================================================
 * TELLING THE TABLE
 * ========================================================================== */

async function tellGms(text, extra = {}) {
    await whisperToGms(`<p>${foundry.utils.escapeHTML(text)}</p>${
        extra.keys ? `<p><strong>${game.i18n.format("DRPG.Murder.keyCount", {
            n: extra.keys
        })}</strong></p>` : ""
    }`);
}

/** @returns the ChatMessage, so a Reroll can replace it rather than contradict it. */
/**
 * Tell the incident what just happened — the GMs AND the people in it.
 *
 * This used to whisper to the GMs alone. The player who had just rolled was
 * told nothing at all: not whether they hit the threshold, not what it did, not
 * that the turn had passed. They watched dice land and then waited for somebody
 * to say something out loud. It was the one action in the module that produced
 * no answer for the person taking it.
 *
 * Both participants get it, not just the roller. An incident is two people in a
 * room hitting each other; the victim who has just been Struck can see that as
 * plainly as the killer, and hiding it made the fight unreadable from inside.
 * The guide's secrecy is about who is doing this to WHOM out in the world, and
 * that is protected by the incident being invisible to everybody else — not by
 * keeping its two participants in the dark about each other.
 *
 * A third party who has walked in is included for the same reason: they are in
 * the room.
 */
async function announceCrisis(actor, def, { success, band, total, threshold, done }) {
    // On a success, the sentence for the band that came up. On a failure,
    // NOTHING from the table — what happened is in `done`.
    //
    // `def.failure` is one string covering every branch at once: "Nothing on a
    // Hope failure. On Despair you still take 1 Sanity off them and leave an
    // Evident Remnant; a critical failure leaves an Obvious one." That is a
    // reference table, and the player has to work out which third of it applies
    // to the roll they just made — while the line directly under it already
    // lists what the module actually did.
    //
    // Worse, three of those strings had drifted from the code: Self-defence and
    // Role reversal both promise an extra point of drain on a Despair failure
    // and neither has `failureExtraDrain` set, and Escape together promises the
    // newcomer becomes a second victim, which nothing implements. Printing the
    // receipt instead of the promise cannot drift.
    const outcome = success ? (def[band] ?? "") : "";
    const state = murderState();

    // A `noRoll` action has no dice and no threshold, so the score line is
    // nonsense for it — it printed "0 ≥ undefined · with Hope". What it has
    // instead is the sentence describing the choice.
    const score = def.noRoll
        ? `<p><em>${foundry.utils.escapeHTML(callEffect(def) || def.hint || "")}</em></p>`
        : `<p>${total} ${success ? "≥" : "<"} ${threshold} · ${
            game.i18n.localize(`DRPG.Murder.band.${band}`)}</p>`;

    // A failure that changed nothing at all still gets a sentence. An empty
    // card under a score line reads as though the module lost the result.
    const nothing = !success && !done.length
        ? `<p>${game.i18n.localize("DRPG.Murder.failedNothing")}</p>`
        : "";

    const content = `
        <h3>${foundry.utils.escapeHTML(def.label)} — ${foundry.utils.escapeHTML(actor.name)}</h3>
        ${score}
        ${outcome ? `<p>${foundry.utils.escapeHTML(outcome)}</p>` : ""}
        ${nothing}
        ${done.length ? `<ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>` : ""}`;

    const recipients = new Set(gmIds());
    for (const id of [state?.killerId, state?.victimId, state?.thirdId]) {
        const owner = id ? ownerOf(game.actors.get(id)) : null;
        if (owner) recipients.add(owner.id);
    }

    return announce({ content, whisper: Array.from(recipients) });
}

/* ==========================================================================
 * THE GM'S TRACKER
 * ========================================================================== */

/** Open a murder from the GM panel. */
export async function openMurderDialog({ killerId = null, indirect = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (murderState()) return openIncidentTracker();

    const { livingStudents } = await import("./chapter.mjs");
    const alive = livingStudents();
    // One is enough, now that a student can be both sides of it. The old floor
    // of two was the last place the engine still assumed a murder needs two
    // people — and the case it locked out, a single survivor with nothing left
    // to do, is the one where this ending is likeliest.
    if (!alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.needOne"));
        return null;
    }

    const optionsFor = selected => alive
        .map(a => `<option value="${a.id}"${a.id === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    /*
     * THE VICTIM DOES NOT START AS THE KILLER (D-F5-1).
     *
     * Both dropdowns are built from the same list of the living, and a select
     * with nothing marked shows its first option — so the window opened
     * proposing that somebody kill themselves.
     *
     * That pair is now LEGAL (see `openMurder`), which changes what this
     * defence is for rather than removing the need for it. It is no longer
     * about heading off a refusal; it is about not proposing one of the two
     * heaviest things at this table as the value nobody touched. A GM who wants
     * it picks it, and the note below says out loud what they have picked.
     *
     * The old render hook that MOVED the victim whenever the killer landed on
     * them is gone with the refusal: it would now silently undo a deliberate
     * choice, and it fired on exactly the gesture a GM reaching for this ending
     * is most likely to make.
     */
    const defaultKiller = killerId ?? alive[0]?.id ?? null;
    const defaultVictim = (alive.find(a => a.id !== defaultKiller) ?? alive[0])?.id ?? null;

    const options = optionsFor(defaultVictim);

    // Which killers have a finished trap waiting. The checkbox follows the
    // dropdown from this, so "indirect" stops being a box a GM has to remember
    // to tick — or remember NOT to tick on a murder that had no project.
    const { allProjects } = await import("./projects.mjs");
    const armed = new Set(allProjects()
        .filter(p => p.indirectMurder && p.current >= p.start)
        .map(p => p.killerId ?? null)
        .filter(Boolean));

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.openTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Murder.openIntro")}</p>
            <label>${game.i18n.localize("DRPG.Murder.killer")}
                <select name="killer">${optionsFor(defaultKiller)}</select></label>
            <label>${game.i18n.localize("DRPG.Murder.victim")}
                <select name="victim">${options}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="indirect"${
                    indirect || armed.has(killerId) ? " checked" : ""} />
                ${game.i18n.localize("DRPG.Murder.indirect")}</label>
            <p class="notes drpg-warning" data-drpg-self hidden>${
                game.i18n.localize("DRPG.Murder.openSelfNote")}</p>
        </form>`),
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            if (!form) return;
            const note = dialog.element.querySelector("[data-drpg-self]");

            /*
             * Say it, rather than prevent it.
             *
             * One name in both dropdowns is a real incident now, and it is also
             * something a GM can arrive at by accident — picking a killer who
             * happened to be the selected victim used to be corrected for them.
             * Correcting it silently is the wrong half of the trade in both
             * directions, so what happens instead is that the window tells them
             * which of the two they are looking at, live, before Confirm.
             *
             * The trap checkbox goes with it: an indirect self-inflicted death
             * opens on a roll that cannot mean anything (see `openMurder`), so
             * it is cleared and locked rather than quietly ignored downstream.
             */
            const sync = () => {
                const self = form.killer.value === form.victim.value;
                if (note) note.hidden = !self;
                form.indirect.disabled = self;
                if (self) form.indirect.checked = false;
            };

            form.killer.addEventListener("change", () => {
                if (form.killer.value !== form.victim.value) {
                    form.indirect.checked = armed.has(form.killer.value);
                }
                sync();
            });
            form.victim.addEventListener("change", sync);
            sync();
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Murder.openConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        killerId: f.killer.value,
                        victimId: f.victim.value,
                        indirect: f.indirect.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    // One name in both seats no longer needs confirming twice. It was refused
    // here; the window now says what it is while the GM is still looking at it,
    // and `openMurder` is the one place that decides what such an incident does.
    await openMurder(result);
    return openIncidentTracker();
}

/**
 * Throw one of the two opening rolls.
 *
 * Rolled on the GM's client, on the participant's actor. That is a deliberate
 * difference from every other roll in this module: Stage 4 happens before the
 * table knows an incident is coming, and handing the victim a roll window
 * titled "opening roll — victim" would tell them the one thing the guide is
 * careful not to.
 *
 * Night swings both rolls, in opposite directions.
 */
/**
 * Stage 4, handed to the person it is about.
 *
 * These two dice decide whether a murder happens at all, and they used to be
 * thrown on the GM's client — so the roll window opened on the wrong screen, the
 * Hope or Sanity it produced was committed by the GM, and a Call the killer had
 * armed for exactly this moment could not be reached. The guide gives the roll
 * to the killer and to the victim; this gives them the dice.
 *
 * The GM still throws it when there is nobody to ask: an unowned character, or
 * an owner who is not connected. That is not a fallback for convenience — an
 * incident cannot wait on somebody who has gone home.
 */
/**
 * What this Stage 4 roll is called, on the window and in the whisper.
 *
 * Prose from config.mjs rather than an i18n key — see MURDER_OPENING. The
 * self-inflicted variant matters here more than anywhere else it is read: the
 * roll goes to the player's own client, and a dialog titled "Opening roll —
 * killer" is a strange thing to put in front of somebody rolling for their own
 * death.
 */
function openingLabel(side, state = murderState()) {
    const def = MURDER_OPENING[side];
    return ((state?.selfInflicted && def?.selfInflicted) || def)?.label ?? "";
}

async function rollOpening(side, state) {
    const actor = game.actors.get(side === "killer" ? state.killerId : state.victimId);
    if (!actor) return null;

    const owner = ownerOf(actor);
    if (owner?.active) {
        const { askOpeningRoll } = await import("./gm-bridge.mjs");
        if (askOpeningRoll({ userId: owner.id, actorId: actor.id, side })) {
            // `label` is prose from config.mjs, not an i18n key — see MURDER_OPENING.
            await whisperToOwner(actor, `<p><strong>${
                foundry.utils.escapeHTML(openingLabel(side, state))
            }</strong> — ${game.i18n.localize("DRPG.Murder.openingYours")}</p>`);
            return { asked: true, of: owner.name };
        }
    }

    return throwOpeningRoll(side, actor.id);
}

/**
 * Throw the opening roll on THIS client, then hand the numbers to a GM.
 * Exported because `gm-bridge` calls it when the invitation arrives.
 *
 * `side` is whichever side this murder actually rolls — killer for a direct one,
 * victim for a trap — not a choice made here.
 */
/**
 * How many Stage 4 invitations this client is currently sitting inside.
 *
 * `closeOpeningRoll` needs to know whether the roll dialog on screen is one of
 * ours before it closes anything: a player may well have their own Search roll
 * open at the same moment, and revoking a murder invitation must not shut that.
 */
let openingRollsInFlight = 0;

/**
 * Is the invitation this client is answering still wanted?
 *
 * Read from the world state, which every client can see, so the player's own
 * browser can tell that the incident it is rolling for has been closed. Without
 * this the retry loop below re-offered a roll for a murder that no longer
 * existed — three times, per incident, for ever.
 */
function openingStillWanted(side, actorId) {
    const state = murderState();
    if (!state?.active || state.stage !== "openingRoll") return false;
    return (side === "killer" ? state.killerId : state.victimId) === actorId;
}

/**
 * Take back a Stage 4 invitation on THIS client.
 *
 * Called locally when a GM threw the roll themselves, and over the socket when
 * the roll belongs to a player. Closing the dialog makes Daggerheart's own
 * promise resolve as a cancellation, so `throwOpeningRoll` falls out of its
 * loop by the ordinary route rather than by anything exotic.
 */
export function closeOpeningRoll() {
    if (!openingRollsInFlight) return 0;

    let closed = 0;
    for (const app of foundry.applications.instances?.values?.() ?? []) {
        if (!app.rendered || app.constructor.name !== "D20RollDialog") continue;
        app.close();
        closed++;
    }
    return closed;
}

/**
 * Tell whoever was invited that the invitation is off.
 *
 * Both people are told, not only the side that rolls: the module picks the side
 * when the murder opens, a GM can have re-sent the invitation from the tracker,
 * and a message to somebody with nothing in flight costs nothing. The GM's own
 * client is closed directly, because a roll with no active owner is thrown here.
 */
async function revokeOpeningInvitation(state) {
    closeOpeningRoll();
    if (!state?.killerId && !state?.victimId) return;

    const { cancelOpeningRoll } = await import("./gm-bridge.mjs");
    const told = new Set();
    for (const id of [state.killerId, state.victimId]) {
        const owner = ownerOf(game.actors.get(id ?? ""));
        if (!owner || told.has(owner.id)) continue;
        told.add(owner.id);
        cancelOpeningRoll({ userId: owner.id });
    }
}

export async function throwOpeningRoll(side, actorId) {
    const def = MURDER_OPENING[side];
    const actor = game.actors.get(actorId);
    if (!def || !actor) return null;

    const calls = await import("./call-effects.mjs");
    const night = atNight();
    const situational = night ? (def.nightAdvantage ? 1 : def.nightDisadvantage ? -1 : 0) : 0;
    if (situational) calls.armSituational(situational);

    // Stage 4 is not optional.
    //
    // Closing the roll window used to end it: `rollTrait` returned null, this
    // returned null, and the incident sat in `openingRoll` for ever with the
    // only way forward being the GM noticing and clicking again. An indirect
    // murder made that worse — the victim's roll is the ONLY one, so declining
    // it stalled the whole trap.
    //
    // So it is re-offered rather than accepted. Capped, because a client that
    // has gone away must not be trapped in a reopening dialog: after the cap the
    // GM is told, and the button is still theirs to press.
    // ...unless the murder it belongs to is over.
    //
    // The re-offer had no way of noticing that. A GM who opened an incident and
    // closed it again left the invitation standing on the player's screen, and
    // every attempt to dismiss it reopened the window twice more — measured:
    // closing it took three closes, and four abandoned incidents left four
    // stacked "Body Roll" windows warning about a murder that no longer existed.
    const MAX_ATTEMPTS = 3;
    let roll = null;
    openingRollsInFlight++;
    try {
        const { rollTrait } = await import("./action-rolls.mjs");
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !roll; attempt++) {
            if (!openingStillWanted(side, actorId)) break;
            roll = await rollTrait(actor, def.traits[0], {
                remember: false,
                actionKey: "murderOpening",
                // Thrown on the participant's own client — see `openingLabel`.
                title: game.i18n.localize(murderState()?.selfInflicted
                    ? "DRPG.Roll.opening.selfInflicted"
                    : `DRPG.Roll.opening.${side}`),
                context: { side }
            });
            if (!roll && attempt < MAX_ATTEMPTS && openingStillWanted(side, actorId)) {
                ui.notifications.warn(game.i18n.localize("DRPG.Murder.openingRequired"));
            }
        }
    } finally {
        openingRollsInFlight = Math.max(0, openingRollsInFlight - 1);
        calls.clearSituational();
    }

    if (!roll) {
        // Only a refusal is worth telling the GMs about. An invitation THEY
        // revoked is not news, and reporting it as "declined their opening
        // roll" would blame the player for the GM closing the incident.
        if (openingStillWanted(side, actorId)) {
            const { whisperToGms } = await import("./utils.mjs");
            await whisperToGms(`<p class="drpg-warning">${
                game.i18n.format("DRPG.Murder.openingDeclined", {
                    name: foundry.utils.escapeHTML(actor.name)
                })}</p>`);
        }
        return null;
    }

    const { requestOpeningResult } = await import("./gm-bridge.mjs");
    return requestOpeningResult({
        actorId: actor.id,
        side,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope)
    });
}

/**
 * Apply a thrown opening roll. GM side — Stage 4 writes world state.
 *
 * The side is re-derived from the incident rather than trusted from the packet:
 * the payload says "this was the killer's roll", and the only thing that decides
 * that is who `murderState()` says the killer is.
 */
export async function resolveOpening({ actorId, side, total, isCritical, withHope } = {}) {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state || state.stage !== "openingRoll") return null;

    const real = actorId === state.killerId ? "killer"
        : actorId === state.victimId ? "victim" : null;
    if (!real || real !== side) {
        warn(`Refused an opening roll: ${actorId} is not the ${side} of this incident.`);
        return null;
    }

    const payload = { total, isCritical: Boolean(isCritical), withHope: Boolean(withHope) };
    return real === "killer"
        ? resolveKillerOpening(payload)
        : resolveVictimOpening(payload);
}

/** The live tracker: whose turn, what is left, and the controls. */
export async function openIncidentTracker() {
    /*
     * NO `alreadyOpen` GUARD HERE, and it is the one window that must not have
     * one. Every other window in the module is opened by somebody pressing a
     * thing; this one REOPENS ITSELF after every crisis action, which is the
     * whole reason it is usable during an incident. A duplicate was never the
     * complaint about it, and a guard that fires while the previous copy is
     * still closing would refuse the reopen and leave the incident with no
     * tracker at all — turning a nuisance somebody else has into a broken
     * scene here.
     *
     * It still carries `drpg-window-incident`, so the diagnostics can count it
     * and a future caller can ask.
     */

    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) {
        ui.notifications.info(game.i18n.localize("DRPG.Murder.none"));
        return null;
    }

    const killer = game.actors.get(state.killerId);
    const victim = game.actors.get(state.victimId);
    const third = state.thirdId ? game.actors.get(state.thirdId) : null;

    const left = res => victim
        ? `${resourceMax(victim, res) - resourceValue(victim, res)} / ${resourceMax(victim, res)}`
        : "?";

    const action = await tableDialog({
        // `cleanupSection()` below puts a table in this window once Stage 6 has
        // traces to list — `tableDialog` is what sizes the window to it.
        window: { title: game.i18n.localize("DRPG.Murder.trackerTitle") },
        classes: ["drpg-panel", "drpg-window-incident"],
        content: dialogContent(`<div>
            <p>${state.selfInflicted
                // One name, and an arrow pointing at itself would be the only
                // thing on this line that is not true.
                ? `<strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong> · ${
                    game.i18n.localize("DRPG.Murder.selfInflicted")}`
                : `<strong>${foundry.utils.escapeHTML(killer?.name ?? "?")}</strong> →
                   <strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong>${
                    third ? ` · ${game.i18n.format("DRPG.Murder.thirdIs", {
                        name: foundry.utils.escapeHTML(third.name)
                    })}` : ""}`}</p>
            <p>${state.selfInflicted
                // No turn and no side to report: there is no Stage 5 in this one.
                ? game.i18n.format("DRPG.Murder.trackerStateSelf", {
                    stage: game.i18n.localize(`DRPG.Murder.stage.${state.stage}`)
                })
                : game.i18n.format("DRPG.Murder.trackerState", {
                    stage: game.i18n.localize(`DRPG.Murder.stage.${state.stage}`),
                    turn: state.turn,
                    side: game.i18n.localize(`DRPG.Murder.side.${state.turnSide}`)
                })}</p>
            <p>${game.i18n.format("DRPG.Murder.victimLeft", {
                hp: left("hitPoints"), stress: left("stress")
            })}</p>
            <p>${game.i18n.format("DRPG.Murder.keyCount", { n: state.keyRemnants })}</p>
            ${await cleanupSection(killer)}
        </div>`),
        buttons: [
            // There is no "roll the opening" button, and there must not be one.
            //
            // Stage 4 offers exactly one roll and its owner is not a decision:
            // a direct murder opens on the KILLER's roll, a trap on the VICTIM's.
            // `openMurder` sends that invitation itself the moment the incident
            // opens, so by the time this window is on screen the roll is already
            // with whoever owes it.
            //
            // A button here only ever sent a SECOND copy. Measured: opening one
            // incident and pressing it three times left the player with FOUR
            // stacked roll windows, each of which reopened itself twice more when
            // dismissed — the retry loop cannot tell an unwanted duplicate from a
            // refusal. And because the tracker reopens after every action with
            // this button as `default`, holding Enter sent invitations for as
            // long as you held it.
            //
            // Nothing is lost by its absence. An owner who is offline never gets
            // an invitation in the first place — `rollOpening` sees that and
            // throws the roll on the GM's own client — and an owner who is here
            // is re-offered three times before anyone has to intervene.
            // And none at all for a self-inflicted death: there is no turn to
            // pass, so the window's DEFAULT button — the one Enter presses —
            // would have been a control for a stage this incident never enters.
            ...(state.stage === "openingRoll" || state.selfInflicted ? [] : [
                // No "somebody walks in" button. The guide's third party is
                // whoever "wejdzie do pomieszczenia poprzez akcję ruch", and
                // `maybeThirdParty` already watches token movement into the
                // victim's room and registers them the moment it happens. A
                // second, manual route only invited the GM to nominate somebody
                // who had not actually walked in — and to do it twice, since the
                // watcher had usually already fired.
                { action: "pass", label: game.i18n.localize("DRPG.Murder.passTurn"), default: true }
            ]),
            { action: "end", label: game.i18n.localize("DRPG.Murder.endMurder") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "pass") {
        await passTurn();
        return openIncidentTracker();
    }
    if (action === "end") {
        const sure = await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Murder.endMurder") },
            content: `<p>${game.i18n.localize("DRPG.Murder.endConfirm")}</p>`
        });
        if (sure) await endMurder();
    }
    return null;
}

/**
 * What the killer is standing in, once the fight is over.
 *
 * Read-only on purpose. The clean-up itself is the killer's action and costs
 * their Sanity — the GM watching it happen needs to know what is still there and
 * what will not come off, not a button to do it for them. Reinforced traces are
 * listed and marked rather than hidden: "there is one you cannot touch" is the
 * single most useful thing this table says.
 *
 * The thresholds are deliberately shown here and nowhere the killer can see —
 * they are read off the trace's own visibility, which is the answer key.
 */
async function cleanupSection(killer) {
    const state = murderState();
    if (state?.stage !== "resolution" || !killer) return "";

    const { cleanableRemnants, cleaningTier, cleaningTool } = await import("./cleanup.mjs");
    const traces = cleanableRemnants(killer);

    const tool = cleaningTool(killer);
    const toolLine = tool
        ? game.i18n.format("DRPG.Cleanup.gmTool", {
            item: foundry.utils.escapeHTML(tool.name), tier: cleaningTier(killer)
        })
        : game.i18n.localize("DRPG.Cleanup.gmNoTool");

    if (!traces.length) {
        return `<h4>${game.i18n.localize("DRPG.Cleanup.title")}</h4>
                <p class="notes">${toolLine}</p>
                <p><em>${game.i18n.localize("DRPG.Cleanup.gmNothingHere")}</em></p>`;
    }

    const rows = traces.map(t => `<tr>
        <td>${foundry.utils.escapeHTML(`${t.data.visibilityLabel} ${t.data.typeLabel}`)}</td>
        <td>${foundry.utils.escapeHTML(t.data.note || t.data.subject || "—")}</td>
        <td>${t.data.reinforced
            ? `<strong>${game.i18n.localize("DRPG.Cleanup.gmReinforced")}</strong>`
            : `DC ${t.dc}`}</td>
    </tr>`).join("");

    // How much scrubbing the killer still has in them. Stage 6 has no turn
    // limit — it ends when the Sanity runs out or the GM says so — and without
    // this the GM had no way to see which of those was coming.
    const left = Math.max(0,
        Math.floor((resourceMax(killer, "stress") - resourceValue(killer, "stress"))
            / RESOLUTION_STRESS_COST));

    return `<h4>${game.i18n.localize("DRPG.Cleanup.title")}</h4>
        <p class="notes">${toolLine}</p>
        <p class="notes">${plural("DRPG.Cleanup.gmAttemptsLeft", { n: left })}</p>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Cleanup.gmTrace")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmNote")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmThreshold")}</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
}
