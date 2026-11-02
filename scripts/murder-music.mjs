/**
 * Danganronpa RPG - the murder music.
 * ---------------------------------------------------------------------------
 * The music only the people in a killing hear, one browser at a time: the
 * track drawn for an incident (`murderTrackFor`, `murderPlayData`), the room's
 * music held on this browser while it plays (`createRoomHold`), the overlay's
 * machine (`createMurderOverlay`) and its one copy per browser (`roomHold`,
 * `murderOverlay`), what this browser hears of it (`murderMusicHere`), the
 * overlay put in step with the incident (`applyMurderMusic`), and the Music
 * volume an older version parked put back (`restoreDuckedMusic`). The account
 * of why it is an overlay and not a state, and what that costs, is the banner
 * over `soundboardMode` below.
 *
 * WHERE IT SITS. Moved out of music.mjs by E41 C9a (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. It reads the map's
 * `playlistFor` from music-states.mjs; the engine (music-play.mjs) reads the
 * hold and the overlay here. music.mjs re-exports the seven names here it
 * exported before, so every importer still imports music.mjs, and nothing here
 * imports it (the facade rule, .claude/rules/code.md).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, incidentWitness, incidentCast } from "./settings.mjs";
import { debug, log, warn } from "./utils.mjs";
import { playlistFor } from "./music-states.mjs";

/* ==========================================================================
 * THE MURDER MUSIC - one browser at a time
 * --------------------------------------------------------------------------
 * Dawid, 15.09: the people in a killing get their own playlist, and nobody
 * else hears it.
 *
 * WHY IT CANNOT BE A STATE LIKE THE OTHERS. Everything above this line works
 * because a Foundry playlist is a WORLD DOCUMENT: the primary GM calls
 * `playAll()`, the document changes, and every client's own `PlaylistSound`
 * reacts. That is the whole reason this file needs no socket - and it is also
 * the reason it cannot do this, because a world document reaches the four
 * people who must not know a murder is happening just as reliably as it
 * reaches the two who are in it.
 *
 * SO IT IS AN OVERLAY, AND IT COSTS TWO THINGS - both worth saying plainly
 * rather than discovering at a table:
 *
 *   1. ONE TRACK, NOT A PLAYLIST. `AudioHelper.play(..., false)` plays a file
 *      on this browser and nowhere else, which is exactly the audience needed,
 *      but it is a file. So a track is drawn from the mapped playlist and
 *      looped. A playlist's own shuffle, fades and track order are Foundry's
 *      and do not come with it. The draw is the incident's, not the browser's
 *      (`murderTrackFor`): everybody in one killing hears the same track.
 *   2. THE ROOM'S MUSIC IS HELD HERE. Otherwise a participant hears both at
 *      once. The track plays on the Music channel (the owner's answer of
 *      04.10: "kanał music zamiast interface"), so it follows the player's own
 *      Music slider - and for that very reason the room's music can no longer
 *      be ducked by turning that slider down, as it was until E19: the channel's
 *      volume is the slider (fvtt-types 14.366 `AudioHelper`, a gain per
 *      channel; not measured here, the harness has no audio). So the room's
 *      sounds are held on this browser instead (`createRoomHold`) and given
 *      back when it is over: paused on a player's browser (04.10: "pauzowane"),
 *      held in place on a GM's, whose browser moves the table's playlists on.
 *
 * NOTHING MAPPED MEANS NOTHING HAPPENS, the same contract every other row in
 * the table has: a GM who has not chosen a murder playlist gets the behaviour
 * the module had before this existed, which is the room's own music carrying
 * on. The room is held only while a murder track is really playing here.
 * ========================================================================== */

/** Foundry's soundboard mode (`CONST.PLAYLIST_MODES.DISABLED`, -1 in fvtt-types 14.366); the harness defines no PLAYLIST_MODES. */
export function soundboardMode() {
    return globalThis.CONST?.PLAYLIST_MODES?.DISABLED ?? -1;
}

