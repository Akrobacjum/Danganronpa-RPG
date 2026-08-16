/**
 * Danganronpa RPG — the Mastermind and the Final Trial.
 * ---------------------------------------------------------------------------
 * Guide, pp. 32–33: "Wśród graczy ukryty jest mastermind" — hidden AMONG the
 * players. This is the single most important secret the game has, and it gets
 * treated that way: nothing about it ever touches an actor document.
 *
 * WHY NOT A FLAG. Every other role in this module — Monokuma, Monocub, dead —
 * is public knowledge at the table, so a plain actor flag (world data, which
 * D6 already established Foundry ships to every client regardless of
 * ownership) costs nothing to use. The Mastermind's identity is exactly the
 * opposite: it must be unreadable from ANY client but a GM's. So it lives in a
 * client-scoped setting on GM browsers only, synced GM-to-GM over a socket the
 * server addresses to named recipients — the same treatment `truth-bullets.mjs`
 * gives the answer key, just for a single actor id instead of a ledger.
 *
 * Everything else the guide asks for is either already built or genuinely
 * small:
 *   private intel        the messenger from Stage B — no new code
 *   Despair → Hope        `despair.mjs`'s `convertDespairToHope`, shared with
 *                         Monocub rather than reimplemented
 *   Final Truth Remnant   `type: "final"` on the existing Remnant system,
 *                         reinforced by its own config entry
 *   the Final Trial       the SAME floor, Present/OBJECTION and vote as any
 *                         other Class Trial (Stage 9) — only the verdict's
 *                         consequences differ, so only the verdict is new here
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { isDeceased, killCharacter } from "./chapter.mjs";
import { remnantsOn, remnantData } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { announce, dialogContent, whisperToGms, gmIds, log, warn, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_SET = "mastermind.set";
const ACTION_REQUEST = "mastermind.request";

/* ==========================================================================
 * IDENTITY — GM browsers only, never world data
 * ========================================================================== */

function readStore() {
    if (!game.user.isGM) return {};
    try {
        return game.settings.get(MODULE_ID, SETTINGS.mastermind) ?? {};
    } catch {
        return {};
    }
}

async function writeStore(actorId) {
    if (!game.user.isGM) return;
    const entry = { actorId: actorId || null, updated: Date.now() };
    await game.settings.set(MODULE_ID, SETTINGS.mastermind, entry);
    syncToGms(entry);
}

function syncToGms(entry) {
    const recipients = gmIds().filter(id => id !== game.user.id);
    if (!recipients.length) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_SET, from: game.user.id, entry }, { recipients });
    } catch (err) {
        error("Could not sync the Mastermind to the other GMs", err);
    }
}

/** The Mastermind's actor. `null` for anyone who is not a GM — not an error. */
export function mastermindActor() {
    if (!game.user.isGM) return null;
    const id = readStore().actorId;
    return id ? (game.actors.get(id) ?? null) : null;
}

/** Is this actor the Mastermind? Always `false` off a non-GM client. */
export function isMastermind(actor) {
    return Boolean(game.user.isGM && actor && mastermindActor()?.id === actor.id);
}

/**
 * Choose the Mastermind. GM only, and singular — the guide's "DMowie wybierają
 * go" is one student, picked "w uzgodnieniu z samym graczem" before the season
 * starts. That agreement is a conversation this module cannot have for you;
 * the dialog only says so.
 */
export async function setMastermind(actor) {
    if (!game.user.isGM || !actor) return null;
    await writeStore(actor.id);
    log(`Mastermind set (visible to GMs only).`);
    return actor;
}

/** Clear the pick — a fresh season, or a correction. */
export async function clearMastermind() {
    if (!game.user.isGM) return;
    await writeStore(null);
}

