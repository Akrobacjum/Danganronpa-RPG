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
import { play, TURN, ARRIVE, LEAVE } from "./motion.mjs";
import { isPrimaryGm, error, plural } from "./utils.mjs";
// Static, and checked before adding: this file avoids static imports because it
// sits on the render path the clock itself calls back into, so a cycle here
// would be a load-order problem rather than a lint complaint. None of these
// four reach hud.mjs, directly or through anything they import — eighteen
// modules were walked to confirm it.
import { roomOfActor, roomOfToken } from "./movement.mjs";
import { projectsAvailableIn } from "./projects.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { isMonokuma, poolUserFor } from "./monokuma.mjs";
// Static, and safe: nothing imports hud.mjs, so no path leads back here.
import { murderState, participantIds } from "./murder.mjs";
import { motive } from "./rules.mjs";
import { pendingGather } from "./call-effects.mjs";
// The fifth, added when the trial's own bar was folded into this widget. Walked
// like the four above and clean: trial-floor.mjs reaches config, settings and
// utils and nothing else — it stopped importing trial.mjs when the evidence
// counter went, which is what took popup.mjs and truth-bullets.mjs out of its
// graph as well.
import { trialFloor, secondsLeft, floorHolder, floorTarget, FLOOR_MODES } from "./trial-floor.mjs";

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
        centrePauseRaster();
    });

    // The word does not move, but the window it is centred in does: a resize,
    // a sidebar collapsing, a second monitor.
    Hooks.once("ready", () => {
        centrePauseRaster();
        window.addEventListener("resize", () => centrePauseRaster());
    });

    // ---- what keeps the room block honest --------------------------------
    //
    // Only the three things it reads can change it, and each is watched at its
    // own source rather than by redrawing the HUD on a timer.

    // A move — but only one that crosses a boundary, and only the token this
    // block is about. `refreshToken` fires on every frame of a drag, and the
    // GM owns every token on the scene: a hook that redrew for "anything I am
    // allowed to move" would repaint on a student being dragged and show the
    // GM that student's room instead of their Monokuma's. Comparing the room
    // before and after is the same trick movement.mjs plays with `lastRoom`.
    Hooks.on("updateToken", (doc, changes) => {
        if (changes.x === undefined && changes.y === undefined) return;
        const mine = hudActor();
        if (!mine || doc.actorId !== mine.id) return;

        const room = roomOfToken(doc);
        if (room === lastHudRoom) return;
        lastHudRoom = room;
        renderHud();
    });

    // Search tokens are a world setting, and so is the clock that refills them.
    Hooks.on("updateSetting", setting => {
        if (!setting?.key?.startsWith(`${MODULE_ID}.`)) return;
        renderHud();
    });

    // The Projects tray redrawing means a project was created, advanced,
    // finished or shared — any of which can change whether this room has one.
    Hooks.on("renderDhCountdowns", () => renderHud());
}

/**
 * The room the block was last drawn for.
 *
 * Module-scoped rather than read from the DOM: the comparison has to survive
 * the HUD being rebuilt from scratch, which it is, several times a minute.
 */
let lastHudRoom = null;


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

/**
 * The last clock this client was ALLOWED to display. See `clockForDisplay`.
 */
let lastPublicClock = null;

/**
 * The clock as this client may show it.
 *
 * While a murder runs, the clock moves in private (Dawid, 26.08): the change
 * of time is part of the incident, and the HUD flipping to "Morning" on every
 * screen would tell each outsider that the GM is doing something at this hour.
 * So an outsider's HUD keeps showing the clock as it stood when the incident
 * began, and catches up the moment it ends — `murderState` clearing travels
 * the sync bus, which re-renders the HUD on every client (SYNC.restrictions).
 *
 * The GM and the participants' owners see the truth throughout; they are the
 * people the incident is happening TO. Note the world SETTING still reaches
 * every client — nothing world-scoped can be hidden from a console (see the
 * settings notes) — this hides the answer from the SCREEN, which is where the
 * table actually reads it.
 */
function clockForDisplay(clock) {
    try {
        const state = murderState();
        const hide = state
            && !game.user.isGM
            && ![...participantIds(state)].some(id =>
                game.actors.get(id)?.testUserPermission(game.user, "OWNER"));

        if (!hide) {
            lastPublicClock = foundry.utils.duplicate(clock);
            return clock;
        }
        return lastPublicClock ?? clock;
    } catch {
        // A HUD that cannot decide shows the truth — a wrong clock for one
        // render beats no clock at all.
        return clock;
    }
}

