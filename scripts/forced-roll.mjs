/**
 * Danganronpa RPG — the Free Critical's dice.
 * ---------------------------------------------------------------------------
 * The guide gives Free Critical as "no roll" — but a roll that never happens
 * leaves nothing on the table: no dice, no chat card, no Hope, and no way for
 * anyone else to see that it landed. So the dice are thrown for real and simply
 * told what to say: both d12s come up 12, which is 24 and, because the two dice
 * match, a critical by Daggerheart's own definition.
 *
 * Rather than editing the roll after the fact — which would fight the system's
 * message pipeline, Dice So Nice, and the reroll feature all at once — the die
 * randomiser is swapped for a constant while the roll evaluates. Foundry maps a
 * uniform sample with `ceil((1 - u) * faces)`, so u = 0 is always the top face,
 * whatever the die.
 *
 * The window between the two hooks contains exactly one `roll.evaluate()` and no
 * user interaction, so nothing else can slip through it.
 */

import { debug, error } from "./utils.mjs";

let armed = false;
let original = null;

export function registerForcedRolls() {
    Hooks.on("daggerheart.postDualityRollConfiguration", onConfigured);
    Hooks.on("daggerheart.postRollDuality", release);
    // Belt and braces: if the roll is abandoned between the two, the next
    // message created must not inherit a rigged randomiser.
    Hooks.on("createChatMessage", release);
}

/** Arm the next duality roll to come up 12 / 12. */
export function armMaximum() {
    armed = true;
}

/** True while a forced roll is pending. */
export function maximumArmed() {
    return armed;
}

export function disarmMaximum() {
    armed = false;
    release();
}

function onConfigured() {
    if (!armed || original) return;
    try {
        original = CONFIG.Dice.randomUniform;
        CONFIG.Dice.randomUniform = () => 0;
        debug("Free Critical: dice forced to their maximum face.");
    } catch (err) {
        error("Could not force the Free Critical dice", err);
        original = null;
    }
}

function release() {
    if (!original) return;
    CONFIG.Dice.randomUniform = original;
    original = null;
    armed = false;
}
