/**
 * Danganronpa RPG - a sound picked, set and played.
 * ---------------------------------------------------------------------------
 * The sound engine's player, whose four rules are sfx.mjs's header: the flag a
 * card carries a sound on (`SFX_FLAG`), the cooldown and the hold, which file
 * an event plays and the pick among several (`soundFor`, `soundsFor`,
 * `pickSound`), a varied rate and gain, the decoded files and the play itself
 * (`playOwned`), a file set from the Sound window (`setSoundFor`), the volumes
 * and their sliders (`sfxVolume`, `setSfxVolume`, `volumeToSlider` ...),
 * `playSfx` and its two senders over the module's socket (`playSfxFor`,
 * `playSfxForUsers`: this file's two `game.socket.emit`), `fire` and its
 * report of a file that cannot be played, the sound a card names
 * (`soundFromMessage`) and the Test button's `testSfx`.
 *
 * WHERE IT SITS. Moved out of sfx.mjs by E41 C9a (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. sfx.mjs keeps what listens:
 * `registerSfx`, the socket's listener and the hooks that play a sound, the
 * unlock and `diagnoseSfx`. It re-exports the fourteen names here it exported
 * before, so every importer still imports sfx.mjs, and nothing here imports it
 * (the facade rule, .claude/rules/code.md); the socket's action name and the
 * counts and caches `diagnoseSfx` reports are exported for sfx.mjs, the
 * slider conversions for the Sound window's sliders.
 */

import { MODULE_ID, SFX_EVENTS, SFX_SLIDERS, SFX_VOLUME_KEYS, SFX_VARIATION } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { warn, error, clamp, ownerOf } from "./utils.mjs";
import { cardFlag, cardWriter } from "./secret.mjs";
import { count } from "./perf-counters.mjs";

/**
 * The chat-message flag that carries a sound to the people a message reaches.
 *
 *     flags["danganronpa-rpg"].sfx = "death"                 // players only
 *     flags["danganronpa-rpg"].sfx = { key: "death", gm: true }
 *
 * The string form is the common case and the object form exists for the one
 * distinction that matters: whether the GMs are an audience or a filing
 * cabinet. See `onCreateChatMessage`.
 */
export const SFX_FLAG = "sfx";

/**
 * The same key may not play twice inside this many milliseconds.
 *
 * Not a de-bounce for its own sake: several things in this module post a
 * message AND redraw a panel in the same frame, and a Foundry document update
 * can arrive twice for one change. Eighty milliseconds is under the threshold
 * at which two clicks are heard as two sounds, so nothing a person did on
 * purpose is ever swallowed.
 */
const COOLDOWN_MS = 80;

/** Our one socket verb: "play this, on your browser, because it is yours". */
export const SFX_ACTION = "playSfxFor";

/**
 * How long a yielding sound waits to find out whether it lost.
 *
 * Pressing a button that opens a window is one gesture and two events, and what
 * you want to hear is the window. The winner cannot un-play the loser, so the
 * loser waits instead - briefly - and cancels itself if the winner turns up.
 *
 * THIS IS THE ONE NUMBER IN THIS FILE THAT HAS TO BE TUNED BY EAR, and E17 is
 * where that happens. Too short and the button sound escapes before the window
 * has finished rendering; too long and a click feels like it lagged. It costs
 * nothing for every other event, because only the keys that declare `yieldsTo`
 * go through the wait at all.
 */
const YIELD_MS = 120;

/**
 * How long `testSfx` will wait for a file before giving up on it.
 *
 * A Test button that never returns is worse than one that gives the wrong
 * answer: the wrong answer can be argued with. Four seconds is far longer than
 * any local file needs and short enough that a GM does not wonder whether they
 * missed the click.
 */
const TEST_TIMEOUT_MS = 4000;

/** Last time each key actually reached the audio layer. Key → epoch ms. */
const lastPlayed = new Map();

/** Sounds waiting to see whether something beats them. Key → timeout id. */
const holding = new Map();

/** Paths already reported as unplayable, so each is said once and not again. */
export const reportedMissing = new Set();

/** How many sounds were dropped because the browser had not been clicked yet. */
export let droppedWhileLocked = 0;

