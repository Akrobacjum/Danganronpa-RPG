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
    renderDespair
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
import { openAssignmentDialog } from "./assignment-dialog.mjs";
import { diagnoseDice, diagnoseDespair } from "./diagnostics.mjs";
import { performAction, currentRoom } from "./action-rolls.mjs";
import { installTables, drawItem, randomItem, tableName } from "./tables.mjs";
import { roomOfActor, roomOfToken, othersInRoom, allRooms, neighbouringRooms, occupantsOf } from "./movement.mjs";
import { applyAll as refreshRoomVisibility, visibleCharacters } from "./visibility.mjs";
import { remnantData, reportRemnants } from "./remnants.mjs";
import {
    allProjects, projectsAvailableIn, addProgress, setProjectMeta,
    makeSecret, shareWith, unshareWith, revealProject, isSecret, viewersOf
} from "./projects.mjs";
import { openProjectManager, openShareDialog } from "./projects-ui.mjs";
import { callGm } from "./gm-bridge.mjs";
import { takeRest, roomAllows, restRooms, setRestRoom, openRestRoomsDialog } from "./rest.mjs";
import {
    dropRemnant, placeRemnant, remnantsOn, remnantsInRoom,
    revealRemnant, removeRemnant, clearFaintRemnants
} from "./remnants.mjs";
import { grantItem, canCarry, countInCategory, itemsInCategory, inventorySummary } from "./inventory.mjs";
import { installHandbook } from "./handbook.mjs";
import { isMonokuma, setMonokuma, monokumaActors, studentActors, poolUserFor } from "./monokuma.mjs";
import { spendHopeCall, spendDespairCallFor, hopeHeld, affordableHopeCalls, despairCallsFor } from "./calls.mjs";
import { startEclipse, endEclipse, isEclipse, movesLeft, placementStatus } from "./eclipse.mjs";
import { createProject, deleteProject } from "./projects.mjs";
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

    /** Write the guide's starting resources onto an actor: HP 4, Stress 6, Hope 2. */
    initCharacter,

    /** Read/write the Ultimate shown under the character's name. */
    getUltimate,
    setUltimate,

    /** Every Ultimate that appears on more than one character this season. */
    findDuplicateUltimates,

    /** Resource readers. HP and Stress are reverse resources — see character.mjs. */
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
    renderDespair,

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

    /** Open the division dialog (also the gear on the Despair widget). */
    assignStudents: openAssignmentDialog,

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
    projectsAvailableIn,
    addProgress,
    setProjectMeta,
    createProject,
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

    /** Chapter end: clear Faint Remnants that are not reinforced. */
    clearFaintRemnants,

    /** Put a found item on a character, respecting the guide's carry limits. */
    grantItem,
    canCarry,
    countInCategory,
    itemsInCategory,
    inventorySummary,

    /** Item pools and the RollTables built from them. */
    installTables,
    drawItem,
    randomItem,
    tableName,

    /* ---- diagnostics --------------------------------------------------- */

    /** Why are the dice unskinned? Why is no Despair being awarded? */
    diagnoseDice,
    diagnoseDespair,

    /* ---- Monokumas ----------------------------------------------------- */

    /** A Monokuma is a character actor with a flag: no actions, no Hope. */
    isMonokuma,
    setMonokuma,
    monokumaActors,
    studentActors,

    /** Which GM's Despair pool a Monokuma actor draws on. */
    poolUserFor,

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

    /* ---- documentation -------------------------------------------------- */

    /**
     * Build the in-world handbook: how to set up a season, where every control
     * lives, and how to add your own items. Also on the GM panel.
     */
    installHandbook,

    /* ---- actions ------------------------------------------------------- */

    /** 2 per time of day, or 1 while all HP is marked. */
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

    /* ---- misc ---------------------------------------------------------- */

    resolveThreshold,
    clamp,

    settings: {
        keys: SETTINGS,
        get: getSetting,
        set: setSetting
    }
};

export function registerApi() {
    game.drpg = DrpgApi;
    log(`API ready on game.drpg — system: ${game.system.id} ${game.system.version}, Foundry: ${game.version}`);
}
