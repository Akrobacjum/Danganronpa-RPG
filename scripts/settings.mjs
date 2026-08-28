/**
 * Danganronpa RPG — world settings.
 * ---------------------------------------------------------------------------
 * Registered during `init`. Anything the GM should be able to flip lives here
 * with `config: true`; internal state is stored with `config: false` so it
 * never clutters the settings window.
 */

import { MODULE_ID, ROOMS, TIMES_OF_DAY, SFX_VOLUME_KEYS } from "./config.mjs";

/** Setting keys, so nothing else in the module has to spell them out. */
export const SETTINGS = {
    forcePrivateRolls: "forcePrivateRolls",
    enforceAnonymity: "enforceAnonymity",
    searchTokensPerRoom: "searchTokensPerRoom",
    searchTokens: "searchTokens",
    clock: "clock",
    despairPools: "despairPools",
    /** Custom display label per pool, independent of the account name. */
    poolNames: "poolNames",
    /** Assistant GMs explicitly granted their own Despair pool. */
    extraPoolUsers: "extraPoolUsers",
    /** Which Gamemaster's pool each Monokuma actor spends from. */
    monokumaPools: "monokumaPools",
    gmAssignments: "gmAssignments",
    despairFromRolls: "despairFromRolls",
    projectMeta: "projectMeta",
    chargeMovement: "chargeMovement",
    lockPlayerResources: "lockPlayerResources",
    roomVisibility: "roomVisibility",
    lockRollDialog: "lockRollDialog",
    eclipseMoves: "eclipseMoves",
    sealedRooms: "sealedRooms",
    /** Per-player Despair Call restrictions, cleared with the clock. */
    restrictions: "restrictions",
    hideSystemFear: "hideSystemFear",
    pixelFont: "pixelFont",
    projectsCollapsed: "projectsCollapsed",
    debug: "debug",
    /** Regions become LiveKit breakout rooms — off by default, needs avclient-livekit. */
    voiceEnabled: "voiceEnabled",
    /** The playlist follows the game state — off by default, needs playlists. */
    musicEnabled: "musicEnabled",
    /** Which playlist each state uses: `{ stateKey: playlistId }`. */
    musicMap: "musicMap",
    /**
     * Which file each sound event plays: `{ eventKey: "path/to/file.ogg" }`.
     *
     * World-scoped, exactly like `musicMap` and for the same reason: which
     * sound means what is one fact about the table. A player who mapped their
     * own files would be playing a different game from everybody else — the
     * door they heard open would not be the door anyone else heard.
     *
     * The module ships no audio and is not going to: the files are the GM's,
     * the same bargain the playlists already make. An event with no file is
     * SILENT, not broken, and the panel says "not assigned yet" rather than
     * showing an error — see the empty-state note in the 1.2.0 plan.
     */
    sfxMap: "sfxMap",
    /**
     * Bend varied sounds a little on each play, or play them exactly as mapped.
     *
     * World-scoped and GM-owned, like the mapping it modifies and unlike the
     * volumes: this is a property of the sound design rather than of one
     * person's speakers. One switch rather than a slider, because the size of
     * the bend is `SFX_VARIATION` and tuned once — what a table needs is a way
     * to say "our files do not like this", in one place, in one click.
     */
    sfxVary: "sfxVary",
    /**
     * How loud this module is on THIS browser: `{ sound }`, 0–1.
     *
     * Client-scoped, because volume is the one thing about sound that is
     * genuinely personal — a GM on headphones and a player on laptop speakers
     * do not want the same numbers, and neither should be setting the other's.
     * It is also the only part of the Sound panel a player sees at all.
     *
     * Sliders, not switches: zero is silence, so a switch would be a poorer
     * version of the same control with a worse bottom end.
     *
     * ONE number, not one per category. The panel shows two sliders and the
     * second is `music`, deliberately absent from this object: it is a proxy
     * for Foundry's `globalPlaylistVolume` — see `SFX_SLIDERS`.
     */
    sfxVolumes: "sfxVolumes",
    /**
     * The word that stops the scene — Player Handbook, ch. 13.
     *
     * A setting rather than a constant because the word belongs to the table,
     * not to the module: a group playing in another language, or one for whom
     * the default lands wrong, has to be able to change it without touching
     * code. Edited in Season setup, next to the campaign name, because that is
     * where a table sets up the things that are true for a whole season.
     *
     * Default "Safe Word". Worlds that predate this setting keep MISIUBOMBO,
     * which is the word their players have already been taught — see the
     * migration. Changing it must redraw the sheets, or the button goes on
     * showing the old word until somebody reopens their character.
     */
    safeword: "safeword",
    /**
     * The module version whose data migration this world has already run.
     *
     * Empty in a world that has never run one. Compared against the manifest
     * version, not against a hardcoded target: when they differ the migration
     * runs, and it stamps only when every clause has been through. That is
     * deliberately looser than a "has 1.2.0 run yet" boolean would be, and the
     * looseness is the point — during the test builds this update ships a new
     * clause every stage, and a world stamped once at the first build would
     * never see any of the later ones. Every clause is idempotent, so running
     * the whole set again on each bump costs a handful of reads and heals a
     * world that was upgraded halfway.
     */
    migratedVersion: "migratedVersion",
    /** Per-client: the last time each messenger thread was read, by player user id. */
    messengerLastRead: "messengerLastRead",
    /** Per-client: remembered position/size of each messenger window, by player user id. */
    messengerWindowPositions: "messengerWindowPositions",
    /**
     * What each Truth Bullet REALLY is, by item uuid. GM browsers only.
     *
     * Deliberately client-scoped. Foundry's server hands every connecting client
     * the entire world database — `World##g()` calls `dump()` on ChatMessage,
     * Setting, Actor, Item and JournalEntry with no user and no filter, and
     * compendium reads check ownership only on create/update/delete. So there is
     * no world-scoped hiding place: a world setting, a GM-only whisper and a
     * GM-only compendium all arrive in the player's browser just the same.
     *
     * A client-scoped setting never enters world data at all, and the GM-to-GM
     * sync in truth-bullets.mjs rides a socket the server addresses to named
     * recipients. Cost of the choice: it lives in browser storage, so it is
     * synced across every GM and can be exported — see `exportLedger()`.
     */
    truthBulletSecrets: "truthBulletSecrets",
    /**
     * What every Remnant on the maps really is: its type, how hard it is to
     * spot, who left it, and the GM's note about it.
     *
     * CLIENT-SCOPED, ON GM BROWSERS, for the same reason as `truthBulletSecrets`
     * and measured the same way. This used to live in flags on the token — and
     * Foundry ships every token on a scene to every client, hidden or not, flags
     * and all. A player's console could enumerate all forty traces on the map
     * with `sourceName`, `tiedToCrime`, the visibility band and the GM's own
     * sentence: the whole investigation, for free, and with no way for the GM to
     * know it had happened.
     *
     * Keyed `sceneId.tokenId`. Synced GM-to-GM over a recipient-addressed
     * socket, the same as the Truth Bullet ledger.
     */
    remnantSecrets: "remnantSecrets",
    /*
     * WHICH ITEM IS THE TRAP, AND WHAT IS WAITING IN WHICH ROOM.
     *
     * CLIENT-SCOPED, on the GM's browser, for the same reason `remnantSecrets`
     * is: a world setting reaches every client and a player can read every one
     * of them from their own console. An item on a character sheet is readable
     * by its owner, so a flag saying "this is the trap" would be a poisoned
     * first aid kit with POISONED written on it — see the header of traps.mjs.
     *
     * `trapLedger` maps the opaque `drpgItemId` every module item carries to
     * the project that poisoned it. The identity is on everything in everybody's
     * bag, which makes it a name rather than a mark; which names are poisoned is
     * only ever here.
     */
    trapLedger: "trapLedger",
    trapPlants: "trapPlants",
    /**
     * The GM's plan for this murder's five Key Remnants.
     *
     * World-scoped and therefore readable by a curious player (see D6), which
     * is fine: the plan is a list of what the GM INTENDS to make findable, and
     * the players are meant to find all of it. The Key Remnants themselves are
     * placed on the map and priced the cheapest of any type precisely so the
     * case stays solvable.
     */
    keyRemnantPlan: "keyRemnantPlan",
    /** Monokuma's standing rules — see rules.mjs. Public by design. */
    killingGameRules: "killingGameRules",
    /**
     * The motive Monokuma is running right now, or `{}`.
     *
     * Guide, p. 16: "Motyw musi być ogłaszany publicznie i trwać maksymalnie do
     * końca rozdziału." Public by design, exactly like the rules — a motive
     * nobody heard is not a motive — and chapter-stamped so it lapses on its
     * own when the chapter counter moves, the same trick `silencedChapter` uses.
     *
     * Shape since E14: `{ text, consequence, timesOfDay, remaining, chapter,
     * at, dueAnnounced }`. The countdown sits INSIDE the chapter stamp rather
     * than replacing it — the guide's outer bound still holds, and the timer
     * is how a motive ends early. See rules.mjs.
     */
    motive: "motive",
    /**
     * The assembly Monokuma has called but not yet held, or `{}`.
     *
     * Shape: `{ room, by, chapter, session, timeOfDay, at }` — the time of day
     * it was BOUGHT in, which is how the clock knows the order is ripe.
     *
     * World-scoped and public on purpose, and this one is not a leak but the
     * mechanic: Public Announcement is now a summons the cast has a whole time
     * of day to react to, and reacting requires knowing. Everybody is told in
     * chat when it is called, and the HUD carries the room until it happens.
     */
    pendingGather: "pendingGather",
    /**
     * The murder currently in progress, or `{}`.
     *
     * World-scoped, and that is a real exposure: a player reading the console
     * could learn who the killer is (see D6 — nothing world-scoped is hidden).
     * Accepted deliberately, because the alternative is worse. An incident is a
     * turn-based exchange between two players who both have to see whose turn
     * it is, how much the victim has left, and which of their actions are
     * blocked this turn. Hiding that on the GM's browser would mean a socket
     * round trip per turn per participant, and a table sitting in silence
     * waiting for it. The state is only live during an incident, everyone at
     * the table knows an incident is happening, and the identity is about to
     * come out anyway.
     */
    murderState: "murderState",
    pendingMurders: "pendingMurders",
    /**
     * Who has killed in THIS chapter, in the order they did it.
     *
     * The incident state is wiped when a murder closes, so until this existed
     * nothing in the world remembered who the Blackened was — and the verdict
     * screen asked a GM to type it in from memory, an hour and two scenes after
     * the engine had known it exactly. A chapter with two incidents, which the
     * betrayal rule makes ordinary, meant remembering two.
     *
     * GM-visible data by nature: it names the killer. It is world-scoped
     * because every GM screen that reads it has to agree, and world settings
     * reach every client — so nothing here is shown to players. See the note in
     * `openVerdictDialog`.
     */
    blackened: "blackened",
    /**
     * The speaking queue during a Class Trial: who has the floor and since when.
     *
     * World-scoped for the same reason as `murderState` — every player has to
     * see the same countdown, and a shared clock cannot live on one browser.
     * Nothing secret is in it. **Votes are not here**: they travel by
     * recipient-addressed socket and are tallied in memory, because "wyniki są
     * jawne, ale głosy - nie" and world data is not private (D6).
     */
    trialQueue: "trialQueue",
    /**
     * How far through the trial the table has got: `{ chapter, seconds,
     * voteClosed, verdictApplied }`.
     *
     * Separate from `trialQueue` because it outlives it. The floor is closed
     * and reopened several times in a trial and cleared entirely when the
     * debate ends; whether the vote has been counted is a fact about the whole
     * trial, and the one thing the verdict button has to know before it lets
     * anybody press it.
     *
     * Chapter-stamped rather than explicitly cleared. A record from an earlier
     * chapter is read as "none of this has happened", so a table that forgets
     * to reset — or a GM who nudges the chapter by hand — gets a fresh trial
     * rather than one that believes its vote was counted last week.
     *
     * Nothing secret: it is three booleans about whether a screen has been
     * opened. The votes themselves never enter world data at all (see vote.mjs).
     */
    trialProgress: "trialProgress",
    /**
     * Who the Mastermind is, on GM browsers only.
     *
     * The single most important secret in the game, so it gets the strictest
     * version of the D6 treatment — not even an actor flag. An actor flag is
     * world data, and Foundry ships every actor to every client (see the note
     * on `truthBulletSecrets`); the Mastermind's own player reading their own
     * flag might be harmless, but every OTHER player reading it from the
     * console would end the game before it started. So this lives in browser
     * storage on GM clients, synced GM-to-GM over a recipient-addressed socket,
     * exactly like the Truth Bullet ledger — a player's client never receives
     * it, full stop.
     */
    mastermind: "mastermind",
    /**
     * "Is THIS browser the Mastermind's player." Client-scoped, boolean, and
     * the only thing about the Mastermind that ever reaches a player's client
     * at all — see mastermind.mjs's `notifyDoorAccess`.
     *
     * Exists because `canCross()` in movement.mjs runs synchronously inside a
     * `preUpdateToken` veto, on the client dragging the token — there is no
     * chance to ask a GM mid-hook, and `isMastermind()` itself always answers
     * `false` off a GM client by construction. A GM setting the Mastermind
     * privately tells the ONE player who already knows they hold the part —
     * the guide has them agree to it before the season starts — and that
     * client alone writes `true` here. Every other client's copy stays `false`
     * forever; there is no broadcast, only a recipient-addressed whisper.
     *
     * Read by movement.mjs (locked doors, sealed rooms), fog.mjs (the
     * Mastermind knows the building, not who is in it), vault.mjs (a
     * concealed stash is their own furniture) and — since 26.08 —
     * visibility.mjs, but only through `myLairRoom()`: standing in their own
     * room shows them the cast, anywhere else they are exactly as blind as
     * every other player's client.
     */
    iAmMastermind: "iAmMastermind",
    /**
     * The Mastermind's own room, on the ONE client that holds the part —
     * delivered over the same recipient-addressed whisper as `iAmMastermind`
     * and cleared with it. Every other client's copy stays empty forever.
     *
     * Read by visibility.mjs: a Mastermind whose own token stands in this
     * room sees the whole cast, the way the GM does, and loses that the
     * moment they leave. (This is the 26.08 revision of the old contract —
     * the note on `iAmMastermind` used to promise visibility.mjs would never
     * read either of these.)
     */
    myMastermindLair: "myMastermindLair",
    /**
     * While `isometric-perspective` is active, keep its fingers out of token
     * configuration windows — see iso-shield.mjs for what exactly is parked
     * and why. World-scoped: the glitch it guards against hits whoever edits
     * tokens, and that is a table-level decision, not a per-browser one.
     */
    isoTokenShield: "isoTokenShield",
    /**
     * Which rooms each character has personally discovered, per scene:
     * `{ [sceneId]: { [actorId]: [roomName, ...] } }`.
     *
     * World-scoped. This is not a secret the way the Mastermind's identity is
     * — a discovered room is a fact about where the party has already been,
     * not about who anybody is — so it travels the ordinary way, like
     * `sealedRooms`. Written only by the primary GM (see fog.mjs), the same
     * discipline `truth-bullets.mjs` uses for its own ledger writes.
     */
    discoveredRooms: "discoveredRooms",
    /**
     * Rooms, not sight lines, decide what a player can see.
     *
     * Turning this on makes the module's own region fog the ONLY thing hiding
     * any part of the map, by switching off Foundry's per-token vision and its
     * own fog exploration on the scene (see `applySceneVisionMode` in
     * fog.mjs). That is not a cosmetic preference: leaving Foundry's vision on
     * alongside the region fog is what produces cone-shaped light wedges that
     * reveal half a room through a doorway — the exact thing the guide's room
     * model exists to prevent.
     *
     * Off leaves the scene exactly as the GM configured it and disables the
     * region fog entirely, for a table that would rather use Foundry's walls
     * and vision as they come.
     */
    regionFog: "regionFog"
};

