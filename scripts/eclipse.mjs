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
import { announce, whisperToOwner, whisperToOwnerOnly, whisperToGms, dialogContent, log, error, plural, cardHead } from "./utils.mjs";
import { overflowCrossings } from "./overflow.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

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
    const base = isFreePlacement(clock) ? null : ECLIPSE_MOVES;
    // Z10. Asked here rather than at each of the four call sites, because this
    // is already the one place the number is decided — `movesLeft`, the sheet's
    // budget line, the Move tile and the Eclipse card all read it from here.
    return overflowCrossings(base);
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
 * THE ACTION ECONOMY COMES BACK HERE (Z2, E18b wave 5), and this function used
 * to argue at length that it must not. The argument was right about the danger
 * and wrong about the cure.
 *
 * The danger: the Eclipse is a placement window sitting BEFORE the next time of
 * day — "only once confirmed does the time of day begin" — so a full budget
 * handed out at the top of it could be spent on ordinary actions and on
 * Hope/Despair Calls while everybody was still walking. That is a real bug and
 * it really happened. It is now fixed WHERE IT BELONGS: `performAction` and
 * `spendHopeCall`/`spendDespairCallFor` refuse everything but Move while
 * `isEclipse()` is true. Refilling late was a second lock on a door that
 * already had one.
 *
 * What refilling late cost was the one action the Eclipse is FOR. A Direct
 * Murder is declared in the dark and nowhere else, it costs an action, and
 * until now that action came out of the budget of the day that had just
 * ENDED — so a killer who had spent their afternoon could not act on the one
 * opportunity the guide gives them, and a killer who had idled all day paid
 * with a currency they no longer had any other use for. Neither is a decision.
 *
 * Now the budget arrives with the dark: the declaration comes off the new
 * allowance, and the killer walks into the time of day one action lighter than
 * everybody else. That is the trade, and it is legible at the moment it is
 * made.
 *
 * ONE REFILL, AND THIS IS THE ONLY ONE. `endEclipse` no longer asks
 * `advanceTimeOfDay` for one, `advanceTimeOfDay` still defaults to off, and the
 * GM's clock editor still only refills when the box is ticked. An invariant
 * holds that shape — see "the action budget comes back when the Eclipse opens".
 */
