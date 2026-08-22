/**
 * Danganronpa RPG — the one popup every player-facing message uses.
 * ---------------------------------------------------------------------------
 * Search, Work on Project, Sabotage, a refused room crossing, a DM's reply, a
 * Despair Call, the time of day — all of it used to be a line in the sidebar
 * somebody had to notice. This is where all of it surfaces instead: a floating
 * card in the middle of the screen, purple for an ordinary update, red for
 * something that was refused, gold for evidence.
 *
 * Everyone gets them, GMs included. The chat log is still the paper trail, but
 * it is not a notification channel — during an incident nobody is reading it.
 *
 * Two ways something ends up here:
 *   showPopup()              called directly, when the caller wants a title or
 *                            a sticky card — `report()` in action-rolls.mjs,
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
import { MESSAGE_FLAG } from "./utils.mjs";

const CONTAINER_ID = "drpg-popups";
const AUTO_DISMISS_MS = 12000;

/**
 * How many cards may be on screen at once.
 *
 * There was no limit, and the moment that costs you is the one the whole system
 * exists for: during an incident every crisis action produces a card for both
 * participants and the GM, several land inside a second, and the stack grows
 * past the top of the window. The cards that scroll off are the oldest — which
 * is the right ones to lose — but they used to be lost silently and off-screen,
 * so the reader could not tell whether they had missed anything.
 *
 * Oldest are now dismissed as new ones arrive, so the stack stays readable and
 * always shows the most recent events. A sticky card (evidence in a trial) is
 * never one of them — it is on screen because somebody has to read it.
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
 * Start the stack under whatever this module has put at the top of the screen.
 *
 * The offset used to be a flat 96px in the stylesheet, which was true for the
 * HUD alone. It is not true once the Despair rows are above it (one per
 * Monokuma, twelve pips each) or the trial floor bar is below it — and a trial
 * is exactly when a sticky evidence card is on screen for minutes at a time,
 * sitting on top of the clock everybody is reading.
 *
 * Measured rather than added up, so a UI module that moves or restyles those
 * widgets is accounted for too. The 96px stays as the fallback for a screen
 * where none of them have rendered yet.
 */
const WIDGET_SELECTORS = ["#drpg-despair", "#drpg-hud", ".drpg-trial-floor"];
const FALLBACK_TOP = 96;
const WIDGET_GAP = 8;

