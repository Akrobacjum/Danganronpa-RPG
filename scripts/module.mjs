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
import { runMigrationOnLoad } from "./migrate.mjs";
import { registerSfx } from "./sfx.mjs";
import { registerPrivateRolls } from "./private-rolls.mjs";
import { registerSearchTokenSocket } from "./search-tokens.mjs";
import { registerSheetTweaks } from "./sheet.mjs";
import { registerAnonymity } from "./anonymity.mjs";
import { registerActionResource } from "./resources.mjs";
import { registerGmPanel } from "./gm-panel.mjs";
import { registerHud } from "./hud.mjs";
import { registerPlayerStatus } from "./player-status.mjs";
import { registerDespair } from "./despair.mjs";
import { registerDespairAwards } from "./despair-award.mjs";
import { registerMovement } from "./movement.mjs";
import { registerProjectsUi } from "./projects-ui.mjs";
import { registerGmBridge } from "./gm-bridge.mjs";
import { registerInventoryLimits } from "./inventory.mjs";
import { registerTruthBullets } from "./truth-bullets.mjs";
import { registerTrial } from "./trial.mjs";
import { registerMurder } from "./murder.mjs";
import { registerTrialFloor } from "./trial-floor.mjs";
import { registerVote } from "./vote.mjs";
import { registerMastermind } from "./mastermind.mjs";
import { registerResourceGuard } from "./resource-guard.mjs";
import { registerStates } from "./states.mjs";
import { registerVisibility } from "./visibility.mjs";
import { registerFog } from "./fog.mjs";
import { registerIsoShield } from "./iso-shield.mjs";
import { registerRemnantRings } from "./remnant-ring.mjs";
import { registerRemnantIcons } from "./remnant-icons.mjs";
import { registerRemnantLedger } from "./remnants.mjs";
import { registerSecrets } from "./secret.mjs";
import { registerDaySummary } from "./day-summary.mjs";
import { registerRollDialog } from "./roll-dialog.mjs";
import { registerForcedRolls } from "./forced-roll.mjs";
import { registerEclipse } from "./eclipse.mjs";
import { registerMonokuma } from "./monokuma.mjs";
import { registerMessenger } from "./messenger.mjs";
import { registerMessengerUi } from "./messenger-app.mjs";
import { registerVoice } from "./voice.mjs";
import { registerVoiceClient } from "./voice-client.mjs";
import { registerMusic } from "./music.mjs";
import { registerCameraView } from "./camera-view.mjs";
import { registerPopups } from "./popup.mjs";
import { registerStacking } from "./stacking.mjs";
import { registerNoCollapse } from "./no-collapse.mjs";
import { registerNoScrollingText } from "./no-scrolling-text.mjs";
import { registerCriticalRule } from "./critical.mjs";
import { registerExplainers } from "./explain.mjs";
import { registerMotion } from "./motion.mjs";
import { registerSafeword } from "./safeword.mjs";
import { registerDiceSync } from "./dice-sync.mjs";
import { registerSync } from "./sync.mjs";
import { registerTraps } from "./traps.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { registerApi } from "./api.mjs";
import { requirementsMet, announceMissingRequirements } from "./requirements.mjs";
import { warnAboutPageTinting, verifyStylesheet } from "./diagnostics.mjs";
import { log, error, injectSelectPickerSkin } from "./utils.mjs";

/** Minimum Daggerheart version this layer was written against. */
const REQUIRED_SYSTEM = "daggerheart";
const REQUIRED_SYSTEM_VERSION = "2.6.0";

/**
 * Register one subsystem without letting it take the others down.
 *
 * These used to run as a bare sequence, which made the list an accidental
 * dependency chain: anything that threw — a renamed hook, a system version that
 * builds a config table differently — silently prevented every registration
 * *after* it. The failure never looked like what it was, because the symptom
 * was whichever features happened to sit lower in the list.
 */
function safely(label, fn) {
    try {
        fn();
    } catch (err) {
        error(`Could not register ${label}; the rest of the module continues.`, err);
    }
}

