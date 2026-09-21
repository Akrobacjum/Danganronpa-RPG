/**
 * Danganronpa RPG - the one popup every player-facing message uses.
 * ---------------------------------------------------------------------------
 * Search, Work on Project, Sabotage, a refused room crossing, a DM's reply, a
 * Despair Call, the time of day - all of it used to be a line in the sidebar
 * somebody had to notice. This is where all of it surfaces instead: a floating
 * card in the middle of the screen, purple for an ordinary update, red for
 * something that was refused, gold for evidence.
 *
 * Every player gets them. A GM gets the ones addressed to the table or to them
 * - see the whisper rule in `onCreateChatMessage` below; the records of what
 * everyone did reach a GM through the chat log and the day summary instead.
 * The chat log is still the paper trail, but it is not a notification channel -
 * during an incident nobody is reading it.
 *
 * Two ways something ends up here:
 *   showPopup()              called directly, when the caller wants a title or
 *                            a sticky card - `report()` in action-rolls.mjs,
 *                            the messenger, the Class Trial's evidence card.
 *   the createChatMessage    anything posted through `announce`,
 *   catch-all hook           `whisperToGms` or `whisperToOwner` in utils.mjs,
 *                            all of which stamp `MESSAGE_FLAG`. The accent
 *                            comes from a `popupKind` flag on the message and
 *                            the header from `popupTitle`; `popupKind: "none"`
 *                            opts out for the callers that raise their own
 *                            richer card.
 *
 * Prefer the hook. A card raised by `showPopup()` appears on the client that
 * called it and nowhere else; a card raised from a whisper appears for everyone
 * the whisper was addressed to, which is almost always what was meant.
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";
import { MESSAGE_FLAG } from "./utils.mjs";
import { play, BEAT, ARRIVE, SNAP } from "./motion.mjs";

import { contentOf, wordsOf, secretHtml, isVeiled } from "./secret.mjs";
const CONTAINER_ID = "drpg-popups";
const EVIDENCE_ID = "drpg-evidence";
const AUTO_DISMISS_MS = TIMING.popupAutoDismissMs;

/**
 * How many cards may be on screen at once.
 *
 * There was no limit, and the moment that costs you is the one the whole system
 * exists for: during an incident every crisis action produces a card for both
 * participants and the GM, several land inside a second, and the stack grows
 * past the top of the window. The cards that scroll off are the oldest - which
 * is the right ones to lose - but they used to be lost silently and off-screen,
 * so the reader could not tell whether they had missed anything.
 *
 * Oldest are now dismissed as new ones arrive, so the stack stays readable and
 * always shows the most recent events. A sticky card (evidence in a trial) is
 * never one of them - it is on screen because somebody has to read it.
 */
const MAX_VISIBLE = 4;

function container() {
    let el = document.getElementById(CONTAINER_ID);
    if (!el) {
        el = document.createElement("div");
        el.id = CONTAINER_ID;
        document.body.append(el);
    }
    positionBelowWidgets(el);
    return el;
}

/**
 * EVIDENCE GETS THE MIDDLE OF THE SCREEN, AND IT GETS IT BECAUSE IT WAS BEING
 * CUT IN HALF IN THE CORNER (16.09).
 * ---------------------------------------------------------------------------
 * The notice tile is 430 x 220, and that is a ceiling rather than a choice: the
 * corner it stands in is shared with Foundry's tool rail, whose own run is
 * bounded to clear it, and every larger size was measured taking the rail's
 * glass away (see the sweep at the top of stained-glass.css). A Class Trial
 * objection carrying a Truth Bullet with its analysis and a comment needs 459
 * px. It does not fit and it never will.
 *
 * So the one card in this module that is meant to be READ stops living in the
 * corner with the receipts. It stands in the middle of the map, which is the
 * one part of the screen nothing else is using during a trial - nobody is
 * moving tokens while the table argues.
 *
 * IT IS NOT A PANE OF THE CURTAIN, DELIBERATELY. A block that comes and goes is
 * a block the glass has to be recut around, and that is the mistake 1.2.30 made
 * with the notice tile - the corner tile came and went with the news. This
 * stage carries its own glass in the stylesheet, so it can appear, grow with
 * its card and vanish without the curtain hearing about it at all.
 *
 * The stage takes no clicks; the card inside it does (stained-glass.css), so
 * the map underneath stays draggable around the evidence.
 */
