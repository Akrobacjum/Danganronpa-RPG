/**
 * Danganronpa RPG - putting evidence in front of the table.
 * ---------------------------------------------------------------------------
 * Guide, p. 31: during a Class Trial each player gets three uninterrupted
 * minutes, and the only way to cut somebody off is an Objection - "pod
 * warunkiem, że pokażą Truth Bullet na czacie w Foundry VTT". Showing the
 * evidence is what earns the interruption.
 *
 * So a presentation is TWO things at once, and this file keeps them one object:
 *
 *   the record   a public ChatMessage carrying the card and its flags. It is
 *                the trial's paper trail, it is what the GM's Objection log
 *                reads back, and it survives an export.
 *   the display  every client turns that message into a popup as it arrives -
 *                the chat sidebar is not where anybody is looking during a
 *                trial, and evidence nobody notices may as well not exist.
 *
 * One message, one hook, so the two can never disagree.
 *
 * WHAT GOES ON THE CARD IS WHAT THE PRESENTER KNOWS, and that sentence is the
 * whole rule. Not "public knowledge", which is what this said and which was
 * never quite it: the type on the card is the type THEY see, so an unanalysed
 * bullet presents as Neutral and an analysed one presents as what it turned out
 * to be. Since 1.2.47 the second half of the description goes with it - Analyze
 * buys a sentence about the trace (`analyzedText`), it was already in the
 * presenter's own item window, and leaving it off the card meant a player who
 * had paid for it could not actually say it with the evidence in front of them.
 *
 * Nothing on the card can leak past that, because the parts of a Truth Bullet
 * the holder has not earned are not on the holder's item at all: the real type,
 * the GM's note and the ledger's copy of the analysis live in the answer key
 * (see D6 and truth-bullets.mjs), and `truthBulletData` hands those out on a
 * GM's client only.
 *
 * ANOTHER HOLDER'S COPY IS NOT TOUCHED. Two people can hold copies of one trace
 * with different knowledge, and a presentation does not level them up: knowing
 * is per character, and hearing something said in a trial is not the same as
 * having analysed it. The card is the record that it was said.
 *
 * Present is Class-Trial-only on purpose. It reaches every player at once, and
 * outside the trial the cast is scattered across rooms that are supposed to be
 * separate - the same-room Share button in handover.mjs is the tool for those
 * phases. During the trial everybody is in one place, so a public card is
 * simply what talking looks like.
 */

import { MODULE_ID, TRUTH_BULLET_TYPES, TRIAL } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { SETTINGS, isMutedDead } from "./settings.mjs";
import { truthBulletData, isTruthBullet, bulletDescription, bulletAsHeld } from "./truth-bullets.mjs";
import { showPopup, OVERRULED_FLAG, overruledStamp } from "./popup.mjs";
import { announce, dialogContent, isPrimaryGm, log, error, tableDialog,
    whisperToOwner, serialWrite, serverNow } from "./utils.mjs";
// The price of an interruption, quoted where it is about to be shown (T-1).
import { quotePrice, priceLine, payPrice, refundPrice, paidLine } from "./price.mjs";
// The question alone, with no toast: this decides a button, and a window that
// opens with no GM connected must not warn every player who opens it (audit A16).
import { gmOnline } from "./bridge-guards.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";

import { contentOf } from "./secret.mjs";
const DialogV2 = foundry.applications.api.DialogV2;

/** Flags that make a chat message a presentation. */
export const TRIAL_FLAGS = {
    /** Marks the message as a presented Truth Bullet. */
    present: "presentCard",
    /** True when it was thrown in to interrupt somebody. */
    objection: "objection",
    /** Who presented it, for the GM's log. */
    presenter: "presenter",
    /**
     * Who an objection was aimed at - the actor id, because this one is read
     * back by code (`openObjection`) rather than only printed. `presenter`
     * above is a NAME because it is only ever displayed, and a name survives
     * an actor being deleted after the trial.
     */
    target: "objectionTarget",
    /** The name to print for that target, for the same reason as `presenter`. */
    targetName: "objectionTargetName",
    /**
     * Set by the primary GM when the floor turned this card down (T-1). The card
     * stays where it is - the evidence really was shown - and the log says the
     * interruption did not happen rather than counting one that did not.
     */
    refused: "objectionRefused",
    /**
     * Which Truth Bullet the card is about. Read by the GM, because the card is
     * authored on the player's client and nothing else on it proves there was any
     * evidence at all.
     */
    item: "presentItem",
    /**
     * An Objection waiting for its Truth Bullet (E79 C16, 1.2.79): the card the primary GM posts when a player
     * presses OBJECTION! (`objectOnPrimary`), true until the bullet is on it (`evidenceOnPrimary`) or the seconds to
     * pick it ran out (`withdrawObjectionCard`).
     */
    pending: "objectionPending",
    /**
     * How the primary GM found the target: "now" (speaking), "last" (spoke last; trial-speakers.mjs) or "named"
     * (the player named them, because the primary GM had no voice Room to listen to).
     */
    how: "objectionHow",
    /**
     * The Objection was withdrawn before its Truth Bullet (its seconds out, its picker closed, its floor replaced):
     * the card says so, and the price stays paid.
     */
    withdrawn: "objectionWithdrawn",
    /**
     * The GM overruled this Objection (E70 C2). DISPLAY ONLY: the chat log draws the stamp from it and every screen
     * closes the card (popup.mjs `onUpdateChatMessage`); what the trial knows of the Overrule is the receipt in the
     * trial record (`keepReceipt`), which is what the log, the judgement and the console read.
     */
    overruled: OVERRULED_FLAG,
    /**
     * The question of the debate the card was put on the table in (E70 C3; S18-70), as the floor held it when the card
     * was built - DISPLAY ONLY, as `presenter` is: the GM's log groups its rows by it, and an Objection's own question is
     * read off its receipt where it has one (`keepReceipt`), which the primary writes.
     */
    topic: "debateTopic",
    chapter: "chapter"
};

/** Is the table in session? Present belongs to the trial and nowhere else. */
export function inClassTrial() {
    return getClock().phase === "classTrial";
}

/* ==========================================================================
 * PRESENTING
 * ========================================================================== */

/**
 * Put this bullet on the table: a Present, free, in every mode of the trial.
 *
 * ONE BUTTON, AND SINCE 1.2.79 IT IS ALWAYS A PRESENT (E79 C16; the owner, 17.10.2026). Until then the stage of the
 * trial decided what this window's button was - a Present in discussion, an Objection in a debate or a rebuttal,
 * with a target the player picked from a list - and the evidence came first. The owner turned that round: an
 * Objection is raised first, with the OBJECTION! button on the trial bar (hud.mjs; `raiseObjection` below), aimed
 * at whoever is speaking or spoke last (trial-speakers.mjs), and the Truth Bullet is chosen after it. So the sheet's
 * button only shows the evidence: nobody's turn to speak changes and nothing is paid. The rules that window used to
 * hold - `floorRefusal`, `targetRefusal`, the price and the free Present when it blocks - are the objection's road
 * now, judged on the primary GM (`objectOnPrimary`).
 *
 * @param {Actor} actor
 * @param {Item} item
 */
