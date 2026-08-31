/**
 * Danganronpa RPG - the sound engine.
 * ---------------------------------------------------------------------------
 * Until this file the module played exactly one sound: a notification chime
 * hard-coded in the messenger. Everything else the game does - a door, a body,
 * an Objection - happened in silence.
 *
 * What lives here is the mixer and the plumbing. WHERE the sounds are triggered
 * from lives with the things that trigger them (E4 for the interface, E5 for
 * events), and WHICH FILE plays lives in a world setting a GM fills in from the
 * Sound panel. Three separate places on purpose: a call site should say "a room
 * was discovered" and know nothing about audio, and a GM should be able to
 * change what that sounds like without a developer.
 *
 * FOUR RULES THIS FILE EXISTS TO KEEP
 *
 * 1. AN UNMAPPED EVENT IS SILENT, NOT BROKEN. The module ships no audio and is
 *    not going to - the files are the GM's, the same bargain the playlists
 *    already make. Nothing is logged for an event with no file: on a fresh
 *    world that is every event, and a console with forty warnings in it is a
 *    console nobody reads. A file that IS mapped and cannot be played is the
 *    opposite case and is reported - once per path, not once per play.
 *
 *    A MISSING FILE DOES NOT THROW. Measured on 14.365: `Sound#load()` on a
 *    path that 404s RESOLVES, and says so by leaving `failed` true and the
 *    state at -1. A `catch` alone therefore reports nothing, and a GM whose
 *    file was renamed would get exactly the silence that means "not mapped
 *    yet". The resolved sound is inspected instead; the `catch` stays for the
 *    genuine throw.
 *
 * 2. SOUND IS LOCAL. `playSfx` never touches a socket. What a client plays is
 *    decided by what happened on that client, which is why the audience of
 *    every event is written down in the catalogue. When a specific set of
 *    people has to hear something that did NOT happen on their browser - a
 *    death, a Despair Call - it travels as a flag on the chat message that
 *    already reaches exactly those people. One mechanism, already tested, and
 *    the audience cannot drift away from the message it belongs to.
 *
 * 3. NEVER TWICE. A call site either plays locally or flags a message. Doing
 *    both means the person who acted hears it twice, and that reads as a bug in
 *    the game rather than in the code. The per-key cooldown below catches the
 *    same-frame version of this; it cannot catch the round trip, so the rule
 *    stands on its own.
 *
 * 4. A BLOCKED AUTOPLAY IS NOT AN ERROR. A browser plays nothing until it has
 *    been clicked, which means every sound before the first click is refused.
 *    Foundry does not refuse it - it QUEUES it - so a session that started with
 *    six silent minutes would fire six sounds at once the moment the player
 *    touched anything. So a locked browser drops the sound instead, silently,
 *    and `diagnoseSfx()` counts what was dropped. That count is the whole
 *    diagnosis of "why did I hear nothing at first".
 *
 *    IT IS WORSE THAN A QUEUE, WHICH IS WHY DROPPING IS NOT MERELY TIDY.
 *    Measured on 14.365: `Sound#load()` opens with `await game.audio.unlock`.
 *    In a browser that has not been clicked it therefore NEVER SETTLES - not
 *    for a missing file, not for a real one. Anything that waits on a sound
 *    without a way out waits for the rest of the session; `testSfx` says so
 *    rather than hanging, and refuses before it asks.
 */

import { MODULE_ID, FLAGS, SFX_EVENTS, SFX_CATEGORIES, SFX_SLIDERS, SFX_VOLUME_KEYS,
    SFX_VARIATION, GAME_WINDOWS } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { log, warn, error, clamp, ownerOf } from "./utils.mjs";


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
const SFX_ACTION = "playSfxFor";

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
const reportedMissing = new Set();

/** How many sounds were dropped because the browser had not been clicked yet. */
let droppedWhileLocked = 0;

/** Whether this browser has produced the gesture that unlocks audio. */
let unlocked = false;

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

