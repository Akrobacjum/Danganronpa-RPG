/**
 * Danganronpa RPG — per-room search tokens.
 * ---------------------------------------------------------------------------
 * Guide: "Every room has 3 search tokens per time of day. Once they are spent,
 * further searching is impossible."
 *
 * Counters live in a world setting keyed by `sceneId::roomName`. Only a GM
 * client may write world settings, so player-side spends are routed through a
 * socket to the primary GM. The room itself is never typed in — it comes from
 * whichever Scene Region the acting token is standing in (`roomOfActor`).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, activeGmIds, whisperToGms, debug, error } from "./utils.mjs";
import { overflowTokenPenalty, overflowFloor } from "./overflow.mjs";

/**
 * Region flags this file owns.
 *
 * Set from Room Setup, enforced here — the same split `ROOM_FLAGS` in
 * movement.mjs uses for a locked door, and for the same reason: the column in
 * the GM's table is a checkbox, and the rule it turns on belongs with the code
 * that has to answer for it.
 */
export const SEARCH_FLAGS = {
    /** This room cannot be searched at all. Not "not right now" — at all. */
    sealed: "drpgNoSearch"
};

export class SearchTokens {

    /**
     * Maximum tokens a room gets per time of day.
     *
     * A darkening takes one off every room (Z10), floored so that no room ever
     * becomes unsearchable — a room with nothing in it cannot be investigated
     * at all, which is a different game rather than a harder one. Applied here
     * because this getter is already the single answer: the restock reads it,
     * the room-setup table reads it, and the "searched out" test reads it.
     */
    static get max() {
        const base = game.settings.get(MODULE_ID, SETTINGS.searchTokensPerRoom);
        const dark = overflowTokenPenalty();
        if (!dark) return base;
        return Math.max(overflowFloor("shift"), base - dark);
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
        // Accept a bare scene id as well as a Scene: the id is what travels over
        // the socket, and the GM answering a player's request must key the
        // counter to the *player's* scene, not to whatever they are looking at.
        const id = typeof scene === "string" ? scene : scene?.id;
        return id ? `${id}::${roomName}` : roomName;
    }

    /** The scene a request should be judged against, when none was supplied. */
    static get currentSceneId() {
        return canvas?.scene?.id ?? null;
    }

    /** Raw counter store. Rooms absent from the store are untouched (= full). */
    static get store() {
        return game.settings.get(MODULE_ID, SETTINGS.searchTokens) ?? {};
    }

    /**
     * Counts a player's client just received straight from the GM, kept until
     * the world setting itself catches up.
     *
     * A player's spend is a round trip: ask the GM, the GM writes the world
     * setting, the setting then has to propagate back to this client before
     * `store` reflects it. The GM's reply already carries the true post-spend
     * count — reading `left()` immediately afterwards (which every action's
     * chat card does) was reading the stale pre-spend value out of `store`
     * instead, off by one until the setting arrived. Cleared whenever the real
     * setting changes; see sync.mjs's `SYNC.searchTokens` handler.
     */
    static #freshCounts = new Map();

    /**
     * A planted item the GM handed back with the last spend — E21, trigger 5.
     *
     * A ONE-SHOT, and deliberately not a return value. `spend` answers a
     * boolean and every call site in the module reads it that way; widening it
     * would mean touching all of them to serve one caller. So the answer is
     * parked here for the Search that asked, and `takeFreshPlant` empties it —
     * which also means a plant that somehow arrives with no one to collect it
     * is dropped rather than handed to the next search in another room.
     */
    static #freshPlant = null;

    /** Collect the plant from the last spend, once. */
    static takeFreshPlant() {
        const plant = this.#freshPlant;
        this.#freshPlant = null;
        return plant;
    }

    /**
     * How long a "the GM just told me" count is trusted.
     *
     * It only exists to bridge the gap until the world setting arrives, and the
     * only thing that used to clear it was that setting's own sync. If that sync
     * never landed — a dropped socket, a client that reconnected — the stale
     * count outlived the value it was standing in for and the room read wrong for
     * the rest of the session. An expiry makes the cache self-correcting.
     */
    static #FRESH_MS = 10000;

    static clearFreshCounts() {
        this.#freshCounts.clear();
    }