/** Build or rebuild the HUD in place. Safe to call as often as you like. */
export function renderHud() {
    try {
        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle") ?? document.body;
        if (!host) return;

        // THE CLOCK IS KEPT, NOT REBUILT.
        //
        // It used to be removed and recreated on every render, and that one
        // line is why the phase colour has never faded: a CSS transition needs
        // an element that was already on the page to transition FROM, and this
        // one was new every time. Two elaborate workarounds were tried before
        // the obvious question got asked — a script cross-fade on the new
        // element, then the colour as a registered `@property` on `<body>` —
        // and the second turned out not to work at all in Chromium, which
        // creates the transition and then never advances it.
        //
        // Only the CONTENTS change from render to render. The element, its id,
        // its listener and its computed colours survive, so `border-color` and
        // the glow are an ordinary transition on an ordinary element.
        const outgoing = document.getElementById(HUD_ID);

        // THE LABEL THE TABLE LAST ACTUALLY READ — which is not always the one
        // sitting in the slot, and is never a variable.
        //
        // Held in a module variable it would be a second copy of something the
        // DOM already knows, and it would describe a HUD nobody saw the first
        // time a render updated it and then threw. Read off the element being
        // refilled, the answer is by definition what the player was looking at
        // a moment ago.
        //
        // While a turn-over is playing, the slot holds the NEW label and the
        // ghost holds the old one. That matters because several things redraw
        // this widget twice in a row: an Eclipse writes the clock and then
        // broadcasts itself, and the broadcast redraws every HUD again a few
        // milliseconds later. Read from the slot, the second redraw compared
        // "Night Eclipse" against "Night Eclipse", found no change, and left
        // the animation it had just destroyed unfinished — which is exactly the
        // report that the Eclipse has no animation at all.
        //
        // Read from the ghost, the second redraw starts the same journey again
        // from the same place. Any number of redundant redraws collapse into
        // one turn-over that plays to the end.
        //
        // The KEY travels with the text. Which way the labels should move is a
        // question about the day, not about the words — "Night" following
        // "Morning" is a rewind, "Morning" following "Night" is not, and no
        // amount of reading the two strings will tell them apart. So the time
        // of day each label names is written onto the element in `buildTimeRow`
        // and read back here with it.
        const before = outgoing
            ? (outgoing.querySelector(".drpg-hud-time-ghost")
                ?? outgoing.querySelector(".drpg-hud-time")
                ?? null)
            : null;
        const previous = before?.textContent ?? null;
        const previousTime = before?.dataset.drpgTime ?? null;

        const hud = outgoing ?? buildHudShell();
        hud.replaceChildren();

        const clock = clockForDisplay(getClock());
        const isGM = game.user.isGM;

        hud.classList.toggle("gm", isGM);

        // Which phase the clock is wearing. An Eclipse is a state rather than a
        // phase in the rules, but it is the loudest thing on screen while it
        // runs, so it takes the slot — see the stylesheet's four blocks.
        const phase = clock.eclipse === true ? "eclipse" : (clock.phase ?? "dailyLife");
        hud.dataset.drpgPhase = phase;
        // …and on the body, where the player's strip and the Projects tray can
        // read it. They are the same family of boxes as this one and were the
        // only two not wearing the phase — see "THE WHOLE RAIL WEARS IT" in the
        // stylesheet. A dataset attribute rather than a class for the same
        // reason `matchStripToDespair` publishes a custom property: it survives
        // every redraw those two widgets do on their own.
        document.body.dataset.drpgPhase = phase;

        hud.append(
            line("drpg-hud-campaign", campaignName(clock)),
            line("drpg-hud-chapter", game.i18n.format("DRPG.Hud.chapter", { n: clock.chapter })),
            line("drpg-hud-day", game.i18n.format("DRPG.Hud.day", { n: clock.day ?? 1 })),
            line("drpg-hud-phase", phaseLabel(clock.phase)),
            buildTimeRow(clock, isGM),
            buildElapsed()
        );

        /* MONOKUMA'S TWO STANDING THREATS, WHEN THERE ARE ANY.
         *
         * Both are public by design and both were previously a chat card that
         * scrolled away — which for the motive meant that "how long have we
         * got" was a memory test, and for a deferred assembly would have meant
         * the cast being teleported by an order nobody could still see.
         *
         * Appended conditionally and returning null when idle, so the column
         * below keeps its height on an ordinary time of day. `alignRightColumn`
         * measures what is actually here, after this. */
        const motiveRow = buildMotive();
        if (motiveRow) hud.append(motiveRow);

        const assembly = buildAssembly();
        if (assembly) hud.append(assembly);

        const incident = buildIncident();
        if (incident) hud.append(incident);

        // Last, under the timer: where you are standing is the most local thing
        // on a widget that otherwise describes the whole world.
        const room = buildRoom();
        if (room) hud.append(room);

        if (hud.parentElement !== host) host.append(hud);
        alignRightColumn(hud);
        // Both of these need the element to be in the document: one measures
        // the slot, the other measures what is in it.
        fitTimeSlot(hud);
        slideTimeOfDay(hud, previous, previousTime);
    } catch (err) {
        error("Could not render the campaign HUD", err);
    }
}

/**
 * Where the right column starts.
 *
 * THE TWO SIDES OF THE SCREEN START ON THE SAME LINE. Whatever is highest on
 * the left — the Despair rows when a campaign has Monokumas, the clock when it
 * does not — is the line the right rail hangs from.
 *
 * This has now been both ways round. Anchoring to the clock alone was tried on
 * 2026-08-23 and put the rail a Despair-panel's height too low, which is
 * exactly what it looks like: two columns starting at different heights for no
 * reason a player can see. Anchoring to the topmost of the two is the version
 * that survives a campaign gaining or losing a Monokuma, because it does not
 * care which of the two is on top.
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

/**
 * The turn-over currently under way, if there is one.
 *
 * `{ from, fromTime, to, dir, startedAt }`, in `performance.now()` milliseconds.
 *
 * `dir` is +1 for the day moving on and -1 for it being rewound. It is kept
 * with the journey rather than recomputed, so a redraw that interrupts a rewind
 * halfway does not finish it in the opposite direction from the half the table
 * already watched.
 *
 * WHY THIS EXISTS. Several things redraw the clock twice in a row — an Eclipse
 * writes to the clock and then broadcasts itself, and the broadcast redraws
 * every HUD again a few milliseconds later. The redraw destroys whatever was
 * moving, and the previous version of this answered that by starting the same
 * journey again from the beginning. That is exactly what it looked like: the
 * animation begins, snaps back to the start, and plays a second time.
 *
 * A journey that is already under way to the label now on screen is not a new
 * journey. It is the same one, and what it needs is to be picked up where it
 * was, not started over.
 */
