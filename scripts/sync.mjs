/**
 * Danganronpa RPG — telling every client what just happened.
 * ---------------------------------------------------------------------------
 * World settings synchronise by themselves: a GM writes, and every client's copy
 * updates. What does NOT travel is the work that follows the write — redrawing
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
 * every client — the sender included — reacts identically. One code path, no
 * "works on my machine".
 */

import { MODULE_ID } from "./config.mjs";
import { debug, error } from "./utils.mjs";

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
    fog: "fog"
};

/**
 * Which world setting, when it changes, means which refresh.
 *
 * The socket is the fast path, but it is not the *reliable* one: it needs
 * `registerSync()` to have run on the receiving client, the module's socket to
 * be up, and the sender to still be connected. A world setting needs none of
 * that. Foundry syncs the Setting document to every client and calls the
 * registered `onChange` there, so keying the refresh off the setting itself is
 * the path that cannot be missed — see settings.mjs, which routes every one of
 * these through `applyFor()`.
 */
const SETTING_KINDS = {
    clock: SYNC.clock,
    sealedRooms: SYNC.restrictions,
    restrictions: SYNC.restrictions,
    eclipseMoves: SYNC.visibility,
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
    // sheets — see the case below.
    motive: SYNC.rules,
    // A called assembly changes two things at once: the HUD row every player
    // reads, and the Public Announcement tile on a Monokuma's sheet, which is
    // its own cancel button while one is pending. `restrictions` already
    // redraws both, and a summons IS a restriction on where the next time of
    // day starts.
    pendingGather: SYNC.restrictions,
    // The safeword is printed on every character sheet, so changing it has to
    // redraw them all — and without an entry here `onWorldChange` would call
    // `applyFor("safeword")`, find no kind, and return silently. That is trap
    // 110, and it is the same shape as the motive's: a setting that syncs
    // itself and a screen that never hears about it.
    safeword: SYNC.rules,
    discoveredRooms: SYNC.fog
};

