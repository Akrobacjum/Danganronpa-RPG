/**
 * Danganronpa RPG — public API.
 * ---------------------------------------------------------------------------
 * Everything macros and journal buttons are allowed to call hangs off
 * `game.drpg`. Treat this as the stable surface: internal files may be
 * reshuffled between stages, this object should not break.
 */

import { DRPG, MODULE_ID, TRAITS, TRAIT_BY_DH } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { getUltimate, setUltimate, findDuplicateUltimates } from "./sheet.mjs";
import { openAdvancement, openAdvancementFor, applyAdvancement } from "./level-up.mjs";
import { auditAnonymity, explainOwnership } from "./anonymity.mjs";
import {
    getClock,
    setClock,
    clockSummary,
    timeOfDayLabel,
    phaseLabel,
    campaignName,
    setPhase,
    advanceTimeOfDay,
    rewindTimeOfDay,
    setTimeOfDay
} from "./clock.mjs";
import { renderHud } from "./hud.mjs";
import {
    monokumas,
    getDespair,
    setDespair,
    adjustDespair,
    fillAllDespair,
    spendDespairCall,
    despairMax,
    renderDespairBar,
    poolLabel,
    setPoolLabel,
    poolCandidates,
    addPool,
    removePool,
    convertDespairToHope
} from "./despair.mjs";
import {
    monokumaFor,
    studentsOf,
    students,
    assignments,
    assign,
    setAssignments,
    autoAssign,
    unassigned,
    pruneAssignments,
    feedsNobody,
    excludedStudents,
    NO_MONOKUMA
} from "./assignments.mjs";
import {
    diagnoseDice, diagnoseDespair, diagnoseStyles, diagnoseTruthBullets, diagnoseVoice,
    diagnoseWindows, traceClicks, fileSizes,
} from "./diagnostics.mjs";
import { runTests } from "./tests.mjs";
import {
    openStateExplainer, openDespairExplainer, openStatusExplainer, openProjectsExplainer
} from "./explain.mjs";
import {
    diagnoseCharacters
} from "./diagnostics.mjs";
import { performAction, currentRoom } from "./action-rolls.mjs";
import { installTables, openItemTables, drawItem, randomItem, tableName, usableKindFor,
    tableNameCandidates, refreshTableCopy } from "./tables.mjs";
import { roomOfActor, roomOfToken, othersInRoom, allRooms, neighbouringRooms, occupantsOf } from "./movement.mjs";
import { applyAll as refreshRoomVisibility, visibleCharacters, diagnoseVisibility }
    from "./visibility.mjs";
import {
    migrateRemnants, remnantData, reportRemnants } from "./remnants.mjs";
import { migrate1_2_0, migrationStatus } from "./migrate.mjs";
import {
    allProjects, visibleProjects, canSee, projectsAvailableIn, projectsListedIn,
    isComplete, addProgress, setProjectMeta,
    makeSecret, shareWith, unshareWith, revealProject, isSecret, viewersOf
} from "./projects.mjs";
import { openProjectManager, openShareDialog } from "./projects-ui.mjs";
import { callGm } from "./gm-bridge.mjs";
import { takeRest, roomAllows, restRooms, setRestRoom, openRestRoomsDialog } from "./rest.mjs";
import {
    dropRemnant, placeRemnant, remnantsOn, remnantsInRoom, rankForObserve,
    revealRemnant, removeRemnant, clearFaintRemnants,
    setRemnantFlags
} from "./remnants.mjs";
import { chooseObserveTarget, resolveObserve, clearPendingObserves } from "./observe.mjs";
import { resolveAnalyze } from "./analyze.mjs";
import { shareBullet, giveItem, shareBulletDialog, giveItemDialog } from "./handover.mjs";
import {
    presentBullet, presentDialog, presentedThisChapter, openObjectionLog, inClassTrial
} from "./trial.mjs";
import {
    isDeceased, deathRecord, livingStudents, killCharacter, reviveCharacter,
    discoverBody, revealAllBulletTypes, sweepTruthBullets,
    openDeathDialog, openBodyDiscoveryDialog, openChapterEndDialog
} from "./chapter.mjs";
import {
    keyPlan, setKeyPlan, keyPlanStatus,
    openInvestigationDashboard, openKeyRemnantHere
} from "./investigation.mjs";
import {
    trialFloor, floorHolder, floorTarget, maySpeak, secondsLeft,
    startFloor, openObjection, openRebuttal, returnToDiscussion, advanceFloorNow,
    extendFloor, endFloor
} from "./trial-floor.mjs";
import { openVote, closeVote, applyVerdict, openVerdictDialog, trialProgress } from "./vote.mjs";
import {
    murderState, sideOf, isTheirTurn, availableCrisisActions,
    openMurder, resolveKillerOpening, resolveVictimOpening,
    takeCrisisAction, resolveCrisisAction, passTurn, thirdPartyEnters, beginResolution, endMurder,
    openMurderDialog, openIncidentTracker
} from "./murder.mjs";
import {
    cleanableRemnants, attemptCleanup, resolveCleanup, openCleanupDialog, isCleaner,
    openMoveBodyDialog,
    attemptStageSix, resolveStageSix
} from "./cleanup.mjs";
import {
    currentState, musicStatus, diagnoseMusic, refreshMusic, openSoundDialog,
    playTrack, resetMusic, situationalPlaylist
} from "./music.mjs";
import {
    playSfx, testSfx, diagnoseSfx, soundFor, setSoundFor, sfxVolume, setSfxVolume
} from "./sfx.mjs";
import { repaintFog, diagnoseFog, applySceneVisionMode, seedDiscovery, prepareScenes,
    restoreSceneVisionMode, diagnoseScenes, whyBlack, fogAnimations, fogPeek, doorwayReport,
    checkRegions } from "./fog.mjs";
