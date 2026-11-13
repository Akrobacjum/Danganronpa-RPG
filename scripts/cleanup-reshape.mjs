/**
 * The reshape road (E54, the plan's P1): the killer's change asked (`askTransform`, `askTransformChange`), the words
 * bounded (`plainText`), the reshape proposed and ruled on by a GM (`proposeReshape`, `claimRuling`, `applyReshapeRuling`,
 * `declineReshapeRuling`, `ruleReshape`), the Remnant's token found (`findRemnantToken`), the veiled whisper to the
 * killer (`whisperToOwner`), and the clean-up receipt store the Reroll's undo reads too (`RECEIPT_FIELDS`, `keepAttempt`,
 * `forgetAttempt`, `keepAttemptFact`, `recreationDataFor`). Moved out of cleanup.mjs, which re-exports every name it
 * exported and imports `whisperToOwner` back.
 */

import { CLEANUP, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS, REMNANT_TYPES } from "./config.mjs";
import { cardWarn } from "./chat-card.mjs";
import { cleanupAttemptStore } from "./gm-stores.mjs";
import { remnantById, sceneOfRemnant, tieState, remnantData, removeRemnant } from "./remnants.mjs";
import { heldCopiesOf } from "./truth-bullets.mjs";
import { whisperToOwner as whisperToOwnerPlain, plural, whisperToGms, log, cardHead } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";

// Veiled, every one of them: a Stage 6 card's speaker is the killer and its
// audience is the incident, and the document must not say so. See murder.mjs.
export const whisperToOwner = (actor, content, extra = {}) =>
    whisperToOwnerPlain(actor, content, { veiled: true, ...extra });

/* ==========================================================================
 * TAKING A CLEAN-UP BACK - the Reroll's other half
 * --------------------------------------------------------------------------
 * Kept on the GMs' browsers rather than in a world setting, unlike the incident's
 * own receipt in murder.mjs. What it holds is the answer key: the full creation
 * data of a Remnant, including how visible it is and what it really is. Writing
 * that into the murder state would publish it to every player's console - see
 * truth-bullets.mjs for the same reasoning about the ledger.
 *
 * A GM STORE SINCE E08+E28 C3 (1.2.67; audit S05-44): `cleanupAttemptStore`, a row
 * per character. It was a Map on the browser that resolved the attempt, so a GM
 * who reloaded mid-Stage-6 could not replay a clean-up, and another GM never
 * could. A row is written whole when an attempt ends (`keepAttempt`), amended by
 * the reshape ruling that fills in what it changed, and dropped by the undo and by
 * an attempt that ends without one (`forgetAttempt`).
 * ========================================================================== */

/**
 * Every field of a receipt, each written, so a row holds one attempt's and nothing of the one before it.
 * `proposal` is a reshape's words as the card put them (`proposeReshape`); `ruled` is never on a
 * receipt - the ruling writes it (`claimRuling`) - and is listed so a new attempt clears it.
 */
const RECEIPT_FIELDS = ["actorId", "tokenId", "attempt", "free", "stressBefore", "stressAfter", "stressMoved",
    "erased", "leftBehind", "transformed", "handedBack", "proposal", "ruled"];

/**
 * What a character's last clean-up attempt did, as the GMs' store holds it; null for none.
 * Exported for the Reroll's question before its payment (reroll.mjs `replayRefusal`).
 */
export async function attemptOf(actorId) {
    await cleanupAttemptStore.whenHydrated();
    return cleanupAttemptStore.get(actorId ?? "") ?? null;
}

/**
 * The receipt of an attempt, over whatever the row held. A reshape keeps it twice - once before its
 * card goes (`proposeReshape`), once when the attempt ends - and a ruling may land between the two
 * (E09 C10, 08.10.2026): its `ruled`, its `transformed`, a decline's `erased`. So the second write
 * of the SAME attempt leaves what the receipt does not hold as the row has it, and only a new
 * attempt nulls every field.
 */
export function keepAttempt(receipt) {
    const again = cleanupAttemptStore.get(receipt.actorId)?.attempt === receipt.attempt;
    return cleanupAttemptStore.patch(receipt.actorId,
        Object.fromEntries(RECEIPT_FIELDS.map(f => [f, receipt[f] ?? (again ? undefined : null)])));
}

/** No receipt: the last attempt is not this character's to take back any more. */
export async function forgetAttempt(actorId) {
    await cleanupAttemptStore.whenHydrated();
    if (cleanupAttemptStore.has(actorId)) await cleanupAttemptStore.drop(actorId);
}

/**
 * The attempt a clean-up roll made, on the GMs' bookmark of that roll (E08+E28 C2): the
 * receipt's `attempt` id, which a reshape card carries too. Only once the attempt is the one
 * the GMs keep - a road that refused kept none. A replay writes its own attempt over the
 * first, as it replaces the first's receipt in the store.
 */
export async function keepAttemptFact(rolls, roll, actorId, receipt) {
    if (cleanupAttemptStore.get(actorId)?.attempt !== receipt.attempt) return;
    await rolls.noteFactOn(roll, { cleanupAttempt: receipt.attempt });
}

