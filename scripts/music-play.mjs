/**
 * Danganronpa RPG - the music's engine.
 * ---------------------------------------------------------------------------
 * What keeps the world's playlists in step with the state, on the primary GM:
 * the marker that tells this module's own playback from a GM's hand
 * (`asOurs`), the settle window and the map's refresh, `registerMusic` with
 * its hooks, the one chain that applies a state (`schedule`, `apply`) and the
 * crossfade, a track drawn at random, a playlist paused, resumed, held, let go,
 * rewound or stopped dead, the cue playlist and a GM's own track taking the
 * room over (`situationalPlaylist`, `watchManualPlayback`, `cueGivesWay`,
 * `stopInterruption`), the Sound window's Play and Reset (`playTrack`,
 * `resetMusic`), `refreshMusic` (the setting's `onChange` and the console's)
 * and `musicStatus`.
 *
 * WHERE IT SITS. Moved out of music.mjs by E41 C9a (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. It reads the states and the
 * map from music-states.mjs and the murder music's hold and overlay from
 * murder-music.mjs. music.mjs re-exports the seven names here it exported
 * before, so every importer still imports music.mjs, and nothing here imports
 * it (the facade rule, .claude/rules/code.md); `interrupted` and `ours` are
 * exported for the two readers music.mjs keeps (`nowPlayingHere`,
 * `diagnoseMusic`) alone.
 */

import { MODULE_ID, SITUATIONAL_PLAYLIST } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { isPrimaryGm, debug, log, warn, error } from "./utils.mjs";
import { count } from "./perf-counters.mjs";
import {
    stateDef, currentState, musicMap, playlistFor, isCuePlaylist, dropCueMappings, recheckMusicKeys
} from "./music-states.mjs";
import { roomHold, murderOverlay, applyMurderMusic, restoreDuckedMusic } from "./murder-music.mjs";

/**
 * How deep we are inside THIS file changing playback.
 *
 * `resource-guard.mjs` tells automation apart from hand-editing with a flag in
 * the update options, which is the tidier mechanism - but `Playlist#playAll`
 * and `#stopAll` build their own `update()` call and accept no options to pass
 * one through. So the marker has to live here instead: everything this file
 * does goes through `asOurs`, and an update that arrives while that is zero is
 * the GM's own.
 *
 * A COUNTER RATHER THAN A BOOLEAN, and that is not tidiness. A boolean is
 * wrong the moment one `asOurs` block calls another: the inner block's
 * `finally` clears the marker, and THE REST OF THE OUTER BLOCK then runs
 * looking exactly like a GM reaching into the sidebar - `watchManualPlayback`
 * would read our own write as a scene cue and start holding playlists for it.
 * Nothing nested until E6; `crossfade` now rewinds a playlist before it plays
 * a track, and both halves are ours.
 */
let applyDepth = 0;

/** Is this file the one making the change that just arrived? */
function ourDoing() {
    return applyDepth > 0;
}

/**
 * Written on a playlist while it is paused for somebody else's track.
 *
 * On the DOCUMENT, not in a variable, because the question "what is holding?"
 * outlives the tab that answered it: the GM reloads, or the other GM presses
 * reset, and the record has to be readable from a client that never saw the
 * cue start.
 */
const HELD_FLAG = "held";

async function asOurs(fn) {
    applyDepth++;
    try {
        return await fn();
    } finally {
        applyDepth--;
    }
}

/* ==========================================================================
 * DRIVING IT
 * ========================================================================== */

/**
 * Changes arrive in bursts.
 *
 * Ending an Eclipse writes the clock and then advances the time of day, which is
 * two state changes inside a few milliseconds; a trial starting while the clock
 * moves is another. Reacting to each one would fade out and back in for a state
 * that lasted 40ms. Same reasoning, and roughly the same window, as `sync.mjs`.
 */
const SETTLE_MS = 400;
let settleTimer = null;

/** What we last started, so an unchanged state is not restarted every tick. */
let playingState = null;

/**
 * The playlist `playingState` was started on (E50 C3), so a map change that leaves the current state's playlist
 * where it is restarts nothing - the state is the same, and so is its playlist - while one that moves it is
 * followed. Null for a silence and before anything was started.
 */
let playingPlaylist = null;

/**
 * HOW LONG THE PRIMARY WAITS AFTER A MAPPING CHANGE (E50 C3; audit S11-34, Q-E50-3: 1500 ms). Any GM may write the
 * map, and only the primary plays: so the primary follows every write of it, from whichever GM, on the setting's
 * echo. A GM picking through several playlists in the Sound window writes at each pick, and the room should hear
 * only the last; one timer, restarted by each write, then the ordinary settle (`schedule`).
 *
 * ARMED ON EVERY GM, AND DECIDED WHEN IT FIRES (E50 fix FG1; the review's F3). It was armed on the primary alone, and
 * a primary GM who left within it took the change with it: the GM who became the primary had heard the echo while
 * it was not, and armed nothing; its `ready` had run long before, and nothing here listens for the primary changing -
 * so the state's new playlist waited for the next state change. Now every GM's browser keeps the timer and
 * `schedule()` asks `enabled()` at the moment it fires, so the GM who is the primary then follows it, once; a GM who
 * is not still runs no apply (87 C1 counts `music.apply`, in `runApply` behind that test). 87 C4 makes gm2 the
 * primary within the settle; a real GM leaving a real server is LIVE-E50-04.
 */
const MAP_SETTLE_MS = 1500;
let mapTimer = null;

/*
 * WHAT A MAPPING CHANGE LEAVES PLAYING (E50 fix FG1b). A state's playlist moved from A to B was followed by B and
 * left A playing beside it: `crossfade` stops the playing playlists the map names (`ours()`), and A, no longer named,
 * was nobody's. Measured on the harness 30.10.2026: 87 C4 (gm2 following after gm left) and E50-T4 (the primary
 * that never changed) both read A still playing after B started.
 *
 * THE RULE CHOSEN: the follow also stops a playlist the map named before the change and does not name after it. Not
 * "the playlist this browser started" (`playingPlaylist`): that answers on the primary that started A, and not on a
 * GM who became the primary within the settle - gm2 never started A and nothing in the world says who did (a flag on
 * the playlist would be a document write at every start, for every browser); tried as a mutant, that rule passed
 * E50-T4 and left 87 C4's A playing. The map is what every GM holds, and a
 * playlist it names is already the state machine's while it is named: `crossfade` stops it and
 * `watchManualPlayback` does not count a sound in it as the GM's own. So this stays inside the module's own
 * definition of its playlists, one map further back; a playlist the map never named - one a GM put on by hand, the
 * cue playlist - is never stopped by it, and a state left with no playlist still stops nothing (`apply`).
 *
 * `mapSeen` is the map as this GM's browser last heard it (at ready, then at each echo); `mapLeft` gathers what left
 * it during one settle, and only the primary's apply after it reads it (`leftForApply`).
 */
