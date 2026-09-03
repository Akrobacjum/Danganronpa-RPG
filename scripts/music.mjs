/**
 * Danganronpa RPG - the music follows the game.
 * ---------------------------------------------------------------------------
 * A killing game has a small number of moods and the GM changes between them
 * constantly: the placement window, a trial, an investigation, and five times of
 * day underneath all of it. Driving that by hand means a GM who is already
 * running an incident is also hunting for a playlist, so in practice the music
 * stops changing about ten minutes in.
 *
 * This maps each state to a playlist the GM chooses and keeps them in step.
 *
 * WHAT DELIBERATELY HAS NO MUSIC: the incident. A murder is the one thing in
 * this module the table must not be able to detect from the outside - private
 * rolls, GM-side scoring and the whole Truth Bullet ledger exist for that - and
 * a track that only ever plays during Stage 5 would announce it to everybody in
 * the room the moment it started. So an incident holds whatever was already
 * playing. The Investigation, by contrast, begins with a body being found: it is
 * public by definition and gets its own mood.
 *
 * WHY THERE IS NO SOCKET IN HERE. Playlists are world documents. One client
 * calls `playAll()`, the document changes, and every other client's own
 * `PlaylistSound#sync` reacts to it - Foundry does the distribution. So unlike
 * voice, this needs no protocol, no acknowledgement and no retry: it only needs
 * exactly one client to be the one deciding, which is the primary GM, the same
 * rule the rest of the module follows.
 *
 * FADES are Foundry's. A playlist's `fade`, or a sound's own, is read by
 * `PlaylistSound#fadeDuration` and applied on both start and stop - this file
 * never animates a volume itself.
 *
 * THE TRIAL IS THREE STATES, NOT ONE (E6). Everything else in this file is one
 * mood that lasts as long as the scene does. A Class Trial is not: it is a
 * discussion that keeps being taken away by an Objection and handed back, and
 * scoring all of it with one playlist is the difference between a trial that
 * builds and a trial that is forty minutes of the same track. So the trial
 * reads the FLOOR, which is the module's own record of who may speak, and it
 * brings two behaviours nothing else here needs: a random track per takeover
 * (`randomTrack`) so a second Objection is not the first one again, and a path
 * that skips the settle window (`immediate`) because an Objection lasts sixty
 * seconds and half of one spent arriving is audible.
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, SITUATIONAL_PLAYLIST } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { trialFloor, FLOOR_MODES } from "./trial-floor.mjs";
import { isPrimaryGm, debug, log, warn, error, plural } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";

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

/**
 * Every state that can own the music, most important first.
 *
 * Order is the answer to "a trial at night during an Eclipse" and it is
 * deliberately a plain list rather than a set of nested conditions: the first
 * one that applies wins, and reading the list is reading the rule.
 *
 *   paused    the game is stopped. Nothing is happening in the fiction at all.
 *   eclipse   the placement window - mechanical, everybody is moving tokens.
 *   trial     the Class Trial.
 *   search    the Investigation phase.
 *   <time>    the fallback: whichever of the five times of day it is.
 */
export const MUSIC_STATES = [
    { key: "paused", labelKey: "DRPG.Music.state.paused", test: () => game.paused },
    { key: "eclipse", labelKey: "DRPG.Music.state.eclipse", test: () => getClock().eclipse === true },
    /*
     * THE TRIAL, IN THE ORDER ITS OWN MODES OUTRANK EACH OTHER.
     *
     * There used to be one entry here, testing "is the floor open" - which
     * meant a Class Trial with no debate running played the time of day, and
     * an Objection played whatever the debate had been playing. Both are the
     * trial's loudest moments arriving with no change in the room.
     *
     * REBUTTAL HAS NO STATE OF ITS OWN, and it belongs to the OBJECTION rather
     * than to the debate. It used to fall in with the debate, on the reading
     * that "on a rebuttal the debate plays again". Dawid, 28.08: it should not
     * change the playlist at all - the objection's music simply keeps going.
     *
     * Which is the truer reading of the same idea. An objection and the rebuttal
     * it buys are ONE exchange, three minutes long, and the only new thing about
     * the second half is that the person who was accused now answers. Cutting to
     * a different track at the sixty-second mark scores that as a scene ENDING.
     * Leaving the music where it is scores it as the same scene continuing,
     * which is what it is - and it means the trial's loudest cue plays for its
     * whole length instead of a third of it.
     *
     * Still no fourth playlist. A mode does not need music of its own to be
     * handled; it needs to be in the right entry.
     *
     * `trial.discussion` is the trial WITHOUT an open floor - the phase set,
     * everybody in the room, nobody holding anything. It is last of the three
     * because it is the widest: the floor being open is also the phase being
     * `classTrial`, so an unordered version of this would never reach the
     * other two.
     */
    {
        key: "trial.objection", labelKey: "DRPG.Music.state.trialObjection",
        randomTrack: true,
        // Sixty seconds, all of them audible. See `schedule`.
        immediate: true,
        test: () => {
            const mode = trialFloor()?.mode;
            return mode === FLOOR_MODES.objection || mode === FLOOR_MODES.rebuttal;
        }
    },
    {
        key: "trial.debate", labelKey: "DRPG.Music.state.trialDebate",
        randomTrack: true,
        test: () => trialFloor()?.mode === FLOOR_MODES.debate
    },
    {
        key: "trial.discussion", labelKey: "DRPG.Music.state.trialDiscussion",
        randomTrack: true,
        test: () => getClock().phase === "classTrial"
    },
    { key: "search", labelKey: "DRPG.Music.state.search", test: () => getClock().phase === "investigation" },
    ...TIMES_OF_DAY.map(time => ({
        key: `time.${time}`,
        label: TIME_OF_DAY_LABELS[time],
        test: () => getClock().timeOfDay === time
    }))
];

