/**
 * Danganronpa RPG — the campaign HUD.
 * ---------------------------------------------------------------------------
 * The clock is world state, not character state, so it belongs on screen once
 * rather than repeated on every sheet. This renders it into `#ui-top`, which
 * Foundry lays out inside `#ui-middle` — top centre of the screen, clear of the
 * scene navigation on the left.
 *
 *      Hope's Peak: Drowned Summer      <- campaign name
 *              Chapter 2
 *              Daily Life
 *          ◀   Afternoon   ▶  ⚙        <- GM-only controls
 *
 * Players see the same four lines without the controls.
 */

import { MODULE_ID, TIMES_OF_DAY, ECLIPSE_FREE_PLACEMENT } from "./config.mjs";
import { getClock, setClock, campaignName, phaseLabel, timeOfDayLabel, rewindTimeOfDay } from "./clock.mjs";
import { isPrimaryGm, error } from "./utils.mjs";
import { actionsLeft, actionsMax } from "./actions.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isDeceased } from "./chapter.mjs";

const HUD_ID = "drpg-hud";

export function registerHud() {
    Hooks.once("ready", () => { renderHud(); renderRoster(); });

    // Foundry rebuilds parts of the interface on scene changes; re-assert.
    Hooks.on("canvasReady", () => { renderHud(); renderRoster(); });

    // Pausing stops the time-of-day timer. Every client redraws so the frozen
    // reading is the same everywhere; only one GM writes the bookkeeping.
    Hooks.on("pauseGame", paused => {
        settleElapsedPause(paused);
        renderHud();
    });

    // The roster is only useful if it is current, and what makes it stale is
    // somebody spending an action. Narrowed to resource writes on characters:
    // a HUD rebuild on every actor update of any kind would fire on inventory,
    // biography and effect changes too, several times a turn, for a row of
    // letters that did not move.
    Hooks.on("updateActor", (actor, changes) => {
        if (!game.user.isGM) return;
        if (actor?.type !== "character") return;
        if (!changes?.system?.resources) return;
        renderRoster();
    });
}


/* ==========================================================================
 * WHO STILL HAS SOMETHING LEFT
 * ==========================================================================
 *
 * A GM running a time of day asks one question over and over: is everybody
 * done. Answering it meant opening five character sheets or interrupting
 * whoever was mid-scene.
 *
 * It lived in the HUD for a while and did not belong there. The HUD is the
 * clock — campaign, chapter, day, time of day, timer — and it is on every
 * screen at the table. A roster of initials squeezed under it read like part
 * of the clock, and two-letter abbreviations are not names: "PA" and "PT" tell
 * a GM nothing at a glance.
 *
 * So it is its own panel now, top left, GM only, collapsible, with the names
 * spelled out. Collapsed it is one line; open it is the table.
 */

const ROSTER_ID = "drpg-roster";
let rosterOpen = true;

function renderRoster() {
    try {
        document.getElementById(ROSTER_ID)?.remove();
        if (!game.user.isGM) return;

        const students = game.actors.contents.filter(a =>
            a.type === "character" && !isMonokuma(a) && !isDeceased(a) && a.hasPlayerOwner);
        if (!students.length) return;

        const left = students.filter(a => actionsLeft(a) > 0);

        const panel = document.createElement("details");
        panel.id = ROSTER_ID;
        panel.open = rosterOpen;
        panel.addEventListener("toggle", () => { rosterOpen = panel.open; });

        // Shut, the summary still answers the question — how many are still
        // holding actions — so the panel only needs opening to find out WHO.
        const summary = document.createElement("summary");
        summary.className = "drpg-roster-summary";
        summary.textContent = game.i18n.format("DRPG.Roster.summary",
            { left: left.length, total: students.length });
        panel.append(summary);

        const list = document.createElement("div");
        list.className = "drpg-roster-list";
        for (const actor of students) {
            const has = actionsLeft(actor);
            const row = document.createElement("div");
            row.className = `drpg-roster-row${has > 0 ? "" : " spent"}`;
            const name = document.createElement("span");
            name.className = "drpg-roster-name";
            name.textContent = actor.name;
            const count = document.createElement("span");
            count.className = "drpg-roster-count";
            count.textContent = `${has} / ${actionsMax(actor)}`;
            row.append(name, count);
            list.append(row);
        }
        panel.append(list);

        (document.querySelector("#ui-left") ?? document.body).append(panel);
    } catch (err) {
        error("Could not render the GM roster", err);
    }
}