/**
 * The word a table gets if it never chooses one.
 *
 * Plain English on purpose. The module is published for tables that have never
 * met this group's in-jokes, and a safeword nobody can guess the meaning of is
 * a safeword somebody hesitates over for a second — which is exactly the second
 * it exists to remove. Tables that want their own word set it in Season setup.
 */
export const DEFAULT_SAFEWORD = "Safe Word";

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
    timeOfDay: TIMES_OF_DAY[0],
    /**
     * When the current time of day started, as `Date.now()`. Drives the HUD's
     * elapsed timer; `null` until the clock is moved for the first time, which
     * the HUD reads as "not started yet" rather than as "zero minutes ago".
     * Written by `setClock` on any change of `timeOfDay`, whichever route moved
     * it — Eclipse, panel, or a rewind.
     */
    timeOfDayStartedAt: null,
    /**
     * When the game was paused, as `Date.now()`, or `null` while it runs. The
     * elapsed timer freezes here, and `timeOfDayStartedAt` is pushed forward by
     * the length of the break when play resumes — a pause is not time the table
     * spent on this time of day.
     */
    pausedAt: null,
    /**
     * The season finale is running: the vote is for the Mastermind, not a
     * Blackened. Purely a flavour flag for the floor/panel text — announcing
     * "a Final Trial is happening" gives nothing away, unlike the Mastermind's
     * identity, which never goes anywhere near this object. See mastermind.mjs.
     */
    finalTrial: false
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

    game.settings.register(MODULE_ID, SETTINGS.voiceEnabled, {
        name: "DRPG.Settings.voiceEnabled.name",
        hint: "DRPG.Settings.voiceEnabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            // Turning it on should take effect immediately, not wait for the
            // next token move. Turning it off should let everyone go, not
            // strand them in whatever room they were last assigned to.
            //
            // `force`, because switching this on says nothing about where the
            // clients currently are — several of them will be sitting in rooms a
            // previous session assigned, and an unforced pass skips exactly the
            // ones whose target happens to match what this browser last noted.
            //
            // Both branches are primary-GM-only inside voice.mjs; this runs on
            // every client that receives the setting change.
            import("./voice.mjs").then(m => {
                if (value) m.scheduleReconcile({ immediate: true, force: true });
                else m.resetAllVoice();
            }).catch(() => {});
        }
    });

    game.settings.register(MODULE_ID, SETTINGS.musicEnabled, {
        name: "DRPG.Settings.musicEnabled.name",
        hint: "DRPG.Settings.musicEnabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: () => {
            // Switching it on should put the right playlist up now, not at the
            // next time of day. Switching it off deliberately stops nothing: the
            // GM may well have turned it off precisely because they want to keep
            // the track that is playing and take over by hand.
            import("./music.mjs")
                .then(m => m.refreshMusic())
                .catch(() => {});
        }
    });

    /* ---- internal state, never shown in the settings window ---- */

    game.settings.register(MODULE_ID, SETTINGS.musicMap, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Which file each sound event plays. Mapped by a GM in the Sound panel; the
    // module ships no audio, so this is empty until somebody fills it in.
    game.settings.register(MODULE_ID, SETTINGS.sfxMap, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Whether the events marked `vary` bend on each play. Default on: the ten
    // that carry the flag are the ones heard dozens of times a session, and an
    // identical click on the fortieth press is the thing this exists to stop.
    game.settings.register(MODULE_ID, SETTINGS.sfxVary, {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    // Per-browser volumes. Client-scoped, so no `onChange` broadcast: the only
    // screen that has to react is the one whose slider moved.
    game.settings.register(MODULE_ID, SETTINGS.sfxVolumes, {
        scope: "client",
        config: false,
        type: Object,
        default: Object.fromEntries(SFX_VOLUME_KEYS.map(key => [key, 1]))
    });

    // The word that stops the scene. Set in Season setup, shown on every sheet,
    // so a change has to redraw them — otherwise the button keeps offering the
    // old word to everyone who has not reopened their character since.
    game.settings.register(MODULE_ID, SETTINGS.safeword, {
        scope: "world",
        config: false,
        type: String,
        default: DEFAULT_SAFEWORD,
        onChange: () => onWorldChange(SETTINGS.safeword)
    });

    // Migration bookkeeping. Never shown, never edited by hand — except by
    // somebody deliberately clearing it to force the whole set to run again.
    game.settings.register(MODULE_ID, SETTINGS.migratedVersion, {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // Read state is personal — the player's and each GM's own idea of what
    // they have seen — so this is client-scoped, not world-scoped like
    // everything else below it.
    game.settings.register(MODULE_ID, SETTINGS.messengerLastRead, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.messengerWindowPositions, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    // Whether this person has folded the Projects tray away. Client-scoped and
    // not in the settings menu: it is a state of the screen you are looking at,
    // set by clicking the caret on the tray itself, and one player folding it up
    // must not fold it up for the table.
    game.settings.register(MODULE_ID, SETTINGS.projectsCollapsed, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false
    });

    // The answer key to every Truth Bullet. Client-scoped on purpose — see the
    // note on SETTINGS.truthBulletSecrets for why no world-scoped store hides
    // anything from a player's console.
    game.settings.register(MODULE_ID, SETTINGS.truthBulletSecrets, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.remnantSecrets, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    // Both GM-side, both client-scoped, both for the reason written beside
    // their keys above.
    game.settings.register(MODULE_ID, SETTINGS.trapLedger, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.trapPlants, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.keyRemnantPlan, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Monokuma's standing rules. World-scoped and deliberately public — a rule
    // exists so that everybody knows it, which is the one case where D6's
    // "world data reaches every client" is the feature rather than the leak.
    game.settings.register(MODULE_ID, SETTINGS.killingGameRules, {
        scope: "world",
        config: false,
        type: Array,
        default: [],
        onChange: () => onWorldChange(SETTINGS.killingGameRules)
    });

    // Monokuma's current motive. World-scoped and deliberately public.
    game.settings.register(MODULE_ID, SETTINGS.motive, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.motive)
    });

    // The assembly called and not yet held. Public for the same reason the
    // motive is: the cast is meant to plan around it.
    game.settings.register(MODULE_ID, SETTINGS.pendingGather, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.pendingGather)
    });

    game.settings.register(MODULE_ID, SETTINGS.murderState, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.murderState)
    });

    // Direct murders declared during an Eclipse and not yet judged.
    //
    // World-scoped like the incident itself: the declaration outlives the
    // client that made it, and the judgement runs on the GM's when the lights
    // come up. Keyed by killer id — one killer, one attempt per Eclipse.
    // Deliberately carries no victim: who that is depends on where everybody
    // ends up standing, which is the whole point. See `judgePendingMurders`.
    //
    // NO `onChange`, DELIBERATELY. Nothing on any screen shows this: it is read
    // once, inside `judgePendingMurders`, on the GM's client, at the moment the
    // lights come up. It used to announce a refresh that `applyFor` then
    // dropped for want of a `SETTING_KINDS` entry — harmless at runtime and a
    // lie in the source, which is the shape of defect the "every setting that
    // promises a redraw gets one" invariant exists to remove.
    game.settings.register(MODULE_ID, SETTINGS.pendingMurders, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // Same as `pendingMurders` above, and for the same reason: the register of
    // this chapter's killers is read by `recordBlackened` and by the verdict
    // window, which asks for it fresh when it opens. No surface holds it, so
    // there is nothing to redraw and no refresh to promise.
    game.settings.register(MODULE_ID, SETTINGS.blackened, {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, SETTINGS.trialQueue, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.trialQueue)
    });

    game.settings.register(MODULE_ID, SETTINGS.trialProgress, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.trialProgress)
    });

    // Client-scoped, deliberately: see the note on SETTINGS.mastermind.
    game.settings.register(MODULE_ID, SETTINGS.mastermind, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.iAmMastermind, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, SETTINGS.myMastermindLair, {
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, SETTINGS.isoTokenShield, {
        name: "DRPG.Settings.isoTokenShield.name",
        hint: "DRPG.Settings.isoTokenShield.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: async () => {
            const { applyIsoShield } = await import("./iso-shield.mjs");
            applyIsoShield();
        }
    });

    // Which rooms each character has discovered. Cleared at season reset.
    game.settings.register(MODULE_ID, SETTINGS.discoveredRooms, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.discoveredRooms)
    });

    game.settings.register(MODULE_ID, SETTINGS.regionFog, {
        name: "DRPG.Settings.regionFog.name",
        hint: "DRPG.Settings.regionFog.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            import("./fog.mjs").then(m => m.onFogSettingChanged()).catch(() => {});
        }
    });

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
        default: [],
        onChange: () => onWorldChange(SETTINGS.sealedRooms)
    });

    // Silenced and chained players, by actor id. A Despair Call lasts one time
    // of day, so this is emptied whenever the clock moves.
    game.settings.register(MODULE_ID, SETTINGS.restrictions, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.restrictions)
    });

    // Eclipse crossings used, per actor. Cleared when the Eclipse ends.
    game.settings.register(MODULE_ID, SETTINGS.eclipseMoves, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.eclipseMoves)
    });

    // Per-project data Daggerheart's countdowns do not carry: which room the
    // project belongs to, whether it is an indirect murder, whether it is secret.
    game.settings.register(MODULE_ID, SETTINGS.projectMeta, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.projectMeta)
    });

    // Which Monokuma looks after which student. Format: { "<actorId>": "<userId>" }
    game.settings.register(MODULE_ID, SETTINGS.gmAssignments, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => {
            import("./despair.mjs").then(m => m.renderDespairBar()).catch(() => {});
        }
    });

    // One Despair pool per full Gamemaster. Format: { "<userId>": 7 }
    game.settings.register(MODULE_ID, SETTINGS.despairPools, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.despairPools)
    });

    // Custom display label per pool — a GM's account name is not always what
    // the table calls their Monokuma. Format: { "<userId>": "Monokid" }
    game.settings.register(MODULE_ID, SETTINGS.poolNames, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.poolNames)
    });

    // Assistant GMs given a pool of their own, beyond the automatic one every
    // full Gamemaster already gets. Format: ["<userId>", ...]
    game.settings.register(MODULE_ID, SETTINGS.extraPoolUsers, {
        scope: "world",
        config: false,
        type: Array,
        default: [],
        onChange: () => onWorldChange(SETTINGS.extraPoolUsers)
    });

    // Which Gamemaster's pool each Monokuma actor draws on. Set in the Monokuma
    // panel. Format: { "<actorId>": "<userId>" }
    game.settings.register(MODULE_ID, SETTINGS.monokumaPools, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.monokumaPools)
    });

    // Search token counters, keyed by room. Format: { "Library": 2, "Kitchen": 0 }
    game.settings.register(MODULE_ID, SETTINGS.searchTokens, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.searchTokens)
    });

    // Where we are in the campaign. Advanced from the GM panel.
    game.settings.register(MODULE_ID, SETTINGS.clock, {
        scope: "world",
        config: false,
        type: Object,
        default: DEFAULT_CLOCK,
        // The clock is the one every player watches, so this does the whole
        // refresh — HUD, sheets, Eclipse dimming, room visibility — not just the
        // sheets. Redrawing the sheets alone was why the time of day changed in
        // the header while the Eclipse stayed light and tokens stayed visible.
        onChange: () => onWorldChange(SETTINGS.clock)
    });
}

