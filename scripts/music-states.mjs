/**
 * Danganronpa RPG - the music's states and the map a GM fills in.
 * ---------------------------------------------------------------------------
 * The moods the music follows and which playlist each one plays: the floor's
 * modes and the state each plays (`TRIAL_MODE_MUSIC`, `trialMusicState`), the
 * table of states in the order they win (`MUSIC_STATES`, `stateDef`), the one
 * that applies now (`currentState`), the world's map of a state to a playlist
 * and its reads (`musicMap`, `playlistFor`, `isCuePlaylist`), and the map's
 * writes, which save as a GM changes it (D45 option 1): one key at a time
 * through one chain (`saveMusicKey`, `writeMusicKeys`), the echo read back for
 * a key another write took back (`recheckMusicKeys`), and a stored mapping onto
 * the cue playlist dropped by the primary GM at ready (`dropCueMappings`, last
 * in this file).
 *
 * WHERE IT SITS. Moved out of music.mjs by E41 C9a (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. A leaf of the music's
 * family: the engine (music-play.mjs), the murder music's overlay
 * (murder-music.mjs) and the Sound window (sound-panel.mjs) read the states
 * and the map here, and nothing here reads them back. music.mjs re-exports the
 * eight names here it exported before, so every importer still imports
 * music.mjs, and nothing here imports it (the facade rule,
 * .claude/rules/code.md).
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, SITUATIONAL_PLAYLIST } from "./config.mjs";
import { SETTINGS, getSetting, setSetting, bodyDiscoveryFresh } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { trialFloor, FLOOR_MODES } from "./trial-floor.mjs";
import { isPrimaryGm, debug, error } from "./utils.mjs";

/*
 * THE FLOOR'S MODES AND THEIR MUSIC, ONE ROW A MODE (E70 C13, 28.10.2026; E70-82). Part 2 of E70 put three modes on the
 * floor - Testimony, Panic Round, the Closing Argument - and none of them has a playlist: they are the trial talking,
 * one speaker at a time, and play the trial's discussion. An Objection cut into any of them, its rebuttal, and the
 * Closing's exchange (whose modes are the Objection's and the rebuttal's, floor-machine.mjs `closing`) play the
 * Objection's. Written as a table over floor-machine.mjs MODES so a mode added later without a row here is a red R1046,
 * not a mode that falls through to whatever state comes next and plays it unheard of.
 */
export const TRIAL_MODE_MUSIC = Object.freeze({
    [FLOOR_MODES.objection]: "trial.objection",
    [FLOOR_MODES.rebuttal]: "trial.objection",
    [FLOOR_MODES.debate]: "trial.debate",
    [FLOOR_MODES.testimony]: "trial.discussion",
    [FLOOR_MODES.panic]: "trial.discussion",
    [FLOOR_MODES.closing]: "trial.discussion",
    // The zone modes (E73 C6; the plan's "music trial.debate covers the zone modes"): the class arguing as one, so the
    // debate's music, which the GM has mapped already.
    [FLOOR_MODES.straw]: "trial.debate",
    [FLOOR_MODES.dive]: "trial.debate",
    [FLOOR_MODES.scrum]: "trial.debate"
});

/*
 * EACH MODE ITS OWN PLAYLIST, WHEN THE GM GIVES IT ONE (E110, 14.11.2026; the owner's D-E110-B "Kazda minigra w class
 * trial niech ma wlasna playliste w muzyce" and D-E110-C "Scrum trzy playlisty niech ma"). A mode's own state plays only
 * once a playlist is mapped to it; until then the mode plays what `TRIAL_MODE_MUSIC` gives it, so a world sounds as
 * before until its GM sets one. The Nonstop Debate and the Objection already had theirs (`trial.debate`,
 * `trial.objection`); the Rebuttal is its own state now, which reverses the 28.08 reading below ("REBUTTAL HAS NO
 * STATE OF ITS OWN") only for a GM who maps it - unmapped it keeps the Objection's music, as that reading wanted. A
 * Scrum Debate's three phases are three states. The switch is the engine's, on the primary alone (music-play.mjs
 * `enabled`), at every write of the floor. R7105.
 */
export const TRIAL_MODE_OWN_MUSIC = Object.freeze({
    [FLOOR_MODES.rebuttal]: "trial.rebuttal",
    [FLOOR_MODES.testimony]: "trial.testimony",
    [FLOOR_MODES.panic]: "trial.panic",
    [FLOOR_MODES.closing]: "trial.closing",
    [FLOOR_MODES.straw]: "trial.straw",
    [FLOOR_MODES.dive]: "trial.dive"
});

