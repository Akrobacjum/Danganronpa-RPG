/**
 * Danganronpa RPG - Breakdown and Wounded.
 * ---------------------------------------------------------------------------
 * Guide, "Stany gracza": "Gracz przy utracie całego stresu dostaje disadvantage
 * na każdy rzut. Przy utracie całego hp w trakcie Daily Life gracz otrzymuje
 * -1 akcję na porę dnia."
 *
 * Two states, at exactly the two moments Daggerheart also marks - and it marks
 * them with the wrong things:
 *
 *   full Sanity  the system applies **Vulnerable**, which in Daggerheart means
 *                "attacks against you have advantage". This game's rule points
 *                the other way: YOUR rolls take the disadvantage.
 *   full Health      the system offers a **Death Move** - blaze of glory, risk it
 *                all. A killing game does not grant a heroic exit; the guide
 *                says you lose an action and keep going, and dying is something
 *                a murderer does to you on purpose.
 *
 * So both of the system's automations are switched off and these two are
 * applied instead. They are real status effects rather than a CSS badge: they
 * show on the token, on the sheet, and in the token HUD, which is where a
 * player already looks for "what is wrong with me".
 *
 * Neither state carries an ActiveEffect *change*, because neither effect is
 * expressible as one. Both are enforced by reading the resource directly, so
 * the status marker and the rule can never disagree about who is wounded:
 *
 *   Breakdown  `stateAdvantage()` below, folded into the roll dialog's own
 *              advantage sum alongside Calls and situational modifiers.
 *   Wounded    `actionBudget()` in actions.mjs, which already subtracted the
 *              action - the guide's rule was in force before it had an icon.
 */

import { MODULE_ID, FLAGS, STATES } from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isDeceased } from "./settings.mjs";
import { remaining } from "./character.mjs";
import { isPrimaryGm, primaryGmId, log, debug, error } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";

const DH = "daggerheart";
const AUTOMATION = "Automation";

/* ==========================================================================
 * REGISTRATION
 * ========================================================================== */

/**
 * Put our two conditions in `CONFIG.statusEffects`.
 *
 * Runs at `setup`, after the system's own `setup` hook has rebuilt that array
 * from its condition table - appending during `init` would be overwritten.
 */
export function registerStates() {
    Hooks.on("setup", () => {
        try {
            const existing = new Set((CONFIG.statusEffects ?? []).map(e => e.id));
            for (const state of Object.values(STATES)) {
                if (existing.has(state.id)) continue;
                CONFIG.statusEffects.push({
                    id: state.id,
                    name: `DRPG.States.${state.id}.name`,
                    img: state.img,
                    description: `DRPG.States.${state.id}.description`
                });
            }
            log("Registered the Breakdown and Wounded conditions.");
        } catch (err) {
            error("Could not register the DRPG conditions", err);
        }
    });

    /*
     * HEARD ON EACH BROWSER (E19 C6, audit S03-08). The sound used to be played by the primary's
     * `syncOnce`, and `playSfx` plays on the browser that calls it: the player whose student broke
     * down, and every other GM, heard nothing, while the Sound panel promises "that student's player
     * and the GMs". Each browser now hears the same write and decides for itself, as sfx.mjs does
     * for a Monocub. Before the sync below, so the primary reads the status as it was.
     */
    Hooks.on("updateActor", (actor, changes) => {
        for (const key of stateSoundsFor(actor, changes)) playSfx(key);
    });

    // One client writes, or two GMs race on the same actor.
    Hooks.on("updateActor", (actor, changes) => {
        if (!isPrimaryGm()) return;
        if (!touchesTracks(changes)) return;
        syncStates(actor).catch(err => error("Could not sync the DRPG states", err));
    });

    Hooks.once("ready", () => {
        if (!isPrimaryGm()) return;
        suppressSystemAutomation()
            .then(() => syncAll())
            .catch(err => error("Could not take over the full-track conditions", err));
    });
}

/**
 * Health and Sanity writes, and since E15 C4 the two flags that take both states away: a death
 * published (`deceased`) and a Monocub made (`monocub`), see `heldNone`.
 *
 * A FLAG TAKEN AWAY IS A CHANGE TOO (E15 part 1 fix e1-G3, 25.10.2026; finding E15p1-END-3). A
 * revive (chapter.mjs `reviveCharacter`, the season reset's revive-all) unsets `deceased`, and the
 * key a deletion arrives under is the flag's own (a ForcedDeletion, as the harness writes it) or
 * `-=deceased` (a `-=` spelling; which one v14's `unsetFlag` hands this hook is LIVE-E30-03's, not
 * measured): read only by its own name, a revived student showed no Wounded or Breakdown until the
 * next Health or Sanity write while the budget and the dice read the tracks (tier 1 R980 at
 * c93be060: the `-=` spellings read as no change). Every spelling, and the module's whole flags
 * deleted at once, now count; voice.mjs `reconcileTrigger` reads the same. Exported for R980.
 */