let slide = null;

/**
 * The widest time-of-day label this client has had to show.
 *
 * Kept for the session and never reduced. See `fitTimeSlot`.
 */
let widestTime = 0;

/**
 * Stop the slot resizing under the label.
 *
 * The slot was as wide as whatever was in it, and the times of day are not the
 * same length — "NOON" and "AFTERNOON ECLIPSE" differ by most of the widget. So
 * the frame the new label arrived in was also the frame the slot changed width,
 * the row re-laid out around it, and the buttons either side moved. On screen
 * that is a jolt, immediately followed by a perfectly smooth animation, which
 * is precisely the report: it stutters on the click and THEN it plays.
 *
 * The slot only ever grows. Once a session has shown its longest label the
 * width is settled for good, and even before that the widening happens in the
 * frame a longer label first appears rather than on every single change. A
 * clock that reserves the room it might need is not wasting it — the space was
 * going to be used.
 */
function fitTimeSlot(hud) {
    const slot = hud.querySelector(".drpg-hud-time-slot");
    const label = slot?.querySelector(".drpg-hud-time");
    if (!slot || !label) return;

    // EVERY LABEL, MEASURED ONCE, BEFORE ANY OF THEM IS NEEDED.
    //
    // Growing to fit whatever has been shown so far was not enough, and the
    // Eclipse is why: its names are the longest strings this widget ever holds,
    // so the first Eclipse of a session was still the frame in which the slot
    // widened — and that is the one moment the whole table is watching. There
    // is no need to wait and find out. The times of day are a fixed list, each
    // has an Eclipse form, and both can be measured against the real font
    // before the clock has ever changed.
    if (!widestTime) widestTime = measureEveryLabel(slot);

    // …and a floor under it anyway, in case a label arrives that this did not
    // predict: a renamed time of day, a language with longer words, a pixel
    // font that finished loading after the measurement.
    widestTime = Math.max(widestTime, Math.ceil(label.scrollWidth) + 2);
    slot.style.minWidth = `${widestTime}px`;
}

/**
 * How wide the slot has to be to hold any time of day, or any Eclipse.
 *
 * Measured in the slot itself, so the probe inherits the font, the size and the
 * letter-spacing that will actually be used — including the pixel face, which
 * is a world setting and half again as wide as Signika. The Eclipse forms are
 * measured wearing `is-eclipse`, because that class sets its own tighter
 * letter-spacing and measuring without it would overstate them.
 *
 * `scrollWidth` rather than the bounding box: the slot clips, so the box would
 * report how much is visible and the question here is how much is needed.
 */
function measureEveryLabel(slot) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-9999px;top:0;"
        + "visibility:hidden;white-space:nowrap;pointer-events:none;";
    slot.append(probe);

    let widest = 0;
    try {
        for (const time of TIMES_OF_DAY) {
            const plain = timeOfDayLabel(time);
            for (const [text, eclipse] of [
                [plain, false],
                [game.i18n.format("DRPG.Eclipse.named", { time: plain }), true]
            ]) {
                probe.className = `drpg-hud-time${eclipse ? " is-eclipse" : ""}`;
                probe.textContent = text;
                widest = Math.max(widest, Math.ceil(probe.scrollWidth) + 2);
            }
        }
        // …and the four words a Class Trial puts in the same slot. Measured for
        // the same reason the Eclipse forms are: the first time one of them
        // appears is a moment the whole table is watching, and the slot widening
        // under the new label is the jolt that turn-over animation exists to
        // avoid.
        for (const key of ["discussion", "debate", "objection", "rebuttal"]) {
            probe.className = "drpg-hud-time is-trial";
            probe.textContent = game.i18n.localize(`DRPG.Hud.trial.${key}`);
            widest = Math.max(widest, Math.ceil(probe.scrollWidth) + 2);
        }
    } catch {
        // A slot sized by what it has been shown is still a working slot.
    }

    probe.remove();
    return widest;
}

/**
 * Which way round this turn-over goes: forward for the day moving on, backwards
 * for it being rewound.
 *
 * BACKWARDS MEANS EXACTLY ONE STEP BACK, and nothing else does. The clock has
 * one control that moves it that way — the left chevron, `rewindTimeOfDay` —
 * and it always steps once. Setting the time straight to Evening from Edit
 * Campaign is a correction rather than an undo: the day is being SET, and it
 * reads as the day moving on, so it goes forward with everything else.
 *
 * Measured round the ring, because the day is one. Night to Morning is a step
 * FORWARD even though the index falls from four to zero, and Morning to Night
 * is the rewind even though it rises — comparing the indexes directly gets both
 * of those exactly wrong, and between them they are every rollover the campaign
 * will ever do.
 *
 * The first draft used the shorter way round instead, which is a tidier rule
 * and the wrong one: it called Morning to Evening a rewind, because three steps
 * on is two steps back. The test said so.
 *
 * @returns {number} +1 forward, -1 backwards.
 */