/** A Scrum Debate's phases and their states (D-E110-C): Sides, Camps confer, the turns. */
export const SCRUM_PHASE_MUSIC = Object.freeze({ setup: "trial.scrumSides", confer: "trial.scrumConfer", speak: "trial.scrumSpeak" });

/*
 * THE CLOSING ARGUMENT'S OWN MUSIC WAITS FOR ITS SPEAKER (the owner, 1.2.119: "Muzyka closing argument niech zaczyna sie
 * dopiero po zatwierdzeniu speakera."). The Closing's phases (floor-machine.mjs `closing`): `volunteer` and `choice` come
 * before the GM confirms or picks a speaker, and have no own state, so they play the mode's row of `TRIAL_MODE_MUSIC`
 * (the trial's discussion); `speak` and `decide` (the GM's choice after an Objection at a confirmed speaker) play
 * `trial.closing` once mapped. Until 1.2.119 `trial.closing` played from the volunteers' first second. R7842.
 */
const CLOSING_OWN_PHASES = Object.freeze(["speak", "decide"]);

/** The state `floor`'s mode has of its own, mapped or not, or null. */
export function ownModeState(floor) {
    const mode = floor?.mode ?? null;
    if (mode === FLOOR_MODES.scrum) return SCRUM_PHASE_MUSIC[floor?.zone?.phase] ?? null;
    if (mode === FLOOR_MODES.closing && !CLOSING_OWN_PHASES.includes(floor?.closing?.phase)) return null;
    return mode ? (TRIAL_MODE_OWN_MUSIC[mode] ?? null) : null;
}

/**
 * The trial's music state for `floor` in `phase` (a clock's phase), or null outside a Class Trial with no floor: the
 * mode's own state when `mapped(key)` says it has a playlist (the world's map by default), else `TRIAL_MODE_MUSIC`'s.
 */
export function trialMusicState(floor, phase, { mapped = key => Boolean(playlistFor(key)) } = {}) {
    const mode = floor?.mode ?? null;
    const own = ownModeState(floor);
    if (own && mapped(own)) return own;
    if (mode && TRIAL_MODE_MUSIC[mode]) return TRIAL_MODE_MUSIC[mode];
    return phase === "classTrial" ? "trial.discussion" : null;
}

/**
 * Whether the vote's own music plays (E110 part 3): a Class Trial, this chapter's record with its vote opened and no
 * verdict yet, and a playlist mapped to `trial.vote` (`mapped`, the world's map by default). Pure over what is handed in.
 */
export function voteMusicPlays(record, clock, { mapped = key => Boolean(playlistFor(key)), floor = null } = {}) {
    if (clock?.phase !== "classTrial" || !record || record.chapter !== clock.chapter || record.verdictApplied) return false;
    // A floor opened after the vote's first opening plays its own music (1.2.122, the audit's STG-95; the owner's choice of
    // 21.11.2026): the modes' own rows already won over the vote's, and an Objection or a debate lost to it.
    if (floor?.mode) return false;
    const opened = Boolean(record.vote?.open || record.voteClosed || record.voteOpenedAt != null);
    return opened && mapped("trial.vote");
}

/** The rows of `MUSIC_STATES` for the modes' own states: each applies while `trialMusicState` answers it. */
const OWN_LABELS = Object.freeze({
    "trial.rebuttal": "trialRebuttal", "trial.testimony": "trialTestimony", "trial.panic": "trialPanic", "trial.closing": "trialClosing",
    "trial.straw": "trialStraw", "trial.dive": "trialDive", "trial.scrumSides": "trialScrumSides", "trial.scrumConfer": "trialScrumConfer",
    "trial.scrumSpeak": "trialScrumSpeak"
});
const ownStateRows = () => Object.entries(OWN_LABELS).map(([key, label]) => ({
    key, labelKey: `DRPG.Music.state.${label}`, randomTrack: true,
    test: () => trialMusicState(trialFloor(), getClock().phase) === key
}));

