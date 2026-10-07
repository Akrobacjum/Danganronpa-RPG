/**
 * Danganronpa RPG - the murder engine's facade, with the murder window and the
 * GM's tracker.
 * ---------------------------------------------------------------------------
 * THE FACADE (E34, 1.2.70). The incident's record and its roads - the world
 * half and the cast, the copies of the cast each participant is sent, the queue
 * every write runs in and the one write of both halves, the cast's socket, who
 * is in it, the betrayal window that write arms, the opening's notices, the
 * deaths a player may know and their socket, the Blackened register, and the cast
 * put back by hand or lifted out of world data - moved to incident-store.mjs, and
 * the rules of the three stages, with this header's account of them, to
 * murder-rules.mjs, each by a pure move that `node tools/moved-only.mjs` proves.
 * This file keeps its name and every name it exported - thirty-three of
 * incident-store.mjs's and thirty-one of murder-rules.mjs's are re-exported under
 * the imports - so every importer still imports murder.mjs, and neither new file
 * imports it. What stays is the murder window (`openMurderDialog`) and the tracker
 * (`openIncidentTracker`, `incidentTrackerHtml`), which read five names of the
 * rules; new code that reads or writes the cast, the world half or the queue, or
 * sends or takes the cast or the deaths, goes into incident-store.mjs, and a rule
 * of the incident into murder-rules.mjs.
 */

