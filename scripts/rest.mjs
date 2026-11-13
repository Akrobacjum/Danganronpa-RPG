/**
 * Danganronpa RPG - Rest.
 * ---------------------------------------------------------------------------
 * Guide:
 *   Long rest  - 2 actions, pick 2 of Sleep / Meal / Breath, once per session,
 *                bedroom only.
 *   Short rest - 1 action, pick 1, once per time of day.
 *   "The pool of rooms allowing a short rest can be larger and depends entirely
 *    on the map prepared for the season. A long rest happens only in a bedroom."
 *
 * Which rooms permit which rest is therefore map data, not a fixed rule: rooms
 * are Scene Regions and the GM flags them. A region flagged for neither offers
 * no rest at all.
 */

import { MODULE_ID, FLAGS, REST, STARTING } from "./config.mjs";
import { actionsLeft, spendAction, canPayFor } from "./actions.mjs";
import { locateActor, roomsKnownToMe, sceneOfActor } from "./movement.mjs";
import { getClock } from "./clock.mjs";
import { whisperToOwner, log, error, plural, cardHead, forcedDeletion, isPrimaryGm } from "./utils.mjs";
// One room map for the whole module (audit C3): rooms.mjs, rooms only and on the scene it is
// handed (E12 C2a). The scene is the caller's, with no default (E12 C6): a rest is judged on
// the scene the character stands on, Room Setup writes the scene it shows. Until 1.2.74 these
// three defaulted to `workingScene()`, the camera. A room of several pieces allows a rest when
// any piece does (E12 fix r1-G1, 11.10.2026): until then `regionsByName` from vault.mjs read
// the last piece, and a piece drawn and marked after the room was set up took its rest away.
import { flagOver, piecesByName, roomFlag, writablePieces } from "./rooms.mjs";

import { drpgWindow } from "./ui-kit.mjs";
import { overflowBlocksShortRest } from "./overflow.mjs";

import { tipText } from "./ui-kit.mjs";

/** Flags set on a Scene Region. */
export const REST_FLAGS = {
    short: "restShort",
    long: "restLong"
};

/* ==========================================================================
 * WHERE
 * ========================================================================== */

/** Does this room allow the given kind of rest? */
export function roomAllows(room, kind, scene) {
    if (!room) return false;
    return Boolean(roomFlag(scene, room, kind === "long" ? REST_FLAGS.long : REST_FLAGS.short));
}

/** Rooms on this scene flagged for a kind of rest. */
export function restRooms(kind, scene) {
    return Array.from(piecesByName(scene).entries())
        .filter(([, pieces]) => flagOver(pieces, kind === "long" ? REST_FLAGS.long : REST_FLAGS.short))
        .map(([name]) => name)
        .sort();
}

/**
 * "Allowed in: ..." with only the rooms this viewer has found (E06 C11, audit S07-19).
 *
 * The Rest window and the refusal listed every rest room on the map, so a player who had
 * been in two rooms read the names of the rest off a warning - what the fog and the
 * refused crossing are careful never to say. Filtered by `roomsKnownToMe` (`null`, a GM's
 * or the Mastermind's, shows them all); a map whose rest rooms are all undiscovered says
 * so without naming one, and a map with none says what it always said. `key` is the
 * sentence the list goes into, `data` its other fields, `scene` the scene whose rest rooms
 * are listed (the character's) and whose found rooms filter them - the camera's did until
 * E12 fix r1-G4; `known` is a parameter for the suite, which runs on a GM's browser.
 *
 * THE REST'S NAME FROM `kind`, NOT ONLY FROM `data` (gaps, the owner's 12.11.2026): the Rest window's hints ask with no
 * `kind` in `data` (`restVariants`, whose "allowedIn" has none), and on a map with no rest room the fallback said "marked
 * for a  yet" / "oznaczony pod ." - now it names the rest by `kindLabel`, as the refusal's road does. R3980.
 */
export function restRoomsSentence(kind, key, data, scene, known = roomsKnownToMe(scene)) {
    const rooms = restRooms(kind, scene);
    const shown = known ? rooms.filter(room => known.has(room)) : rooms;
    if (shown.length) return game.i18n.format(key, { ...data, rooms: shown.join(", ") });
    return rooms.length
        ? game.i18n.localize("DRPG.Rest.noKnownRooms")
        : game.i18n.format("DRPG.Rest.noRooms", { kind: data?.kind ?? kindLabel(kind) });
}

