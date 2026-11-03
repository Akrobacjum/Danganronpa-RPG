/**
 * Danganronpa RPG - the music follows the game.
 * ---------------------------------------------------------------------------
 * THE FAMILY (E41 C9a, 1.2.97). This file keeps two readers - what this
 * browser hears (`nowPlayingHere`) and the GM's report (`diagnoseMusic`) - and
 * re-exports the twenty-four names that moved, each by a pure move that
 * `node tools/moved-only.mjs` proves: the states and the map with its saved
 * writes to music-states.mjs, the engine with `registerMusic` to
 * music-play.mjs, the murder music to murder-music.mjs, the Sound window to
 * sound-panel.mjs. Every importer still imports this file, and none of those
 * four imports it. New code goes into the file of its role, not here.
 *
 * A killing game has a small number of moods and the GM changes between them
 * constantly: the placement window, a trial, an investigation, and five times of
 * day underneath all of it. Driving that by hand means a GM who is already
 * running an incident is also hunting for a playlist, so in practice the music
 * stops changing about ten minutes in.
 *
 * This maps each state to a playlist the GM chooses and keeps them in step.
 *
 * THE INCIDENT USED TO HAVE NO MUSIC, AND THE REASON WAS RIGHT - the fix is
 * that it was the right reason for the wrong mechanism.
 *
 * A murder is the one thing in this module the table must not be able to detect
 * from the outside; private rolls, GM-side scoring and the whole Truth Bullet
 * ledger exist for that. A PLAYLIST would wreck it, because a playlist is a
 * world document: the moment one started, every bystander would hear the
 * killing begin. So for six milestones an incident simply held whatever was
 * already playing.
 *
 * It has music now, and only its own people hear it (Dawid, 15.09). Not a
 * state in the table below - an overlay on the browsers that are in it, built
 * out of a local sound and the room's music held on that browser. A bystander's client is
 * not told, does not play it and does not change. See THE MURDER MUSIC in
 * murder-music.mjs for how it works and what it costs.
 *
 * The Investigation, by contrast, begins with a body being found: it is public
 * by definition and gets its own mood, in the ordinary way.
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

import { MODULE_ID, SITUATIONAL_PLAYLIST } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { isPrimaryGm, debug, gmReport } from "./utils.mjs";
import { MUSIC_STATES, currentState, musicMap, playlistFor, isCuePlaylist } from "./music-states.mjs";
import { interrupted, situationalPlaylist, ours } from "./music-play.mjs";
import { soundboardMode, murderMusicHere, playlistVolume } from "./murder-music.mjs";
export {
    TRIAL_MODE_MUSIC, trialMusicState, MUSIC_STATES, currentState, musicMap, playlistFor, dropCueMappings, saveMusicKey
} from "./music-states.mjs";
export {
    registerMusic, cueGivesWay, situationalPlaylist, playTrack, resetMusic, refreshMusic, musicStatus
} from "./music-play.mjs";
export {
    murderTrackFor, murderPlayData, createRoomHold, createMurderOverlay, murderMusicHere, applyMurderMusic,
    restoreDuckedMusic
} from "./murder-music.mjs";
export { musicMapRows, openSoundDialog } from "./sound-panel.mjs";

/**
 * The track THIS CLIENT is hearing, if any (N-1, Dawid 20.09).
 *
 * WHAT IS PLAYING HERE, NOT WHAT THE WORLD SAYS IS PLAYING, and that distinction is
 * the whole reason this function exists rather than a read of `playlist.playing`.
 * Playback is driven by the primary GM through `playAll()`, which is a document
 * update, so in the ordinary case every client hears the same thing - but not in
 * every case: a sound can be started on one client alone (the module's own effects
 * do it, addressed to a side), and a GM listening to something while they set a
 * scene up must not have the name of it appear on a player's clock. A
 * `PlaylistSound`'s `sound` is the CLIENT's own audio node: if it is playing here,
 * this browser is hearing it, and if it is not, this browser is not.
 *
 * WHICH ONE, WHEN THERE ARE TWO. A cue over an ambient bed is two sounds at once,
 * and the one a person would name is the cue - so the cue playlist wins, then
 * anything that is not one of ours (a GM's own pick, which is what an interruption
 * is), and the module's own bed last.
 *
 * @returns {{track: string, playlist: string}|null}
 */