import {
    isMonocub, monocubActors, eligibleForMonocub, setMonocub, setSilenced, isSilenced,
    meddleTargets, performMeddle, resolveMeddle, meddleDialog,
    openMonocubDialog
} from "./monocub.mjs";
import {
    mastermindActor, isMastermind, setMastermind, clearMastermind,
    mastermindLair, setMastermindLair, myLairRoom,
    finalTruthPlacedThisChapter, finalRemnants, placeFinalRemnant,
    inFinalTrial, setFinalTrial,
    openMastermindDialog, openFinalVerdictDialog, applyFinalVerdict
} from "./mastermind.mjs";
import {
    grantItem, canCarry, countInCategory, itemsInCategory, carriedInCategory,
    inventorySummary, isStashed, locationOf, isBroken, breakItem
} from "./inventory.mjs";
import {
    vaultRoomFor, vaultOwnerOf, vaultContents, allVaults, isConcealed,
    roomTable, roomFavours, favoursCategory, roomHinders, hindersCategory, setVaultRoom,
    stow, retrieve, stealFromVault, openRoomSetupDialog, openVaultInspector,
    openStashHere, rifleStashDialog,
    keysHeldBy, mayEnterBedroom, grantBedroomKey, reconcileBedroomKeys
} from "./vault.mjs";
import {
    useItem, toggleEquipped, isUsable, usableKindOf, isEquippable, isEquipped, equippedIn,
    grantItemEffect, discardBroken
} from "./use-items.mjs";
import { syncStates, syncAll as syncAllStates } from "./states.mjs";
import { openItemManager, issueAutopsyDialog } from "./gm-items.mjs";
import {
    createTruthBullet, truthBulletData, bulletsOf, isTruthBullet,
    isAnalysable, analysableBullets,
    issueAutopsy, migrateTruthBullets, secretOf, setSecret, dropSecret,
    exportLedger, importLedger
} from "./truth-bullets.mjs";
import {
    isMonokuma, setMonokuma, monokumaActors, studentActors,
    poolUserFor, poolFor, setPoolFor, monokumasWithoutPool
} from "./monokuma.mjs";
import { openGmTeamDialog } from "./gm-team-dialog.mjs";
import { rules, addRule, updateRule, removeRule, openRulesManager, motive, setMotive } from "./rules.mjs";
import { spendHopeCall, spendDespairCallFor, hopeHeld, affordableHopeCalls, despairCallsFor } from "./calls.mjs";
import { openMessenger } from "./messenger-app.mjs";
import {
    sendMessage as sendMessengerMessage,
    threadMessages as messengerThreadMessages,
    totalUnread as messengerUnreadTotal
} from "./messenger.mjs";
import {
    scheduleReconcile as reconcileVoice,
    eavesdropRoom, voicePlan, voiceTargets,
    stopEavesdropping,
    resetAllVoice,
    openEavesdropDialog as voiceEavesdropDialog
} from "./voice.mjs";
import {
    startEclipse, endEclipse, isEclipse, movesLeft, placementStatus, ruleOnParkedMurder
} from "./eclipse.mjs";
import { createProject, deleteProject, updateProject } from "./projects.mjs";
import {
    actionBudget,
    actionsLeft,
    actionsMax,
    spendAction,
    refundAction,
    setActions,
    resetActionsFor,
    resetAllActions,
    hasFreeMove,
    takeMove,
    restoreFreeMove
} from "./actions.mjs";
import { openGmPanel, openClockDialog } from "./gm-panel.mjs";
import {
    initCharacter,
    resourceMax,
    resourceValue,
    remaining,
    isBrokenDown,
    isWounded,
    validateTraitSpread,
    listExperiences
} from "./character.mjs";
import {
    ownerOf,
    whisperToOwner,
    whisperToGms,
    gmIds,
    activeGmIds,
    isPrimaryGm,
    resolveThreshold,
    clamp,
    log
} from "./utils.mjs";

