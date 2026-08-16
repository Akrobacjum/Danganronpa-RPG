/**
 * Danganronpa RPG — the music follows the game.
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
 * this module the table must not be able to detect from the outside — private
 * rolls, GM-side scoring and the whole Truth Bullet ledger exist for that — and
 * a track that only ever plays during Stage 5 would announce it to everybody in
 * the room the moment it started. So an incident holds whatever was already
 * playing. The Investigation, by contrast, begins with a body being found: it is
 * public by definition and gets its own mood.
 *
 * WHY THERE IS NO SOCKET IN HERE. Playlists are world documents. One client
 * calls `playAll()`, the document changes, and every other client's own
 * `PlaylistSound#sync` reacts to it — Foundry does the distribution. So unlike
 * voice, this needs no protocol, no acknowledgement and no retry: it only needs
 * exactly one client to be the one deciding, which is the primary GM, the same
 * rule the rest of the module follows.
 *
 * FADES are Foundry's. A playlist's `fade`, or a sound's own, is read by
 * `PlaylistSound#fadeDuration` and applied on both start and stop — this file
 * never animates a volume itself.
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { trialQueue } from "./trial-floor.mjs";
import { isPrimaryGm, debug, log, error, plural } from "./utils.mjs";

/**
 * True while THIS file is changing playback.
 *
 * `resource-guard.mjs` tells automation apart from hand-editing with a flag in
 * the update options, which is the tidier mechanism — but `Playlist#playAll`
 * and `#stopAll` build their own `update()` call and accept no options to pass
 * one through. So the marker has to live here instead: everything this file
 * does goes through `asOurs`, and an update that arrives while that is false is
 * the GM's own.
 */
let applying = false;

async function asOurs(fn) {
    applying = true;
    try {
        return await fn();
    } finally {
        applying = false;
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
 *   eclipse   the placement window — mechanical, everybody is moving tokens.
 *   trial     the Class Trial.
 *   search    the Investigation phase.
 *   <time>    the fallback: whichever of the five times of day it is.
 */
export const MUSIC_STATES = [
    { key: "paused", labelKey: "DRPG.Music.state.paused", test: () => game.paused },
    { key: "eclipse", labelKey: "DRPG.Music.state.eclipse", test: () => getClock().eclipse === true },
    // The floor being OPEN, not the phase being displayed.
    //
    // Setting the chapter phase to "Class Trial" in Edit Campaign is
    // bookkeeping — a GM does it while preparing, often minutes before anyone
    // is in the room, and it used to start the trial music there and then. The
    // trial actually begins when the floor opens and somebody has the right to
    // speak, which is exactly when `trialQueue()` starts answering.
    { key: "trial", labelKey: "DRPG.Music.state.trial", test: () => trialQueue() !== null },
    { key: "search", labelKey: "DRPG.Music.state.search", test: () => getClock().phase === "investigation" },
    ...TIMES_OF_DAY.map(time => ({
        key: `time.${time}`,
        label: TIME_OF_DAY_LABELS[time],
        test: () => getClock().timeOfDay === time
    }))
];

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

function playlistFor(stateKey) {
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

/** The GM's own track, while it is interrupting the ambient one. */
let interrupted = null;

export function registerMusic() {
    Hooks.on("drpgTimeOfDayChanged", () => schedule());
    // Opening or closing the floor is now a state change the music follows.
    // The queue lives in a world setting, so this is the event that carries it.
    Hooks.on("updateSetting", setting => {
        if (setting?.key?.endsWith("trialQueue")) schedule();
    });
    Hooks.on("drpgEclipseChanged", () => schedule());
    Hooks.on("pauseGame", () => schedule());

    Hooks.once("ready", () => {
        watchManualPlayback();
        watchManualEnd();
        // Not immediate: at `ready` the canvas and the clock are still settling,
        // and the first thing a GM sees should not be a fade triggered by a
        // state that is about to change again.
        schedule();
    });
}

function schedule() {
    if (!enabled()) return;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
        settleTimer = null;
        apply().catch(err => error("Could not follow the state with the music", err));
    }, SETTLE_MS);
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
 * playing — which is also exactly the behaviour an incident wants.
 */
async function apply() {
    if (!enabled()) return;

    // The GM is playing something of their own. Their choice outranks the state
    // machine until it finishes; `resume` picks the thread back up.
    //
    // Checked against reality first. `interrupted` is cleared by an event, and
    // an event can be missed — a playlist deleted mid-track, a sound removed, a
    // client that reconnected between the start and the stop. Every one of those
    // used to leave the flag set for good, which silently retired the whole
    // state machine. Nothing is playing on either side means the interruption is
    // over, whatever we did or did not hear about it.
    if (interrupted && !interruptionRunning()) {
        debug("Music: the GM's track is no longer playing; taking the music back.");
        interrupted = null;
        playingState = null;
    }

    // The GM's track outranks the state machine — but only for the state it was
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

    await crossfade(next);
    playingState = state;
    log(`Music: ${state} -> "${next.name}".`);
}

/**
 * Stop everything of ours, start the new one.
 *
 * Sequential rather than simultaneous on purpose: Foundry fades a stopping
 * playlist out and a starting one in, and starting the second before the first
 * has been told to stop gives a few seconds of both at once.
 */
function crossfade(next) {
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

        if (next.playing) return;
        try {
            await next.playAll();
        } catch (err) {
            error(`Could not start "${next.name}"`, err);
        }
    });
}