export async function presentDialog(actor, item) {
    if (!isTruthBullet(item)) return false;

    if (!inClassTrial()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Trial.notInTrial"));
        return false;
    }

    /*
     * THE DEAD DO NOT PRESENT (E10 C16, 1.2.71; audit S06-35). This asked only
     * whether the item was a bullet and whether a trial was running, so a student
     * killed with their bullets kept opened this window and put evidence on every
     * screen, and an Objection of theirs reached the primary GM, which refused it
     * with no word of the death (e10run c16a1/red, 10.10.2026). Refused before the window,
     * with a reason; `presentBullet` asks again for the API's road, and
     * `objectOnPrimary` judges a dead objector on the primary GM. The document's
     * death on this browser is a courtesy, as everything in this window is.
     */
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(actor)) {
        ui.notifications.warn(game.i18n.format("DRPG.Trial.deadCannotPresent", { name: actor.name }));
        return false;
    }

    const data = truthBulletData(item);

    const choice = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Trial.presentTitle", { name: item.name }) },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Trial.presentIntro", {
                name: foundry.utils.escapeHTML(item.name),
                type: foundry.utils.escapeHTML(data.shownLabel)
            })}</p>
            <label>${game.i18n.localize("DRPG.Trial.comment")}
                <textarea name="comment" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Trial.commentPlaceholder")}"></textarea></label>
            <p class="notes">${game.i18n.localize("DRPG.Trial.presentNote")}</p>
        </form>`),
        // The Present first and the default: the `<textarea>` swallows Enter, so the button is the only road in.
        buttons: [
            {
                action: "present",
                label: game.i18n.localize("DRPG.Trial.present"),
                default: true,
                callback: (e, b, d) => ({
                    comment: d.element.querySelector("[name=comment]").value.trim()
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return false;
    const posted = await presentBullet(actor, item, { comment: choice.comment });
    /* SAID WHEN IT WENT OUT (E10 C16, 1.2.71; audit S03-27). The window closed and
       nothing else on the presenter's screen moved - the card lands in the chat
       and the evidence stage, and on a busy screen neither is where they look. */
    if (posted) ui.notifications.info(game.i18n.format("DRPG.Trial.presented", { name: item.name }));
    return posted;
}

/*
 * `objectionBlockedReason` lived here until T-1 (18.09). It was this file's copy
 * of half a rule that lives in trial-floor.mjs, kept in step by hand and
 * described in its own comment as having to "go on mirroring" the other one.
 * `floorRefusal` and `targetRefusal` are that rule, exported once and asked by
 * both sides.
 */

/**
 * Post the card. Built and sent by the presenter's own client - everything on
 * it is already public. An objection card (`objection`) is a GM's alone since
 * 1.2.79 (E79 C16): the API's and the suite's road to `seizeFloor`. A player
 * raises an Objection through the primary GM (`raiseObjection`), and a card of
 * theirs that says it is one is refused there (`registerTrial`).
 */
export async function presentBullet(actor, item, {
    objection = false, comment = "", targetId = ""
} = {}) {
    const data = truthBulletData(item);
    if (!data) return false;

    // The API's road to the card a dead student's window no longer opens (see
    // `presentDialog`; E10 C16).
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(actor)) {
        ui.notifications.warn(game.i18n.format("DRPG.Trial.deadCannotPresent", { name: actor.name }));
        return false;
    }

    /*
     * A PLAYER'S OBJECTION IS NOT A CARD OF THEIRS ANY MORE (E79 C16, 1.2.79). The objection is raised first and
     * proved after, on the primary GM (`objectOnPrimary`), which posts the card itself; a card a player's browser
     * posts with the flag is refused and marked on the primary (`registerTrial`). Said here first, so the API's road
     * on a player's browser is told where the Objection went rather than posting a card the table sees refused.
     */
    if (objection && !game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Trial.objectionByButton"));
        return false;
    }

    const target = objection && targetId ? (game.actors.get(targetId) ?? null) : null;

    /*
     * THE LAST CHEAP PLACE TO STOP AN OBJECTION THAT CANNOT HAPPEN (T-1).
     *
     * The window can stand open while the floor moves under it: somebody else's
     * objection starts, the trial ends, the last GM disconnects, a Monokuma takes
     * the Hope the price was going to use. Past this line the card is posted, and
     * an objection card raises a sticky OBJECTION! popup on every screen in the
     * game before the GM's side can turn it down - so the refusal is worth
     * repeating here even though the dialog already asked.
     *
     * A free Present is not an objection and skips all of it. On a GM's
     * browser alone since 1.2.79 (above).
     */
    if (objection) {
        const { floorRefusal, targetRefusal } = await import("./trial-floor.mjs");
        const why = !inClassTrial() ? game.i18n.localize("DRPG.Trial.notInTrial")
            : floorRefusal()
            ?? targetRefusal(actor.id, targetId)
            ?? (gmOnline() ? null : game.i18n.localize("DRPG.Trial.objectionNoGm"))
            ?? quotePrice(actor, "objection").blocked;
        if (why) {
            ui.notifications.warn(why);
            return false;
        }
    }

    // The debate's question, as the floor holds it now (E70 C3): the card's marker and its flag for the log.
    const { trialFloor } = await import("./trial-floor.mjs");
    const topic = trialFloor()?.topic ?? null;
    try {
        await announce({
            content: buildCard(actor, data, { objection, comment, target, topic }),
            speaker: ChatMessage.getSpeaker({ actor }),
            flags: {
                [MODULE_ID]: {
                    [TRIAL_FLAGS.present]: true,
                    [TRIAL_FLAGS.objection]: objection,
                    [TRIAL_FLAGS.presenter]: actor.name,
                    // What the GM checks the objector is still holding - see
                    // `seizeFloor`.
                    [TRIAL_FLAGS.item]: item.id,
                    [TRIAL_FLAGS.target]: target?.id ?? null,
                    [TRIAL_FLAGS.targetName]: target?.name ?? null,
                    [TRIAL_FLAGS.topic]: topic,
                    [TRIAL_FLAGS.chapter]: getClock().chapter,
                    // This file raises its own sticky card from the
                    // `createChatMessage` hook below; the generic popup layer
                    // must not also throw a plain one on top of it.
                    popupKind: "none"
                }
            }
        });
    } catch (err) {
        error("Could not present the Truth Bullet", err);
        ui.notifications.error(game.i18n.localize("DRPG.Trial.failed"));
        return false;
    }

    log(`${actor.name} ${objection ? "objected with" : "presented"} "${item.name}".`);
    return true;
}

/** The card itself. What the PRESENTER knows - see the note at the top. */
function buildCard(actor, data, { objection, comment, target = null, topic = null }) {
    const hint = TRUTH_BULLET_TYPES[data.shownType]?.hint ?? "";

    const badges = [
        `<span class="drpg-tb-badge type ${data.shownType}">${
            foundry.utils.escapeHTML(data.shownLabel)}</span>`
    ];
    /* FAINT, ON THE SAME RULE THE SHEET USES (`bulletBadges`): beside the type,
       and only once there IS a type, because Faint is the second half of what
       the thing is rather than a fact of its own. `identified` as well as
       `faint` for the reason stated there - a world made before 1.2.47 carries
       the flag on unanalysed bullets until the migration has run. */
    if (data.faint && data.identified) {
        badges.push(`<span class="drpg-tb-badge faint">${
            foundry.utils.escapeHTML(game.i18n.localize("DRPG.TruthBullet.faint"))}</span>`);
    }
    badges.push(`<span class="drpg-tb-badge visibility">${
        foundry.utils.escapeHTML(data.visibilityLabel)}</span>`);
    if (data.chapter !== null) {
        badges.push(`<span class="drpg-tb-badge chapter">${
            game.i18n.format("DRPG.TruthBullet.chapterShort", { n: data.chapter })}</span>`);
    }
    /* The same `room` class the sheet's row uses (`bulletBadges` in sheet.mjs), so
       one fact is one colour wherever it is read. This card keeps its own badge
       list rather than calling that function, and deliberately: it is a chat card
       the whole table sees, so the GM's "Really:" chip and the per-holder "Analyzed
       in vain" mark - both of which `bulletBadges` adds - would be shown to people
       they are not about. */
    if (data.room) {
        badges.push(`<span class="drpg-tb-badge room">${foundry.utils.escapeHTML(data.room)}</span>`);
    }

    return `<div class="drpg-evidence-card${objection ? " objection" : ""}">
        ${objection
            ? `<div class="drpg-objection-banner">${game.i18n.localize("DRPG.Trial.objectionBanner")}</div>`
            : ""}
        <div class="drpg-evidence-who">${whoLine(actor.name, objection && target ? target.name : null)}</div>
        ${topicMarker(topic)}
        <h3 class="drpg-evidence-name">${foundry.utils.escapeHTML(data.name)}</h3>
        <div class="drpg-tb-badges">${badges.join("")}</div>
        ${data.playerText
            ? `<p class="drpg-evidence-text">${foundry.utils.escapeHTML(data.playerText)}</p>` : ""}
        ${data.analyzedText ? bulletDescription("", data.analyzedText) : ""}
        ${hint ? `<p class="drpg-evidence-hint"><em>${foundry.utils.escapeHTML(hint)}</em></p>` : ""}
        ${comment
            ? `<p class="drpg-evidence-comment">"${foundry.utils.escapeHTML(comment)}"</p>` : ""}
    </div>`;
}

/** The debate's question on a card (E70 C3; S18-70): the question the card was put on the table under, or nothing. */
function topicMarker(topic) {
    return topic ? `<p class="drpg-evidence-topic">${game.i18n.format("DRPG.Floor.topicLine", { topic: foundry.utils.escapeHTML(String(topic)) })}</p>` : "";
}

/** The card's first line: who presents, or who objects to whom. Its own function, because a re-point rewrites it alone. */
function whoLine(name, targetName = null) {
    return targetName
        ? game.i18n.format("DRPG.Trial.objectedTo", {
            who: foundry.utils.escapeHTML(name), target: foundry.utils.escapeHTML(targetName)
        })
        : game.i18n.format("DRPG.Trial.presentedBy", { who: foundry.utils.escapeHTML(name) });
}

/*
 * WHAT THE PRIMARY GM MAY PUT ON A PLAYER'S CARD (E79 C16, 1.2.79). Until this stage the card was built on the
 * presenter's own browser, where `truthBulletData` has no GM half to give. The objection's card is filled on the
 * primary GM's (`evidenceOnPrimary`), where it answers the real type, the GM's note and the ledger's analysis too,
 * and `buildCard` reading only the holder's fields was a habit, not a rule. This is the rule: the card is built from
 * these fields and no other, the holder's own copy of what they know (the note at the top of this file), and tier 2's
 * "an Objection's card is one card on the table..." plants an answer key in a bullet and reads the filled card's
 * words and flags for it.
 */
const HOLDER_FIELDS = Object.freeze(["name", "shownType", "shownLabel", "faint", "identified", "visibilityLabel",
    "chapter", "room", "playerText", "analyzedText"]);

/** `truthBulletData`'s answer cut to what its holder knows (`HOLDER_FIELDS`), on any browser. */
export function holderView(data) {
    return data ? Object.fromEntries(HOLDER_FIELDS.map(key => [key, data[key]])) : null;
}

/**
 * An objection's card before its evidence (E79 C16): the banner, who objects to whom, and one line of its state -
 * "pending" while the objector chooses the Truth Bullet, "withdrawn" once it was withdrawn before one (`withdrawObjectionCard`).
 *
 * @param {"pending"|"withdrawn"|"overruled"} state  "overruled" for a pending card the GM overruled (E70 C2)
 */
function objectionStateCard(name, targetName, state, topic = null) {
    const line = game.i18n.localize(state === "withdrawn" ? "DRPG.Trial.objectionWithdrawn"
        : state === "overruled" ? "DRPG.Trial.overruledStamp" : "DRPG.Trial.objectionPending");
    return `<div class="drpg-evidence-card objection ${state}">
        <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Trial.objectionBanner")}</div>
        <div class="drpg-evidence-who">${whoLine(name, targetName)}</div>
        ${topicMarker(topic)}
        ${state === "overruled"
            ? `<div class="drpg-overruled-stamp">${foundry.utils.escapeHTML(line)}</div>`
            : `<p class="drpg-evidence-hint"><em>${foundry.utils.escapeHTML(line)}</em></p>`}
    </div>`;
}

/* ==========================================================================
 * DISPLAY - the same message, on everybody's screen
 * ========================================================================== */

export function registerTrial() {
    // Deliberately NOT an async handler. Foundry throws a hook's return value
    // away, so an `await` in here is a promise nobody is holding: a rejection
    // becomes an unhandled one, invisible in the log.
    //
    // The order matters more than the error handling, though. This used to await
    // the floor seizure BEFORE showing the card, which put the evidence popup on
    // the primary GM's screen one server round-trip late - and not at all if the
    // seizure failed. The person running the trial was the one who missed the
    // card the trial is about. Display first; it cannot fail and cannot wait.
    Hooks.on("createChatMessage", message => {
        if (!message.getFlag(MODULE_ID, TRIAL_FLAGS.present)) return;

        /*
         * ONLY A CARD ITS AUTHOR COULD HAVE POSTED (E02, 24.09.2026; audit S06-34).
         * The sticky OBJECTION! went up on every screen for any message carrying
         * the flag, before anything asked who wrote it - so a player's console
         * could raise "Kaede objects to Shuichi" with invented evidence in somebody
         * else's name. `seizeFloor` below refused the floor, but the table had
         * already seen the card. The same two questions it asks, asked first: the
         * author owns the character the card speaks as, and that character holds
         * the evidence. A GM's card is a GM's to post.
         *
         * Only the POPUP waits on the answer. The card still goes on to
         * `seizeFloor` below, which refuses it and marks it refused - that mark is
         * how the table's log shows a forged objection for what it was, and the
         * suite holds it ("a card posted in somebody else's name").
         */
        const author = message.author;
        let authorised = Boolean(author?.isGM);
        if (!authorised) {
            const speaker = game.actors.get(message.speaker?.actor ?? "");
            const itemId = message.getFlag(MODULE_ID, TRIAL_FLAGS.item);
            authorised = Boolean(author && speaker?.testUserPermission(author, "OWNER")
                && (!itemId || speaker.items.has(itemId)));
        }

        const objection = Boolean(message.getFlag(MODULE_ID, TRIAL_FLAGS.objection));
        /*
         * A PLAYER'S OBJECTION CARD IS NOT A ROAD ANY MORE (E79 C16, 1.2.79). The Objection is raised on the
         * primary GM (`objectOnPrimary`), which posts its card as a GM, so a card a player's browser posts with the
         * flag is a console's or an old client's: no popup, and the primary marks it refused below and tells its
         * owner, as it marked a forged one. A player's Present - no objection flag - is today's, and free.
         */
        const playerObjection = objection && !author?.isGM;

        if (authorised && !playerObjection) showPopup(contentOf(message), {
            title: game.i18n.localize(objection ? "DRPG.Trial.objection" : "DRPG.Trial.evidence"),
            kind: objection ? "objection" : "evidence",
            // Evidence stays up until somebody closes it. A trial argues with a
            // card for minutes, and this is the one popup in the module that is
            // meant to be read rather than noticed.
            sticky: true,
            // Kept in this browser's notice history as evidence, one entry for the card (E81 C4). Its message
            // makes a deletion in the chat log take this sticky card off every screen (popup.mjs
            // `onDeleteChatMessage`, E81 C5); a plain deletion leaves the entry unread and marked deleted
            // (R297, E81 fix r1-G1; the review's O11).
            source: "evidence",
            messageId: message.id
        });

        // Showing the evidence and taking the floor are one act in the guide,
        // so they are one act here. Exactly one client writes it: this hook
        // fires on every GM, and two of them racing on the same setting is how
        // the floor ends up pointing at the wrong person.
        if (!objection || !isPrimaryGm()) return;

        if (playerObjection) {
            serialWrite(SEIZE_KEY, () => refusePlayersCard(message))
                .catch(err => error("Could not mark a player's objection card as refused", err));
            return;
        }
        // The primary's own card of a player's Objection: its floor is `objectOnPrimary`'s, opened after the post.
        if (message.getFlag(MODULE_ID, TRIAL_FLAGS.pending)) return;

        const objectorId = message.speaker?.actor;
        const targetId = message.getFlag(MODULE_ID, TRIAL_FLAGS.target);
        // An objection card with no target cannot open the exchange - there is
        // nobody for the rebuttal to be with. That should be impossible from
        // the dialog, which requires one, so this is the guard for a card
        // posted through the API or left over from before this stage: the
        // evidence still lands, the floor simply does not move.
        if (!objectorId || !targetId) return;

        // Serialised rather than fired and forgotten, and paid for inside - see
        // `seizeFloor` below, which is where every rule about an interruption that
        // costs something lives.
        serialWrite(SEIZE_KEY, () => seizeFloor(message, objectorId, targetId))
            .catch(err => error("Could not open the objection", err));
    });

    /*
     * THE OBJECTION'S CARD IS REDRAWN WHERE IT STANDS (E79 C16, 1.2.79). A player's Objection is one card that
     * changes twice - pending, then filled with its Truth Bullet or withdrawn - and the sticky card on each screen
     * is the one the table reads. A second popup for each change would be three cards and three entries in the
     * notice history for one Objection; the body is rewritten in place instead, and the history follows the card's
     * body to its last words (popup.mjs `watchCard`, R293), one entry. A GM's card only: the GMs write these, and a
     * player's card that changes its words is not redrawn on anybody's screen by this.
     */
    /* THE STAMP OF AN OVERRULE (E70 C2; DB41: "Overruled by the GM"), drawn by the chat log from the card's flag on a
       GM's card: display only, as the flag is - the receipt is the record. */
    Hooks.on("renderChatMessageHTML", (message, element) => {
        if (!message?.getFlag?.(MODULE_ID, TRIAL_FLAGS.overruled) || !message.author?.isGM) return;
        const card = element?.querySelector?.(".drpg-evidence-card") ?? null;
        if (card && !card.querySelector(".drpg-overruled-stamp")) card.append(overruledStamp());
    });

    Hooks.on("updateChatMessage", (message, change) => {
        if (!message.getFlag(MODULE_ID, TRIAL_FLAGS.present) || !("content" in (change ?? {}))) return;
        if (!message.author?.isGM) return;
        const html = contentOf(message);
        for (const card of document.querySelectorAll(".drpg-popup[data-drpg-message]")) {
            if (card.dataset.drpgMessage !== message.id) continue;
            const body = card.querySelector(".drpg-popup-body");
            if (body) body.innerHTML = html;
        }
    });
}

/**
 * A card a player's browser posted with the objection flag, on the primary GM (E79 C16): marked refused - the log
 * shows it for what it was - and its character's owner told where an Objection is raised now, or, for a card in
 * somebody else's name, that it was not theirs. Nothing is paid and the floor does not move.
 */
async function refusePlayersCard(message) {
    if (!isPrimaryGm()) return;
    try {
        await message.setFlag(MODULE_ID, TRIAL_FLAGS.refused, true);
        const actor = game.actors.get(message.speaker?.actor ?? "");
        if (!actor) return;
        const why = message.author && actor.testUserPermission(message.author, "OWNER")
            ? game.i18n.localize("DRPG.Trial.objectionByButton")
            : game.i18n.format("DRPG.Trial.objectionNotYours", { name: actor.name });
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Trial.objectionRefusedWhisper", { why })}</p>`);
    } catch (err) {
        error("Could not mark a player's objection card as refused", err);
    }
}