/**
 * Enough to build this Remnant again where it stood, with everything it knew.
 *
 * `placeRemnant` takes exactly this shape, so recreating is handing the flags
 * back rather than reconstructing them from a summary.
 *
 * THE TOKEN'S ID COMES BACK TOO (E08+E28 C3, 03.10.2026; audit S05-07). It was
 * the one thing that did not: the undo re-placed the trace without it, so
 * Foundry minted a new one and the replay that followed looked for the old id -
 * "vanished", the trace standing, the Sanity charged. `_id` here and `keepId` in
 * `undoLastCleanup` put it back under the id it had, so what keys off the id
 * holds as it was: a Truth Bullet's `remnantId`, the already-copied check that
 * stops one character copying one trace twice, and the ledger row's key.
 */
export function recreationDataFor(token) {
    // FROM THE LEDGER, NOT THE TOKEN (CASE-06). Since the answer key moved
    // off the tokens a token carries only `isRemnant`, and reading the flags
    // here brought every trace back as an Evident Prep Remnant with no
    // source, no room, no stamp and an explicit "not tied" - a Reroll that
    // rewrote the evidence. Captured before `removeRemnant` tombstones the row.
    const d = remnantData(token);
    if (!d) return null;
    return {
        _id: token.id,
        x: token.x,
        y: token.y,
        sceneId: token.parent?.id ?? null,
        type: d.type,
        visibility: d.visibility,
        faint: Boolean(d.faint),
        reinforced: Boolean(d.reinforced),
        // Three states (E09 C4): put back as it stood, undecided included (`placeRemnant`'s `keepId`).
        tiedToCrime: tieState(d.tiedToCrime),
        note: d.note ?? "",
        action: d.action ?? "manual",
        subject: d.subject ?? "",
        pointsAt: d.pointsAt ?? null,
        sourceActor: d.sourceActor ?? null,
        sourceName: d.sourceName ?? "",
        itemIdentity: d.itemIdentity ?? null,
        room: d.room ?? null,
        chapter: d.chapter ?? null,
        // And of which season (E11 C12): `placeRemnant` keeps it for a trace put back under its id.
        epoch: d.epoch ?? null,
        day: d.day ?? null,
        timeOfDay: d.timeOfDay ?? null,
        // How old it is: a trace put back is not a fresh one (E03 third review).
        placedAt: d.placedAt ?? (token.document ?? token)._stats?.createdTime ?? null,
        // What a player was to be shown, re-applied after re-placing.
        public: d.public ?? null
    };
}

/** One trace by id, from whichever scene it is on: its ref (remnants.mjs `remnantById`, E60 C1b), not its token. */
export function findRemnantToken(tokenId) {
    if (!tokenId) return null;
    const scene = sceneOfRemnant(tokenId);
    return scene ? remnantById(scene.id, tokenId) : null;
}

/**
 * G-20: on a critical, erase it - or leave something arguing for another story.
 *
 * ASKED HERE, NOT GM-SIDE, and for the reason a critical Strike's target is:
 * this is the killer's decision about the story they are telling, and the GM's
 * client has no way to guess it. The dice are still on screen when it opens.
 *
 * ERASE IS NO LONGER WHAT ENTER PRESSES (E09 C11, 08.10.2026; audit S05-50).
 * It was the first button and the default, on the argument that a player who
 * did not want a second decision got the ordinary answer by pressing on - and
 * Enter in the name field, pressed by a player moving on to the description,
 * erased the trace they were halfway through rewriting. Enter in a field moves
 * to the next one now (`enterMovesOn`), "Leave something else" is the first
 * button, so what a browser's own submission presses can never be the erase,
 * and the player who wants no second decision closes the window, which has
 * always meant the same erase.
 *
 * AN UNFINISHED FORM ASKS AGAIN. One field filled and "Leave something else"
 * pressed used to warn and answer null - which is the erase, so the trace went
 * while the toast asked for the second field. The window opens again holding
 * what was typed; Erase and closing are the ways out.
 *
 * THE SAME RESHAPE AS THE TAMPER ROAD, ASKED LATER (Dawid, 29.08). It used to
 * offer a type menu, and it stopped for the reason argued in
 * `CLEANUP.transformAction`: the lie a killer tells is a sentence. What this
 * road keeps that the other does not is the BAND - a critical earned the right
 * to say how loudly the fake reads, which is a real choice and the reward for
 * rolling that well. Exported for the suite.
 *
 * @returns {Promise<object|null>} `{ name, text, visibility }`, or null for "erase it".
 */
