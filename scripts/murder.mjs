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
 *            them Stress until it runs out and then HP. Both sides pick crisis
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
    RESOLUTION_STRESS_COST
} from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { carriedInCategory, ITEM_FLAGS } from "./inventory.mjs";
import { equippedIn } from "./use-items.mjs";
import { dropRemnant } from "./remnants.mjs";
import {
    announce, dialogContent, whisperToGms, whisperToOwner, ownerOf, gmIds,
    isPrimaryGm, log, warn, error
} from "./utils.mjs";

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
    const next = { ...(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}), ...patch };
    await game.settings.set(MODULE_ID, SETTINGS.murderState, next);
    return next;
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
 * Is it this actor's turn to act?
 *
 * A third party is deliberately outside the turn order. The guide gives
 * whoever walks in on an incident ONE free action, and "free" here means
 * exactly that: it does not wait for a turn and it does not consume one. Since
 * `turnSide` only ever holds "victim" or "killer", asking whether it equals
 * "third" is always false — which meant the third party was told they had a
 * free action and then refused with "not your turn" every time they tried to
 * use it. They may act while they still have that action, and not after.
 */
export function isTheirTurn(actor) {
    const state = murderState();
    if (!state || state.stage !== "incident") return false;
    const side = sideOf(actor);
    if (side === "third") return !state.thirdActed;
    return state.turnSide === side;
}

