/**
 * Danganronpa RPG — the sound engine.
 * ---------------------------------------------------------------------------
 * Until this file the module played exactly one sound: a notification chime
 * hard-coded in the messenger. Everything else the game does — a door, a body,
 * an Objection — happened in silence.
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
 *    not going to — the files are the GM's, the same bargain the playlists
 *    already make. Nothing is logged for an event with no file: on a fresh
 *    world that is every event, and a console with forty warnings in it is a
 *    console nobody reads. A file that IS mapped and cannot be played is the
 *    opposite case and is reported — once per path, not once per play.
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
 *    people has to hear something that did NOT happen on their browser — a
 *    death, a Despair Call — it travels as a flag on the chat message that
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
 *    Foundry does not refuse it — it QUEUES it — so a session that started with
 *    six silent minutes would fire six sounds at once the moment the player
 *    touched anything. So a locked browser drops the sound instead, silently,
 *    and `diagnoseSfx()` counts what was dropped. That count is the whole
 *    diagnosis of "why did I hear nothing at first".
 *
 *    IT IS WORSE THAN A QUEUE, WHICH IS WHY DROPPING IS NOT MERELY TIDY.
 *    Measured on 14.365: `Sound#load()` opens with `await game.audio.unlock`.
 *    In a browser that has not been clicked it therefore NEVER SETTLES — not
 *    for a missing file, not for a real one. Anything that waits on a sound
 *    without a way out waits for the rest of the session; `testSfx` says so
 *    rather than hanging, and refuses before it asks.
 */

import { MODULE_ID, SFX_EVENTS, SFX_CATEGORIES, SFX_SLIDERS, SFX_VOLUME_KEYS }
    from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { log, warn, error, clamp } from "./utils.mjs";

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

/**
 * How long a yielding sound waits to find out whether it lost.
 *
 * Pressing a button that opens a window is one gesture and two events, and what
 * you want to hear is the window. The winner cannot un-play the loser, so the
 * loser waits instead — briefly — and cancels itself if the winner turns up.
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
 * everybody else — the door they heard would not be the door anyone else heard.
 */
export function soundFor(key) {
    const map = getSetting(SETTINGS.sfxMap) ?? {};
    const src = map[key];
    return typeof src === "string" && src.trim() ? src.trim() : null;
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
    // A path that failed before may be a path that works now — the GM has just
    // told us they changed something, and the once-per-path rule must not
    // outlive the mapping it was about.
    reportedMissing.clear();
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
 *                                      autoplay lock. For `testSfx` alone — a
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
 *          otherwise the pending sound — which `testSfx` waits on to find out
 *          whether the file actually loaded. `playSfx` only reads its truthiness.
 */
function fire(key, force) {
    cancelHoldersOf(key);

    const now = Date.now();
    if (!force && now - (lastPlayed.get(key) ?? -Infinity) < COOLDOWN_MS) return false;

    // RULE 1. No file is not a fault. Checked before everything else so that an
    // unconfigured world costs one object read per event and nothing more.
    const src = soundFor(key);
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
    // which is where a player already goes to turn the game down — without it
    // the only way to quieten the module would be to switch it off. `false` as
    // the second argument is what keeps this local: the alternative pushes the
    // sound to every other client over a socket, which is precisely the thing
    // the audience column of the catalogue exists to avoid.
    try {
        return Promise.resolve(foundry.audio.AudioHelper.play(
            { src, volume, channel: "interface", autoplay: true }, false))
            .then(sound => {
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
 * A mapped file that will not play — said once per path, and never again.
 *
 * This is the case worth hearing about: somebody chose a file, the panel shows
 * it, and it has since been renamed or deleted. Repeating it on every play
 * would bury the console during exactly the sessions it matters in.
 */
function reportUnplayable(key, src, err) {
    if (reportedMissing.has(src)) return;
    reportedMissing.add(src);
    // `err` is null for the common case — a path that 404s does not throw, it
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
 * sound of every player's turn — the same problem the notification diet was
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
 * Register the one hook this engine needs.
 *
 * Nothing else is registered anywhere: `playSfx` is a plain function, so the
 * call sites added in E4 and E5 do not depend on this having run. That is
 * deliberate — a sound layer that can fail to register and take a subsystem
 * down with it would be a poor trade for a chime.
 */
export function registerSfx() {
    Hooks.on("createChatMessage", onCreateChatMessage);

    // Not used to gate anything — the drop rule above does that. This exists so
    // `diagnoseSfx()` can answer "has this browser been clicked yet", which is
    // the first question when somebody reports hearing nothing.
    game.audio?.awaitFirstGesture?.()
        .then(() => { unlocked = true; })
        .catch(() => { /* a browser that never unlocks is not an error */ });

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
 * — whether the file loads is known a moment after it was asked for, not when.
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
        volumes: {
            sound: sfxVolume("sound"),
            music: sfxVolume("music")
        },
        // Ours multiplies with Foundry's, so a slider at 1 over a channel at 0
        // is still silence — and the person moving our slider cannot see that.
        foundry: {
            interface: core("globalInterfaceVolume"),
            playlist: core("globalPlaylistVolume")
        },
        assigned: `${assigned.length} of ${keys.length}`,
        byCategory,
        // Mapped somewhere in the setting but not a key this build knows: what
        // a renamed event leaves behind, and invisible in the panel because the
        // panel draws from the catalogue.
        orphanedMappings: Object.keys(map).filter(key => !SFX_EVENTS[key]),
        unplayableThisSession: Array.from(reportedMissing)
    };
}