export async function askTransform(actor) {
    const { REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
    const rules = CLEANUP.transform ?? {};
    const bands = rules.visibilities ?? [];
    const limits = CLEANUP.transformAction?.limits ?? {};
    if (!bands.length) return null;

    let typed = { name: "", text: "", visibility: bands[0] };
    for (;;) {
        const options = bands
            .map(key => `<option value="${key}"${key === typed.visibility ? " selected" : ""}>${
                foundry.utils.escapeHTML(REMNANT_VISIBILITY_LABELS[key] ?? key)}</option>`)
            .join("");

        // On the kit's frame (E21 C5a): Leave something else on the GM's road (E22 C5c, D11: a GM approves the story
        // before it lands, `proposeReshape`) and first in the tree, so Enter never erases (E09 C11); Erase a secondary
        // (it answers null, as a close does).
        const picked = await drpgWindow({
            title: game.i18n.localize("DRPG.Cleanup.transformTitle"),
            classes: ["drpg-panel", "drpg-narrow"],
            body: `<form>
                <p>${game.i18n.localize("DRPG.Cleanup.transformIntro")}</p>
                ${reshapeFields(limits, typed)}
                <label>${game.i18n.localize("DRPG.Cleanup.transformVisibility")}
                    <select name="visibility">${options}</select></label>
                <p class="notes">${game.i18n.localize("DRPG.Cleanup.transformNote")}</p>
            </form>`,
            footer: {
                gmRoute: [{
                    action: "change", label: game.i18n.localize("DRPG.Cleanup.transformChange"),
                    callback: (e, b, d) => ({
                        name: d.element.querySelector("[name=name]").value,
                        text: d.element.querySelector("[name=text]").value,
                        visibility: d.element.querySelector("[name=visibility]").value
                    })
                }],
                secondary: [{
                    action: "erase", label: game.i18n.localize("DRPG.Cleanup.transformErase"),
                    callback: () => null
                }]
            },
            render: (event, dialog) => enterMovesOn(dialog),
            rejectClose: false
        });

        // Erase answers "erase" (its callback's null falls back to the action in DialogV2;
        // the end review's correctness m3 found this saying null), closing the window
        // null - the same outcome, and it should be: backing out of a bonus question must
        // not cost the critical that earned it.
        if (!picked || picked === "erase") return null;

        const name = plainText(picked.name, limits.name ?? 60);
        const text = plainText(picked.text, limits.text ?? 400);
        if (name && text) return { name, text, visibility: picked.visibility };
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.reshapeNeedsBoth"));
        typed = { name: picked.name ?? "", text: picked.text ?? "", visibility: picked.visibility ?? bands[0] };
    }
}

/** The two fields of a reshape, holding what was typed when the window opens again. */
function reshapeFields(limits, typed = {}) {
    const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
    return `<label>${game.i18n.localize("DRPG.Cleanup.reshapeName")}
                <input type="text" name="name" maxlength="${limits.name ?? 60}" value="${esc(typed.name)}" autofocus
                    placeholder="${game.i18n.localize("DRPG.Cleanup.reshapeNamePlaceholder")}" /></label>
            <label>${game.i18n.localize("DRPG.Cleanup.reshapeText")}
                <textarea name="text" rows="3" maxlength="${limits.text ?? 400}"
                    placeholder="${game.i18n.localize("DRPG.Cleanup.reshapeTextPlaceholder")}">${esc(typed.text)}</textarea></label>`;
}

/**
 * Enter in a reshape's one-line fields moves to the next field, and never answers the window.
 *
 * WHY THESE TWO WINDOWS DO IT THEMSELVES (E09 C11, 08.10.2026; audit S05-50). DialogV2 puts the content and the
 * footer in one form and its footer buttons are submits, so Enter in the name field is the browser's implicit
 * submission, which presses the first submit in tree order (read in the code and in `guardTextFields`'s note, not
 * measured here: jsdom does not submit a form on a synthetic key). In the critical's window that was Erase, and in
 * the Tamper's it sent the description empty. `guardTextFields` (utils.mjs) has no rule for "move on": its
 * `data-drpg-enter` presses a button, which is the very thing this must not do. The description is a textarea, where
 * Enter is a new line; the band's select moves on to the footer, whose focused button Enter then presses as a
 * button, on purpose.
 */
function enterMovesOn(dialog) {
    const root = dialog?.element;
    if (!root) return;
    root.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) return;
        const field = event.target;
        if (!field?.matches?.("input, select")) return;
        event.preventDefault();
        const order = [...root.querySelectorAll("input, textarea, select, footer button")].filter(el => !el.disabled);
        order[order.indexOf(field) + 1]?.focus();
    });
}

/**
 * A player's sentence, made safe to store and print.
 *
 * THIS IS THE ONLY FREE TEXT A PLAYER WRITES INTO THE WORLD in this module, so
 * it is the only place that needs this, and it is worth being exact about what
 * each step is for rather than reaching for a general-purpose "sanitise".
 *
 *   tags stripped   - the value ends up in a token's `name` and in a chat card.
 *                     Foundry escapes most of those paths and this module escapes
 *                     the rest, but a string that has crossed a socket from a
 *                     client should not be relying on every future reader
 *                     remembering to escape it. Removed at the boundary, once.
 *   runs collapsed  - a name made of four hundred newlines is a name that breaks
 *                     the layout of whatever prints it.
 *   length capped   - `CLEANUP.transformAction.limits`. A socket packet is not
 *                     bounded by the `maxlength` on the input that was supposed
 *                     to produce it.
 *
 * Empty in, empty out, and callers read empty as "they did not fill this in".
 */
export function plainText(value, max) {
    return String(value ?? "")
        .replace(/<[^>]*>/g, " ")
        /* AND EVERY ANGLE BRACKET LEFT OVER (E02, 24.09.2026; audit S05-05). The
           pattern above only matches a CLOSED tag, so `<img src=x onerror=alert(1)//`
           - 29 characters, inside the 60 a name may have - came through whole,
           was printed into the GM's secret card by `innerHTML`, and ran there with
           the GM's permissions. Measured. Nothing a killer writes on a trace needs
           either character. */
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, Math.max(0, max));
}