export function nowPlayingHere(seen = {}) {
    try {
        const cueId = "cueId" in seen ? seen.cueId : (situationalPlaylist()?.id ?? null);
        const mine = new Set(seen.mine ?? ours().map(p => p.id));
        const channel = Number(seen.channel ?? playlistVolume());
        const murder = "murder" in seen ? seen.murder : murderMusicHere();
        /* THE MURDER TRACK FIRST (E19 C5; audit S11-40): it is not a playlist sound, so the loop below never named
           it, and the room's track it holds at 0 was named instead. Nothing is named at a Music volume of 0. */
        if (!(channel > 0)) return null;
        if (murder?.track && murder.playing !== false && Number(murder.volume ?? 1) > 0) {
            return { track: murder.track, playlist: murder.playlist ?? "" };
        }
        let best = null;
        let bestRank = -1;

        for (const playlist of seen.playlists ?? game.playlists ?? []) {
            // A soundboard's one-shot is an effect, not what is playing (S11-40).
            if (playlist.mode === soundboardMode()) continue;
            for (const sound of playlist.sounds ?? []) {
                // `sound.sound` is this client's audio node; `sound.playing` is the
                // document's opinion, which is the thing that can differ.
                if (!sound.sound?.playing) continue;
                // Held at 0 here (the murder music's hold, a fade's end): not heard, not named.
                if (!(Number(sound.sound.volume ?? sound.volume ?? 1) > 0)) continue;
                const rank = playlist.id === cueId ? 2 : (mine.has(playlist.id) ? 0 : 1);
                if (rank > bestRank) {
                    bestRank = rank;
                    best = { track: sound.name ?? "", playlist: playlist.name ?? "" };
                }
            }
        }
        return best?.track ? best : null;
    } catch (err) {
        debug("Could not read what this client is playing", err);
        return null;
    }
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
export function diagnoseMusic({ toChat = true } = {}) {
    const clock = getClock();
    const map = musicMap();
    const winner = currentState();

    /* THE TABLE'S WORDS (E50 C3; E50-26, the plan's amendment of 05.10 B): the report is shown to a GM in a window, so
       its lines are keys of DRPG.Music.diag. The console line below prints the same localized text; only its header,
       "Music diagnostics", stays English. */
    const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
    const yes = on => t(on ? "DRPG.Music.diag.yes" : "DRPG.Music.diag.no");
    const cue = situationalPlaylist();
    const lines = [
        t("DRPG.Music.diag.enabled", { value: t(getSetting(SETTINGS.musicEnabled) ? "DRPG.Music.diag.on" : "DRPG.Music.diag.off") }),
        t("DRPG.Music.diag.drives", { value: yes(isPrimaryGm()) }),
        t("DRPG.Music.diag.clock", { phase: clock.phase ?? t("DRPG.Music.diag.unset"), time: clock.timeOfDay ?? t("DRPG.Music.diag.unset"), eclipse: yes(clock.eclipse === true), paused: yes(game.paused) }),
        t("DRPG.Music.diag.playlists", { n: game.playlists.size }),
        t("DRPG.Music.diag.cue", { name: SITUATIONAL_PLAYLIST, value: cue ? t("DRPG.Music.diag.cueTracks", { n: cue.sounds.size }) : t("DRPG.Music.diag.cueMissing") }),
        t("DRPG.Music.diag.cueRunning", { value: yes(Boolean(interrupted)) })
            + (interrupted?.held?.length ? t("DRPG.Music.diag.cueHolding", { n: interrupted.held.length }) : ""),
        "",
        `${t("DRPG.Music.diag.colState").padEnd(18)} ${t("DRPG.Music.diag.colApplies").padEnd(13)} ${t("DRPG.Music.diag.colPlaylist")}`
    ];

    for (const state of MUSIC_STATES) {
        let applies = false;
        try {
            applies = yes(Boolean(state.test()));
        } catch (err) {
            applies = t("DRPG.Music.diag.testError", { message: err.message });
        }
        /* A LOCAL ROW NEVER "APPLIES", AND THAT IS NOT A FAULT. `murder` is not
           in the ladder - it plays on the browsers of the people in a killing
           and answers a question this table does not ask - so a plain `false`
           in this column would read as a state that is broken. Says what it is
           instead, and says whether THIS browser is currently hearing it. */
        if (state.local) applies = t(murderMusicHere().playing ? "DRPG.Music.diag.playingHere" : "DRPG.Music.diag.perClient");
        const mapped = map[state.key] ? game.playlists.get(map[state.key]) : null;
        // "Mapped to a playlist with nothing in it" is silence that looks
        // exactly like a correct mapping from every other angle.
        const playlist = !map[state.key] ? "-"
            : !mapped ? t("DRPG.Music.diag.missingPlaylist")
            : isCuePlaylist(mapped) ? t("DRPG.Music.diag.onCue", { name: mapped.name })
            : !mapped.sounds.size ? t("DRPG.Music.diag.emptyPlaylist", { name: mapped.name })
            : mapped.name;
        const mark = state.key === winner ? t("DRPG.Music.diag.wins") : "";
        const random = state.randomTrack ? t("DRPG.Music.diag.randomTrack") : "";
        lines.push(`${state.key.padEnd(18)} ${String(applies).padEnd(13)} ${playlist}${mark}${random}`);
    }

    if (!winner) lines.push("", t("DRPG.Music.diag.noState"));
    else if (!playlistFor(winner)) lines.push("", t("DRPG.Music.diag.unmapped", { state: winner }));

    const text = lines.join("\n");
    console.log(`${MODULE_ID} | Music diagnostics\n${text}`);
    // The words to this console's own store, not a document every browser holds (E06 C11). Not from the one
    // report (E52 C4), which shows them in its own window.
    if (toChat) gmReport(game.i18n.localize("DRPG.Diagnostics.title.music"),
        `<pre style="white-space:pre-wrap;font-size:0.85em">${foundry.utils.escapeHTML(text)}</pre>`);
    return text;
}