/**
 * Every state that can own the music, most important first.
 *
 * Order is the answer to "a trial at night during an Eclipse" and it is
 * deliberately a plain list rather than a set of nested conditions: the first
 * one that applies wins, and reading the list is reading the rule.
 *
 *   murder     first in the list and never the world's answer (`test` is
 *              false): it is here for the Sound panel and `playlistFor`.
 *   paused     the game is stopped. Nothing is happening in the fiction at all.
 *   eclipse    the placement window - mechanical, everybody is moving tokens.
 *   trial.*    the Class Trial: the nine rows of the modes' own states (E110,
 *              each only while its playlist is mapped), then the vote, the
 *              Objection, the Nonstop Debate and the discussion.
 *   bodyFound  a body announced, silence unless mapped.
 *   search     the Investigation phase.
 *   time.*     the fallback: whichever of the five times of day it is.
 *
 * 1 + 2 + 9 + 4 + 1 + 1 + 5 = 23 rows, counted off the list below on
 * 21.11.2026; the GM handbook's section 17 lists the same order, with the
 * murder row beside the table rather than in it.
 */
export const MUSIC_STATES = [
    /*
     * THE MURDER, AND IT IS NOT PART OF THE LADDER BELOW IT.
     *
     * Every other row here is a fact about the WORLD, decided by the primary GM
     * and distributed by Foundry, so the whole table hears the same thing. That
     * is exactly why the header of music.mjs used to say an incident gets no
     * music at all: a playlist that only ever starts during Stage 5 announces
     * the killing to everybody in earshot, which is the one thing this module
     * is built to prevent.
     *
     * This row is a fact about the BROWSER. It plays for the people in the
     * incident and for the GM, on their own clients, and a bystander hears the
     * afternoon exactly as before - so the objection the header raised does not
     * apply to it. See `applyMurderMusic` in murder-music.mjs for how,
     * and for the two things that cost: the room's own playlist has to be
     * held on those browsers, and a Foundry playlist cannot be played on one
     * client, so what actually plays is one track off it.
     *
     * `test` is `false` on purpose. `currentState()` walks this list to decide
     * what the WORLD is playing, and this is never that answer; the entry is
     * here so the Sound panel lists it and `playlistFor("murder")` finds it,
     * which is the whole of what it needs from the state machine.
     */
    { key: "murder", labelKey: "DRPG.Music.state.murder", local: true, test: () => false },
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
     * (E110, 14.11.2026: the owner's D-E110-B gives the Rebuttal a state of its own, `trial.rebuttal`, which plays only
     * once a GM maps it; unmapped, what follows still holds - see `TRIAL_MODE_OWN_MUSIC` above.)
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
     * Since E110 the rebuttal does have a state of its own, `trial.rebuttal`,
     * one of the nine own-mode rows (`OWN_LABELS`), which applies only while
     * a playlist is mapped to it; unmapped, the rebuttal falls to the
     * Objection's row, as this note describes.
     *
     * `trial.discussion` is the trial WITHOUT an open floor - the phase set,
     * everybody in the room, nobody holding anything. It is last of the three
     * because it is the widest: the floor being open is also the phase being
     * `classTrial`, so an unordered version of this would never reach the
     * other two.
     */
    // Each mode's own playlist first (E110; D-E110-B, D-E110-C): a row applies only while its playlist is mapped.
    ...ownStateRows(),
    /*
     * THE VOTE (E110 part 3, 14.11.2026; the coordinator's survey): from the vote's opening to the verdict, a playlist of
     * its own - only once one is mapped; unmapped, the trial's music plays on as before. The vote ends every floor
     * (trial-floor.mjs `endFloorForVoteInStep`), but a floor can open again before the verdict (a tie argued on), so a
     * mode does compete with it: while a floor is open its music plays, Objection and Nonstop Debate included, and the
     * vote's comes back when it ends, until the verdict (1.2.122, the audit's STG-95; the owner's choice of 21.11.2026).
     * R7107, R8274.
     */
    {
        key: "trial.vote", labelKey: "DRPG.Music.state.trialVote", randomTrack: true,
        test: () => voteMusicPlays(getSetting(SETTINGS.trialProgress), getClock(), { floor: trialFloor() })
    },
    {
        key: "trial.objection", labelKey: "DRPG.Music.state.trialObjection",
        randomTrack: true,
        // Sixty seconds, all of them audible. See `schedule`.
        immediate: true,
        test: () => trialMusicState(trialFloor(), getClock().phase) === "trial.objection"
    },
    {
        key: "trial.debate", labelKey: "DRPG.Music.state.trialDebate",
        randomTrack: true,
        test: () => trialMusicState(trialFloor(), getClock().phase) === "trial.debate"
    },
    {
        key: "trial.discussion", labelKey: "DRPG.Music.state.trialDiscussion",
        randomTrack: true,
        test: () => getClock().phase === "classTrial"
    },
    /*
     * A BODY ON THE FLOOR, AND NOBODY HAS DECIDED WHAT HAPPENS NEXT (D5).
     *
     * The one state whose default is SILENCE. Everywhere else "nothing mapped"
     * means "leave the room alone", which is wrong for the sixty seconds after
     * the announcement. `silence` is read in `apply` and is only reached when
     * nothing is mapped, so a GM with a drone for the discovery still gets it.
     *
     * Whatever was playing is PAUSED, not stopped, so the afternoon comes back
     * at the bar it left off.
     */
    {
        key: "bodyFound", labelKey: "DRPG.Music.state.bodyFound",
        silence: true, immediate: true,
        // The hour it was found in, and only while the game is still in Daily
        // Life. The first half is what lets the GM answer by moving the clock -
        // the clock write fires the watcher below and this test simply stops
        // being true. The second stops a GM who started Stage 7 before
        // announcing the body from silencing an investigation already running.
        test: () => bodyDiscoveryFresh() !== null && getClock().phase === "dailyLife"
    },
    { key: "search", labelKey: "DRPG.Music.state.search", test: () => getClock().phase === "investigation" },
    /* THE LABEL IS READ WHEN IT IS DRAWN (E50 C3, E50-24). It was `TIME_OF_DAY_LABELS[time]` taken at import, and
       i18n.mjs `localizeConfig` swaps that table in place only at `i18nInit`, after this file has run - so a Polish
       table read "Morning" on the Music tab. A getter reads the table as it stands. */
    ...TIMES_OF_DAY.map(time => ({
        key: `time.${time}`,
        get label() { return TIME_OF_DAY_LABELS[time]; },
        test: () => getClock().timeOfDay === time
    }))
];

