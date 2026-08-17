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

const HUD_ID = "drpg-hud";

export function registerHud() {
    Hooks.once("ready", () => renderHud());

    // Foundry rebuilds parts of the interface on scene changes; re-assert.
    Hooks.on("canvasReady", () => renderHud());

    // Nothing here moves the Projects tray any more.
    //
    // It wanted to sit under the player's status strip, and the strip and the
    // tray are already siblings in `#ui-right-column-1` — so the whole job is
    // one `order` in the stylesheet. Doing it in script meant re-parenting the
    // tray on three separate hooks and re-asserting after every one of its own
    // renders, because it appends itself back into that column each time a
    // project advances. CSS has no such problem: `order` cannot be undone by a
    // redraw, so there is nothing to re-assert and nothing to go wrong when the
    // system changes how it rebuilds.

    // Pausing stops the time-of-day timer. Every client redraws so the frozen
    // reading is the same everywhere; only one GM writes the bookkeeping.
    Hooks.on("pauseGame", paused => {
        settleElapsedPause(paused);
        renderHud();
    });

}


/*
 * THE ROSTER IS GONE.
 * --------------------------------------------------------------------------
 * It answered "is everybody done" with names, and it was the right answer — but
 * the GM panel answers the same question now, in the line above the tiles
 * ("N students still have actions to spend"), and the strip in the right column
 * carries the count. Three widgets, one fact, and this was the one taking a
 * corner of the map to say it.
 */

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

        // Which phase the clock is wearing. An Eclipse is a state rather than a
        // phase in the rules, but it is the loudest thing on screen while it
        // runs, so it takes the slot — see the stylesheet's four blocks.
        hud.dataset.drpgPhase = clock.eclipse === true ? "eclipse" : (clock.phase ?? "dailyLife");

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
 * Where the right column starts.
 *
 * Align to whatever is highest on the LEFT of the screen, not to the clock: the
 * Despair bars sit above the clock, so matching the clock left the right rail a
 * bar's height too low — which is what it looked like, two columns starting at
 * different heights for no reason.
 *
 * The column carries the status strip and the Projects tray, in that order, and
 * both ride on this one offset — see the `order` rules in the stylesheet.
 */
function alignRightColumn(hud) {
    try {
        const column = document.querySelector("#ui-right-column-1");
        if (!column) return;

        const anchors = ["#drpg-despair", "#drpg-hud"]
            .map(sel => document.querySelector(sel))
            .filter(el => el && el.getBoundingClientRect().height > 0);
        const top = anchors.length
            ? Math.round(Math.min(...anchors.map(el => el.getBoundingClientRect().top)))
            : Math.round(hud?.getBoundingClientRect().top ?? 0);

        if (top > 0) column.style.marginTop = `${top}px`;
        matchStripToDespair();
    } catch {
        // Being a few pixels out is not worth throwing into the HUD render.
    }
}

/**
 * Give the player's status strip the Despair panel's height.
 *
 * The two boxes either side of the clock start on the same line and should end
 * on it. How tall the Despair panel is depends on how many Monokumas the
 * campaign runs — one row each — so the number cannot live in the stylesheet.
 * It is measured here and published as a custom property on `<body>`, which
 * `#drpg-player-status` reads as its `min-height`.
 *
 * A property rather than an inline height on the element: the strip is rebuilt
 * from scratch on every action spent, and an inline style would go with it. The
 * token survives on the body, so a freshly drawn strip is already the right
 * height instead of snapping to it a frame later.
 */
export function matchStripToDespair() {
    const despair = document.getElementById("drpg-despair");
    const height = Math.round(despair?.getBoundingClientRect().height ?? 0);
    if (height > 0) document.body.style.setProperty("--drpg-despair-height", `${height}px`);
    else document.body.style.removeProperty("--drpg-despair-height");
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
    //
    // The killers' side may hold two people, and only one of them has the turn.
    // Read straight off `killerTurnId` rather than from `isTheirTurn`, for the
    // same reason the state itself is read from the setting here: this file is
    // on the render path the clock calls back into, and one boolean is not worth
    // closing that loop. The rule is `passTurn`'s and is one line long.
    const killers = [state.killerId, state.thirdSide === "killer" ? state.thirdId : null]
        .filter(Boolean);
    const killerActing = killers.length > 1
        ? (state.killerTurnId ?? killers[0])
        : state.killerId;
    const myTurn = involved && (
        (state.turnSide === "victim" && mine === state.victimId)
        || (state.turnSide === "killer" && mine === killerActing));
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
