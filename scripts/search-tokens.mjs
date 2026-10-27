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
import { isPrimaryGm, whisperToGms, debug, error, serialWrite } from "./utils.mjs";
import { ownsActor, judge, table, pick, as, knownSender, bridgeRequest } from "./bridge-guards.mjs";
import { overflowTokenPenalty, overflowFloor } from "./overflow.mjs";
import { roomFlag, roomNames, viewedScene } from "./rooms.mjs";

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

/**
 * THE ONE QUEUE'S KEY FOR THE COUNTERS (E17 C0, 26.10.2026; audit S07-24, S10-23). The counters are one world setting
 * read and written whole, so two Searches of a room begun within a server round trip both read its last token and
 * both spent it: ten together in a room of three spent ten (tier 2 E17-T1 at 9f727e07). Every write of the setting
 * is a step of utils.mjs `serialWrite` under this key, reading the store inside its step (tier 0 R991).
 */
export const SEARCH_KEY = "searchTokens";

/**
 * A room's maximum under a Shift: `base` tokens a room as the GM set it, `dark` the Shift's penalty, `floor` the
 * fewest a darkened room keeps (E17 C4, 26.10.2026; audit S07-21). No penalty, or a base of 0 or less, is the base;
 * else the base less the penalty, floored at the smaller of `floor` and the base - so a darkening never gives a room
 * a token the GM did not set (0 stays 0, 1 stays 1). Pure (tier 1 R994).
 */
export function searchMax(base, dark, floor) {
    if (!dark || base <= 0) return base;
    return Math.max(Math.min(base, floor), base - dark);
}

export class SearchTokens {

    /**
     * Maximum tokens a room gets per time of day.
     *
     * A darkening takes one off every room (Z10), floored so that no room ever
     * becomes unsearchable - a room with nothing in it cannot be investigated
     * at all, which is a different game rather than a harder one. Applied here
     * because this getter is already the single answer: the restock reads it,
     * the room-setup table reads it, and the "searched out" test reads it.
     *
     * NEVER ONE MORE THAN THE GM SET (E17 C4, 26.10.2026; audit S07-21). The floor was the floor of every room,
     * so a world set to 0 tokens a room - no searching at all - got 1 back from the debuff meant to take one away.
     * The floor now holds only what the GM set (`searchMax`, tier 1 R994).
     */
    static get max() {
        const base = game.settings.get(MODULE_ID, SETTINGS.searchTokensPerRoom);
        const dark = overflowTokenPenalty();
        return searchMax(base, dark, dark ? overflowFloor("shift") : 1);
    }

