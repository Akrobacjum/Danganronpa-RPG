/**
 * Danganronpa RPG - telling every client what just happened.
 * ---------------------------------------------------------------------------
 * World settings synchronise by themselves: a GM writes, and every client's copy
 * updates. What does NOT travel is the work that follows the write - redrawing
 * the HUD, dimming the canvas for an Eclipse, recomputing who can see whose
 * token, re-rendering open sheets.
 *
 * That work was being driven by `Hooks.callAll(...)` immediately after the
 * write, which runs on the writer's client and nowhere else. On one machine
 * with a GM window and a player window it looked fine, because both windows
 * were the same browser and the settings `onChange` covered the gap. On a real
 * server it was not fine: the clock advanced for the GM alone.
 *
 * So every world-state change is announced here, on the module's own socket, and
 * every client - the sender included - reacts identically. One code path, no
 * "works on my machine".
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { debug, error } from "./utils.mjs";
import { getClock, isEclipse } from "./settings.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION = "sync";

/** What can be announced. Add a kind here and a handler in `apply`. */
export const SYNC = {
    /** The clock moved: time of day, day, session, chapter, phase. */
    clock: "clock",
    /** An Eclipse started or ended. */
    eclipse: "eclipse",
    /** Room occupancy changed enough to redraw who sees whom. */
    visibility: "visibility",
    /** A project was created, advanced, frozen or made secret. */
    projects: "projects",
    /** A Despair pool changed. */
    despair: "despair",
    /** Search tokens were spent or restocked. */
    searchTokens: "searchTokens",
    /** A room was sealed or unsealed, or a player silenced or chained. */
    restrictions: "restrictions",
    /** The Class Trial's speaking floor moved. */
    trial: "trial",
    /** A killing game rule was introduced, reworded or revoked. */
    rules: "rules",
    /** A room was discovered, or the GM edited the fog table by hand. */
    fog: "fog",
    /**
     * The Despair Overflow counter moved, fired, or had its rules edited.
     *
     * ITS OWN KIND RATHER THAN `despair`, because it touches three surfaces and
     * that one touches two. The caption lives in the Despair widget, the search
     * tokens and the clock row live in the HUD, and the action budget is
     * printed on every sheet - a darkening that redrew only the bar would leave
     * two of its three effects invisible until something else happened to
     * redraw them.
     */
    overflow: "overflow",
    /**
     * The cast was gathered into one room: `{ room, scene, tokenIds }`, the tokens moved
     * (call-world.mjs `gatherEveryone`). Each client pans its camera to its own token among
     * them (`panToGathered`); nothing is written (E11 C3).
     */
    gather: "gather",
    /**
     * The readiness round before the clock moves was opened, answered or ended (E37 C3; boundary.mjs): a player's
     * window opens or closes. The GM's window keeps itself live on the setting (live.mjs `keepLive`).
     */
    ready: "ready"
};

/**
 * Which world setting, when it changes, means which refresh.
 *
 * The socket is the fast path, but it is not the *reliable* one: it needs
 * `registerSync()` to have run on the receiving client, the module's socket to
 * be up, and the sender to still be connected. A world setting needs none of
 * that. Foundry syncs the Setting document to every client and calls the
 * registered `onChange` there, so keying the refresh off the setting itself is
 * the path that cannot be missed - see settings.mjs, which routes every one of
 * these through `applyFor()`.
 */