export async function startEclipse() {
    if (!game.user.isGM) return null;
    if (isEclipse()) {
        ui.notifications.info(game.i18n.localize("DRPG.Eclipse.already"));
        return null;
    }

    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, {});
    await setClock({ eclipse: true });

    /*
     * THE OVERFLOW CHECK, AND IT HAS TO COME BEFORE THE REFILL (Z10).
     *
     * A darkening takes an action off everybody's budget, and the budget is
     * WRITTEN by the refill two blocks down — `resetActionsFor` stores the
     * total as both value and max. Checked afterwards, the darkening would
     * arrive one time of day late every single time: announced now, felt next
     * time. The order of these two calls is the whole of that.
     *
     * After the flag, because the crossings this Eclipse hands out are read
     * from a clock that has to already say `eclipse: true`.
     */
    const { checkOverflow } = await import("./overflow.mjs");
    await checkOverflow({ opening: true });

    /*
     * THE REFILL (Z2). After the flag, before the card.
     *
     * After the flag because `resetActionsFor` also zeroes the Sprint and Burst
     * grants, and "until the end of this time of day" ends when the lights go
     * out — the Eclipse is the boundary, not a part of the day it follows. The
     * grants therefore die on exactly the boundary they always died on; only
     * the line of code that kills them moved.
     *
     * Before the card so the card can say how many, which matters more than it
     * sounds: the announcement is the only thing the table reads at this
     * moment, and the one event that hands everybody their actions back was
     * about to become the only event that never mentioned it.
     *
     * Imported here rather than at the top: clock.mjs already imports
     * actions.mjs, and eclipse.mjs already imports clock.mjs.
     */
    const { resetAllActions } = await import("./actions.mjs");
    let refilled = [];
    try {
        refilled = await resetAllActions();
    } catch (err) {
        // Reported rather than swallowed, and the Eclipse still opens: a table
        // left in the dark with no way forward is worse than a table that has
        // to refill by hand.
        error("Could not refill the action budget as the Eclipse opened", err);
    }

    // Read before the clock moves, which it will not until this Eclipse ends —
    // so these describe the time of day being opened, not the one just closed.
    const free = isFreePlacement();
    const allowance = eclipseAllowance();

    const refillNote = refilled.length
        ? `<p><em>${plural("DRPG.Clock.actionsRefilled",
                           { count: refilled.length }, "count")}</em></p>`
        : "";

    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "eclipseStart", gm: true } } },
        content: `<h3>${eclipseLabel()}</h3>
                  <p>${free
                      ? game.i18n.localize("DRPG.Eclipse.announceFree")
                      : plural("DRPG.Eclipse.announce", { n: allowance }, "n")}</p>
                  ${refillNote}`
    });

    for (const actor of placingActors()) {
        const room = foundry.utils.escapeHTML(roomOfActor(actor) ?? "—");
        // PLURALISED BECAUSE ONE IS NOW REACHABLE. A darkened Eclipse hands out
        // a single crossing (Z10), and until then no allowance was ever 1, so
        // "up to 1 connected rooms" had never been printed. Found on the live
        // round the moment the overflow first fired.
        await whisperToOwner(actor, `<p>${free
            ? game.i18n.format("DRPG.Eclipse.yourMovesFree", { room })
            : plural("DRPG.Eclipse.yourMoves", { n: allowance, room }, "n")
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

    await game.settings.set(MODULE_ID, SETTINGS.eclipseMoves, {});
    log("Eclipse ended.");

    // The broadcast comes AFTER the clock, for the same reason the flag does.
    // It redraws the HUD on every other client, and sent first it redrew them
    // into the half-finished state this function exists to skip past.
    if (advance) {
        const { advanceTimeOfDay } = await import("./clock.mjs");
        // NO REFILL HERE ANY MORE (Z2). The budget arrived when this Eclipse
        // opened; asking for a second one on the way out would hand the table
        // two in a row and wipe the cost of a Direct Murder declared in the
        // dark — the exact thing this change exists to make payable.
        //
        // `resetActions` stays off by default in `advanceTimeOfDay`, so the
        // omission below is the whole of it. The GM's clock editor still asks
        // for one explicitly when a botched advance needs repairing.
        //
        // `eclipse: false` travels WITH the advance rather than ahead of it.
        // Cleared first, the clock spent a frame reading as the time of day
        // that had just finished — the flicker between the Eclipse and the
        // time it leads into.
        /*
         * THE SOUND RIDES THIS CARD, AND THAT IS THE BUG THIS FIXES.
         *
         * `eclipseEnd` used to be attached to the `else` below — the branch for
         * `advance: false`, which nothing in the game takes. An Eclipse ends by
         * advancing the clock; that is what `advance` defaults to and what the
         * GM panel calls. So the sound was mapped, catalogued, shown in the
         * Sound panel with a Test button that worked, and never once played in
         * a real session. Found at the table by Dawid, 28.08, and it could only
         * be found there: nothing static can tell a live branch from a dead one.
         *
         * There is no card of its own on this path because there should not be:
         * `advanceTimeOfDay` already announces the time of day the Eclipse was
         * leading into, and a second card would say the same thing twice.
         */
        await advanceTimeOfDay({
            also: { eclipse: false },
            sfx: { key: "eclipseEnd", gm: true }
        });
    } else {
        await setClock({ eclipse: false });
        await announce({
            flags: { [MODULE_ID]: { sfx: { key: "eclipseEnd", gm: true } } },
            content: `<p><strong>${timeOfDayLabel()}</strong> — ${game.i18n.localize("DRPG.Eclipse.ended")}</p>`
        });
    }

    await broadcastEclipse(false);

    // LAST, and after the clock has moved. Everything a murder opened here needs
    // — the new time of day, unlocked Hope Calls — is put in place by the lines
    // above, and an incident opened before them lands in the placement window
    // this function exists to close.
    //
    // The action budget is NOT among those things any more, and does not need
    // to be: the declaration paid for itself when it was made, out of the
    // budget this Eclipse opened with (Z2). Judging spends nothing.
    try {
        await judgePendingMurders();
    } catch (err) {
        error("Could not judge the direct murders declared during the Eclipse", err);
    }
    return true;
}

/* ==========================================================================
 * DIRECT MURDERS DECLARED IN THE DARK
 * --------------------------------------------------------------------------
 * The guide gives the Eclipse as the one moment you can be alone with somebody,
 * so a direct murder is declared here and nowhere else. What it must NOT do is
 * resolve here: the Eclipse is a placement window that sits before the next
 * time of day, everybody is still crossing the map, Hope Calls are locked, and
 * the third-party watch would take the first person walking through the room as
 * a witness. See the long note in `performDirectMurder`.
 *
 * So the declaration waits, and is judged against where everyone ENDS UP — the
 * placement is the answer, not a snapshot of a room half way through it.
 * ========================================================================== */

function pendingMurders() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.pendingMurders) ?? {};
    } catch {
        return {};
    }
}

/** Record a declaration. One per killer: declaring twice replaces the first. */
export async function parkDirectMurder({ killerId, room = null, note = "" } = {}) {
    if (!killerId) return null;
    const { requestParkMurder } = await import("./gm-bridge.mjs");
    return requestParkMurder({ killerId, room, note });
}

/** GM-side. The write itself, reached from the bridge or directly by a GM. */
export async function writeParkedMurder({ killerId, room = null, note = "" } = {}) {
    if (!game.user.isGM || !killerId) return null;
    const all = { ...pendingMurders() };
    // `approved: null` is undecided, and it is written explicitly: a
    // declaration parked before this gate existed carries no field at all, and
    // `undefined` reading as "not yet allowed" is exactly the right answer for
    // it — the GM is asked at the lights instead.
    all[killerId] = { room, note, at: Date.now(), approved: null };
    await game.settings.set(MODULE_ID, SETTINGS.pendingMurders, all);
    log(`Direct murder declared in the dark by ${game.actors.get(killerId)?.name ?? killerId}.`);

    await askGmToAllow(killerId, all[killerId]);
    return all[killerId];
}

/**
 * Put the declaration to the GM, now, while the Eclipse is still running.
 *
 * Into the killer's own messenger thread, like every other ruling this module
 * asks for — which means the killer sees the card too, and should: it is their
 * declaration and their sentence quoted in it. The buttons are stripped for
 * anybody who is not a GM before they are ever rendered.
 *
 * It cannot name a victim, because there is not one yet. Nobody has finished
 * placing and the room the killer ends up in is the whole question the Eclipse
 * exists to answer, so what the GM is being asked here is whether this player
 * may attempt it at all.
 */
async function askGmToAllow(killerId, parked) {
    const killer = game.actors.get(killerId);
    if (!killer) return;

    try {
        const { callGm } = await import("./gm-bridge.mjs");
        await callGm(killer, {
            title: game.i18n.localize("DRPG.Action.directMurder"),
            body: game.i18n.localize("DRPG.Action.murderNeedsApproval"),
            request: parked.note ?? "",
            room: parked.room ?? null,
            actions: [
                {
                    action: "approveMurder",
                    label: game.i18n.localize("DRPG.Action.murderApprove"),
                    data: { killer: killerId }
                },
                {
                    action: "refuseMurder",
                    label: game.i18n.localize("DRPG.Action.murderRefuse"),
                    data: { killer: killerId }
                }
            ]
        });
    } catch (err) {
        // A card that could not be posted must not lose the declaration. The
        // gate at the lights asks again, which is the whole reason it exists.
        error("Could not put the direct murder to the GM", err);
    }
}

/**
 * The GM's ruling on a parked declaration, from the card's two buttons.
 *
 * Refusing DELETES the record rather than marking it refused. A refusal is not
 * a thing the judging step needs to reason about — there is nothing to judge —
 * and leaving it in the setting only creates a second way for a dead
 * declaration to be reconsidered at the lights.
 *
 * The action stays spent either way. That is the guide's rule for a direct
 * murder and it does not change because the GM said no: declaring is the cost.
 */
export async function ruleOnParkedMurder(killerId, allow) {
    if (!game.user.isGM || !killerId) return null;

    const all = { ...pendingMurders() };
    const parked = all[killerId];
    const killer = game.actors.get(killerId);
    if (!parked) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.murderNotParked"));
        return null;
    }

    if (allow) all[killerId] = { ...parked, approved: true };
    else delete all[killerId];
    await game.settings.set(MODULE_ID, SETTINGS.pendingMurders, all);

    if (killer) {
        await whisperToOwner(killer,
            `${cardHead({ action: game.i18n.localize("DRPG.Action.directMurder") })}<p>${
                allow
                    ? game.i18n.localize("DRPG.Action.murderApproved")
                    : `<span class="drpg-warning">${
                        game.i18n.localize("DRPG.Action.murderRefused")}</span>`}</p>`);
    }

    log(`Direct murder by ${killer?.name ?? killerId} ${allow ? "allowed" : "refused"}.`);
    ui.notifications.info(game.i18n.format(
        allow ? "DRPG.Action.murderApprovedGm" : "DRPG.Action.murderRefusedGm",
        { name: killer?.name ?? "?" }));
    return allow;
}

export async function clearParkedMurders() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, SETTINGS.pendingMurders, {});
}

/**
 * The lights come up: judge every declaration made in the dark.
 *
 * The condition is the guide's and is read now, off the final placement — one
 * other character in the killer's room, and that person is the victim. Anything
 * else is a failed attempt: nobody there to kill, or somebody there to see it.
 *
 * Only the FIRST successful declaration opens an incident. Two killings at once
 * is not something this engine models — `murderState` is a single incident —
 * and the honest thing is to say so to the second killer rather than to drop
 * their attempt silently.
 *
 * AND NOTHING OPENS WITHOUT THE GM. The room condition is the guide's and the
 * module can read it; whether this killing happens at this table tonight is not
 * a thing a rule can answer. Most declarations are already ruled on from the
 * card posted when they were parked — see `askGmToAllow` — and this is the
 * backstop for the ones that are not, asked at the one moment the question is
 * fully formed: the killer, the victim, the room, and the killer's own sentence
 * about what they are doing.
 */
async function judgePendingMurders() {
    if (!game.user.isGM) return;

    const all = pendingMurders();
    const ids = Object.keys(all);
    if (!ids.length) return;
    await clearParkedMurders();

    const { othersInRoom, roomOfActor } = await import("./movement.mjs");
    const { openMurder, murderState } = await import("./murder.mjs");
    const { whisperToOwner, whisperToGms } = await import("./utils.mjs");

    // Declaration order, so "whoever got there first" is a fact about the table
    // rather than about object-key ordering.
    ids.sort((a, b) => (all[a].at ?? 0) - (all[b].at ?? 0));

    for (const killerId of ids) {
        const killer = game.actors.get(killerId);
        if (!killer) continue;

        const parked = all[killerId];
        const room = roomOfActor(killer) ?? parked.room;
        const present = othersInRoom(killer);

        const say = async (line, cls = "") => {
            await whisperToOwner(killer,
                `${cardHead({ action: game.i18n.localize("DRPG.Action.directMurder") })}<p>${
                    cls ? `<span class="${cls}">${line}</span>` : line}</p>`);
        };

        if (murderState()) {
            await say(game.i18n.localize("DRPG.Action.murderAlreadyRunning"), "drpg-warning");
            await whisperToGms(`<p>${game.i18n.format("DRPG.Action.murderSecondDeclaration", {
                killer: foundry.utils.escapeHTML(killer.name)
            })}</p>`);
            continue;
        }

        if (present.length !== 1) {
            const reason = present.length === 0
                ? game.i18n.localize("DRPG.Action.murderNobody")
                : plural("DRPG.Action.murderWitness", { n: present.length - 1 });
            await say(reason, "drpg-warning");
            await whisperToGms(`<p>${game.i18n.format("DRPG.Action.murderCancelled", {
                killer: foundry.utils.escapeHTML(killer.name),
                room: foundry.utils.escapeHTML(room ?? "—"),
                reason: foundry.utils.escapeHTML(reason)
            })}</p>`);
            continue;
        }

        const victim = present[0];

        // Ruled on already, or ruled on now. Asked AFTER the room condition, so
        // the GM is never made to decide about an attempt that came to nothing
        // on its own.
        if (parked.approved !== true && !await askAtTheLights(killer, victim, room, parked)) {
            await say(game.i18n.localize("DRPG.Action.murderRefused"), "drpg-warning");
            continue;
        }

        await whisperToGms(`
            <h3>${game.i18n.localize("DRPG.Action.murderOpensTitle")}</h3>
            <p>${game.i18n.format("DRPG.Action.murderOpens", {
                killer: foundry.utils.escapeHTML(killer.name),
                victim: foundry.utils.escapeHTML(victim.name),
                room: foundry.utils.escapeHTML(room ?? "—")
            })}</p>
            ${parked.note ? `<p class="notes">${foundry.utils.escapeHTML(parked.note)}</p>` : ""}`);

        await openMurder({ killerId: killer.id, victimId: victim.id });
    }
}

/**
 * The question the card asked, asked again with the answers filled in.
 *
 * Only reached when the GM did not rule during the Eclipse. It BLOCKS the end
 * of the Eclipse, which is the point: everything else `endEclipse` does has
 * already happened by the time this runs, and the alternative to blocking is a
 * spent action failing because a card scrolled off the bottom of a thread.
 *
 * Closing the window is a refusal. There is no third answer here — the
 * incident either opens now or it does not — and a dialog dismissed with the
 * escape key must not open one.
 */
async function askAtTheLights(killer, victim, room, parked) {
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    try {
        return Boolean(await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Action.murderOpensTitle") },
            content: dialogContent(`<div>
                <p>${game.i18n.format("DRPG.Action.murderAsk", {
                    killer: esc(killer.name), victim: esc(victim.name), room: esc(room ?? "—")
                })}</p>
                ${parked.note ? `<blockquote>${esc(parked.note)}</blockquote>` : ""}
                <p class="notes">${game.i18n.localize("DRPG.Action.murderAskNote")}</p>
            </div>`),
            yes: { label: game.i18n.localize("DRPG.Action.murderApprove") },
            no: { label: game.i18n.localize("DRPG.Action.murderRefuse"), default: true },
            rejectClose: false
        }));
    } catch (err) {
        // A dialog that could not open must not open an incident by accident.
        error("Could not ask the GM about the direct murder", err);
        return false;
    }
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

    // Owner ONLY — no GM copy, on purpose. This card names the room the
    // character just walked into, and an Eclipse is everybody crossing the
    // map in the dark: a copy of every crossing landing on the GM's screen
    // was a running commentary on exactly the thing the phase hides. The GM
    // who wants the answer opens the placement table, which `recordMove`
    // above keeps current either way.
    await whisperToOwnerOnly(actor, `${cardHead({ action: eclipseLabel(), room: to })}<p>${
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
