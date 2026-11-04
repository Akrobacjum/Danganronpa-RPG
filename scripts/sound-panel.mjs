/**
 * Danganronpa RPG - the Sound window.
 * ---------------------------------------------------------------------------
 * The window a GM maps the music in, plays a cue from and sets the volumes
 * in, and the one a player gets with the sliders alone
 * (`openPlayerSoundDialog`): the Music tab's rows (`musicMapRows`), each saving
 * as it is changed with its marker (`SAVE_STATE_KEYS`, `showSaveState`,
 * `wireMusicMap`), the Play tab built on every redraw (`soundPlayPane`,
 * `soundPlaylistsPane`, `trackOptions`, `wireSoundPlay`), the window's own
 * wiring (`wireSoundDialog`) and `openSoundDialog`.
 *
 * WHERE IT SITS. The window's music side moved out of music.mjs by E41 C9a
 * (1.2.97), a pure move that `node tools/moved-only.mjs` proves line by line;
 * music.mjs re-exports the two names here it exported before
 * (`musicMapRows`, `openSoundDialog`). Its sfx side - the sliders, the Effects
 * tab and the launcher by the chat, from `LAUNCHER_ID` to `wireSoundPanel` -
 * stays in sfx.mjs, and `openSoundDialog` takes those panes from it by
 * `import("./sfx.mjs")`: moved here (E41 C9b, built on a scratch copy and not
 * committed), they made sfx.mjs import this file, and this file reaches
 * sfx.mjs through music-states.mjs, clock.mjs and actions.mjs - a static
 * import cycle in which the module did not boot. E41-16 is carried to E73,
 * which writes its sfx rows here. It reads the states and the map from
 * music-states.mjs and the engine's Play and Reset from music-play.mjs; it
 * imports music.mjs by no road (the facade rule, .claude/rules/code.md).
 */

import { SITUATIONAL_PLAYLIST } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { error } from "./utils.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";
import { MUSIC_STATES, musicMap, isCuePlaylist, saveMusicKey } from "./music-states.mjs";
import { situationalPlaylist, playTrack, resetMusic } from "./music-play.mjs";

/* ==========================================================================
 * GM SCREEN
 * ========================================================================== */

/** Map each state to one of the world's playlists. */
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
async function openPlayerSoundDialog({ tableDialog, dialogContent, soundSlidersHtml, wireSoundPanel }) {
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
}

/**
 * One row per music state: its label, a select of the world's playlists, and the row's marker.
 *
 * Not the cue playlist (E50 C3; S11-47): it is the Play tab's source, never a state's (`playlistFor`). The marker
 * (`data-drpg-save`, empty until the row is changed) says saving, saved or failed, read aloud as it changes. It
 * carries its state's key (`data-drpg-key`, E44 C2b): the rows are a live region, and a redraw finds the marker of a
 * save in flight by it - live.mjs carries its state across, and `showSaveState` writes to the one drawn now.
 */
