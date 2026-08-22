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

import { MODULE_ID, TRUTH_BULLET_TYPES } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { truthBulletData, isTruthBullet } from "./truth-bullets.mjs";
import { showPopup } from "./popup.mjs";
import { announce, dialogContent, isPrimaryGm, log, error, tableDialog } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Flags that make a chat message a presentation. */
export const TRIAL_FLAGS = {
    /** Marks the message as a presented Truth Bullet. */
    present: "presentCard",
    /** True when it was thrown in to interrupt somebody. */
    objection: "objection",
    /** Who presented it, for the GM's log. */
    presenter: "presenter",
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
 * Ask how this bullet is going on the table, then put it there.
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
        buttons: [
            {
                action: "present", label: game.i18n.localize("DRPG.Trial.present"), default: true,
                callback: (e, b, d) => ({
                    objection: false,
                    comment: d.element.querySelector("[name=comment]").value.trim()
                })
            },
            {
                action: "objection", label: game.i18n.localize("DRPG.Trial.objection"),
                callback: (e, b, d) => ({
                    objection: true,
                    comment: d.element.querySelector("[name=comment]").value.trim()
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return false;
    return presentBullet(actor, item, choice);
}

/**
 * Post the card. Built and sent by the presenter's own client — everything on
 * it is already public, and during a trial the delay of a round trip through
 * the GM is exactly the wrong cost to pay for an interruption.
 */
export async function presentBullet(actor, item, { objection = false, comment = "" } = {}) {
    const data = truthBulletData(item);
    if (!data) return false;

    try {
        await announce({
            content: buildCard(actor, data, { objection, comment }),
            speaker: ChatMessage.getSpeaker({ actor }),
            flags: {
                [MODULE_ID]: {
                    [TRIAL_FLAGS.present]: true,
                    [TRIAL_FLAGS.objection]: objection,
                    [TRIAL_FLAGS.presenter]: actor.name,
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
function buildCard(actor, data, { objection, comment }) {
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
        <div class="drpg-evidence-who">${game.i18n.format("DRPG.Trial.presentedBy", {
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

        showPopup(message.content, {
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
        // a queue ends up pointing at the wrong person.
        if (!objection || !isPrimaryGm()) return;
        const actorId = message.speaker?.actor;
        if (!actorId) return;

        import("./trial-floor.mjs")
            .then(m => m.seizeFloor(actorId))
            .catch(err => error("Could not hand the floor to the objector", err));
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
            chapter: m.getFlag(MODULE_ID, TRIAL_FLAGS.chapter) ?? null,
            timestamp: m.timestamp
        }))
        .reverse();
}

/** The GM panel's read-out of who interrupted whom, and with what. */
export async function openObjectionLog() {
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
        <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
    </tr>`).join("");

    const objections = entries.filter(e => e.objection).length;

    return tableDialog({
        window: { title: game.i18n.localize("DRPG.Trial.logTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Trial.logSummary", {
                total: entries.length, objections
            })}</p>
            <table class="drpg-objection-log"><tbody>${rows}</tbody></table>
        </div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}