/*
 * ONE SEIZURE AT A TIME (T-1).
 *
 * Two objection cards can land in the same tick - two players pressing at once,
 * or a player and a macro. Run in parallel they would both read a debate, both
 * pay, and both write the floor: one of them would have bought a minute the other
 * one is holding. Chained, the second runs after the first `writeFloor`, and
 * `floorRefusal` then turns it down on `mode === objection` before anything is
 * charged.
 *
 * ONE KEY OF THE ONE QUEUE SINCE E17 C0 (26.10.2026; session 0's list: "the seizing chain from trial.mjs"). The chain
 * was this file's own promise, and the bridge's Objection (`objectOnPrimary`) held it by hand with a release in a
 * `finally`; both are steps of utils.mjs `serialWrite` under this key now, in the order they were asked, and a step
 * that throws fails only its own caller (tier 0 R991, R45).
 *
 * THE FLOOR'S KEY SINCE E70 C0 (27.10.2026; amend 5 (d)): every write of the floor is a step of it on the primary GM
 * (trial-floor.mjs `floorStep`, which imports it from here), the evidence's fill too (`evidenceOnPrimary`), so a
 * seizure, the heartbeat and a GM's button read and write the floor one after another.
 */
export const SEIZE_KEY = "trial.seize";

/**
 * Take the floor for an objection card, and charge for it.
 *
 * ON THE PRIMARY GM ONLY, and for somebody else's character - which is what
 * shapes every decision in here.
 *
 * WHY THE CHARGE IS HERE AND NOT IN `openObjection` (Dawid, 17.09: "pobranie na
 * glownym MG w hooku karty, tylko gdy openObjection faktycznie odda glos"). That
 * function is on the API and is called by the suite, the harness and macros, and
 * all of those must stay free. This is the one road a player's press travels.
 *
 * WHY IT PAYS BEFORE IT OPENS, AND REFUNDS IF THE FLOOR DID NOT MOVE. Opening the
 * floor awaits a world settings write plus a music refresh, so "quote, then open,
 * then charge" leaves a window in which the price can change under the quote - and
 * an objection that took the floor and charged nothing is the one outcome nobody
 * can undo. `refundPrice` is exact: it hands back the step that paid, a Burst as a
 * Burst, and Hope marked as a refund so the darkening lets it through. So paying
 * first still satisfies "charged only when it really gets the floor", with no human
 * adjudicating anything.
 *
 * THE TWO CHECKS FOUNDRY DOES NOT DO. A chat message's create rule tests only the
 * AUTHOR, so anybody can post a card whose speaker is somebody else's character -
 * and the card body is built entirely client-side, so a bare `ChatMessage.create`
 * with three flags would buy the floor with no evidence at all. Showing the
 * evidence is what earns the interruption (the rule at the top of this file), so
 * the objector must own the character and must still hold the Truth Bullet named on
 * the card.
 *
 * A REFUSED CARD IS MARKED AND STAYS (Dawid, 17.09). The evidence really was
 * shown, and the log says the interruption was turned down rather than quietly
 * counting it as one that happened.
 */