let mapSeen = null;
const mapLeft = new Set();
const leftForApply = new Set();

function noteMapLeft() {
    const now = musicMap() ?? {};
    const named = new Set(Object.values(now).filter(Boolean));
    for (const id of Object.values(mapSeen ?? {})) if (id && !named.has(id)) mapLeft.add(id);
    mapSeen = { ...now };
}

function scheduleMapRefresh() {
    if (!game.user?.isGM) return;
    noteMapLeft();
    if (mapTimer) clearTimeout(mapTimer);
    mapTimer = setTimeout(() => {
        mapTimer = null;
        const left = [...mapLeft];
        mapLeft.clear();
        if (enabled()) for (const id of left) leftForApply.add(id);
        schedule();
    }, MAP_SETTLE_MS);
}

/**
 * The GM's own track, while it is interrupting whatever was playing.
 *
 * `held` is a list, not one playlist. It used to be a single id - the one
 * mapped playlist that happened to be playing - and everything else audible
 * carried on underneath the cue: a second cue, a playlist the GM had started
 * from the sidebar, an ambient one for a state that is no longer mapped. What
 * is put on hold is now simply everything that was playing, and every one of
 * them comes back.
 *
 *   { soundId, sourcePlaylistId, held: [playlistId], state }
 */
export let interrupted = null;

/** The playlists this file stopped for a silent state, and is holding for it. */
let silenced = null;