const SETTING_KINDS = {
    clock: SYNC.clock,
    sealedRooms: SYNC.restrictions,
    restrictions: SYNC.restrictions,
    despairPools: SYNC.despair,
    // Re-pointing a Monokuma at another pool changes what every open sheet
    // should be showing, so it travels the same road as the pools themselves.
    monokumaPools: SYNC.despair,
    // A renamed or newly added pool changes the same widget.
    poolNames: SYNC.despair,
    extraPoolUsers: SYNC.despair,
    searchTokens: SYNC.searchTokens,
    projectMeta: SYNC.projects,
    // An incident turn changes what both participants may do right now, so the
    // sheets have to redraw the moment the state moves.
    murderState: SYNC.restrictions,
    // The body card is a card on the Event panel, which `renderHud` redraws -
    // and the music state machine reads this too. `restrictions` already
    // redraws the HUD and every open sheet, which is the whole of what changes.
    bodyFound: SYNC.restrictions,
    // The floor passing to somebody else changes a countdown every client is
    // watching, so it has to land everywhere at once.
    trialQueue: SYNC.trial,
    // The vote being counted changes which buttons the GM's trial console will
    // let them press, so it travels the same road as the floor.
    trialProgress: SYNC.trial,
    // Every sheet carries the rules list, so a new rule has to redraw them all.
    killingGameRules: SYNC.rules,
    // The motive sits beside them and is read the same way. Its countdown is
    // a HUD row, which is why `SYNC.rules` redraws the HUD as well as the
    // sheets - see the case below.
    motive: SYNC.rules,
    // A called assembly changes two things at once: the HUD row every player
    // reads, and the Public Announcement tile on a Monokuma's sheet, which is
    // its own cancel button while one is pending. `restrictions` already
    // redraws both, and a summons IS a restriction on where the next time of
    // day starts.
    pendingGather: SYNC.restrictions,
    // The safeword is printed on every character sheet, so changing it has to
    // redraw them all - and without an entry here `onWorldChange` would call
    // `applyFor("safeword")`, find no kind, and return silently. That is trap
    // 110, and it is the same shape as the motive's: a setting that syncs
    // itself and a screen that never hears about it.
    safeword: SYNC.rules,
    discoveredRooms: SYNC.fog,
    // Both halves of Z10, and both really do need the redraw: the counter
    // because its caption is on screen, the rules because editing X changes
    // the "?/X" every client is reading.
    overflow: SYNC.overflow,
    overflowRules: SYNC.overflow,
    readyRound: SYNC.ready
};

export function registerSync() {
    game.socket.on(SOCKET_EVENT, (payload, senderId) => {
        if (payload?.action !== ACTION) return;
        // Only a GM announces world state. Every caller of `broadcast` is a
        // GM-side write (the clock, the Eclipse, Despair Call restrictions), so
        // this refuses nothing legitimate - and without it any player could hand
        // every other client a fabricated clock to redraw against.
        if (!game.users.get(senderId)?.isGM) return;
        apply(payload.kind, payload.data);
    });
    // The clock as this browser found it (E17 C6): what its first change is news against. Read here, at once:
    // module.mjs registers this inside `ready`, where a `Hooks.once("ready")` would never be called.
    try { heard ??= clockNews(null, getClock()).heard; } catch (err) { error("Could not read the clock at ready", err); }
}

/**
 * Run one kind's refresh on this client, for what changes without being a world
 * setting: a GM store's key, or a player's copy of one (E05) - a name of `SYNC`.
 */
export function applyKind(kind, data = {}) {
    if (Object.values(SYNC).includes(kind)) apply(kind, data);
}

/**
 * Refresh in response to a world setting changing. Called from the settings'
 * own `onChange`, which Foundry runs on every client that receives the update.
 */
export function applyFor(settingKey, data = {}) {
    const kind = SETTING_KINDS[settingKey];
    if (!kind) return;
    apply(kind, data);
}

/**
 * Whether a world setting (by its bare key) travels this bus. The HUD's own
 * `updateSetting` hook asks, so a key that already redraws it through a sync
 * kind is not drawn a second time by the hook (CORE-12).
 */
export function isSyncedSetting(settingKey) {
    return Boolean(SETTING_KINDS[settingKey]);
}

/**
 * Announce a change to every client, and apply it here.
 *
 * Safe to call from any client. The local half runs regardless of who is
 * connected, so a single-GM world behaves the same as a full table.
 */
export function broadcast(kind, data = {}) {
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION, kind, data });
    } catch (err) {
        error(`Could not broadcast "${kind}"`, err);
    }
    apply(kind, data);
}

