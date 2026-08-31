/**
 * Danganronpa RPG - forced private rolls.
 * ---------------------------------------------------------------------------
 * In a killing game nobody may read anyone else's dice. Every chat message
 * carrying a roll is rewritten into a whisper, and WHO may read it is decided by
 * the actor the roll is about - not by whoever pressed the button:
 *
 *   a student    the GMs and that student's own player
 *   a Monocub    the above, plus everyone standing in the same room
 *   a Monokuma   the GMs, and nobody else
 *
 * Keying on the subject rather than the author is the correction this file most
 * needed. It used to return early for any GM-authored message, so a GM rolling
 * on behalf of a student - testing a template, covering an absent player,
 * driving Stage 4 - produced a fully public roll that the whole table read. That
 * is the one leak reported from an actual session.
 *
 * Incident rolls widen the audience deliberately; see `incidentAudience`.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { roomOfActor, occupantsOf } from "./movement.mjs";
import { gmIds, ownerOf, error, debug, MESSAGE_FLAG } from "./utils.mjs";
import { play, ENTER, ARRIVE } from "./motion.mjs";

import { contentOf } from "./secret.mjs";
export function registerPrivateRolls() {
    Hooks.on("preCreateChatMessage", onPreCreateChatMessage);
    // `renderChatMessageHTML` and nothing else.
    //
    // The deprecated `renderChatMessage` was registered alongside it as a
    // "fallback", which is backwards: core fires the old hook only when it finds
    // a listener for it (`if ("renderChatMessage" in Hooks.events)`), so keeping
    // one here was not insurance - it was what made every single chat message
    // take the deprecated path, log a compatibility warning, wrap itself in
    // jQuery and run this handler twice. Removing it also removes the module
    // from the v15 removal path.
    //
    // Nothing is lost. `renderChatMessageHTML` fires on BOTH of the branches in
    // `ChatMessage#renderHTML` - the ordinary one and the early return for a
    // message type that renders itself - while the deprecated hook only ever
    // fired on the first. The old listener was strictly the smaller net.
    Hooks.on("renderChatMessageHTML", enforceContentVisibility);

    // The same hook, deliberately, and after the one above: a message this
    // client may not read is hidden first and never styled. See `paintChatCard`
    // for why a chat card's border cannot be a stylesheet rule.
    Hooks.on("renderChatMessageHTML", paintChatCard);

    // Everything already in the log is history. Registered here rather than at
    // module scope because `game.messages` does not exist until the world is
    // ready, and `ready` fires before the chat log has rendered a single card.
    Hooks.once("ready", rememberExistingMessages);
}

/**
 * Put the outcome colour on a duality roll - from script, because CSS cannot.
 *
 * The stylesheet has carried `border: 1px solid var(--drpg-gold) !important` for
 * Hope rolls since the palette work, and it has never once applied. Daggerheart
 * sets `border-style: none !important` on every chat message from `layer system`,
 * and for IMPORTANT declarations the cascade runs layers in reverse - the
 * earlier layer wins. Our `!important` sits in `layer modules`, which is later,
 * so it loses by rule rather than by specificity, and no selector this module
 * can write will change that. Measured on a real card: the dark background
 * landed (Daggerheart does not force `background-color`), the border computed to
 * `0px none`.
 *
 * An inline style is the one thing above an author `!important`, so the colour
 * goes on the element. The palette still lives in the stylesheet - the tokens
 * are read back off `:root` rather than repeated here, so changing the gold in
 * one place still changes it here.
 */
const OUTCOME_TOKEN = {
    critical: "--drpg-crimson",
    fear: "--drpg-blood",
    hope: "--drpg-gold"
};

/**
 * Every message that was already in the log when this client finished loading.
 *
 * `renderChatMessageHTML` fires for every card in the log, not only for new ones
 * - opening the tab, reloading, scrolling back far enough - so "is this new"
 * has to be answered somehow, and the obvious answer is wrong. Comparing
 * `message.timestamp` against `Date.now()` compares a stamp written by the
 * SERVER against a reading taken from the CLIENT's clock, and on a hosted world
 * those two disagree by however far the two machines have drifted apart. A
 * server a few seconds behind makes every new roll look like history, which is
 * exactly the symptom: no animation, ever, on the newest card in the log.
 *
 * Identity instead of time. Everything present at `ready` is history by
 * definition; everything that turns up afterwards is new, and gets marked as it
 * is handled so a re-render cannot slash the same card twice. No clocks
 * involved, so nothing to drift.
 */
const alreadySeen = new Set();

let historyLoaded = false;

function rememberExistingMessages() {
    for (const message of game.messages ?? []) alreadySeen.add(message.id);
    historyLoaded = true;
}

