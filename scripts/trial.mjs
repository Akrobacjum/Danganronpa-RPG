/**
 * Danganronpa RPG — putting evidence in front of the table.
 * ---------------------------------------------------------------------------
 * Guide, p. 31: during a Class Trial each player gets three uninterrupted
 * minutes, and the only way to cut somebody off is an Objection — "pod
 * warunkiem, że pokażą Truth Bullet na czacie w Foundry VTT". Showing the
 * evidence is what earns the interruption.
 *
 * So a presentation is TWO things at once, and this file keeps them one object:
 *
 *   the record   a public ChatMessage carrying the card and its flags. It is
 *                the trial's paper trail, it is what the GM's Objection log
 *                reads back, and it survives an export.
 *   the display  every client turns that message into a popup as it arrives —
 *                the chat sidebar is not where anybody is looking during a
 *                trial, and evidence nobody notices may as well not exist.
 *
 * One message, one hook, so the two can never disagree.
 *
 * Only public knowledge goes on the card: the name, the type the HOLDER sees,
 * how visible the original was, the chapter, and their own note. The real type
 * and the GM's note are not on the player's item to begin with (see D6 and
 * truth-bullets.mjs), so there is nothing here to leak by accident.
 *
 * Present is Class-Trial-only on purpose. It reaches every player at once, and
 * outside the trial the cast is scattered across rooms that are supposed to be
 * separate — the same-room Share button in handover.mjs is the tool for those
 * phases. During the trial everybody is in one place, so a public card is
 * simply what talking looks like.
 */

import { MODULE_ID, TRUTH_BULLET_TYPES, TRIAL } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { truthBulletData, isTruthBullet } from "./truth-bullets.mjs";
import { showPopup } from "./popup.mjs";
import { announce, dialogContent, isPrimaryGm, log, error, tableDialog } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";

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
     * Who an objection was aimed at — the actor id, because this one is read
     * back by code (`openObjection`) rather than only printed. `presenter`
     * above is a NAME because it is only ever displayed, and a name survives
     * an actor being deleted after the trial.
     */
    target: "objectionTarget",
    /** The name to print for that target, for the same reason as `presenter`. */
    targetName: "objectionTargetName",
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
 *   debate       the floor is open. Evidence takes it — an Objection.
 *   rebuttal     an Objection too, and the escalation the mode is for: the
 *                pair are arguing, and evidence produced inside that argument
 *                re-points the floor at whoever produced it. Only the two on
 *                the floor may; a third party is not in this exchange.
 *   objection    somebody has one minute alone. The button is the Objection it
 *                would be, and it is refused with the reason on the window —
 *                see `objectionBlockedReason`.
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

    const { trialFloor, FLOOR_MODES, maySpeak } = await import("./trial-floor.mjs");
    const { livingStudents } = await import("./chapter.mjs");

    const floor = trialFloor();
    // An open floor of any kind is a debate in progress, and evidence produced
    // during one takes it. No floor is the trial's discussion, where evidence
    // is simply shown.
    const asObjection = Boolean(floor);

    // Refused before the card is ever posted, so the player is told why rather
    // than watching an objection land as an ordinary card because the floor
    // quietly turned it down. `openObjection` checks this again on the GM's
    // side — this is the courtesy, that is the rule.
    const blocked = asObjection
        ? objectionBlockedReason(actor, floor, FLOOR_MODES)
        : null;

    const targets = livingStudents()
        .filter(a => a.id !== actor.id)
        .sort((a, b) => a.name.localeCompare(b.name));

    /*
     * DURING A REBUTTAL, WHO YOU MAY AIM AT DEPENDS ON WHETHER YOU ARE IN IT.
     *
     * For the two on the floor there is exactly one person to aim at: the one
     * already opposite them. Offering the rest of the table would let the pair
     * drag a bystander into an exchange they are not in, and the floor would
     * re-point at somebody who has not said a word.
     *
     * FOR ANYBODY ELSE IT IS THE WHOLE TABLE, and this half arrived with
     * Dawid's ruling of 28.08 that a third party may cut into a rebuttal. It is
     * the trap that ruling sets: lifting the guard in `openObjection` without
     * touching this line would have let a bystander object and then handed them
     * a picker holding one name — whichever of the pair `find` happened to
     * reach first — so the interruption would have worked and been aimed at the
     * wrong person, silently. A permission granted in one place and half-
     * refused in another is worse than the refusal.
     *
     * `maySpeak` is the same question `openObjection` used to ask, asked here
     * for the thing it is still right for: not "may you interrupt" any more,
     * but "is this exchange yours".
     */
    const inRebuttal = floor?.mode === FLOOR_MODES.rebuttal;
    const onTheFloor = inRebuttal && maySpeak(actor.id, floor);
    const opponentId = onTheFloor
        ? [floor.holderId, floor.targetId].find(id => id && id !== actor.id) ?? null
        : null;
    const choices = opponentId
        ? targets.filter(a => a.id === opponentId)
        : targets;

    const targetField = choices.length
        ? `<label>${game.i18n.localize("DRPG.Trial.objectionTarget")}
            <select name="target">${choices.map(a =>
                `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`
            ).join("")}</select></label>`
        : `<p class="notes">${game.i18n.localize("DRPG.Trial.objectionNobody")}</p>`;

    const readTarget = d => d.element.querySelector("[name=target]")?.value ?? "";

    // Nothing to aim at is as good a refusal as a rule refusing you.
    const stopped = asObjection && (Boolean(blocked) || !choices.length);

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
                ${blocked ? `<p class="notes">${blocked}</p>` : targetField}
            </fieldset>`
            : `<p class="notes">${game.i18n.localize("DRPG.Trial.presentNote")}</p>`}
        </form>`),
        buttons: [
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
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return false;
    return presentBullet(actor, item, choice);
}