/* ========================================================================== *
 *  What is mapped to what
 * ========================================================================== */

/**
 * The file a GM mapped to this event, or `null` when there is none.
 *
 * World-scoped, because what a door sounds like is one fact about the table. A
 * player mapping their own files would be playing a different game from
 * everybody else - the door they heard would not be the door anyone else heard.
 */
export function soundFor(key) {
    const map = getSetting(SETTINGS.sfxMap) ?? {};
    const src = map[key];
    return typeof src === "string" && src.trim() ? src.trim() : null;
}

/**
 * The separator between several files mapped to one event.
 *
 * A pipe, because it is the one character that cannot appear in a Windows
 * filename and is not legal unencoded in a URL path - so it can never be part
 * of a path a GM actually typed. A comma or a semicolon can be, and a
 * separator that occasionally eats half a filename is worse than none.
 */
const SOUND_SEPARATOR = "|";

/**
 * Every file mapped to this event, in the order the GM listed them; for an event left empty that names another to fall
 * back to (`fallsBackTo`, E62 C3b: "Death fade" plays the death's file by default), that event's files.
 */
export function soundsFor(key) {
    const own = (soundFor(key) ?? "")
        .split(SOUND_SEPARATOR)
        .map(path => path.trim())
        .filter(Boolean);
    const fallback = SFX_EVENTS[key]?.fallsBackTo;
    return own.length || !fallback || fallback === key ? own : soundsFor(fallback);
}

/** What each key played last, so the next pick can avoid it. Key -> path. */
const lastPicked = new Map();

/**
 * ONE file for this play - the round robin, and the stronger half of the two
 * answers to "the same sound forty times a session".
 *
 * Bending the rate makes one file stop being identical; a second file makes it
 * stop being the same sound. This is the real fix and it composes with the
 * other: a GM with one file gets the bend, a GM with three gets both.
 *
 * NEVER TWICE RUNNING, when there is a choice. Plain random draws the same
 * file back-to-back one time in N, which is exactly the case the whole feature
 * exists to remove and the one a player notices. With two files this alternates
 * strictly, which is fine - two alternating clicks is what a real pair of
 * footsteps does.
 */
export function pickSound(key) {
    const options = soundsFor(key);
    if (options.length <= 1) return options[0] ?? null;

    const previous = lastPicked.get(key);
    const fresh = options.filter(path => path !== previous);
    const pool = fresh.length ? fresh : options;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    lastPicked.set(key, chosen);
    return chosen;
}

/**
 * How much to bend this play, as a playback rate around 1.
 *
 * `null` for anything that must not bend, so the caller has one test rather
 * than three. THE SAFEWORD IS EXCLUDED HERE, IN CODE, and not by leaving `vary`
 * off its catalogue entry: it is the one sound in this game that has to be
 * unmistakable, and a signal that sounds slightly different each time is one the
 * table learns to second-guess. That must not be one edit away from being true.
 */
function rateFor(key) {
    if (!varies(key)) return null;

    /*
     * NO DEAD CENTRE, and this is the half that answers what the table heard.
     *
     * A uniform draw across ±spread puts half of every play within half a
     * spread of unbent - which is to say inaudible. What reaches the ear is
     * only the tail, so a run of plays sounds like a couple of distinct takes
     * with a lot of repeats between them. Dawid, 28.08, hearing 0.08: "it
     * sounds a bit like there are two versions of the sound, they differ so
     * little." Widening alone would have made the two versions further apart
     * and left the repeats.
     *
     * So the sign is drawn first and the SIZE is drawn from the outer half:
     * every play is at least `floor` of the way out, and never past `rate`.
     * The worst case is unchanged - that is what the edge is for - and the
     * common case stops being silence.
     */
    const spread = SFX_VARIATION.rate;
    const floor = SFX_VARIATION.floor ?? 0;
    const size = spread * (floor + Math.random() * (1 - floor));
    return 1 + (Math.random() < 0.5 ? -size : size);
}

/**
 * The three questions that decide whether a sound bends, asked once.
 *
 * Split out of `rateFor` when gain joined rate: two callers asking the same
 * three things in two places is two places for the safeword's exclusion to be
 * forgotten in.
 */
