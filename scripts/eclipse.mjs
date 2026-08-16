/**
 * Danganronpa RPG — the Eclipse.
 * ---------------------------------------------------------------------------
 * Guide: "Before each time of day the player may move their token by 2
 * connected rooms. Before the time of day begins every player places their
 * character token on the map — they do not see the others' tokens. Only once
 * confirmed does the time of day begin."
 *
 * That placement window is the Eclipse. During it:
 *   · nobody sees anybody else's token, in any room
 *   · each player gets exactly 2 room crossings, free of the action economy
 *   · crossings still respect doors and gaps — you move through connected
 *     rooms, not across the map
 *
 * An Eclipse is not part of a day. Time of day, session and day counters do not
 * advance while one is running; it sits between them.
 */

import { MODULE_ID, FLAGS, ECLIPSE_MOVES, ECLIPSE_FREE_PLACEMENT, TIMES_OF_DAY } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, setClock, timeOfDayLabel } from "./clock.mjs";
import { roomOfActor, neighbouringRooms } from "./movement.mjs";
import { announce, whisperToOwner, log, error, plural } from "./utils.mjs";

/** How many room crossings each character gets during an ordinary Eclipse. */
export { ECLIPSE_MOVES };

/* ==========================================================================
 * WHICH ECLIPSE IS THIS ONE
 * --------------------------------------------------------------------------
 * An Eclipse is named after the time of day it OPENS, not the one it closes:
 * the Morning Eclipse runs before Morning, the Night Eclipse before Night. The
 * clock does not move until the Eclipse ends, so the time of day a running
 * Eclipse is leading into is always the NEXT one.
 *
 * That naming is not cosmetic — it is what decides the allowance. Two of the
 * five let you start anywhere on the map (see ECLIPSE_FREE_PLACEMENT); the
 * other three are the handbook's two connected rooms.
 * ========================================================================== */

/** The time of day a running (or about-to-run) Eclipse leads into. */
export function incomingTimeOfDay(clock = getClock()) {
    const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
    if (index < 0) return TIMES_OF_DAY[0];
    return TIMES_OF_DAY[(index + 1) % TIMES_OF_DAY.length];
}

/** "Morning Eclipse", "Night Eclipse" — what this placement window is called. */
export function eclipseLabel(clock = getClock()) {
    return game.i18n.format("DRPG.Eclipse.named", {
        time: timeOfDayLabel(incomingTimeOfDay(clock))
    });
}

/** Does the Eclipse leading into this time of day allow free placement? */
export function isFreePlacement(clock = getClock()) {
    return ECLIPSE_FREE_PLACEMENT.includes(incomingTimeOfDay(clock));
}

/**
 * Crossings allowed by the Eclipse currently running.
 * `null` means unlimited — pick any room on the map.
 */
export function eclipseAllowance(clock = getClock()) {
    return isFreePlacement(clock) ? null : ECLIPSE_MOVES;
}

/**
 * Is the clock sitting on the last time of day of the session?
 *
 * Night closes a session — "most players take a long rest and finish for the
 * day". The Eclipse that follows belongs to the NEXT session's Morning, so the
 * control that opens it says so rather than pretending the evening continues.
 */
export function atSessionEnd(clock = getClock()) {
    return clock.timeOfDay === TIMES_OF_DAY[TIMES_OF_DAY.length - 1];
}

/** Per-character crossings used, keyed by actor id. Cleared when it ends. */
export function eclipseMoves() {
    return game.settings.get(MODULE_ID, SETTINGS.eclipseMoves) ?? {};
}

export function movesUsed(actor) {
    return eclipseMoves()[actor?.id] ?? 0;
}

/**
 * Crossings this character has left. `null` means unlimited — a Morning or
 * Night Eclipse places freely, so there is no number to count down.
 */
export function movesLeft(actor) {
    const allowance = eclipseAllowance();
    if (allowance === null) return null;
    return Math.max(0, allowance - movesUsed(actor));
}

/** Is an Eclipse running right now? */
export function isEclipse() {
    return getClock().eclipse === true;
}


/* ==========================================================================
 * STARTING AND ENDING
 * ========================================================================== */