/**
 * Mark or unmark a room. GM only. Every region of the name on the scene that can be a room is
 * written (E12 C2a; `writablePieces` since E12 fix r1-G1, never a Teleport's), marked or not:
 * Room Setup, which calls this, is where a named region is made a room.
 */
export async function setRestRoom(roomName, { short = null, long = null, scene = null } = {}) {
    if (!game.user.isGM) return null;

    const pieces = writablePieces(scene, roomName);
    const region = pieces.at(-1);
    if (!region) return null;

    const update = {};
    if (short !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.short}`] = short;
    if (long !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.long}`] = long;
    if (!Object.keys(update).length) return null;

    await scene.updateEmbeddedDocuments("Region", pieces.map(r => ({ _id: r.id, ...update })));
    return region;
}

/* ==========================================================================
 * HOW OFTEN
 * --------------------------------------------------------------------------
 * A short rest is once per time of day, a long rest once per session. Both are
 * recorded as the clock reading at the moment they were taken, so they expire on
 * their own when the clock moves rather than needing a reset pass.
 * ========================================================================== */

/**
 * The stamp that identifies "this rest, in this window" (read by the GMs' audit too: sheet-audit.mjs `restCovers`).
 *
 * THE CHAPTER IS IN IT (E17 C9, 26.10.2026; audit S07-23). It was `d${day}:${timeOfDay}` and `s${session}`: a
 * chapter's end sets the day back to 1 and may keep the session (chapter.mjs, its "next session" box), so a
 * character who rested on chapter 1's first morning was told "already taken" on chapter 2's, and a long rest
 * carried across the chapter's end (R1002). A stamp written before this is read as the current chapter's
 * (`legacyRestStamp`, E17 fix p2-G3), so a rest taken in the time of day the module was updated in is not taken twice.
 */
export function restStamp(kind, clock) {
    const chapter = `c${clock.chapter ?? 1}`;
    return kind === "long" ? `${chapter}s${clock.session}` : `${chapter}d${clock.day ?? 1}:${clock.timeOfDay}`;
}

function restsTaken(actor) {
    return actor?.getFlag(MODULE_ID, FLAGS.restsTaken) ?? {};
}

/**
 * Has this character already used up this kind of rest in the current window?
 * @returns {boolean}
 */
export function restSpent(actor, kind, clock = null) {
    const rules = REST[kind];
    if (!rules) return true;
    // A kind with no declared frequency is unlimited.
    if (!rules.perSession && !rules.perTimeOfDay) return false;

    const now = clock ?? currentClock();
    const taken = restsTaken(actor)[kind];
    return taken === restStamp(kind, now) || taken === legacyRestStamp(kind, now);
}

/**
 * THE STAMP AS IT WAS WRITTEN BEFORE E17 C9 (E17 fix p2-G3, 26.10.2026; the end review's E17p2-R11 and R8): no
 * chapter, `d${day}:${timeOfDay}` and `s${session}`. Read as the current chapter's, so a character who rested in the
 * time of day (or the session) the module was updated in is not given that rest a second time. What it costs: a stamp
 * of that shape from an earlier chapter, at the same day and time of day (or session) and never written over since,
 * reads as spent - the S07-23 refusal, once, for a character who has not rested since the update (sheet-audit.mjs
 * `restCovers` judges new writes by `restStamp` alone). Pure.
 */
export function legacyRestStamp(kind, clock) {
    return kind === "long" ? `s${clock.session}` : `d${clock.day ?? 1}:${clock.timeOfDay}`;
}

/**
 * THE OLD STAMPS, MIGRATED ONCE (E91 C8, 12.11.2026; the owner's deferred item D068; default, owner may revise). Pure:
 * of `rests` (a character's `restsTaken`), what a migration writes - `set`, the old-shape stamps (`legacyRestStamp`'s,
 * no chapter) of the window `clock` reads now, given that clock's chapter (`restStamp`), which is how they were read
 * until now; `drop`, every other old-shape stamp, which could only refuse a rest of an earlier chapter by mistake (the
 * cost `legacyRestStamp` names). A stamp with a chapter is left as it is.
 */
