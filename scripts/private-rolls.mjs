/**
 * Danganronpa RPG — forced private rolls.
 * ---------------------------------------------------------------------------
 * In a killing game nobody may read anyone else's dice. Every chat message
 * carrying a roll is rewritten into a whisper, and WHO may read it is decided by
 * the actor the roll is about — not by whoever pressed the button:
 *
 *   a student    the GMs and that student's own player
 *   a Monocub    the above, plus everyone standing in the same room
 *   a Monokuma   the GMs, and nobody else
 *
 * Keying on the subject rather than the author is the correction this file most
 * needed. It used to return early for any GM-authored message, so a GM rolling
 * on behalf of a student — testing a template, covering an absent player,
 * driving Stage 4 — produced a fully public roll that the whole table read. That
 * is the one leak reported from an actual session.
 *
 * Incident rolls widen the audience deliberately; see `incidentAudience`.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { roomOfActor, occupantsOf } from "./movement.mjs";
import { gmIds, ownerOf, error, debug } from "./utils.mjs";

export function registerPrivateRolls() {
    Hooks.on("preCreateChatMessage", onPreCreateChatMessage);
    // `renderChatMessageHTML` and nothing else.
    //
    // The deprecated `renderChatMessage` was registered alongside it as a
    // "fallback", which is backwards: core fires the old hook only when it finds
    // a listener for it (`if ("renderChatMessage" in Hooks.events)`), so keeping
    // one here was not insurance — it was what made every single chat message
    // take the deprecated path, log a compatibility warning, wrap itself in
    // jQuery and run this handler twice. Removing it also removes the module
    // from the v15 removal path.
    //
    // Nothing is lost. `renderChatMessageHTML` fires on BOTH of the branches in
    // `ChatMessage#renderHTML` — the ordinary one and the early return for a
    // message type that renders itself — while the deprecated hook only ever
    // fired on the first. The old listener was strictly the smaller net.
    Hooks.on("renderChatMessageHTML", enforceContentVisibility);

    // The same hook, deliberately, and after the one above: a message this
    // client may not read is hidden first and never styled. See `paintRollCard`
    // for why the outcome colour cannot be a stylesheet rule.
    Hooks.on("renderChatMessageHTML", paintRollCard);
}

/**
 * Put the outcome colour on a duality roll — from script, because CSS cannot.
 *
 * The stylesheet has carried `border: 1px solid var(--drpg-gold) !important` for
 * Hope rolls since the palette work, and it has never once applied. Daggerheart
 * sets `border-style: none !important` on every chat message from `layer system`,
 * and for IMPORTANT declarations the cascade runs layers in reverse — the
 * earlier layer wins. Our `!important` sits in `layer modules`, which is later,
 * so it loses by rule rather than by specificity, and no selector this module
 * can write will change that. Measured on a real card: the dark background
 * landed (Daggerheart does not force `background-color`), the border computed to
 * `0px none`.
 *
 * An inline style is the one thing above an author `!important`, so the colour
 * goes on the element. The palette still lives in the stylesheet — the tokens
 * are read back off `:root` rather than repeated here, so changing the gold in
 * one place still changes it here.
 */
const OUTCOME_TOKEN = {
    critical: "--drpg-crimson",
    fear: "--drpg-blood",
    hope: "--drpg-gold"
};

function paintRollCard(message, element) {
    try {
        const html = element instanceof HTMLElement ? element : element?.[0];
        if (!html?.classList?.contains("duality")) return;
        // Hidden by the pass above: leave it exactly as it is.
        if (html.classList.contains("drpg-hidden-message")) return;

        // Critical first — a card carries `critical` alongside `hope` or `fear`,
        // and the rarest outcome is the one worth naming.
        const outcome = ["critical", "fear", "hope"].find(k => html.classList.contains(k));
        if (!outcome) return;

        const colour = getComputedStyle(document.documentElement)
            .getPropertyValue(OUTCOME_TOKEN[outcome]).trim();
        if (!colour) return;

        html.style.setProperty("border", `1px solid ${colour}`, "important");
        html.style.setProperty("border-left", `3px solid ${colour}`, "important");
    } catch (err) {
        // A card without its border is still a readable card.
        error("Could not colour a roll card", err);
    }
}