/**
 * Write the killer's story onto a trace. GM-side, and the ONLY writer.
 *
 * Both reshape roads end here - the Tamper action's own (declared before the
 * dice) and the erase road's critical bonus (offered after them) - because the
 * two differ only in when the question is asked. Everything after the answer is
 * the same job, and the file has already been bitten once by two branches that
 * were supposed to stay in step and did not.
 *
 * TWO WRITES, AND THEY ARE DIFFERENT KINDS OF FACT. `retuneRemnant` moves what
 * the trace IS - type and band - which is engine state the GM reads.
 * `setRemnantPublic` moves what it SAYS, which is the answer a finder gets. The
 * ledger's own `label` is untouched by both, so the GM keeps a true reading of
 * a trace the killer has lied about: that asymmetry is the whole point of the
 * remnant architecture and this is the feature that exercises it hardest.
 *
 * The undo snapshot carries both, or a Reroll would put the type back and leave
 * the killer's sentence standing on a roll that no longer produced it.
 *
 * THE TRACE, NOT THE COPIES ALREADY HELD (E09 C9, 08.10.2026; audit S05-24). The words
 * went on through `propagateRemnantPublic` to every Truth Bullet copied from the trace,
 * so an approved reshape renamed and reworded what other players had found and read -
 * measured in scenario 62's phase T at the code before C9 (08.10.2026): p1's copy, found
 * and analysed before p2's reshape, read the reshaped name and words, and so did p2's own.
 * A copy is what its finder found; the reshape is what the next finder finds. The ledger
 * takes the story, the copies keep theirs (`propagate: false`), and the card the GMs
 * approve says how many that is (`reshapeCardParts`). Tier 2 "a reshape leaves the copies
 * already held".
 */
async function reshapeTrace(token, data, {
    name = "", text = "", softer = null, tie = false, receipt = null, done = []
} = {}) {
    const { retuneRemnant, setRemnantPublic, remnantData } = await import("./remnants.mjs");
    const { REMNANT_VISIBILITY_LABELS, REMNANT_TYPES } = await import("./config.mjs");

    const patch = { type: CLEANUP.transformAction?.becomes ?? "resolution" };
    if (softer) patch.visibility = softer;

    /*
     * A TRACE THE KILLER RESHAPED IS THE KILLER'S (D2).
     *
     * Reshaping is the one road that changes what a trace is, so it is also the
     * one road that could launder a tie away. `retuneRemnant` writes the fields
     * it is given and nothing else, so an already-tied trace survives by
     * construction - trap 163's shape. What is added is the other direction: a
     * killer who reshapes an untied trace ties it, because they have now handled
     * it as part of their crime. An innocent doing the same in Tamper leaves it
     * exactly as untied as they found it.
     */
    if (tie && !data.tiedToCrime) patch.tiedToCrime = true;

    /*
     * THE AFTER-ANALYSIS SENTENCE IS NOT TOUCHED, AND THAT IS THE DECISION (T-2).
     *
     * A reshape changes what a trace IS - an Incident Remnant becomes a Tamper
     * Remnant - and what a finder reads about it. It does not change the object,
     * and the GM's sentence about the object goes on being true: a killer who
     * rewrote a smear has not altered what analysing it would reveal. So the
     * `story` below never carries `analyzedText`, and `setRemnantPublic` merges
     * rather than replaces, so the sentence survives the reshape as the GM wrote
     * it. A reader who finds it missing from this patch has found the rule rather
     * than an oversight.
     */
    if (receipt) {
        receipt.transformed = {
            id: token.id,
            sceneId: token.parent?.id ?? null,
            // The tie with the type (E08+E28 C3; audit S05-44): a killer's reshape ties an
            // untied trace (above), and a Reroll that took the reshape back left it tied. As one
            // of its three states since E09 C4 (remnants.mjs `tieState`): undecided goes back
            // undecided, where `Boolean()` put it back as a GM's "not tied".
            from: { type: data.type, visibility: data.visibility, tiedToCrime: tieState(data.tiedToCrime) },
            publicFrom: remnantData(token)?.public ?? null
        };
    }

    await retuneRemnant(token.parent?.id ?? null, token.id, patch);

    // Only the halves they actually filled in. Passing an empty string would
    // overwrite a description the GM had already written for a finder.
    const story = {};
    if (name) story.name = name;
    if (text) story.playerText = text;
    if (Object.keys(story).length) await setRemnantPublic(token, story, { propagate: false });

    done.push(game.i18n.format("DRPG.Cleanup.reshaped", {
        from: `${data.visibilityLabel} ${data.typeLabel}`,
        band: REMNANT_VISIBILITY_LABELS[patch.visibility ?? data.visibility]
            ?? data.visibilityLabel,
        kind: REMNANT_TYPES[patch.type]?.label ?? patch.type,
        // Escaped where it is printed as well as cleaned where it arrived: the card
        // is drawn with `innerHTML` on the GM's screen (S05-05).
        name: foundry.utils.escapeHTML(name || game.i18n.localize("DRPG.Cleanup.reshapeUnnamed"))
    }));
}