export const DrpgApi = {
    /** Static rules data straight from the guide. */
    config: DRPG,

    /** Module id, handy when writing flags from a macro. */
    id: MODULE_ID,

    /* ---- traits -------------------------------------------------------- */

    /** Map a DRPG trait key ("eye") to the Daggerheart key ("instinct"). */
    traitKey(drpgKey) {
        return TRAITS[drpgKey]?.dh ?? drpgKey;
    },

    /** Map a Daggerheart trait key ("instinct") back to DRPG ("eye"). */
    traitFromDh(dhKey) {
        return TRAIT_BY_DH[dhKey] ?? dhKey;
    },

    /** Current value of a DRPG trait on an actor. */
    traitValue(actor, drpgKey) {
        const dh = this.traitKey(drpgKey);
        return actor?.system?.traits?.[dh]?.value ?? 0;
    },

    /* ---- characters ---------------------------------------------------- */

    /** Write the guide's starting resources onto an actor: Health 4, Sanity 6, Hope 2. */
    initCharacter,

    /** Read/write the Ultimate shown under the character's name. */
    getUltimate,
    setUltimate,

    /** Every Ultimate that appears on more than one character this season. */
    findDuplicateUltimates,

    /** Resource readers. Health and Sanity are reverse resources — see character.mjs. */
    resourceMax,
    resourceValue,
    remaining,
    isBrokenDown,
    isWounded,

    /** Does this actor's trait spread match +2/+1/+1/0/0/-1? Reports only. */
    validateTraitSpread,
    listExperiences,

    /* ---- advancement --------------------------------------------------- */

    /** Open the Advancement dialog. kind: "standard" (pick 1) or "reinforced" (pick 3). */
    advance: openAdvancement,

    /** Ask which advancement was earned first. This is what the sheet button uses. */
    advanceFor: openAdvancementFor,
    applyAdvancement,

    /* ---- safety -------------------------------------------------------- */

    /** Report every character sheet that is visible to the wrong people. */
    auditAnonymity,

    /** Who can open this sheet, at what level, and with what user role. */
    explainOwnership,

    /* ---- clock --------------------------------------------------------- */

    /** Campaign name / chapter / phase / session / time of day. */
    getClock,
    setClock,
    clockSummary,
    timeOfDayLabel,
    phaseLabel,
    campaignName,

    /** Phase: "dailyLife" | "investigation" | "classTrial". */
    setPhase,

    /** Move to the next time of day: refills actions, free Moves, search tokens. */
    advanceTimeOfDay,

    /** Step back one time of day. A correction — refills nothing. */
    rewindTimeOfDay,
    setTimeOfDay,

    /** Open the GM panel (also on the token toolbar as a clock icon). */
    gmPanel: openGmPanel,

    /** Open the clock editor (also the gear on the HUD). */
    editClock: openClockDialog,

    /** Force the top-of-screen HUD to redraw. */
    renderHud,

    /* ---- despair ------------------------------------------------------- */

    /** Full Gamemasters only — Assistant GMs do not get a Monokuma pool. */
    monokumas,
    despairMax,
    getDespair,
    setDespair,
    adjustDespair,

    /** Top every Monokuma up to 12 — the guide does this after a wrong vote. */
    fillAllDespair,

    /** Pay for one of the guide's Despair Calls and announce it. */
    spendDespairCall,
    renderDespairBar,

    /** A pool's display label — custom if set, the account name otherwise —
     *  and the controls to rename a pool or grant/revoke one for an
     *  Assistant GM. Also on the GM team panel. */
    poolLabel,
    setPoolLabel,
    poolCandidates,
    addPool,
    removePool,

    /* ---- student division ---------------------------------------------- */

    /** Which Monokuma looks after this character (falls back to the first). */
    monokumaFor,

    /** Characters carried by one Monokuma. */
    studentsOf,
    students,
    assignments,
    assign,
    setAssignments,

    /** Split every student evenly between Monokumas, in name order. */
    autoAssign,
    unassigned,
    pruneAssignments,

    /** Assign an actor to NO_MONOKUMA to keep them out of every Despair pool. */
    NO_MONOKUMA,
    feedsNobody,
    excludedStudents,

    /* ---- actions as abilities ------------------------------------------ */

    /** Run one of the guide's actions end to end: roll, resolve, apply, report. */
    performAction,

    /** Which room region the character's token is standing in. */
    currentRoom,
    roomOfActor,
    roomOfToken,
    othersInRoom,
    allRooms,

    /** Rooms adjacent to this one — used by Listen. */
    neighbouringRooms,
    occupantsOf,

    /** Recompute who each player can see. GMs always see everything. */
    refreshRoomVisibility,
    visibleCharacters,

    /* ---- projects ------------------------------------------------------ */

    /** Countdowns, plus the room and secrecy Daggerheart does not model. */
    allProjects,

    /** The same list, minus every secret project this user may not know about.
        Anything shown to a player must come from here, never `allProjects`. */
    visibleProjects,
    canSee,
    projectsAvailableIn,

    /** The same list with finished projects left in, which is what a picker
     *  shows: struck through rather than absent. */
    projectsListedIn,

    /** Is this project already at its target? */
    isComplete,
    addProgress,
    setProjectMeta,
    createProject,

    /** Rename, re-scale, re-room or re-portrait a project without losing its
     *  progress or its id — everything pointing at it keeps pointing at it. */
    updateProject,
    deleteProject,

    /** Indirect murder projects are secret by default. */
    makeSecret,
    revealProject,
    isSecret,
    viewersOf,
    shareProject: shareWith,
    unshareProject: unshareWith,

    /** Dialogs: rooms and secrecy, and letting a co-conspirator in. */
    manageProjects: openProjectManager,
    shareProjectDialog: openShareDialog,

    /** Whisper a ruling request to the GMs. */
    callGm,

    /* ---- rest ---------------------------------------------------------- */

    /** Short rest: 1 action, pick 1. Long rest: 2 actions, pick 2, bedroom only. */
    takeRest,
    roomAllows,
    restRooms,
    setRestRoom,

    /** Mark which rooms on this scene allow which rest. */
    manageRestRooms: openRestRoomsDialog,

    /* ---- remnants & inventory ------------------------------------------ */

    /** Drop a Remnant where a character stands: hidden, translucent, under tokens. */
    dropRemnant,
    placeRemnant,
    remnantsOn,
    remnantsInRoom,
    revealRemnant,
    removeRemnant,

    /** Everything recorded on a Remnant: type, visibility, who left it, when. */
    remnantData,
    reportRemnants,

    /** Chapter end: clear Faint Remnants that are neither reinforced nor tied to the crime. */
    clearFaintRemnants,

    /** Edit which Remnants survive the chapter. Also on the Investigation Dashboard's "Traces" tab. */
    setRemnantFlags,

    /** Give or take an item, as the GM. Also on the sheet and the GM panel. */
    manageItems: openItemManager,

    /** Put a found item on a character, respecting the guide's carry limits. */
    grantItem,
    canCarry,
    countInCategory,
    itemsInCategory,
    carriedInCategory,
    inventorySummary,

    /* ---- the stash --------------------------------------------------------
     * A stashed item is an ordinary item on its owner's sheet with a `location`
     * flag — which is why the death procedure empties stashes without knowing
     * they exist. Uncapped; the carry limit only measures what is in hand. */

    isStashed,
    locationOf,
    vaultRoomFor,
    vaultOwnerOf,
    vaultContents,
    allVaults,
    isConcealed,

    /** Free, no roll, and only from inside the room itself. */
    stow,
    retrieve,

    /** Search found somebody else's hiding place. GM-side. */
    stealFromVault,

    /** An UNCONCEALED stash in the room you are standing in is just a drawer:
     *  free to go through, no roll. A concealed one still needs a Search. */
    openStashHere,
    rifleStash: rifleStashDialog,

    /* ---- using what you carry ---------------------------------------------
     * Neither costs an action — the guide charges for finding and making
     * things, not for opening them. */

    /** Spend a Usable Item. Tiers 1/2 restore what the item's kind says —
     *  healing items Health, stress-relief items Sanity, read off the item tables;
     *  tier 3 asks Health or Sanity and adds 2 Hope; tier 0 is "open to creative
     *  use" and goes to the GM as a ruling. */
    useItem,

    /** Which kind of usable this item is: "healing", "stress", or null when
     *  neither the item tables nor the item itself say. */
    usableKindOf,

    /** Throw away something that has been used up. Rolls Shadow and leaves a
     *  Remnant priced by the result — the only route out of an inventory for a
     *  broken item apart from a bedroom stash. */
    discardBroken,

    /** Has this been used up? A broken item still occupies its carry slot. */
    isBroken,

    /** Mark something as used up without deleting it. GM-side repair for a
     *  world where a tool went missing the old way. */
    breakItem,

    /** Hold one Crime Tool or Cleaning Tool ready. One per category — this is
     *  what the incident engine reads before falling back to "the best you own". */
    toggleEquipped,
    equippedIn,
    isUsable,
    isEquippable,
    isEquipped,

    /** Finish a Tier 0 creative use the GM has agreed to. */
    grantItemEffect,

    /* ---- Breakdown and Wounded --------------------------------------------
     * The guide's two player states, replacing Daggerheart's Vulnerable and
     * Death Move. Applied automatically; these are for a manual re-check. */

    syncStates,
    syncAllStates,

    /* ---- what a room is ---------------------------------------------------
     * Which table it draws from, and what it is a sensible — or a poor —
     * place to look for. */

    roomTable,
    roomFavours,
    favoursCategory,
    roomHinders,
    hindersCategory,
    setVaultRoom,

    /** Owner, concealment, table and favoured categories, on one screen. */
    roomSetup: openRoomSetupDialog,
    inspectVaults: openVaultInspector,

    /* ---- bedroom keys -----------------------------------------------------
     * A bedroom is shut to everybody but its owner and whoever they let in, and
     * the way in is an item. `issueMissingKeys` is the repair: it runs on load
     * and on every Room Setup save, and it is here so a GM who suspects a key
     * never arrived can say so out loud rather than reassigning a room to force
     * it. It reports how many it had to make — zero means the world was already
     * right. */

    keysHeldBy,
    mayEnterBedroom,
    giveBedroomKey: grantBedroomKey,
    issueMissingKeys: reconcileBedroomKeys,

    /* ---- Truth Bullets --------------------------------------------------
     * A bullet is split in two: the Item the player holds carries only what
     * they may know, and what it REALLY is lives in a GM-side ledger that is
     * never sent to a player's client. `truthBulletData` merges the halves the
     * caller is entitled to — for a player, that is one half. */

    /** The single creation path: Observe, the GM dialog and macro 03 all use it. */
    createTruthBullet,
    truthBulletData,
    bulletsOf,
    isTruthBullet,

    /** Hand the Autopsy bullet to everyone still alive (decision D2). */
    issueAutopsy,
    issueAutopsyDialog,

    /** The GM-side answer key. `secretOf` returns {} for anyone who is not a GM. */
    secretOf,
    setSecret,
    dropSecret,

    /** The ledger lives in browser storage, so it can be backed up and restored. */
    exportLedger,
    importLedger,

    /** Bring bullets made before Stage 1 up to the current shape. Idempotent. */
    migrateTruthBullets,
    migrateRemnants,

    /* ---- 1.2.0 data migration -------------------------------------------
     * Runs by itself at `ready` on the primary GM's client whenever the
     * installed version has moved. These are the repair route. */

    /** Re-run every clause. `{ force: true }` ignores the version stamp. */
    migrate1_2_0,

    /** What the migration thinks of this world, without writing anything. */
    migrationStatus,

    /* ---- Observe --------------------------------------------------------
     * Resolved on the GM's client, never the observer's: the room's Remnants
     * and their difficulties are exactly what the player must not know. */

    /** The Remnants in a room as Observe ranks them: crime-tied first, then easiest. */
    rankForObserve,

    /** GM side: fix a target before the roll, then score the roll against it. */
    chooseObserveTarget,
    resolveObserve,
    clearPendingObserves,

    /* ---- Analyze --------------------------------------------------------
     * Also GM-side: the difficulty is read from what the bullet really is,
     * which is the very thing the roll is trying to buy. */

    /** Can this bullet still be worked on, or is it identified / locked this chapter? */
    isAnalysable,
    analysableBullets,

    /** GM side: convert the bullet, or lock it for the rest of the chapter. */
    resolveAnalyze,

    /* ---- passing things on ----------------------------------------------
     * Same room, no action. A Truth Bullet is copied — the giver keeps theirs;
     * an item is moved and the giver loses it. */

    shareBullet,
    giveItem,

    /** The pickers the inventory buttons open. */
    shareBulletDialog,
    giveItemDialog,

    /* ---- Class Trial ----------------------------------------------------
     * A presentation is one object seen two ways: a public ChatMessage that is
     * the trial's record, and a popup every client raises from it. */

    presentBullet,
    presentDialog,
    inClassTrial,

    /** Who put what in front of the table, newest first. Also on the GM panel. */
    presentedThisChapter,
    objectionLog: openObjectionLog,

    /** Open and close the Nonstop Debate inside a running trial. The player's
     *  Truth Bullet button is a Present outside one and an Objection inside. */
    openDebate: (...a) => import("./trial-floor-ui.mjs").then(m => m.openDebate(...a)),
    closeDebate: (...a) => import("./trial-floor-ui.mjs").then(m => m.closeDebate(...a)),

    /* ---- the chapter's life -----------------------------------------------
     * None of these fire on a clock tick. Two of them delete things that do not
     * come back, and "the chapter has ended" is a judgement about the fiction,
     * not a number changing. Every one is a GM button. */

    /** The dead stay on the map but stop counting as being in the room. */
    isDeceased,
    deathRecord,
    livingStudents,

    /** D1 in one procedure: inventory and Truth Bullets destroyed, body marked. */
    killCharacter,

    /** Un-mark a mis-click. Does NOT bring the destroyed inventory back. */
    reviveCharacter,

    /** Promote the traces, call everyone in, switch to Investigation. */
    discoverBody,

    /** Chapter's end: every bullet gives up what it really was. */
    revealAllBulletTypes,

    /** New session: clear the evidence out, Faint excepted. */
    sweepTruthBullets,

    /** The dialogs behind the GM panel's entries. */
    deathDialog: openDeathDialog,
    bodyDiscoveryDialog: openBodyDiscoveryDialog,
    chapterEndDialog: openChapterEndDialog,

    /* ---- the GM's Investigation workshop -----------------------------------
     * Five clues, scaled trivial to desperate, and a read-out of who has
     * reached what. GM-only in the strongest sense: it reads the answer key in
     * bulk, and the answer key only exists on a GM's browser. */

    keyPlan,
    setKeyPlan,

    /** The plan scored against the map and the players' sheets. */
    keyPlanStatus,

    investigationDashboard: openInvestigationDashboard,
    /** One clue, in one room, optionally filling a slot in the plan. Also the
     *  button on an Observe ruling card. */
    keyRemnantHere: openKeyRemnantHere,

    /* ---- the murder engine -------------------------------------------------
     * Two opening rolls, then a turn-based incident. The module owns the
     * numbers — thresholds, the drain, turn order, damage, which Remnants each
     * outcome leaves — and hands the prose to the GM. */

    murderState,
    sideOf,
    isTheirTurn,
    availableCrisisActions,

    openMurder,
    resolveKillerOpening,
    resolveVictimOpening,

    /** The participant's own roll, and the GM-side scoring behind it. */
    takeCrisisAction,
    resolveCrisisAction,

    passTurn,
    thirdPartyEnters,
    /** Stage 6 without a Finishing Blow, for a victim who died some other way. */
    beginResolution,
    endMurder,

    murderDialog: openMurderDialog,
    incidentTracker: openIncidentTracker,

    /* ---- Stage 6: cleaning up ----------------------------------------------
     * Once the incident ends the killer can see what they left and spend Sanity
     * trying to erase it. Reinforced traces refuse to go; a botched wipe leaves
     * a Resolution Remnant of its own; the tools used are destroyed when the
     * murder is closed. Scored on a GM's client, because the threshold is read
     * off how visible the trace is — the answer key. */

    /** Every trace in the killer's room, with what it would take to erase it. */
    cleanableRemnants,

    /** The killer's picker, and the roll behind it. */
    cleanupDialog: openCleanupDialog,

    /** Pick where the body goes, then roll to carry it. */
    moveBodyDialog: openMoveBodyDialog,
    attemptCleanup,
    resolveCleanup,

    /** Is this actor the one cleaning up right now? */
    isCleaner,

    /** The guide's other two Stage 6 actions: plant a Prep Remnant pointing at
     *  somebody else ("misleadingTrail"), or carry the body out of the room
     *  ("moveBody"). Both cost 1 Sanity and need the killer standing there. */
    attemptStageSix,
    resolveStageSix,

    /* ---- Monocub -----------------------------------------------------------
     * A dead student's player, opted in after their trial. Same actor, same
     * action budget, restricted to Move and Meddle. Meddle's flat 2d12 has no
     * trait behind it — the guide's own "Stat: —" — and its effect reuses the
     * same Call machinery Support and Obstacle already use. */

    isMonocub,
    monocubActors,
    eligibleForMonocub,

    /** Opt in or out. Only ever on a character already marked dead. */
    setMonocub,

    /** The guide's "stumbled onto the crime" ban, until the chapter ends. */
    setSilenced,
    isSilenced,

    /** GM-driven: spend a Monokuma's Despair to give somebody Hope, 1:1.
     *  Shared with the Mastermind below — the guide gives both the same trade. */
    convertDespairToHope,

    meddleTargets,
    meddleDialog,
    performMeddle,
    resolveMeddle,

    monocubDialog: openMonocubDialog,

    /* ---- the Mastermind -----------------------------------------------------
     * The one secret this module treats as more sensitive than a Truth
     * Bullet's real type: never an actor flag, never world data. It lives in a
     * client-scoped setting on GM browsers only — see the note on
     * SETTINGS.mastermind for why a flag would have been a real leak. */

    /** `null` for anyone who is not a GM. Never guess otherwise. */
    mastermindActor,
    isMastermind,
    setMastermind,
    clearMastermind,

    /** The lair: GM-side read/write, and the private client-side read. */
    mastermindLair,
    setMastermindLair,
    myLairRoom,

    /** The guide's "co rozdział" cadence check — informational only. */
    finalTruthPlacedThisChapter,

    /** The endgame's own clues, and the one place they are placed from. */
    finalRemnants,
    placeFinalRemnant,

    /** Flavour flag only: everyone already knows a Final Trial is happening. */
    inFinalTrial,
    setFinalTrial,

    mastermindDialog: openMastermindDialog,
    finalVerdictDialog: openFinalVerdictDialog,
    applyFinalVerdict,

    /* ---- the Class Trial ---------------------------------------------------
     * The floor is a shared clock in world data. The ballots are not: they are
     * addressed to the GMs over the socket and counted in memory, because
     * "wyniki jawne, głosy nie" and world data is not private (D6). */

    /* The floor is three modes rather than a queue: a free discussion, the
     * minute an OBJECTION buys its objector, and the two minutes of rebuttal
     * that follow it. `maySpeak` is the one question all of it answers. */
    trialFloor,

    /** How far through this chapter's trial the table has got: the debate's
     *  budget, whether the vote has been counted and whether the verdict has
     *  been applied. The GM console's two gates read this. */
    trialProgress,

    /** Kept under its old name: callers only ever asked "is a trial running". */
    trialQueue: trialFloor,
    trialHolder: floorHolder,
    trialTarget: floorTarget,
    trialMaySpeak: maySpeak,
    trialSecondsLeft: secondsLeft,
    startFloor,

    /** An OBJECTION calls this by itself — presenting evidence takes the floor. */
    openObjection,
    openRebuttal,
    returnToDiscussion,
    /** The transition the clock would have made, made now. */
    advanceFloorNow,
    extendFloor,
    endFloor,

    openVote,
    closeVote,
    applyVerdict,
    verdictDialog: openVerdictDialog,

    /** Item pools and the RollTables built from them. */
    installTables,
    /** The editor over those tables: what is in them, and adding to them. */
    itemTables: openItemTables,
    drawItem,
    randomItem,
    tableName,
    /** Which kind of usable a NAME is, read off the Healing and Sanity Relief
     *  tables: "healing", "stress", "both" or null. */
    usableKindFor,
    /** Every name a tier table could be sitting under, today's first — labels
     *  get reworded and the old names stay valid. See LEGACY_PLURALS. */
    tableNameCandidates,
    /** Bring installed tables' names and blurbs up to today's wording. Runs
     *  itself at load; here for a GM who wants to see what it did. */
    refreshTableCopy,

    /* ---- the panels explain themselves ---------------------------------
     * What each on-screen widget is, plus where things stand right now.
     * Opened by clicking the panel; here so a macro or a journal button can
     * hand somebody the same window. Anyone may open any of them — each one
     * shows only what its own widget already shows that user. */
    explainState: openStateExplainer,
    explainDespair: openDespairExplainer,
    explainStatus: openStatusExplainer,
    explainProjects: openProjectsExplainer,

    /* ---- diagnostics --------------------------------------------------- */

    /** Why are the dice unskinned? Why is no Despair being awarded? */
    diagnoseDice,
    /** Why can this player see a token in another room? Run it on THEIR
     *  client: it prints every character's room beside whether the token is
     *  visible, which is what tells the two failure modes apart. */
    diagnoseVisibility,
    diagnoseDespair,

    /** Who is still missing the guide's starting resources — run before a session
     *  zero. Also a tile in the GM panel. */
    diagnoseCharacters,

    /** Why does the sheet look different here than on another install? */
    diagnoseStyles,

    /** Why is a Foundry config window cut off at its right edge? Open the
     *  window that is wrong FIRST, then run this — every line measures that
     *  window. It also reports which version of the stylesheet this page has,
     *  which is the answer whenever a fix works locally and not on a host. */
    diagnoseWindows,

    /** Why did that click not do anything? Run it, then click the control that
     *  misbehaves a few times. Twenty seconds later it posts what it saw:
     *  whether something was on top of the control, whether the control was
     *  torn out of the page mid-click, or whether the click fired and was
     *  cancelled. Every listener it adds is passive, so it cannot be the cause
     *  of what it is measuring. */
    traceClicks,

    /** Which of this module's files the server is actually serving, by size,
     *  fetched past the browser cache. The answer to "I updated it and the fix
     *  is still not there" on a hosted world. */
    fileSizes,
    runTests,

    /** Are the bullets and their answer key still in step, and do the rows render? */
    diagnoseTruthBullets,

    /** Which of the five links in per-region voice is the broken one. Run it on
     *  the client that is complaining, not only on the GM's. */
    diagnoseVoice,

    /* ---- Monokumas ----------------------------------------------------- */

    /** A Monokuma is a character actor with a flag: no actions, no Hope. */
    isMonokuma,
    setMonokuma,
    monokumaActors,
    studentActors,

    /** Which GM's Despair pool a Monokuma actor draws on. */
    poolUserFor,
    poolFor,
    setPoolFor,

    /** Monokumas nobody has pointed at a pool yet. */
    monokumasWithoutPool,

    /** Mark actors as Monokumas, say whose Despair each spends, and divide
     *  students between Monokumas — one combined panel, GM panel only. */
    gmTeamPanel: openGmTeamDialog,

    /* ---- the killing game's rules ------------------------------------------
     * Monokuma's standing rules, on every character sheet in the slot the
     * system uses for Effects. The 12-Despair New Rule Call writes here too. */

    rules,
    addRule,
    updateRule,
    removeRule,
    rulesManager: openRulesManager,

    /** Monokuma's motive: public by definition, and it lapses on its own when
     *  the chapter counter moves. `setMotive(null)` withdraws it. */
    motive,
    setMotive,

    /* ---- calls --------------------------------------------------------- */

    /** Hope Calls for players, Despair Calls for Monokumas. */
    spendHopeCall,
    spendDespairCallFor,
    hopeHeld,
    affordableHopeCalls,
    despairCallsFor,

    /* ---- eclipse ------------------------------------------------------- */

    /** The placement window between two times of day. Never counts as a day. */
    startEclipse,
    endEclipse,
    isEclipse,
    eclipseMovesLeft: movesLeft,
    placementStatus,

    /** Allow or refuse a direct murder declared in the dark, when the card that
     *  asks has been lost: `game.drpg.ruleOnParkedMurder(killerId, true)`. The
     *  GM is asked again at the lights either way, so this is a shortcut rather
     *  than the only way through. */
    ruleOnParkedMurder,

    /* ---- actions ------------------------------------------------------- */

    /** 2 per time of day, or 1 while all Health is marked. */
    actionBudget,
    actionsLeft,
    actionsMax,
    spendAction,
    refundAction,
    setActions,
    resetActionsFor,
    resetAllActions,

    /** One free Move per time of day; further Moves cost an action. */
    hasFreeMove,
    takeMove,
    restoreFreeMove,

    /* ---- search tokens ------------------------------------------------- */

    searchTokens: SearchTokens,

    /** Shorthands kept for the existing GM macros. */
    tokensLeft: roomName => SearchTokens.left(roomName),
    useToken: roomName => SearchTokens.spend(roomName),
    resetTokens: () => SearchTokens.reset(),
    showTokens: () => SearchTokens.report(),

    /* ---- chat ---------------------------------------------------------- */

    ownerOf,
    whisperToOwner,
    whisperToGms,
    gmIds,
    activeGmIds,
    isPrimaryGm,

    /* ---- messenger ------------------------------------------------------
     * One shared thread per player: the player and every current GM read and
     * write into the same conversation. callGm() (above) posts its ruling
     * requests into these same threads. */

    /** Open (or focus) a player's GM-chat window. Defaults to your own. */
    openMessenger,
    sendMessengerMessage,
    messengerThreadMessages,
    messengerUnreadTotal,

    /* ---- voice ----------------------------------------------------------
     * Regions become LiveKit breakout rooms via avclient-livekit, if it is
     * installed, active, and the world setting is on. Every function here is
     * a safe no-op otherwise. */

    /** Re-check every player's room and reassign voice now, skipping the debounce. */
    reconcileVoice,

    /** Join a room's voice channel as a muted listener. `null` leaves it. */
    eavesdropRoom,
    voicePlan,
    stopEavesdropping,

    /**
     * The raw decision behind `voicePlan()` — one entry per connected account,
     * plus every character's claim on it. The loop, the answer given to a client
     * that asks, and the printed plan all come from here, so a test that asserts
     * against this is asserting against the thing that actually runs.
     */
    voiceTargets,

    /** Send everyone currently assigned back to the main room. */
    resetAllVoice,

    /** Open the room picker (also on the GM panel's "More…" menu). */
    voiceEavesdropDialog,

    /* ---- music -------------------------------------------------------------
     * The playlist follows the state. No socket: playlists are world documents,
     * so the primary GM's playback is everyone's. An incident deliberately has
     * no entry — see music.mjs. */

    /** Which state owns the music right now, by key. */
    musicState: currentState,

    /** State, chosen playlist, what is actually playing. For "why this track?". */
    musicStatus,

    /** Every state, whether it applies, and what it is mapped to — the four
     *  reasons a state never takes over, printed at once. */
    diagnoseMusic,

    /** Re-evaluate now, after changing the map or the clock by hand. */
    refreshMusic,

    /* ---- the room fog ------------------------------------------------------
     * "I can see the whole map" looks identical whether the setting is off,
     * the scene has no Regions, the layer failed to mount, or every room is
     * already discovered. `diagnoseFog()` names which one it is, in the order
     * the checks actually run — run it on the PLAYER's client, since the fog
     * deliberately never draws on a GM's. */
    diagnoseFog,
    /** Repaint now, after editing the fog table or a Region by hand. */
    repaintFog,
    /** GM: put this scene into room-based visibility (token vision off). */
    applySceneVisionMode,
    /** Primary GM: do the same for EVERY scene that has rooms drawn on it. */
    prepareScenes,
    /** GM: give one scene back the vision settings it had before the module. */
    restoreSceneVisionMode,
    /** Which scenes with rooms are ready for players, as text. */
    diagnoseScenes,
    /** Every object the fog layer currently has on screen. Run it WHILE the
     *  picture is wrong — `diagnoseFog` says what the fog meant to do, this
     *  says what is actually in front of the map. */
    whyBlack,
    /** Why each stretch of the current room's border counts as a doorway or
     *  not — the overlap test, the wall test and the passability test, each
     *  reported in its own column. */
    doorwayReport,
    /** Check every room on this scene against the rules the fog depends on:
     *  overlapping rooms, borders drawn away from their walls, openings too
     *  long to be doorways, corners off the grid. Reports, never repairs — the
     *  map belongs to the GM. Also on a button in Room setup ▸ Fog. */
    checkRegions,
    /** Hide both fog layers for a few seconds, then put them back. Answers
     *  "is that thing on screen ours?" without pasting a chain of lookups. */
    fogPeek,
    /** Turn the reveal and the dissolve off (or back on) without a reload.
     *  The way out of a bad frame mid-session: `game.drpg.fogAnimations(false)`. */
    fogAnimations,
    /** Primary GM: record the room every character is ALREADY standing in.
     *  Runs itself on `canvasReady`; exposed so "why is nothing discovered"
     *  can be answered by calling it and reading what it returns. */
    seedDiscovery,

    /** The Sound window: Play, Music and Effects, with the two volume sliders
     *  above them. `musicDialog` is the name it had while it was only about
     *  music and still works. */
    soundDialog: openSoundDialog,
    musicDialog: openSoundDialog,
    /** One track from the cue playlist on repeat, holding everything that was
     *  playing; and the way back. `playTrack` takes a sound id or a track name,
     *  `resetMusic` stops the cue dead and gives back what it interrupted. */
    playTrack,
    resetMusic,
    /** The playlist those two work on, found by name. Null when the world has
     *  no playlist called "Situational" — which is the whole of "the Play
     *  button does nothing". */
    situationalPlaylist,

    /* ---- Sound ----------------------------------------------------------
     * The module ships no audio; a GM maps their own files in the Sound panel.
     * An event with no file is silent and that is not a fault — so when
     * something is expected and nothing is heard, `diagnoseSfx` is the answer
     * and `testSfx` is the proof. */

    /** Play one event on THIS browser. Silent if no file is mapped to it. */
    playSfx,
    /** Play one event now, past the cooldown and the autoplay lock, and say
     *  WHY if it could not — five different things make a test button silent
     *  and only one of them is a broken file. `await` it: the last of the five
     *  is whether the file loads, which is not known when it is asked for. */
    testSfx,
    /** Everything this browser knows about sound without playing any: what is
     *  mapped, what is muted (ours AND Foundry's), whether the browser has been
     *  clicked yet, and which files have already failed. */
    diagnoseSfx,
    /** The file mapped to an event, and the GM-only way to change it. */
    soundFor,
    setSoundFor,
    /** The two volume sliders, per browser. `music` is a proxy for Foundry's
     *  own playlist volume rather than a second, competing number. */
    sfxVolume,
    setSfxVolume,

    /* ---- misc ---------------------------------------------------------- */

    resolveThreshold,
    clamp,

    settings: {
        keys: SETTINGS,
        get: getSetting,
        set: setSetting
    }
};

