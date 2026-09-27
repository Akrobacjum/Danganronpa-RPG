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
 */

import { MODULE_ID, FLAGS, TIMING } from "./config.mjs";
import { SETTINGS, getSetting, isDeadForGm, incidentSeats } from "./settings.mjs";
import { roomOfActor, occupantsOf } from "./movement.mjs";
import { gmIds, ownerOf, error, debug, isPrimaryGm, MESSAGE_FLAG } from "./utils.mjs";
import { judge, table, pick, as, knownSender, owns, guardRollAuthor, bridgeRequest } from "./bridge-guards.mjs";
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

/** Stamp a roll message created inside a claim, and say whether it was. See `supersedingRoll`. */
function claimRollMessage(message, data) {
    const claim = rollClaims.find(c => !c.spent);
    if (!claim) return false;

    const hasRoll = (message.rolls?.length ?? 0) > 0
        || !!data?.roll
        || (data?.rolls?.length ?? 0) > 0;
    if (!hasRoll) return false;

    claim.spent = true;
    message.updateSource({ [`flags.${MODULE_ID}.${SUPERSEDED_FLAG}`]: true });
    return true;
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
 * - each roll's options - which ARE the roll's whole config in Daggerheart
 *   (dhRoll.mjs:45) - lose their `title` and `headerTitle`, the actor's uuid in
 *   `source.actor`, and the actor's `id` and `name` in `data`, and each roll
 *   keeps the form it came in (Foundry holds them as JSON text);
 * - the flavour goes.
 *
 * What is left of `data` (`getRollData()`: the trait values and the resources)
 * is the dice's arithmetic, and stays. What a real Daggerheart message holds
 * beyond these fields has been read in its source, not measured (LIVE-E06-02).
 */
export function neutralRollSource(data, { alias = game.i18n.localize("DRPG.Secret.speaker") } = {}) {
    const changes = { speaker: { alias, actor: null, token: null, scene: null }, flavor: "" };
    const system = data?.system;
    if (system && typeof system === "object") {
        if (Object.hasOwn(system, "title")) changes["system.title"] = "";
        if (system.source && typeof system.source === "object" && Object.hasOwn(system.source, "actor")) changes["system.source.actor"] = "";
        if (Object.hasOwn(system, "targets")) changes["system.targets"] = [];
    }
    if (Array.isArray(data?.rolls)) {
        changes.rolls = data.rolls.map(entry => {
            let roll;
            try { roll = typeof entry === "string" ? JSON.parse(entry) : foundry.utils.deepClone(entry); } catch { return entry; }
            const opts = roll?.options;
            if (opts && typeof opts === "object") {
                if (Object.hasOwn(opts, "title")) opts.title = "";
                if (Object.hasOwn(opts, "headerTitle")) opts.headerTitle = "";
                if (opts.source && typeof opts.source === "object" && Object.hasOwn(opts.source, "actor")) opts.source.actor = "";
                if (opts.data && typeof opts.data === "object") { delete opts.data.id; delete opts.data.name; }
            }
            return typeof entry === "string" ? JSON.stringify(roll) : roll;
        });
    }
    return changes;
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

/* ==========================================================================
 * WHO A ROLL IS ABOUT, KEPT ON THE GM (E06 C5a, 27.09.2026)
 * --------------------------------------------------------------------------
 * Three readers on the primary GM find the character a roll is about on its
 * message: the Despair award (despair-award.mjs `resolveActor`), the Reroll
 * receipts (reroll-receipts.mjs `actorIdsOf`) and the diagnostics - by the
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
 * In memory, like the Reroll receipts: a GM who reloads forgets what was
 * reported before, and such a message is read as an unclaimed one is - its
 * speaker, its source, then its author's one living character. E28 moves the
 * record into the GM's store behind the same function.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;

/** message id -> { actorId, userId, at }: what this client was told, or threw itself. Oldest first. */
const rollSubjects = new Map();

/*
 * HOW LONG, AND HOW MANY. A subject is read when the roll lands (the Despair
 * award) and again whenever a Reroll rewrites the roll (the receipt), which
 * the recent-chat scan allows up to `TIMING.rerollWindowMinutes` after it, so
 * that is how long one is kept. The E06 plan said twice `rerollReceiptMs`, ten
 * minutes: that would forget a roll a Reroll can still reach, and the receipt
 * would fall back to the author's character. Five hundred bounds a table that
 * rolls faster than that; it is a bound, not a measured session.
 */
const SUBJECTS_KEPT = 500;
const SUBJECT_KEPT_MS = TIMING.rerollWindowMinutes * 60_000;

/** message id -> the resolvers of `rollSubject` calls waiting for its report. */
const subjectWaiters = new Map();

/** Record a subject, forget what is too old or too many, and wake whoever waits for this one. */
function keepSubject(messageId, actorId, userId) {
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
    }
});

