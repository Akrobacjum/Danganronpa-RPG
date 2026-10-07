/*
 * DAGGERHEART'S OWN CODE, copied VERBATIM for the headless harness (E33 C2a; the owner's decision P6
 * of 06.10.2026: Daggerheart's dice classes run in the harness, as its GM relay does in dh-relay.mjs).
 *
 * Source: Foundryborne Daggerheart, tag 2.10.5 (commit 6bf4b69f98), module/dice/die/dualityDie.mjs - the whole file
 * (38 lines). Everything after this comment and the one blank line under it is that file byte for
 * byte, its imports included. An import that leaves module/dice/ lands on the harness's glue at the
 * same relative path under lib/dh-dice/ (applications/, helpers/, data/), which says it is not
 * Daggerheart's; audit/harness/README.md ("Daggerheart's dice") names the boundary.
 *
 * Re-copy it on an upgrade; never edit it. A model of this file could be wrong in the module's
 * favour - the reason it is the file itself.
 *
 * MIT License, Copyright (c) 2025 WBHarry. The notice in full: lib/dh-dice/LICENSE.
 */

import { updateResourcesForDualityReroll } from '../helpers.mjs';
import BaseDie from './baseDie.mjs';

export default class DualityDie extends BaseDie {
    get isRerolled() {
        return this.results.some(x => x.rerolled);
    }

    #getDualityState(roll) {
        if (!roll) return null;
        return roll.withHope ? 1 : roll.withFear ? -1 : 0;
    }

    async reroll(modifier, options) {
        const oldDuality = this.#getDualityState(options.liveRoll.roll);
        await super.reroll(modifier, options);

        if (options?.liveRoll) {
            if (game.dice3d) {
                const diceSoNiceRoll = {
                    _evaluated: true,
                    dice: [this]
                };

                diceSoNiceRoll.dice[0].results = diceSoNiceRoll.dice[0].results.filter(x => x.active);
                await game.dice3d.showForRoll(diceSoNiceRoll, game.user, true);
            } else {
                foundry.audio.AudioHelper.play({ src: CONFIG.sounds.dice });
            }

            await options.liveRoll.roll._evaluate();
            if (options.liveRoll.isReaction) return;

            const newDuality = this.#getDualityState(options.liveRoll.roll);
            updateResourcesForDualityReroll(oldDuality, newDuality, options.liveRoll.actor);
        }
    }
}