/** Every file mapped to this event, in the order the GM listed them. */
export function soundsFor(key) {
    return (soundFor(key) ?? "")
        .split(SOUND_SEPARATOR)
        .map(path => path.trim())
        .filter(Boolean);
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
const decoded = new Set();

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
const lastRates = new Map();

/**
 * And the last volume each file was actually played at.
 *
 * Beside the rates rather than folded into them: this is what makes "is the
 * variation working" answerable from the console instead of by ear, and the
 * two numbers move independently - the gain half lands on every varied play,
 * the rate half only on the buffer path.
 */
const lastGains = new Map();

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

/**
 * How loud a slider is on this browser, 0–1.
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
 * Move a slider. Client-scoped, so this is never an act on anybody else's ears.
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
 * @param {object} data
 * @param {string} senderId  Foundry's own second argument - who really sent
 *   this, which the sender cannot forge.
 *
 * Only a GM may make another browser make a noise. Without the check any player
 * could emit this at any other player, at any time, as often as they liked -
 * and the one thing a horror game's sound design cannot survive is a stranger
 * with the button.
 */
function onSfxSocket(data, senderId) {
    if (data?.action !== SFX_ACTION) return;
    if (!game.users.get(senderId)?.isGM) return;
    if (data.userId && data.userId !== game.user.id) return;
    playSfx(data.key);
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
    const volume = SFX_EVENTS[key].ignoresVolume ? 1 : sfxVolume("sound");
    if (volume <= 0) return false;

    lastPlayed.set(key, now);

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
 * A sound carried on a chat message, heard by the people that message reached.
 *
 * THE AUDIENCE RULE IS THE POPUP'S, ON PURPOSE. `whisperToOwner` addresses the
 * owner PLUS every GM, so a GM sitting on the default rule would hear every
 * sound of every player's turn - the same problem the notification diet was
 * written to solve, and the reason popup.mjs stopped raising a card for every
 * whisper a GM was copied into. A record reaches a GM through the chat log; a
 * sound is not a record, it is an interruption.
 *
 * `gm: true` on the flag is how the few genuinely GM-facing events opt back in.
 * A death is the case in point: the message goes to the GMs and to the owners
 * of everyone caught in the incident, and every one of them is an audience.
 */
function onCreateChatMessage(message) {
    const carried = message.getFlag(MODULE_ID, SFX_FLAG);
    if (!carried) return;

    const key = typeof carried === "string" ? carried : carried?.key;
    const forGm = typeof carried === "string" ? false : Boolean(carried?.gm);
    if (!key) return;

    // A whisper reaches the people it names. No whisper list at all is a public
    // announcement, and everyone hears an announcement.
    const whisper = message.whisper ?? [];
    if (whisper.length && !whisper.includes(game.user.id)) return;
    if (game.user.isGM && whisper.length && !forGm) return;

    playSfx(key);
}

/**
 * Every button in every window this game is played in, from one listener.
 *
 * ONE HANDLER, TWO KEYS. A character sheet IS a window - it matches the motion
 * layer's list and its opening plays the window sound - so without an explicit
 * test its buttons would be window buttons too, and the busiest surface in the
 * game would sound like a dialog. The distinction is made where it can be made
 * honestly: what the button is INSIDE.
 *
 * Capture phase, so a handler that stops propagation cannot silence the press
 * that reached it. Nothing here reads or changes the event.
 *
 * What deliberately does not sound:
 *   disabled controls      nothing happened, so nothing should be heard
 *   the window frame       close has its own sound and minimise is not a move
 *                          the game made
 *   the Sound panel's Test the whole point of that button is to hear ONE sound
 */
function onDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const control = target.closest("button, [role='button']");
    if (!control) return;
    if (control.disabled || control.getAttribute("aria-disabled") === "true") return;
    if (control.hasAttribute("data-drpg-sfx-test")) return;
    if (control.closest(".window-header, .controls-dropdown")) return;

    const app = control.closest(GAME_WINDOWS);
    if (!app) return;

    playSfx(app.matches(".sheet.actor") ? "sheetButton" : "windowButton");
}

/* ========================================================================== *
 *  Events nobody's client "did"
 * ========================================================================== *
 *
 * Most of this module's sounds belong to an act: somebody pressed, moved,
 * rolled, sent. Those play where the act happened and need nothing from here.
 *
 * A few belong to a CHANGE OF STATE that everybody is inside and nobody
 * performed on their own screen - the trial floor opening, an Objection taking
 * it, a turn coming round in an incident, a dead student becoming a Monocub.
 * The GM's client is the only one that runs the function; every other client
 * learns about it because the world setting changed underneath them.
 *
 * A chat message would be the other route and it is the wrong one here: none of
 * these posts a card that reaches exactly the right people, and inventing one
 * per sound would put four new cards in a log that is already the paper trail
 * for everything else. Watching the state is watching the same fact from the
 * same distance on every client at once.
 *
 * EDGES, NOT LEVELS. Each of these fires on a TRANSITION - floor closed to
 * open, mode becoming an objection, the turn becoming mine - because a setting
 * is rewritten for reasons that have nothing to do with the thing being
 * watched. Levels would replay the sound every time the GM extended the clock.
 */

/** What the last look at the world said, so only changes speak. */
const worldWas = { floorOpen: false, floorMode: null, myTurn: false };

async function onWorldSettingChanged(setting) {
    const prefix = `${MODULE_ID}.`;
    if (!setting?.key?.startsWith(prefix)) return;
    const key = setting.key.slice(prefix.length);

    try {
        if (key === SETTINGS.trialQueue) await onFloorChanged();
        else if (key === SETTINGS.murderState) await onIncidentChanged();
    } catch (err) {
        // A sound that cannot work out whether it should play does not play.
        error("Could not read the world state for a sound", err);
    }
}

/**
 * The Nonstop Debate opening, and an Objection taking the floor.
 *
 * "Debate" is `FLOOR_MODES.discussion` - the floor open to everybody - which is
 * what the HUD has always called it and what `openDebate()` produces. So the
 * debate's sound is the floor going from absent to present, not the mode
 * becoming `discussion`: returning to discussion after a rebuttal is the same
 * debate carrying on, and it would otherwise announce itself twice a minute.
 */
async function onFloorChanged() {
    const { trialFloor, FLOOR_MODES } = await import("./trial-floor.mjs");
    const floor = trialFloor();

    const open = Boolean(floor);
    const mode = floor?.mode ?? null;

    if (open && !worldWas.floorOpen) playSfx("debateOpen");
    if (mode === FLOOR_MODES.objection && worldWas.floorMode !== FLOOR_MODES.objection) {
        playSfx("objection");
    }

    worldWas.floorOpen = open;
    worldWas.floorMode = mode;
}

/**
 * Your turn, and only YOURS.
 *
 * `isOwner` is useless for this: a GM owns every actor in the world, so asking
 * it would give a GM "your turn" on every player's turn. The question is whose
 * character it is, which is what `ownerOf` answers - the same helper the
 * whispers use to decide who a card belongs to.
 */
async function onIncidentChanged() {
    const { murderState, isTheirTurn } = await import("./murder.mjs");
    const state = murderState();

    const mine = Boolean(state) && game.actors.some(actor =>
        actor.type === "character"
        && ownerOf(actor)?.id === game.user.id
        && isTheirTurn(actor));

    if (mine && !worldWas.myTurn) playSfx("yourTurn");
    worldWas.myTurn = mine;
}

/**
 * A dead student joining the Monocubs, or leaving them.
 *
 * Heard by their player and by the GMs - this one IS the GM's business, since
 * a Monocub is a GM-side promotion and the panel that made it is theirs.
 */
function onActorFlagged(actor, changes) {
    const changed = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${FLAGS.monocub}`);
    if (changed === undefined) return;
    if (game.user.isGM || ownerOf(actor)?.id === game.user.id) playSfx("monocub");
}

/**
 * Register the one hook this engine needs.
 *
 * Nothing else is registered anywhere: `playSfx` is a plain function, so the
 * call sites added in E4 and E5 do not depend on this having run. That is
 * deliberate - a sound layer that can fail to register and take a subsystem
 * down with it would be a poor trade for a chime.
 */
export function registerSfx() {
    Hooks.on("createChatMessage", onCreateChatMessage);

    // The addressed half of the same job - see `playSfxFor`.
    game.socket.on(`module.${MODULE_ID}`, onSfxSocket);

    // One listener on the document, so it outlives every redraw every window
    // does on its own - the same reason the panel explainers use one.
    document.addEventListener("click", onDocumentClick, true);

    // The handful of events that are a change in the world rather than an act
    // on this screen - see the block above.
    Hooks.on("updateSetting", onWorldSettingChanged);
    Hooks.on("updateActor", onActorFlagged);

    // What the world looked like before anybody changed anything, so the first
    // change is measured against the truth and not against zero: a client that
    // joins mid-trial must not be told the debate just opened.
    Promise.all([onFloorChanged(), onIncidentChanged()]).catch(() => {});

    // Not used to gate anything - the drop rule above does that. This exists so
    // `diagnoseSfx()` can answer "has this browser been clicked yet", which is
    // the first question when somebody reports hearing nothing.
    game.audio?.awaitFirstGesture?.()
        .then(() => { unlocked = true; })
        .catch(() => { /* a browser that never unlocks is not an error */ });

    // The player's only door to the two sliders, and a GM's shortcut past
     // their own panel. Mounted at `ready` and again on every canvas draw,
     // like the messenger launcher it sits above: Foundry rebuilds the body's
     // furniture more often than it looks.
    Hooks.once("ready", renderSoundLauncher);
    Hooks.on("canvasReady", () => renderSoundLauncher());

    log("Sound engine ready.");
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
            why: `No such event. Known keys: ${Object.keys(SFX_EVENTS).join(", ")}`
        };
    }

    const src = soundFor(key);
    if (!src) return { played: false, key, why: "No file is mapped to this event yet." };

    const volume = event.ignoresVolume ? 1 : sfxVolume("sound");
    if (volume <= 0) return { played: false, key, src, why: "The Sound slider is at zero." };

    const interfaceVolume = (() => {
        try { return Number(game.settings.get("core", "globalInterfaceVolume")); }
        catch { return null; }
    })();
    if (interfaceVolume === 0) {
        return { played: false, key, src, why: "Foundry's own Interface volume is at zero." };
    }

    // Checked HERE rather than left to `force`, and the reason is measured:
    // loading a sound in a browser that has not been clicked never finishes,
    // so forcing past this would hang rather than play. From the panel the
    // button press IS the click and this is already false; from the console it
    // is the likeliest answer of the lot.
    if (game.audio?.locked) {
        return {
            played: false, key, src,
            why: "This browser has not been allowed to play audio yet. "
                + "Click anywhere on the page first, then try again."
        };
    }

    const sent = fire(key, true);
    if (!sent) return { played: false, key, src, why: "The audio layer refused it." };

    // The one thing a Test button has to be able to say, and the only one that
    // cannot be answered from settings: whether the file is really there.
    const timeout = Symbol("timeout");
    const sound = await Promise.race([
        sent,
        new Promise(resolve => setTimeout(() => resolve(timeout), TEST_TIMEOUT_MS))
    ]);
    if (sound === timeout) {
        return { played: false, key, src, why: "The file did not finish loading." };
    }
    if (sound?.failed) {
        return { played: false, key, src, why: "Foundry could not load that file." };
    }
    return { played: true, key, src, volume, interfaceVolume };
}

/**
 * What this browser thinks of the sound layer, without playing anything.
 *
 *     game.drpg.diagnoseSfx()
 *
 * A subsystem whose only symptom is silence cannot be diagnosed from outside
 * it. Every question somebody would ask about a missing sound is answered here:
 * is a file mapped, is anything muted, has the browser been clicked, and did
 * something already fail.
 */
export function diagnoseSfx() {
    const map = getSetting(SETTINGS.sfxMap) ?? {};
    const keys = Object.keys(SFX_EVENTS);
    const assigned = keys.filter(key => soundFor(key));

    const byCategory = {};
    for (const [category, meta] of Object.entries(SFX_CATEGORIES)) {
        const inCategory = keys.filter(key => SFX_EVENTS[key].category === category);
        byCategory[category] = {
            label: meta.label,
            assigned: inCategory.filter(key => soundFor(key)).length,
            of: inCategory.length,
            unassigned: inCategory.filter(key => !soundFor(key))
        };
    }

    const core = key => {
        try { return Number(game.settings.get("core", key)); }
        catch { return null; }
    };

    return {
        module: MODULE_ID,
        // The two questions that explain most reports of "no sound at all",
        // and neither of them is about this module.
        browserClicked: unlocked || !(game.audio?.locked ?? false),
        droppedBeforeFirstClick: droppedWhileLocked,
        // Files this session has given up on. Exposed because the module was
        // reporting files as unplayable WHILE PLAYING THEM for four months and
        // nothing could ask.
        unplayable: [...reportedMissing],
        volumes: {
            sound: sfxVolume("sound"),
            music: sfxVolume("music")
        },
        // Ours multiplies with Foundry's, so a slider at 1 over a channel at 0
        // is still silence - and the person moving our slider cannot see that.
        foundry: {
            interface: core("globalInterfaceVolume"),
            playlist: core("globalPlaylistVolume")
        },
        assigned: `${assigned.length} of ${keys.length}`,
        // Whether the busiest sounds are being bent and by how much they last
        // were; `decoded` is what this file holds in memory in order to do it.
        variation: {
            on: Boolean(getSetting(SETTINGS.sfxVary)),
            spread: SFX_VARIATION.rate,
            gainSpread: SFX_VARIATION.gain,
            events: Object.entries(SFX_EVENTS).filter(([, e]) => e.vary).map(([k]) => k),
            decoded: [...decoded],
            lastRates: Object.fromEntries(lastRates),
            lastGains: Object.fromEntries(lastGains)
        },
        byCategory,
        // Mapped somewhere in the setting but not a key this build knows: what
        // a renamed event leaves behind, and invisible in the panel because the
        // panel draws from the catalogue.
        orphanedMappings: Object.keys(map).filter(key => !SFX_EVENTS[key]),
        unplayableThisSession: Array.from(reportedMissing)
    };
}

/* ========================================================================== *
 *  The launcher, and the panel it opens
 * ========================================================================== */

const LAUNCHER_ID = "drpg-sound-launcher";

/**
 * A second circle above the chat one (Dawid, 28.08).
 *
 * THE PLAYER NEEDS A DOOR, AND THIS IS THE ONLY ONE THEY HAVE. The GM reaches
 * the Sound panel from the tile in their own panel; a player has no panel, and
 * the two volumes are THEIR settings - the one part of that window that is not
 * the GM's business. Left without a way in, the sliders would exist for nobody.
 *
 * Deliberately not a menu in Foundry's own settings, which was the cheap
 * option: volume is something you reach for while a sound is playing, and a
 * control three menus deep is a control nobody moves twice.
 *
 * Smaller and bone against the chat button's eye-violet - see the stylesheet
 * for why those two differences and not others.
 */
export function renderSoundLauncher() {
    try {
        document.getElementById(LAUNCHER_ID)?.remove();
        if (!game.user) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = LAUNCHER_ID;

        const tip = game.i18n.localize("DRPG.Sound.launcherTooltip");
        button.dataset.tooltip = tip;
        button.setAttribute("aria-label", tip);
        // `inert` so the mask element cannot become the click target and eat
        // the press - the same guard the messenger launcher's glyph carries.
        button.innerHTML = `<i inert></i>`;

        button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            try {
                const { openSoundDialog } = await import("./music.mjs");
                await openSoundDialog();
            } catch (err) {
                error("Could not open the Sound panel", err);
            }
        });

        document.body.append(button);
        refreshSoundLauncher();
    } catch (err) {
        error("Could not render the sound launcher", err);
    }
}

/**
 * Show on the button itself that this browser is silent.
 *
 * Zero is a state somebody puts themselves in and then forgets, and "the module
 * went quiet" is a bug report nobody enjoys chasing. Both sliders down, because
 * one of the two at zero is an ordinary preference.
 */
export function refreshSoundLauncher() {
    const button = document.getElementById(LAUNCHER_ID);
    if (!button) return;
    button.classList.toggle("drpg-muted",
        sfxVolume("sound") <= 0 && sfxVolume("music") <= 0);
}

/** The two sliders. The whole of the window for a player - see `openSoundDialog`. */
export function soundSlidersHtml() {
    const rows = Object.entries(SFX_SLIDERS).map(([key, slider]) => `
        <label class="drpg-sound-slider" data-drpg-slider="${key}">
            <span class="drpg-sound-slider-name">${foundry.utils.escapeHTML(slider.label)}</span>
            <input type="range" min="0" max="100" step="1"
                   name="vol:${key}" value="${Math.round(sfxVolume(key) * 100)}" />
            <output>${Math.round(sfxVolume(key) * 100)}%</output>
            <span class="notes">${foundry.utils.escapeHTML(slider.hint)}</span>
        </label>`).join("");

    /*
     * The variation switch rides with the sliders and is GM-only.
     *
     * Here rather than on the mapping table because it is one control for the
     * whole panel and the table is one row per event - and a switch buried at
     * the top of forty rows is a switch nobody finds. Hidden from players
     * entirely: this is a world setting they could not write anyway, and a dead
     * control is worse than no control.
     */
    const variation = game.user.isGM
        ? `<label class="drpg-sound-switch">
            <input type="checkbox" name="sfxVary"${
                getSetting(SETTINGS.sfxVary) ? " checked" : ""} />
            <span>${game.i18n.localize("DRPG.Sound.varyLabel")}</span>
            <span class="notes">${game.i18n.localize("DRPG.Sound.varyHint")}</span>
        </label>`
        : "";

    return `<fieldset class="drpg-sound-volumes">
        <legend>${game.i18n.localize("DRPG.Sound.volumes")}</legend>
        ${rows}
        <p class="notes">${game.i18n.localize("DRPG.Sound.volumeNote")}</p>
        ${variation}
    </fieldset>`;
}

/** The mapping table: one row per event, grouped by category. GM only. */
export function soundEffectsHtml() {
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const keys = Object.keys(SFX_EVENTS);

    const body = Object.entries(SFX_CATEGORIES).map(([category, meta]) => {
        const rows = keys.filter(key => SFX_EVENTS[key].category === category).map(key => {
            const event = SFX_EVENTS[key];
            const src = soundFor(key) ?? "";
            const many = soundsFor(key).length;
            // Two badges, and both answer a question the row could not before:
            // how many files this event draws from, and whether it bends.
            const badges = [
                many > 1
                    ? `<span class="drpg-sfx-badge">${game.i18n.format(
                        "DRPG.Sound.fileCount", { n: many })}</span>`
                    : "",
                event.vary
                    ? `<span class="drpg-sfx-badge" title="${esc(game.i18n.localize(
                        "DRPG.Sound.variesHint"))}">${esc(game.i18n.localize(
                        "DRPG.Sound.varies"))}</span>`
                    : ""
            ].join("");
            return `<tr data-drpg-sfx="${key}">
                <td>
                    <strong>${esc(event.label)}</strong>${badges}<br>
                    <small class="notes">${esc(event.hint)}</small>
                </td>
                <td><input type="text" name="sfx:${key}" value="${esc(src)}"
                        title="${esc(game.i18n.localize("DRPG.Sound.severalHint"))}"
                        placeholder="${esc(game.i18n.localize("DRPG.Sound.notAssigned"))}" /></td>
                <td><div class="drpg-sfx-actions">
                    <button type="button" class="drpg-mini-button" data-drpg-sfx-pick>${
                        esc(game.i18n.localize("DRPG.Sound.choose"))}</button>
                    <button type="button" class="drpg-mini-button" data-drpg-sfx-test>${
                        esc(game.i18n.localize("DRPG.Sound.test"))}</button>
                    <button type="button" class="drpg-mini-button" data-drpg-sfx-clear>${
                        esc(game.i18n.localize("DRPG.Sound.clear"))}</button>
                </div></td>
            </tr>`;
        }).join("");

        return `<tr class="drpg-sfx-group"><td colspan="3">
            <strong>${esc(meta.label)}</strong>
            <small class="notes">${esc(meta.hint)}</small>
        </td></tr>${rows}`;
    }).join("");

    return `
        <p class="notes">${game.i18n.localize("DRPG.Sound.effectsIntro")}</p>
        <p class="notes" data-drpg-sfx-count>${countLine()}</p>
        <table class="drpg-vault-table drpg-sfx-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Sound.event")}</th>
            <th>${game.i18n.localize("DRPG.Sound.file")}</th>
            <th></th>
        </tr></thead><tbody>${body}</tbody></table>`;
}

/** "12 of 35 events have a file." - the empty state, said as a number. */
function countLine() {
    const keys = Object.keys(SFX_EVENTS);
    return game.i18n.format("DRPG.Sound.assigned", {
        n: keys.filter(key => soundFor(key)).length,
        total: keys.length
    });
}

/**
 * Wire the panel from the dialog's `render`, never before it.
 *
 * DialogV2 stringifies its content, so listeners attached to markup do not
 * survive the trip - the same reason `wirePortraitPickers` documents, and the
 * reason the FilePicker here has to be opened from a live element.
 *
 * EVERYTHING HERE SAVES AS IT IS TOUCHED, and there is no Apply for it. The
 * volumes are this browser's and want to be heard while being dragged; a
 * mapping wants to be testable the moment it is chosen, and a Test button that
 * needs the window closed and reopened first is a Test button nobody trusts.
 */
export function wireSoundPanel(root) {
    /* ---- volumes ---------------------------------------------------- */
    for (const label of root.querySelectorAll("[data-drpg-slider]")) {
        const key = label.dataset.drpgSlider;
        const input = label.querySelector("input[type=range]");
        const out = label.querySelector("output");
        if (!input) continue;

        input.addEventListener("input", () => {
            const percent = Number(input.value);
            if (out) out.textContent = `${percent}%`;
            setSfxVolume(key, percent / 100)
                .then(refreshSoundLauncher)
                .catch(err => error(`Could not set the ${key} volume`, err));
        });
    }

    /* ---- the variation switch ---------------------------------------- */
    const varyBox = root.querySelector('input[name="sfxVary"]');
    varyBox?.addEventListener("change", () => {
        setSetting(SETTINGS.sfxVary, varyBox.checked)
            .catch(err => error("Could not set sound variation", err));
    });

    /* ---- the mapping table ------------------------------------------ */
    const counter = root.querySelector("[data-drpg-sfx-count]");
    const recount = () => { if (counter) counter.textContent = countLine(); };

    for (const row of root.querySelectorAll("[data-drpg-sfx]")) {
        const key = row.dataset.drpgSfx;
        const input = row.querySelector(`input[name="sfx:${CSS.escape(key)}"]`);

        const write = async value => {
            await setSoundFor(key, value);
            if (input) input.value = value ?? "";
            recount();
        };

        row.querySelector("[data-drpg-sfx-pick]")?.addEventListener("click", () => {
            /*
             * ADDS when the row already has something, replaces when it is empty.
             *
             * One event can draw from several files now, and the way a GM builds
             * that list is by pressing Choose more than once - so a picker that
             * overwrote would make the second file destroy the first and there
             * would be no way to build a list at all except by typing pipes by
             * hand. "Clear" is the button that empties a row, and it is right
             * there next to this one.
             */
            const existing = soundsFor(key);
            new foundry.applications.apps.FilePicker.implementation({
                type: "audio",
                current: existing[existing.length - 1] ?? "",
                callback: path => {
                    if (existing.includes(path)) return;   // adding it twice weights the draw
                    write([...existing, path].join(" | "));
                }
            }).render(true);
        });

        // Typed by hand rather than picked - a path pasted from somewhere else
        // has to save too, or the box lies about what is mapped.
        input?.addEventListener("change", () => write(input.value));

        row.querySelector("[data-drpg-sfx-test]")?.addEventListener("click", async () => {
            const result = await testSfx(key);
            if (result?.played) return;
            ui.notifications.warn(`${SFX_EVENTS[key]?.label ?? key}: ${result?.why ?? ""}`);
        });

        row.querySelector("[data-drpg-sfx-clear]")?.addEventListener("click", () => write(null));
    }
}
