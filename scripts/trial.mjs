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
import { truthBulletData, isTruthBullet, bulletDescription } from "./truth-bullets.mjs";
import { showPopup } from "./popup.mjs";
import { announce, dialogContent, isPrimaryGm, log, error, tableDialog,
    whisperToOwner } from "./utils.mjs";
// The price of an interruption, quoted where it is about to be shown (T-1).
import { quotePrice, priceLine, payPrice, refundPrice, paidLine } from "./price.mjs";
// The question alone, with no toast: this decides a button, and a window that
// opens with no GM connected must not warn every player who opens it (audit A16).
import { gmOnline } from "./gm-bridge.mjs";
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
 * Put this bullet on the table. What that MEANS is decided by the trial, not
 * by the player.
 *
 * ONE BUTTON, AND THE STAGE OF THE TRIAL DECIDES WHICH ONE IT IS. This window
 * used to offer both, side by side, all trial long:
 *
 *   Present    the evidence goes on the table. The discussion carries on
 *              around it, and nobody's turn to speak changes.
 *   Objection  the evidence goes on the table AND the objector takes the
 *              floor: a minute in which only they may speak, followed by two
 *              minutes in which only they and the person they named may.
 *
 * Both at once is a choice the player should not have. Whether producing
 * evidence interrupts the room is a fact about what the room is currently
 * doing, and the trial already knows it:
 *
 *   discussion   no debate is open. Nothing to interrupt, so it is a Present.
 *   debate       the floor is open. Evidence takes it - an Objection.
 *   rebuttal     an Objection too, and the escalation the mode is for: the
 *                pair are arguing, and evidence produced inside that argument
 *                re-points the floor at whoever produced it. Anybody may cut
 *                in (Dawid, 28.08) and only the two already on the floor may
 *                be aimed at - see `targetRefusal`.
 *   objection    somebody has one minute alone. The button is the Objection it
 *                would be, and it is refused with the reason on the window -
 *                see `floorRefusal` in trial-floor.mjs.
 *
 * The target picker only appears when the button is an Objection, because it is
 * the only case that has one. An objection is aimed: the person named is
 * exactly who gets the two minutes of rebuttal when the minute runs out, and
 * without them there is no exchange to open.
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

    const data = truthBulletData(item);

    const { trialFloor, FLOOR_MODES, floorRefusal } = await import("./trial-floor.mjs");
    const { livingStudents } = await import("./chapter.mjs");

    const floor = trialFloor();
    // An open floor of any kind is a debate in progress, and evidence produced
    // during one takes it. No floor is the trial's discussion, where evidence
    // is simply shown.
    const asObjection = Boolean(floor);

    /*
     * TWO CLASSES OF REFUSAL, AND THE CLASS DECIDES WHAT IS OFFERED INSTEAD
     * (T-1, Dawid 17.09: "Darmowe Present pojawia sie tylko wtedy, gdy sprzeciw
     * blokuje cena, a nie tryb podlogi").
     *
     * THE FLOOR class - no floor, somebody else's minute running, nobody to aim
     * at, or a character who is never offered these prices at all - is greyed
     * with nothing offered: the trial has not got room for this interruption, and
     * a free Present in its place would be a different act nobody asked for.
     *
     * THE PRICE class - an empty pocket, or no GM connected to hand the floor
     * over - is greyed and answered: you may still put the evidence on the table
     * for nothing, and it does not take the floor.
     *
     * Refused HERE as a courtesy, so the player is told before the card is
     * posted rather than watching an objection land as an ordinary card.
     * `floorRefusal` and `targetRefusal` in trial-floor.mjs are the rule, asked
     * again on the GM's side.
     */
    const floorBlock = asObjection ? floorRefusal(floor) : null;
    const quote = asObjection ? quotePrice(actor, "objection") : null;
    const noGm = asObjection && !gmOnline()
        ? game.i18n.localize("DRPG.Trial.objectionNoGm")
        : null;
    const priceBlock = asObjection
        ? (quote.blockedKind === "nothingLeft" ? quote.blocked : null) ?? noGm
        : null;

    const targets = livingStudents()
        .filter(a => a.id !== actor.id)
        .sort((a, b) => a.name.localeCompare(b.name));

    /*
     * DURING A REBUTTAL YOU MAY AIM AT THE TWO IN IT, AND AT NOBODY ELSE.
     *
     * Two rules about two different people, and they were once read as one:
     *
     *   who may speak      anybody (Dawid, 28.08). The moment somebody
     *                      listening sees the hole is the moment interrupting
     *                      is worth anything, and making them wait until the
     *                      argument is over is a rule against that moment.
     *   who may be aimed   the pair, and only the pair (Dawid, 28.08, the
     *                      correction). An objection RE-POINTS the floor, so
     *                      aiming a bystander at another bystander would take a
     *                      rebuttal two people earned and hand it to two who
     *                      have not said a word. That is not an interruption,
     *                      it is a change of subject.
     *
     * So it is the same list for everybody: the two on the floor, minus
     * yourself. For one of the pair that leaves exactly their opponent, which
     * is what it always was; for a bystander it leaves two, which is the whole
     * of the correction.
     */
    const inRebuttal = floor?.mode === FLOOR_MODES.rebuttal;
    const onFloorIds = inRebuttal
        ? [floor.holderId, floor.targetId].filter(id => id && id !== actor.id)
        : [];
    const choices = inRebuttal
        ? targets.filter(a => onFloorIds.includes(a.id))
        : targets;

    // A shortened list needs a reason next to it. Everywhere else this select
    // holds the whole table; in a rebuttal it holds two names, and without a
    // line saying why, a player cannot tell the rule from a bug. It says both
    // halves at once, because they are the two that get read as one: anybody
    // may cut in, at those two and nobody else.
    const targetField = choices.length
        ? `<label>${game.i18n.localize("DRPG.Trial.objectionTarget")}
            <select name="target">${choices.map(a =>
                `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`
            ).join("")}</select></label>
            ${inRebuttal
                ? `<p class="notes">${game.i18n.localize(
                    "DRPG.Trial.objectionRebuttalTargets")}</p>` : ""}`
        : `<p class="notes">${game.i18n.localize("DRPG.Trial.objectionNobody")}</p>`;

    const readTarget = d => d.element.querySelector("[name=target]")?.value ?? "";

    // Nothing to aim at is as good a refusal as a rule refusing you.
    const stopped = asObjection && Boolean(
        floorBlock || priceBlock || !choices.length || quote.blockedKind === "noPrice");

    // The fallback, and only for the class of refusal that earns it: somebody
    // alive, with a floor to interrupt and somebody to aim at, who simply has
    // nothing left to pay with.
    const offerPresent = asObjection && !floorBlock && Boolean(choices.length)
        && quote.blockedKind !== "noPrice" && Boolean(priceBlock);

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

            ${asObjection ? `<fieldset class="drpg-objection-block">
                <legend>${game.i18n.localize("DRPG.Trial.objection")}</legend>
                <p class="drpg-warning">${game.i18n.format("DRPG.Trial.objectionWarning", {
                    // The two timings are set in config.mjs and counted down by
                    // trial-floor.mjs. This paragraph used to spell them out in
                    // words, which is one rebalance away from being wrong.
                    objection: TRIAL.objectionSeconds,
                    rebuttal: TRIAL.rebuttalSeconds
                })}</p>
                <p class="notes">${priceLine(actor, quote)}</p>
                ${floorBlock ? `<p class="notes">${floorBlock}</p>` : ""}
                ${offerPresent
                    ? `<p class="notes">${game.i18n.localize(
                        "DRPG.Trial.objectionFreePresentNote")}</p>` : ""}
                ${floorBlock ? "" : targetField}
            </fieldset>`
            : `<p class="notes">${game.i18n.localize("DRPG.Trial.presentNote")}</p>`}
        </form>`),
        /*
         * BUTTON ORDER IS A RULE HERE, NOT A LAYOUT (T-1). There are two Enter
         * paths into a DialogV2 and they aim at different buttons:
         *
         *   focus on a button    Enter presses THAT button - the one carrying
         *                        `default: true`, which is where DialogV2 puts
         *                        `autofocus`.
         *   focus in a field     HTML implicit submission, whose target is the
         *                        FIRST submit button in tree order. DialogV2
         *                        renders every footer button as a submit.
         *
         * A disabled first submit is not a valid target and the browser does
         * nothing at all - Enter dies rather than falling through to the next
         * button. The `<textarea>` swallows Enter, so the only field that can
         * fire implicit submission is the target `<select>`, which is rendered
         * whenever the FLOOR is fine.
         *
         * SO: the first entry is always enabled and always carries
         * `default: true`. With nothing blocking, that is the Objection. With a
         * price blocking it, that is the free Present - which is exactly what
         * Enter from the select should do - and the greyed Objection still shows,
         * second, so the player can see it exists and read why. With the FLOOR
         * blocking, no select is rendered and Enter cannot fire at all.
         */
        buttons: (offerPresent ? [
            {
                action: "freePresent",
                label: game.i18n.localize("DRPG.Trial.objectionFreePresent"),
                default: true,
                callback: (e, b, d) => ({
                    objection: false,
                    targetId: "",
                    comment: d.element.querySelector("[name=comment]").value.trim()
                })
            },
            {
                action: "objection",
                label: game.i18n.localize("DRPG.Trial.objection"),
                disabled: true
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ] : [
            {
                action: asObjection ? "objection" : "present",
                label: game.i18n.localize(asObjection
                    ? "DRPG.Trial.objection" : "DRPG.Trial.present"),
                // Greyed rather than gone: a player needs to see that the button
                // exists and why it will not work this second, which is what the
                // reason above it says.
                disabled: stopped,
                default: !stopped,
                callback: (e, b, d) => ({
                    objection: asObjection,
                    targetId: asObjection ? readTarget(d) : "",
                    comment: d.element.querySelector("[name=comment]").value.trim()
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: stopped }
        ]),
        rejectClose: false
    });

    if (!choice || choice === "cancel") return false;
    return presentBullet(actor, item, choice);
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
 * it is already public, and during a trial the delay of a round trip through
 * the GM is exactly the wrong cost to pay for an interruption.
 */
export async function presentBullet(actor, item, {
    objection = false, comment = "", targetId = ""
} = {}) {
    const data = truthBulletData(item);
    if (!data) return false;

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
     * A free Present is not an objection and skips all of it.
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

    try {
        await announce({
            content: buildCard(actor, data, { objection, comment, target }),
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
function buildCard(actor, data, { objection, comment, target = null }) {
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
        <div class="drpg-evidence-who">${objection && target
            ? game.i18n.format("DRPG.Trial.objectedTo", {
                who: foundry.utils.escapeHTML(actor.name),
                target: foundry.utils.escapeHTML(target.name)
            })
            : game.i18n.format("DRPG.Trial.presentedBy", {
                who: foundry.utils.escapeHTML(actor.name)
            })}</div>
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

        if (authorised) showPopup(contentOf(message), {
            title: game.i18n.localize(objection ? "DRPG.Trial.objection" : "DRPG.Trial.evidence"),
            kind: objection ? "objection" : "evidence",
            // Evidence stays up until somebody closes it. A trial argues with a
            // card for minutes, and this is the one popup in the module that is
            // meant to be read rather than noticed.
            sticky: true
        });

        // Showing the evidence and taking the floor are one act in the guide,
        // so they are one act here. Exactly one client writes it: this hook
        // fires on every GM, and two of them racing on the same setting is how
        // the floor ends up pointing at the wrong person.
        if (!objection || !isPrimaryGm()) return;

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
        seizing = seizing
            .then(() => seizeFloor(message, objectorId, targetId))
            .catch(err => error("Could not open the objection", err));
    });
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
 */
let seizing = Promise.resolve();

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

    const { floorRefusal, targetRefusal, openObjection, trialFloor } =
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

    const itemId = message.getFlag(MODULE_ID, TRIAL_FLAGS.item);
    const item = itemId ? actor.items.get(itemId) : null;
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
        opened = await openObjection(objectorId, targetId);
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

    // The sound travels as a flag on the whisper rather than being played here:
    // this is the GM's client, and the pip that just moved is the objector's.
    await whisperToOwner(actor,
        `<p>${game.i18n.format("DRPG.Trial.objectionPaid", { what: paidLine(receipt) })}</p>`,
        receipt.pay === "action" ? { flags: { [MODULE_ID]: { sfx: "actionSpent" } } } : {});

    return opened;
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
    const logBody = () => {
        const entries = presentedThisChapter();
        const rows = entries.map(e => `<tr>
            <td>${e.objection
                ? `<strong>${game.i18n.localize("DRPG.Trial.objectionShort")}</strong>${
                    e.refused
                        ? ` <em>${game.i18n.localize("DRPG.Trial.logRefused")}</em>` : ""}`
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
                objections: entries.filter(e => e.objection && !e.refused).length
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
        render: (event, dialog) => keepLive(dialog, {
            region: ".drpg-objection-live",
            build: logBody,
            watch: { hooks: ["createChatMessage", "deleteChatMessage", "updateChatMessage"] }
        }),
        rejectClose: false
    });
}