export function registerMusic() {
    Hooks.on("drpgTimeOfDayChanged", () => schedule());
    /*
     * The two world settings the states are read out of.
     *
     * The FLOOR carries the trial's modes, so this is what makes an Objection
     * change the music at the moment it takes the floor rather than at the
     * moment something else happens to fire.
     *
     * The CLOCK is new in E6 and it is not decoration: `trial.discussion` is
     * true because the phase says `classTrial`, and nothing here was listening
     * for the phase moving. A GM opening the trial from the campaign window
     * would have set a state that only took effect the next time something
     * else changed. The time of day has its own hook above and arrives here
     * too - `apply` no-ops on an unchanged state, so the overlap costs one
     * comparison and buys not having to reason about which route fired.
     *
     * Matched on the whole key rather than its ending, because "ends with
     * trialQueue" is also true of another module's setting of the same name.
     */
    /* THE CAST, WHERE IT CHANGES: the GMs' record (`gmCast`) and a participant's
       copy (`mineCast`), both client-scoped - `clientSettingChanged`, which fires
       for every write of either (E04). See the note on the murder's keys below. */
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.incidentCast}` || key === `${MODULE_ID}.${SETTINGS.mineCast}`) {
            applyMurderMusic().catch(err => error("Could not follow the incident with the music", err));
        }
    });
    Hooks.on("updateSetting", (setting, changes, options, userId) => {
        const key = setting?.key;
        /*
         * THE MURDER'S TWO KEYS ARE HANDLED SEPARATELY, and not by `schedule`.
         *
         * Everything else in this listener feeds the world state machine, which
         * runs on one client and distributes through the playlist document. The
         * murder music is per browser and answers a different question - "am I
         * in this one" - so it goes straight to `applyMurderMusic` on EVERY
         * client rather than through the primary GM's `apply`.
         *
         * Both keys, and both are needed. `murderState` carries the stage, so
         * it is what says the incident has started or ended; the cast carries
         * the names, so on a participant's browser it is what says the
         * incident is theirs - and it arrives by socket a moment after the
         * world half, which means listening to only the first would start the
         * music before the client knew whether it was in it. The cast is heard
         * below: it is client-scoped, and this document hook never fires for a
         * client-scoped key (R14's note), so the cast half of it heard nothing
         * until E04 moved it.
         */
        if (key === `${MODULE_ID}.${SETTINGS.murderState}`) {
            applyMurderMusic().catch(err => error("Could not follow the incident with the music", err));
            return;
        }
        /* THE MURDER PLAYLIST CHANGED (E19 C5; audit S11-42): one mapped, or changed, while an incident runs is
           played from that write on, not from the next murder write. */
        if (key === `${MODULE_ID}.${SETTINGS.musicMap}`) {
            applyMurderMusic().catch(err => error("Could not follow the murder playlist", err));
            /* AND THE PRIMARY FOLLOWS IT, whoever wrote it (E50 C3; S11-34): the writer's own `schedule` did nothing on a
               GM who is not the primary. This browser's own writes are checked here too (`recheckMusicKeys`). */
            scheduleMapRefresh();
            recheckMusicKeys(userId);
            return;
        }
        if (key !== `${MODULE_ID}.${SETTINGS.trialQueue}`
            && key !== `${MODULE_ID}.${SETTINGS.clock}`
            && key !== `${MODULE_ID}.${SETTINGS.bodyFound}`) return;
        // Asked AFTER the setting has landed, so this is the state we are
        // moving TO rather than the one we are leaving.
        schedule({ now: stateDef(currentState())?.immediate === true });
    });
    Hooks.on("drpgEclipseChanged", () => schedule());
    Hooks.on("pauseGame", () => schedule());
    /* A ROOM SOUND MADE OR STARTED WHILE THE MURDER MUSIC PLAYS HERE is held too (E19 C5): the primary moving
       the room's playlist on mid-incident starts a sound this browser had not heard when the hold began. */
    for (const hook of ["createPlaylistSound", "updatePlaylistSound", "updatePlaylist"]) {
        Hooks.on(hook, () => {
            if (murderOverlay.state().playing) roomHold.hold(game.playlists ?? []);
        });
    }

    Hooks.once("ready", () => {
        if (game.user?.isGM) mapSeen = { ...(musicMap() ?? {}) };
        watchManualPlayback();
        watchManualEnd();
        adoptRunningInterruption();
        // Not immediate: at `ready` the canvas and the clock are still settling,
        // and the first thing a GM sees should not be a fade triggered by a
        // state that is about to change again.
        schedule();
        // A mapping onto the cue playlist stored before 1.2.94 (Q-E50-1): the primary's, once (`dropCueMappings`).
        dropCueMappings().catch(err => error("Could not drop the cue playlist's mappings", err));

        // In that order: put back a volume an earlier version parked, THEN ask
        // whether this browser is in an incident right now. A client that
        // reloaded mid-killing is both: its Music volume comes back first, and
        // the second call starts the same track again (E19 C5).
        restoreDuckedMusic()
            .then(() => applyMurderMusic())
            .catch(err => error("Could not settle the murder music at ready", err));
    });
}

/**
 * Pick up an interruption that started before this client did.
 *
 * `interrupted` is a variable, not a setting - it lives for as long as the tab
 * does. That is fine for the case it was written for and wrong for the one that
 * actually happens: the GM starts a track, then reloads, or Foundry restarts, or
 * they hand over to the other GM. The track is still playing and the module has
 * no memory of it, so `apply()` sees a state with a playlist mapped and starts
 * the ambient one straight over the top of it - and the paused ambient playlist
 * from before the reload never comes back, because nothing knows it is holding.
 *
 * Found in the test world in exactly that state: a GM cue playing, the module
 * reporting no interruption.
 *
 * So the running state is read from the world rather than remembered. Anything
 * playing that is not one of ours IS an interruption, whoever started it and
 * whenever - and a playlist of ours that is paused while that runs is the one
 * holding, which is what `resumeAmbient` needs to give the music back.
 */
function adoptRunningInterruption() {
    if (!enabled() || interrupted) return;

    try {
        const mine = ours();
        const situational = situationalPlaylist();
        // The cue playlist first: it is where a cue comes from, so a track
        // running there is far more likely to be the interruption than
        // whatever else the world happens to have going.
        const theirs = (situational?.playing ? situational : null)
            ?? game.playlists.find(p =>
                p.playing
                && !mine.some(o => o.id === p.id)
                && p.mode !== CONST.PLAYLIST_MODES.DISABLED);
        if (!theirs) return;

        // Anything paused mid-track is something that was holding for it.
        const held = playlistsHolding().filter(p => p.id !== theirs.id).map(p => p.id);

        interrupted = {
            soundId: theirs.sounds.find(s => s.playing)?.id ?? null,
            sourcePlaylistId: theirs.id,
            held,
            state: currentState()
        };
        debug(`Music: adopted "${theirs.name}" as an interruption already in progress.`);
    } catch (err) {
        // Never let a recovery attempt stop the music system from starting.
        error("Could not check for an interruption already running", err);
    }
}

/**
 * Ask for the music to be brought in line with the state.
 *
 * @param {object}  [options]
 * @param {boolean} [options.now]  Skip the settle window. For a state that is
 *   over before the window would have closed - see `immediate` in the
 *   catalogue, which today is the Objection alone.
 */
function schedule({ now = false } = {}) {
    if (!enabled()) return;
    if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
    }
    if (now) {
        runApply();
        return;
    }
    settleTimer = setTimeout(() => {
        settleTimer = null;
        runApply();
    }, SETTLE_MS);
}

/**
 * One `apply()` at a time, in the order they were asked for.
 *
 * `apply()` awaits several playlist writes, so it is perfectly possible for a
 * second one to start while the first is between stopping and starting - and
 * two crossfades interleaved leave two playlists running and `playingState`
 * naming neither. The settle window used to make that vanishingly unlikely by
 * spacing every call 400ms apart; the immediate path removes exactly that
 * spacing, so the ordering has to be said out loud instead of assumed.
 */
let applyChain = Promise.resolve();

function runApply() {
    count("music.apply");
    applyChain = applyChain
        .then(() => apply())
        .catch(err => error("Could not follow the state with the music", err));
    return applyChain;
}

function enabled() {
    if (!isPrimaryGm()) return false;
    try {
        return getSetting(SETTINGS.musicEnabled) === true;
    } catch {
        return false;
    }
}

/**
 * Put the right playlist on, if it is not already.
 *
 * A state with no playlist mapped stops nothing: the GM has said nothing about
 * it, and silence is a decision they did not make. What was playing keeps
 * playing - which is also exactly the behaviour an incident wants.
 */
async function apply() {
    if (!enabled()) return;

    // The GM is playing something of their own. Their choice outranks the state
    // machine until it finishes; `resume` picks the thread back up.
    //
    // Checked against reality first. `interrupted` is cleared by an event, and
    // an event can be missed - a playlist deleted mid-track, a sound removed, a
    // client that reconnected between the start and the stop. Every one of those
    // used to leave the flag set for good, which silently retired the whole
    // state machine. Nothing is playing on either side means the interruption is
    // over, whatever we did or did not hear about it.
    if (interrupted && !interruptionRunning()) {
        debug("Music: the GM's track is no longer playing; taking the music back.");
        interrupted = null;
        playingState = null;
    }

    // The GM's track outranks the state machine - but only for the state it was
    // started in.
    //
    // "Morning is playing, the GM drops a track in over it, the track finishes,
    // morning comes back" is the ordinary case and it waits. What must NOT wait
    // is the state moving underneath it: if the time of day turns, or a Class
    // Trial opens, while the GM's track is still running, the track is now
    // scoring the wrong scene. The room hears the old mood over the new one for
    // as long as the track lasts, and `resumeAmbient` would then bring back the
    // playlist for a state that has already gone.
    //
    // So the interruption is held against the state it began in. Same state:
    // let it finish. Different state: take the music back now.
    //
    // E6 MADE THIS BITE HARDER, and that is worth knowing before it surprises
    // somebody at the table. The whole Class Trial used to be ONE state, so a
    // track a GM put on mid-trial survived the entire trial. The trial is three
    // states now, and an Objection is a different one - so an Objection takes
    // the music off the GM's cue, and when it ends the debate takes it rather
    // than the cue coming back. That is almost certainly right: an Objection is
    // the loudest beat in the game, and a GM who wants their own track through
    // one can simply leave the Objection unmapped. But it is a change in
    // behaviour rather than a consequence of one, and it belongs in writing.
    if (interrupted) {
        const moved = currentState();
        // Nothing mapped for the new state means we have nothing to replace it
        // with, and cutting the GM off into silence is worse than letting a
        // track outstay its scene. Same rule as the `!next` branch below - but
        // for the body's silence, which is a decision (`cueGivesWay`).
        if (!cueGivesWay(moved, interrupted.state, {
            mapped: Boolean(playlistFor(moved)), silent: stateDef(moved)?.silence === true
        })) return;
        log(`Music: the state moved to "${moved}" while the GM's track ran; taking over.`);
        const heldForCue = interrupted.held ?? [];
        await stopInterruption();
        /* WHAT THE CUT-OFF TRACK WAS HOLDING (E19 C5; audit S11-32). Left flagged, a Reset in some later silence
           gave back music from hours before. A silent state takes it over as its own hold, so the end of the
           silence gives it back as the silence's; any other state lets go of it. */
        if (!playlistFor(moved) && stateDef(moved)?.silence === true) silenced = { held: heldForCue };
        else for (const id of heldForCue) await clearHeld(game.playlists.get(id));
        interrupted = null;
        playingState = null;
    }

    const state = currentState();
    const next = state ? playlistFor(state) : null;
    // What left the map in the change this apply follows, if it follows one (`scheduleMapRefresh`): taken here so
    // that an apply that returns below does not hand it to a later one.
    const left = [...leftForApply];
    leftForApply.clear();
    // The same state on the same playlist: nothing to do. The playlist is asked too since E50 C3, because the map
    // can move a state's playlist under it (`scheduleMapRefresh`).
    if (!state || (state === playingState && (next?.id ?? null) === playingPlaylist)) return;

    // SILENCE IS A DECISION TOO - see the `bodyFound` entry in MUSIC_STATES.
    // Below `next`, so a playlist mapped to a silent state still wins.
    if (!next && stateDef(state)?.silence === true) {
        if (!silenced) silenced = { held: await holdEverything() };
        playingState = state;
        playingPlaylist = null;
        log(`Music: ${state} -> silence (${silenced.held.length} playlist(s) held).`);
        return;
    }

    // Coming back out of one, and only what THIS branch took. `HELD_FLAG` is
    // shared with the GM-cue path (`startInterruption`, `adoptRunningInterruption`),
    // so `playlistsHolding()` here would resume playlists a running cue is still
    // holding. `resetMusic` owns the after-a-reload case and guards it with
    // `!anythingPlaying()`, which this branch has no equivalent of.
    if (silenced) {
        const held = silenced.held;
        silenced = null;
        /* A MAPPED STATE AFTER THE SILENCE takes the music itself (E19 C5; audit S11-32): resuming what the silence
           held first faded the afternoon back in for the moment before the crossfade stopped it, after a body was
           found. What was held is let go instead; with nothing mapped, it comes back as before. */
        if (next) for (const id of held) await clearHeld(game.playlists.get(id));
        else await resumeHeld(held);
    }

    if (!next) {
        debug(`Music: nothing mapped for "${state}"; leaving the current track alone.`);
        return;
    }

    await crossfade(next, { randomTrack: stateDef(state)?.randomTrack === true, left });
    playingState = state;
    playingPlaylist = next.id;
    log(`Music: ${state} -> "${next.name}".`);
}