/* ==========================================================================
 * A RESHAPE IS A PROPOSAL (N-3, Dawid 21.09)
 * ========================================================================== */

/**
 * The reshape card's two halves (E05 C14, 27.09.2026; audit S05-14). What the player
 * reads: the name and the words they asked for, and whether the dice made the trace
 * quieter. What only the GMs read: what the trace was and would become - its band and
 * category off the ledger ("was/now") - and, for the killer, that approving ties it to
 * the murder. The card goes to the player's own thread (`proposeReshape`, `callGm`), and
 * both lines were in its body: the player read the category an Analyze exists to price,
 * and a line about them in the third person meant for the GM. They are `gmBody` now,
 * which the card on a player's screen leaves out (COMM-06) - and since E06 C7b is not
 * sent to that player's browser at all. Since E06 C8 the card is veiled (`callGm`'s
 * `veiled`): its document names neither the thread nor the player (S05-15). Since E09 C9
 * the GMs' part also counts the Truth Bullets already copied from the trace (`copies`,
 * truth-bullets.mjs `heldCopiesOf`), which an approval leaves as they were found: how many
 * others hold a copy is the answer key's, not the player's. Pure, for the suite.
 *
 * THE BAND AS IT IS (E09 C14, 08.10.2026; audit S05-33). `softer` is the band the reshape
 * writes. On the Tamper road it is always one band quieter (`resolveTransformRoad`); on the
 * erase road's critical it is the band the player picked (`resolveEraseRoad`), which may be
 * the same band, a louder one or three quieter - and the card said "one band harder to spot"
 * for all of them. The sentence is said only of exactly one band quieter; any other band is
 * named ("Band: Hidden").
 */
export function reshapeCardParts(data, { name = "", text = "", softer = null, tie = false, copies = 0 } = {}) {
    const esc = foundry.utils.escapeHTML;
    const becomes = CLEANUP.transformAction?.becomes ?? "resolution";
    const was = `${data.visibilityLabel} ${data.typeLabel}`;
    const now = `${REMNANT_VISIBILITY_LABELS[softer ?? data.visibility]
        ?? data.visibilityLabel} ${REMNANT_TYPES[becomes]?.label ?? becomes}`;
    const oneQuieter = Boolean(softer) && REMNANT_VISIBILITY.indexOf(data.visibility) >= 0
        && REMNANT_VISIBILITY.indexOf(softer) === REMNANT_VISIBILITY.indexOf(data.visibility) + 1;
    const band = !softer ? ""
        : oneQuieter ? game.i18n.localize("DRPG.Cleanup.reshapeRulingQuieter")
            : game.i18n.format("DRPG.Cleanup.reshapeRulingBand", { band: REMNANT_VISIBILITY_LABELS[softer] ?? softer });
    const body = [
        `<strong>${esc(name || game.i18n.localize("DRPG.Cleanup.reshapeUnnamed"))}</strong>`,
        text ? `<br><em>${esc(text)}</em>` : "",
        band ? `<br>${esc(band)}` : ""
    ].join("");
    const gmBody = `<p>${esc(game.i18n.format("DRPG.Cleanup.reshapeRulingWas", { was, now }))}${
        tie ? `<br>${cardWarn(esc(game.i18n.localize("DRPG.Cleanup.reshapeRulingTies")), "span")}` : ""}${
        copies > 0 ? `<br>${esc(plural("DRPG.Cleanup.reshapeRulingCopies", { n: copies }))}` : ""}</p>`;
    return { body, gmBody };
}

/**
 * Ask the GM to rule on a lie, instead of writing it into their evidence.
 *
 * WHAT WAS WRONG. A Tamper that succeeded applied the player's words the moment
 * the dice landed: their name and their sentence went onto the GM's own trace,
 * and the next person through the door read them as the truth of the room. The
 * packet was BOUNDED - `plainText` caps both halves, the visibility list is
 * checked - but bounding is not ruling. Nobody had said yes.
 *
 * Starting a project is the precedent and Dawid named it: the player fills in
 * the form, the form becomes a card, and nothing exists in the world until the
 * GM presses a button. The same three reasons apply here and are stronger,
 * because this writes over something that already exists.
 *
 * THE ROLL AND THE PRICE STAY SPENT. A decline is a ruling, not a refund: they
 * spent the turn and the Sanity scrubbing at a trace, and the critical's
 * Sanity-back is the critical's, not the approval's. So this sits exactly where
 * the write used to sit - after the price, before the report - and the report
 * says the same thing it always said about the dice.
 *
 * WHAT IT DOES NOT DO. It does not touch the Tamper Remnant a failure leaves,
 * the erase road, or the reshape's OWN consequence of becoming a Tamper
 * Remnant. Those are the rules answering; this is a player writing prose.
 */
