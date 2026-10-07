/*
 * HARNESS GLUE, with two of Daggerheart's functions in it (E33 C2a, 07.10.2026). Daggerheart's
 * module/helpers/utils.mjs (2.10.5) is some nine hundred lines that import a tag library and the
 * system's config; the dice code copied beside this (lib/dh-dice/dice) imports four names from it.
 *   - `shouldUseHopeFearAutomation`: utils.mjs lines 815-818, copied verbatim.
 *   - `triggerChatRollFx`: utils.mjs lines 805-813, with one change, the harness's: Daggerheart asks
 *     `game.dice3d`, which a table has only with Dice So Nice on, and the harness's is always there, so
 *     the module's own state stands in for it - as the harness's roll asked before C2a.
 *   - `parseRallyDice` (:536-542) and `getAllResourceLabels` (:895-904) are not copied: the first runs
 *     only for a rally effect on the roll data's `parent`, which the harness's roll data has none of
 *     (lib/shim.mjs `getRollData`), the second only when a chat card is rendered by Daggerheart's own
 *     `render`, which the harness never calls. Each throws if that ever changes, rather than answer
 *     something Daggerheart would not.
 * Daggerheart's code is MIT License, Copyright (c) 2025 WBHarry: lib/dh-dice/LICENSE.
 */

export async function triggerChatRollFx(rolls, options = { whisper: false, blind: false }) {
    const { whisper, blind } = options;
    if (game.modules.get("dice-so-nice")?.active && game.dice3d) {
        const rerollPromises = rolls.map(roll => game.dice3d.showForRoll(roll, game.user, true, whisper, blind));
        await Promise.allSettled(rerollPromises);
    } else {
        foundry.audio.AudioHelper.play({ src: CONFIG.sounds.dice });
    }
}

export function shouldUseHopeFearAutomation(options = { gmAsPlayer: true }) {
    const { hopeFear } = game.system.settings.automation;
    return (!game.user.isGM || options.gmAsPlayer) ? hopeFear.players : hopeFear.gm; 
}

export function parseRallyDice() {
    throw new Error("harness: Daggerheart's parseRallyDice is not copied (lib/dh-dice/helpers/utils.mjs)");
}

export function getAllResourceLabels() {
    throw new Error("harness: Daggerheart's getAllResourceLabels is not copied (lib/dh-dice/helpers/utils.mjs)");
}
