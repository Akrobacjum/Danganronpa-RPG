/**
 * Danganronpa RPG — calling the GM, and asking them to write.
 * ---------------------------------------------------------------------------
 * Two jobs:
 *
 *   callGm()  — the guide's actions that need a human ruling (Think, Listen,
 *               Analyze, Direct Murder, starting a project). The player's roll
 *               and request are whispered to the GMs with the context they need
 *               to answer, so nobody has to shout across the table.
 *
 *   request*() — world settings can only be written by a GM client, so a
 *               player's project progress is forwarded over the socket.
 */

import { MODULE_ID, TRAITS } from "./config.mjs";
import { whisperToGms, whisperToOwner, isPrimaryGm, debug, error } from "./utils.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_PROGRESS = "project.progress";
const ACTION_SHARE = "project.share";
const ACTION_REMNANT = "remnant.place";
const ACTION_CREATE = "project.create";
const ACTION_SABOTAGE = "project.sabotage";
const ACTION_SENDBACK = "token.sendBack";
const ACTION_ECLIPSE_MOVE = "eclipse.move";
const ACTION_ARM = "call.arm";
const ACTION_DESPAIR = "despair.adjust";

export function registerGmBridge() {
    game.socket.on(SOCKET_EVENT, onSocket);
}

async function onSocket(payload) {
    if (!isPrimaryGm()) return;

    if (payload?.action === ACTION_PROGRESS) {
        const { addProgress } = await import("./projects.mjs");
        const result = await addProgress(payload.countdownId, payload.amount);
        debug(`Applied ${payload.amount} progress to ${payload.countdownId} on behalf of a player.`, result);

        // Report back to whoever asked.
        //
        // A player cannot see whether their request arrived, was applied, or was
        // clamped to nothing — so a project that refused to move looked exactly
        // like a socket that never fired. Now it says which of the three it was.
        const to = payload.userId ? [payload.userId] : [];
        if (!to.length) return;

        const line = !result
            ? game.i18n.localize("DRPG.Project.gone")
            : result.changed === false
                ? game.i18n.format(result.reason ?? "DRPG.Project.alreadyFull", {
                      name: result.name, current: result.from, target: result.target
                  })
                : game.i18n.format("DRPG.Project.now", {
                      project: result.name, current: result.to, target: result.target
                  });

        await ChatMessage.create({
            content: `<p><strong>${game.i18n.localize("DRPG.Project.title")}</strong> — ${
                foundry.utils.escapeHTML(line)
            }</p>`,
            whisper: to
        });
        return;
    }

    if (payload?.action === ACTION_SHARE) {
        const { shareWith } = await import("./projects.mjs");
        await shareWith(payload.countdownId, payload.userId);
        debug(`Shared project ${payload.countdownId} with ${payload.userId} on behalf of a player.`);
        return;
    }

    if (payload?.action === ACTION_REMNANT) {
        const { placeRemnant } = await import("./remnants.mjs");
        await placeRemnant(payload.data);
        debug("Placed a Remnant on behalf of a player.");
        return;
    }

    if (payload?.action === ACTION_SABOTAGE) {
        const { sabotageProject } = await import("./projects.mjs");
        await sabotageProject(payload.targetId, payload.difficulty);
        return;
    }

    if (payload?.action === ACTION_SENDBACK) {
        const scene = game.scenes.get(payload.sceneId);
        const token = scene?.tokens?.get(payload.tokenId);
        const { REVERT } = await import("./movement.mjs");
        if (token) await token.update(payload.position, { animate: false, [REVERT]: true });
        return;
    }

    if (payload?.action === ACTION_ARM) {
        const actor = game.actors.get(payload.actorId);
        if (!actor) return;
        const { MODULE_ID: id, FLAGS } = await import("./config.mjs");
        await actor.setFlag(id, FLAGS.pendingCall, payload.call);
        debug(`Armed ${payload.call?.key} on ${actor.name} on behalf of a player.`);
        // The beneficiary is not the buyer: tell them what they have been given,
        // or they will meet a locked roll dialog with no idea why it opened up.
        await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Calls.armedTitle")}</strong> — ${
            game.i18n.format("DRPG.Calls.armedForYou", {
                what: game.i18n.localize(`DRPG.Calls.grants.${payload.call?.grants}`)
            })
        }</p>`);
        return;
    }

    if (payload?.action === ACTION_DESPAIR) {
        const { adjustDespair } = await import("./despair.mjs");
        await adjustDespair(payload.userId, payload.delta);
        debug(`Adjusted Despair for ${payload.userId} by ${payload.delta} on behalf of a player.`);
        return;
    }

    if (payload?.action === ACTION_ECLIPSE_MOVE) {
        const { applyRecordedMove } = await import("./eclipse.mjs");
        await applyRecordedMove(payload.actorId);
        return;
    }

    if (payload?.action === ACTION_CREATE) {
        const { createProject } = await import("./projects.mjs");
        const made = await createProject(payload.data);
        if (made) {
            // Tell the GMs what appeared, so nothing is created behind their back.
            await whisperToGms(`<h3>${game.i18n.localize("DRPG.Project.startNew")}</h3>
                <p><strong>${foundry.utils.escapeHTML(payload.data.by ?? "?")}</strong> — ${foundry.utils.escapeHTML(made.name)}
                (${made.target} progress${payload.data.room ? `, ${foundry.utils.escapeHTML(payload.data.room)}` : ""})${
                payload.data.indirectMurder ? ` · <em>${game.i18n.localize("DRPG.Project.indirect")}</em>` : ""}</p>
                <p><em>${game.i18n.localize("DRPG.Project.gmCanAdjust")}</em></p>`);
        }
    }
}

/**
 * Arm a Call on somebody else's character.
 *
 * Support gives another player advantage. Flags live on the beneficiary's actor,
 * which the buyer has no write access to — hence "Player A lacks permission".
 * The GM owns everything, so they set it.
 */
export async function requestArmCall(actorId, call) {
    if (game.user.isGM) {
        const actor = game.actors.get(actorId);
        if (!actor) return null;
        const { MODULE_ID: id, FLAGS } = await import("./config.mjs");
        await actor.setFlag(id, FLAGS.pendingCall, call);
        return true;
    }
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_ARM, actorId, call });
    return true;
}

/** Despair pools are a world setting; a player's reroll asks the GM to fix one. */
export async function requestDespairAdjust(userId, delta) {
    if (game.user.isGM) {
        const { adjustDespair } = await import("./despair.mjs");
        return adjustDespair(userId, delta);
    }
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_DESPAIR, userId, delta });
    return { pending: true };
}

/** Sabotage writes two world settings; the GM applies it. */
export function requestSabotage(targetId, difficulty) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_SABOTAGE, targetId, difficulty });
    return { pending: true };
}

/** A player whose token cannot be moved back asks the GM to do it. */
export function requestSendBack(sceneId, tokenId, position) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_SENDBACK, sceneId, tokenId, position });
    return { pending: true };
}

/** Count an Eclipse crossing on the GM's copy of the world setting. */
export function requestEclipseMove(actorId) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_ECLIPSE_MOVE, actorId });
    return { pending: true };
}

/** Creating a countdown writes a world setting, so the GM does it for us. */
export function requestProjectCreate(data) {
    if (game.user.isGM) {
        return import("./projects.mjs").then(m => m.createProject(data));
    }
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_CREATE, data });
    return { pending: true };
}

/** Creating tokens is GM-only, so a player's Remnant is placed for them. */
export function requestRemnant(data) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_REMNANT, data });
    return { pending: true };
}

function hasGm() {
    if (game.users.some(u => u.isGM && u.active)) return true;
    ui.notifications.warn(game.i18n.localize("DRPG.Bridge.noGm"));
    return false;
}

/** Ask the GM to add project progress on our behalf. */
export function requestProjectProgress(countdownId, amount) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_PROGRESS, countdownId, amount, userId: game.user.id
    });
    // `changed` is unknown from here — the GM whispers back what actually
    // happened. Claiming success would be a guess.
    return { pending: true, changed: null };
}

/**
 * Ask the GM to let another player in on a secret project. Players are allowed
 * to bring someone in on their own plan — the guide's whole social engine runs
 * on conspiracies — but the write itself has to happen GM-side.
 */
export function requestProjectShare(countdownId, userId) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_SHARE, countdownId, userId });
    return { pending: true };
}

/* ==========================================================================
 * CALLING THE GM
 * ========================================================================== */

/**
 * Whisper a ruling request to the GMs and confirm to the player that it went.
 *
 * @param {Actor} actor
 * @param {object} params
 * @param {string} params.title     What is being asked, e.g. "Think".
 * @param {string} [params.body]    Extra context, already escaped.
 * @param {object} [params.roll]    Result of the roll, if one was made.
 * @param {string} [params.request] The player's own words.
 * @param {string} [params.room]    Where they are standing.
 */
export async function callGm(actor, { title, body = "", roll = null, request = "", room = null } = {}) {
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const parts = [];

    parts.push(`<h3>${esc(title)}</h3>`);
    parts.push(`<p><strong>${esc(actor?.name ?? "?")}</strong>${room ? ` · ${esc(room)}` : ""}</p>`);

    if (roll) {
        const traitLabel = TRAITS[roll.trait]?.label ?? roll.trait ?? "";
        parts.push(`<p>${traitLabel} · <strong>${roll.total}</strong>${
            roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>`
            : roll.withHope ? " · Hope"
            : roll.withFear ? " · Despair" : ""
        }</p>`);

        // The guide owes the player a substantial hint on a critical Observe or
        // Analyze. Say so loudly rather than leaving the GM to remember it.
        if (roll.isCritical) {
            parts.push(`<p class="drpg-warning"><strong>${
                game.i18n.localize("DRPG.Bridge.criticalHint")
            }</strong></p>`);
        }
    }

    if (request) parts.push(`<blockquote>${esc(request)}</blockquote>`);
    if (body) parts.push(`<p>${body}</p>`);
    parts.push(`<p><em>${game.i18n.localize("DRPG.Bridge.awaitingRuling")}</em></p>`);

    try {
        await whisperToGms(parts.join(""));
        await whisperToOwner(actor, `<p><em>${game.i18n.format("DRPG.Bridge.sent", { title: esc(title) })}</em></p>`);
        return true;
    } catch (err) {
        error("Could not reach the GM", err);
        return false;
    }
}

/**
 * Ask the player what they want, then send it to the GM. Returns the text, or
 * null if they backed out.
 */
export async function promptAndCallGm(actor, { title, prompt, placeholder = "", roll = null, room = null }) {
    const DialogV2 = foundry.applications.api.DialogV2;

    const text = await DialogV2.wait({
        window: { title },
        content: `<form>
                    <p>${prompt}</p>
                    <textarea name="request" rows="3" placeholder="${foundry.utils.escapeHTML(placeholder)}"></textarea>
                  </form>`,
        buttons: [
            {
                action: "send",
                label: game.i18n.localize("DRPG.Bridge.send"),
                default: true,
                callback: (event, button, dialog) => dialog.element.querySelector("[name=request]").value.trim()
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (text === "cancel" || text === null || text === undefined) return null;

    await callGm(actor, { title, roll, request: text, room });
    return text;
}