/**
 * Actually hide what the whisper only *marked* as hidden.
 *
 * The whisper above was working the whole time. What defeated it is a
 * collaboration between core and the system, and neither half is a bug on its
 * own:
 *
 *   Foundry:      `ChatMessage#visible` returns TRUE for any whispered message
 *                 that contains a roll — deliberately. The card is meant to be
 *                 seen ("somebody rolled") while the CONTENT is blanked, and
 *                 the blanking is a separate getter, `isContentVisible`.
 *   Daggerheart:  its chat template replaces core's and renders
 *                 `{{{message.content}}}` unconditionally. It never asks
 *                 `isContentVisible`.
 *
 * So every private roll was whispered correctly, rendered by the system's own
 * template, and read by the whole table.
 *
 * This closes it at the last possible moment — render time — which is also the
 * only place that works regardless of which template the system swaps in next.
 * The whole message is hidden rather than emptied: in a killing game "Kaede
 * rolled something" is itself information, and an empty card in the log is
 * worse than no card.
 */
function enforceContentVisibility(message, element) {
    try {
        const html = element instanceof HTMLElement ? element : element?.[0];
        if (!html) return;
        // Core's own rule, asked directly. It already accounts for the author,
        // blind rolls and GMs, so there is nothing to re-derive here.
        if (message.isContentVisible) return;

        // Belt AND braces, on purpose.
        //
        // The class carries the intent and is what the stylesheet documents; the
        // inline style is what actually guarantees it. A class only hides the
        // message while a rule matching `.chat-message.drpg-hidden-message` is
        // in play, which assumes this element IS a `.chat-message` and that no
        // later rule outranks `display: none`. Neither is ours to assume: the
        // chat log is re-skinned by UI modules that rewrap messages, and this is
        // the one piece of the module where being wrong means somebody reads
        // another player's dice.
        html.classList.add("drpg-hidden-message");
        html.style.setProperty("display", "none", "important");
    } catch (err) {
        // A message we cannot judge is left alone — better a visible roll than
        // a chat log that stops rendering.
        error("Could not apply private-roll visibility", err);
    }
}

/**
 * The other participants' owners, when this roll came from inside an incident.
 *
 * The incident state is read straight off the world setting rather than through
 * `murder.mjs`. `preCreateChatMessage` is synchronous — there is no chance to
 * await a dynamic import — and this is the same reason `lockedInIncident` in
 * movement.mjs reads it directly. The shape is `murderState()`'s own.
 *
 * The roller has to BE a participant. Working it out from the speaker first and
 * from ownership second covers both routes: a crisis action sets the speaker,
 * while a trait rolled straight off the sheet may not.
 *
 * @returns {string[]} user ids to add, empty when this is not an incident roll.
 */
function incidentAudience(author, message) {
    try {
        const state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        if (!state.active || state.stage !== "incident") return [];

        const ids = [state.killerId, state.victimId, state.thirdId].filter(Boolean);
        if (ids.length < 2) return [];

        const speakerId = message.speaker?.actor ?? null;
        const mine = ids.includes(speakerId)
            ? speakerId
            : ids.find(id => game.actors.get(id)?.testUserPermission(author, "OWNER")) ?? null;
        if (!mine) return [];

        const out = [];
        for (const id of ids) {
            if (id === mine) continue;
            const owner = ownerOf(game.actors.get(id));
            if (owner) out.push(owner.id);
        }
        return out;
    } catch {
        // Never let this stop a roll being whispered at all — the GM-only
        // fallback above is the safe state.
        return [];
    }
}

/**
 * The actor a roll is ABOUT, which is not the same as who pressed the button.
 *
 * This distinction is the whole of the bug this function exists to close. The
 * old rule was "rewrite rolls authored by a player", so a GM rolling on behalf
 * of a student — which is how a template gets tested, how an absent player's
 * character acts, and how half of Stage 4 is driven — produced a PUBLIC roll
 * that the whole table read. The dice belong to the character, so the character
 * decides who may see them.
 */
