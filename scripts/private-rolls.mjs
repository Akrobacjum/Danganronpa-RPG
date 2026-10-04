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
 * A ROLL THE MODULE THROWS NAMES NOBODY (E06 C5b, 27.09.2026; audit S02-02,
 * S04-02). Every roll of an action goes through `supersedingRoll`, and every
 * browser holds its document whoever it is whispered to: its speaker, its
 * title and the actor Daggerheart writes into it told a bystander who was
 * rolling, and what for, in the middle of a murder. Such a roll is whispered to
 * the GMs alone - the author reads their own - and its document is emptied as
 * it is created (`neutralRollSource`); the GM learns whose roll it was from the
 * roller's report (`rollSubject`, below). The rules above are for the rolls the
 * module did not throw: a statistic clicked on a sheet, a Monocub's Meddle, a
 * GM's /roll. The incident's participants no longer read each other's rolls
 * off the whisper list - that list named them all to every console; the primary
 * GM sends them each other's dice instead (`relayIncidentDice`, E06 C6).
 *
 * WHAT A ROLL STILL SAYS (E06 C13, 28.09.2026), written down so nobody has to find it
 * again: its author and its moment, which Foundry stamps on the server - a roll a
 * player's browser throws names that player, and only E28, which throws a player's
 * dice on the GM, takes that away (the owner's answer Q2 (a)): since E08+E28 C12a a
 * player's action roll is drawn on the primary GM, who writes it (roll-draw.mjs), and
 * 11-killer-secrecy reads the killer's opening roll written by the GM - known-leaks.json's
 * `roll-author` until then; a statistic from the sheet until C13; its formula, which carries the
 * statistic's value; and, for a roll the module did not throw, Daggerheart's own card
 * and speaker. Who watches its dice fall is the section on the dice below
 * (`keepDiceToReaders`, `diceAudienceIds`). The GM handbook's section 1 tells the GM
 * the same, with what of it was measured.
 */

import { MODULE_ID, FLAGS, TIMING } from "./config.mjs";
import { SETTINGS, getSetting, isDeadForGm, incidentSeats } from "./settings.mjs";
import { roomOfActor, occupantsOf } from "./movement.mjs";
import { gmIds, ownerOf, error, debug, isPrimaryGm, MESSAGE_FLAG } from "./utils.mjs";
import { judge, table, pick, as, knownSender, owns, guardRollAuthor, guardDrawnRoll, bridgeRequest } from "./bridge-guards.mjs";
import { play, ENTER, ARRIVE } from "./motion.mjs";
// Who is in the incident, read on the primary GM for the incident's dice (E06 C6). Static
// and safe: nothing in murder.mjs's own import closure leads back to this file (R161).
import { murderState, incidentAudienceIds } from "./murder.mjs";

// The module's one reader of "what did these two d12s say" - see `rollOutcomeOf`.
// Static and safe: nothing in despair-award.mjs's own import closure leads back
// to this file. It replaced `contentOf` from secret.mjs, which this file needed
// only to match words against a card's prose.
import { readDuality } from "./despair-award.mjs";
import { cardFlag } from "./secret.mjs";
import { LOADED_DIE } from "./forced-roll.mjs";

export function registerPrivateRolls() {
    Hooks.on("preCreateChatMessage", onPreCreateChatMessage);
    // Whose roll it is, told to the primary GM as the message exists (E06 fix r1-G2).
    Hooks.on("createChatMessage", reportClaimedRoll);
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

    // Which character a roll is about, reported by the roller to the primary GM,
    // who judges it by the declaration below (`ROLL_ACTIONS`, E06 C5a) - and the
    // incident's dice, which only a GM sends (`showRelayedDice`, E06 C6).
    game.socket.on(SOCKET_EVENT, (payload, senderId) => {
        if (payload?.action === DICE_SHOW) return void showRelayedDice(payload, senderId);
        return isPrimaryGm() ? judge(ROLL_ACTIONS, payload, senderId) : null;
    });

    // Dice So Nice asks every client whether to animate a message (E06 C6).
    Hooks.on("diceSoNiceMessagePreProcess", keepDiceToReaders);

    // A Reroll rewrites a roll's dice, and the incident's audience sees it too.
    Hooks.on("updateChatMessage", onRollsRewritten);
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
            markReplaced(message, html);

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
            // A private card's tone came with its words (E06 C7a): this hook runs again when they land.
            const tone = cardFlag(message, "popupTone");
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

/*
 * THE CARD A REROLL REPLACED (E08+E28 C5, 03.10.2026; audit S02-21; the plan's 2.7). The GM
 * making a Reroll marks the action's card `rerolled = { from, to, tone, at }` (reroll.mjs
 * `markReplacedCard`) - a private card's in the meta its readers keep with its words (fix r1-G6,
 * read with `cardFlag`), any other's on its document - and every client that draws the card
 * strikes its header's total and adds one line under the header - "Rerolled: 14 -> 4 (see the
 * Reroll card)" - in the new roll's colour.
 * Drawn here, never written into the words: a private card's words are its readers' alone
 * (secret.mjs), and the GM, who sends its own copy of them again to carry the mark, sends them
 * as they were.
 *
 * AFTER THE WORDS, NOT BEFORE. This hook is registered at init and secret.mjs's, which puts a
 * private card's words into the element, at ready (module.mjs) - so on a private card this runs
 * on the stub, and the words replace whatever it drew. The mark waits for the end of the hook's
 * run (a microtask; every listener of `renderChatMessageHTML` runs in one synchronous call) and
 * is drawn only where a header with a total is there to strike. Until fix r1-G6 (04.10.2026; the
 * round-1 review's S4) that was the whole of "the totals reach nobody the card does not": the
 * drawn line did not, but the mark was on a private card's document, which every browser holds.
 * A private card's mark now arrives with its words, to its readers alone. The card's author may
 * write a mark of their own, in its meta or on its document, as they wrote its words: the line is
 * the card's own word, as the rest of it is.
 */
const REPLACED_LINE = "drpg-reroll-replaced";

function markReplaced(message, html) {
    const mark = cardFlag(message, "rerolled");
    if (!mark || typeof mark !== "object") return;
    queueMicrotask(() => {
        try {
            drawReplaced(html, mark);
        } catch (err) {
            error("Could not mark a card a Reroll replaced", err);
        }
    });
}

/** The struck total and the line, on a card element that holds the header; once. */
function drawReplaced(html, mark) {
    const head = html?.querySelector?.(".drpg-card-head");
    const total = head?.querySelector(".drpg-card-total");
    if (!total || html.querySelector(`.${REPLACED_LINE}`)) return false;
    total.style.setProperty("text-decoration", "line-through");
    const line = document.createElement("p");
    line.className = REPLACED_LINE;
    line.textContent = game.i18n.format("DRPG.Reroll.cardReplaced", { from: String(mark.from ?? "?"), to: String(mark.to ?? "?") });
    const token = Object.hasOwn(OUTCOME_TOKEN, mark.tone ?? "") ? OUTCOME_TOKEN[mark.tone] : null;
    if (token) {
        line.dataset.tone = mark.tone;
        const colour = outcomeColour(token);
        if (colour) line.style.setProperty("color", colour);
    }
    head.after(line);
    return true;
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
    /* THE CORNER FOLLOWS THE THEME, and it did not until 09.09. Stained Glass took every
       rounded corner out in 1.2.41, but this radius is written INLINE and with `!important`
       (see the note above for why the border has to be), so no rule in the theme could reach
       it - the audit found seven rounded chat cards on a screen with no other radius on it.
       Legacy keeps its 4 px.

       THE SETTING, NOT THE CLASS - and the first go used the class and left seven rounded
       cards on screen. `applyTheme()` puts `drpg-theme-stained-glass` on `<body>` at ready and
       the chat log renders at ready too, so which of the two lands first is a race. It is the
       same trap `flashOutline` in fog.mjs has written out at length. */
    element.style.setProperty("border-radius", styleNow().square ? "0px" : "4px", "important");
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

    const colour = outcomeColour(token);
    if (!colour) return null;

    element.style.setProperty("border", `1px solid ${colour}`, "important");
    element.style.setProperty("border-left", `3px solid ${colour}`, "important");
    return colour;
}

/*
 * ONCE A SECOND, NOT ONCE A CARD (ROLL-17). `paintChatCard` is the hottest
 * render hook in the module - every card, every render of the log, the whole
 * history at load - and each outcome card asked the style engine for a colour
 * and each plain card read the theme setting. Neither changes inside a render
 * pass, and both change a few times a session; a one-second memo serves a
 * whole pass from one read and still follows a theme switch on the next.
 */
const STYLE_MEMO_MS = 1000;
let styleMemo = { at: 0, colours: {}, square: false };

function styleNow() {
    const now = Date.now();
    if (now - styleMemo.at > STYLE_MEMO_MS) {
        const colours = {};
        try {
            const root = getComputedStyle(document.documentElement);
            for (const token of Object.values(OUTCOME_TOKEN)) colours[token] = root.getPropertyValue(token).trim();
        } catch { /* keep an empty map: the card is still a readable card */ }
        const square = (() => {
            try { return getSetting(SETTINGS.theme) === "stainedGlass"; }
            catch { return document.body.classList.contains("drpg-theme-stained-glass"); }
        })();
        styleMemo = { at: now, colours, square };
    }
    return styleMemo;
}

const outcomeColour = token => styleNow().colours[token] ?? "";

/**
 * Which of the three outcomes a message carries, or `null` for a roll that is
 * not a duality roll at all. Reads the message rather than the DOM, so it works
 * before anything has been rendered - which is what the messenger needs.
 *
 * FROM THE DICE, NOT FROM THE PROSE (audit A7).
 *
 * This used to match `/critical|fear|despair|hope/` against the flavour and the
 * content, which is a card's own WORDS - and this module writes those words
 * constantly. A ruling that says "No Hope left", a GM's reply with "critical
 * mistake" in it, an Analyze card naming the Despair pool: each one dressed
 * itself in a colour it had not rolled, and a card that genuinely rolled
 * nothing could come out gold. The colour is a claim about the dice, so it is
 * read off the dice.
 *
 * `readDuality` is the module's existing answer to exactly this question - it
 * compares the two d12s and only falls back to the system's own flags when it
 * cannot find them. Nothing it imports leads back here.
 */
export function rollOutcomeOf(message) {
    if (!message?.rolls?.length) return null;

    const duality = readDuality(message);
    if (!duality) return null;

    // A tie is a critical and grants Hope, so it is asked first - the flag path
    // can report `withHope` alongside it.
    if (duality.isCritical) return "critical";
    if (duality.withFear) return "fear";
    if (duality.withHope) return "hope";
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
 *
 * AND EACH CLAIM IS ITS OWN ROLL'S (E08+E28 C11, 04.10.2026; audit S02-45). A
 * claim took the first roll message created while it was open, whoever's roll
 * it was. A module roll's window stays open as long as its player looks at it,
 * and a statistic clicked on the sheet meanwhile - a reaction the GM asked for -
 * created its message first: that card was stamped and hidden, emptied of its
 * character, and the module's own roll kept Daggerheart's card with the
 * character's name on it. Tier 2 "a statistic from the sheet thrown while a Work
 * on Project window is open keeps its card" measures it in the harness, and
 * 12-social on a player's browser. So each claim mints a nonce, the roll
 * carries it on its config (`ROLL_NONCE`), and only the message whose first
 * roll's options carry it is claimed.
 */
let rollClaims = [];

/**
 * The key a claim's nonce rides under on the roll's config, which Daggerheart
 * makes the roll's options (dhRoll.mjs:45-47 `createRollInstance`, and the
 * message keeps them through `Roll#toJSON`; read in 2.10.5, not measured at a
 * table). Random, minted per roll and kept nowhere but the open claim on the
 * roller's browser, so the copy every browser holds on the message links the
 * roll to nothing: `neutralRollOf` leaves it, and `reportClaimedRoll` reads it
 * there once the roll has been emptied.
 */
export const ROLL_NONCE = "drpgRollNonce";

/** The nonce a roll message's first roll carries (`ROLL_NONCE`), or null. `data` is the creation data, read where the document has no rolls. */
function rollNonceOf(message, data = null) {
    let roll = message?.rolls?.[0] ?? data?.rolls?.[0] ?? null;
    if (typeof roll === "string") {
        try { roll = JSON.parse(roll); } catch { return null; }
    }
    const nonce = roll?.options?.[ROLL_NONCE];
    return typeof nonce === "string" && nonce ? nonce : null;
}

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
 * @param {(nonce: string) => Promise<any>} fn  the call that produces the roll; it puts `nonce` on the roll's config under `ROLL_NONCE`.
 * @param {object} [opts]
 * @param {Actor|null} [opts.subject]  the character the roll is about, reported as its message is created (`reportClaimedRoll`).
 * @param {string|null} [opts.actionKey]  the action the roll is for, kept on the claim for the GM's draw (roll-draw.mjs); never on the roll.
 * @param {object|null} [opts.facts]  what the GM's draw is told beside the roll (E08+E28 C12b): `calls`, the nonces of the
 *   Calls the roll applied (the roll window's, `noteWindowCalls`), and `context`, the action's (a Search's category and
 *   its stash). On the claim, in this browser's memory, and never on the roll, whose options its message keeps.
 *
 * The GM's draw of a player's roll (roll-draw.mjs `drawOnGm`, E08+E28 C12a) claims the
 * message it writes with the roller's nonce, which the roll already carries (`nonce`), stamps
 * the record's flags beside the claim's (`stamp`), keeps the roller out of the incident's dice
 * relay - their dice are played from the draw's answer (`except`) - and hears the message
 * created before Daggerheart's `toMessage` waits for Dice So Nice (`onCreated`).
 */
export async function supersedingRoll(fn, { subject = null, actionKey = null, facts = null, nonce = null, stamp = null, except = [], onCreated = null } = {}) {
    const claim = { spent: false, subject, actionKey, facts, reported: false, nonce: nonce ?? foundry.utils.randomID(), stamp, except, onCreated };
    rollClaims.push(claim);
    try {
        return await fn(claim.nonce);
    } finally {
        rollClaims = rollClaims.filter(c => c !== claim);
    }
}

/** Stamp a roll message created inside its own claim, and say whether it was. See `supersedingRoll`. */
function claimRollMessage(message, data) {
    const nonce = rollClaims.length ? rollNonceOf(message, data) : null;
    const claim = nonce ? rollClaims.find(c => !c.spent && c.nonce === nonce) : null;
    if (!claim) return false;

    const hasRoll = (message.rolls?.length ?? 0) > 0
        || !!data?.roll
        || (data?.rolls?.length ?? 0) > 0;
    if (!hasRoll) return false;

    claim.spent = true;
    const stamp = Object.fromEntries(Object.entries(claim.stamp ?? {}).map(([key, value]) => [`flags.${MODULE_ID}.${key}`, value]));
    message.updateSource({ [`flags.${MODULE_ID}.${SUPERSEDED_FLAG}`]: true, ...stamp });
    return true;
}

/** The open claim whose roll carries this nonce: what the GM's draw is told of it (roll-draw.mjs). Null when none. */
export function rollClaimOf(nonce) {
    const claim = typeof nonce === "string" && nonce ? rollClaims.find(c => c.nonce === nonce) : null;
    return claim ? { subject: claim.subject, actionKey: claim.actionKey, facts: claim.facts } : null;
}

/**
 * The Calls a roll window applied, kept on its roll's claim for the GM's draw (E08+E28 C12b;
 * roll-dialog.mjs `onCloseApplication`): the window's list, which `throwDice`'s - read before
 * the window opened - gives way to (E08+E28 C7). Synchronous, so it lands before the build goes
 * on past the window. A claim without `facts` - a roll the module did not throw for an action -
 * keeps nothing.
 */
export function noteWindowCalls(nonce, nonces) {
    const claim = typeof nonce === "string" && nonce ? rollClaims.find(c => c.nonce === nonce) : null;
    if (claim?.facts && typeof claim.facts === "object") claim.facts.calls = [...nonces];
}

/*
 * WHOSE ROLL IT IS, SAID AS THE ROLL IS CREATED (E06 fix r1-G2, 28.09.2026; review F4).
 * Daggerheart's `toMessage` creates the message and then waits for Dice So Nice's animation
 * (dhRoll.mjs:162-165), and its duality updates and triggers follow (dualityRoll.mjs:280-281,
 * both read in 2.6.5) - so a report sent when `rollTrait` returned reached the primary GM
 * after the dice had landed, and never while the roller's tab was in the background (the note
 * on `rollClaims`). The Despair award waits four seconds for it and then falls back to the
 * author's one living character, so a GM's roll for a student, or a player's who plays two,
 * lost its award whenever the animation ran longer. The claim carries its character, and the
 * roller reports it from its own `createChatMessage`, before Daggerheart waits for anything;
 * the incident's dice (`relayIncidentDice`) leave with it. Measured with the harness's Dice So
 * Nice holding the animation (`__dsnAnimation`): tier 2 "a roll's character is kept before its
 * dice have landed", and 13's "the victim's roll reaches the killer while the victim's own dice
 * still fall". The claim is found by the roll's nonce (`ROLL_NONCE`, E08+E28 C11), as it was
 * spent: until C11 it was the first spent claim not yet reported, which held only while
 * messages were created in the order their claims were spent.
 */
function reportClaimedRoll(message, options, userId) {
    if ((userId ?? message?.author?.id) !== game.user?.id || !isClaimedRoll(message)) return;
    const nonce = rollNonceOf(message);
    const claim = nonce ? rollClaims.find(c => c.spent && !c.reported && c.nonce === nonce) : null;
    if (!claim) return;
    claim.reported = true;
    if (claim.subject) reportRollSubject(message, claim.subject, { except: claim.except });
    if (typeof claim.onCreated === "function") claim.onCreated(message);
}

/**
 * What a roll the module threw keeps of whose it was: nothing. The changes to
 * `data`, a message's source, that make it the same document whatever the
 * action and whoever threw it - a Strike and a Search are not told apart by
 * their shape (E06 C5b; the plan's 2.3). It writes nothing: the caller applies
 * them, as the roll is created (`onPreCreateChatMessage`) or to a message
 * written before.
 *
 * - the speaker is the one every private card speaks as, with no actor, token
 *   or scene;
 * - Daggerheart's `system.title`, `system.source.actor` and `system.targets`
 *   are emptied where the source has them (actorRoll.mjs's schema, read in
 *   2.6.5; a message of another shape is not given fields it lacks);
 * - each roll is `neutralRollOf`, below, and keeps the form it came in
 *   (Foundry holds them as JSON text);
 * - the flavour goes.
 */
export function neutralRollSource(data, { alias = game.i18n.localize("DRPG.Secret.speaker") } = {}) {
    const changes = { speaker: { alias, actor: null, token: null, scene: null }, flavor: "" };
    const system = data?.system;
    if (system && typeof system === "object") {
        if (Object.hasOwn(system, "title")) changes["system.title"] = "";
        if (system.source && typeof system.source === "object" && Object.hasOwn(system.source, "actor")) changes["system.source.actor"] = "";
        if (Object.hasOwn(system, "targets")) changes["system.targets"] = [];
    }
    if (Array.isArray(data?.rolls)) changes.rolls = data.rolls.map(neutralRollOf);
    return changes;
}

/**
 * One roll of a roll the module threw, as its message keeps it: its options
 * without what describes the character (E06 fix r1-G1, 28.09.2026; review M1 =
 * F1). In Daggerheart a roll's options ARE the roll's whole config
 * (dhRoll.mjs:45), and C5b emptied only its title, its actor's uuid and the
 * actor's `id` and `name` in `data`. Read in 2.6.5's source, the rest said
 * whose it was too: `data` is `getRollData()`, which serialises as the
 * character's whole system - named experiences, a biography, a companion's
 * uuid (actor.mjs:560-563, :636-645; character.mjs); `effects` are the
 * character's ActiveEffects, with names and origins (actor.mjs:576), and
 * `bonusEffects` are built from them; `experiences` are the ids of the
 * character's own experiences the dialog picked, and the roll's modifiers are
 * labelled with their names; `roll.trait` is the statistic, which tells one
 * action from another where their statistics differ.
 *
 * What the roll classes read back when a browser rebuilds the roll from its
 * JSON, which every browser holding the message does, stays: the dice, the
 * formula, `roll`'s type, advantage and numbers, `actionType`. So does the rest
 * of the config as Daggerheart wrote it - the dialog's settings, the module's
 * own marks but one - which was read, not measured, to say nothing more of the
 * character. The one is the Loaded Die's (`LOADED_DIE`; fix r2-G2, 28.09.2026,
 * review round 2's mn1 = m1): the nonce its Call keeps in the character's
 * `pendingCall` flag, which every browser holds until the roll has spent it, so
 * a console that kept the nonces it saw named the roll's character exactly.
 * forced-roll.mjs reads it off the config as the dice are thrown, before the
 * message exists, and nothing reads it off a message (grep, 28.09.2026); the
 * harness's roll carries the config's other keys since the same fix, so a mark
 * like it shows. The claim's nonce (`ROLL_NONCE`, E08+E28 C11) stays: it is
 * minted for the one roll and kept nowhere else, so it names nobody, and the
 * roller's browser reads it off the emptied message (`reportClaimedRoll`).
 * `data` stays as an empty object, not absent - d20Roll.mjs
 * `configureModifiers` (:103) reads `options.data.system` as the constructor
 * runs; `effects` and `experiences` are read with `?.` there and in
 * dhRoll.mjs `bonusEffectBuilder` (:344-360), which rebuilds `bonusEffects`
 * from them. Nothing of the character is needed again but by a Reroll, which
 * rebuilds the formula: it takes the character's data from the actor and the
 * statistic and experiences from the roller's bookmark (reroll.mjs
 * `rollAsThrown`). A modifier keeps its value and loses its label - the
 * formula is summed from the values (dhRoll.mjs `addModifiers`).
 *
 * Read in the source, not measured on a real message (LIVE-E06-02); the
 * harness's roll is written in the shape read here (client-entry.mjs
 * `diceRoll`). `entry` is JSON text or a plain object, and comes back in the
 * same form; text that is not JSON comes back as it was. Exported for the
 * Reroll, which writes a rerolled roll back into the same message.
 */
export function neutralRollOf(entry) {
    let roll;
    try { roll = typeof entry === "string" ? JSON.parse(entry) : foundry.utils.deepClone(entry); } catch { return entry; }
    const opts = roll?.options;
    if (opts && typeof opts === "object") {
        if (Object.hasOwn(opts, "title")) opts.title = "";
        if (Object.hasOwn(opts, "headerTitle")) opts.headerTitle = "";
        if (opts.source && typeof opts.source === "object" && Object.hasOwn(opts.source, "actor")) opts.source.actor = "";
        if (Object.hasOwn(opts, "data")) opts.data = {};
        delete opts.effects;
        delete opts.bonusEffects;
        delete opts.experiences;
        delete opts[LOADED_DIE];
        if (Object.hasOwn(opts, "targets")) opts.targets = [];
        if (opts.roll && typeof opts.roll === "object") {
            delete opts.roll.trait;
            for (const key of ["modifiers", "baseModifiers"]) {
                if (!Array.isArray(opts.roll[key])) continue;
                opts.roll[key] = opts.roll[key].map(m => m && typeof m === "object" && Object.hasOwn(m, "label") ? { ...m, label: "" } : m);
            }
        }
    }
    return typeof entry === "string" ? JSON.stringify(roll) : roll;
}

function onPreCreateChatMessage(message, data, options, userId) {
    let claimed = false;
    try {
        claimed = claimRollMessage(message, data);
    } catch (err) {
        // A card we failed to claim is a duplicate card, not a broken one.
        error("Could not claim a superseded roll card", err);
    }

    try {
        whisperRoll(message, data, userId, claimed);
    } catch (err) {
        error("preCreateChatMessage failed", err);
    }

    // Emptied after the whisper was decided on the true speaker, and whether or
    // not rolls are forced private: a table that shows its rolls still shows
    // nobody's name on one the module threw. A roll this fails on is created as
    // Daggerheart wrote it - a roll that cannot be created is a lost action.
    if (!claimed) return;
    try {
        message.updateSource(neutralRollSource(message.toObject()));
    } catch (err) {
        error("Could not empty the document of a roll the module threw", err);
    }
}

/**
 * Who may read a roll, written into it as it is created; nothing is written
 * when rolls are not forced private. `claimed`: the module threw it.
 */
function whisperRoll(message, data, userId, claimed) {
    if (!game.settings.get(MODULE_ID, SETTINGS.forcePrivateRolls)) return;

    // Foundry v12+ exposes the creating user as `author`.
    const authorId = message.author?.id ?? message.user?.id ?? userId;
    const author = game.users.get(authorId);
    if (!author) return;

    const hasRoll = (message.rolls?.length ?? 0) > 0
        || !!data?.roll
        || (data?.rolls?.length ?? 0) > 0;
    if (!hasRoll) return;

    const recipients = gmIds();
    if (!recipients.length) return;

    /*
     * A ROLL THE MODULE THREW GOES TO THE GMs ALONE (E06 C5b, 27.09.2026). A
     * whisper list is on every browser's copy of the document, so a list that
     * named the roller's player - or, in an incident, every participant's -
     * told each console whose roll it was. The author reads their own roll
     * without being on it (Foundry's `isContentVisible`); a GM's roll for a
     * student no longer adds the student's player (the plan's 2.3). The
     * document is never drawn - the module posts its own card of the roll -
     * so what the list decides is who holds its dice. Whatever whisper the
     * roll arrived with, a GM's blind roll or a player's self roll, gives way
     * to this one.
     */
    if (claimed) {
        message.updateSource({ whisper: recipients, blind: false, "flags.core.rollMode": CONST.DICE_ROLL_MODES.PRIVATE });
        debug("Rewrote a roll the module threw into a whisper to the GMs.");
        return;
    }

    // Already a whisper: respected when a GM aimed it (a blind roll on
    // purpose). A PLAYER's whisper is widened, not respected (ROLL-14): the
    // roll dialog's mode select is disabled but its value is the client's
    // own core roll mode, which any player can set to "Self Roll" from the
    // chat bar - and a self-whispered Despair result never reached the
    // primary GM, so it never fed a Monokuma's pool.
    const already = Array.from(message.whisper ?? []);
    if (already.length && author.isGM) return;
    for (const id of already) recipients.push(id);

    /* ---- who this roll belongs to, and therefore who may read it ------
     *
     *   a Monokuma   GMs only. Monokuma's dice are the other side of the
     *                table and the handbook is explicit that players see the
     *                effects, never the pool behind them.
     *   a Monocub    GMs, their own player, and whoever is standing in the
     *                room with them. A Monocub is back on the board and
     *                visible to the room they are in; hiding their dice from
     *                the people watching them would be hiding half a scene.
     *                A Monocub's Meddle is rolled outside `supersedingRoll`
     *                (monocub.mjs), so this rule still reaches it: the room
     *                sees a Monocub's dice, Confusion's included (the owner's
     *                answer Q3 (b), 27.09.2026).
     *   a student    GMs and their own player, as before.
     *
     * A roll with no actor behind it - a GM's bare /roll - is treated as the
     * GM's own and goes to the GMs. Until E06 C5b an incident's participants
     * were added here as well, and every console read the cast off the list.
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
}

/**
 * Who an old roll the module did not throw may keep on its list at the rewrite of 1.2.65's
 * first load (E06 fix r2-G1, 28.09.2026; review round 2's MJ1; migrate.mjs
 * `neutraliseOldCards`): `whisperRoll`'s rule above, as far as a document can say it - the
 * GMs, the subject's own player (not a Monokuma's) and a player who threw it. Until 1.2.65 an
 * incident's participants were added to every roll one of them made, a statistic the GM asked
 * for on a sheet included (d666a2a private-rolls.mjs `incidentAudience`), and such a list
 * named the cast to every console for as long as the log kept it. What a player's own roll
 * mode aimed it at is the GMs or that player, both kept. Null for a Monocub's roll, which is
 * not judged: its room is on its list (the owner's Q3 (b)), and the room it rolled in then is
 * not known now. A roll a GM or a macro whispered to some other player by hand - no roll mode
 * does - loses that reader as well: the document cannot tell the two lists apart.
 */
export function oldRollReaders(message) {
    const author = message?.author ?? message?.user ?? null;
    const subject = subjectActor(message, author);
    if (subject?.getFlag(MODULE_ID, FLAGS.monocub)) return null;
    const readers = new Set(gmIds());
    if (!subject?.getFlag(MODULE_ID, FLAGS.monokuma)) {
        const owner = ownerOf(subject);
        if (owner) readers.add(owner.id);
    }
    if (author?.id && !author.isGM) readers.add(author.id);
    return readers;
}

/* ==========================================================================
 * WHO A ROLL IS ABOUT, KEPT ON THE GM (E06 C5a, 27.09.2026)
 * --------------------------------------------------------------------------
 * Three readers on the primary GM find the character a roll is about on its
 * message: the Despair award (despair-award.mjs `resolveActor`), the Reroll
 * receipts (reroll-receipts.mjs `actorIdsOf`, which since E08+E28 C8 names the
 * roll in the GMs' warning of a rewrite put back) and the diagnostics - by the
 * speaker and by Daggerheart's `system.source.actor`. Both name the roller's
 * character to every browser that holds the message, and since E06 C5b both
 * are emptied on every roll the module throws (`neutralRollSource`), which
 * would have left all three with nobody. So the subject reaches the GM another
 * way: `throwDice` (action-rolls.mjs) reports `{ messageId, actorId }` in an
 * addressed request, `roll.subject`, the primary GM keeps it in memory, and
 * `rollSubject` answers from that before it reads the message. The speaker
 * and the source are still read after it, for the rolls the module did not
 * throw and for those written before 1.2.65.
 *
 * In memory, as the primary's first throws are (reroll-receipts.mjs): a GM who reloads forgets what was
 * reported before, and such a message is read as an unclaimed one is - its
 * speaker, its source, then its author's one living character. E28 moves the
 * record into the GM's store behind the same function.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;

/** message id -> { actorId, userId, at }: what this client was told, or threw itself. Oldest first. */
const rollSubjects = new Map();

/*
 * HOW LONG, AND HOW MANY. A subject is read when the roll lands (the Despair
 * award) and again whenever a Reroll rewrites the roll (the receipt until
 * E08+E28 C8; the GMs' warning of a player's rewrite put back since), which
 * the GMs' row of the roll allows up to `TIMING.rerollWindowMinutes` after it, so
 * that is how long one is kept. The E06 plan said twice the receipt's five
 * minutes, ten: that would forget a roll a Reroll can still reach, and the
 * receipt would have fallen back to the author's character. Five hundred bounds a table that
 * rolls faster than that; it is a bound, not a measured session.
 */
const SUBJECTS_KEPT = 500;
const SUBJECT_KEPT_MS = TIMING.rerollWindowMinutes * 60_000;

/** message id -> the resolvers of `rollSubject` calls waiting for its report. */
const subjectWaiters = new Map();

/**
 * Record a subject, forget what is too old or too many, and wake whoever waits for this one.
 * Exported for the GM's draw (roll-draw.mjs, E08+E28 C12a): the roller's browser keeps the
 * subject of the message the GM wrote for it, as it keeps one it threw, and asks nothing.
 */
export function keepSubject(messageId, actorId, userId) {
    const now = Date.now();
    rollSubjects.delete(messageId);
    rollSubjects.set(messageId, { actorId, userId, at: now });
    for (const [id, entry] of rollSubjects) {
        if (rollSubjects.size <= SUBJECTS_KEPT && now - entry.at <= SUBJECT_KEPT_MS) break;
        rollSubjects.delete(id);
    }
    const waiting = subjectWaiters.get(messageId) ?? [];
    subjectWaiters.delete(messageId);
    for (const wake of waiting) wake();
}

/**
 * The report, as the primary GM judges it: who sent it, that they play the
 * character it names, and that the message is a roll the module threw, written
 * by the sender a moment ago (`guardRollAuthor`). A report nobody waits on, so
 * a refusal is logged on the GM and told to nobody.
 */
export const ROLL_ACTIONS = table({
    "roll.subject": {
        label: "DRPG.Bridge.what.roll.subject",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardRollAuthor],
        sanitize: pick({ messageId: as.id, actorId: as.id }),
        run: keepRollSubject,
        answer: "none", quiet: true,
        claims: { messageId: guardRollAuthor }
    },
    /*
     * A PLAYER'S ROLL, DRAWN BY THE PRIMARY GM (E08+E28 C12a, 04.10.2026; audit S16-05; the
     * plan's 3.3). The roller's browser configured the roll - Daggerheart's own hooks and window
     * - and sends it unevaluated (roll-draw.mjs `drawnBuild`); the GM throws it, writes its
     * message, settles its Hope, Stress and Fear, records it (`rollStore`) and answers with the
     * faces it drew. The roll is the sender's own character's (`owns`) and a duality roll
     * nobody has thrown, carrying the claim's nonce (`guardDrawnRoll`). What the roll adds up
     * to beyond its dice is observed from C12b on, not refused (D2's allowance for 1.2.67):
     * the statistic, the experiences, the Calls and the stash the packet names are the
     * roller's word, held against what the GM knows (roll-draw.mjs `expectedFor`).
     */
    "roll.draw": {
        label: "DRPG.Bridge.what.roll.draw",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardDrawnRoll],
        sanitize: pick({ actorId: as.id, actionKey: as.maybeText, nonce: as.id, claimed: as.bool, loaded: as.id, costs: as.raw, roll: as.raw,
            trait: as.maybeText, experiences: as.raw, calls: as.raw, context: as.raw, situational: as.num }),
        run: drawRollOnGm,
        answer: "reply",
        claims: {
            roll: guardDrawnRoll,
            nonce: guardDrawnRoll,
            costs: "only what the sender's own character pays: drawOnGm (roll-draw.mjs) keeps up to eight enabled costs of a whole number from 1 to 12, each taken off that character",
            loaded: "the Loaded Die is loaded on the GM only while that character's armed Calls hold this nonce and the roll applied it (roll-draw.mjs drawOnGm)",
            experiences: "only the sender's own character's experiences count, at the value the GM holds; one beyond what an armed Call allows is flagged to the GMs (roll-draw.mjs checkRoll)",
            calls: "only Calls armed on the sender's own character as the GM holds them count; the GM spends those and reads its expectation from them (roll-draw.mjs appliedCalls)",
            context: "a Search's category and stash as the roller saw them: the room is the GM's, its favour and its hidden stash read by the GM (roll-draw.mjs expectedFor)"
        }
    }
});

/** The run of `roll.draw`: the GM's draw, with the fields its whitelist lets through. */
async function drawRollOnGm(payload, sender, ctx) {
    const { drawOnGm } = await import("./roll-draw.mjs");
    return drawOnGm({ actorId: payload.actorId, actionKey: payload.actionKey, nonce: payload.nonce, claimed: payload.claimed,
        loaded: payload.loaded, costs: payload.costs, roll: payload.roll, trait: payload.trait, experiences: payload.experiences,
        calls: payload.calls, context: payload.context, situational: payload.situational }, sender);
}

/** The run of `roll.subject`: its guards tied the message to the sender and the character to them. */
function keepRollSubject(payload, sender, ctx) {
    keepSubject(payload.messageId, payload.actorId, sender.id);
    relayIncidentDice(game.messages.get(payload.messageId));
}

/**
 * Tell the primary GM which character a roll the module threw is about - as
 * its message is created (`reportClaimedRoll`), and again from `throwDice`
 * (action-rolls.mjs) once the roll has returned, which says nothing when the
 * first did. Kept on this client as well: the roller's own Reroll finds its
 * roll by it (`belongsTo`, reroll.mjs). A primary GM's own roll is recorded
 * without a packet.
 */
export function reportRollSubject(message, actor, { except = [] } = {}) {
    const messageId = message?.id ?? message?._id ?? null;
    if (!messageId || !actor?.id || keptRollSubject(message) === actor.id) return;
    keepSubject(messageId, actor.id, game.user?.id ?? null);
    if (isPrimaryGm()) return relayIncidentDice(message, { except });
    const decl = ROLL_ACTIONS["roll.subject"];
    void bridgeRequest("roll.subject", { messageId, actorId: actor.id }, { settle: decl.answer, quiet: decl.quiet });
}

/** Is this a roll the module threw - a message `supersedingRoll` claimed as it was created? */
export function isClaimedRoll(message) {
    return Boolean(message?.getFlag?.(MODULE_ID, SUPERSEDED_FLAG));
}

/** The character this client was told (or knows, having thrown it) a roll is about, as an id, or null. */
export function keptRollSubject(message) {
    return rollSubjects.get(message?.id ?? "")?.actorId ?? null;
}

/**
 * The character a roll is about, as this client can tell now: the subject kept
 * for it, then the speaker (its actor, then its token), then Daggerheart's
 * `system.source.actor`, then the author's one living character - a player who
 * plays two is not guessed between, and a GM owns every one. Null when none.
 */
export function rollSubjectNow(message) {
    if (!message) return null;
    const kept = game.actors.get(keptRollSubject(message) ?? "");
    if (kept) return kept;

    const speaker = message.speaker;
    const spoken = game.actors.get(speaker?.actor ?? "");
    if (spoken) return spoken;
    if (speaker?.token && speaker?.scene) {
        const token = game.scenes.get(speaker.scene)?.tokens?.get(speaker.token);
        if (token?.actor) return token.actor;
    }

    const source = message.system?.source?.actor;
    if (typeof source === "string" && source) {
        let doc = null;
        try { doc = fromUuidSync(source); } catch { doc = null; }
        const actor = doc?.documentName === "Actor" ? doc : doc?.actor ?? null;
        if (actor) return actor;
    }

    const author = game.users.get(message.author?.id ?? message.user?.id ?? "");
    if (!author || author.isGM) return null;
    const living = game.actors.filter(a => a.type === "character"
        && a.testUserPermission(author, "OWNER") && !isDeadForGm(a));
    return living.length === 1 ? living[0] : null;
}

/**
 * `rollSubjectNow`, after waiting up to `waitMs` for the report of a roll the
 * module threw and nobody has reported yet. The Despair award asks as the
 * message is created, and the roller's report leaves as the roller's browser
 * sees it created (`reportClaimedRoll`), a round trip later, so on the primary
 * GM the report usually comes second. An unclaimed roll is never reported and
 * is not waited for.
 */
export async function rollSubject(message, { waitMs = 0 } = {}) {
    if (!message) return null;
    if (waitMs > 0 && !keptRollSubject(message) && isClaimedRoll(message)) await subjectReported(message.id, waitMs);
    return rollSubjectNow(message);
}

/** Resolves when this message's subject is kept, or after `ms`. */
function subjectReported(messageId, ms) {
    return new Promise(resolve => {
        const wake = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
            const rest = (subjectWaiters.get(messageId) ?? []).filter(w => w !== wake);
            if (rest.length) subjectWaiters.set(messageId, rest);
            else subjectWaiters.delete(messageId);
            resolve();
        }, ms);
        subjectWaiters.set(messageId, [...(subjectWaiters.get(messageId) ?? []), wake]);
    });
}

/* ==========================================================================
 * THE DICE, ONLY WHERE THE RULE SAYS (E06 C6, 27.09.2026; audit S02-13, S02-40, S04-01)
 * --------------------------------------------------------------------------
 * Who watches a roll's dice fall is decided in three places, and before E06 none
 * of them asked this module. Dice So Nice decides on every client whether a new
 * roll message animates there; with its world setting "Hide 3D dice on secret
 * rolls" off it animated a whisper, with its real faces, on every screen
 * (main.js `shouldInterceptMessage`, :458-516, read in 6.3.1). A Reroll threw its
 * new dice to every screen (reroll.mjs). And the incident's participants saw each
 * other's dice by being on the roll's whisper list, which named them all to every
 * console until C5b emptied it - so from C5b on they saw none.
 *
 * - `keepDiceToReaders`: with rolls forced private, a client that cannot read a
 *   message never animates it, whatever Dice So Nice's own settings say - no real
 *   dice, no ghost dice.
 * - `diceAudienceIds`: who sees a roll's dice - the GMs, its author, and, for a
 *   roll the module threw for a character seated in the incident at the opening or
 *   in the fight, the incident's audience at that stage (`incidentAudienceIds`). The one
 *   rule; E28, which throws the players' dice on the GM, asks it too.
 * - `relayIncidentDice`: the primary GM, once it keeps a roll's subject (or sees
 *   its rolls rewritten by a GM's hand - a player's is put back since E08+E28 C8;
 *   a Reroll's GM sends its own, `relayRerolledDice`),
 *   sends `dice.show { id }` to that audience less
 *   the GMs, the author and whoever rewrote it, by addressed socket. The packet
 *   carries the message's id and nothing else; each receiver plays the rolls of
 *   its own copy of the message (`showRelayedDice`), which every browser holds -
 *   unless it can read the roll, as every client can when rolls are not forced
 *   private: Dice So Nice has animated it there already (E06 fix r1-G2).
 *
 * At the stage the roll is reported at, `openingRoll` or `incident` (E06 fix r1-G3,
 * 28.09.2026; review M4, the owner's rule read as written: each incident roll). At the
 * opening the seats are the roller's own side, so the relay adds only an accomplice
 * seated with a killer - and never a direct murder's victim (D6). Stage 6 is the
 * clean-up, whose rolls are the killer's alone. What each roll came to and which roll
 * it was reach the same people on the crisis card (murder.mjs `announceCrisis`, veiled,
 * E06 C4) and on the opening's (`announceOpening`, E06 fix r1-G3) - with or without Dice
 * So Nice. What a relayed roll looks like on a real table, and whether Dice So Nice
 * queues it behind the roller's own, has not been measured (LIVE-E06-03).
 * ========================================================================== */

/** The socket action of the incident's dice, GM to player. */
const DICE_SHOW = "dice.show";

/**
 * The update option a Reroll's rewrite carries (reroll.mjs, E08+E28 C4a): its dice are sent
 * by the GM that made it (`relayRerolledDice`), so the relay below sends nothing for it.
 */
export const REROLL_SHOWN = "drpgRerollShown";

/**
 * `diceSoNiceMessagePreProcess` (Dice So Nice 6.0 and later): the decision is the
 * hook's `interception.willTrigger3DRoll`, and a listener may turn it off. Only
 * off, and only when rolls are forced private - a table that shows its rolls
 * keeps Dice So Nice's own choice.
 */
function keepDiceToReaders(messageId, interception) {
    if (!interception || !game.settings.get(MODULE_ID, SETTINGS.forcePrivateRolls)) return;
    const message = game.messages.get(messageId ?? "");
    if (message && !message.isContentVisible) interception.willTrigger3DRoll = false;
}

/**
 * The incident's audience for this roll's dice, as user ids: `incidentAudienceIds`
 * at `state`, when the stage is `openingRoll` or `incident` and the character the
 * roll is about - as this client was told it (`keptRollSubject`), so a roll the
 * module threw - holds a seat of `incidentSeats`. Empty otherwise. A trap's builder
 * holds no seat while the trap runs, so no roll of it reaches them.
 */
function incidentDiceAudience(message, state) {
    if (state?.stage !== "incident" && state?.stage !== "openingRoll") return [];
    const subject = keptRollSubject(message);
    if (!subject || !incidentSeats(state, state).includes(subject)) return [];
    return incidentAudienceIds(state);
}

/**
 * WHO SEES A ROLL'S DICE, as user ids: every GM, the message's author, and the
 * incident's audience of `incidentDiceAudience`. Read on the primary GM, which is
 * told every roll's subject; another client knows the subjects of its own rolls
 * alone. Exported for E28.
 */
export function diceAudienceIds(message, state = murderState()) {
    const authorId = message?.author?.id ?? message?.user?.id ?? null;
    return [...new Set([...gmIds(), ...(authorId ? [authorId] : []), ...incidentDiceAudience(message, state)])];
}

/**
 * Send the incident's audience a roll's dice (the primary GM alone): those of
 * `diceAudienceIds` who are not GMs, not its author and not in `except` - the GMs
 * and the author read the message and Dice So Nice shows it to them itself.
 */
function relayIncidentDice(message, { except = [] } = {}) {
    if (!message?.id || !isPrimaryGm()) return;
    const skip = new Set([...gmIds(), message.author?.id ?? message.user?.id ?? null, ...except]);
    const recipients = diceAudienceIds(message).filter(id => !skip.has(id));
    if (!recipients.length) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: DICE_SHOW, id: message.id }, { recipients });
    } catch (err) {
        error("Could not send the incident's dice", err);
    }
}