export function migratedRests(rests, clock) {
    const set = {}, drop = [];
    for (const [kind, taken] of Object.entries(rests ?? {})) {
        if (typeof taken !== "string" || /^c/.test(taken)) continue;
        if (taken === legacyRestStamp(kind, clock)) set[kind] = restStamp(kind, clock);
        else drop.push(kind);
    }
    return { set, drop };
}

/**
 * The migration step `chapterRestStamps` (migrate.mjs): every character's old rest stamps by `migratedRests` against the
 * clock now, on the primary GM, one update a character (a key dropped with `forcedDeletion`, else `unsetFlag` and the
 * stamps written again). Answers how many characters changed, or null for none.
 */
export async function migrateRestStamps({ actors = game.actors, clock = getClock() } = {}) {
    if (!isPrimaryGm()) return { notPrimary: true };
    let changed = 0;
    for (const actor of actors ?? []) {
        if (actor?.type !== "character") continue;
        const rests = restsTaken(actor);
        const { set, drop } = migratedRests(rests, clock);
        if (!Object.keys(set).length && !drop.length) continue;
        const gone = forcedDeletion();
        const path = `flags.${MODULE_ID}.${FLAGS.restsTaken}`;
        if (gone) {
            await actor.update({ ...Object.fromEntries(Object.entries(set).map(([k, v]) => [`${path}.${k}`, v])),
                ...Object.fromEntries(drop.map(k => [`${path}.${k}`, gone])) });
        } else {
            const kept = Object.fromEntries(Object.entries(rests).filter(([k]) => !drop.includes(k)));
            await actor.unsetFlag(MODULE_ID, FLAGS.restsTaken);
            await actor.setFlag(MODULE_ID, FLAGS.restsTaken, { ...kept, ...set });
        }
        changed++;
    }
    return changed ? { changed } : null;
}

/** The "used up" stamp for this rest, as a path of the one write that also carries its benefits. */
function restTakenUpdate(actor, kind, clock) {
    return { [`flags.${MODULE_ID}.${FLAGS.restsTaken}`]: { ...restsTaken(actor), [kind]: restStamp(kind, clock) } };
}

/**
 * The clock, through the one function that owns what it says.
 *
 * This used to read the setting itself and, on any failure, hand back a clock it
 * had invented on the spot: day 1, session 1, morning. That is not a fallback,
 * it is a lie with consequences - a rest is stamped with the day it was taken,
 * and a rest stamped day 1 on day six is a Long Rest the character can either
 * never take again or take twice, depending on which way the comparison falls.
 *
 * `getClock` merges `DEFAULT_CLOCK` over whatever is stored, so the defaults are
 * declared once, in settings.mjs, beside the setting they belong to. There were
 * three copies of "what the clock says when we cannot read it" in this module
 * and two of them were written from memory.
 */
function currentClock() {
    return getClock();
}

/**
 * The Rest window's two rows, each with its price and its reason for being unavailable - spent already, or not
 * allowed in this room. Both reasons used to be printed above a pair of buttons that stayed live regardless, so the
 * player could pick the one the list had just told them they could not have. Out of action-rest.mjs `performRest`
 * (E16 part 2 C4, 26.10.2026; audit S02-26), so the sheet's tile reads the same rows (action-facilities.mjs `facilitiesRows`).
 */
export function restVariants(actor) {
    const place = locateActor(actor);
    const room = place?.room ?? null;
    // Insomnia (E93 C6): the Despair Overflow's darkening that bars the Short rest this time of day; the Long stays.
    const sleepless = overflowBlocksShortRest();
    return ["short", "long"].map(kind => {
        const spent = restSpent(actor, kind);
        const allowed = roomAllows(room, kind, place?.scene);
        const barred = kind === "short" && sleepless;
        // Only the rest rooms this viewer has found (E06 C11) - `restRoomsSentence` - on the
        // character's scene, the school's for one with no token (E12 fix r1-G4).
        const elsewhere = restRoomsSentence(kind, "DRPG.Rest.allowedIn", {}, place?.scene ?? sceneOfActor(actor));
        return {
            value: kind,
            icon: kind === "long" ? "fa-bed" : "fa-mug-hot",
            label: game.i18n.localize(kind === "long" ? "DRPG.Rest.long" : "DRPG.Rest.short"),
            hint: `${plural("DRPG.Action.willCost",
                { n: REST[kind].actionCost, left: actionsLeft(actor) })} · ${
                allowed
                    ? game.i18n.format("DRPG.Rest.allowedHere", { room: room ?? "" })
                    : elsewhere}`,
            disabled: spent || !allowed || barred,
            why: barred ? game.i18n.localize("DRPG.Rest.insomnia") : spent
                ? game.i18n.localize(kind === "long"
                    ? "DRPG.Rest.alreadyThisSessionShort" : "DRPG.Rest.alreadyThisTimeOfDayShort")
                : elsewhere
        };
    });
}