/** One state's declaration, for the two behaviours only the trial uses. */
export function stateDef(key) {
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

/**
 * The playlist a state is mapped to, or null.
 *
 * NEVER THE CUE PLAYLIST (E50 C3; audit S11-47, Q-E50-1). The cue playlist is where the Play tab draws a GM's
 * cues from; a state mapped onto it played those cues as its mood, and a cue put on under it found its own playlist
 * already playing. The Music tab no longer offers it and the primary drops such a mapping at ready
 * (`dropCueMappings`), and this answers null for one all the same - a playlist renamed to the cue's name after the
 * drop - so the state plays as unmapped. `map` and `playlists` stand in for the world's in a test.
 */
export function playlistFor(stateKey, { map = musicMap(), playlists = game.playlists } = {}) {
    const id = map?.[stateKey];
    const playlist = id ? playlists?.get(id) ?? null : null;
    return playlist && !isCuePlaylist(playlist) ? playlist : null;
}

/** Whether a playlist is the cue playlist: matched by name, as `situationalPlaylist` finds it. */
export function isCuePlaylist(playlist) {
    return String(playlist?.name ?? "").trim().toLowerCase() === SITUATIONAL_PLAYLIST.trim().toLowerCase();
}

/*
 * THE MAPPING SAVES AS IT IS CHANGED (E50 C3; D45 option 1, audit S11-34).
 *
 * It waited for an Apply that wrote the whole map as the window had drawn it, so a key another GM had written
 * since the window opened was lost, and the Music tab was the one place in the window that did not save as it was
 * touched. Now a select's change writes its one key: the map is read at the moment of the write and only that key
 * set or taken out, one write at a time - a change made while a write is in flight waits for it and goes in the next
 * (the last value of a key wins). A world setting is stored whole, so two GMs writing in the same moment each write
 * a map the other's key is missing from, and the later one wins: so for a few seconds after its write this browser
 * keeps what it set, and when a write lands that put a key back as it was before (`recheckMusicKeys`, on the
 * setting's echo) writes that key again, once. A key another GM set to something else since is theirs, and kept.
 *
 * WHAT THE REPAIR CANNOT TELL APART (E50 fix FG1; the review's S1). A write that puts the key back is read by what
 * it holds, and two writes can hold the same thing for different reasons:
 *   - this browser's own user writing the map by any other road - a console, a macro, a test putting the world
 *     back - is a deliberate write: `updateSetting`'s `userId` is this user's and the map is none of the ones
 *     `writeMusicKeys` sent (`mapSent`), so the watch ends there and nothing is written again. Before this, the
 *     repair wrote four keys back over E50-T1's own restore 66 ms after it (the security review's probe, 30.10.2026);
 *   - another GM's write that takes the key out, or puts back its old playlist, within MAP_ECHO_MS of this browser's
 *     change cannot be told from a write that GM made from a map read before this one landed (the race the repair
 *     is for), so it is overruled once: the key comes back, one write, and that GM's next change of it stands
 *     (`retry`). The GM handbook says so. A key that GM set to a third playlist is theirs, as above.
 */
const MAP_ECHO_MS = 4000;
const mapQueue = new Map();       // state key -> { value, onState, retry }, waiting for the next write
const mapWritten = new Map();     // state key -> { value, before, until, retry, onState }, this browser's recent writes
const mapSent = new Set();        // { text, until }: the maps writeMusicKeys sent, until their echo is heard
let mapChain = Promise.resolve();

/** A map as one string whatever the order of its keys: it is flat, a state key to a playlist id. */
const mapText = map => JSON.stringify(Object.entries(map ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * Write one state's playlist into the map (an empty id takes the state out). `onState` hears "saving", then "saved"
 * or "failed". Resolves when this browser's writes so far have landed.
 */
export function saveMusicKey(stateKey, playlistId, { onState = null, retry = false } = {}) {
    // A newer choice of this key is not an older one taken back: its own echo must not write the older one again.
    mapWritten.delete(stateKey);
    mapQueue.set(stateKey, { value: playlistId || null, onState, retry });
    onState?.("saving");
    mapChain = mapChain.then(writeMusicKeys);
    return mapChain;
}

async function writeMusicKeys() {
    if (!mapQueue.size) return;
    const batch = [...mapQueue];
    mapQueue.clear();
    const next = { ...musicMap() };
    const before = {};
    for (const [key, { value }] of batch) {
        before[key] = next[key] ?? null;
        if (value) next[key] = value;
        else delete next[key];
    }
    // Before the write, as its echo may be heard before the write resolves.
    const sent = { text: mapText(next), until: Date.now() + MAP_ECHO_MS };
    mapSent.add(sent);
    try {
        await setSetting(SETTINGS.musicMap, next);
    } catch (err) {
        mapSent.delete(sent);
        error("Could not save the music mapping", err);
        for (const [, { onState }] of batch) onState?.("failed");
        return;
    }
    const until = Date.now() + MAP_ECHO_MS;
    for (const [key, { value, onState, retry }] of batch) {
        mapWritten.set(key, { value, before: before[key], until, retry, onState });
        onState?.("saved");
    }
}

/**
 * On every write of the map: a key this browser wrote that a later write put back as it was is written again, once.
 * `userId` is the writer's (`updateSetting`'s fourth argument): this user's write that `writeMusicKeys` did not send
 * ends the watch instead.
 */
export function recheckMusicKeys(userId = null) {
    const now = Date.now();
    const map = musicMap();
    for (const sent of [...mapSent]) if (now > sent.until) mapSent.delete(sent);
    if (userId && userId === game.user?.id) {
        const text = mapText(map);
        const ours = [...mapSent].find(sent => sent.text === text);
        if (ours) mapSent.delete(ours);
        else {
            if (mapWritten.size) debug("Music: this user wrote the map by another road; its recent rows are not written again.");
            mapWritten.clear();
            return;
        }
    }
    if (!mapWritten.size) return;
    for (const [key, mine] of [...mapWritten]) {
        const value = map[key] ?? null;
        if (now > mine.until) mapWritten.delete(key);
        else if (value === mine.value) continue;
        else {
            mapWritten.delete(key);
            if (value === mine.before && !mine.retry) {
                debug(`Music: another write took "${key}" back; writing it again.`);
                saveMusicKey(key, mine.value, { onState: mine.onState, retry: true });
            }
        }
    }
}

/**
 * Take a stored mapping onto the cue playlist out of the map (E50 C3; Q-E50-1, the owner's answer of 30.10: removed
 * by itself, with no warning). The primary GM's, at ready: one write of the whole map without those keys - a world
 * setting is stored whole, so a key left out is gone and no `-=` is needed - and only when there is one to drop, so a
 * second call writes nothing. A debug line, not a toast: nothing is asked of the GM. `primary`, `map`, `playlists` and
 * `write` stand in for the world's in a test.
 *
 * @returns {Promise<string[]>} the state keys dropped
 */
export async function dropCueMappings({
    primary = isPrimaryGm(), map = musicMap(), playlists = game.playlists,
    write = next => game.settings.set(MODULE_ID, SETTINGS.musicMap, next)
} = {}) {
    if (!primary || !map) return [];
    const dropped = Object.keys(map).filter(key => isCuePlaylist(playlists?.get(map[key])));
    if (!dropped.length) return [];
    const next = { ...map };
    for (const key of dropped) delete next[key];
    await write(next);
    debug(`Music: the cue playlist is not a state's playlist; dropped the mapping of ${dropped.join(", ")}.`);
    return dropped;
}
