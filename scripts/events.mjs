/**
 * Danganronpa RPG - the Event panel (theme "Stained Glass").
 * ---------------------------------------------------------------------------
 * A narrow panel under the Despair rail that says what is happening and has no
 * button in it. It takes over the three standing threats the clock used to
 * carry as extra rows - Monokuma's motive, a deferred assembly, and the open
 * incident - so the clock is a clock again and the events read as events, each
 * on its own pane of the curtain (glass.mjs cuts a section for `#drpg-events`
 * under the rail's).
 *
 * WHO SEES THE INCIDENT. The killing is shown to its participants and to the
 * GM, and to nobody else - the same rule `buildIncident` in hud.mjs applied,
 * read from ownership rather than from `game.user.character` (see the note
 * there). A spectator's screen shows no card at all, not a redacted one: the
 * fact that an incident is running is itself part of what the killer is
 * hiding.
 *
 * Under "Monokuma Legacy" this panel is not rendered and the clock keeps its
 * rows, so that theme stays exactly the look it was.
 */

import { MODULE_ID } from "./config.mjs";
import { getClock, timeOfDayLabel } from "./clock.mjs";
import { error, plural } from "./utils.mjs";
import { remaining } from "./character.mjs";
import { motive } from "./rules.mjs";
import { pendingGather } from "./call-effects.mjs";
import { roomOfActor } from "./movement.mjs";
import { trialFloor, floorHolder, floorTarget, FLOOR_MODES } from "./trial-floor.mjs";
import { keyPlanStatus } from "./investigation.mjs";
import { bodyDiscovery, bodyDiscoveryFresh } from "./settings.mjs";

const WIDGET_ID = "drpg-events";

/** The panel exists only under the Stained Glass theme. */
export function eventsWindowActive() {
    return document.body.classList.contains("drpg-theme-stained-glass");
}

function kicker(clock) {
    const parts = [
        game.i18n.format("DRPG.Hud.chapter", { n: clock.chapter }),
        game.i18n.format("DRPG.Hud.day", { n: clock.day ?? 1 })
    ];
    try { const t = timeOfDayLabel(clock.timeOfDay); if (t) parts.push(t); } catch { /* the hour is optional */ }
    return parts.join(" · ");
}

/* ---- the three cards ------------------------------------------------------ */

function motiveCard() {
    const record = motive();
    if (!record) return null;
    const meta = record.due
        ? game.i18n.localize("DRPG.Motive.dueShort")
        : plural("DRPG.Motive.left", { n: record.remaining ?? 0 });
    const tooltip = [foundry.utils.escapeHTML(record.text)];
    if (record.consequence) tooltip.push(`<em>${game.i18n.format("DRPG.Motive.orElse", { what: foundry.utils.escapeHTML(record.consequence) })}</em>`);
    return { kind: "motive", due: Boolean(record.due), title: game.i18n.localize("DRPG.Motive.title"), sub: record.text, meta, tooltip: tooltip.join("<br>") };
}

function assemblyCard() {
    const order = pendingGather();
    if (!order) return null;
    return {
        kind: "assembly",
        title: game.i18n.localize("DRPG.Calls.gatherShort"),
        sub: order.room,
        meta: game.i18n.format("DRPG.Calls.gatherBody", { room: order.room })
    };
}

/**
 * The open incident, for its participants and the GM only. Ownership decides
 * who is a participant - see hud.mjs `buildIncident` for why not
 * `game.user.character`.
 */
/**
 * A murder that has opened but not yet reached its incident: the GM's own card, and the
 * participants'. The panel showed nothing for the whole opening stage, which on the GM's
 * screen read as "the Event panel does not show at a murder".
 */