/* ==========================================================================
 * RESTING
 * ========================================================================== */

/**
 * Take a rest.
 *
 * @param {Actor} actor
 * @param {"short"|"long"} kind
 * @param {object} [options]  All four are the Relief Hope Call and nothing else
 *   (E13). Each one SKIPS a gate rather than passing it: `takeRest` refuses with
 *   its own warning at three separate points, and a Call that "passed" them
 *   would show the player "you have already rested this time of day" and then
 *   hand their five Hope back - trap 99.
 * @param {boolean} [options.free]         costs no action
 * @param {boolean} [options.ignoreRoom]   no marked room required
 * @param {boolean} [options.ignoreLimit]  neither checks nor spends the once-per
 *   window allowance, so the ordinary Short Rest is still there afterwards
 * @param {boolean} [options.quiet]        no card of its own; the caller prints one
 */
export async function takeRest(actor, kind = "short", {
    free = false, ignoreRoom = false, ignoreLimit = false, quiet = false
} = {}) {
    try {
        const rules = REST[kind];
        if (!actor || !rules) return null;

        const clock = currentClock();
        // Insomnia bars the Short rest; a Relief's free rest (`ignoreLimit`, a Call paid in Hope) is not barred by it
        // (E93 C6; default taken, the owner to confirm).
        if (kind === "short" && !ignoreLimit && overflowBlocksShortRest()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Rest.insomnia"));
            return null;
        }
        if (!ignoreLimit && restSpent(actor, kind, clock)) {
            ui.notifications.warn(game.i18n.format(
                kind === "long" ? "DRPG.Rest.alreadyThisSession" : "DRPG.Rest.alreadyThisTimeOfDay",
                { kind: kindLabel(kind) }
            ));
            return null;
        }

        const place = locateActor(actor);
        const room = place?.room ?? null;
        if (!ignoreRoom && !roomAllows(room, kind, place?.scene)) {
            ui.notifications.warn(restRoomsSentence(kind, "DRPG.Rest.wrongRoom",
                { kind: kindLabel(kind), room: room ?? "-" }, place?.scene ?? sceneOfActor(actor)));
            return null;
        }

        const cost = free ? 0 : rules.actionCost;
        if (cost > 0 && !canPayFor(actor, cost)) {
            ui.notifications.warn(plural("DRPG.Actions.notEnough", {
                actor: actor.name, left: actionsLeft(actor), needed: cost
            }, "left"));
            return null;
        }

        // `false`, not null: a player who backed out is not a rest that failed,
        // and Relief refunds the two differently (review, 17.09).
        const picks = await choosePicks(kind, rules.picks, cost, { relief: free });
        if (!picks) return false;

        if (cost > 0 && !await spendAction(actor, cost)) return null;

        // The benefits and the "used up" stamp in ONE write (E29 C1, 05.10.2026). They
        // were two, benefits first, so a failed write could not leave the rest spent and
        // nothing restored - a long rest is once per session. One write keeps that and
        // gives the GMs' side one change to judge with its stamp beside it: a Rest's gains
        // are covered by the stamp moving (the plan's 2.5), and as two writes the gains
        // arrived with nothing to say which Rest they were.
        // Relief does not use the allowance up, which is half of what it buys:
        // the Short Rest this character had before it is still there.
        const applied = await applyRest(actor, kind, picks, { stamp: ignoreLimit ? null : clock, relief: free });

        if (!quiet) {
            await whisperToOwner(actor, `${cardHead({ action: kindLabel(kind), room })}
                <ul>${applied.map(a => `<li>${foundry.utils.escapeHTML(a)}</li>`).join("")}</ul>`);
        }

        log(`${actor.name} took a ${kind} rest in ${room}: ${picks.join(", ")}`);
        Hooks.callAll("drpgRested", { actor, kind, picks, room });
        return { kind, picks, room, applied };
    } catch (err) {
        error("Rest failed", err);
        return null;
    }
}