function evidenceStage() {
    let el = document.getElementById(EVIDENCE_ID);
    if (!el) {
        el = document.createElement("div");
        el.id = EVIDENCE_ID;
        /* Announced, because a card that lands in the middle of the screen
           without a word is a card a screen reader's user never learns about.
           The same role the notice stack carries (a11y.mjs). */
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.append(el);
    }
    return el;
}

/**
 * Which of the two this card belongs in.
 *
 * Only a STICKY piece of evidence takes the stage. A non-sticky one is a
 * caller that wanted the evidence colour for a passing message, and a passing
 * message in the middle of the screen is exactly the interruption the corner
 * exists to avoid.
 */
function hostFor(kind, sticky) {
    return sticky && (kind === "evidence" || kind === "objection")
        ? evidenceStage()
        : container();
}

/**
 * Start the stack under whatever this module has put at the top of the screen.
 *
 * The offset used to be a flat 96px in the stylesheet, which was true for the
 * HUD alone. It is not true once the Despair rows are above it (one per
 * Monokuma, twelve pips each) or the trial floor bar is below it - and a trial
 * is exactly when a sticky evidence card is on screen for minutes at a time,
 * sitting on top of the clock everybody is reading.
 *
 * Measured rather than added up, so a UI module that moves or restyles those
 * widgets is accounted for too. The 96px stays as the fallback for a screen
 * where none of them have rendered yet.
 */
const WIDGET_SELECTORS = ["#drpg-despair", "#drpg-hud"];
const FALLBACK_TOP = 96;
const WIDGET_GAP = 8;

function positionBelowWidgets(el) {
    try {
        /* Under Stained Glass the cards have a tile of their own - bottom-left, cut by the
           curtain (glass.mjs, "note-block") - and the sheet places the stack on it. An inline
           `top` here put the stack just under the clock instead, over the glass and the map. */
        if (document.body.classList.contains("drpg-theme-stained-glass")) { el.style.top = ""; return; }
        let bottom = 0;
        for (const selector of WIDGET_SELECTORS) {
            const widget = document.querySelector(selector);
            if (!widget) continue;
            const box = widget.getBoundingClientRect();
            // A hidden or unrendered widget measures zero and must not count.
            if (box.height > 0) bottom = Math.max(bottom, box.bottom);
        }
        el.style.top = `${Math.round(bottom ? bottom + WIDGET_GAP : FALLBACK_TOP)}px`;
    } catch {
        // A card in the wrong place beats no card at all.
    }
}

/**
 * Retire the oldest cards until the stack fits - non-sticky ones first.
 *
 * Takes the stack it is trimming, because there are two now and they hold
 * different amounts: the corner tile is a fixed piece of glass with room for
 * two short cards, and the evidence stage is sized by its own card.
 */
function trimStack(host = container()) {
    if (host.id === EVIDENCE_ID) { trimEvidence(host); return; }
    const cards = Array.from(host.querySelectorAll(".drpg-popup:not(.leaving)"));
    const droppable = cards.filter(c => !c.classList.contains("drpg-popup-sticky"));
    // Under Stained Glass the stack lives on a tile of the curtain cut for two short cards or one
    // long one (glass.mjs, "note-block"), so two is the most it may hold.
    const glass = document.body.classList.contains("drpg-theme-stained-glass");
    const max = glass ? 2 : MAX_VISIBLE;
    let excess = cards.length - max;

    for (let i = 0; i < excess && i < droppable.length; i++) {
        droppable[i].dispatchEvent(new CustomEvent("drpg-dismiss"));
    }

    /* AND THEN THE OLDEST STICKY ONE (UI-10). The glass tile clips with `overflow: hidden`
       and fills from the bottom, so with two sticky evidence cards on it every later card -
       a refusal, a reply, the time of day - was appended out of sight, and the newest card
       was the one nobody could see until a sticky one was closed by hand. A retired evidence
       card is still in the chat log; a hidden refusal is nowhere. Legacy scrolls, so it keeps
       its sticky cards. */
    excess -= Math.min(excess, droppable.length);
    if (!glass || excess <= 0) return;
    const sticky = cards.filter(c => c.classList.contains("drpg-popup-sticky"));
    for (let i = 0; i < excess && i < sticky.length; i++) {
        sticky[i].dispatchEvent(new CustomEvent("drpg-dismiss"));
    }
}

