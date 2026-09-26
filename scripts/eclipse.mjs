/**
 * Danganronpa RPG - the Eclipse.
 * ---------------------------------------------------------------------------
 * Guide: "Before each time of day the player may move their token by 2
 * connected rooms. Before the time of day begins every player places their
 * character token on the map - they do not see the others' tokens. Only once
 * confirmed does the time of day begin."
 *
 * That placement window is the Eclipse. During it:
 *   · nobody sees anybody else's token, in any room
 *   · each player gets exactly 2 room crossings, free of the action economy
 *   · crossings still respect doors and gaps - you move through connected
 *     rooms, not across the map
 *
 * An Eclipse is not part of a day. Time of day, session and day counters do not
 * advance while one is running; it sits between them.
 */

import { MODULE_ID, FLAGS, ECLIPSE_MOVES, ECLIPSE_FREE_PLACEMENT } from "./config.mjs";
import { SETTINGS, isEclipse, incomingTimeOfDay, eclipseId, eclipseMovesUsed } from "./settings.mjs";
// Defined in settings.mjs, the leaf every side of this file's import cycles can
// reach (audit C3); re-exported so nothing that imports them from here has to
// know that.
export { isEclipse, incomingTimeOfDay, eclipseId };
import { getClock, setClock, timeOfDayLabel } from "./clock.mjs";
import { roomOfActor, neighbouringRooms } from "./movement.mjs";
import { announce, whisperToOwner, whisperToOwnerOnly, whisperToGms, dialogContent, log, warn, error, plural, cardHead, esc, isPrimaryGm,
    primaryGmId, ownerIdsOf } from "./utils.mjs";
