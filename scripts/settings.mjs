/**
 * Danganronpa RPG — world settings.
 * ---------------------------------------------------------------------------
 * Registered during `init`. Anything the GM should be able to flip lives here
 * with `config: true`; internal state is stored with `config: false` so it
 * never clutters the settings window.
 */

import { MODULE_ID, ROOMS, TIMES_OF_DAY } from "./config.mjs";

/** Setting keys, so nothing else in the module has to spell them out. */
export const SETTINGS = {
    forcePrivateRolls: "forcePrivateRolls",
    enforceAnonymity: "enforceAnonymity",
    searchTokensPerRoom: "searchTokensPerRoom",
    searchTokens: "searchTokens",
    clock: "clock",
    despairPools: "despairPools",
    gmAssignments: "gmAssignments",
    despairFromRolls: "despairFromRolls",
    projectMeta: "projectMeta",
    chargeMovement: "chargeMovement",
    lockPlayerResources: "lockPlayerResources",
    roomVisibility: "roomVisibility",
    lockRollDialog: "lockRollDialog",
    eclipseMoves: "eclipseMoves",
    roomStash: "roomStash",
    sealedRooms: "sealedRooms",
    hideSystemFear: "hideSystemFear",
    pixelFont: "pixelFont",
    debug: "debug"
};

/** Shape of the campaign clock stored under SETTINGS.clock. */
export const DEFAULT_CLOCK = {
    /**
     * True while the placement window between two times of day is running.
     * An Eclipse is not part of a day — the day counter does not move for it.
     */
    eclipse: false,
    /** Free text shown at the top of the HUD, e.g. "Hope's Peak: Drowned Summer". */
    campaignName: "",
    season: 1,
    chapter: 1,
    session: 1,
    /** In-fiction day. Five times of day make one day; ticks over automatically. */
    day: 1,
    /** One of the keys in PHASES: dailyLife | investigation | classTrial. */
    phase: "dailyLife",
    timeOfDay: TIMES_OF_DAY[0]
};

export function registerSettings() {
    game.settings.register(MODULE_ID, SETTINGS.forcePrivateRolls, {
        name: "DRPG.Settings.forcePrivateRolls.name",
        hint: "DRPG.Settings.forcePrivateRolls.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.enforceAnonymity, {
        name: "DRPG.Settings.enforceAnonymity.name",
        hint: "DRPG.Settings.enforceAnonymity.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.searchTokensPerRoom, {
        name: "DRPG.Settings.searchTokensPerRoom.name",
        hint: "DRPG.Settings.searchTokensPerRoom.hint",
        scope: "world",
        config: true,
        type: Number,
        default: ROOMS.searchTokensPerRoom,
        range: { min: 0, max: 10, step: 1 }
    });

    game.settings.register(MODULE_ID, SETTINGS.hideSystemFear, {
        name: "DRPG.Settings.hideSystemFear.name",
        hint: "DRPG.Settings.hideSystemFear.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => document.body.classList.toggle("drpg-hide-system-fear", getSetting(SETTINGS.hideSystemFear))
    });

    game.settings.register(MODULE_ID, SETTINGS.pixelFont, {
        name: "DRPG.Settings.pixelFont.name",
        hint: "DRPG.Settings.pixelFont.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => document.body.classList.toggle("drpg-pixel-font", getSetting(SETTINGS.pixelFont))
    });

    game.settings.register(MODULE_ID, SETTINGS.debug, {
        name: "DRPG.Settings.debug.name",
        hint: "DRPG.Settings.debug.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false
    });

    /* ---- internal state, never shown in the settings window ---- */

    game.settings.register(MODULE_ID, SETTINGS.despairFromRolls, {
        name: "DRPG.Settings.despairFromRolls.name",
        hint: "DRPG.Settings.despairFromRolls.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.lockRollDialog, {
        name: "DRPG.Settings.lockRollDialog.name",
        hint: "DRPG.Settings.lockRollDialog.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.roomVisibility, {
        name: "DRPG.Settings.roomVisibility.name",
        hint: "DRPG.Settings.roomVisibility.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            import("./visibility.mjs").then(m => m.applyAll()).catch(() => {});
        }
    });

    game.settings.register(MODULE_ID, SETTINGS.lockPlayerResources, {
        name: "DRPG.Settings.lockPlayerResources.name",
        hint: "DRPG.Settings.lockPlayerResources.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.chargeMovement, {
        name: "DRPG.Settings.chargeMovement.name",
        hint: "DRPG.Settings.chargeMovement.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    // Rooms sealed by "Behind Closed Doors". Cleared when the clock advances.
    game.settings.register(MODULE_ID, SETTINGS.sealedRooms, {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    // Eclipse crossings used, per actor. Cleared when the Eclipse ends.
    game.settings.register(MODULE_ID, SETTINGS.eclipseMoves, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Each character's Room Stash: { "<actorId>": [ {name, category, tier}, … ] }
    game.settings.register(MODULE_ID, SETTINGS.roomStash, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Per-project data Daggerheart's countdowns do not carry: which room the
    // project belongs to, whether it is an indirect murder, whether it is secret.
    game.settings.register(MODULE_ID, SETTINGS.projectMeta, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Which Monokuma looks after which student. Format: { "<actorId>": "<userId>" }
    game.settings.register(MODULE_ID, SETTINGS.gmAssignments, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => {
            import("./despair.mjs").then(m => m.renderDespair()).catch(() => {});
        }
    });

    // One Despair pool per full Gamemaster. Format: { "<userId>": 7 }
    game.settings.register(MODULE_ID, SETTINGS.despairPools, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => {
            import("./despair.mjs").then(m => m.renderDespair()).catch(() => {});
        }
    });

    // Search token counters, keyed by room. Format: { "Library": 2, "Kitchen": 0 }
    game.settings.register(MODULE_ID, SETTINGS.searchTokens, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Where we are in the campaign. Advanced from the GM panel.
    game.settings.register(MODULE_ID, SETTINGS.clock, {
        scope: "world",
        config: false,
        type: Object,
        default: DEFAULT_CLOCK,
        // Every client redraws its sheets, so the time of day in the header
        // never goes stale on a player's screen.
        onChange: () => {
            import("./clock.mjs").then(m => m.refreshSheets()).catch(() => {});
        }
    });
}

/** Convenience reader. */
export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

/** Convenience writer. GM-only for world-scoped settings. */
export function setSetting(key, value) {
    return game.settings.set(MODULE_ID, key, value);
}