Hooks.once("init", () => {
    // FOUR MODULES ARE NOT OPTIONAL — see requirements.mjs, and the
    // `relationships.requires` block in module.json that this reads.
    //
    // Nothing registers when one of them is missing or switched off. Half of
    // this layer on isometric maps that are not being projected, with dice
    // nobody can see, is worse than an honest stop: the table would spend the
    // evening working around symptoms rather than ticking one checkbox.
    // Nothing is written on this path, so enabling them and reloading is the
    // whole of the repair.
    if (!requirementsMet()) {
        log("Not starting: a required module is missing or disabled.");
        return;
    }

    log("Initialising the Danganronpa RPG layer.");

    // Settings first and unguarded: every other subsystem reads them, so if this
    // cannot run there is nothing worth continuing to.
    registerSettings();

    // A paint-path workaround, not decoration — see the note on the function.
    safely("the select picker skin", injectSelectPickerSkin);
    safely("private rolls", registerPrivateRolls);
    safely("sheet tweaks", registerSheetTweaks);
    safely("anonymity", registerAnonymity);
    safely("the GM panel", registerGmPanel);
    safely("the campaign HUD", registerHud);
    // The personal counterpart to the HUD: actions, free Move and Hope, pinned
    // above the Projects tray. See player-status.mjs.
    safely("the player status strip", registerPlayerStatus);
    safely("Despair pools", registerDespair);
    safely("Despair awards", registerDespairAwards);
    safely("movement", registerMovement);
    safely("the projects tray", registerProjectsUi);
    safely("inventory limits", registerInventoryLimits);
    safely("the resource guard", registerResourceGuard);
    // Registers the Breakdown/Wounded conditions on `setup` and takes the two
    // equivalent automations off Daggerheart at `ready`.
    safely("Breakdown and Wounded", registerStates);
    safely("room visibility", registerVisibility);
    safely("the fog of war", registerFog);
    safely("the isometric token shield", registerIsoShield);
    safely("Remnant rings", registerRemnantRings);
    safely("Remnant icons", registerRemnantIcons);
    safely("day summary", registerDaySummary);
    safely("the roll dialog lock", registerRollDialog);
    safely("forced rolls", registerForcedRolls);
    safely("the Eclipse", registerEclipse);
    safely("Monokumas", registerMonokuma);
    // Before the messenger, whose arrival chime is now a mapped event. Only a
    // hook goes up here — `playSfx` is a plain function and works whether or
    // not this ran, which is the point: a chime must never be able to take a
    // subsystem down with it.
    safely("the sound engine", registerSfx);
    safely("the messenger", registerMessenger);
    safely("the messenger UI", registerMessengerUi);
    safely("regional voice", registerVoice);
    // The receiving half, on every client. Separate from the deciding half
    // above because a player has to be able to apply a room and to ask which
    // one they belong in — see voice-client.mjs.
    safely("the voice client", registerVoiceClient);
    // Playlists are world documents, so one client driving them is heard by
    // everyone — no socket, unlike voice. See music.mjs.
    safely("the music", registerMusic);
    safely("the camera dock", registerCameraView);
    // Before anything that can open a window. The motion layer only listens —
    // it adds no state and holds no reference — but a window that renders
    // before the hook exists simply appears, and the first window of a session
    // is the one worth getting right.
    safely("the motion layer", registerMotion);
    safely("popups", registerPopups);
    // After popups, before anything that opens one: every module prompt is
    // something the game is waiting on, so none of them may end up under the
    // sheet that launched them. See stacking.mjs.
    safely("window stacking", registerStacking);
    safely("the double-click collapse block", registerNoCollapse);
    // Patches a canvas prototype, so it has to be in place before the first
    // canvas is drawn — and it holds no per-canvas state, so `init` is early
    // enough and every later scene inherits it.
    safely("the token caption block", registerNoScrollingText);
    // One delegated listener on the document, so it outlives every redraw the
    // four panels do on their own — see explain.mjs.
    safely("the panel explanations", registerExplainers);
    // After popups, because the safeword raises one. This is the safety tool —
    // it registers early and depends on nothing that can fail.
    safely("the safeword", registerSafeword);
    // After popups: a presented Truth Bullet becomes one, so the container has
    // to exist by the time the first card lands.
    safely("the Class Trial", registerTrial);
    safely("the trial floor", registerTrialFloor);
    // Watches for somebody walking into an incident — the guide's "automatyczny,
    // darmowy wybór" for a third party, which until now waited on a GM noticing.
    safely("the murder watch", registerMurder);

    // The system builds CONFIG.DH during its own init hook. Systems load before
    // modules, so this normally succeeds here; `setup` is the safety net.
    safely("the Actions resource", registerActionResource);
});