import { overflowCrossings } from "./overflow.mjs";
import { pendingMurderStore, eclipseMoveStore, eclipseMoveCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";

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
 * That naming is not cosmetic - it is what decides the allowance. The ones in
 * ECLIPSE_FREE_PLACEMENT (Night, today) let you start anywhere on the map - unless
 * the darkening has pulled that back to two crossings (`freeBecomes` in the
 * overflow table); the other three are the handbook's two connected rooms.
 * ========================================================================== */

/** "Morning Eclipse", "Night Eclipse" - what this placement window is called. */
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
 * `null` means unlimited - pick any room on the map.
 */
export function eclipseAllowance(clock = getClock()) {
    const base = isFreePlacement(clock) ? null : ECLIPSE_MOVES;
    // Z10. Asked here rather than at each of the four call sites, because this
    // is already the one place the number is decided - `movesLeft`, the sheet's
    // budget line, the Move tile and the Eclipse card all read it from here.
    return overflowCrossings(base);
}

/**
 * Crossings used in the running Eclipse, keyed by actor id: the GMs' store on a GM's
 * browser, the owner's copy of their own characters on a player's (E05, audit S10-39 -
 * until 1.2.64 a world setting every browser held). A row of another Eclipse counts
 * nothing, so nothing has to clear them when one starts or ends.
 */
export function eclipseMoves() {
    const id = eclipseId();
    const out = {};
    if (!id) return out;
    const rows = game.user?.isGM ? eclipseMoveStore.entries() : (eclipseMoveCopy.read() ?? {});
    for (const [actorId, row] of Object.entries(rows ?? {})) {
        if (row?.eclipse === id) out[actorId] = Math.max(0, Number(row.used) || 0);
    }
    return out;
}

export function movesUsed(actor) {
    return eclipseMovesUsed(actor?.id);
}

/**
 * Crossings this character has left. `null` means unlimited - a Morning or
 * Night Eclipse places freely, so there is no number to count down.
 */
export function movesLeft(actor) {
    const allowance = eclipseAllowance();
    if (allowance === null) return null;
    return Math.max(0, allowance - movesUsed(actor));
}


/* ==========================================================================
 * STARTING AND ENDING
 * ========================================================================== */

/**
 * Begin the Eclipse. Everything goes dark and everyone gets two crossings.
 * The clock does not move - that happens when the Eclipse ends.
 *
 * THE ACTION ECONOMY COMES BACK HERE (Z2, E18b wave 5), and this function used
 * to argue at length that it must not. The argument was right about the danger
 * and wrong about the cure.
 *
 * The danger: the Eclipse is a placement window sitting BEFORE the next time of
 * day - "only once confirmed does the time of day begin" - so a full budget
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
 * ENDED - so a killer who had spent their afternoon could not act on the one
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
 * holds that shape - see "the action budget comes back when the Eclipse opens".
 */
export async function startEclipse() {
    if (!game.user.isGM) return null;
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.already"));
        return null;
    }

    // Named by when it began (`eclipseId`): what is declared and crossed in it counts
    // in it alone, so the last Eclipse's crossings need no clearing (E05).
    await setClock({ eclipse: true, eclipseStartedAt: Date.now() });

    /*
     * THE OVERFLOW CHECK, AND IT HAS TO COME BEFORE THE REFILL (Z10).
     *
     * A darkening takes an action off everybody's budget, and the budget is
     * WRITTEN by the refill two blocks down - `resetActionsFor` stores the
     * total as both value and max. Checked afterwards, the darkening would
     * arrive one time of day late every single time: announced now, felt next
     * time. The order of these two calls is the whole of that.
     *
     * After the flag, because the crossings this Eclipse hands out are read
     * from a clock that has to already say `eclipse: true`.
     */
    const { checkOverflow } = await import("./overflow.mjs");
    await checkOverflow({ ahead: true });

    /*
     * THE REFILL (Z2). After the flag, before the card.
     *
     * After the flag because `resetActionsFor` also zeroes the Sprint and Burst
     * grants, and "until the end of this time of day" ends when the lights go
     * out - the Eclipse is the boundary, not a part of the day it follows. The
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

    /*
     * AND EVERYTHING BOUGHT "UNTIL THIS TIME OF DAY ENDS" ENDS WITH IT (CALL-09, 17.09).
     *
     * Same boundary, same reasoning as the grants above. A sealed room, a Chained
     * student and a Silence used to be cleared only when the clock itself moved,
     * which with Eclipses is when the Eclipse ENDS - so a Chained student could
     * make none of their crossings, a sealed room could not be entered during
     * placement, and a Call priced for one time of day took the next one's
     * positioning too. The clear in `applyTimeOfDayChange` stays, for tables
     * that move the clock without an Eclipse; after this one it clears nothing.
     */
    try {
        const { clearSeals } = await import("./call-effects.mjs");
        await clearSeals();
    } catch (err) {
        error("Could not lift the seals and restrictions as the Eclipse opened", err);
    }

    // Read before the clock moves, which it will not until this Eclipse ends -
    // so these describe the time of day being opened, not the one just closed.
    //
    // `free` comes off the ALLOWANCE rather than off the calendar, the same
    // correction `judgeEclipseCrossing` carries and for the same reason: a
    // darkened free-placement Eclipse is worth two crossings, and announcing
    // "pick any room on the map" while the rules hand out two is the module
    // telling the table something it will refuse a moment later.
    const allowance = eclipseAllowance();
    const free = allowance === null;

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
        const room = foundry.utils.escapeHTML(roomOfActor(actor) ?? "-");
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
 * @param {boolean} [options.advance]  Also advance the clock. Default true -
 *   the Eclipse sits *between* times of day, so ending one begins the next.
 */
export async function endEclipse({ advance = true } = {}) {
    if (!game.user.isGM) return null;
    if (!isEclipse()) return null;
    // Its name, read while it still has one: the lights below judge what was declared in it.
    const ending = eclipseId();

    log("Eclipse ended.");

    // The broadcast comes AFTER the clock, for the same reason the flag does.
    // It redraws the HUD on every other client, and sent first it redrew them
    // into the half-finished state this function exists to skip past.
    if (advance) {
        const { advanceTimeOfDay } = await import("./clock.mjs");
        // NO REFILL HERE ANY MORE (Z2). The budget arrived when this Eclipse
        // opened; asking for a second one on the way out would hand the table
        // two in a row and wipe the cost of a Direct Murder declared in the
        // dark - the exact thing this change exists to make payable.
        //
        // `resetActions` stays off by default in `advanceTimeOfDay`, so the
        // omission below is the whole of it. The GM's clock editor still asks
        // for one explicitly when a botched advance needs repairing.
        //
        // `eclipse: false` travels WITH the advance rather than ahead of it.
        // Cleared first, the clock spent a frame reading as the time of day
        // that had just finished - the flicker between the Eclipse and the
        // time it leads into.
        /*
         * THE SOUND RIDES THIS CARD, AND THAT IS THE BUG THIS FIXES.
         *
         * `eclipseEnd` used to be attached to the `else` below - the branch for
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
            content: `<p><strong>${timeOfDayLabel()}</strong> - ${game.i18n.localize("DRPG.Eclipse.ended")}</p>`
        });
    }

    await broadcastEclipse(false);

    // LAST, and after the clock has moved. Everything a murder opened here needs
    // - the new time of day, unlocked Hope Calls - is put in place by the lines
    // above, and an incident opened before them lands in the placement window
    // this function exists to close.
    //
    // The action budget is NOT among those things any more, and does not need
    // to be: the declaration paid for itself when it was made, out of the
    // budget this Eclipse opened with (Z2). Judging spends nothing.
    try {
        await judgePendingMurders(ending);
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
 * So the declaration waits, and is judged against where everyone ENDS UP - the
 * placement is the answer, not a snapshot of a room half way through it.
 * ========================================================================== */

/**
 * The declarations of the Eclipse `id` - the running one's unless another is named -
 * keyed by killer id. The GMs' store (E05, audit S10-01): until 1.2.64 this was a
 * world setting, and every player's console read the killer, the room and the plan
 * for the whole of the Eclipse. A row of another Eclipse is not this one's, whoever
 * holds it: a GM who was away when an Eclipse ended hands its rows back at the next
 * exchange, and they must not be judged by the next lights.
 */
function pendingMurders(id = eclipseId()) {
    const out = {};
    if (!game.user.isGM || !id) return out;
    for (const [killerId, row] of Object.entries(pendingMurderStore.entries())) {
        if (row && row.eclipse === id) out[killerId] = row;
    }
    return out;
}

/** Record a declaration. One per killer: declaring twice replaces the first. */
export async function parkDirectMurder({ killerId, room = null, note = "" } = {}) {
    if (!killerId) return null;
    const { requestParkMurder } = await import("./gm-bridge.mjs");
    const res = await requestParkMurder({ killerId, room, note });
    // A GM's own client answers the entry it wrote; a player's, that the GM has it.
    if (!res.ok) return null;
    return game.user.isGM ? res.value : { pending: true };
}

/** GM-side. The write itself, reached from the bridge or directly by a GM. */
export async function writeParkedMurder({ killerId, room = null, note = "" } = {}) {
    if (!game.user.isGM || !killerId) return null;
    // `approved: null` is undecided, and it is written explicitly: every field is
    // named, so a second declaration by the same killer replaces the first whole.
    // `eclipse` is the name of the Eclipse it was made in; the lights of another
    // Eclipse drop it unjudged.
    const entry = { room, note, at: Date.now(), approved: null, eclipse: eclipseId() };
    await pendingMurderStore.patch(killerId, entry);
    log(`Direct murder declared in the dark by ${game.actors.get(killerId)?.name ?? killerId}.`);

    await askGmToAllow(killerId, entry);
    return entry;
}

/**
 * Put the declaration to the GMs, now, while the Eclipse is still running.
 *
 * INTO THE GMs' LOG, NOT THE KILLER'S THREAD (E05, audit S11-02). It went into the
 * killer's own messenger thread, like every other ruling this module asks for, so
 * that the killer saw their own sentence quoted back. But a thread card's document
 * names the thread it belongs to (messenger.mjs), and every browser holds the
 * document: a new ruling card in one player's thread in the middle of an Eclipse
 * said who had declared something. `gmOnly` whispers it to the GMs, and its title -
 * the one line of it the document carries, as the popup's title - says nothing of
 * what is asked. Its buttons are wired in the log as in a thread (gm-bridge.mjs,
 * `registerGmBridge`); the killer hears the ruling, veiled, from
 * `ruleOnParkedMurder`.
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
            gmOnly: true,
            title: game.i18n.localize("DRPG.Action.murderRulingTitle"),
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
 * Refusing DROPS the row rather than marking it refused. A refusal is not
 * a thing the judging step needs to reason about - there is nothing to judge -
 * and leaving it in the store only creates a second way for a dead
 * declaration to be reconsidered at the lights.
 *
 * The action stays spent either way. That is the guide's rule for a direct
 * murder and it does not change because the GM said no: declaring is the cost.
 *
 * The killer's card is VEILED (E05, S11-02): addressed to them and the GMs it
 * named their actor as its speaker and their player among its readers, in a
 * document every browser holds, at the moment the GM ruled on a declaration.
 */
export async function ruleOnParkedMurder(killerId, allow) {
    if (!game.user.isGM || !killerId) return null;

    const parked = pendingMurders()[killerId];
    const killer = game.actors.get(killerId);
    if (!parked) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.murderNotParked"));
        return null;
    }

    if (allow) await pendingMurderStore.patch(killerId, { approved: true });
    else await pendingMurderStore.drop(killerId);

    if (killer) {
        await whisperToOwner(killer,
            `${cardHead({ action: game.i18n.localize("DRPG.Action.directMurder") })}<p>${
                allow
                    ? game.i18n.localize("DRPG.Action.murderApproved")
                    : `<span class="drpg-warning">${
                        game.i18n.localize("DRPG.Action.murderRefused")}</span>`}</p>`, { veiled: true });
    }

    log(`Direct murder by ${killer?.name ?? killerId} ${allow ? "allowed" : "refused"}.`);
    ui.notifications.info(game.i18n.format(
        allow ? "DRPG.Action.murderApprovedGm" : "DRPG.Action.murderRefusedGm",
        { name: killer?.name ?? "?" }));
    return allow;
}

/** Every declaration this GM's browser holds, of any Eclipse, dropped (the season reset). */
export async function clearParkedMurders() {
    if (!game.user.isGM) return;
    await pendingMurderStore.dropMany(Object.keys(pendingMurderStore.entries()));
}

/**
 * A world from before 1.2.64 holds the declarations in the world setting
 * `pendingMurders`, which every browser reads (audit S10-01). The clause
 * `liftPendingMurders` (migrate.mjs, since 1.2.64) runs this once, on the primary,
 * after the store holds the other GMs' copies (E05 C3).
 *
 * NOTHING LEAVES WORLD DATA BEFORE THE STORE HOLDS IT. Each declaration goes in weak
 * and fill-only, named for the Eclipse running now (a world updated between two
 * Eclipses has none running, and the next lights drop what it held unjudged, as
 * 1.2.63's season reset left it); a key is taken out of the world only once its row
 * reads back from storage, and the setting is written back whole with the rest.
 * Idempotent: a world already through this holds nothing.
 *
 * @returns {Promise<null|{lifted: number, kept: number, emptied: boolean}>}
 */
export async function liftPendingMurders() {
    if (!isPrimaryGm()) return null;
    if (await pendingMurderStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the declarations did not arrive; the next load tries again");
    }
    const old = game.settings.get(MODULE_ID, SETTINGS.legacyPendingMurders) ?? {};
    const eclipse = eclipseId();
    const rows = {};
    for (const [killerId, entry] of Object.entries(old)) {
        if (!killerId || !entry || typeof entry !== "object") continue;
        rows[killerId] = { room: entry.room ?? null, note: entry.note ?? "", at: entry.at ?? null, approved: entry.approved ?? null, eclipse };
    }
    if (!Object.keys(old).length) return null;
    if (Object.keys(rows).length) {
        await pendingMurderStore.patchMany(rows, { weak: true, fillOnly: true });
        await pendingMurderStore.idle();
    }
    const next = { ...old };
    let lifted = 0, kept = 0;
    for (const killerId of Object.keys(old)) {
        if (!rows[killerId]) {
            // Not a declaration at all: nothing to keep, and nothing a GM needs.
            delete next[killerId];
            continue;
        }
        if (pendingMurderStore.persisted(killerId)) {
            delete next[killerId];
            lifted++;
        } else kept++;
    }
    if (kept) warn(`Declarations in the dark: ${kept} stayed in world data, because the GM store did not read them back.`);
    if (Object.keys(next).length !== Object.keys(old).length) await game.settings.set(MODULE_ID, SETTINGS.legacyPendingMurders, next);
    const left = Object.keys(game.settings.get(MODULE_ID, SETTINGS.legacyPendingMurders) ?? {}).length;
    if (lifted) log(`Lifted ${lifted} declaration(s) made in the dark out of world data; ${left} left.`);
    return { lifted, kept, emptied: left === 0 };
}

/**
 * The lights come up: judge every declaration made in the Eclipse `id` - the one
 * `endEclipse` is ending, named before the clock moved.
 *
 * The condition is the guide's and is read now, off the final placement - one
 * other character in the killer's room, and that person is the victim. Anything
 * else is a failed attempt: nobody there to kill, or somebody there to see it.
 *
 * Only the FIRST successful declaration opens an incident. Two killings at once
 * is not something this engine models - `murderState` is a single incident -
 * and the honest thing is to say so to the second killer rather than to drop
 * their attempt silently.
 *
 * AND NOTHING OPENS WITHOUT THE GM. The room condition is the guide's and the
 * module can read it; whether this killing happens at this table tonight is not
 * a thing a rule can answer. Most declarations are already ruled on from the
 * card posted when they were parked - see `askGmToAllow` - and this is the
 * backstop for the ones that are not, asked at the one moment the question is
 * fully formed: the killer, the victim, the room, and the killer's own sentence
 * about what they are doing.
 *
 * EVERY ROW GOES, and another Eclipse's goes unjudged (E05): a declaration the
 * lights of its own Eclipse never reached - that Eclipse ended by a season reset, or
 * on a GM who did not hold it yet - is not an attempt at this Eclipse's placement.
 * Asked once the store holds the other GMs' copies, so a declaration parked through
 * the primary is judged by whichever GM ends the Eclipse.
 */
async function judgePendingMurders(id) {
    if (!game.user.isGM) return;

    await pendingMurderStore.whenHydrated();
    const held = Object.keys(pendingMurderStore.entries());
    const all = pendingMurders(id);
    const ids = Object.keys(all);
    if (!held.length) return;
    await pendingMurderStore.dropMany(held);
    if (held.length > ids.length) log(`Dropped ${held.length - ids.length} declaration(s) made in another Eclipse, unjudged.`);
    if (!ids.length) return;

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

        // Veiled, as the ruling is (E05, S11-02): the document would name the killer's
        // actor and their player at the moment the lights judged them.
        const say = async (line, cls = "") => {
            await whisperToOwner(killer,
                `${cardHead({ action: game.i18n.localize("DRPG.Action.directMurder") })}<p>${
                    cls ? `<span class="${cls}">${line}</span>` : line}</p>`, { veiled: true });
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
                room: foundry.utils.escapeHTML(room ?? "-"),
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
                room: foundry.utils.escapeHTML(room ?? "-")
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
 * Closing the window is a refusal. There is no third answer here - the
 * incident either opens now or it does not - and a dialog dismissed with the
 * escape key must not open one.
 */
async function askAtTheLights(killer, victim, room, parked) {
    try {
        return Boolean(await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Action.murderOpensTitle") },
            content: dialogContent(`<div>
                <p>${game.i18n.format("DRPG.Action.murderAsk", {
                    killer: esc(killer.name), victim: esc(victim.name), room: esc(room ?? "-")
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
 *              never read as finished - the GM was waiting on tokens that were
 *              never going to move.
 *
 * A Monocub stays: they are dead, but they are back on the board and they do
 * cross rooms. Flags are read directly rather than through chapter.mjs and
 * monocub.mjs, matching how actions.mjs and voice.mjs ask the same question -
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
 * rooms actually connected to the one you are leaving - the guide's "2
 * connected rooms", not two arbitrary hops.
 */
export async function judgeEclipseCrossing(actor, from, to) {
    if (!isEclipse()) return true;

    /*
     * A free-placement Eclipse (ECLIPSE_FREE_PLACEMENT) is "pick any room to begin in": no budget and
     * no adjacency. Both checks below are skipped rather than given a very large
     * number, because the rule is not "many crossings" - it is that you are
     * placing a token, not walking a route.
     *
     * READ OFF THE ALLOWANCE, NOT OFF THE CALENDAR (audit A2). It used to ask
     * `isFreePlacement()`, which answers about the time of day alone - so a
     * darkened free-placement Eclipse skipped every check here while
     * `eclipseAllowance()` was telling the sheet, the placement table and the
     * announcement that two crossings were all anybody had. `freeBecomes` in
     * OVERFLOW was a number nothing enforced. Asking the allowance is asking
     * the same question the rest of the file already asks, and `null` still
     * means what it always meant.
     */
    const allowance = eclipseAllowance();
    const free = allowance === null;

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
                // The same sentence the veto uses, and it names only rooms the
                // viewer has been in - `crossingRefused` in movement.mjs.
                ui.notifications.warn(game.i18n.format("DRPG.Move.notConnectedShort", { from, to }));
                return false;
            }
        }
    }

    /*
     * THE COUNT AND THE CARD ARE THE GM'S (E05, 26.09.2026; audit S10-39, S07-46).
     *
     * The crossing is counted on the primary GM's client, which judges the allowance
     * again - until 1.2.64 only this client judged it, and the count was a world
     * setting any browser could read. A crossing the GM finds beyond the allowance is
     * refused (`nothingLeft`) and sent back; one no GM answered stands and is not
     * counted, as it did (E31). The card that tells the owner the room they walked
     * into is posted by the GM too: posted here, its document named this character as
     * the speaker and this player as the author and the reader, in every browser.
     */
    return (await recordMove(actor, to)) !== false;
}

/**
 * Count a crossing: on a player's client through the GM, on a GM's here.
 *
 * @returns {Promise<boolean|null>} true counted; false refused by the GM's count (the
 *   crossing goes back); null not answered, so neither counted nor refused.
 */
async function recordMove(actor, to = null) {
    if (!game.user.isGM) {
        const { requestEclipseMove } = await import("./gm-bridge.mjs");
        const res = await requestEclipseMove(actor.id);
        if (res.ok) return true;
        return res.refused && res.reason === "nothingLeft" ? false : null;
    }
    const out = await applyRecordedMove(actor.id, { to });
    if (out?.refused) return false;
    return out ? true : null;
}

/**
 * Count a crossing, GM side: the bridge's `eclipse.move` for a player's client, and a
 * GM's own crossing. The allowance is judged here (layer one, E05): a crossing beyond
 * it is refused with the sentence `nothingLeft` stands for, and counts nothing. A
 * counted crossing is told to its owner by a veiled card this client posts - to the
 * owner only, no GM copy, on purpose: an Eclipse is everybody crossing the map in the
 * dark, and a copy of every crossing on the GM's screen was a running commentary on
 * exactly the thing the phase hides; the GM who wants the answer opens the placement
 * table. Then the owner is sent their copy of the count.
 *
 * `to` is the room walked into, as the mover's client saw it; a request through the
 * bridge carries no room, and the card names where the GM's client stands the token.
 *
 * @returns {Promise<null|{refused: string}|{used: number, left: number|null}>}
 */
export async function applyRecordedMove(actorId, { to = null } = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId);
    const id = eclipseId();
    if (!actor || !id) return null;
    const allowance = eclipseAllowance();
    const before = eclipseMovesUsed(actorId);
    if (allowance !== null && before >= allowance) return { refused: "no crossings left this Eclipse" };
    const used = before + 1;
    await eclipseMoveStore.patch(actorId, { used, eclipse: id });

    // A free-placement Eclipse is still counted: the placement table reads it to see
    // who has put a token down. The ALLOWANCE, not the constant: under a darkening
    // the two crossings are worth one, and this card was the one place still counting
    // down from two - so a player was told "1 left" by the same window that had just
    // refused them.
    const room = foundry.utils.escapeHTML(to ?? roomOfActor(actor) ?? "-");
    await whisperToOwnerOnly(actor, `${cardHead({ action: eclipseLabel(), room: to ?? roomOfActor(actor) })}<p>${
        allowance === null
            ? game.i18n.format("DRPG.Eclipse.movedFree", { room })
            : plural("DRPG.Eclipse.moved", { room, left: Math.max(0, allowance - used) }, "left")
    }</p>`, { veiled: true });

    for (const userId of ownerIdsOf(actor)) sendMovesTo(userId);
    return { used, left: allowance === null ? null : Math.max(0, allowance - used) };
}

/* ==========================================================================
 * AN OWNER'S COPY OF THE CROSSINGS (E05)
 * --------------------------------------------------------------------------
 * A player's sheet, status panel and veto read how many crossings their own
 * characters have used, and the count is the GMs' store: so each owner holds a
 * copy of their own characters' rows (gm-stores.mjs `eclipseMoveCopy`), sent by
 * the primary GM when a crossing is counted, and when the owner asks - at load,
 * and when a primary GM's world has loaded (gm-bridge.mjs's "a GM is listening",
 * `drpgPrimaryReady`). Asking is the owner's; answering is the primary's alone,
 * about the asker's own characters, found from Foundry's `senderId`; the copy is
 * taken only from a GM, and only for a character this user owns.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_MOVES = "eclipse.moves";
const ACTION_MOVES_ASK = "eclipse.movesAsk";

/**
 * GM: one user's own characters' crossings, and only those, with a stamp per character
 * they own - the newest decision about its row (`newest`: a count, or a reset's cut), 0 for
 * one this browser never held, which takes nothing away on the owner's side (`offersCombine`).
 */
export function movesFor(userId) {
    const user = game.users.get(userId);
    const moves = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { moves, stamps };
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        stamps[actor.id] = eclipseMoveStore.newest(actor.id);
        const row = eclipseMoveStore.get(actor.id);
        if (row) moves[actor.id] = { used: Math.max(0, Number(row.used) || 0), eclipse: row.eclipse ?? null };
    }
    return { moves, stamps };
}

/**
 * Primary GM: send one user their crossings (`movesFor`). Addressed, and only while they
 * are here; nothing while the suite holds the stores or stands in another world
 * (`gmStoresQuiet`). Answers whether it sent.
 */
export function sendMovesTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { moves, stamps } = movesFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_MOVES, userId, moves, stamps }, { recipients: [userId] });
    return true;
}

/**
 * After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their
 * crossings again, with their stamps - a copy that holds the same changes nothing. Nothing
 * while the suite holds the stores or stands in another world. Answers how many were sent.
 */
export async function retellMoves() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && sendMovesTo(user.id)) sent++;
    }
    return sent;
}

/** Owner: take the primary's answer where it is newer (`eclipseMoveCopy`), for this user's own characters only. */
export async function receiveMoves(moves, stamps) {
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(s) || 0;
        const row = moves?.[actorId];
        if (row && typeof row === "object") {
            mine[actorId] = { used: Math.max(0, Math.trunc(Number(row.used) || 0)), eclipse: typeof row.eclipse === "string" ? row.eclipse : null };
        }
    }
    return eclipseMoveCopy.receive(mine, own);
}

/** Owner: ask the primary for this user's crossings, while an Eclipse runs. */
function askForMoves(primary = primaryGmId()) {
    if (!primary || game.user.isGM || !isEclipse()) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_MOVES_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this Eclipse's crossings", err);
    }
}

function onMovesSocket(payload, senderId) {
    if (payload?.action === ACTION_MOVES_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        // Asked while the suite holds the stores: answered once it lets them go (as the offers are).
        whenGmStoresAudible().then(() => sendMovesTo(sender.id)).catch(err => error("Could not answer an owner's crossings", err));
        return;
    }
    if (payload?.action !== ACTION_MOVES || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another their count.
    if (!replyForMe(payload, senderId)) return;
    receiveMoves(payload.moves, payload.stamps).catch(err => error("Could not keep this Eclipse's crossings", err));
}

/** At ready: the copy's listener on every client, and an owner's first ask. */
function registerMovesCopy() {
    game.socket.on(SOCKET_EVENT, onMovesSocket);
    if (game.user.isGM) return;
    askForMoves();
    Hooks.on("drpgPrimaryReady", primary => askForMoves(primary));
}

/**
 * A world from before 1.2.64 holds the crossings in the world setting `eclipseMoves`,
 * which every browser reads (audit S10-39). The clause `liftEclipseMoves` (migrate.mjs,
 * since 1.2.64) runs this once, on the primary, after the store holds the other GMs'
 * copies (E05 C4).
 *
 * Only while an Eclipse runs: a count outside one is the last Eclipse's, which 1.2.63
 * cleared at its end and nothing reads, so it is taken out with no row. During one, each
 * count goes in weak and fill-only, named for the running Eclipse - a crossing a GM has
 * counted since the update keeps its count - and leaves the world only once its row
 * reads back from storage; then each owner is sent their copy. Idempotent: a world
 * already through this holds nothing.
 *
 * @returns {Promise<null|{lifted: number, kept: number, emptied: boolean}>}
 */
export async function liftEclipseMoves() {
    if (!isPrimaryGm()) return null;
    if (await eclipseMoveStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the crossings did not arrive; the next load tries again");
    }
    const old = game.settings.get(MODULE_ID, SETTINGS.legacyEclipseMoves) ?? {};
    if (!Object.keys(old).length) return null;
    const id = eclipseId();
    const rows = {};
    if (id) {
        for (const [actorId, n] of Object.entries(old)) {
            const used = Math.trunc(Number(n));
            if (actorId && Number.isFinite(used) && used > 0) rows[actorId] = { used, eclipse: id };
        }
    }
    if (Object.keys(rows).length) {
        await eclipseMoveStore.patchMany(rows, { weak: true, fillOnly: true });
        await eclipseMoveStore.idle();
    }
    const next = { ...old };
    let lifted = 0, kept = 0;
    for (const actorId of Object.keys(old)) {
        if (!rows[actorId]) {
            delete next[actorId];
            continue;
        }
        if (eclipseMoveStore.persisted(actorId)) {
            delete next[actorId];
            lifted++;
        } else kept++;
    }
    if (kept) warn(`Eclipse crossings: ${kept} stayed in world data, because the GM store did not read them back.`);
    if (Object.keys(next).length !== Object.keys(old).length) await game.settings.set(MODULE_ID, SETTINGS.legacyEclipseMoves, next);
    const left = Object.keys(game.settings.get(MODULE_ID, SETTINGS.legacyEclipseMoves) ?? {}).length;
    if (lifted) log(`Lifted ${lifted} Eclipse crossing count(s) out of world data; ${left} left.`);
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && Object.keys(rows).some(actorId => game.actors.get(actorId)?.testUserPermission?.(user, "OWNER"))) sendMovesTo(user.id);
    }
    return { lifted, kept, emptied: left === 0 };
}

/** Every crossing this GM's browser holds, of any Eclipse, taken away (the season reset). */
export async function clearEclipseMoves() {
    if (!game.user.isGM) return;
    if (isPrimaryGm()) await eclipseMoveStore.clear();
    else await eclipseMoveStore.dropMany(Object.keys(eclipseMoveStore.entries()));
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
        // The class alone. The HUD render and the visibility pass this also
        // ran are already on the sync bus beside it (`SYNC.clock`,
        // `SYNC.eclipse`), and on their own `ready`/`canvasReady` hooks for
        // load - so from here they were a second and a third copy (CORE-12).
        document.body.classList.toggle("drpg-eclipse", isEclipse());
    } catch (err) {
        error("Could not refresh for the Eclipse", err);
    }
}

/** Keep the body class in step on load and on every clock change; and, at ready, the crossings' copy. */
export function registerEclipse() {
    Hooks.once("ready", refreshEclipse);
    Hooks.on("drpgTimeOfDayChanged", refreshEclipse);
    Hooks.once("ready", registerMovesCopy);
}