export function registerMastermind() {
    /*
     * GM-to-GM only, and that has to be checked on BOTH ends.
     *
     * It used to be checked on one. "A player's client never receives this — the
     * server filters by `recipients`" was true and beside the point: nothing
     * stopped a player from SENDING one. Two consequences, and the second is the
     * worst hole this module has had:
     *
     *   · a forged `set` with a large `updated` rewrote every GM's copy of who
     *     the Mastermind is;
     *   · a forged `request` was answered — the reply went to `payload.from`,
     *     an id the sender chose, so any player could ask the GMs to send them
     *     the Mastermind's identity and be given it.
     *
     * Both are closed the same way: trust Foundry's own `senderId` argument and
     * nothing inside the payload. `from` is kept only so a GM ignores its own
     * broadcast, and the reply is addressed to whoever actually asked.
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (!game.user.isGM) return;
        if (!game.users.get(senderId)?.isGM) {
            if (payload?.action === ACTION_SET || payload?.action === ACTION_REQUEST) {
                warn(`Refused a Mastermind "${payload.action}" from a non-GM (${
                    game.users.get(senderId)?.name ?? senderId}).`);
            }
            return;
        }
        if (senderId === game.user.id) return;

        if (payload?.action === ACTION_SET) {
            const mine = readStore();
            if ((mine.updated ?? 0) >= (payload.entry?.updated ?? 0)) return;
            await game.settings.set(MODULE_ID, SETTINGS.mastermind, payload.entry);
            return;
        }

        if (payload?.action === ACTION_REQUEST) {
            const mine = readStore();
            if (!mine.actorId) return;
            try {
                game.socket.emit(SOCKET_EVENT,
                    { action: ACTION_SET, from: game.user.id, entry: mine },
                    { recipients: [senderId] });
            } catch (err) {
                error("Could not answer a Mastermind request", err);
            }
        }
    });

    // A GM who just joined, or whose browser storage was cleared, asks the
    // others rather than starting the season blind.
    //
    // EVERY GM asks, not only the primary one — the same unconditional catch-up
    // `truth-bullets.mjs` does for the answer key. Gating it on `isPrimaryGm()`
    // meant the one client most likely to be missing the pick, a second GM
    // joining after the season started, was the one client that never asked.
    if (game.user.isGM) {
        const recipients = gmIds().filter(id => id !== game.user.id);
        if (recipients.length) {
            try {
                game.socket.emit(SOCKET_EVENT,
                    { action: ACTION_REQUEST, from: game.user.id }, { recipients });
            } catch (err) {
                error("Could not ask the other GMs for the Mastermind", err);
            }
        }
    }
}

/**
 * Pick, clear, or top up the Mastermind. The one screen for all of it, since
 * showing the current pick and the controls to change it on two different
 * screens is two more places this secret could end up on somebody's shared
 * screen than it needs to be.
 */
/**
 * Announce or withdraw the Final Trial. Moved here from the GM panel, which used
 * to own a tile for it; it is the same subject as the Mastermind screen and
 * belongs on the same window.
 */
async function toggleFinalTrialFlag() {
    const DialogV2 = foundry.applications.api.DialogV2;
    const next = !inFinalTrial();

    const sure = await DialogV2.confirm({
        window: { title: game.i18n.localize("DRPG.Mastermind.toggleFinalTrial") },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize(
            next ? "DRPG.Mastermind.confirmStart" : "DRPG.Mastermind.confirmEnd")}</p>`,
        rejectClose: false
    });
    if (!sure) return;

    await setFinalTrial(next);
    ui.notifications.info(game.i18n.localize(
        next ? "DRPG.Mastermind.started" : "DRPG.Mastermind.ended"));

    // Say it out loud, because the window promised to.
    //
    // "Announce the Final Trial? This is public — everyone sees it start" is
    // what the GM agreed to, and then the only thing that happened was a local
    // notification on their own screen. Checked twice while testing: the flag
    // flipped, the players saw nothing at all. The one moment the season has
    // been building to arrived in silence.
    //
    // Starting is public. ENDING is not announced: the flag comes down after
    // the verdict, which has its own card, and a second "the Final Trial is
    // over" underneath it would be the module talking to itself.
    if (!next) return;

    await announce({
        content: `<div class="drpg-evidence-card objection">
            <div class="drpg-objection-banner">${
                game.i18n.localize("DRPG.Mastermind.finalBanner")}</div>
            <p>${game.i18n.localize("DRPG.Mastermind.finalAnnounce")}</p>
        </div>`
    });
}

export async function openMastermindDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const students = studentActors();
    const current = mastermindActor();

    const options = students.map(a =>
        `<option value="${a.id}"${a.id === current?.id ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const { monokumas, poolLabel, getDespair } = await import("./despair.mjs");
    const gms = monokumas();
    const donors = gms.map(u =>
        `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))} (${getDespair(u.id)})</option>`
    ).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Mastermind.dialogTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.privacyWarning")}</p>
            <label>${game.i18n.localize("DRPG.Mastermind.whoIs")}
                <select name="who">
                    <option value="">${game.i18n.localize("DRPG.Mastermind.nobody")}</option>
                    ${options}
                </select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.dialogIntro")}</p>
            ${current ? `
            <fieldset>
                <legend>${game.i18n.localize("DRPG.Monocub.giveHope")}</legend>
                <p class="notes">${game.i18n.format("DRPG.Mastermind.hopeReadout", {
                    held: current.system?.resources?.hope?.value ?? 0
                })}</p>
                <select name="donor">${donors}</select>
                <input type="number" name="amount" min="1" value="1" style="width:4em" />
                <button type="button" class="drpg-mini-button" data-drpg-give>
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>
            </fieldset>` : ""}
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                // An OBJECT, not the bare value.
                //
                // "Apply with nobody selected" and "the GM shut the window"
                // both used to arrive here as a falsy `result`, and the code
                // below read either of them as "clear the Mastermind". So
                // closing this window with the X — changing nothing, touching
                // nothing — deleted the secret of the season. Measured: set the
                // Mastermind, open, close, gone.
                //
                // Wrapping the answer makes the two distinguishable: a dismissal
                // is `null`, a deliberate clear is `{ who: "" }`.
                callback: (e, b, d) => ({ who: d.element.querySelector("[name=who]").value })
            },
            // The endgame used to be three GM-panel tiles — pick the Mastermind,
            // toggle the Final Trial, rule on it — which is one subject split
            // across three trips through the panel, on a screen that names the
            // one secret the module guards hardest. They are buttons here now.
            //
            // Labelled by state rather than "start or end": one button doing two
            // opposite things is a coin flip when the GM is reading quickly, and
            // this one is next to the button that used to wipe the season.
            { action: "toggleFinal", label: game.i18n.localize(inFinalTrial()
                ? "DRPG.Mastermind.endFinalTrial" : "DRPG.Mastermind.startFinalTrial") },
            { action: "finalVerdict", label: game.i18n.localize("DRPG.Mastermind.verdictTitle") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            dialog.element.querySelector("[data-drpg-give]")?.addEventListener("click", async () => {
                const donorId = dialog.element.querySelector("[name=donor]")?.value;
                const amount = Number(dialog.element.querySelector("[name=amount]")?.value) || 0;
                if (donorId && amount > 0 && current) {
                    const { convertDespairToHope } = await import("./despair.mjs");
                    await convertDespairToHope(donorId, current, amount);
                    await dialog.close();
                    await openMastermindDialog();
                }
            });
        },
        rejectClose: false
    });

    // Anything that is not one of this dialog's own answers is a dismissal, and
    // a dismissal changes nothing. `rejectClose: false` turns the X and Escape
    // into a `null` that used to fall all the way through to the clear.
    if (!result || result === "cancel") return null;

    // Both of these open a window of their own and then come back here, so the
    // GM lands on the screen they pressed the button from rather than on the
    // scene. Same pattern the GM panel uses for its own tiles.
    if (result === "toggleFinal") {
        await toggleFinalTrialFlag();
        return openMastermindDialog();
    }
    if (result === "finalVerdict") {
        await openFinalVerdictDialog();
        return openMastermindDialog();
    }

    // Only the Apply button reaches here, and it always brings an object — so
    // an empty `who` is the GM choosing "Nobody" on purpose.
    const who = result.who ?? null;

    if (!who) {
        if (current) {
            await clearMastermind();
            ui.notifications.info(game.i18n.localize("DRPG.Mastermind.cleared"));
        }
        return null;
    }

    if (who !== current?.id) {
        const picked = game.actors.get(who);
        await setMastermind(picked);
        // Setting it used to confirm nothing at all: no notification, no
        // whisper, no entry. The secret must not go to chat, but the person who
        // just set it is entitled to know it took.
        ui.notifications.info(game.i18n.format("DRPG.Mastermind.confirmed",
            { name: picked?.name ?? "?" }));
    }

    return who;
}