/**
 * Stop everything of ours, start the new one.
 *
 * Sequential rather than simultaneous on purpose: Foundry fades a stopping
 * playlist out and a starting one in, and starting the second before the first
 * has been told to stop gives a few seconds of both at once.
 *
 * @param {Playlist} next
 * @param {object}  [options]
 * @param {boolean} [options.randomTrack]  Start ONE track, chosen at random,
 *   rather than letting the playlist resume wherever it left off. The trial's
 *   three states ask for this; see `playRandomTrack`.
 * @param {string[]} [options.left]  Playlists a mapping change took out of
 *   the map, stopped too when playing (E50 fix FG1b; `mapLeft`).
 */
function crossfade(next, { randomTrack = false, left = [] } = {}) {
    return asOurs(async () => {
        // The playlists the map names, and those a mapping change just took out of it (the rule: `mapLeft`).
        const stopping = new Map(ours().map(playlist => [playlist.id, playlist]));
        for (const id of left) {
            const playlist = game.playlists.get(id);
            if (playlist && !isCuePlaylist(playlist)) stopping.set(id, playlist);
        }
        for (const playlist of stopping.values()) {
            if (playlist.id === next.id) continue;
            if (!playlist.playing) continue;
            try {
                await playlist.stopAll();
            } catch (err) {
                error(`Could not stop "${playlist.name}"`, err);
            }
        }

        /*
         * ALREADY PLAYING IS NOT A REASON TO DO NOTHING WHEN A TRACK IS ASKED
         * FOR (Dawid, 28.08: "must have").
         *
         * For an ambient playlist it is exactly the right reason: the afternoon
         * carries on. For a cue it is the bug - an Objection cutting into a
         * rebuttal, or a second Objection, lands on the state that is ALREADY
         * playing, so this returned and the sting never changed. The note under
         * `playRandomTrack` said that function is "what makes a second
         * Objection sound like a second Objection"; this line is what stopped
         * it being called in precisely that case.
         *
         * `playRandomTrack` already refuses to repeat the last pick, and
         * `rewindTo` stops whatever else in the playlist is running, so asking
         * again while it plays is a clean cut to a different track.
         */
        if (next.playing && !randomTrack) return;
        try {
            if (randomTrack) await playRandomTrack(next);
            else await next.playAll();
            // Playing for its state now, not holding for a cue or a silence (E19 C5; audit S11-32).
            await clearHeld(next);
        } catch (err) {
            error(`Could not start "${next.name}"`, err);
        }
    });
}

/**
 * Does a GM's own track give way to the state the music moved to?
 *
 * Not to its own state, and not to a state with nothing mapped - cutting the
 * GM off into silence they did not choose is worse than a track outstaying its
 * scene. Except the body's silence (the owner's D8; audit S11-58): silence is
 * that state's music, and a GM's track played on through the announcement of
 * a body. Exported for the suite.
 *
 * @param {string|null} moved  the state now
 * @param {string|null} cueState  the state the GM's track was chosen for
 * @param {{mapped: boolean, silent: boolean}} now  whether a playlist is mapped to `moved`, and whether it is a silent state
 */
export function cueGivesWay(moved, cueState, { mapped = false, silent = false } = {}) {
    if (moved === cueState) return false;
    return mapped || silent;
}