export async function proposeReshape(actor, token, data, {
    name = "", text = "", softer = null, tie = false, done = [], erases = false, receipt
} = {}) {
    const { body, gmBody } = reshapeCardParts(data, { name, text, softer, tie, copies: heldCopiesOf(token.id) });

    /*
     * THE PROPOSAL IS KEPT BY THE GMS, ON THE ATTEMPT'S ROW, BEFORE THE CARD EXISTS (E09 C10,
     * 08.10.2026). Until this commit the words, the quieter band, the tie and the erase rode on
     * the card's buttons as `data-*`, and the ruling took them off the click: whoever could press
     * Approve chose what Approve wrote, the row knew nothing of a proposal, and a card a GM could
     * press already existed while the row of its attempt was not yet written - the receipt was kept
     * only when the attempt ended, after the card. Now the row holds the proposal from before the
     * card goes, and the buttons carry the attempt alone; the ruling reads what it writes off the
     * row (`claimRuling`). The row is the attempt's own receipt, so a later attempt by the same
     * character replaces it, and a card from the earlier one is refused as a Reroll's is.
     */
    receipt.proposal = { name, text, softer: softer ?? null, tie: Boolean(tie), erases: Boolean(erases) };
    await keepAttempt(receipt);
    const attempt = receipt.attempt;

    const { callGm } = await import("./gm-bridge.mjs");
    const sent = await callGm(actor, {
        title: game.i18n.localize("DRPG.Cleanup.reshapeRulingTitle"),
        room: data.room ?? null,
        body,
        gmBody,
        // Put to the GMs in its player's thread, which is nobody else's to know of (E06 C8).
        veiled: true,
        actions: [
            {
                action: "approveReshape",
                label: game.i18n.localize("DRPG.Cleanup.reshapeApprove"),
                // Lowercase keys only: `data-*` arrives through `dataset`, which
                // lowercases everything, so `tokenId` would read back undefined.
                // What the approval writes is the row's, not the button's (above).
                data: { by: actor.id, scene: token.parent?.id ?? "", trace: token.id, attempt }
            },
            {
                action: "declineReshape",
                label: game.i18n.localize("DRPG.Cleanup.reshapeDecline"),
                /* The trace travels too: on the erase road the dice bought an ERASE and the
                   rewrite was the upgrade the player chose on top of it, so a GM who refuses
                   the story still owes them the erase - which the row's `erases` says. */
                data: { by: actor.id, scene: token.parent?.id ?? "", trace: token.id, attempt }
            }
        ]
    });

    /*
     * A CARD THAT DID NOT GO IS NOT A PROPOSAL, and the player must not be told
     * one is waiting. Same `=== false` care as ACT-15: the messenger answers
     * with a document or with false, and a lie left in limbo with nobody asked
     * is the one outcome this change must not create.
     */
    if (sent === false) {
        await whisperToGms({ tone: "warning", body: `<p>${
            game.i18n.localize("DRPG.Cleanup.reshapeUnsent")}</p>` });
        done.push(game.i18n.localize("DRPG.Cleanup.reshapeUnsentPlayer"));
        return false;
    }

    done.push(game.i18n.format("DRPG.Cleanup.reshapeWaiting", {
        name: foundry.utils.escapeHTML(name || game.i18n.localize("DRPG.Cleanup.reshapeUnnamed"))
    }));
    return true;
}

/** Where a ruling's notices go when nobody asked for them back: this browser's own. */
function tellHere(level, key, data = null) {
    ui.notifications[level](data ? game.i18n.format(key, data) : game.i18n.localize(key));
}

/**
 * ONE RULING PER PROPOSAL, AND IT IS TAKEN BEFORE ANYTHING WAITS (E09 C10, 08.10.2026).
 *
 * Measured at the parent (08.10.2026): Approve and Decline on one card at once both
 * answered true (tier 2, "two rulings of one reshape at once run once"), and in
 * scenario 62 the GM's Approve on its own open copy of the card, pressed after gm2's,
 * ran again and told the player a second time (T9: 3 messages, then 4). Nothing
 * marked a proposal as ruled; each ruling read the row, awaited, and wrote. Here the
 * row is read and marked `ruled` in one synchronous step, so of two rulings on one
 * browser exactly one finds it unmarked; `askReshapeRuling` (bridge-asks.mjs) sends
 * every GM's ruling to the primary, which makes that one browser.
 *
 * The proposal is the row's (`proposeReshape`), and a row that does not hold one for
 * this trace under this attempt is refused: a Reroll's replay, a later attempt by the
 * same character, a chapter's reset. No row is no longer "proves nothing": the row is
 * where the words are, so without it there is nothing to rule on.
 */
function claimRuling(actorId, tokenId, attempt, by, verdict) {
    const row = cleanupAttemptStore.get(actorId ?? "") ?? null;
    const tag = String(attempt ?? "").slice(0, 32);
    if (!row?.proposal || !tokenId || row.tokenId !== tokenId || !tag || row.attempt !== tag) {
        log(`Reshape ruling refused: the GMs hold no proposal of attempt ${tag || "(none)"} on ${tokenId}.`);
        return { refused: "DRPG.Cleanup.reshapeTakenBack", value: false };
    }
    if (row.ruled) {
        const name = game.users.get(row.ruled.by)?.name ?? String(row.ruled.by ?? "");
        log(`Reshape ruling refused: attempt ${tag} was ruled already (${row.ruled.verdict}).`);
        return { refused: "DRPG.Cleanup.alreadyRuled", data: { name }, value: null };
    }
    const marking = cleanupAttemptStore.patch(actorId, { ruled: { by, on: game.user.id, verdict } }, { ifLive: true });
    return { proposal: { ...row.proposal }, marking };
}