/* ==========================================================================
 * "AN ACTOR OR AN ID" — normalising the surface
 * --------------------------------------------------------------------------
 * This object is the stable surface macros are told to use, and it was not
 * behaving like one. Some entries take an Actor document, some take an actor
 * id, and a few take an id in one position and a document in another
 * (`convertDespairToHope(userId, actor, n)`). Nothing announced which.
 *
 * The failure mode is what makes it worth fixing rather than documenting.
 * Passing an id where a document was wanted does not produce "expected an
 * Actor" — it produces `actor.update is not a function` from inside
 * resource-guard.mjs, or `actor.testUserPermission is not a function` from
 * inside utils.mjs. A macro author gets a stack trace pointing at the module's
 * internals and no hint that the mistake was theirs, one frame up.
 *
 * So every API function that takes an actor positionally now accepts either.
 * The set is derived from the functions themselves rather than hand-listed: a
 * parameter literally named `actor` is the module's own convention, used
 * consistently across all 117 of them, and deriving it means a function added
 * next year is covered without anybody remembering to update a list.
 *
 * This reads function source, which is safe here for a specific reason: the
 * module ships as plain ES modules with no build step and no minifier, so
 * parameter names survive to runtime. If that ever stops being true the parse
 * fails, `wrap` returns the function untouched, and the API goes back to
 * behaving exactly as it does today — strictly no worse.
 * ========================================================================== */