function turnDirection(fromTime, toTime) {
    const from = TIMES_OF_DAY.indexOf(fromTime);
    const to = TIMES_OF_DAY.indexOf(toTime);
    if (from < 0 || to < 0) return 1;

    const n = TIMES_OF_DAY.length;
    return (from - to + n) % n === 1 ? -1 : 1;
}

/**
 * The old time leaves one way; the new one arrives from the other.
 *
 * Direction is the whole content of this moment. A label that simply changed
 * said "it is Noon now"; one that walks off to the left while its replacement
 * walks in from the right says "the day moved on", and every player reads that
 * without being told.
 *
 * Which is why REWINDING PLAYS IT MIRRORED. The GM's left chevron undoes a time
 * of day, and running the forward journey for it said the opposite of what had
 * just happened — the one control on this row whose entire job is to take a
 * step back announcing itself as another step on. Backwards, the old label
 * leaves to the right and the new one arrives from the left, and the gesture
 * reads as the undo it is.
 *
 * The slot clips, so both are travelling through a window rather than across
 * the HUD, and nothing either side of them shifts.
 *
 * The distance is measured, not written down: it is the slot's own width, so
 * the two labels are fully clear of the window at each end of the travel
 * whatever the language or the font size. Neither animation is awaited and
 * neither leaves anything behind — the outgoing copy is removed when its own
 * animation reports finished, and by a fallback if it never does.
 */
function slideTimeOfDay(hud, was, wasTime) {
    const slot = hud.querySelector(".drpg-hud-time-slot");
    const incoming = slot?.querySelector(".drpg-hud-time");
    if (!incoming) return;

    const ms = TURN();
    // Zero means the reader asked for stillness. The new label is already in
    // place and correct; there is simply no journey to show.
    if (!ms) return void (slide = null);

    const to = incoming.textContent;
    const now = performance.now();

    // RESUME, OR BEGIN — never begin twice.
    //
    // If a journey to exactly this label is already running, this redraw has
    // destroyed its animations but not its meaning. `elapsed` is how far it had
    // got, and the new animations are wound forward to that point below, so the
    // labels carry on from where they were. Any number of redundant redraws
    // collapse into one movement that plays through once.
    let elapsed = 0;
    let from = was;
    let fromTime = wasTime;
    let dir = 1;
    if (slide && slide.to === to && (now - slide.startedAt) < ms) {
        elapsed = now - slide.startedAt;
        from = slide.from;
        fromTime = slide.fromTime;
        dir = slide.dir;
    } else {
        // No previous HUD at all is a page load, not the clock moving: arriving
        // at a table where it is already Evening is not a turn-over.
        if (!was || was === to) return void (slide = null);
        dir = turnDirection(wasTime, incoming.dataset.drpgTime ?? null);
        slide = { from: was, fromTime: wasTime, to, dir, startedAt: now };
    }

    // ONE AT A TIME, NOT SIDE BY SIDE.
    //
    // Run together, the two labels are both in the window for most of the
    // journey and the eye has two times of day to choose between — which is
    // the whole complaint about this moment, and slowing it down only made
    // the overlap easier to read. So the slot holds one label at a time: the
    // old one leaves, and the new one does not start until it has gone. Half
    // the turn each, so the moment still takes exactly as long as it did.
    const half = Math.round(ms / 2);

    // Signed, and that sign is the whole of the change. Forward: in from the
    // right, out to the left. Backwards: the mirror of it.
    const distance = (Math.round(slot.getBoundingClientRect().width) || 80) * dir;

    const ghost = document.createElement("div");
    ghost.className = "drpg-hud-time drpg-hud-time-ghost";
    ghost.textContent = from;
    // The ghost carries the key as well as the words, because a redraw during
    // the journey reads the outgoing label off the GHOST — so without this the
    // second half of an interrupted rewind would have nothing to compare.
    if (fromTime) ghost.dataset.drpgTime = fromTime;
    slot.append(ghost);

    // `fill: "backwards"` is what makes the wait honest. Without it the new
    // label sits in the middle of the slot, at full opacity, for the whole of
    // the old one's exit — a delay that delays nothing.
    const into = play(incoming, [
        { transform: `translateX(${distance}px)`, opacity: 0 },
        { transform: "translateX(0)", opacity: 1 }
    ], half, ARRIVE(), { delay: half, fill: "backwards" });

    const out = play(ghost, [
        { transform: "translateX(0)", opacity: 1 },
        { transform: `translateX(${-distance}px)`, opacity: 0 }
    ], half, LEAVE());

    // Wound forward to where the interrupted journey had got to. An outgoing
    // label whose half is already over finishes in the same frame and takes
    // itself off the screen, which is correct — it had already left.
    if (elapsed > 0) {
        try {
            if (into) into.currentTime = elapsed;
            if (out) out.currentTime = elapsed;
        } catch {
            // A journey that restarts is worse than one that resumes and better
            // than none.
        }
    }

    if (!out) return void ghost.remove();
    out.finished.then(() => ghost.remove(), () => ghost.remove());
}