function openingCard() {
    if (!game.settings.settings.has(`${MODULE_ID}.murderState`)) return null;
    const state = game.settings.get(MODULE_ID, "murderState") ?? {};
    if (!state.active || state.stage !== "openingRoll") return null;
    const ids = new Set(game.actors
        .filter(a => a.type === "character" && a.testUserPermission(game.user, "OWNER"))
        .map(a => a.id));
    if (game.user.character?.id) ids.add(game.user.character.id);
    const seats = [state.killerId, state.victimId, state.thirdId].filter(Boolean);
    if (!game.user.isGM && !seats.some(id => ids.has(id))) return null;
    const victim = game.actors.get(state.victimId), killer = game.actors.get(state.killerId);
    let room = null;
    try { room = victim ? (roomOfActor(victim)?.name ?? null) : null; } catch { /* a victim outside every room */ }
    const who = game.user.isGM && killer && victim ? `${killer.name} → ${victim.name}` : (victim?.name ?? "");
    return {
        kind: "incident",
        mine: !game.user.isGM,
        title: game.i18n.localize("DRPG.Events.openingTitle"),
        sub: room ? `${who} · ${room}` : who,
        meta: game.i18n.localize("DRPG.Events.openingMeta")
    };
}
function incidentCard() {
    if (!game.settings.settings.has(`${MODULE_ID}.murderState`)) return null;
    const state = game.settings.get(MODULE_ID, "murderState") ?? {};
    if (!state.active || state.stage !== "incident") return null;

    const ids = new Set(game.actors
        .filter(a => a.type === "character" && a.testUserPermission(game.user, "OWNER"))
        .map(a => a.id));
    const assigned = game.user.character?.id;
    if (assigned) ids.add(assigned);
    const seats = [state.killerId, state.victimId, state.thirdId].filter(Boolean);
    const ownedSeat = seats.find(id => ids.has(id)) ?? null;
    const mine = (assigned && seats.includes(assigned)) ? assigned : (game.user.isGM ? null : ownedSeat);
    const involved = Boolean(mine);

    // THE GATE: a spectator gets nothing, not even the frame.
    if (!game.user.isGM && !ownedSeat) return null;

    const victim = game.actors.get(state.victimId);
    const killer = game.actors.get(state.killerId);
    if (!victim) return null;

    const killers = [state.killerId, state.thirdSide === "killer" ? state.thirdId : null].filter(Boolean);
    const killerActing = killers.length > 1 ? (state.killerTurnId ?? killers[0]) : state.killerId;
    const myTurn = involved && (
        (state.turnSide === "victim" && mine === state.victimId)
        || (state.turnSide === "killer" && mine === killerActing));

    const turn = involved
        ? game.i18n.localize(myTurn ? "DRPG.Murder.yourTurn" : "DRPG.Murder.theirTurn")
        : game.i18n.format("DRPG.Murder.trackerState", {
            stage: game.i18n.localize(`DRPG.Murder.stage.${state.stage}`),
            turn: state.turn ?? 1,
            side: game.i18n.localize(`DRPG.Murder.side.${state.turnSide}`)
        });
    const left = game.i18n.format("DRPG.Murder.victimLeft", {
        hp: remaining(victim, "hitPoints"),
        stress: remaining(victim, "stress")
    });

    let room = null;
    try { room = roomOfActor(victim)?.name ?? null; } catch { /* a victim outside every room */ }
    const sub = killer
        ? game.i18n.format(room ? "DRPG.Events.incidentSubRoom" : "DRPG.Events.incidentSub", { killer: killer.name, victim: victim.name, room })
        : victim.name;

    return { kind: "incident", mine: Boolean(myTurn), title: game.i18n.localize("DRPG.Events.incidentTitle"), sub, meta: `${turn} · ${left}` };
}

/**
 * Whose floor it is in the Class Trial: the mode, the speaker, and who they
 * aimed at. The same reading hud.mjs `trialSlot` makes for the time row; here
 * it is a card, so the clock can stay a clock.
 */