async function seizeFloor(message, objectorId, targetId) {
    // Inside the function as well as in the hook: this is where the rule lives,
    // and a second GM reaching it by any other road must not write the floor.
    if (!isPrimaryGm()) return null;

    const actor = game.actors.get(objectorId);
    if (!actor) return null;

    // The in-step twin (E70 C0): this is a step of SEIZE_KEY, and the public `openObjection` would queue behind it.
    const { floorRefusal, targetRefusal, openObjectionInStep, trialFloor } =
        await import("./trial-floor.mjs");

    /** Mark the card and tell the objector why their minute did not happen. */
    const refuse = async why => {
        try {
            await message.setFlag(MODULE_ID, TRIAL_FLAGS.refused, true);
            if (why) {
                await whisperToOwner(actor, `<p>${game.i18n.format(
                    "DRPG.Trial.objectionRefusedWhisper", { why })}</p>`);
            }
        } catch (err) {
            error("Could not mark an objection as refused", err);
        }
        return null;
    };

    if (!message.author || !actor.testUserPermission(message.author, "OWNER")) {
        return refuse(game.i18n.format("DRPG.Trial.objectionNotYours", { name: actor.name }));
    }

    /*
     * THE DEAD DO NOT OBJECT, AS THE GMS HOLD THE DEATH (E10 C16, 1.2.71; audit S06-35). The
     * objector's window refuses a dead student, but the card is the claim and this is where it is
     * judged. The death is a GM's flag the sheet audit puts back (`deceased`, sheet-audit.mjs
     * GM_FLAGS), so it is read as the GMs hold it (`flagsAsHeld`), not off the document a player's
     * write can have changed until the put-back lands - the same seam as the evidence below. The
     * wait holds up nothing that holds it up, by reading: an objection writes no use's consumption
     * and no roll's card. Refused before anything is paid, and told like every refusal here.
     */
    const { itemAsHeld, flagsAsHeld } = await import("./sheet-audit.mjs");
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(await flagsAsHeld(actor)) || isMutedDead(actor)) {
        return refuse(game.i18n.format("DRPG.Trial.deadCannotPresent", { name: actor.name }));
    }

    /*
     * THE BULLET AS THE GMS HOLD IT (E29 fix r2-H20, 06.10.2026; H18's seam). Whether the card's item is a Truth
     * Bullet is its category, a field the sheet audit judges, so it is read as the GMs hold it (sheet-audit.mjs
     * `itemAsHeld`): an item a player's browser made a bullet a moment before - a write the audit puts back - shows
     * no evidence. Read before anything is paid; the wait holds up nothing that holds it up, by reading: an
     * objection writes no use's consumption and no roll's card. Until this fix (4d1532c, e29run/r2h20red,
     * 06.10.2026) a Tool made a Truth Bullet where the GMs' mark did not see it took the floor, its action paid.
     */
    const itemId = message.getFlag(MODULE_ID, TRIAL_FLAGS.item);
    const item = itemId ? await itemAsHeld(actor, itemId) : null;
    if (!item || !isTruthBullet(item)) {
        return refuse(game.i18n.localize("DRPG.Trial.objectionNoItem"));
    }

    const blocked = floorRefusal() ?? targetRefusal(objectorId, targetId);
    if (blocked) return refuse(blocked);

    const receipt = await payPrice(actor, "objection", { quiet: true });
    if (!receipt) {
        // Nothing moved: `payPrice` re-quotes and charges nothing when the chain
        // has run out. The free Present is offered by the player's own window.
        return refuse(quotePrice(actor, "objection").blocked
            ?? game.i18n.localize("DRPG.Price.noPrice"));
    }

    let opened = null;
    try {
        // The card goes on the floor's stack with the floor it interrupted (E70 C1): C2's Overrule finds it there.
        opened = await openObjectionInStep(objectorId, targetId, { cardId: message.id });
    } catch (err) {
        error("Could not open the objection", err);
    }

    /*
     * RE-READ THE FLOOR, don't trust the answer. `writeFloor` merges a patch and
     * returns the merged object, so a floor another GM closed in the same breath
     * comes back truthy. What matters is who is holding it now.
     */
    if (!opened || trialFloor()?.holderId !== objectorId) {
        await refundPrice(actor, receipt, { quiet: true });
        return refuse(floorRefusal() ?? game.i18n.localize("DRPG.Trial.objectionNoFloor"));
    }

    // The receipt of the price this step took, for the Overrule (E70 C2): the floor it took, as the stack keeps it.
    await keepReceipt(message.id, opened, { objectorId, aimedAt: targetId, paid: receipt });

    // The sound travels as a flag on the whisper rather than being played here:
    // this is the GM's client, and the pip that just moved is the objector's.
    await whisperToOwner(actor,
        `<p>${game.i18n.format("DRPG.Trial.objectionPaid", { what: paidLine(receipt) })}</p>`,
        receipt.pay === "action" ? { flags: { [MODULE_ID]: { sfx: "actionSpent" } } } : {});

    return opened;
}

/*
 * THE RECEIPT OF AN OBJECTION (E70 C2, 27.10.2026; S18-77, E70-09). What the Overrule needs - who objected to whom,
 * what they paid, what they interrupted and with how much time left - was nowhere but the card, which is a chat
 * message: its flags are the poster's, its words are HTML, and a log that read them read whatever a card said. The
 * primary writes it here, in the step that took the price (`seizeFloor`, `objectOnPrimary`), from what it charged
 * (`payPrice`'s answer) and the floor it wrote (the stack's newest entry, E70 C1): into the trial record
 * (`trialProgress().objections`, by card), kept for the chapter, never read off a card. An Objection refused or
 * refunded never gets one; a withdrawn one loses it (`withdrawObjectionCard`): there is nothing to overrule in either.
 */
// `aimedAt`, the target the step judged: objectOnPrimary names the packet's `targetId` in its no-Room branch alone (R591).
async function keepReceipt(messageId, floor, { objectorId, aimedAt, paid }) {
    if (!messageId || !floor) return;
    try {
        const { restOf } = await import("./floor-machine.mjs");
        const entry = (Array.isArray(floor.before) ? floor.before : []).findLast(e => e?.messageId === messageId) ?? null;
        const { setTrialProgress } = await import("./vote.mjs");
        await setTrialProgress(record => ({
            objections: {
                ...(record.objections ?? {}),
                [messageId]: {
                    objectorId, targetId: aimedAt ?? null,
                    paid: paid ? { key: paid.key ?? null, pay: paid.pay ?? null, amount: Number(paid.amount) || 0, grant: Boolean(paid.grant) } : null,
                    mode: entry?.before?.mode ?? null, leftAtObjection: entry ? Number(entry.leftAtObjection) || 0 : null,
                    debateLeft: restOf(floor), trialStartedAt: record.trialStartedAt ?? null, at: serverNow(), overruled: false,
                    // The debate's question it was raised in (E70 C3), as the floor the primary wrote holds it.
                    topic: floor.topic ?? null
                }
            }
        }));
    } catch (err) {
        error("Could not keep the receipt of an Objection", err);
    }
}