/**
 * Refresh this client because a world setting changed.
 *
 * Foundry syncs the Setting document to every client and runs the registered
 * `onChange` there, so this fires on the players' screens as well as the GM's —
 * which is exactly what the module's socket could not be relied on to do.
 */
function onWorldChange(key) {
    import("./sync.mjs").then(m => m.applyFor(key)).catch(() => {});
}

/** Convenience reader. */
export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

/** Convenience writer. GM-only for world-scoped settings. */
export function setSetting(key, value) {
    return game.settings.set(MODULE_ID, key, value);
}

/**
 * Is THIS browser the Mastermind's player, for the narrow purpose of locked
 * doors, the fog layer and a concealed stash? See `SETTINGS.iAmMastermind`'s
 * own header — this is the only thing about the Mastermind a player's client
 * ever holds, and reading one client-scoped boolean is the whole of it.
 *
 * IT LIVES HERE RATHER THAN IN mastermind.mjs, AND THAT IS THE POINT.
 *
 * Every static import cycle in this module ran through one edge: movement.mjs
 * reaching into mastermind.mjs for this function, while mastermind.mjs reaches
 * for chapter.mjs and remnants.mjs, which reach back through movement.mjs.
 *
 *   chapter -> remnants -> movement -> mastermind -> chapter
 *   mastermind -> remnants -> movement -> mastermind
 *
 * Both worked, because every binding in them is called at runtime and not one
 * is touched while the modules are still evaluating. That is a property of
 * today's call sites, not of the graph: the first `const` initialised from an
 * imported binding at the top level of any file on those rings is a
 * `ReferenceError` at boot, thrown before anything renders, from a file that
 * looks innocent.
 *
 * Nothing about this predicate needed mastermind.mjs. It reads a setting, and
 * the setting exists precisely so `canCross()` can ask synchronously inside a
 * `preUpdateToken` veto — which is the note already written above the key
 * itself. Moving the reader next to what it reads is what removes the edge, and
 * with it both cycles; the GM-side Mastermind machinery stays where it is.
 */
export function iAmTheMastermind() {
    if (game.user.isGM) return false;
    try {
        return game.settings.get(MODULE_ID, SETTINGS.iAmMastermind) === true;
    } catch {
        // Asked before the settings are registered — during boot, or from a
        // client that never received the whisper. Not the Mastermind.
        return false;
    }
}
