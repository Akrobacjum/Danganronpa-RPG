/**
 * Danganronpa RPG - the module's marks on a roll's config, carried through Daggerheart 2.12's MoveContext.
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (E76b, 12.11.2026; the owner's yes of 12.11, relayed by the coordinator; R3604).
 *
 * The module hands Daggerheart's `actor.rollTrait` its own keys on the options - that the roll is an action's
 * (`drpgActionRoll`), the claim's nonce (`drpgRollNonce`), the Loaded Die (`drpgLoadedDie`), a statistic a GM picked
 * (`drpgTraitByGm`) - and the window's `dialog.configure`. Up to 2.10.x `rollTrait` spread the options onto the config
 * it built, so they reached `DualityRoll.build`, the window and the roll's own options. From 2.12 it builds a
 * `MoveContext` (actor.mjs:727-743, 2.12.8), whose constructor keeps only the properties it names (move-context.mjs:21-)
 * and sets `dialog` to {}: every one of the module's keys is gone. What it does keep is the caller's own event object
 * (`this.event ??= data.event`). So the module registers its marks against that object here (`carryMarks`), and puts
 * them back on the config where Daggerheart's build starts (`adoptMarks`): the GM draw's wrapper of `build` and the
 * `daggerheart.preRollDuality` hook, which `buildConfigure` calls before the window opens and the roll is made
 * (roll-draw.mjs). One object a roll, so two rolls in flight cannot take each other's marks.
 *
 * On 2.10.x the marks are on the config already and `adoptMarks` writes nothing over them. Where a MoveContext keeps
 * no event, nothing can be carried: roll-draw.mjs `seamFor` reads that build as "changed" (R3602). The second half of
 * the file puts a 2.12 roll's outcome where 2.10 wrote it (`fillRollFacts`). A leaf: no imports.
 */

/** The module's keys a roll's options carry, and so the only ones put back. */
const MARK_KEYS = ["drpgActionRoll", "drpgRollNonce", "drpgLoadedDie", "drpgTraitByGm"];

/** The marks each carried event holds, by the event object itself. */
const carried = new WeakMap();

/**
 * Register the marks `options` holds against its own `event` (made here when it has none), and answer the same
 * options: the keys stay on them for a Daggerheart that spreads them. `dialog.configure` is carried as asked.
 */
export function carryMarks(options = {}) {
    if (!options.event || typeof options.event !== "object") options.event = { shiftKey: false, altKey: false, ctrlKey: false };
    const marks = {};
    for (const key of MARK_KEYS) if (options[key] !== undefined) marks[key] = options[key];
    if (options.dialog && "configure" in options.dialog) marks.dialogConfigure = options.dialog.configure;
    if (Object.keys(marks).length) carried.set(options.event, marks);
    return options;
}

/**
 * Put the marks carried on `config.event` back on the config: a mark it has already stands, and the window's
 * configure is set as the module asked, as 2.10 let the module's own stand. Answers whether the event carried any.
 */
export function adoptMarks(config) {
    const event = config?.event;
    const marks = event && typeof event === "object" ? carried.get(event) : null;
    if (!marks) return false;
    for (const key of MARK_KEYS) if (marks[key] !== undefined && config[key] === undefined) config[key] = marks[key];
    if ("dialogConfigure" in marks) {
        if (!config.dialog || typeof config.dialog !== "object") config.dialog = {};
        config.dialog.configure = marks.dialogConfigure;
    }
    return true;
}

/*
 * THE ROLL'S OUTCOME WHERE THE MODULE READS IT (E76b, 12.11.2026; 40-flow's Sabotage whose tool breaks on the roll).
 * Up to 2.10 Daggerheart's `buildEvaluate` steps wrote a duality roll's outcome onto `config.roll`: its total, formula
 * and dice (dhRoll.mjs:88-101, 2.10.5), its Hope and Fear faces and its duality (dualityRoll.mjs:213-239), whether it
 * is a critical (d20Roll.mjs:180). The module's readers take it from there - the duality a tool wears on
 * (action-pipeline.mjs `dualityOf`), the bar on the card (action-report.mjs), the Loaded Die's face
 * (forced-roll.mjs). From 2.12 `config.roll` keeps only what the roll was asked to be, with its breakdown, and the
 * outcome is the Roll itself on `config.evaluated` (dhRoll.mjs:98-107, 2.12.8), whose getters answer the same facts. So
 * on a config with an evaluated roll each of those facts is written where 2.10 wrote it, only where it is missing: on
 * 2.10 nothing is written, and nothing 2.12 wrote is changed. Answers whether there was an evaluated roll to read.
 */
export function fillRollFacts(config) {
    const roll = config?.evaluated;
    const data = config?.roll;
    if (!roll || typeof roll.total !== "number" || !data || typeof data !== "object") return false;
    const put = (key, value) => { if (data[key] === undefined && value !== undefined) data[key] = value; };
    put("total", roll.total);
    put("formula", roll.formula);
    put("dice", (roll.dice ?? []).map(d => ({ dice: d.denomination, total: d.total, formula: d.formula, results: d.results })));
    put("isCritical", roll.isCritical);
    const face = die => (die ? {
        dice: die.denomination, value: die.total,
        rerolled: { any: (die.results ?? []).some(x => x.rerolled), rerolls: (die.results ?? []).filter(x => x.rerolled) }
    } : undefined);
    put("hope", face(roll.dHope));
    put("fear", face(roll.dFear));
    if (roll.dHope && roll.dFear) {
        put("result", { duality: roll.withHope ? 1 : roll.withFear ? -1 : 0, total: roll.dHope.total + roll.dFear.total, label: roll.totalLabel });
    }
    return true;
}