/**
 * Ask which benefits to take. A long rest takes two, a short one takes one. `cost` is the actions the rest spends after
 * this window (0 for a Relief's free rest), and Do it's tooltip says it (REVIEW-102 T8: the button pays a price).
 * `relief`: a Relief's free rest, whose Breath is greyed (`BREATH_REFUSED`).
 */
async function choosePicks(kind, count, cost = 0, { relief = false } = {}) {
    /*
     * THE COUNT IS ENFORCED IN THE WINDOW, NOT AFTER IT.
     *
     * A Short Rest takes one of the three and a Long Rest takes two, and the
     * window used to let you tick all three and find out on the way past: the
     * check below fired, warned, and closed the dialog, sending the player back
     * to the start of an action they had already paid for.
     *
     * ONE PICK IS A RADIO GROUP. Not a checkbox that un-ticks its neighbour -
     * a radio, because that is what a browser already knows how to be, and
     * because a player who has used a radio button before knows what it will do
     * before they touch it. Two picks stay checkboxes and are capped live, with
     * the confirm button shut until exactly two are on.
     *
     * The check after the button STAYS. It is the authority; this is the
     * interface agreeing with it in advance.
     */
    const single = count === 1;
    // Breath is Hope, and under the Despair darkening no Hope is earned - so it
    // is offered greyed with the reason rather than taken and turned into
    // nothing (CALL-05).
    // And a Relief's rest greys it with its own reason (`BREATH_REFUSED`, 1.2.112).
    const { overflowBlocksHope } = await import("./overflow.mjs");
    const noBreath = relief ? "relief" : overflowBlocksHope() ? "overflow" : null;
    const options = Object.entries(REST.options)
        .map(([key, opt]) => {
            const off = key === "breath" ? noBreath : null;
            return `<label class="drpg-rest-option"${off
                ? ` title="${foundry.utils.escapeHTML(game.i18n.localize(off === "overflow" ? "DRPG.Overflow.noHopeNow" : BREATH_REFUSED.relief))}"` : ""}>
                <input type="${single ? "radio" : "checkbox"}" name="pick" value="${key}"${off ? " disabled data-drpg-blocked" : ""} />
                <span><strong>${opt.label}</strong> - ${off
                    ? game.i18n.localize(BREATH_REFUSED[off])
                    : (kind === "long" ? opt.long : opt.short)}</span>
            </label>`;
        }).join("");

    // On the kit's frame (E21 C5a).
    const picks = await drpgWindow({
        title: kindLabel(kind),
        classes: ["drpg-panel", "drpg-rest"],
        body: `<form>
            <p>${game.i18n.format("DRPG.Rest.choose", { n: count })}</p>
            ${options}
        </form>`,
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root) return;
            const boxes = Array.from(root.querySelectorAll("[name=pick]"));
            const confirm = root.querySelector('button[data-action="ok"]');
            const sync = () => {
                const on = boxes.filter(b => b.checked);
                // Cap, so the third tick cannot happen at all - a box that
                // refuses the click is clearer than one that accepts it and is
                // told off later. Radios cap themselves.
                // A blocked pick stays blocked: the cap below rewrote `disabled`
                // on every box and handed Breath back to a Long Rest under the
                // Despair darkening (review of CALL-05).
                for (const b of boxes) {
                    const blocked = "drpgBlocked" in b.dataset;
                    if (blocked) b.disabled = true;
                    else if (!single) b.disabled = !b.checked && on.length >= count;
                }
                if (confirm) confirm.disabled = on.length !== count;
            };
            for (const b of boxes) b.addEventListener("change", sync);
            sync();
        },
        footer: {
            primary: {
                tooltip: cost > 0 ? plural("DRPG.Tips.Actions.doItCostTooltip", { n: cost }) : tipText("DRPG.Tips.Actions.doItTooltip"),
                action: "ok",
                label: game.i18n.localize("DRPG.Action.restNow"),
                callback: (e, b, d) => Array.from(d.element.querySelectorAll("[name=pick]:checked")).map(i => i.value)
            },
            close: "cancel"
        },
        rejectClose: false
    });

    if (!picks || picks === "cancel") return null;

    // The authority, and it should now be unreachable from the window above.
    // Kept because "should be unreachable" is not a guarantee: a template
    // change, a UI module rewrapping the dialog, or a render that never fired
    // would all quietly take the cap away and leave nothing behind it.
    if (picks.length !== count) {
        ui.notifications.warn(game.i18n.format("DRPG.Rest.pickExactly", { n: count }));
        return null;
    }
    return picks;
}