/**
 * Keep the elapsed timer honest across a pause.
 *
 * On pause: stamp when it happened, and `paintElapsed` freezes there.
 * On unpause: push `timeOfDayStartedAt` forward by however long the break ran,
 * so the timer carries on from the same number instead of having counted the
 * break. The stamp is cleared in the same write.
 *
 * GM-only, and primary-GM-only, because it writes the clock — two GMs both
 * adding the pause duration would double it.
 */
async function settleElapsedPause(paused) {
    try {
        if (!game.user.isGM || !isPrimaryGm()) return;
        const clock = getClock();
        if (!clock.timeOfDayStartedAt) return;

        if (paused) {
            if (clock.pausedAt) return;              // already stamped
            await setClock({ pausedAt: Date.now() });
            return;
        }

        if (!clock.pausedAt) return;
        const paused_ms = Math.max(0, Date.now() - clock.pausedAt);
        await setClock({
            timeOfDayStartedAt: clock.timeOfDayStartedAt + paused_ms,
            pausedAt: null
        });
    } catch (err) {
        // A drifting timer is a cosmetic problem; never let it throw into the
        // pause handler, which everything else on screen also listens to.
        error("Could not settle the paused time-of-day timer", err);
    }
}

/** Build or rebuild the HUD in place. Safe to call as often as you like. */
export function renderHud() {
    try {
        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle") ?? document.body;
        if (!host) return;

        document.getElementById(HUD_ID)?.remove();

        const clock = getClock();
        const isGM = game.user.isGM;

        const hud = document.createElement("div");
        hud.id = HUD_ID;
        hud.classList.toggle("gm", isGM);

        hud.append(
            line("drpg-hud-campaign", campaignName(clock)),
            line("drpg-hud-chapter", game.i18n.format("DRPG.Hud.chapter", { n: clock.chapter })),
            line("drpg-hud-day", game.i18n.format("DRPG.Hud.day", { n: clock.day ?? 1 })),
            line("drpg-hud-phase", phaseLabel(clock.phase)),
            buildTimeRow(clock, isGM),
            buildElapsed()
        );

        const incident = buildIncident();
        if (incident) hud.append(incident);

        // The HUD must never swallow clicks meant for the canvas behind it.
        hud.addEventListener("pointerdown", event => event.stopPropagation());

        host.append(hud);
        alignRightColumn(hud);
    } catch (err) {
        error("Could not render the campaign HUD", err);
    }
}

/**
 * Start the Projects tray level with the clock.
 *
 * They are the two things permanently on screen either side of the map, and
 * they were 60px out of step, which reads as carelessness before it reads as
 * anything else. The offset cannot be a constant: the HUD sits below the
 * Despair bars, and how tall those are depends on how many Monokumas the
 * campaign has. So it is measured, the same way popup.mjs measures its own
 * top rather than adding up the widgets above it.
 */
function alignRightColumn(hud) {
    try {
        const column = document.querySelector("#ui-right-column-1");
        if (!column) return;

        // Align to whatever is highest on the left of the screen, not to the
        // clock. The Despair bars sit ABOVE the clock, so matching the clock
        // left the right rail a bar's height too low — which is what it looked
        // like: two columns starting at different heights for no reason.
        const anchors = ["#drpg-despair", "#drpg-hud"]
            .map(sel => document.querySelector(sel))
            .filter(el => el && el.getBoundingClientRect().height > 0);
        const top = anchors.length
            ? Math.round(Math.min(...anchors.map(el => el.getBoundingClientRect().top)))
            : Math.round(hud?.getBoundingClientRect().top ?? 0);

        if (top > 0) column.style.marginTop = `${top}px`;
    } catch {
        // Being a few pixels out is not worth throwing into the HUD render.
    }
}

/**
 * The time of day an Eclipse is leading into.
 *
 * A local copy of `eclipse.mjs`'s function of the same name, kept here for the
 * same reason `movement.mjs` has one: eclipse.mjs reaches back into this file to
 * redraw the HUD, and a two-line date calculation is not worth an import that
 * has to be dynamic to stay honest about the cycle.
 */
function incomingTimeOfDay(clock) {
    const index = TIMES_OF_DAY.indexOf(clock?.timeOfDay);
    return TIMES_OF_DAY[(index < 0 ? 0 : index + 1) % TIMES_OF_DAY.length];
}

function line(className, text) {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text ?? "";
    if (!text) el.classList.add("empty");
    return el;
}

