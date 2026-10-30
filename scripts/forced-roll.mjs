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
 * lands on 12 by itself. Which way the roll goes is that other die's: a loaded
 * Hope die is a roll with Hope (or a critical), a loaded Fear die one with
 * Despair (or a critical) - since D16 (below) the coin decides, not the order.
 * A die whose faces do not come from the randomiser is not loaded at all, and
 * the roll does not read as a Free Critical (`loadedDieHeld`, E16 part 2 C5).
 *
 * AND WHICH ONE AT RANDOM (D16, the owner's option 1: the Loaded Die sets a random die;
 * audit S09-08, E15 C5, 25.10.2026). Until C5 it was always the first die the
 * randomiser served, and Daggerheart throws the Hope die first (dualityRoll.mjs
 * `createBaseDice`: terms[0] Hope, terms[2] Fear) - so every loaded roll was
 * "with Hope" (measured at 3e5d1f6d by tier 2's E15-T7: twenty loaded rolls,
 * twenty Hope 12s): the audit's reading is that it gave a Hope back (the Call
 * cost 5, not 6) and never fed a Monokuma's pool. Now a coin is tossed before the throw, Hope or Fear, and
 * the die it names is the one set to 12; the roll says which on its options
 * (`LOADED_AT`), so a reader after it (E16 part 2's S02-44) knows which face
 * was forced without guessing from the totals.
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

import { debug, error, markFired } from "./utils.mjs";

/**
 * The roll config key that says "this is the roll the Loaded Die was bought for".
 *
 * ON THE ROLL, NOT ON THE CLIENT (review of CALL-03, 17.09). This used to be a
 * module-level `armed` flag set before the action's roll window opened, and the
 * hook loaded the first duality roll configured on the client while it was up -
 * so a statistic rolled off the sheet with the action window still open took the
 * 12, the Call stayed bought, and the action got an honest roll. `throwDice`
 * puts this key on its own `rollTrait` config; the hook, the red roll window and
 * the close hook that spends the Call all read the same key.
 */
export const LOADED_DIE = "drpgLoadedDie";

/*
 * Which die the Loaded Die set to 12, on the roll's options: "hope" or "fear", written as the
 * die is loaded and before the throw (`loadDie`). It names no character - it is one of two
 * words - so the neutral roll a message keeps (private-rolls.mjs `neutralRollOf`) leaves it,
 * where the mark above, a nonce the character's flag holds, is dropped.
 */
export const LOADED_AT = "drpgLoadedAt";

/** The die `roll` was loaded on, "hope" or "fear", or null for a roll nothing loaded. */
export function loadedAtOf(roll) {
    const at = roll?.options?.[LOADED_AT];
    return at === "hope" || at === "fear" ? at : null;
}

/**
 * WHETHER THE LOADED DIE HELD on a roll this browser threw (E16 part 2 C5, 26.10.2026; audit S02-44). The die is
 * loaded by answering its draw from `CONFIG.Dice.randomUniform`; a d12 whose faces come from elsewhere - a method
 * other than the default chosen in Foundry's Configure Dice, which draws no uniform sample - shows an honest face,
 * and the roll still read as a Free Critical: "freeCritUsed" whispered and the outcome marked, for dice nobody
 * loaded. `result` is what Daggerheart's `rollTrait` answers - its config, which the Roll it built keeps as its
 * `options` (dhRoll.mjs `createRollInstance`), so the die `loadDie` named is on it - with the faces on its `roll`
 * (`hope` and `fear`, `{ dice: "d12", value }`, dualityRoll.mjs `buildEvaluate`). Held: the named die shows its top
 * face; with no die named (a Daggerheart whose roll keeps other options), either die. Read on the harness's dice
 * (tier 2's E16-T35, a die method that ignores the sample); a table's Configure Dice is LIVE-E16-06.
 */
export function loadedDieHeld(result) {
    const at = loadedAtOf(result) ?? loadedAtOf({ options: result }) ?? loadedAtOf(result?.roll);
    const faces = result?.roll ?? result;
    const top = side => {
        const die = faces?.[side];
        const most = Number(String(die?.dice ?? "d12").replace(/^d/, "")) || 12;
        return Number(die?.value) === most;
    };
    return (at ? [at] : ["hope", "fear"]).some(top);
}

/*
 * AND ONCE PER PURCHASE (review, 17.09). The mark is the Call's own nonce, and a
 * nonce that has loaded a die is remembered here: two action windows opened while
 * one Loaded Die was held both carry it, and without this both came up 12 for
 * one purchase. The first to throw takes it; the other is an honest roll. Each
 * purchase has a new nonce, so the set never has to be cleared.
 */
const spent = new Set();

/*
 * The draw each die takes from the randomiser, in the order Daggerheart builds them: the Hope
 * die first, the Fear die second, an advantage die after both (dualityRoll.mjs `createBaseDice`,
 * 2.10.5 as copied in audit/harness/lib/dh-dice). Read in the source, not on a real v14 table.
 */
const DRAW_OF = Object.freeze({ hope: 0, fear: 1 });

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
const LOADED = 1;

export function registerForcedRolls() {
    // Marked first (E52-09; patches.mjs's hook row): the contract reads whether Daggerheart still fires it.
    Hooks.on("daggerheart.postDualityRollConfiguration", (roll, config) => {
        markFired("daggerheart.postDualityRollConfiguration");
        onConfigured(roll, config);
    });
}

/**
 * The hook's first argument is the Roll about to be thrown. Its `evaluate` is
 * shadowed on the instance - an own property over the prototype's method,
 * the same shape sheet.mjs uses for `render` - so the loaded randomiser exists
 * for exactly as long as this one roll is being evaluated.
 *
 * A roll the GM draws is not loaded here (E08+E28 C12b): the roller's copy only
 * plays back the faces the GM threw, and the GM loads the die on its own throw
 * where the character's armed Calls hold this mark (roll-draw.mjs `drawOnGm`).
 */
function onConfigured(roll, config) {
    if (!drawnByGm(config)) loadDie(roll, config?.[LOADED_DIE]);
}

/*
 * Whether the GM draws a roll is roll-draw.mjs's to say (`drawnByGm` there), and it says so
 * at setup through `standAsideFor` rather than being imported here: roll-draw.mjs imports this
 * file, and so do private-rolls.mjs and action-rolls.mjs, which roll-draw.mjs imports too - an
 * import back closed the cycle R161 refuses (C12b's first suite run, 04.10.2026). Until it is
 * told, no roll is the GM's, as with no seam.
 */
let drawnByGm = () => false;

/** roll-draw.mjs's `drawnByGm`, handed over by `registerRollDraw`. */
export function standAsideFor(predicate) {
    if (typeof predicate === "function") drawnByGm = predicate;
}

/**
 * Load one of the two dice `roll` throws, Hope or Fear at random, once per `mark`. The configuration hook's on this
 * client; and the primary GM's for a player's roll it draws (roll-draw.mjs `drawOnGm`,
 * E08+E28 C12a), where the roll the GM throws is not the one the roller's hook saw - which,
 * since C12b, loads nothing (`onConfigured`).
 */
export function loadDie(roll, mark) {
    if (!mark || spent.has(mark)) return;
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
            // Claimed at the throw, not at configuration: a window that is
            // configured and then abandoned must not use the purchase up.
            if (spent.has(mark)) {
                delete this.evaluate;
                return evaluate.apply(this, args);
            }
            spent.add(mark);
            const real = CONFIG.Dice.randomUniform;
            // The coin is tossed here, before the throw, and from Math.random rather than
            // the dice's own randomiser: a draw taken from `randomUniform` would be one the
            // dice never see, and a scripted randomiser (the harness's faces) would hand its
            // first face to the coin instead of a die.
            const at = Math.random() < 0.5 ? "hope" : "fear";
            if (this.options && typeof this.options === "object") this.options[LOADED_AT] = at;
            let draw = 0, left = LOADED;
            // Counted rather than flagged: `randomUniform` is called once per die and
            // knows nothing about which die it is serving, so the draw's place in the
            // order is the only handle there is. Every other draw rolls for real.
            CONFIG.Dice.randomUniform = () => {
                const here = draw++;
                if (left > 0 && here === DRAW_OF[at]) {
                    left -= 1;
                    return 0;
                }
                return real();
            };
            debug(`Free Critical: the ${at === "hope" ? "Hope" : "Fear"} die forced to its maximum face.`);
            try {
                return await evaluate.apply(this, args);
            } finally {
                CONFIG.Dice.randomUniform = real;
                // Spent on this roll and no other: the wrapper goes too, so a
                // second evaluate of the same instance is an honest one.
                delete this.evaluate;
            }
        }
    });
}
