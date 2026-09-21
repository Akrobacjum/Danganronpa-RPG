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
import { getClock } from "./clock.mjs";
import { error, plural } from "./utils.mjs";
import { marksOf } from "./character.mjs";
import { motive } from "./rules.mjs";
import { pendingGather } from "./call-effects.mjs";
import { roomOfActor } from "./movement.mjs";
import { trialFloor, floorHolder, floorTarget, secondsLeft, FLOOR_MODES } from "./trial-floor.mjs";
import { keyPlanStatus } from "./investigation.mjs";
import { SETTINGS, bodyDiscovery, bodyDiscoveryFresh, incidentCast, incidentParticipants,
    incidentWitness } from "./settings.mjs";
import { overflowEffect, overflowStatus, overflowRules } from "./overflow.mjs";
import { SAFEWORD_FLAG } from "./safeword.mjs";
import { trialProgress, VOTE_OPEN_FLAG, votesIn, pendingVoters } from "./vote.mjs";
import { narrowColumn } from "./narrow.mjs";

const WIDGET_ID = "drpg-events";

/**
 * BOTH THEMES, SINCE 1.2.47, AND THE REASON IS NOT DECORATION.
 * ---------------------------------------------------------------------------
 * This panel used to be Stained Glass only, and the four standing threats went
 * back to being rows of the clock under Monokuma Legacy so that theme "stayed
 * exactly the look it was". What that actually bought was two implementations
 * of the same four facts - `motiveCard` here and `buildMotive` in hud.mjs, and
 * so on - and a Legacy screen that was missing information, not just styling:
 *
 *   the opening roll     no row at all
 *   the Despair overflow no row at all
 *   a body found         a row that vanished the moment the investigation
 *                        started, because it read `bodyDiscovery()` alone and
 *                        that record is cleared then; the card here stands for
 *                        the whole investigation
 *   the motive           a row whose consequence was in a tooltip only
 *
 * So there is one implementation now and both themes get all of it. The clock
 * is a clock in both, which is what it was always supposed to be. What stays
 * theme-specific is the LOOK (stained-glass.css and the Legacy block beside it)
 * and the ticker behind the clock, which is a texture rather than a fact.
 *
 * Kept as a function rather than deleted at every call site: it is what the
 * a11y sweep and the suite name when they ask whether this panel is a thing,
 * and a predicate that is true everywhere is cheaper to read than an absence.
 */
export function eventsWindowActive() {
    return true;
}

/* THE KICKER IS GONE, AND WHAT IT SAID IS THE REASON (16.09).
   ---------------------------------------------------------------------------
   Every card in this panel used to open with a line reading
   "Chapter 1 · Day 3 · Afternoon", built here from the clock. The clock itself
   stands 300 px to the left and prints the campaign, "Chapter 1 · Day 3", the
   phase with its glyph, the hour, the elapsed time and the room. So with three
   cards up, the same six words were on screen four times - once where they
   belong and three times as a header for something else.

   Nothing replaces it as a header. What the freed line buys is the motive's
   CONSEQUENCE, which until now lived only in a `data-tooltip`: a tooltip is not
   readable on a shared screen, is not readable at all by somebody driving with
   a keyboard, and "or else" is half of what a motive IS. It is `note` on the
   card now, and the tooltip keeps its copy for the hover. */

/* ---- the three cards ------------------------------------------------------ */

