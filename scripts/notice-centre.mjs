/**
 * Danganronpa RPG - the notices that take the middle of the screen (1.2.124 line UI; the owner's request of 22.11.2026,
 * OWNER-124-NOTICES: "co ważniejsze powiadomienia jako pop upy na ekranie do recznego zamykania (np wynik akcji, czy fail
 * na shadow, odkrycie zepsutego zamka do pokoju itd). Takie powiadomienia nie pojawialyby sie w lewym dolnym rogu, ale
 * dalej bylyby w historii powiadomien").
 * ---------------------------------------------------------------------------
 * ONE CLOSED LIST. A card asks for the middle by a name (`popupCentre: "<name>"` among its module flags), and only a name
 * in `CENTRED_NOTICES` is honoured: popup.mjs's catch-all reads `centredNotice`, and every other card - a name not on the
 * list, `true` as body.mjs wrote it until 1.2.124, anything - stays in the corner. A centred card is drawn and kept as
 * every card is (popup.mjs `showPopup`; its notice history entry is the same), stands on a stage of its own in the middle
 * (`#drpg-notice-centre`), one at a time in the order they came, and is closed by its reader alone.
 *
 * WHO MAY ASK (the GM-writer rule, E62 C5 and E02's `popupForce`): a GM's card, or a card read by its own writer - a
 * player's own result on that player's own screen (the coordinator's default of 22.11.2026: an action's result card is
 * written by the acting player's browser, `whisperToOwner`). A card a player wrote never takes the middle of anybody
 * else's screen: a co-owner of the actor, or any player a console names, gets it in the corner, as before. A console can
 * already draw what it likes on its own screen (`showPopup`), so its own middle is nothing new.
 *
 * WHAT STAYS IN THE CORNER, AND WHY (the report of 22.11.2026 lists it): what the reader did not wait on and need not act
 * on - the time of day, a refusal of a crossing, the messenger's replies (the messenger draws its own), receipts of a
 * Call or a payment, the GMs' records, a Tail's later steps. The middle is for a result a player waits on or a thing that
 * happened to them.
 */
import { cardFlag, cardWriter } from "./secret.mjs";

/** The flag a card asks by: a name of `CENTRED_NOTICES`. */
export const CENTRE_FLAG = "popupCentre";

/**
 * The closed list: name -> what it is and who writes it. Each poster names itself here and stamps its name; R8670 reads
 * that every name has a poster and every poster a name.
 */
export const CENTRED_NOTICES = Object.freeze({
    /* An action's result, the card its player waits on: action-report.mjs `report` (Search, Work on Project, Sabotage,
       Tamper and every action that ends on it), `rollCardFlags` (Observe, Analyze, Listen) and a Tail begun unseen
       (action-tail.mjs `performTail`). Written by the acting player's browser: centred on that player's screen. */
    actionResult: "an action's result card (action-report.mjs `report`, `rollCardFlags`; action-tail.mjs `performTail`)",
    /* A failed Shadow with a consequence: the tailer's card that the target noticed the tail (action-tail.mjs
       `performTail`). The acting player's own card. */
    failedShadow: "a Shadow roll failed and the character was noticed (action-tail.mjs `performTail`)",
    /* A bedroom's lock found picked, forced or breached: the owner's card, now or on walking back in (doors-gm.mjs
       `noteBedroom`, `tellBedroomNotes`). Written by the primary GM. A lock only mended stays in the corner. */
    lockBroken: "a bedroom's lock found picked, forced or breached (doors-gm.mjs `noteBedroom`, `tellBedroomNotes`)",
    /* The body's discovery (body.mjs `runDiscovery`), centred since E62 C5. Written by a GM. */
    bodyFound: "a body found (body.mjs `runDiscovery`)",
    /* The time of day's summary on the GM's screen (day-summary.mjs), centred since E62 C5: drawn by its own
       `showPopup(..., { centre: true })` on that screen alone, not through the catch-all. */
    daySummary: "the time of day's summary on the GM's screen (day-summary.mjs)"
});

/** The flags that ask for the middle by `name`, to spread into a card's module flags. Throws on a name not on the list. */
export function centreFlag(name) {
    if (!Object.hasOwn(CENTRED_NOTICES, name)) throw new Error(`notice-centre: "${name}" is not a centred notice`);
    return { [CENTRE_FLAG]: name };
}

/**
 * Whether `message` takes the middle of `reader`'s screen: its name is on the list, and a GM wrote it or `reader` did.
 * Pure but for `cardFlag` and `cardWriter` (secret.mjs), which read the card's own flags and its writer.
 */
export function centredNotice(message, reader = game.user) {
    const name = cardFlag(message, CENTRE_FLAG);
    if (typeof name !== "string" || !Object.hasOwn(CENTRED_NOTICES, name)) return false;
    const writer = cardWriter(message);
    if (!writer) return false;
    return Boolean(writer.isGM) || (Boolean(reader?.id) && writer.id === reader.id);
}
