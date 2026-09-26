/**
 * Danganronpa RPG - Hope Calls and Despair Calls.
 * ---------------------------------------------------------------------------
 * The guide's two spending menus. Players buy advantages with Hope; Monokumas
 * buy interference with Despair.
 *
 * Most of these effects are narrative - "give another player advantage on one
 * roll", "add progress to a project in your room". The module does the part a
 * computer should do: check the cost is affordable, deduct it, and announce it
 * so nobody has to track it on paper. What the effect *means* stays at the
 * table, which is where the guide wants it.
 *
 * Hope Calls are whispered - spending Hope is your business. Despair Calls are
 * public: when Monokuma acts, the room should know.
 */

import { MODULE_ID, HOPE_CALLS, DESPAIR_CALLS, STARTING, callEffect } from "./config.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate, HOPE_REFUND } from "./resource-guard.mjs";
import { isEclipse } from "./eclipse.mjs";
import { getClock } from "./settings.mjs";
import { announce, whisperToOwner, log, error, esc} from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * HOPE CALLS
 * ========================================================================== */

/** How much Hope this character is holding. */
export function hopeHeld(actor) {
    return resourceValue(actor, "hope");
}

/**
 * Is this Call shut before anything is chosen or paid for (CALL-17, 20.09)?
 *
 * THE SAME ANSWER, ASKED AT THE DOOR AND AT THE BOUNDARY. These rules were only
 * ever asked inside `spendHopeCall` and `spendDespairCallFor`, which the sheet
 * reaches AFTER the target picker and the confirmation - so a player under an
 * Eclipse, a Monokuma in a Class Trial or a dead student picked a target, read the
 * price, pressed Spend, and only then learned the menu had been shut all along.
 * Three windows to be told no.
 *
 * Exported so the sheet can ask it first. The two spenders go on asking it too, and
 * that is not belt and braces: the sheet is one road in, `game.drpg` is another, and
 * the world can move between the question and the purchase.
 *
 * WHICH RULES ARE WHOSE. The Eclipse falls on both kinds. Overflow's Silence shuts
 * every student's HOPE Calls (handbook 7; `reader: "spendHopeCall"` in config.mjs)
 * and a Monokuma's Despair Calls go on under it - so it is asked on the Hope side
 * only, in the order `hopeCallBarred` asks it. This asked it for both, and the
 * sheet's Despair picker told a Monokuma the Silence had shut a menu the rules
 * leave open (review of stage D). The Class Trial shuts DESPAIR Calls only - T-1's
 * decision, written out in `spendDespairCallFor` - and a Monokuma is deceased by
 * definition, which is why the dead test is not asked of one.
 *
 * @returns {Promise<string|null>} the sentence to say, or null when nothing bars it.
 */
export async function callBarred(actor, { despair = false } = {}) {
    if (isEclipse()) return game.i18n.localize("DRPG.Eclipse.actionsLocked");

    if (despair) {
        if (getClock().phase === "classTrial") return game.i18n.localize("DRPG.Trial.callsLocked");
        return null;
    }

    const { overflowBlocksCalls } = await import("./overflow.mjs");
    if (overflowBlocksCalls()) return game.i18n.localize("DRPG.Overflow.silenced");

    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(actor)) {
        return game.i18n.format("DRPG.Chapter.deadCannotAct", { name: actor?.name ?? "?" });
    }
    return null;
}

/**
 * Why a Hope Call is barred right now, whatever it costs, or null.
 *
 * Split out of `hopeCallBarred` (E03) so the GM can ask it too: a Support a
 * player buys for somebody else is now paid for on the GM's side, and the GM
 * has to refuse it for the same reasons this client would have.
 *
 * @returns {Promise<string|null>} the sentence to say.
 */
export async function hopeCallRefusal(actor) {
    // The Eclipse is placement-only - see the guard in action-rolls.mjs's
    // `performAction` for the full reasoning. A Call is not a room
    // crossing, so it waits for the same next time of day everything else
    // does.
    if (isEclipse()) return game.i18n.localize("DRPG.Eclipse.actionsLocked");

    /*
     * SILENCE, THE WEATHER (Z10) - not to be confused with the Silence
     * Despair Call checked below, which a Monokuma BUYS and
     * aims at one player. This one was drawn by the overflow and falls on
     * everybody, which is why it is checked here rather than in the
     * per-player restrictions: there is nobody to look up.
     */
    const { overflowBlocksCalls } = await import("./overflow.mjs");
    if (overflowBlocksCalls()) return game.i18n.localize("DRPG.Overflow.silenced");

    // The dead spend nothing. The sheet stops offering them the Calls panel
    // at all, so this covers the two routes that skip the sheet: a window
    // left open across the moment of death, and the `game.drpg` API.
    // A Monocub is deceased but pays Hope for Meddle through its own path
    // in monocub.mjs, not through here, so it is unaffected.
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(actor)) return game.i18n.format("DRPG.Chapter.deadCannotAct", { name: actor.name });

    // Silence, bought with 4 Despair, closes this menu until this time of day ends.
    const { isSilenced } = await import("./call-effects.mjs");
    if (isSilenced(actor)) return game.i18n.localize("DRPG.Calls.silencedNotice");
    return null;
}