function buildTimeRow(clock, isGM) {
    const row = document.createElement("div");
    row.className = "drpg-hud-time-row";

    if (isGM) {
        row.append(control("fa-chevron-left", "DRPG.Hud.rewind", async () => {
            await rewindTimeOfDay();
        }));
    }

    // While an Eclipse runs, the clock has NOT moved yet — it still reads the
    // time of day just finished, and showing that was the single most confusing
    // thing on screen: the Night Eclipse ran under a bar reading "EVENING", so
    // anyone checking which Eclipse they were in got the wrong answer, and
    // anyone setting the clock to "night" to test the Night Eclipse actually
    // opened the Morning one.
    //
    // So during an Eclipse the row names the Eclipse instead. The sequence then
    // reads on screen exactly as it does in the rules: Morning Eclipse, Morning,
    // Noon Eclipse, Noon, and so on.
    const running = clock.eclipse === true;
    const time = document.createElement("div");
    time.className = `drpg-hud-time${running ? " is-eclipse" : ""}`;
    time.textContent = running
        ? game.i18n.format("DRPG.Eclipse.named", {
            time: timeOfDayLabel(incomingTimeOfDay(clock))
        })
        : timeOfDayLabel(clock.timeOfDay);
    time.dataset.tooltip = running
        ? game.i18n.localize("DRPG.Hud.eclipseRunningTooltip")
        : game.i18n.format("DRPG.Hud.sessionTooltip", { session: clock.session });
    row.append(time);

    if (isGM) {
        // One button, two steps: the Eclipse always sits between two times of
        // day, so the first press opens the placement window and the second
        // closes it and starts the time of day. No separate button to forget.
        //
        // The tooltip names which Eclipse is about to run, because the two
        // free-placement ones behave differently from the other three and the GM
        // should not have to work out which is next. On Night it says so even
        // more plainly: the next placement window belongs to a new session.
        const eclipseRunning = running;
        const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
        const incoming = incomingTimeOfDay(clock);
        const free = ECLIPSE_FREE_PLACEMENT.includes(incoming);

        const tooltip = eclipseRunning
            ? game.i18n.localize("DRPG.Hud.endEclipse")
            : game.i18n.format(
                index === TIMES_OF_DAY.length - 1 ? "DRPG.Hud.startEclipseNewSession"
                    : free ? "DRPG.Hud.startEclipseFree"
                        : "DRPG.Hud.startEclipseNamed",
                { time: timeOfDayLabel(incoming) });

        row.append(control(
            eclipseRunning ? "fa-play" : "fa-chevron-right",
            tooltip,
            async () => {
                const { isEclipse, startEclipse, endEclipse } = await import("./eclipse.mjs");
                if (isEclipse()) await endEclipse({ advance: true });
                else await startEclipse();
            },
            { literal: true }
        ));
    }

    return row;
}

/* ==========================================================================
 * HOW LONG THIS TIME OF DAY HAS RUN
 * --------------------------------------------------------------------------
 * The handbook asks players to spend their first action inside fifteen minutes
 * and their second by thirty, and then tells them "you never know the exact
 * moment of the next Eclipse". Both are true and together they are unplayable
 * without a clock somebody can see.
 *
 * Counts UP rather than down, because a time of day has no fixed length — the
 * handbook gives 30 to 60 minutes and the GM decides. A countdown would have to
 * invent a deadline. What it does instead is change colour at the two marks the
 * handbook actually names, so the advice is legible at a glance without any
 * number being promised.
 *
 * Runs off one shared interval for the whole HUD rather than a timer per
 * render: `renderHud` is called on every canvas change and every clock write,
 * and a stacked interval per call is how a HUD ends up ticking six times a
 * second by the third session.
 * ========================================================================== */

/* ==========================================================================
 * WHOSE TURN IT IS
 * --------------------------------------------------------------------------
 * An incident is turn-based, and every turn costs the victim Stress and then
 * HP. All of that state lived in one place: the Incident tracker window. Close
 * it — or never open it, which is every player's situation, since it is a GM
 * window — and you are playing the tensest scene in the game blind.
 *
 * So the two facts that decide what you do next go on the HUD: whose turn it
 * is, and what the victim has left.
 *
 * Read straight from the setting rather than through murder.mjs. The HUD is
 * imported by sync.mjs, which murder.mjs also reaches, and importing the murder
 * engine here would close that loop. The shape read is two ids and two
 * numbers — not worth a cycle.
 * ========================================================================== */

