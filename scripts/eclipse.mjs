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

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, setClock, timeOfDayLabel } from "./clock.mjs";
import { roomOfActor, neighbouringRooms } from "./movement.mjs";
import { whisperToOwner, whisperToGms, log, error } from "./utils.mjs";

/** How many room crossings each character gets during an Eclipse. */
export const ECLIPSE_MOVES = 2;

/** Per-character crossings used, keyed by actor id. Cleared when it ends. */
export function eclipseMoves() {
    return game.settings.get(MODULE_ID, SETTINGS.eclipseMoves) ?? {};
}

export function movesUsed(actor) {
    return eclipseMoves()[actor?.id] ?? 0;
}

export function movesLeft(actor) {
    return Math.max(0, ECLIPSE_MOVES - movesUsed(actor));
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
 */
export async function startEclipse() {
    if (!game.user.isGM) return null;
    if (isEclipse()) {
        ui.notifications.info(game.i18n.localize("DRPG.Eclipse.already"));
        return null;
    }

    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, {});
    await setClock({ eclipse: true });

    await ChatMessage.create({
        content: `<h3>${game.i18n.localize("DRPG.Eclipse.title")}</h3>
                  <p>${game.i18n.format("DRPG.Eclipse.announce", { n: ECLIPSE_MOVES })}</p>`
    });

    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Eclipse.yourMoves", {
            n: ECLIPSE_MOVES,
            room: foundry.utils.escapeHTML(roomOfActor(actor) ?? "—")
        })}</p>`);
    }

    log("Eclipse started.");
    Hooks.callAll("drpgEclipseChanged", { active: true });
    refresh();
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
    Hooks.callAll("drpgEclipseChanged", { active: false });
    refresh();

    if (advance) {
        const { advanceTimeOfDay } = await import("./clock.mjs");
        await advanceTimeOfDay();
    } else {
        await ChatMessage.create({
            content: `<p><strong>${timeOfDayLabel()}</strong> — ${game.i18n.localize("DRPG.Eclipse.ended")}</p>`
        });
    }
    return true;
}

/** Who has and has not finished placing. For the GM, before ending it. */
export function placementStatus() {
    const used = eclipseMoves();
    return game.actors
        .filter(a => a.type === "character")
        .map(a => ({
            actor: a,
            room: roomOfActor(a),
            moved: used[a.id] ?? 0,
            left: Math.max(0, ECLIPSE_MOVES - (used[a.id] ?? 0))
        }));
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

    await recordMove(actor);
    const remaining = movesLeft(actor);

    await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Eclipse.title")}</strong> — ${
        game.i18n.format("DRPG.Eclipse.moved", {
            room: foundry.utils.escapeHTML(to ?? "—"),
            left: remaining
        })
    }</p>`);

    return true;
}

/** Count a crossing. World setting, so players route through the GM. */
async function recordMove(actor) {
    if (!game.user.isGM) {
        const { requestEclipseMove } = await import("./gm-bridge.mjs");
        return requestEclipseMove(actor.id);
    }
    const used = { ...eclipseMoves() };
    used[actor.id] = (used[actor.id] ?? 0) + 1;
    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, used);
}

/** Apply a crossing recorded on a player's behalf. GM side of the socket. */
export async function applyRecordedMove(actorId) {
    if (!game.user.isGM) return null;
    const used = { ...eclipseMoves() };
    used[actorId] = (used[actorId] ?? 0) + 1;
    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, used);
    return used[actorId];
}

function refresh() {
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
    Hooks.once("ready", refresh);
    Hooks.on("drpgTimeOfDayChanged", refresh);
}