import { CRISIS_ACTIONS, RESOLUTION_STRESS_COST, TIMING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { resourceValue, resourceMax, marksOf, reserveNote } from "./character.mjs";
import { keepLive } from "./live.mjs";
import { dialogContent, tableDialog, error, plural, esc } from "./utils.mjs";
import { murderState, killerIds } from "./incident-store.mjs";
import { openMurder, passTurn, endMurder, openingInvited, rollOpening } from "./murder-rules.mjs";
export {
    PUBLIC_INCIDENT, splitIncident, murderState, castFieldsToWrite, incidentAudienceIds, castFor, castPacket,
    retellCast, clearBetrayalOffer, swungWeaponOf, sideOf, killerIds, participantIds, incidentKnowers, knowsOfDeath,
    deathsFor, sendDeathsTo, tellDeaths, retellDeaths, receiveDeaths, tellFinder, enterCast, liftIncidentSecrets,
    liftIncidentMethod, liftIncidentFight, blackenedIds, trialBlackenedIds, countsAtTrial, whenTrialReadable,
    trialBlackenedActors, leftABody, blackenedWrites, clearBlackened
} from "./incident-store.mjs";
export {
    isTheirTurn, crisisTileLabel, freeResolutionFor, crisisSituational, availableCrisisActions, atNight,
    freshIncidentState, openMurder, resolveKillerOpening, resolveVictimOpening, crisisRefusal, crisisUndoRefusal,
    crisisVariant, takeCrisisAction, resolveCrisisAction, refOf, crisisKilled, beginResolution, spendFreeCleanup,
    passTurn, registerMurder, thirdPartyEnters, endMurder, betrayalTarget, betrayAsPlayer, openParkedBetrayal,
    takeDeclaredBetrayal, rollOpening, closeOpeningRoll, throwOpeningRoll, resolveOpening
} from "./murder-rules.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * THE GM'S TRACKER
 * ========================================================================== */

/**
 * Open a murder from the GM panel, or from a trap's ruling card (messenger-app.mjs
 * `ruleFireTrap`), which names the builder (`killerId`) and the student the trap read
 * (`victimId`) and ticks `indirect`.
 */
export async function openMurderDialog({ killerId = null, victimId = null, indirect = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (murderState()) return openIncidentTracker();

    /*
     * THE ECLIPSE IS ASKED HERE, NOT AT CONFIRM (F11).
     *
     * `openMurder` refuses during placement and always has, but it is the last
     * line of the form: the GM picked a killer, a victim and a checkbox, pressed
     * "Open it", and was told the Eclipse is a placement window - then told a
     * second time that no murder is running, because the tracker was opened
     * whether or not anything had opened. The GM panel's tile has been greyed with
     * a tooltip for exactly this reason; the road that was left is the trap card's
     * "fire the trap" button, which prefills the killer and cannot grey itself
     * while a chat card sits in the log.
     *
     * AFTER the running-incident shortcut above, on purpose. That branch is not
     * about opening anything - a GM who presses this mid-incident wants the
     * tracker, and the Eclipse has no opinion about a fight already in progress.
     * And before `livingStudents()`, so nothing is read for a window that is not
     * going to open.
     *
     * Returning null is what keeps the trap's ruling card usable: `fireTrap`
     * settles the card only on a truthy answer, so the button stays there for when
     * the lights come up.
     */
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.murderWindowLocked"));
        return null;
    }

    const { livingStudentsForGm } = await import("./chapter.mjs");
    const alive = livingStudentsForGm();
    // One is enough, now that a student can be both sides of it. The old floor
    // of two was the last place the engine still assumed a murder needs two
    // people - and the case it locked out, a single survivor with nothing left
    // to do, is the one where this ending is likeliest.
    if (!alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.needOne"));
        return null;
    }

    const optionsFor = selected => alive
        .map(a => `<option value="${a.id}"${a.id === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    /*
     * THE VICTIM DOES NOT START AS THE KILLER (D-F5-1).
     *
     * Both dropdowns are built from the same list of the living, and a select
     * with nothing marked shows its first option - so the window opened
     * proposing that somebody kill themselves.
     *
     * That pair is now LEGAL (see `openMurder`), which changes what this
     * defence is for rather than removing the need for it. It is no longer
     * about heading off a refusal; it is about not proposing one of the two
     * heaviest things at this table as the value nobody touched. A GM who wants
     * it picks it, and the note below says out loud what they have picked.
     *
     * The old render hook that MOVED the victim whenever the killer landed on
     * them is gone with the refusal: it would now silently undo a deliberate
     * choice, and it fired on exactly the gesture a GM reaching for this ending
     * is most likely to make.
     */
    /*
     * WHO THE CALLER NAMED, WHEN THEY ARE AMONG THE LIVING (E32+E07 C14, 03.10.2026; audit
     * S11-20). A trap's card has carried the student it read since it was built
     * (traps.mjs `alert`, `data.victim`), and `ruleFireTrap` passed the builder alone - so
     * the victim's dropdown showed the first living student who was not the builder, OK is
     * the default, and Enter opened the incident on somebody who never walked into the trap,
     * their opening roll and all. And a builder who has died since was not in the killer's
     * list: a select with no option marked shows its first, so the window proposed another
     * student as the killer without a word - and, since the victim was then chosen against
     * the dead builder's id, could propose the first living student in both seats (read off
     * the code; the suite's dead-builder test reads the seats). Now the
     * victim is the one the card names, and a named killer who is not among the living is
     * said in the window (`killerNotAlive`) while the list shows somebody else.
     */
    const living = id => Boolean(id) && alive.some(a => a.id === id);
    const gone = killerId && !living(killerId) ? game.actors.get(killerId)?.name ?? "?" : null;
    const namedVictim = living(victimId) ? victimId : null;
    const defaultKiller = (living(killerId) ? killerId : null)
        ?? (alive.find(a => a.id !== namedVictim) ?? alive[0])?.id ?? null;
    const defaultVictim = namedVictim ?? (alive.find(a => a.id !== defaultKiller) ?? alive[0])?.id ?? null;

    const options = optionsFor(defaultVictim);

    // Which killers have a finished trap waiting. The checkbox follows the
    // dropdown from this, so "indirect" stops being a box a GM has to remember
    // to tick - or remember NOT to tick on a murder that had no project.
    const { allProjects, isComplete } = await import("./projects.mjs");
    const armed = new Set(allProjects()
        // `isComplete` rather than `current >= start` written out again: the
        // hand-rolled version was missing its `start > 0` half, so an indirect
        // murder countdown with no target at all counted as a finished trap.
        .filter(p => p.indirectMurder && isComplete(p))
        .map(p => p.killerId ?? null)
        .filter(Boolean));

    /*
     * THE OPENING'S STATISTIC, PICKED HERE (E32+E07 C14, 03.10.2026; the owner's Q4 as
     * corrected on 28.09). Both openings list two traits and the GM picks one; a murder
     * opened from this window asked it as a second window once the first had closed
     * (`openingTraitFor`). The select lists the traits of the side that rolls - the killer's
     * for a direct murder, the victim's for a trap - with that character's value, as the
     * GM's own window prints them, and follows the dropdowns and the box; what it holds goes
     * to `openMurder` as `openingTrait`, which checks it against the side once more.
     */
    const { listedTraits, traitWithValue } = await import("./trait-ruling.mjs");
    const { locateActor } = await import("./movement.mjs");
    const statisticOptions = (side, rollerId, selected = null) => {
        const traits = listedTraits({ kind: "opening", key: side });
        const roller = game.actors.get(rollerId ?? "");
        // With nothing kept, the first is marked, as the GM's own window marks its first
        // button (trait-ruling.mjs) - a default shown to the GM, not a trait taken (R213).
        const kept = traits.includes(selected);
        return traits.map((t, i) => `<option value="${t}"${(kept ? t === selected : i === 0) ? " selected" : ""}>${
            esc(traitWithValue(roller, t))}</option>`).join("");
    };
    // What the box shows at first, as `sync` below settles it: one name in both seats is direct.
    const trapFirst = (indirect || armed.has(defaultKiller)) && defaultKiller !== defaultVictim;

    /*
     * TWO ROOMS, SAID BEFORE CONFIRM (E32+E07 C14, 03.10.2026; audit S04-43). A direct
     * murder is face to face, and nothing read where the two stood: in the audit's
     * screenshots of one the victim's clock said DINNER HALL and the killer's MAIN HALL (the
     * audit allowed that its own script may have stood them there; the window said nothing
     * either way). Said, not refused - a GM may have moved the fiction ahead of the tokens.
     * Read off the scene documents (`locateActor`, as `sameRoom` does) rather than
     * `roomOfActor`, which reads the canvas and answers "no room" for both when the GM is
     * looking at another scene.
     * Nothing is said when either stands in no named room: that is not a measurement.
     */
    const roomsApart = (killer, victim) => {
        const [k, v] = [killer, victim].map(id => locateActor(game.actors.get(id)));
        if (!k?.room || !v?.room) return null;
        if (k.scene?.id === v.scene?.id && k.room === v.room) return null;
        const named = at => k.room === v.room ? `${at.room} (${at.scene?.name ?? "?"})` : at.room;
        return { killerRoom: named(k), victimRoom: named(v) };
    };

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.openTitle") },
        // Named so it can be addressed - the diagnostics count it and the suite
        // closes it - and deliberately WITHOUT an `alreadyOpen` guard, exactly
        // like the incident tracker's own class.
        classes: ["drpg-panel", "drpg-window-murder"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Murder.openIntro")}</p>
            ${gone ? `<p class="notes drpg-warning" data-drpg-killer-gone>${
                game.i18n.format("DRPG.Murder.killerNotAlive", { name: esc(gone) })}</p>` : ""}
            <label>${game.i18n.localize("DRPG.Murder.killer")}
                <select name="killer">${optionsFor(defaultKiller)}</select></label>
            <label>${game.i18n.localize("DRPG.Murder.victim")}
                <select name="victim">${options}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="indirect"${
                    /*
                     * THE KILLER THE DROPDOWN IS SHOWING, NOT THE ONE THE CALLER
                     * NAMED (F10). `killerId` is this function's argument and the
                     * GM panel passes none, so `armed.has(null)` was false on the
                     * one road where the question is worth asking - and the box
                     * stayed unticked for a killer whose trap is finished until the
                     * GM touched a dropdown they had no reason to touch. The
                     * `change` listener below has always asked
                     * `armed.has(form.killer.value)`; this is the same question at
                     * first render. On the trap road `defaultKiller` IS `killerId`
                     * while the builder lives, and the box is ticked by `indirect`
                     * either way.
                     */
                    indirect || armed.has(defaultKiller) ? " checked" : ""} />
                ${game.i18n.localize("DRPG.Murder.indirect")}</label>
            <p class="notes" data-drpg-trap-note${trapFirst ? "" : " hidden"}>${
                game.i18n.localize("DRPG.Murder.indirectCost")}</p>
            <label>${game.i18n.localize("DRPG.Murder.openingStatistic")}
                <select name="openingTrait">${trapFirst
                    ? statisticOptions("victim", defaultVictim) : statisticOptions("killer", defaultKiller)}</select></label>
            <p class="notes drpg-warning" data-drpg-rooms hidden></p>
            <p class="notes drpg-warning" data-drpg-self hidden>${
                game.i18n.localize("DRPG.Murder.openSelfNote")}</p>
        </form>`),
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            if (!form) return;
            const note = dialog.element.querySelector("[data-drpg-self]");
            // The trap's budget is about building one (S04-30): read beside a direct murder it
            // was taken for a rule of the murder being opened, so it shows with the box ticked.
            const trapNote = dialog.element.querySelector("[data-drpg-trap-note]");
            const rooms = dialog.element.querySelector("[data-drpg-rooms]");

            /*
             * Say it, rather than prevent it.
             *
             * One name in both dropdowns is a real incident now, and it is also
             * something a GM can arrive at by accident - picking a killer who
             * happened to be the selected victim used to be corrected for them.
             * Correcting it silently is the wrong half of the trade in both
             * directions, so what happens instead is that the window tells them
             * which of the two they are looking at, live, before Confirm.
             *
             * The trap checkbox goes with it: an indirect self-inflicted death
             * opens on a roll that cannot mean anything (see `openMurder`), so
             * it is cleared and locked rather than quietly ignored downstream.
             */
            const sync = () => {
                const self = form.killer.value === form.victim.value;
                if (note) note.hidden = !self;
                form.indirect.disabled = self;
                if (self) form.indirect.checked = false;
                if (trapNote) trapNote.hidden = !form.indirect.checked;

                // The side that rolls, as `openMurder` reads it once the box is settled.
                const side = form.indirect.checked ? "victim" : "killer";
                form.openingTrait.innerHTML = statisticOptions(side, form[side].value, form.openingTrait.value);

                const apart = side === "killer" && !self ? roomsApart(form.killer.value, form.victim.value) : null;
                if (rooms) {
                    rooms.hidden = !apart;
                    rooms.textContent = apart ? game.i18n.format("DRPG.Murder.roomsDiffer", {
                        killer: game.actors.get(form.killer.value)?.name ?? "?",
                        victim: game.actors.get(form.victim.value)?.name ?? "?",
                        ...apart
                    }) : "";
                }
            };

            form.killer.addEventListener("change", () => {
                if (form.killer.value !== form.victim.value) {
                    form.indirect.checked = armed.has(form.killer.value);
                }
                sync();
            });
            form.victim.addEventListener("change", sync);
            form.indirect.addEventListener("change", sync);
            sync();
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Murder.openConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        killerId: f.killer.value,
                        victimId: f.victim.value,
                        indirect: f.indirect.checked,
                        openingTrait: f.openingTrait.value || null
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    /*
     * One name in both seats no longer needs confirming twice. It was refused
     * here; the window now says what it is while the GM is still looking at it,
     * and `openMurder` is the one place that decides what such an incident does.
     *
     * AND ITS ANSWER IS READ (F11). This used to be `await openMurder(result);`
     * followed unconditionally by the tracker, which has two consequences and both
     * were shipped. A refusal - the Eclipse, an incident already running, a missing
     * actor - warned once from `openMurder` and again from the tracker ("No murder
     * is running"). And because `openIncidentTracker` returns null on every road,
     * THIS function always resolved falsy: `fireTrap` in messenger-app.mjs settles
     * the trap's ruling card only on a truthy answer, so a trap that really did
     * become an incident left "Awaiting a ruling" and a live button on the thread
     * for the rest of the chapter.
     *
     * The tracker stays AWAITED. The GM panel reopens itself when a tile's `run()`
     * resolves, on the stated assumption that every tile awaits its own dialog -
     * returning early here would drop the panel on top of a live incident.
     */
    const opened = await openMurder(result);
    if (!opened) return null;

    await openIncidentTracker();
    return true;
}

/** The tracker's "ask again": once per ten seconds on this client. */
let lastReask = 0;
const REASK_COOLDOWN_MS = TIMING.reaskCooldownMs;

/** The live tracker: whose turn, what is left, and the controls. */
/** The three people in the incident, and the victim's Health and Sanity marks as text. */
function incidentPeople(now) {
        const killer = game.actors.get(now.killerId);
        const victim = game.actors.get(now.victimId);
        const third = now.thirdId ? game.actors.get(now.thirdId) : null;
        // Marks, the sheet's own direction (W-1): 0/6 is untouched.
        const left = res => victim ? marksOf(victim, res) : "?";
        return { killer, victim, third, left };
}

/* THE WRAPPER IS PART OF THE ANSWER, not decoration on the call site.

   `keepLive` looks its region up by selector on every round and REPLACES the element
   it finds - so a `build()` that returns the region's CONTENTS replaces the region
   with its own first child, and the second refresh has nothing left to find. Measured
   on 11.09 with exactly that mistake: one Pass the turn and the window read "Player A
   -> Player B" and nothing else, with `.drpg-incident-live` gone from the DOM.
   `buildConsole` in trial-floor-ui.mjs carries its own class for the same reason.
   Exported for the suite, which reads its clean-up table (E32+E07 C12). */
export function incidentTrackerHtml(now, cleanup) {
    // The incident is gone but the window is still up - the live hook below closes it
    // on the next tick, and until then it says so rather than showing a dead fight.
    if (!now) {
        return `<div class="drpg-incident-live"><p class="notes">${
            game.i18n.localize("DRPG.Murder.trackerOver")}</p></div>`;
    }
    const { killer, victim, third, left } = incidentPeople(now);

    /*
     * AN INCIDENT WHOSE CAST IS GONE SAYS SO (20.09).
     *
     * The cast is two actor ids, held in the GMs' client-scoped `incidentCast`
     * since LIVE-001 and merged in by `murderState`. An actor deleted while an
     * incident stands open - a fixture from a suite run that died, a character
     * removed between sessions - leaves the world insisting a fight is running
     * and this window reading "? -> ?". Every control on it then acts
     * on a side that does not exist: passing the turn writes a turn nobody owns,
     * and the tracker is the only screen that could have explained it.
     *
     * ONLY AN ID THAT NAMES NOBODY. A GM whose copy of the cast has not arrived
     * yet has no ids at all, and that is a sync still in flight, not a deleted
     * actor - so an empty id is left alone and only an id `game.actors` cannot
     * find is reported.
     *
     * It cannot repair itself - which actor was meant is not recoverable - so it
     * names what is missing and points at the one button that helps. The stage
     * and the count below stay: they are what a GM needs to decide whether
     * anything of this incident is worth writing down before it goes.
     */
    const lost = [
        now.killerId && !killer && !now.selfInflicted ? game.i18n.localize("DRPG.Murder.side.killer") : null,
        now.victimId && !victim ? game.i18n.localize("DRPG.Murder.side.victim") : null
    ].filter(Boolean);

    /*
     * AT THE OPENING, WHOSE ROLL IT WAITS FOR (E32+E07 C17, 03.10.2026; audit S04-29). Until
     * this commit the line read the fight's fields as they stand before there is a fight -
     * "Opening · turn 0 · victim to act" - while the roll it waited for was the killer's (a
     * trap's victim's). It names the roller now, and on the GM's browser that sent the
     * invitation, the player it went to (`openingInvited`).
     */
    const opening = now.stage === "openingRoll";
    const invited = opening && openingInvited?.openedAt === (now.openedAt ?? null)
        ? game.users.get(openingInvited.userId) ?? null : null;

    return `<div class="drpg-incident-live">
        ${lost.length ? `<p class="drpg-warning">${game.i18n.format(
            "DRPG.Murder.trackerCastGone", { who: lost.join(", ") })}</p>` : ""}
        <p>${now.selfInflicted
            // One name, and an arrow pointing at itself would be the only
            // thing on this line that is not true.
            ? `<strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong> · ${
                game.i18n.localize("DRPG.Murder.selfInflicted")}`
            : `<strong>${foundry.utils.escapeHTML(killer?.name ?? "?")}</strong> →
               <strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong>${
                third ? ` · ${game.i18n.format("DRPG.Murder.thirdIs", {
                    name: foundry.utils.escapeHTML(third.name)
                })}` : ""}`}</p>
        <p>${opening
            ? game.i18n.format("DRPG.Murder.trackerWaiting", {
                stage: game.i18n.localize(`DRPG.Murder.stage.${now.stage}`),
                name: foundry.utils.escapeHTML((now.indirect ? victim : killer)?.name ?? "?")
            })
            : now.selfInflicted
            // No turn and no side to report: there is no Stage 5 in this one.
            ? game.i18n.format("DRPG.Murder.trackerStateSelf", {
                stage: game.i18n.localize(`DRPG.Murder.stage.${now.stage}`)
            })
            : game.i18n.format("DRPG.Murder.trackerState", {
                stage: game.i18n.localize(`DRPG.Murder.stage.${now.stage}`),
                turn: now.turn,
                side: game.i18n.localize(`DRPG.Murder.side.${now.turnSide}`)
            })}</p>
        ${invited ? `<p class="notes">${game.i18n.format("DRPG.Murder.trackerInvited", {
            user: foundry.utils.escapeHTML(invited.name)
        })}</p>` : ""}
        ${recentTurnsHtml(now.recent)}
        <p>${game.i18n.format("DRPG.Murder.victimMarks", {
            hp: left("hitPoints"), stress: left("stress")
        })}</p>
        <p>${game.i18n.format("DRPG.Murder.keyCount", { n: now.keyRemnants })}</p>
        ${cleanupSection(killerIds(now).map(id => game.actors.get(id)).filter(Boolean), cleanup)}</div>`;
}

/**
 * The fight's last turns (`recent`, see `RECENT_TURNS`), oldest first, as the tracker lists
 * them: "Turn 1 - victim: Self-defence, missed with Despair." and what each reserve took, by
 * name ("Aiko loses 1 Health.", `reserveNote`). Nothing before the first action.
 */
function recentTurnsHtml(recent) {
    const lines = (recent ?? []).map(({ turn, side, key, band, success, changes }) => {
        const result = !band
            ? game.i18n.localize("DRPG.Murder.trackerResult.free")
            : band === "critical"
                ? game.i18n.localize("DRPG.Murder.trackerResult.critical")
                : game.i18n.format(success ? "DRPG.Murder.trackerResult.hit" : "DRPG.Murder.trackerResult.miss", {
                    band: game.i18n.localize(`DRPG.Murder.band.${band}`)
                });
        const byActor = new Map();
        for (const change of changes ?? []) byActor.set(change.actorId, [...(byActor.get(change.actorId) ?? []), change]);
        const notes = [...byActor].map(([id, list]) => reserveNote({
            name: foundry.utils.escapeHTML(game.actors.get(id)?.name ?? "?")
        }, list)).filter(Boolean);
        return [game.i18n.format("DRPG.Murder.trackerTurnLine", {
            turn,
            side: game.i18n.localize(`DRPG.Murder.side.${side}`),
            action: foundry.utils.escapeHTML(CRISIS_ACTIONS[key]?.label ?? key),
            result
        }), ...notes].join(" ");
    });
    return lines.length
        ? `<ul class="drpg-incident-recent">${lines.map(line => `<li>${line}</li>`).join("")}</ul>`
        : "";
}

/* WHICH BUTTONS ARE ON IT, which `keepLive` cannot change - it replaces a region of
   the content, not a DialogV2 footer built once. Same answer the trial console reached
   for the same reason: when the SET of buttons would differ, reopen instead. */
function incidentSignature(now) {
    return now ? [now.stage, now.selfInflicted].join("|") : null;
}

/** The footer, by stage: re-ask the opening roll, pass the turn, end the incident, close. */
function incidentButtons(state) {
    return [
        // There is no unconditional "roll the opening" button, and there must not
        // be one - the rate-limited re-ask at the end of this note is the exception.
        //
        // Stage 4 offers exactly one roll and its owner is not a decision:
        // a direct murder opens on the KILLER's roll, a trap on the VICTIM's.
        // `openMurder` sends that invitation itself the moment the incident
        // opens, so by the time this window is on screen the roll is already
        // with whoever owes it.
        //
        // A button here only ever sent a SECOND copy. Measured: opening one
        // incident and pressing it three times left the player with FOUR
        // stacked roll windows, each of which reopened itself twice more when
        // dismissed - the retry loop cannot tell an unwanted duplicate from a
        // refusal. And because the tracker reopens after every action with
        // this button as `default`, holding Enter sent invitations for as
        // long as you held it.
        //
        // Nothing is lost by its absence. An owner who is offline never gets
        // an invitation in the first place - `rollOpening` sees that and
        // throws the roll on the GM's own client - and an owner who is here
        // is re-offered three times before anyone has to intervene.
        // And none at all for a self-inflicted death: there is no turn to
        // pass, so the window's DEFAULT button - the one Enter presses -
        // would have been a control for a stage this incident never enters.
        // ...but an invitation that was declined three times can be sent
        // once more from here (CASE-10): the alternative was End and open
        // it again, which repeated the whole three-strike loop. Rate-limited
        // on this client so a held Enter cannot stack windows again.
        ...(state.stage === "openingRoll" && !state.selfInflicted ? [
            { action: "reask", label: game.i18n.localize("DRPG.Murder.openingReask") }
        ] : []),
        ...(state.stage === "openingRoll" || state.selfInflicted ? [] : [
            // No "somebody walks in" button. The guide's third party is
            // whoever "wejdzie do pomieszczenia poprzez akcję ruch", and
            // `maybeThirdParty` already watches token movement into the
            // victim's room and registers them the moment it happens. A
            // second, manual route only invited the GM to nominate somebody
            // who had not actually walked in - and to do it twice, since the
            // watcher had usually already fired.
            { action: "pass", label: game.i18n.localize("DRPG.Murder.passTurn"), default: true }
        ]),
        { action: "end", label: game.i18n.localize("DRPG.Murder.endMurder") },
        { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
    ];
}

/** Send the opening roll again, once the cooldown allows. */
function reaskOpening() {
    const now = Date.now();
    if (now - lastReask < REASK_COOLDOWN_MS) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.openingReaskWait"));
    } else {
        lastReask = now;
        const current = murderState();
        if (current?.stage === "openingRoll") {
            rollOpening(current.indirect ? "victim" : "killer", current)
                .catch(err => error("Could not re-send the opening roll", err));
            ui.notifications.info(game.i18n.localize("DRPG.Murder.openingReaskSent"));
        }
    }
}

export async function openIncidentTracker() {
    /*
     * NO `alreadyOpen` GUARD HERE, and it is the one window that must not have
     * one. Every other window in the module is opened by somebody pressing a
     * thing; this one REOPENS ITSELF after every crisis action, which is the
     * whole reason it is usable during an incident. A duplicate was never the
     * complaint about it, and a guard that fires while the previous copy is
     * still closing would refuse the reopen and leave the incident with no
     * tracker at all - turning a nuisance somebody else has into a broken
     * scene here.
     *
     * It still carries `drpg-window-incident`, so the diagnostics can count it
     * and a future caller can ask.
     */

    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.none"));
        return null;
    }

    /* AWAITED ONCE, HERE, so the body below can be rebuilt synchronously.

       `keepLive` calls `build()` and uses what comes back; a promise is not markup. The
       import has to be dynamic - cleanup.mjs reads the incident state out of this file and
       a static pair both ways is a cycle - so it is paid for at the door instead of inside
       the thing that runs sixty times a fight. */
    const cleanup = await import("./cleanup.mjs");

    /**
     * What the tracker says, read fresh every time it is asked.
     *
     * THIS WINDOW WAS A PHOTOGRAPH, AND IT IS THE ONE WINDOW THAT CANNOT BE.
     *
     * Measured on 11.09 with one tracker open and nothing touching it: it read "turn 1 -
     * victim to act, Victim 5/5 Health, 6/6 Sanity" and went on reading exactly that
     * through a crisis action, through a trace being left, through the victim dying and
     * through the murder being closed. Every other console in the module is on `keepLive`;
     * this was the only one that was not, and it is the console for the fastest-moving
     * scene in the game - the GM watches an incident here while the players drive it from
     * their sheets, so nothing that changes is a change this client made.

     * The old excuse was that it "reopens itself after every action" - it does, but only
     * after the GM presses Pass the turn, which is the one move a table with players in the
     * incident never uses.
     */
    const read = () => murderState();

    const trackerBody = () => incidentTrackerHtml(read(), cleanup);
    const signature = () => incidentSignature(read());
    const openedWith = signature();
    let settling = false;

    const action = await tableDialog({
        // `cleanupSection()` puts a table in this window once Stage 6 has traces to
        // list - `tableDialog` is what sizes the window to it.
        window: { title: game.i18n.localize("DRPG.Murder.trackerTitle") },
        classes: ["drpg-panel", "drpg-window-incident"],
        content: dialogContent(trackerBody()),
        buttons: incidentButtons(state),
        render: (event, dialog) => keepLive(dialog, {
            region: ".drpg-incident-live",
            build: trackerBody,
            /* Actors for the victim's Health and Sanity, tokens for the traces the
               clean-up table lists, the world half for the stage, and the cast for the
               turn. The cast is client-scoped, so Foundry writes it straight to
               localStorage and `updateSetting` never fires for it; until 1.2.66 it did not
               change mid-incident, and the turn was the world half's. Since E32 C2 a pass
               writes the cast alone, and its setting's change says so (`drpgCastChanged`,
               settings.mjs). */
            watch: { actors: true, tokens: true, settings: [SETTINGS.murderState], hooks: ["drpgCastChanged"] },
            after: () => {
                if (settling) return;
                const now = signature();
                if (now === openedWith) return;
                settling = true;
                /* The fight is over: shut, rather than reopening onto nothing. The
                   `endMurder` route closes this window itself; this is the backstop for
                   every other way an incident can stop existing. */
                const again = now !== null;
                dialog.close()
                    .then(() => (again ? openIncidentTracker() : null))
                    .catch(err => error("Could not refresh the incident tracker", err));
            }
        }),
        rejectClose: false
    });

    if (action === "pass") {
        await passTurn();
        return openIncidentTracker();
    }
    if (action === "reask") {
        reaskOpening();
        return openIncidentTracker();
    }
    if (action === "end") {
        const sure = await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Murder.endMurder") },
            content: `<p>${game.i18n.localize("DRPG.Murder.endConfirm")}</p>`
        });
        if (sure) await endMurder();
    }
    return null;
}