Hooks.once("setup", () => {
    if (!requirementsMet()) return;
    safely("the Actions resource", registerActionResource);
    /*
     * What a critical pays (G-16). At `setup` rather than `init`, because it
     * patches `game.system.api.dice.DualityRoll` and the system builds that
     * during its OWN init — a module init hook can land before it does. Every
     * init hook has run by now and nobody has rolled anything yet, so this is
     * both late enough to find the class and early enough to matter.
     */
    safely("the critical rule", registerCriticalRule);
});

Hooks.once("ready", () => {
    // The one thing this layer still does when it is not running: say so, now
    // that there is an interface to say it in.
    if (!requirementsMet()) {
        announceMissingRequirements().catch(err =>
            error("Could not announce the missing modules", err));
        return;
    }

    // First, and before anything below reads a saved shape: bring this world's
    // data up to the shape this build expects. Primary GM only, silent when
    // there is nothing to do, and deliberately NOT awaited — a slow pass must
    // not hold the interface shut. The consequence is written down where the
    // clauses live: a clause that repairs something one of the passes below has
    // already read is responsible for asking that pass to run again.
    safely("the 1.2.0 migration", runMigrationOnLoad);

    // Before anything that reads a Remnant: the ledger asks the other GMs for
    // anything this browser is missing, and a GM who joins mid-session must not
    // spend the first minute unable to read their own crime scene.
    safely("the Remnant ledger", registerRemnantLedger);
    // Before anything that can whisper. The socket listener and the render hook
    // are what turn a stub back into a sentence, and a card that arrives before
    // they exist would show a dash until the next redraw.
    safely("private cards", registerSecrets);
    safely("the API", registerApi);
    // Before the other socket listeners: this is the one that carries world-state
    // changes to the players. Without it `broadcast()` emits into a socket nobody
    // is listening on, and the clock, the Eclipse and every Despair Call
    // restriction advance on the GM's screen alone.
    safely("world-state sync", registerSync);
    safely("the search-token socket", registerSearchTokenSocket);
    // Five listeners for the eight watched triggers — see traps.mjs. Registered
    // after the sync socket because two of them react to world-state events
    // that arrive over it, and the listener has to exist before the event does.
    safely("the trap watchers", registerTraps);
    safely("the GM bridge", registerGmBridge);
    // After the API, because the migration it kicks off reads the clock, and
    // after the other socket listeners for the same reason they are ordered:
    // the GM-to-GM ledger sync is a socket conversation like any other.
    safely("Truth Bullets", registerTruthBullets);
    // After the other socket listeners: a ballot is addressed to the GMs and
    // tallied in memory, so it needs the socket up and nothing else.
    safely("the vote", registerVote);
    // Same requirements as Truth Bullets: needs the socket and `game.users`
    // populated, and asks the other GMs for the pick if this browser has none.
    safely("the Mastermind", registerMastermind);
    safely("dice appearance sync", registerDiceSync);
    safely("body classes", applyBodyClasses);
    safely("the system check", verifySystem);
    // After the body classes, so the check sees the interface as it will be
    // drawn rather than as Foundry left it.
    safely("the page-tinting check", warnAboutPageTinting);
    // After the body classes for the same reason, and after the tinting check
    // because a repainted page is the louder problem of the two.
    safely("the stylesheet check", verifyStylesheet);
    safely("project secrecy", sealProjects);
    safely("bedroom keys", issueMissingKeys);
    safely("the Remnant actor", reconcileRemnantActorOnLoad);
    safely("item table wording", refreshTableCopyOnLoad);
});