/* The phase COLOUR is not here any more, and the reason is worth keeping.
 *
 * It was animated from this file, on the new HUD, away from colours read off
 * the old one — which worked, and was fighting two things at once: a 1400ms
 * `transition: border-color` already declared on `#drpg-hud`, and the fact that
 * the element under it is thrown away and rebuilt several times a second in
 * places. The result read as a colour that changed roughly rather than
 * smoothly.
 *
 * It is a stylesheet matter now, and it moved to the one element in this that
 * is NEVER rebuilt: `<body>`. Three registered custom properties (`@property`
 * with `syntax: "<color>"`, which is what makes a custom property something CSS
 * can interpolate at all) hold the edge, the glow and the ink; the body
 * transitions them when `data-drpg-phase` changes; and the clock, the player's
 * strip and the Projects tray simply read the inherited value, which is already
 * moving by the time they read it. A widget rebuilt mid-transition picks the
 * animation up wherever it has got to, because the animation was never theirs.
 */

/**
 * The clock's shell: the parts that do not change between renders.
 *
 * Built once per session. The listener in particular has to live here rather
 * than in `renderHud` — attached on every render to an element that survives,
 * it would stack up one copy per redraw, and this widget redraws often.
 */
function buildHudShell() {
    const hud = document.createElement("div");
    hud.id = HUD_ID;
    // The HUD must never swallow clicks meant for the canvas behind it.
    hud.addEventListener("pointerdown", event => event.stopPropagation());
    return hud;
}

function line(className, text) {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text ?? "";
    if (!text) el.classList.add("empty");
    return el;
}

/**
 * WHAT THE CLOCK SAYS DURING A CLASS TRIAL, or null when there is not one.
 *
 * Four states, and the first is the one the floor state cannot express by
 * itself: a trial that is in session with no debate open. `trialFloor()` returns
 * null for that, which is indistinguishable from "no trial" unless the phase is
 * consulted — so the phase is what decides whether there is anything to say at
 * all, and the floor only decides which of the four words it is.
 *
 *   discussion   the trial is running; nobody has taken the floor.
 *   debate       the floor is open to everybody. This is `FLOOR_MODES.discussion`
 *                — the mode's name inside the engine is about who may speak,
 *                and the word on screen is about what is happening.
 *   objection    one person, one minute, bought with a Truth Bullet.
 *   rebuttal     two people, two minutes.
 *
 * WHO IS TALKING comes back with it, because during a trial the room block
 * below the clock stops naming the room and names them instead. Everybody is in
 * the same room during a trial — the name was the least useful line on screen at
 * exactly the moment the most useful one is "whose floor is this".
 *
 *   discussion / debate   everyone.
 *   objection             the objector, alone.
 *   rebuttal              the person answering, and underneath, who they are
 *                         answering. Note the ORDER: the defender is named
 *                         first and the objector second, because the rebuttal
 *                         is the defender's two minutes — the objection above
 *                         it already had the objector's name on its own.
 *
 * @returns {{key: string, label: string, speaker: string, versus: string|null}|null}
 */
function trialSlot() {
    try {
        if (getClock().phase !== "classTrial") return null;

        const floor = trialFloor();
        const key = !floor ? "discussion"
            : floor.mode === FLOOR_MODES.discussion ? "debate"
                : floor.mode;

        // `holder` is whoever took the floor — the objector, in both restrictive
        // modes — and `target` is who they aimed at. See `openObjection`.
        const unknown = "—";
        let speaker = game.i18n.localize("DRPG.Hud.trialEveryone");
        let versus = null;

        if (floor?.mode === FLOOR_MODES.objection) {
            speaker = floorHolder(floor)?.name ?? unknown;
        } else if (floor?.mode === FLOOR_MODES.rebuttal) {
            speaker = floorTarget(floor)?.name ?? unknown;
            versus = game.i18n.format("DRPG.Hud.trialVersus", {
                who: floorHolder(floor)?.name ?? unknown
            });
        }

        return { key, label: game.i18n.localize(`DRPG.Hud.trial.${key}`), speaker, versus };
    } catch (err) {
        // A clock that cannot work out the trial shows the time of day, which is
        // the state it was in for every session before this existed.
        error("Could not read the trial's state for the HUD", err);
        return null;
    }
}