/**
 * React to a change, wherever it came from.
 *
 * Every branch is defensive: a client that cannot do one part of the refresh -
 * no canvas yet, a sheet mid-render - must still do the rest.
 *
 * The socket announcement and the setting's own `onChange` describe the same
 * event, and on a healthy connection both arrive. Doing the work twice is
 * wasteful - re-rendering every open sheet is not cheap - so events of one kind
 * arriving close together are merged into one run.
 *
 * Merged, NOT discarded. This used to return early and throw the second event
 * away, which is only safe when the two describe the same state. They often do
 * not: a Despair Call spends and then refunds within a few milliseconds, and
 * clearing the seals writes two settings back to back. In both cases the screen
 * was left showing the state *before* the final write, with no further event
 * coming to correct it. The run always applies the newest data.
 *
 * AND MERGED NOW, WHICH IT WAS NOT (E17 C6, 26.10.2026; audit S01-30). What this said
 * was a first event run at once and a second one `coalesceMs` later: the clock
 * setting's `onChange` and the GM's broadcast of the same write were two whole
 * refreshes on every browser, `drpgTimeOfDayChanged` twice and the visibility pass
 * four times. `coalescer` is a trailing wait per kind: each event of the kind
 * restarts it, the run comes `coalesceMs` after the burst's last event and never
 * later than `COALESCE_MAX_WAIT_MS` after its first, with the burst's fields merged,
 * the newest winning (R995). Every redraw comes `coalesceMs` later than its first
 * event did before: 120 ms, against the 400 ms the suite's `settle` waits.
 */
const COALESCE_MS = TIMING.coalesceMs;

/**
 * The longest a kind's run waits for a burst to end, in ms (E17 C6): three waits. A
 * design number, not a measured one - no scenario reads how long a burst of the
 * clock's writes lasts; it holds a stream of events (a trial's floor ticking, a run of
 * Despair spends) to a redraw at least every 360 ms, inside the suite's 400 ms settle.
 * The stage asked for it measured in scenario 40; it was not (E17 fix p2-G3, the end
 * review's E17p2-R7): the harness's server and socket are a shim, whose spread between
 * a setting's change and the GM's broadcast is no server's. The reading is LIVE-E17-11
 * (audit/AUDIT-1.2.42.md 9.2, item 316), to be written here.
 */
export const COALESCE_MAX_WAIT_MS = COALESCE_MS * 3;

/**
 * A trailing debounce per kind (E17 C6; R995): `push(kind, data)` returns at once, and
 * `run(kind, merged)` is called `wait` ms after the kind's last push, at most `maxWait`
 * ms after the first push of the burst; `merged` is the burst's data, each field the
 * newest push's. The clock and the timers are parameters so the suite can drive it
 * without waiting.
 */
export function coalescer(run, {
    wait = COALESCE_MS, maxWait = COALESCE_MAX_WAIT_MS, now = () => Date.now(),
    schedule = (fn, ms) => setTimeout(fn, ms), cancel = id => clearTimeout(id)
} = {}) {
    const pending = new Map();
    const push = (kind, data = {}) => {
        const at = now();
        const held = pending.get(kind);
        const entry = held ?? { first: at, data: {}, timer: null };
        if (held) cancel(held.timer);
        entry.data = { ...entry.data, ...(data ?? {}) };
        const due = Math.min(at + wait, entry.first + maxWait);
        entry.timer = schedule(() => {
            pending.delete(kind);
            run(kind, entry.data);
        }, Math.max(0, due - at));
        pending.set(kind, entry);
        if (held) debug(`sync: ${kind} merged`);
    };
    /* The kinds whose run is still to come (E17 fix ci-3): what `syncIdle` waits out. */
    push.pending = () => [...pending.keys()];
    return push;
}

const apply = coalescer((kind, data) => refresh(kind, data));

/** The runs `refresh` started and that have not settled yet, each with its kind (E17 fix ci-3; `syncIdle`). */
const running = new Map();