/**
 * Pause a playlist where it stands, so it can be resumed rather than restarted.
 *
 * Foundry has `playAll` and `stopAll` and no `pauseAll`; pausing is a property
 * of a SOUND, and the sidebar does it as
 * `sound.update({playing: false, pausedTime: sound.sound.currentTime})`. That
 * stored `pausedTime` is what `playAll` looks for when it decides which track to
 * start — `this.sounds.find(s => s.pausedTime)` — so writing it here is the
 * whole of "resume where it left off".
 *
 * A sound whose audio has not decoded yet has no `currentTime` to record. It is
 * stopped rather than paused: restarting a track that had barely begun is not a
 * loss, and a `pausedTime` of zero would read as "not paused" anyway.
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

        if (!updates.length) return;
        try {
            await playlist.update({ playing: false, sounds: updates });
        } catch (err) {
            error(`Could not pause "${playlist.name}"`, err);
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
 * Cut the GM's track off, because the scene it was chosen for has ended.
 *
 * Wrapped in `asOurs` so the stop we cause is not read back as the GM stopping
 * it by hand — `watchManualEnd` and `watchManualPlayback` both bail while
 * `applying` is true, which is the whole reason that marker exists.
 */
async function stopInterruption() {
    const source = interrupted?.sourcePlaylistId
        ? game.playlists.get(interrupted.sourcePlaylistId)
        : null;
    if (!source?.playing) return;

    await asOurs(async () => {
        try {
            await source.stopAll();
        } catch (err) {
            error(`Could not stop "${source.name}"`, err);
        }
    });
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
    // the music comes back — which is the whole point of checking reality
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
        // Ours. See `applying`: this cannot be a flag in the update options,
        // because the methods that produce these updates take none.
        if (applying) return;
        if (!("playing" in changes)) return;

        // A sound inside a playlist we drive is the state machine's business,
        // not a manual interruption — the GM skipping to the next ambient track
        // should not be treated as a scene cue.
        if (ours().some(p => p.id === sound.parent?.id)) return;

        // A soundboard is for one-shots: an OBJECTION sting, a door, a gunshot.
        // Ducking the music for two seconds and fading it back is the wrong
        // shape for those — it makes a sound effect feel like a scene change,
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

    const ambient = ours().find(p => p.playing);
    // `sourcePlaylistId` is the GM's OWN playlist, and it is what makes the
    // interruption end when nothing of ours was holding.
    //
    // Without it this was a one-way door. `watchManualEnd` only ever compared
    // against `playlistId` — the ambient playlist we paused — so an interruption
    // that started while no ambient track was playing recorded `playlistId:
    // null`, and `playlist.id !== null` is true for every playlist that will
    // ever stop. `resumeAmbient()` could not be reached, `interrupted` stayed
    // set for the rest of the session, and `apply()` opens with
    // `if (interrupted) return`. One scene cue played at the wrong moment — the
    // start of a session, or any state the GM has not mapped — and the Class
    // Trial and the Investigation never changed the music again.
    interrupted = {
        soundId: sound.id,
        playlistId: ambient?.id ?? null,
        sourcePlaylistId: sound.parent?.id ?? null,
        // The scene the GM chose this track FOR. `apply()` compares against it,
        // so a track keeps the floor for its own state and loses it the moment
        // the state changes.
        state: currentState()
    };

    if (!ambient) return;

    pausePlaylist(ambient)
        .then(() => debug(`Music: "${sound.name}" took over; "${ambient.name}" is holding.`))
        .catch(err => error(`Could not hold "${ambient.name}"`, err));
}

/**
 * The GM's own playback finishing.
 *
 * Watches the PLAYLIST, not the sound. A single track ending is not the end of
 * the interruption: `Playlist#_onSoundEnd` calls `playNext` for a Sequential or
 * Shuffle playlist, so the GM's next track starts immediately — and resuming on
 * the sound's end meant the ambient playlist faded back IN UNDER the GM's second
 * track, both playing at once. `_getNextSound` also wraps at the end of the
 * list, so a GM playlist runs until it is stopped; that is what "the GM has
 * taken over the music" means, and stopping it is what hands control back.
 */
