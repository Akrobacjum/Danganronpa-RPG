/**
 * Danganronpa RPG - the sound engine.
 * ---------------------------------------------------------------------------
 * THE FAMILY (E41 C9a, 1.2.97). A sound picked, set and played - the mixer,
 * the volumes, `playSfx`, its two socket senders, `fire` and `testSfx` -
 * moved to sfx-play.mjs by a pure move that `node tools/moved-only.mjs`
 * proves, and this file re-exports the fourteen names of it that it exported.
 * It keeps what listens: `registerSfx` with the socket's listener and the
 * hooks that play a sound, the unlock and `diagnoseSfx`, and the Sound
 * window's sliders, its Effects tab and the launcher: in sound-panel.mjs they
 * would close a static import cycle (sound-panel.mjs reaches this file through
 * music-states.mjs, clock.mjs and actions.mjs), so they stay here, and E41-16
 * is carried to E73. Every importer still imports this file. New code goes
 * into the file of its role, not here.
 *
 * Until this file the module played exactly one sound: a notification chime
 * hard-coded in the messenger. Everything else the game does - a door, a body,
 * an Objection - happened in silence.
 *
 * This family is the mixer and the plumbing. WHERE the sounds are triggered
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

import { MODULE_ID, FLAGS, SFX_EVENTS, SFX_CATEGORIES, SFX_SLIDERS, SFX_VARIATION, GAME_WINDOWS } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { log, error, playerOwns, esc, plural, markLanguage } from "./utils.mjs";
import { wordsOf, secretHtml, isVeiled, SECRET_FLAG } from "./secret.mjs";
import { dataTable, iconButton } from "./ui-kit.mjs";
import {
    SFX_ACTION, reportedMissing, droppedWhileLocked, soundFor, soundsFor, decoded, lastRates, lastGains, setSoundFor,
    volumeToSlider, sliderToVolume, sfxVolume, setSfxVolume, playSfx, soundFromMessage, testSfx
} from "./sfx-play.mjs";
export {
    SFX_FLAG, soundFor, soundsFor, pickSound, setSoundFor, musicVolumeToInput, musicInputToVolume, sfxVolume,
    setSfxVolume, playSfx, playSfxFor, playSfxForUsers, soundFromMessage, testSfx
} from "./sfx-play.mjs";

/** Whether this browser has produced the gesture that unlocks audio. */
let unlocked = false;

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
async function onCreateChatMessage(message) {
    // A whisper reaches the people it names. No whisper list at all is a public
    // announcement, and everyone hears an announcement.
    const whisper = message.whisper ?? [];
    if (whisper.length && !whisper.includes(game.user.id)) return;

    // A private card's sound came with its words (E06 C7a), so it is asked for once
    // they are here. A veiled card names everybody and is meant for its readers alone:
    // a client that never receives the words hears nothing.
    if (message.getFlag?.(MODULE_ID, SECRET_FLAG)) {
        await wordsOf(message);
        if (isVeiled(message) && !secretHtml(message)) return;
    }

    const asked = soundFromMessage(message);
    if (!asked) return;
    const { key, forGm } = asked;
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

/**
 * What the last look at the world said, so only changes speak. `known` is false until
 * `snapshotWorld` has read the world at ready: before it, a change has nothing to be a change from.
 */
const worldWas = { known: false, floorOpen: false, floorMode: null, myTurn: false, turnStep: null, closingAt: null };

/**
 * The baseline, read at ready (E19 C6, audit S11-31). It was read from `registerSfx` at init, where
 * `game.actors` does not exist yet: the TypeError was swallowed, the baseline said "not my turn",
 * and a player who reloaded during their own turn heard "your turn" at the next incident write.
 * Both readers stay quiet while `known` is false, and it turns true even if a reader throws, so a
 * failed read costs one transition's sound rather than every sound after it.
 */
function snapshotWorld() {
    return Promise.all([onFloorChanged(), onIncidentChanged()])
        .catch(err => error("Could not read the world state for the sounds", err))
        .finally(() => { worldWas.known = true; });
}

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
 * The Nonstop Debate opening, an Objection taking the floor, and the rebuttal after it.
 *
 * `FLOOR_MODES.debate` is the floor open to everybody, which is what the HUD
 * calls it and what `openDebate()` produces. So the debate's sound is the
 * floor going from absent to present, not the mode becoming `debate`:
 * returning to debate after a rebuttal is the same debate carrying on, and it
 * would otherwise announce itself twice a minute.
 *
 * THE REBUTTAL HAS ITS OWN (Dawid, 22.09: "osobny sound effect na start
 * rebuttal"). It is the mode becoming `rebuttal` from anything else - after an
 * Objection's minute, when the floor hands itself on, or when the GM opens one -
 * and not the rebuttal carrying on. Every client reads the same floor, so the
 * whole table hears it, as it hears the Objection.
 */
async function onFloorChanged() {
    const { trialFloor, FLOOR_MODES } = await import("./trial-floor.mjs");
    const floor = trialFloor();

    const open = Boolean(floor);
    const mode = floor?.mode ?? null;

    // The Closing's start has its own sound (E70 C8, below), not the debate's.
    const closingOpens = mode === FLOOR_MODES.closing && floor?.closing?.phase === "volunteer";
    if (worldWas.known && open && !worldWas.floorOpen && !closingOpens) playSfx("debateOpen");
    const into = target => mode === target && worldWas.floorMode !== target;
    if (worldWas.known && into(FLOOR_MODES.objection)) playSfx("objection");
    // A rebuttal an Overrule brings back is no rebuttal starting: the Overrule's card carries its own sound (E70 C2).
    const overruled = floor?.gmNote?.key === "DRPG.Floor.gmNoteOverrule";
    if (worldWas.known && into(FLOOR_MODES.rebuttal) && !overruled) playSfx("rebuttal");
    /* A ROUND (E70 C7; E70-45, amend 0): a Panic Round's start for the whole table, and `yourTurn` for the speaker's
       player alone, once a turn - a GM owns every student, so the question is whose character it is (`playerOwns`:
       any of its owners since E91 C6). */
    if (worldWas.known && into(FLOOR_MODES.panic)) playSfx("panicStart");
    /* THE CLOSING ARGUMENT (E70 C8; amend 0): its start for the whole table, once a Closing (its volunteers' window, by
       its stamp - the Closing's mode stands through its phases, so `into` would sound again after every exchange), and
       `yourTurn` for its speaker's player at each stretch. */
    const closingAt = mode === FLOOR_MODES.closing && floor?.closing?.phase === "volunteer" ? (floor.closing.openedAt ?? null) : null;
    if (worldWas.known && closingAt !== null && worldWas.closingAt !== closingAt) playSfx("closingStart");
    if (closingAt !== null) worldWas.closingAt = closingAt;
    const closingTurn = mode === FLOOR_MODES.closing && floor?.closing?.phase === "speak" && floor?.holderId
        ? `closing|${floor.closing.openedAt ?? "-"}|${floor.closing.step ?? "-"}` : null;
    const roundTurn = (mode === FLOOR_MODES.testimony || mode === FLOOR_MODES.panic) && floor?.holderId
        ? `${floor.round?.openedAt ?? "-"}|${floor.round?.step ?? "-"}` : closingTurn;
    const mineNow = Boolean(roundTurn) && playerOwns(game.actors.get(floor.holderId));
    if (worldWas.known && mineNow && worldWas.turnStep !== roundTurn) playSfx("yourTurn");
    worldWas.turnStep = roundTurn;

    worldWas.floorOpen = open;
    worldWas.floorMode = mode;
}

/**
 * Your turn, and only YOURS.
 *
 * `isOwner` is useless for this: a GM owns every actor in the world, so asking
 * it would give a GM "your turn" on every player's turn. The question is whose
 * character it is, which is what `playerOwns` answers: any player who owns it,
 * a co-owner as well since E91 C6 (D078), as a card goes to every owner.
 */
async function onIncidentChanged() {
    const { murderState, isTheirTurn } = await import("./murder.mjs");
    const state = murderState();

    const mine = Boolean(state) && game.actors.some(actor =>
        actor.type === "character"
        && playerOwns(actor)
        && isTheirTurn(actor));

    if (worldWas.known && mine && !worldWas.myTurn) playSfx("yourTurn");
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
    if (game.user.isGM || playerOwns(actor)) playSfx("monocub");
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
    /* The turn is the cast's since E32 C2 (1.2.66): a pass writes the cast alone, a client
       setting, whose change never reaches `updateSetting` - the world half's change still
       does, for the stage. */
    Hooks.on("drpgCastChanged", () => onIncidentChanged().catch(() => {}));
    Hooks.on("updateActor", onActorFlagged);

    // What the world looked like before anybody changed anything, so the first
    // change is measured against the truth and not against zero: a client that
    // joins mid-trial must not be told the debate just opened. At ready, when
    // the actors exist - see `snapshotWorld`.
    Hooks.once("ready", () => snapshotWorld());

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
        // Its language, the page's (E66 C3; C1's `lang` on the module's containers, STATUS Open 3).
        markLanguage(button);

        // Under both themes this is the settings button: this browser's settings
        // window (settings-window.mjs, through look.mjs `openLookDialog`; E49 A1d) -
        // the volumes, the voice, the look - the same for a GM and a player.
        // A player has no other door to the theme switch.
        const tip = game.i18n.localize("DRPG.Look.launcherTooltip");
        button.dataset.tooltip = tip;
        button.setAttribute("aria-label", tip);
        // `inert` so the mask element cannot become the click target and eat
        // the press - the same guard the messenger launcher's glyph carries.
        button.innerHTML = `<i inert></i>`;

        button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            try {
                const { openLookDialog } = await import("./look.mjs");
                await openLookDialog();
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
 * one of the two at zero is an ordinary preference. Or Foundry's "mute all" of
 * the voices on (E78 C5, the A9 design's step 8): with the camera dock out of
 * sight its own struck button is too, and this is the button a player looks at
 * when nobody can be heard. voice-tile.mjs calls this on `rtcSettingsChanged`.
 */
export function refreshSoundLauncher() {
    const button = document.getElementById(LAUNCHER_ID);
    if (!button) return;
    button.classList.toggle("drpg-muted",
        (sfxVolume("sound") <= 0 && sfxVolume("music") <= 0) || game.webrtc?.settings?.client?.muteAll === true);
}

/**
 * The volume sliders as they stand, `{ key, label, hint, position }` per SFX_SLIDERS row (`position` 0-100, the
 * slider's, `volumeToSlider`): one reading for the Sound window's fieldset below and for the settings window's Sound
 * section (settings-window.mjs, E49 A1d), which draw it each in their own rows.
 */
export function volumeSliders() {
    return Object.entries(SFX_SLIDERS).map(([key, slider]) => ({
        key, label: slider.label, hint: slider.hint, position: Math.round(volumeToSlider(key, sfxVolume(key)) * 100)
    }));
}

/** The two sliders. The whole of the window for a player - see `openSoundDialog`. */
export function soundSlidersHtml() {
    const rows = volumeSliders().map(({ key, label, hint, position }) => `
        <label class="drpg-sound-slider" data-drpg-slider="${key}">
            <span class="drpg-sound-slider-name">${foundry.utils.escapeHTML(label)}</span>
            <input type="range" min="0" max="100" step="1"
                   name="vol:${key}" value="${position}" />
            <output>${position}%</output>
            <span class="notes">${foundry.utils.escapeHTML(hint)}</span>
        </label>`).join("");

    /*
     * THE VARIATION SWITCH LEFT THE SLIDERS (E49 A1d, 11.11.2026). It rode here, GM-only, a world setting among this
     * browser's own - so the gear's window was a different window for a GM than for a player, which is exactly what
     * the owner refused on A1's shots ("Gm pod przyciskiem zebatki nie powinien miec innych ustawien niz gracz"). Vary
     * the sounds is a row of the game's settings now, the GM panel's tab (settings-window.mjs GAME_SECTIONS, audio),
     * the one place it is set; the GM's Sound window under Monokuma Legacy, which drew these sliders, lost it with them.
     */

    const messenger = `<label class="drpg-sound-switch">
            <input type="checkbox" name="messengerSound"${
                getSetting(SETTINGS.messengerSound) !== false ? " checked" : ""} />
            <span>${game.i18n.localize("DRPG.Look.messengerSound")}</span>
            <span class="notes">${game.i18n.localize(
                "DRPG.Settings.messengerSound.hint")}</span>
        </label>`;

    return `<fieldset class="drpg-sound-volumes">
        <legend>${game.i18n.localize("DRPG.Sound.volumes")}</legend>
        ${rows}
        <p class="notes">${game.i18n.localize("DRPG.Sound.volumeNote")}</p>
        ${messenger}
    </fieldset>`;
}

/**
 * The Effects tab on the kit (E46-C4, 09.11.2026; card M2, Approve 04.11; STAGE E46's Sound shape). One `dataTable`:
 * a group row per category, its "n of m assigned" in the kit's count and its line under it, then one row per event in
 * `SFX_EVENTS`' order - the name, its chips and its description in one cell cut after two lines, the whole in the
 * cell's title (`cellLines: 2`); the file box with its Choose; Test and Clear, the kit's icon buttons, their words in
 * `aria-label` and the tooltip. Three buttons a row, as before (E19 C6 made the word buttons icons, audit S11-21).
 * Measured at 3c952c67 (glass, 1366x768): 60 hand rows of a median 118 px (the largest 227), a body of 7171 px, and
 * under Legacy the 60 descriptions at 10.83 px (`small.notes`, the browser's `smaller`); the kit's fine print takes the
 * floor (R2027). The chooseHint, testHint and clearHint tooltips went with the owner's "Test and Clear as buttons whose
 * words are in aria-label and the tooltip"; the file box keeps its title (`DRPG.Sound.severalHint`). GM only.
 */
export function soundEffectsHtml({ lead = "" } = {}) {
    const L = key => game.i18n.localize(key);
    const keys = Object.keys(SFX_EVENTS);
    const groups = Object.entries(SFX_CATEGORIES).map(([category, meta]) => ({ group: meta.label, count: groupCountLine(category), category, hint: meta.hint }));
    const rows = groups.flatMap(group => [group, ...keys.filter(key => SFX_EVENTS[key].category === group.category).map(effectRow)]);
    const table = dataTable({
        columns: [
            { key: "event", label: L("DRPG.Sound.event"), cellLines: 2, cls: "sound-event" },
            { key: "file", label: L("DRPG.Sound.file"), cls: "sound-file", width: "32%" },
            { key: "act", label: L("DRPG.Sound.rowButtons"), act: true, cls: "sound-act", width: "9em", lines: 2 }
        ],
        rows,
        rowAttrs: row => ({ "data-drpg-sfx": row.key })
    });

    // What the "varies" chip means, said once above the table rather than in a hover on each chip.
    const legend = Object.values(SFX_EVENTS).some(event => event.vary)
        ? `<p class="drpg-help" data-drpg-sfx-legend><span class="drpg-sound-chip">${esc(L("DRPG.Sound.varies"))}</span> ${esc(L("DRPG.Sound.variesHint"))}</p>`
        : "";

    // This tab has no Apply (see `wireSoundPanel`), and a GM who typed paths into it closed the
    // window believing nothing was saved: the sentence says so before the table.
    return `
        <p class="drpg-help">${L("DRPG.Sound.effectsIntro")}</p>
        <p class="drpg-help">${L("DRPG.Sound.autosave")}</p>
        <p class="drpg-help" data-drpg-sfx-count>${countLine()}</p>
        ${legend}
        ${lead}
        ${markGroups(table, groups)}`;
}

/* One event's row for `soundEffectsHtml`: the cell of its name, chips and description, the file box with Choose, and
   Test and Clear. Two chips, each answering what a bare path cannot: how many files the event draws from, and
   whether it bends. */
function effectRow(key) {
    const L = name => game.i18n.localize(name);
    const event = SFX_EVENTS[key];
    const many = soundsFor(key).length;
    const chips = [
        many > 1 ? `<span class="drpg-sound-chip" data-drpg-sfx-files>${plural("DRPG.Sound.fileCount", { n: many })}</span>` : "",
        event.vary ? `<span class="drpg-sound-chip" data-drpg-sfx-varies data-tooltip="${esc(L("DRPG.Sound.variesHint"))}">${esc(L("DRPG.Sound.varies"))}</span>` : ""
    ].join("");
    return {
        key,
        event: `<strong>${esc(event.label)}</strong>${chips}<br><span class="drpg-help">${esc(event.hint)}</span>`,
        file: `<div class="drpg-sound-file"><input type="text" name="sfx:${key}" value="${esc(soundFor(key) ?? "")}"
            title="${esc(L("DRPG.Sound.severalHint"))}" placeholder="${esc(L("DRPG.Sound.notAssigned"))}" />${
            iconButton({ icon: "fa-solid fa-folder-open", label: L("DRPG.Sound.choose"), attrs: { "data-drpg-sfx-pick": true } })}</div>`,
        act: `<div class="drpg-sound-act">${iconButton({ icon: "fa-solid fa-play", label: L("DRPG.Sound.test"), attrs: { "data-drpg-sfx-test": true } })}${
            iconButton({ icon: "fa-solid fa-xmark", label: L("DRPG.Sound.clear"), attrs: { "data-drpg-sfx-clear": true } })}</div>`
    };
}

/* The kit's group rows, in `groups`' order, marked for `wireSoundPanel`'s recount (the count's `data-drpg-sfx-group-
   count`) and given their category's line as fine print under the name - the kit's group row draws a name and a count
   only (ui-kit.mjs `dataTable`), and the line was the group's before (D31: content unchanged). */
function markGroups(table, groups) {
    const t = document.createElement("template");
    t.innerHTML = table;
    [...t.content.querySelectorAll("tr.drpg-data-group > th")].forEach((th, i) => {
        const group = groups[i];
        if (!group) return;
        th.querySelector(":scope > span")?.setAttribute("data-drpg-sfx-group-count", group.category);
        const line = document.createElement("span");
        line.className = "drpg-help drpg-sound-group-line";
        line.textContent = group.hint;
        th.append(line);
    });
    return t.innerHTML;
}

/** "3 of 11 assigned" - one group's empty state, beside its name. */
function groupCountLine(category) {
    const keys = Object.keys(SFX_EVENTS).filter(key => SFX_EVENTS[key].category === category);
    return game.i18n.format("DRPG.Sound.groupAssigned", {
        n: keys.filter(key => soundFor(key)).length,
        total: keys.length
    });
}

/** "12 of 35 events have a file." - the empty state, said as a number. */
function countLine() {
    const keys = Object.keys(SFX_EVENTS);
    return plural("DRPG.Sound.assigned", {
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
/**
 * Every `[data-drpg-slider]` under `root` wired: its range writes its volume as it moves (`setSfxVolume`), its output
 * follows. The Sound window's (below) and the settings window's Sound section's (E49 A1d) - the one writer of both.
 */
export function wireVolumeSliders(root) {
    for (const label of root.querySelectorAll("[data-drpg-slider]")) {
        const key = label.dataset.drpgSlider;
        const input = label.querySelector("input[type=range]");
        const out = label.querySelector("output");
        if (!input) continue;

        input.addEventListener("input", () => {
            const percent = Number(input.value);
            if (out) out.textContent = `${percent}%`;
            setSfxVolume(key, sliderToVolume(key, percent / 100))
                .then(refreshSoundLauncher)
                .catch(err => error(`Could not set the ${key} volume`, err));
        });
    }
}

export function wireSoundPanel(root) {
    /* ---- volumes ---------------------------------------------------- */
    wireVolumeSliders(root);

    /* ---- the messenger's sounds -------------------------------------- */
    const messengerBox = root.querySelector('input[name="messengerSound"]');
    messengerBox?.addEventListener("change", () => {
        setSetting(SETTINGS.messengerSound, messengerBox.checked)
            .catch(err => error("Could not change the messenger sounds", err));
    });

    /* ---- the mapping table ------------------------------------------ */
    const counter = root.querySelector("[data-drpg-sfx-count]");
    const recount = () => {
        if (counter) counter.textContent = countLine();
        for (const group of root.querySelectorAll("[data-drpg-sfx-group-count]")) {
            group.textContent = groupCountLine(group.dataset.drpgSfxGroupCount);
        }
    };

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
            ui.notifications.warn(game.i18n.format("DRPG.Sound.testFailed", { label: SFX_EVENTS[key]?.label ?? key, why: result?.why ?? "" }));
        });

        row.querySelector("[data-drpg-sfx-clear]")?.addEventListener("click", () => write(null));
    }
}