function varies(key) {
    if (key === "safeword") return false;
    if (!SFX_EVENTS[key]?.vary) return false;
    return Boolean(getSetting(SETTINGS.sfxVary));
}

/**
 * How loud this play is, as a fraction of the volume the sliders decided.
 *
 * DOWNWARDS ONLY. `1 - random * spread` rather than a swing either side of 1:
 * the number this multiplies is the GM's own setting, and a variation allowed
 * to exceed it would make the loudest sound in the game louder than the volume
 * control says is possible. Quieter-sometimes reads as life; louder-sometimes
 * reads as a bug in the volume slider.
 *
 * This is the half that carries on a very short file. A rate bend needs enough
 * sound for the ear to measure a pitch against, and an 80ms interface click
 * does not have it; loudness lands instantly.
 */
function gainFor(key) {
    if (!varies(key)) return 1;
    return 1 - (Math.random() * SFX_VARIATION.gain);
}

/**
 * Sounds this file owns, decoded once. Path -> Sound.
 *
 * WHY WE OWN THEM AT ALL, since `AudioHelper.play` is otherwise perfectly good:
 * a rate can only be bent on an `AudioBufferSourceNode`, and Foundry decides
 * per file whether to decode into a buffer or stream from an `<audio>` element
 * - where the rate lives on the element and PRESERVES PITCH, which is a speed
 * change with no pitch change and sounds like a glitch rather than variation.
 *
 * `AudioHelper.play` takes a `forceBuffer` option and PASSES IT ON, and that is
 * still not enough: measured, it produced a buffered sound the first time a file
 * was played in a session and a streamed one every time after. Whatever decides
 * that is not something to build a feature on, so the varied path constructs its
 * own Sound with `forceBuffer` and keeps it. Ten short interface files is a
 * trivial amount of memory, and decoding once is cheaper per press than setting
 * up a stream every time.
 *
 * Everything that does NOT vary still goes through `AudioHelper.play` exactly as
 * before. This is a second path for eleven events, not a replacement for forty.
 */
export const decoded = new Set();

/**
 * The last rate actually applied to each file, for `diagnoseSfx`.
 *
 * Kept because this feature is otherwise INVISIBLE when it fails. A bend that
 * silently does nothing sounds exactly like a bend working on files too short
 * to notice - which is precisely the trap the first attempt fell into, where
 * `forceBuffer` was passed to `AudioHelper.play`, accepted, and quietly
 * ignored on every play after the first. A number somebody can read is the
 * difference between "it works" and "I assume it works".
 */
export const lastRates = new Map();

/**
 * And the last volume each file was actually played at.
 *
 * Beside the rates rather than folded into them: this is what makes "is the
 * variation working" answerable from the console instead of by ear, and the
 * two numbers move independently - the gain half lands on every varied play,
 * the rate half only on the buffer path.
 */
export const lastGains = new Map();

/**
 * Play a varied sound and bend it.
 *
 * ONE `Sound` PER PLAYBACK, AND THAT IS THE WHOLE OF THE SECOND FIX.
 *
 * This used to keep one Sound per file and re-play it. Measured on 14.365,
 * `Sound#play()` opens with
 *
 *     if ( ![LOADED, PAUSED, STOPPED].includes(this._state) ) return this;
 *
 * - so a sound that is still PLAYING refuses to play again, silently, and
 * returns as though it had. A file is PLAYING for its whole duration including
 * whatever silence the recording ends with, so half a second of trailing room
 * tone made half a second of deafness. Dawid found it at the table and read it
 * exactly right: "prawdopodobnie przez długość klipów".
 *
 * It bit precisely the eleven events that carry `vary: true` - window open and
 * close, every button press, chat, a room entered, a crossing refused, an action
 * spent - which are the sounds a player hears most and the ones two of which
 * genuinely happen at once. Everything else already overlapped: Foundry's own
 * `AudioHelper.play` builds a new Sound for every call.
 *
 * The decode is NOT repeated. Foundry caches decoded buffers per path in
 * `game.audio.buffers`, so a second `load()` of the same file is a cache read -
 * measured at 0 ms against 0 ms for the first, on a warm client. `decoded`
 * below is now a record of which paths this file has proved decodable, which is
 * what `diagnoseSfx` was really reporting all along.
 *
 * The bend is applied AFTER `play()` because the node does not exist before it -
 * Foundry builds the graph when the sound starts. Setting an AudioParam takes
 * effect on the audio thread immediately, so the fraction of a millisecond that
 * has already gone out at the original rate is inaudible; at three per cent
 * there would be nothing to hear even if the whole sound played unbent.
 */