/** The run of `roll.subject`: its guards tied the message to the sender and the character to them. */
function keepRollSubject(payload, sender, ctx) {
    keepSubject(payload.messageId, payload.actorId, sender.id);
    relayIncidentDice(game.messages.get(payload.messageId));
}

/**
 * Tell the primary GM which character a roll the module threw is about
 * (`throwDice`, action-rolls.mjs). Kept on this client as well: the roller's
 * own Reroll finds its roll by it (`belongsTo`, reroll.mjs). A primary GM's
 * own roll is recorded without a packet.
 */
export function reportRollSubject(message, actor) {
    const messageId = message?.id ?? message?._id ?? null;
    if (!messageId || !actor?.id) return;
    keepSubject(messageId, actor.id, game.user?.id ?? null);
    if (isPrimaryGm()) return relayIncidentDice(message);
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
 * message is created, and the roller's report leaves only once its roll has
 * returned, so on the primary GM the report usually comes second. An
 * unclaimed roll is never reported and is not waited for.
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
 *   roll the module threw for a character seated in the incident while the fight
 *   runs, the incident's audience at that stage (`incidentAudienceIds`). The one
 *   rule; E28, which throws the players' dice on the GM, asks it too.
 * - `relayIncidentDice`: the primary GM, once it keeps a roll's subject (or sees
 *   a Reroll rewrite its rolls), sends `dice.show { id }` to that audience less
 *   the GMs, the author and whoever rewrote it, by addressed socket. The packet
 *   carries the message's id and nothing else; each receiver plays the rolls of
 *   its own copy of the message (`showRelayedDice`), which every browser holds.
 *
 * Only while the stage is `incident`: at the opening the seats are the roller's
 * own side, and Stage 6 is the clean-up, whose rolls are the killer's alone. What
 * each roll came to and which action it was reach the same people on the crisis
 * card (murder.mjs `announceCrisis`, veiled, E06 C4) - with or without Dice So
 * Nice. What a relayed roll looks like on a real table, and whether Dice So Nice
 * queues it behind the roller's own, has not been measured (LIVE-E06-03).
 * ========================================================================== */

/** The socket action of the incident's dice, GM to player. */
const DICE_SHOW = "dice.show";

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
 * at `state`, when the stage is `incident` and the character the roll is about -
 * as this client was told it (`keptRollSubject`), so a roll the module threw - holds
 * a seat of `incidentSeats`. Empty otherwise. A trap's builder holds no seat while
 * the trap runs, so no roll of the fight reaches them.
 */
function incidentDiceAudience(message, state) {
    if (state?.stage !== "incident") return [];
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

/** `updateChatMessage`, on the primary GM: a roll the module threw was given new dice - a Reroll. */
function onRollsRewritten(message, changes, options, userId) {
    if (!changes || !Object.hasOwn(changes, "rolls") || !isPrimaryGm() || !isClaimedRoll(message)) return;
    relayIncidentDice(message, { except: [userId] });
}

/**
 * `dice.show`, as a player receives it: taken from a GM alone, and played from
 * this client's own copy of the message - once it arrives, as `secret.card`'s
 * words wait for theirs - with no message id, so Dice So Nice draws the dice as
 * they fell instead of veiling a roll this client cannot read, and only here.
 */
async function showRelayedDice(payload, senderId) {
    if (!game.users.get(senderId)?.isGM) return;
    const id = typeof payload?.id === "string" ? payload.id : null;
    if (!id || typeof game.dice3d?.showForRoll !== "function") return;
    try {
        const { messageArrives } = await import("./secret.mjs");
        const message = game.messages.get(id) ?? await messageArrives(id);
        for (const roll of message?.rolls ?? []) await game.dice3d.showForRoll(roll, message.author, false);
    } catch (err) {
        error("Could not show the incident's dice", err);
    }
}