/**
 * The trial record's receipts (`objections`), the trial's stamp and the console's offer of the debate again
 * (`againAfterOverrule`), as vote.mjs `trialProgress` reads the record: `chapter`'s (the clock's), else none - a record
 * of another chapter is another trial's. `given` stands for the record (the suite's). Read synchronously, for the bar's
 * greyed button and the log, without the vote's file.
 */
export function objectionRecord({ chapter = null, given = null } = {}) {
    const none = { objections: {}, trialStartedAt: null, again: null };
    try {
        const stored = given ?? game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {};
        if (!given && stored.chapter !== (chapter ?? getClock().chapter)) return none;
        return { objections: stored.objections ?? {}, trialStartedAt: stored.trialStartedAt ?? null, again: stored.againAfterOverrule ?? null };
    } catch {
        return none;
    }
}

/** A withdrawn Objection's receipt taken out of the record (`withdrawObjectionCard`): nothing of it is left to overrule. */
async function dropReceipt(messageId) {
    try {
        const { setTrialProgress } = await import("./vote.mjs");
        await setTrialProgress(record => {
            if (!record.objections?.[messageId]) return null;
            const objections = { ...record.objections };
            delete objections[messageId];
            return { objections };
        });
    } catch (err) {
        error("Could not take a withdrawn Objection's receipt out of the trial record", err);
    }
}

/**
 * The Overrule told (E70 C2; trial-floor.mjs `overruleInStep`, on the primary): the card marked - its stamp drawn by the
 * chat log from the flag, its sticky card closed on every screen (popup.mjs) - and a card to the table with the sound,
 * "The GM overrules {name}'s Objection. The price stays, ..." with where the trial went back to, or, after the
 * exchange, that nothing else changes. A card deleted since is skipped: the receipt is the record. A pending card's
 * words say it was overruled, not that a bullet is being chosen.
 */
export async function markOverruled(messageId, { objectorId = null, state = null } = {}) {
    if (!game.user.isGM) return;
    const message = messageId ? (game.messages.get(messageId) ?? null) : null;
    const name = game.actors.get(objectorId ?? "")?.name ?? message?.getFlag(MODULE_ID, TRIAL_FLAGS.presenter) ?? "?";
    if (message?.author?.isGM) {
        try {
            const pending = Boolean(message.getFlag(MODULE_ID, TRIAL_FLAGS.pending));
            await message.update({
                ...(pending ? { content: objectionStateCard(name, message.getFlag(MODULE_ID, TRIAL_FLAGS.targetName) ?? null, "overruled",
                    message.getFlag(MODULE_ID, TRIAL_FLAGS.topic) ?? null) } : {}),
                flags: { [MODULE_ID]: { [TRIAL_FLAGS.overruled]: true, ...(pending ? { [TRIAL_FLAGS.pending]: false } : {}) } }
            });
        } catch (err) {
            error("Could not mark the overruled Objection's card", err);
        }
    }
    const { trialEventCard } = await import("./trial-floor-ui.mjs");
    const esc = foundry.utils.escapeHTML;
    const lines = state
        ? [game.i18n.format("DRPG.Floor.overrule.card", { name: esc(name), state: esc(state) })]
        : [game.i18n.format("DRPG.Floor.overrule.cardOver", { name: esc(name) }), game.i18n.localize("DRPG.Floor.overrule.over")];
    try {
        await announce({
            content: trialEventCard("DRPG.Floor.overrule.title", ...lines),
            flags: { [MODULE_ID]: { sfx: { key: "overrule", gm: true } } }
        });
    } catch (err) {
        error("Could not tell the table the Objection was overruled", err);
    }
    log(`The GM overruled ${name}'s Objection${state ? `; back to ${state}` : ""}.`);
}


/* ==========================================================================
 * THE OBJECTION, RAISED FIRST AND PROVED AFTER (E79 C16, 1.2.79)
 * ========================================================================== */

/*
 * THE OWNER, 17.10.2026: an Objection is thrown at whoever is speaking now, or, when nobody is, at the last player
 * who spoke; the Truth Bullet is chosen after it, and the card waits "pending" until it is. Until 1.2.79 the
 * player chose both in the sheet's window - the evidence first, then whom to aim at from a list - and posted the
 * card from their own browser, which the primary GM then judged (`seizeFloor`, still the GM's road).
 *
 * THE ROAD NOW, every step of it on the primary GM:
 *   the press      OBJECTION! on the trial bar (hud.mjs) asks `trial.object` (gm-bridge.mjs) for the character.
 *                  `objectOnPrimary` judges it: a Class Trial, a floor open to an Objection, a character offered
 *                  one, alive and holding a Truth Bullet as the GMs hold them, a target, and the price paid - then
 *                  posts the card as a GM, pending, and opens the floor pending on it (trial-floor.mjs
 *                  `openObjection`). Refused, nothing is paid; the floor not moving after the payment refunds it.
 *   the target     with a voice Room on the primary GM, the speaker its Room counts (trial-speakers.mjs
 *                  `objectionTarget`), and nothing the packet names; with none - no A/V, another A/V client, not
 *                  connected - the student the packet names, judged by `targetRefusal` as the window judged it,
 *                  and with none named the answer asks the objector for a name, nothing paid (`needName`).
 *                  ONE BROWSER DECIDES (fix r4-G1, 17.10.2026): until then the objector's browser asked for a
 *                  name only when its own Room was closed, so with the player's Room up and the primary's down
 *                  (A/V off on the GM, avclient-livekit in its own window, a Room reconnecting) every press was
 *                  refused and no road named a target, and with the player's down and the primary's up the name
 *                  was asked for and thrown away. The press now always goes unnamed first.
 *   the bullet     the player's picker (`pickObjectionEvidence`) asks `trial.evidence`: `evidenceOnPrimary` fills
 *                  the card with the bullet as its holder knows it (`holderView`) and starts the minute.
 *   the lapse      no bullet within `TRIAL.objectionPickSeconds`: the heartbeat (trial-floor.mjs `advanceIfDue`)
 *                  puts the floor back to the debate and `withdrawObjectionCard` marks the card. The price stays.
 *   the withdrawal the picker closed (`trial.withdraw`, `withdrawOnPrimary`), or any road that replaces the pending
 *                  floor (trial-floor.mjs `withdrawReplaced`): the card marked as at the lapse (fix r4-G2).
 *   the re-point   a GM points the running Objection at somebody else from the trial console (`floor.repoint`,
 *                  `repointOnPrimary`); the card's line follows.
 */

/**
 * The run of `trial.object` (gm-bridge.mjs) on the primary GM: raise `actorId`'s Objection, pending its Truth
 * Bullet. Answers `{ reply: { messageId, target, how, deadline } }` - the card, the target's name, how they were
 * found and the server time the bullet must be on the card by - or `{ refused }` with nothing paid.
 *
 * @param {{actorId: string, targetId?: string|null}} request  `targetId` is read only with no voice Room here
 */