export function touchesTracks(changes) {
    const r = changes?.system?.resources;
    return Boolean(r?.hitPoints || r?.stress || namesFlag(changes, FLAGS.deceased) || namesFlag(changes, FLAGS.monocub));
}

/**
 * Whether an update's `changes` set or delete the module's flag `key`: by its name, by `-=key`, or by the module's
 * whole flags deleted (`-=<module>`). Pure.
 */
export function namesFlag(changes, key) {
    const flags = changes?.flags;
    if (!flags || typeof flags !== "object") return false;
    if (`-=${MODULE_ID}` in flags) return true;
    const f = flags[MODULE_ID];
    return Boolean(f && typeof f === "object" && (key in f || `-=${key}` in f));
}

/* ==========================================================================
 * TAKING OVER FROM THE SYSTEM
 * ========================================================================== */

/**
 * Switch off Daggerheart's Vulnerable and Defeated automations.
 *
 * Done in its settings rather than by racing its hooks: the system applies
 * Vulnerable from the character model's own `_preUpdate` and the defeated
 * condition from `toggleDefeated`, and there is no hook between either of them
 * and the write. Removing the effect afterwards would leave it visible for a
 * frame and would fight the system every time Health moved.
 *
 * Idempotent, and it says what it did - silently rewriting somebody else's
 * settings is the kind of thing a GM should be able to find in the log.
 */
async function suppressSystemAutomation() {
    if (!game.user.isGM) return false;

    let automation;
    try {
        automation = game.settings.get(DH, AUTOMATION);
    } catch {
        debug("Daggerheart's Automation setting is unavailable; nothing to switch off.");
        return false;
    }

    const current = automation?.toObject?.() ?? foundry.utils.deepClone(automation ?? {});
    const wantsVulnerable = current.vulnerableAutomation === true;
    const wantsDefeated = current.defeated?.enabled === true;
    if (!wantsVulnerable && !wantsDefeated) return false;

    try {
        await game.settings.set(DH, AUTOMATION, {
            ...current,
            vulnerableAutomation: false,
            defeated: { ...(current.defeated ?? {}), enabled: false }
        });
        log("Switched off Daggerheart's Vulnerable and Defeated automations; "
            + "Breakdown and Wounded replace them.");
        return true;
    } catch (err) {
        error("Could not switch off Daggerheart's own full-track conditions", err);
        return false;
    }
}

/**
 * Clear anything the system applied before this module took over.
 *
 * A world that has been played on already has Vulnerable and Death Move effects
 * sitting on sheets, and switching the automation off does not retract them -
 * it only stops new ones. Without this the two systems' markers would sit side
 * by side for the rest of the season.
 */
const SYSTEM_CONDITIONS = ["vulnerable", "deathMove", "defeated", "unconscious"];

async function clearSystemConditions(actor) {
    const doomed = actor.effects.filter(e =>
        SYSTEM_CONDITIONS.some(id => e.statuses?.has?.(id)));
    if (!doomed.length) return 0;

    try {
        await actor.deleteEmbeddedDocuments("ActiveEffect", doomed.map(e => e.id));
        return doomed.length;
    } catch (err) {
        error(`Could not clear the system conditions on ${actor.name}`, err);
        return 0;
    }
}

/* ==========================================================================
 * APPLYING OURS
 * ========================================================================== */

/** Should this character be showing this state right now? */
function shouldHave(actor, state) {
    return !heldNone(actor) && remaining(actor, state.resource) <= 0;
}

/*
 * THE DEAD CARRY NO STATES, AND A MONOCUB NEITHER (E15 C4, 25.10.2026; audit S03-10). A body beside
 * the "dead" overlay wore Wounded or Breakdown, and a Monocub made from a victim who bled out was
 * Wounded on the token. Dead as the table knows it (`isDeceased`, the published flag): the statuses
 * are on a token every browser sees, so a death nobody has found keeps its states until it is
 * published, and the hook above runs again on that flag. A Monocub is dead by definition; asked
 * by its flag as well, which is the one a GM can set by hand.
 */
function heldNone(actor) {
    return isDeceased(actor) || Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.monocub));
}

/**
 * Bring one character's two conditions into line with their tracks.
 *
 * A Monokuma is skipped outright: they have no action economy to lose and no
 * Hope to spend, and `setMonokuma` zeroes both tracks on purpose - which would
 * otherwise light up both states permanently on every GM's own sheet.
 */