/**
 * Begin the Eclipse. Everything goes dark and everyone gets two crossings.
 * The clock does not move — that happens when the Eclipse ends.
 *
 * The action economy does NOT come back here. Per the guide, the Eclipse is a
 * placement window that sits *before* the next time of day — "only once
 * confirmed does the time of day begin" — so a player has nothing to spend
 * actions or Calls on yet, only two room crossings. Refilling here used to
 * hand out a full budget the instant the Eclipse opened, with nothing
 * stopping it being spent on ordinary actions or Hope/Despair Calls while
 * the placement window was still running — see `performAction` and
 * `spendHopeCall`/`spendDespairCallFor`, which now refuse everything but Move
 * while `isEclipse()` is true. The refill itself happens in `endEclipse()`,
 * exactly when the next time of day actually starts.
 */
export async function startEclipse() {
    if (!game.user.isGM) return null;
    if (isEclipse()) {
        ui.notifications.info(game.i18n.localize("DRPG.Eclipse.already"));
        return null;
    }

    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, {});
    await setClock({ eclipse: true });

    // Read before the clock moves, which it will not until this Eclipse ends —
    // so these describe the time of day being opened, not the one just closed.
    const free = isFreePlacement();
    const allowance = eclipseAllowance();

    await announce({
        content: `<h3>${eclipseLabel()}</h3>
                  <p>${free
                      ? game.i18n.localize("DRPG.Eclipse.announceFree")
                      : game.i18n.format("DRPG.Eclipse.announce", { n: allowance })}</p>`
    });

    for (const actor of placingActors()) {
        const room = foundry.utils.escapeHTML(roomOfActor(actor) ?? "—");
        await whisperToOwner(actor, `<p>${free
            ? game.i18n.format("DRPG.Eclipse.yourMovesFree", { room })
            : game.i18n.format("DRPG.Eclipse.yourMoves", { n: allowance, room })
        }</p>`);
    }

    log("Eclipse started.");
    await broadcastEclipse(true);
    return true;
}

/**
 * End the Eclipse and start the time of day it was leading into.
 *
 * @param {object} [options]
 * @param {boolean} [options.advance]  Also advance the clock. Default true —
 *   the Eclipse sits *between* times of day, so ending one begins the next.
 */
export async function endEclipse({ advance = true } = {}) {
    if (!game.user.isGM) return null;
    if (!isEclipse()) return null;

    await setClock({ eclipse: false });
    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, {});

    log("Eclipse ended.");
    await broadcastEclipse(false);

    if (advance) {
        const { advanceTimeOfDay } = await import("./clock.mjs");
        // This is where the action economy actually comes back — see the
        // comment on `startEclipse`. `resetActions` is off by default in
        // `advanceTimeOfDay` precisely so the Eclipse is the one thing that
        // turns it on.
        await advanceTimeOfDay({ resetActions: true });
    } else {
        await announce({
            content: `<p><strong>${timeOfDayLabel()}</strong> — ${game.i18n.localize("DRPG.Eclipse.ended")}</p>`
        });
    }
    return true;
}

/** Who has and has not finished placing. For the GM, before ending it. */
export function placementStatus() {
    const used = eclipseMoves();
    const allowance = eclipseAllowance();
    return placingActors().map(a => ({
        actor: a,
        room: roomOfActor(a),
        moved: used[a.id] ?? 0,
        // `null` on a free-placement Eclipse: there is no budget to have left.
        left: allowance === null ? null : Math.max(0, allowance - (used[a.id] ?? 0)),
        allowance
    }));
}

/**
 * Who actually takes part in the placement window.
 *
 * Everybody who can cross a room during it, and nobody else. Both exclusions
 * matter in practice:
 *
 *   Monokumas  walk the map freely and are bound by none of the Eclipse's
 *              rules (see `canCross` in movement.mjs), so telling their GM
 *              "you have 2 crossings" states a limit that does not apply.
 *   the dead   cannot move at all. They were being counted in the GM's
 *              "who has finished placing" table, which meant the table could
 *              never read as finished — the GM was waiting on tokens that were
 *              never going to move.
 *
 * A Monocub stays: they are dead, but they are back on the board and they do
 * cross rooms. Flags are read directly rather than through chapter.mjs and
 * monocub.mjs, matching how actions.mjs and voice.mjs ask the same question —
 * this file is imported by movement.mjs's hot path and does not need the
 * dependency.
 */
function placingActors() {
    return game.actors.filter(a => {
        if (a.type !== "character") return false;
        if (a.getFlag(MODULE_ID, FLAGS.monokuma)) return false;
        if (a.getFlag(MODULE_ID, FLAGS.deceased) && !a.getFlag(MODULE_ID, FLAGS.monocub)) return false;
        return true;
    });
}