/**
 * What the killer is standing in, once the fight is over.
 *
 * Read-only on purpose. The clean-up itself is the killer's action and costs
 * their Sanity - the GM watching it happen needs to know what is still there and
 * what will not come off, not a button to do it for them. Reinforced traces are
 * listed and marked rather than hidden: "there is one you cannot touch" is the
 * single most useful thing this table says.
 *
 * The thresholds are deliberately shown here and nowhere the killer can see -
 * they are read off the trace's own visibility, which is the answer key.
 */
/**
 * EVERY KILLER'S (E32+E07 C12, 02.10.2026; audit S04-17): an accomplice cleans with their
 * own Sanity and their own tool, and the table showed the first killer's alone. With two,
 * each section is headed with its killer's name.
 *
 * @param {Actor[]} killers
 * @param {object} cleanup  cleanup.mjs, imported once by the caller - see the note there.
 */
function cleanupSection(killers, cleanup) {
    const state = murderState();
    if (state?.stage !== "resolution" || !killers.length) return "";
    return killers.map(killer => killerCleanup(killer, cleanup, killers.length > 1)).join("");
}

/** One killer's part of `cleanupSection`; `named` heads it with their name. */
function killerCleanup(killer, cleanup, named) {
    const { cleanableRemnants, cleaningTier, cleaningTool } = cleanup;
    const title = named
        ? game.i18n.format("DRPG.Cleanup.gmTitleFor", { name: foundry.utils.escapeHTML(killer.name) })
        : game.i18n.localize("DRPG.Cleanup.title");
    const traces = cleanableRemnants(killer);

    const tool = cleaningTool(killer);
    const toolLine = tool
        ? game.i18n.format("DRPG.Cleanup.gmTool", {
            item: foundry.utils.escapeHTML(tool.name), tier: cleaningTier(killer)
        })
        : game.i18n.localize("DRPG.Cleanup.gmNoTool");

    if (!traces.length) {
        return `<h4>${title}</h4>
                <p class="notes">${toolLine}</p>
                <p><em>${game.i18n.localize("DRPG.Cleanup.gmNothingHere")}</em></p>`;
    }

    const rows = traces.map(t => `<tr>
        <td>${foundry.utils.escapeHTML(`${t.data.visibilityLabel} ${t.data.typeLabel}`)}</td>
        <td>${foundry.utils.escapeHTML(t.data.note || t.data.subject || "-")}</td>
        <td>${t.data.reinforced
            ? `<strong>${game.i18n.localize("DRPG.Cleanup.gmReinforced")}</strong>`
            : `DC ${t.dc}`}</td>
    </tr>`).join("");

    // How much scrubbing the killer still has in them. Stage 6 has no turn
    // limit - it ends when the Sanity runs out or the GM says so - and without
    // this the GM had no way to see which of those was coming.
    const left = Math.max(0,
        Math.floor((resourceMax(killer, "stress") - resourceValue(killer, "stress"))
            / RESOLUTION_STRESS_COST));

    return `<h4>${title}</h4>
        <p class="notes">${toolLine}</p>
        <p class="notes">${plural("DRPG.Cleanup.gmAttemptsLeft", { n: left })}</p>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Cleanup.gmTrace")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmNote")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmThreshold")}</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
}