/**
 * Why this player may not object right now, or `null` when they may.
 *
 * ONE CASE NOW. A rebuttal stopped being one of them on 28.08 — see the rule
 * in `openObjection`, which this mirrors and must go on mirroring: that
 * function is the RULE (the floor refuses) and this one is the COURTESY (the
 * player is told why). A courtesy that refuses what the rule allows is worse
 * than no courtesy at all, because then the only thing standing between a
 * player and a legal move is a window telling them no.
 *
 *   during an objection   somebody has one minute alone. A second objection
 *                         would reset the clock onto a new pair, and the
 *                         rebuttal the first one bought would never happen.
 */
function objectionBlockedReason(actor, floor, FLOOR_MODES) {
    if (!floor) return game.i18n.localize("DRPG.Trial.objectionNoFloor");
    if (floor.mode === FLOOR_MODES.objection) {
        return game.i18n.localize("DRPG.Trial.objectionDuringObjection");
    }
    return null;
}

/**
 * Post the card. Built and sent by the presenter's own client — everything on
 * it is already public, and during a trial the delay of a round trip through
 * the GM is exactly the wrong cost to pay for an interruption.
 */
export async function presentBullet(actor, item, {
    objection = false, comment = "", targetId = ""
} = {}) {
    const data = truthBulletData(item);
    if (!data) return false;

    const target = objection && targetId ? (game.actors.get(targetId) ?? null) : null;

    try {
        await announce({
            content: buildCard(actor, data, { objection, comment, target }),
            speaker: ChatMessage.getSpeaker({ actor }),
            flags: {
                [MODULE_ID]: {
                    [TRIAL_FLAGS.present]: true,
                    [TRIAL_FLAGS.objection]: objection,
                    [TRIAL_FLAGS.presenter]: actor.name,
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

/** The card itself. Public knowledge only — see the note at the top. */
function buildCard(actor, data, { objection, comment, target = null }) {
    const hint = TRUTH_BULLET_TYPES[data.shownType]?.hint ?? "";

    const badges = [
        `<span class="drpg-tb-badge type ${data.shownType}">${
            foundry.utils.escapeHTML(data.shownLabel)}</span>`,
        `<span class="drpg-tb-badge visibility">${
            foundry.utils.escapeHTML(data.visibilityLabel)}</span>`
    ];
    if (data.chapter !== null) {
        badges.push(`<span class="drpg-tb-badge chapter">${
            game.i18n.format("DRPG.TruthBullet.chapterShort", { n: data.chapter })}</span>`);
    }
    if (data.room) {
        badges.push(`<span class="drpg-tb-badge">${foundry.utils.escapeHTML(data.room)}</span>`);
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
        ${hint ? `<p class="drpg-evidence-hint"><em>${foundry.utils.escapeHTML(hint)}</em></p>` : ""}
        ${comment
            ? `<p class="drpg-evidence-comment">"${foundry.utils.escapeHTML(comment)}"</p>` : ""}
    </div>`;
}

/* ==========================================================================
 * DISPLAY — the same message, on everybody's screen
 * ========================================================================== */

export function registerTrial() {
    // Deliberately NOT an async handler. Foundry throws a hook's return value
    // away, so an `await` in here is a promise nobody is holding: a rejection
    // becomes an unhandled one, invisible in the log.
    //
    // The order matters more than the error handling, though. This used to await
    // the floor seizure BEFORE showing the card, which put the evidence popup on
    // the primary GM's screen one server round-trip late — and not at all if the
    // seizure failed. The person running the trial was the one who missed the
    // card the trial is about. Display first; it cannot fail and cannot wait.
    Hooks.on("createChatMessage", message => {
        if (!message.getFlag(MODULE_ID, TRIAL_FLAGS.present)) return;

        const objection = Boolean(message.getFlag(MODULE_ID, TRIAL_FLAGS.objection));

        showPopup(contentOf(message), {
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
        // An objection card with no target cannot open the exchange — there is
        // nobody for the rebuttal to be with. That should be impossible from
        // the dialog, which requires one, so this is the guard for a card
        // posted through the API or left over from before this stage: the
        // evidence still lands, the floor simply does not move.
        if (!objectorId || !targetId) return;

        import("./trial-floor.mjs")
            .then(m => m.openObjection(objectorId, targetId))
            .catch(err => error("Could not open the objection", err));
    });
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
            // presentation — the log prints a dash for both rather than
            // pretending an old objection had a target it never recorded.
            target: m.getFlag(MODULE_ID, TRIAL_FLAGS.targetName) ?? null,
            chapter: m.getFlag(MODULE_ID, TRIAL_FLAGS.chapter) ?? null,
            timestamp: m.timestamp
        }))
        .reverse();
}

/** The GM panel's read-out of who interrupted whom, and with what. */
export async function openObjectionLog() {
    // ONE OF THESE, NOT FOUR — see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-objections")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const entries = presentedThisChapter();
    if (!entries.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Trial.logEmpty"));
        return null;
    }

    const rows = entries.map(e => `<tr>
        <td>${e.objection
            ? `<strong>${game.i18n.localize("DRPG.Trial.objectionShort")}</strong>`
            : game.i18n.localize("DRPG.Trial.presentShort")}</td>
        <td>${foundry.utils.escapeHTML(e.presenter)}</td>
        <td>${e.target ? foundry.utils.escapeHTML(e.target) : "—"}</td>
        <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
    </tr>`).join("");

    const objections = entries.filter(e => e.objection).length;

    return tableDialog({
        window: { title: game.i18n.localize("DRPG.Trial.logTitle") },
        classes: ["drpg-panel", "drpg-window-objections"],
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Trial.logSummary", {
                total: entries.length, objections
            })}</p>
            <table class="drpg-objection-log"><thead><tr>
                <th>${game.i18n.localize("DRPG.Trial.logKind")}</th>
                <th>${game.i18n.localize("DRPG.Trial.logWho")}</th>
                <th>${game.i18n.localize("DRPG.Trial.logAgainst")}</th>
                <th>${game.i18n.localize("DRPG.Trial.logWhen")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
        </div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}