function buildTimeRow(clock, isGM) {
    const row = document.createElement("div");
    row.className = "drpg-hud-time-row";

    // THE TRIAL TAKES THE ROW, AND TAKES THE CONTROLS OFF IT.
    //
    // Not "hidden because there is no room": the two chevrons rewind the time of
    // day and open an Eclipse, and neither is a thing that happens during a
    // trial. The mode is driven by the GM's own trial console and by players
    // spending Truth Bullets, so a control here would be a fourth way to change
    // something that already has three — and the only one of the four that could
    // do it by accident.
    const trial = trialSlot();
    if (trial) {
        const label = document.createElement("div");
        label.className = `drpg-hud-time is-trial is-${trial.key}`;
        label.textContent = trial.label;
        label.dataset.tooltip = game.i18n.localize("DRPG.Hud.trialTooltip");

        const slot = document.createElement("div");
        slot.className = "drpg-hud-time-slot";
        slot.append(label);
        row.append(slot);
        return row;
    }

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

    // Which time of day this label NAMES, which during an Eclipse is not the
    // one on the clock: the clock still reads the time of day just finished and
    // the label reads the one being placed for. The turn-over compares these
    // two keys to decide which way the labels travel, and it has to compare
    // what the reader sees moving.
    time.dataset.drpgTime = running ? incomingTimeOfDay(clock) : clock.timeOfDay;

    // The slot is what makes the turn-over readable: it clips, so both labels
    // travel through a window rather than across the HUD, and the buttons
    // either side of it do not move while they pass. What used to travel WITH
    // it — a note about the previous label, written onto the element — is gone;
    // `renderHud` reads that off the HUD it is replacing instead.
    const slot = document.createElement("div");
    slot.className = "drpg-hud-time-slot";
    slot.append(time);
    row.append(slot);

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
 * An incident is turn-based, and every turn costs the victim Sanity and then
 * Health. All of that state lived in one place: the Incident tracker window. Close
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

    /*
     * WHO AM I IN THIS, read from ownership rather than from `game.user.character`.
     *
     * `game.user.character` is the actor picked in Foundry's own user
     * configuration, and nothing in this game ever asks anybody to set it. A
     * table that assigns characters by ownership — which is every table, because
     * that is what the module's own assignment screen writes — left every
     * player with `game.user.character === null`, so `involved` was false for
     * all of them and this row was GM-only in practice. The killer and the
     * victim were playing the tensest scene in the game blind, which is the
     * exact failure the header above this function describes.
     *
     * Ownership is the answer everywhere else in the module (`ownerOf`,
     * `activeOwnerOf`, the voice loop), so it is the answer here.
     */
    const ids = new Set(game.actors
        .filter(a => a.type === "character" && a.testUserPermission(game.user, "OWNER"))
        .map(a => a.id));
    // Still preferred when it is set: a player who owns two characters gets the
    // turn indicator for the one they are actually playing.
    const assigned = game.user.character?.id;
    if (assigned) ids.add(assigned);

    const seats = [
        state.killerId,
        state.victimId,
        state.thirdId
    ].filter(Boolean);
    const ownedSeat = seats.find(id => ids.has(id)) ?? null;

    // A GM owns every character in the world, so ownership alone would make
    // every incident read as theirs and print "your turn" at somebody running
    // both sides. The seat only counts as YOURS when it is the character you
    // are actually playing — which for a GM means one they have deliberately
    // assigned to themselves, and for a player means the one they own.
    const mine = (assigned && seats.includes(assigned))
        ? assigned
        : (game.user.isGM ? null : ownedSeat);
    const involved = Boolean(mine);

    if (!game.user.isGM && !ownedSeat) return null;

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
 * Health and Sanity are reverse resources in Daggerheart — `value` counts marks,
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

/**
 * THE PAUSE RASTER IS CENTRED ON THE WORD, MEASURED RATHER THAN ASSUMED.
 * ---------------------------------------------------------------------------
 * The stylesheet lays the raster out from the centre of `#pause`, and that is
 * only the centre of the caption while nothing else is in the box and nothing
 * else has moved it. Both assumptions have been wrong at least once — core's
 * own pulse animation scales the element, a layout module can give it padding,
 * and the caption's own line-height decides where the WORD sits inside its
 * box even when the box is centred perfectly.
 *
 * So the offset is measured off the rendered caption and written as an inline
 * `background-position`. The tile is 60px with its hairline in the middle, so
 * putting a tile's top edge exactly on the caption's centre leaves the middle
 * of the word in the gap between two lines, with the nearest line 30px above
 * and its twin 30px below — symmetric by measurement, not by arithmetic about
 * a box nobody can see.
 */
function centrePauseRaster() {
    try {
        const pause = document.getElementById("pause");
        const caption = pause?.querySelector("figcaption");
        if (!pause || !caption) return;

        const box = caption.getBoundingClientRect();
        const frame = pause.getBoundingClientRect();
        if (!box.height || !frame.height) return;

        const centre = Math.round((box.top + box.height / 2) - frame.top);
        pause.style.setProperty("background-position", `center ${centre}px`, "important");
    } catch {
        // A raster a few pixels out is not worth an error in the log.
    }
}

/* ==========================================================================
 * WHERE YOU ARE STANDING
 * --------------------------------------------------------------------------
 * Three facts a player checks constantly and had to work out from three
 * different places: which room am I in (look at the map and guess where the
 * region boundary is), is there a project here (open the tray and read the
 * rooms), can I still search (spend the action and find out).
 *
 * Nothing here is new information and nothing here is a new query — every line
 * is an existing function called once more, in the one place the answer is
 * actually wanted.
 *
 * WHOSE ROOM. A player's own character. A GM's own Monokuma — not "no block at
 * all": a Monokuma walks the map freely, pays no movement economy and knows no
 * walls (see movement.mjs), so for the GM this row means "where I have parked
 * my token", which is exactly as useful as the player's version and answers the
 * same question about the same map.
 * ========================================================================== */

/**
 * The character this HUD is about, for this account.
 *
 * Same resolution player-status.mjs uses for a player — the assigned character,
 * or the single owned student when nobody assigned one — and the same one
 * voice.mjs and camera-view.mjs use for a GM: the Monokuma whose Despair pool
 * is this user's.
 */
function hudActor() {
    if (game.user.isGM) {
        return game.actors.find(a =>
            a.type === "character" && isMonokuma(a) && poolUserFor(a)?.id === game.user.id) ?? null;
    }

    const assigned = game.user.character;
    if (assigned && !isMonokuma(assigned)) return assigned;
    if (assigned) return null;

    const owned = game.actors.filter(a =>
        a.type === "character" && a.isOwner && !isMonokuma(a));
    return owned.length === 1 ? owned[0] : null;
}

/**
 * Three rows: the room, whether it holds a project, and its search tokens —
 * or, during a Class Trial, who is talking. See `buildTrialSpeaker`.
 */
function buildRoom() {
    try {
        // Checked FIRST, and deliberately before `hudActor()`: the trial block
        // is about the trial rather than about you, so a GM with no Monokuma of
        // their own — who gets no room block at all the rest of the time — must
        // still see whose floor it is.
        const trial = trialSlot();
        if (trial) return buildTrialSpeaker(trial);

        const actor = hudActor();
        if (!actor) return null;

        const room = roomOfActor(actor);

        const box = document.createElement("div");
        box.className = "drpg-hud-room";
        box.append(line("drpg-hud-room-name", room ?? game.i18n.localize("DRPG.Hud.roomNowhere")));

        // No room, nothing true to say about projects or searching in it. The
        // name row stays, because "you are between rooms" is itself the answer
        // to the question the block is asked.
        if (!room) return box;

        // A GM sees every project in the room, including the secret ones —
        // `canSee()` opens with `if (user?.isGM) return true`. That is correct
        // and needs no branch here: one call, two roles, two right answers.
        // The NAME is never rendered, for either of them: this widget is on
        // screen while people share a screen, and a project's name is exactly
        // the thing the guide keeps between its owner and the GM.
        const projects = projectsAvailableIn(room, game.user);
        box.append(line("drpg-hud-room-project", game.i18n.localize(projects.length
            ? "DRPG.Hud.roomProject" : "DRPG.Hud.roomNoProject")));

        box.append(buildSearchPips(room));
        return box;
    } catch (err) {
        // The HUD is the frame around the game; a room that cannot be resolved
        // must not take the clock down with it.
        error("Could not build the HUD's room block", err);
        return null;
    }
}

/**
 * The same three rows, saying who is talking instead of where you are.
 *
 * WHY THE ROOM GOES. During a Class Trial everybody is in the same room, so its
 * name is the least useful line on the widget at exactly the moment the most
 * useful one — whose floor is this — has nowhere to live. The rows are reused
 * rather than added, so the clock is the same shape and height in a trial as
 * out of one.
 *
 *   row 1   who is talking. "Everyone" in a discussion or a debate; the
 *           objector alone during an objection; the person answering, during a
 *           rebuttal.
 *   row 2   who they are answering, during a rebuttal. An em dash otherwise —
 *           the row keeps its place rather than collapsing, so the block does
 *           not change height when a rebuttal opens.
 *   row 3   the search pips, greyed. Nothing can be searched from inside a
 *           trial, and removing them would say the room had none left.
 */
function buildTrialSpeaker(trial) {
    const box = document.createElement("div");
    box.className = "drpg-hud-room is-trial";

    box.append(line("drpg-hud-room-name", trial.speaker));
    // NOT `line()`'s empty branch: an em dash is content, and the `empty` class
    // it would add fades the row to a third of its opacity.
    const versus = line("drpg-hud-room-project", trial.versus ?? "—");
    versus.classList.toggle("is-versus", Boolean(trial.versus));
    box.append(versus);

    // Whichever room this client's own character is standing in — which during a
    // trial is the courtroom for everybody. Skipped entirely when there is no
    // character to ask about, rather than drawn empty.
    try {
        const room = roomOfActor(hudActor());
        if (room) box.append(buildSearchPips(room, { idle: true }));
    } catch {
        // A block that is missing its pips is still the block that matters.
    }

    return box;
}

/**
 * The room's search tokens, as pips.
 *
 * Drawn as spans with a border-radius rather than as ● and ○, because the two
 * Unicode circles have different advance widths in the pixel font and a row
 * that mixes them staggers. A screen reader gets the number instead: three
 * dots are not a readout.
 */
function buildSearchPips(room, { idle = false } = {}) {
    const max = SearchTokens.max;
    // A sealed room has its three tokens sitting untouched in the store and
    // none of them can be spent, so drawing them would be the widget promising
    // something the sheet then refuses. Shown empty and struck through instead.
    const sealed = SearchTokens.sealed(room);
    const left = sealed ? 0 : SearchTokens.left(room);

    const row = document.createElement("div");
    row.className = `drpg-hud-room-tokens${idle ? " is-idle" : ""}${sealed ? " is-sealed" : ""}`;
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", sealed
        ? game.i18n.localize("DRPG.SearchTokens.sealed")
        : game.i18n.format("DRPG.Hud.roomTokens", { left, max }));
    row.dataset.tooltip = sealed
        ? game.i18n.localize("DRPG.SearchTokens.sealed")
        : game.i18n.format("DRPG.Hud.roomTokensTooltip", { left, max });

    for (let i = 0; i < max; i++) {
        const pip = document.createElement("span");
        pip.className = i < left ? "drpg-hud-pip full" : "drpg-hud-pip";
        row.append(pip);
    }
    return row;
}