/*
 * WHY BREATH IS NOT OFFERED, BY CASE (1.2.112). Under the Despair darkening no Hope is earned (CALL-05). And a Relief's
 * rest gives none (the owner's decision of 13.11.2026): Relief costs 4 Hope (config.mjs `HOPE_CALLS.relief`), and its
 * Breath gave back 1 - three Hope lost for nothing, a pick no one would make on purpose. Greyed with the reason in the
 * picker (`choosePicks`) and refused by `applyRest`, and the GMs' audit covers no Hope on a Relief's rest (sheet-audit.mjs
 * `restCovers`). Tier 2's "Relief's rest offers Breath greyed ..." and "a Relief rest's Hope is put back ..." read them.
 * Written out, so each key is a literal the lang check can find.
 */
const BREATH_REFUSED = Object.freeze({ overflow: "DRPG.Overflow.noHopeNow", relief: "DRPG.Rest.reliefNoBreath" });

/**
 * Apply the chosen benefits.
 *
 * Health and Sanity are reverse resources - `value` counts marks upward - so
 * recovering means subtracting. A long rest clears the track; a short rest
 * clears half, rounded up in the character's favour.
 */
async function applyRest(actor, kind, picks, { stamp = null, relief = false } = {}) {
    const full = kind === "long";
    const update = stamp ? restTakenUpdate(actor, kind, stamp) : {};
    const applied = [];
    const { overflowBlocksHope } = await import("./overflow.mjs");
    const hopeBlocked = overflowBlocksHope();
    const { trustedWrite } = await import("./resource-guard.mjs");

    // From the means the GMs hold on a GM's client - a rest a GM gives, a Relief bought there - in one step
    // (sheet-audit.mjs `meansWrite`, E29 fix r2-H24): a console's raised Hope, not put back yet, was rested on top
    // there. A player's own rest reads its sheet, as before.
    const { meansWrite } = await import("./sheet-audit.mjs");
    return meansWrite(actor, async (held, maxOf) => {
        for (const pick of picks) {
            const opt = REST.options[pick];

            if (pick === "sleep") {
                const marks = held.hitPoints;
                const healed = full ? marks : Math.ceil(marks / 2);
                update["system.resources.hitPoints.value"] = marks - healed;
                applied.push(`${opt.label}: ${healed} Health recovered`);
            }

            if (pick === "meal") {
                const marks = held.stress;
                const cleared = full ? marks : Math.ceil(marks / 2);
                update["system.resources.stress.value"] = marks - cleared;
                applied.push(`${opt.label}: ${cleared} Sanity cleared`);
            }

            if (pick === "breath" && (relief || hopeBlocked)) {
                // The picker greys Breath under the Despair darkening (CALL-05) and on a
                // Relief's rest (1.2.112); this is the authority for a pick that got past it.
                applied.push(`${opt.label}: ${game.i18n.localize(relief ? BREATH_REFUSED.relief : BREATH_REFUSED.overflow)}`);
            } else if (pick === "breath") {
                const gain = full ? 2 : 1;
                const max = maxOf("hope") || STARTING.hopeMax;
                const next = Math.min(max, held.hope + gain);
                update["system.resources.hope.value"] = next;
                applied.push(`${opt.label}: +${gain} Hope`);
            }
        }

        // Through the module's road: Health and Sanity are in the courtesy guard's
        // `GUARDED`, so a plain `actor.update()` from a player's browser would lose them.
        // `ref` "relief" is a Relief's free rest, which the GMs' side covers by that Call's
        // payment rather than by the room, the allowance and the action.
        if (Object.keys(update).length) await trustedWrite(actor, update, { reason: "rest", ref: relief ? "relief" : null });
        return applied;
    });
}

function kindLabel(kind) {
    return game.i18n.localize(kind === "long" ? "DRPG.Rest.long" : "DRPG.Rest.short");
}