/**
 * `updateChatMessage`, on the primary GM: a roll the module threw was given new dice by
 * somebody's own hand. A Reroll's rewrite says so (`REROLL_SHOWN`), and its dice have been
 * sent already. On the primary that made it the option is the one it passed; one another GM
 * made reaches it through Foundry's broadcast of the update, which carries its options -
 * read in Foundry's source, not measured at a real table.
 */
function onRollsRewritten(message, changes, options, userId) {
    if (!changes || !Object.hasOwn(changes, "rolls") || !isPrimaryGm() || !isClaimedRoll(message)) return;
    if (options?.[REROLL_SHOWN]) return;
    // A rewrite by a user who is not a GM is put back (reroll-receipts.mjs `judgeRewrite`,
    // E08+E28 C8), so its dice are nobody's to watch.
    if (!game.users.get(userId ?? "")?.isGM) return;
    relayIncidentDice(message, { except: [userId] });
}

/**
 * A REROLL'S DICE, FROM THE GM THAT MADE IT (E08+E28 C4a, 03.10.2026; the owner's rule of
 * 27.09: the roller sees the roll as their own). The roller's own browser threw them to
 * the roll's readers until this commit (reroll.mjs's `showRerolledDice`, a synchronised
 * throw Dice So Nice sent to every client and filtered as it arrived); the GM rewrites the
 * message now, and Dice So Nice animates no update. So the GM sends `dice.show { id, by,
 * rewrite }` to the readers of `diceAudienceIds` and the roller (`by`, the user whose
 * browser threw the roll), and plays them on its own screen; each receiver plays its own
 * copy's new rolls as `by`'s dice (`showRelayedDice`). Not awaited on this screen: the
 * Reroll does not wait for an animation. How it looks at a real table, with and without
 * Dice So Nice, is not measured here.
 */