/** Participants and GMs only. Nobody else learns an incident is even running. */
function buildIncident() {
    if (!game.settings.settings.has(`${MODULE_ID}.murderState`)) return null;

    const state = game.settings.get(MODULE_ID, "murderState") ?? {};
    if (!state.active || state.stage !== "incident") return null;

    const mine = game.user.character?.id;
    const involved = mine
        && (mine === state.killerId || mine === state.victimId || mine === state.thirdId);
    if (!game.user.isGM && !involved) return null;

    const victim = game.actors.get(state.victimId);
    if (!victim) return null;

    const el = document.createElement("div");
    el.className = "drpg-hud-incident";

    const side = document.createElement("div");
    side.className = "drpg-hud-incident-turn";
    // A participant is told whether it is on them; a GM is told which side, since
    // "yours" means nothing to somebody running both.
    const myTurn = involved && (
        (state.turnSide === "victim" && mine === state.victimId)
        || (state.turnSide === "killer" && mine === state.killerId));
    side.textContent = involved
        ? game.i18n.localize(myTurn ? "DRPG.Murder.yourTurn" : "DRPG.Murder.theirTurn")
        : game.i18n.format("DRPG.Murder.trackerState", {
            stage: game.i18n.localize(`DRPG.Murder.stage.${state.stage}`),
            turn: state.turn ?? 1,
            side: game.i18n.localize(`DRPG.Murder.side.${state.turnSide}`)
        });
    side.classList.toggle("mine", Boolean(myTurn));
    el.append(side);

    // The victim's own numbers are on their sheet, but the killer and the GM are
    // making decisions against them too, and that is the whole shape of Stage 5.
    const left = document.createElement("div");
    left.className = "drpg-hud-incident-left";
    left.textContent = game.i18n.format("DRPG.Murder.victimLeft", {
        hp: remaining(victim, "hitPoints"),
        stress: remaining(victim, "stress")
    });
    el.append(left);

    return el;
}

/**
 * HP and Stress are reverse resources in Daggerheart — `value` counts marks,
 * not what is left. Duplicated from character.mjs rather than imported for the
 * same cycle reason as the state read above.
 */
function remaining(actor, key) {
    const res = actor?.system?.resources?.[key];
    if (!res) return 0;
    const max = Number(res.max ?? 0);
    const marked = Number(res.value ?? 0);
    return Math.max(0, max - marked);
}

const MARK_FIRST_ACTION = 15 * 60 * 1000;
const MARK_SECOND_ACTION = 30 * 60 * 1000;

let elapsedTimer = null;

function buildElapsed() {
    const el = document.createElement("div");
    el.className = "drpg-hud-elapsed";
    el.dataset.tooltip = game.i18n.localize("DRPG.Hud.elapsedTooltip");
    paintElapsed(el);

    clearInterval(elapsedTimer);
    // Every 10s: the readout is in whole minutes, so a per-second tick would
    // repaint sixty times for each visible change.
    elapsedTimer = setInterval(() => {
        // The HUD is rebuilt often; when this node is gone, so is the interval.
        if (!el.isConnected) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
            return;
        }
        paintElapsed(el);
    }, 10_000);

    return el;
}

function paintElapsed(el) {
    const clock = getClock();
    const startedAt = clock.timeOfDayStartedAt;
    el.classList.remove("past-first", "past-second", "paused");

    if (!startedAt) {
        el.textContent = game.i18n.localize("DRPG.Hud.elapsedUnknown");
        el.classList.add("empty");
        return;
    }

    // A paused game is a stopped clock. The whole point of this readout is "how
    // much of the time of day have you used", and a break, a rules argument or a
    // safeword is not time anybody used. While paused it freezes at the moment
    // the pause began; `settleElapsedPause` then pushes the start forward by the
    // length of the break, so it resumes where it stopped rather than jumping.
    const now = game.paused && clock.pausedAt ? clock.pausedAt : Date.now();
    const ms = Math.max(0, now - startedAt);

    el.classList.remove("empty");
    el.classList.toggle("paused", Boolean(game.paused && clock.pausedAt));
    el.textContent = game.i18n.format("DRPG.Hud.elapsed", {
        minutes: Math.floor(ms / 60000)
    });

    if (ms >= MARK_SECOND_ACTION) el.classList.add("past-second");
    else if (ms >= MARK_FIRST_ACTION) el.classList.add("past-first");
}

/**
 * @param {string} tooltipKey  An i18n key, or already-localised text when
 *   `literal` is set — the Eclipse control builds its own from the time of day
 *   it is about to open.
 */
function control(icon, tooltipKey, handler, { literal = false } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-hud-button";
    const label = literal ? tooltipKey : game.i18n.localize(tooltipKey);
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`;
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        try {
            await handler();
        } finally {
            button.disabled = false;
        }
    });
    return button;
}

export { HUD_ID, MODULE_ID };