export async function objectOnPrimary({ actorId, targetId = null }) {
    // One at a time with every other seizure of the floor (`SEIZE_KEY`, above): two presses in one tick must not both
    // read a debate and both pay. Held across the whole judgement, so the second reads the floor the first wrote.
    return serialWrite(SEIZE_KEY, async () => {
        const actor = game.actors.get(actorId ?? "");
        if (!actor) return { refused: "no such character" };
        if (!inClassTrial()) return { refused: "no Class Trial is in session" };
        const { objectionOpen, mayObjectTo, openObjectionInStep, trialFloor } = await import("./trial-floor.mjs");
        if (!objectionOpen()) return { refused: "the trial's floor is not open to an objection now" };
        // The death and the bullets as the GMs hold them, as `seizeFloor` reads them (E10 C16, E29 fix r2-H20). The death
        // before the price (E70 C5 fix-mutant): the price's own refusal of the dead (price.mjs `cannotPayAtAll`, on
        // `isDeadForGm`) answered first and left this line unreachable - tier 2 E70-T8 read "that character is offered no
        // Objection" for K and U, the same code (`cannotNow`) to the player, and mutant v1 survived it.
        const { itemsAsHeld, flagsAsHeld } = await import("./sheet-audit.mjs");
        const { isDeceased, livingStudents } = await import("./chapter.mjs");
        if (isDeceased(await flagsAsHeld(actor))) return { refused: "a dead student does not object" };
        // E70 C5: nor one on the trial's list of the dead - a death nobody has found, which the flag does not show (TR30).
        if (isMutedDead(actor)) return { refused: "a dead student does not object" };
        if (quotePrice(actor, "objection").blockedKind === "noPrice") return { refused: "that character is offered no Objection" };
        if (!(await itemsAsHeld(actor)).some(item => isTruthBullet(item))) return { refused: "that character holds no Truth Bullet" };

        const speakers = await import("./trial-speakers.mjs");
        let target = null, how = "named";
        if (speakers.speakerRoomOpen()) {
            // A speaker the floor lets this objector aim at: during a rebuttal only the two in it (`targetRefusal`).
            const found = speakers.objectionTarget({ exclude: actor.id, actorOf: userId => {
                const student = speakers.speakingStudent(userId);
                return student && mayObjectTo(actor.id, student.id) ? student : null;
            } });
            if (!found) return { refused: "nobody has spoken in this trial that the objection could be aimed at" };
            target = game.actors.get(found.actorId) ?? null;
            how = found.how;
        } else if (!targetId) {
            // No Room here and nobody named: the objector is asked whom they contradict, and nothing is paid, posted
            // or moved - not a refusal, nothing was refused (`raiseObjection` asks again with the name).
            return { reply: { needName: true } };
        } else if (mayObjectTo(actor.id, targetId)) {
            // Alive as the table knows it, as the Room's speakers are (trial-speakers.mjs `speakingStudent`): a death
            // the GMs keep is not told by a refusal of its name.
            target = livingStudents().find(student => student.id === targetId) ?? null;
        }
        if (!target) return { refused: "the student named may not be objected to now" };

        const receipt = await payPrice(actor, "objection", { quiet: true });
        if (!receipt) return { refused: "nothing left to pay for an objection" };

        let message = null;
        try {
            message = await announce({
                content: objectionStateCard(actor.name, target.name, "pending", trialFloor()?.topic ?? null),
                speaker: ChatMessage.getSpeaker({ actor }),
                flags: {
                    [MODULE_ID]: {
                        [TRIAL_FLAGS.present]: true,
                        [TRIAL_FLAGS.objection]: true,
                        [TRIAL_FLAGS.pending]: true,
                        [TRIAL_FLAGS.presenter]: actor.name,
                        [TRIAL_FLAGS.item]: null,
                        [TRIAL_FLAGS.target]: target.id,
                        [TRIAL_FLAGS.targetName]: target.name,
                        [TRIAL_FLAGS.how]: how,
                        [TRIAL_FLAGS.topic]: trialFloor()?.topic ?? null,
                        [TRIAL_FLAGS.chapter]: getClock().chapter,
                        popupKind: "none"
                    }
                }
            });
        } catch (err) {
            error("Could not post the Objection's card", err);
        }
        if (!message?.id) {
            await refundPrice(actor, receipt, { quiet: true });
            return { refused: "the objection's card could not be posted" };
        }

        let opened = null;
        try {
            opened = await openObjectionInStep(actor.id, target.id, { pending: true, messageId: message.id });
        } catch (err) {
            error("Could not open the objection", err);
        }
        // Re-read, as `seizeFloor` does: what matters is who holds the floor now, and on which card.
        const floor = trialFloor();
        if (!opened || floor?.holderId !== actor.id || floor?.messageId !== message.id) {
            await refundPrice(actor, receipt, { quiet: true });
            // Nothing happened and nothing was paid: the card goes, and its popup with it (popup.mjs).
            try {
                await message.delete();
            } catch (err) {
                error("Could not take back the card of an Objection that did not take the floor", err);
            }
            return { refused: "the floor did not move for that objection" };
        }

        await keepReceipt(message.id, floor, { objectorId: actor.id, aimedAt: target.id, paid: receipt });
        await whisperToOwner(actor,
            `<p>${game.i18n.format("DRPG.Trial.objectionPaid", { what: paidLine(receipt) })}</p>`,
            receipt.pay === "action" ? { flags: { [MODULE_ID]: { sfx: "actionSpent" } } } : {});
        return { reply: { messageId: message.id, target: target.name, how,
            deadline: floor.startedAt + TRIAL.objectionPickSeconds * 1000 } };
    });
}

/**
 * The run of `trial.evidence` (gm-bridge.mjs) on the primary GM: put `itemId` on `actorId`'s pending Objection.
 * Only the objector's own Objection, still pending, inside its seconds (trial-floor.mjs `pendingFor`), with a Truth
 * Bullet the character holds as the GMs hold it; anything else is refused and changes nothing. The card is filled
 * from the bullet as its holder knows it (`holderView`), and the minute starts here (`fillObjection`).
 *
 * The card's words are the bullet as the GMs hold it (E79 fix r4-G2; the round-4 review's SEC4-1): `itemAsHeld`
 * decides only that the item is a bullet, and the shown fields were read off the document, where a player's write
 * whose put-back has not landed, or failed, stands - onto a card a GM authors and every notice history, drawn once.
 * They are read through `bulletAsHeld`, as handover.mjs mints a copy. And a card that cannot be filled puts the
 * floor back (SEC4-3): the fill writes the floor first, and a failed update left a filled Objection running its
 * minute with the pending words on the table while its objector was told it failed. The floor goes back to the
 * debate and the card is marked withdrawn, nothing given back, as at a lapse.
 *
 * A STEP OF THE FLOOR'S KEY (E70 C0): the fill read the floor and wrote it outside `SEIZE_KEY`, beside the seizures
 * and the heartbeat that are steps of it; the read, the fill and a put-back are one step now, through the floor's
 * in-step twins (`fillObjectionInStep`, and `unfill`'s `returnToDebateInStep`).
 *
 * @param {{actorId: string, itemId: string, comment?: string}} request
 */
export async function evidenceOnPrimary({ actorId, itemId, comment = "" }) {
    return serialWrite(SEIZE_KEY, async () => {
        const actor = game.actors.get(actorId ?? "");
        if (!actor) return { refused: "no such character" };
        const { noteTooLong } = await import("./pre-session-note.mjs");
        if (noteTooLong(comment)) return { refused: "the comment is longer than a player's words may be" };
        const { trialFloor, pendingFor, fillObjectionInStep } = await import("./trial-floor.mjs");
        const floor = trialFloor();
        const message = floor?.messageId ? (game.messages.get(floor.messageId) ?? null) : null;
        if (!message || !pendingFor(floor, actor.id, message.id)) {
            return { refused: "that objection is no longer waiting for its Truth Bullet" };
        }
        const { itemAsHeld } = await import("./sheet-audit.mjs");
        const held = itemId ? await itemAsHeld(actor, itemId) : null;
        const item = held && isTruthBullet(held) ? (actor.items.get(itemId) ?? null) : null;
        const data = item ? truthBulletData(bulletAsHeld(item)) : null;
        if (!data) return { refused: "that character holds no such Truth Bullet" };

        if (!(await fillObjectionInStep(actor.id, message.id))) {
            return { refused: "that objection is no longer waiting for its Truth Bullet" };
        }
        try {
            await message.update({
                content: buildCard(actor, holderView(data), {
                    objection: true, comment: String(comment ?? "").trim(), target: game.actors.get(floor.targetId) ?? null,
                    topic: floor.topic ?? null
                }),
                flags: { [MODULE_ID]: { [TRIAL_FLAGS.pending]: false, [TRIAL_FLAGS.item]: item.id } }
            });
        } catch (err) {
            error("Could not put the Truth Bullet on the Objection's card", err);
            await unfill(actor.id, message.id);
            return { refused: "the objection's card could not be filled" };
        }
        log(`${actor.name} objected with "${data.name}".`);
        return { reply: { item: data.name } };
    });
}

/** `evidenceOnPrimary`'s put-back when its card could not be filled: the floor it filled back to the debate, the card withdrawn. */
async function unfill(objectorId, messageId) {
    try {
        const { trialFloor, returnToDebateInStep, FLOOR_MODES } = await import("./trial-floor.mjs");
        const floor = trialFloor();
        if (floor?.mode === FLOOR_MODES.objection && floor.holderId === objectorId && floor.messageId === messageId) await returnToDebateInStep({});
        await withdrawObjectionCard(messageId);
    } catch (err) {
        error("Could not put the floor back after the Objection's card could not be filled", err);
    }
}

/**
 * The run of `trial.withdraw` (gm-bridge.mjs) on the primary GM (E79 fix r4-G2, 1.2.79; the round-4 review's cor F4):
 * the objector's picker closed or cancelled, so their pending Objection on the card `messageId` goes back to the
 * debate and its card is marked withdrawn, nothing given back (D4) - the handbooks' "Close the window ... and the
 * Objection is withdrawn", which until this fix waited for the seconds to run out. Anything but the objector's own
 * Objection on that card, still pending, is refused and changes nothing (trial-floor.mjs `withdrawObjection`).
 *
 * @param {{actorId: string, messageId: string}} request
 */
