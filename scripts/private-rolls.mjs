/**
 * Danganronpa RPG — forced private rolls.
 * ---------------------------------------------------------------------------
 * In a killing game nobody may read anyone else's dice. Every chat message a
 * player creates that carries a roll is rewritten into a whisper aimed at the
 * GMs plus the roller. The roller still sees their own result; nobody else
 * does. GM rolls are left alone.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { gmIds, error, debug } from "./utils.mjs";

export function registerPrivateRolls() {
    Hooks.on("preCreateChatMessage", onPreCreateChatMessage);
}

function onPreCreateChatMessage(message, data, options, userId) {
    try {
        if (!game.settings.get(MODULE_ID, SETTINGS.forcePrivateRolls)) return;

        // Foundry v12+ exposes the creating user as `author`.
        const authorId = message.author?.id ?? message.user?.id ?? userId;
        const author = game.users.get(authorId);
        if (!author || author.isGM) return;

        const hasRoll = (message.rolls?.length ?? 0) > 0
            || !!data?.roll
            || (data?.rolls?.length ?? 0) > 0;
        if (!hasRoll) return;

        // Already a whisper — respect whatever aimed it there.
        if (message.whisper?.length) return;

        const recipients = gmIds();
        if (!recipients.length) return;

        // Set the roll mode flag as well as the recipients. Modules that style
        // or animate rolls (Dice So Nice among them) read `core.rollMode`, and
        // a message whose recipients say "private" while its flag still says
        // "public" is an inconsistent state we should not create.
        message.updateSource({
            whisper: Array.from(new Set([...recipients, author.id])),
            blind: false,
            "flags.core.rollMode": CONST.DICE_ROLL_MODES.PRIVATE
        });
        debug("Rewrote a player roll into a private whisper.", author.name);
    } catch (err) {
        error("preCreateChatMessage failed", err);
    }
}