/**
 * The outcome frame arrives on a cut.
 *
 * A roll's result is the only thing in the chat log that is an EVENT rather
 * than a record - everything else there is something you go and read, and this
 * is something that just happened to you. It used to appear the way a log entry
 * appears, which is to say not at all: the card was simply the next thing down
 * the column.
 *
 * A diagonal wipe, left to right, over the enter time. Not a fade - a fade is
 * the grammar of something settling into place, and the whole visual language
 * this game is built on is hard cuts. One slash, and the frame is there.
 *
 * `clip-path` and nothing else: no layout is read, no layout is written, and
 * the Web Animations API leaves no clip behind when it finishes, so a card that
 * has been cut in is afterwards an entirely ordinary card.
 */
/**
 * Wait until a chat card is actually on the page, then do something with it.
 *
 * `renderChatMessageHTML` fires while the message is still being assembled - it
 * has not been appended to the log yet. An animation started at that moment
 * runs to completion on a detached node, perfectly, without one frame of it
 * ever being composited, which is why the cut was invisible for a release.
 *
 * A handful of frames of patience, then the element as the reader sees it - or
 * nothing, if it never lands, which is the correct answer for a card that was
 * thrown away before it was shown.
 */
function whenOnScreen(html, then) {
    let frames = 6;
    const check = () => {
        if (html.isConnected) return void then();
        if (frames-- > 0) requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
}

function cutIn(html) {
    play(html, [
        { clipPath: "polygon(0% 0%, 0% 0%, -20% 100%, -20% 100%)" },
        { clipPath: "polygon(0% 0%, 120% 0%, 100% 100%, 0% 100%)" }
    ], ENTER(), ARRIVE());
}

/** New means "not in the log when this client loaded", and only once. */
function isNew(message) {
    // The chat log renders its history BEFORE `ready` fires, so until the set
    // above has been filled, nothing can be judged - and judging it wrong here
    // means the whole log slashes itself in and raises a card per roll on load.
    if (!historyLoaded) return false;
    if (!message?.id || alreadySeen.has(message.id)) return false;
    alreadySeen.add(message.id);
    return true;
}

/**
 * Which of the three outcomes this card carries - asked of the DOCUMENT.
 *
 * This used to read the element's classes, and it has never once worked.
 * Daggerheart puts `duality`, `hope`, `fear` and `critical` on the message
 * element inside `enrichChatMessage()`, and it calls that from its own
 * `renderHTML()` - AFTER `super.renderHTML()`, which is the call that fires the
 * hook this module listens on. Every duality card reaching `paintChatCard` is
 * still wearing nothing but `chat-message message flexcol dh-chat-message
 * dh-style`, so the test could only ever come back false.
 *
 * The consequence was quiet and had nothing to do with animation: the outcome
 * BORDER - gold for Hope, blood for Fear, crimson for a Critical - has been
 * falling through to the plain Bone edge on every roll since it was written.
 *
 * The same three facts live on the message, before anything is rendered at all,
 * and this is the same test Daggerheart itself makes: withHope, else withFear,
 * else a Critical.
 */
function dualityOutcome(message, html) {
    if (message?.type === "dualityRoll") {
        const roll = message.system?.roll;
        if (roll) {
            if (roll.withHope) return "hope";
            if (roll.withFear) return "fear";
            return "critical";
        }
    }

    // A re-render of a card Daggerheart has already decorated, and any future
    // message type that adopts the same classes. Costs one lookup and covers
    // the case where the document does not carry the answer.
    if (html?.classList?.contains?.("duality")) {
        return ["critical", "fear", "hope"].find(k => html.classList.contains(k)) ?? null;
    }
    return null;
}

function paintChatCard(message, element) {
    try {
        const html = element instanceof HTMLElement ? element : element?.[0];
        if (!html?.classList) return;
        // Hidden by the pass above: leave it exactly as it is.
        if (html.classList.contains("drpg-hidden-message")) return;

        // SAY WHICH CARDS ARE OURS.
        //
        // Everything below marks every card in the log - the frame is for the
        // whole surface - so nothing here has ever distinguished a card this
        // module wrote from one the system did. The stylesheet needs to: small
        // print inside our cards is ours to weight, and inside Daggerheart's is
        // not. The flag is the same one `stamped()` puts on every message this
        // module posts, so the class means exactly "we wrote this".
        if (message?.getFlag?.(MODULE_ID, MESSAGE_FLAG)) {
            html.classList.add("drpg-chat-card");

            /* AND WHICH WAY ITS ROLL WENT.
             *
             * The module's own result card knew its outcome - `popupTone` has
             * carried it to the popup's title bar since the popup existed - and
             * spent it on nothing in the chat log, where the same card sat in
             * neutral ink beside Daggerheart's, which is tinted, gradient-washed
             * and lit from inside. That is most of why the system's card looked
             * better: not the composition, the CARD. Same treatment, same
             * tokens, applied to ours.
             */
            const tone = message.getFlag(MODULE_ID, "popupTone");
            if (tone && OUTCOME_TOKEN[tone]) {
                html.classList.add("drpg-outcome", `drpg-outcome-${tone}`);
                markOutcome(html, tone);
                return;
            }
        }

        {
            const outcome = dualityOutcome(message, html);
            if (outcome) {
                markOutcome(html, outcome);
                if (isNew(message)) whenOnScreen(html, () => cutIn(html));
                return;
            }
        }

        // Everything else gets the module's window edge. Same mechanism, same
        // reason: the chat log was the one surface in this interface with no
        // frame at all, next to popups and dialogs that have one, and it looked
        // like an oversight rather than a choice. An outcome colour still wins
        // where there is one - a Hope roll says Hope before it says "a card".
        markFrame(html);
    } catch (err) {
        // A card without its border is still a readable card.
        error("Could not paint a chat card", err);
    }
}

/**
 * The module's window edge, on a chat card, inline.
 *
 * Everything the note on `markOutcome` says about why this cannot be a
 * stylesheet rule applies here unchanged - Daggerheart's `border-style: none
 * !important` from `layer system` beats any `!important` this module writes.
 * The colour is read off `:root` so the palette stays in one place.
 */
function markFrame(element) {
    if (!element) return false;

    // `var()` rather than a colour read off `:root`, which is what `markOutcome`
    // does above. An inline style may reference a custom property, and the
    // property is inherited from `:root` like any other - so the edge stays one
    // declaration in the stylesheet, and a client on the light theme resolves
    // `light-dark()` for itself instead of getting whatever this browser
    // happened to compute at the moment the card rendered.
    element.style.setProperty("border", "1px solid var(--drpg-window-edge)", "important");
    element.style.setProperty("border-radius", "4px", "important");
    return true;
}

/**
 * Put the outcome's colour on one element, as an inline border.
 *
 * Exported because a roll now appears in two places - the chat log and the
 * messenger thread the action was declared in - and two copies of this would
 * be two palettes the moment one of them was tuned. Inline rather than a class
 * for the reason the note above gives: the system writes its own `!important`
 * borders on the chat card, and an inline style is the only thing that outranks
 * an author `!important`. The colour itself is still read off `:root`, so it
 * follows the stylesheet.
 *
 * @param {HTMLElement} element
 * @param {"critical"|"fear"|"hope"} outcome
 */
export function markOutcome(element, outcome) {
    const token = OUTCOME_TOKEN[outcome];
    if (!element || !token) return null;

    const colour = getComputedStyle(document.documentElement)
        .getPropertyValue(token).trim();
    if (!colour) return null;

    element.style.setProperty("border", `1px solid ${colour}`, "important");
    element.style.setProperty("border-left", `3px solid ${colour}`, "important");
    return colour;
}

/**
 * Which of the three outcomes a message carries, or `null` for a roll that is
 * not a duality roll at all. Reads the message rather than the DOM, so it works
 * before anything has been rendered - which is what the messenger needs.
 */
export function rollOutcomeOf(message) {
    if (!message?.rolls?.length) return null;
    const flavour = `${message.flavor ?? ""} ${contentOf(message)}`;
    if (/\bcritical\b/i.test(flavour)) return "critical";
    if (/\bfear\b|despair/i.test(flavour)) return "fear";
    if (/\bhope\b/i.test(flavour)) return "hope";
    return null;
}

/**
 * Actually hide what the whisper only *marked* as hidden.
 *
 * The whisper above was working the whole time. What defeated it is a
 * collaboration between core and the system, and neither half is a bug on its
 * own:
 *
 *   Foundry:      `ChatMessage#visible` returns TRUE for any whispered message
 *                 that contains a roll - deliberately. The card is meant to be
 *                 seen ("somebody rolled") while the CONTENT is blanked, and
 *                 the blanking is a separate getter, `isContentVisible`.
 *   Daggerheart:  its chat template replaces core's and renders
 *                 `{{{message.content}}}` unconditionally. It never asks
 *                 `isContentVisible`.
 *
 * So every private roll was whispered correctly, rendered by the system's own
 * template, and read by the whole table.
 *
 * This closes it at the last possible moment - render time - which is also the
 * only place that works regardless of which template the system swaps in next.
 * The whole message is hidden rather than emptied: in a killing game "Kaede
 * rolled something" is itself information, and an empty card in the log is
 * worse than no card.
 */
function enforceContentVisibility(message, element) {
    try {
        const html = element instanceof HTMLElement ? element : element?.[0];
        if (!html) return;

        // A roll this module already reported in its own card. Hidden the same
        // way and for a related reason - the log should carry one account of
        // what happened, not two. See `supersedingRoll`.
        if (message.getFlag?.(MODULE_ID, SUPERSEDED_FLAG)) {
            html.classList.add("drpg-hidden-message");
            html.style.setProperty("display", "none", "important");
            return;
        }

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
        // A message we cannot judge is left alone - better a visible roll than
        // a chat log that stops rendering.
        error("Could not apply private-roll visibility", err);
    }
}

/**
 * The other participants' owners, when this roll came from inside an incident.
 *
 * The incident state is read straight off the world setting rather than through
 * `murder.mjs`. `preCreateChatMessage` is synchronous - there is no chance to
 * await a dynamic import - and this is the same reason `lockedInIncident` in
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
        // Never let this stop a roll being whispered at all - the GM-only
        // fallback above is the safe state.
        return [];
    }
}

/**
 * The actor a roll is ABOUT, which is not the same as who pressed the button.
 *
 * This distinction is the whole of the bug this function exists to close. The
 * old rule was "rewrite rolls authored by a player", so a GM rolling on behalf
 * of a student - which is how a template gets tested, how an absent player's
 * character acts, and how half of Stage 4 is driven - produced a PUBLIC roll
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

/**
 * The flag that says "this module posted its own card for this roll".
 *
 * Written into the message AS IT IS CREATED rather than set afterwards, which
 * matters: a flag added later means an update, an update means a re-render, and
 * a re-render means the system's card is on screen for a moment and then
 * vanishes. Stamped at creation it is simply never seen - and, being a real
 * flag on a real document, it is still not seen after a reload.
 */
const SUPERSEDED_FLAG = "supersededRoll";

/**
 * Open claims - one per `supersedingRoll` call in flight. A list rather than a
 * boolean because nothing here promises the roll paths never nest.
 *
 * EACH CLAIM IS SPENT ON ONE MESSAGE. A trait roll produces exactly one, and
 * without that limit a roll that never finishes leaves its claim open forever:
 * observed once, and the cost was every subsequent roll on that client being
 * swallowed silently. Foundry's own dice animation does not run on a
 * BACKGROUNDED tab - the roll then hangs after its message exists - so this is
 * the ordinary case, not an exotic one. Marking the claim spent at the moment
 * it stamps means a hang can cost the roll it belongs to and nothing after it.
 */
let rollClaims = [];

/**
 * Run something that posts a system roll card this module replaces with its own.
 *
 * Daggerheart's duality card is the same roll said twice: the module's card
 * already carries the two faces, the modifier, the total and which way it went,
 * and having both meant a player read the result on one card and looked away to
 * a second in another visual language. So the system's copy is claimed as it is
 * created and never rendered.
 *
 * Scoped to the window in which the module is deliberately rolling - a plain
 * trait roll from the sheet has no module card to replace it and keeps its own,
 * which is the whole reason this is a claim and not a blanket rule.
 *
 * @param {() => Promise<any>} fn  the call that produces the roll.
 */
export async function supersedingRoll(fn) {
    const claim = { spent: false };
    rollClaims.push(claim);
    try {
        return await fn();
    } finally {
        rollClaims = rollClaims.filter(c => c !== claim);
    }
}

/** Stamp a roll message created inside a claim. See `supersedingRoll`. */
function claimRollMessage(message, data) {
    const claim = rollClaims.find(c => !c.spent);
    if (!claim) return;

    const hasRoll = (message.rolls?.length ?? 0) > 0
        || !!data?.roll
        || (data?.rolls?.length ?? 0) > 0;
    if (!hasRoll) return;

    claim.spent = true;
    message.updateSource({ [`flags.${MODULE_ID}.${SUPERSEDED_FLAG}`]: true });
}

function onPreCreateChatMessage(message, data, options, userId) {
    try {
        claimRollMessage(message, data);
    } catch (err) {
        // A card we failed to claim is a duplicate card, not a broken one.
        error("Could not claim a superseded roll card", err);
    }

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

        // Already a whisper - respect whatever aimed it there.
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
         * A roll with no actor behind it - a GM's bare /roll - is treated as the
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
        // told what the other just did - the crisis cards are whispered to every
        // participant's owner. The DICE were not: they went through the ordinary
        // private-roll rewrite above, which addresses the GMs and the roller and
        // nobody else. So the victim read "Strike - 17 ≥ 15" as prose while the
        // roll that produced it was hidden from them, which is the one place in
        // this module where hiding a die serves nothing: the result is already
        // public to exactly these people, and a killing game's incident is the
        // one scene where both players need to watch the maths.
        //
        // Everyone else in the world still sees nothing.
        for (const id of incidentAudience(author, message)) recipients.push(id);

        // The author sees their own dice - EXCEPT when they are a GM rolling
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