export async function withdrawOnPrimary({ actorId, messageId }) {
    const actor = game.actors.get(actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { withdrawObjection } = await import("./trial-floor.mjs");
    if (!(await withdrawObjection(actor.id, messageId ?? null))) {
        return { refused: "that objection is no longer waiting for its Truth Bullet" };
    }
    return { reply: { withdrawn: true } };
}

/** `html` with its card's first line rewritten for a new target (`repointOnPrimary`). */
function withWho(html, name, targetName) {
    const box = document.createElement("template");
    box.innerHTML = html;
    const who = box.content.querySelector(".drpg-evidence-who");
    if (who) who.innerHTML = whoLine(name, targetName);
    return box.innerHTML;
}

/**
 * The run of `floor.repoint` (gm-bridge.mjs) on the primary GM: the running Objection aimed at `targetId` instead,
 * a living student the floor lets its objector aim at. The floor's target alone changes (trial-floor.mjs
 * `repointObjection`), then the card's line and its target flags.
 *
 * @param {{targetId: string}} request
 */
export async function repointOnPrimary({ targetId }) {
    const { trialFloor, mayObjectTo, repointObjection, FLOOR_MODES } = await import("./trial-floor.mjs");
    const floor = trialFloor();
    if (floor?.mode !== FLOOR_MODES.objection) return { refused: "the floor holds no objection to re-point" };
    const { livingStudentsForGm } = await import("./chapter.mjs");
    const target = livingStudentsForGm().find(student => student.id === targetId) ?? null;
    if (!target || !mayObjectTo(floor.holderId, target.id, floor) || !(await repointObjection(target.id))) {
        return { refused: "the student named may not be objected to now" };
    }
    const message = floor.messageId ? (game.messages.get(floor.messageId) ?? null) : null;
    if (message) {
        try {
            await message.update({
                content: withWho(contentOf(message), message.getFlag(MODULE_ID, TRIAL_FLAGS.presenter) ?? "?", target.name),
                flags: { [MODULE_ID]: { [TRIAL_FLAGS.target]: target.id, [TRIAL_FLAGS.targetName]: target.name } }
            });
        } catch (err) {
            error("Could not re-point the Objection's card", err);
        }
    }
    return { reply: { target: target.name } };
}

/**
 * The card of an Objection that was never filled, marked withdrawn: its seconds ran out, its objector closed the
 * picker, or its floor was replaced (trial-floor.mjs `withdrawReplaced`, on the GM that replaced it), or the card
 * could not be filled (`unfill`). Only a card still pending, so it is marked once; answers whether it was marked.
 */
export async function withdrawObjectionCard(messageId) {
    if (!game.user.isGM || !messageId) return false;
    const message = game.messages.get(messageId);
    if (!message?.getFlag(MODULE_ID, TRIAL_FLAGS.pending)) return false;
    await message.update({
        content: objectionStateCard(message.getFlag(MODULE_ID, TRIAL_FLAGS.presenter) ?? "?",
            message.getFlag(MODULE_ID, TRIAL_FLAGS.targetName) ?? null, "withdrawn", message.getFlag(MODULE_ID, TRIAL_FLAGS.topic) ?? null),
        flags: { [MODULE_ID]: { [TRIAL_FLAGS.pending]: false, [TRIAL_FLAGS.withdrawn]: true } }
    });
    await dropReceipt(messageId);
    return true;
}

/**
 * OBJECTION!, pressed on a player's trial bar (hud.mjs): ask the primary GM to raise it, then choose the Truth
 * Bullet. The press names nobody; when the primary GM has no voice Room it answers asking for a name
 * (`needName`), and the player names the target, as the old window asked, and the press goes again with it. This
 * browser's own Room decides nothing here (fix r4-G1: the primary's alone does; the header above says why). Every
 * refusal is the bridge's to say. Answers whether the card was filled.
 *
 * @param {Actor} actor  the viewer's own student (hud.mjs `viewerActor`)
 */
export async function raiseObjection(actor) {
    if (!actor || !inClassTrial()) return false;
    const { requestObject, requestEvidence, requestWithdraw } = await import("./gm-bridge.mjs");
    const asked = await requestObject({ actorId: actor.id, targetId: null });
    let raised = asked.ok ? (asked.value ?? null) : null;
    if (raised?.needName === true) {
        const named = await nameObjectionTarget(actor);
        if (!named) return false;
        const again = await requestObject({ actorId: actor.id, targetId: named });
        raised = again.ok ? (again.value ?? null) : null;
    }
    if (!raised?.messageId) return false;
    const pick = await pickObjectionEvidence(actor, raised);
    if (!pick) {
        // Closed or cancelled while the Objection still waits: it is withdrawn now, as the handbooks say (fix r4-G2,
        // cor F4), not at its deadline. A window the floor closed (its seconds out, the floor moved on) asks nothing.
        const { trialFloor, pendingFor } = await import("./trial-floor.mjs");
        if (pendingFor(trialFloor(), actor.id, raised.messageId)) await requestWithdraw({ actorId: actor.id, messageId: raised.messageId });
        return false;
    }
    const filled = await requestEvidence({ actorId: actor.id, itemId: pick.itemId, comment: pick.comment });
    return filled.ok === true;
}

/** The old choice, when the primary GM has no voice Room: a living student, during a rebuttal one of the two in it. */
async function nameObjectionTarget(actor) {
    const { livingStudents } = await import("./chapter.mjs");
    const { trialFloor, FLOOR_MODES } = await import("./trial-floor.mjs");
    const floor = trialFloor();
    const pair = floor?.mode === FLOOR_MODES.rebuttal ? [floor.holderId, floor.targetId] : null;
    const choices = livingStudents()
        .filter(student => student.id !== actor.id && (!pair || pair.includes(student.id)))
        .sort((a, b) => a.name.localeCompare(b.name));
    if (!choices.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Trial.objectionNobody"));
        return null;
    }
    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Trial.objection") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Trial.objectionTarget")}
                <select name="target">${choices.map(student =>
                    `<option value="${student.id}">${foundry.utils.escapeHTML(student.name)}</option>`).join("")}</select></label>
            ${pair ? `<p class="notes">${game.i18n.localize("DRPG.Trial.objectionRebuttalTargets")}</p>` : ""}
            <p class="notes">${game.i18n.localize("DRPG.Trial.objectionNoRoom")}</p>
        </form>`),
        buttons: [
            { action: "object", label: game.i18n.localize("DRPG.Trial.objection"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=target]")?.value ?? "" },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    return choice && choice !== "cancel" ? choice : null;
}

/**
 * The Truth Bullet for a raised Objection: the character's bullets, a comment, and the seconds left counted down on
 * the window, which closes itself at zero. Answers `{ itemId, comment }`, or null when it was closed or cancelled -
 * and then `raiseObjection` withdraws the Objection, its price kept, as the window says.
 *
 * THE FLOOR'S SECONDS, NOT THE PRESS'S (E79 fix r4-G2, 1.2.79; the round-4 review's cor F3). The window counted to
 * the deadline the press answered, so a GM's +30 s (`extendFloor`) gave the primary thirty more seconds and the
 * window none - it closed, and the Objection lapsed thirty seconds later with its price kept - and a floor the GM
 * moved on left the window open to that deadline. It reads the floor now, each half second: the seconds while the
 * floor still waits for this card (trial-floor.mjs `pendingFor`, `msLeft`, the primary's own count), and zero, which
 * closes it, once it does not.
 */
async function pickObjectionEvidence(actor, { target, messageId }) {
    const { trialFloor, pendingFor, msLeft } = await import("./trial-floor.mjs");
    const bullets = actor.items.filter(item => isTruthBullet(item)).sort((a, b) => a.name.localeCompare(b.name));
    const left = () => {
        const floor = trialFloor();
        return pendingFor(floor, actor.id, messageId) ? Math.ceil(msLeft(floor) / 1000) : 0;
    };
    const countLine = () => game.i18n.format("DRPG.Trial.objectionPickCount", { seconds: left() });
    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Trial.objectionPickTitle") },
        classes: ["drpg-panel", "drpg-objection-pick"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Trial.objectionPickIntro", { target: foundry.utils.escapeHTML(String(target ?? "-")) })}</p>
            <label>${game.i18n.localize("DRPG.Trial.objectionPickLabel")}
                <select name="item">${bullets.map(item =>
                    `<option value="${item.id}">${foundry.utils.escapeHTML(item.name)}</option>`).join("")}</select></label>
            <label>${game.i18n.localize("DRPG.Trial.comment")}
                <textarea name="comment" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Trial.commentPlaceholder")}"></textarea></label>
            <p class="drpg-warning">${game.i18n.format("DRPG.Trial.objectionWarning", {
                objection: TRIAL.objectionSeconds, rebuttal: TRIAL.rebuttalSeconds
            })}</p>
            <p class="notes">${countLine()}</p>
        </form>`),
        buttons: [
            { action: "evidence", label: game.i18n.localize("DRPG.Trial.objection"), default: true,
                callback: (e, b, d) => ({
                    itemId: d.element.querySelector("[name=item]")?.value ?? "",
                    comment: d.element.querySelector("[name=comment]")?.value.trim() ?? ""
                }) },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            // Half a second, so the count never reads a second late; the window is gone at zero, not after it.
            const ticker = setInterval(() => {
                if (!dialog.element?.isConnected) return void clearInterval(ticker);
                const count = dialog.element.querySelector("form p.notes");
                if (count) count.textContent = countLine();
                if (left() > 0) return;
                clearInterval(ticker);
                dialog.close();
            }, 500);
        },
        rejectClose: false
    });
    return choice && choice !== "cancel" && choice.itemId ? choice : null;
}

/**
 * What the trial bar's OBJECTION! says before it is pressed, on the player's own browser (hud.mjs): why it is held,
 * or whom it would be aimed at now as this browser's Room hears it - a preview; the primary GM decides - and the
 * price. `{ text, held }`.
 */
