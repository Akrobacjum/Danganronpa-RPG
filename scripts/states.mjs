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
 *   Breakdown  roll-dialog.mjs `stateGrant` (character.mjs `isBrokenDown`), folded into
 *              the roll window's own advantage sum alongside Calls and situational modifiers.
 *   Wounded    `actionBudget()` in actions.mjs, which already subtracted the
 *              action - the guide's rule was in force before it had an icon.
 */

import { MODULE_ID, FLAGS, STATES, DEAD_ICON } from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isDeceased } from "./settings.mjs";
import { remaining, RESERVES, reserveView } from "./character.mjs";
import { isPrimaryGm, primaryGmId, log, debug, error, whisperToGms } from "./utils.mjs";
import { foundryGivenBack, keepOriginal } from "./enforced.mjs";
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
    // The token bars as the reserve, from init (E24 C1b): before any token is drawn.
    installReserveBars();
    Hooks.on("setup", () => {
        // After every package's init has set the token class (Daggerheart's own among them, E24 C1b).
        installEffectIcons();
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
            // The dead status on the module's skull while Daggerheart's own icon is its default (E24 C1c, Q-E24-7).
            if (ownDeadIcon(CONFIG.statusEffects, automationSetting())) log("The dead status wears the module's icon.");
        } catch (err) {
            error("Could not register the DRPG conditions", err);
        }
    });
    // And again when a GM changes Daggerheart's dead icon mid-session (E24 fix G2A, review n2; `automationChanged`).
    Hooks.on("updateSetting", setting => automationChanged(setting));

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
        // The migration, which alone clears the system's conditions, then the sync (`takeOverConditions`).
        takeOverConditions()
            .catch(err => error("Could not take over the full-track conditions", err))
            // Once a load, after the sync has made or removed what it would: the effects made before
            // 1.2.101 put on the states' own icons (E24 C1c).
            .then(() => reimageStates())
            .catch(err => error("Could not put the states' own icons on their effects", err));
    });
}

/**
 * Health and Sanity writes, and since E15 C4 the two flags that take both states away: a death
 * published (`deceased`) and a Monocub made (`monocub`), see `heldNone`.
 *
 * A FLAG TAKEN AWAY IS A CHANGE TOO (E15 part 1 fix e1-G3, 25.10.2026; finding E15p1-END-3). A
 * revive (death.mjs `reviveCharacter`, the season reset's revive-all) unsets `deceased`, and the
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
function namesFlag(changes, key) {
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
 *
 * KEPT, TOLD AND GIVEN BACK (E20 C6, 30.10.2026; S03-37). The two values it found are kept before the write
 * (enforced.mjs `keepOriginal`), the GMs are told in the chat, not the log alone, and a GM's Give back Foundry's
 * settings writes them back (`giveBackAutomation`) and stops this until a GM holds them again. Exported for the
 * switch's re-hold and E20-T4.
 */
export async function suppressSystemAutomation({ actors = game.actors } = {}) {
    if (!game.user.isGM || foundryGivenBack()) return false;

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
        await keepOriginal("automation", automationOriginal(current));
        await game.settings.set(DH, AUTOMATION, {
            ...current,
            vulnerableAutomation: false,
            defeated: { ...(current.defeated ?? {}), enabled: false }
        });
        log("Switched off Daggerheart's Vulnerable and Defeated automations; "
            + "Breakdown and Wounded replace them.");
        // What the automations already put on the sheets goes with them, once (E24 C3b; `clearAllSystemConditions`).
        await clearAllSystemConditions({ actors });
        await whisperToGms(`<p>${game.i18n.localize("DRPG.GiveBack.automationOff")}</p>`);
        return true;
    } catch (err) {
        error("Could not switch off Daggerheart's own full-track conditions", err);
        return false;
    }
}

/* Daggerheart's own initial values of the two fields (2.6.5's Automation.mjs `defineSchema`, as the harness copies
   it in lib/daggerheart.mjs `AUTOMATION_DEFAULT`; 2.10.x's not read here). Given back where nothing was kept: a world
   whose automations an earlier version switched off. */
const AUTOMATION_DEFAULTS = { vulnerableAutomation: true, defeated: true };

/** The two fields `suppressSystemAutomation` writes, as Daggerheart's setting holds them now. Pure. */
export function automationOriginal(current) {
    return { vulnerableAutomation: current?.vulnerableAutomation ?? null, defeated: current?.defeated?.enabled ?? null };
}