/**
 * Is a Hope Call barred right now, whatever it costs? Says why when it is.
 *
 * Asked twice by `spendHopeCall` (ACT-09, 17.09): before anything else, and
 * again after a GM's yes on the two Calls that wait for one. That wait can be
 * five minutes, and a Silence bought or an Eclipse begun in the meantime used
 * to be ignored - the Call went through on a ruling given to a different moment.
 *
 * @returns {Promise<boolean>}
 */
async function hopeCallBarred(actor) {
    const why = await hopeCallRefusal(actor);
    if (why) ui.notifications.warn(why);
    return Boolean(why);
}

/**
 * Spend a Hope Call.
 *
 * @param {Actor} actor
 * @param {string} key   A key from HOPE_CALLS.
 * @param {object} [options]
 * @param {string} [options.note]  What the player is aiming it at.
 */
export async function spendHopeCall(actor, key, { note = "", choice = {} } = {}) {
    try {
        const call = HOPE_CALLS[key];
        if (!call || !actor) return null;

        if (await hopeCallBarred(actor)) return null;

        let held = hopeHeld(actor);
        if (held < call.cost) {
            ui.notifications.warn(game.i18n.format("DRPG.Calls.notEnoughHope", {
                call: call.label, cost: call.cost, held
            }));
            return null;
        }

        /*
         * TWO CALLS WAIT FOR A RULING BEFORE ANYTHING IS PAID (Dawid, 29.08).
         *
         * Experience and Ultimate are the only Hope Calls whose effect is a
         * claim about the fiction - "this applies here" - which is the sentence
         * the handbook gives the GM to judge. See `needsGm` in config.mjs.
         *
         * CHARGED ON THE YES, NOT ON THE ASK. The alternative was to take the
         * Hope up front and refund a refusal, which is what the Despair Calls do
         * (trap 3) - but those pay for something that then happens, and this
         * pays for permission. A refund loop around a human who might take five
         * minutes to answer is a window in which the refund can be lost, and a
         * player watching their Hope leave for a request that was refused has
         * been charged for asking.
         *
         * SO THE PRICE IS RE-CHECKED AFTER THE YES. Between the ask and the
         * answer the player may have spent that Hope on something else, and the
         * check above is now stale.
         *
         * A GM asking on their own sheet skips the round trip: sending yourself
         * a socket message and waiting for your own dialog works, and is a
         * needlessly long way round to open the dialog directly.
         */
        if (call.needsGm) {
            const ask = {
                actorId: actor.id, actorName: actor.name, key,
                callLabel: call.label, effect: callEffect(call), cost: call.cost, note
            };

            /*
             * AN `if`, NOT A TERNARY, AND R6 IS RIGHT TO INSIST.
             *
             * The invariant wants the `game.user.isGM` test within three hundred
             * characters of the bridge call, on the grounds that a guard far
             * enough away to be out of sight is a guard the next editor will not
             * know is load-bearing. A ternary whose first branch carries a
             * six-field object literal pushed them apart - the guard was there
             * and it did not read as one.
             */
            // The sticky "waiting" card, raised before the fork so the GM
            // guard stays within sight of the bridge call (R6).
            const waiting = game.user.isGM ? () => {} : await showWaitingCard(call);
            let approved;
            try {
                if (game.user.isGM) {
                    approved = await askHopeCallApproval(ask);
                } else {
                    const { requestHopeCallApproval } = await import("./gm-bridge.mjs");
                    const res = await requestHopeCallApproval(ask);
                    // Not asked, not answered, refused by the GM's client: said once
                    // already, with "Nothing was spent." (E31). Only a GM's no is left
                    // for this card to say.
                    approved = res.ok ? res.value : null;
                }
            } finally {
                waiting();
            }

            if (approved === null) return null;
            if (!approved) {
                ui.notifications.warn(game.i18n.format("DRPG.Calls.refused", { call: call.label }));
                log(`${call.label} was not allowed for ${actor.name}.`);
                return null;
            }

            if (await hopeCallBarred(actor)) return null;
            const now = hopeHeld(actor);
            if (now < call.cost) {
                ui.notifications.warn(game.i18n.format("DRPG.Calls.notEnoughHope", {
                    call: call.label, cost: call.cost, held: now
                }));
                return null;
            }
            // The write below and the receipt both use `held`: the reading
            // from before the wait, during which a roll may have granted Hope
            // or another Call spent it. Charging `held - cost` then either
            // erased the grant or handed back what was spent.
            held = now;
        }

        /*
         * A SUPPORT ON SOMEBODY ELSE'S CHARACTER IS PAID FOR ON THE GM'S SIDE
         * (E03, 24.09.2026; audit S10-09, decision D2). Arming it is a write to a
         * sheet this player does not own, so it always went through the GM - and
         * the price stayed here, where the GM never saw it and a console did not
         * pay it. The GM now takes the Hope when it arms the Call (`handleArm`),
         * and refuses when there is not enough; this client charges nothing and,
         * when the Call does not land, has nothing to give back.
         */
        const gmPays = !game.user.isGM && call.target === "player" && Boolean(call.grants)
            && Boolean(choice?.target) && !choice.target.isOwner;
        if (!gmPays) await automatedUpdate(actor, { "system.resources.hope.value": held - call.cost });

        // Do the thing, not just charge for it.
        const { applyCall } = await import("./call-effects.mjs");
        const { lines: done, failed } = await applyCall(actor, key, "hope", choice);

        if (failed && gmPays) {
            ui.notifications.warn(game.i18n.format("DRPG.Calls.notArmedNotCharged", { call: call.label }));
            log(`${call.label} was not armed by the GM; ${actor.name} was not charged.`);
            return null;
        }

        // The effect did not land, so the Hope goes back. Read the value again
        // rather than restoring `held`: a roll may have granted Hope in between,
        // and writing the old number would quietly erase it.
        if (failed) {
            const now = hopeHeld(actor);
            const max = resourceMax(actor, "hope") || STARTING.hopeMax;
            await automatedUpdate(actor, {
                "system.resources.hope.value": Math.min(max, now + call.cost)
            }, { [HOPE_REFUND]: true });
            ui.notifications.warn(game.i18n.format("DRPG.Calls.refunded", {
                call: call.label, cost: call.cost
            }));
            log(`${call.label} failed; ${call.cost} Hope returned to ${actor.name}.`);
            return null;
        }

        // A Hope Call is spent Hope. There is no reading to do - the card wears
        // gold because of what it is, the same gold a Hope roll wears.
        await whisperToOwner(actor, `
            <h3>${esc(call.label)}</h3>
            <p>${esc(callEffect(call))}</p>
            ${note ? `<blockquote>${esc(note)}</blockquote>` : ""}
            ${done.length ? `<ul>${done.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
            <p><em>${game.i18n.format("DRPG.Calls.hopeSpent", {
                cost: call.cost, left: held - call.cost
            })}</em></p>`, { flags: { [MODULE_ID]: { popupTone: "hope", sfx: "hopeCall" } } });

        log(`${actor.name} spent ${call.cost} Hope on ${call.label}.`);
        Hooks.callAll("drpgHopeCall", { actor, key, call, note, choice });
        return call;
    } catch (err) {
        error("Hope Call failed", err);
        return null;
    }
}

/* ==========================================================================
 * DESPAIR CALLS
 * ========================================================================== */

/**
 * Spend a Despair Call from a Monokuma actor's pool.
 *
 * Which pool is decided by who owns the actor - see monokuma.mjs - so two GMs
 * running two Monokumas each spend their own 12.
 */
export async function spendDespairCallFor(actor, key, { note = "", choice = {} } = {}) {
    try {
        const call = DESPAIR_CALLS[key];
        if (!call) return null;

        // A Monokuma's purchase, and a Monokuma is a GM (E03; audit S09-11). On a
        // player's client the pool write is a silent no-op while the effect still
        // went through the bridge - a free Obstacle from the console.
        if (!game.user.isGM) {
            ui.notifications.warn(game.i18n.localize("DRPG.Calls.despairGmOnly"));
            return null;
        }

        // Same placement-only rule as a Hope Call - see the note above.
        if (isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
            return null;
        }

        /*
         * AND A CLASS TRIAL SHUTS THEM TOO (T-1, Dawid 17.09).
         *
         * The trial is an argument between students, and a Monokuma who can arm a
         * disadvantage on the next Objection is arguing for them. Hope Calls stay
         * open, deliberately, and that asymmetry is the decision: see
         * `hopeCallBarred` above, which is NOT given a trial branch.
         */
        if (getClock().phase === "classTrial") {
            ui.notifications.warn(game.i18n.localize("DRPG.Trial.callsLocked"));
            return null;
        }

        const { poolUserFor } = await import("./monokuma.mjs");
        const user = poolUserFor(actor);
        if (!user) {
            ui.notifications.warn(game.i18n.localize("DRPG.Calls.noPool"));
            return null;
        }

        // Before the pool is touched: a Call that would change nothing - a room
        // already sealed, a track already full, Hope bought under the darkening
        // (DESP-04), a project that cannot move (CALL-10) - is turned away with
        // its reason, rather than paid, applied, refunded and only then
        // explained. See `refusalBeforePaying` and `projectRefusal`.
        const { refusalBeforePaying, projectRefusal } = await import("./call-effects.mjs");
        const refusal = refusalBeforePaying(call, choice) ?? await projectRefusal(call, choice);
        if (refusal) {
            ui.notifications.warn(refusal);
            return null;
        }

        const { spendDespairCall, poolLabel } = await import("./despair.mjs");
        // One card, after the effect (DESP-11, CALL-13): `announce: false` keeps
        // `spendDespairCall` from posting its own, and the announcement is this
        // function's, below, with the effect's own receipt lines on it.
        const ok = await spendDespairCall(user.id, key, { announce: false });
        if (!ok) return null;

        // Despair is now spent. Applying the effect is separated from the
        // announcement above so a failure in one cannot cost the other.
        let done = [];
        let failed = false;
        try {
            const { applyCall } = await import("./call-effects.mjs");
            const result = await applyCall(actor, key, "despair", choice);
            done = result.lines;
            failed = result.failed;
        } catch (err) {
            error(`${call.label} was paid for but its effect failed`, err);
            ui.notifications.error(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
            failed = true;
        }

        // Same rule as Hope: a Monokuma who paid for nothing gets it back. The
        // pool is a world setting, so this goes through the same adjuster the
        // spend did rather than writing a remembered number.
        if (failed) {
            const { adjustDespair } = await import("./despair.mjs");
            await adjustDespair(user.id, call.cost);
            ui.notifications.warn(game.i18n.format("DRPG.Calls.refunded", {
                call: call.label, cost: call.cost
            }));
            log(`${call.label} failed; ${call.cost} Despair returned to ${user.name}.`);
            return null;
        }


        /*
         * THE TABLE IS ALWAYS TOLD (Dawid, 28.08).
         *
         * This used to post only when the Monokuma had typed a note or the
         * call had produced a list - so a Despair Call spent without either
         * happened in complete silence, with no card and, once sounds existed,
         * nothing to carry one. A Despair Call is the loudest thing a Monokuma
         * can do; the table finding out is the point of it.
         *
         * The name of the call is the content when there is nothing else, so
         * an empty card cannot happen. It wears Blood, because a Despair Call
         * is spent Despair.
         */
        /* AND THE PRICE IS ON THIS CARD (DESP-11, CALL-13). It used to be on a
           second card that `spendDespairCall` posted before the effect ran - see
           the note there. Built after the refund branch above, so it is only ever
           posted for a purchase that held. `poolLabel` rather than the account's
           name, because that is what the Despair bar calls it. */
        const body = `<p>${esc(callEffect(call))}</p>
                      ${note ? `<blockquote>${esc(note)}</blockquote>` : ""}
                      ${done.length ? `<ul>${done.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
                      <p><em>${game.i18n.format("DRPG.Despair.spent", {
                          name: esc(poolLabel(user) ?? user?.name ?? "?"), cost: call.cost
                      })}</em></p>`;
        await announce({
            content: `<h3>${game.i18n.localize("DRPG.Despair.callTitle")} - ${esc(call.label)}</h3>${body}`,
            flags: { [MODULE_ID]: { popupTone: "fear", sfx: { key: "despairCall", gm: true } } }
        });

        Hooks.callAll("drpgDespairCall", { actor, user, key, call, note, choice });
        return call;
    } catch (err) {
        error("Despair Call failed", err);
        return null;
    }
}

/* ==========================================================================
 * SHARED DIALOG
 * ========================================================================== */

/**
 * Refuse a Call whose note is empty, before the window can start closing (CALL-12).
 *
 * A BUTTON CALLBACK CANNOT SAY NO. Read from Foundry 14.365's own source,
 * client/applications/api/dialog.mjs:273:
 *
 *     const result = (await button?.callback?.(event, target, this)) ?? button?.action;
 *
 * so a callback returning `null` comes back as the button's own name - the player's
 * note arrived at the GM as the word "spend" - and line 276 closes the window
 * whatever the callback returned, because DEFAULT_OPTIONS sets
 * `form: { closeOnSubmit: true }`. The player was warned, the window shut, and the
 * GM got an approval request whose entire body was one machine word, on the one
 * pair of Calls where the sentence IS the request.
 *
 * THE ONLY WAY TO KEEP THE WINDOW OPEN IS TO STOP THE SUBMIT FROM STARTING.
 * ApplicationV2 delegates every `[data-action]` click from one listener on the app
 * root in the bubble phase, and DialogV2 also listens for `submit` on the form; a
 * capture listener on the button itself runs before both. All three stops are
 * load-bearing: `stopImmediatePropagation` for anything else on this button,
 * `stopPropagation` for the root's delegated listener, and `preventDefault` for the
 * implicit submission a submit button performs by itself.
 *
 * `type: "button"` IS NOT THE ANSWER - it still closes the window, because the
 * action dispatch calls `_onSubmit` whatever the button's type. Throwing is not the
 * answer either: a throw inside submit leaves the window refusing every button
 * including its own X, which investigation.mjs has already paid for.
 */
function wireNoteGate(dialog, call) {
    if (!call.needsGm) return;
    const spend = dialog.element?.querySelector('button[data-action="spend"]');
    const box = dialog.element?.querySelector("[name=callNote]");
    if (!spend || !box) return;

    spend.addEventListener("click", event => {
        if (box.value.trim()) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.needNote"));
        box.focus();
    }, { capture: true });
}

/**
 * Confirm a Call: the effect, the price, what it will be applied to - and, for the
 * two that wait for a ruling, the sentence that IS the request.
 *
 * Two doc blocks used to stand here saying different things, one of them from
 * before the note box existed ("no free-text box"). This is the contract:
 *
 * @returns {Promise<string|null>} the note for a Call that needs one, `""` for
 *   every other Call, and `null` for a cancel - which now includes a needsGm Call
 *   whose box is empty, because a request nobody can rule on and no request are
 *   the same thing (Dawid, 29.08).
 */
export async function confirmCall(call, { kind = "hope", held = 0, choice = {} } = {}) {
    const affordable = held >= call.cost;
    const aimed = describeChoice(choice);

    const result = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", kind === "hope" ? "drpg-hope-dialog" : "drpg-despair-dialog"],
        content: `<div>
            <p>${foundry.utils.escapeHTML(callEffect(call))}</p>
            ${aimed ? `<p><strong>${game.i18n.localize("DRPG.Calls.aimedAt")}:</strong> ${foundry.utils.escapeHTML(aimed)}</p>` : ""}
            <p class="${affordable ? "notes" : "drpg-warning"}">${
                game.i18n.format(kind === "hope" ? "DRPG.Calls.costsHope" : "DRPG.Calls.costsDespair", {
                    cost: call.cost, held
                })
            }</p>
            ${call.needsGm ? `
                <label class="drpg-call-note">
                    <span>${game.i18n.localize("DRPG.Calls.tellGm")}</span>
                    <textarea name="callNote" rows="3" placeholder="${
                        foundry.utils.escapeHTML(game.i18n.localize(
                            `DRPG.Calls.tellGmPlaceholder.${call.grants === "experience"
                                ? "experience" : "ultimate"}`))}"></textarea>
                </label>
                <p class="notes">${game.i18n.localize("DRPG.Calls.waitsForGm")}</p>` : ""}
        </div>`,
        buttons: [
            {
                action: "spend",
                label: game.i18n.format("DRPG.Calls.spend", { cost: call.cost }),
                default: affordable,
                // Refusing at the last step is worse than not offering the step.
                // The price was already shown in red; leaving the button live
                // meant the only way to learn you could not pay was to press it.
                disabled: !affordable,
                /*
                 * THE NOTE IS THE REQUEST (Dawid, 29.08), and this is only the
                 * READER of it now - `wireNoteGate` above refuses an empty box
                 * before the submit starts, because a callback cannot refuse
                 * anything. See the note on it for what was measured.
                 */
                callback: (event, button, dialog) => call.needsGm
                    ? (dialog.element.querySelector("[name=callNote]")?.value.trim() ?? "")
                    : ""
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: !affordable }
        ],
        render: (event, dialog) => wireNoteGate(dialog, call),
        rejectClose: false
    });

    if (result === "cancel" || result === null || result === undefined) return null;
    /* AND ASKED AGAIN WHERE NOTHING ABOUT THE WINDOW CAN LIE TO IT (CALL-12). The
       gate above lives in the interface, and an empty string does not trip
       `?? button.action` - that operator fires on null and undefined only - so
       without this line an empty note could still travel to the GM as an empty
       blockquote. A needsGm Call with nothing written is the same answer Cancel
       gives. */
    if (call.needsGm && !String(result).trim()) return null;
    return result;
}