/**
 * The motive, and how many times of day are left on it.
 *
 * The demand is the row; the consequence is the tooltip. Two sentences in the
 * corner of the screen is a paragraph, and a paragraph in a HUD is something
 * people stop reading — but the consequence is the half a player actually
 * needs when they decide whether to take the threat seriously, so it has to be
 * one hover away rather than in a chat log two hundred messages back.
 *
 * At zero the row does not disappear. It says the deadline has arrived, which
 * is the only moment the countdown was ever for.
 */
function buildMotive() {
    const record = motive();
    if (!record) return null;

    const el = document.createElement("div");
    el.className = "drpg-hud-motive";
    if (record.due) el.classList.add("due");

    const left = record.due
        ? game.i18n.localize("DRPG.Motive.dueShort")
        : plural("DRPG.Motive.left", { n: record.remaining ?? 0 });

    el.innerHTML = `<span class="drpg-hud-motive-label">${
        game.i18n.localize("DRPG.Motive.title")}</span><span class="drpg-hud-motive-left">${
        foundry.utils.escapeHTML(left)}</span>`;

    const parts = [foundry.utils.escapeHTML(record.text)];
    if (record.consequence) {
        parts.push(`<em>${game.i18n.format("DRPG.Motive.orElse", {
            what: foundry.utils.escapeHTML(record.consequence)
        })}</em>`);
    }
    el.dataset.tooltip = parts.join("<br>");

    return el;
}