async function playOwned(src, volume, rate) {
    const sound = new foundry.audio.Sound(src, {
        context: game.audio.interface,
        forceBuffer: true
    });

    // `load()` on a locked context never settles - see rule 4 at the top of
    // this file. The caller only reaches here unlocked, and the try/catch in
    // `fire` is what keeps a bad path from taking the press down with it.
    await sound.load();
    decoded.add(src);

    await sound.play({ volume });
    if (sound.isBuffer && sound.sourceNode?.playbackRate) {
        sound.sourceNode.playbackRate.value = rate;
        lastRates.set(src, Math.round(rate * 10000) / 10000);
    }
    return sound;
}

/**
 * Map a file to an event, or clear it with `null`. GM only.
 *
 * Writes the whole object back because a Foundry object setting has no
 * per-field update, and clears by DELETING the key rather than storing an empty
 * string: "not assigned yet" and "assigned to nothing" would otherwise be two
 * states that look identical in the panel and differ in the diagnosis.
 */
export async function setSoundFor(key, src) {
    if (!game.user.isGM) return null;
    if (!SFX_EVENTS[key]) {
        error(`Asked to map a file to an unknown sound event "${key}".`);
        return null;
    }

    const map = { ...(getSetting(SETTINGS.sfxMap) ?? {}) };
    const value = typeof src === "string" ? src.trim() : "";
    if (value) map[key] = value;
    else delete map[key];

    await setSetting(SETTINGS.sfxMap, map);
    // A path that failed before may be a path that works now - the GM has just
    // told us they changed something, and the once-per-path rule must not
    // outlive the mapping it was about.
    reportedMissing.clear();
    // What this file has proved decodable is a claim about paths the GM has
    // just changed, so it stops being true here rather than aging quietly.
    decoded.clear();
    return map;
}

/* ========================================================================== *
 *  Volume
 * ========================================================================== */

/** Foundry's own playlist volume, which our Music slider IS rather than mirrors. */
function foundryMusicVolume() {
    try {
        return clamp(Number(game.settings.get("core", "globalPlaylistVolume")), 0, 1);
    } catch {
        return 1;
    }
}

/*
 * THE MUSIC SLIDER IS FOUNDRY'S OWN NUMBER (E50 C3; audit S11-41, Q-E50-4). Foundry's playlist volume slider shows
 * and writes through AudioHelper's curve - the position is `volumeToInput(volume)`, the volume `inputToVolume(position)`
 * - and this slider wrote the position as the volume and showed the volume as the position, so one volume read as
 * two numbers (Foundry's 50 here was 35). Foundry's own functions where it has them, else the same curve
 * (`v ** (1 / 1.5)`, `x ** 1.5`, read in fvtt-types 14.366, not in v14's code: LIVE-E50-03). The Sound slider is this
 * module's own and stays linear. `helper` stands in for Foundry's AudioHelper in a test; `null` is "Foundry has none".
 */
export function musicVolumeToInput(volume, helper = globalThis.foundry?.audio?.AudioHelper) {
    const v = clamp(Number(volume) || 0, 0, 1);
    return typeof helper?.volumeToInput === "function" ? helper.volumeToInput(v) : v ** (1 / 1.5);
}

export function musicInputToVolume(position, helper = globalThis.foundry?.audio?.AudioHelper) {
    const x = clamp(Number(position) || 0, 0, 1);
    return typeof helper?.inputToVolume === "function" ? helper.inputToVolume(x) : x ** 1.5;
}

/** Where a slider stands, 0-1, for a volume: the Music slider on Foundry's curve, every other one linear. */
export function volumeToSlider(slider, volume) {
    return SFX_SLIDERS[slider]?.proxiesFoundryMusic ? musicVolumeToInput(volume) : volume;
}

