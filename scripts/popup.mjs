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

import { MODULE_ID } from "./config.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";
import { MESSAGE_FLAG, plural } from "./utils.mjs";
import { play, BEAT, ARRIVE, SNAP } from "./motion.mjs";

import { contentOf, wordsOf, secretHtml, isVeiled } from "./secret.mjs";
const CONTAINER_ID = "drpg-popups";
const EVIDENCE_ID = "drpg-evidence";

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
 * Oldest were dismissed as new ones arrived, so the stack stayed readable and
 * always showed the most recent events.
 *
 * NOW THEY WAIT INSTEAD (22.09, Dawid: "powiadomienia niech nie znikaja, dopoki
 * gracz ich nie zamknie"). Nothing a notice says leaves the screen until the reader
 * closes it: no timer, and a card that does not fit is PARKED rather than dismissed
 * - out of sight, counted on the stack as "+N", and back the moment a card in front
 * of it is closed. The cap is still how many are SHOWN; it stops being how many are
 * kept.
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

/** How many cards a stack SHOWS. The rest wait, parked - see `MAX_VISIBLE`. */
function capacityOf(host) {
    if (host.id === EVIDENCE_ID) return MAX_EVIDENCE;
    // Under Stained Glass the stack lives on a tile of the curtain cut for two short cards or one
    // long one (glass.mjs, "note-block"), so two is the most it may show.
    return document.body.classList.contains("drpg-theme-stained-glass") ? 2 : MAX_VISIBLE;
}

const PARKED = "drpg-popup-parked";

/* Arrival order, kept on each card, because the two stacks lay it out differently: the
   corner tile puts the newest on TOP (see `showPopup`), the evidence stage puts it at
   the bottom. "Oldest" is a fact about time, so it is read off the time. */
let arrivals = 0;
const seqOf = card => Number(card.dataset.drpgSeq) || 0;
const byArrival = (a, b) => seqOf(a) - seqOf(b);

/**
 * Park the oldest cards until the stack fits - non-sticky ones first.
 *
 * Takes the stack it is trimming, because there are two and they show different
 * amounts: the corner tile is a fixed piece of glass with room for two short cards,
 * and the evidence stage holds two pieces of evidence (`MAX_EVIDENCE`).
 *
 * PARKED, NOT DISMISSED (22.09). This retired the oldest cards for good, which was a
 * notice leaving the screen before anybody had read it. A parked card is hidden and
 * kept, in arrival order; `unparkInto` brings the newest of them back as soon as a
 * shown card is closed.
 *
 * Non-sticky ones go first, then sticky ones (UI-10): the glass tile clips with
 * `overflow: hidden` and fills from the bottom, so with two sticky cards on it every
 * later card - a refusal, a reply, the time of day - used to arrive out of sight.
 * The newest card is always one of the cards shown.
 */
function trimStack(host = container()) {
    const shown = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`))
        .sort(byArrival);
    let excess = shown.length - capacityOf(host);
    if (excess > 0) {
        const order = [
            ...shown.filter(c => !c.classList.contains("drpg-popup-sticky")),
            ...shown.filter(c => c.classList.contains("drpg-popup-sticky"))
        ];
        // Never the card that just arrived: it is the newest, and it is why this ran.
        const newest = shown.at(-1);
        for (const card of order) {
            if (excess <= 0) break;
            if (card === newest) continue;
            card.classList.add(PARKED);
            excess--;
        }
    }
    parkWhatDoesNotFit(host);
    markParked(host);
}

/**
 * AND WHAT DOES NOT FIT THE GLASS WAITS TOO, rather than being cut by it (22.09).
 *
 * The corner tile is a fixed pane with `overflow: hidden`, cut for two short cards or
 * one long one. With the newest card on top, two long ones overflowed it at the top -
 * measured at 1920 x 1080, a new notice arrived with its title bar above the glass and
 * only its sentence showing. So while the tile overflows and more than one card is
 * shown, the oldest shown one is parked as well. One card alone never is: a card taller
 * than the tile is capped at the tile and scrolls inside itself.
 *
 * MEASURED ON THE BOXES, NOT ON `scrollHeight`. A card arrives translated down by
 * half a slide, and a transform counts towards a scroll container's overflow: every
 * arrival read as an overflow, and two cards that fitted were parked down to one.
 * The cards do not shrink (`flex: 1 0 auto`), so their heights and the gaps between
 * them add up to more than the tile exactly when they do not fit.
 */
function overflowsGlass(host) {
    if (host.id === EVIDENCE_ID || !document.body.classList.contains("drpg-theme-stained-glass")) return false;
    const shown = host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`);
    if (shown.length < 2) return false;
    const gap = parseFloat(getComputedStyle(host).rowGap) || 0;
    let total = gap * (shown.length - 1);
    for (const card of shown) total += card.offsetHeight;
    return total > host.clientHeight + 1;
}