/* ==========================================================================
 * THE FINAL TRUTH REMNANT
 * --------------------------------------------------------------------------
 * Nothing new mechanically — `type: "final"` already exists in REMNANT_TYPES,
 * already carries `reinforced: true`, and `dropRemnant`/`placeRemnant` already
 * know how to place it. This is only the "did I remember this chapter" check
 * the guide's cadence ("co rozdział") asks for.
 * ========================================================================== */

/** Has a Final Truth Remnant been placed this chapter, on any scene? */
export function finalTruthPlacedThisChapter() {
    const chapter = getClock().chapter;
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (data?.type === "final" && data.chapter === chapter) return true;
        }
    }
    return false;
}

/* ==========================================================================
 * FINAL TRIAL
 * ========================================================================== */

/** Is a Final Trial the kind of Class Trial running right now? Flavour only. */
export function inFinalTrial() {
    return Boolean(getClock().finalTrial);
}

/** Toggle the flag. Announces to the table — this part is not a secret. */
export async function setFinalTrial(value) {
    if (!game.user.isGM) return null;
    return setClock({ finalTrial: Boolean(value) });
}

/**
 * The Final Trial's verdict.
 *
 * Deliberately not `vote.mjs`'s `applyVerdict`: the guide's consequences here
 * are a different shape entirely. A normal wrong guess executes an innocent
 * and pays the Monokumas; a wrong Final Trial guess does neither — it reveals
 * that the game was never what it looked like, and nobody new dies for it.
 *
 * "Correct" branches on the Mastermind being alive to answer for it — if they
 * already died earlier in the season, the guide's own text is the reveal
 * branch regardless of who the table names: "W wypadku gdy ten nie żyje -
 * zdemaskować, że gra w którą grają właściwie już się nie toczy."
 */