/**
 * The track one incident plays, the same on every browser in it (audit S11-42).
 *
 * Until E19 each browser drew at random, so the killer and the victim heard two
 * different tracks of the same killing. Now the draw is a hash of the incident's
 * key - its opening time, which the GMs' record and every participant's copy hold
 * alike - over the playlist's tracks in id order, which no browser can see
 * differently. A track with no file is not a track.
 *
 * @param {Iterable<{id: string, path?: string}>} sounds
 * @param {*} key   the incident's (`openedAt`)
 * @returns {object|null}  the PlaylistSound
 */
export function murderTrackFor(sounds, key) {
    const pool = [...(sounds ?? [])].filter(s => s?.path).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (!pool.length) return null;
    // FNV-1a over the key's text: small, the same in every browser, and spread enough for a playlist's length.
    let hash = 0x811c9dc5;
    for (const ch of String(key ?? "")) {
        hash ^= ch.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return pool[hash % pool.length];
}

/**
 * What `AudioHelper.play` is handed for the murder track (audit S11-42).
 *
 * The Music channel, so the player's Music slider is the volume they hear it at;
 * the track's own volume from the playlist, which a GM sets per track (until E19
 * the track played at the Music volume the room had, on the Interface channel,
 * so a player who had turned the clicks down heard no murder music at all).
 */
export function murderPlayData({ src, volume }) {
    const level = Number(volume);
    return { src, volume: Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 1, loop: true, autoplay: true, channel: "music" };
}

/**
 * The room's music, paused or held on this browser while a murder track plays.
 *
 * PAUSED ON A PLAYER'S BROWSER (the owner's 04.10: "playlisty pokoju pauzowane na
 * czas incydentu"). Each room sound playing here is paused (`Sound#pause`) and,
 * when the incident is over, resumed where it stood (`Sound#play` with no
 * offset resumes from `pausedTime` and keeps the loop and volume it had,
 * fvtt-types 14.366; not measured on real audio, the harness has none). A
 * player's browser drives no playlist - it cannot write one - so a pause there
 * moves nothing for the table.
 *
 * HELD IN PLACE ON A GM'S BROWSER. A GM is always in the incident, and a
 * playlist moves to its next track when a GM's browser hears the last one end;
 * a paused sound never ends, so a pause there would stop the table's playlist
 * for everybody. There each sound's own volume goes to 0 while it runs, and is
 * given back at the volume its track carries. Until E19 fix r1-G3 (the review's
 * F2) every browser was held in place, and a player came back to the room
 * minutes on from where the incident had taken them.
 *
 * A SOUND THAT STARTS LATER IS PAUSED OR HELD AS IT STARTS: every sound of the
 * room is listened to for "play" once, and while the hold is on, a start - a
 * new track, a sync that set the volume or started a paused sound again - is
 * put back. A track the playlist no longer plays when the hold ends (the GM's
 * browser moved on, a GM stopped it) is stopped rather than resumed, so its
 * pause point does not come back with it later. A soundboard is left alone:
 * its one-shots are effects, not the room's music, as `holdEverything` reads
 * them.
 *
 * @param {object} [options]
 * @param {() => boolean} [options.pauses]  whether this browser pauses (a player's) or holds in place (a GM's);
 *   read when a hold begins
 */
export function createRoomHold({ pauses = () => false } = {}) {
    let holding = false;
    let pausing = false;
    const held = new Map();
    const heard = new WeakSet();
    const quiet = sound => {
        const local = sound?.sound;
        if (!local?.playing) return;
        if (pausing && typeof local.pause === "function") {
            try {
                local.pause();
                held.set(sound, "paused");
                return;
            } catch (err) {
                debug("Murder music: a room sound would not pause; held at 0 instead", err);
            }
        }
        // Playing at 0, whatever it was before: given back by its volume.
        local.volume = 0;
        held.set(sound, "muted");
    };
    return {
        hold(playlists) {
            if (!holding) pausing = Boolean(pauses());
            holding = true;
            for (const playlist of playlists ?? []) {
                if (playlist?.mode === soundboardMode()) continue;
                for (const sound of playlist.sounds ?? []) {
                    const local = sound?.sound;
                    if (!local) continue;
                    if (!heard.has(local) && typeof local.addEventListener === "function") {
                        heard.add(local);
                        local.addEventListener("play", () => { if (holding) quiet(sound); });
                    }
                    quiet(sound);
                }
            }
        },
        release() {
            holding = false;
            for (const [sound, how] of held) {
                const local = sound.sound;
                if (!local) continue;
                if (how === "paused") {
                    const failed = err => debug("Murder music: a paused room sound would not resume or stop", err);
                    try {
                        // Resumed from where it was paused; a track the playlist has left is stopped instead.
                        Promise.resolve(sound.playing ? local.play() : local.stop()).catch(failed);
                    } catch (err) {
                        failed(err);
                    }
                    continue;
                }
                const level = Number(sound.volume);
                local.volume = Number.isFinite(level) ? level : 1;
            }
            held.clear();
        },
        holding: () => holding
    };
}

/**
 * The overlay's states (audit S11-07), its effects handed in.
 *
 * Until E19 the overlay turned the room down BEFORE it asked for the track, and
 * three things followed: a file that 404s comes back as a sound with `failed`
 * (it does not throw), so the participant sat in silence; a browser not clicked
 * yet waits in `AudioHelper.play` for the first click, so the room stayed down
 * and the loop started after the incident had ended, with nothing to stop it;
 * and a reload parked the Music volume the incident had already turned down.
 *
 *   - the room is held only once a track really plays (`playing`, which
 *     `murderMusicHere` reads);
 *   - every start and stop takes a new generation, and a track that arrives for
 *     an older one is stopped as it arrives;
 *   - a file that fails is said once (`unplayable`) and not asked for again
 *     in that incident (its key); the next incident asks for it once more.
 *     Until E19 fix r1-G3 (the review's E19-COR-5) it was skipped until the
 *     playlist gave another file, and a murder playlist of one track never
 *     does: one 404 (a late upload, a fetch that hiccuped) meant no murder
 *     music and the room not held in every later incident until F5;
 *   - asked again for the track it is playing or waiting for, it does nothing,
 *     so every murder write can ask.
 *
 * @param {object} effects
 * @param {(key: *) => ({src: string, volume: number, name: string, playlist: string}|null)} effects.pick
 * @param {(pick: object) => Promise<object|null>} effects.play
 * @param {() => void} effects.holdRoom
 * @param {() => void} effects.releaseRoom
 * @param {(pick: object) => void} [effects.unplayable]
 * @param {(state: object) => void} [effects.changed]
 */
export function createMurderOverlay({ pick, play, holdRoom, releaseRoom, unplayable = () => {}, changed = () => {} }) {
    let generation = 0;
    let asked = null;
    let track = null;
    let heard = null;
    let failed = null;
    let failedIn = null;
    const state = () => ({
        playing: Boolean(track), track: heard?.name ?? null, playlist: heard?.playlist ?? null,
        volume: heard?.volume ?? null, failed
    });
    const stop = async () => {
        generation++;
        const was = track;
        track = null;
        heard = null;
        asked = null;
        try {
            await was?.stop?.();
        } catch (err) {
            debug("Murder music: the track would not stop", err);
        }
        releaseRoom();
        changed(state());
    };
    async function want(inIt, key = null) {
        const next = inIt ? pick(key) : null;
        if (!next) {
            // Out of the incident (or nothing mapped): the next one tries its file afresh.
            failed = null;
            failedIn = null;
            if (asked || track) await stop();
            return state();
        }
        if (next.src === asked || (next.src === failed && key === failedIn)) return state();
        if (asked || track) await stop();
        const mine = ++generation;
        asked = next.src;
        let sound = null;
        try {
            sound = await play(next);
        } catch (err) {
            debug("Murder music: the track would not start", err);
        }
        if (mine !== generation) {
            // Asked for by an incident that has ended, or by a start a newer one replaced.
            try {
                await sound?.stop?.();
            } catch (err) {
                debug("Murder music: a late track would not stop", err);
            }
            return state();
        }
        if (!sound || sound.failed) {
            asked = null;
            failed = next.src;
            failedIn = key;
            unplayable(next);
            return state();
        }
        failed = null;
        failedIn = null;
        track = sound;
        heard = next;
        holdRoom();
        changed(state());
        return state();
    }
    return { want, state };
}

/** This browser's room hold and overlay, wired to Foundry. */
export const roomHold = createRoomHold({ pauses: () => !game.user?.isGM });
export const murderOverlay = createMurderOverlay({
    pick: key => {
        const playlist = playlistFor("murder");
        const sound = murderTrackFor(playlist?.sounds, key);
        return sound ? { src: sound.path, volume: sound.volume, name: sound.name ?? "", playlist: playlist.name ?? "" } : null;
    },
    play: next => foundry.audio.AudioHelper.play(murderPlayData(next), false),
    holdRoom: () => roomHold.hold(game.playlists ?? []),
    releaseRoom: () => roomHold.release(),
    unplayable: next => warn(`Murder music: the track "${next.name}" (${next.src}) could not be played; the room's music carries on.`),
    changed: state => Hooks.callAll("drpgMurderMusicChanged", state)
});

/** Whether the murder music is playing on this browser, and what: for the band under the clock and the diagnostics. */
export function murderMusicHere() {
    return murderOverlay.state();
}

/** The incident's key for the draw: its opening time, in the GMs' record and every participant's copy alike. */
function incidentKey() {
    return incidentCast()?.openedAt ?? null;
}

/**
 * Is this browser in a killing, and is the music where that says it should be?
 *
 * Cheap and idempotent: the overlay compares the answer with what it is playing
 * or waiting for, so every murder write, every cast copy and every change of the
 * murder playlist can call it.
 */
export async function applyMurderMusic() {
    if (!game.user) return;
    const inIt = Boolean(incidentWitness().witness);
    await murderOverlay.want(inIt, inIt ? incidentKey() : null);
    // While it plays, a room sound created or started since is held too.
    if (murderOverlay.state().playing) roomHold.hold(game.playlists ?? []);
}

/**
 * A volume an earlier version parked, given back (E19-26).
 *
 * Until E19 the overlay ducked the room by setting the Music volume to 0 and
 * parked what it had been in `musicDuckedFrom`; a reload mid-incident parked
 * the 0 over it. Nothing parks now. Called once at `ready`, in an incident or
 * not: a parked number is only ever an earlier version's, and the volume it
 * names is the player's. Its reads and writes can be handed in (the suite).
 */
export async function restoreDuckedMusic({
    parked = duckedFrom,
    setVolume = level => game.settings.set("core", "globalPlaylistVolume", level),
    park = level => game.settings.set(MODULE_ID, SETTINGS.musicDuckedFrom, level)
} = {}) {
    const was = parked();
    if (!(was >= 0)) return;
    log("Murder music: putting back the Music volume an earlier version left parked.");
    try {
        await setVolume(was);
        await park(-1);
    } catch (err) {
        debug("Murder music: could not put the parked volume back", err);
    }
}

/** The volume an earlier version parked, or -1. */
function duckedFrom() {
    try {
        const v = Number(getSetting(SETTINGS.musicDuckedFrom));
        return Number.isFinite(v) ? v : -1;
    } catch {
        return -1;
    }
}

/** This browser's Music volume, read (the band under the clock). */
export function playlistVolume() {
    try {
        const v = Number(game.settings.get("core", "globalPlaylistVolume"));
        return Number.isFinite(v) ? v : 1;
    } catch {
        return 1;
    }
}