/**
 * The GM pressed Approve. NOW the words land.
 *
 * Read fresh rather than from the card: minutes may have passed, and the trace
 * the ruling is about is the trace as it stands when the ruling is made. A
 * chapter sweep, another killer's clean-up or the GM's own hand may have taken
 * it - in which case there is nothing to relabel and both sides are told.
 *
 * THE WORDS ARE THE ROW'S (E09 C10), and still bounded again on arrival: the
 * module's habit is that a field is bounded by the code that uses it rather than
 * by the code that was supposed to produce it. It costs two lines.
 *
 * `tell` is where the notices go: this browser's, or back to the GM who asked the
 * primary to rule (`ruleReshape`); `by` is the GM who pressed.
 */
export async function applyReshapeRuling({ actorId, tokenId, attempt = "" } = {}, { tell = tellHere, by = game.user.id } = {}) {
    if (!game.user.isGM) return null;
    await cleanupAttemptStore.whenHydrated();
    const actor = game.actors.get(actorId) ?? null;
    const token = findRemnantToken(tokenId);
    const data = token ? remnantData(token) : null;
    /*
     * A CARD FROM AN ATTEMPT A REROLL TOOK BACK RULES ON NOTHING (review of
     * stage D). The card carries the attempt it was raised for; a Reroll replays
     * the attempt under a new id, which the row then holds - measured the way the
     * review wrote it: a lost Reroll, then Approve on the older card, used to put
     * the lie on the trace anyway. `claimRuling`, with no wait before it: only a
     * trace that stands and is not reinforced is claimed, and the two refusals
     * below leave the proposal to be ruled on again.
     */
    const claim = data && !data.reinforced ? claimRuling(actorId, tokenId, attempt, by, "approve") : null;
    if (!data) {
        tell("warn", "DRPG.Cleanup.reshapeRulingGone");
        if (actor) await whisperToOwner(actor, `<p>${
            game.i18n.localize("DRPG.Cleanup.vanished")}</p>`);
        return null;
    }

    /*
     * REINFORCED SINCE THE ROLL IS A REFUSAL, and this is the one guard that
     * could not be asked when the dice landed. A GM who has decided in the
     * meantime that this trace is what makes the case solvable has said no to
     * every road that edits it, including one they are being offered a button
     * for.
     */
    if (data.reinforced) {
        tell("warn", "DRPG.Cleanup.reinforced", { what: `${data.visibilityLabel} ${data.typeLabel}` });
        return null;
    }
    if (claim.refused) {
        tell("warn", claim.refused, claim.data);
        return claim.value;
    }
    await claim.marking;

    const { name = "", text = "", softer = null, tie = false } = claim.proposal;
    const limits = CLEANUP.transformAction?.limits ?? {};
    const safeName = plainText(name, limits.name ?? 60);
    const safeText = plainText(text, limits.text ?? 400);
    const quieter = REMNANT_VISIBILITY.includes(softer) ? softer : null;

    const done = [];
    /*
     * THE RECEIPT IS FILLED IN WHEN THE CHANGE HAPPENS, not when it was asked
     * for. A Reroll between the roll and the ruling finds `transformed: null`,
     * which is the truth - nothing had been written yet - and one after the
     * ruling finds the snapshot `reshapeTrace` takes below, written onto the
     * row the roll opened (E08+E28 C3: a GM store now, where it was a Map whose
     * object this wrote through) - and only onto a row still standing.
     */
    const receipt = {};
    await reshapeTrace(token, data, {
        name: safeName, text: safeText, softer: quieter, tie: Boolean(tie),
        receipt,
        done
    });
    if (receipt.transformed) {
        await cleanupAttemptStore.patch(actorId, { transformed: receipt.transformed }, { ifLive: true });
    }

    if (actor && done.length) {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Cleanup.reshapeRulingTitle")
        })}<p>${done.join("</p><p>")}</p>`);
    }
    log(`Reshape approved: ${actor?.name ?? actorId} relabelled a ${
        data.visibility} ${data.type}.`);
    return true;
}

/**
 * The GM pressed Decline. The trace stands, and the player is told so.
 *
 * Nothing to refund, for the reason written at the top of this block: the price
 * bought the attempt, and the attempt happened.
 */
export async function declineReshapeRuling({ actorId, tokenId = null, attempt = "" } = {}, { tell = tellHere, by = game.user.id } = {}) {
    if (!game.user.isGM) return null;
    await cleanupAttemptStore.whenHydrated();
    const actor = game.actors.get(actorId);
    if (!actor) return null;

    // The same claim as the approval, and it matters MORE here: the erase below
    // would otherwise remove a trace a Reroll's replay had left standing.
    const claim = claimRuling(actorId, tokenId, attempt, by, "decline");
    if (claim.refused) {
        tell("warn", claim.refused, claim.data);
        return claim.value;
    }
    await claim.marking;

    /*
     * THE ERASE THE CRITICAL BOUGHT (review of stage D). On the erase road the
     * rewrite was an upgrade the player chose instead of erasing, and N-3 made it
     * a proposal - so a decline used to leave the trace exactly as it was, the
     * critical's erase gone with the story, and nothing telling the player the
     * trace was still there. The GM refuses the story, not the dice: the trace is
     * erased as a plain critical would have erased it, through `removeRemnant`
     * like every erase, with the receipt filled in first so a Reroll can put it
     * back. Read fresh, as the approval reads it: a trace swept or reinforced in
     * the meantime is left alone. No refund, and no price call - the critical's
     * hand-back already ran when the dice landed. Whether it erases is the row's
     * `erases` since E09 C10, not the button's.
     */
    let said = "DRPG.Cleanup.reshapeDeclined";
    if (claim.proposal.erases) {
        const token = findRemnantToken(tokenId);
        const data = token ? remnantData(token) : null;
        if (data && !data.reinforced) {
            await cleanupAttemptStore.patch(actorId, { erased: recreationDataFor(token) }, { ifLive: true });
            await removeRemnant(token);
            said = "DRPG.Cleanup.reshapeDeclinedErased";
        }
    }

    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Cleanup.reshapeRulingTitle")
    })}<p><em>${foundry.utils.escapeHTML(game.i18n.format(
        said, { name: game.users.get(by)?.name ?? game.user.name }))}</em></p>`);
    tell("info", "DRPG.Cleanup.reshapeDeclinedGm", { name: actor.name });
    return true;
}