/** An Actor from a document, an id, or a name. `null` when it is none of them. */
function asActor(value) {
    if (!value) return value ?? null;
    if (typeof value !== "string") return value;
    return game.actors.get(value) ?? game.actors.getName(value) ?? null;
}

/** Which positional parameter, if any, is the actor. */
function actorPosition(fn) {
    try {
        const src = Function.prototype.toString.call(fn);
        const open = src.indexOf("(");
        if (open < 0) return -1;
        const params = src.slice(open + 1, src.indexOf(")", open));
        // Destructured or defaulted parameters are left alone: `{actorId}` is an
        // options bag, not an actor, and must not be coerced.
        if (params.includes("{")) {
            const flat = params.split(",").map(p => p.trim());
            return flat[0] === "actor" ? 0 : -1;
        }
        return params.split(",").map(p => p.split("=")[0].trim()).indexOf("actor");
    } catch {
        return -1;
    }
}

function wrap(fn) {
    const at = actorPosition(fn);
    if (at < 0) return fn;
    const wrapped = function (...args) {
        if (args.length > at) args[at] = asActor(args[at]);
        return fn.apply(this, args);
    };
    // Keep the name, so `actorPosition` on a re-wrapped object and any logging
    // that reads it still say something true.
    Object.defineProperty(wrapped, "name", { value: fn.name, configurable: true });
    return wrapped;
}

/** The same object, with every actor-taking entry made forgiving. */
function normalise(api) {
    const out = {};
    for (const [key, value] of Object.entries(api)) {
        out[key] = typeof value === "function" ? wrap(value) : value;
    }
    return out;
}

export function registerApi() {
    game.drpg = normalise(DrpgApi);
    log(`API ready on game.drpg — system: ${game.system.id} ${game.system.version}, Foundry: ${game.version}`);
}
