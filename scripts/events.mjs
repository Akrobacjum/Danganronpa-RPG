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

/* ---- the panel ------------------------------------------------------------ */

function cardElement(card, clock) {
    const el = document.createElement("div");
    el.className = "drpg-event";
    el.dataset.kind = card.kind;
    if (card.due) el.classList.add("due");
    if (card.mine) el.classList.add("mine");
    if (card.tooltip) el.dataset.tooltip = card.tooltip;
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
        const cards = [incidentCard(), assemblyCard(), motiveCard()].filter(Boolean);
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