/**
 * What each playlist started last, so it does not start it again next time.
 *
 * A variable, not a flag on the document. It only has to be right within one
 * trial, on the one client that drives playback, and the cost of being wrong is
 * that a track repeats once after a reload - which is not worth a world write
 * per objection.
 */
const lastTrack = new Map();

/**
 * Start ONE track from this playlist, and not the one it started last time.
 *
 * This is what makes a second Objection sound like a second Objection.
 * `playAll()` - what every other state uses - resumes a playlist where it left
 * off, and for an ambient mood that is exactly right: an afternoon carrying on
 * from where the afternoon stopped. A trial state takes over in bursts, four or
 * five times in the same trial, and resuming means the same sting from the same
 * second, every time.
 *
 * THE EXCLUSION IS SKIPPED FOR A ONE-TRACK PLAYLIST rather than leaving nothing
 * to choose from. A GM with one Objection sting has said what they want.
 *
 * THE TRACK IS REWOUND FIRST, and that is not optional: `Playlist#stopAll`
 * writes `playing: false` and leaves every `pausedTime` exactly where it was,
 * so a track this file stopped an hour ago is still carrying an offset. Without
 * the rewind a "random track" starts at 1:47 - the same trap the cue playlist
 * hit, and it is now the same function that answers both.
 */
async function playRandomTrack(playlist) {
    const sounds = Array.from(playlist.sounds ?? []);
    if (!sounds.length) {
        // Not an error: a playlist can be mapped before it has anything in it.
        // Said out loud because the symptom - the music stopping the moment the
        // trial starts - looks nothing like the cause.
        warn(`Music: "${playlist.name}" is mapped but has no tracks, so there is `
            + "nothing to play for this state.");
        return;
    }

    const last = lastTrack.get(playlist.id);
    const pool = sounds.length > 1 ? sounds.filter(s => s.id !== last) : sounds;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    lastTrack.set(playlist.id, pick.id);
    await rewindTo(playlist, pick.id);
    await playlist.playSound(pick);
    debug(`Music: "${playlist.name}" -> "${pick.name}".`);
}

/**
 * Pause a playlist where it stands, so it can be resumed rather than restarted.
 *
 * Foundry has `playAll` and `stopAll` and no `pauseAll`; pausing is a property
 * of a SOUND, and the sidebar does it as
 * `sound.update({playing: false, pausedTime: sound.sound.currentTime})`. That
 * stored `pausedTime` is what `playAll` looks for when it decides which track to
 * start - `this.sounds.find(s => s.pausedTime)` - so writing it here is the
 * whole of "resume where it left off".
 *
 * A sound whose audio has not decoded yet has no `currentTime` to record. It is
 * stopped rather than paused: restarting a track that had barely begun is not a
 * loss, and a `pausedTime` of zero would read as "not paused" anyway.
 *
 * @returns {Promise<boolean>} whether anything was actually put on hold. The
 *   caller uses it to decide whether this playlist is worth remembering: a
 *   playlist with nothing running in it has nothing to come back to.
 */
function pausePlaylist(playlist) {
    return asOurs(async () => {
        const updates = playlist.sounds
            .filter(s => s.playing)
            .map(s => ({
                _id: s.id,
                playing: false,
                pausedTime: Number(s.sound?.currentTime) || null
            }));

        if (!updates.length) {
            // The document claims to be playing and nothing inside it is. Left
            // alone this outlives the session and makes every later reading of
            // "what is playing" wrong, including this file's own.
            if (playlist.playing) {
                try {
                    await playlist.update({ playing: false });
                } catch (err) {
                    error(`Could not tidy up "${playlist.name}"`, err);
                }
            }
            return false;
        }

        try {
            // The flag rides along in the same write. It is what makes "give
            // back what was holding" answerable by a client that never saw the
            // cue start - see `playlistsHolding`.
            await playlist.update({
                playing: false,
                sounds: updates,
                [`flags.${MODULE_ID}.${HELD_FLAG}`]: true
            });
            return true;
        } catch (err) {
            error(`Could not pause "${playlist.name}"`, err);
            return false;
        }
    });
}

function resumePlaylist(playlist) {
    return asOurs(async () => {
        try {
            await playlist.playAll();
        } catch (err) {
            error(`Could not resume "${playlist.name}"`, err);
        }
    });
}

/**
 * The one playlist the GM's own cues come from.
 *
 * Matched by NAME, not by an id stored in a setting. A name is something the
 * GM can see in the sidebar and fix by renaming; an id is invisible, and a
 * setting pointing at a playlist somebody deleted fails in a way that looks
 * like the module being broken. The cost is that renaming the playlist
 * unhooks it - which is why the window says which name it is looking for
 * rather than leaving the GM to guess.
 */
export function situationalPlaylist() {
    const wanted = SITUATIONAL_PLAYLIST.trim().toLowerCase();
    try {
        return game.playlists?.find(p => p.name?.trim().toLowerCase() === wanted) ?? null;
    } catch {
        return null;
    }
}

/**
 * Put EVERYTHING that is playing on hold, except the playlist taking over.
 *
 * "Everything" rather than "the one playlist this module started" on purpose.
 * A GM pressing play under a moment means *this* is the music now, and the old
 * behaviour left anything the module had not started itself running underneath
 * the cue - two pieces of music at once, and no way to tell from the panel
 * which one was which.
 *
 * A soundboard playlist is left alone. Those are one-shots - a sting, a door,
 * a gunshot - and pausing one halfway to resume it three minutes later is not
 * a thing anybody wants; Foundry already treats that mode as "not scene music"
 * by refusing to play the playlist as a whole.
 *
 * @returns {Promise<string[]>} the ids to give back, in the order they were taken.
 */
async function holdEverything(except = null) {
    const held = [];
    for (const playlist of game.playlists) {
        if (except && playlist.id === except.id) continue;
        if (playlist.mode === CONST.PLAYLIST_MODES.DISABLED) continue;
        if (!playlist.playing && !playlist.sounds.some(s => s.playing)) continue;
        if (await pausePlaylist(playlist)) held.push(playlist.id);
    }
    if (held.length) debug(`Music: ${held.length} playlist(s) put on hold for the cue.`);
    return held;
}