/** Crisis actions this actor may take right now, with their hindered flags. */
export function availableCrisisActions(actor) {
    const state = murderState();
    const side = sideOf(actor);
    if (!state || state.stage !== "incident" || !side) return [];

    const hindered = state.hindered?.[side] ?? {};
    const blocked = state.blocked?.[side] ?? {};
    const unlocked = new Set(state.unlocked ?? []);
    const spent = new Set(state.spent ?? []);

    return Object.entries(CRISIS_ACTIONS)
        .filter(([, def]) => def.side === side)
        // The guide takes Role Reversal away from a victim whose killer opened
        // on a Despair success.
        .filter(([key]) => !(state.deniedToVictim ?? []).includes(key))
        .map(([key, def]) => {
            const locked = Boolean(def.lockedUntil && !unlocked.has(key));
            return {
                key,
                def,
                hindered: (hindered[key] ?? 0) > 0,
                // Self-defence gates the victim's two ways out, and closes
                // itself once it lands. `blocked` already means "you may not
                // press this", so both reasons fold into it — and each carries
                // its own explanation for the tooltip.
                blocked: (blocked[key] ?? 0) > 0 || locked || spent.has(key),
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

    const killer = game.actors.get(killerId);
    const victim = game.actors.get(victimId);
    if (!killer || !victim || killer.id === victim.id) return null;

    await writeState({
        active: true,
        stage: "openingRoll",
        indirect,
        killerId, victimId, thirdId: null,
        turn: 0,
        turnSide: "victim",
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
        <p>${game.i18n.format("DRPG.Murder.opened", {
            killer: foundry.utils.escapeHTML(killer.name),
            victim: foundry.utils.escapeHTML(victim.name)
        })}</p>
        <p>${game.i18n.localize(nightNoteKey(indirect))}</p>`);

    log(`Murder opened: ${killer.name} → ${victim.name}${indirect ? " (indirect)" : ""}.`);
    return murderState();
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

    const def = MURDER_OPENING.killer;
    const success = isCritical || total >= def.threshold;

    if (!success) {
        await tellGms(def.failure);
        await endMurder({ reason: "openingFailed" });
        return { success: false };
    }

    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    const keys = Math.max(KEY_REMNANTS.minimum, def.keyRemnants[band]);

    const patch = { stage: "incident", keyRemnants: keys, turn: 1, turnSide: "victim" };

    // A Despair success costs the victim their Stress and their way out.
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
    await tellGms(def[band], { keys });
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
export async function takeCrisisAction(actor, key) {
    const state = murderState();
    const side = sideOf(actor);
    const def = CRISIS_ACTIONS[key];

    if (!state || state.stage !== "incident" || !def || def.side !== side) return null;
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
    // A resolution action costs Stress rather than an action, and needs some.
    //
    // The third party's three decisions are exempt: the guide hands them an
    // "automatyczny, darmowy wybór", and charging Stress to somebody who has
    // only just walked through the door — and may be choosing to walk straight
    // back out — is not what "darmowy" means.
    if (def.kind === "resolution" && !def.noRoll
        && resourceValue(actor, "stress") >= resourceMax(actor, "stress")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.noStressLeft"));
        return null;
    }

    // Three of the third party's four options have no threshold, no stat and no
    // outcome table in the guide, because there is nothing to fail at — you pick
    // a side or you leave. They skip the dice entirely and are applied as taken.
    if (def.noRoll) {
        const { requestCrisisResult } = await import("./gm-bridge.mjs");
        return requestCrisisResult({
            actorId: actor.id, key, total: 0, isCritical: false, withHope: true
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

    let roll;
    try {
        roll = await rollTrait(actor, trait, { actionKey: "crisis", context: { crisis: key } });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    const { requestCrisisResult } = await import("./gm-bridge.mjs");
    await requestCrisisResult({
        actorId: actor.id, key,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope)
    });

    return { roll };
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
 * Through `equippedIn` rather than a flag name spelled out here: it already
 * means "this category, readied, and not in the stash", and it owns the spelling
 * of the flag.
 */
function equippedWeapon(actor) {
    return equippedIn(actor, "crimeTool");
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
 */
function carriesWeapon(actor) {
    return carriedInCategory(actor, "crimeTool").length > 0;
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
    actorId, key, total, isCritical, withHope, undo = false
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

    const side = def.side;
    const threshold = key === "finishingBlow"
        ? finishingBlowThreshold(state)
        : def.threshold;
    // `noRoll` actions have no threshold to beat — the guide gives them no
    // table at all — so they always take the success branch. Left out, they
    // scored `total >= undefined`, which is false, and every one of the third
    // party's three decisions would have quietly resolved as a failure.
    const success = def.noRoll || isCritical || total >= threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    const done = [];

    // What it would take to put all of this back. Captured before anything is
    // applied, because half of it is "the value this resource had a moment ago".
    const receipt = openReceipt(actorId, key, state);

    // The advantage a missed attempt earned is spent whatever happens next.
    await clearAdvantage(side);

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
        await applyDamage(actor, state, def, band, done);
        if (wasUnarmed) receipt.itemId = await grantImprovisedWeapon(actor, def, band, done);
        await applyHindrance(state, def, band, done);
        await applyUnlocks(state, def, key, band, done);
        if (def.swapsRoles) await swapRoles(state, band, done);
        await applyThirdPartyChoice(actor, def, done);
        if (def.endsIncident) await finishIncident(state, key, band, done);
    } else {
        if (def.failureGrantsAdvantage) {
            await grantAdvantage(side);
            done.push(game.i18n.localize("DRPG.Murder.advantageNext"));
        }
        receipt.remnant = refOf(await applyRemnant(actor, def.failureRemnant?.[band], def, band, done,
            Boolean(def.failureRemnantReinforced?.[band]), side));
        await applyDamage(actor, state, def, band, done, true);
        if (def.failureExtraDrain) {
            await drain(state, def.failureExtraDrain, done);
        }
    }

    // The third party's decisions are "automatyczny, darmowy wybór" — free in
    // the guide's own words — so they are exempt from the Stress a resolution
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
    // skip whoever's turn it actually was. It is also the only one they get.
    if (side === "third") {
        if (murderState()?.stage === "incident") await writeState({ thirdActed: true });
        await closeReceipt(receipt);
        return { success, band, done, ranOut };
    }

    // The turn passes unless the incident just ended — which now includes the
    // victim running out, not only an action that says `endsIncident`.
    if (murderState()?.stage === "incident") await passTurn();

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
        actorStress: actor ? resourceValue(actor, "stress") : null,
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

    await restoreResource(game.actors.get(actorId), "stress", receipt.actorStress);
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
 * A victim whose HP and Stress are both full of marks has nothing left to
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

/** Both tracks full: HP and Stress are reverse resources, marks count up. */
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

    await writeState({ stage: "resolution" });

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

    log(`${victim.name} ran out of HP and Stress; the incident ended by itself.`);
    return true;
}

/** Five times the victim's remaining HP; free once they are at zero. */
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

    if (last) {
        done.push(count > 1
            ? game.i18n.format("DRPG.Murder.leftRemnants", { n: count, visibility })
            : game.i18n.format("DRPG.Murder.leftRemnant", { visibility }));
    }
    return last ?? null;
}

/** Damage the killer deals. HP and Stress are reverse resources. */
async function applyDamage(actor, state, def, band, done, failed = false) {
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

    // The critical Strike lets the killer choose. Not a decision the module can
    // make, so it is reported and the GM applies it.
    if (hit?.choice) {
        done.push(game.i18n.localize("DRPG.Murder.killerChooses"));
        return;
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
 */
async function applyThirdPartyChoice(actor, def, done) {
    if (def.joinsKiller || def.alsoTakesThird) {
        await writeState({ thirdSide: "killer", thirdActed: true });
        done.push(game.i18n.format("DRPG.Murder.thirdJoined", {
            name: foundry.utils.escapeHTML(actor.name)
        }));
        return;
    }

    if (def.leavesIncident) {
        await writeState({ thirdId: null, thirdSide: null, thirdActed: false });
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
        // The case is not the case any more.
        //
        // Guide, p. 26: "Jeśli mordercą jest inna osoba niż ta, która rozpoczęła
        // incydent, DM przygotowuje nową pulę Key Remnants." The five clues were
        // planned around a killer who is now the victim, so every one of them
        // narrows the suspect pool towards the wrong person. Cleared rather than
        // recomputed: which clues exist is the GM's authored work, not a number
        // this engine may invent — `keyPlanner` is where they are rebuilt.
        keyRemnants: null,
        keyRemnantsStale: true
    });

    done.push(game.i18n.localize("DRPG.Murder.rolesSwapped"));

    // Said out loud to the GMs, because it is a job rather than a state change:
    // somebody has to sit down and write five new clues before the Investigation.
    await whisperToGms(`<p class="drpg-warning">${
        game.i18n.localize("DRPG.Murder.keyRemnantsStale")}</p>`);
}

async function finishIncident(state, key, band, done) {
    await writeState({ stage: "resolution" });
    done.push(game.i18n.localize(
        key === "finishingBlow" ? "DRPG.Murder.victimDead" : "DRPG.Murder.incidentEnded"));

    // The killer can see their own traces from Stage 6 onwards — guide p. 26.
    if (key === "finishingBlow") {
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);
    }
}

/** One turn's cost to the victim: Stress first, then HP. */
async function drain(state, amount, done) {
    const victim = game.actors.get(state.victimId);
    if (!victim) return;

    // A critical Self-defence buys the bleeding stopping — guide: "Ofiara
    // przestaje tracić hp i stress."
    if (state.drainStopped) {
        done.push(game.i18n.localize("DRPG.Murder.drainStopped"));
        return;
    }

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
    if (marks >= max) return;
    await automatedUpdate(actor, {
        "system.resources.stress.value": Math.min(max, marks + RESOLUTION_STRESS_COST)
    });
    done.push(game.i18n.format("DRPG.Murder.spentStress", { n: RESOLUTION_STRESS_COST }));
}

/**
 * Hand the turn over. The victim always opens the incident, so a full round is
 * victim → killer, and the drain lands at the start of each of the victim's.
 */
export async function passTurn() {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state || state.stage !== "incident") return null;

    const next = state.turnSide === "victim" ? "killer" : "victim";
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

    const patch = { turnSide: next, turn };
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
    Hooks.on("updateToken", (tokenDoc, changes) => {
        if (changes.x === undefined && changes.y === undefined) return;
        // One client decides, or several GMs would each write the same
        // participant in — the same rule movement.mjs applies to who pays.
        if (!isPrimaryGm()) return;
        maybeThirdParty(tokenDoc).catch(err =>
            error("Could not check for a third party walking in", err));
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
    if (state.thirdId) return;           // the guide gives the scene one

    const actor = tokenDoc?.actor;
    if (!actor || actor.type !== "character") return;
    if (actor.id === state.killerId || actor.id === state.victimId) return;
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
 * Close the murder out.
 *
 * The tools the incident consumed are destroyed on the way out — the crime tool
 * that was swung and the cleaning tool that was used on the scene. Dynamic
 * import, because cleanup.mjs reads the incident state from this file and a
 * static pair of imports both ways is a cycle for no gain.
 */
export async function endMurder({ reason = "closed" } = {}) {
    if (!game.user.isGM) return null;

    const state = murderState();
    const killer = state?.killerId ? game.actors.get(state.killerId) : null;
    if (killer) {
        try {
            const { endResolution } = await import("./cleanup.mjs");
            await endResolution(killer);
        } catch (err) {
            error("Could not destroy the tools the incident used", err);
        }
    }

    await game.settings.set(MODULE_ID, SETTINGS.murderState, {});
    log(`Murder closed (${reason}).`);
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
    const outcome = success ? (def[band] ?? "") : (def.failure ?? "");
    const state = murderState();

    // A `noRoll` action has no dice and no threshold, so the score line is
    // nonsense for it — it printed "0 ≥ undefined · with Hope". What it has
    // instead is the sentence describing the choice.
    const score = def.noRoll
        ? `<p><em>${foundry.utils.escapeHTML(def.effect ?? def.hint ?? "")}</em></p>`
        : `<p>${total} ${success ? "≥" : "<"} ${threshold} · ${
            game.i18n.localize(`DRPG.Murder.band.${band}`)}</p>`;

    const content = `
        <h3>${foundry.utils.escapeHTML(def.label)} — ${foundry.utils.escapeHTML(actor.name)}</h3>
        ${score}
        ${outcome ? `<p>${foundry.utils.escapeHTML(outcome)}</p>` : ""}
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
export async function openMurderDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (murderState()) return openIncidentTracker();

    const { livingStudents } = await import("./chapter.mjs");
    const alive = livingStudents();
    if (alive.length < 2) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.needTwo"));
        return null;
    }

    const options = alive
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.openTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Murder.openIntro")}</p>
            <label>${game.i18n.localize("DRPG.Murder.killer")}
                <select name="killer">${options}</select></label>
            <label>${game.i18n.localize("DRPG.Murder.victim")}
                <select name="victim">${options}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="indirect" />
                ${game.i18n.localize("DRPG.Murder.indirect")}</label>
        </form>`),
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
    if (result.killerId === result.victimId) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.sameActor"));
        return null;
    }

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
 * Hope or Stress it produced was committed by the GM, and a Call the killer had
 * armed for exactly this moment could not be reached. The guide gives the roll
 * to the killer and to the victim; this gives them the dice.
 *
 * The GM still throws it when there is nobody to ask: an unowned character, or
 * an owner who is not connected. That is not a fallback for convenience — an
 * incident cannot wait on somebody who has gone home.
 */
async function rollOpening(side, state) {
    const actor = game.actors.get(side === "killer" ? state.killerId : state.victimId);
    if (!actor) return null;

    const owner = ownerOf(actor);
    if (owner?.active) {
        const { askOpeningRoll } = await import("./gm-bridge.mjs");
        if (askOpeningRoll({ userId: owner.id, actorId: actor.id, side })) {
            // `label` is prose from config.mjs, not an i18n key — see MURDER_OPENING.
            await whisperToOwner(actor, `<p><strong>${
                foundry.utils.escapeHTML(MURDER_OPENING[side].label)
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
    const MAX_ATTEMPTS = 3;
    let roll = null;
    try {
        const { rollTrait } = await import("./action-rolls.mjs");
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !roll; attempt++) {
            roll = await rollTrait(actor, def.traits[0], {
                remember: false,
                actionKey: "murderOpening",
                context: { side }
            });
            if (!roll && attempt < MAX_ATTEMPTS) {
                ui.notifications.warn(game.i18n.localize("DRPG.Murder.openingRequired"));
            }
        }
    } finally {
        calls.clearSituational();
    }

    if (!roll) {
        const { whisperToGms } = await import("./utils.mjs");
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Murder.openingDeclined", {
            name: foundry.utils.escapeHTML(actor.name)
        })}</p>`);
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

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.trackerTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <p><strong>${foundry.utils.escapeHTML(killer?.name ?? "?")}</strong> →
               <strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong>${
                third ? ` · ${game.i18n.format("DRPG.Murder.thirdIs", {
                    name: foundry.utils.escapeHTML(third.name)
                })}` : ""}</p>
            <p>${game.i18n.format("DRPG.Murder.trackerState", {
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
            // Stage 4 offers exactly one roll, and which one is decided by the
            // kind of murder rather than by asking.
            //
            // A direct murder opens on the KILLER's roll: they are in the room,
            // and the question is whether they go through with it. An indirect
            // one has nobody to confront — the trap is already set — so the only
            // roll is the VICTIM's, on whether they sense it. Offering both
            // meant half of every Stage 4 was a button that should not have been
            // pressed, and pressing the wrong one wrote the wrong state.
            ...(state.stage === "openingRoll" ? [
                state.indirect
                    ? { action: "rollVictim", label: game.i18n.localize("DRPG.Murder.rollVictim"),
                        default: true }
                    : { action: "rollKiller", label: game.i18n.localize("DRPG.Murder.rollKiller"),
                        default: true }
            ] : [
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

    if (action === "rollKiller" || action === "rollVictim") {
        await rollOpening(action === "rollKiller" ? "killer" : "victim", state);
        return openIncidentTracker();
    }
    if (action === "pass") {
        await passTurn();
        return openIncidentTracker();
    }
    if (action === "end") {
        const sure = await DialogV2.confirm({
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
 * their Stress — the GM watching it happen needs to know what is still there and
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
    // limit — it ends when the Stress runs out or the GM says so — and without
    // this the GM had no way to see which of those was coming.
    const left = Math.max(0,
        Math.floor((resourceMax(killer, "stress") - resourceValue(killer, "stress"))
            / RESOLUTION_STRESS_COST));

    return `<h4>${game.i18n.localize("DRPG.Cleanup.title")}</h4>
        <p class="notes">${toolLine}</p>
        <p class="notes">${game.i18n.format("DRPG.Cleanup.gmAttemptsLeft", { n: left })}</p>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Cleanup.gmTrace")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmNote")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmThreshold")}</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
}