export async function objectionButtonState(actor) {
    const { objectionOpen, floorRefusal } = await import("./trial-floor.mjs");
    const quote = quotePrice(actor, "objection");
    const blocked = (objectionOpen() ? null : floorRefusal())
        ?? quote.blocked
        ?? (gmOnline() ? null : game.i18n.localize("DRPG.Trial.objectionNoGm"));
    if (blocked) return { text: blocked, held: true };
    const speakers = await import("./trial-speakers.mjs");
    let line = game.i18n.localize("DRPG.Trial.objectionAtNamed");
    if (speakers.speakerRoomOpen()) {
        const found = speakers.objectionTarget({ exclude: actor.id });
        const target = found ? game.actors.get(found.actorId) : null;
        line = target
            ? game.i18n.format(found.how === "now" ? "DRPG.Trial.objectionAtNow" : "DRPG.Trial.objectionAtLast",
                { target: target.name })
            : game.i18n.localize("DRPG.Trial.objectionAtNobody");
    }
    return { text: `${line} ${priceLine(actor, quote)}`, held: false };
}

/** The trial console's Re-point (trial-floor-ui.mjs): a living student, not the objector, asked of the primary GM. */
export async function repointDialog() {
    if (!game.user.isGM) return null;
    const { trialFloor, FLOOR_MODES } = await import("./trial-floor.mjs");
    const floor = trialFloor();
    if (floor?.mode !== FLOOR_MODES.objection) return null;
    const { livingStudentsForGm } = await import("./chapter.mjs");
    const choices = livingStudentsForGm()
        .filter(student => student.id !== floor.holderId)
        .sort((a, b) => a.name.localeCompare(b.name));
    if (!choices.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Trial.objectionNobody"));
        return null;
    }
    const targetId = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.repoint") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Floor.repointTo")}
                <select name="target">${choices.map(student => `<option value="${student.id}"${
                    student.id === floor.targetId ? " selected" : ""}>${foundry.utils.escapeHTML(student.name)}</option>`).join("")}</select></label>
        </form>`),
        buttons: [
            { action: "repoint", label: game.i18n.localize("DRPG.Floor.repoint"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=target]")?.value ?? "" },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    if (!targetId || targetId === "cancel") return null;
    const { requestRepoint } = await import("./gm-bridge.mjs");
    const res = await requestRepoint(targetId);
    return res.ok ? (res.value ?? null) : null;
}

/* ==========================================================================
 * THE GM'S LOG
 * ========================================================================== */

/**
 * Everything put in front of the table, newest first.
 *
 * Read back out of the chat log rather than kept in a second place: the message
 * IS the record, so there is no copy to fall out of step with it.
 *
 * @param {object} [options]
 * @param {boolean} [options.objectionsOnly]
 * @param {number} [options.chapter]  Defaults to the chapter now running.
 */
export function presentedThisChapter({ objectionsOnly = false, chapter = null } = {}) {
    const want = chapter ?? getClock().chapter;
    // The Overrule is the receipt's (E70 C2), never the card's flag, which its own author could take off again.
    const { objections } = objectionRecord({ chapter: want });

    return game.messages
        .filter(m => m.getFlag(MODULE_ID, TRIAL_FLAGS.present))
        .filter(m => want === null || m.getFlag(MODULE_ID, TRIAL_FLAGS.chapter) === want)
        .filter(m => !objectionsOnly || m.getFlag(MODULE_ID, TRIAL_FLAGS.objection))
        .map(m => ({
            id: m.id,
            presenter: m.getFlag(MODULE_ID, TRIAL_FLAGS.presenter) ?? "?",
            objection: Boolean(m.getFlag(MODULE_ID, TRIAL_FLAGS.objection)),
            // Null on every card posted before this stage, and on any ordinary
            // presentation - the log prints a dash for both rather than
            // pretending an old objection had a target it never recorded.
            target: m.getFlag(MODULE_ID, TRIAL_FLAGS.targetName) ?? null,
            // An objection the floor turned down (T-1). False on every card from
            // before that release, which is what it was in effect.
            refused: Boolean(m.getFlag(MODULE_ID, TRIAL_FLAGS.refused)),
            // An Objection whose Truth Bullet never came (E79 C16): it stopped the room and showed nothing.
            withdrawn: Boolean(m.getFlag(MODULE_ID, TRIAL_FLAGS.withdrawn)),
            // Overruled by the GM (E70 C2): read off the receipt the primary keeps, as is whether it has one.
            overruled: Boolean(objections[m.id]?.overruled),
            receipt: Boolean(objections[m.id]),
            // The debate's question (E70 C3): the receipt's where the primary kept one, else the card's own marker.
            topic: objections[m.id]?.topic ?? m.getFlag(MODULE_ID, TRIAL_FLAGS.topic) ?? null,
            chapter: m.getFlag(MODULE_ID, TRIAL_FLAGS.chapter) ?? null,
            timestamp: m.timestamp
        }))
        .reverse();
}

/** The GM panel's read-out of who interrupted whom, and with what. */
export async function openObjectionLog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-objections")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (!presentedThisChapter().length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Trial.logEmpty"));
        return null;
    }

    /*
     * BUILT EVERY TIME, BECAUSE THIS IS THE WINDOW A GM LEAVES OPEN.
     *
     * It is the running record of a trial, and a trial is exactly when evidence keeps
     * arriving - from the PLAYERS, so nothing that lands in here is a change this
     * client made. It was drawn once and then sat there: measured on 11.09 with the log
     * open, a sixth presentation went into the world and the window went on saying
     * "5 presented this chapter".
     *
     * The log is read back out of the chat messages themselves (see
     * `presentedThisChapter`), so the hooks to watch are the message hooks - none of
     * which `keepLive` carries by default, because no other window in the module is
     * about chat.
     */
    /* OVERRULE ON THE NEWEST ROW (E70 C2): the one Objection an Overrule would name now - the running one, else the
       newest of this trial not yet overruled (floor-machine.mjs `overruleTarget`) - carries the button; each row of an
       overruled one says so, read off the receipt ("OBJECTION - overruled by the GM"). */
    const floorMod = await import("./trial-floor.mjs");
    const { overruleTarget } = await import("./floor-machine.mjs");
    const logBody = () => {
        const entries = presentedThisChapter();
        const named = overruleTarget({ floor: floorMod.trialFloor(), ...objectionRecord(), running: floorMod.inClassTrial() });
        /* THE LOG BY QUESTION (E70 C3; S18-70): once any row of the chapter has a debate's question, a heading row goes
           above each run of rows under one question, newest first as the rows are, and the rows put on the table with
           no question are headed so. A chapter whose debates had no question reads as it did. */
        const grouped = entries.some(e => e.topic);
        let heading;
        const rows = entries.map(e => `${grouped && e.topic !== heading ? `<tr class="drpg-objection-log-topic"><th colspan="4">${(heading = e.topic)
            ? game.i18n.format("DRPG.Floor.topicLine", { topic: foundry.utils.escapeHTML(e.topic) })
            : game.i18n.localize("DRPG.Trial.logNoTopic")}</th></tr>` : ""}<tr>
            <td>${e.objection
                ? `<strong>${game.i18n.localize("DRPG.Trial.objectionShort")}</strong>${
                    e.refused
                        ? ` <em>${game.i18n.localize("DRPG.Trial.logRefused")}</em>`
                        : e.withdrawn ? ` <em>${game.i18n.localize("DRPG.Trial.logWithdrawn")}</em>`
                            : e.overruled ? ` - <em>${game.i18n.localize("DRPG.Trial.logOverruled")}</em>` : ""}${
                    !named.refused && named.messageId === e.id
                        ? ` <button type="button" data-drpg-overrule="${e.id}">${
                            game.i18n.localize("DRPG.Floor.bar.overrule")}</button>` : ""}`
                : game.i18n.localize("DRPG.Trial.presentShort")}</td>
            <td>${foundry.utils.escapeHTML(e.presenter)}</td>
            <td>${e.target ? foundry.utils.escapeHTML(e.target) : "-"}</td>
            <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
        </tr>`).join("");

        return `<div class="drpg-objection-live">
            <p>${game.i18n.format("DRPG.Trial.logSummary", {
                total: entries.length,
                // The ones that actually took the floor. A refused card is listed
                // in the table below and says so, so the count and the rows do not
                // have to mean the same thing.
                objections: entries.filter(e => e.objection && !e.refused && !e.withdrawn).length
            })}</p>
            <table class="drpg-objection-log"><thead><tr>
                <th>${game.i18n.localize("DRPG.Trial.logKind")}</th>
                <th>${game.i18n.localize("DRPG.Trial.logWho")}</th>
                <th>${game.i18n.localize("DRPG.Trial.logAgainst")}</th>
                <th>${game.i18n.localize("DRPG.Trial.logWhen")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
        </div>`;
    };

    return tableDialog({
        window: { title: game.i18n.localize("DRPG.Trial.logTitle") },
        classes: ["drpg-panel", "drpg-window-objections"],
        content: dialogContent(logBody()),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        render: (event, dialog) => {
            // By delegation on the window: the region is rebuilt whenever the record or a card changes.
            dialog.element?.addEventListener("click", ev => {
                const button = ev.target?.closest?.("[data-drpg-overrule]");
                if (!button) return;
                ev.preventDefault();
                floorMod.overruleObjection(button.dataset.drpgOverrule).catch(err => error("The log's Overrule failed", err));
            });
            return keepLive(dialog, {
                region: ".drpg-objection-live",
                build: logBody,
                watch: { hooks: ["createChatMessage", "deleteChatMessage", "updateChatMessage"] }
            });
        },
        rejectClose: false
    });
}