    /** How many search tokens remain in a room on the current scene. */
    static left(roomName, scene = canvas?.scene) {
        if (!roomName) return 0;
        const scoped = this.key(roomName, scene);

        const fresh = this.#freshCounts.get(scoped);
        if (fresh) {
            if (Date.now() - fresh.at < this.#FRESH_MS) return fresh.value;
            this.#freshCounts.delete(scoped);
        }

        const store = this.store;
        // Scene-scoped key first, then the legacy plain-name key.
        return store[scoped] ?? store[roomName] ?? this.max;
    }

    /**
     * Has the GM closed this room to searching entirely?
     *
     * A different question from `left() <= 0`, and the difference is the whole
     * point: an exhausted room is one the cast has already been through this
     * time of day and it comes back at the next one. A sealed room is a place
     * with nothing in it to find — a corridor, a wing nobody has opened, the
     * Monokuma statue — and no amount of waiting changes that.
     *
     * Read off the Region rather than out of the counter store, so it survives
     * every refill and every reset the tokens go through.
     *
     * @param {string} roomName
     * @param {Scene|string|null} [scene]  A Scene or a bare scene id: the id is
     *   what travels over the socket, and a player's spend has to be judged
     *   against THEIR scene rather than whatever the GM is looking at.
     */
    static sealed(roomName, scene = canvas?.scene) {
        if (!roomName) return false;
        const where = typeof scene === "string" ? game.scenes?.get(scene) : scene;
        for (const region of (where ?? canvas?.scene)?.regions ?? []) {
            if (region.name === roomName) {
                return Boolean(region.getFlag(MODULE_ID, SEARCH_FLAGS.sealed));
            }
        }
        return false;
    }

    /**
     * Spend one token. Returns true when it was spent, false when the room is
     * exhausted. Safe to call from a player client — it forwards to the GM.
     */
    static async spend(roomName, sceneId = this.currentSceneId) {
        if (!roomName) return false;
        if (!game.user.isGM) {
            const { ok, left, plant } = await requestSpend(roomName, sceneId);
            // Handed to the caller through a one-shot rather than a return
            // value: `spend` answers a boolean and forty call sites read it
            // that way. See `takeFreshPlant`.
            if (plant) this.#freshPlant = plant;
            // Bank the true count the GM just computed, so the chat card this
            // spend is about to produce reads it correctly instead of racing
            // the setting's own propagation back to this client.
            if (typeof left === "number") {
                this.#freshCounts.set(this.key(roomName, sceneId), { value: left, at: Date.now() });
            }
            return ok;
        }
        return this.#spendAsGm(roomName, sceneId);
    }

    static async #spendAsGm(roomName, sceneId = this.currentSceneId) {
        // THE LAST WORD, and deliberately down here rather than only in front
        // of the action. Every route to a search ends at this method — the
        // sheet's tile, a player's socket request, `game.drpg.useToken` from a
        // console — so a room the GM has sealed cannot be searched by any of
        // them, including one that arrives from a client whose copy of the map
        // is a few seconds out of date.
        if (this.sealed(roomName, sceneId)) return false;

        const store = foundry.utils.duplicate(this.store);
        const key = this.key(roomName, sceneId);
        const current = store[key] ?? store[roomName] ?? this.max;
        if (current <= 0) return false;

        store[key] = current - 1;
        // Migrate off the legacy plain-name key — but only when it IS a different
        // key. With no scene to key against, `key()` falls back to the bare room
        // name, and deleting it here erased the spend that had just been written
        // one line above: the counter never moved and the room could be searched
        // for ever.
        if (key !== roomName) delete store[roomName];
        await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
        debug(`Search token spent in "${roomName}". Left: ${store[key]}`);
        return true;
    }

    /** Zero out a single room for the rest of the day (project "Tidy the room"). */
    static async exhaust(roomName) {
        if (!game.user.isGM || !roomName) return false;
        const store = foundry.utils.duplicate(this.store);
        const key = this.key(roomName);
        store[key] = 0;
        if (key !== roomName) delete store[roomName];   // same reasoning as above
        await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
        return true;
    }