/** Give back, where they left off, the playlists a cue put on hold. */
async function resumeHeld(ids = []) {
    for (const id of ids) {
        const playlist = game.playlists.get(id);
        if (!playlist) continue;
        if (!playlist.playing) await resumePlaylist(playlist);
        await clearHeld(playlist);
    }
}

/**
 * This playlist is no longer holding for anything.
 *
 * Set to false rather than deleted. Deleting a key here means `-=held`, and in
 * this Foundry that quietly does nothing unless the update is a forced
 * replacement - a flag that cannot be cleared is worse than a flag that reads
 * `false`.
 */
async function clearHeld(playlist) {
    if (!playlist?.getFlag?.(MODULE_ID, HELD_FLAG)) return;
    await asOurs(async () => {
        try {
            await playlist.update({ [`flags.${MODULE_ID}.${HELD_FLAG}`]: false });
        } catch (err) {
            error(`Could not clear the hold on "${playlist.name}"`, err);
        }
    });
}

/**
 * Everything this module has put on hold and not yet given back.
 *
 * The fallback for "a cue is playing and this client has no memory of starting
 * it" - after a reload, or when the other GM pressed the button. The flag,
 * rather than a stored `pausedTime`: `pausedTime` is written by pausing and
 * NOT cleared by `Playlist#stopAll`, so a playlist paused once and stopped by
 * hand an hour later still looks paused for the rest of the world's life, and
 * a reset would drag it back into the room. Caught by the headless test doing
 * exactly that.
 */
function playlistsHolding() {
    return game.playlists.filter(p =>
        !p.playing
        && p.mode !== CONST.PLAYLIST_MODES.DISABLED
        && p.getFlag?.(MODULE_ID, HELD_FLAG));
}

/**
 * Is any scene music actually audible?
 *
 * Read from the SOUNDS, not from the playlist's own `playing` flag, and with
 * soundboards left out. `Playlist#playSound` sets `playing: true` on the
 * playlist whatever its mode, so a soundboard that fired one sting in the last
 * hour can still be claiming to play - and a reset that believed it would
 * decide the room already had music and leave the paused track paused.
 */
function anythingPlaying() {
    return game.playlists.some(p =>
        p.mode !== CONST.PLAYLIST_MODES.DISABLED
        && p.sounds.some(s => s.playing));
}

/**
 * Clear a playlist down to the one track about to play, and rewind that track.
 *
 * `Playlist#playSound` already does the first half for a Sequential or Shuffle
 * playlist and does NOT for a Simultaneous or Soundboard one, where it starts
 * the new sound and leaves the others running - which is how pressing Play
 * twice ended up with two cues playing at once.
 *
 * The track that is about to start has its own `pausedTime` cleared as well, so
 * it begins at the beginning. That is the half both callers need and neither
 * gets for free: `stopAll` never clears an offset, so any track this file has
 * stopped is still carrying one, however long ago. A cue is chosen for a moment
 * at the table and a trial track for a beat in an argument; neither is resumed
 * from wherever it happened to stop the last time it was used.
 *
 * Was `clearCuePlaylist`, back when the cue was the only thing that needed it.
 */
function rewindTo(playlist, keepId) {
    return asOurs(async () => {
        const updates = playlist.sounds
            .filter(s => s.id !== keepId && (s.playing || s.pausedTime))
            .map(s => ({ _id: s.id, playing: false, pausedTime: null }));

        if (playlist.sounds.get(keepId)?.pausedTime) {
            // No `playing` key: this one is not being stopped, only rewound.
            updates.push({ _id: keepId, pausedTime: null });
        }

        if (!updates.length) return;
        try {
            await playlist.update({ sounds: updates });
        } catch (err) {
            error(`Could not clear "${playlist.name}"`, err);
        }
    });
}

/**
 * Stop a playlist dead: not playing, and not paused either.
 *
 * `Playlist#stopAll` writes `{_id, playing: false}` per sound and leaves every
 * `pausedTime` exactly as it found it. That field is only ever read as a start
 * offset - `PlaylistSound#sync` passes it as `offset` - so a playlist stopped
 * with `stopAll` starts again halfway through whichever track was cut off, at
 * whatever later moment anything plays it. Fine for an ambient playlist that
 * is meant to resume where it left off; wrong for a cue, which is chosen for
 * one moment and should never turn up again on its own.
 *
 * Wrapped in `asOurs` so the stop we cause is not read back as the GM stopping
 * it by hand - `watchManualEnd` and `watchManualPlayback` both bail while
 * `ourDoing()` is true, which is the whole reason that marker exists.
 */
function stopPlaylistDead(playlist) {
    return asOurs(async () => {
        try {
            await playlist.update({
                playing: false,
                sounds: playlist.sounds.map(s => ({ _id: s.id, playing: false, pausedTime: null })),
                // Whatever it was holding for, it is not holding now.
                [`flags.${MODULE_ID}.${HELD_FLAG}`]: false
            });
        } catch (err) {
            error(`Could not stop "${playlist.name}"`, err);
        }
    });
}

/** Cut the GM's track off, because the scene it was chosen for has ended. */
async function stopInterruption() {
    const source = interrupted?.sourcePlaylistId
        ? game.playlists.get(interrupted.sourcePlaylistId)
        : null;
    if (!source) return;
    if (!source.playing && !source.sounds.some(s => s.playing || s.pausedTime)) return;

    await stopPlaylistDead(source);
}

/**
 * Is the GM's interruption actually still audible?
 *
 * Read from the documents rather than from our own bookkeeping, so a missed
 * stop event cannot outlive the sound it was about. The source playlist still
 * playing is the ordinary case; the individual sound is checked too, for a
 * soundboard one-shot whose playlist never reports itself as playing.
 */
function interruptionRunning() {
    if (!interrupted) return false;

    const source = interrupted.sourcePlaylistId
        ? game.playlists.get(interrupted.sourcePlaylistId)
        : null;
    if (source?.playing) return true;
    if (source?.sounds.get(interrupted.soundId)?.playing) return true;

    // Nothing of the GM's is playing. Whether that is because it finished
    // normally or because we never heard it stop, the answer is the same and
    // the music comes back - which is the whole point of checking reality
    // rather than trusting the flag.
    return false;
}

/** Every playlist this module is responsible for. */
export function ours() {
    const ids = new Set(Object.values(musicMap()).filter(Boolean));
    return Array.from(ids).map(id => game.playlists.get(id)).filter(Boolean);
}