function trialCard(clock) {
    try {
        if (clock.phase !== "classTrial") return null;
        const floor = trialFloor();
        const key = floor ? floor.mode : "discussion";
        const unknown = "-";
        let speaker = game.i18n.localize("DRPG.Hud.trialEveryone");
        let versus = null;
        if (floor?.mode === FLOOR_MODES.objection) {
            speaker = floorHolder(floor)?.name ?? unknown;
        } else if (floor?.mode === FLOOR_MODES.rebuttal) {
            speaker = floorTarget(floor)?.name ?? unknown;
            versus = game.i18n.format("DRPG.Hud.trialVersus", { who: floorHolder(floor)?.name ?? unknown });
        }
        return {
            kind: "trial",
            title: game.i18n.localize(`DRPG.Hud.trial.${key}`),
            sub: speaker,
            meta: versus ?? game.i18n.localize("DRPG.Events.trialFloorOpen")
        };
    } catch (err) {
        error("Could not read the trial's state for the Event panel", err);
        return null;
    }
}

/**
 * A BODY HAS BEEN FOUND, which is the one part of a killing that is public.
 *
 * The incident card above is shown to its participants and to nobody else; this
 * one is shown to everybody, because the discovery is what opens the
 * investigation and the whole table is in it. It goes up the moment the body is
 * found - which since D5 is no longer the moment Stage 7 starts - and stays up
 * for the whole of the investigation that follows.
 *
 * What it says is deliberately thin for a player: who, and where. How many
 * traces are still out there is the GM's number - a player who could read
 * "3 traces left" off the frame would know when to stop searching, which is
 * the one thing the investigation is supposed to cost them.
 */
function bodyCard(clock) {
    /*
     * TWO STATES, ONE CARD (D5).
     *
     * `bodyDiscovery()` is the HOLDING state: the body is found, the GM has not
     * answered, and the clock is still in Daily Life. It carries the room and
     * the victim itself, and that is not duplication - the incident state this
     * card used to be read from is wiped by `endMurder` (`restoreState({})`,
     * murder.mjs) BEFORE the GM ever presses anything, so in the ordinary flow
     * `state.stage === "resolution"` was false and this card never appeared at
     * all. The record is the only thing that still knows who and where.
     *
     * Once the Investigation starts the record is cleared (see `setClock`) and
     * the old reading takes over, so the frame still stands for the whole of
     * Stage 7 when the GM has parked an incident at Stage 6.
     */
    /* The record is written even when the phase moved first (see `discoverBody`), so "is the
       game being held?" is the record AND the clock: with Stage 7 already running nothing is
       waiting, and the card goes back to being the investigation's own frame. */
    const record = bodyDiscovery();
    const found = clock.phase === "investigation" ? null : record;
    let victimId = found?.victimId ?? record?.victimId ?? null;
    let room = found?.room ?? record?.room ?? null;

    if (!found) {
        if (clock.phase !== "investigation") return null;
        // The record still names the victim and the room that the wiped incident cannot, so it
        // is only when there is no record at all that the old reading has to answer.
        if (!victimId) {
            if (!game.settings.settings.has(`${MODULE_ID}.murderState`)) return null;
            const state = game.settings.get(MODULE_ID, "murderState") ?? {};
            if (state.stage !== "resolution" || !state.victimId) return null;
            victimId = state.victimId;
        }
    }

    const victim = victimId ? game.actors.get(victimId) : null;
    if (!victim && !room) return null;
    if (!room && victim) {
        try { room = roomOfActor(victim)?.name ?? null; } catch { /* a victim outside every room */ }
    }

    // WHAT THE META SAYS DEPENDS ON WHO IS WAITING FOR WHAT. While the game is
    // held, the players are told the room has stopped and the GM is told what
    // to press; once the investigation is running it goes back to the count of
    // Key Remnants for the GM, which is a number no player may read.
    let meta;
    if (found) {
        meta = game.i18n.localize(game.user.isGM
            ? "DRPG.Events.bodyHoldMetaGm" : "DRPG.Events.bodyHoldMeta");
    } else {
        meta = game.i18n.localize("DRPG.Events.bodyMeta");
        if (game.user.isGM) {
            try {
                const status = keyPlanStatus();
                if (status.entries.length) {
                    meta = game.i18n.format("DRPG.Events.bodyMetaGm",
                        { found: status.found, total: status.entries.length });
                }
            } catch { /* the plan is the GM's and may not exist yet */ }
        }
    }

    return {
        kind: "body",
        // The same pulse the motive's card uses when it is due: this card is
        // waiting on somebody, and `.due` is how this panel already says so.
        // The FRESH reader, not the standing one - the record outlives the hour
        // it was written in, and a card that pulses all evening is wallpaper.
        due: Boolean(bodyDiscoveryFresh()),
        title: game.i18n.localize("DRPG.Events.bodyTitle"),
        sub: room && victim
            ? game.i18n.format("DRPG.Events.bodySubRoom", { victim: victim.name, room })
            : (victim?.name ?? room),
        meta
    };
}