    /**
     * Set one room's counter outright.
     *
     * The Room Setup table's −1 / +1 / reset controls, which move a single room
     * rather than restocking the map: a GM who has just ruled that a cupboard
     * was already turned out wants that cupboard empty, not every room in the
     * building refilled.
     *
     * Clamped to 0…max. Without the clamp the arrows are held down and the
     * counter goes to −3, which every screen that reads `left()` then renders
     * as a room owing three searches.
     *
     * @returns {Promise<number|null>}  The value actually stored.
     */
    static async setFor(roomName, value, scene = canvas?.scene) {
        if (!game.user.isGM || !roomName) return null;
        const max = this.max;
        const n = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));

        const store = foundry.utils.duplicate(this.store);
        const key = this.key(roomName, scene);
        store[key] = n;
        // Same reasoning as `#spendAsGm`: drop the legacy plain-name key only
        // when it is genuinely a different key, or this erases the write above.
        if (key !== roomName) delete store[roomName];
        await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
        debug(`Search tokens in "${roomName}" set to ${n}.`);
        return n;
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
            ? `<table><thead><tr>
                    <th>${game.i18n.localize("DRPG.SearchTokens.roomColumn")}</th>
                    <th>${game.i18n.localize("DRPG.SearchTokens.tokensColumn")}</th>
               </tr></thead><tbody>${rows}</tbody></table>`
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

async function onSocketMessage(payload, senderId) {
    if (!payload?.action) return;

    if (payload.action === ACTION_SPEND) {
        // Exactly one GM client answers, otherwise every GM would spend a token.
        if (!isPrimaryGm()) return;
        // Answered to whoever actually asked, not to the id in the payload —
        // otherwise one player could make the GM spend a token and report the
        // result to somebody else.
        const sceneId = payload.sceneId ?? null;
        const ok = await SearchTokens.spend(payload.roomName, sceneId);

        /*
         * AND WHETHER SOMEBODY LEFT SOMETHING HERE — E21, trap 165.
         *
         * The plant rides the round trip this search was already making. That
         * is the whole reason it can be a GM-side decision at no cost: every
         * player Search already asks a GM for a token, so asking "and is there
         * anything waiting here" costs nothing that was not already being paid,
         * and no new socket road is opened for the most-used action in the game.
         *
         * Only on a spend that SUCCEEDED. A refused search is not a search, and
         * a plant handed out for one would be a free item from a sealed or
         * exhausted room.
         *
         * The plant comes out of the store as it is handed over — see
         * `takePlant`. It is one object somebody left, not something the room
         * has become.
         */
        let plant = null;
        if (ok) {
            try {
                const { takePlant } = await import("./traps.mjs");
                plant = await takePlant(payload.roomName, sceneId);
            } catch (err) {
                // A search that cannot check for a plant is an ordinary search.
                error("Could not check a room for a planted item", err);
            }
        }

        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_RESULT,
            requestId: payload.requestId,
            ok,
            plant,
            left: SearchTokens.left(payload.roomName, sceneId)
        }, { recipients: [senderId] });
        return;
    }

    if (payload.action === ACTION_RESULT) {
        // Only a GM decides whether a room had a token left.
        //
        // The request used to be broadcast, so every client saw the `requestId`,
        // and this end accepted any reply carrying it. A player could answer
        // another player's request before the GM did — granting a search in a
        // room that was already exhausted, or denying one that was not. The
        // request is now addressed to the GMs (see `requestSpend`) and the reply
        // has to come from one.
        if (!game.users.get(senderId)?.isGM) return;
        const resolve = pending.get(payload.requestId);
        if (!resolve) return;
        pending.delete(payload.requestId);
        resolve({ ok: payload.ok, left: payload.left, plant: payload.plant ?? null });
    }
}

/**
 * Ask the GM to spend a token on our behalf. Resolves `{ ok: false, left: null }`
 * if no GM answers in time, so a disconnected GM can never silently grant a
 * free search.
 */
function requestSpend(roomName, sceneId = SearchTokens.currentSceneId, timeoutMs = 5000) {
    if (!game.users.some(u => u.isGM && u.active)) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.noGm"));
        return Promise.resolve({ ok: false, left: null, plant: null });
    }

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        pending.set(requestId, resolve);
        // Addressed to the GMs. Broadcasting it put the `requestId` in every
        // player's hands, which is all that was needed to forge the answer.
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_SPEND,
            requestId,
            roomName,
            sceneId
        }, { recipients: activeGmIds() });
        setTimeout(() => {
            if (!pending.has(requestId)) return;
            pending.delete(requestId);
            ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.timeout"));
            resolve({ ok: false, left: null, plant: null });
        }, timeoutMs);
    });
}
