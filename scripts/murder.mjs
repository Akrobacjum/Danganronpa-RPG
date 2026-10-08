/**
 * Danganronpa RPG - the murder engine's facade.
 * ---------------------------------------------------------------------------
 * THE FACADE (E34, 1.2.70). This file holds no code. The incident's record and
 * its roads - the world half and the cast, the copies of the cast each
 * participant is sent, the queue every write runs in and the one write of both
 * halves, the cast's socket, who is in it, the betrayal window that write arms,
 * the opening's notices, the deaths a player may know and their socket, the
 * Blackened register, and the cast put back by hand or lifted out of world data -
 * moved to incident-store.mjs; the rules of the three stages, with the account
 * of them this header held, to murder-rules.mjs; and the murder window and the GM's
 * tracker to murder-ui.mjs, each by a pure move that `node tools/moved-only.mjs`
 * proves. It keeps its name and every name it exported - thirty-three of
 * incident-store.mjs's, thirty-one of murder-rules.mjs's and three of
 * murder-ui.mjs's, re-exported below - so every importer still imports murder.mjs,
 * and none of the three imports it. New code goes into the file of its role, never
 * here: what reads or writes the cast, the world half or the queue, or sends or
 * takes the cast or the deaths, into incident-store.mjs; what only the window or
 * the tracker uses, into murder-ui.mjs; any other rule of the incident, into
 * murder-rules.mjs.
 */

export {
    PUBLIC_INCIDENT, splitIncident, murderState, castFieldsToWrite, incidentAudienceIds, castFor, castPacket,
    retellCast, clearBetrayalOffer, swungWeaponOf, sideOf, killerIds, participantIds, incidentKnowers, knowsOfDeath,
    deathsFor, sendDeathsTo, tellDeaths, retellDeaths, receiveDeaths, tellFinder, enterCast, liftIncidentSecrets,
    liftIncidentMethod, liftIncidentFight, blackenedIds, trialBlackenedIds, countsAtTrial, whenTrialReadable,
    trialBlackenedActors, leftABody, blackenedWrites, clearBlackened
} from "./incident-store.mjs";
export {
    isTheirTurn, crisisTileLabel, freeResolutionFor, crisisSituational, availableCrisisActions, atNight,
    freshIncidentState, openMurder, resolveKillerOpening, resolveVictimOpening, crisisRefusal, crisisUndoRefusal,
    crisisVariant, takeCrisisAction, resolveCrisisAction, refOf, crisisKilled, beginResolution, spendFreeCleanup,
    passTurn, registerMurder, thirdPartyEnters, endMurder, betrayalTarget, betrayAsPlayer, openParkedBetrayal,
    takeDeclaredBetrayal, rollOpening, closeOpeningRoll, throwOpeningRoll, resolveOpening
} from "./murder-rules.mjs";
export { openMurderDialog, incidentTrackerHtml, openIncidentTracker } from "./murder-ui.mjs";