export async function openFinalVerdictDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const mastermind = mastermindActor();
    if (!mastermind) {
        ui.notifications.warn(game.i18n.localize("DRPG.Mastermind.noneSet"));
        return null;
    }

    const alreadyDead = isDeceased(mastermind);
    const students = studentActors();
    const options = students
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Mastermind.verdictTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Mastermind.verdictIntro")}</p>
            ${alreadyDead
                ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.alreadyDeadNote")}</p>`
                : ""}
            <label>${game.i18n.localize("DRPG.Mastermind.whoWasAccused")}
                <select name="accused">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.verdictNote")}</p>
        </form>`),
        buttons: [
            {
                action: "correct", label: game.i18n.localize("DRPG.Mastermind.correctlyNamed"),
                default: !alreadyDead,
                disabled: alreadyDead,
                callback: (e, b, d) => ({
                    correct: true, accusedId: d.element.querySelector("[name=accused]").value
                })
            },
            {
                action: "wrong", label: game.i18n.localize("DRPG.Mastermind.notCorrectlyNamed"),
                default: alreadyDead,
                callback: (e, b, d) => ({
                    correct: false, accusedId: d.element.querySelector("[name=accused]").value
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyFinalVerdict({ ...result, alreadyDead });
}

export async function applyFinalVerdict({ correct, accusedId, alreadyDead = null } = {}) {
    if (!game.user.isGM) return null;

    const mastermind = mastermindActor();
    if (!mastermind) return null;
    const dead = alreadyDead ?? isDeceased(mastermind);
    const accused = accusedId ? game.actors.get(accusedId) : null;

    const executed = correct && !dead;

    if (executed) {
        await killCharacter(mastermind);
    }

    await announce({
        content: `<div class="drpg-evidence-card objection">
            <div class="drpg-objection-banner">${game.i18n.localize(
                executed ? "DRPG.Mastermind.defeatedBanner" : "DRPG.Mastermind.revealedBanner")}</div>
            <p>${game.i18n.localize(
                executed ? "DRPG.Mastermind.defeatedText" : "DRPG.Mastermind.revealedText")}</p>
        </div>`
    });

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Mastermind.verdictTitle")}</h3>
        <p>${game.i18n.format("DRPG.Mastermind.verdictSummary", {
            mastermind: foundry.utils.escapeHTML(mastermind.name),
            accused: foundry.utils.escapeHTML(accused?.name ?? "—"),
            outcome: game.i18n.localize(executed ? "DRPG.Mastermind.outcomeExecuted"
                : dead ? "DRPG.Mastermind.outcomeAlreadyDead" : "DRPG.Mastermind.outcomeEscaped")
        })}</p>`);

    // The season is over either way — a Final Trial is the guide's ending, not
    // a chapter like the others. Clearing the pick here rather than leaving it
    // set is what makes `mastermindActor()` honestly answer "nobody" afterwards.
    await clearMastermind();

    log(`Final Trial verdict applied: ${executed ? "executed" : "revealed, not executed"}.`);
    return { executed, dead };
}
