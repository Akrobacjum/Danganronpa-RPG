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
import { automatedUpdate } from "./resource-guard.mjs";
import { isEclipse } from "./eclipse.mjs";
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

        // The Eclipse is placement-only - see the guard in action-rolls.mjs's
        // `performAction` for the full reasoning. A Call is not a room
        // crossing, so it waits for the same next time of day everything else
        // does.
        if (isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
            return null;
        }

        /*
         * SILENCE, THE WEATHER (Z10) - not to be confused with the Silence
         * Despair Call above it in the same file, which a Monokuma BUYS and
         * aims at one player. This one was drawn by the overflow and falls on
         * everybody, which is why it is checked here rather than in the
         * per-player restrictions: there is nobody to look up.
         */
        const { overflowBlocksCalls } = await import("./overflow.mjs");
        if (overflowBlocksCalls()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Overflow.silenced"));
            return null;
        }

        // The dead spend nothing. The sheet stops offering them the Calls panel
        // at all, so this covers the two routes that skip the sheet: a window
        // left open across the moment of death, and the `game.drpg` API.
        // A Monocub is deceased but pays Hope for Meddle through its own path
        // in monocub.mjs, not through here, so it is unaffected.
        const { isDeceased } = await import("./chapter.mjs");
        if (isDeceased(actor)) {
            ui.notifications.warn(game.i18n.format("DRPG.Chapter.deadCannotAct", {
                name: actor.name
            }));
            return null;
        }

        // Silence, bought with 4 Despair, closes this menu until the clock moves.
        const { isSilenced } = await import("./call-effects.mjs");
        if (isSilenced(actor)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Calls.silencedNotice"));
            return null;
        }

        const held = hopeHeld(actor);
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
            let approved;
            if (game.user.isGM) {
                approved = await askHopeCallApproval(ask);
            } else {
                const { requestHopeCallApproval } = await import("./gm-bridge.mjs");
                approved = await requestHopeCallApproval(ask);
            }

            if (!approved) {
                ui.notifications.warn(game.i18n.format(
                    approved === null ? "DRPG.Calls.noAnswer" : "DRPG.Calls.refused",
                    { call: call.label }));
                log(`${call.label} was not allowed for ${actor.name}.`);
                return null;
            }

            const now = hopeHeld(actor);
            if (now < call.cost) {
                ui.notifications.warn(game.i18n.format("DRPG.Calls.notEnoughHope", {
                    call: call.label, cost: call.cost, held: now
                }));
                return null;
            }
        }

        await automatedUpdate(actor, { "system.resources.hope.value": held - call.cost });

        // Do the thing, not just charge for it.
        const { applyCall } = await import("./call-effects.mjs");
        const { lines: done, failed } = await applyCall(actor, key, "hope", choice);

        // The effect did not land, so the Hope goes back. Read the value again
        // rather than restoring `held`: a roll may have granted Hope in between,
        // and writing the old number would quietly erase it.
        if (failed) {
            const now = hopeHeld(actor);
            const max = resourceMax(actor, "hope") || STARTING.hopeMax;
            await automatedUpdate(actor, {
                "system.resources.hope.value": Math.min(max, now + call.cost)
            });
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

        // Same placement-only rule as a Hope Call - see the note above.
        if (isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
            return null;
        }

        const { poolUserFor } = await import("./monokuma.mjs");
        const user = poolUserFor(actor);
        if (!user) {
            ui.notifications.warn(game.i18n.localize("DRPG.Calls.noPool"));
            return null;
        }

        const { spendDespairCall } = await import("./despair.mjs");
        const ok = await spendDespairCall(user.id, key);
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
        const body = `${note ? `<blockquote>${esc(note)}</blockquote>` : ""}
                      ${done.length ? `<ul>${done.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}`;
        await announce({
            content: `<h3>${esc(call.label)}</h3>${body}`,
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
 * Confirm a call before paying for it, with room to say what it is aimed at.
 * @returns {Promise<string|null>} the note, or null if cancelled.
 */
/**
 * Confirm a Call. Just the effect, the price, and what it will be applied to -
 * no free-text box. The Call does the thing; explaining it is what the table is
 * for.
 *
 * @returns {Promise<""|null>} "" when confirmed, null when cancelled. The empty
 *   string keeps the caller's `note` plumbing intact without asking for one.
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
                 * THE NOTE IS THE REQUEST (Dawid, 29.08).
                 *
                 * For a Call that waits for a ruling, an empty box is not a
                 * request - it is a player asking the GM to guess what they
                 * meant. Returning `null` here cancels rather than sends, which
                 * is the same answer pressing Cancel gives, because a request
                 * nobody can rule on and no request are the same thing.
                 */
                callback: (event, button, dialog) => {
                    if (!call.needsGm) return "";
                    const written = dialog.element
                        .querySelector("[name=callNote]")?.value.trim() ?? "";
                    if (!written) {
                        ui.notifications.warn(game.i18n.localize("DRPG.Calls.needNote"));
                        return null;
                    }
                    return written;
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: !affordable }
        ],
        rejectClose: false
    });

    // `null` from the callback above means "they left the box empty", which is
    // a cancel. Anything else is the note, and for every other Call it is "".
    return (result === "cancel" || result === null || result === undefined) ? null : result;
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