/**
 * A sticky notice while the GM decides (COMM-04). The player used to see
 * nothing at all between pressing the tile and the answer, and could not tell
 * a GM reading the question from a socket that had dropped it.
 */
async function showWaitingCard(call) {
    try {
        const { showWaiting } = await import("./popup.mjs");
        return showWaiting(game.i18n.format("DRPG.Calls.waitingGm", { call: call.label }), call.label);
    } catch {
        return () => {};
    }
}

/**
 * The GM's ruling on a Call that needs one. Runs on a GM's client only.
 *
 * WHAT THE GM IS BEING ASKED is not "is this allowed" in the abstract - it is
 * the handbook's own gate: does the experience, or the talent, GENUINELY apply
 * to what this player is about to do. So the player's sentence is the body of
 * the window and the rest is context.
 *
 * @returns {Promise<boolean>} true to allow. A closed window is a refusal,
 *   because an unanswered request must not become a yes by default.
 */
export async function askHopeCallApproval(payload = {}) {
    if (!game.user.isGM) return false;

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Calls.approveTitle", {
            call: payload.callLabel ?? "" }) },
        classes: ["drpg-panel", "drpg-hope-dialog"],
        content: `<div>
            <p><strong>${esc(payload.actorName)}</strong> - ${esc(payload.callLabel)}
                (${esc(payload.cost)} Hope)</p>
            <p class="notes">${esc(payload.effect)}</p>
            <blockquote>${esc(payload.note)}</blockquote>
            <p class="notes">${game.i18n.localize("DRPG.Calls.approveHint")}</p>
        </div>`,
        buttons: [
            { action: "yes", label: game.i18n.localize("DRPG.Calls.approveYes"), default: true },
            { action: "no", label: game.i18n.localize("DRPG.Calls.approveNo") }
        ],
        rejectClose: false
    });

    return result === "yes";
}