/**
 * The stage holds TWO pieces of evidence, and the second one is the point.
 *
 * A trial argues by putting one thing beside another - an objection answers a
 * presentation, and reading the two together is the whole move. One at a time
 * would make the objection erase what it was objecting to. Three is a wall of
 * text in the middle of the map, and the chat log still has every card.
 *
 * Oldest first, and by hand rather than by `overflow: hidden`: this stage grows
 * with what is in it, so a card that does not fit is not clipped, it is simply
 * not retired and the stage gets taller. The cap is what keeps that honest.
 */
const MAX_EVIDENCE = 2;
function trimEvidence(host) {
    const cards = Array.from(host.querySelectorAll(".drpg-popup:not(.leaving)"));
    for (let i = 0; i < cards.length - MAX_EVIDENCE; i++) {
        cards[i].dispatchEvent(new CustomEvent("drpg-dismiss"));
    }
}

/**
 * Show a floating, auto-dismissing card on THIS client. Several can stack if
 * things happen close together.
 *
 * @param {string|Element} bodyHtml  Already-escaped HTML, or a ready-made
 *   element to adopt. The element form exists because a copy of a chat card is
 *   a DOM subtree, and serialising it to a string only to have the parser
 *   rebuild it is a round trip that can lose things - a `<li>` outside a list
 *   being the obvious one.
 * @param {object} [options]
 * @param {string} [options.title]     Shown in the header bar. Falls back to the
 *   name of the card's kind - every card gets a bar, see below.
 * @param {"info"|"error"|"evidence"|"objection"} [options.kind]  Only the accent
 *   changes: purple for an ordinary update (default), red for something
 *   refused, gold for evidence, loud red for an Objection.
 * @param {() => void} [options.onClick]   Extra action on click, before the
 *   card dismisses. Used to jump straight to the messenger for a DM reply.
 * @param {boolean} [options.sticky]  Stay until dismissed by hand. Evidence put
 *   in front of the table has to survive being read and argued with, which is
 *   considerably longer than twelve seconds.
 * @param {"hope"|"fear"|"critical"|null} [options.tone]  What the card is about,
 *   when that has a colour of its own. The title bar takes it: gold for Hope,
 *   Blood for Despair, crimson for a Critical. A name rather than a colour, so
 *   the palette stays in the stylesheet where the rest of it lives - see
 *   `.drpg-popup-tone-*` there.
 */
const KINDS = ["info", "error", "evidence", "objection"];

const TONES = ["hope", "fear", "critical"];