/* ==========================================================================
 * THE GM PLAYING SOMETHING BY HAND
 * --------------------------------------------------------------------------
 * The one interaction worth getting right. A GM hits play on a track for a
 * scene; the ambient playlist should get out of the way and come back
 * afterwards, at the point it had reached rather than from the top.
 *
 * "At the point it had reached" is free: `pausedTime` is a stored field on
 * PlaylistSound, so pausing and resuming is Foundry's own behaviour and not
 * something this file has to model.
 * ========================================================================== */

function watchManualPlayback() {
    Hooks.on("updatePlaylistSound", (sound, changes) => {
        if (!enabled()) return;
        // Ours. See `applyDepth`: this cannot be a flag in the update options,
        // because the methods that produce these updates take none.
        if (ourDoing()) return;
        if (!("playing" in changes)) return;

        // A sound inside a playlist we drive is the state machine's business,
        // not a manual interruption - the GM skipping to the next ambient track
        // should not be treated as a scene cue.
        if (ours().some(p => p.id === sound.parent?.id)) return;

        // A soundboard is for one-shots: an OBJECTION sting, a door, a gunshot.
        // Ducking the music for two seconds and fading it back is the wrong
        // shape for those - it makes a sound effect feel like a scene change,
        // and Foundry already calls this mode "soundboard only" by refusing to
        // play the playlist as a whole. Scene music belongs in a Sequential or
        // Shuffle playlist, which is exactly what is left after this.
        if (sound.parent?.mode === CONST.PLAYLIST_MODES.DISABLED) return;

        if (changes.playing) onManualStart(sound);
        else onManualEnd(sound);
    });
}

function onManualStart(sound) {
    if (interrupted) return;

    const source = sound.parent ?? null;

    // Recorded BEFORE the holding starts, and filled in after.
    //
    // `holdEverything` awaits a write per playlist, and any of those can put
    // another update on the wire; an empty record in place from the first line
    // is what stops a second sound arriving mid-hold from starting the whole
    // thing again and taking a second, emptier reading of what was playing.
    //
    // `sourcePlaylistId` is the GM's OWN playlist, and it is what makes the
    // interruption end when nothing was holding. Without it this was a one-way
    // door: an interruption that started in silence had nothing to compare a
    // stop against, `resumeAmbient()` could not be reached, `interrupted` stayed
    // set for the rest of the session, and `apply()` opens with
    // `if (interrupted) return` - so the Class Trial and the Investigation never
    // changed the music again.
    interrupted = {
        soundId: sound.id,
        sourcePlaylistId: source?.id ?? null,
        held: [],
        // The scene the GM chose this track FOR. `apply()` compares against it,
        // so a track keeps the floor for its own state and loses it the moment
        // the state changes.
        state: currentState()
    };

    holdEverything(source)
        .then(held => {
            if (interrupted) interrupted.held = held;
            if (held.length) debug(`Music: "${sound.name}" took over; ${held.length} holding.`);
        })
        .catch(err => error("Could not hold what was already playing", err));
}

/**
 * The GM's own playback finishing.
 *
 * Watches the PLAYLIST, not the sound. A single track ending is not the end of
 * the interruption: `Playlist#_onSoundEnd` calls `playNext` for a Sequential or
 * Shuffle playlist, so the GM's next track starts immediately - and resuming on
 * the sound's end meant the ambient playlist faded back IN UNDER the GM's second
 * track, both playing at once. `_getNextSound` also wraps at the end of the
 * list, so a GM playlist runs until it is stopped; that is what "the GM has
 * taken over the music" means, and stopping it is what hands control back.
 */
function watchManualEnd() {
    Hooks.on("updatePlaylist", (playlist, changes) => {
        if (!enabled()) return;
        if (ourDoing()) return;
        if (changes.playing !== false) return;
        if (!interrupted) return;
        // The CUE's own playlist stopping, and nothing else.
        //
        // A held playlist stopping used to count too, and it was wrong in the
        // one case it fired: that is the GM reaching into the sidebar and
        // stopping the thing we paused, and answering "you stopped it" with
        // "here it is again" is the module arguing with them.
        if (playlist.id !== interrupted.sourcePlaylistId) return;
        resumeAmbient();
    });
}

function onManualEnd(sound) {
    // Only meaningful for a soundboard-style one-shot, which is the one case
    // where a sound ending IS the end of the interruption. Everything else is
    // handled by `watchManualEnd`, because the playlist carries on.
    if (interrupted?.soundId !== sound.id) return;
    if (sound.parent?.playing) return;
    resumeAmbient();
}

/** Give the music back to whatever was playing, and then to the state machine. */
function resumeAmbient() {
    const held = interrupted?.held ?? [];
    interrupted = null;

    if (!held.length) {
        // Nothing was holding, so there is nothing to resume - but the state may
        // well have moved on while the GM's track was running.
        playingState = null;
        schedule();
        return;
    }

    // Straight back, no settle window: the silence after a scene cue is exactly
    // where the music that was playing is missed.
    //
    // `playAll` resumes rather than restarts, because `pausePlaylist` left a
    // `pausedTime` behind for it to find.
    resumeHeld(held)
        .then(() => {
            debug(`Music: ${held.length} playlist(s) resumed.`);
            // The state may have changed while the GM's track ran - a trial can
            // start behind a scene cue. Re-check rather than assume the room we
            // came back to is the one we left.
            schedule();
        })
        .catch(err => error("Could not resume what the cue interrupted", err));
}

/* ==========================================================================
 * THE GM PUTTING A TRACK UNDER A MOMENT
 * --------------------------------------------------------------------------
 * The machinery for this already existed and was only reachable by reaching
 * past the module: a GM pressed play in Foundry's own Playlists sidebar and
 * `watchManualPlayback` picked it up. That works, and it is two panels away
 * from everything else a GM touches mid-scene. These two are the same thing
 * with a door on it.
 * ========================================================================== */

