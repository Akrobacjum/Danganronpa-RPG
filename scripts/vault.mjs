/**
 * Danganronpa RPG - the stash's facade.
 * ---------------------------------------------------------------------------
 * THE FACADE (E41 C6, 1.2.97). This file holds no code. The rooms' flags and
 * the bedroom keys, a room's table, picture and favours, the stashes' record
 * and the marks of a stash found, with the account of the stash this header
 * held, moved to vault-store.mjs; what a character does at a stash and what a
 * GM judges of it - stowing, retrieving, the rifle, a theft from a stash, a
 * Find Stash and the GMs' inspector - to stash-reach.mjs; the GM's side of a
 * Palm (a theft from a person and a plant, and the pockets they read) to
 * palm.mjs, beside the player's half E41 C4 put there; and Room Setup, with the
 * Passages tab's row and its `import()` of passages-tab.mjs, to room-setup.mjs.
 * Each moved by a pure move that `node tools/moved-only.mjs` proves.
 *
 * This file keeps its name and every name it exported - fifty-one of
 * vault-store.mjs's, thirteen of stash-reach.mjs's, four of palm.mjs's and five
 * of room-setup.mjs's, re-exported below - so every importer still imports
 * vault.mjs but fog.mjs and fog-diagnostics.mjs, which import vault-store.mjs
 * (palm.mjs reaches both statically, and through this file's re-export of it
 * either import would be a static cycle, R161), and none of the four imports
 * it. New code goes into the file of its role, never here: a flag, a key, a
 * room's record or a stash's, into vault-store.mjs; what a character does at a
 * stash or a GM judges of one, into stash-reach.mjs; a Palm's either half, into
 * palm.mjs; Room Setup, into room-setup.mjs.
 */

export {
    VAULT_FLAGS, KEY_FLAG, keyRoomOf, keysHeldBy, mayEnterBedroom, grantBedroomKey, bedroomKeyKey, reconcileBedroomKeys,
    takeOldOwnersKeys, roomTable, roomDescription, safeRoomImage, roomImage, roomFavours, favoursCategory, roomHinders,
    hindersCategory, regionsByName, vaultOwnerOf, stashesIn, stashIn, stashRoomsFor, primaryStashRoom,
    setStash, ensureBedroomStash, bedroomStashGaps, forgetAllStashesFound, unconcealStashes, startLocked, isConcealed,
    vaultRoomFor, stashRoomOfItem, stashItemsIn, allBedrooms, allBedroomsAnywhere, bedroomOwnerAnywhere,
    carryRoomOnSheets, sharedRooms, roomCensusOf, roomCensus, roomRatioLine, roomsWantedFor, allVaults, setVaultRoom,
    registerRoomPieces, bedroomsOfNewScene, clearSplitPiece, vaultContents, hasFoundStash, stashesFoundBy
} from "./vault-store.mjs";
export {
    myStashHere, stow, tellNotHere, retrieve, openStashesHere, openStashHere, rifleStashDialog, rifleKey,
    rifleMark, stealFromVault, resolveStashSearch, openVaultInspector
} from "./stash-reach.mjs";
export { pocketsAsHeld, pocketsFrom, stealFromPerson, plantOnPerson } from "./palm.mjs";
export { ROOM_SETUP_TABS, roomSetupTab, wireRoomRatio, setApplyBlock, openRoomSetupDialog } from "./room-setup.mjs";