/**
 * WHEN THE BUS HAS NOTHING LEFT TO DO ON THIS BROWSER (E17 fix ci-3, 26.10.2026; CI run 40418039458 on 15f204c5,
 * suite 2/8). Resolves once no run of `kinds` (every kind when none is named) is waiting in `apply` and every run of
 * them `refresh` started has settled - its redraws done and its hooks called (`drpgTimeOfDayChanged` and the rest go
 * out inside one such run) - looking again after each wait, since a run can push another. Answers the kinds it saw
 * waiting. Bounded by `timeout` (ms): a run that never settles is let go rather than waited on for ever, and the
 * caller reads the world as it then stands.
 *
 * For whoever writes the world and then reads it back whole - tier 2's restore. Since E17 C6 a write of the clock
 * runs `coalesceMs` after its burst's last event and at most `COALESCE_MAX_WAIT_MS` after its first, where it ran at
 * once before; a test that put its clock back in its `finally` and returned had its time of day's run - and the
 * trace digest that run sends the GMs (remnants.mjs `flushTraceDigest`) - land after the restore had deleted the
 * test's chat: measured on the harness 26.10, "a Key row's Place button ...": the restore's deletion at +17 ms, the
 * clock's run at +109 ms, the digest of the test's Key trace at +178 ms, and "restore left: ... ChatMessage appeared".
 * What a hook's listener goes on to do after its first await is not a run of the bus and not waited on here; the
 * listener that posts a card says when it is done itself (`traceDigestIdle`), as the owed Despair does
 * (`settleOwed`).
 */
export async function syncIdle({ kinds = null, timeout = COALESCE_MAX_WAIT_MS * 10 } = {}) {
    const asked = kind => !kinds || kinds.includes(kind);
    const seen = new Set();
    const deadline = Date.now() + timeout;
    for (;;) {
        const waiting = apply.pending().filter(asked);
        waiting.forEach(kind => seen.add(kind));
        const runs = [...running].filter(([, kind]) => asked(kind)).map(([held]) => held);
        if (!waiting.length && !runs.length) return [...seen];
        const left = deadline - Date.now();
        if (left <= 0) return [...seen];
        const step = new Promise(resolve => setTimeout(resolve, Math.min(left, waiting.length ? TIMING.coalesceMs / 4 : left)));
        await (waiting.length ? step : Promise.race([Promise.allSettled(runs), step]));
    }
}

/**
 * WHAT THIS BROWSER LAST TOLD ITS LISTENERS ABOUT THE CLOCK (E17 C6, 26.10.2026; audit
 * S01-30): `{ json, calendar, phase, eclipse }`, or null before `ready`. The clock branch
 * hung `drpgTimeOfDayChanged` on every write of the clock - a pause, a campaign's new
 * name, a phase, the Eclipse's flag - to listeners that read it as the time moving
 * (the owed Despair paid, the betrayal windows swept, the trace digest sent). Read at
 * `ready` (`registerSync`), so a browser that loads mid-Eclipse is not told the
 * Eclipse began (`clockHeard`, R995, reads that it was); the Eclipse branch reads
 * and writes its `eclipse` too, so whichever of the clock's write and
 * `broadcastEclipse` lands first tells the listeners, once.
 */
let heard = null;

/** What this browser last told its listeners of the clock (`heard`), or null: for the suite (R995). */
export const clockHeard = () => heard;

/**
 * The clock branch's reading (R995): `same` (nothing in the clock moved since `heard`),
 * `timeOfDay` (the season, chapter, day, session or time of day moved), `phase`,
 * `eclipse` (its flag flipped), and `heard`, the reading to keep. With no `heard`
 * everything is news, as every run was before E17 C6. Pure.
 */
export function clockNews(before, clock) {
    const calendar = JSON.stringify([clock?.season ?? null, clock?.chapter ?? null, clock?.day ?? null,
        clock?.session ?? null, clock?.timeOfDay ?? null]);
    const next = { json: JSON.stringify(clock ?? null), calendar, phase: clock?.phase ?? null, eclipse: clock?.eclipse === true };
    if (!before) return { same: false, timeOfDay: true, phase: true, eclipse: true, heard: next };
    return {
        same: next.json === before.json,
        timeOfDay: next.calendar !== before.calendar,
        phase: next.phase !== before.phase,
        eclipse: next.eclipse !== before.eclipse,
        heard: next
    };
}