/**
 * One pass at a time, per actor.
 *
 * The hook that drives this fires on every Health and Sanity write, and an incident
 * writes both within a turn. Two passes overlapping is a real prospect, and
 * `toggleStatusEffect` is not atomic: both would read `actor.statuses` before
 * either had finished creating the effect, both would decide it was missing,
 * and the actor would end up with two Breakdown effects - which then need
 * removing twice before the icon goes away.
 */
const running = new Map();

export async function syncStates(actor) {
    /*
     * A GM'S (E33 C1a, 06.10.2026; R220's census). Every road here is a GM's - the primary's hook
     * above, the sheet's wand after `initCharacter`, `syncAll` at `ready` - and the function is
     * `game.drpg.syncStates`, so a player's console toggled the two conditions, and deleted the
     * system's, on any student it could write. Refused before the queue, so nothing is chained.
     */
    if (!game.user.isGM) return null;
    if (!actor || actor.type !== "character") return null;
    if (isMonokuma(actor)) return null;

    // Queue behind whatever pass is already in flight for this actor, then run.
    // Chaining rather than dropping: the later call is the one that knows the
    // newer resource values, so it must not be the one thrown away.
    const previous = running.get(actor.id) ?? Promise.resolve();
    const mine = previous.catch(() => {}).then(() => syncOnce(actor));
    running.set(actor.id, mine);

    try {
        return await mine;
    } finally {
        if (running.get(actor.id) === mine) running.delete(actor.id);
    }
}

/** Which state announces itself, and with which sound. */
const SFX_FOR_STATE = { [STATES.breakdown.id]: "breakdown", [STATES.wounded.id]: "wounded" };

/**
 * The state sounds one actor write makes on `user`'s browser (E19 C6, audit S03-08).
 *
 * ARRIVING ONLY, as `syncOnce` toggles: the write's own track is now full and the status is not
 * on yet. Every browser runs this on the same `updateActor`, and the primary's pass puts the status
 * on only in answer to that write, so "not held yet" is the arrival on all of them (read from the
 * order of the two writes, not measured at a table). Coming back from Breakdown or
 * Wounded is a relief and is not announced; a write to the other track does not repeat a state
 * that is full and still on its way.
 *
 * Heard by every GM and by the players who own the student (a co-owned character has two), never
 * by another player. A Monokuma is skipped as `syncStates` skips it, and with no GM online
 * nothing puts the status on, so nothing is announced.
 *
 * @returns {string[]} keys of `SFX_EVENTS`, in `STATES` order
 */
export function stateSoundsFor(actor, changes, user = game.user) {
    if (!actor || actor.type !== "character" || isMonokuma(actor)) return [];
    if (!user || !(user.isGM || actor.testUserPermission?.(user, "OWNER"))) return [];
    if (!primaryGmId()) return [];
    const written = changes?.system?.resources ?? {};
    return Object.values(STATES)
        .filter(state => written[state.resource] !== undefined && SFX_FOR_STATE[state.id])
        .filter(state => shouldHave(actor, state) && !(actor.statuses?.has?.(state.id) ?? false))
        .map(state => SFX_FOR_STATE[state.id]);
}

async function syncOnce(actor) {
    await clearSystemConditions(actor);

    const applied = [];
    for (const state of Object.values(STATES)) {
        const wanted = shouldHave(actor, state);
        const held = actor.statuses?.has?.(state.id) ?? false;
        if (wanted === held) continue;

        try {
            await actor.toggleStatusEffect(state.id, { active: wanted });
            applied.push(`${state.label}: ${wanted ? "on" : "off"}`);
            // No sound here: `stateSoundsFor` plays it on every browser that should hear it.
        } catch (err) {
            error(`Could not toggle ${state.label} on ${actor.name}`, err);
        }
    }

    if (applied.length) debug(`${actor.name} - ${applied.join(", ")}`);
    return applied;
}

/** Every student, for the one-off pass at load. */
export async function syncAll() {
    if (!game.user.isGM) return 0;
    let touched = 0;
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const changed = await syncStates(actor);
        if (changed?.length) touched += 1;
    }
    if (touched) log(`Brought the Breakdown/Wounded conditions up to date on ${touched} sheet(s).`);
    return touched;
}

/*
 * "Is this character broken down / wounded" deliberately does NOT live here.
 *
 * `character.mjs` has answered both since before this file existed, and
 * actions.mjs, sheet.mjs and roll-dialog.mjs all read it from there. A second
 * pair of exports saying the same thing is how two copies of one rule start
 * disagreeing - so this file owns the marker and `character.mjs` owns the
 * question. `shouldHave()` above is the one place they touch.
 */