function parkWhatDoesNotFit(host) {
    let shown = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`)).sort(byArrival);
    while (shown.length > 1 && overflowsGlass(host)) {
        shown[0].classList.add(PARKED);
        shown = shown.slice(1);
    }
}

/** A shown card was closed: bring back the newest parked one, as many as now fit. */
function unparkInto(host) {
    if (!host?.isConnected) return;
    let shown = host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`).length;
    const parked = Array.from(host.querySelectorAll(`.drpg-popup.${PARKED}:not(.leaving)`))
        .sort(byArrival);
    const room = capacityOf(host);
    while (shown < room && parked.length) {
        const card = parked.pop();
        card.classList.remove(PARKED);
        shown++;
        // Back only if it fits beside what is shown - otherwise it waits a little longer.
        if (overflowsGlass(host)) {
            card.classList.add(PARKED);
            break;
        }
    }
    markParked(host);
}

/**
 * The "+N" on the stack: how many notices wait under the ones on screen.
 *
 * On the title bar of the OLDEST shown card, beside its close button: the parked
 * cards are older than everything shown, so they sit next to it in the stack and it
 * is the one they come back beside. One badge per stack, moved rather than multiplied.
 */
function markParked(host) {
    host.querySelectorAll(".drpg-popup-more").forEach(b => b.remove());
    const waiting = host.querySelectorAll(`.drpg-popup.${PARKED}:not(.leaving)`).length;
    if (!waiting) return;
    const oldest = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`))
        .sort(byArrival)[0];
    const top = oldest?.querySelector(".drpg-popup-title");
    if (!top) return;
    const badge = document.createElement("span");
    badge.className = "drpg-popup-more";
    badge.textContent = `+${waiting}`;
    const tip = plural("DRPG.Popup.moreTip", { n: waiting });
    badge.dataset.tooltip = tip;
    badge.setAttribute("aria-label", tip);
    top.insertBefore(badge, top.querySelector(".drpg-popup-close"));
}

/**
 * The stage SHOWS TWO pieces of evidence, and the second one is the point.
 *
 * A trial argues by putting one thing beside another - an objection answers a
 * presentation, and reading the two together is the whole move. One at a time
 * would make the objection erase what it was objecting to. Three is a wall of
 * text in the middle of the map, and the chat log still has every card.
 *
 * Oldest first, and by hand rather than by `overflow: hidden`: this stage grows
 * with what is in it, so a card that does not fit is not clipped, it would simply
 * make the stage taller. The cap is what keeps that honest - and since 22.09 the
 * oldest is parked by `trimStack` like any notice, not dismissed.
 */
const MAX_EVIDENCE = 2;

/**
 * Show a floating card on THIS client, until its reader closes it (22.09). Several
 * can stack if things happen close together; past what the stack shows, the older
 * ones wait parked - see `trimStack`.
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
 * @param {boolean} [options.sticky]  Close only from its own button, not from a
 *   click anywhere on it, and go to the trial's stage when it is evidence. Every
 *   card stays until it is closed now; this is about how it may be closed.
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
    card.dataset.drpgSeq = String(++arrivals);
    /* THE NEWEST ON TOP, AND THE OLD ONES PUSHED UNDER IT (22.09, Dawid: "nowy notice ma
       wypychac pod spod stare"). The corner tile used to append, so a new notice came in
       below the ones already there. It goes in first now; what it pushes past the tile's
       two is parked underneath (`trimStack`). The evidence stage keeps its order: there
       an objection is read AFTER the presentation it answers. */
    if (host.id === EVIDENCE_ID) host.append(card);
    else host.prepend(card);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        card.classList.add("leaving");
        /* The seat it leaves is taken by the newest card that was waiting for one - once
           it has actually gone: a leaving card still takes its space until it is removed,
           and measured beside it nothing would fit. */
        const home = card.parentElement;

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
            unparkInto(home);
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
    // for a receipt: it is information, and it can be ignored until its reader
    // closes it. Evidence in a Class Trial is the opposite of all of that. Somebody has put a fact in front of the table and the table has
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

    /* NO TIMER (22.09). An ordinary card used to leave by itself after twelve seconds,
       which is a notice gone while its reader was looking at the map. */
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
    // `popupForce` only from a GM (E02, audit S11-27): from a player's console it
    // put a card that looks like the module's own in the middle of every screen.
    const forGm = message.getFlag(MODULE_ID, "gmPopup")
        || (message.author?.isGM && message.getFlag(MODULE_ID, "popupForce"));
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