function refresh(kind, data = {}) {
    debug(`sync: ${kind}`, data);

    const run = (label, fn) => {
        try {
            const result = fn();
            if (result?.catch) {
                // Held until it settles, for `syncIdle` (E17 fix ci-3).
                const held = result.catch(err => error(`sync ${kind}/${label} failed`, err));
                running.set(held, kind);
                held.finally(() => running.delete(held));
            }
        } catch (err) {
            error(`sync ${kind}/${label} failed`, err);
        }
    };

    switch (kind) {
        case SYNC.clock: {
            /*
             * ONE RUN PER CHANGE OF THE CLOCK, AND EACH HOOK FOR WHAT IT NAMES (E17 C6, 26.10.2026; audit S01-30).
             * The clock is the setting as it stands when the run comes, never the socket's copy: the copy can arrive
             * before the setting lands here, and the setting's own `onChange` always follows it. A run that finds
             * nothing moved since the last one this browser made (`clockNews`: the copy before its setting, the
             * second of a pair the coalescer did not merge) redraws nothing. `drpgTimeOfDayChanged` only when the
             * calendar moved - season, chapter, day, session, time of day; `drpgPhaseChanged` (new) for the phase,
             * whose readers of the old hook had other roads already (music.mjs and voice.mjs hear the clock's
             * `updateSetting`, visibility is called below; a11y.mjs and live.mjs listen to it now); and
             * `drpgEclipseChanged` when the flag flipped - here, at the clock's own write, so a GM gone before
             * `broadcastEclipse` (sent after the whispers) leaves no browser dark without its fog, summary and voice
             * told. The Eclipse branch below reads the same `heard` and tells nobody twice.
             */
            const clock = getClock();
            const news = clockNews(heard, clock);
            if (news.same) break;
            heard = news.heard;
            /*
             * A CALLED ASSEMBLY IS HELD HERE, AND BY ONE CLIENT ONLY.
             *
             * `runPendingGather` refuses on anybody but the primary GM and on
             * an order that is not ripe yet, then clears the order BEFORE it
             * moves anybody - so the second arrival of this event (the socket
             * and the setting's `onChange` both describe it) finds nothing to
             * do. First, because a teleport that lands after the HUD redraw
             * shows the cast a room they are no longer standing in.
             */
            run("assembly", () => import("./call-effects.mjs").then(m => m.runPendingGather()));
            /*
             * THE CLOCK IS WHAT ENDS A DARKENING (Dawid, 31.08).
             *
             * "Darkened - this time of day" stayed on the caption after the
             * time of day it named had passed. Nothing was wrong with the
             * mechanic: `overflowEffect()` compares the armed stamp against the
             * clock, so it had already stopped answering - every reader that
             * asks at the moment it acts was correct. It was the one reader
             * that does NOT ask again, the pixels, and the pixels are the only
             * place the table looks.
             *
             * Measured before the fix: stamp on `evening`, clock moved to
             * `night`, `overflowStatus().active` false and the badge still in
             * the DOM. A manual `renderDespairBar()` cleared it.
             *
             * The caption reads the CLOCK as much as it reads the counter, so
             * it belongs on both roads. `SYNC.overflow` already redraws it when
             * the counter or the stamp moves; this is the other half - the
             * stamp standing still while the clock walks out from under it. It
             * covers the arrival too: a stamp armed mid-hour for the hour ahead
             * lights up when that hour begins, and until now that also waited
             * for something unrelated to redraw the widget.
             */
            run("bar", () => import("./despair.mjs").then(m => m.renderDespairBar?.()));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            /* The body class only; the HUD and the visibility pass are the two
               lines either side of it (CORE-12).
               NOT "once each", which is what this said until 16.09. `applyAll`
               is bound to `drpgTimeOfDayChanged` as well (visibility.mjs:61), and
               that hook is fired below - so a change of the time of day runs the
               visibility pass TWICE on every client, and an Eclipse change does
               the same through `drpgEclipseChanged`. Left as it is rather than
               fixed: dropping the direct call would make room visibility depend
               on hook ordering, and coalescing `applyAll` touches the one path
               that gives other people's hidden tokens back (see its own note).
               It is once per time of day, not per frame, and it has not been
               priced - but the claim had to stop being made. Since E17 C6 a
               write of the clock that moves neither (a pause, a name) runs it
               once, and a write already told runs nothing. */
            run("eclipse", () => import("./eclipse.mjs").then(m => m.refreshEclipse()));
            run("visibility", () => import("./visibility.mjs").then(m => m.applyAll()));
            // Local listeners (other modules, macros) still get their hook - but
            // now they get it on every client, which is what they always meant.
            // A listener is handed the clock as the setting holds it, never an
            // empty object, and the summary when the burst held the GM's broadcast.
            // Each hook goes out through a module's import, as it did before C6, so
            // it comes after the redraws queued above it (`later`).
            const later = fire => import("./clock.mjs").then(fire);
            if (news.timeOfDay) run("hook", () => later(() => Hooks.callAll("drpgTimeOfDayChanged", clock, data.summary ?? {})));
            if (news.phase) run("phase", () => later(() => Hooks.callAll("drpgPhaseChanged", clock.phase ?? null)));
            if (news.eclipse) run("eclipseHook", () => later(() => Hooks.callAll("drpgEclipseChanged", clock.eclipse === true)));
            break;
        }

        case SYNC.eclipse: {
            /* ONCE PER CHANGE (E17 C6, 26.10.2026; audit S01-30). The clock's own write of the flag reaches the
               clock branch above, which redraws all of what follows and tells `drpgEclipseChanged`; the GM's
               `broadcastEclipse` comes later, after the whispers, and finds the change told (`heard.eclipse`).
               Whichever lands first tells it. Before `ready` (no `heard`) every one runs, as before. */
            const active = data.active ?? isEclipse();
            if (heard && heard.eclipse === active) break;
            if (heard) heard = { ...heard, eclipse: active };
            run("eclipse", () => import("./eclipse.mjs").then(m => m.refreshEclipse()));
            // The same caption, and the same reason. `overflowEffect()` has an
            // Eclipse branch: while one runs the clock has not moved yet, so a
            // stamp armed for the time of day the Eclipse opens counts as
            // running already. That answer flips when the Eclipse starts and
            // when it ends, and neither of those is a counter change.
            run("bar", () => import("./despair.mjs").then(m => m.renderDespairBar?.()));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            run("visibility", () => import("./visibility.mjs").then(m => m.applyAll()));
            // Every other sync kind re-renders open character sheets; this one
            // did not. The action panel and Calls panel both read `isEclipse()`
            // at render time (see sheet.mjs), so a sheet already open when the
            // Eclipse starts or ends was left showing the pre-Eclipse state -
            // actions and Calls looking normally clickable when they are not,
            // or still greyed out a whole time of day after they came back.
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            run("hook", () => import("./eclipse.mjs").then(() => Hooks.callAll("drpgEclipseChanged", active)));
            break;
        }

        case SYNC.visibility:
            run("visibility", () => import("./visibility.mjs").then(m => m.applyAll()));
            // The only thing drawn through this kind is the Eclipse's crossings -
            // the GMs' store and an owner's copy since E05, which are no world
            // settings and name the kind themselves (settings.mjs `onStoreChange`)
            // - and that number is printed on the sheet twice - the budget line
            // and the Move tile's own cost label - so a crossing has to redraw them.
            // At most two writes per character per Eclipse, so this is not the
            // per-frame cost that its name suggests.
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            break;

        case SYNC.projects:
            run("tray", () => import("./projects-ui.mjs").then(m => m.refreshProjects?.()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            // The HUD's project row for this room.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            /* And the map. `projectMeta` is where a project's ROOM and its
               SECRECY live, and both decide whether this client may see its
               token - so a reveal, or a project moved to another room, has to
               re-ask `knowsProject` here. The token being dragged somewhere
               else is already covered: that is an `updateToken`, which
               visibility.mjs hears directly. This is the case that has no
               document change to hang off. */
            run("projectTokens", () => import("./visibility.mjs").then(m => m.applyAll?.()));
            break;

        case SYNC.despair:
            run("bar", () => import("./despair.mjs").then(m => m.renderDespairBar?.()));
            /* THE MONOKUMAS' SHEETS ONLY (E88 C4, 27.10.2026; E88-09, E37's line taken early). A pool, its name, who
               holds one and which pool a Monokuma spends are read on a sheet by the Monokuma's Despair panel alone
               (sheet.mjs `monokumaPool`, asked where `isMonokuma` built the panel); a student's sheet reads none of
               them, and every one open was rendered on each Despair spent. Scenario 86 at 7baff238: a pass on every
               browser for each write. A student's sheet is still rendered by its own actor's update (a Despair Call's
               Hope, a Reroll's), which is not this road. */
            run("sheets", () => Promise.all([import("./clock.mjs"), import("./monokuma.mjs")])
                .then(([clock, monokuma]) => clock.refreshSheets({ only: monokuma.isMonokuma })));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            break;

        case SYNC.overflow:
            // All three, in the order a reader's eye travels: the caption that
            // says how close it is, the HUD row that says what the world costs
            // now, and the sheets that carry the shrunken action budget.
            run("bar", () => import("./despair.mjs").then(m => m.renderDespairBar?.()));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            break;

        case SYNC.searchTokens:
            // The world setting has just landed, so it is authoritative again -
            // drop the player-side "GM just told me" cache rather than let it
            // outlive the value it was standing in for.
            run("cache", () => import("./search-tokens.mjs").then(m => m.SearchTokens.clearFreshCounts()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            // The room pips on the HUD.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            break;

        case SYNC.restrictions:
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            // The HUD carries the incident line - whose turn it is and what the
            // victim has left. That moves on every crisis action, so it has to
            // redraw here too; without this it only refreshed when the clock
            // happened to move, which during an incident it does not.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            break;

        case SYNC.trial:
            run("floor", () => import("./trial-floor.mjs").then(m => m.renderTrialFloor()));
            // The trial's three facts are three rows of the campaign HUD now -
            // which mode, how long is left, and the room - so the floor moving
            // is a HUD redraw. Without this the mode label was only ever
            // refreshed when the clock happened to move, which during a trial it
            // does not, and the turn-over animation between one mode and the
            // next never played at all.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            // A Truth Bullet's row on a sheet is Present only since 1.2.79 (E79 C16), so the floor moving
            // repaints no row; the OBJECTION! that took its place is the HUD's, redrawn above.
            // The voice tile's microphone (E70 C5): the trial's list of the dead and a Monocub's line follow the floor
            // and the record (voice.mjs `micHold`), and a client setting's or the user's own change does not come here.
            run("voiceTile", () => import("./voice-tile.mjs").then(m => m.paintControls()));
            break;

        case SYNC.rules:
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            // The motive travels this road and its countdown is a HUD row, so
            // this kind stopped being sheets-only at E14. Rules and motives
            // change a handful of times per chapter, so the extra redraw costs
            // nothing worth counting.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            break;

        case SYNC.fog:
            // The mirror first: a ledger that SHRANK (season reset, "hide
            // all") has to take this client's session mirror with it, or the
            // repaint redraws the stale union and the reset only shows after a
            // reload - see `reconcileMirror` in fog.mjs.
            run("fog", () => import("./fog.mjs").then(m => {
                m.reconcileMirror();
                return m.repaintFog();
            }));

            /* WALKING INTO A ROOM FINDS THE PROJECT IN IT (stage 2).
               ---------------------------------------------------------------
               Discovery is what `knowsProject` reads, so the two surfaces that
               ask it have to be redrawn when the ledger moves, or a player
               walks into a room and the project appears only when something
               else happens to redraw - which on a quiet table can be minutes.

               Neither redraw can ride the client's own `updateToken` hook
               instead: the ledger is written by the PRIMARY GM and comes back
               round the socket, so by the time this client heard its token had
               moved, the answer was still "no". This is the moment the answer
               changes. */
            run("projectTray", () => import("./projects-ui.mjs").then(m => m.refreshProjects?.()));
            run("projectTokens", () => import("./visibility.mjs").then(m => m.applyAll?.()));
            break;

        case SYNC.gather:
            run("camera", () => import("./call-world.mjs").then(m => m.panToGathered(data)));
            break;

        case SYNC.ready:
            run("window", () => import("./boundary.mjs").then(m => m.renderReadyRound()));
            break;

        default:
            debug(`sync: unknown kind "${kind}" ignored`);
    }
}