    /**
     * Counters are keyed by "sceneId::roomName", not by room name alone.
     *
     * Two scenes in a season will both have a "Kitchen", and sharing one
     * counter between them would let a player search out a room they have never
     * been in. Old plain-name keys are still read, so counters saved before
     * this change are not lost mid-session.
     */
    static key(roomName, scene) {
        if (!roomName) return null;
        // Accept a bare scene id as well as a Scene: the id is what travels over
        // the socket, and the GM answering a player's request must key the
        // counter to the *player's* scene, not to whatever they are looking at.
        const id = typeof scene === "string" ? scene : scene?.id;
        return id ? `${id}::${roomName}` : roomName;
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
     * in that room a moment ago - see `runTakePlant`. No answer is no plant:
     * the room keeps it for the next search, which is the safe way to be wrong.
     *
     * The plant comes back with `back`, what `returnPlant` needs to put it in its room again: the
     * plant check's request id on a player's client; on a GM's, the room, the scene and the store's
     * row as it was taken (its trap's project, which the finder's copy never carries).
     *
     * @returns {Promise<object|null>}
     */
    static async takePlant(roomName, sceneId, { actorId = null, rollId = null, by = null } = {}) {
        if (!roomName) return null;
        if (!game.user.isGM) {
            const res = await requestPlantCheck(roomName, sceneId, actorId, rollId);
            const plant = res.ok ? res.value?.plant ?? null : null;
            return plant ? { ...plant, back: { plantRequestId: res.value.plantRequestId ?? null } } : null;
        }
        try {
            const { takePlant } = await import("./traps.mjs");
            const plant = await takePlant(roomName, sceneId, { actorId, rollId, by });
            return plant ? { ...plant, back: { roomName, sceneId: sceneId ?? null, row: structuredClone(plant) } } : null;
        } catch (err) {
            // A search that cannot check for a plant is an ordinary search.
            error("Could not check a room for a planted item", err);
            return null;
        }
    }

    /**
     * A PLANT THE SEARCH COULD NOT HAND OVER GOES BACK (E14 part 2 C4, 24.10.2026; audit S08-10).
     * `takePlant` takes the plant out of the store before anybody knows whether it fits: a student
     * with full hands and no stash found the plant, `grantItem` refused it, and the plant, its row
     * in the trap's ledger and the killer's project went with it, the GMs told nothing until
     * `diagnoseTraps`. action-rolls.mjs `grantDrawn` hands a refused plant here: on a GM it goes
     * back at once (`putPlantBack`), on a player's client the GM is asked as a late plant is
     * (`ACTION_RETURN_PLANT`, judged by `guardPlantReturn`: only the plant handed to that user, once,
     * inside `PLANT_WINDOW_MS`). Answers whether it went back, or was asked to.
     */
    static async returnPlant(plant) {
        const back = plant?.back ?? null;
        if (!back) return false;
        if (!game.user.isGM) {
            if (!back.plantRequestId) return false;
            const res = await askSearch(ACTION_RETURN_PLANT, { plantRequestId: back.plantRequestId });
            return Boolean(res.ok);
        }
        return back.row ? putPlantBack(back.roomName, back.sceneId, back.row) : false;
    }

    /**
     * Mark, on the GMs' record of the sender's newest Search of that character, that this GM spent
     * its token (`tokenSpentAt`): a find stands only on a Search so marked (sheet-audit.mjs
     * `searchFind`, E29 fix r2-H11). On the primary GM, from `runSpend`, after a spend that
     * succeeded. A method here, like `takePlant`, so that R166 - which runs the spend's real run
     * for a player at tier 1, the token stubbed - stubs this write as well, and tier 1 writes
     * nothing at a table where that player searched minutes ago. By reading, not measured: the
     * harness holds no Search record when tier 1 runs, so it would see no write either way.
     */
    static async markSpent(sender, actorId) {
        const { rollStore, rollId, row } = await newestSearch(sender, actorId);
        if (row && !row.tokenSpentAt) await rollStore.patch(rollId, { tokenSpentAt: Date.now() });
        // The record marked, for the spend's return to settle and read (E17 fix e1-G3, `returnToken`).
        return row ? rollId : null;
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

    /**
     * How many search tokens remain in a room on the scene named. Every method here takes the
     * scene of the room it counts, with no default (E12 C6, 11.10.2026; plan-E12 3.3): until
     * 1.2.74 it was the scene on screen (`canvas.scene`, and `currentSceneId` for a spend), so
     * a Search counted, sealed and spent the room of that name on whatever scene the browser
     * running it was showing.
     */
    static left(roomName, scene) {
        if (!roomName) return 0;
        const scoped = this.key(roomName, scene);

        const fresh = this.#freshCounts.get(scoped);
        if (fresh) {
            if (Date.now() - fresh.at < this.#FRESH_MS) return fresh.value;
            this.#freshCounts.delete(scoped);
        }

        // Scene-scoped key first, then the legacy plain-name key; never above the maximum (E17 C4; S07-21): a room
        // saved at 3 read "3 / 2" once a Shift or the GM lowered the maximum, and searched three times.
        return this.storedLeft(this.store, scoped, roomName);
    }

    /** A room's count in `store` (its scene's key, then the plain name), the maximum when it holds none, never above it. */
    static storedLeft(store, key, roomName) {
        const max = this.max;
        const stored = store[key] ?? store[roomName];
        return stored === undefined || stored === null ? max : Math.min(stored, max);
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
    static sealed(roomName, scene) {
        if (!roomName) return false;
        const where = typeof scene === "string" ? game.scenes?.get(scene) : scene;
        // Every piece of the room, and only regions that are rooms (E12 C2a): the first
        // region of that name used to answer, and Room Setup wrote the last one.
        return Boolean(roomFlag(where ?? null, roomName, SEARCH_FLAGS.sealed));
    }

    /**
     * Spend one token. Returns true when it was spent, false when the room is
     * exhausted. Safe to call from a player client - it forwards to the GM.
     */
    static async spend(roomName, sceneId, { actorId = null, onPrimary = false } = {}) {
        const claimed = await this.claim(roomName, sceneId, { actorId, onPrimary });
        // `onPrimary` (the bridge's spend, `runSpend`): a step that found this browser no longer the primary (E17 fix e1-G4).
        return claimed.handedOver ? HANDED_OVER : claimed.ok;
    }

    /**
     * Spend one token and say why not: `{ ok, why }`, `why` one of "sealed", "empty", "unanswered", "refused", null
     * when spent (E17 C4, 26.10.2026; audit S07-20). The GM's refusal of a sealed room came back to the player as a
     * bare false, read as an unanswered request ("The search was not counted."); the reply names it now
     * (`runSpend`) and the Search says the seal (action-rolls.mjs `unclaimedOutcome`).
     */
    static async claim(roomName, sceneId, { actorId = null, onPrimary = false } = {}) {
        if (!roomName) return { ok: false, why: "empty" };
        if (!game.user.isGM) {
            // The searching character travels with the request: the GM spends a
            // room's token only for somebody standing in it (E03).
            // A refusal - not standing in the room, not their character - has been
            // told once, with its reason, by the one wait (E31); nothing more here.
            const res = await requestSpend(roomName, sceneId, actorId);
            // Bank the true count the GM just computed, so the chat card this
            // spend is about to produce reads it correctly instead of racing
            // the setting's own propagation back to this client.
            const left = res.ok ? res.value?.left : null;
            if (typeof left === "number") {
                this.#freshCounts.set(this.key(roomName, sceneId), { value: left, at: Date.now() });
            }
            return claimOf({ ok: res.ok, value: res.value, refused: res.refused });
        }
        const spent = await this.#spendAsGm(roomName, sceneId, { onPrimary });
        if (spent === HANDED_OVER) return { ok: false, why: "refused", handedOver: true };
        return { ok: spent, why: spent ? null : this.refusalOf(roomName, sceneId) };
    }

    /** Why the GM's spend in this room was refused: sealed, or out of tokens (`runSpend`'s reply, `claim`). */
    static refusalOf(roomName, sceneId) {
        return this.sealed(roomName, sceneId) ? "sealed" : "empty";
    }

    /**
     * A token the GM spent for a request the player's browser stopped waiting for, back in its room (E17 C4; S07-20):
     * the return a late answer asks (`returnToken`). One more, never above the maximum - a time of day that refilled
     * the room meanwhile leaves it full. In a step of `SEARCH_KEY`, as every write of the counters is (R991).
     */
    static async giveBack(roomName, sceneId) {
        if (!game.user.isGM || !roomName) return null;
        return serialWrite(SEARCH_KEY, async () => {
            // The primary's alone (`returnToken`), asked again in the step (E17 fix e1-G4).
            if (!isPrimaryGm()) return null;
            const store = foundry.utils.duplicate(this.store);
            const key = this.key(roomName, sceneId);
            const next = Math.min(this.max, this.storedLeft(store, key, roomName) + 1);
            store[key] = next;
            if (key !== roomName) delete store[roomName];   // same reasoning as `#spendAsGm`
            await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
            debug(`A search token came back to "${roomName}". Left: ${next}`);
            return next;
        });
    }

    static async #spendAsGm(roomName, sceneId, { onPrimary = false } = {}) {
        // THE LAST WORD, and deliberately down here rather than only in front
        // of the action. Every route to a search ends at this method - the
        // sheet's tile, a player's socket request, `game.drpg.useToken` from a
        // console - so a room the GM has sealed cannot be searched by any of
        // them, including one that arrives from a client whose copy of the map
        // is a few seconds out of date.
        if (this.sealed(roomName, sceneId)) return false;

        return serialWrite(SEARCH_KEY, async () => {
            /* A player's spend the bridge runs is the primary's alone (E17 fix e1-G4, 26.10.2026; the review's E17P1-COR-8,
               E17R-07): a GM whose id sorts first that connected while this step waited is the primary now, and writes the
               counters from its own copy - refused here (`HANDED_OVER`), the player's Search ends with its action back. */
            if (onPrimary && !isPrimaryGm()) return HANDED_OVER;
            const store = foundry.utils.duplicate(this.store);
            const key = this.key(roomName, sceneId);
            const current = this.storedLeft(store, key, roomName);
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
        });
    }

    /** Zero out a single room for the rest of the day (project "Tidy the room"). */
    static async exhaust(roomName, scene) {
        if (!game.user.isGM || !roomName) return false;
        return serialWrite(SEARCH_KEY, async () => {
            const store = foundry.utils.duplicate(this.store);
            const key = this.key(roomName, scene);
            store[key] = 0;
            if (key !== roomName) delete store[roomName];   // same reasoning as above
            await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
            return true;
        });
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
    static async setFor(roomName, value, scene) {
        if (!game.user.isGM || !roomName) return null;
        const max = this.max;
        const n = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));

        return serialWrite(SEARCH_KEY, async () => {
            const store = foundry.utils.duplicate(this.store);
            const key = this.key(roomName, scene);
            store[key] = n;
            // Same reasoning as `#spendAsGm`: drop the legacy plain-name key only
            // when it is genuinely a different key, or this erases the write above.
            if (key !== roomName) delete store[roomName];
            await game.settings.set(MODULE_ID, SETTINGS.searchTokens, store);
            debug(`Search tokens in "${roomName}" set to ${n}.`);
            return n;
        });
    }

    /**
     * The counters as a boundary found them, written back (E17 C7, 26.10.2026; audit S10-42): clock.mjs
     * `takeBackBoundary`, when "End without advancing" or a rewind takes back the restock a boundary gave. The whole
     * store, in a step of `SEARCH_KEY` as every write of it is (R991). GM only.
     */
    static async putBack(store = {}) {
        if (!game.user.isGM) return false;
        await serialWrite(SEARCH_KEY, () => game.settings.set(MODULE_ID, SETTINGS.searchTokens, foundry.utils.deepClone(store ?? {})));
        return true;
    }

    /** Refill everything. Called whenever the clock advances a time of day. */
    static async reset({ notify = true } = {}) {
        if (!game.user.isGM) return false;
        await serialWrite(SEARCH_KEY, () => game.settings.set(MODULE_ID, SETTINGS.searchTokens, {}));
        if (notify) ui.notifications.info(game.i18n.localize("DRPG.SearchTokens.reset"));
        return true;
    }

    /**
     * GM-only chat readout. Lists every room on the scene it is given, so a full
     * room is as visible as a spent one - "which rooms are still worth
     * searching" is the question actually being asked.
     */
    static async report(scene) {
        const max = this.max;

        const rooms = roomNames(scene);

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

/** `game.drpg.showTokens()`: the readout for the scene on this GM's screen, the scene a GM asking means. */
export function showSearchTokens() {
    return SearchTokens.report(viewedScene());
}

/* ==========================================================================
 * SOCKET BRIDGE - players ask, the primary GM writes
 * --------------------------------------------------------------------------
 * Since E31 (25.09.2026) the three requests are declarations in SEARCH_ACTIONS,
 * below, judged by the bridge's own runner (`judge`, bridge-guards.mjs) - who
 * sent it, then the guards, then the run with a whitelisted copy - and asked
 * for through the bridge's one wait (`bridgeRequest`), as every other request
 * to the GM is. The answer to a spend and to a plant check is the request's
 * `bridge.done`; a refusal is told once, with its reason. The waiting of their
 * own this file used to do (`pending`, `askGm`, `gaveUp`, a result packet) is
 * gone with it.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
/** `#spendAsGm`'s answer for a bridge's spend that found this browser no longer the primary (E17 fix e1-G4). */
const HANDED_OVER = "handedOver";
const ACTION_SPEND = "searchTokens.spend";
const ACTION_TAKE_PLANT = "searchTokens.takePlant";
const ACTION_RETURN_PLANT = "searchTokens.returnPlant";
/** player -> primary GM: the token of a spend whose answer came after this browser stopped waiting, back (E17 C4). */
const ACTION_RETURN_TOKEN = "searchTokens.returnToken";

/**
 * Who spent a token where, on the primary GM's client: `user::scene::room` ->
 * when. A plant goes only to a user in this map, once, so asking for one is not
 * a way to empty a room nobody searched.
 */
const searchedBy = new Map();
const PLANT_WINDOW_MS = TIMING.plantWindowMs;

/**
 * Plants handed out and not yet known to have arrived, on the primary GM's
 * client: the plant check's request id -> `{ kind: "plant", userId, roomName, sceneId, plant, at }`.
 * And, in the same ledger (E17 C4), the tokens a player's spend took: the spend's request id ->
 * `{ kind: "token", userId, roomName, sceneId, actorId, at }`, for the return its late answer asks.
 *
 * A REPLY THAT LANDS AFTER THE PLAYER GAVE UP (review of ACT-03, 17.09). The
 * plant leaves the store as it is handed over, and a player who stopped waiting
 * after five seconds had no request left to give it to - so on a slow server the
 * item was simply gone. That client now sends the request id back, and only a
 * plant recorded here, for that same user, goes back into the room. Only the
 * client that asked can: the one wait hands a late answer to `late` for a
 * request it gave up on and drops it anywhere else, so another tab of the same
 * user, which sees the same answer, sends nothing back (review, 17.09). The
 * wait hands it on for as long as a return is taken here, `PLANT_WINDOW_MS`
 * (its `lateMs`; E31 review: it had kept the request for one more clock, five
 * seconds, and dropped an answer later than that).
 */
const handedOut = new Map();
const searchKey = (userId, sceneId, room) => `${userId}::${sceneId ?? "-"}::${room}`;

/**
 * A REFILL ENDS EVERY TOKEN'S RETURN (E17 fix e1-G3, 26.10.2026; the review's E17P1-SEC-7). The ledger kept a spend's token
 * across a time of day's refill, so a spender whose room another player spent from in the new time of day asked the old
 * token back and the room held one more than the GM set. The tokens' entries go at every refill, whichever GM wrote it
 * (`SearchTokens.reset`): read on the primary where the setting turns empty (`registerSearchTokenSocket`'s
 * `updateSetting`, which the writer's own browser fires too). A plant's entries stay: a plant handed out is an item,
 * which a refill does not make again.
 */
function forgetTokenReturns() {
    for (const [id, entry] of handedOut) if (entry?.kind === "token") handedOut.delete(id);
}

/** The ledger's entries older than a return is taken for, gone. */
function pruneLedger() {
    for (const [id, entry] of handedOut) {
        if (Date.now() - entry.at > PLANT_WINDOW_MS) handedOut.delete(id);
    }
}

/** The ledger's entry under `id`, taken out of it: null when there is none, or it is older than a return is taken for. */
function takeEntry(id) {
    const entry = handedOut.get(id ?? "") ?? null;
    handedOut.delete(id ?? "");
    // A late reply comes back within seconds; a return long after the fact is
    // not one, and would put an item back that has been in a pocket all along.
    if (!entry || Date.now() - entry.at > PLANT_WINDOW_MS) return null;
    return entry;
}

/** The primary GM judges what a player asks here, by the declarations below. */
export function registerSearchTokenSocket() {
    game.socket.on(SOCKET_EVENT, (payload, senderId) => (isPrimaryGm() ? judge(SEARCH_ACTIONS, payload, senderId) : null));
    // Another GM's refill (E17 fix e1-G3; `forgetTokenReturns`): the setting turned empty ends every token's return here too.
    Hooks.on("updateSetting", setting => {
        if (setting?.key !== `${MODULE_ID}.${SETTINGS.searchTokens}`) return;
        const store = game.settings.get(MODULE_ID, SETTINGS.searchTokens);
        if (store && typeof store === "object" && !Object.keys(store).length) forgetTokenReturns();
    });
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
 * Why this sender may not spend a search token in this room - or take the plant
 * check that follows the spend - or null. The bridge's one guard signature
 * (see `firstRefusal` in bridge-guards.mjs, E03): a GM's search is taken as asked, a
 * player's character has to be standing in the room (`searchSpendRefusal`).
 *
 * A LOCAL GUARD (E31): it stays beside its table rather than in the leaf,
 * because it writes the place it judged into `judgedPlace`, this file's own
 * record, for the run to read back.
 */
export async function guardSearchRoom(sender, payload, ctx) {
    if (!sender) return "unknown sender";
    if (sender.isGM) return null;
    const actor = game.actors.get(payload.actorId ?? "") ?? null;
    const { locateActor } = await import("./movement.mjs");
    const where = actor ? locateActor(actor, { sceneId: payload.sceneId ?? null }) : null;
    judgedPlace.set(ctx, where);
    return searchSpendRefusal({ sender, actor, where, roomName: payload.roomName });
}

/**
 * The place `guardSearchRoom` judged, for the request it judged it for.
 *
 * KEYED BY `ctx`, NOT BY THE PACKET (E31, the design's W1). The runner hands the
 * guards the packet as it came and the run a new object with only the fields
 * its declaration lists, so a record keyed by the packet would never be found
 * by the run: `searchSceneOf` would fall back to the packet's `sceneId` - the
 * claim this guard exists to replace. `ctx` is the one object the runner hands
 * both (R166).
 */
const judgedPlace = new WeakMap();

/**
 * Which scene a search is recorded against, asked once `guardSearchRoom` has
 * passed. Not a guard - it refuses nothing: a GM's is taken as asked, a
 * player's is the scene of the very place the guard judged, read back from
 * `judgedPlace` rather than found a second time. A second `locateActor`, an
 * `await import()` later, could read a token moved or deleted in between and
 * record the spend on another scene than the one checked (the review of the
 * guard split, 24.09.2026). `judged` is there for R166, which hands it a record
 * of its own.
 */
export function searchSceneOf(sender, payload, ctx, judged = judgedPlace) {
    if (sender.isGM) return payload.sceneId ?? null;
    return judged.get(ctx)?.scene?.id ?? payload.sceneId ?? null;
}

/**
 * A plant check may be answered only for the user it was handed to, once (the
 * `handedOut` note above). It was an inline test in the socket handler, which
 * returned without a word; a refusal here is logged on the GM, and told to
 * nobody, as the return is quiet.
 */
export function guardPlantReturn(sender, payload, ctx) {
    const entry = handedOut.get(payload?.plantRequestId ?? "");
    if (entry?.kind !== "plant") return "no plant was handed out under that request";
    return entry.userId === sender?.id ? null : "that plant was handed to somebody else";
}

/**
 * A token's return may be asked only by the user whose spend took it, once (E17 C4): the ledger's entry under the
 * spend's request id, of the kind "token". Quiet, as a plant's return is: nobody waits on it.
 */
export function guardTokenReturn(sender, payload, ctx) {
    const entry = handedOut.get(payload?.spendRequestId ?? "");
    if (entry?.kind !== "token") return "no token was spent under that request";
    return entry.userId === sender?.id ? null : "that token was spent by somebody else";
}

/**
 * Spend a token for the sender, on the scene its guard judged; the answer is `{ ok, left, why }`, `why` "sealed" or
 * "empty" when refused (E17 C4; S07-20: a seal read as no answer on the player's side).
 *
 * A SPEND IS WRITTEN IN THE LEDGER (E17 C4, 26.10.2026; audit S07-20). A player's browser waits five seconds for
 * this answer and then ends the Search unclaimed, its action back; an answer after that still spent the room's
 * token. The spend is kept under its request id for `PLANT_WINDOW_MS`, so the late answer's return
 * (`ACTION_RETURN_TOKEN`) finds what to give back, and to whom.
 */
async function runSpend(payload, sender, ctx) {
    const sceneId = searchSceneOf(sender, payload, ctx);
    const spent = await SearchTokens.spend(payload.roomName, sceneId, { onPrimary: true });
    if (spent === HANDED_OVER) return { refused: "nothing was carried out: the GM's browser stopped being the primary while the spend waited" };
    const ok = Boolean(spent);
    // Only a spend that SUCCEEDED earns a look for a plant: a refused search
    // is not a search, and a plant handed out for one would be a free item
    // from a sealed or exhausted room. The look itself comes later, from a
    // Search that found something - see `SearchTokens.takePlant`. And only it
    // marks the Search's record a find may stand on (`SearchTokens.markSpent`).
    if (ok) {
        const at = Date.now();
        searchedBy.set(searchKey(sender.id, sceneId, payload.roomName), at);
        if (ctx?.requestId) {
            pruneLedger();
            handedOut.set(ctx.requestId, { kind: "token", userId: sender.id, roomName: payload.roomName, sceneId, actorId: payload.actorId ?? null, at, rollId: null });
        }
        const rollId = await SearchTokens.markSpent(sender, payload.actorId);
        const entry = ctx?.requestId ? handedOut.get(ctx.requestId) : null;
        if (entry?.kind === "token" && entry.at === at) entry.rollId = rollId;
    } else await settleUnclaimed(sender, payload.actorId);
    return { reply: { ok, left: SearchTokens.left(payload.roomName, sceneId), why: ok ? null : SearchTokens.refusalOf(payload.roomName, sceneId) } };
}

/*
 * A SEARCH WHOSE TOKEN WAS REFUSED FINDS NOTHING (E29 fix r2-H9, 06.10.2026; review round 2 cor m3).
 * The searcher's browser ends a Search whose token this GM refused - a room picked clean, or sealed -
 * without a find (action-rolls.mjs `searchUnclaimed`), but the GMs' record of its roll stayed as the
 * draw wrote it, and an item a player's console created named after that record stood as the Search's
 * find (sheet-audit.mjs `searchFind`; red at 2f2747d, the tier-2 test "a Search whose token the GM
 * refused"). The refusal settles the record's "search" now, as a stash's theft does (bridge-guards.mjs
 * `rollsFor`), and the find's judge refuses a settled record. The packet names no roll, so the record
 * is the newest Search of the character drawn for the sender: the draw writes it before it answers
 * (roll-draw.mjs `keepRecord`, which also marks the older unsettled one `superseded`), and the spend
 * follows the answer. A refusal after a roll this GM did not draw finds an older Search, whose find
 * was asked after its own spend - by reading, not measured.
 *
 * AND A SEARCH THAT ASKED FOR NO TOKEN FINDS NOTHING EITHER (E29 fix r2-H11, 06.10.2026; found by
 * fix r2-H9). Until then a find named after a Search that never asked for its token was judged on
 * the record alone (the plan's 2.6), and stood (red at 3654512, the tier-2 test "a find named after
 * a Search whose token was never spent"): a console that drew a Search and skipped the spend had
 * what the refusal above closes. A spend that succeeds marks the same record - the newest Search
 * of the character drawn for the sender (`SearchTokens.markSpent`) - and the find's judge asks for
 * that mark. A player's Search draws its roll, then spends, and only then draws the find
 * (action-rolls.mjs `performSearch`, and `grantDrawn`, the one road that names a record): the
 * Daily Life day of 40-flow flags its find when the spend marks nothing. The rest by reading, not
 * measured: a plant is handed only after a spend (`runTakePlant`); a Reroll keeps the record and
 * its mark, and grants as `reroll`; a spend that reaches this GM before its roll's record does
 * marks the Search before it, and the new one stays unmarked - the stricter side.
 */
async function settleUnclaimed(sender, actorId, named = null) {
    const { rollStore, rollId, row } = named ? await namedSearch(sender, actorId, named) : await newestSearch(sender, actorId);
    const resolved = Array.isArray(row?.resolved) ? row.resolved : [];
    if (row && !resolved.includes("search")) await rollStore.patch(rollId, { resolved: [...resolved, "search"] });
    return { rollId: row ? rollId : null, settledBefore: resolved.includes("search") };
}

/** The GMs' record `rollId`, when it is a Search of `actorId` drawn for `sender` (`newestSearch`'s shape). */
async function namedSearch(sender, actorId, rollId) {
    const { rollStore } = await import("./gm-stores.mjs");
    await rollStore.whenHydrated();
    const row = rollStore.get(rollId) ?? null;
    const ours = row && ownsActor(sender, actorId) && row.actorId === actorId && row.userId === sender.id && row.actionKey === "search";
    return { rollStore, rollId, row: ours ? row : null };
}

/**
 * The GMs' record of the newest Search of `actorId` drawn for `sender` that no later one replaced
 * (roll-draw.mjs `keepRecord`), as `{ rollStore, rollId, row }` - `row` null when there is none, or
 * when the sender does not play that character. What a spend settles or marks.
 */
async function newestSearch(sender, actorId) {
    const { rollStore } = await import("./gm-stores.mjs");
    if (!ownsActor(sender, actorId)) return { rollStore, rollId: null, row: null };
    await rollStore.whenHydrated();
    const [rollId = null, row = null] = Object.entries(rollStore.entries() ?? {})
        .filter(([, r]) => r?.actorId === actorId && r.userId === sender.id && r.actionKey === "search" && !r.superseded)
        .sort(([, a], [, b]) => (Number(b.at) || 0) - (Number(a.at) || 0))[0] ?? [];
    return { rollStore, rollId, row };
}

/**
 * Hand the room's plant to a sender who spent a token there a moment ago; the
 * answer is `{ ok, plant, left }`. The same judgement as the spend it follows,
 * so the scene is the one the spend was recorded against.
 */
async function runTakePlant(payload, sender, ctx) {
    const sceneId = searchSceneOf(sender, payload, ctx);
    // Once per token: the entry is used up whether or not a plant was there.
    const key = searchKey(sender.id, sceneId, payload.roomName);
    const at = searchedBy.get(key);
    searchedBy.delete(key);
    // The searcher, for the GMs' bookmark of their roll (E08+E28 C2): only a character the sender
    // plays; and the roll, written on only when it is the sender's Search of that character (fix
    // r1-G2, traps.mjs `takePlant`).
    const actorId = ownsActor(sender, payload.actorId) ? payload.actorId : null;
    const taken = at && Date.now() - at < PLANT_WINDOW_MS
        ? await SearchTokens.takePlant(payload.roomName, sceneId, { actorId, rollId: payload.rollId ?? null, by: sender.id })
        : null;
    // The store's row as it was taken, not the GM's own way back (`back`): this road's is the request id.
    const plant = taken ? taken.back?.row ?? taken : null;
    if (plant) {
        pruneLedger();
        handedOut.set(ctx.requestId, { kind: "plant", userId: sender.id, roomName: payload.roomName, sceneId, plant, at: Date.now() });
    }
    // The request's id goes back with the plant, for the return a refused grant asks (C4): the one `handedOut` keys.
    return { reply: { ok: Boolean(plant), plant: plantForFinder(plant), plantRequestId: plant ? ctx.requestId ?? null : null,
        left: SearchTokens.left(payload.roomName, sceneId) } };
}

/**
 * What the finder's browser is handed of a plant: the item, and nothing of the trap (E06 C10,
 * 28.09.2026; audit S07-18). The store's row carries the trap's project id beside the item, and
 * the reply carried the row whole, so the finder's console read which project had planted the
 * thing in their hands. These five are what the Search reads (action-rolls.mjs, the plant's
 * draw); `handedOut` keeps the row whole, for a return to put back.
 */
export function plantForFinder(plant) {
    if (!plant) return null;
    const { name, img, description, roles, drpgItemId } = plant;
    return { name, img, description, roles, drpgItemId };
}

/** Put a plant the asker never received back in its room. */
async function returnPlant(payload, sender, ctx) {
    const entry = takeEntry(payload.plantRequestId);
    if (!entry) return;
    await putPlantBack(entry.roomName, entry.sceneId, entry.plant);
}

/**
 * A TOKEN SPENT AFTER THE PLAYER'S BROWSER GAVE UP COMES BACK (E17 C4, 26.10.2026; audit S07-20). The spend's
 * answer came after its five seconds: the searcher's browser had ended the Search unclaimed (action-rolls.mjs
 * `searchUnclaimed`, the action given back), and asks the token back (`spendWaitOptions`). Given back once, to
 * the spender, inside `PLANT_WINDOW_MS` (`takeEntry`) and only while the look for a plant that spend earned is
 * still unasked - a browser that gave up asks none, so a plant check before the return is a Search that went on.
 * The Search's record is settled as a refused spend's is (`settleUnclaimed`), so no find stands on it. Measured by
 * tier 2 E17-T7.
 */
async function returnToken(payload, sender, ctx) {
    const entry = takeEntry(payload.spendRequestId);
    if (!entry) return { refused: "nothing was carried out: that search token's return came too late" };
    const key = searchKey(sender.id, entry.sceneId, entry.roomName);
    if (searchedBy.get(key) !== entry.at) return { refused: "nothing was carried out: the Search that token paid for went on" };
    searchedBy.delete(key);
    /* NOTHING STOOD ON THAT SEARCH (E17 fix e1-G3, 26.10.2026; the review's E17P1-SEC-1, E17R-03). A browser that gave up
       asks no plant check, and neither does a console that skips it: one spent, wrote its find on its own sheet (the
       find stood, the record marked spent) and asked the token back, and the room never ran out. The record the spend
       marked (`SearchTokens.markSpent`, kept in the entry) is settled first, so no find stands on it from here; then a
       find that already stood on it (the GMs' `sheetMarks` `finds`, sheet-audit.mjs `searchFind`) or a settling before
       this one (a stash's theft, bridge-guards.mjs `rollsFor`) keeps the token spent. A find judged while this runs
       reads the record settled and is refused (the sheet audit's step per student; not driven across the two). */
    const { rollId, settledBefore } = await settleUnclaimed(sender, entry.actorId, entry.rollId);
    if (rollId && (settledBefore || await findStoodOn(entry.actorId, rollId))) {
        return { refused: "nothing was carried out: the Search that token paid for went on" };
    }
    await SearchTokens.giveBack(entry.roomName, entry.sceneId);
    return null;
}

/** Whether the GMs hold a find of `actorId` named after the Search `rollId` (sheet-audit.mjs `searchFind`'s `finds`). */
async function findStoodOn(actorId, rollId) {
    const { sheetMarkStore } = await import("./gm-stores.mjs");
    await sheetMarkStore.whenHydrated();
    return Boolean(actorId && sheetMarkStore.get(actorId)?.finds?.[rollId]);
}

/**
 * The plant in its room again, and the GMs told (E14 part 2 C4; S08-10): a return asked by a
 * player's client, a GM's own Search's refused grant (`SearchTokens.returnPlant`). A room planted
 * again meanwhile keeps the newer plant (`restorePlant`), and the GMs are told this one is gone.
 *
 * NOT ONE ALREADY IN A POCKET (E14 fix e1-G1, 25.10.2026). A return is a player's claim that the
 * plant never reached the sheet, and `guardPlantReturn` holds only who asks and how often: a console
 * that let the grant through and then asked anyway had the item in its hands and the plant waiting
 * again, two of one trap (the late road's hole since E31 as well). So an item that carries the
 * plant's identity on any character keeps it out of the room. Measured by E14-T9's third take.
 */
async function putPlantBack(roomName, sceneId, plant) {
    if (await plantHeld(plant?.drpgItemId)) {
        debug(`A planted item was not put back in ${roomName}: a character holds it.`);
        return false;
    }
    let back = false;
    try {
        const { restorePlant } = await import("./traps.mjs");
        back = await restorePlant(roomName, sceneId, plant);
    } catch (err) {
        error("Could not put a planted item back in its room", err);
    }
    const words = { item: foundry.utils.escapeHTML(plant?.name ?? "?"), room: foundry.utils.escapeHTML(roomName ?? "?") };
    await whisperToGms(`<p>${game.i18n.format(back ? "DRPG.Trap.plantBack" : "DRPG.Trap.plantLost", words)}</p>`);
    return back;
}

/** Whether an item with this identity is on any character's sheet (`putPlantBack`). */
async function plantHeld(identity) {
    if (!identity) return false;
    const { ITEM_FLAGS } = await import("./inventory.mjs");
    return game.actors.some(actor => actor.items.some(item => item.getFlag(MODULE_ID, ITEM_FLAGS.identity) === identity));
}

/**
 * The three requests a player's client sends here, as the bridge's runner
 * judges them (E31, 25.09.2026). A spend and a plant check wait five seconds
 * for their answer (`TIMING.searchTokenAckMs`, `TIMING.plantRequestMs`), for
 * the "got it" as well - a Search is not a ruling somebody takes time over. A
 * plant given back is a report nobody waits on.
 */
export const SEARCH_ACTIONS = table({
    [ACTION_SPEND]: {
        label: "DRPG.Bridge.what.searchTokens.spend",
        guards: [knownSender, guardSearchRoom],
        // The character is the guard's to find, off the packet as it came; the run reads it only to
        // settle a refused Search's record, for a character the sender plays (`settleUnclaimed`).
        sanitize: pick({ roomName: as.text, sceneId: as.id, actorId: as.id }),
        run: runSpend,
        answer: "reply", timeoutMs: TIMING.searchTokenAckMs,
        claims: { sceneId: guardSearchRoom, actorId: guardSearchRoom }
    },
    [ACTION_TAKE_PLANT]: {
        label: "DRPG.Bridge.what.searchTokens.takePlant",
        guards: [knownSender, guardSearchRoom],
        sanitize: pick({ roomName: as.text, sceneId: as.id, actorId: as.id, rollId: as.id }),
        run: runTakePlant,
        answer: "reply", timeoutMs: TIMING.plantRequestMs,
        claims: { sceneId: guardSearchRoom, actorId: guardSearchRoom,
            rollId: "written on only by noteFactOfRoll (action-rolls.mjs): the sender's own row of that message, its character and a Search" }
    },
    [ACTION_RETURN_PLANT]: {
        label: "DRPG.Bridge.what.searchTokens.returnPlant",
        guards: [knownSender, guardPlantReturn],
        sanitize: pick({ plantRequestId: as.id }),
        run: returnPlant,
        answer: "none", quiet: true,
        claims: { plantRequestId: guardPlantReturn }
    },
    [ACTION_RETURN_TOKEN]: {
        label: "DRPG.Bridge.what.searchTokens.returnToken",
        guards: [knownSender, guardTokenReturn],
        sanitize: pick({ spendRequestId: as.id }),
        run: returnToken,
        answer: "none", quiet: true,
        claims: { spendRequestId: guardTokenReturn }
    }
});

/** Ask the primary GM for a search action as SEARCH_ACTIONS says (`ask` in gm-bridge.mjs is the same); both clocks are its one. */
function askSearch(action, payload, opts = {}) {
    const decl = SEARCH_ACTIONS[action];
    return bridgeRequest(action, payload, {
        settle: decl.answer, quiet: Boolean(decl.quiet),
        ...(decl.timeoutMs ? { timeoutMs: decl.timeoutMs, ackMs: decl.timeoutMs } : {}),
        ...opts
    });
}

/**
 * Ask the GM to spend a token on our behalf. A GM who does not answer in time
 * cannot grant a free search: the answer is not ok, and the one message has said
 * why. A spend the GM carried out after that asks its token back (`spendWaitOptions`).
 */
function requestSpend(roomName, sceneId, actorId = null) {
    return askSearch(ACTION_SPEND, { roomName, sceneId, actorId }, spendWaitOptions());
}

/**
 * How a spend waits past its clock (E17 C4, 26.10.2026; audit S07-20), as a plant check does (`requestPlantCheck`):
 * an answer that comes within `PLANT_WINDOW_MS` of the give-up goes to `late`, and a spend the GM carried out asks
 * the token back under its request id - the one the ledger keeps it by. A refused spend's late answer asks nothing.
 * Only the browser that asked is handed a late answer (the one wait's `closed`), so another tab of the same user
 * sends nothing. `ask` is the bridge's, or tier 2 E17-T7's.
 */
export function spendWaitOptions(ask = askSearch) {
    return {
        lateMs: PLANT_WINDOW_MS,
        late: (value, spendRequestId) => {
            if (value?.ok === true && spendRequestId) void ask(ACTION_RETURN_TOKEN, { spendRequestId });
        }
    };
}

/**
 * What a Search reads of its spend's bridge result, `{ ok, why }` (E17 C4; `SearchTokens.claim`): a spend carried
 * out; the GM's refusal and its why ("sealed", "empty"); no answer in time; a refusal of the request itself (the
 * character not in the room), which the one wait has told already.
 */
export function claimOf(res) {
    if (res?.ok) return res.value?.ok ? { ok: true, why: null } : { ok: false, why: res.value?.why === "sealed" ? "sealed" : "empty" };
    return { ok: false, why: res?.refused ? "refused" : "unanswered" };
}

/**
 * Ask the GM for the plant in a room this user has just searched - renamed from
 * `requestPlant` in E31, a name the Palm's request in gm-bridge.mjs has. Quiet:
 * when nobody answers, the search goes on as an ordinary one and the plant stays
 * where it was left, so there is nothing to tell the player. A plant that
 * arrives after the clock goes back to its room (`late`), while the GM's client
 * still takes one back.
 */
function requestPlantCheck(roomName, sceneId, actorId = null, rollId = null) {
    return askSearch(ACTION_TAKE_PLANT, { roomName, sceneId, actorId, rollId }, {
        quiet: true,
        lateMs: PLANT_WINDOW_MS,
        late: (value, plantRequestId) => {
            if (value?.plant) void askSearch(ACTION_RETURN_PLANT, { plantRequestId });
        }
    });
}
