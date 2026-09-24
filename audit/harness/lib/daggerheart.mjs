/**
 * Daggerheart's roll-to-resources step, as the harness models it (E30,
 * 24.09.2026; the E30 design's G1-G8 and G10).
 *
 * Read off the Daggerheart source in the scratchpad, 2.6.5 (the version
 * module.json is verified on), and checked against 2.10.5 where it matters:
 *   - actor.mjs `rollTrait`: an action unless the options say otherwise, the
 *     options spread last; `diceRoll` stamps `config.source.actor`,
 *     `config.data` and a fresh ResourceUpdateMap before the roll is built;
 *   - dualityRoll.mjs `buildPost`: the chat card first, then `dualityUpdate`,
 *     whose resource step is `addDualityResourceUpdates` below;
 *   - baseAction.mjs `ResourceUpdateMap`, copied: a batch with a keyless entry
 *     is dropped whole, `clear` replaces an entry, anything else adds onto it,
 *     and applying the map does not empty it;
 *   - Automation.mjs: the setting's default, every field at its `initial`,
 *     taken by evaluating 2.6.5's own schema (both hopeFear flags are false);
 *   - resourceConfig.mjs: `CONFIG.DH.RESOURCE`, three tables of base, custom
 *     and all.
 * The roll itself is never committed by Daggerheart: `rollTrait` hands back the
 * map, and whoever asked commits it - the sheet's trait button
 * (character.mjs `#rollAttribute`) or this module's `commitResources`
 * (action-rolls.mjs). The harness's mock committed inside the roll and then
 * emptied the map, so a second commit did nothing.
 *
 * Not modelled: the roll's own hooks (preRoll, postRoll...), countdown ticks,
 * triggers and domain cards (`dualityUpdate`, `handleTriggers`), damage and
 * armor. `writeResources` stands in for the actor's `modifyResource`, which
 * the next commit of E30 models (C9b, the relay for a player's writes).
 */

/** Daggerheart 2.6.5's Automation setting at its defaults (Automation.mjs `defineSchema`). */
export const AUTOMATION_DEFAULT = Object.freeze({
    summaryMessages: { damage: true, effects: true },
    hopeFear: { gm: false, players: false },
    vulnerableAutomation: true,
    countdownAutomation: true,
    levelupAuto: true,
    actionPoints: false,
    hordeDamage: true,
    effects: { rangeDependent: true },
    damageReductionRulesDefault: "onWithToggle",
    resourceScrollTexts: true,
    deathMoveAutomation: { avoidDeath: true, riskItAll: true, blazeOfGlory: true },
    defeated: {
        enabled: true, overlay: true, characterDefault: "deathMove", adversaryDefault: "dead", companionDefault: "defeated",
        deathMoveIcon: "icons/magic/life/heart-cross-purple-orange.webp",
        deadIcon: "icons/magic/death/grave-tombstone-glow-teal.webp",
        defeatedIcon: "icons/magic/control/fear-fright-mask-orange.webp",
        unconsciousIcon: "icons/magic/control/sleep-bubble-purple.webp"
    },
    roll: {
        roll: { gm: false, players: false },
        damage: { gm: "never", players: "never" },
        save: { gm: "never", players: "never" },
        damageApply: { gm: false, players: false },
        effect: { gm: false, players: false }
    },
    reload: "manual",
    autoExpireActiveEffects: true,
    triggers: { enabled: true }
});

/** `CONFIG.DH.RESOURCE` as resourceConfig.mjs builds it: base frozen, custom empty, all a copy of base. */
export function resourceTables() {
    const character = Object.freeze({
        hitPoints: { id: "hitPoints", initial: 0, max: 0, reverse: true, label: "DAGGERHEART.GENERAL.HitPoints.plural", maxLabel: "DAGGERHEART.ACTORS.Character.maxHPBonus" },
        stress: { id: "stress", initial: 0, max: 6, reverse: true, label: "DAGGERHEART.GENERAL.stress" },
        hope: { id: "hope", initial: 2, reverse: false, label: "DAGGERHEART.GENERAL.hope" }
    });
    const adversary = Object.freeze({
        hitPoints: { id: "hitPoints", initial: 0, max: 0, reverse: true, label: "DAGGERHEART.GENERAL.HitPoints.plural", maxLabel: "DAGGERHEART.ACTORS.Character.maxHPBonus" },
        stress: { id: "stress", initial: 0, max: 0, reverse: true, label: "DAGGERHEART.GENERAL.stress" }
    });
    const companion = Object.freeze({
        stress: { id: "stress", initial: 0, max: 3, reverse: true, label: "DAGGERHEART.GENERAL.stress" }
    });
    const table = base => ({ base, custom: {}, all: { ...base } });
    return { character: table(character), adversary: table(adversary), companion: table(companion) };
}