/**
 * The assembly Monokuma has called and not yet held.
 *
 * Deferring Public Announcement created a fact the cast has to plan around,
 * and a fact you plan around cannot live only in scrollback. It names the room
 * and says when — and it is gone the moment the assembly happens.
 */
function buildAssembly() {
    const order = pendingGather();
    if (!order) return null;

    const el = document.createElement("div");
    el.className = "drpg-hud-assembly";
    el.innerHTML = `<span class="drpg-hud-assembly-label">${
        game.i18n.localize("DRPG.Calls.gatherShort")}</span><span class="drpg-hud-assembly-room">${
        foundry.utils.escapeHTML(order.room)}</span>`;
    el.dataset.tooltip = game.i18n.format("DRPG.Calls.gatherBody", {
        room: foundry.utils.escapeHTML(order.room)
    });

    return el;
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
    // Ten seconds for the minutes readout — it is in whole minutes, so a
    // per-second tick would repaint sixty times for each visible change — and
    // one second while a debate is running, where every tick is a visible
    // change and the number is the thing people are watching.
    //
    // Which of the two is decided here rather than inside the tick, so the
    // period changes when the HUD is rebuilt: the floor opening and closing both
    // go through `SYNC.trial`, which redraws this widget.
    const period = trialFloor() ? 1000 : 10_000;
    elapsedTimer = setInterval(() => {
        // The HUD is rebuilt often; when this node is gone, so is the interval.
        if (!el.isConnected) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
            return;
        }
        paintElapsed(el);
    }, period);

    return el;
}

function paintElapsed(el) {
    // A DEBATE'S CLOCK OUTRANKS THE TIME OF DAY'S.
    //
    // The minutes readout is pacing advice about spending two actions inside
    // half an hour, and a Class Trial has no actions to spend — so during one it
    // is a number that means nothing sitting where the number that means
    // everything should be.
    //
    // Only while a floor is actually open. A trial in session with nobody
    // holding the floor has no clock running, and inventing one — a stopwatch on
    // the trial, a countdown to nothing — would be the module making up a rule.
    // In that state the line goes back to what it has always been.
    const floor = trialFloor();
    if (floor) return paintFloorClock(el, floor);

    // Back from a debate. The tooltip is restored with the class, or a line
    // reading "22 min in" keeps explaining how long the debate has left.
    el.classList.remove("is-trial-clock", "overrun");
    el.dataset.tooltip = game.i18n.localize("DRPG.Hud.elapsedTooltip");

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
 * How long this mode has left, counting down, in the elapsed line's place.
 *
 * Derived from the floor's `startedAt` exactly as the old bar's was, so every
 * client shows the same second without anybody broadcasting it.
 *
 * The overrun mark is only ever put on a debate. The other two modes end
 * themselves the moment they reach zero, so a red number there would be the
 * half-second before the transition lands rather than a state anybody is in.
 */
function paintFloorClock(el, floor) {
    const left = secondsLeft(floor);
    const over = left < 0;
    const mins = Math.floor(Math.abs(left) / 60);
    const secs = String(Math.abs(left) % 60).padStart(2, "0");

    el.classList.remove("past-first", "past-second", "paused", "empty");
    el.classList.add("is-trial-clock");
    el.classList.toggle("overrun", over && floor.mode === FLOOR_MODES.discussion);
    el.textContent = `${over ? "+" : ""}${mins}:${secs}`;
    el.dataset.tooltip = game.i18n.localize("DRPG.Hud.trialClockTooltip");
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
