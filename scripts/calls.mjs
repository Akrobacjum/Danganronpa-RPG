/**
 * Danganronpa RPG — Hope Calls and Despair Calls.
 * ---------------------------------------------------------------------------
 * The guide's two spending menus. Players buy advantages with Hope; Monokumas
 * buy interference with Despair.
 *
 * Most of these effects are narrative — "give another player advantage on one
 * roll", "add progress to a project in your room". The module does the part a
 * computer should do: check the cost is affordable, deduct it, and announce it
 * so nobody has to track it on paper. What the effect *means* stays at the
 * table, which is where the guide wants it.
 *
 * Hope Calls are whispered — spending Hope is your business. Despair Calls are
 * public: when Monokuma acts, the room should know.
 */

import { MODULE_ID, HOPE_CALLS, DESPAIR_CALLS, STARTING } from "./config.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { whisperToOwner, log, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * HOPE CALLS
 * ========================================================================== */

/** How much Hope this character is holding. */
export function hopeHeld(actor) {
    return resourceValue(actor, "hope");
}

/** Can they afford this call? */
export function canAffordHope(actor, key) {
    const call = HOPE_CALLS[key];
    if (!call) return false;
    return hopeHeld(actor) >= call.cost;
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

        const held = hopeHeld(actor);
        if (held < call.cost) {
            ui.notifications.warn(game.i18n.format("DRPG.Calls.notEnoughHope", {
                call: call.label, cost: call.cost, held
            }));
            return null;
        }

        await automatedUpdate(actor, { "system.resources.hope.value": held - call.cost });

        // Do the thing, not just charge for it.
        const { applyCall } = await import("./call-effects.mjs");
        const done = await applyCall(actor, key, "hope", choice);

        const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
        await whisperToOwner(actor, `
            <h3>${esc(call.label)}</h3>
            <p>${esc(call.effect)}</p>
            ${note ? `<blockquote>${esc(note)}</blockquote>` : ""}
            ${done.length ? `<ul>${done.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
            <p><em>${game.i18n.format("DRPG.Calls.hopeSpent", {
                cost: call.cost, left: held - call.cost
            })}</em></p>`);

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
 * Which pool is decided by who owns the actor — see monokuma.mjs — so two GMs
 * running two Monokumas each spend their own 12.
 */
export async function spendDespairCallFor(actor, key, { note = "", choice = {} } = {}) {
    try {
        const call = DESPAIR_CALLS[key];
        if (!call) return null;

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
        try {
            const { applyCall } = await import("./call-effects.mjs");
            done = await applyCall(actor, key, "despair", choice);
        } catch (err) {
            error(`${call.label} was paid for but its effect failed`, err);
            ui.notifications.error(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
        }

        const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
        if (note || done.length) {
            await ChatMessage.create({
                content: `${note ? `<blockquote>${esc(note)}</blockquote>` : ""}
                          ${done.length ? `<ul>${done.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}`
            });
        }

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
 * Confirm a Call. Just the effect, the price, and what it will be applied to —
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
            <p>${foundry.utils.escapeHTML(call.effect)}</p>
            ${aimed ? `<p><strong>${game.i18n.localize("DRPG.Calls.aimedAt")}:</strong> ${foundry.utils.escapeHTML(aimed)}</p>` : ""}
            <p class="${affordable ? "notes" : "drpg-warning"}">${
                game.i18n.format(kind === "hope" ? "DRPG.Calls.costsHope" : "DRPG.Calls.costsDespair", {
                    cost: call.cost, held
                })
            }</p>
        </div>`,
        buttons: [
            {
                action: "spend",
                label: game.i18n.format("DRPG.Calls.spend", { cost: call.cost }),
                default: true,
                callback: () => ""
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (result === "cancel" || result === null || result === undefined) ? null : "";
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
    return Object.entries(HOPE_CALLS).map(([key, call]) => ({
        key, ...call, affordable: held >= call.cost
    }));
}

/** Despair Calls, with affordability against a pool. */
export function despairCallsFor(poolValue = 0) {
    return Object.entries(DESPAIR_CALLS).map(([key, call]) => ({
        key, ...call, affordable: poolValue >= call.cost
    }));
}

/** Max Hope, for the sheet header. */
export function hopeMax(actor) {
    return resourceMax(actor, "hope") || STARTING.hopeMax;
}
