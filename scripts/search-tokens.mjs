/**
 * Danganronpa RPG - per-room search tokens.
 * ---------------------------------------------------------------------------
 * Guide: "Every room has 3 search tokens per time of day. Once they are spent,
 * further searching is impossible."
 *
 * Counters live in a world setting keyed by `sceneId::roomName`. Only a GM
 * client may write world settings, so player-side spends are routed through a
 * socket to the primary GM. The room itself is never typed in - it comes from
 * whichever Scene Region the acting token is standing in (`roomOfActor`).
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, activeGmIds, whisperToGms, debug, warn, error } from "./utils.mjs";
import { senderOf, ownsActor } from "./gm-bridge.mjs";
import { overflowTokenPenalty, overflowFloor } from "./overflow.mjs";

/**
 * Region flags this file owns.
 *
 * Set from Room Setup, enforced here - the same split `ROOM_FLAGS` in
 * movement.mjs uses for a locked door, and for the same reason: the column in
 * the GM's table is a checkbox, and the rule it turns on belongs with the code
 * that has to answer for it.
 */
export const SEARCH_FLAGS = {
    /** This room cannot be searched at all. Not "not right now" - at all. */
    sealed: "drpgNoSearch"
};

export class SearchTokens {

    /**
     * Maximum tokens a room gets per time of day.
     *
     * A darkening takes one off every room (Z10), floored so that no room ever
     * becomes unsearchable - a room with nothing in it cannot be investigated
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
     * count - reading `left()` immediately afterwards (which every action's
     * chat card does) was reading the stale pre-spend value out of `store`
     * instead, off by one until the setting arrived. Cleared whenever the real
     * setting changes; see sync.mjs's `SYNC.searchTokens` handler.
     */
    static #freshCounts = new Map();

    /**
     * Collect the item somebody planted in this room, if one is waiting - E21,
     * trigger 5. Called by a Search that has SUCCEEDED, and only then.
     *
     * IT USED TO RIDE THE TOKEN (ACT-03, 17.09). The GM took the plant out of the
     * store on every spend, which happens once the dice are down but before
     * anybody knows what they say - so a failed Search, a "something specific"
     * request or a stash find used the plant up, and the client kept it parked
     * and handed it to its next successful Search in any room at all. Now the
     * store is only touched when the item is actually found.
     *
     * A player asks the GM, who hands it over only to somebody who spent a token
     * in that room a moment ago - see `onSocketMessage`. No answer is no plant:
     * the room keeps it for the next search, which is the safe way to be wrong.
     *
     * @returns {Promise<object|null>}
     */
    static async takePlant(roomName, sceneId = this.currentSceneId, { actorId = null } = {}) {
        if (!roomName) return null;
        if (!game.user.isGM) {
            const { plant } = await requestPlant(roomName, sceneId, actorId);
            return plant ?? null;
        }
        try {
            const { takePlant } = await import("./traps.mjs");
            return await takePlant(roomName, sceneId);
        } catch (err) {
            // A search that cannot check for a plant is an ordinary search.
            error("Could not check a room for a planted item", err);
            return null;
        }
    }