function watchManualEnd() {
    Hooks.on("updatePlaylist", (playlist, changes) => {
        if (!enabled()) return;
        if (applying) return;
        if (changes.playing !== false) return;
        if (!interrupted) return;
        // Either end counts: the ambient playlist we paused, or the GM's own
        // playlist finishing. The second is the only signal available when
        // nothing of ours was playing when they started.
        const mine = playlist.id === interrupted.playlistId;
        const theirs = playlist.id === interrupted.sourcePlaylistId;
        if (!mine && !theirs) return;
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

/** Give the music back to the state machine. */
function resumeAmbient() {
    const ambient = interrupted?.playlistId
        ? game.playlists.get(interrupted.playlistId)
        : null;
    interrupted = null;

    if (!ambient) {
        // Nothing was holding, so there is nothing to resume — but the state may
        // well have moved on while the GM's track was running.
        playingState = null;
        schedule();
        return;
    }

    // Straight back, no settle window: the silence after a scene cue is exactly
    // where the ambient track is missed.
    //
    // `playAll` resumes rather than restarts, because `pausePlaylist` left a
    // `pausedTime` behind for it to find.
    resumePlaylist(ambient)
        .then(() => {
            debug(`Music: "${ambient.name}" resumed.`);
            // The state may have changed while the GM's track ran — a trial can
            // start behind a scene cue. Re-check rather than assume the room we
            // came back to is the one we left.
            schedule();
        })
        .catch(err => error(`Could not resume "${ambient.name}"`, err));
}

/* ==========================================================================
 * GM SCREEN
 * ========================================================================== */

/** Map each state to one of the world's playlists. */
export async function openMusicDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const playlists = Array.from(game.playlists).sort((a, b) => a.name.localeCompare(b.name));
    if (!playlists.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Music.noPlaylists"));
        return null;
    }

    const map = musicMap();
    const rows = MUSIC_STATES.map(state => {
        const label = state.label ?? game.i18n.localize(state.labelKey);
        const options = [`<option value="">—</option>`, ...playlists.map(p =>
            `<option value="${p.id}"${map[state.key] === p.id ? " selected" : ""}>${
                foundry.utils.escapeHTML(p.name)}</option>`)].join("");

        return `<tr>
            <td>${foundry.utils.escapeHTML(label)}</td>
            <td><select name="state:${state.key}">${options}</select></td>
        </tr>`;
    }).join("");

    const { dialogContent } = await import("./utils.mjs");
    const DialogV2 = foundry.applications.api.DialogV2;

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Music.title") },
        classes: ["drpg-panel", "drpg-projects"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Music.intro")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Music.orderNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Music.incidentNote")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Music.when")}</th>
                <th>${game.i18n.localize("DRPG.Music.playlist")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Music.fadeNote")}</p>
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
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

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

/**
 * Re-evaluate now. For the setting's own `onChange` and for the console.
 *
 * `playingState` is cleared first so this re-asserts rather than deciding it has
 * nothing to do: whatever is playing was chosen under the old configuration.
 */
export function refreshMusic() {
    playingState = null;
    schedule();
}

/** Console tool: what the module thinks is going on. */
export function musicStatus() {
    const state = currentState();
    return {
        enabled: enabled(),
        state,
        playlist: playlistFor(state)?.name ?? null,
        playing: ours().filter(p => p.playing).map(p => p.name),
        interrupted: Boolean(interrupted)
    };
}

/**
 * Every state, whether it currently applies, and what it is mapped to.
 *
 * A state that never takes over has exactly four possible reasons and they are
 * indistinguishable from the outside: the switch is off, this client is not the
 * one driving, the state's condition is not actually true, or nothing is mapped
 * to it. This prints all four at once rather than leaving it to be guessed at —
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
        "",
        "state            applies  playlist"
    ];

    for (const state of MUSIC_STATES) {
        let applies = false;
        try {
            applies = Boolean(state.test());
        } catch (err) {
            applies = `error: ${err.message}`;
        }
        const playlist = map[state.key]
            ? game.playlists.get(map[state.key])?.name ?? "MAPPED TO A MISSING PLAYLIST"
            : "—";
        const mark = state.key === winner ? " <- wins" : "";
        lines.push(`${state.key.padEnd(16)} ${String(applies).padEnd(8)} ${playlist}${mark}`);
    }

    if (!winner) lines.push("", "No state applies at all — nothing will play.");
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