/** One state's declaration, for the two behaviours only the trial uses. */
function stateDef(key) {
    return MUSIC_STATES.find(s => s.key === key) ?? null;
}

/** Which state owns the music right now. */
export function currentState() {
    return MUSIC_STATES.find(s => {
        try {
            return s.test();
        } catch {
            return false;
        }
    })?.key ?? null;
}

/** The GM's state -> playlist id map. */
export function musicMap() {
    return getSetting(SETTINGS.musicMap) ?? {};
}

export function playlistFor(stateKey) {
    const id = musicMap()[stateKey];
    return id ? game.playlists.get(id) ?? null : null;
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
let interrupted = null;

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
    Hooks.on("updateSetting", setting => {
        const key = setting?.key;
        if (key !== `${MODULE_ID}.${SETTINGS.trialQueue}`
            && key !== `${MODULE_ID}.${SETTINGS.clock}`) return;
        // Asked AFTER the setting has landed, so this is the state we are
        // moving TO rather than the one we are leaving.
        schedule({ now: stateDef(currentState())?.immediate === true });
    });
    Hooks.on("drpgEclipseChanged", () => schedule());
    Hooks.on("pauseGame", () => schedule());

    Hooks.once("ready", () => {
        watchManualPlayback();
        watchManualEnd();
        adoptRunningInterruption();
        // Not immediate: at `ready` the canvas and the clock are still settling,
        // and the first thing a GM sees should not be a fade triggered by a
        // state that is about to change again.
        schedule();
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
        // track outstay its scene. Same rule as the `!next` branch below.
        if (moved === interrupted.state || !playlistFor(moved)) return;
        log(`Music: the state moved to "${moved}" while the GM's track ran; taking over.`);
        await stopInterruption();
        interrupted = null;
        playingState = null;
    }

    const state = currentState();
    if (!state || state === playingState) return;

    const next = playlistFor(state);
    if (!next) {
        debug(`Music: nothing mapped for "${state}"; leaving the current track alone.`);
        return;
    }

    await crossfade(next, { randomTrack: stateDef(state)?.randomTrack === true });
    playingState = state;
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
 */
function crossfade(next, { randomTrack = false } = {}) {
    return asOurs(async () => {
        for (const playlist of ours()) {
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
        } catch (err) {
            error(`Could not start "${next.name}"`, err);
        }
    });
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
function ours() {
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

/* ==========================================================================
 * GM SCREEN
 * ========================================================================== */

/** Map each state to one of the world's playlists. */
export async function openSoundDialog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-sound")) return null;

    const { dialogContent, tableDialog, panelTabs, wirePanelTabs } = await import("./utils.mjs");
    const { soundSlidersHtml, soundEffectsHtml, wireSoundPanel } = await import("./sfx.mjs");

    /*
     * A PLAYER GETS THE SLIDERS AND NOTHING ELSE.
     *
     * This window used to be refused to them outright, which was right while it
     * held only a GM's mapping tables. It now also holds the two volumes, and
     * those are the one thing here that is NOT the GM's business: they are per
     * browser, they change nothing anybody else hears, and a GM setting them
     * for a player would be setting them wrong.
     *
     * So the same window opens for everybody and simply has less in it. Not a
     * second, player-shaped window: two windows about the same two sliders is
     * how the two drift apart.
     */
    if (!game.user.isGM) {
        await tableDialog({
            window: { title: game.i18n.localize("DRPG.Sound.title") },
            classes: ["drpg-panel", "drpg-projects", "drpg-sound", "drpg-sound-player", "drpg-window-sound"],
            // NARROW, AND SAID HERE RATHER THAN LEFT TO THE FIT.
            // `tableDialog` marks every window it makes as a table window,
            // which is what exempts it from the module's one-width rule so a
            // measured fit can win. This window has no table to measure, so
            // the exemption left it with nothing at all and it opened the full
            // width of the screen. Two sliders need about a third of that.
            position: { width: 460 },
            content: dialogContent(`<form>${soundSlidersHtml()}</form>`),
            buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close") }],
            render: (event, dialog) => wireSoundPanel(dialog.element),
            rejectClose: false
        });
        return null;
    }

    /*
     * A WORLD WITH NO PLAYLISTS STILL OPENS THIS WINDOW.
     *
     * It used to be refused at the door with "make one in the Playlists sidebar
     * first" - which was true right up until the Play tab grew a button that
     * makes the cue playlist itself. The one action that fixes an empty world
     * now lives inside the window the empty world was not allowed to open.
     *
     * The mapping table below is the part that genuinely needs playlists to
     * exist, and it says so in place rather than closing the door on the other
     * tab. Same reasoning as the missing cue playlist: report it where it is,
     * do not refuse the whole screen over it.
     */
    const playlists = Array.from(game.playlists).sort((a, b) => a.name.localeCompare(b.name));

    const map = musicMap();
    const rows = MUSIC_STATES.map(state => {
        const label = state.label ?? game.i18n.localize(state.labelKey);
        const options = [`<option value="">-</option>`, ...playlists.map(p =>
            `<option value="${p.id}"${map[state.key] === p.id ? " selected" : ""}>${
                foundry.utils.escapeHTML(p.name)}</option>`)].join("");

        return `<tr>
            <td>${foundry.utils.escapeHTML(label)}</td>
            <td><select name="state:${state.key}">${options}</select></td>
        </tr>`;
    }).join("");

    // The cue playlist, if the world has one. Its absence is not an error -
    // the state-to-playlist table below is the other half of this window and
    // works perfectly well without it - so it is reported in place rather than
    // refused at the door.
    const situational = situationalPlaylist();
    // An empty cue playlist is the same to this button as a missing one.
    const canPlay = Boolean(situational?.sounds.size);

    // Three tabs, Play first (Dawid, 26.08): the cue controls a GM reaches
    // for mid-scene, then the state-to-playlist mapping they set up once, then
    // the sound-effect files. Apply still reads the mapping selects whichever
    // tab is showing - panes are hidden by class, never removed; see
    // `panelTabs` in utils.mjs.
    const playPane = `
            <fieldset class="drpg-music-now">
                <legend>${game.i18n.localize("DRPG.Music.playNow")}</legend>
                <p class="notes">${game.i18n.format("DRPG.Music.playNowNote",
                    { name: SITUATIONAL_PLAYLIST })}</p>
                ${situational
                    ? `<label>${game.i18n.localize("DRPG.Music.track")}
                    <select name="playTrack">${trackOptions(situational)}</select></label>`
                    // MADE FROM HERE, NOT DESCRIBED FROM HERE.
                    //
                    // This said "make one in the Playlists sidebar" and left the
                    // GM to do it: find the tab, press Create Playlist, and type
                    // the name - where the name is the whole hinge, because the
                    // playlist is matched BY NAME (see `situationalPlaylist`). A
                    // typo produces a playlist this module silently ignores, and
                    // nothing on any screen says why.
                    //
                    // So the module spells it. The button exists only while the
                    // playlist is missing, and it disappears the moment there is
                    // one.
                    : `<p class="notes drpg-warning" data-drpg-no-cue>${game.i18n.format(
                        "DRPG.Music.noSituational", { name: SITUATIONAL_PLAYLIST })}</p>
                    <button type="button" class="drpg-mini-button" data-drpg-make-cue>${
                        game.i18n.format("DRPG.Music.makeSituational",
                            { name: SITUATIONAL_PLAYLIST })}</button>`}
                <button type="button" class="drpg-mini-button" data-drpg-play${
                    canPlay ? "" : " disabled"}>${
                    game.i18n.localize("DRPG.Music.play")}</button>
                <button type="button" class="drpg-mini-button" data-drpg-reset-music>${
                    game.i18n.localize("DRPG.Music.reset")}</button>
            </fieldset>`;

    const playlistsPane = `
            <p>${game.i18n.localize("DRPG.Music.intro")}</p>
            ${playlists.length ? "" : `<p class="notes drpg-warning">${
                game.i18n.localize("DRPG.Music.noPlaylists")}</p>`}
            <p class="notes">${game.i18n.localize("DRPG.Music.orderNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Music.trialNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Music.incidentNote")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Music.when")}</th>
                <th>${game.i18n.localize("DRPG.Music.playlist")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Music.fadeNote")}</p>`;

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Sound.title") },
        classes: ["drpg-panel", "drpg-projects", "drpg-wide", "drpg-sound", "drpg-window-sound"],
        // The tabs measure to one size rather than the window jumping between
        // a two-line Play pane and a thirty-five-row table - trap 29. It works
        // on `panelTabs` markup as of E3; before that it silently measured
        // only the visible tab.
        fitTabs: true,
        // ABOVE THE TABS, NOT INSIDE ONE. The sliders are not about music or
        // about effects, they are about this browser - and putting them in a
        // tab would leave a player looking at a tab bar with one tab in it.
        content: dialogContent(`<form>
            ${soundSlidersHtml()}
            ${panelTabs([
                { key: "play", label: game.i18n.localize("DRPG.Sound.tabPlay"), html: playPane },
                { key: "music", label: game.i18n.localize("DRPG.Sound.tabMusic"), html: playlistsPane },
                { key: "effects", label: game.i18n.localize("DRPG.Sound.tabEffects"),
                  html: soundEffectsHtml() }
            ])}
        </form>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => {
                    const out = {};
                    for (const select of d.element.querySelectorAll("[name^='state:']")) {
                        const key = select.name.slice("state:".length);
                        if (select.value) out[key] = select.value;
                    }
                    return out;
                }
            },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        // Both controls act at once and the window stays open, like the Monocub
        // manager's "give Hope": a GM putting a track under a moment at the
        // table is not filling in a form, and Apply is about the mapping table
        // below rather than about what is playing right now.
        render: (event, dialog) => {
            const root = dialog.element;
            /*
             * ONE APPLY, AND IT BELONGS TO ONE TAB.
             *
             * The playlist mapping is the only thing in this window that waits
             * for a button: the cue controls act where they are, and the sound
             * files and the volumes save as they are touched, because a mapping
             * you cannot Test until you have closed and reopened the window is
             * a mapping nobody trusts. So Apply appears on the Music tab and
             * nowhere else, and nothing is lost by its absence elsewhere.
             */
            wirePanelTabs(root, {
                buttons: { play: [], music: ["save"], effects: [] },
                always: ["close"]
            });
            wireSoundPanel(root);
            const track = root.querySelector("[name=playTrack]");

            root.querySelector("[data-drpg-play]")?.addEventListener("click", async () => {
                const sound = await playTrack(track?.value);
                if (sound) {
                    ui.notifications.info(game.i18n.format("DRPG.Music.playing",
                        { track: sound.name }));
                }
            });

            root.querySelector("[data-drpg-reset-music]")?.addEventListener("click", async () => {
                await resetMusic();
                ui.notifications.info(game.i18n.localize("DRPG.Music.wasReset"));
            });

            /*
             * Make the cue playlist, and swap the fieldset over IN PLACE.
             *
             * Not by reopening the window, which is the obvious way and the
             * wrong one: the Playlists tab beside this holds a table of selects
             * the GM may already have changed, and Apply has not run yet.
             * Reopening would throw that away to save a redraw.
             *
             * The Play button deliberately stays disabled. A playlist made this
             * second has no tracks in it, and a button that says it will play
             * something is lying until the GM has put something there - which
             * is what the replacement note asks for.
             */
            root.querySelector("[data-drpg-make-cue]")?.addEventListener("click", async event => {
                const button = event.currentTarget;
                button.disabled = true;
                try {
                    const made = situationalPlaylist()
                        ?? await Playlist.create({ name: SITUATIONAL_PLAYLIST });
                    if (!made) throw new Error("Playlist.create returned nothing");

                    const note = root.querySelector("[data-drpg-no-cue]");
                    if (note) {
                        note.classList.remove("drpg-warning");
                        note.textContent = game.i18n.format("DRPG.Music.situationalMade",
                            { name: made.name });
                    }

                    // The track picker the fieldset would have been built with.
                    const label = document.createElement("label");
                    label.textContent = `${game.i18n.localize("DRPG.Music.track")} `;
                    const select = document.createElement("select");
                    select.name = "playTrack";
                    select.innerHTML = trackOptions(made);
                    label.append(select);
                    note?.after(label);

                    button.remove();
                    ui.notifications.info(game.i18n.format("DRPG.Music.situationalMade",
                        { name: made.name }));
                } catch (err) {
                    button.disabled = false;
                    error("Could not create the cue playlist", err);
                    ui.notifications.error(game.i18n.localize("DRPG.Music.makeFailed"));
                }
            });
        },
        rejectClose: false
    });

    if (!result || result === "close" || result === "cancel") return null;

    const { setSetting } = await import("./settings.mjs");
    await setSetting(SETTINGS.musicMap, result);

    // The map just changed, so whatever is playing may no longer be right.
    playingState = null;
    schedule();

    ui.notifications.info(plural("DRPG.Music.saved", {
        n: Object.keys(result).length
    }));
    return result;
}

/** The sounds inside one playlist, as <option>s. Empty when it has none. */
function trackOptions(playlist) {
    const sounds = Array.from(playlist?.sounds ?? [])
        .sort((a, b) => a.name.localeCompare(b.name));
    if (!sounds.length) {
        return `<option value="">${game.i18n.localize("DRPG.Music.noTracks")}</option>`;
    }
    return sounds.map(s =>
        `<option value="${s.id}">${foundry.utils.escapeHTML(s.name)}</option>`).join("");
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
        // What a reset would stop, and what it would give back.
        cue: cue?.sounds.get(interrupted.soundId)?.name ?? null,
        held: (interrupted?.held ?? []).map(id => game.playlists.get(id)?.name ?? id)
    };
}

/**
 * Every state, whether it currently applies, and what it is mapped to.
 *
 * A state that never takes over has exactly four possible reasons and they are
 * indistinguishable from the outside: the switch is off, this client is not the
 * one driving, the state's condition is not actually true, or nothing is mapped
 * to it. This prints all four at once rather than leaving it to be guessed at -
 * the same job `diagnoseVoice` does for the other subsystem that fails quietly.
 */
export function diagnoseMusic() {
    const clock = getClock();
    const map = musicMap();
    const winner = currentState();

    const lines = [
        `Setting "music follows the game state": ${
            getSetting(SETTINGS.musicEnabled) ? "on" : "OFF"}`,
        `This client drives playback: ${isPrimaryGm() ? "yes" : "no"}`,
        `Clock: phase=${clock.phase ?? "(unset)"} timeOfDay=${clock.timeOfDay ?? "(unset)"} eclipse=${
            clock.eclipse === true} paused=${game.paused}`,
        `Playlists in this world: ${game.playlists.size}`,
        `Cue playlist ("${SITUATIONAL_PLAYLIST}"): ${
            situationalPlaylist()
                ? `${situationalPlaylist().sounds.size} track(s)`
                : "MISSING - the Play button has nothing to draw from"}`,
        `A cue is running: ${interrupted ? "yes" : "no"}${
            interrupted?.held?.length ? `, holding ${interrupted.held.length} playlist(s)` : ""}`,
        "",
        "state              applies  playlist"
    ];

    for (const state of MUSIC_STATES) {
        let applies = false;
        try {
            applies = Boolean(state.test());
        } catch (err) {
            applies = `error: ${err.message}`;
        }
        const mapped = map[state.key] ? game.playlists.get(map[state.key]) : null;
        // "Mapped to a playlist with nothing in it" is silence that looks
        // exactly like a correct mapping from every other angle.
        const playlist = !map[state.key] ? "-"
            : !mapped ? "MAPPED TO A MISSING PLAYLIST"
            : !mapped.sounds.size ? `${mapped.name} - EMPTY, nothing to play`
            : mapped.name;
        const mark = state.key === winner ? " <- wins" : "";
        const random = state.randomTrack ? " (random track)" : "";
        lines.push(`${state.key.padEnd(18)} ${String(applies).padEnd(8)} ${playlist}${mark}${random}`);
    }

    if (!winner) lines.push("", "No state applies at all - nothing will play.");
    else if (!map[winner]) {
        lines.push("", `"${winner}" is the active state but has no playlist mapped, so the`
            + " music is deliberately left alone. Map it in GM panel -> Right now -> Music by state.");
    }

    const text = lines.join("\n");
    console.log(`${MODULE_ID} | Music diagnostics\n${text}`);
    ChatMessage.create({
        content: `<h3>Music diagnostics</h3><pre style="white-space:pre-wrap;font-size:0.85em">${
            foundry.utils.escapeHTML(text)}</pre>`,
        whisper: [game.user.id]
    });
    return text;
}