function positionBelowWidgets(el) {
    try {
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

/** Retire the oldest non-sticky cards until the stack fits. */
function trimStack() {
    const cards = Array.from(container().querySelectorAll(".drpg-popup:not(.leaving)"));
    const droppable = cards.filter(c => !c.classList.contains("drpg-popup-sticky"));
    const excess = cards.length - MAX_VISIBLE;

    for (let i = 0; i < excess && i < droppable.length; i++) {
        droppable[i].dispatchEvent(new CustomEvent("drpg-dismiss"));
    }
}

/**
 * Show a floating, auto-dismissing card on THIS client. Several can stack if
 * things happen close together.
 *
 * @param {string} bodyHtml       Already-escaped HTML.
 * @param {object} [options]
 * @param {string} [options.title]     Shown in a header bar. Omitted entirely
 *   when there is none — most whispers were never built with a clean title to
 *   pull out of them, and a generic placeholder label helps nobody.
 * @param {"info"|"error"|"evidence"|"objection"} [options.kind]  Only the accent
 *   changes: purple for an ordinary update (default), red for something
 *   refused, gold for evidence, loud red for an Objection.
 * @param {() => void} [options.onClick]   Extra action on click, before the
 *   card dismisses. Used to jump straight to the messenger for a DM reply.
 * @param {boolean} [options.sticky]  Stay until dismissed by hand. Evidence put
 *   in front of the table has to survive being read and argued with, which is
 *   considerably longer than twelve seconds.
 */
const KINDS = ["info", "error", "evidence", "objection"];

export function showPopup(bodyHtml, {
    title = null, kind = "info", onClick = null, sticky = false
} = {}) {
    const card = document.createElement("div");
    card.className = `drpg-popup drpg-popup-${KINDS.includes(kind) ? kind : "info"}${
        sticky ? " drpg-popup-sticky" : ""}`;

    // A sticky card must be closeable, so it grows a header even when the
    // caller did not ask for one — otherwise the only way out is the click
    // handler, which is not obvious and is not always harmless.
    if (!title && sticky) title = game.i18n.localize("DRPG.Panel.close");

    if (title) {
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
    body.innerHTML = bodyHtml ?? "";
    card.append(body);

    container().append(card);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        card.classList.add("leaving");
        setTimeout(() => card.remove(), 300);
    };

    // So `trimStack` can retire this card without holding a reference to its
    // closure. Everything a card knows about closing lives in `dismiss`.
    card.addEventListener("drpg-dismiss", dismiss);
    trimStack();

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
    if (!sticky) setTimeout(dismiss, AUTO_DISMISS_MS);
}

/* ==========================================================================
 * CATCH-ALL — any DRPG whisper reaching a non-GM player becomes a popup too
 * ========================================================================== */

export function registerPopups() {
    Hooks.on("createChatMessage", onCreateChatMessage);
}

/**
 * Every module message surfaces in the middle of the screen, for everybody it
 * was addressed to — GMs included.
 *
 * The old rule was "players only, whispers only". That left the GM reading a
 * sidebar for the half of this module that talks to them exclusively — every
 * ruling request, every Remnant placed, every Despair Call receipt, the entire
 * murder engine's commentary — while the players got cards. During an incident
 * the chat log is the last place anyone is looking.
 *
 * "Ours" is decided by the marker `utils.mjs` stamps on the three helpers every
 * module message goes through, not by sniffing the content: half of these are a
 * bare heading and a paragraph with nothing to recognise them by.
 */
function onCreateChatMessage(message) {
    if (!message.getFlag(MODULE_ID, MESSAGE_FLAG)) return;

    // Surfaces that already present themselves, and must not be shown twice.
    //
    //   the messenger  raises its own card, or appends to an open window
    //   `popupKind: "none"`  the poster is calling `showPopup` itself, with a
    //                        richer card than this generic one — the Class
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

    /* ---- a GM is not an audience for every receipt in the world ----------
     *
     * Most of what this module whispers to the GMs is a RECORD, not a request:
     * a Remnant was placed, a Search drew a Tier 2 item, a Despair Call was
     * paid for, a clean-up rolled 14 against DC 12. Every one of those raised a
     * card in the middle of the GM's screen, and during a busy time of day —
     * five players acting, an incident running — the GM's screen was the one
     * least able to afford it. The cards a GM actually has to answer arrive by
     * a different road: a ruling request goes through the messenger thread,
     * which is skipped above and raises its own card.
     *
     * So a GM-only whisper stays in the chat log, where a record belongs, and
     * anything genuinely addressed to a GM still interrupts them:
     *
     *   public announcements   everyone sees them, GMs included
     *   messenger threads      handled above; that IS the GM being called
     *   `popupForce`           the poster insists — the safeword uses this
     *   a player recipient     not a GM-only whisper at all
     */
    const gmOnly = whisper.length && whisper.every(id => game.users.get(id)?.isGM);
    if (game.user.isGM && gmOnly && !message.getFlag(MODULE_ID, "popupForce")) return;

    // A header, when the poster gave one. An action's result card says which
    // action it is about — "Search", "Sabotage" — and that used to be possible
    // only by calling `showPopup` directly, which meant the card appeared on the
    // acting client alone. Carried on the message instead, so every recipient
    // gets the same card with the same title.
    showPopup(message.content, {
        kind,
        title: message.getFlag(MODULE_ID, "popupTitle") ?? null
    });
}
