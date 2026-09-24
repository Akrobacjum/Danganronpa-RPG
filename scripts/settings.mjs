/**
 * Danganronpa RPG - world settings.
 * ---------------------------------------------------------------------------
 * Registered during `init`. Anything the GM should be able to flip lives here
 * with `config: true`; internal state is stored with `config: false` so it
 * never clutters the settings window.
 */

import { MODULE_ID, ROOMS, TIMES_OF_DAY, SFX_VOLUME_KEYS, SHEET_SIZE } from "./config.mjs";

/** Setting keys, so nothing else in the module has to spell them out. */
export const SETTINGS = {
    /** This browser has been told which recommended modules are missing (M-1). */
    recommendsSilenced: "recommendsSilenced",
    /** The Daggerheart version this browser's GM said not to be warned about again (E01, S01-09). */
    systemWarningSilenced: "systemWarningSilenced",
    /** The Daggerheart version the relay guard last warned this GM about (E03, relay-guard.mjs). */
    relayWarned: "relayWarned",
    /** Hold Isometric Perspective's welcome window off on every client (E27, N2 - see enforced.mjs). */
    enforceIsoWelcome: "enforceIsoWelcome",
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
    /**
     * The live Despair Overflow: `{ count, active }` (Z10).
     *
     * `count` is spilled Despair waiting to be spent; `active` is the stamp of
     * the ONE time of day a darkening covers, or null. Both in one setting
     * because they change together and a reader that saw one without the other
     * would draw a HUD that contradicts itself.
     */
    overflow: "overflow",
    /**
     * The GM's dial for it: `{ threshold, effects }`, shaped like
     * `OVERFLOW` in config.mjs, which supplies every default.
     *
     * SEPARATE FROM THE COUNTER ABOVE, because they are edited by different
     * things at different times: the counter moves several times a session
     * without anybody touching it, and this moves once a season when a GM
     * decides how hard their table wants it.
     */
    overflowRules: "overflowRules",
    sealedRooms: "sealedRooms",
    /** Per-player Despair Call restrictions, cleared with the clock. */
    restrictions: "restrictions",
    hideSystemFear: "hideSystemFear",
    pixelFont: "pixelFont",
    theme: "theme",
    /** This browser's language for the module's own strings - see i18n.mjs. */
    language: "language",
    /** The slow darkening of the glass, separately from the glass itself. */
    glassPulse: "glassPulse",
    /** Whether the glass blurs the map behind it - the theme's largest single cost. */
    glassBlur: "glassBlur",
    uiScale: "uiScale",
    /** This browser's own "reduced motion", independent of what the system says. */
    reducedMotion: "reducedMotion",
    /** This client's own high contrast, on top of whatever `prefers-contrast` says. */
    highContrast: "highContrast",
    /** The state's name running as an outline behind the clock. */
    hudTicker: "hudTicker",
    /** The three messenger sounds, muted for this browser alone. */
    messengerSound: "messengerSound",
    projectsCollapsed: "projectsCollapsed",
    /** How a player's Truth Bullets are grouped in the inventory: "chapter" or "room". */
    bulletSort: "bulletSort",
    debug: "debug",
    /** Regions become LiveKit breakout rooms - off by default, needs avclient-livekit. */
    voiceEnabled: "voiceEnabled",
    /** The playlist follows the game state - off by default, needs playlists. */
    musicEnabled: "musicEnabled",
    /** Which playlist each state uses: `{ stateKey: playlistId }`. */
    musicMap: "musicMap",
    /**
     * Which file each sound event plays: `{ eventKey: "path/to/file.ogg" }`.
     *
     * World-scoped, exactly like `musicMap` and for the same reason: which
     * sound means what is one fact about the table. A player who mapped their
     * own files would be playing a different game from everybody else - the
     * door they heard open would not be the door anyone else heard.
     *
     * The module ships no audio and is not going to: the files are the GM's,
     * the same bargain the playlists already make. An event with no file is
     * SILENT, not broken, and the panel says "not assigned yet" rather than
     * showing an error - see the empty-state note in the 1.2.0 plan.
     */
    sfxMap: "sfxMap",
    /**
     * Bend varied sounds a little on each play, or play them exactly as mapped.
     *
     * World-scoped and GM-owned, like the mapping it modifies and unlike the
     * volumes: this is a property of the sound design rather than of one
     * person's speakers. One switch rather than a slider, because the size of
     * the bend is `SFX_VARIATION` and tuned once - what a table needs is a way
     * to say "our files do not like this", in one place, in one click.
     */
    sfxVary: "sfxVary",
    /**
     * How loud this module is on THIS browser: `{ sound }`, 0–1.
     *
     * Client-scoped, because volume is the one thing about sound that is
     * genuinely personal - a GM on headphones and a player on laptop speakers
     * do not want the same numbers, and neither should be setting the other's.
     * It is also the only part of the Sound panel a player sees at all.
     *
     * Sliders, not switches: zero is silence, so a switch would be a poorer
     * version of the same control with a worse bottom end.
     *
     * ONE number, not one per category. The panel shows two sliders and the
     * second is `music`, deliberately absent from this object: it is a proxy
     * for Foundry's `globalPlaylistVolume` - see `SFX_SLIDERS`.
     */
    sfxVolumes: "sfxVolumes",
    /** The room's playlist volume, parked while the murder music has this browser. */
    musicDuckedFrom: "musicDuckedFrom",
    /**
     * The word that stops the scene - Player Handbook, ch. 13.
     *
     * A setting rather than a constant because the word belongs to the table,
     * not to the module: a group playing in another language, or one for whom
     * the default lands wrong, has to be able to change it without touching
     * code. Edited in Season setup, next to the campaign name, because that is
     * where a table sets up the things that are true for a whole season.
     *
     * Default "Safe Word". Worlds that predate this setting keep MISIUBOMBO,
     * which is the word their players have already been taught - see the
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
     * looseness is the point - during the test builds this update ships a new
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
     * the entire world database - `World##g()` calls `dump()` on ChatMessage,
     * Setting, Actor, Item and JournalEntry with no user and no filter, and
     * compendium reads check ownership only on create/update/delete. So there is
     * no world-scoped hiding place: a world setting, a GM-only whisper and a
     * GM-only compendium all arrive in the player's browser just the same.
     *
     * A client-scoped setting never enters world data at all, and the GM-to-GM
     * sync in truth-bullets.mjs rides a socket the server addresses to named
     * recipients. Cost of the choice: it lives in browser storage, so it is
     * synced across every GM and can be exported - see `exportLedger()`.
     */
    truthBulletSecrets: "truthBulletSecrets",
    /**
     * What every Remnant on the maps really is: its type, how hard it is to
     * spot, who left it, and the GM's note about it.
     *
     * CLIENT-SCOPED, ON GM BROWSERS, for the same reason as `truthBulletSecrets`
     * and measured the same way. This used to live in flags on the token - and
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
    /**
     * Observe targets declared but not yet scored (ACT-08, 20.09).
     *
     * CLIENT-SCOPED, on the GM's browser, for the same reason `remnantSecrets` is:
     * every entry holds the Remnant's real type and the difficulty it will be
     * scored against - the answer the player is paying to find out - and a world
     * setting reaches every client, where any player can read it from their own
     * console.
     *
     * It exists because the two halves of an Observe are minutes apart and the
     * declaration used to live in one browser's memory: a GM who reloaded in
     * between left the player having paid an action and rolled for nothing.
     */
    observePending: "observePending",
    /**
     * Level Ups handed to a player and not yet spent (N-2). CLIENT-scoped: the
     * primary GM's copy is the authority, an owner's holds only their own
     * characters' - see "WHERE AN OFFER LIVES" in level-up.mjs for why a flag
     * on the character was both forgeable and readable by everyone.
     */
    advanceOffers: "advanceOffers",
    /**
     * The words of every private card this browser is a recipient of.
     *
     * CLIENT-SCOPED, and that is the entire point - see secret.mjs. A whisper
     * is delivered to every connected client and merely hidden in the
     * interface; this is the one store in Foundry that stays where it was
     * written.
     */
    secretCards: "secretCards",
    /*
     * WHICH ITEM IS THE TRAP, AND WHAT IS WAITING IN WHICH ROOM.
     *
     * CLIENT-SCOPED, on the GM's browser, for the same reason `remnantSecrets`
     * is: a world setting reaches every client and a player can read every one
     * of them from their own console. An item on a character sheet is readable
     * by its owner, so a flag saying "this is the trap" would be a poisoned
     * first aid kit with POISONED written on it - see the header of traps.mjs.
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
    /** Which groups the last season reset was told to leave alone (R-1). */
    seasonExceptions: "seasonExceptions",
    /** Monokuma's standing rules - see rules.mjs. Public by design. */
    killingGameRules: "killingGameRules",
    /**
     * The motive Monokuma is running right now, or `{}`.
     *
     * Guide, p. 16: "Motyw musi być ogłaszany publicznie i trwać maksymalnie do
     * końca rozdziału." Public by design, exactly like the rules - a motive
     * nobody heard is not a motive - and chapter-stamped so it lapses on its
     * own when the chapter counter moves, the same trick `silencedChapter` uses.
     *
     * Shape since E14: `{ text, consequence, timesOfDay, remaining, chapter,
     * at, dueAnnounced }`. The countdown sits INSIDE the chapter stamp rather
     * than replacing it - the guide's outer bound still holds, and the timer
     * is how a motive ends early. See rules.mjs.
     */
    motive: "motive",
    /**
     * The assembly Monokuma has called but not yet held, or `{}`.
     *
     * Shape: `{ room, by, chapter, session, timeOfDay, at }` - the time of day
     * it was BOUGHT in, which is how the clock knows the order is ripe.
     *
     * World-scoped and public on purpose, and this one is not a leak but the
     * mechanic: Public Announcement is now a summons the cast has a whole time
     * of day to react to, and reacting requires knowing. Everybody is told in
     * chat when it is called, and the HUD carries the room until it happens.
     */
    pendingGather: "pendingGather",
    /**
     * A BODY HAS BEEN FOUND AND THE GM HAS NOT ANSWERED YET, or `{}` (D5).
     *
     * Shape: `{ room, victimId, chapter, day, timeOfDay, at }` - the same shape
     * and the same reasoning as `pendingGather` above. Finding a body used to
     * BE starting the investigation: `discoverBody` moved the phase, and Stage 7
     * began whether or not the table was ready for it. It is a holding state
     * now - the card stands, the music stops, Daily Life carries on - until the
     * GM either starts the Investigation or moves the clock on.
     *
     * World-scoped and public on purpose, like the assembly: the discovery is
     * announced in chat to everybody, so there is nothing in here that is not
     * already on screen. Cleared in `setClock`; see the note there.
     */
    bodyFound: "bodyFound",
    /**
     * The murder currently in progress, or `{}`.
     *
     * World-scoped, and that is a real exposure: a player reading the console
     * could learn who the killer is (see D6 - nothing world-scoped is hidden).
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
    /**
     * WHO IS IN THE INCIDENT. Client-scoped, and that is the whole point.
     *
     * `murderState` above keeps the mechanics - the stage, whose turn it is,
     * what is blocked, what has been spent - because both participants need
     * those live and a socket round trip per turn would leave the table
     * sitting in silence. What it must NOT keep is the names, and it used to:
     * `killerId` sat in a world setting, and world data reaches every client,
     * so any player could read the killer out of their own console before the
     * body was found. That is LIVE-001, and this is the half that closes it.
     *
     * Held here by every GM (synced GM to GM, like the Truth Bullet answer key
     * and the Mastermind) and by the participants themselves, each sent their
     * copy over a recipient-addressed socket. A student who is not in the
     * incident receives nothing at all, not an empty envelope.
     *
     * Participants get the WHOLE cast rather than only their own role, which is
     * exactly what they could see before this change - they already read each
     * other's rolls through `incidentAudience`. Narrowing it further is a rules
     * question about what the victim may know and when, not a leak.
     */
    incidentCast: "incidentCast",
    pendingMurders: "pendingMurders",
    /**
     * Who has killed in THIS chapter, in the order they did it.
     *
     * The incident state is wiped when a murder closes, so until this existed
     * nothing in the world remembered who the Blackened was - and the verdict
     * screen asked a GM to type it in from memory, an hour and two scenes after
     * the engine had known it exactly. A chapter with two incidents, which the
     * betrayal rule makes ordinary, meant remembering two.
     *
     * It names the killer, so it is client-scoped and synced GM to GM, the same
     * road `incidentCast` and the Mastermind take.
     *
     * It was world-scoped, on the reasoning that every GM screen reading it has
     * to agree - which is true and is not an argument for world data, only for
     * synchronisation. The cost was that closing the incident moved the killer's
     * name from one world setting to another and left it readable by the whole
     * table for the rest of the chapter, which is the half of LIVE-001 that
     * survived the first fix. See `openVerdictDialog`.
     *
     * `blackened` below it is the old world key, kept registered so a world
     * upgrading mid-chapter can be read once and emptied. Nothing writes it.
     */
    blackenedLedger: "blackenedLedger",
    /**
     * The speaking queue during a Class Trial: who has the floor and since when.
     *
     * World-scoped for the same reason as `murderState` - every player has to
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
     * to reset - or a GM who nudges the chapter by hand - gets a fresh trial
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
     * version of the D6 treatment - not even an actor flag. An actor flag is
     * world data, and Foundry ships every actor to every client (see the note
     * on `truthBulletSecrets`); the Mastermind's own player reading their own
     * flag might be harmless, but every OTHER player reading it from the
     * console would end the game before it started. So this lives in browser
     * storage on GM clients, synced GM-to-GM over a recipient-addressed socket,
     * exactly like the Truth Bullet ledger - a player's client never receives
     * it, full stop.
     */
    mastermind: "mastermind",
    /**
     * "Is THIS browser the Mastermind's player." Client-scoped, boolean, and
     * the only thing about the Mastermind that ever reaches a player's client
     * at all - see mastermind.mjs's `notifyDoorAccess`.
     *
     * Exists because `canCross()` in movement.mjs runs synchronously inside a
     * `preUpdateToken` veto, on the client dragging the token - there is no
     * chance to ask a GM mid-hook, and `isMastermind()` itself always answers
     * `false` off a GM client by construction. A GM setting the Mastermind
     * privately tells the ONE player who already knows they hold the part -
     * the guide has them agree to it before the season starts - and that
     * client alone writes `true` here. Every other client's copy stays `false`
     * forever; there is no broadcast, only a recipient-addressed whisper.
     *
     * Read by movement.mjs (locked doors, sealed rooms), fog.mjs (the
     * Mastermind knows the building, not who is in it), vault.mjs (a
     * concealed stash is their own furniture) and - since 26.08 -
     * visibility.mjs, but only through `myLairRoom()`: standing in their own
     * room shows them the cast, anywhere else they are exactly as blind as
     * every other player's client.
     */
    iAmMastermind: "iAmMastermind",
    /**
     * The Mastermind's own room, on the ONE client that holds the part -
     * delivered over the same recipient-addressed whisper as `iAmMastermind`
     * and cleared with it. Every other client's copy stays empty forever.
     *
     * Read by visibility.mjs: a Mastermind whose own token stands in this
     * room sees the whole cast, the way the GM does, and loses that the
     * moment they leave. (This is the 26.08 revision of the old contract -
     * the note on `iAmMastermind` used to promise visibility.mjs would never
     * read either of these.)
     */
    myMastermindLair: "myMastermindLair",
    /**
     * While `isometric-perspective` is active, keep its fingers out of token
     * configuration windows - see iso-shield.mjs for what exactly is parked
     * and why. World-scoped: the glitch it guards against hits whoever edits
     * tokens, and that is a table-level decision, not a per-browser one.
     */
    isoTokenShield: "isoTokenShield",
    /**
     * Which rooms each character has personally discovered, per scene:
     * `{ [sceneId]: { [actorId]: [roomName, ...] } }`.
     *
     * World-scoped. This is not a secret the way the Mastermind's identity is
     * - a discovered room is a fact about where the party has already been,
     * not about who anybody is - so it travels the ordinary way, like
     * `sealedRooms`. Written only by the primary GM (see fog.mjs), the same
     * discipline `truth-bullets.mjs` uses for its own ledger writes.
     */
    discoveredRooms: "discoveredRooms",
    /** The GM's union of every character's discoveries - a CLIENT setting on GM browsers (D2). */
    discoveryLedger: "discoveryLedger",
    /** This player's own characters' rows, written by the primary GM over the socket (D2). */
    discoveryMine: "discoveryMine",
    /**
     * Rooms, not sight lines, decide what a player can see.
     *
     * Turning this on makes the module's own region fog the ONLY thing hiding
     * any part of the map, by switching off Foundry's per-token vision and its
     * own fog exploration on the scene (see `applySceneVisionMode` in
     * fog.mjs). That is not a cosmetic preference: leaving Foundry's vision on
     * alongside the region fog is what produces cone-shaped light wedges that
     * reveal half a room through a doorway - the exact thing the guide's room
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
 * a safeword somebody hesitates over for a second - which is exactly the second
 * it exists to remove. Tables that want their own word set it in Season setup.
 */
export const DEFAULT_SAFEWORD = "Safe Word";

/** Shape of the campaign clock stored under SETTINGS.clock. */
export const DEFAULT_CLOCK = {
    /**
     * True while the placement window between two times of day is running.
     * An Eclipse is not part of a day - the day counter does not move for it.
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
     * it - Eclipse, panel, or a rewind.
     */
    timeOfDayStartedAt: null,
    /**
     * When the game was paused, as `Date.now()`, or `null` while it runs. The
     * elapsed timer freezes here, and `timeOfDayStartedAt` is pushed forward by
     * the length of the break when play resumes - a pause is not time the table
     * spent on this time of day.
     */
    pausedAt: null,
    /**
     * The season finale is running: the vote is for the Mastermind, not a
     * Blackened. Purely a flavour flag for the floor/panel text - announcing
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

    /* ONE SWITCH PER HELD SETTING OF ANOTHER MODULE (E27, 24.09.2026; N2, D19).
       World-scoped because it is the table's decision, not a browser's; the setting
       it guards is client-scoped in Isometric Perspective, which is why every
       player met the welcome window on every start while the GM's own was off.
       On by default: the request was to take it away from the players. Each
       client re-applies on change, which is also what gives the box back to a
       player's Configure Settings when the GM switches the row off. */
    game.settings.register(MODULE_ID, SETTINGS.enforceIsoWelcome, {
        name: "DRPG.Settings.enforceIsoWelcome.name",
        hint: "DRPG.Settings.enforceIsoWelcome.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => import("./enforced.mjs")
            .then(m => m.applyEnforced())
            .catch(err => console.error("danganronpa-rpg | Could not re-apply the held settings", err))
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

    /* THE PIXEL FACE BELONGS TO ONE THEME, AND TO ONE BROWSER.
       ----------------------------------------------------------------------
       It was a world setting, on by default, and the two `!important` sweeps
       it switches on in danganronpa.css outrank almost every font rule in
       stained-glass.css. So a table on the defaults saw Press Start 2P under
       BOTH themes: Stained Glass never showed VT323 or Special Elite unless a
       GM turned the pixel face off for the whole world - which took the pixel
       face away from everyone still on Monokuma Legacy. One switch could not
       serve two themes, so it does not try to any more.

       `scope: "client"`, like the theme it belongs to, and `pixelFontOn()`
       below reads it only under Monokuma Legacy. Legacy therefore keeps Press
       Start 2P as its default face with nothing to turn on, and Stained Glass
       is VT323 and Special Elite for everybody. */
    /* THE ADVICE IS PER BROWSER, AND CAN BE TURNED OFF (M-1, 17.09).
       Isometric Perspective and LiveKit are recommended rather than required, so
       the module says once what is missing and what it does. `config: false`: it
       is not a dial anybody sets on purpose, it is the checkbox in that window. */
    game.settings.register(MODULE_ID, SETTINGS.recommendsSilenced, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false
    });
    /* A VERSION, NOT A SWITCH (E01, 24.09.2026; audit S01-09). The warning about a
       Daggerheart newer than the one this module was measured on is silenced for
       THAT version only: the next Daggerheart release is a new unknown and the GM
       hears about it again. Same shape and scope as the switch above. */
    game.settings.register(MODULE_ID, SETTINGS.systemWarningSilenced, {
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    /* The Daggerheart version whose unreviewed relay cases this browser's GM
       has been told about (E03, relay-guard.mjs) - once per version, like the
       warning above. An UNGUARDED relay is said on every load regardless. */
    game.settings.register(MODULE_ID, SETTINGS.relayWarned, {
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, SETTINGS.pixelFont, {
        name: "DRPG.Settings.pixelFont.name",
        hint: "DRPG.Settings.pixelFont.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => applyTheme()
    });

    /* ---- the language of this layer, per browser. English by default, and
       deliberately NOT Foundry's core language: the file is fetched by the
       module itself at init and merged at i18nInit (i18n.mjs), so a Polish
       table on an English Foundry gets the sheet, the panel and the cards in
       Polish and nothing else changes. A reload, because everything on screen
       was built in the old language. The glossary stays in English in every
       language - see the header of i18n.mjs. */
    game.settings.register(MODULE_ID, SETTINGS.language, {
        name: "DRPG.Settings.language.name",
        hint: "DRPG.Settings.language.hint",
        scope: "client",
        config: true,
        type: String,
        choices: { en: "English", pl: "Polski" },
        default: "en",
        requiresReload: true
    });

    /* ---- the look: theme, glass effects, UI scale. All three are this
       browser's own (scope "client"); the GM's choice never reaches a player. */
    game.settings.register(MODULE_ID, SETTINGS.theme, {
        name: "DRPG.Settings.theme.name",
        hint: "DRPG.Settings.theme.hint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            stainedGlass: "DRPG.Settings.theme.stainedGlass",
            monokumaLegacy: "DRPG.Settings.theme.monokumaLegacy"
        },
        default: "stainedGlass",
        onChange: () => applyTheme()
    });

    /* The audit asked for four switches the Look window promised and never had. All four
       are this browser's own, like the theme: what one player can bear to look at and
       listen to is not a thing a GM decides for the table. */
    game.settings.register(MODULE_ID, SETTINGS.glassPulse, {
        name: "DRPG.Settings.glassPulse.name",
        hint: "DRPG.Settings.glassPulse.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => applyTheme()
    });

    /* THE ONE SWITCH THAT IS ABOUT THE MACHINE RATHER THAN THE TASTE.
       Every other switch in this group is "what can I bear to look at". This one is
       "what can this browser draw": a full-screen `backdrop-filter` is recomputed
       every time anything over or behind it is redrawn, and under this theme the
       pulse, the clock's ticker and Foundry's own map see to it that something
       always is. It is the theme's largest single cost and it is not JavaScript -
       the measurement, and what was tried and did not help, are written on
       `--drpg-glass-backdrop` in stained-glass.css. Default ON: the blur is what
       the theme looks like, and a table that does not need to turn it off should
       never have to know it is there. `game.drpg.perf()` says whether they do. */
    /* HOW THIS PLAYER READS THEIR OWN PACK, AND IT IS THEIRS TO DECIDE.
       Not `config: true`: the switch lives on the inventory itself, beside the
       evidence it orders, because that is where somebody realises they want it -
       a setting in Foundry's window would be a control nobody finds while
       looking at the thing it controls. Client-scoped like the look settings:
       one player argues a case by room and another by chapter, and neither
       should move the other's pack. */
    game.settings.register(MODULE_ID, SETTINGS.bulletSort, {
        name: "DRPG.Settings.bulletSort.name",
        hint: "DRPG.Settings.bulletSort.hint",
        scope: "client",
        config: false,
        type: String,
        choices: {
            chapter: "DRPG.Sheet.bulletsByChapter",
            room: "DRPG.Sheet.bulletsByRoom"
        },
        default: "chapter"
    });

    game.settings.register(MODULE_ID, SETTINGS.glassBlur, {
        name: "DRPG.Settings.glassBlur.name",
        hint: "DRPG.Settings.glassBlur.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => applyTheme()
    });

    game.settings.register(MODULE_ID, SETTINGS.reducedMotion, {
        name: "DRPG.Settings.reducedMotion.name",
        hint: "DRPG.Settings.reducedMotion.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: () => applyTheme()
    });

    /*
     * HIGH CONTRAST IS THE READER'S, NOT THE TABLE'S (W-7, Dawid 18.09).
     *
     * Client-scoped for the same stated reason as reduced motion: what one player
     * can read is not a thing a GM decides for everybody. It is offered under both
     * themes, because dim fine print is dim in both.
     */
    game.settings.register(MODULE_ID, SETTINGS.highContrast, {
        name: "DRPG.Settings.highContrast.name",
        hint: "DRPG.Settings.highContrast.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: () => applyTheme()
    });

    game.settings.register(MODULE_ID, SETTINGS.hudTicker, {
        name: "DRPG.Settings.hudTicker.name",
        hint: "DRPG.Settings.hudTicker.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => applyTheme()
    });

    game.settings.register(MODULE_ID, SETTINGS.messengerSound, {
        name: "DRPG.Settings.messengerSound.name",
        hint: "DRPG.Settings.messengerSound.hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.uiScale, {
        name: "DRPG.Settings.uiScale.name",
        hint: "DRPG.Settings.uiScale.hint",
        scope: "client",
        config: true,
        type: Number,
        range: { min: 0.8, max: 1.4, step: 0.05 },
        default: 1,
        onChange: () => applyTheme()
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
            // clients currently are - several of them will be sitting in rooms a
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

    /*
     * WHAT THE PLAYLIST VOLUME WAS BEFORE THE MURDER MUSIC TOOK IT.
     *
     * The murder playlist plays on one browser rather than in the world (see
     * music.mjs), so the room's own playlist has to be ducked on that browser
     * while it runs - and put back afterwards. Held in a setting rather than in
     * a variable because the thing that most obviously goes wrong is a client
     * closing the tab mid-incident: a variable dies with the page and the
     * player comes back to a world with the music turned off and no way to
     * know why. `restoreDuckedMusic` reads this at `ready` and, if no incident
     * is running, puts the number back.
     *
     * `-1` for "not ducked" rather than `null`, so a stored 0 - a player who
     * had genuinely muted the music before any of this - is not read as absent
     * and quietly turned back up.
     */
    game.settings.register(MODULE_ID, SETTINGS.musicDuckedFrom, {
        scope: "client",
        config: false,
        type: Number,
        default: -1
    });

    // The word that stops the scene. Set in Season setup, shown on every sheet,
    // so a change has to redraw them - otherwise the button keeps offering the
    // old word to everyone who has not reopened their character since.
    game.settings.register(MODULE_ID, SETTINGS.safeword, {
        scope: "world",
        config: false,
        type: String,
        default: DEFAULT_SAFEWORD,
        onChange: () => onWorldChange(SETTINGS.safeword)
    });

    // Migration bookkeeping. Never shown, never edited by hand - except by
    // somebody deliberately clearing it to force the whole set to run again.
    game.settings.register(MODULE_ID, SETTINGS.migratedVersion, {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // Read state is personal - the player's and each GM's own idea of what
    // they have seen - so this is client-scoped, not world-scoped like
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

    // The answer key to every Truth Bullet. Client-scoped on purpose - see the
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

    game.settings.register(MODULE_ID, SETTINGS.observePending, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.advanceOffers, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, SETTINGS.secretCards, {
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

    /*
     * THE EXCEPTIONS THE LAST RESET WAS GIVEN (R-1, Dawid 18.09).
     *
     * World-scoped, because a reset is a decision about the world and the next one
     * may be run by a different GM at the same table. It holds group KEYS and
     * nothing about the season itself, so there is nothing here a player learns
     * anything from - which is the test D6 asks of every world setting.
     */
    game.settings.register(MODULE_ID, SETTINGS.seasonExceptions, {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    // Monokuma's standing rules. World-scoped and deliberately public - a rule
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

    // The body found and not yet answered. Public for the same reason the
    // assembly above it is: the discovery is announced to the whole table.
    game.settings.register(MODULE_ID, SETTINGS.bodyFound, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.bodyFound)
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
    // come up. Keyed by killer id - one killer, one attempt per Eclipse.
    // Deliberately carries no victim: who that is depends on where everybody
    // ends up standing, which is the whole point. See `judgePendingMurders`.
    //
    // NO `onChange`, DELIBERATELY. Nothing on any screen shows this: it is read
    // once, inside `judgePendingMurders`, on the GM's client, at the moment the
    // lights come up. It used to announce a refresh that `applyFor` then
    // dropped for want of a `SETTING_KINDS` entry - harmless at runtime and a
    // lie in the source, which is the shape of defect the "every setting that
    // promises a redraw gets one" invariant exists to remove.
    game.settings.register(MODULE_ID, SETTINGS.pendingMurders, {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    /*
     * THE TWO CLIENT-SCOPED HALVES OF LIVE-001.
     *
     * `incidentCast` carries an `onChange`, and it has to: a participant's copy
     * arrives over a socket AFTER the world state that goes with it, so the
     * screen that already repainted for the stage change has to repaint again
     * once it knows whose side this player is on. Without it a killer's own
     * sheet would show the bystander's view until something else happened to
     * redraw it. `applyFor` is keyed by setting name and does not care that
     * this one is client-scoped.
     *
     * `blackenedLedger` carries none, for the same reason `blackened` never
     * did: no surface holds it. The verdict window asks for it when it opens.
     */
    game.settings.register(MODULE_ID, SETTINGS.incidentCast, {
        scope: "client",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.murderState)
    });

    game.settings.register(MODULE_ID, SETTINGS.blackenedLedger, {
        scope: "client",
        config: false,
        type: Array,
        default: []
    });

    /*
     * Z10. Registered in the SAME build as the code that reads them - trap 7:
     * a key read by a build that never registered it costs the world its data,
     * and splitting a setting from its first reader buys nothing but the risk
     * that its shape goes stale before anybody uses it.
     */
    game.settings.register(MODULE_ID, SETTINGS.overflow, {
        scope: "world",
        config: false,
        type: Object,
        default: { count: 0, active: null },
        onChange: () => onWorldChange(SETTINGS.overflow)
    });

    game.settings.register(MODULE_ID, SETTINGS.overflowRules, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.overflowRules)
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

    /*
     * WHICH ROOMS EACH CHARACTER HAS DISCOVERED - AND WHO MAY KNOW IT (D2,
     * Dawid 13.09; audit MAP-12).
     *
     * This used to be one world setting, readable from any player's console:
     * "which rooms has X been in" for the whole season, which in a killing
     * game is alibi evidence. It travels the `incidentCast` road now. The
     * primary GM holds the union in a client setting on their own browser and
     * mirrors it to the other GMs; each player's browser holds only the rows
     * of the characters they own, sent to them alone over the addressed
     * socket (fog.mjs, `shareLedger`). The world setting stays registered so
     * a world that updates mid-season can be lifted out of it once
     * (`migrateLedger`), and is empty from then on.
     *
     * All three fire the same repaint: the fog reads through
     * `discoveryLedger()` below, whichever store this client is.
     */
    game.settings.register(MODULE_ID, SETTINGS.discoveredRooms, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.discoveredRooms)
    });
    game.settings.register(MODULE_ID, SETTINGS.discoveryLedger, {
        scope: "client",
        config: false,
        type: Object,
        default: {},
        onChange: () => onWorldChange(SETTINGS.discoveredRooms)
    });
    game.settings.register(MODULE_ID, SETTINGS.discoveryMine, {
        scope: "client",
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
        default: true,
        // The stylesheet's half of the lock follows at once (E03; audit S01-40).
        onChange: value => document.body.classList.toggle("drpg-resources-locked", Boolean(value))
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

    // Custom display label per pool - a GM's account name is not always what
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
        // refresh - HUD, sheets, Eclipse dimming, room visibility - not just the
        // sheets. Redrawing the sheets alone was why the time of day changed in
        // the header while the Eclipse stayed light and tokens stayed visible.
        onChange: () => onWorldChange(SETTINGS.clock)
    });
}

/**
 * Refresh this client because a world setting changed.
 *
 * Foundry syncs the Setting document to every client and runs the registered
 * `onChange` there, so this fires on the players' screens as well as the GM's -
 * which is exactly what the module's socket could not be relied on to do.
 */
function onWorldChange(key) {
    import("./sync.mjs").then(m => m.applyFor(key)).catch(() => {});
}

/**
 * Who is in the incident, as a bare list of actor ids.
 *
 * HERE, AND NOT IN murder.mjs, for exactly the reason `iAmTheMastermind` lives
 * in this file: movement.mjs and private-rolls.mjs both need it, both are
 * imported by murder.mjs's own graph, and an import the other way would be a
 * cycle. This file is a leaf and reads the client-scoped store directly.
 *
 * Both callers used to read `SETTINGS.murderState` themselves and pick
 * `killerId`, `victimId` and `thirdId` out of it. Those names left world data
 * with LIVE-001, so the list comes from `incidentCast` now - which means a
 * bystander's client gets an empty array, and that is the whole point: a
 * student who is not in the incident is not stopped from walking, and their
 * rolls are not whispered to anybody.
 *
 * A LIST, not the roles. Neither caller ever needed to know which of the three
 * is the killer - one asks "is this actor one of them" and the other asks "who
 * are the others" - so neither is given the answer.
 */
/**
 * The discovery ledger as THIS client may know it: the union on a GM's
 * browser, this player's own rows on theirs. Shaped
 * `{ [sceneId]: { [actorId]: [roomName, ...] } }` either way. A leaf, so
 * movement.mjs and fog.mjs read the same thing.
 */
export function discoveryLedger() {
    try {
        const key = game.user?.isGM ? SETTINGS.discoveryLedger : SETTINGS.discoveryMine;
        return game.settings.get(MODULE_ID, key) ?? {};
    } catch {
        return {};
    }
}

/**
 * This client's copy of the incident's cast.
 *
 * The names in a murder do not travel in the world setting - they are the one
 * thing the incident has to keep (LIVE-001). The GM's browser holds the whole
 * cast; a participant's holds their own seat and nothing else; a spectator's
 * holds nothing. So every reader has to merge this with `murderState`'s public
 * half rather than expecting the ids to be in it, and this is the leaf they
 * all ask.
 */
export function incidentCast() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.incidentCast) ?? {};
    } catch {
        return {};
    }
}

export function incidentParticipants() {
    const cast = incidentCast();
    return [cast.killerId, cast.victimId, cast.thirdId].filter(Boolean);
}

/**
 * DOES THIS BROWSER WITNESS THE INCIDENT THAT IS RUNNING - and which seat is it?
 *
 * Four things now turn on that one question: the Event card, the HUD's turn
 * row, the colour of the interface's own edges, and whether this client plays
 * the murder playlist. Before this existed they each answered it themselves,
 * in four slightly different ways, and two of them had already drifted - the
 * HUD was still reading the ids off the world half of `murderState`, where
 * they have not lived since LIVE-001, so its row rendered for nobody at all
 * including the GM. The Event card had been fixed; nothing connected the two.
 *
 * So it is one function, in the leaf every caller can already reach, and the
 * rules it states are the whole of the rule:
 *
 *   · the names come from `incidentCast`, never from the world setting - a
 *     bystander's browser holds none of them and must go on holding none
 *   · a seat is decided by OWNERSHIP, because `game.user.character` is a field
 *     nothing at this table ever sets (see hud.mjs's own note on that)
 *   · a GM witnesses every incident, but owns no seat in it - owning every
 *     actor in the world would otherwise make every incident read as theirs
 *   · AND THE KILLER OF A TRAP IS NOT A WITNESS. They built it and walked
 *     away; the whole point of an indirect murder is that they are elsewhere
 *     when it goes off. A card, a red edge or a change of music arriving on
 *     their screen is the module telling them the moment it worked, which is
 *     exactly the fact the rest of this file exists to keep from travelling.
 *     They are let back in at Stage 6, when the scene becomes theirs to
 *     arrange - see `castOwners` in murder.mjs, which stops sending them the
 *     cast at all until then.
 *
 * @returns {{running: boolean, witness: boolean, seat: string|null, gm: boolean, indirect: boolean}}
 */
export function incidentWitness() {
    const away = { running: false, witness: false, seat: null, gm: false, indirect: false };
    let state;
    try {
        state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    } catch {
        return away;
    }
    // `openingRoll` counts: the trap's roll and the killer's are both part of
    // the same held breath, and the Event card has always covered both.
    if (!state.active || (state.stage !== "incident" && state.stage !== "openingRoll")) return away;

    const cast = incidentCast();
    const indirect = Boolean(state.indirect);
    const gm = Boolean(game.user?.isGM);

    const mine = new Set();
    try {
        for (const actor of game.actors ?? []) {
            if (actor.type === "character" && actor.testUserPermission(game.user, "OWNER")) mine.add(actor.id);
        }
    } catch {
        // No actors yet - mid-boot. Not a witness, which is the safe answer.
    }
    // Still preferred when it is set: somebody owning two students gets the
    // turn indicator for the one they are actually playing.
    const assigned = game.user?.character?.id ?? null;
    if (assigned) mine.add(assigned);

    // The killer's seat is simply not on the board during their own trap.
    const seats = [
        indirect ? null : cast.killerId,
        cast.victimId,
        cast.thirdId
    ].filter(Boolean);

    const owned = (assigned && seats.includes(assigned))
        ? assigned
        : (seats.find(id => mine.has(id)) ?? null);

    // A GM's ownership of every actor is not a seat; only a deliberate
    // assignment is.
    const seat = gm ? (assigned && seats.includes(assigned) ? assigned : null) : owned;

    return { running: true, witness: gm || Boolean(owned), seat, gm, indirect };
}

/*
 * THE CLOCK'S THREE LEAF READERS (audit C3).
 *
 * `getClock`, `isEclipse` and `incomingTimeOfDay` each had two or three
 * private copies - in overflow.mjs, fog.mjs, visibility.mjs, hud.mjs and
 * movement.mjs - every one with the same note beside it: clock.mjs and
 * eclipse.mjs import the file that needs the answer, so importing them back
 * would close a cycle. The copies were right about the cycle and wrong about
 * the cure. This file imports config.mjs and nothing else, so it is where a
 * reader lives when both ends of a cycle need it. clock.mjs and eclipse.mjs
 * re-export these under the names everything already imports from them.
 */

/** The clock, every field present. */
export function getClock() {
    return { ...DEFAULT_CLOCK, ...(game.settings.get(MODULE_ID, SETTINGS.clock) ?? {}) };
}

/** Is an Eclipse running right now? False rather than a throw before `ready`. */
export function isEclipse() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.clock)?.eclipse === true;
    } catch {
        return false;
    }
}

/** The time of day a running (or about-to-run) Eclipse leads into. */
export function incomingTimeOfDay(clock = getClock()) {
    const index = TIMES_OF_DAY.indexOf(clock?.timeOfDay);
    return TIMES_OF_DAY[(index < 0 ? 0 : index + 1) % TIMES_OF_DAY.length];
}

/*
 * THE BODY FOUND, READ FROM THE SAME LEAF (D5).
 *
 * Not a clock reader, but here for the reason the three above it are: clock.mjs,
 * chapter.mjs, events.mjs, music.mjs, cleanup.mjs and hud.mjs all need the
 * answer, and every one of them is already downstream of somebody who would
 * close a cycle if the record lived anywhere else. This file imports config.mjs
 * and nothing else.
 */

/** The body found and not yet answered, or `null`. Never a throw before `ready`. */
export function bodyDiscovery() {
    try {
        const record = game.settings.get(MODULE_ID, SETTINGS.bodyFound) ?? {};
        return record.at ? record : null;
    } catch {
        return null;
    }
}

/**
 * Is the discovery still the LOUD one - found this hour, nobody has moved yet?
 *
 * The record is two facts and they do not end together. "A body has been found
 * and Stage 7 has not started" lasts until the phase moves: it is what stops the
 * token watch re-announcing the same corpse (`maybeBodyFound`) and what ends the
 * killer's fresh-scene discount (`freshSceneBonus`), and neither of those is
 * undone by the hour turning. What the hour DOES end is the noise - the silence
 * and the pulsing card. Stamped with the time of day it was written in, which is
 * the same question `pendingGather` above it asks of its own stamp.
 */
export function bodyDiscoveryFresh() {
    const record = bodyDiscovery();
    return record && record.timeOfDay === getClock().timeOfDay ? record : null;
}

/** Record a discovery the GM has still to answer. GM-side. */
export function setBodyDiscovery({ room = null, victimId = null } = {}) {
    const clock = getClock();
    return game.settings.set(MODULE_ID, SETTINGS.bodyFound, {
        room, victimId,
        chapter: clock.chapter, day: clock.day ?? 1, timeOfDay: clock.timeOfDay,
        at: Date.now()
    });
}

/** The GM has answered. Safe to call when there is nothing to clear. */
export async function clearBodyDiscovery() {
    if (!game.user.isGM || !bodyDiscovery()) return null;
    return game.settings.set(MODULE_ID, SETTINGS.bodyFound, {});
}

/** Convenience reader. */
/**
 * The language this browser asked the module for: `en` or `pl`, `en` when the
 * setting is unregistered or holds something unknown. Here rather than in
 * i18n.mjs because utils.mjs's `plural()` needs it and utils imports this leaf.
 */
export function moduleLanguage() {
    try {
        const lang = game.settings.get(MODULE_ID, SETTINGS.language);
        return lang === "pl" ? "pl" : "en";
    } catch {
        return "en";
    }
}

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
 * own header - this is the only thing about the Mastermind a player's client
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
 * `preUpdateToken` veto - which is the note already written above the key
 * itself. Moving the reader next to what it reads is what removes the edge, and
 * with it both cycles; the GM-side Mastermind machinery stays where it is.
 */
export function iAmTheMastermind() {
    if (game.user.isGM) return false;
    try {
        return game.settings.get(MODULE_ID, SETTINGS.iAmMastermind) === true;
    } catch {
        // Asked before the settings are registered - during boot, or from a
        // client that never received the whisper. Not the Mastermind.
        return false;
    }
}

/**
 * Whether this browser draws the module's chrome in the pixel face.
 *
 * True only under Monokuma Legacy, where Press Start 2P is the identity and
 * the default. Stained Glass has its own two faces and never mixes: the pixel
 * sweeps in danganronpa.css carry `!important`, so a client wearing both
 * classes would render the new theme in the old face - which is exactly what
 * 1.2.27 did on a default world.
 */
export function pixelFontOn() {
    try {
        return getSetting(SETTINGS.theme) !== "stainedGlass" && getSetting(SETTINGS.pixelFont) !== false;
    } catch {
        return false;
    }
}

/**
 * The look, applied to the body: the theme class, the pixel-face class, the
 * glass-effects class and the UI scale. Idempotent; called at ready and from
 * every onChange above. The curtain itself (scripts/glass.mjs) listens to the
 * same settings through `refreshGlass`, which this calls when it is loaded.
 */
/*
 * THE THREE SHAPES A SCREEN CAN HAVE, AND THEY ARE MEASURED, NOT GUESSED.
 *
 * Foundry lays its interface out in columns that assume a desk: the left column,
 * the centred top bar and the right column. The module puts its own blocks in
 * them - the clock in the left, the Despair rail in the top, the status strip and
 * the Projects tray in the right - and on a wide screen they never meet. On a
 * narrow one they do, and the measurement is unambiguous (audit/glass-harness.html
 * at each size, 13.09; overlapping pairs among the module's own blocks):
 *
 *   1920x993  none        1366x768  none        1280x800  none
 *   1024x768  the rail over the status strip and over the tray
 *   820x1180  and the clock over the rail as well
 *   393x852   five pairs, and two blocks off the screen entirely
 *
 * The rail is centred and about 433 px wide at the scale floor, the right column
 * about 382 px in from the edge, so the two meet at about 1196 px of width. 1200
 * was that number rounded up.
 *
 * 1224 SINCE 22.09, BECAUSE 1200 TO 1216 WERE STILL A COLLISION. Swept on a real
 * client (Foundry v14, Stained Glass, a fresh load at each width, 768 px tall), the
 * Despair rail and the status strip overlapped by 10 px at 1200 once the curtain's
 * own faults were fixed, and the curtain's self-check read 8 block failures at 1200,
 * 1208 and 1216 - the rail had no pane of its own, because two blocks standing on
 * each other cannot have one each. 1224 and every width above it read clean, and
 * 1152, 1100, 1024, 900 and 820 x 1180 read clean stacked.
 *
 * SHORT IS ITS OWN THING, AND IT IS NOT ABOUT COLLISIONS. A phone held sideways
 * (980 x 386) is narrow as well, so it stacks for the reason above; what 620 px
 * decides is different. The stack has a ceiling and scrolls past it, and a block
 * scrolled under that ceiling is a block the curtain cannot cut a pane for - it
 * reports the position it is laid out at, which by then is over the board. Under
 * 620 px of height that starts happening with an ordinary table's blocks, so the
 * curtain stands down there and the flat backdrop takes over (glass.mjs). It is a
 * separate number from the one above because a wide short window - 1600 x 600 -
 * has no collisions to fix and keeps the desk layout it always had.
 */
export const BREAKPOINTS = { narrow: 1224, short: 620 };

/* A measurement of zero is a window that has not been laid out yet - a hidden
   iframe, a client mid-boot - and it must not read as "tiny": nothing stacks,
   shrinks or unmounts on a number nobody has measured. */
const measured = v => (Number.isFinite(v) && v > 0 ? v : Infinity);

/** True when the module's blocks must leave Foundry's columns and stack in one. */
export function narrowScreen(w = innerWidth) {
    return measured(w) < BREAKPOINTS.narrow;
}
/** True when there is too little height for the desk layout's vertical rhythm. */
export function shortScreen(h = innerHeight) {
    return measured(h) < BREAKPOINTS.short;
}
/**
 * The screen's own factor under the slider.
 *
 * Every size in the theme is drawn for 2560 x 1440 at 100 % (the audit page's rule), and
 * until 1.2.35 that was the only size: a 1280 x 800 tablet got the same 330 px notice pane
 * as a 1440p monitor, a quarter of its width. The factor is the screen's short side against
 * 1440p's - never above 1, never under 0.7 (below that the 11 px floor holds the type
 * anyway and only the panes would keep shrinking) - and the slider multiplies it. The Look
 * dialog shows both numbers so nobody has to guess why 100 % is not 100 %.
 */
export function autoScale() {
    const w = Math.max(320, innerWidth || 0), h = Math.max(240, innerHeight || 0);
    const f = Math.min(w / 2560, h / 1440);
    return Math.round(Math.min(1, Math.max(0.7, f)) * 100) / 100;
}
/** The slider on its own, 0.8 to 1.4, with no screen factor in it. */
export function sliderScale() {
    return Math.min(1.4, Math.max(0.8, Number(getSetting(SETTINGS.uiScale)) || 1));
}
/**
 * The factor the theme's TYPE uses: the slider, with a gentle screen term under it.
 *
 * The two factors were split apart on 07.09 because type on the full `autoScale` was
 * broken - see the note in `applyTheme`. That fixed the slider and left a new problem,
 * measured in the 08.09 audit: at 1920 x 1080 the geometry runs at 0.75 and the type at
 * 1.00, so every box is a quarter smaller with the same words in it. That ratio, and
 * nothing else, is what cuts the sheet's Actions tab by 151 px, the action tiles' labels,
 * the item-table names by 22 px and the chat card's header by 47.
 *
 * So type takes the screen term back, CLAMPED AT 0.85 rather than following it down to
 * `autoScale`'s own 0.7 floor. Two reasons for the clamp and both are measured. It gives
 * back about two thirds of the quarter the boxes lost, which is what the cuts needed. And
 * it keeps the slider audible: at 1080p the floor runs 14.3 px at 80 % and 25.0 px at
 * 140 %, where the full screen term would have flattened the low end.
 *
 * THE OLD TRAP IS GONE AND IT WAS NOT THIS FACTOR. What killed the slider in 1.2.41 was
 * the readability floor written `max(1, scale)`, which no multiplier under 1 could reach.
 * The floor is a plain multiply now (`--drpg-sg-floor` in stained-glass.css), so a screen
 * term below 1 shrinks it honestly instead of being swallowed.
 */
export function typeScale() {
    return Math.round(sliderScale() * Math.max(0.85, autoScale()) * 100) / 100;
}
/** The factor the theme's GEOMETRY uses: the slider on the screen's own factor. */
export function effectiveScale() {
    return Math.round(sliderScale() * autoScale() * 100) / 100;
}
/* The screen's factor changes when the window does, and so can its shape; the theme
   follows once the resize has settled, and only when one of the two actually differs. */
let screenWatched = false, screenTimer = 0, screenFactor = 0, screenShape = "";
/* The scale is not the only thing a resize can change: crossing 1200 px of width
   restacks the module and crossing 620 px of height puts the glass to sleep, and
   both can happen without the factor moving a hundredth (it is at its floor on every
   screen under 1792 x 1008 anyway). One key covers all three. */
const shapeKey = () => (narrowScreen() ? "n" : "-") + (shortScreen() ? "s" : "-");
function watchScreen() {
    screenFactor = autoScale();
    screenShape = shapeKey();
    if (screenWatched) return;
    screenWatched = true;
    addEventListener("resize", () => {
        clearTimeout(screenTimer);
        screenTimer = setTimeout(() => { if (autoScale() !== screenFactor || shapeKey() !== screenShape) applyTheme(); }, 250);
    });
}

/**
 * Is this client asking for more contrast?
 *
 * The switch, or the system asking through `prefers-contrast: more`. READ IN JS
 * rather than in a second CSS block, so the token overrides below exist once
 * instead of twice - fog.mjs reads `prefers-reduced-motion` the same way and for
 * the same reason.
 */
export function highContrastOn() {
    try {
        if (getSetting(SETTINGS.highContrast) === true) return true;
        return Boolean(window.matchMedia?.("(prefers-contrast: more)")?.matches);
    } catch {
        return false;
    }
}

let contrastWatched = false;

/**
 * Follow the system's own contrast preference while the game is open.
 *
 * One listener, registered once, exactly as `watchScreen` does it - a player who
 * turns high contrast on in Windows mid-session gets it here without reloading.
 */
function watchContrast() {
    if (contrastWatched) return;
    try {
        const query = window.matchMedia?.("(prefers-contrast: more)");
        if (!query?.addEventListener) return;
        contrastWatched = true;
        query.addEventListener("change", () => applyTheme());
    } catch {
        // A browser without the query is a browser that never asks for it.
        contrastWatched = true;
    }
}

export function applyTheme() {
    const theme = getSetting(SETTINGS.theme);
    document.body.classList.toggle("drpg-theme-stained-glass", theme === "stainedGlass");
    document.body.classList.toggle("drpg-theme-monokuma-legacy", theme !== "stainedGlass");
    document.body.classList.toggle("drpg-pixel-font", pixelFontOn());
    document.body.classList.toggle("drpg-no-pulse", getSetting(SETTINGS.glassPulse) === false);
    document.body.classList.toggle("drpg-no-ticker", getSetting(SETTINGS.hudTicker) === false);
    document.body.classList.toggle("drpg-no-blur", getSetting(SETTINGS.glassBlur) === false);
    document.body.classList.toggle("drpg-reduced-motion", getSetting(SETTINGS.reducedMotion) === true);
    // W-7. Deliberately NOT in the pulse/ticker/blur group above: those three are one
    // theme's effects, and this one is about being able to read the other 235
    // sizes in the stylesheet, whichever theme is drawing them.
    document.body.classList.toggle("drpg-high-contrast", highContrastOn());
    /* The breakpoints live here and nowhere else. The stylesheet keys off these two
       classes rather than repeating the numbers in a media query, so there is one
       place to change them and no chance of the sheet and the curtain disagreeing
       about where a screen stops being a desk. One class for "the blocks stack"
       and one for "and there is no height either", which is the only distinction
       styles/narrow.css needs to draw. */
    document.body.classList.toggle("drpg-stacked", narrowScreen());
    document.body.classList.toggle("drpg-short", shortScreen());
    // On the body, where the theme's own rules live: a value on <html> was shadowed by
    // the sheet's default on body (v1.2.15), so the scale never applied.
    const total = String(effectiveScale());
    document.body.style.setProperty("--drpg-ui-scale", total);
    document.documentElement.style.setProperty("--drpg-ui-scale", total);
    /* TYPE DOES NOT SHRINK WITH THE SCREEN, ONLY WITH THE SLIDER.
       `autoScale` is the screen's short side against 1440p, and it is right for the panes:
       a 1280 px tablet should not be given a 330 px notice tile. It is wrong for text. On
       any screen under 1440p it is pinned at its 0.7 floor, so the whole type scale was
       multiplied by 0.7 before the slider ever touched it - and since the readability floor
       is written `max(1, scale)`, the slider could not reach it either: 100 % and 140 %
       measured 18 px on both settings (07.09). The two factors are separate tokens now.
       Geometry keeps `--drpg-ui-scale`; type reads `typeScale()`, which is the slider on a
       screen term clamped at 0.85 - see the note there for why the clamp, and why the old
       trap cannot come back. */
    document.body.style.setProperty("--drpg-type-scale", String(typeScale()));
    document.documentElement.style.setProperty("--drpg-type-scale", String(typeScale()));

    /*
     * THE SLIDER ON ITS OWN, FOR THE SIZES danganronpa.css STATES ITSELF (W-2,
     * Dawid 19.09).
     *
     * That sheet read NEITHER of the two tokens above - 234 font-size
     * declarations, zero uses - so Monokuma Legacy kept one size whatever the
     * slider said, and the only thing a Legacy client's slider moved was the
     * number in the Look window's own note. Measured at three settings: every
     * probe flat at 28 / 15 / 11 px.
     *
     * NOT `--drpg-type-scale`: that carries the screen term, which is 0.85 at
     * 1080p, and this sheet was drawn at one size for every screen - wiring it in
     * would have shrunk every Legacy label by 15 % the day it shipped.
     *
     * PINNED AT 1 UNDER THE GLASS, because that theme states its own sizes and
     * scales them with `--drpg-sg-scale`. One factor per sheet: a second multiply
     * on the same declaration is not a bug anybody sees, it is a bug somebody
     * measures a month later. Decided here rather than with a CSS gate because
     * five stylesheets read it and only one of them would have carried the gate.
     *
     * ON THE DOCUMENT AS WELL AS THE BODY, and that is load-bearing: the six
     * `--drpg-text-*` rungs are declared on `:root`, and a custom property is
     * substituted against the element its declaration sits on - a token that only
     * reached `body` would leave all six on their fallback of 1 and nothing would
     * move. The mirror of the v1.2.15 trap in the note above.
     *
     * At 100 % it is 1.00 in both themes, so a player who never touched the
     * slider sees no difference at all.
     */
    const legacyScale = String(theme === "stainedGlass" ? 1 : sliderScale());
    document.body.style.setProperty("--drpg-legacy-scale", legacyScale);
    document.documentElement.style.setProperty("--drpg-legacy-scale", legacyScale);
    /* THE SLIDER ON ITS OWN, IN BOTH THEMES (22.09) - the factor a window's size is already
       multiplied by in `scaleWindow`, for the boxes inside it that are drawn in rem or px
       rather than around their text: the character sheet's trait frames, its Health and
       Sanity blocks and its pips (see the end of danganronpa.css). 1 at 100 %. */
    const slider = String(sliderScale());
    document.body.style.setProperty("--drpg-slider-scale", slider);
    document.documentElement.style.setProperty("--drpg-slider-scale", slider);
    // the windows standing open when the slider moved, which will not render again on their own
    for (const app of foundry.applications.instances.values()) {
        const el = app.element instanceof HTMLElement ? app.element : app.element?.[0];
        if (el) { delete el.dataset.drpgScaled; scaleWindow(app, el); }
    }
    watchScreen();
    watchContrast();
    /* The stack before the glass: the curtain is cut around where the blocks are,
       and on a narrow screen this is what decides that. Dynamic, like the curtain's
       own call, because narrow.mjs reads the breakpoints from this file. */
    import("./narrow.mjs").then(m => m.applyNarrowLayout()).catch(() => {});
    import("./glass.mjs").then(m => m.refreshGlass()).catch(() => {});
    import("./sfx.mjs").then(m => m.renderSoundLauncher?.()).catch(() => {});
    // The clock carries the theme's ticker and, under Monokuma Legacy, the three
    // rows the Event panel takes over; a switch redraws it so neither lingers.
    if (game.ready) import("./hud.mjs").then(m => m.renderHud?.()).catch(() => {});
}

/*
 * THE OTHER THEME'S SWITCHES ARE NOT SHOWN.
 *
 * Three of the look settings only exist under Stained Glass - the pulse, the ticker and
 * the blur - and the pixel face only exists under Monokuma Legacy, which has no second
 * face of its own to swap. Reduced motion is in neither list: it is for both themes since
 * W-3. Whichever theme is on, the other's switches still sat in Foundry's settings window
 * looking live, and changing one did nothing.
 *
 * HIDDEN, not greyed (Dawid, 08.09). They were greyed here and simply absent from the
 * Look window, which builds the same switches from the same settings - so the two
 * windows disagreed about whether a switch existed at all. One of them had to change,
 * and the Look window is the one a player actually opens. The row is hidden, never
 * disabled: a disabled field is left out of the form Foundry submits on Save, and a
 * setting that is merely irrelevant to this theme must keep the value it has.
 *
 * Off the SELECT, not the stored setting. Somebody who picks the other theme in this
 * window has not saved yet, and the switches follow the choice as it is made.
 */
/* ==========================================================================
   A WINDOW IS PART OF THE INTERFACE, SO THE SLIDER MOVES IT TOO
   ==========================================================================
   The scale multiplies the theme's own type and block sizes, which is what makes the
   CONTENTS of a window grow - and for a window that sizes itself to its contents that was
   the whole job. Sheets and dialogs do not: Foundry writes their width and height in pixels
   from the class's own defaults, so at 140 % the text grew inside a box that did not, and at
   80 % nothing moved at all ("zawartosc okien poprawnie sie powieksza, ale same okna juz
   nie", 07.09). The box is scaled here, once per render, from the size the application asked
   for rather than from whatever it is now - so re-rendering never compounds it, and a window
   the user has dragged wider keeps that width until it is rendered again.
   `auto` is left alone: a window that measures itself is already right. */
function scaleWindow(app, element) {
    const el = element instanceof HTMLElement ? element : element?.[0];
    /*
     * THE BOX IS BOTH THEMES' NOW (W-2, Dawid 19.09).
     *
     * It was the glass's alone, so on a Legacy client 140 % grew the type inside a
     * box that did not move and 80 % moved nothing at all - and because the
     * sheet's box never changed, the ResizeObserver in sheet.mjs never fired and
     * the action tiles were never re-measured either. At 100 % this writes the
     * numbers the window already has, and the `drpgScaled` memo below swallows
     * the repeat.
     */
    if (!el) return;
    const s = sliderScale();
    const key = String(s);
    if (el.dataset.drpgScaled === key) return;
    el.dataset.drpgScaled = key;
    const want = { ...(app?.constructor?.DEFAULT_OPTIONS?.position ?? {}), ...(app?.options?.position ?? {}) };
    /* THE CHARACTER SHEET HAS A SIZE OF ITS OWN.
       Daggerheart opens it at 850 x 800, which was right for its own type; at the theme's
       floor the five-tile action grid does not fit that width and the last column is cut off
       at the frame (Dawid's screen, 07.09). The theme states the size the sheet is DRAWN for
       - the audit page's proportions, one grid wide and one deep - and the interface scale
       multiplies it like everything else, so 140 % opens a bigger sheet rather than the same
       box with bigger text in it. */
    /* AND IT IS A STATEMENT ABOUT THIS THEME ONLY (W-2, 19.09). 1120 x 1160 is
       VT323 at 17px and a five-tile grid under the glass; handing it to Monokuma
       Legacy would open a pixel-font sheet two thirds empty and take its resize
       handle away for a size nobody measured. Legacy keeps Daggerheart's own
       850 x 800 multiplied by the slider, and keeps the handle - the rule that hides
       it names the glass.

       AND ABOUT ONE WINDOW, ASKED BY ITS DOCUMENT (UI-09). A class-name match on
       "actor" also caught Foundry's Actors sidebar tab and any window with the word
       in its name, and `documentName === "Actor"` caught NPC sheets - all of them
       were forced to this size and lost their resize handle. */
    if (document.body.classList.contains("drpg-theme-stained-glass")
        && app?.document?.type === "character") {
        /* 1160 high, NOT 940. Measured on the sheet: the tallest tab wants 820 px of room and
           was given 607, so the last row of Hope Calls was simply below the fold - the window
           was sized for the old, smaller type. The extra 213 px is that shortfall. The numbers
           live in config.mjs (SHEET_SIZE) beside the Legacy minimum. */
        want.width = SHEET_SIZE.glass.width;
        want.height = SHEET_SIZE.glass.height;
    }
    const size = {};
    for (const dim of ["width", "height"]) {
        const n = Number(want[dim]);
        if (Number.isFinite(n) && n > 0) size[dim] = Math.round(n * s);
    }
    /* A window may not be taller than the screen it is on. At 140 % a 1160 px sheet asks for
       1624, and Foundry will happily place a window whose bottom is off the display. */
    if (size.height) size.height = Math.min(size.height, Math.round(window.innerHeight - 48));
    if (size.width) size.width = Math.min(size.width, Math.round(window.innerWidth - 48));
    /* THE SHEET IS NOT RESIZED BY HAND UNDER THE GLASS - its size is a statement of that
       theme - and the handle is hidden by a THEME RULE in stained-glass.css rather than
       taken out of the DOM here. Removed here, it stayed gone after a switch to Monokuma
       Legacy, which keeps Daggerheart's size and was promised its handle (review of
       stage D): a one-way edit cannot follow a two-way switch, and a rule can. */
    if (!Object.keys(size).length) return;
    /* THROUGH `setPosition`, NOT THE ELEMENT'S STYLE. An ApplicationV2 writes its own
       `position` onto the element after every render, so an inline width set from the render
       hook was overwritten a moment later and the box never moved at all. Going through the
       application means the number it will write IS the scaled one, and it stays through the
       next re-render and through a drag. */
    if (typeof app.setPosition === "function") app.setPosition(size);
    else for (const [k, v] of Object.entries(size)) el.style[k] = v + "px";
}
Hooks.on("renderApplicationV2", scaleWindow);
Hooks.on("renderApplication", scaleWindow);

Hooks.on("renderSettingsConfig", (_app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;
    const themeField = root.querySelector(`[name="${MODULE_ID}.${SETTINGS.theme}"]`);
    const show = (key, on) => {
        const field = root.querySelector(`[name="${MODULE_ID}.${key}"]`);
        const row = field?.closest(".form-group");
        /* Inline, not a class: `.form-group` is `display: flex` in Foundry's own sheet,
           which outranks the `[hidden]` attribute's `display: none`. */
        if (row) row.style.display = on ? "" : "none";
    };
    const sync = () => {
        const glass = (themeField?.value ?? getSetting(SETTINGS.theme)) === "stainedGlass";
        /* The other theme's switches, hidden: the pulse, the ticker and the blur are
           the glass's alone. Reduced motion is NOT among them (W-3, 16.09 - see
           look.mjs): motion.css zeroes every motion token of the module under
           `drpg-reduced-motion`, popups and flares included, whichever theme is on. */
        for (const key of [SETTINGS.glassPulse, SETTINGS.hudTicker, SETTINGS.glassBlur]) show(key, glass);
        show(SETTINGS.pixelFont, !glass);
    };
    sync();
    themeField?.addEventListener("change", sync);
});