/**
 * The volume a slider's position means, 0-1: `volumeToSlider` the other way. The window's slider is the one place a
 * position is turned into a volume (E50 fix FG1): `setSfxVolume`, the macro API's (tools/api-surface.json), takes a
 * volume for every slider, as it did before E50 C3, so `setSfxVolume("music", sfxVolume("music"))` changes nothing.
 */
export function sliderToVolume(slider, position) {
    return SFX_SLIDERS[slider]?.proxiesFoundryMusic ? musicInputToVolume(position) : position;
}

/**
 * How loud a slider is on this browser, 0-1.
 *
 * `music` reads Foundry's setting instead of ours. Two independent music
 * volumes would fight each other and the loser would be whichever one the
 * person did not think to check.
 */
export function sfxVolume(slider = "sound") {
    if (SFX_SLIDERS[slider]?.proxiesFoundryMusic) return foundryMusicVolume();

    const stored = getSetting(SETTINGS.sfxVolumes) ?? {};
    const value = Number(stored[slider]);
    return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
}

/**
 * Set a slider's volume, 0-1. Client-scoped, so this is never an act on anybody else's ears. A volume for every
 * slider, the Music one included (`sfxVolume` answers the same number): the slider's position is the window's to
 * turn into a volume (`sliderToVolume`, in `wireSoundPanel`), not this API's (E50 fix FG1; C3 had made it a position).
 */
export async function setSfxVolume(slider, value) {
    const level = clamp(Number(value) || 0, 0, 1);

    if (SFX_SLIDERS[slider]?.proxiesFoundryMusic) {
        return game.settings.set("core", "globalPlaylistVolume", level);
    }
    if (!SFX_VOLUME_KEYS.includes(slider)) {
        error(`Asked to set an unknown volume slider "${slider}".`);
        return null;
    }

    const stored = { ...(getSetting(SETTINGS.sfxVolumes) ?? {}) };
    stored[slider] = level;
    return setSetting(SETTINGS.sfxVolumes, stored);
}

/* ========================================================================== *
 *  Playing
 * ========================================================================== */

/**
 * Play the sound mapped to an event, on this browser only.
 *
 *     playSfx("roomDiscovered");
 *
 * Deliberately not `async` and deliberately never rejecting: sixty call sites
 * are going to use this, none of them wants to know whether audio worked, and
 * an unhandled rejection in a click handler is a worse outcome than silence.
 *
 * @param {string}  key                 a key of `SFX_EVENTS`
 * @param {object}  [options]
 * @param {boolean} [options.force]     ignore the cooldown, the yield and the
 *                                      autoplay lock. For `testSfx` alone - a
 *                                      test button is pressed BY a gesture, so
 *                                      the lock cannot apply to it.
 * @returns {boolean}  whether a sound was sent to the audio layer. `false`
 *                     means "nothing to play", never "something went wrong".
 */
export function playSfx(key, { force = false } = {}) {
    const event = SFX_EVENTS[key];
    if (!event) {
        // A typo in a call site is a bug in this module, not the GM's problem,
        // and it is the one thing here worth an error: it will never fix itself.
        error(`Asked to play an unknown sound "${key}". Known keys: `
            + `${Object.keys(SFX_EVENTS).join(", ")}`);
        return false;
    }

    if (!force && event.yieldsTo?.length) {
        // Nothing to yield to unless something is mapped; a wait that ends in
        // silence is still a wait, and it would make the panel's own test
        // button feel broken on an empty world.
        if (!soundFor(key)) return false;

        clearTimeout(holding.get(key));
        holding.set(key, setTimeout(() => {
            holding.delete(key);
            fire(key, false);
        }, YIELD_MS));
        return true;
    }

    return Boolean(fire(key, force));
}