export function showPopup(bodyHtml, {
    title = null, kind = "info", onClick = null, sticky = false, tone = null
} = {}) {
    const card = document.createElement("div");
    card.className = `drpg-popup drpg-popup-${KINDS.includes(kind) ? kind : "info"}${
        sticky ? " drpg-popup-sticky" : ""}${
        TONES.includes(tone) ? ` drpg-popup-tone-${tone}` : ""}`;

    // EVERY CARD HAS A TITLE BAR.
    //
    // It used to be optional, on the reasoning that a generic label helps
    // nobody - and the result was two kinds of card on screen: the ones with
    // the module's Bone bar across the top and the ones that were a paragraph
    // floating in a box. The bar is what makes a card read as this module's,
    // and a card with no title of its own can still say what kind of thing it
    // is. It also carries the close button, which a card without a bar simply
    // did not have.
    if (!title) title = game.i18n.localize(`DRPG.Popup.kind.${KINDS.includes(kind) ? kind : "info"}`);

    {
        const head = document.createElement("div");
        head.className = "drpg-popup-title";
        head.textContent = title;

        const close = document.createElement("button");
        close.type = "button";
        close.className = "drpg-popup-close";
        close.innerHTML = `<i class="fa-solid fa-xmark" inert></i>`;
        close.setAttribute("aria-label", game.i18n.localize("DRPG.Panel.close"));
        head.append(close);
        close.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
        });

        card.append(head);
    }

    const body = document.createElement("div");
    body.className = "drpg-popup-body";
    if (bodyHtml instanceof Element) body.append(bodyHtml);
    else body.innerHTML = bodyHtml ?? "";
    card.append(body);

    const host = hostFor(kind, sticky);
    host.append(card);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        card.classList.add("leaving");

        // WAIT FOR THE TRANSITION, NOT FOR A NUMBER.
        //
        // This was `setTimeout(…, 300)`, and 300 was a guess at a duration
        // written in the stylesheet - two files holding the same fact, which is
        // how they drift. Worse: it was unreachable. A reader who asks their
        // operating system to stop animations gets the tokens zeroed, the
        // transition never runs, and a hardcoded timeout would still have held
        // a finished card on screen for a third of a second.
        //
        // The timeout that remains is a backstop and nothing else. A card
        // dismissed while its tab is in the background gets no `transitionend`
        // at all - browsers do not run transitions nobody can see - and a card
        // that never leaves the DOM is a leak. Generous enough never to cut a
        // real transition short, short enough that nothing piles up.
        let gone = false;
        const remove = () => {
            if (gone) return;
            gone = true;
            card.remove();
            /* The stage is a box in the middle of the screen. Empty, it has
               nothing to draw and nothing to say, so it goes rather than
               sitting there as an invisible `role="status"` region. The corner
               tile is the opposite case and stays: it is a cut pane of the
               curtain whether or not anything is on it. */
            const stage = document.getElementById(EVIDENCE_ID);
            if (stage && !stage.querySelector(".drpg-popup")) stage.remove();
        };
        card.addEventListener("transitionend", event => {
            if (event.target === card) remove();
        });
        setTimeout(remove, Math.max(SNAP(), 0) + 1000);
    };

    // So `trimStack` can retire this card without holding a reference to its
    // closure. Everything a card knows about closing lives in `dismiss`.
    card.addEventListener("drpg-dismiss", dismiss);
    trimStack(host);

    // Click-anywhere-to-dismiss is right for a notification and wrong for a card
    // somebody is reading: a sticky one closes only from its own button, unless
    // the caller gave it something to do on click.
    if (!sticky || onClick) {
        card.addEventListener("click", () => {
            onClick?.();
            dismiss();
        });
    }

    requestAnimationFrame(() => card.classList.add("visible"));

    // EVIDENCE LANDS. IT DOES NOT APPEAR.
    //
    // An ordinary card slides down a few pixels and fades in, which is right
    // for a receipt: it is information, it can be ignored, and it will retire
    // by itself in twelve seconds. Evidence in a Class Trial is the opposite of
    // all three. Somebody has put a fact in front of the table and the table has
    // to deal with it, so it arrives from the side, overshoots, and stops hard -
    // Danganronpa's own grammar, where nothing eases into frame.
    //
    // Over the beat, once, on the card that just arrived. Nothing waits for it:
    // the card is already in the DOM, already clickable, already readable, and
    // this runs on top of a card that is fully there.
    if (kind === "evidence" || kind === "objection") {
        const from = kind === "objection" ? "120%" : "60%";
        play(card, [
            { transform: `translateX(${from}) scale(1.04)`, opacity: 0, offset: 0 },
            { transform: "translateX(-4%) scale(1.02)", opacity: 1, offset: 0.55 },
            { transform: "translateX(2%) scale(0.995)", opacity: 1, offset: 0.78 },
            { transform: "translateX(0) scale(1)", opacity: 1, offset: 1 }
        ], BEAT(), ARRIVE());
    }

    if (!sticky) setTimeout(dismiss, AUTO_DISMISS_MS);
    return dismiss;
}

/**
 * A card that says "waiting on the GM", and the function that takes it down.
 *
 * A player who asked for a ruling used to get either a toast that faded in
 * five seconds or nothing at all, and then sat for minutes unable to tell a
 * GM reading the question from a socket that had dropped it. Sticky, so it
 * stays until the answer comes; closable, so it never traps anybody.
 */
export function showWaiting(text, title = null) {
    const dismiss = showPopup(`<p>${text}</p>`, { sticky: true, title, kind: "info" });
    return () => {
        try {
            dismiss?.();
        } catch {
            // Already gone.
        }
    };
}

/* ==========================================================================
 * CATCH-ALL - any DRPG whisper reaching a non-GM player becomes a popup too
 * ========================================================================== */

export function registerPopups() {
    Hooks.on("createChatMessage", onCreateChatMessage);
}