    /**
     * How long a "the GM just told me" count is trusted.
     *
     * It only exists to bridge the gap until the world setting arrives, and the
     * only thing that used to clear it was that setting's own sync. If that sync
     * never landed - a dropped socket, a client that reconnected - the stale
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
     * with nothing in it to find - a corridor, a wing nobody has opened, the
     * Monokuma statue - and no amount of waiting changes that.
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
     * exhausted. Safe to call from a player client - it forwards to the GM.
     */
    static async spend(roomName, sceneId = this.currentSceneId, { actorId = null } = {}) {
        if (!roomName) return false;
        if (!game.user.isGM) {
            // The searching character travels with the request: the GM spends a
            // room's token only for somebody standing in it (E03).
            const { ok, left, reason } = await requestSpend(roomName, sceneId, actorId);
            if (reason === "notHere") ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.notHere"));
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
        // of the action. Every route to a search ends at this method - the
        // sheet's tile, a player's socket request, `game.drpg.useToken` from a
        // console - so a room the GM has sealed cannot be searched by any of
        // them, including one that arrives from a client whose copy of the map
        // is a few seconds out of date.
        if (this.sealed(roomName, sceneId)) return false;

        const store = foundry.utils.duplicate(this.store);
        const key = this.key(roomName, sceneId);
        const current = store[key] ?? store[roomName] ?? this.max;
        if (current <= 0) return false;

        store[key] = current - 1;
        // Migrate off the legacy plain-name key - but only when it IS a different
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
     * room is as visible as a spent one - "which rooms are still worth
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
 * SOCKET BRIDGE - players ask, the primary GM writes
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_SPEND = "searchTokens.spend";
const ACTION_RESULT = "searchTokens.result";
const ACTION_TAKE_PLANT = "searchTokens.takePlant";
const ACTION_RETURN_PLANT = "searchTokens.returnPlant";

/** Pending player-side promises, keyed by request id. */
const pending = new Map();

/**
 * Plant requests THIS client stopped waiting for. Only these may send a plant
 * back: another tab of the same user sees the same reply with no request of its
 * own, and returning it from there duplicated a plant that had been delivered
 * (review, 17.09).
 */
const gaveUp = new Set();

/**
 * Who spent a token where, on the primary GM's client: `user::scene::room` ->
 * when. A plant goes only to a user in this map, once, so asking for one is not
 * a way to empty a room nobody searched.
 */
const searchedBy = new Map();
const PLANT_WINDOW_MS = 120000;

/**
 * Plants handed out and not yet known to have arrived, on the primary GM's
 * client: `requestId` -> `{ userId, roomName, sceneId, plant, at }`.
 *
 * A REPLY THAT LANDS AFTER THE PLAYER GAVE UP (review of ACT-03, 17.09). The
 * plant leaves the store as it is handed over, and a player who stopped waiting
 * after five seconds had no request left to give it to - so on a slow server the
 * item was simply gone. That client now sends the request id back, and only a
 * plant recorded here, for that same user, goes back into the room.
 */
const handedOut = new Map();
const searchKey = (userId, sceneId, room) => `${userId}::${sceneId ?? "-"}::${room}`;

export function registerSearchTokenSocket() {
    game.socket.on(SOCKET_EVENT, onSocketMessage);
}

/**
 * Why this player may not search this room, or null. Pure, for the suite.
 *
 * THE SEARCHER HAS TO BE STANDING IN IT (E03, 24.09.2026; audit S01-10, S07-03).
 * The spend took any room name from anybody, so a console could empty every
 * room's search tokens on the map - and with the plant check that follows a
 * spend, walk off with a planted item without rolling for it. Now the request
 * names a character, the sender has to play it, and the GM finds it in the
 * room by itself (`locateActor`, which does not need the GM to be looking at
 * that scene).
 */
export function searchSpendRefusal({ sender, actor, where, roomName }) {
    if (!ownsActor(sender, actor?.id)) return "sender does not own that character";
    if (!where?.room || where.room !== roomName) return "the character is not in that room";
    return null;
}

/**
 * Which scene a player's search is judged on, or why it is refused. A GM's is
 * taken as asked; a player's is the scene their character is standing on.
 */
async function judgeSearch(payload, senderId) {
    const sender = senderOf(senderId);
    if (!sender) return { why: "unknown sender" };
    if (sender.isGM) return { sceneId: payload.sceneId ?? null };
    const actor = game.actors.get(payload.actorId ?? "") ?? null;
    const { locateActor } = await import("./movement.mjs");
    const where = actor ? locateActor(actor) : null;
    const why = searchSpendRefusal({ sender, actor, where, roomName: payload.roomName });
    return why ? { why } : { sceneId: where.scene?.id ?? payload.sceneId ?? null };
}

async function onSocketMessage(payload, senderId) {
    if (!payload?.action) return;

    if (payload.action === ACTION_SPEND) {
        // Exactly one GM client answers, otherwise every GM would spend a token.
        if (!isPrimaryGm()) return;
        const judged = await judgeSearch(payload, senderId);
        if (judged.why) {
            warn(`Refused a search-token spend in "${payload.roomName}" from ${game.users.get(senderId ?? "")?.name ?? senderId}: ${judged.why}.`);
            game.socket.emit(SOCKET_EVENT, {
                action: ACTION_RESULT, requestId: payload.requestId, ok: false, left: null, reason: "notHere"
            }, { recipients: [senderId] });
            return;
        }
        // Answered to whoever actually asked, not to the id in the payload -
        // otherwise one player could make the GM spend a token and report the
        // result to somebody else.
        const sceneId = judged.sceneId;
        const ok = await SearchTokens.spend(payload.roomName, sceneId);
        // Only a spend that SUCCEEDED earns a look for a plant: a refused search
        // is not a search, and a plant handed out for one would be a free item
        // from a sealed or exhausted room. The look itself comes later, from a
        // Search that found something - see `SearchTokens.takePlant`.
        if (ok) searchedBy.set(searchKey(senderId, sceneId, payload.roomName), Date.now());

        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_RESULT,
            requestId: payload.requestId,
            ok,
            left: SearchTokens.left(payload.roomName, sceneId)
        }, { recipients: [senderId] });
        return;
    }

    if (payload.action === ACTION_TAKE_PLANT) {
        if (!isPrimaryGm()) return;
        // The same judgement as the spend it follows, so the scene is the one
        // the spend was recorded against.
        const judged = await judgeSearch(payload, senderId);
        if (judged.why) {
            game.socket.emit(SOCKET_EVENT, {
                action: ACTION_RESULT, requestId: payload.requestId, ok: false, plant: null, left: null
            }, { recipients: [senderId] });
            return;
        }
        const sceneId = judged.sceneId;
        // Once per token: the entry is used up whether or not a plant was there.
        const key = searchKey(senderId, sceneId, payload.roomName);
        const at = searchedBy.get(key);
        searchedBy.delete(key);
        const plant = at && Date.now() - at < PLANT_WINDOW_MS
            ? await SearchTokens.takePlant(payload.roomName, sceneId)
            : null;
        if (plant) {
            for (const [id, entry] of handedOut) {
                if (Date.now() - entry.at > PLANT_WINDOW_MS) handedOut.delete(id);
            }
            handedOut.set(payload.requestId, {
                userId: senderId, roomName: payload.roomName, sceneId, plant, at: Date.now()
            });
        }
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_RESULT,
            requestId: payload.requestId,
            ok: Boolean(plant),
            plant,
            left: SearchTokens.left(payload.roomName, sceneId)
        }, { recipients: [senderId] });
        return;
    }

    if (payload.action === ACTION_RETURN_PLANT) {
        if (!isPrimaryGm()) return;
        const entry = handedOut.get(payload.requestId);
        // Only what this GM handed out, to the user who is giving it back.
        if (!entry || entry.userId !== senderId) return;
        handedOut.delete(payload.requestId);
        // A late reply comes back within seconds; a return long after the fact is
        // not one, and would put an item back that has been in a pocket all along.
        if (Date.now() - entry.at > PLANT_WINDOW_MS) return;
        try {
            const { restorePlant } = await import("./traps.mjs");
            await restorePlant(entry.roomName, entry.sceneId, entry.plant);
        } catch (err) {
            error("Could not put a planted item back in its room", err);
        }
        return;
    }

    if (payload.action === ACTION_RESULT) {
        // Only a GM decides whether a room had a token left.
        //
        // The request used to be broadcast, so every client saw the `requestId`,
        // and this end accepted any reply carrying it. A player could answer
        // another player's request before the GM did - granting a search in a
        // room that was already exhausted, or denying one that was not. The
        // request is now addressed to the GMs (see `requestSpend`) and the reply
        // has to come from one.
        if (!game.users.get(senderId)?.isGM) return;
        const resolve = pending.get(payload.requestId);
        if (!resolve) {
            // Too late: this client stopped waiting and searched on without it.
            // Hand the plant back rather than drop it - see `handedOut`.
            if (payload.plant && gaveUp.delete(payload.requestId)) {
                game.socket.emit(SOCKET_EVENT, { action: ACTION_RETURN_PLANT, requestId: payload.requestId },
                    { recipients: activeGmIds() });
            }
            return;
        }
        pending.delete(payload.requestId);
        resolve({ ok: payload.ok, left: payload.left, plant: payload.plant ?? null, reason: payload.reason ?? null });
    }
}