/**
 * A sound for one character's player, wherever that player happens to be.
 *
 * WHY THIS EXISTS (Dawid, 29.08: "the Truth Bullet sound does not fire when the
 * GM fills in its name and description"). `playSfx` plays on the browser that
 * calls it, and this module has a whole class of events whose audience is a
 * PLAYER but whose code necessarily runs on the GM's client: a Truth Bullet is
 * the clearest of them, because the answer key only exists on a GM's browser,
 * so `createTruthBullet` refuses to run anywhere else. The sound was landing on
 * the one screen in the world that had not found anything.
 *
 * The usual carrier is the chat flag, and it stays the usual carrier: when
 * there is a card, put the sound on the card. This is for the cases where the
 * event is real and the card is not - a bullet minted off a looted body says
 * nothing to anyone, and a sound that only exists when somebody remembered to
 * write a paragraph is a sound that will go missing again.
 *
 * Addressed, never broadcast. `AudioHelper.play(..., true)` and a socket to
 * everyone are the two ways to make the whole table hear a private find; the
 * recipient list here is one player, and the handler checks it again on arrival.
 *
 * @param {Actor} actor  Whose player should hear it.
 * @param {string} key
 */
export function playSfxFor(actor, key) {
    const owner = ownerOf(actor);

    // Ours to play: the GM running a character of their own, or a player who
    // somehow reached this code path on their own browser.
    if (!owner || owner.id === game.user.id) {
        playSfx(key);
        return;
    }

    if (!owner.active) return;

    try {
        game.socket.emit(`module.${MODULE_ID}`,
            { action: SFX_ACTION, key, userId: owner.id },
            { recipients: [owner.id] });
    } catch (err) {
        warn("Could not send a sound to the player it was for", err);
    }
}

/**
 * `playSfxFor` for a list of users (E05 C10). A death kept by the GMs has a card, and a
 * sound on a card is a flag of the message, which every console receives whoever it is
 * whispered to - a death sound at that moment would say somebody died. So the sound goes
 * to the card's readers by address: played here when this browser is one of them.
 */
export function playSfxForUsers(userIds, key) {
    for (const id of new Set(userIds ?? [])) {
        if (id === game.user?.id) {
            playSfx(key);
            continue;
        }
        if (!game.users.get(id)?.active) continue;
        try {
            game.socket.emit(`module.${MODULE_ID}`, { action: SFX_ACTION, key, userId: id }, { recipients: [id] });
        } catch (err) {
            warn("Could not send a sound to the player it was for", err);
        }
    }
}

/** Cancel anything that was waiting to find out whether this key would fire. */
function cancelHoldersOf(winner) {
    for (const [key, timer] of holding) {
        if (!SFX_EVENTS[key]?.yieldsTo?.includes(winner)) continue;
        clearTimeout(timer);
        holding.delete(key);
    }
}

/**
 * The bottom of the funnel: every sound this module plays goes through here.
 *
 * @returns {false|Promise<Sound|null>}  `false` when nothing was sent, and
 *          otherwise the pending sound - which `testSfx` waits on to find out
 *          whether the file actually loaded. `playSfx` only reads its truthiness.
 */