/** helpers/utils.mjs: the Hope and Fear gate. By default the players' flag decides, a GM's roll included. */
export function shouldUseHopeFearAutomation(options = { gmAsPlayer: true }) {
    const { hopeFear } = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Automation);
    return (!game.user.isGM || options.gmAsPlayer) ? hopeFear.players : hopeFear.gm;
}

/** baseAction.mjs, copied. */
export class ResourceUpdateMap extends Map {
    #actor;
    constructor(actor) {
        super();
        this.#actor = actor;
    }
    addResources(resources) {
        if (!resources?.length) return;
        const invalidResources = resources.some(resource => !resource.key);
        if (invalidResources) return;
        for (const resource of resources) {
            if (!resource.key) continue;
            const existing = this.get(resource.key);
            if (!existing || resource.clear) {
                this.set(resource.key, resource);
            } else if (!existing?.clear) {
                this.set(resource.key, { ...existing, value: existing.value + (resource.value ?? 0) });
            }
        }
    }
    #getResources() {
        return Array.from(this.values());
    }
    async updateResources() {
        if (this.#actor) {
            const target = this.#actor.system.partner ?? this.#actor;
            await writeResources(target, this.#getResources());
        }
    }
}

/** dualityRoll.mjs `addDualityResourceUpdates`, copied (2.6.5). */
export async function addDualityResourceUpdates(config) {
    if (!config.source?.actor || !shouldUseHopeFearAutomation() || config.actionType === "reaction" || config.skips?.resources) return;
    const actor = await fromUuid(config.source.actor);
    const updates = [];
    if (!actor) return;

    if (config.rerolledRoll) {
        if (config.roll.result.duality != config.rerolledRoll.result.duality) {
            const hope = (config.roll.isCritical || config.roll.result.duality === 1 ? 1 : 0)
                - (config.rerolledRoll.isCritical || config.rerolledRoll.result.duality === 1 ? 1 : 0);
            const stress = (config.roll.isCritical ? 1 : 0) - (config.rerolledRoll.isCritical ? 1 : 0);
            const fear = (config.roll.result.duality === -1 ? 1 : 0) - (config.rerolledRoll.result.duality === -1 ? 1 : 0);
            if (hope !== 0) updates.push({ key: "hope", value: hope, enabled: true });
            if (stress !== 0) updates.push({ key: "stress", value: -1 * stress, enabled: true });
            if (fear !== 0) updates.push({ key: "fear", value: fear, enabled: true });
        }
    } else {
        if (config.roll.isCritical || config.roll.result.duality === 1) updates.push({ key: "hope", value: 1, enabled: true });
        if (config.roll.isCritical) updates.push({ key: "stress", value: -1, enabled: true });
        if (config.roll.result.duality === -1) updates.push({ key: "fear", value: 1, enabled: true });
    }

    if (updates.length && !["dead", "defeated", "unconscious"].some(x => actor.statuses.has(x))) {
        config.resourceUpdates.addResources(updates);
    }
}

/**
 * The harness's stand-in for the actor's `modifyResource` (actor.mjs): its
 * arithmetic - a Stress past its maximum turns into one Hit Point, `clear`
 * empties, each value is held between 0 and its maximum - written straight to
 * the actor and waited for. Fear, armour and item costs are not written: in
 * Daggerheart a player's go through the GM relay, which this commit does not
 * model (C9b does, with `modifyResource` itself).
 */
async function writeResources(actor, resources) {
    if (!resources?.length) return;
    if (resources.find(r => r.key === "stress")) convertStressDamageToHP(actor, resources);
    const changes = {};
    for (const r of resources) {
        if (r.itemId || r.key === "fear" || r.key === "armor") continue;
        const base = actor.system.resources?.[r.key];
        if (!base) continue;
        const value = r.clear ? (base.max && base.inverted ? base.max : 0) : (base.value ?? base) + r.value;
        changes[`system.resources.${r.key}.value`] = Math.max(Math.min(value, base.max), 0);
    }
    if (Object.keys(changes).length) await actor.update(changes);
}

/** actor.mjs, copied: Stress past its maximum is a Hit Point instead. */
function convertStressDamageToHP(actor, resources) {
    const stressDamage = resources.find(r => r.key === "stress");
    const newValue = actor.system.resources.stress.value + stressDamage.value;
    if (newValue <= actor.system.resources.stress.max) return;
    const hpDamage = resources.find(r => r.key === "hitPoints");
    if (hpDamage) hpDamage.value++;
    else resources.push({ key: "hitPoints", value: 1 });
}