/**
 * Ask the GM to spend a token on our behalf. Resolves `{ ok: false, left: null }`
 * if no GM answers in time, so a disconnected GM can never silently grant a
 * free search.
 */
function requestSpend(roomName, sceneId = SearchTokens.currentSceneId, actorId = null, timeoutMs = TIMING.searchTokenAckMs) {
    if (!game.users.some(u => u.isGM && u.active)) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.noGm"));
        return Promise.resolve({ ok: false, left: null, plant: null });
    }
    return askGm(ACTION_SPEND, roomName, sceneId, timeoutMs, () =>
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.timeout")), actorId);
}

/**
 * Ask the GM for the plant in a room this user has just searched. Silent when
 * nobody answers: the search goes on as an ordinary one and the plant stays
 * where it was left, so there is nothing to tell the player.
 */
function requestPlant(roomName, sceneId = SearchTokens.currentSceneId, actorId = null, timeoutMs = 5000) {
    if (!game.users.some(u => u.isGM && u.active)) {
        return Promise.resolve({ ok: false, left: null, plant: null });
    }
    return askGm(ACTION_TAKE_PLANT, roomName, sceneId, timeoutMs, () =>
        debug(`No GM answered the plant check for ${roomName}.`), actorId);
}

function askGm(action, roomName, sceneId, timeoutMs, onTimeout, actorId = null) {
    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        pending.set(requestId, resolve);
        // Addressed to the GMs. Broadcasting it put the `requestId` in every
        // player's hands, which is all that was needed to forge the answer.
        game.socket.emit(SOCKET_EVENT, {
            action,
            requestId,
            roomName,
            sceneId,
            actorId
        }, { recipients: activeGmIds() });
        setTimeout(() => {
            if (!pending.has(requestId)) return;
            pending.delete(requestId);
            if (action === ACTION_TAKE_PLANT) gaveUp.add(requestId);
            onTimeout?.();
            resolve({ ok: false, left: null, plant: null });
        }, timeoutMs);
    });
}