/* ---- the panel ------------------------------------------------------------ */

function cardElement(card, clock) {
    const el = document.createElement("div");
    el.className = "drpg-event";
    el.dataset.kind = card.kind;
    if (card.due) el.classList.add("due");
    if (card.mine) el.classList.add("mine");
    if (card.tooltip) el.dataset.tooltip = card.tooltip;
    /* Every card carries the glyph of what it is, as the audit page draws it: the knife for
       an open incident, the envelope for a motive, the horn for an assembly, the gavel for
       the floor of a trial. A masked pixel sprite, chosen by `data-kind` in the stylesheet,
       so a new kind of card needs one rule and no icon file. */
    const glyph = document.createElement("span");
    glyph.className = "drpg-event-glyph drpg-pxi";
    glyph.setAttribute("aria-hidden", "true");
    el.append(glyph);
    /* The same outline the clock runs behind itself, for the same reason: the card's colour
       says a state has changed and the word says which. One word, repeated, at the opacity
       the audit page sets - it is a texture, not a label, and the label is right underneath. */
    const word = game.i18n.localize(`DRPG.Events.ticker.${card.kind}`);
    if (word && word.indexOf("DRPG.") !== 0) {
        const ticker = document.createElement("div");
        ticker.className = "drpg-event-ticker";
        ticker.setAttribute("aria-hidden", "true");
        const run = document.createElement("span");
        run.textContent = Array(6).fill(word).join(" · ") + " · ";
        ticker.append(run, run.cloneNode(true));
        el.append(ticker);
    }
    const add = (cls, text) => {
        if (!text) return;
        const line = document.createElement("div");
        line.className = cls;
        line.textContent = text;
        el.append(line);
    };
    add("drpg-event-kicker", kicker(clock));
    add("drpg-event-title", card.title);
    add("drpg-event-sub", card.sub);
    add("drpg-event-meta", card.meta);
    return el;
}

/** Build or rebuild the panel. Safe to call repeatedly; removes itself when there is nothing to say. */
export function renderEvents() {
    try {
        const existing = document.getElementById(WIDGET_ID);
        if (!eventsWindowActive() || !game.user) { existing?.remove(); return; }

        const clock = getClock() ?? {};
        const cards = [trialCard(clock), openingCard(), incidentCard(), bodyCard(clock), assemblyCard(), motiveCard()].filter(Boolean);
        if (!cards.length) { existing?.remove(); return; }

        // Redraw only when something changed: the panel is on the curtain, and
        // every rebuild of it is a recut of the glass around it.
        const signature = JSON.stringify(cards.map(c => [c.kind, c.title, c.sub, c.meta, c.due, c.mine]));
        if (existing && existing.dataset.signature === signature) return;

        const panel = document.createElement("div");
        panel.id = WIDGET_ID;
        panel.className = "drpg-events";
        panel.dataset.signature = signature;
        panel.setAttribute("role", "status");
        for (const card of cards) panel.append(cardElement(card, clock));

        const rail = document.getElementById("drpg-despair");
        const host = rail?.parentElement ?? document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;
        existing?.remove();
        if (rail) rail.after(panel); else host.append(panel);
    } catch (err) {
        error("Could not render the Event panel", err);
    }
}