/** Human-readable summary of whatever the Call was pointed at. */
function describeChoice(choice = {}) {
    if (choice.text) return choice.text;
    if (choice.target?.name) return choice.target.name;
    if (choice.room) return choice.room;
    if (choice.item?.name) return choice.item.name;
    if (choice.project) {
        try {
            const data = game.settings.get("daggerheart", "Countdowns");
            return data?.countdowns?.[choice.project]?.name ?? null;
        } catch {
            return null;
        }
    }
    return null;
}

/** Hope Calls a character could pay for right now. */
export function affordableHopeCalls(actor) {
    const held = hopeHeld(actor);
    return byPrice(Object.entries(HOPE_CALLS).map(([key, call]) => ({
        key, ...call, affordable: held >= call.cost
    })));
}

/** Despair Calls, with affordability against a pool. */
export function despairCallsFor(poolValue = 0) {
    return byPrice(Object.entries(DESPAIR_CALLS).map(([key, call]) => ({
        key, ...call, affordable: poolValue >= call.cost
    })));
}

/**
 * Cheapest first.
 *
 * SORTED ON THE WAY OUT, not rearranged in config.mjs. That table is the rules
 * written down, and its order is thematic - the Calls that do similar things
 * sit together, which is how you read a rulebook. A panel is read the other
 * way: you look at what you can afford. `fuelTheCub` costs 1 and was listed
 * after `silence`, which costs 4, so the Despair panel opened with the two
 * most expensive Calls and buried the cheap one at the bottom.
 *
 * Ties keep the table's own order - `sort` is stable - so the thematic
 * grouping survives inside each price band.
 */
function byPrice(calls) {
    return calls.sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
}

/** Max Hope, for the sheet header. */
export function hopeMax(actor) {
    return resourceMax(actor, "hope") || STARTING.hopeMax;
}