export function registerSync() {
    game.socket.on(SOCKET_EVENT, (payload, senderId) => {
        if (payload?.action !== ACTION) return;
        // Only a GM announces world state. Every caller of `broadcast` is a
        // GM-side write (the clock, the Eclipse, Despair Call restrictions), so
        // this refuses nothing legitimate — and without it any player could hand
        // every other client a fabricated clock to redraw against.
        if (!game.users.get(senderId)?.isGM) return;
        apply(payload.kind, payload.data);
    });
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
 * Every branch is defensive: a client that cannot do one part of the refresh —
 * no canvas yet, a sheet mid-render — must still do the rest.
 *
 * The socket announcement and the setting's own `onChange` describe the same
 * event, and on a healthy connection both arrive. Doing the work twice is
 * wasteful — re-rendering every open sheet is not cheap — so events arriving
 * inside a short window are merged.
 *
 * Merged, NOT discarded. This used to return early and throw the second event
 * away, which is only safe when the two describe the same state. They often do
 * not: a Despair Call spends and then refunds within a few milliseconds, and
 * clearing the seals writes two settings back to back. In both cases the screen
 * was left showing the state *before* the final write, with no further event
 * coming to correct it. The trailing run below always applies the newest data.
 */
const lastRun = new Map();
const queued = new Map();
const COALESCE_MS = 120;

function apply(kind, data = {}) {
    const now = Date.now();
    const since = now - (lastRun.get(kind) ?? 0);

    if (since < COALESCE_MS) {
        const alreadyQueued = queued.has(kind);
        queued.set(kind, data);                 // newest state wins
        if (alreadyQueued) return;

        debug(`sync: ${kind} deferred`);
        setTimeout(() => {
            const pending = queued.get(kind) ?? {};
            queued.delete(kind);
            lastRun.set(kind, Date.now());
            refresh(kind, pending);
        }, COALESCE_MS - since);
        return;
    }

    lastRun.set(kind, now);
    refresh(kind, data);
}

function refresh(kind, data = {}) {
    debug(`sync: ${kind}`, data);

    const run = (label, fn) => {
        try {
            const result = fn();
            if (result?.catch) result.catch(err => error(`sync ${kind}/${label} failed`, err));
        } catch (err) {
            error(`sync ${kind}/${label} failed`, err);
        }
    };

    switch (kind) {
        case SYNC.clock:
            /*
             * A CALLED ASSEMBLY IS HELD HERE, AND BY ONE CLIENT ONLY.
             *
             * `runPendingGather` refuses on anybody but the primary GM and on
             * an order that is not ripe yet, then clears the order BEFORE it
             * moves anybody — so the second arrival of this event (the socket
             * and the setting's `onChange` both describe it) finds nothing to
             * do. First, because a teleport that lands after the HUD redraw
             * shows the cast a room they are no longer standing in.
             */
            run("assembly", () => import("./call-effects.mjs").then(m => m.runPendingGather()));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            run("eclipse", () => import("./eclipse.mjs").then(m => m.refreshEclipse()));
            run("visibility", () => import("./visibility.mjs").then(m => m.applyAll()));
            // Local listeners (other modules, macros) still get their hook — but
            // now they get it on every client, which is what they always meant.
            //
            // The clock is read back from the setting when the announcement did
            // not carry one: this path is also reached from the setting's own
            // `onChange`, which knows the value changed but not what was in the
            // socket payload. A listener must never be handed an empty object.
            run("hook", async () => {
                const { getClock } = await import("./clock.mjs");
                Hooks.callAll("drpgTimeOfDayChanged", data.clock ?? getClock(), data.summary ?? {});
            });
            break;

        case SYNC.eclipse:
            run("eclipse", () => import("./eclipse.mjs").then(m => m.refreshEclipse()));
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            run("visibility", () => import("./visibility.mjs").then(m => m.applyAll()));
            // Every other sync kind re-renders open character sheets; this one
            // did not. The action panel and Calls panel both read `isEclipse()`
            // at render time (see sheet.mjs), so a sheet already open when the
            // Eclipse starts or ends was left showing the pre-Eclipse state —
            // actions and Calls looking normally clickable when they are not,
            // or still greyed out a whole time of day after they came back.
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            run("hook", async () => {
                const { isEclipse } = await import("./eclipse.mjs");
                Hooks.callAll("drpgEclipseChanged", data.active ?? isEclipse());
            });
            break;

        case SYNC.visibility:
            run("visibility", () => import("./visibility.mjs").then(m => m.applyAll()));
            // The only setting mapped to this kind is `eclipseMoves`, and that
            // number is printed on the sheet twice — the budget line and the
            // Move tile's own cost label — so a crossing has to redraw them.
            // At most two writes per character per Eclipse, so this is not the
            // per-frame cost that its name suggests.
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            break;

        case SYNC.projects:
            run("tray", () => import("./projects-ui.mjs").then(m => m.refreshProjects?.()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            break;

        case SYNC.despair:
            run("bar", () => import("./despair.mjs").then(m => m.renderDespairBar?.()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            break;

        case SYNC.searchTokens:
            // The world setting has just landed, so it is authoritative again —
            // drop the player-side "GM just told me" cache rather than let it
            // outlive the value it was standing in for.
            run("cache", () => import("./search-tokens.mjs").then(m => m.SearchTokens.clearFreshCounts()));
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            break;

        case SYNC.restrictions:
            run("sheets", () => import("./clock.mjs").then(m => m.refreshSheets()));
            // The HUD carries the incident line — whose turn it is and what the
            // victim has left. That moves on every crisis action, so it has to
            // redraw here too; without this it only refreshed when the clock
            // happened to move, which during an incident it does not.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
            break;

        case SYNC.trial:
            run("floor", () => import("./trial-floor.mjs").then(m => m.renderTrialFloor()));
            // The trial's three facts are three rows of the campaign HUD now —
            // which mode, how long is left, and the room — so the floor moving
            // is a HUD redraw. Without this the mode label was only ever
            // refreshed when the clock happened to move, which during a trial it
            // does not, and the turn-over animation between one mode and the
            // next never played at all.
            run("hud", () => import("./hud.mjs").then(m => m.renderHud()));
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
            // reload — see `reconcileMirror` in fog.mjs.
            run("fog", () => import("./fog.mjs").then(m => {
                m.reconcileMirror();
                return m.repaintFog();
            }));
            break;

        default:
            debug(`sync: unknown kind "${kind}" ignored`);
    }
}