function fire(key, force) {
    cancelHoldersOf(key);

    const now = Date.now();
    if (!force && now - (lastPlayed.get(key) ?? -Infinity) < COOLDOWN_MS) return false;

    // RULE 1. No file is not a fault. Checked before everything else so that an
    // unconfigured world costs one object read per event and nothing more.
    const src = pickSound(key);
    if (!src) return false;

    // RULE 4. Queuing this would fire it at whatever unrelated moment the
    // player first clicks something, which is worse than never playing it.
    if (!force && game.audio?.locked) {
        droppedWhileLocked++;
        return false;
    }

    // The safeword, and only the safeword. A safety tool that a player can
    // silence by leaving a slider at zero months ago is not a safety tool.
    // It still plays on the interface channel below, so Foundry's Interface
    // volume and the page's first click (rule 4) still decide it: the owner's
    // answer to Q1 (E19, 19.10.2026; audit S11-43) keeps both and corrects the
    // promise - the card is what everybody is sure to get.
    const volume = SFX_EVENTS[key].ignoresVolume ? 1 : sfxVolume("sound");
    if (volume <= 0) return false;

    lastPlayed.set(key, now);
    // A file handed to the audio layer, by either path below (E50 C4): what 87-messenger-sound counts on every browser
    // for the socket road ("sound" flow). A play, not a sound heard - the harness has no audio.
    count("sfx.played");

    // `channel: "interface"` puts these under Foundry's own interface volume,
    // which is where a player already goes to turn the game down - without it
    // the only way to quieten the module would be to switch it off. `false` as
    // the second argument is what keeps this local: the alternative pushes the
    // sound to every other client over a socket, which is precisely the thing
    // the audience column of the catalogue exists to avoid.
    const rate = rateFor(key);
    // Both paths get it, and it multiplies the volume the sliders already
    // settled rather than replacing it - see `gainFor`.
    const varied = volume * gainFor(key);
    if (varied !== volume) lastGains.set(src, Math.round(varied * 10000) / 10000);

    /*
     * THE VARIED PATH, and it is deliberately narrow.
     *
     * Only when this event bends AND the browser has been clicked: `load()`
     * waits on `game.audio.unlock` and would never settle otherwise, which is
     * the one way a decoration could hang the thing it decorates. A locked
     * browser falls through to the ordinary path, which drops the sound and
     * counts it - the behaviour rule 4 already describes.
     */
    if (rate !== null && !game.audio?.locked) {
        return playOwned(src, varied, rate)
            .then(sound => {
                if (sound?.failed) reportUnplayable(key, src, null);
                return sound ?? null;
            })
            .catch(err => {
                reportUnplayable(key, src, err);
                return null;
            });
    }

    try {
        return Promise.resolve(foundry.audio.AudioHelper.play(
            {
                src, volume: varied, channel: "interface", autoplay: true,
            }, false))
            .then(sound => {
                /*
                 * NOTHING TO BEND HERE, and there has not been since E14.
                 *
                 * This branch is only reached when `rate` is null - the event
                 * does not vary - or the browser has not been clicked yet. It
                 * called `bend(sound, rate)`, and there is no `bend` in this
                 * file: the function went when the variation moved onto its own
                 * `Sound` (a rate can only be set on a buffer node), and the
                 * call site stayed.
                 *
                 * WHY IT LOOKED LIKE A FILE PROBLEM. The throw lands inside a
                 * `.then`, AFTER `AudioHelper.play` has already started the
                 * sound, so the `.catch` below reported the file as unplayable
                 * while the table was hearing it. Dawid, 28.08: five warnings,
                 * and four of the five sounds played.
                 */
                if (sound?.failed) reportUnplayable(key, src, null);
                return sound ?? null;
            })
            .catch(err => {
                reportUnplayable(key, src, err);
                return null;
            });
    } catch (err) {
        reportUnplayable(key, src, err);
        return false;
    }
}

/**
 * A mapped file that will not play - said once per path, and never again.
 *
 * This is the case worth hearing about: somebody chose a file, the panel shows
 * it, and it has since been renamed or deleted. Repeating it on every play
 * would bury the console during exactly the sessions it matters in.
 */
function reportUnplayable(key, src, err) {
    if (reportedMissing.has(src)) return;
    reportedMissing.add(src);
    // `err` is null for the common case - a path that 404s does not throw, it
    // comes back as a sound that failed to load.
    warn(`The file mapped to "${key}" could not be played and will not be `
        + `reported again this session: ${src}`, err ?? "(the file could not be loaded)");
}

/* ========================================================================== *
 *  Sounds that travel with a message
 * ========================================================================== */

/**
 * The sound a chat message asks for, as its author was entitled to ask:
 * `{ key, forGm }`, or null for none.
 *
 * WHO MAY MAKE A SOUND FOR EVERYBODY (E02, 24.09.2026; audit S11-27).
 *
 * The socket road for sounds already demands a GM; this one, the flag on a
 * chat message, honoured any author. A player could create a public message
 * carrying `{ key: "safeword", gm: true }` and play the one sound that ignores
 * the volume slider to the whole table, in a loop, from the console.
 *
 * A player's own cards do carry sounds, so the rule is narrower than "GMs
 * only". A player may not reach the GMs with a sound, and may not play one
 * that ignores the slider - EXCEPT on the real safeword card, which any player
 * is entitled to post and which carries the safeword marker (`SAFEWORD_FLAG`
 * in safeword.mjs, read here by its value to keep this file out of that
 * one's imports). A spoof that sets the marker too has called the safeword:
 * the game pauses and the GMs are told, which is no longer a prank.
 *
 * THE MARKER IS READ OFF THE DOCUMENT (E06 fix r1-G5, 28.09.2026; the round-1
 * review's m3). Since E06 C7a a private card's module flags go with its words
 * as meta, and the sound is read through `cardFlag`, which looks there. The
 * marker was read the same way, so a player's private card to the GMs with the
 * siren and the marker in its meta played the siren on the GMs' screens while
 * nothing paused - safeword.mjs pauses on the document's flag. The real card
 * is public and carries both on its document, so the marker is read there and
 * nowhere else; secret.mjs also drops it from a player's meta (`GM_META`). Red
 * at f9aca34: tier 2 "a player's card rings the safeword's siren only with the
 * marker on its document" and 30-security's check of a player's private card.
 *
 * Exported for the suite (R128), which asks it about messages it builds.
 */