/**
 * A ruling on a reshape card, on the primary GM's browser (E09 C10; `cleanup.ruling`
 * in gm-bridge.mjs). Answers what the ruling answered and the notices it raised, as
 * `[level, key, data]`, for the GM who pressed to be shown on their own screen. `by`
 * is that GM's id.
 */
export async function ruleReshape({ actorId, tokenId, attempt, verdict } = {}, by = game.user.id) {
    const told = [];
    const tell = (level, key, data = null) => { told.push([level, key, data]); };
    const asked = { actorId, tokenId, attempt };
    const value = verdict === "approve" ? await applyReshapeRuling(asked, { tell, by })
        : verdict === "decline" ? await declineReshapeRuling(asked, { tell, by })
            : null;
    return { value, told };
}

/**
 * What are you trying to make this look like? Asked BEFORE the dice (Z5).
 *
 * The erase road's `askTransform` is a reward, so it comes after a critical.
 * This one is the action's content: you declare the lie, then find out whether
 * you told it well. Cancelling here costs nothing, which is why it is asked
 * before the action is charged.
 *
 * TWO FIELDS, AND THEY ARE THE LIE ITSELF (Dawid, 29.08). The killer writes
 * what the next person through the door will read: a name for the thing, and a
 * sentence about it. There is no type menu any more - see the argument in
 * `CLEANUP.transformAction` - and there is no "just make it quieter" option,
 * because that was the other half of a choice the menu created.
 *
 * BOTH ARE REQUIRED. A reshape with nothing written in it is not a quiet
 * reshape, it is a player who pressed the wrong button: the action would charge
 * Sanity and a turn to leave the trace saying exactly what it said before.
 * Cancelling here costs nothing, which is the reason this is asked before the
 * action is charged at all - and an unfinished form asks again rather than
 * cancelling (E09 C11, 08.10.2026; audit S05-50): Enter in the name field
 * pressed "Reshape it" with the description empty, and the warning that
 * followed threw away the name that had been typed. Enter moves on now
 * (`enterMovesOn`), and the window opens again holding what was written; the
 * GM's side holds the same rule (`resolveTransformRoad`).
 *
 * @returns {Promise<{name: string, text: string}|null>} null when they backed out.
 */
export async function askTransformChange(actor) {
    const limits = CLEANUP.transformAction?.limits ?? {};

    let typed = { name: "", text: "" };
    for (;;) {
        // On the kit's frame (E21 C5a); Reshape it on the GM's road (E22 C5c, D11): the words wait for a GM's yes.
        const picked = await drpgWindow({
            title: game.i18n.localize("DRPG.Cleanup.transformAction"),
            classes: ["drpg-panel", "drpg-narrow"],
            body: `<form>
                <p>${game.i18n.localize("DRPG.Cleanup.transformActionIntro")}</p>
                ${reshapeFields(limits, typed)}
                <p class="notes">${game.i18n.localize("DRPG.Cleanup.transformActionNote")}</p>
            </form>`,
            footer: {
                gmRoute: [{
                    action: "go", label: game.i18n.localize("DRPG.Cleanup.transformGo"),
                    callback: (e, b, d) => ({
                        name: d.element.querySelector("[name=name]").value,
                        text: d.element.querySelector("[name=text]").value
                    })
                }],
                close: "cancel"
            },
            render: (event, dialog) => enterMovesOn(dialog),
            rejectClose: false
        });

        if (!picked || picked === "cancel") return null;

        const name = plainText(picked.name, limits.name ?? 60);
        const text = plainText(picked.text, limits.text ?? 400);
        if (name && text) return { name, text };
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.reshapeNeedsBoth"));
        typed = { name: picked.name ?? "", text: picked.text ?? "" };
    }
}