function motiveCard() {
    const record = motive();
    if (!record) return null;
    const meta = record.due
        ? game.i18n.localize("DRPG.Motive.dueShort")
        : plural("DRPG.Motive.left", { n: record.remaining ?? 0 });
    const tooltip = [foundry.utils.escapeHTML(record.text)];
    if (record.consequence) tooltip.push(`<em>${game.i18n.format("DRPG.Motive.orElse", { what: foundry.utils.escapeHTML(record.consequence) })}</em>`);
    return {
        kind: "motive", due: Boolean(record.due),
        title: game.i18n.localize("DRPG.Motive.title"),
        sub: record.text,
        meta,
        // The half of a motive that says what it costs to ignore.
        note: record.consequence
            ? game.i18n.format("DRPG.Motive.orElse", { what: record.consequence })
            : null,
        tooltip: tooltip.join("<br>")
    };
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
    const state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    if (!state.active || state.stage !== "openingRoll") return null;
    const cast = incidentCast();
    const ids = new Set(game.actors
        .filter(a => a.type === "character" && a.testUserPermission(game.user, "OWNER"))
        .map(a => a.id));
    if (game.user.character?.id) ids.add(game.user.character.id);
    /*
     * The names are in the client-scoped cast (LIVE-001), which a participant
     * holds and a bystander does not; reading them off the world half found
     * nothing and hid this card from the killer as well.
     *
     * EACH KIND OF MURDER HAS EXACTLY ONE PERSON IT DOES NOT TELL, and they are
     * opposite people. A DIRECT murder does not tell its victim: nobody has
     * asked them for anything and the first they know of it is the incident
     * starting (config.mjs, the opening rules). An INDIRECT one does not tell
     * its killer: they built the trap and are somewhere else, and the victim is
     * the one who rolls. Stated as one line because it is one rule seen from
     * two ends.
     *
     * The killer's half is belt and braces - `castOwners` in murder.mjs no
     * longer sends them a cast at all while the trap is running, so
     * `incidentParticipants()` is already empty on their browser. It is written
     * here too because this card is also built on a GM's client, where the cast
     * is complete, and because a rule that lives in one place is a rule that
     * travels when somebody moves the other place.
     */
    const seats = incidentParticipants().filter(id =>
        state.indirect ? id !== cast.killerId : id !== cast.victimId);
    if (!game.user.isGM && !seats.some(id => ids.has(id))) return null;
    const victim = game.actors.get(cast.victimId), killer = game.actors.get(cast.killerId);
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
    /*
     * THE MECHANICS FROM THE WORLD, THE NAMES FROM THIS BROWSER.
     *
     * Every id this card reads - who the killer is, who the victim is, whose
     * turn it is - moved into the client-scoped cast with LIVE-001, and this
     * card went on reading them off the world setting alone. They were never
     * there, so `victim` was always undefined and the card returned null the
     * instant the opening roll ended: the panel simply vanished for the rest of
     * the incident, on the GM's screen as well as everybody else's. Same merge
     * `murderState()` makes in murder.mjs, and the same one `openingCard` above
     * already made.
     */
    const state = { ...(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}), ...incidentCast() };
    if (!state.active || state.stage !== "incident") return null;

    // THE GATE: a spectator gets nothing, not even the frame - and neither does
    // the killer of a trap. One predicate, shared with the HUD's turn row, the
    // colour of the interface's edges and the murder playlist, so those four
    // cannot come to disagree about who is in this. See `incidentWitness`.
    const here = incidentWitness();
    if (!here.witness) return null;
    const mine = here.seat;
    const involved = Boolean(mine);

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
    const left = game.i18n.format("DRPG.Murder.victimMarks", {
        hp: marksOf(victim, "hitPoints"),
        stress: marksOf(victim, "stress")
    });

    let room = null;
    try { room = roomOfActor(victim)?.name ?? null; } catch { /* a victim outside every room */ }
    const sub = killer
        ? game.i18n.format(room ? "DRPG.Events.incidentSubRoom" : "DRPG.Events.incidentSub", { killer: killer.name, victim: victim.name, room })
        : victim.name;

    return { kind: "incident", mine: Boolean(myTurn), title: game.i18n.localize("DRPG.Events.incidentTitle"), sub, meta: `${turn} · ${left}` };
}