/**
 * Bring installed item tables up to today's wording — see `refreshTableCopy`.
 *
 * A world already in play keeps the names and blurbs it was built with, so a
 * relabelled resource goes on showing the old word in the tables sidebar long
 * after every other surface has moved on. Silent, GM-only, and writes nothing
 * when there is nothing to change.
 */
function refreshTableCopyOnLoad() {
    if (!game.user.isGM) return;

    import("./tables.mjs")
        .then(m => m.refreshTableCopy())
        .catch(err => error("Could not bring the item tables' wording up to date", err));
}

/**
 * A trace a player has copied must open when they double-click it.
 *
 * Same shape and same reason as `issueMissingKeys` below: the actor every
 * Remnant token is built from was created with no player access at all, so the
 * per-player card was unreachable in every world that already exists. See
 * `reconcileRemnantActor` in remnants.mjs.
 */
function reconcileRemnantActorOnLoad() {
    if (!game.user.isGM) return;

    import("./remnants.mjs")
        .then(m => m.reconcileRemnantActor())
        .catch(err => error("Could not reconcile the Remnant actor", err));
}

/**
 * Every bedroom's owner holds the key to it — checked on load, not on change.
 *
 * The same reasoning as `sealProjects` right below: this is a statement about
 * how the world should look, and the world can arrive at load in a state that
 * predates the rule. Rooms assigned before keys existed are exactly that state,
 * and no amount of re-saving Room Setup would have reached them, because that
 * screen only acts on rows whose flags changed.
 *
 * Silent, and writes nothing when nothing is missing.
 */
function issueMissingKeys() {
    if (!game.user.isGM) return;

    import("./vault.mjs")
        .then(m => m.reconcileBedroomKeys())
        .catch(err => error("Could not issue the missing bedroom keys", err));
}

/**
 * Re-apply secrecy to every project that claims to be secret.
 *
 * Two reasons this cannot be a one-off at creation. Projects made before the
 * ownership rules were understood carry a `default: 0` that Daggerheart ignores,
 * so they are still on show. And the ownership map only ever lists the users who
 * existed when it was written — a player added to the world later has no entry,
 * Daggerheart falls back to the world default of OBSERVER, and they can read
 * somebody's murder plan. Running this on load and whenever a user appears keeps
 * that window shut.
 */
function sealProjects() {
    if (!game.user.isGM) return;

    const reseal = () => import("./projects.mjs")
        .then(m => m.resealSecretProjects())
        .catch(err => error("Could not re-seal the secret projects", err));

    reseal();
    Hooks.on("createUser", reseal);
}

/**
 * Toggles that CSS keys off. Kept on `body` rather than on any one widget so a
 * UI module reshuffling the interface cannot detach them.
 */
function applyBodyClasses() {
    document.body.classList.toggle("drpg-hide-system-fear", getSetting(SETTINGS.hideSystemFear));
    document.body.classList.toggle("drpg-pixel-font", getSetting(SETTINGS.pixelFont));
    // CSS uses this to make Hope and traits display-only for players.
    document.body.classList.toggle("drpg-gm", game.user.isGM);
    /*
     * THE SAME FACT, STATED POSITIVELY, and it is not redundant.
     *
     * A rule written as `body:not(.drpg-gm)` is true of every client for the
     * two seconds before this function runs — including a GM's. Anything it
     * hides therefore flashes off and back on while their world loads, and the
     * first thing to want this was `#sidebar`, which is not a small thing to
     * blink. `body.drpg-player` is false until it is known to be true, so a
     * player's interface settles into place instead of a GM's jumping.
     */
    document.body.classList.toggle("drpg-player", !game.user.isGM);
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