export function relayRerolledDice(message, byId = null) {
    if (!message?.id) return;
    const by = game.users.get(byId ?? "") ?? message.author ?? null;
    const recipients = [...new Set([...diceAudienceIds(message), ...(by?.id ? [by.id] : [])])].filter(id => id !== game.user?.id);
    try {
        if (recipients.length) game.socket.emit(SOCKET_EVENT, { action: DICE_SHOW, id: message.id, by: by?.id ?? null, rewrite: true }, { recipients });
    } catch (err) {
        error("Could not send a Reroll's dice", err);
    }
    void playRolls(message, by ?? game.user);
}

/** A message's rolls on this screen as `user`'s dice, or the dice sound where Dice So Nice is not. */
async function playRolls(message, user) {
    try {
        if (typeof game.dice3d?.showForRoll !== "function") return void foundry.audio.AudioHelper.play({ src: CONFIG.sounds.dice });
        for (const roll of message.rolls ?? []) await game.dice3d.showForRoll(roll, user, false);
    } catch (err) {
        error("Could not show a Reroll's dice", err);
    }
}

/**
 * `dice.show`, as a player receives it: taken from a GM alone, and played from
 * this client's own copy of the message - once it arrives, as `secret.card`'s
 * words wait for theirs - with no message id, so Dice So Nice draws the dice as
 * they fell instead of veiling a roll this client cannot read, and only here.
 *
 * NOT A ROLL THIS CLIENT READS (E06 fix r1-G2, 28.09.2026; review F2). With rolls
 * not forced private a roll the module threw is public, and Dice So Nice animates it on
 * every client - so the relay played each incident roll a second time on every other
 * participant's screen. Asked of the message as it is here rather than of the setting on
 * the GM: what decides is whether this client's Dice So Nice shows it itself.
 *
 * A REROLL'S (`rewrite`, E08+E28 C4a) is played even where this client reads the message:
 * Dice So Nice animates a new message, not new rolls on an old one. As `by`'s dice - the
 * roller's appearance - when `by` names a user, else the message's author's.
 */
async function showRelayedDice(payload, senderId) {
    if (!game.users.get(senderId)?.isGM) return;
    const id = typeof payload?.id === "string" ? payload.id : null;
    const rewrite = payload?.rewrite === true;
    if (!id) return;
    try {
        const { messageArrives } = await import("./secret.mjs");
        const message = game.messages.get(id) ?? await messageArrives(id);
        if (!message || (message.isContentVisible && !rewrite)) return;
        const by = rewrite && typeof payload.by === "string" ? game.users.get(payload.by) ?? null : null;
        if (rewrite) return await playRolls(message, by ?? message.author);
        if (typeof game.dice3d?.showForRoll !== "function") return;
        for (const roll of message.rolls ?? []) await game.dice3d.showForRoll(roll, message.author, false);
    } catch (err) {
        error("Could not show the incident's dice", err);
    }
}
