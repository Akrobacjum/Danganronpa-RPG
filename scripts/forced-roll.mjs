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
 * The window between the two hooks contains exactly one `roll.evaluate()` and no
 * user interaction, so nothing else can slip through it.
 */

import { debug, error } from "./utils.mjs";

let armed = false;
let original = null;

/*
 * ILE KOSCI DOSTAJE SWOJA GORNA SCIANE.
 *
 * Bylo: wszystkie, wiec 12/12 - para, czyli krytyk wedlug definicji systemu.
 * Jest: jedna (Dawid, 31.08). Druga leci normalnie, wiec wynik jest bardzo
 * wysoki, ale krytykiem bywa tylko wtedy, gdy ta druga sama wyrzuci 12.
 *
 * To nie jest ostroznosc, tylko sedno oslabienia: krytyk otwiera darmowa akcje
 * rozwiazania, a Free Critical kupowany za Nadziej nagromadzona z Experience
 * dawal ofierze wyjscie z incydentu za nic. Jedna na dwanascie zostaje - i
 * dobrze, bo to jest wtedy prawdziwy rzut, a nie zakup.
 */
let loaded = 0;

export function registerForcedRolls() {
    Hooks.on("daggerheart.postDualityRollConfiguration", onConfigured);
    Hooks.on("daggerheart.postRollDuality", release);
    // Belt and braces: if the roll is abandoned between the two, the next
    // message *this user* creates must not inherit a rigged randomiser.
    //
    // Scoped to our own messages on purpose. `createChatMessage` fires on every
    // client for every message, so an unscoped release meant somebody else's
    // whisper landing in the window between configuration and evaluation quietly
    // disarmed a Free Critical the player had just paid 6 Hope for.
    Hooks.on("createChatMessage", message => {
        const authorId = message?.author?.id ?? message?.user?.id;
        if (authorId && authorId !== game.user.id) return;
        release();
    });
}

/** Arm the next duality roll so ONE die comes up 12 and the other is thrown. */
export function armOneMaximum() {
    armed = true;
    loaded = 1;
}

export function disarmMaximum() {
    armed = false;
    loaded = 0;
    release();
}

function onConfigured() {
    if (!armed || original) return;
    try {
        original = CONFIG.Dice.randomUniform;
        const real = original;
        // Counted down rather than flagged: `randomUniform` is called once per
        // die and knows nothing about which die it is serving, so "the first
        // one" is the only handle there is. Everything after it rolls for real.
        CONFIG.Dice.randomUniform = () => {
            if (loaded > 0) {
                loaded -= 1;
                return 0;
            }
            return real();
        };
        debug("Free Critical: one die forced to its maximum face.");
    } catch (err) {
        error("Could not force the Free Critical die", err);
        original = null;
    }
}

function release() {
    if (!original) return;
    CONFIG.Dice.randomUniform = original;
    original = null;
    armed = false;
    loaded = 0;
}