export function soundFromMessage(message) {
    // A private card's sound is in the meta its words brought (E06 C7a), not on the document.
    const carried = cardFlag(message, SFX_FLAG);
    if (!carried) return null;

    const key = typeof carried === "string" ? carried : carried?.key;
    let forGm = typeof carried === "string" ? false : Boolean(carried?.gm);
    if (!key) return null;

    // A card a GM posted at a player's asking is the player's (secret.mjs `cardWriter`, E08+E28 fix r2-H5).
    const byPlayer = !cardWriter(message)?.isGM;
    if (byPlayer && !message.getFlag?.(MODULE_ID, "safeword")) {
        if (SFX_EVENTS[key]?.ignoresVolume) return null;
        forGm = false;
    }
    return { key, forGm };
}

/* ========================================================================== *
 *  Diagnosis
 * ========================================================================== */

/**
 * Play one event now, ignoring the cooldown, the yield and the autoplay lock.
 *
 *     game.drpg.testSfx("death")
 *
 * Behind the panel's Test button and usable from the console. It returns WHY it
 * did nothing rather than just doing nothing: "I pressed test and heard
 * silence" has five possible causes and only one of them is a broken file.
 *
 * Asynchronous because the last of those five cannot be answered any other way
 * - whether the file loads is known a moment after it was asked for, not when.
 */
export async function testSfx(key) {
    const event = SFX_EVENTS[key];
    if (!event) {
        return {
            played: false,
            why: game.i18n.format("DRPG.Sound.why.noEvent", { keys: Object.keys(SFX_EVENTS).join(", ") })
        };
    }

    const src = soundFor(key);
    if (!src) return { played: false, key, why: game.i18n.localize("DRPG.Sound.why.noFile") };

    const volume = event.ignoresVolume ? 1 : sfxVolume("sound");
    if (volume <= 0) return { played: false, key, src, why: game.i18n.localize("DRPG.Sound.why.soundZero") };

    const interfaceVolume = (() => {
        try { return Number(game.settings.get("core", "globalInterfaceVolume")); }
        catch { return null; }
    })();
    if (interfaceVolume === 0) {
        return { played: false, key, src, why: game.i18n.localize("DRPG.Sound.why.interfaceZero") };
    }

    // Checked HERE rather than left to `force`, and the reason is measured:
    // loading a sound in a browser that has not been clicked never finishes,
    // so forcing past this would hang rather than play. From the panel the
    // button press IS the click and this is already false; from the console it
    // is the likeliest answer of the lot.
    if (game.audio?.locked) {
        return {
            played: false, key, src,
            why: game.i18n.localize("DRPG.Sound.why.locked")
        };
    }

    const sent = fire(key, true);
    if (!sent) return { played: false, key, src, why: game.i18n.localize("DRPG.Sound.why.refused") };

    // The one thing a Test button has to be able to say, and the only one that
    // cannot be answered from settings: whether the file is really there.
    const timeout = Symbol("timeout");
    const sound = await Promise.race([
        sent,
        new Promise(resolve => setTimeout(() => resolve(timeout), TEST_TIMEOUT_MS))
    ]);
    if (sound === timeout) {
        return { played: false, key, src, why: game.i18n.localize("DRPG.Sound.why.timeout") };
    }
    if (sound?.failed) {
        return { played: false, key, src, why: game.i18n.localize("DRPG.Sound.why.failed") };
    }
    return { played: true, key, src, volume, interfaceVolume };
}