/**
 * Play one track now, on repeat, holding everything that was already playing.
 *
 * Three steps, in this order, and the order is the whole behaviour:
 *
 *   1. pause what is playing, wherever it is playing from, so it can come back
 *      at the bar it reached rather than from the top;
 *   2. clear the cue playlist, so a second press replaces the first cue instead
 *      of stacking a second one on top of it;
 *   3. start the chosen track, on repeat.
 *
 * IT DOES ITS OWN BOOKKEEPING. It used to do none: it played the sound and let
 * `watchManualPlayback` notice, which meant the pausing, the record of what to
 * resume and therefore Reset itself all quietly did nothing in a world where
 * "music follows the game state" is switched off - the hook bails on that
 * setting, and this button has nothing to do with it. So the writes are wrapped
 * in `asOurs` (the hook stays out of the way) and the record is written here.
 *
 * `repeat: true` because a track chosen for a moment at the table should last
 * as long as the moment does. It also sidesteps the one awkward edge in the
 * hand-off: a Sequential playlist would otherwise roll on to its next track,
 * and this is a GM picking ONE piece of music, not starting a set.
 *
 * @param {string} track  A sound id in the cue playlist, or its name.
 * @param {string} [soundId]  Ignored except as the old `(playlistId, soundId)`
 *   signature, from before the playlist stopped being a choice.
 */
export async function playTrack(track, soundId) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const playlist = situationalPlaylist();
    if (!playlist) {
        ui.notifications.warn(game.i18n.format("DRPG.Music.noSituational",
            { name: SITUATIONAL_PLAYLIST }));
        return null;
    }

    const wanted = String(soundId ?? track ?? "").trim();
    const sound = playlist.sounds.get(wanted)
        ?? playlist.sounds.find(s => s.name?.trim().toLowerCase() === wanted.toLowerCase());
    if (!sound) {
        ui.notifications.warn(game.i18n.localize("DRPG.Music.noTrack"));
        return null;
    }

    try {
        let held;
        if (interrupted) {
            // A cue is already running, so what it displaced is recorded and
            // still paused. Reading "what is playing" again now would find only
            // the cue itself and record an empty list - losing the way back.
            //
            // The old cue is STOPPED rather than held: it was an interruption
            // in its own right, and Reset gives the music back to what was
            // playing before the first press, not to the previous cue.
            held = interrupted.held ?? [];
            await stopInterruption();
        } else {
            held = await holdEverything(playlist);
        }

        await rewindTo(playlist, sound.id);

        // `repeat` carries no `playing` key, so it is not the write that starts
        // anything; it is set first so the track is already on repeat by the
        // time it does start.
        if (!sound.repeat) await sound.update({ repeat: true });

        interrupted = {
            soundId: sound.id,
            sourcePlaylistId: playlist.id,
            held,
            // The scene the GM chose this track FOR - see `apply`.
            state: currentState()
        };

        await asOurs(() => playlist.playSound(sound));
    } catch (err) {
        error(`Could not play "${sound.name}"`, err);
        ui.notifications.error(game.i18n.localize("DRPG.Music.playFailed"));
        return null;
    }

    log(`Music: the GM put "${sound.name}" on.`);
    return sound;
}

/**
 * Stop the cue outright and give the music back to what it interrupted.
 *
 * Both halves, because either one alone leaves the world in a state the GM
 * cannot see: stopping without resuming leaves silence with `interrupted` still
 * set, and resuming without stopping fades the old track in underneath one that
 * is still playing.
 *
 * STOPPED, not paused. The cue playlist is emptied of playback entirely - every
 * sound in it, and its `pausedTime` with it - because "reset" that leaves the
 * cue paused mid-track means the next `playAll` on that playlist picks up the
 * cue again, minutes later, under a scene it was never chosen for.
 *
 * Safe with nothing recorded, which is the case that actually turns up: this
 * client reloaded, or the other GM pressed Play. The cue playlist is known by
 * name whether or not anybody remembers starting it, and anything left paused
 * mid-track is what was holding for it.
 */
export async function resetMusic() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const record = interrupted;
    interrupted = null;
    // Reset gives back everything holding and then calls `schedule()`, which
    // re-silences if the body is still unanswered. The flag must not survive
    // that, or the resume below would be the last one this state ever gets.
    silenced = null;

    // Everything the cue could be coming out of: the playlist it was started
    // from, and the cue playlist itself - the same one nine times out of ten.
    const cues = new Set();
    if (record?.sourcePlaylistId) cues.add(record.sourcePlaylistId);
    const situational = situationalPlaylist();
    if (situational) cues.add(situational.id);

    for (const id of cues) {
        const playlist = game.playlists.get(id);
        if (!playlist) continue;
        if (!playlist.playing && !playlist.sounds.some(s => s.playing || s.pausedTime)) continue;
        await stopPlaylistDead(playlist);
    }

    // What comes back. The record if there is one; otherwise whatever is left
    // stopped mid-track - but only INTO SILENCE. Without that last condition a
    // reset would resume a playlist the state machine had already moved on
    // from, and two pieces of music would be playing where there had been one.
    let held = record?.held ?? [];
    if (!held.length && !anythingPlaying()) {
        held = playlistsHolding().map(p => p.id);
    }
    // Never the cue itself, however it got into the list: it was just stopped
    // on purpose and resuming it here would undo the other half of the button.
    const giveBack = held.filter(id => !cues.has(id));
    await resumeHeld(giveBack);

    // Whatever is playing now was not chosen under the current state, so the
    // state machine gets to say again - if it is switched on at all.
    playingState = null;
    schedule();

    log(`Music: reset. ${giveBack.length} playlist(s) given back.`);
    return true;
}

/**
 * Re-evaluate now. For the setting's own `onChange` and for the console.
 *
 * `playingState` is cleared first so this re-asserts rather than deciding it has
 * nothing to do: whatever is playing was chosen under the old configuration.
 */
export function refreshMusic({ now = false } = {}) {
    playingState = null;
    schedule({ now });
}

/** Console tool: what the module thinks is going on. */
export function musicStatus() {
    const state = currentState();
    const cue = interrupted?.sourcePlaylistId
        ? game.playlists.get(interrupted.sourcePlaylistId)
        : null;
    return {
        enabled: enabled(),
        state,
        playlist: playlistFor(state)?.name ?? null,
        playing: game.playlists.filter(p => p.playing).map(p => p.name),
        situational: situationalPlaylist()?.name ?? null,
        interrupted: Boolean(interrupted),
        silenced: Boolean(silenced),
        // What a reset would stop, and what it would give back.
        cue: cue?.sounds.get(interrupted.soundId)?.name ?? null,
        held: (interrupted?.held ?? []).map(id => game.playlists.get(id)?.name ?? id)
    };
}