export function musicMapRows(playlists) {
    const map = musicMap();
    const offered = playlists.filter(p => !isCuePlaylist(p));
    return MUSIC_STATES.map(state => {
        const label = state.label ?? game.i18n.localize(state.labelKey);
        const options = [`<option value="">-</option>`, ...offered.map(p =>
            `<option value="${p.id}"${map[state.key] === p.id ? " selected" : ""}>${
                foundry.utils.escapeHTML(p.name)}</option>`)].join("");

        return `<tr>
            <td>${foundry.utils.escapeHTML(label)}</td>
            <td><select name="state:${state.key}"
                aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Music.playlist")}: ${label}`)}">${options}</select>
                <span class="notes drpg-music-save" data-drpg-save="" data-drpg-key="${foundry.utils.escapeHTML(state.key)}" aria-live="polite"></span></td>
        </tr>`;
    }).join("");
}

// Three tabs, Play first (Dawid, 26.08): the cue controls a GM reaches
// for mid-scene, then the state-to-playlist mapping they set up once, then
// the sound-effect files. Every one of them acts or saves at once (E50 C3,
// D45): there is no Apply.
/*
 * THE CUE PANE IS BUILT, NOT BAKED (F17, 20.09).
 *
 * This was built once, from a cue playlist read when the window opened, so a
 * track dragged into the cue playlist in the Playlists sidebar - which is
 * exactly what a GM does next, with this window still open beside it - did not
 * appear in the picker until the window was closed and opened again. The
 * picker went on saying "this playlist has no tracks" over a playlist that had
 * some. It takes no arguments now and reads the playlist itself, which is what
 * lets `keepLive` in `openSoundDialog` call it again on every playlist change.
 *
 * THREE STATES, because there are three: no cue playlist, one that is empty,
 * and one with tracks in it. The middle one used to exist only as a sentence
 * the make-cue handler wrote into the DOM by hand; now it is a state the
 * builder can reach on its own, which is what lets that hand-written DOM
 * surgery go.
 */
function soundPlayPane() {
    // The cue playlist, if the world has one. Its absence is not an error -
    // the state-to-playlist table is the other half of this window and works
    // perfectly well without it - so it is reported in place rather than
    // refused at the door.
    const cue = situationalPlaylist();
    // An empty cue playlist is the same to this button as a missing one.
    const playable = Boolean(cue?.sounds.size);
    return `
            <fieldset class="drpg-music-now">
                <legend>${game.i18n.localize("DRPG.Music.playNow")}</legend>
                <p class="notes">${game.i18n.format("DRPG.Music.playNowNote",
                    { name: SITUATIONAL_PLAYLIST })}</p>
                ${cue
                    ? `${playable ? "" : `<p class="notes" data-drpg-no-cue>${
                        game.i18n.format("DRPG.Music.situationalMade", { name: foundry.utils.escapeHTML(cue.name) })}</p>`}
                    <label>${game.i18n.localize("DRPG.Music.track")}
                    <select name="playTrack" data-drpg-enter="[data-drpg-play]"
                        >${trackOptions(cue)}</select></label>`
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
                    // one - which the rebuild on `createPlaylist` now does by itself.
                    : `<p class="notes drpg-warning" data-drpg-no-cue>${game.i18n.format(
                        "DRPG.Music.noSituational", { name: SITUATIONAL_PLAYLIST })}</p>
                    <button type="button" class="drpg-mini-button" data-drpg-make-cue>${
                        game.i18n.format("DRPG.Music.makeSituational",
                            { name: SITUATIONAL_PLAYLIST })}</button>`}
                <button type="button" class="drpg-mini-button" data-drpg-play${
                    playable ? "" : " disabled"}>${
                    game.i18n.localize("DRPG.Music.play")}</button>
                <button type="button" class="drpg-mini-button" data-drpg-reset-music>${
                    game.i18n.localize("DRPG.Music.reset")}</button>
            </fieldset>`;
}

/** The mapping tab: the intro, the warnings, and the state-to-playlist table. */
function soundPlaylistsPane(playlists, rows) {
    return `
            <p>${game.i18n.localize("DRPG.Music.intro")}</p>
            ${playlists.length ? "" : `<p class="notes drpg-warning">${
                game.i18n.localize("DRPG.Music.noPlaylists")}</p>`}
            <p class="notes">${game.i18n.localize("DRPG.Music.orderNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Music.trialNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Music.incidentNote")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Music.when")}</th>
                <th>${game.i18n.localize("DRPG.Music.playlist")}</th>
            </tr></thead><tbody class="drpg-music-map">${rows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Music.fadeNote")}</p>`;
}

/** A row's marker: its state as a data attribute and as words a screen reader is told. */
const SAVE_STATE_KEYS = Object.freeze({
    saving: "DRPG.Music.saveState.saving", saved: "DRPG.Music.saveState.saved", failed: "DRPG.Music.saveState.failed"
});

/* The marker of `key` as the window draws it NOW, found by its key (E44 C2b): the save's answer can arrive after
   its own echo redrew the rows, and the row the select was in is then gone. */
function showSaveState(frame, key, state) {
    const marker = [...(frame?.querySelectorAll?.("[data-drpg-save]") ?? [])].find(m => m.dataset.drpgKey === key);
    if (!marker) return;
    marker.dataset.drpgSave = state;
    marker.textContent = game.i18n.localize(SAVE_STATE_KEYS[state]);
}

/**
 * Each mapping select saves its row as it is changed. `root` holds the selects to wire (the window, or the rows
 * drawn again); `frame` is the window, where the row's marker is looked for when the answer comes.
 */
function wireMusicMap(root, frame = root) {
    for (const select of root.querySelectorAll("select[name^='state:']")) {
        const key = select.name.slice("state:".length);
        select.addEventListener("change", () => {
            saveMusicKey(key, select.value, { onState: state => showSaveState(frame, key, state) });
        });
    }
}

/* The world's playlists as the window lists them: by name. */
const sortedPlaylists = () => Array.from(game.playlists).sort((a, b) => a.name.localeCompare(b.name));

/* The Music tab's rows, drawn again as the live region's build (E44 C2b). A node, not markup: a `<tbody>` written
   into a `<div>` (live.mjs `toElement`) is dropped by the parser. */
function musicMapBody() {
    const body = document.createElement("tbody");
    body.className = "drpg-music-map";
    body.innerHTML = musicMapRows(sortedPlaylists());
    return body;
}

/*
 * THE CUE PANE'S LISTENERS, REWIRED AFTER EVERY REDRAW (F17).
 *
 * `keepLive` replaces the fieldset's nodes, and a listener goes with the
 * button it was on - the same reason the Mastermind window's give-Hope
 * row has its own `wireGive`. So this is called once from `wireSoundDialog`
 * and again as the live region's `after`. The track select is read INSIDE the
 * handler rather than captured beside it, so a redraw between opening
 * the window and pressing Play cannot leave this pointing at a detached
 * node or at a sound that has since been deleted.
 */
function wireSoundPlay(root) {
    root.querySelector("[data-drpg-play]")?.addEventListener("click", async () => {
        const sound = await playTrack(root.querySelector("[name=playTrack]")?.value);
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
     * Make the cue playlist. The fieldset swaps itself over: `soundPlayPane`
     * has a state for "made but empty", and `createPlaylist` is one of the
     * hooks the live region wakes on, so there is nothing left for this
     * handler to do to the DOM.
     *
     * NOT BY REOPENING THE WINDOW, which is the obvious way and the wrong
     * one: it would draw again the window the GM is working in, with the
     * Music tab's markers and the tab they were on gone.
     *
     * The Play button stays disabled, because a playlist made this second
     * has no tracks in it and a button that says it will play something is
     * lying until the GM has put something there.
     */
    root.querySelector("[data-drpg-make-cue]")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const made = situationalPlaylist()
                ?? await Playlist.create({ name: SITUATIONAL_PLAYLIST });
            if (!made) throw new Error("Playlist.create returned nothing");
            ui.notifications.info(game.i18n.format("DRPG.Music.situationalMade",
                { name: made.name }));
        } catch (err) {
            button.disabled = false;
            error("Could not create the cue playlist", err);
            ui.notifications.error(game.i18n.localize("DRPG.Music.makeFailed"));
        }
    });
}

/** Every tab acts or saves at once and the window stays open: one Close, and no Apply anywhere. */
function wireSoundDialog(root, { wirePanelTabs, wireSoundPanel }) {
    /*
     * NO APPLY (E50 C3; D45 option 1). The Music tab was the one thing in this window that waited for a button,
     * beside a Play tab that acts where it is and an Effects tab that saves as it is touched - one window, two ways
     * of saving, and a GM who changed a mapping and pressed Close lost it. The mapping saves as it is changed now
     * (`saveMusicKey`), so every tab has the same footer: Close.
     */
    wirePanelTabs(root, {
        buttons: { play: [], music: [], effects: [] },
        always: ["close"]
    });
    wireSoundPanel(root);
    wireSoundPlay(root);
    wireMusicMap(root, root);
}

export async function openSoundDialog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-sound")) return null;

    const { dialogContent, tableDialog, panelTabs, wirePanelTabs } = await import("./utils.mjs");
    const { soundSlidersHtml, soundEffectsHtml, wireSoundPanel } = await import("./sfx.mjs");

    if (!game.user.isGM) {
        await openPlayerSoundDialog({ tableDialog, dialogContent, soundSlidersHtml, wireSoundPanel });
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
    const playlists = sortedPlaylists();

    const rows = musicMapRows(playlists);

    // The cue pane reads its own playlist, because it is built again on every
    // playlist change (`soundPlayPane`, and the live region in `render` below).
    // The mapping's warning counts what it can offer, which is never the cue playlist.
    const playlistsPane = soundPlaylistsPane(playlists.filter(p => !isCuePlaylist(p)), rows);

    await tableDialog({
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
            ${document.body.classList.contains("drpg-theme-stained-glass") ? "" : soundSlidersHtml()}
            ${panelTabs([
                { key: "play", label: game.i18n.localize("DRPG.Sound.tabPlay"), html: soundPlayPane() },
                { key: "music", label: game.i18n.localize("DRPG.Sound.tabMusic"), html: playlistsPane },
                { key: "effects", label: game.i18n.localize("DRPG.Sound.tabEffects"),
                  html: soundEffectsHtml() }
            ])}
        </form>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        // Every control acts at once and the window stays open, like the Monocub
        // manager's "give Hope": a GM putting a track under a moment at the
        // table is not filling in a form.
        render: (event, dialog) => {
            wireSoundDialog(dialog.element, { wirePanelTabs, wireSoundPanel });
            /*
             * WHAT WAKES IT: THE PLAYLIST HOOKS (F17).
             *
             * Nothing this pane prints is in a setting, and the tracks it lists are
             * documents - so the hooks are named here rather than relying on the
             * world hooks `keepLive` always adds. `settings: []` is an empty array,
             * which is TRUTHY, so live.mjs's filter rejects every module setting key:
             * this pane has no reason to redraw because a preference was saved. The
             * two world hooks still fire and are harmless. `after` puts the pane's
             * three listeners back on the nodes the redraw just made.
             */
            keepLive(dialog, {
                region: ".drpg-music-now",
                build: soundPlayPane,
                watch: {
                    settings: [],
                    hooks: ["createPlaylistSound", "deletePlaylistSound", "updatePlaylistSound",
                        "createPlaylist", "deletePlaylist", "updatePlaylist"]
                },
                after: () => wireSoundPlay(dialog.element)
            });
            /*
             * THE MUSIC ROWS FOLLOW ANOTHER GM'S MAPPING (E44 C2b, 04.11.2026; the 27.10 amend: "keepLive for settings
             * is E44's", E50's STAGE). With the window open on two GMs, one's mapping left the other's select drawn
             * with the old playlist - true only until it was read. The rows are a region of their own, woken by the
             * map's key alone: another key of the module, the Effects tab's `sfxMap` among them, redraws nothing here.
             * A select being chosen from holds the redraw (rule 1); a dirty select and a row's save marker are
             * carried across (rule 2); `after` wires the new selects, whose answer finds its marker in the window.
             */
            keepLive(dialog, {
                region: ".drpg-music-map",
                build: musicMapBody,
                watch: { settings: [SETTINGS.musicMap] },
                after: next => wireMusicMap(next, dialog.element)
            });
        },
        rejectClose: false
    });
    // Nothing to do on the way out: each change was saved as it was made, and the primary follows the map's writes
    // (`scheduleMapRefresh`), whichever GM made them.
    return null;
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
