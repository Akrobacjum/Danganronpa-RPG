/**
 * Danganronpa RPG — module entry point.
 * ---------------------------------------------------------------------------
 * A thin layer on top of the Daggerheart system (Foundryborne) that turns it
 * into the Danganronpa RPG System described in the full guide.
 *
 * This file only wires things together. The actual work lives in:
 *   config.mjs         every rule, threshold and table from the guide
 *   settings.mjs       world settings
 *   private-rolls.mjs  players never see each other's dice
 *   search-tokens.mjs  three search tokens per room, per time of day
 *   api.mjs            game.drpg — the surface macros are allowed to call
 */

import { MODULE_ID } from "./config.mjs";
import { registerSettings } from "./settings.mjs";
import { registerPrivateRolls } from "./private-rolls.mjs";
import { registerSearchTokenSocket } from "./search-tokens.mjs";
import { registerSheetTweaks } from "./sheet.mjs";
import { registerAnonymity } from "./anonymity.mjs";
import { registerActionResource } from "./resources.mjs";
import { registerGmPanel } from "./gm-panel.mjs";
import { registerHud } from "./hud.mjs";
import { registerDespair } from "./despair.mjs";
import { registerDespairAwards } from "./despair-award.mjs";
import { registerMovement } from "./movement.mjs";
import { registerProjectsUi } from "./projects-ui.mjs";
import { registerGmBridge } from "./gm-bridge.mjs";
import { registerInventoryLimits } from "./inventory.mjs";
import { registerResourceGuard } from "./resource-guard.mjs";
import { registerVisibility } from "./visibility.mjs";
import { registerRollDialog } from "./roll-dialog.mjs";
import { registerForcedRolls } from "./forced-roll.mjs";
import { registerEclipse } from "./eclipse.mjs";
import { registerMonokuma } from "./monokuma.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { registerApi } from "./api.mjs";
import { log, error } from "./utils.mjs";

/** Minimum Daggerheart version this layer was written against. */
const REQUIRED_SYSTEM = "daggerheart";
const REQUIRED_SYSTEM_VERSION = "2.6.0";

Hooks.once("init", () => {
    log("Initialising the Danganronpa RPG layer.");
    registerSettings();
    registerPrivateRolls();
    registerSheetTweaks();
    registerAnonymity();
    registerGmPanel();
    registerHud();
    registerDespair();
    registerDespairAwards();
    registerMovement();
    registerProjectsUi();
    registerInventoryLimits();
    registerResourceGuard();
    registerVisibility();
    registerRollDialog();
    registerForcedRolls();
    registerEclipse();
    registerMonokuma();

    // The system builds CONFIG.DH during its own init hook. Systems load before
    // modules, so this normally succeeds here; `setup` is the safety net.
    registerActionResource();
});

Hooks.once("setup", () => {
    registerActionResource();
});

Hooks.once("ready", () => {
    registerApi();
    registerSearchTokenSocket();
    registerGmBridge();
    applyBodyClasses();
    verifySystem();
});

/**
 * Toggles that CSS keys off. Kept on `body` rather than on any one widget so a
 * UI module reshuffling the interface cannot detach them.
 */
function applyBodyClasses() {
    document.body.classList.toggle("drpg-hide-system-fear", getSetting(SETTINGS.hideSystemFear));
    document.body.classList.toggle("drpg-pixel-font", getSetting(SETTINGS.pixelFont));
    // CSS uses this to make Hope and traits display-only for players.
    document.body.classList.toggle("drpg-gm", game.user.isGM);
}

/**
 * Refuse to pretend everything is fine on the wrong system. The whole layer
 * assumes Daggerheart's duality roll, Hope/Fear pools and trait keys.
 */
function verifySystem() {
    if (game.system.id !== REQUIRED_SYSTEM) {
        const msg = game.i18n.format("DRPG.Errors.wrongSystem", { found: game.system.id });
        error(msg);
        if (game.user.isGM) ui.notifications.error(msg, { permanent: true });
        return;
    }

    const tooOld = foundry.utils.isNewerVersion(REQUIRED_SYSTEM_VERSION, game.system.version);
    if (tooOld && game.user.isGM) {
        ui.notifications.warn(game.i18n.format("DRPG.Errors.oldSystem", {
            required: REQUIRED_SYSTEM_VERSION,
            found: game.system.version
        }));
    }
}

export { MODULE_ID };
