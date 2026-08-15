/**
 * Danganronpa RPG — Breakdown and Wounded.
 * ---------------------------------------------------------------------------
 * Guide, "Stany gracza": "Gracz przy utracie całego stresu dostaje disadvantage
 * na każdy rzut. Przy utracie całego hp w trakcie Daily Life gracz otrzymuje
 * -1 akcję na porę dnia."
 *
 * Two states, at exactly the two moments Daggerheart also marks — and it marks
 * them with the wrong things:
 *
 *   full Stress  the system applies **Vulnerable**, which in Daggerheart means
 *                "attacks against you have advantage". This game's rule points
 *                the other way: YOUR rolls take the disadvantage.
 *   full HP      the system offers a **Death Move** — blaze of glory, risk it
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
 *              action — the guide's rule was in force before it had an icon.
 */

import { STATES } from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { remaining } from "./character.mjs";
import { isPrimaryGm, log, debug, error } from "./utils.mjs";

const DH = "daggerheart";
const AUTOMATION = "Automation";

/* ==========================================================================
 * REGISTRATION
 * ========================================================================== */

/**
 * Put our two conditions in `CONFIG.statusEffects`.
 *
 * Runs at `setup`, after the system's own `setup` hook has rebuilt that array
 * from its condition table — appending during `init` would be overwritten.
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

/** Only HP and Stress writes can change either state. */
function touchesTracks(changes) {
    const r = changes?.system?.resources;
    return Boolean(r?.hitPoints || r?.stress);
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
 * frame and would fight the system every time HP moved.
 *
 * Idempotent, and it says what it did — silently rewriting somebody else's
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
 * sitting on sheets, and switching the automation off does not retract them —
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
    return remaining(actor, state.resource) <= 0;
}

/**
 * Bring one character's two conditions into line with their tracks.
 *
 * A Monokuma is skipped outright: they have no action economy to lose and no
 * Hope to spend, and `setMonokuma` zeroes both tracks on purpose — which would
 * otherwise light up both states permanently on every GM's own sheet.
 */
/**
 * One pass at a time, per actor.
 *
 * The hook that drives this fires on every HP and Stress write, and an incident
 * writes both within a turn. Two passes overlapping is a real prospect, and
 * `toggleStatusEffect` is not atomic: both would read `actor.statuses` before
 * either had finished creating the effect, both would decide it was missing,
 * and the actor would end up with two Breakdown effects — which then need
 * removing twice before the icon goes away.
 */
const running = new Map();

export async function syncStates(actor) {
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
        } catch (err) {
            error(`Could not toggle ${state.label} on ${actor.name}`, err);
        }
    }

    if (applied.length) debug(`${actor.name} — ${applied.join(", ")}`);
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
 * disagreeing — so this file owns the marker and `character.mjs` owns the
 * question. `shouldHave()` above is the one place they touch.
 */
