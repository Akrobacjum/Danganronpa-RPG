/**
 * THE MODULE'S CHAT CARD (E49 B5a, 11.11.2026; the owner's amend [6]: "upewnijmy sie ze nie wklejamy po prostu
 * powiadomien na czat, ale ze caly czat jest w podobnym stylu").
 *
 * One card from the kit's parts: a header (the glyph, then the title when there is one), the body, a foot. The header
 * is a window's head without its close button - a chat message is closed by nobody. Until E49 a whisper to the GMs that
 * warned of something was a bare `p.drpg-warning` (E21's carried sites, R2035: 55 of them in 33 functions), styled as a
 * dialog's warning line and pasted into the log; they are this card since E49 B5a, and utils.mjs's five posting helpers
 * take one (`whisperToGms({ tone: "warning", body })`).
 *
 * THE WORDS ARE THE CALLER'S, UNCHANGED. The card adds no word of its own: no "Warning" in the head, no tone named in
 * text. A card with no title draws its glyph alone beside the body (a bare head), so what a reader reads - and what
 * secret.mjs carries to whom - is what the site wrote before (E49 B5a's check: the 55 sites' text before and after).
 *
 * THE GLYPH BY ELEMENT KEY (E48 G3). `glyph` is a key of an element config.mjs names - "ACTIONS.observe",
 * "HOPE_CALLS.support", "DESPAIR_CALLS.motive", "CRISIS_ACTIONS.strike" - drawn with that element's own icon, or a face
 * of CARD_FACES; with none, the tone's. The mark is a Font Awesome class inside a `drpg-` element, which is what
 * pixel-icons.css's FACES rules repaint with the hand-drawn glyph under Stained Glass; Monokuma Legacy keeps Font
 * Awesome (E48 A1, option A). Every face here is one FACES maps (R3510 reads tests-glyphs.mjs), so no card wears a
 * vector icon under the glass.
 *
 * `tone` is one of CARD_TONES - the kit's three boxes' words (ui-kit.mjs `box`): `info`, `warning` (something goes
 * wrong or cannot be taken back if nobody acts) and `secret` (the GMs' words). It is the card's `data-drpg-tone`, and
 * private-rolls.mjs `paintChatCard` copies it onto the message so the log's edge says it too. `title` is text (escaped
 * here); `body` and `foot` are markup, the caller's to escape. An unknown tone or glyph throws: a card that silently
 * fell back would wear the wrong meaning.
 */
import { ACTIONS, HOPE_CALLS, DESPAIR_CALLS, CRISIS_ACTIONS } from "./config.mjs";

export const CARD_TONES = Object.freeze(["info", "warning", "secret"]);

/** The faces a card may name directly (Font Awesome names, each one FACES maps to a glass glyph), and each tone's own. */
export const CARD_FACES = Object.freeze(["circle-info", "triangle-exclamation", "user-secret", "list-check", "scale-balanced", "gavel", "envelope", "bug"]);
export const TONE_FACES = Object.freeze({ info: "circle-info", warning: "triangle-exclamation", secret: "user-secret" });

const ELEMENT_SETS = { ACTIONS, HOPE_CALLS, DESPAIR_CALLS, CRISIS_ACTIONS };

/** The Font Awesome face a glyph key draws with: an element's icon, a CARD_FACES name, or null for none asked. */
export function cardFace(glyph) {
    if (glyph == null || glyph === "") return null;
    const [set, key] = String(glyph).split(".");
    if (key !== undefined) {
        const icon = ELEMENT_SETS[set]?.[key]?.icon;
        if (typeof icon !== "string" || !icon.startsWith("fa-")) throw new Error(`chat-card: no element "${glyph}" with an icon`);
        return icon.slice(3);
    }
    if (!CARD_FACES.includes(glyph)) throw new Error(`chat-card: no face "${glyph}" (faces: ${CARD_FACES.join(", ")})`);
    return glyph;
}

const escape = text => foundry.utils.escapeHTML(String(text));

/**
 * A card's markup: `div.drpg-chat-kit[data-drpg-tone]` > `header.drpg-chat-kit-head` (the glyph `i.drpg-chat-kit-glyph`,
 * then `h3.drpg-chat-kit-title` when titled; a bare head, the glyph alone, when not), `div.drpg-chat-kit-body`, and `footer.drpg-chat-kit-foot`
 * when there is a foot. The title is an `h3` so popup.mjs lifts it into the notice's bar as it lifted the old cards'
 * opening heading.
 */
export function chatCard({ glyph = null, title = null, body = "", foot = null, tone = "info" } = {}) {
    if (!CARD_TONES.includes(tone)) throw new Error(`chat-card: no tone "${tone}" (tones: ${CARD_TONES.join(", ")})`);
    const face = cardFace(glyph) ?? TONE_FACES[tone];
    const mark = `<i class="fa-solid fa-${face} drpg-chat-kit-glyph" aria-hidden="true"></i>`;
    const titled = title != null && String(title).trim() !== "";
    const head = titled
        ? `<header class="drpg-chat-kit-head">${mark}<h3 class="drpg-chat-kit-title">${escape(title)}</h3></header>`
        : `<header class="drpg-chat-kit-head">${mark}</header>`;
    const tail = foot ? `<footer class="drpg-chat-kit-foot">${foot}</footer>` : "";
    return `<div class="drpg-chat-kit" data-drpg-tone="${tone}">${head}<div class="drpg-chat-kit-body">${body ?? ""}</div>${tail}</div>`;
}

/** Whether `content` is a card's spec (an object) rather than markup: what the posting helpers ask. */
export function isCardSpec(content) {
    return content !== null && typeof content === "object" && !Array.isArray(content);
}

/** Markup for a card's spec, or the markup itself. */
export function cardMarkup(content) {
    return isCardSpec(content) ? chatCard(content) : content;
}

/**
 * A warning line inside a card another builder draws - the action card (action-report.mjs `cardHead`), the motive's
 * evidence card, a call's card, a report's list - where the card is not a warning but one of its lines is: `p` (or
 * `span` inline) `.drpg-chat-kit-warn`, the warning tone's ink and edge. Before E49 B5a, `drpg-warning`, a dialog's class.
 */
export function cardWarn(markup, tag = "p") {
    if (tag !== "p" && tag !== "span") throw new Error(`chat-card: a warning line is a p or a span, not "${tag}"`);
    return `<${tag} class="drpg-chat-kit-warn">${markup ?? ""}</${tag}>`;
}