/**
 * Every module message surfaces in the middle of the screen, for everybody it
 * was addressed to - GMs included.
 *
 * The old rule was "players only, whispers only". That left the GM reading a
 * sidebar for the half of this module that talks to them exclusively - every
 * ruling request, every Remnant placed, every Despair Call receipt, the entire
 * murder engine's commentary - while the players got cards. During an incident
 * the chat log is the last place anyone is looking.
 *
 * "Ours" is decided by the marker `utils.mjs` stamps on the three helpers every
 * module message goes through, not by sniffing the content: half of these are a
 * bare heading and a paragraph with nothing to recognise them by.
 */
async function onCreateChatMessage(message) {
    if (!message.getFlag(MODULE_ID, MESSAGE_FLAG)) return;

    // Surfaces that already present themselves, and must not be shown twice.
    //
    //   the messenger  raises its own card, or appends to an open window
    //   `popupKind: "none"`  the poster is calling `showPopup` itself, with a
    //                        richer card than this generic one - the Class
    //                        Trial's sticky evidence card is the case in point
    if (message.getFlag(MODULE_ID, MESSENGER_FLAGS.thread)) return;
    const kind = message.getFlag(MODULE_ID, "popupKind") ?? "info";
    if (kind === "none") return;

    // A genuine dice roll should animate and show in chat normally, not get
    // swallowed into a popup card.
    if ((message.rolls?.length ?? 0) > 0) return;

    // A whisper reaches the people it names. A public announcement reaches
    // everyone, which is what makes it an announcement.
    const whisper = message.whisper ?? [];
    if (whisper.length && !whisper.includes(game.user.id)) return;

    // A veiled card is addressed to everybody and readable by its readers
    // alone: wait for the words, and if none came this is not our card.
    if (isVeiled(message)) {
        await wordsOf(message);
        if (!secretHtml(message)) return;
    }

    /* ---- a GM is not an audience for every receipt in the world ----------
     *
     * Most of what this module whispers is a RECORD, not a request: a Remnant
     * was placed, a Search drew a Tier 2 item, a Despair Call was paid for, a
     * clean-up rolled 14 against DC 12. Every one of those raised a card in the
     * middle of the GM's screen, and during a busy time of day - five players
     * acting, an incident running - the GM's screen was the one least able to
     * afford it.
     *
     * The first pass at this only skipped whispers addressed to GMs ALONE,
     * which turned out to be the smaller half of the problem: a player's action
     * card goes through `whisperToOwner` (utils.mjs), and that list is the owner
     * PLUS every GM, so it was never GM-only and every one of the sixty-odd call
     * sites still interrupted the GM. Measured on two clients: a `whisperToGms`
     * record raised nothing, a `whisperToOwner` record raised a card.
     *
     * So a whisper - any whisper - stays in the chat log for the GM, where a
     * record belongs, and the GM's roundup of who did what is the day summary
     * (day-summary.mjs), which already carries a "who" column for GMs. What
     * still interrupts a GM:
     *
     *   public announcements   no whisper list at all; that IS an announcement
     *   messenger threads      handled above; that IS the GM being called
     *   `gmPopup`              the poster says this one is for the GM to answer
     *   `popupForce`           the poster insists, for every recipient
     *
     * Players are untouched: their own cards are the whole point of the popup.
     */
    const forGm = message.getFlag(MODULE_ID, "gmPopup")
        || message.getFlag(MODULE_ID, "popupForce");
    if (game.user.isGM && whisper.length && !forGm) return;

    // A header, when the poster gave one. An action's result card says which
    // action it is about - "Search", "Sabotage" - and that used to be possible
    // only by calling `showPopup` directly, which meant the card appeared on the
    // acting client alone. Carried on the message instead, so every recipient
    // gets the same card with the same title.
    /*
     * THE WORDS, NOT THE STUB. A private card carries its text by socket and
     * the document holds a placeholder, so a notice drawn the moment the
     * document arrives was drawing the placeholder - an empty card. The chat
     * log never showed it because it redraws itself when the words land; the
     * notice is drawn once.
     *
     * `wordsOf` resolves at once for everything that is not a private card,
     * which is nearly everything, so the ordinary notice is not delayed by a
     * tick it does not need.
     */
    showPopup(await wordsOf(message), {
        kind,
        title: message.getFlag(MODULE_ID, "popupTitle") ?? null,
        // Carried on the message rather than worked out here, for the same
        // reason the title is: the card appears on every screen the whisper
        // reached, and only the client that posted it knows what the roll did.
        tone: message.getFlag(MODULE_ID, "popupTone") ?? null
    });
}