function subjectActor(message, author) {
    const speakerId = message.speaker?.actor ?? null;
    return game.actors.get(speakerId) ?? author?.character ?? null;
}

/** Everyone standing in the same room as this actor, as user ids. */
function sameRoomAudience(actor) {
    try {
        const room = roomOfActor(actor);
        if (!room) return [];
        return occupantsOf(room, actor)
            .map(other => ownerOf(other)?.id)
            .filter(Boolean);
    } catch {
        return [];
    }
}

function onPreCreateChatMessage(message, data, options, userId) {
    try {
        if (!game.settings.get(MODULE_ID, SETTINGS.forcePrivateRolls)) return;

        // Foundry v12+ exposes the creating user as `author`.
        const authorId = message.author?.id ?? message.user?.id ?? userId;
        const author = game.users.get(authorId);
        if (!author) return;

        const hasRoll = (message.rolls?.length ?? 0) > 0
            || !!data?.roll
            || (data?.rolls?.length ?? 0) > 0;
        if (!hasRoll) return;

        // Already a whisper — respect whatever aimed it there.
        if (message.whisper?.length) return;

        const recipients = gmIds();
        if (!recipients.length) return;

        /* ---- who this roll belongs to, and therefore who may read it ------
         *
         *   a Monokuma   GMs only. Monokuma's dice are the other side of the
         *                table and the handbook is explicit that players see the
         *                effects, never the pool behind them.
         *   a Monocub    GMs, their own player, and whoever is standing in the
         *                room with them. A Monocub is back on the board and
         *                visible to the room they are in; hiding their dice from
         *                the people watching them would be hiding half a scene.
         *   a student    GMs and their own player, as before.
         *
         * A roll with no actor behind it — a GM's bare /roll — is treated as the
         * GM's own and goes to the GMs.
         */
        const subject = subjectActor(message, author);
        const isMonokuma = Boolean(subject?.getFlag(MODULE_ID, FLAGS.monokuma));
        const isMonocub = Boolean(subject?.getFlag(MODULE_ID, FLAGS.monocub));

        if (isMonocub) {
            for (const id of sameRoomAudience(subject)) recipients.push(id);
        }

        // The subject's own player, whoever authored the message. Skipped for a
        // Monokuma: their "owner" is a GM already, and a Monokuma actor handed
        // to a player must not turn Monokuma's dice public.
        if (!isMonokuma) {
            const owner = ownerOf(subject);
            if (owner) recipients.push(owner.id);
        }

        // The people you are actually fighting see your dice.
        //
        // An incident is a turn-based exchange in one room, and both sides are
        // told what the other just did — the crisis cards are whispered to every
        // participant's owner. The DICE were not: they went through the ordinary
        // private-roll rewrite above, which addresses the GMs and the roller and
        // nobody else. So the victim read "Strike — 17 ≥ 15" as prose while the
        // roll that produced it was hidden from them, which is the one place in
        // this module where hiding a die serves nothing: the result is already
        // public to exactly these people, and a killing game's incident is the
        // one scene where both players need to watch the maths.
        //
        // Everyone else in the world still sees nothing.
        for (const id of incidentAudience(author, message)) recipients.push(id);

        // The author sees their own dice — EXCEPT when they are a GM rolling
        // Monokuma, where they are already in `gmIds()` anyway. Adding the
        // author unconditionally is what used to make a GM's roll for a student
        // readable by that GM alone rather than by the student's player; both
        // are now covered by the subject rules above.
        if (!author.isGM) recipients.push(author.id);

        // Set the roll mode flag as well as the recipients. Modules that style
        // or animate rolls (Dice So Nice among them) read `core.rollMode`, and
        // a message whose recipients say "private" while its flag still says
        // "public" is an inconsistent state we should not create.
        message.updateSource({
            whisper: Array.from(new Set(recipients)),
            blind: false,
            "flags.core.rollMode": CONST.DICE_ROLL_MODES.PRIVATE
        });
        debug(`Rewrote a roll for ${subject?.name ?? author.name} into a private whisper.`);
    } catch (err) {
        error("preCreateChatMessage failed", err);
    }
}
