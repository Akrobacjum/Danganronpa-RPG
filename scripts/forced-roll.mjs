/**
 * Danganronpa RPG - the Free Critical's dice.
 * ---------------------------------------------------------------------------
 * The guide gives Free Critical as "no roll" - but a roll that never happens
 * leaves nothing on the table: no dice, no chat card, no Hope, and no way for
 * anyone else to see that it landed. So the dice are thrown for real and one of
 * them is told what to say.
 *
 * ONE DIE, NOT BOTH (Dawid, 31.08). Both of them coming up 12 is a pair, and a
 * pair is a critical by Daggerheart's own definition - which opens the free
 * resolution action, which is what made this Call the cheapest way out of an
 * incident anybody had. Now the loaded die guarantees a very high total and
 * nothing more; the other one is thrown, and a critical happens only when it
 * lands on 12 by itself.
 *
 * Rather than editing the roll after the fact - which would fight the system's
 * message pipeline, Dice So Nice, and the reroll feature all at once - the die
 * randomiser is swapped for a constant while the roll evaluates. Foundry maps a
 * uniform sample with `ceil((1 - u) * faces)`, so u = 0 is always the top face,
 * whatever the die.
 *
 * THIS ROLL'S EVALUATION AND NOTHING ELSE (audit A4). The swap used to sit on
 * `CONFIG.Dice.randomUniform` from the configuration hook until the next chat
 * message this client created, and the audit's worry was every other roll on
 * the client in between - a macro, a second character, a reroll. Daggerheart
 * 2.6.5 hands the configuration hook the unevaluated `Roll` itself (read from
 * `build` in its source: `buildConfigure` fires the hook with `roll`, then
 * `buildEvaluate` awaits `roll.evaluate()`), so the swap now lives on THAT
 * instance's own `evaluate`: installed before the throw, lifted in a `finally`
 * the moment the throw is over. A roll that is abandoned between the two takes
 * its wrapper to the grave with it, and no other roll ever sees a loaded die.
 * Dice evaluation is microtasks all the way down - no network, no dialog - so
 * nothing a person clicks can land inside the window that is left.
 */

import { debug, error } from "./utils.mjs";

let armed = false;

/*
 * HOW MANY DICE GET THEIR TOP FACE.
 *
 * It was all of them, so 12/12 - a pair, and a critical by the system's own
 * definition. It is one (Dawid, 31.08). The other is thrown as normal, so the
 * total is very high, but a critical only happens when that second die lands a
 * 12 on its own.
 *
 * That is not caution, it is the whole point of the weakening: a critical
 * opens the free resolution action, and a Free Critical bought with Hope saved
 * up from Experience gave the victim a way out of the incident for nothing.
 * One in twelve remains - and rightly, because then it is a real roll rather
 * than a purchase.
 */
let loaded = 0;

export function registerForcedRolls() {
    Hooks.on("daggerheart.postDualityRollConfiguration", onConfigured);
}

/** Arm the next duality roll so ONE die comes up 12 and the other is thrown. */
export function armOneMaximum() {
    armed = true;
    loaded = 1;
}

export function disarmMaximum() {
    armed = false;
    loaded = 0;
}

/**
 * The hook's first argument is the Roll about to be thrown. Its `evaluate` is
 * shadowed on the instance - an own property over the prototype's method,
 * the same shape sheet.mjs uses for `render` - so the loaded randomiser exists
 * for exactly as long as this one roll is being evaluated.
 */
function onConfigured(roll) {
    if (!armed) return;
    if (typeof roll?.evaluate !== "function") {
        // A Daggerheart that stopped passing the roll. Loud rather than silent:
        // the player paid for this, and "the die was not loaded" needs a reason.
        error("Free Critical: the roll configuration hook carried no roll - the die is not loaded");
        return;
    }

    const evaluate = roll.evaluate;
    Object.defineProperty(roll, "evaluate", {
        configurable: true,
        writable: true,
        value: async function (...args) {
            // Disarmed between configuration and the throw (the Call was
            // cancelled, say): an honest roll, and the wrapper is inert.
            if (!armed) return evaluate.apply(this, args);

            const real = CONFIG.Dice.randomUniform;
            let left = loaded;
            // Counted down rather than flagged: `randomUniform` is called once
            // per die and knows nothing about which die it is serving, so "the
            // first one" is the only handle there is. Everything after it
            // rolls for real.
            CONFIG.Dice.randomUniform = () => {
                if (left > 0) {
                    left -= 1;
                    return 0;
                }
                return real();
            };
            debug("Free Critical: one die forced to its maximum face.");
            try {
                return await evaluate.apply(this, args);
            } finally {
                CONFIG.Dice.randomUniform = real;
                // Spent on this roll and no other. Whatever happened inside the
                // throw, the next duality roll on this client is an honest one.
                armed = false;
                loaded = 0;
            }
        }
    });
}