/**
 * THE SCENE IS STOPPED, and it stays stopped until somebody says otherwise.
 *
 * The safeword's own card is a sticky popup on the client that receives the
 * announcement, which is right for the moment it lands and wrong for the ten
 * minutes afterwards: somebody closes it, somebody else joins, and the one
 * state in this game that means "nothing happens now" is on nobody's screen.
 *
 * NO NEW STATE, and that is the whole of why this reads the way it does. The
 * safeword pauses the game (`game.togglePause`, safeword.mjs) and the clock
 * stamps `pausedAt` when it does, so "is the game stopped" is already answered
 * twice over. What is left is "was it stopped BY a safeword", and the chat log
 * is the record: the announcement carries `SAFEWORD_FLAG` and a timestamp. An
 * ordinary pause - somebody pressed Foundry's own button - gets no card, and
 * should not: Foundry draws its own banner for that.
 *
 * WHO CALLED IT IS NOT ON THE CARD, ever. The handbook's protection is that
 * nobody has to explain themselves, and the public announcement says "somebody"
 * for exactly that reason (safeword.mjs). The name travels to the GMs over a
 * recipient-addressed socket and stops there; this card is drawn on everybody's
 * screen, so it knows nothing to leak.
 *
 * The slack is for the order of two writes, not for a guess: the message is
 * posted and the pause follows it, both asynchronously, so a message a few
 * seconds older than the stamp is still this pause's.
 */
const SAFEWORD_SLACK_MS = 15000;
/* Exported for the suite, which passes a clock of its own rather than moving
   the world's: both of these take one and read nothing else off it. */
export function safewordCard(clock) {
    try {
        if (!game.paused || !clock.pausedAt) return null;
        const called = (game.messages ?? []).reduce((newest, m) => {
            if (!m.getFlag(MODULE_ID, SAFEWORD_FLAG)) return newest;
            return !newest || m.timestamp > newest.timestamp ? m : newest;
        }, null);
        if (!called || called.timestamp < clock.pausedAt - SAFEWORD_SLACK_MS) return null;

        return {
            kind: "safeword",
            // It is waiting on a person, and `due` is how this panel says so.
            due: true,
            title: game.i18n.localize("DRPG.Events.safewordTitle"),
            sub: game.i18n.localize("DRPG.Events.safewordSub"),
            meta: game.i18n.localize(game.user.isGM
                ? "DRPG.Events.safewordMetaGm" : "DRPG.Events.safewordMeta")
        };
    } catch (err) {
        error("Could not read the safeword for the Event panel", err);
        return null;
    }
}

/**
 * IS THERE A VOTE OPEN, asked without inventing anywhere new to keep it.
 *
 * `ballots` lives on the GM's client and nowhere else, so a player's browser
 * cannot answer this at all - which is the gap `pendingVoters` exists for: a
 * player who dismissed their ballot by accident had nothing on screen telling
 * them the table was waiting. Two facts that are already shared answer it:
 * the flagged announcement `openVote` posts (the log is the record), and
 * `voteClosed` in `trialProgress`, which is a world setting and is what
 * `closeVote` writes. Both are chapter-stamped, because the log outlives the
 * trial and a record from another chapter describes another vote.
 */
function voteIsOpen(clock) {
    try {
        if (trialProgress().voteClosed) return false;
        return (game.messages ?? []).some(m =>
            m.getFlag(MODULE_ID, VOTE_OPEN_FLAG)
            && m.getFlag(MODULE_ID, "voteChapter") === clock.chapter);
    } catch {
        return false;
    }
}

/**
 * Whose floor it is in the Class Trial: the mode, the speaker, and who they
 * aimed at. The same reading hud.mjs `trialSlot` makes for the time row; here
 * it is a card, so the clock can stay a clock.
 *
 * THE VOTE IS A MODE OF THIS CARD AND NOT A CARD OF ITS OWN, because it is the
 * same fact the rest of the time: what the trial is doing right now. A second
 * card would put two gavels in the panel and leave the reader to work out which
 * of them is live. What differs is what the two sides may know - everybody is
 * told the vote is open, and only a GM is told how many ballots are back, since
 * `votesIn` and `pendingVoters` answer on that client alone. HOW anybody voted
 * is not here and is not anywhere: that is the one thing the guide keeps.
 */
