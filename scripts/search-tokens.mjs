/**
 * Danganronpa RPG — per-room search tokens.
 * ---------------------------------------------------------------------------
 * Guide: "Every room has 3 search tokens per time of day. Once they are spent,
 * further searching is impossible."
 *
 * Counters live in a world setting keyed by room name. Only a GM client may
 * write world settings, so player-side spends are routed through a socket to
 * the primary GM. Stage 4 will move the counters onto Scene Regions so the
 * room is detected from the token's position instead of a typed-in name.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, whisperToGms, debug } from "./utils.mjs";

export class SearchTokens {

    /** Maximum tokens a room gets per time of day. */
    static get max() {
        return game.settings.get(MODULE_ID, SETTINGS.searchTokensPerRoom);
    }

    /**
     * Counters are keyed by "sceneId::roomName", not by room name alone.
     *
     * Two scenes in a season will both have a "Kitchen", and sharing one
     * counter between them would let a player search out a room they have never
     * been in. Old plain-name keys are still read, so counters saved before
     * this change are not lost mid-session.
     */
    static key(roomName, scene = canvas?.scene) {
        if (!roomName) return null;
        return scene?.id ? `${scene.id}::${roomName}` : roomName;
    }

    /** Raw counter store. Rooms absent from the store are untouched (= full). */
    static get store() {
        return game.settings.get(MODULE_ID, SETTINGS.searchTokens) ?? {};
    }

    /** How many search tokens remain in a room on the current scene. */
    static left(roomName, scene = canvas?.scene) {
        if (!roomName) return 0;
        const store = this.store;
        const scoped = this.key(roomName, scene);
        // Scene-scoped key first, then the legacy plain-name key.
        return store[scoped] ?? store[roomName] ?? this.max;
    }

    /**
     * Spend one token. Returns true when it was spent, false when the room is
     * exhausted. Safe to call from a player client — it forwards to the GM.
     */
    static async spend(roomName) {
        if (!roomName) return false;
        if (!game.user.isGM) return requestSpend(roomName);
        return this.#spendAsGm(roomName);
    }

    static async #spendAsGm(roomName) {
        const store = foundry.utils.duplicate(this.store);
        const key = this.key(roomName);
        const current = store[key] ?? store[roomName] ?? this.max;
        if (current <= 0) return false;

        store[key] = current - 1;
        delete store[roomName];             // migrate off the legacy key
        await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
        debug(`Search token spent in "${roomName}". Left: ${store[key]}`);
        return true;
    }

    /** Zero out a single room for the rest of the day (project "Tidy the room"). */
    static async exhaust(roomName) {
        if (!game.user.isGM || !roomName) return false;
        const store = foundry.utils.duplicate(this.store);
        store[this.key(roomName)] = 0;
        delete store[roomName];
        await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
        return true;
    }

    /** Refill everything. Called whenever the clock advances a time of day. */
    static async reset({ notify = true } = {}) {
        if (!game.user.isGM) return false;
        await game.settings.set(MODULE_ID, SETTINGS.searchTokens, {});
        if (notify) ui.notifications.info(game.i18n.localize("DRPG.SearchTokens.reset"));
        return true;
    }

    /**
     * GM-only chat readout. Lists every room on the current scene, so a full
     * room is as visible as a spent one — "which rooms are still worth
     * searching" is the question actually being asked.
     */
    static async report() {
        const max = this.max;
        const scene = canvas?.scene;

        const rooms = Array.from(scene?.regions ?? [])
            .map(r => r.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        const rows = rooms.length
            ? rooms.map(room => {
                const n = this.left(room, scene);
                const style = n === 0 ? ' style="opacity:.5"' : "";
                return `<tr${style}><td>${foundry.utils.escapeHTML(room)}</td><td style="text-align:center">${n} / ${max}</td></tr>`;
            }).join("")
            : Object.entries(this.store)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([key, n]) => `<tr><td>${foundry.utils.escapeHTML(key.split("::").pop())}</td><td style="text-align:center">${n} / ${max}</td></tr>`)
                .join("");

        const content = rows
            ? `<table><thead><tr><th>Room</th><th>Tokens</th></tr></thead><tbody>${rows}</tbody></table>`
            : `<p>${game.i18n.format("DRPG.SearchTokens.allFull", { max })}</p>`;

        return whisperToGms(`<h3>${game.i18n.localize("DRPG.SearchTokens.title")}</h3>${content}`);
    }
}

/* ==========================================================================
 * SOCKET BRIDGE — players ask, the primary GM writes
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_SPEND = "searchTokens.spend";
const ACTION_RESULT = "searchTokens.result";

/** Pending player-side promises, keyed by request id. */
const pending = new Map();

export function registerSearchTokenSocket() {
    game.socket.on(SOCKET_EVENT, onSocketMessage);
}

async function onSocketMessage(payload) {
    if (!payload?.action) return;

    if (payload.action === ACTION_SPEND) {
        // Exactly one GM client answers, otherwise every GM would spend a token.
        if (!isPrimaryGm()) return;
        const ok = await SearchTokens.spend(payload.roomName);
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_RESULT,
            requestId: payload.requestId,
            userId: payload.userId,
            ok,
            left: SearchTokens.left(payload.roomName)
        });
        return;
    }

    if (payload.action === ACTION_RESULT) {
        if (payload.userId !== game.user.id) return;
        const resolve = pending.get(payload.requestId);
        if (!resolve) return;
        pending.delete(payload.requestId);
        resolve(payload.ok);
    }
}

/**
 * Ask the GM to spend a token on our behalf. Resolves false if no GM answers
 * in time, so a disconnected GM can never silently grant a free search.
 */
function requestSpend(roomName, timeoutMs = 5000) {
    if (!game.users.some(u => u.isGM && u.active)) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.noGm"));
        return Promise.resolve(false);
    }

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        pending.set(requestId, resolve);
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_SPEND,
            requestId,
            userId: game.user.id,
            roomName
        });
        setTimeout(() => {
            if (!pending.has(requestId)) return;
            pending.delete(requestId);
            ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.timeout"));
            resolve(false);
        }, timeoutMs);
    });
}