/** Daggerheart's setting with the two fields as `kept` has them (Daggerheart's defaults when nothing was kept); the rest as it is. Pure. */
export function automationGivenBack(current, kept) {
    const from = kept ?? AUTOMATION_DEFAULTS;
    const out = foundry.utils.deepClone(current ?? {});
    if (typeof from.vulnerableAutomation === "boolean") out.vulnerableAutomation = from.vulnerableAutomation;
    if (typeof from.defeated === "boolean") out.defeated = { ...(out.defeated ?? {}), enabled: from.defeated };
    return out;
}

/**
 * Give Daggerheart's two automations back (enforced.mjs `giveBackFoundry`); writes only what differs. Answers true when
 * it wrote, false when there was nothing to write (or no such setting), and null when the write was refused - so Give
 * back keeps the value for another try (E20 fix round, C-6).
 */
export async function giveBackAutomation(kept) {
    if (!game.user.isGM) return false;
    let automation;
    try { automation = game.settings.get(DH, AUTOMATION); } catch { return false; }
    const current = automation?.toObject?.() ?? foundry.utils.deepClone(automation ?? {});
    const back = automationGivenBack(current, kept);
    if (back.vulnerableAutomation === current.vulnerableAutomation && back.defeated?.enabled === current.defeated?.enabled) return false;
    try {
        await game.settings.set(DH, AUTOMATION, back);
        log("Gave Daggerheart's Vulnerable and Defeated automations back.");
        return true;
    } catch (err) {
        error("Could not give Daggerheart's own full-track conditions back", err);
        return null;
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

/*
 * ONCE, BY THE MIGRATION ALONE (E24 C3b, 08.11.2026; E24-25, audit S03-35; E24 fix G2A, review M1). `syncOnce` called
 * this on every Health and Sanity write, so an Unconscious a GM put on a student by hand went at the next write to
 * either track. C3b kept it on every primary-GM `ready` instead, and once the automations are off - every world after
 * its first load - the migration switches nothing, so each reload took the GM's Unconscious and Defeated all the same
 * (R1496, red on 52955be4 with the ready step lifted out unchanged). The markers it is for are the automations'
 * leftovers, and those stop arriving once the automations are off: cleared only by the migration that switches them
 * off (`suppressSystemAutomation`, which a GM's re-hold also runs), every student but a Monokuma, as `syncStates`
 * reads them. No pass for worlds switched off before 1.2.101: every release before it ran this on each write to either
 * track, so a leftover there outlived only a student whose tracks nobody has written since. Returns how many effects
 * went. Exported, with `actors` a stand-in world, for R1496.
 */
export async function clearAllSystemConditions({ actors = game.actors } = {}) {
    if (!isPrimaryGm()) return 0;
    let cleared = 0;
    for (const actor of actors ?? []) {
        if (actor?.type !== "character" || isMonokuma(actor)) continue;
        cleared += await clearSystemConditions(actor);
    }
    if (cleared) log(`Cleared ${cleared} of Daggerheart's own condition(s) left from before this module took over.`);
    return cleared;
}

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

/**
 * Whether `actor` is in `state` (one of `STATES`) as the rule has it, the reading `syncOnce` writes the status from:
 * the sheet's state badges read it (sheet-sidebar.mjs `paintStateBadges`, E95 C5), so a sheet drawn before the status lands
 * says what the reserves already say.
 */
export function stateHeld(actor, state) {
    // A Monokuma is skipped outright by `syncStates` (below), whatever its marks say, so its sheet draws no badge either
    // (E95 C5 fix: with Health and Sanity marked through, the badge row showed both on a Monokuma, a status it never gets).
    return Boolean(state) && !isMonokuma(actor) && shouldHave(actor, state);
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

/**
 * Bring one character's two conditions into line with their tracks.
 *
 * A Monokuma is skipped outright: they have no action economy to lose and no
 * Hope to spend, and `setMonokuma` zeroes both tracks on purpose - which would
 * otherwise light up both states permanently on every GM's own sheet.
 */
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

/**
 * The primary GM's ready step for the full-track conditions: the migration (`suppress`), which clears Daggerheart's
 * leftovers with `actors` only on the load it switches the automations off, then the one-off sync. Clears nothing
 * itself: a GM's own Unconscious and Defeated stay through every reload (E24 fix G2A, review M1; E24-25). Answers
 * whether the migration switched them off; false on any browser but the primary GM's. `actors`, `suppress` and `sync`
 * handed in by R1496's stand-in world.
 */
export async function takeOverConditions({ actors = game.actors, suppress = suppressSystemAutomation, sync = syncAll } = {}) {
    if (!isPrimaryGm()) return false;
    const switched = await suppress({ actors });
    await sync();
    return switched;
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

/* ==========================================================================
 * WHAT A TOKEN SHOWS OF HEALTH AND SANITY (E24 C1b, 08.11.2026)
 * --------------------------------------------------------------------------
 * Two of Foundry's drawings carry a student's reserves to every client's canvas,
 * and both said what no other view the module draws says any more.
 *
 * THE BARS. Daggerheart 2.10.5 points bar 1 at `resources.hitPoints` and bar 2 at
 * `resources.stress` (system.json), and its `Token#_drawBar` (module/canvas/
 * placeables/token.mjs) draws one section a point of `data.max` and fills
 * `ceil(data.value)` of them, `data` being Foundry's `TokenDocument#getBarAttribute`:
 * the marks, so a full bar was the wound (audit S12-36), and bar 2 showed another
 * player the Sanity the sheet now keeps from them. The attribute is wrapped (a row
 * of patches.mjs, `token-bars-reserve`): for a character's two reserves (a student's, and
 * since E24 fix G2A a Monokuma's and an NPC's, `reserveCharacter`) it answers what
 * is left of what maximum, and `editable: false`, which takes the token HUD's two
 * inputs off for everybody on a character (tokenHUD.hbs disables an input whose
 * attribute is not editable) - a number typed there would be written to the marks as
 * if it were the reserve. A GM edits on the sheet. Sanity answers null to a user
 * `reserveView` does not show it to: Foundry draws no bar for null. Read on Foundry's
 * v13 behaviour as recalled (no v14 source on this machine): the HUD and `drawBars`
 * both ask `getBarAttribute`, and `Actor#modifyTokenAttribute` reads the system data
 * itself. A table's check (E24's live row of the token bars, AUDIT 9.2).
 *
 * THE STATE ICONS ARE NOT ON THE TOKEN (E95 C5, 10.11.2026; the owner's "ikony breakdown i
 * wounded nie wyswietlaly sie na tokenie na mapie wcale - TYLKO na karcie postaci").
 * `syncOnce` puts Breakdown and Wounded on with `toggleStatusEffect`, and Daggerheart's
 * `_drawEffects` draws each status's icon on every client's token. Its
 * `_drawEffect(src, tint, effect)` is wrapped (row `state-icons-off-token`, an override
 * of Daggerheart's): the icon of a `drpgBreakdown` or `drpgWounded` effect is drawn for
 * nobody - a GM, the owner, another player, an Observer - on any character. From E24 C1b
 * (08.11) to E95 C4 the wrapper hid Breakdown only from a user who may not read the
 * Sanity and drew Wounded for all. The sheet says both instead, to every reader
 * (sheet-sidebar.mjs `paintStateBadges`). A view on this browser, not a data change: the
 * statuses stay on the actor every client holds, every rule reads them as before, and a
 * console reads them. The token HUD's status palette lists statuses, not the token's
 * drawn icons, and is not changed. A table's check (LIVE-E95-05, AUDIT 9.2).
 * ========================================================================== */

/*
 * ONE MEANING, THE SHEET'S (E24 fix G2A, 08.11.2026; review m4). The token's reserves are every character's, as the
 * sheet's: `paintReserves` draws "n / max" ("Left: n / max" until 1.2.102) and hides Sanity on any character's sheet, a Monokuma's and an NPC's
 * not in the class among them, while this asked for a student alone, so an NPC that had taken 3 of 4 Health read
 * "Left: 1 / 4" on its sheet beside a token bar 3/4 full, and its Sanity bar and Breakdown icon (`syncStates` still
 * gives an NPC Breakdown) showed to every player. Now its bars are the reserve, its Sanity bar (and, until E95 C5 took
 * both state icons off every token, its Breakdown icon) the owner's and the GMs', and its HUD inputs off as a student's
 * are (R1447, R1485; red on 52955be4: as Foundry's).
 */
/** A character, for the token's reserves: a student, a Monokuma or an NPC not in the class alike. */
function reserveCharacter(actor) {
    return actor?.type === "character";
}

/**
 * Foundry's bar answer `data` for `doc`, as `user` reads it: a character's Health or Sanity bar as its reserve - `value`
 * what is left, `max` its maximum, not editable - or null for a Sanity `user` may not see; anything else as Foundry
 * answered it. Exported for R1447 and E24-T1.
 */
export function reserveBar(doc, data, user = game.user) {
    if (!data || data.type !== "bar") return data;
    const key = Object.keys(RESERVES).find(k => data.attribute === `resources.${k}`);
    if (!key || !reserveCharacter(doc?.actor)) return data;
    const view = reserveView(doc.actor, key, user);
    if (!view.shown) return null;
    return { ...data, value: view.left, max: view.max, editable: false };
}

/** Wrap `proto.getBarAttribute` with `reserveBar`, marked so a second call stacks nothing. Exported for R1447. */
export function wrapBarAttribute(proto) {
    const original = proto?.getBarAttribute;
    if (typeof original !== "function" || original[RESERVE_BARS]) return false;
    function drpgReserveBars(...args) {
        return reserveBar(this, original.apply(this, args));
    }
    drpgReserveBars[RESERVE_BARS] = true;
    drpgReserveBars.original = original;
    proto.getBarAttribute = drpgReserveBars;
    return true;
}
const RESERVE_BARS = Symbol.for("drpgReserveBars");

/* The prototype that owns `getBarAttribute`, from the token document class up: Foundry's TokenDocument at a table. */
function installReserveBars() {
    let proto = (CONFIG.Token?.documentClass ?? foundry.documents?.TokenDocument)?.prototype ?? null;
    while (proto && proto !== Object.prototype && !Object.hasOwn(proto, "getBarAttribute")) proto = Object.getPrototypeOf(proto);
    if (!proto || proto === Object.prototype) {
        error("Could not find the token bars' attribute - a student's bars fill up as they are hurt, as Daggerheart draws them");
        return false;
    }
    return wrapBarAttribute(proto);
}

/** The statuses whose icon no token draws (E95 C5): Breakdown and Wounded. */
const OFF_TOKEN = Object.freeze([STATES.breakdown, STATES.wounded]);

/**
 * Whether `user` is shown the icon of `effect` on `actor`'s token: never an effect holding Breakdown or Wounded, for
 * any user on any actor (E95 C5; the old effects `reimageStates` reimaged and one still on Foundry's core image are
 * matched by the status, not the image); every other icon, the dead overlay among them, as Foundry draws it. `actor`
 * and `user` stay in the signature for the callers and R1485, which hands each reader. Exported for R1485.
 */
export function effectIconShown(actor, effect, user = game.user) {
    return !OFF_TOKEN.some(state => effect?.statuses?.has?.(state.id));
}

/**
 * Wrap `proto._drawEffect(src, tint, effect)` (Daggerheart 2.10.5's token hands it each icon's effect): an icon
 * `effectIconShown` refuses is not drawn, answered as a draw with nothing to draw (a settled null, which its
 * `_drawEffects` and `_drawOverlay` read as no icon). An effect it is not handed is matched by its image, Breakdown's
 * or Wounded's, on an actor that holds that status. Marked so a second call stacks nothing. Exported for R1485.
 */
export function wrapEffectIcons(proto) {
    const original = proto?._drawEffect;
    if (typeof original !== "function" || original[BREAKDOWN_ICON]) return false;
    function drpgBreakdownIcon(src, tint, effect, ...rest) {
        const shown = effect
            ? effectIconShown(this.actor, effect)
            : !OFF_TOKEN.some(state => src === state.img && this.actor?.statuses?.has?.(state.id));
        if (!shown) return Promise.resolve(null);
        return original.call(this, src, tint, effect, ...rest);
    }
    drpgBreakdownIcon[BREAKDOWN_ICON] = true;
    drpgBreakdownIcon.original = original;
    proto._drawEffect = drpgBreakdownIcon;
    return true;
}
const BREAKDOWN_ICON = Symbol.for("drpgBreakdownIcon");

/* On the token class this world draws with: never on a class that is no Foundry Token (the harness's is Object). */
function installEffectIcons() {
    const proto = CONFIG.Token?.objectClass?.prototype ?? null;
    if (!proto || proto === Object.prototype || typeof proto._drawEffect !== "function") {
        debug("No token class drawing effect icons here - Breakdown's and Wounded's icons are drawn as Foundry draws them");
        return false;
    }
    return wrapEffectIcons(proto);
}

/* ==========================================================================
 * THE STATES' OWN ICONS (E24 C1c, 08.11.2026; STAGE.md "Amend 08.11" A3, Q-E24-7)
 * --------------------------------------------------------------------------
 * Breakdown and Wounded wear the module's pixel art since 1.2.101 (config.mjs
 * `STATES`, R1487). `toggleStatusEffect` makes an effect from the status's entry
 * in `CONFIG.statusEffects` with the image the entry has at that moment, and the
 * effect keeps it, so a world played before holds its Breakdown and Wounded
 * effects in Foundry's core painted icons while new ones wear ours. The primary
 * GM's ready step (`reimageStates`) sets the new image on those two statuses'
 * effects on the world's actors: once a load, a no-op once they carry it, and
 * on no effect of another status - a dead overlay keeps the image it was made
 * with. A primary-GM write, so this part is MARKED (R1488's mutants: the step on
 * a non-primary, an effect of another status touched). Not reached: an unlinked
 * token's own actor (its delta's effects); the module's students are linked.
 *
 * The dead status is Daggerheart's (its defeated condition), made at its setup
 * from the Automation setting's `defeated.deadIcon`. `ownDeadIcon` puts the
 * module's skull on that entry only while the setting is Daggerheart's default
 * (config.mjs `DEAD_ICON.daggerheart`), so a GM who chose their own keeps it (the
 * owner's default for Q-E24-7). A row of patches.mjs, `dead-icon-own`.
 * ========================================================================== */

/** Daggerheart's Automation setting, or null where it cannot be read. */
function automationSetting() {
    try { return game.settings.get(DH, AUTOMATION) ?? null; } catch { return null; }
}

/**
 * Put the module's dead icon on the `dead` entry of `effects` (CONFIG.statusEffects) when `automation`'s
 * `defeated.deadIcon` is Daggerheart's default, and a GM's own icon back on an entry that wears ours when it is not.
 * True when it changed the entry; false for an unreadable setting, no entry, or one already as the setting says.
 * Exported for R1488.
 */
export function ownDeadIcon(effects, automation) {
    const icon = automation?.defeated?.deadIcon;
    const dead = (effects ?? []).find(entry => entry?.id === "dead");
    if (typeof icon !== "string" || !icon || !dead) return false;
    const img = icon === DEAD_ICON.daggerheart ? DEAD_ICON.img : (dead.img === DEAD_ICON.img ? icon : dead.img);
    if (dead.img === img) return false;
    dead.img = img;
    return true;
}

/*
 * A GM'S CHANGE MID-SESSION (E24 fix G2A, 08.11.2026; review n2). Daggerheart reads `defeated.deadIcon` into the dead
 * entry at its setup only (2.10.11 daggerheart.mjs's setup hook builds `CONFIG.statusEffects` from
 * `defeatedConditions()`; the setting's onChange, `DhAutomation#handleChange`, only stores the new value), so
 * `ownDeadIcon` at setup alone left a GM who set the icon back to its default during a session on the old icon until
 * a reload. Each client hears the setting's write (`updateSetting`) and puts the entry as the setting now says: ours
 * at the default, the GM's own in place of ours. Effects already made keep the image they were made with. The hook
 * and `Setting#key` as Foundry v13 has them, not read on v14's source (LIVE-E24-13). Exported, with `effects` and `automation`
 * handed in, for R1488.
 */
export function automationChanged(setting, effects = CONFIG.statusEffects, automation = automationSetting()) {
    if (setting?.key !== `${DH}.${AUTOMATION}`) return false;
    return ownDeadIcon(effects, automation);
}

/**
 * Set each Breakdown and Wounded effect on `actors` to its state's own image, one update per actor that has one
 * on another image. Only the primary GM writes: this browser a GM's, and `user` (standing for this browser's
 * user, a stand-in in R1488) the primary; anybody else's call answers 0. Returns how many effects it wrote. Exported for R1488.
 */
export async function reimageStates({ actors = game.actors, user = game.user } = {}) {
    // A GM's browser (the census's gate, R220), and `user` the primary.
    if (!game.user?.isGM || !user?.isGM || !user.id || primaryGmId() !== user.id) return 0;
    const images = Object.values(STATES).map(state => [state.id, state.img]);
    let written = 0;
    for (const actor of actors ?? []) {
        const updates = [];
        for (const effect of actor?.effects ?? []) {
            const img = images.find(([id]) => effect?.statuses?.has?.(id))?.[1];
            if (img && effect.img !== img) updates.push({ _id: effect.id, img });
        }
        if (!updates.length) continue;
        try {
            await actor.updateEmbeddedDocuments("ActiveEffect", updates);
            written += updates.length;
        } catch (err) {
            error(`Could not put the states' own icons on ${actor?.name ?? actor?.id}`, err);
        }
    }
    if (written) log(`Put the Breakdown and Wounded icons on ${written} effect(s) made before them.`);
    return written;
}