/* ==========================================================================
 * MOVEMENT DURING AN ECLIPSE
 * ========================================================================== */

/**
 * Judge a crossing made while the Eclipse is running.
 *
 * Returns true when the move is allowed. Crossings are limited to two, and to
 * rooms actually connected to the one you are leaving — the guide's "2
 * connected rooms", not two arbitrary hops.
 */
export async function judgeEclipseCrossing(actor, from, to) {
    if (!isEclipse()) return true;

    // A Morning or Night Eclipse is "pick any room to begin in": no budget and
    // no adjacency. Both checks below are skipped rather than given a very large
    // number, because the rule is not "many crossings" — it is that you are
    // placing a token, not walking a route.
    const free = isFreePlacement();

    if (!free) {
        const left = movesLeft(actor);
        if (left <= 0) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.noMovesLeft"));
            return false;
        }

        // Must be a connected room.
        if (from && to) {
            const connected = neighbouringRooms(from);
            if (connected.length && !connected.includes(to)) {
                ui.notifications.warn(game.i18n.format("DRPG.Eclipse.notConnected", {
                    from: from, to: to, rooms: connected.join(", ")
                }));
                return false;
            }
        }
    }

    // The count this crossing leaves behind, taken from `recordMove` rather than
    // read back out of the setting.
    //
    // A player's crossing is written by the GM over the socket, so the world
    // setting on this client is still the pre-crossing value when the next line
    // runs — every whisper said "2 left" after the first move, and the card's own
    // read-out (`budgetLine`, `costLabelFor`) was one behind for as long as the
    // round trip took. The GM's own path writes locally and is exact either way.
    // Still recorded on a free-placement Eclipse: the GM's placement table reads
    // this to see who has actually put a token down, which is the whole point of
    // the table and is just as useful when nobody has a budget.
    const used = await recordMove(actor);
    const room = foundry.utils.escapeHTML(to ?? "—");

    await whisperToOwner(actor, `<p><strong>${eclipseLabel()}</strong> — ${
        free
            ? game.i18n.format("DRPG.Eclipse.movedFree", { room })
            : plural("DRPG.Eclipse.moved", {
                room,
                left: Math.max(0, ECLIPSE_MOVES - used)
            }, "left")
    }</p>`);

    return true;
}

/**
 * Count a crossing. World setting, so players route through the GM.
 *
 * @returns {Promise<number>} crossings used AFTER this one. A player's client
 *   predicts it — the write is somebody else's and has not landed yet — which is
 *   the honest answer to "how many have I used": the request has been sent, and
 *   the setting will agree in a moment. A GM's client returns what it just wrote.
 */
async function recordMove(actor) {
    const before = movesUsed(actor);

    if (!game.user.isGM) {
        const { requestEclipseMove } = await import("./gm-bridge.mjs");
        await requestEclipseMove(actor.id);
        return before + 1;
    }

    const used = { ...eclipseMoves() };
    used[actor.id] = before + 1;
    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, used);
    return used[actor.id];
}

/** Apply a crossing recorded on a player's behalf. GM side of the socket. */
export async function applyRecordedMove(actorId) {
    if (!game.user.isGM) return null;
    const used = { ...eclipseMoves() };
    used[actorId] = (used[actorId] ?? 0) + 1;
    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, used);
    return used[actorId];
}

/**
 * Tell every client the Eclipse changed.
 *
 * The dimming, the token visibility rules and the HUD badge all keyed off a
 * local hook, so on a hosted server only the GM's screen ever went dark.
 */
async function broadcastEclipse(active) {
    const { broadcast, SYNC } = await import("./sync.mjs");
    broadcast(SYNC.eclipse, { active });
}

export function refreshEclipse() {
    try {
        document.body.classList.toggle("drpg-eclipse", isEclipse());
        import("./visibility.mjs").then(m => m.applyAll()).catch(() => {});
        import("./hud.mjs").then(m => m.renderHud()).catch(() => {});
    } catch (err) {
        error("Could not refresh for the Eclipse", err);
    }
}

/** Keep the body class in step on load and on every clock change. */
export function registerEclipse() {
    Hooks.once("ready", refreshEclipse);
    Hooks.on("drpgTimeOfDayChanged", refreshEclipse);
}