export function trialCard(clock) {
    try {
        if (clock.phase !== "classTrial") return null;

        if (voteIsOpen(clock)) {
            const back = game.user.isGM ? votesIn() : null;
            const out = game.user.isGM ? (pendingVoters()?.length ?? null) : null;
            return {
                kind: "trial",
                due: true,
                title: game.i18n.localize("DRPG.Events.voteTitle"),
                sub: game.i18n.localize("DRPG.Events.voteSub"),
                meta: back === null || out === null
                    ? game.i18n.localize("DRPG.Events.voteMeta")
                    : game.i18n.format("DRPG.Events.voteMetaGm", { back, total: back + out })
            };
        }

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
            meta: versus ?? game.i18n.localize("DRPG.Events.trialFloorOpen"),
            // The debate's countdown, only while a floor is open: a trial in session
            // with nobody holding the floor has no clock running (see `paintTrialClock`).
            clock: Boolean(floor)
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
                    // `foundAny`, so a Key Remnant found off the plan is not
                    // missing from the line that says how solvable the case is (F18).
                    meta = game.i18n.format("DRPG.Events.bodyMetaGm",
                        { found: status.foundAny, total: status.entries.length });
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

/**
 * THE DESPAIR OVERFLOW, WHILE IT RUNS (Dawid, 13.09). The rail's caption says
 * the counter is under an effect, in the small type of a caption; the effect
 * itself changes what every action costs for a whole time of day, which is
 * exactly what this panel is for. Everybody sees the card - the effect is
 * announced to the table when it fires - and only the GM sees the counter
 * behind it, which stays masked for a player (D3).
 */
function overflowCard() {
    try {
        const key = overflowEffect();
        if (!key) return null;
        const status = overflowStatus();
        const rule = overflowRules().effects?.[key] ?? {};
        return {
            kind: "overflow",
            due: true,
            title: game.i18n.localize("DRPG.Overflow.caption"),
            sub: status.effectName ?? game.i18n.localize(`DRPG.Overflow.name.${key}`),
            meta: game.user.isGM
                ? game.i18n.format("DRPG.Events.overflowMetaGm", { count: status.count, max: status.threshold })
                : game.i18n.format(`DRPG.Overflow.what.${key}`, { n: rule.by ?? 1 })
        };
    } catch (err) {
        error("Could not read the overflow for the Event panel", err);
        return null;
    }
}

/* ---- the panel ------------------------------------------------------------ */

/* The state each card showed last time it was drawn, so a redraw can tell a change
   from a first sight. Keyed by card kind: two cards never share one. */
const LAST_SUB = new Map();

function cardElement(card) {
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
    add("drpg-event-title", card.title);
    /*
     * THE STATE ARRIVES THE WAY THE HOUR DOES.
     *
     * The clock slides a new time of day in from the edge of its slot rather than
     * swapping the word in place, because a label that simply changes is a label
     * nobody saw change. A trial's state moves faster and matters more - discussion,
     * debate, an Objection, a rebuttal - and it was the one that swapped silently
     * (Dawid, 2026-09-07).
     *
     * Only when it CHANGES, and only when there was something before it: arriving at
     * a table where the debate is already running is not a state change, and animating
     * it on the first draw would announce a moment that has not happened.
     */
    const before = LAST_SUB.get(card.kind);
    add("drpg-event-sub", card.sub);
    if (card.sub && before !== undefined && before !== card.sub) {
        el.querySelector(".drpg-event-sub")?.classList.add("drpg-event-swap");
    }
    LAST_SUB.set(card.kind, card.sub ?? "");
    if (card.clock) {
        const clockEl = document.createElement("div");
        clockEl.className = "drpg-event-clock";
        clockEl.dataset.tooltip = game.i18n.localize("DRPG.Hud.trialClockTooltip");
        paintTrialClock(clockEl);
        el.append(clockEl);
        startTrialClock();
    }
    add("drpg-event-meta", card.meta);
    add("drpg-event-note", card.note);
    return el;
}

/* ==========================================================================
 * THE DEBATE'S CLOCK, ON THE TRIAL'S CARD (22.09)
 * --------------------------------------------------------------------------
 * It stood in the campaign clock's elapsed line, a widget away from the card
 * that names the mode and the speaker ("timer jest w zegarze zamiast oknie
 * eventu. Bez sensu", Dawid). Derived from the floor's `startedAt`, so every
 * client shows the same second without anybody broadcasting it.
 *
 * TICKED IN PLACE, NEVER BY A REDRAW. The panel stands on the curtain and a
 * redraw of it is a recut of the glass (see the signature in `renderEvents`),
 * so the seconds are written into the element the card already holds, and the
 * signature carries only whether there is a clock - not what it reads.
 * ========================================================================== */
let trialClockTimer = null;

/**
 * How long this mode has left. The overrun mark is only ever put on a debate:
 * the other two modes end themselves at zero, so a red number there would be
 * the half-second before the transition lands rather than a state anybody is in.
 */
function paintTrialClock(el) {
    const floor = trialFloor();
    if (!floor) {
        if (el.textContent) el.textContent = "";
        return;
    }
    const left = secondsLeft(floor);
    const over = left < 0;
    const mins = Math.floor(Math.abs(left) / 60);
    const secs = String(Math.abs(left) % 60).padStart(2, "0");
    const text = `${over ? "+" : ""}${mins}:${secs}`;
    // Only when it changes: `#drpg-events` is watched by the a11y sweep, and a
    // write of the same words is still a mutation.
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle("overrun", over && floor.mode === FLOOR_MODES.debate);
}

function startTrialClock() {
    if (trialClockTimer) return;
    trialClockTimer = setInterval(() => {
        const clocks = document.querySelectorAll("#drpg-events .drpg-event-clock");
        if (!clocks.length) {
            clearInterval(trialClockTimer);
            trialClockTimer = null;
            return;
        }
        clocks.forEach(paintTrialClock);
    }, 1000);
}

/** Build or rebuild the panel. Safe to call repeatedly; removes itself when there is nothing to say. */
export function renderEvents() {
    try {
        const existing = document.getElementById(WIDGET_ID);
        if (!eventsWindowActive() || !game.user) { existing?.remove(); return; }

        const clock = getClock() ?? {};
        /* The safeword is first because it outranks everything: while the scene
           is stopped, nothing else on this panel is happening. */
        const cards = [safewordCard(clock), trialCard(clock), openingCard(), incidentCard(),
            bodyCard(clock), overflowCard(), assemblyCard(), motiveCard()].filter(Boolean);
        if (!cards.length) { existing?.remove(); return; }

        // Redraw only when something changed: the panel is on the curtain, and
        // every rebuild of it is a recut of the glass around it.
        const signature = JSON.stringify(cards.map(c => [c.kind, c.title, c.sub, c.meta, c.note, c.due, c.mine, c.clock]));
        if (existing && existing.dataset.signature === signature) return;

        const panel = document.createElement("div");
        panel.id = WIDGET_ID;
        panel.className = "drpg-events";
        panel.dataset.signature = signature;
        panel.setAttribute("role", "status");
        for (const card of cards) panel.append(cardElement(card));

        const rail = document.getElementById("drpg-despair");
        // the card follows the rail wherever it stands, including into the narrow stack
        const host = rail?.parentElement ?? narrowColumn() ?? document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;
        existing?.remove();
        if (rail) rail.after(panel); else host.append(panel);
    } catch (err) {
        error("Could not render the Event panel", err);
    }
}
